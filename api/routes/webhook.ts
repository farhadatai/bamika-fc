import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Webhook processing failed';

const router = express.Router();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeOptions: Stripe.StripeConfig = { apiVersion: '2023-10-16' };
const getStripeClient = () => {
  if (!stripeSecretKey) {
    throw new Error('Stripe secret key is not configured. Add STRIPE_SECRET_KEY to Vercel Environment Variables, then redeploy.');
  }

  return new Stripe(stripeSecretKey, stripeOptions);
};

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();

    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error(`Webhook Error: ${message}`);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const playerId = session.metadata?.player_id || session.client_reference_id;
      const registrationId = session.metadata?.registration_id;
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
          .update({
            status: 'active',
            payment_status: 'paid',
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
          })
          .eq('id', playerId);

        if (playerError) {
          console.error(`Error updating player ${playerId} to active with Stripe ids:`, playerError);
          await supabase
            .from('players')
            .update({ status: 'active', payment_status: 'paid' })
            .eq('id', playerId);
        } else {
          console.log(`Player ${playerId} status updated to active.`);
        }

        // Find and update the corresponding registration log
        const { error: regError } = await supabase
          .from('registrations')
          .update({
            status: 'active',
            payment_status: 'paid',
            stripe_subscription_id: subscriptionId,
          })
          .eq(registrationId ? 'id' : 'player_id', registrationId || playerId);

        if (regError) {
          console.error(`Error updating registration for player ${playerId}:`, regError);
          if (registrationId) {
            await supabase
              .from('registrations')
              .update({
                status: 'active',
                payment_status: 'paid',
                stripe_subscription_id: subscriptionId,
              })
              .eq('id', registrationId);
          }
        } else {
          console.log(`Registration for player ${playerId} updated.`);
        }

      } catch (error: unknown) {
        console.error('Error processing checkout.session.completed:', getErrorMessage(error));
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
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
            .update({
              status: 'active',
              payment_status: 'paid',
              stripe_subscription_id: subscription.id,
              stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
            })
            .eq('id', subPlayerId);

          if (playerError) {
            console.error(`Error updating player ${subPlayerId} from subscription ${subscription.id}:`, playerError);
            await supabase
              .from('players')
              .update({ status: 'active', payment_status: 'paid' })
              .eq('id', subPlayerId);
          } else {
            console.log(`Player ${subPlayerId} activated via subscription ${subscription.id}.`);
          }
        } catch (error: unknown) {
          console.error('Error processing subscription event:', getErrorMessage(error));
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.send();
});

export default router;
