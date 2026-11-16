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

// Paid visiting teams and Bamika's own (fee-waived) teams are both "in".
const isEntered = (paymentStatus: string) => paymentStatus === 'paid' || paymentStatus === 'waived'

const publicTeam = (team: { id: string, division: string, team_name: string, group_label: string | null, payment_status: string, paid_at: string | null }) => ({
  id: team.id,
  division: team.division,
  team_name: team.team_name,
  group_label: team.group_label,
  payment_status: team.payment_status,
  paid_at: team.paid_at,
})

// ---------------------------------------------------------------------------
// Rosters
// ---------------------------------------------------------------------------

const ROSTER_BUCKET = 'tournament-docs'
const MAX_CERT_BYTES = 6 * 1024 * 1024
const CERT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

interface RosterPlayerRow {
  id: string
  team_id: string
  club_id: string
  full_name: string
  date_of_birth: string
  jersey_number: string | null
  birth_cert_path: string | null
  created_at: string
  source_player_id?: string | null
}

const rosterPlayerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the player\'s full name.').max(80),
  dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of birth.'),
  jerseyNumber: z.string().trim().max(4).optional().default(''),
  birthCert: z.object({
    name: z.string().trim().max(200),
    type: z.string().trim().max(100),
    data: z.string().min(1),
  }).optional(),
})

const isMissingRosterTable = (message: string) => /tournament_roster_players/.test(message) && /(schema cache|does not exist)/.test(message)

const getClubRoster = async (clubId: string) => {
  const { data, error } = await supabase
    .from('tournament_roster_players')
    .select('id, team_id, club_id, full_name, date_of_birth, jersey_number, birth_cert_path, created_at, source_player_id')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true })
  if (error) {
    // Until the roster migration has run, the club page still loads (payments must never break).
    if (isMissingRosterTable(error.message)) return []
    throw new Error(error.message)
  }
  return (data || []) as RosterPlayerRow[]
}

// What a club (or the admin list) sees: never the storage path itself.
const publicRosterPlayer = (player: RosterPlayerRow) => ({
  id: player.id,
  team_id: player.team_id,
  full_name: player.full_name,
  date_of_birth: player.date_of_birth,
  jersey_number: player.jersey_number,
  has_birth_cert: Boolean(player.birth_cert_path),
  created_at: player.created_at,
})

const rostersLocked = (tournament: { roster_deadline: string | null } | null) => {
  if (!tournament?.roster_deadline) return false
  // Deadline is inclusive: rosters lock at the end of that day (Pacific time).
  return Date.now() > new Date(`${tournament.roster_deadline}T23:59:59-08:00`).getTime()
}

const isReasonableBirthDate = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return false
  const year = date.getFullYear()
  const thisYear = new Date().getFullYear()
  return year >= thisYear - 25 && year <= thisYear
}

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
    const [tournament, teams, roster] = await Promise.all([getTournament(), getClubTeams(club.id), getClubRoster(club.id)])
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
        rosters_locked: rostersLocked(tournament),
      },
      club: {
        club_name: club.club_name,
        contact_name: club.contact_name,
        email: club.email,
        status: club.status,
        reference_code: club.reference_code,
      },
      teams: teams.map(publicTeam),
      roster: roster.map(publicRosterPlayer),
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

