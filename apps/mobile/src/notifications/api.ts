import { supabase } from '../lib/supabase';
import type { MemberNotification } from './types';

type NotificationStateListener = () => void;
const notificationStateListeners = new Set<NotificationStateListener>();

function emitNotificationStateChanged() {
  notificationStateListeners.forEach((listener) => listener());
}

async function currentRecipientId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You must be signed in.');
  return userId;
}

export function subscribeNotificationStateChanges(listener: NotificationStateListener) {
  notificationStateListeners.add(listener);
  return () => {
    notificationStateListeners.delete(listener);
  };
}

export async function listNotifications(): Promise<MemberNotification[]> {
  const recipientId = await currentRecipientId();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, adventure_id, kind, priority, title, body, action_url, read_at, created_at')
    .eq('recipient_id', recipientId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as MemberNotification[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const recipientId = await currentRecipientId();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .is('archived_at', null)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function registerPushToken(expoPushToken: string, platform: string) {
  const { data, error } = await supabase.rpc('register_device_push_token', {
    expo_token: expoPushToken,
    device_platform: platform,
  });
  if (error) throw error;
  return data as string;
}

export async function markNotificationRead(id: string) {
  const recipientId = await currentRecipientId();
  const { error } = await supabase.rpc('mark_notification_read', { notification_uuid: id });
  if (error) throw error;

  const { data: persisted, error: verifyError } = await supabase
    .from('notifications')
    .select('read_at')
    .eq('id', id)
    .eq('recipient_id', recipientId)
    .single();
  if (verifyError) throw verifyError;
  if (!persisted?.read_at) throw new Error('Notification read state did not persist.');

  emitNotificationStateChanged();
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
  emitNotificationStateChanged();
}

export async function archiveNotification(id: string) {
  const recipientId = await currentRecipientId();
  const { error } = await supabase
    .from('notifications')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_id', recipientId);
  if (error) throw error;
  emitNotificationStateChanged();
}

export async function archiveAllNotifications() {
  const recipientId = await currentRecipientId();
  const { error } = await supabase
    .from('notifications')
    .update({ archived_at: new Date().toISOString() })
    .eq('recipient_id', recipientId)
    .is('archived_at', null);
  if (error) throw error;
  emitNotificationStateChanged();
}
