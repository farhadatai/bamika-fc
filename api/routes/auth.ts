/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()
const canonicalBaseUrl = 'https://www.bamikafc.com'

const getBaseUrl = () => {
  const candidates = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VITE_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].filter(Boolean)

  for (const value of candidates) {
    try {
      const url = new URL(String(value).startsWith('http') ? String(value) : `https://${value}`)
      const hostname = url.hostname

      if (hostname === 'www.bamikafc.com' || hostname === 'bamikafc.com' || hostname === 'localhost' || hostname === '127.0.0.1') {
        url.pathname = url.pathname.replace(/\/+$/, '')
        url.search = ''
        url.hash = ''
        return url.toString().replace(/\/+$/, '')
      }
    } catch {
      // Try the next configured URL.
    }
  }

  return canonicalBaseUrl
}

const hasServiceRoleKey = () => Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY,
)

const isMissingProfileColumnError = (message?: string) => (
  !!message
  && message.includes('schema cache')
  && message.includes('profiles')
  && (
    message.includes('first_name')
    || message.includes('last_name')
    || message.includes('email')
    || message.includes('photo_url')
  )
)

const isMissingCoachColumnError = (message?: string) => (
  !!message
  && message.includes('schema cache')
  && message.includes('coaches')
  && (
    message.includes('name')
    || message.includes('role')
    || message.includes('full_name')
    || message.includes('specialty')
    || message.includes('photo_url')
  )
)

const normalizeBirthDate = (value: string) => {
  const trimmed = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)

  if (!match) {
    throw new Error('Please choose a valid date of birth before continuing.')
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  if (
    Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error('Please choose a valid date of birth before continuing.')
  }

  return parsed.toISOString()
}

interface CoachDirectoryPlayerRecord {
  id: string
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  status?: string | null
  payment_status?: string | null
  team_assigned?: string | null
  created_at?: string | null
  profiles?: {
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
  } | Array<{
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
  }> | null
}

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
    res.status(403).json({ error: 'Only admins can invite coaches.' })
    return null
  }

  return authData.user
}

const requireCoach = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    res.status(401).json({ error: 'Missing coach session.' })
    return null
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)

  if (authError || !authData.user) {
    res.status(401).json({ error: 'Invalid coach session.' })
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (profileError || profile?.role !== 'coach') {
    res.status(403).json({ error: 'Only coaches can add players from the coach dashboard.' })
    return null
  }

  return authData.user
}

/**
 * User Login
 * POST /api/auth/register
 */
router.post('/register', async (): Promise<void> => {
  // TODO: Implement register logic
})

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', async (): Promise<void> => {
  // TODO: Implement login logic
})

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', async (): Promise<void> => {
  // TODO: Implement logout logic
})

router.get('/coach-player-directory', async (req: Request, res: Response): Promise<void> => {
  try {
    const coachUser = await requireCoach(req, res)
    if (!coachUser) return

    if (!hasServiceRoleKey()) {
      res.status(500).json({ error: 'The limited coach directory requires the server service role key.' })
      return
    }

    const { data: players, error } = await supabase
      .from('players')
      .select('id, full_name, status, payment_status, team_assigned, created_at, profiles:parent_id(first_name, last_name, full_name)')
      .order('created_at', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message || 'Unable to load the club player directory.' })
      return
    }

    const directory = ((players || []) as CoachDirectoryPlayerRecord[]).map((player) => {
      const parent = Array.isArray(player.profiles) ? player.profiles[0] : player.profiles
      const parentName = `${parent?.first_name || ''} ${parent?.last_name || ''}`.trim()
        || parent?.full_name
        || 'Parent not listed'

      // players has no first_name/last_name columns; derive them from full_name
      const playerNameParts = (player.full_name || '').trim().split(/\s+/).filter(Boolean)

      return {
        id: player.id,
        first_name: playerNameParts[0] || '',
        last_name: playerNameParts.slice(1).join(' '),
        full_name: player.full_name || '',
        status: player.status || 'pending',
        payment_status: player.payment_status || 'pending',
        team_assigned: player.team_assigned || 'Unassigned',
        created_at: player.created_at || null,
        parent_name: parentName,
      }
    })

    res.status(200).json({ players: directory })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load the club player directory.'
    res.status(500).json({ error: message })
  }
})

