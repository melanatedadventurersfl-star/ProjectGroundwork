import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://melanatedadventurersfl-star.github.io',
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : 'https://melanatedadventurersfl-star.github.io';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin);
  }

  try {
    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const website = String(body?.website ?? '').trim();

    // Honeypot: bots receive the same generic response without creating a request.
    if (website) return json({ ok: true }, 200, origin);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return json({ error: 'Enter a valid email address.' }, 400, origin);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      return json({ error: 'Service unavailable.' }, 503, origin);
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    const { error } = await admin.from('account_deletion_requests').insert({
      email,
      user_id: profile?.id ?? null,
      source: 'web',
      status: 'pending',
    });

    // Never reveal whether an account exists. Duplicate open requests also return success.
    if (error && error.code !== '23505') {
      console.error('account deletion request insert failed', error.code, error.message);
      return json({ error: 'Unable to submit your request right now.' }, 500, origin);
    }

    return json({ ok: true }, 200, origin);
  } catch (error) {
    console.error('account deletion request failed', error);
    return json({ error: 'Unable to submit your request right now.' }, 500, origin);
  }
});
