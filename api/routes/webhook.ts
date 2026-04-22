import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';




const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;

  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      const playerId = session.client_reference_id;
      const subscriptionId = session.subscription as string;
      const customerId = session.customer as string;

      if (!playerId) {
        console.error('Webhook Error: No player_id in checkout.session.completed client_reference_id');
        return res.status(400).send('Missing player_id in session.');
      }

      try {
        // Update Player status to Active
        const { error: playerError } = await supabase
          .from('players')
          .update({ status: 'Active' })
          .eq('id', playerId);

        if (playerError) {
          console.error(`Error updating player ${playerId} to active:`, playerError);
        } else {
          console.log(`Player ${playerId} status updated to Active.`);
        }

        // Find and update the corresponding registration log
        const { error: regError } = await supabase
          .from('registrations')
          .update({
            status: 'active',
            payment_status: 'paid',
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
          })
          .eq('player_id', playerId); 

        if (regError) {
          console.error(`Error updating registration for player ${playerId}:`, regError);
        } else {
          console.log(`Registration for player ${playerId} updated.`);
        }

      } catch (error: any) {
        console.error('Error processing checkout.session.completed:', error.message);
      }
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
      const subPlayerId = subscription.metadata.player_id;

      if (!subPlayerId) {
        console.error('Webhook Error: No player_id in subscription.metadata');
        break; 
      }
      
      if (subscription.status === 'trialing' || subscription.status === 'active') {
        try {
          const { error: playerError } = await supabase
            .from('players')
            .update({ status: 'Active' })
            .eq('id', subPlayerId);

          if (playerError) {
            console.error(`Error updating player ${subPlayerId} from subscription ${subscription.id}:`, playerError);
          } else {
            console.log(`Player ${subPlayerId} activated via subscription ${subscription.id}.`);
          }
        } catch (error: any) {
          console.error('Error processing subscription event:', error.message);
        }
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.send();
});

export default router;
