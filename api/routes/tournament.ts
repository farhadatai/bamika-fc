import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { escapeHtml, sendEmail } from '../lib/email.js'

const router = Router()

const TOURNAMENT_SLUG = 'bamika-cup-2026'
const MAX_TEAMS_PER_DIVISION = 3
const siteUrl = 'https://www.bamikafc.com'
const adminNotifyEmail = process.env.ADMIN_NOTIFY_EMAIL?.trim() || 'farhad421@gmail.com'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Tournament request failed'

// Public form: much tighter than the global API limit. A real club submits once.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts. Please try again in a few minutes.' },
  validate: { forwardedHeader: false },
})

const registrationSchema = z.object({
  clubName: z.string().trim().min(2).max(80),
  contactName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(7).max(25),
  city: z.string().trim().max(80).optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
  teams: z.array(z.object({
    division: z.string().trim().min(2).max(10),
    teamName: z.string().trim().min(2).max(80),
  })).min(1, 'Add at least one team.').max(15),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0).optional().default(''),
})

const makeReferenceCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `BC26-${code}`
}

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

const formatDateRange = (startsOn: string, endsOn: string) => {
  const fmt = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `${fmt(startsOn)} – ${fmt(endsOn)}`
}

const getTournament = async () => {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', TOURNAMENT_SLUG)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
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
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
  if (profile?.role !== 'admin') {
    res.status(403).json({ error: 'Only admins can manage the tournament.' })
    return null
  }
  return authData.user
}

