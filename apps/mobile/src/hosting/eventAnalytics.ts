import { supabase } from '../lib/supabase';

export type EventConnection = {
  id: string;
  provider: string;
  displayName: string | null;
  status: 'connected' | 'attention' | 'disconnected';
  lastSyncedAt: string | null;
  capabilities: Record<string, unknown>;
};

export type EventPromotion = {
  id: string;
  channel: string;
  contentType: string | null;
  title: string | null;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  trackingCode: string | null;
};

export type EventAnalyticsSummary = {
  impressions: number;
  reach: number;
  views: number;
  clicks: number;
  pageViews: number;
  checkoutStarts: number;
  orders: number;
  tickets: number;
  refunds: number;
  checkIns: number;
  grossRevenueCents: number;
  refundedCents: number;
  capacity: number;
  sold: number;
  bySource: Array<{ source: string; impressions: number; clicks: number; orders: number; tickets: number; revenueCents: number }>;
};

export async function listEventConnections(campaignId: string): Promise<EventConnection[]> {
  const { data, error } = await supabase.from('host_event_connections').select('id,provider,display_name,status,last_synced_at,capabilities').eq('campaign_id', campaignId).order('provider');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, provider: row.provider, displayName: row.display_name, status: row.status, lastSyncedAt: row.last_synced_at, capabilities: row.capabilities ?? {} }));
}

export async function listEventPromotions(campaignId: string): Promise<EventPromotion[]> {
  const { data, error } = await supabase.from('host_event_promotions').select('id,channel,content_type,title,status,scheduled_for,published_at,tracking_code').eq('campaign_id', campaignId).order('scheduled_for', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, channel: row.channel, contentType: row.content_type, title: row.title, status: row.status, scheduledFor: row.scheduled_for, publishedAt: row.published_at, trackingCode: row.tracking_code }));
}

export async function getEventAnalyticsSummary(campaignId: string): Promise<EventAnalyticsSummary> {
  const [eventsResult, ticketsResult] = await Promise.all([
    supabase.from('host_event_analytics_events').select('event_name,source,quantity,value_cents').eq('campaign_id', campaignId),
    supabase.from('host_event_ticket_sources').select('source,capacity,sold,gross_revenue_cents,refunded_cents').eq('campaign_id', campaignId),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  if (ticketsResult.error) throw ticketsResult.error;

  const bySource = new Map<string, { source: string; impressions: number; clicks: number; orders: number; tickets: number; revenueCents: number }>();
  const totals = { impressions: 0, reach: 0, views: 0, clicks: 0, pageViews: 0, checkoutStarts: 0, orders: 0, refunds: 0, checkIns: 0 };
  for (const row of eventsResult.data ?? []) {
    const quantity = Number(row.quantity ?? 0);
    const source = String(row.source || 'unknown');
    const bucket = bySource.get(source) ?? { source, impressions: 0, clicks: 0, orders: 0, tickets: 0, revenueCents: 0 };
    if (row.event_name === 'promotion_impression') { totals.impressions += quantity; bucket.impressions += quantity; }
    if (row.event_name === 'promotion_reach') totals.reach += quantity;
    if (row.event_name === 'promotion_view') totals.views += quantity;
    if (row.event_name === 'promotion_click') { totals.clicks += quantity; bucket.clicks += quantity; }
    if (row.event_name === 'event_page_view') totals.pageViews += quantity;
    if (row.event_name === 'checkout_started') totals.checkoutStarts += quantity;
    if (row.event_name === 'ticket_ordered') { totals.orders += quantity; bucket.orders += quantity; bucket.revenueCents += Number(row.value_cents ?? 0); }
    if (row.event_name === 'ticket_refunded') totals.refunds += quantity;
    if (row.event_name === 'attendee_checked_in') totals.checkIns += quantity;
    bySource.set(source, bucket);
  }

  let capacity = 0;
  let sold = 0;
  let grossRevenueCents = 0;
  let refundedCents = 0;
  for (const row of ticketsResult.data ?? []) {
    const source = String(row.source || 'unknown');
    const bucket = bySource.get(source) ?? { source, impressions: 0, clicks: 0, orders: 0, tickets: 0, revenueCents: 0 };
    capacity += Number(row.capacity ?? 0);
    sold += Number(row.sold ?? 0);
    grossRevenueCents += Number(row.gross_revenue_cents ?? 0);
    refundedCents += Number(row.refunded_cents ?? 0);
    bucket.tickets += Number(row.sold ?? 0);
    bucket.revenueCents = Math.max(bucket.revenueCents, Number(row.gross_revenue_cents ?? 0));
    bySource.set(source, bucket);
  }

  return {
    ...totals,
    tickets: sold,
    grossRevenueCents,
    refundedCents,
    capacity,
    sold,
    bySource: [...bySource.values()].sort((a, b) => b.revenueCents - a.revenueCents || b.clicks - a.clicks),
  };
}
