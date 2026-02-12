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

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Bamika FC Membership',
              description: `Monthly membership for ${registration.first_name} ${registration.last_name}`,
            },
            unit_amount: 5000, // $50.00
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.VITE_CLIENT_URL || 'http://localhost:5173'}/dashboard?success=true`,
      cancel_url: `${process.env.VITE_CLIENT_URL || 'http://localhost:5173'}/register?canceled=true`,
      client_reference_id: registration.id,
      metadata: {
        registration_id: registration.id,
      },
    })

    res.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe Error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