const emailShell = (title: string, body: string) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0a0a0a;padding:32px 16px;color:#f5f5f5">
    <div style="max-width:560px;margin:0 auto;background:#171717;border:1px solid #333;border-radius:16px;padding:28px">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4AF37;font-weight:700">Bamika FC Tournament</p>
      <h1 style="margin:0 0 18px;font-size:22px;font-style:italic;text-transform:uppercase;color:#fff">${title}</h1>
      ${body}
      <p style="margin:26px 0 0;font-size:12px;color:#888">Questions? Reply to this email and the Bamika FC tournament team will help.</p>
    </div>
  </div>`

// Public: tournament details for the /tournament page.
router.get('/info', async (_req: Request, res: Response): Promise<void> => {
  try {
    const tournament = await getTournament()
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found.' })
      return
    }
    res.json({ tournament })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Public: a club requests to join. No account needed.
router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = registrationSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please check the form and try again.' })
      return
    }
    const input = parsed.data

    const tournament = await getTournament()
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found.' })
      return
    }
    if (!tournament.registration_open) {
      res.status(400).json({ error: 'Registration for this tournament is closed.' })
      return
    }

    const allowedDivisions: string[] = tournament.divisions || []
    const perDivision = new Map<string, number>()
    for (const team of input.teams) {
      if (!allowedDivisions.includes(team.division)) {
        res.status(400).json({ error: `Unknown division: ${team.division}` })
        return
      }
      const count = (perDivision.get(team.division) || 0) + 1
      if (count > MAX_TEAMS_PER_DIVISION) {
        res.status(400).json({ error: `A club may enter up to ${MAX_TEAMS_PER_DIVISION} teams per division.` })
        return
      }
      perDivision.set(team.division, count)
    }

    // Retry on the (very unlikely) reference-code collision.
    let club: { id: string, reference_code: string } | null = null
    for (let attempt = 0; attempt < 3 && !club; attempt += 1) {
      const { data, error } = await supabase
        .from('tournament_clubs')
        .insert({
          tournament_id: tournament.id,
          reference_code: makeReferenceCode(),
          club_name: input.clubName,
          contact_name: input.contactName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          city: input.city || null,
          notes: input.notes || null,
        })
        .select('id, reference_code')
        .single()
      if (data) club = data
      else if (!error?.message.includes('reference_code')) throw new Error(error?.message || 'Could not save club request')
    }
    if (!club) throw new Error('Could not generate a reference code. Please try again.')

    const { error: teamsError } = await supabase
      .from('tournament_teams')
      .insert(input.teams.map((team) => ({ club_id: club!.id, division: team.division, team_name: team.teamName })))
    if (teamsError) throw new Error(teamsError.message)

    const totalCents = input.teams.length * tournament.team_fee_cents
    const teamLines = input.teams
      .map((team) => `<li>${escapeHtml(team.division)} — ${escapeHtml(team.teamName)}</li>`)
      .join('')

    // Confirmation to the club, notification to the admin. Never block the signup on mail.
    void sendEmail({
      to: [input.email],
      subject: `${tournament.name} — we received your club request (${club.reference_code})`,
      html: emailShell('Request received', `
        <p style="color:#ddd;line-height:1.6">Hi ${escapeHtml(input.contactName)}, thank you for registering <strong style="color:#fff">${escapeHtml(input.clubName)}</strong> for the ${escapeHtml(tournament.name)} (${formatDateRange(tournament.starts_on, tournament.ends_on)}).</p>
        <p style="color:#ddd;line-height:1.6">Your reference code is <strong style="color:#D4AF37;font-size:18px">${club.reference_code}</strong>. Keep it for any questions.</p>
        <p style="color:#ddd;margin-bottom:6px"><strong>Teams requested:</strong></p>
        <ul style="color:#ddd;line-height:1.7;margin-top:0">${teamLines}</ul>
        <p style="color:#ddd;line-height:1.6">Entry fee: ${formatMoney(tournament.team_fee_cents)} per team — <strong style="color:#fff">${formatMoney(totalCents)} total</strong>.</p>
        <p style="color:#ddd;line-height:1.6"><strong style="color:#fff">What happens next:</strong><br>
        1. Our tournament director reviews your request (usually within 1–2 days).<br>
        2. Once approved, you receive a private link to pay for each team.<br>
        3. After payment, that same link unlocks your team rosters (${tournament.roster_min}–${tournament.roster_max} players per team, birth certificates required).</p>
      `),
    })

    void sendEmail({
      to: [adminNotifyEmail],
      replyTo: input.email,
      subject: `New tournament club request: ${input.clubName} (${input.teams.length} team${input.teams.length === 1 ? '' : 's'})`,
      html: emailShell('New club request', `
        <p style="color:#ddd;line-height:1.7">
          <strong style="color:#fff">${escapeHtml(input.clubName)}</strong>${input.city ? ` (${escapeHtml(input.city)})` : ''}<br>
          Contact: ${escapeHtml(input.contactName)} — ${escapeHtml(input.email)} — ${escapeHtml(input.phone)}<br>
          Reference: ${club.reference_code}
        </p>
        <ul style="color:#ddd;line-height:1.7">${teamLines}</ul>
        ${input.notes ? `<p style="color:#bbb;line-height:1.6"><em>${escapeHtml(input.notes)}</em></p>` : ''}
        <p style="color:#ddd">Expected fees: ${formatMoney(totalCents)}</p>
        <p><a href="${siteUrl}/admin" style="display:inline-block;background:#EF4444;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Review in Admin → Tournament</a></p>
      `),
    })

    res.status(201).json({ success: true, referenceCode: club.reference_code, totalCents })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Admin: approve or decline a club request (emails the club).
router.post('/admin/clubs/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const status = req.body?.status
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1000) : ''
    if (status !== 'approved' && status !== 'declined' && status !== 'pending') {
      res.status(400).json({ error: 'Status must be approved, declined, or pending.' })
      return
    }

    const { data: club, error } = await supabase
      .from('tournament_clubs')
      .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, club_name, contact_name, email, reference_code, tournament_id')
      .single()
    if (error || !club) throw new Error(error?.message || 'Club not found')

    if (status !== 'pending') {
      const tournament = await getTournament()
      const { data: teams } = await supabase.from('tournament_teams').select('division, team_name').eq('club_id', club.id)
      const teamCount = teams?.length || 0
      const fee = tournament?.team_fee_cents || 0

      void sendEmail({
        to: [club.email],
        subject: status === 'approved'
          ? `${tournament?.name || 'Bamika FC Tournament'} — ${club.club_name} is approved!`
          : `${tournament?.name || 'Bamika FC Tournament'} — update on your request (${club.reference_code})`,
        html: status === 'approved'
          ? emailShell('You are in!', `
              <p style="color:#ddd;line-height:1.6">Hi ${escapeHtml(club.contact_name)}, great news — <strong style="color:#fff">${escapeHtml(club.club_name)}</strong> has been approved for the ${escapeHtml(tournament?.name || 'tournament')} with ${teamCount} team${teamCount === 1 ? '' : 's'}.</p>
              <p style="color:#ddd;line-height:1.6">Entry fee: ${formatMoney(fee)} per team — <strong style="color:#fff">${formatMoney(fee * teamCount)} total</strong>.</p>
              <p style="color:#ddd;line-height:1.6"><strong style="color:#fff">Next step:</strong> you will receive a separate email with your private payment &amp; roster link. Your spot is reserved once payment is complete.</p>
              ${message ? `<p style="color:#ddd;line-height:1.6;border-left:3px solid #D4AF37;padding-left:12px">${escapeHtml(message)}</p>` : ''}
            `)
          : emailShell('Request update', `
              <p style="color:#ddd;line-height:1.6">Hi ${escapeHtml(club.contact_name)}, unfortunately we are unable to accept <strong style="color:#fff">${escapeHtml(club.club_name)}</strong> for this tournament at this time.</p>
              ${message ? `<p style="color:#ddd;line-height:1.6;border-left:3px solid #D4AF37;padding-left:12px">${escapeHtml(message)}</p>` : ''}
              <p style="color:#ddd;line-height:1.6">We hope to see your club at a future Bamika FC event.</p>
            `),
      })
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

export default router
