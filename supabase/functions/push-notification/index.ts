import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationRecord = {
  id: string;
  recipient_id: string;
  kind: string;
  priority: string;
  title: string;
  body: string;
  action_url: string | null;
};

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: NotificationRecord | null;
  old_record: NotificationRecord | null;
};

type PushTicket = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Server configuration is incomplete.' }, { status: 500 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const notificationId = payload.record?.id;
  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !notificationId) {
    return Response.json({ skipped: true, reason: 'Unsupported webhook payload.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: notification, error: notificationError } = await admin
    .from('notifications')
    .select('id, recipient_id, kind, priority, title, body, action_url')
    .eq('id', notificationId)
    .single<NotificationRecord>();

  if (notificationError || !notification) {
    return Response.json({ error: 'Notification not found.' }, { status: 404 });
  }

  const { data: existingDelivery } = await admin
    .from('notification_deliveries')
    .select('id, status')
    .eq('notification_id', notification.id)
    .eq('channel', 'push')
    .maybeSingle();

  if (existingDelivery?.status === 'sent' || existingDelivery?.status === 'delivered') {
    return Response.json({ skipped: true, reason: 'Push already sent.' });
  }

  const { data: devices, error: devicesError } = await admin
    .from('device_push_tokens')
    .select('id, expo_push_token')
    .eq('profile_id', notification.recipient_id)
    .eq('enabled', true);

  if (devicesError) {
    return Response.json({ error: devicesError.message }, { status: 500 });
  }

  if (!devices?.length) {
    await admin.from('notification_deliveries').upsert({
      notification_id: notification.id,
      channel: 'push',
      status: 'skipped',
      attempted_at: new Date().toISOString(),
      failure_reason: 'No active push-enabled devices are registered.',
    }, { onConflict: 'notification_id,channel' });

    return Response.json({ skipped: true, reason: 'No registered devices.' });
  }

  const messages = devices.map((device) => ({
    to: device.expo_push_token,
    sound: 'default',
    channelId: 'general',
    title: notification.title,
    body: notification.body,
    priority: notification.priority === 'high' || notification.priority === 'critical' ? 'high' : 'default',
    data: {
      notification_id: notification.id,
      action_url: notification.action_url,
      kind: notification.kind,
      priority: notification.priority,
    },
  }));

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

  const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  const expoBody = await expoResponse.json().catch(() => ({}));
  const tickets = Array.isArray(expoBody?.data) ? expoBody.data as PushTicket[] : [];

  const disabledDeviceIds: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && devices[index]?.id) {
      disabledDeviceIds.push(devices[index].id);
    }
  });

  if (disabledDeviceIds.length) {
    await admin
      .from('device_push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .in('id', disabledDeviceIds);
  }

  const successfulTickets = tickets.filter((ticket) => ticket.status === 'ok');
  const deliveryStatus = expoResponse.ok && successfulTickets.length > 0 ? 'sent' : 'failed';
  const providerIds = successfulTickets.map((ticket) => ticket.id).filter(Boolean);
  const failures = tickets
    .filter((ticket) => ticket.status === 'error')
    .map((ticket) => ticket.message ?? ticket.details?.error ?? 'Expo rejected a push ticket.');

  await admin.from('notification_deliveries').upsert({
    notification_id: notification.id,
    channel: 'push',
    status: deliveryStatus,
    attempted_at: new Date().toISOString(),
    provider_message_id: providerIds.length ? JSON.stringify(providerIds) : null,
    failure_reason: failures.length ? failures.join(' | ') : null,
  }, { onConflict: 'notification_id,channel' });

  return Response.json({
    status: deliveryStatus,
    devices: devices.length,
    sent: successfulTickets.length,
    disabled: disabledDeviceIds.length,
  }, { status: deliveryStatus === 'sent' ? 200 : 502 });
});
