import express from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Payment request failed'

const router = express.Router()
const stripeOptions: Stripe.StripeConfig = { apiVersion: '2023-10-16' }
const canonicalBaseUrl = 'https://www.bamikafc.com'

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) {
    const error = new Error('Stripe is not configured yet. Add STRIPE_SECRET_KEY to the server environment for Production, then redeploy.')
    error.name = 'StripeConfigurationError'
    throw error
  }

  return new Stripe(stripeSecretKey, stripeOptions)
}

const sendPaymentError = (res: express.Response, error: unknown) => {
  const message = getErrorMessage(error)
  const isConfigurationError = error instanceof Error && error.name === 'StripeConfigurationError'
  res.status(isConfigurationError ? 503 : 500).json({
    error: message,
    code: isConfigurationError ? 'STRIPE_NOT_CONFIGURED' : 'PAYMENT_ERROR',
  })
}

const normalizeBaseUrl = (value?: string | null) => {
  if (!value) return null

  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    url.pathname = url.pathname.replace(/\/+$/, '')
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

const isLocalHost = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1'
const isProductionHost = (hostname: string) => hostname === 'www.bamikafc.com' || hostname === 'bamikafc.com'
const isAllowedReturnHost = (hostname: string, baseHostname: string) => {
  if (isProductionHost(hostname)) return true
  return isLocalHost(hostname) && isLocalHost(baseHostname)
}

const getRequestOrigin = (req: express.Request) => {
  const origin = normalizeBaseUrl(req.get('origin'))
  if (origin) return origin

  const host = req.get('x-forwarded-host') || req.get('host')
  if (!host) return null

  const protocol = req.get('x-forwarded-proto') || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https')
  return normalizeBaseUrl(`${protocol}://${host}`)
}

const getSiteBaseUrl = (req: express.Request) => {
  const requestOrigin = getRequestOrigin(req)
  if (requestOrigin) {
    const requestHost = new URL(requestOrigin).hostname
    if (isLocalHost(requestHost)) return requestOrigin
  }

  const configuredUrls = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.VITE_BASE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]

  for (const value of configuredUrls) {
    const normalized = normalizeBaseUrl(value)
    if (!normalized) continue

    const hostname = new URL(normalized).hostname
    if (isProductionHost(hostname) || isLocalHost(hostname)) return normalized
  }

  if (requestOrigin) {
    const requestHost = new URL(requestOrigin).hostname
    if (isProductionHost(requestHost)) return requestOrigin
  }

  return canonicalBaseUrl
}

const buildReturnUrl = (req: express.Request, requestedUrl: unknown, fallbackPath: string) => {
  const baseUrl = getSiteBaseUrl(req)
  const fallbackUrl = `${baseUrl}${fallbackPath}`

  if (typeof requestedUrl !== 'string' || !requestedUrl.trim()) return fallbackUrl

  try {
    const requested = new URL(requestedUrl, baseUrl)
    const baseHostname = new URL(baseUrl).hostname

    if (!isAllowedReturnHost(requested.hostname, baseHostname)) {
      return fallbackUrl
    }

    requested.hash = ''
    return requested.toString()
  } catch {
    return fallbackUrl
  }
}

type RegistrationRecord = {
  id: string
  player_id?: string | null
  checkout_player_id?: string | null
  first_name: string
  last_name: string
}

const generateUniformConfirmationCode = () => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `UNI-${new Date().getFullYear()}-${random}`
}

const requireAdmin = async (req: express.Request, res: express.Response) => {
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
    res.status(403).json({ error: 'Only admins can manage billing.' })
    return null
  }

  return authData.user
}

