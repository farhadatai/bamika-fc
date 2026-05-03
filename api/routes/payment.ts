import express from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Payment request failed'

const router = express.Router()
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeOptions: Stripe.StripeConfig = { apiVersion: '2023-10-16' }

const getStripeClient = () => {
  if (!stripeSecretKey) {
    throw new Error('Stripe secret key is not configured. Add STRIPE_SECRET_KEY to Vercel Environment Variables, then redeploy.')
  }

  return new Stripe(stripeSecretKey, stripeOptions)
}

type RegistrationRecord = {
  id: string
  player_id?: string | null
  checkout_player_id?: string | null
  first_name: string
  last_name: string
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
      const { data: newReg, error: dbError } = await supabase
        .from('registrations')
        .insert([
          {
            ...registrationData,
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
    const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VITE_BASE_URL || 'https://bamika-fc.vercel.app';
    const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

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
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Full Uniform Package',
            description: 'Game jersey, shorts, socks, and practice jersey',
          },
          unit_amount: 10000, // $100.00
        },
        quantity: 1,
      },
    ];

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
      success_url: successUrl || `${baseUrl}/registration/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/registration/payment`,
      client_reference_id: playerId,
      metadata: {
        registration_id: registration.id,
        player_id: playerId,
      },
      subscription_data: {
        metadata: {
          registration_id: registration.id,
          player_id: playerId,
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
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

router.post('/create-portal-session', async (req, res) => {
  const { customerId } = req.body;
  const stripe = getStripeClient()

  const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VITE_BASE_URL || 'https://bamika-fc.vercel.app';
  const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard`,
    });
    res.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Stripe Billing Portal Error:', error);
    res.status(500).json({ error: getErrorMessage(error) });
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
    res.status(500).json({ error: getErrorMessage(error) })
  }
})

export default router