// Add a player to a PAID team's roster. The birth certificate arrives as base64
// JSON (clubs have no account, so they cannot upload to storage directly) and
// is written to the private tournament-docs bucket by the server.
router.post('/club/:token/teams/:teamId/players', portalLimiter, async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({ error: 'Rosters open once your club is approved.' })
      return
    }
    const parsed = rosterPlayerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the player details.' })
      return
    }
    const input = parsed.data
    if (!isReasonableBirthDate(input.dateOfBirth)) {
      res.status(400).json({ error: 'That date of birth does not look right.' })
      return
    }

    const tournament = await getTournament()
    if (!tournament) throw new Error('Tournament not found')
    if (rostersLocked(tournament)) {
      res.status(400).json({ error: 'Rosters are locked. Contact Bamika FC for changes.' })
      return
    }

    const teams = await getClubTeams(club.id)
    const team = teams.find((row) => row.id === teamId)
    if (!team) {
      res.status(404).json({ error: 'Team not found.' })
      return
    }
    if (!isEntered(team.payment_status)) {
      res.status(400).json({ error: 'Pay this team\'s entry fee first, then add its players.' })
      return
    }

    const roster = await getClubRoster(club.id)
    const teamRoster = roster.filter((player) => player.team_id === team.id)
    if (teamRoster.length >= tournament.roster_max) {
      res.status(400).json({ error: `This team already has the maximum of ${tournament.roster_max} players.` })
      return
    }
    const duplicate = teamRoster.find((player) => player.full_name.trim().toLowerCase() === input.fullName.toLowerCase())
    if (duplicate) {
      res.status(400).json({ error: `${input.fullName} is already on this team's roster.` })
      return
    }

    let birthCertPath: string | null = null
    if (input.birthCert) {
      const extension = CERT_TYPES[input.birthCert.type.toLowerCase()]
      if (!extension) {
        res.status(400).json({ error: 'Upload the birth certificate as a PDF or a photo (JPG, PNG, HEIC).' })
        return
      }
      const buffer = Buffer.from(input.birthCert.data, 'base64')
      if (buffer.length === 0 || buffer.length > MAX_CERT_BYTES) {
        res.status(400).json({ error: 'The birth certificate file must be under 6 MB.' })
        return
      }
      const safeName = input.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player'
      birthCertPath = `${club.id}/${team.id}/${Date.now()}-${safeName}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(ROSTER_BUCKET)
        .upload(birthCertPath, buffer, { contentType: input.birthCert.type.toLowerCase(), upsert: false })
      if (uploadError) throw new Error(`Could not save the birth certificate: ${uploadError.message}`)
    }

    const { data: player, error: insertError } = await supabase
      .from('tournament_roster_players')
      .insert({
        team_id: team.id,
        club_id: club.id,
        full_name: input.fullName,
        date_of_birth: input.dateOfBirth,
        jersey_number: input.jerseyNumber || null,
        birth_cert_path: birthCertPath,
      })
      .select('id, team_id, club_id, full_name, date_of_birth, jersey_number, birth_cert_path, created_at')
      .single()
    if (insertError || !player) throw new Error(insertError?.message || 'Could not add the player')

    res.status(201).json({ success: true, player: publicRosterPlayer(player as RosterPlayerRow) })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Replace (or add) the birth certificate for a player already on the roster.
router.post('/club/:token/players/:playerId/birth-certificate', portalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, playerId } = req.params
    if (!isValidToken(token)) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    const club = await getClubByToken(token)
    if (!club) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    const parsed = rosterPlayerSchema.shape.birthCert.unwrap().safeParse(req.body?.birthCert)
    if (!parsed.success) {
      res.status(400).json({ error: 'Choose a file to upload.' })
      return
    }
    const tournament = await getTournament()
    if (rostersLocked(tournament)) {
      res.status(400).json({ error: 'Rosters are locked. Contact Bamika FC for changes.' })
      return
    }
    const roster = await getClubRoster(club.id)
    const player = roster.find((row) => row.id === playerId)
    if (!player) {
      res.status(404).json({ error: 'Player not found.' })
      return
    }
    const extension = CERT_TYPES[parsed.data.type.toLowerCase()]
    if (!extension) {
      res.status(400).json({ error: 'Upload the birth certificate as a PDF or a photo (JPG, PNG, HEIC).' })
      return
    }
    const buffer = Buffer.from(parsed.data.data, 'base64')
    if (buffer.length === 0 || buffer.length > MAX_CERT_BYTES) {
      res.status(400).json({ error: 'The birth certificate file must be under 6 MB.' })
      return
    }
    const safeName = player.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player'
    const path = `${club.id}/${player.team_id}/${Date.now()}-${safeName}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from(ROSTER_BUCKET)
      .upload(path, buffer, { contentType: parsed.data.type.toLowerCase(), upsert: false })
    if (uploadError) throw new Error(`Could not save the birth certificate: ${uploadError.message}`)

    const { error: updateError } = await supabase
      .from('tournament_roster_players')
      .update({ birth_cert_path: path })
      .eq('id', player.id)
    if (updateError) throw new Error(updateError.message)
    if (player.birth_cert_path) void supabase.storage.from(ROSTER_BUCKET).remove([player.birth_cert_path])

    res.json({ success: true, player: publicRosterPlayer({ ...player, birth_cert_path: path }) })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Remove a player from the roster (and their document).
router.delete('/club/:token/players/:playerId', portalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, playerId } = req.params
    if (!isValidToken(token)) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    const club = await getClubByToken(token)
    if (!club) {
      res.status(404).json({ error: 'This club link is not valid.' })
      return
    }
    const tournament = await getTournament()
    if (rostersLocked(tournament)) {
      res.status(400).json({ error: 'Rosters are locked. Contact Bamika FC for changes.' })
      return
    }
    const roster = await getClubRoster(club.id)
    const player = roster.find((row) => row.id === playerId)
    if (!player) {
      res.status(404).json({ error: 'Player not found.' })
      return
    }
    const { error } = await supabase.from('tournament_roster_players').delete().eq('id', player.id)
    if (error) throw new Error(error.message)
    if (player.birth_cert_path) void supabase.storage.from(ROSTER_BUCKET).remove([player.birth_cert_path])
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// Full roster for one team, with short-lived download links for birth certificates.
router.get('/admin/teams/:teamId/roster', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const { data: players, error } = await supabase
      .from('tournament_roster_players')
      .select('id, team_id, club_id, full_name, date_of_birth, jersey_number, birth_cert_path, created_at')
      .eq('team_id', req.params.teamId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)

    const rows = (players || []) as RosterPlayerRow[]
    const paths = rows.map((player) => player.birth_cert_path).filter((path): path is string => Boolean(path))
    const signed: Record<string, string> = {}
    if (paths.length > 0) {
      const { data: urls } = await supabase.storage.from(ROSTER_BUCKET).createSignedUrls(paths, 60 * 15)
      for (const entry of urls || []) {
        if (entry.path && entry.signedUrl) signed[entry.path] = entry.signedUrl
      }
    }

    res.json({
      players: rows.map((player) => ({
        ...publicRosterPlayer(player),
        birth_cert_url: player.birth_cert_path ? signed[player.birth_cert_path] || null : null,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

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

// ---------------------------------------------------------------------------
// Bamika FC's own teams (coaches, no entry fee)
// ---------------------------------------------------------------------------

const HOME_CLUB_REFERENCE = 'BC26-HOME'
const MAX_HOME_ENTRIES_PER_COACH_TEAM = 3

// Coach or admin session, plus the coach's Bamika team label.
const requireCoach = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Please log in again.' })
    return null
  }
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    res.status(401).json({ error: 'Please log in again.' })
    return null
  }
  const [{ data: profile }, { data: coachRow }] = await Promise.all([
    supabase.from('profiles').select('role, first_name, last_name, full_name').eq('id', authData.user.id).single(),
    supabase.from('coaches').select('team_id').eq('id', authData.user.id).maybeSingle(),
  ])
  if (profile?.role !== 'coach' && profile?.role !== 'admin') {
    res.status(403).json({ error: 'Only Bamika coaches can enter club teams.' })
    return null
  }
  const coachTeam = String(coachRow?.team_id || '').trim()
  return {
    user: authData.user,
    isAdmin: profile?.role === 'admin',
    coachTeam: coachTeam && coachTeam !== 'Unassigned' ? coachTeam : '',
  }
}

type CoachSession = NonNullable<Awaited<ReturnType<typeof requireCoach>>>

// The single "Bamika FC" club row that holds the home teams; created on first use.
const getHomeClub = async (tournamentId: string) => {
  const { data: existing, error } = await supabase
    .from('tournament_clubs')
    .select('id, tournament_id, club_name, status, is_home')
    .eq('tournament_id', tournamentId)
    .eq('is_home', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) return existing
  const { data: created, error: insertError } = await supabase
    .from('tournament_clubs')
    .insert({
      tournament_id: tournamentId,
      reference_code: HOME_CLUB_REFERENCE,
      club_name: 'Bamika FC',
      contact_name: 'Bamika FC',
      email: adminNotifyEmail,
      phone: '-',
      city: 'Sacramento',
      status: 'approved',
      is_home: true,
      reviewed_at: new Date().toISOString(),
    })
    .select('id, tournament_id, club_name, status, is_home')
    .single()
  if (insertError) throw new Error(insertError.message)
  return created
}

interface HomeTeamRow {
  id: string
  club_id: string
  division: string
  team_name: string
  group_label: string | null
  payment_status: string
  paid_at: string | null
  coach_team: string | null
  created_by: string | null
}

const getHomeTeams = async (clubId: string) => {
  const { data, error } = await supabase
    .from('tournament_club_teams')
    .select('id, club_id, division, team_name, group_label, payment_status, paid_at, coach_team, created_by')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as HomeTeamRow[]
}

const coachNamesByTeam = async () => {
  const { data: coachRows } = await supabase.from('coaches').select('id, team_id')
  const rows = ((coachRows || []) as Array<{ id: string, team_id: string | null }>).filter((row) => row.team_id)
  const byTeam: Record<string, string> = {}
  if (rows.length === 0) return byTeam
  const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, full_name').in('id', rows.map((row) => row.id))
  const nameById: Record<string, string> = {}
  for (const profile of (profiles || []) as Array<{ id: string, first_name?: string | null, last_name?: string | null, full_name?: string | null }>) {
    nameById[profile.id] = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.full_name || 'Coach'
  }
  for (const row of rows) byTeam[row.team_id as string] = nameById[row.id] || 'Coach'
  return byTeam
}

// "U14 A" -> "U14" when that age group exists in the tournament.
const divisionFromTeamLabel = (label: string, divisions: string[]) => {
  const match = label.match(/^(U\d{1,2})/i)
  const guess = match ? match[1].toUpperCase() : ''
  return divisions.includes(guess) ? guess : ''
}

const ACTIVE_FILTER = (status: unknown) => !['inactive', 'cancelled', 'canceled', 'deleted'].includes(String(status || '').toLowerCase())

// Everything the coach dashboard needs for its tournament card.
router.get('/coach/entries', async (req: Request, res: Response): Promise<void> => {
  try {
    const coach = await requireCoach(req, res)
    if (!coach) return
    const tournament = await getTournament()
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found.' })
      return
    }
    const club = await getHomeClub(tournament.id)
    const [teams, roster, coachNames] = await Promise.all([getHomeTeams(club.id), getClubRoster(club.id), coachNamesByTeam()])

    // The coach's own Bamika players, ready to be picked.
    let myPlayers: Array<{ id: string, full_name: string, date_of_birth: string | null, jersey_number: string | null }> = []
    if (coach.coachTeam) {
      const { data } = await supabase
        .from('players')
        .select('id, full_name, date_of_birth, jersey_number, status')
        .eq('team_assigned', coach.coachTeam)
        .order('full_name', { ascending: true })
      myPlayers = ((data || []) as Array<{ id: string, full_name: string, date_of_birth: string | null, jersey_number: string | null, status: string | null }>)
        .filter((player) => ACTIVE_FILTER(player.status))
        .map(({ id, full_name, date_of_birth, jersey_number }) => ({ id, full_name, date_of_birth, jersey_number }))
    }

    res.json({
      tournament: {
        name: tournament.name,
        starts_on: tournament.starts_on,
        ends_on: tournament.ends_on,
        venue_name: tournament.venue_name,
        divisions: tournament.divisions,
        roster_min: tournament.roster_min,
        roster_max: tournament.roster_max,
        roster_deadline: tournament.roster_deadline,
        rosters_locked: rostersLocked(tournament),
      },
      coach_team: coach.coachTeam,
      suggested_division: coach.coachTeam ? divisionFromTeamLabel(coach.coachTeam, tournament.divisions) : '',
      max_entries: MAX_HOME_ENTRIES_PER_COACH_TEAM,
      teams: teams.map((team) => ({
        ...publicTeam(team),
        coach_team: team.coach_team,
        coach_name: team.coach_team ? coachNames[team.coach_team] || null : null,
        mine: coach.isAdmin || (Boolean(coach.coachTeam) && team.coach_team === coach.coachTeam),
        player_count: roster.filter((player) => player.team_id === team.id).length,
      })),
      roster: roster.map((player) => ({ ...publicRosterPlayer(player), source_player_id: player.source_player_id || null })),
      my_players: myPlayers,
    })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

const homeTeamSchema = z.object({
  division: z.string().trim().min(2).max(10),
  teamName: z.string().trim().min(2, 'Give the team a name.').max(80),
})

// Coach enters a Bamika team. No fee: payment_status = 'waived'.
router.post('/coach/teams', async (req: Request, res: Response): Promise<void> => {
  try {
    const coach = await requireCoach(req, res)
    if (!coach) return
    if (!coach.coachTeam) {
      res.status(400).json({ error: 'You need a Bamika team assigned by the admin before entering the tournament.' })
      return
    }
    const parsed = homeTeamSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the team details.' })
      return
    }
    const tournament = await getTournament()
    if (!tournament) throw new Error('Tournament not found')
    if (!(tournament.divisions as string[]).includes(parsed.data.division)) {
      res.status(400).json({ error: 'Pick one of the tournament age groups.' })
      return
    }
    if (rostersLocked(tournament)) {
      res.status(400).json({ error: 'Rosters are locked. Contact the admin for changes.' })
      return
    }
    const club = await getHomeClub(tournament.id)
    const teams = await getHomeTeams(club.id)
    if (teams.filter((team) => team.coach_team === coach.coachTeam).length >= MAX_HOME_ENTRIES_PER_COACH_TEAM) {
      res.status(400).json({ error: `Up to ${MAX_HOME_ENTRIES_PER_COACH_TEAM} tournament teams per Bamika team.` })
      return
    }
    if (teams.some((team) => team.division === parsed.data.division && team.team_name.toLowerCase() === parsed.data.teamName.toLowerCase())) {
      res.status(400).json({ error: 'A Bamika team with that name is already entered in this age group.' })
      return
    }
    const { data: created, error } = await supabase
      .from('tournament_club_teams')
      .insert({
        club_id: club.id,
        division: parsed.data.division,
        team_name: parsed.data.teamName,
        payment_status: 'waived',
        paid_at: new Date().toISOString(),
        coach_team: coach.coachTeam,
        created_by: coach.user.id,
      })
      .select('id, club_id, division, team_name, group_label, payment_status, paid_at, coach_team, created_by')
      .single()
    if (error) throw new Error(error.message)
    res.status(201).json({ success: true, team: { ...publicTeam(created), coach_team: created.coach_team, mine: true, player_count: 0 } })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Shared guard: the team must be a Bamika entry this coach may manage.
const getManagedHomeTeam = async (coach: CoachSession, teamId: string, res: Response) => {
  const tournament = await getTournament()
  if (!tournament) throw new Error('Tournament not found')
  const club = await getHomeClub(tournament.id)
  const teams = await getHomeTeams(club.id)
  const team = teams.find((row) => row.id === teamId)
  if (!team) {
    res.status(404).json({ error: 'Team not found.' })
    return null
  }
  if (!coach.isAdmin && (!coach.coachTeam || team.coach_team !== coach.coachTeam)) {
    res.status(403).json({ error: `Only the ${team.coach_team || 'owning'} coach can change this team.` })
    return null
  }
  if (rostersLocked(tournament)) {
    res.status(400).json({ error: 'Rosters are locked. Contact the admin for changes.' })
    return null
  }
  return { tournament, club, team }
}

// Put one of the club's registered players on a Bamika tournament team.
router.post('/coach/teams/:teamId/players', async (req: Request, res: Response): Promise<void> => {
  try {
    const coach = await requireCoach(req, res)
    if (!coach) return
    const managed = await getManagedHomeTeam(coach, req.params.teamId, res)
    if (!managed) return
    const { tournament, club, team } = managed
    const playerId = String(req.body?.player_id || '').trim()
    if (!playerId) {
      res.status(400).json({ error: 'Missing player.' })
      return
    }
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, full_name, date_of_birth, jersey_number, status')
      .eq('id', playerId)
      .maybeSingle()
    if (playerError) throw new Error(playerError.message)
    if (!player || !ACTIVE_FILTER(player.status)) {
      res.status(404).json({ error: 'Player not found.' })
      return
    }
    if (!player.date_of_birth) {
      res.status(400).json({ error: `${player.full_name} has no birth date on file. Ask the admin to add it first.` })
      return
    }
    const roster = await getClubRoster(club.id)
    const onTeam = roster.filter((row) => row.team_id === team.id)
    if (onTeam.length >= tournament.roster_max) {
      res.status(400).json({ error: `This team already has the maximum of ${tournament.roster_max} players.` })
      return
    }
    if (onTeam.some((row) => row.source_player_id === player.id)) {
      res.status(400).json({ error: `${player.full_name} is already on this team.` })
      return
    }
    const jersey = String(player.jersey_number || '').trim()
    const { data: created, error } = await supabase
      .from('tournament_roster_players')
      .insert({
        team_id: team.id,
        club_id: club.id,
        full_name: player.full_name,
        date_of_birth: String(player.date_of_birth).slice(0, 10),
        jersey_number: jersey && jersey !== '-' ? jersey.slice(0, 4) : null,
        source_player_id: player.id,
      })
      .select('id, team_id, club_id, full_name, date_of_birth, jersey_number, birth_cert_path, created_at, source_player_id')
      .single()
    if (error) throw new Error(error.message)
    res.status(201).json({ success: true, player: { ...publicRosterPlayer(created), source_player_id: created.source_player_id } })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

router.delete('/coach/teams/:teamId/players/:playerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const coach = await requireCoach(req, res)
    if (!coach) return
    const managed = await getManagedHomeTeam(coach, req.params.teamId, res)
    if (!managed) return
    const { error } = await supabase
      .from('tournament_roster_players')
      .delete()
      .eq('id', req.params.playerId)
      .eq('team_id', managed.team.id)
    if (error) throw new Error(error.message)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

// Withdraw a Bamika team (its roster goes with it).
router.delete('/coach/teams/:teamId', async (req: Request, res: Response): Promise<void> => {
  try {
    const coach = await requireCoach(req, res)
    if (!coach) return
    const managed = await getManagedHomeTeam(coach, req.params.teamId, res)
    if (!managed) return
    const { error } = await supabase.from('tournament_club_teams').delete().eq('id', managed.team.id)
    if (error) throw new Error(error.message)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

export default router