router.post('/invite-coach', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!hasServiceRoleKey()) {
      res.status(500).json({
        error: 'Coach invites require SUPABASE_SERVICE_ROLE_KEY on the server.',
      })
      return
    }

    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const firstName = String(req.body.first_name || '').trim()
    const lastName = String(req.body.last_name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const role = String(req.body.role || 'Coach').trim()
    const bio = String(req.body.bio || '').trim()
    const photoUrl = String(req.body.photo_url || '').trim()

    if (!firstName || !lastName || !email) {
      res.status(400).json({ error: 'First name, last name, and email are required.' })
      return
    }

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: 'coach',
          invited_by: adminUser.id,
        },
        redirectTo: `${getBaseUrl()}/coach/setup-password`,
      },
    )

    if (inviteError || !inviteData.user) {
      res.status(400).json({ error: inviteError?.message || 'Unable to send coach invite.' })
      return
    }

    const userId = inviteData.user.id
    const fullName = `${firstName} ${lastName}`.trim()

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email,
      role: 'coach',
      photo_url: photoUrl || null,
    })

    if (profileError) {
      if (!isMissingProfileColumnError(profileError.message)) {
        res.status(500).json({ error: `Invite sent, but profile setup failed: ${profileError.message}` })
        return
      }

      const { error: legacyProfileError } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        role: 'coach',
      })

      if (legacyProfileError) {
        res.status(500).json({
          error: `Invite sent, but profile setup failed. Run the profile fields SQL migration in Supabase. Details: ${legacyProfileError.message}`,
        })
        return
      }
    }

    const { error: coachError } = await supabase.from('coaches').upsert({
      id: userId,
      full_name: fullName,
      specialty: role,
      bio,
      photo_url: photoUrl || null,
      is_published: true,
    })

    if (coachError) {
      if (!isMissingCoachColumnError(coachError.message)) {
        res.status(500).json({ error: `Invite sent, but coach profile setup failed: ${coachError.message}` })
        return
      }

      const { error: legacyCoachError } = await supabase.from('coaches').upsert({
        id: userId,
        name: fullName,
        role,
        bio,
        is_published: true,
      })

      if (legacyCoachError) {
        res.status(500).json({
          error: `Invite sent, but coach profile setup failed. The coaches table needs either full_name/specialty or name/role fields. Details: ${legacyCoachError.message}`,
        })
        return
      }
    }

    res.status(200).json({
      success: true,
      message: `Coach invite sent to ${email}.`,
      coach: {
        id: userId,
        name: fullName,
        email,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to invite coach.'
    res.status(500).json({ error: message })
  }
})

