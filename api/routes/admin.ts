import { Router, type Request, type Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'

const router = Router()

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Admin cleanup failed'

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) return null
  return new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
}

const hasServiceRoleKey = () => Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY,
)

const requireAdmin = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    res.status(401).json({ error: 'Missing admin session.' })
    return null
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)

  if (authError || !authData.user) {
    res.status(401).json({ error: 'Invalid admin session.' })
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    res.status(403).json({ error: 'Only admins can delete registration data.' })
    return null
  }

  return authData.user
}

const storagePathFromPublicUrl = (url?: string | null) => {
  if (!url) return null
  const marker = '/storage/v1/object/public/'
  const markerIndex = url.indexOf(marker)
  if (markerIndex === -1) return null

  const bucketAndPath = url.slice(markerIndex + marker.length).split('?')[0]
  const [bucket, ...pathParts] = bucketAndPath.split('/')
  const path = decodeURIComponent(pathParts.join('/'))

  return bucket && path ? { bucket, path } : null
}

const removeStorageObjects = async (objects: Array<{ bucket: string, path: string }>) => {
  const grouped = objects.reduce<Record<string, string[]>>((acc, object) => {
    if (!object.bucket || !object.path) return acc
    acc[object.bucket] = acc[object.bucket] || []
    acc[object.bucket].push(object.path)
    return acc
  }, {})

  for (const [bucket, paths] of Object.entries(grouped)) {
    const uniquePaths = [...new Set(paths)]
    if (uniquePaths.length > 0) {
      const { error } = await supabase.storage.from(bucket).remove(uniquePaths)
      if (error) console.warn(`Storage cleanup skipped for ${bucket}:`, error.message)
    }
  }
}

const cancelSubscriptionIfPresent = async (subscriptionId?: string | null) => {
  if (!subscriptionId) return
  const stripe = getStripeClient()
  if (!stripe) return

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.status !== 'canceled') {
      await stripe.subscriptions.cancel(subscriptionId)
    }
  } catch (error) {
    console.warn(`Stripe subscription cleanup skipped for ${subscriptionId}:`, getErrorMessage(error))
  }
}

const deletePlayerRecord = async (playerId: string) => {
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()

  if (playerError || !player) {
    throw new Error(playerError?.message || 'Player not found.')
  }

  await cancelSubscriptionIfPresent(player.stripe_subscription_id)

  const playerName = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim()
  const [firstName = '', ...lastParts] = playerName.split(/\s+/).filter(Boolean)
  const lastName = lastParts.join(' ')

  const { data: registrations } = await supabase
    .from('registrations')
    .select('*')
    .or(`player_id.eq.${playerId},checkout_player_id.eq.${playerId}`)

  const fallbackRegistrationQuery = player.parent_id && (player.first_name || firstName)
    ? await supabase
        .from('registrations')
        .select('*')
        .eq('parent_id', player.parent_id)
        .eq('first_name', player.first_name || firstName)
        .eq('last_name', player.last_name || lastName)
    : { data: [] }

  const allRegistrations = [...(registrations || []), ...((fallbackRegistrationQuery.data as unknown[]) || [])]
  const registrationIds = [...new Set(allRegistrations.map((registration: any) => registration.id).filter(Boolean))]

  const storageObjects = [
    storagePathFromPublicUrl(player.photo_url),
    ...allRegistrations.flatMap((registration: any) => [
      storagePathFromPublicUrl(registration.photo_url),
      registration.birth_cert_path && registration.birth_cert_path !== 'not_provided'
        ? { bucket: 'birth_certificates', path: registration.birth_cert_path }
        : null,
    ]),
  ].filter(Boolean) as Array<{ bucket: string, path: string }>

  await removeStorageObjects(storageObjects)

  if (registrationIds.length > 0) {
    await supabase.from('registrations').delete().in('id', registrationIds)
  }

  const { error: deleteError } = await supabase.from('players').delete().eq('id', playerId)
  if (deleteError) throw new Error(deleteError.message)

  return { player, deletedRegistrations: registrationIds.length }
}

router.delete('/players/:playerId', async (req, res): Promise<void> => {
  try {
    if (!hasServiceRoleKey()) {
      res.status(503).json({ error: 'Full deletion requires SUPABASE_SERVICE_ROLE_KEY on the server.' })
      return
    }

    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const playerId = String(req.params.playerId || '').trim()
    if (!playerId) {
      res.status(400).json({ error: 'Missing player id.' })
      return
    }

    const result = await deletePlayerRecord(playerId)
    res.json({
      success: true,
      message: 'Player, linked registration records, payment references, and uploaded player files were deleted.',
      deletedRegistrations: result.deletedRegistrations,
    })
  } catch (error) {
    console.error('Player deletion failed:', error)
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

router.delete('/parents/:parentId', async (req, res): Promise<void> => {
  try {
    if (!hasServiceRoleKey()) {
      res.status(503).json({ error: 'Full parent deletion requires SUPABASE_SERVICE_ROLE_KEY on the server.' })
      return
    }

    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const parentId = String(req.params.parentId || '').trim()
    if (!parentId) {
      res.status(400).json({ error: 'Missing parent id.' })
      return
    }

    const { data: parent, error: parentError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', parentId)
      .single()

    if (parentError || !parent) {
      res.status(404).json({ error: parentError?.message || 'Parent not found.' })
      return
    }

    if (['admin', 'coach'].includes(parent.role)) {
      res.status(400).json({ error: 'Admins and coaches are protected and were not deleted.' })
      return
    }

    const { data: players } = await supabase.from('players').select('id').eq('parent_id', parentId)
    for (const player of players || []) {
      await deletePlayerRecord(player.id)
    }

    const { data: remainingRegistrations } = await supabase
      .from('registrations')
      .select('*')
      .eq('parent_id', parentId)

    const storageObjects = (remainingRegistrations || []).flatMap((registration: any) => [
      storagePathFromPublicUrl(registration.photo_url),
      registration.birth_cert_path && registration.birth_cert_path !== 'not_provided'
        ? { bucket: 'birth_certificates', path: registration.birth_cert_path }
        : null,
    ]).filter(Boolean) as Array<{ bucket: string, path: string }>

    await removeStorageObjects(storageObjects)
    await supabase.from('registrations').delete().eq('parent_id', parentId)
    await supabase.from('profiles').delete().eq('id', parentId)

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(parentId)
    if (authDeleteError) {
      throw new Error(`Database records were deleted, but Supabase Auth deletion failed: ${authDeleteError.message}`)
    }

    res.json({
      success: true,
      message: `Parent ${parent.email || parentId}, their players, linked registrations, payment references, uploads, and Auth account were deleted.`,
      deletedPlayers: players?.length || 0,
    })
  } catch (error) {
    console.error('Parent deletion failed:', error)
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

export default router
