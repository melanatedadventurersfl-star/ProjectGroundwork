import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const googleWebhookUrl = Deno.env.get('GOOGLE_BACKUP_WEBHOOK_URL');
const googleWebhookSecret = Deno.env.get('GOOGLE_BACKUP_WEBHOOK_SECRET');

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!supabaseUrl || !serviceRoleKey) return new Response('Backup service is not configured', { status: 503 });
  if (!googleWebhookUrl || !googleWebhookSecret) return new Response('Google backup destination is not configured', { status: 503 });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('Unauthorized', { status: 401 });

  const callerClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  const caller = userData.user;
  if (!caller) return new Response('Unauthorized', { status: 401 });

  const { data: isAdmin, error: adminError } = await callerClient.rpc('is_platform_admin', {
    check_profile_id: caller.id,
  });
  if (adminError || !isAdmin) return new Response('Forbidden', { status: 403 });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const body = await request.json().catch(() => ({}));
  const maxRows = Math.max(1, Math.min(Number(body?.maxRows ?? 100), 500));

  const { data: rows, error: batchError } = await serviceClient.rpc('get_backup_outbox_batch', {
    max_rows: maxRows,
  });
  if (batchError) return Response.json({ error: batchError.message }, { status: 500 });
  if (!rows?.length) return Response.json({ synced: 0, message: 'Nothing to sync.' });

  const ids = rows.map((row: { id: number }) => row.id);

  try {
    const response = await fetch(googleWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Go-Melanated-Backup-Secret': googleWebhookSecret,
      },
      body: JSON.stringify({
        source: 'go-melanated',
        sentAt: new Date().toISOString(),
        events: rows,
      }),
    });

    if (!response.ok) {
      const message = `Google backup destination returned ${response.status}: ${await response.text()}`;
      await serviceClient.rpc('mark_backup_outbox_failed', { sync_ids: ids, error_message: message });
      return Response.json({ error: message }, { status: 502 });
    }

    await serviceClient.rpc('mark_backup_outbox_synced', { sync_ids: ids });
    return Response.json({ synced: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Google backup error';
    await serviceClient.rpc('mark_backup_outbox_failed', { sync_ids: ids, error_message: message });
    return Response.json({ error: message }, { status: 502 });
  }
});
