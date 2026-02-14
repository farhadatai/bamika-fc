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
        // 1. Update Registration Status
        const { data: registration, error: regError } = await supabase
          .from('registrations')
          .update({
            status: 'active',
            stripe_subscription_id: subscriptionId,
            payment_status: 'paid'
          })
          .eq('id', registrationId)
          .select()
          .single();

        if (regError) {
            console.error('Error updating registration:', regError);
        } else {
            console.log(`Registration ${registrationId} activated.`);

            // 2. Create Player Record (Copy from Registration)
            if (registration) {
                const { error: playerError } = await supabase
                  .from('players')
                  .insert({
                    parent_id: registration.parent_id,
                    full_name: `${registration.first_name} ${registration.last_name}`,
                    date_of_birth: registration.dob,
                    gender: registration.gender,
                    position: registration.position || 'TBD',
                    jersey_size: registration.jersey_size,
                    medical_conditions: registration.medical_conditions,
                    team_assigned: 'Unassigned',
                    jersey_number: '-'
                  });
                
                if (playerError) {
                    console.error('Error creating player record:', playerError);
                } else {
                    console.log('Player record created successfully from registration.');
                }
            }
        }
      }
      break
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  res.send()
})

export default router
