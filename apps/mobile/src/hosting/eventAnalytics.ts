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

export type EventSourceAnalytics = {
  source: string;
  impressions: number;
  pageViews: number;
  clicks: number;
  interested: number;
  checkoutStarts: number;
  orders: number;
  tickets: number;
  shares: number;
  saves: number;
  revenueCents: number;
};

export type EventActivityDay = {
  date: string;
  pageViews: number;
  interested: number;
  checkoutStarts: number;
  orders: number;
  tickets: number;
  checkIns: number;
};

export type EventAnalyticsSummary = {
  impressions: number;
  reach: number;
  views: number;
  clicks: number;
  pageViews: number;
  uniqueViewers?: number;
  interested?: number;
  going?: number;
  saves?: number;
  shares?: number;
  waitlist?: number;
  checkoutStarts: number;
  checkoutAbandons?: number;
  orders: number;
  tickets: number;
  activeTickets?: number;
  refundedTickets?: number;
  cancelledTickets?: number;
  refunds: number;
  checkIns: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents?: number;
  capacity: number;
  sold: number;
  activityByDay?: EventActivityDay[];
  bySource: EventSourceAnalytics[];
};

type AnalyticsEventRow = {
  event_name: string;
  source: string | null;
  quantity: number | null;
  value_cents: number | null;
  actor_profile_id?: string | null;
  session_key?: string | null;
  is_internal?: boolean | null;
  occurred_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function emptySource(source: string): EventSourceAnalytics {
  return { source, impressions: 0, pageViews: 0, clicks: 0, interested: 0, checkoutStarts: 0, orders: 0, tickets: 0, shares: 0, saves: 0, revenueCents: 0 };
}

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
  const [eventsResult, ticketsResult, firstPartyResult] = await Promise.all([
    supabase
      .from('host_event_analytics_events')
      .select('event_name,source,quantity,value_cents,actor_profile_id,session_key,is_internal,occurred_at,metadata')
      .eq('campaign_id', campaignId),
    supabase
      .from('host_event_ticket_sources')
      .select('source,capacity,sold,gross_revenue_cents,refunded_cents,refunded_tickets,cancelled_tickets')
      .eq('campaign_id', campaignId),
    supabase.rpc('get_host_event_first_party_state', { p_campaign_id: campaignId }),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  if (ticketsResult.error) throw ticketsResult.error;

  const bySource = new Map<string, EventSourceAnalytics>();
  const totals = {
    impressions: 0,
    reach: 0,
    views: 0,
    clicks: 0,
    pageViews: 0,
    checkoutStarts: 0,
    checkoutAbandons: 0,
    orders: 0,
    refunds: 0,
    checkIns: 0,
    shares: 0,
  };
  const uniqueViewers = new Set<string>();
  const daily = new Map<string, EventActivityDay>();

  const rows = ((eventsResult.data ?? []) as AnalyticsEventRow[]).filter((row) => row.is_internal !== true);
  for (const row of rows) {
    const quantity = Number(row.quantity ?? 0);
    const source = String(row.source || 'unknown');
    const bucket = bySource.get(source) ?? emptySource(source);
    const date = row.occurred_at ? new Date(row.occurred_at).toISOString().slice(0, 10) : null;
    const day = date ? (daily.get(date) ?? { date, pageViews: 0, interested: 0, checkoutStarts: 0, orders: 0, tickets: 0, checkIns: 0 }) : null;

    if (row.event_name === 'promotion_impression') { totals.impressions += quantity; bucket.impressions += quantity; }
    if (row.event_name === 'promotion_reach') totals.reach += quantity;
    if (row.event_name === 'promotion_view') totals.views += quantity;
    if (row.event_name === 'promotion_click') { totals.clicks += quantity; bucket.clicks += quantity; }
    if (row.event_name === 'event_page_view') {
      totals.pageViews += quantity;
      bucket.pageViews += quantity;
      const viewerKey = row.actor_profile_id ? `profile:${row.actor_profile_id}` : row.session_key ? `session:${row.session_key}` : null;
      if (viewerKey) uniqueViewers.add(viewerKey);
      if (day) day.pageViews += quantity;
    }
    if (row.event_name === 'event_interested') { bucket.interested += quantity; if (day) day.interested += quantity; }
    if (row.event_name === 'event_shared') { totals.shares += quantity; bucket.shares += quantity; }
    if (row.event_name === 'event_saved') bucket.saves += quantity;
    if (row.event_name === 'checkout_started') { totals.checkoutStarts += quantity; bucket.checkoutStarts += quantity; if (day) day.checkoutStarts += quantity; }
    if (row.event_name === 'checkout_abandoned') totals.checkoutAbandons += quantity;
    if (row.event_name === 'ticket_ordered') {
      totals.orders += quantity;
      bucket.orders += quantity;
      bucket.revenueCents += Number(row.value_cents ?? 0);
      const ticketCount = Number(row.metadata?.ticket_count ?? 0);
      if (day) { day.orders += quantity; day.tickets += ticketCount; }
    }
    if (row.event_name === 'ticket_refunded') totals.refunds += quantity;
    if (row.event_name === 'attendee_checked_in') { totals.checkIns += quantity; if (day) day.checkIns += quantity; }

    bySource.set(source, bucket);
    if (day) daily.set(date as string, day);
  }

  let capacity = 0;
  let sold = 0;
  let grossRevenueCents = 0;
  let refundedCents = 0;
  let refundedTickets = 0;
  let cancelledTickets = 0;
  for (const row of ticketsResult.data ?? []) {
    const source = String(row.source || 'unknown');
    const bucket = bySource.get(source) ?? emptySource(source);
    capacity += Number(row.capacity ?? 0);
    sold += Number(row.sold ?? 0);
    grossRevenueCents += Number(row.gross_revenue_cents ?? 0);
    refundedCents += Number(row.refunded_cents ?? 0);
    refundedTickets += Number(row.refunded_tickets ?? 0);
    cancelledTickets += Number(row.cancelled_tickets ?? 0);
    bucket.tickets += Number(row.sold ?? 0);
    bucket.revenueCents = Math.max(bucket.revenueCents, Number(row.gross_revenue_cents ?? 0));
    bySource.set(source, bucket);
  }

  const firstPartyRow = Array.isArray(firstPartyResult.data) ? firstPartyResult.data[0] : firstPartyResult.data;
  const interested = Number(firstPartyRow?.interested ?? 0);
  const going = Number(firstPartyRow?.going ?? 0);
  const saves = Number(firstPartyRow?.saved ?? 0);
  const waitlist = Number(firstPartyRow?.waitlist ?? 0);
  const goMelanated = bySource.get('go_melanated') ?? emptySource('go_melanated');
  goMelanated.interested = interested;
  goMelanated.saves = saves;
  if (goMelanated.pageViews || goMelanated.interested || goMelanated.checkoutStarts || goMelanated.orders || goMelanated.tickets || goMelanated.shares || goMelanated.saves) {
    bySource.set('go_melanated', goMelanated);
  }

  const activeTickets = Math.max(0, sold - refundedTickets - cancelledTickets);
  const netRevenueCents = Math.max(0, grossRevenueCents - refundedCents);

  return {
    ...totals,
    uniqueViewers: uniqueViewers.size,
    interested,
    going,
    saves,
    shares: totals.shares,
    waitlist,
    checkoutAbandons: totals.checkoutAbandons,
    tickets: sold,
    activeTickets,
    refundedTickets,
    cancelledTickets,
    grossRevenueCents,
    refundedCents,
    netRevenueCents,
    capacity,
    sold,
    activityByDay: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    bySource: [...bySource.values()].sort((a, b) => b.revenueCents - a.revenueCents || b.tickets - a.tickets || b.pageViews - a.pageViews),
  };
}
