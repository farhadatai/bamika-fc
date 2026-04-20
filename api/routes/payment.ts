import express from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Stripe requires the raw body to construct the event
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const registrationId = session.metadata?.registration_id;

    if (registrationId) {
      try {
        const { error } = await supabase
          .from('registrations')
          .update({ status: 'paid', payment_status: 'paid' })
          .eq('id', registrationId);

        if (error) {
          console.error('Supabase update error:', error);
          // Optionally, you could retry or flag this for manual review
        } else {
          console.log(`✅ Registration ${registrationId} updated to paid.`);
        }
      } catch (dbError) {
        console.error('Database connection error:', dbError);
      }
    }
  }

  res.json({received: true});
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { registrationData, registrationId, successUrl } = req.body

    let registration;

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
      registration = data
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
      registration = newReg
    }

    // DYNAMIC PRICING LOGIC
    const now = new Date();
    const mayFirst2026 = new Date('2026-05-01T00:00:00Z');
    const juneFirst2026 = new Date('2026-06-01T00:00:00Z');

    const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VITE_BASE_URL || 'https://bamika-fc.vercel.app';
    const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Monthly Club Fee',
            description: `Monthly membership for ${registration.first_name} ${registration.last_name}`,
          },
          unit_amount: 5000, // $50.00
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ];

    if (now >= juneFirst2026) {
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
      success_url: `${baseUrl}/registration/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/registration/payment`,
      client_reference_id: registration.id,
      metadata: {
        registration_id: registration.id,
      },
      allow_promotion_codes: true,
    };

    if (now < mayFirst2026) {
      checkoutOptions.subscription_data = {
        trial_end: Math.floor(mayFirst2026.getTime() / 1000),
      };
    }

    const session = await stripe.checkout.sessions.create(checkoutOptions);

    res.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe Error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/create-portal-session', async (req, res) => {
  const { customerId } = req.body;

  const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VITE_BASE_URL || 'https://bamika-fc.vercel.app';
  const baseUrl = rawBaseUrl.endsWith('/') ? rawCBaseUrl.slice(0, -1) : rawBaseUrl;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard`,
    });
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Billing Portal Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router