router.post('/invite-parent-player', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!hasServiceRoleKey()) {
      res.status(500).json({
        error: 'Parent invites require SUPABASE_SERVICE_ROLE_KEY on the server.',
      })
      return
    }

    const coachUser = await requireCoach(req, res)
    if (!coachUser) return

    const { data: coachRow, error: coachError } = await supabase
      .from('coaches')
      .select('team_id')
      .eq('id', coachUser.id)
      .single()

    if (coachError || !coachRow?.team_id) {
      res.status(400).json({ error: 'You need an assigned team before adding players.' })
      return
    }

    const parentFirstName = String(req.body.parent_first_name || '').trim()
    const parentLastName = String(req.body.parent_last_name || '').trim()
    const parentEmail = String(req.body.parent_email || '').trim().toLowerCase()
    const parentPhone = String(req.body.parent_phone || '').trim()
    const playerFirstName = String(req.body.player_first_name || '').trim()
    const playerLastName = String(req.body.player_last_name || '').trim()
    const dateOfBirth = String(req.body.date_of_birth || '').trim()
    const position = String(req.body.position || 'TBD').trim()
    const jerseySize = String(req.body.jersey_size || 'YM').trim()

    if (!parentFirstName || !parentLastName || !parentEmail || !playerFirstName || !playerLastName || !dateOfBirth) {
      res.status(400).json({ error: 'Parent name, parent email, player name, and date of birth are required.' })
      return
    }

    const parentFullName = `${parentFirstName} ${parentLastName}`.trim()
    const playerFullName = `${playerFirstName} ${playerLastName}`.trim()
    const safeDob = normalizeBirthDate(dateOfBirth)

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .ilike('email', parentEmail)
      .maybeSingle()

    let parentId = existingProfile?.id || ''
    let inviteSent = false

    if (existingProfile?.role === 'admin') {
      res.status(400).json({ error: 'This email belongs to an admin account. Use the parent or guardian email for the player invite.' })
      return
    }

    if (!parentId) {
      const { data: listedUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const authUsers = (listedUsers?.users || []) as Array<{ id?: string, email?: string }>
      const existingAuthUser = authUsers.find((authUser) => authUser.email?.toLowerCase() === parentEmail)
      if (existingAuthUser?.id) {
        parentId = existingAuthUser.id
      }
    }

    if (!parentId) {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(parentEmail, {
        data: {
          first_name: parentFirstName,
          last_name: parentLastName,
          full_name: parentFullName,
          phone: parentPhone,
          role: 'user',
          invited_by_coach: coachUser.id,
        },
        redirectTo: `${getBaseUrl()}/parent/setup-password`,
      })

      if (inviteError || !inviteData.user) {
        res.status(400).json({ error: inviteError?.message || 'Unable to send parent invite.' })
        return
      }

      parentId = inviteData.user.id
      inviteSent = true
    }

    const isExistingCoachOrAdmin = existingProfile?.role === 'admin' || existingProfile?.role === 'coach'
    if (!isExistingCoachOrAdmin) {
      const profileUpdate = {
        id: parentId,
        first_name: parentFirstName,
        last_name: parentLastName,
        full_name: parentFullName,
        email: parentEmail,
        phone: parentPhone,
        role: 'user',
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileUpdate, { onConflict: 'id' })

      if (profileError) {
        res.status(500).json({ error: `Parent invite was prepared, but profile setup failed: ${profileError.message}` })
        return
      }
    }

    const playerInsert = {
      parent_id: parentId,
      first_name: playerFirstName,
      last_name: playerLastName,
      full_name: playerFullName,
      date_of_birth: safeDob,
      dob: safeDob,
      position,
      jersey_size: jerseySize,
      jersey_number: '-',
      team_assigned: coachRow.team_id,
      age_group: coachRow.team_id,
      status: 'pending_payment',
      payment_status: 'pending',
      medical_conditions: '',
    }

    let playerId = ''
    const { data: newPlayer, error: playerError } = await supabase
      .from('players')
      .insert(playerInsert)
      .select('id')
      .single()

    if (playerError) {
      const { first_name: _first, last_name: _last, dob: _dob, age_group: _ageGroup, ...fallbackPlayerInsert } = playerInsert
      const { data: fallbackPlayer, error: fallbackPlayerError } = await supabase
        .from('players')
        .insert(fallbackPlayerInsert)
        .select('id')
        .single()

      if (fallbackPlayerError || !fallbackPlayer?.id) {
        res.status(500).json({ error: fallbackPlayerError?.message || playerError.message })
        return
      }

      playerId = fallbackPlayer.id
    } else {
      playerId = newPlayer.id
    }

    const registrationPayload = {
      parent_id: parentId,
      player_id: playerId,
      checkout_player_id: playerId,
      first_name: playerFirstName,
      last_name: playerLastName,
      dob: safeDob,
      gender: 'Not specified',
      position,
      jersey_size: jerseySize,
      birth_cert_path: 'not_provided',
      waiver_signed_at: new Date().toISOString(),
      medical_conditions: '',
      status: 'pending_payment',
      payment_status: 'pending',
      created_at: new Date().toISOString(),
    }

    const { error: registrationError } = await supabase
      .from('registrations')
      .insert(registrationPayload)

    if (registrationError) {
      console.warn('Coach-created player registration record was not created:', registrationError.message)
    }

    res.status(200).json({
      success: true,
      message: inviteSent
        ? `Player added and parent invite sent to ${parentEmail}.`
        : `Player added and linked to the existing parent account for ${parentEmail}.`,
      playerId,
      parentId,
      inviteSent,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add player and invite parent.'
    res.status(500).json({ error: message })
  }
})

export default router
