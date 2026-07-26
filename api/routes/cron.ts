import { Router, type Request, type Response } from 'express'
import { runPaymentReminders } from '../lib/reminders.js'

const router = Router()

// Vercel Cron calls this on the schedule in vercel.json and automatically
// sends "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET env var is
// set on the project. Reject anything without that exact header.
router.get('/payment-reminders', async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.CRON_SECRET?.trim()

  if (!secret) {
    res.status(500).json({ error: 'CRON_SECRET is not configured on the server.' })
    return
  }

  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }

  try {
    const summary = await runPaymentReminders({ dryRun: req.query.dryRun === '1' })
    res.status(200).json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reminder run failed.'
    res.status(500).json({ error: message })
  }
})

export default router
