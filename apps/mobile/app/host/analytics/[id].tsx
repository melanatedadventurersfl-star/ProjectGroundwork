import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCampaignForAdventure } from '../../../src/hosting/eventBuilder';
import { getEventAnalyticsSummary, listEventConnections, listEventPromotions, type EventAnalyticsSummary, type EventConnection, type EventPromotion } from '../../../src/hosting/eventAnalytics';

const emptySummary: EventAnalyticsSummary = { impressions: 0, reach: 0, views: 0, clicks: 0, pageViews: 0, checkoutStarts: 0, orders: 0, tickets: 0, refunds: 0, checkIns: 0, grossRevenueCents: 0, refundedCents: 0, capacity: 0, sold: 0, bySource: [] };

export default function EventAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [summary, setSummary] = useState<EventAnalyticsSummary>(emptySummary);
  const [connections, setConnections] = useState<EventConnection[]>([]);
  const [promotions, setPromotions] = useState<EventPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const nextCampaign = await getCampaignForAdventure(id);
        if (!nextCampaign) throw new Error('Event workspace not found.');
        const [nextSummary, nextConnections, nextPromotions] = await Promise.all([
          getEventAnalyticsSummary(nextCampaign.id),
          listEventConnections(nextCampaign.id),
          listEventPromotions(nextCampaign.id),
        ]);
        setCampaign(nextCampaign); setSummary(nextSummary); setConnections(nextConnections); setPromotions(nextPromotions);
      } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load event analytics.'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const activeTickets = summary.activeTickets ?? summary.sold;
  const remaining = summary.capacity > 0 ? Math.max(0, summary.capacity - activeTickets) : null;
  const netRevenue = summary.netRevenueCents ?? Math.max(0, summary.grossRevenueCents - summary.refundedCents);
  const viewToTicket = summary.pageViews > 0 ? Math.round((activeTickets / summary.pageViews) * 1000) / 10 : 0;
  const lastActivity = (summary.activityByDay ?? []).slice(-14).reverse();

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading event analytics…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event</Text></Pressable>
    <Text style={styles.eyebrow}>EVENT ANALYTICS</Text><Text style={styles.title}>{campaign?.title || 'Event performance'}</Text><Text style={styles.subtitle}>Go Melanated activity and connected event sources roll into one view. Host and event-staff testing is excluded from audience activity.</Text>

    {error ? <Text style={styles.error}>{error}</Text> : null}

    <Text style={styles.sectionTitle}>Audience</Text>
    <View style={styles.metrics}><Metric value={String(summary.uniqueViewers ?? 0)} label="Unique viewers" /><Metric value={String(summary.interested ?? 0)} label="Interested" /><Metric value={String(summary.going ?? 0)} label="Going" /></View>
    <View style={styles.metrics}><Metric value={String(summary.saves ?? 0)} label="Saved" /><Metric value={String(summary.shares ?? 0)} label="Shares" /><Metric value={String(summary.waitlist ?? 0)} label="Waitlist" /></View>

    <Text style={styles.sectionTitle}>Registration</Text>
    <View style={styles.metrics}><Metric value={String(activeTickets)} label="Active tickets" /><Metric value={remaining == null ? '—' : String(remaining)} label="Remaining" /><Metric value={`$${(netRevenue / 100).toLocaleString()}`} label="Net revenue" /></View>
    <View style={styles.metrics}><Metric value={String(summary.sold)} label="Tickets sold" /><Metric value={String(summary.refundedTickets ?? 0)} label="Refunded tickets" /><Metric value={String(summary.checkIns)} label="Checked in" /></View>
    <View style={styles.metrics}><Metric value={String(summary.orders)} label="Tracked orders" /><Metric value={String(summary.checkoutAbandons ?? 0)} label="Abandoned checkout" /><Metric value={`$${(summary.grossRevenueCents / 100).toLocaleString()}`} label="Gross revenue" /></View>

    <Text style={styles.sectionTitle}>Event funnel</Text>
    <View style={styles.funnel}><Funnel value={summary.pageViews} label="Event page views" /><Funnel value={summary.uniqueViewers ?? 0} label="Unique viewers" /><Funnel value={summary.interested ?? 0} label="Currently interested" /><Funnel value={summary.checkoutStarts} label="Checkout starts" /><Funnel value={summary.orders} label="Completed orders" /><Funnel value={activeTickets} label="Active tickets" /></View>
    <Text style={styles.funnelMeta}>{summary.pageViews > 0 ? `${viewToTicket}% tracked page-view-to-ticket rate. Interested is a current RSVP state, so people who later register can move out of that count.` : 'Conversion rates appear after tracked Go Melanated or connected-source activity is recorded.'}</Text>

    <Text style={styles.sectionTitle}>Promotion reach</Text>
    <View style={styles.metrics}><Metric value={summary.impressions.toLocaleString()} label="Impressions" /><Metric value={summary.reach.toLocaleString()} label="Reach" /><Metric value={summary.clicks.toLocaleString()} label="Tracked clicks" /></View>

    <Text style={styles.sectionTitle}>Connected services</Text>
    {connections.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No event sources have recorded activity yet.</Text><Text style={styles.emptyBody}>Go Melanated appears automatically after first-party event activity. Eventbrite, Facebook, Instagram, email and other sources appear when connected.</Text></View> : connections.map((connection) => <View key={connection.id} style={styles.connection}><View style={{ flex: 1 }}><Text style={styles.connectionTitle}>{connection.displayName || connection.provider.replace(/_/g, ' ')}</Text><Text style={styles.connectionMeta}>{connection.provider.toUpperCase()} · {connection.lastSyncedAt ? `Synced ${new Date(connection.lastSyncedAt).toLocaleString()}` : 'Not synced yet'}</Text></View><Text style={[styles.connectionStatus, connection.status === 'attention' && styles.attention]}>{connection.status.toUpperCase()}</Text></View>)}

    <Text style={styles.sectionTitle}>Performance by source</Text>
    {summary.bySource.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No attributed activity yet.</Text><Text style={styles.emptyBody}>First-party activity, tracked links and ticket-source syncs populate this section while preserving the original source.</Text></View> : summary.bySource.map((source) => <View key={source.source} style={styles.source}><View style={styles.sourceTop}><Text style={styles.sourceTitle}>{source.source.replace(/_/g, ' ')}</Text><Text style={styles.sourceRevenue}>${(source.revenueCents / 100).toLocaleString()}</Text></View><Text style={styles.sourceMeta}>{source.pageViews.toLocaleString()} views · {source.clicks.toLocaleString()} clicks · {source.interested.toLocaleString()} interested · {source.checkoutStarts.toLocaleString()} checkout · {source.orders} orders · {source.tickets} tickets</Text></View>)}

    <Text style={styles.sectionTitle}>Recent activity</Text>
    {lastActivity.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No daily activity recorded yet.</Text><Text style={styles.emptyBody}>Daily event views, interest, checkout, orders, tickets and check-ins will appear here as activity arrives.</Text></View> : <View style={styles.activityList}>{lastActivity.map((day) => <View key={day.date} style={styles.activityRow}><Text style={styles.activityDate}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text><Text style={styles.activityMeta}>{day.pageViews} views · {day.interested} interest · {day.checkoutStarts} checkout · {day.tickets} tickets</Text></View>)}</View>}

    <Text style={styles.sectionTitle}>Promotions</Text>
    {promotions.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No tracked promotions yet.</Text><Text style={styles.emptyBody}>Scheduled Facebook, Instagram, email and other promotion records can share one attribution model while keeping their channel-specific results.</Text></View> : promotions.map((promotion) => <View key={promotion.id} style={styles.promotion}><View style={{ flex: 1 }}><Text style={styles.connectionTitle}>{promotion.title || promotion.contentType || 'Promotion'}</Text><Text style={styles.connectionMeta}>{promotion.channel.toUpperCase()} · {promotion.status}{promotion.scheduledFor ? ` · ${new Date(promotion.scheduledFor).toLocaleDateString()}` : ''}</Text></View>{promotion.trackingCode ? <Text style={styles.tracked}>TRACKED</Text> : null}</View>)}

    <Text style={styles.note}>These are operational event metrics. They are separate from optional AI product-improvement analytics and do not require hosts to count their own testing as audience activity.</Text>
  </ScrollView></SafeAreaView>;
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Funnel({ value, label }: { value: number; label: string }) { return <View style={styles.funnelRow}><Text style={styles.funnelValue}>{value.toLocaleString()}</Text><Text style={styles.funnelLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0A0F0C' }, center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', gap: 8 }, muted: { color: '#7F8B83', fontSize: 10 }, content: { padding: 18, paddingBottom: 76 }, back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 16 }, eyebrow: { color: '#84C992', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#8F9C93', fontSize: 10.5, lineHeight: 16, marginTop: 5 }, sectionTitle: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 }, metrics: { flexDirection: 'row', gap: 8, marginTop: 8 }, metric: { flex: 1, minHeight: 72, borderRadius: 13, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 10 }, metricValue: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, metricLabel: { color: '#7D8981', fontSize: 8, marginTop: 3 }, funnel: { borderRadius: 15, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', overflow: 'hidden' }, funnelRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#29342D' }, funnelValue: { color: '#FFF8E8', width: 76, fontSize: 15, fontWeight: '900' }, funnelLabel: { color: '#9BA69F', fontSize: 10 }, funnelMeta: { color: '#718078', fontSize: 8.5, lineHeight: 13, marginTop: 7 }, empty: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 13 }, emptyTitle: { color: '#D9E1DC', fontSize: 11, fontWeight: '900' }, emptyBody: { color: '#7F8B83', fontSize: 9, lineHeight: 14, marginTop: 4 }, connection: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 }, connectionTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' }, connectionMeta: { color: '#7F8B83', fontSize: 8.5, marginTop: 3 }, connectionStatus: { color: '#84C992', fontSize: 8, fontWeight: '900' }, attention: { color: '#E7A05C' }, source: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12, marginTop: 7 }, sourceTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, sourceTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' }, sourceRevenue: { color: '#84C992', fontSize: 12, fontWeight: '900' }, sourceMeta: { color: '#7E8A82', fontSize: 8.5, lineHeight: 14, marginTop: 5 }, activityList: { borderRadius: 15, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', overflow: 'hidden' }, activityRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#29342D' }, activityDate: { width: 48, color: '#D7B45A', fontSize: 9, fontWeight: '900' }, activityMeta: { flex: 1, color: '#8D9991', fontSize: 8.5, lineHeight: 13 }, promotion: { minHeight: 61, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 }, tracked: { color: '#D7B45A', fontSize: 8, fontWeight: '900' }, note: { color: '#68766D', fontSize: 8.5, lineHeight: 13, marginTop: 20, textAlign: 'center' }, error: { color: '#FF9D92', fontSize: 10, marginTop: 10 } });
