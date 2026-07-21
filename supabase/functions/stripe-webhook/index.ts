import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async (request) => {
  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRoleKey) return new Response('Webhook not configured', { status: 503 });

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });
  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.order_id;
    if (orderId) {
      await supabase.from('orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', orderId);
      await supabase.rpc('issue_order_credentials', { p_order_id: orderId });
    }
  }

  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.order_id;
    if (orderId) await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  }

  return Response.json({ received: true });
});