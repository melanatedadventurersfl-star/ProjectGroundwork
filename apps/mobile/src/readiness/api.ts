import { supabase } from '../lib/supabase';
import type { AdventureQueueItem, ReadinessItem, ReadinessStatus } from './types';

export async function getAdventureQueue() {
  const { data, error } = await supabase
    .from('member_adventure_queue')
    .select('*')
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AdventureQueueItem[];
}

export async function seedReadiness(orderId: string) {
  const { error } = await supabase.rpc('seed_member_readiness', { p_order_id: orderId });
  if (error) throw error;
}

export async function getReadinessItems(orderId: string) {
  await seedReadiness(orderId);

  const { data, error } = await supabase
    .from('member_readiness_items')
    .select('*')
    .eq('order_id', orderId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReadinessItem[];
}

export async function updateReadinessStatus(itemId: string, status: ReadinessStatus) {
  const completed = status === 'complete' || status === 'waived';
  const { error } = await supabase
    .from('member_readiness_items')
    .update({
      status,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) throw error;
}

export function getNextBestAction(items: ReadinessItem[]) {
  const openItems = items.filter((item) => !['complete', 'waived'].includes(item.status));
  if (openItems.length === 0) return null;

  return [...openItems].sort((a, b) => {
    if (a.blocks_check_in !== b.blocks_check_in) return a.blocks_check_in ? -1 : 1;
    if (a.status !== b.status) return a.status === 'blocked' ? -1 : 1;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  })[0];
}
