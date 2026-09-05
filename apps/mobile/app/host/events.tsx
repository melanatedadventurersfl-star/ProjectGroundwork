import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { getUnifiedEventOperationsSummary } from '../../src/hosting/eventOperations';
import { canonicalCampaigns, duplicateCampaignCount } from '../../src/hosting/workModel';

type EventRow = { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getUnifiedEventOperationsSummary>>; duplicateCount: number };

export default function HostEventsScreen() {
  const [items, setItems] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rawCampaigns = (await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete');
      const campaigns = canonicalCampaigns(rawCampaigns);
      const rows = await Promise.all(campaigns.map(async (campaign) => ({
        campaign,
        operations: await getUnifiedEventOperationsSummary(campaign),
        duplicateCount: duplicateCampaignCount(campaign, rawCampaigns),
      })));
      setItems(rows);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load events.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
    <Text style={styles.eyebrow}>EVENTS</Text><Text style={styles.title}>Events</Text><Text style={styles.subtitle}>Build, run and adjust every event. Work counts use the same integrity rules as My Work.</Text>
    <Pressable style={styles.primary} onPress={() => router.push('/host/create' as never)}><Text style={styles.primaryText}>＋ Build an Event</Text></Pressable>

    {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading events…</Text></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}

    {!loading && items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No active events</Text><Text style={styles.emptyBody}>Create one manually, start from a template, import one, or plan it with AI.</Text></View> : null}

    {items.map(({ campaign, operations, duplicateCount }) => <View key={campaign.id} style={styles.card}>
      <View style={styles.cardTop}><View style={{ flex: 1 }}><View style={styles.kickerRow}><Text style={styles.cardKicker}>{campaign.status.toUpperCase()}</Text>{duplicateCount ? <Text style={styles.duplicate}>POSSIBLE DUPLICATE · {duplicateCount + 1} RECORDS</Text> : null}</View><Text style={styles.cardTitle}>{campaign.shortTitle}</Text><Text style={styles.cardMeta}>{campaign.location} · {new Date(campaign.startsAt).toLocaleDateString()}</Text></View><Text style={styles.ready}>{operations.progress}%</Text></View>
      <Text style={styles.readyLabel}>Task completion</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(operations.progress, 100))}%` }]} /></View>
      {operations.dateAssessment.state === 'review' ? <View style={styles.dateWarning}><Text style={styles.dateWarningTitle}>Review event dates</Text><Text style={styles.dateWarningText}>{operations.dateAssessment.reason}</Text></View> : null}
      <View style={styles.stats}><Text style={styles.stat}>{operations.overdueTaskCount} overdue</Text><Text style={styles.stat}>{operations.openTaskCount} open tasks</Text><Text style={styles.stat}>{operations.needsSchedulingCount} need scheduling</Text><Text style={styles.stat}>${(operations.profitCents / 100).toLocaleString()} profit</Text></View>
      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}><Text style={styles.secondaryText}>Open Event</Text></Pressable>
        <Pressable style={styles.analytics} onPress={() => router.push(`/host/analytics/${campaign.adventureId}` as never)}><Text style={styles.analyticsText}>Analytics</Text></Pressable>
        <Pressable style={styles.ai} onPress={() => router.push(`/host/assistant/${campaign.adventureId}` as never)}><Text style={styles.aiText}>✦ Assistant</Text></Pressable>
      </View>
    </View>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 72 }, back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 17 }, eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 31, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#92A097', fontSize: 11, lineHeight: 17, marginTop: 5 }, primary: { minHeight: 46, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' }, loading: { paddingVertical: 35, alignItems: 'center', gap: 8 }, muted: { color: '#7F8B83', fontSize: 10 }, error: { color: '#FF9D92', fontSize: 10, marginTop: 12 }, empty: { borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 18, marginTop: 14 }, emptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, emptyBody: { color: '#849087', fontSize: 10, lineHeight: 15, marginTop: 4 }, card: { borderRadius: 17, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 14, marginTop: 11 }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, kickerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, cardKicker: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: .8 }, duplicate: { color: '#E7A05C', fontSize: 7, fontWeight: '900' }, cardTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 2 }, cardMeta: { color: '#859188', fontSize: 9, marginTop: 4 }, ready: { color: '#E7C464', fontSize: 20, fontWeight: '900' }, readyLabel: { color: '#77847B', fontSize: 7, textAlign: 'right', marginTop: 1 }, track: { height: 4, borderRadius: 3, backgroundColor: '#29332D', overflow: 'hidden', marginTop: 9 }, fill: { height: 4, backgroundColor: '#D7B45A' }, dateWarning: { borderRadius: 11, borderWidth: 1, borderColor: '#6A5030', backgroundColor: '#251D12', padding: 10, marginTop: 10 }, dateWarningTitle: { color: '#E7B86A', fontSize: 9, fontWeight: '900' }, dateWarningText: { color: '#B8A27C', fontSize: 8, lineHeight: 12, marginTop: 2 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 9 }, stat: { color: '#77847B', fontSize: 8 }, actions: { flexDirection: 'row', gap: 7, marginTop: 12 }, secondary: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#3B473F', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#D4DDD7', fontSize: 9, fontWeight: '900' }, analytics: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#42634D', backgroundColor: '#152018', alignItems: 'center', justifyContent: 'center' }, analyticsText: { color: '#9ED1A9', fontSize: 9, fontWeight: '900' }, ai: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#5C4B80', backgroundColor: '#1B1724', alignItems: 'center', justifyContent: 'center' }, aiText: { color: '#C6B0F4', fontSize: 9, fontWeight: '900' } });
