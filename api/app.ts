/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'path'

import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import paymentRoutes from './routes/payment.js'
import webhookRoutes from './routes/webhook.js'
import adminRoutes from './routes/admin.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env


const app: express.Application = express()

// Vercel places one trusted reverse proxy in front of this Express app.
// This lets the rate limiter use the visitor IP from X-Forwarded-For instead
// of treating the entire deployment as one shared client.
app.set('trust proxy', 1)

// Restrict cross-origin API access to the club's own sites. Server-to-server
// callers (Stripe webhooks, curl) send no Origin header and are unaffected.
const allowedOrigins = [
  'https://bamikafc.com',
  'https://www.bamikafc.com',
  ...(process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
]
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true)
    return callback(new Error('Not allowed by CORS'))
  },
}))

// Webhook must be defined before body parsers (and before rate limiting, so
// Stripe's event deliveries are never throttled).
app.use('/webhook', webhookRoutes)

// Defense-in-depth rate limit on the API. Caps abuse of public endpoints such
// as checkout-session creation (spamming Stripe) from a single IP. The real
// login/signup flow runs through Supabase Auth, which is rate limited there.
// Note: on serverless the in-memory counter is per warm instance, so this
// blunts casual scripted abuse rather than a distributed attack.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  // Vercel also sends the standardized Forwarded header. Express currently
  // resolves client IPs from X-Forwarded-For, so that is the intentional source.
  validate: { forwardedHeader: false },
})
app.use('/api', apiLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api', paymentRoutes)
app.use('/api/admin', adminRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
