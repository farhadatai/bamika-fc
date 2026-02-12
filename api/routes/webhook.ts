import express from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event: Stripe.Event

  try {
    if (endpointSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret)
    } else {
        // For local development without webhook secret configured
        event = req.body
    }
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session
      const registrationId = session.client_reference_id
      const subscriptionId = session.subscription as string

      if (registrationId) {
        const { error } = await supabase
          .from('registrations')
          .update({
            status: 'active',
            stripe_subscription_id: subscriptionId,
            payment_status: 'paid' // Adding this column to schema might be good, but we have status='active'
          })
          .eq('id', registrationId)

        if (error) {
            console.error('Error updating registration:', error)
        } else {
            console.log(`Registration ${registrationId} activated.`)
        }
      }
      break
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  res.send()
})

export default router
