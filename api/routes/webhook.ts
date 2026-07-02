import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Webhook processing failed';

const router = express.Router();
const stripeOptions: Stripe.StripeConfig = { apiVersion: '2023-10-16' };
const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecretKey) {
    const error = new Error('Stripe webhook is not configured because STRIPE_SECRET_KEY is missing from the server environment.');
    error.name = 'StripeConfigurationError';
    throw error;
  }

  return new Stripe(stripeSecretKey, stripeOptions);
};

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();

    if (!endpointSecret) {
      console.error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured.');
      return res.status(503).send('Stripe webhook secret is not configured.');
    }

    if (!sig) {
      return res.status(400).send('Missing Stripe signature.');
    }

    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error(`Webhook Error: ${message}`);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const checkoutType = session.metadata?.checkout_type;
      const uniformOrderId = session.metadata?.uniform_order_id;
      const playerId = session.metadata?.player_id || session.client_reference_id;
      const registrationId = session.metadata?.registration_id;
      const subscriptionId = session.subscription as string;
      const customerId = session.customer as string;
      const uniformPurchased = session.metadata?.uniform_purchased === 'true';
      const uniformConfirmationCode = session.metadata?.uniform_confirmation_code || null;

      if (checkoutType === 'uniform_order' && uniformOrderId) {
        const confirmationCode = session.metadata?.confirmation_code || null;
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;

        const { error: orderError } = await supabase
          .from('uniform_orders')
          .update({
            status: 'paid',
            payment_status: 'paid',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_customer_id: customerId,
            confirmation_code: confirmationCode,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', uniformOrderId);

        if (orderError) {
          console.error(`Error updating uniform order ${uniformOrderId}:`, orderError);
        }

        if (playerId) {
          const { error: playerUniformError } = await supabase
            .from('players')
            .update({
              uniform_purchased: true,
              uniform_confirmation_code: confirmationCode,
            })
            .eq('id', playerId);

          if (playerUniformError) {
            console.error(`Error updating player ${playerId} uniform status:`, playerUniformError);
          }
        }

        break;
      }

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
            uniform_purchased: uniformPurchased,
            uniform_confirmation_code: uniformPurchased ? uniformConfirmationCode : null,
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
            uniform_purchased: uniformPurchased,
            uniform_confirmation_code: uniformPurchased ? uniformConfirmationCode : null,
          })
          .eq(registrationId ? 'id' : 'player_id', registrationId || playerId);

        if (regError) {
          console.error(`Error updating registration for player ${playerId}:`, regError);
          if (registrationId) {
            const { error: regRetryError } = await supabase
              .from('registrations')
              .update({
                status: 'active',
                payment_status: 'paid',
                stripe_subscription_id: subscriptionId,
                uniform_purchased: uniformPurchased,
                uniform_confirmation_code: uniformPurchased ? uniformConfirmationCode : null,
              })
              .eq('id', registrationId);

            if (regRetryError) {
              await supabase
                .from('registrations')
                .update({
                  status: 'active',
                  payment_status: 'paid',
                  stripe_subscription_id: subscriptionId,
                })
                .eq('id', registrationId);
            }
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
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const subPlayerId = subscription.metadata.player_id;

      if (!subPlayerId) {
        console.error('Webhook Error: No player_id in subscription.metadata');
        break; 
      }

      const isActive = subscription.status === 'trialing' || subscription.status === 'active';
      const isInactive = subscription.status === 'canceled' || event.type === 'customer.subscription.deleted';
      const playerStatus = isActive ? 'active' : isInactive ? 'inactive' : 'pending_payment';
      const paymentStatus = isActive ? 'paid' : isInactive ? 'cancelled' : subscription.status;

      try {
        const updatePayload = {
          status: playerStatus,
          payment_status: paymentStatus,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
        };

        const { error: playerError } = await supabase
          .from('players')
          .update(updatePayload)
          .eq('id', subPlayerId);

        if (playerError) {
          console.error(`Error updating player ${subPlayerId} from subscription ${subscription.id}:`, playerError);
          await supabase
            .from('players')
            .update({ status: playerStatus, payment_status: paymentStatus })
            .eq('id', subPlayerId);
        }

        await supabase
          .from('registrations')
          .update({
            status: playerStatus,
            payment_status: paymentStatus,
            stripe_subscription_id: subscription.id,
          })
          .or(`player_id.eq.${subPlayerId},checkout_player_id.eq.${subPlayerId}`);

        console.log(`Player ${subPlayerId} payment status updated from Stripe subscription ${subscription.id}.`);
      } catch (error: unknown) {
        console.error('Error processing subscription event:', getErrorMessage(error));
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.send();
});

export default router;
