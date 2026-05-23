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

const activeStripeStatuses = new Set(['active', 'trialing'])

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

const findPlayerSubscription = async (playerId: string, storedSubscriptionId?: string | null) => {
  const stripe = getStripeClient()
  if (!stripe) return null

  if (storedSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(storedSubscriptionId)
      if (subscription && subscription.status !== 'canceled') return subscription
    } catch (error) {
      console.warn(`Stored subscription ${storedSubscriptionId} could not be retrieved:`, getErrorMessage(error))
    }
  }

  try {
    const result = await stripe.subscriptions.search({
      query: `metadata['player_id']:'${playerId}'`,
      limit: 1,
    })
    if (result.data[0]) return result.data[0]
  } catch (error) {
    console.warn('Stripe subscription search failed, falling back to subscription list:', getErrorMessage(error))
  }

  const statuses: Stripe.SubscriptionListParams.Status[] = ['active', 'trialing', 'past_due', 'unpaid', 'canceled']
  for (const status of statuses) {
    const list = await stripe.subscriptions.list({ status, limit: 100 })
    const match = list.data.find((subscription) => subscription.metadata?.player_id === playerId)
    if (match) return match
  }

  return null
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

const splitFullName = (fullName = '') => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

router.patch('/coaches/:coachId', async (req, res): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const coachId = String(req.params.coachId || '').trim()
    if (!coachId) {
      res.status(400).json({ error: 'Missing coach id.' })
      return
    }

    const firstName = String(req.body.first_name || '').trim()
    const lastName = String(req.body.last_name || '').trim()
    const fullName = String(req.body.full_name || `${firstName} ${lastName}`.trim()).trim()
    const splitName = splitFullName(fullName)
    const email = String(req.body.email || '').trim().toLowerCase()
    const role = String(req.body.role || req.body.specialty || 'Coach').trim()
    const bio = String(req.body.bio || '').trim()
    const photoUrl = String(req.body.photo_url || '').trim()
    const teamId = String(req.body.team_id || '').trim()

    if (!fullName) {
      res.status(400).json({ error: 'Coach name is required.' })
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', coachId)
      .single()

    if (profile?.role === 'admin') {
      res.status(400).json({ error: 'Admin accounts cannot be edited from the coach list.' })
      return
    }

    const profileUpdate = {
      first_name: firstName || splitName.firstName,
      last_name: lastName || splitName.lastName,
      full_name: fullName,
      email: email || profile?.email || null,
      role: 'coach',
      photo_url: photoUrl || null,
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: coachId, ...profileUpdate }, { onConflict: 'id' })

    if (profileError) throw new Error(profileError.message)

    if (email && email !== profile?.email) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(coachId, { email })
      if (authUpdateError) {
        throw new Error(`Coach profile saved, but email login update failed: ${authUpdateError.message}`)
      }
    }

    const coachUpdate = {
      id: coachId,
      full_name: fullName,
      name: fullName,
      specialty: role,
      role,
      bio,
      photo_url: photoUrl || null,
      team_id: teamId && teamId !== 'Unassigned' ? teamId : null,
      is_published: true,
    }

    const { error: coachError } = await supabase
      .from('coaches')
      .upsert(coachUpdate, { onConflict: 'id' })

    if (coachError) throw new Error(coachError.message)

    res.json({ success: true, message: 'Coach updated.' })
  } catch (error) {
    console.error('Coach update failed:', error)
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

router.delete('/coaches/:coachId', async (req, res): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const coachId = String(req.params.coachId || '').trim()
    if (!coachId) {
      res.status(400).json({ error: 'Missing coach id.' })
      return
    }

    if (coachId === adminUser.id) {
      res.status(400).json({ error: 'You cannot delete your own admin account from the coach list.' })
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', coachId)
      .single()

    if (profileError || !profile) {
      res.status(404).json({ error: profileError?.message || 'Coach profile not found.' })
      return
    }

    if (profile.role === 'admin') {
      res.status(400).json({ error: 'Admin accounts are protected and were not deleted.' })
      return
    }

    const { data: linkedPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('parent_id', coachId)
      .limit(1)

    const hasFamilyRecords = Boolean(linkedPlayers?.length)

    const { error: coachDeleteError } = await supabase.from('coaches').delete().eq('id', coachId)
    if (coachDeleteError) throw new Error(coachDeleteError.message)

    if (hasFamilyRecords) {
      const { error: downgradeError } = await supabase
        .from('profiles')
        .update({ role: 'user' })
        .eq('id', coachId)

      if (downgradeError) throw new Error(downgradeError.message)

      res.json({
        success: true,
        message: 'Coach role removed. Parent account was kept because this person has linked player records.',
        keptParentAccount: true,
      })
      return
    }

    await removeStorageObjects([
      storagePathFromPublicUrl((req.body && req.body.photo_url) || null),
    ].filter(Boolean) as Array<{ bucket: string, path: string }>)

    await supabase.from('profiles').delete().eq('id', coachId)

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(coachId)
    if (authDeleteError) {
      throw new Error(`Coach database records were deleted, but Supabase Auth deletion failed: ${authDeleteError.message}`)
    }

    res.json({
      success: true,
      message: `Coach ${profile.email || coachId} was deleted from coaches, profile, and Auth login.`,
      keptParentAccount: false,
    })
  } catch (error) {
    console.error('Coach deletion failed:', error)
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

router.post('/players/:playerId/sync-payment', async (req, res): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const playerId = String(req.params.playerId || '').trim()
    if (!playerId) {
      res.status(400).json({ error: 'Missing player id.' })
      return
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()

    if (playerError || !player) {
      res.status(404).json({ error: playerError?.message || 'Player not found.' })
      return
    }

    const subscription = await findPlayerSubscription(playerId, player.stripe_subscription_id)

    if (!subscription) {
      res.json({
        success: true,
        paymentStatus: player.payment_status || 'pending',
        status: player.status || 'pending',
        message: 'No Stripe subscription was found for this player yet. They may not have finished checkout.',
      })
      return
    }

    const paymentStatus = activeStripeStatuses.has(subscription.status)
      ? 'paid'
      : subscription.status === 'canceled'
        ? 'cancelled'
        : subscription.status
    const playerStatus = activeStripeStatuses.has(subscription.status) ? 'active' : player.status || 'pending_payment'
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : null
    const uniformPurchased = subscription.metadata?.uniform_purchased === 'true' || Boolean(player.uniform_purchased)
    const uniformConfirmationCode = subscription.metadata?.uniform_confirmation_code || player.uniform_confirmation_code || null

    const playerUpdate = {
      status: playerStatus,
      payment_status: paymentStatus,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      uniform_purchased: uniformPurchased,
      uniform_confirmation_code: uniformPurchased ? uniformConfirmationCode : null,
    }

    const { error: playerUpdateError } = await supabase
      .from('players')
      .update(playerUpdate)
      .eq('id', playerId)

    if (playerUpdateError) {
      const { error: fallbackError } = await supabase
        .from('players')
        .update({
          status: playerStatus,
          payment_status: paymentStatus,
        })
        .eq('id', playerId)

      if (fallbackError) throw new Error(fallbackError.message)
    }

    const registrationUpdate = {
      status: playerStatus,
      payment_status: paymentStatus,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      uniform_purchased: uniformPurchased,
      uniform_confirmation_code: uniformPurchased ? uniformConfirmationCode : null,
    }

    const { error: registrationError } = await supabase
      .from('registrations')
      .update(registrationUpdate)
      .or(`player_id.eq.${playerId},checkout_player_id.eq.${playerId}`)

    if (registrationError) {
      const playerName = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim()
      const [firstName = '', ...lastParts] = playerName.split(/\s+/).filter(Boolean)
      await supabase
        .from('registrations')
        .update(registrationUpdate)
        .eq('parent_id', player.parent_id)
        .eq('first_name', firstName)
        .eq('last_name', lastParts.join(' '))
    }

    res.json({
      success: true,
      message: activeStripeStatuses.has(subscription.status)
        ? 'Stripe payment is active. Player was marked paid.'
        : `Stripe subscription status is ${subscription.status}. Player payment status was updated.`,
      paymentStatus,
      status: playerStatus,
      subscriptionId: subscription.id,
    })
  } catch (error) {
    console.error('Stripe payment sync failed:', error)
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

router.get('/registrations/:registrationId/birth-certificate-url', async (req, res): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const registrationId = String(req.params.registrationId || '').trim()
    if (!registrationId) {
      res.status(400).json({ error: 'Missing registration id.' })
      return
    }

    const { data: registration, error: registrationError } = await supabase
      .from('registrations')
      .select('birth_cert_path')
      .eq('id', registrationId)
      .single()

    if (registrationError || !registration) {
      res.status(404).json({ error: registrationError?.message || 'Registration not found.' })
      return
    }

    if (!registration.birth_cert_path || registration.birth_cert_path === 'not_provided') {
      res.status(404).json({ error: 'No birth certificate has been uploaded for this player yet.' })
      return
    }

    const { data, error } = await supabase.storage
      .from('birth_certificates')
      .createSignedUrl(registration.birth_cert_path, 60 * 10)

    if (error || !data?.signedUrl) {
      res.status(500).json({ error: error?.message || 'Unable to open birth certificate.' })
      return
    }

    res.json({ success: true, url: data.signedUrl })
  } catch (error) {
    console.error('Birth certificate URL failed:', error)
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

router.delete('/players/:playerId', async (req, res): Promise<void> => {
  try {
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
