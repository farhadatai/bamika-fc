import express from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Payment request failed'

const router = express.Router()
const stripeOptions: Stripe.StripeConfig = { apiVersion: '2023-10-16' }
const canonicalBaseUrl = 'https://www.bamikafc.com'
const monthlyClubFeeCents = 2500
const uniformPackageCents = 10000
const previousMonthlyFeeCents = 5000
const monthlyCreditCents = previousMonthlyFeeCents - monthlyClubFeeCents

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

const splitName = (value?: string | null) => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  }
}

const getSafeDate = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return value
  }

  return '1900-01-01'
}

const getRequiredRegistrationDefaults = (player: Record<string, any>) => ({
  dob: getSafeDate(player.date_of_birth, player.dob),
  gender: player.gender || 'Not specified',
  birth_cert_path: player.birth_cert_path || 'not_provided',
  waiver_signed_at: player.waiver_signed_at || player.created_at || new Date().toISOString(),
})

const generateUniformConfirmationCode = () => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `UNI-${new Date().getFullYear()}-${random}`
}

const getPlayerNameParts = (player: Record<string, any>) => {
  const fullName = String(player.full_name || player.name || '').trim()
  const parts = splitName(fullName)
  return {
    firstName: String(player.first_name || parts.firstName || '').trim(),
    lastName: String(player.last_name || parts.lastName || '').trim(),
  }
}

const findOrCreateRegistrationForPlayer = async (
  playerId: string,
  registrationData: Record<string, any> = {},
) => {
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()

  if (playerError || !player) {
    throw new Error(playerError?.message || 'Player not found.')
  }

  const { firstName, lastName } = getPlayerNameParts(player)

  const linkedRegistrations = await supabase
    .from('registrations')
    .select('*')
    .or(`player_id.eq.${playerId},checkout_player_id.eq.${playerId}`)
    .limit(1)

  if (linkedRegistrations.data?.[0]) {
    return linkedRegistrations.data[0] as RegistrationRecord
  }

  if (player.parent_id && firstName) {
    const fallbackRegistrations = await supabase
      .from('registrations')
      .select('*')
      .eq('parent_id', player.parent_id)
      .eq('first_name', firstName)
      .eq('last_name', lastName)
      .limit(1)

    if (fallbackRegistrations.data?.[0]) {
      return fallbackRegistrations.data[0] as RegistrationRecord
    }
  }

  const requiredRegistrationDefaults = getRequiredRegistrationDefaults(player)
  const { include_uniform: _includeUniform, ...safeRegistrationData } = registrationData || {}
  const { data: newRegistration, error: registrationError } = await supabase
    .from('registrations')
    .insert({
      ...safeRegistrationData,
      parent_id: player.parent_id || safeRegistrationData.parent_id || null,
      player_id: playerId,
      checkout_player_id: playerId,
      first_name: safeRegistrationData.first_name || firstName || 'Player',
      last_name: safeRegistrationData.last_name || lastName || '',
      dob: safeRegistrationData.dob || requiredRegistrationDefaults.dob,
      gender: safeRegistrationData.gender || requiredRegistrationDefaults.gender,
      position: safeRegistrationData.position || player.position || 'TBD',
      jersey_size: safeRegistrationData.jersey_size || player.jersey_size || 'YM',
      medical_conditions: safeRegistrationData.medical_conditions || player.medical_conditions || '',
      birth_cert_path: safeRegistrationData.birth_cert_path || requiredRegistrationDefaults.birth_cert_path,
      photo_url: safeRegistrationData.photo_url || player.photo_url || null,
      waiver_signed_at: safeRegistrationData.waiver_signed_at || requiredRegistrationDefaults.waiver_signed_at,
      status: 'pending_payment',
      payment_status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (registrationError || !newRegistration) {
    throw new Error(registrationError?.message || 'Unable to prepare registration payment.')
  }

  return newRegistration as RegistrationRecord
}

const getOrCreateMonthlyPrice = async (stripe: Stripe) => {
  const lookupKey = 'bamika_fc_monthly_25'
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  if (existing.data[0]) return existing.data[0]

  return stripe.prices.create({
    currency: 'usd',
    unit_amount: monthlyClubFeeCents,
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
    product_data: {
      name: 'Bamika FC Monthly Club Fee',
    },
  })
}

const getSubscriptionPlayerId = (subscription: Stripe.Subscription) => (
  subscription.metadata?.player_id
  || subscription.items.data.find((item) => item.metadata?.player_id)?.metadata?.player_id
  || ''
)

const hasMonthlyCreditAlready = async (stripe: Stripe, customerId: string, playerId: string) => {
  const transactions = await stripe.customers.listBalanceTransactions(customerId, { limit: 100 })
  return transactions.data.some((transaction) => (
    transaction.metadata?.bamika_monthly_credit_2026_06 === 'true'
    && (!playerId || transaction.metadata?.player_id === playerId)
  ))
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

const requireUser = async (req: express.Request, res: express.Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    res.status(401).json({ error: 'Missing session.' })
    return null
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)

  if (authError || !authData.user) {
    res.status(401).json({ error: 'Invalid session.' })
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
    const includeUniform = false
    const uniformConfirmationCode = ''

    let registration: RegistrationRecord;

    if (requestPlayerId && !registrationId) {
      registration = await findOrCreateRegistrationForPlayer(String(requestPlayerId), registrationData || {})
    } else if (registrationId) {
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
        return res.status(500).json({ error: dbError.message || 'Failed to save registration data' })
      }

      registration = newReg as RegistrationRecord
    }

    const playerId = requestPlayerId || registration.player_id || registration.checkout_player_id || registration.id;

    const baseUrl = getSiteBaseUrl(req);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Monthly Club Fee',
            description: `Monthly membership for ${registration.first_name} ${registration.last_name}`,
          },
          unit_amount: monthlyClubFeeCents,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ];

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

    const session = await stripe.checkout.sessions.create(checkoutOptions);

    res.json({ url: session.url })
  } catch (error: unknown) {
    console.error('Stripe Error:', error)
    sendPaymentError(res, error)
  }
})

