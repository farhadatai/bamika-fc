import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import Stripe from 'stripe'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { escapeHtml, sendEmail } from '../lib/email.js'

const router = Router()

const TOURNAMENT_SLUG = 'bamika-cup-2026'
const MAX_TEAMS_PER_DIVISION = 3
const siteUrl = 'https://www.bamikafc.com'
const adminNotifyEmail = process.env.ADMIN_NOTIFY_EMAIL?.trim() || 'farhad421@gmail.com'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Tournament request failed'

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) throw new Error('Stripe is not configured on the server.')
  return new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
}

// Return URLs: production always goes to the canonical site; local dev keeps localhost.
const getBaseUrl = (req: Request) => {
  const origin = req.get('origin') || ''
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  return siteUrl
}

// Public form: much tighter than the global API limit. A real club submits once.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts. Please try again in a few minutes.' },
  validate: { forwardedHeader: false },
})

// Club portal: tokens are 48 hex chars so guessing is hopeless, but keep probing cheap to shut down.
const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again shortly.' },
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

const isValidToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{48}$/.test(value)

const portalPath = (token: string) => `/tournament/club/${token}`

const getTournament = async () => {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', TOURNAMENT_SLUG)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

const getClubByToken = async (token: string) => {
  const { data, error } = await supabase
    .from('tournament_clubs')
    .select('id, tournament_id, reference_code, club_name, contact_name, email, phone, status, access_token')
    .eq('access_token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

const getClubTeams = async (clubId: string) => {
  const { data, error } = await supabase
    .from('tournament_club_teams')
    .select('id, division, team_name, group_label, payment_status, paid_at, stripe_checkout_session_id')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

const publicTeam = (team: { id: string, division: string, team_name: string, group_label: string | null, payment_status: string, paid_at: string | null }) => ({
  id: team.id,
  division: team.division,
  team_name: team.team_name,
  group_label: team.group_label,
  payment_status: team.payment_status,
  paid_at: team.paid_at,
})

const markTeamPaid = async (teamId: string, sessionId: string) => {
  const { error } = await supabase
    .from('tournament_club_teams')
    .update({ payment_status: 'paid', paid_at: new Date().toISOString(), stripe_checkout_session_id: sessionId })
    .eq('id', teamId)
  if (error) throw new Error(error.message)
}

// Confirms a Stripe Checkout session belongs to the given club's team and is paid.
// This is how payments get recorded (on return from Stripe, or on admin refresh) —
// it does not rely on a webhook.
const confirmSessionPayment = async (stripe: Stripe, sessionId: string, clubId: string) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  const teamId = session.metadata?.team_id
  if (session.metadata?.checkout_type !== 'tournament_team' || !teamId || session.metadata?.club_id !== clubId) return null
  if (session.payment_status !== 'paid') return { teamId, paid: false }
  await markTeamPaid(teamId, session.id)
  return { teamId, paid: true }
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

const portalButton = (link: string, label: string) => `
  <p style="margin:22px 0"><a href="${link}" style="display:inline-block;background:#EF4444;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">${label}</a></p>
  <p style="color:#999;font-size:12px;line-height:1.6">This is your club's private link — anyone with it can pay for and manage your teams, so only share it with your own staff. If the button does not work, copy this address:<br><span style="color:#ccc;word-break:break-all">${link}</span></p>`

const sendPortalLinkEmail = async (club: { email: string, contact_name: string, club_name: string, access_token: string }, tournamentName: string, teamCount: number, feeCents: number, message?: string) => (
  sendEmail({
    to: [club.email],
    subject: `${tournamentName} — ${club.club_name} is approved! Pay for your teams`,
    html: emailShell('You are in!', `
      <p style="color:#ddd;line-height:1.6">Hi ${escapeHtml(club.contact_name)}, great news — <strong style="color:#fff">${escapeHtml(club.club_name)}</strong> has been approved for the ${escapeHtml(tournamentName)} with ${teamCount} team${teamCount === 1 ? '' : 's'}.</p>
      <p style="color:#ddd;line-height:1.6">Entry fee: ${formatMoney(feeCents)} per team — <strong style="color:#fff">${formatMoney(feeCents * teamCount)} total</strong>. You can pay for each team separately, with any card, from your club page:</p>
      ${portalButton(`${siteUrl}${portalPath(club.access_token)}`, 'Open my club page & pay')}
      <p style="color:#ddd;line-height:1.6">A team's spot is reserved as soon as it is paid. After payment, the same page is where you will enter that team's roster (player names, birth dates, and a birth certificate for each player).</p>
      ${message ? `<p style="color:#ddd;line-height:1.6;border-left:3px solid #D4AF37;padding-left:12px">${escapeHtml(message)}</p>` : ''}
    `),
  })
)

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

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

// A club requests to join. No account needed.
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
      .from('tournament_club_teams')
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
        2. Once approved, you receive your private club link to pay for each team.<br>
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

// ---------------------------------------------------------------------------
// Club portal (private link, no account)
// ---------------------------------------------------------------------------

router.get('/club/:token', portalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params
    if (!isValidToken(token)) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    const club = await getClubByToken(token)
    if (!club) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    const [tournament, teams] = await Promise.all([getTournament(), getClubTeams(club.id)])
    res.json({
      tournament: tournament && {
        name: tournament.name,
        starts_on: tournament.starts_on,
        ends_on: tournament.ends_on,
        venue_name: tournament.venue_name,
        venue_address: tournament.venue_address,
        team_fee_cents: tournament.team_fee_cents,
        roster_min: tournament.roster_min,
        roster_max: tournament.roster_max,
        roster_deadline: tournament.roster_deadline,
      },
      club: {
        club_name: club.club_name,
        contact_name: club.contact_name,
        email: club.email,
        status: club.status,
        reference_code: club.reference_code,
      },
      teams: teams.map(publicTeam),
    })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Start a Stripe Checkout for ONE team ($fee one-time payment).
router.post('/club/:token/teams/:teamId/checkout', portalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, teamId } = req.params
    if (!isValidToken(token)) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    const club = await getClubByToken(token)
    if (!club) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    if (club.status !== 'approved') {
      res.status(400).json({ error: 'Payments open once your club is approved.' })
      return
    }
    const tournament = await getTournament()
    if (!tournament) throw new Error('Tournament not found')

    const teams = await getClubTeams(club.id)
    const team = teams.find((row) => row.id === teamId)
    if (!team) {
      res.status(404).json({ error: 'Team not found.' })
      return
    }
    if (team.payment_status === 'paid') {
      res.status(400).json({ error: 'This team is already paid.' })
      return
    }

    const stripe = getStripeClient()
    const baseUrl = getBaseUrl(req)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tournament.name} — team entry`,
              description: `${team.team_name} (${team.division}) · ${club.club_name}`,
            },
            unit_amount: tournament.team_fee_cents,
          },
          quantity: 1,
        },
      ],
      customer_email: club.email,
      client_reference_id: team.id,
      success_url: `${baseUrl}${portalPath(token)}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${portalPath(token)}`,
      metadata: {
        checkout_type: 'tournament_team',
        tournament_id: tournament.id,
        club_id: club.id,
        team_id: team.id,
        division: team.division,
        team_name: team.team_name,
        club_name: club.club_name,
      },
      payment_intent_data: {
        description: `${tournament.name}: ${team.team_name} (${team.division}) — ${club.club_name}`,
        metadata: { checkout_type: 'tournament_team', club_id: club.id, team_id: team.id },
      },
    })

    await supabase
      .from('tournament_club_teams')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', team.id)

    res.json({ success: true, url: session.url })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Called when the club returns from Stripe: confirm that session and record the payment.
router.post('/club/:token/verify', portalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : ''
    if (!isValidToken(token) || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      res.status(400).json({ error: 'Invalid request.' })
      return
    }
    const club = await getClubByToken(token)
    if (!club) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    const result = await confirmSessionPayment(getStripeClient(), sessionId, club.id)
    const teams = await getClubTeams(club.id)

    if (result?.paid) {
      const paidTeam = teams.find((row) => row.id === result.teamId)
      const tournament = await getTournament()
      void sendEmail({
        to: [club.email],
        subject: `${tournament?.name || 'Bamika FC Tournament'} — payment received for ${paidTeam?.team_name || 'your team'}`,
        html: emailShell('Payment received', `
          <p style="color:#ddd;line-height:1.6">Thank you! We received <strong style="color:#fff">${formatMoney(tournament?.team_fee_cents || 0)}</strong> for <strong style="color:#fff">${escapeHtml(paidTeam?.team_name || 'your team')}${paidTeam ? ` (${escapeHtml(paidTeam.division)})` : ''}</strong>. That team's spot is reserved.</p>
          <p style="color:#ddd;line-height:1.6">${teams.filter((row) => row.payment_status !== 'paid').length > 0 ? 'You still have unpaid teams — you can pay for them any time from your club page.' : 'All of your teams are paid.'} Roster entry opens on the same page.</p>
          ${portalButton(`${siteUrl}${portalPath(club.access_token)}`, 'Open my club page')}
        `),
      })
      void sendEmail({
        to: [adminNotifyEmail],
        subject: `Tournament payment: ${club.club_name} — ${paidTeam?.team_name || 'team'} (${paidTeam?.division || ''})`,
        html: emailShell('Payment received', `<p style="color:#ddd;line-height:1.7"><strong style="color:#fff">${escapeHtml(club.club_name)}</strong> paid ${formatMoney(tournament?.team_fee_cents || 0)} for ${escapeHtml(paidTeam?.team_name || 'a team')} (${escapeHtml(paidTeam?.division || '')}).<br>Paid teams for this club: ${teams.filter((row) => row.payment_status === 'paid').length} of ${teams.length}.</p>`),
      })
    }

    res.json({ success: true, paid: Boolean(result?.paid), teams: teams.map(publicTeam) })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// Approve / decline / reset a club request (emails the club; approval includes the portal link).
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
      .select('id, club_name, contact_name, email, reference_code, tournament_id, access_token')
      .single()
    if (error || !club) throw new Error(error?.message || 'Club not found')

    if (status !== 'pending') {
      const tournament = await getTournament()
      const teams = await getClubTeams(club.id)
      const tournamentName = tournament?.name || 'Bamika FC Tournament'

      if (status === 'approved') {
        void sendPortalLinkEmail(club, tournamentName, teams.length, tournament?.team_fee_cents || 0, message)
      } else {
        void sendEmail({
          to: [club.email],
          subject: `${tournamentName} — update on your request (${club.reference_code})`,
          html: emailShell('Request update', `
            <p style="color:#ddd;line-height:1.6">Hi ${escapeHtml(club.contact_name)}, unfortunately we are unable to accept <strong style="color:#fff">${escapeHtml(club.club_name)}</strong> for this tournament at this time.</p>
            ${message ? `<p style="color:#ddd;line-height:1.6;border-left:3px solid #D4AF37;padding-left:12px">${escapeHtml(message)}</p>` : ''}
            <p style="color:#ddd;line-height:1.6">We hope to see your club at a future Bamika FC event.</p>
          `),
        })
      }
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Re-send the club its private link (approved clubs only).
router.post('/admin/clubs/:id/resend-link', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const { data: club, error } = await supabase
      .from('tournament_clubs')
      .select('id, club_name, contact_name, email, status, access_token')
      .eq('id', req.params.id)
      .single()
    if (error || !club) throw new Error(error?.message || 'Club not found')
    if (club.status !== 'approved') {
      res.status(400).json({ error: 'Approve the club first — the link email includes payment instructions.' })
      return
    }
    const tournament = await getTournament()
    const teams = await getClubTeams(club.id)
    const result = await sendPortalLinkEmail(club, tournament?.name || 'Bamika FC Tournament', teams.length, tournament?.team_fee_cents || 0)
    if (!result.sent) {
      res.status(502).json({ error: `Email not sent: ${result.detail || 'unknown error'}` })
      return
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Re-check Stripe for any team with an unfinished checkout (e.g. the club paid but
// closed the tab before returning to the portal).
router.post('/admin/clubs/:id/sync-payments', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const teams = await getClubTeams(req.params.id)
    const stripe = getStripeClient()
    let updated = 0
    for (const team of teams) {
      if (team.payment_status === 'paid' || !team.stripe_checkout_session_id) continue
      const result = await confirmSessionPayment(stripe, team.stripe_checkout_session_id, req.params.id)
      if (result?.paid) updated += 1
    }
    res.json({ success: true, updated })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Remove one team (only while unpaid — refund paid teams in Stripe first).
router.delete('/admin/teams/:teamId', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const { data: team, error } = await supabase
      .from('tournament_club_teams')
      .select('id, payment_status')
      .eq('id', req.params.teamId)
      .single()
    if (error || !team) throw new Error(error?.message || 'Team not found')
    if (team.payment_status === 'paid') {
      res.status(400).json({ error: 'This team is paid. Refund it in Stripe first, then remove it.' })
      return
    }
    const { error: deleteError } = await supabase.from('tournament_club_teams').delete().eq('id', team.id)
    if (deleteError) throw new Error(deleteError.message)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Delete a club request entirely (and its teams). Blocked while any team is paid.
router.delete('/admin/clubs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const teams = await getClubTeams(req.params.id)
    if (teams.some((team) => team.payment_status === 'paid')) {
      res.status(400).json({ error: 'This club has paid teams. Refund them in Stripe first, then delete.' })
      return
    }
    const { error } = await supabase.from('tournament_clubs').delete().eq('id', req.params.id)
    if (error) throw new Error(error.message)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

export default router
