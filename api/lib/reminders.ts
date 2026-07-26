import { supabase } from './supabase.js'

const CLEARED_PAYMENT = new Set(['paid', 'waived'])
const INACTIVE_STATUS = new Set(['inactive', 'cancelled', 'canceled', 'deleted', 'paused'])

interface ReminderParentProfile {
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
}

interface ReminderPlayerRow {
  id: string
  full_name?: string | null
  payment_status?: string | null
  status?: string | null
  parent_id?: string | null
  profiles?: ReminderParentProfile | ReminderParentProfile[] | null
}

interface FamilyReminder {
  email: string
  parentName: string
  playerNames: string[]
}

const parentDisplayName = (parent?: ReminderParentProfile | null) => (
  `${parent?.first_name || ''} ${parent?.last_name || ''}`.trim()
  || parent?.full_name
  || 'Bamika FC Family'
)

const reminderEmailHtml = (reminder: FamilyReminder) => {
  const playerList = reminder.playerNames.map((name) => `<li style="margin:4px 0;">${name}</li>`).join('')
  const plural = reminder.playerNames.length > 1

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;border:1px solid #262626;">
    <div style="background:#000;padding:24px;text-align:center;border-bottom:2px solid #EF4444;">
      <h1 style="margin:0;font-size:22px;font-style:italic;text-transform:uppercase;color:#fff;">Bamika FC</h1>
      <p style="margin:6px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">Payment Reminder</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${reminder.parentName},</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
        This is a friendly reminder that the $25/month club membership is still pending for your ${plural ? 'players' : 'player'}:
      </p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;color:#facc15;">${playerList}</ul>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
        You can finish setting up the monthly payment in about a minute from your family dashboard — just press
        <strong>"Set up monthly payment"</strong> on your player's card.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://www.bamikafc.com/dashboard" style="display:inline-block;background:#EF4444;color:#fff;text-decoration:none;font-weight:bold;text-transform:uppercase;font-size:13px;letter-spacing:1px;padding:14px 28px;border-radius:8px;">Open My Dashboard</a>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;">
        Already paid or arranged something with the club? You can ignore this email — statuses can take a little while to update.
        Questions? Just reply to this email.
      </p>
    </div>
    <div style="background:#000;padding:16px;text-align:center;font-size:11px;color:#6b7280;">
      Bamika FC — Elk Grove Youth Soccer · bamikafc.com
    </div>
  </div>`
}

// Finds every family with a player whose membership payment is still pending
// and (unless dry-run / unconfigured) emails them a reminder via Resend.
export const runPaymentReminders = async ({ dryRun }: { dryRun: boolean }) => {
  const { data: players, error } = await supabase
    .from('players')
    .select('id, full_name, payment_status, status, parent_id, profiles:parent_id(email, first_name, last_name, full_name)')

  if (error) {
    throw new Error(error.message || 'Unable to load players for reminders.')
  }

  const pendingPlayers = ((players || []) as ReminderPlayerRow[]).filter((player) => {
    const payment = String(player.payment_status || 'pending').toLowerCase()
    const status = String(player.status || '').toLowerCase()
    return !CLEARED_PAYMENT.has(payment) && !INACTIVE_STATUS.has(payment) && !INACTIVE_STATUS.has(status)
  })

  const families = new Map<string, FamilyReminder>()
  let missingEmail = 0

  for (const player of pendingPlayers) {
    const parent = Array.isArray(player.profiles) ? player.profiles[0] : player.profiles
    const email = parent?.email?.trim().toLowerCase()

    if (!email) {
      missingEmail += 1
      continue
    }

    const existing = families.get(email)
    const playerName = player.full_name?.trim() || 'Your player'

    if (existing) {
      existing.playerNames.push(playerName)
    } else {
      families.set(email, { email, parentName: parentDisplayName(parent), playerNames: [playerName] })
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromAddress = process.env.REMINDER_FROM_EMAIL?.trim() || 'Bamika FC <reminders@bamikafc.com>'
  const effectiveDryRun = dryRun || !apiKey

  const results: Array<{ email: string, players: string[], sent: boolean, detail?: string }> = []
  let sentCount = 0

  for (const reminder of families.values()) {
    if (effectiveDryRun) {
      results.push({
        email: reminder.email,
        players: reminder.playerNames,
        sent: false,
        detail: !apiKey ? 'RESEND_API_KEY not configured — would send' : 'dry run — would send',
      })
      continue
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [reminder.email],
          subject: `Bamika FC — membership payment pending for ${reminder.playerNames.join(', ')}`,
          html: reminderEmailHtml(reminder),
        }),
      })

      const body = await response.json().catch(() => ({})) as { message?: string }

      if (response.ok) {
        sentCount += 1
        results.push({ email: reminder.email, players: reminder.playerNames, sent: true })
      } else {
        results.push({ email: reminder.email, players: reminder.playerNames, sent: false, detail: body.message || `Resend responded ${response.status}` })
      }
    } catch (sendError) {
      const detail = sendError instanceof Error ? sendError.message : 'Send failed'
      results.push({ email: reminder.email, players: reminder.playerNames, sent: false, detail })
    }
  }

  return {
    pendingPlayers: pendingPlayers.length,
    families: families.size,
    familiesMissingEmail: missingEmail,
    emailsSent: sentCount,
    dryRun: effectiveDryRun,
    emailConfigured: Boolean(apiKey),
    results,
  }
}
