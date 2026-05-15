/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

const getBaseUrl = () => {
  const rawBaseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VITE_BASE_URL ||
    process.env.SITE_URL ||
    'https://bamika-fc.vercel.app'

  return rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl
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
      name: fullName,
      role,
      bio,
      is_published: true,
    })

    if (coachError) {
      res.status(500).json({ error: `Invite sent, but coach profile setup failed: ${coachError.message}` })
      return
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

export default router
