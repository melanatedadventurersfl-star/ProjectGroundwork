import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCampaignMarketingItems, type CampaignMarketingItem } from '../../../src/hosting/campaignMarketing';
import { listHostCampaigns, type HostCampaign } from '../../../src/hosting/campaigns';
import { canonicalCampaigns } from '../../../src/hosting/workModel';

type MarketingCampaign = {
  campaign: HostCampaign;
  items: CampaignMarketingItem[];
};

export default function MarketingCampaignsScreen() {
  const [rows, setRows] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const campaigns = canonicalCampaigns(await listHostCampaigns());
      const next = await Promise.all(campaigns.map(async (campaign) => ({
        campaign,
        items: await listCampaignMarketingItems(campaign.id).catch(() => []),
      })));
      setRows(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load marketing campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const totals = useMemo(() => {
    const items = rows.flatMap((row) => row.items);
    return {
      planned: items.filter((item) => ['idea', 'draft', 'ready'].includes(item.status)).length,
      scheduled: items.filter((item) => item.status === 'scheduled').length,
      published: items.filter((item) => item.status === 'published').length,
    };
  }, [rows]);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
      <Text style={styles.eyebrow}>MARKETING</Text>
      <Text style={styles.title}>Campaigns</Text>
      <Text style={styles.subtitle}>Open the marketing calendar for an event. Event planning and event management now live in Events.</Text>

      <View style={styles.metrics}>
        <Metric value={totals.planned} label="Planned" />
        <Metric value={totals.scheduled} label="Scheduled" />
        <Metric value={totals.published} label="Published" />
      </View>

      {loading ? <View style={styles.state}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading marketing campaigns…</Text></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}

      {!loading && !error && rows.length === 0 ? <View style={styles.state}><Text style={styles.emptyTitle}>No event campaigns yet</Text><Text style={styles.muted}>Create an event first, then build its promotion plan here.</Text></View> : null}

      {!loading && !error ? rows.map(({ campaign, items }) => {
        const scheduled = items.filter((item) => item.status === 'scheduled').length;
        const published = items.filter((item) => item.status === 'published').length;
        const drafts = items.filter((item) => ['idea', 'draft', 'ready'].includes(item.status)).length;
        return <Pressable key={campaign.id} style={styles.card} onPress={() => router.push(`/host/campaigns/${campaign.slug}/marketing` as never)}>
          <View style={styles.cardTop}>
            <View style={[styles.dot, { backgroundColor: campaign.accent || '#D7B45A' }]} />
            <Text style={styles.cardDate}>{new Date(campaign.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
          </View>
          <Text style={styles.cardTitle}>{campaign.shortTitle}</Text>
          <Text style={styles.cardMeta}>{items.length} campaign item{items.length === 1 ? '' : 's'}</Text>
          <View style={styles.statRow}>
            <MiniStat value={drafts} label="Draft" />
            <MiniStat value={scheduled} label="Scheduled" />
            <MiniStat value={published} label="Published" />
          </View>
          <Text style={styles.open}>Open marketing calendar ›</Text>
        </Pressable>;
      }) : null}

      <Pressable style={styles.eventsLink} onPress={() => router.push('/host/events' as never)}><Text style={styles.eventsLinkText}>Manage events in Events ›</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return <View style={styles.miniStat}><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 72 },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#9AA59E', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 18 },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metric: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: '#2E3933', backgroundColor: '#141A16', padding: 12 },
  metricValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  metricLabel: { color: '#7F8A83', fontSize: 8, fontWeight: '800', marginTop: 2 },
  state: { minHeight: 130, borderRadius: 16, borderWidth: 1, borderColor: '#2E3933', backgroundColor: '#141A16', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 18 },
  muted: { color: '#839087', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  errorCard: { borderRadius: 16, borderWidth: 1, borderColor: '#6A413A', backgroundColor: '#211715', padding: 16 },
  error: { color: '#E9A59A', fontSize: 11, lineHeight: 17 },
  retry: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 10, backgroundColor: '#D7B45A', paddingHorizontal: 13, paddingVertical: 8 },
  retryText: { color: '#172017', fontSize: 10, fontWeight: '900' },
  card: { marginBottom: 10, borderRadius: 17, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 15 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardDate: { color: '#87928B', fontSize: 8.5, fontWeight: '800' },
  cardTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 8 },
  cardMeta: { color: '#87928B', fontSize: 9.5, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 7, marginTop: 13 },
  miniStat: { flex: 1, borderRadius: 10, backgroundColor: '#101512', padding: 9 },
  miniValue: { color: '#E8DDC0', fontSize: 14, fontWeight: '900' },
  miniLabel: { color: '#717C75', fontSize: 7.5, marginTop: 2 },
  open: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginTop: 13 },
  eventsLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  eventsLinkText: { color: '#C7D0CA', fontSize: 10.5, fontWeight: '900' },
});
