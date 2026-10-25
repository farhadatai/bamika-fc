// Small shared Resend sender. Mirrors the reminder mailer: when RESEND_API_KEY
// is missing we log instead of failing, so a mail problem never breaks a signup.

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

export { escapeHtml }

export const sendEmail = async ({ to, subject, html, replyTo }: {
  to: string[]
  subject: string
  html: string
  replyTo?: string
}): Promise<{ sent: boolean, detail?: string }> => {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromAddress = process.env.REMINDER_FROM_EMAIL?.trim() || 'Bamika FC <reminders@bamikafc.com>'

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not configured — skipped "${subject}" to ${to.join(', ')}`)
    return { sent: false, detail: 'RESEND_API_KEY not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    })
    const body = await response.json().catch(() => ({})) as { message?: string }
    if (!response.ok) return { sent: false, detail: body.message || `Resend responded ${response.status}` }
    return { sent: true }
  } catch (error) {
    return { sent: false, detail: error instanceof Error ? error.message : 'Send failed' }
  }
}
