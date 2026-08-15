import { supabase } from '../lib/supabase';
import type { MemberNotification } from './types';

export async function listNotifications(): Promise<MemberNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, adventure_id, kind, priority, title, body, action_url, read_at, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as MemberNotification[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('archived_at', null)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.rpc('mark_notification_read', { notification_uuid: id });
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

export async function archiveNotification(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function archiveAllNotifications() {
  const { error } = await supabase
    .from('notifications')
    .update({ archived_at: new Date().toISOString() })
    .is('archived_at', null);
  if (error) throw error;
}