router.post('/admin/players/:playerId/payment-link', async (req, res): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const playerId = String(req.params.playerId || '').trim()
    const includeUniform = false

    if (!playerId) {
      res.status(400).json({ error: 'Missing player id.' })
      return
    }

    const stripe = getStripeClient()

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*, profiles:parent_id(first_name, last_name, email, phone)')
      .eq('id', playerId)
      .single()

    if (playerError || !player) {
      res.status(404).json({ error: playerError?.message || 'Player not found.' })
      return
    }

    const { firstName, lastName } = getPlayerNameParts(player)

    const linkedRegistrations = await supabase
      .from('registrations')
      .select('*')
      .or(`player_id.eq.${playerId},checkout_player_id.eq.${playerId}`)
      .limit(1)

    let registration = linkedRegistrations.data?.[0] as RegistrationRecord | undefined

    if (!registration) {
      const { data: fallbackRegistrations } = await supabase
        .from('registrations')
        .select('*')
        .eq('parent_id', player.parent_id)
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .limit(1)

      registration = fallbackRegistrations?.[0] as RegistrationRecord | undefined
    }

    if (!registration) {
      const requiredRegistrationDefaults = getRequiredRegistrationDefaults(player)
      const { data: newRegistration, error: registrationError } = await supabase
        .from('registrations')
        .insert({
          parent_id: player.parent_id,
          player_id: playerId,
          checkout_player_id: playerId,
          first_name: firstName,
          last_name: lastName,
          dob: requiredRegistrationDefaults.dob,
          gender: requiredRegistrationDefaults.gender,
          position: player.position || 'TBD',
          jersey_size: player.jersey_size || 'YM',
          medical_conditions: player.medical_conditions || '',
          birth_cert_path: requiredRegistrationDefaults.birth_cert_path,
          waiver_signed_at: requiredRegistrationDefaults.waiver_signed_at,
          photo_url: player.photo_url || null,
          status: 'pending_payment',
          payment_status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (registrationError || !newRegistration) {
        res.status(500).json({ error: registrationError?.message || 'Unable to prepare a registration for checkout.' })
        return
      }

      registration = newRegistration as RegistrationRecord
    }

    const baseUrl = getSiteBaseUrl(req)
    const uniformConfirmationCode = includeUniform ? generateUniformConfirmationCode() : ''

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Monthly Club Fee',
            description: `Monthly membership for ${firstName} ${lastName}`,
          },
          unit_amount: monthlyClubFeeCents,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ]

    const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: `${baseUrl}/registration/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard`,
      client_reference_id: playerId,
      customer_email: player.profiles?.email || undefined,
      metadata: {
        registration_id: registration.id,
        player_id: playerId,
        uniform_purchased: includeUniform ? 'true' : 'false',
        uniform_confirmation_code: uniformConfirmationCode,
        created_by_admin: adminUser.id,
      },
      subscription_data: {
        metadata: {
          registration_id: registration.id,
          player_id: playerId,
          uniform_purchased: includeUniform ? 'true' : 'false',
          uniform_confirmation_code: uniformConfirmationCode,
          created_by_admin: adminUser.id,
        },
      },
      allow_promotion_codes: true,
    }

    const session = await stripe.checkout.sessions.create(checkoutOptions)

    res.json({
      success: true,
      url: session.url,
      parentEmail: player.profiles?.email || '',
      message: 'Stripe checkout link created.',
    })
  } catch (error: unknown) {
    console.error('Admin payment link error:', error)
    sendPaymentError(res, error)
  }
})

