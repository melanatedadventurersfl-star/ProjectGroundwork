import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!stripeSecret || !supabaseUrl || !serviceRoleKey) return new Response('Payment service is not configured', { status: 503 });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { orderId } = await request.json();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id,total_cents,status,purchaser_id')
    .eq('id', orderId)
    .eq('purchaser_id', user.id)
    .single();

  if (error || !order) return new Response('Order not found', { status: 404 });
  if (!['held', 'payment_pending'].includes(order.status)) return new Response('Order cannot be paid', { status: 409 });

  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });
  const intent = await stripe.paymentIntents.create({
    amount: order.total_cents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { order_id: order.id, purchaser_id: user.id },
  });

  await supabase.from('orders').update({ status: 'payment_pending', stripe_payment_intent_id: intent.id }).eq('id', order.id);

  return Response.json({ paymentIntentClientSecret: intent.client_secret, orderId: order.id });
});