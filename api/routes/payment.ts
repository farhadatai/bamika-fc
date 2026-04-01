import express from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()
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
      success_url: successUrl || `${process.env.VITE_CLIENT_URL || 'http://localhost:5173'}/dashboard?success=true`,
      cancel_url: `${process.env.VITE_CLIENT_URL || 'http://localhost:5173'}/register?canceled=true`,
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

router.post('/create-billing-portal-session', async (req, res) => {
  const { customerId } = req.body;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.VITE_CLIENT_URL || 'http://localhost:5173'}/dashboard`,
    });
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Billing Portal Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router