const findPlayerSubscription = async (playerId: string, storedSubscriptionId?: string | null) => {
  const stripe = getStripeClient()

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
      query: `metadata['player_id']:'${playerId}' AND status:'active'`,
      limit: 1,
    })
    if (result.data[0]) return result.data[0]
  } catch (error) {
    console.warn('Stripe subscription search failed, falling back to list:', getErrorMessage(error))
  }

  const statuses: Stripe.SubscriptionListParams.Status[] = ['active', 'trialing', 'past_due', 'unpaid']
  for (const status of statuses) {
    const list = await stripe.subscriptions.list({ status, limit: 100 })
    const match = list.data.find((subscription) => subscription.metadata?.player_id === playerId)
    if (match) return match
  }

  return null
}

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { registrationData, registrationId, successUrl, playerId: requestPlayerId } = req.body
    const stripe = getStripeClient()
    const includeUniform = Boolean(req.body.includeUniform ?? registrationData?.include_uniform)
    const uniformConfirmationCode = includeUniform ? generateUniformConfirmationCode() : ''

    let registration: RegistrationRecord;

    if (registrationId) {
      // Fetch existing registration
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', registrationId)
        .single()
      
      if (error || !data) {
        return res.status(404).json({ error: 'Registration not found' })
      }
      registration = data as RegistrationRecord
    } else {
      // 1. Create a pending registration in Supabase
      const { include_uniform: _includeUniform, ...safeRegistrationData } = registrationData || {}
      const { data: newReg, error: dbError } = await supabase
        .from('registrations')
        .insert([
          {
            ...safeRegistrationData,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (dbError) {
        console.error('Database Error:', dbError)
        if (!requestPlayerId) {
          return res.status(500).json({ error: dbError.message || 'Failed to save registration data' })
        }

        registration = {
          id: requestPlayerId,
          player_id: requestPlayerId,
          first_name: registrationData?.first_name || '',
          last_name: registrationData?.last_name || '',
        }
      } else {
        registration = newReg as RegistrationRecord
      }
    }

    const playerId = requestPlayerId || registration.player_id || registration.checkout_player_id || registration.id;

    // DYNAMIC PRICING LOGIC
    const now = new Date();
    const mayFirst2026 = new Date('2026-05-01T00:00:00Z');
    const julyFirst2026 = new Date('2026-07-01T00:00:00Z');
    const isPromoSignup = now < julyFirst2026;
    const baseUrl = getSiteBaseUrl(req);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Monthly Club Fee',
            description: isPromoSignup
              ? `Promo monthly membership for ${registration.first_name} ${registration.last_name}`
              : `Monthly membership for ${registration.first_name} ${registration.last_name}`,
          },
          unit_amount: isPromoSignup ? 5000 : 5900, // Promo $50.00, regular $59.00
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ];

    if (includeUniform) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Full Uniform Package',
            description: 'Game jersey, shorts, socks, and practice jersey',
          },
          unit_amount: 10000, // $100.00
        },
        quantity: 1,
      });
    }

    if (!isPromoSignup) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'One-Time Registration Fee',
          },
          unit_amount: 9900, // $99.00
        },
        quantity: 1,
      });
    }

    const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: buildReturnUrl(req, successUrl, '/registration/success?session_id={CHECKOUT_SESSION_ID}'),
      cancel_url: `${baseUrl}/dashboard`,
      client_reference_id: playerId,
      metadata: {
        registration_id: registration.id,
        player_id: playerId,
        uniform_purchased: includeUniform ? 'true' : 'false',
        uniform_confirmation_code: uniformConfirmationCode,
      },
      subscription_data: {
        metadata: {
          registration_id: registration.id,
          player_id: playerId,
          uniform_purchased: includeUniform ? 'true' : 'false',
          uniform_confirmation_code: uniformConfirmationCode,
        },
      },
      allow_promotion_codes: true,
    };

    if (now < mayFirst2026) {
      checkoutOptions.subscription_data = {
        ...checkoutOptions.subscription_data,
        trial_end: Math.floor(mayFirst2026.getTime() / 1000),
      };
    }

    const session = await stripe.checkout.sessions.create(checkoutOptions);

    res.json({ url: session.url })
  } catch (error: unknown) {
    console.error('Stripe Error:', error)
    sendPaymentError(res, error)
  }
})

router.post('/create-portal-session', async (req, res) => {
  try {
    const { customerId } = req.body;
    const stripe = getStripeClient()

    if (!customerId) {
      res.status(400).json({ error: 'Missing Stripe customer id.' })
      return
    }

    const baseUrl = getSiteBaseUrl(req);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard`,
    });
    res.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Stripe Billing Portal Error:', error);
    sendPaymentError(res, error);
  }
});

router.post('/cancel-player-subscription', async (req, res): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const playerId = String(req.body.playerId || '').trim()
    const cancelAtPeriodEnd = req.body.cancelAtPeriodEnd !== false

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

    const stripe = getStripeClient()
    const subscription = await findPlayerSubscription(playerId, player.stripe_subscription_id)
    let cancelledSubscription: Stripe.Subscription | null = null

    if (subscription) {
      cancelledSubscription = cancelAtPeriodEnd
        ? await stripe.subscriptions.update(subscription.id, {
            cancel_at_period_end: true,
            metadata: {
              ...subscription.metadata,
              cancelled_by_admin: adminUser.id,
              cancelled_for_player_id: playerId,
            },
          })
        : await stripe.subscriptions.cancel(subscription.id)
    }

    const playerUpdate = {
      status: 'inactive',
      payment_status: cancelledSubscription ? 'cancelled' : 'paused',
      team_assigned: 'Unassigned',
      stripe_subscription_id: cancelledSubscription?.id || player.stripe_subscription_id || null,
      stripe_customer_id: typeof cancelledSubscription?.customer === 'string'
        ? cancelledSubscription.customer
        : player.stripe_customer_id || null,
    }

    const { error: updateError } = await supabase
      .from('players')
      .update(playerUpdate)
      .eq('id', playerId)

    if (updateError) {
      const { error: fallbackError } = await supabase
        .from('players')
        .update({
          status: 'inactive',
          payment_status: cancelledSubscription ? 'cancelled' : 'paused',
          team_assigned: 'Unassigned',
        })
        .eq('id', playerId)

      if (fallbackError) {
        res.status(500).json({ error: fallbackError.message })
        return
      }
    }

    const playerName = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim()
    const nameParts = playerName.split(/\s+/).filter(Boolean)
    await supabase
      .from('registrations')
      .update({
        status: 'inactive',
        payment_status: cancelledSubscription ? 'cancelled' : 'paused',
        stripe_subscription_id: cancelledSubscription?.id || null,
      })
      .eq('parent_id', player.parent_id)
      .eq('first_name', nameParts[0] || '')
      .eq('last_name', nameParts.slice(1).join(' '))

    res.json({
      success: true,
      message: cancelledSubscription
        ? cancelAtPeriodEnd
          ? 'Stripe subscription will cancel at the end of the current billing period. Player marked inactive.'
          : 'Stripe subscription cancelled immediately. Player marked inactive.'
        : 'No active Stripe subscription was found. Player marked inactive and billing status paused.',
      subscriptionId: cancelledSubscription?.id || null,
      cancelAtPeriodEnd: cancelledSubscription?.cancel_at_period_end || false,
    })
  } catch (error: unknown) {
    console.error('Cancel subscription error:', error)
    sendPaymentError(res, error)
  }
})

export default router
