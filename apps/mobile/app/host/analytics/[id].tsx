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

  const remaining = summary.capacity > 0 ? Math.max(0, summary.capacity - summary.sold) : null;
  const clickToOrder = summary.clicks > 0 ? Math.round((summary.orders / summary.clicks) * 1000) / 10 : 0;

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading event analytics…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event</Text></Pressable>
    <Text style={styles.eyebrow}>EVENT ANALYTICS</Text><Text style={styles.title}>{campaign?.title || 'Event performance'}</Text><Text style={styles.subtitle}>Ticket sources, promotions and connected channel metrics roll into one event view. Metrics appear only when a connected provider or Go Melanated records them.</Text>

    {error ? <Text style={styles.error}>{error}</Text> : null}

    <Text style={styles.sectionTitle}>Sales</Text>
    <View style={styles.metrics}><Metric value={String(summary.sold)} label="Tickets sold" /><Metric value={remaining == null ? '—' : String(remaining)} label="Remaining" /><Metric value={`$${(summary.grossRevenueCents / 100).toLocaleString()}`} label="Gross revenue" /></View>
    <View style={styles.metrics}><Metric value={String(summary.orders)} label="Tracked orders" /><Metric value={String(summary.refunds)} label="Refund events" /><Metric value={String(summary.checkIns)} label="Checked in" /></View>

    <Text style={styles.sectionTitle}>Promotion funnel</Text>
    <View style={styles.funnel}><Funnel value={summary.impressions} label="Impressions" /><Funnel value={summary.clicks} label="Clicks" /><Funnel value={summary.pageViews} label="Event page views" /><Funnel value={summary.checkoutStarts} label="Checkout starts" /><Funnel value={summary.orders} label="Orders" /></View>
    <Text style={styles.funnelMeta}>{summary.clicks > 0 ? `${clickToOrder}% tracked click-to-order rate` : 'Conversion rate appears after tracked clicks and orders are recorded.'}</Text>

    <Text style={styles.sectionTitle}>Connected services</Text>
    {connections.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No external channels connected to this event yet.</Text><Text style={styles.emptyBody}>When Eventbrite, Facebook, Instagram, email or another supported source is linked, its event-level sync state will appear here.</Text></View> : connections.map((connection) => <View key={connection.id} style={styles.connection}><View style={{ flex: 1 }}><Text style={styles.connectionTitle}>{connection.displayName || connection.provider.replace(/_/g, ' ')}</Text><Text style={styles.connectionMeta}>{connection.provider.toUpperCase()} · {connection.lastSyncedAt ? `Synced ${new Date(connection.lastSyncedAt).toLocaleString()}` : 'Not synced yet'}</Text></View><Text style={[styles.connectionStatus, connection.status === 'attention' && styles.attention]}>{connection.status.toUpperCase()}</Text></View>)}

    <Text style={styles.sectionTitle}>Performance by source</Text>
    {summary.bySource.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No attributed activity yet.</Text><Text style={styles.emptyBody}>Tracked links and ticket-source syncs populate this section without forcing Facebook, Eventbrite and Go Melanated into separate event totals.</Text></View> : summary.bySource.map((source) => <View key={source.source} style={styles.source}><View style={styles.sourceTop}><Text style={styles.sourceTitle}>{source.source.replace(/_/g, ' ')}</Text><Text style={styles.sourceRevenue}>${(source.revenueCents / 100).toLocaleString()}</Text></View><Text style={styles.sourceMeta}>{source.impressions.toLocaleString()} impressions · {source.clicks.toLocaleString()} clicks · {source.orders} orders · {source.tickets} tickets</Text></View>)}

    <Text style={styles.sectionTitle}>Promotions</Text>
    {promotions.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No tracked promotions yet.</Text><Text style={styles.emptyBody}>Scheduled Facebook, Instagram, email and other promotion records can share one attribution model while still keeping their channel-specific metrics.</Text></View> : promotions.map((promotion) => <View key={promotion.id} style={styles.promotion}><View style={{ flex: 1 }}><Text style={styles.connectionTitle}>{promotion.title || promotion.contentType || 'Promotion'}</Text><Text style={styles.connectionMeta}>{promotion.channel.toUpperCase()} · {promotion.status}{promotion.scheduledFor ? ` · ${new Date(promotion.scheduledFor).toLocaleDateString()}` : ''}</Text></View>{promotion.trackingCode ? <Text style={styles.tracked}>TRACKED</Text> : null}</View>)}

    <Text style={styles.note}>Operational event analytics are separate from optional AI product-improvement analytics. AI personalization and product analytics remain controlled by your AI & Privacy settings.</Text>
  </ScrollView></SafeAreaView>;
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Funnel({ value, label }: { value: number; label: string }) { return <View style={styles.funnelRow}><Text style={styles.funnelValue}>{value.toLocaleString()}</Text><Text style={styles.funnelLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0A0F0C' }, center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', gap: 8 }, muted: { color: '#7F8B83', fontSize: 10 }, content: { padding: 18, paddingBottom: 76 }, back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 16 }, eyebrow: { color: '#84C992', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#8F9C93', fontSize: 10.5, lineHeight: 16, marginTop: 5 }, sectionTitle: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 }, metrics: { flexDirection: 'row', gap: 8, marginTop: 8 }, metric: { flex: 1, minHeight: 72, borderRadius: 13, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 10 }, metricValue: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, metricLabel: { color: '#7D8981', fontSize: 8, marginTop: 3 }, funnel: { borderRadius: 15, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', overflow: 'hidden' }, funnelRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#29342D' }, funnelValue: { color: '#FFF8E8', width: 76, fontSize: 15, fontWeight: '900' }, funnelLabel: { color: '#9BA69F', fontSize: 10 }, funnelMeta: { color: '#718078', fontSize: 8.5, marginTop: 7 }, empty: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 13 }, emptyTitle: { color: '#D9E1DC', fontSize: 11, fontWeight: '900' }, emptyBody: { color: '#7F8B83', fontSize: 9, lineHeight: 14, marginTop: 4 }, connection: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 }, connectionTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' }, connectionMeta: { color: '#7F8B83', fontSize: 8.5, marginTop: 3 }, connectionStatus: { color: '#84C992', fontSize: 8, fontWeight: '900' }, attention: { color: '#E7A05C' }, source: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12, marginTop: 7 }, sourceTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, sourceTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' }, sourceRevenue: { color: '#84C992', fontSize: 12, fontWeight: '900' }, sourceMeta: { color: '#7E8A82', fontSize: 8.5, marginTop: 5 }, promotion: { minHeight: 61, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 }, tracked: { color: '#D7B45A', fontSize: 8, fontWeight: '900' }, note: { color: '#68766D', fontSize: 8.5, lineHeight: 13, marginTop: 20, textAlign: 'center' }, error: { color: '#FF9D92', fontSize: 10, marginTop: 10 } });
