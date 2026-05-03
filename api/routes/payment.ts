import express from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Payment request failed'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

type RegistrationRecord = {
  id: string
  player_id?: string | null
  checkout_player_id?: string | null
  first_name: string
  last_name: string
}

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { registrationData, registrationId, successUrl, playerId: requestPlayerId } = req.body

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
        return res.status(500).json({ error: 'Failed to save registration data' })
      }
      registration = newReg as RegistrationRecord
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

export default router