router.post('/uniform-orders/create-checkout-session', async (req, res): Promise<void> => {
  try {
    const user = await requireUser(req, res)
    if (!user) return

    const playerId = String(req.body?.playerId || '').trim()
    if (!playerId) {
      res.status(400).json({ error: 'Choose the player who needs the uniform.' })
      return
    }

    const stripe = getStripeClient()
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*, profiles:parent_id(first_name, last_name, full_name, email, phone)')
      .eq('id', playerId)
      .eq('parent_id', user.id)
      .single()

    if (playerError || !player) {
      res.status(404).json({ error: playerError?.message || 'Player was not found on this parent account.' })
      return
    }

    const playerName = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Bamika Player'
    const parentProfile = player.profiles || {}
    const parentName = parentProfile.full_name || `${parentProfile.first_name || ''} ${parentProfile.last_name || ''}`.trim() || user.email || ''
    const parentEmail = parentProfile.email || user.email || ''
    const confirmationCode = generateUniformConfirmationCode()

    const { data: order, error: orderError } = await supabase
      .from('uniform_orders')
      .insert({
        parent_id: user.id,
        player_id: playerId,
        player_name: playerName,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentProfile.phone || null,
        jersey_size: player.jersey_size || null,
        jersey_number: player.jersey_number || null,
        team_assigned: player.team_assigned || null,
        amount_cents: uniformPackageCents,
        currency: 'usd',
        status: 'pending_payment',
        payment_status: 'pending',
        confirmation_code: confirmationCode,
      })
      .select('id')
      .single()

    if (orderError || !order?.id) {
      const message = orderError?.message || 'Unable to prepare the uniform order.'
      if (message.includes('uniform_orders') || message.includes('schema cache')) {
        res.status(503).json({ error: 'Uniform ordering needs the latest Supabase database update. Run supabase/APPLY_THIS_IN_SUPABASE.sql, then refresh.' })
        return
      }
      res.status(500).json({ error: message })
      return
    }

    const baseUrl = getSiteBaseUrl(req)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Bamika FC Full Uniform Package',
              description: `${playerName} - size ${player.jersey_size || 'TBD'} - number ${player.jersey_number || 'TBD'}`,
            },
            unit_amount: uniformPackageCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/dashboard?uniform=success`,
      cancel_url: `${baseUrl}/dashboard`,
      client_reference_id: playerId,
      customer_email: parentEmail || undefined,
      metadata: {
        checkout_type: 'uniform_order',
        uniform_order_id: order.id,
        player_id: playerId,
        parent_id: user.id,
        confirmation_code: confirmationCode,
      },
      allow_promotion_codes: true,
    })

    await supabase
      .from('uniform_orders')
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    res.json({ success: true, url: session.url, confirmationCode })
  } catch (error: unknown) {
    console.error('Uniform checkout error:', error)
    sendPaymentError(res, error)
  }
})

router.post('/admin/billing/move-to-25', async (req, res): Promise<void> => {
  try {
    const adminUser = await requireAdmin(req, res)
    if (!adminUser) return

    const dryRun = req.body?.dryRun !== false
    const stripe = getStripeClient()
    const targetPrice = dryRun ? null : await getOrCreateMonthlyPrice(stripe)
    const statuses: Stripe.SubscriptionListParams.Status[] = ['active', 'trialing', 'past_due', 'unpaid']
    const candidates: Array<{
      subscriptionId: string
      customerId: string
      playerId: string
      currentAmount: number
      updated: boolean
      credited: boolean
      skippedReason?: string
    }> = []

    for (const status of statuses) {
      let startingAfter: string | undefined
      do {
        const page = await stripe.subscriptions.list({
          status,
          limit: 100,
          starting_after: startingAfter,
        })

        for (const subscription of page.data) {
          const monthlyItem = subscription.items.data.find((item) => (
            item.price?.recurring?.interval === 'month'
            && (item.price?.unit_amount || 0) > monthlyClubFeeCents
          ))

          if (!monthlyItem) continue

          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
          const playerId = getSubscriptionPlayerId(subscription)

          if (!customerId) {
            candidates.push({
              subscriptionId: subscription.id,
              customerId: '',
              playerId,
              currentAmount: monthlyItem.price?.unit_amount || 0,
              updated: false,
              credited: false,
              skippedReason: 'No Stripe customer found.',
            })
            continue
          }

          let credited = false
          let skippedReason = ''
          const alreadyCredited = await hasMonthlyCreditAlready(stripe, customerId, playerId)

          if (!dryRun && targetPrice) {
            await stripe.subscriptionItems.update(monthlyItem.id, {
              price: targetPrice.id,
              proration_behavior: 'none',
            })

            if (!alreadyCredited && monthlyCreditCents > 0) {
              await stripe.customers.createBalanceTransaction(customerId, {
                amount: -monthlyCreditCents,
                currency: 'usd',
                description: 'Bamika FC credit for previous $50 monthly rate. New monthly rate is $25.',
                metadata: {
                  bamika_monthly_credit_2026_06: 'true',
                  player_id: playerId,
                  subscription_id: subscription.id,
                  created_by_admin: adminUser.id,
                },
              })
              credited = true
            } else if (alreadyCredited) {
              skippedReason = 'Credit already applied.'
            }
          }

          candidates.push({
            subscriptionId: subscription.id,
            customerId,
            playerId,
            currentAmount: monthlyItem.price?.unit_amount || 0,
            updated: !dryRun,
            credited,
            skippedReason,
          })
        }

        startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined
      } while (startingAfter)
    }

    res.json({
      success: true,
      dryRun,
      newMonthlyFee: monthlyClubFeeCents,
      creditAmount: monthlyCreditCents,
      count: candidates.length,
      candidates,
      message: dryRun
        ? `Found ${candidates.length} Stripe subscriptions above $25/mo. No changes were made.`
        : `Updated ${candidates.filter((item) => item.updated).length} subscriptions to $25/mo and applied ${candidates.filter((item) => item.credited).length} credits.`,
    })
  } catch (error: unknown) {
    console.error('Monthly billing migration error:', error)
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
