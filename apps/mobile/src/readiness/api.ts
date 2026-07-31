import { supabase } from '../lib/supabase';
import type { AdventureQueueItem, ReadinessItem, ReadinessStatus } from './types';

type HeldOrderRow = {
  id: string;
  status: string;
  adventure_id: string;
  adventures:
    | {
        title: string;
        summary: string | null;
        starts_at: string;
        ends_at: string;
        city: string;
        state: string;
        venue_name: string | null;
      }
    | {
        title: string;
        summary: string | null;
        starts_at: string;
        ends_at: string;
        city: string;
        state: string;
        venue_name: string | null;
      }[]
    | null;
};

function toHeldQueueItem(order: HeldOrderRow): AdventureQueueItem | null {
  const adventure = Array.isArray(order.adventures) ? order.adventures[0] : order.adventures;
  if (!adventure) return null;

  return {
    order_id: order.id,
    adventure_id: order.adventure_id,
    title: adventure.title,
    summary: adventure.summary,
    starts_at: adventure.starts_at,
    ends_at: adventure.ends_at,
    city: adventure.city,
    state: adventure.state,
    venue_name: adventure.venue_name,
    order_status: order.status,
    required_count: 0,
    completed_required_count: 0,
    blocker_count: 0,
    readiness_score: 0,
    next_due_at: null,
  };
}

export async function getAdventureQueue() {
  const [readinessResult, heldResult] = await Promise.all([
    supabase.from('member_adventure_queue').select('*').order('starts_at', { ascending: true }),
    supabase
      .from('orders')
      .select('id,status,adventure_id,adventures(title,summary,starts_at,ends_at,city,state,venue_name)')
      .eq('status', 'held'),
  ]);

  if (readinessResult.error) throw readinessResult.error;
  if (heldResult.error) throw heldResult.error;

  const readinessItems = (readinessResult.data ?? []) as AdventureQueueItem[];
  const readinessOrderIds = new Set(readinessItems.map((item) => item.order_id));
  const heldItems = ((heldResult.data ?? []) as HeldOrderRow[])
    .map(toHeldQueueItem)
    .filter((item): item is AdventureQueueItem => Boolean(item))
    .filter((item) => !readinessOrderIds.has(item.order_id));

  return [...readinessItems, ...heldItems].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
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
