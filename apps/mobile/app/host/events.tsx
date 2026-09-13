import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { getUnifiedEventOperationsSummary } from '../../src/hosting/eventOperations';
import { canonicalCampaigns, duplicateCampaignCount } from '../../src/hosting/workModel';

type EventRow = {
  campaign: HostCampaign;
  operations: Awaited<ReturnType<typeof getUnifiedEventOperationsSummary>>;
  duplicateCount: number;
};

type EventFilter = 'all' | 'attention' | 'planning' | 'live';

const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'planning', label: 'Planning' },
  { key: 'live', label: 'Live' },
];

function isPastCampaign(campaign: HostCampaign, now = Date.now()) {
  const end = new Date(campaign.endsAt).getTime();
  return Number.isFinite(end) && end < now;
}

function needsAttention(row: EventRow, now = Date.now()) {
  return isPastCampaign(row.campaign, now)
    || row.operations.dateAssessment.state === 'review'
    || row.operations.overdueTaskCount > 0
    || row.duplicateCount > 0;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function timingLabel(campaign: HostCampaign, now = Date.now()) {
  const start = new Date(campaign.startsAt).getTime();
  const end = new Date(campaign.endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Date needs review';
  if (end < now) return 'Date passed';
  if (start <= now && end >= now) return 'Happening now';
  const days = Math.ceil((start - now) / 86_400_000);
  if (days === 1) return 'Tomorrow';
  if (days <= 14) return `In ${days} days`;
  return 'Upcoming';
}

function metricTone(value: number, urgent = false) {
  if (urgent && value > 0) return styles.metricValueAlert;
  return styles.metricValue;
}

export default function HostEventsScreen() {
  const [items, setItems] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<EventFilter>('all');
  const [clockNow, setClockNow] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rawCampaigns = (await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete');
      const campaigns = canonicalCampaigns(rawCampaigns);
      const rows = await Promise.all(campaigns.map(async (campaign) => ({
        campaign,
        operations: await getUnifiedEventOperationsSummary(campaign),
        duplicateCount: duplicateCampaignCount(campaign, rawCampaigns),
      })));
      setClockNow(Date.now());
      setItems(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const summary = useMemo(() => {
    const attention = items.filter((item) => needsAttention(item, clockNow)).length;
    const openTasks = items.reduce((sum, item) => sum + item.operations.openTaskCount, 0);
    const overdue = items.reduce((sum, item) => sum + item.operations.overdueTaskCount, 0);
    return { attention, openTasks, overdue };
  }, [clockNow, items]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filter === 'attention') return needsAttention(item, clockNow);
      if (filter === 'planning') return item.campaign.status === 'planning';
      if (filter === 'live') return item.campaign.status === 'live';
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aPast = isPastCampaign(a.campaign, clockNow);
      const bPast = isPastCampaign(b.campaign, clockNow);
      if (aPast !== bPast) return aPast ? 1 : -1;
      return new Date(a.campaign.startsAt).getTime() - new Date(b.campaign.startsAt).getTime();
    });
  }, [clockNow, filter, items]);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.replace('/host' as never)}>
        <Text style={styles.back}>‹ Host Center</Text>
      </Pressable>

      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>EVENTS</Text>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.subtitle}>See what needs attention, track progress, and open each event workspace.</Text>
        </View>
        {!loading ? <View style={styles.activeBadge}><Text style={styles.activeBadgeValue}>{items.length}</Text><Text style={styles.activeBadgeLabel}>ACTIVE</Text></View> : null}
      </View>

      <Pressable style={styles.primary} onPress={() => router.push('/host/create' as never)}>
        <Text style={styles.primaryText}>＋ Build an Event</Text>
      </Pressable>

      {!loading && items.length > 0 ? <>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Needs attention</Text>
            <Text style={[styles.summaryValue, summary.attention > 0 ? styles.summaryValueAlert : null]}>{summary.attention}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Open tasks</Text>
            <Text style={styles.summaryValue}>{summary.openTasks}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Overdue</Text>
            <Text style={[styles.summaryValue, summary.overdue > 0 ? styles.summaryValueAlert : null]}>{summary.overdue}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const active = item.key === filter;
            const count = item.key === 'all'
              ? items.length
              : item.key === 'attention'
                ? summary.attention
                : items.filter((row) => row.campaign.status === item.key).length;
            return <Pressable key={item.key} style={[styles.filterChip, active ? styles.filterChipActive : null]} onPress={() => setFilter(item.key)}>
              <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{item.label}</Text>
              <View style={[styles.filterCount, active ? styles.filterCountActive : null]}><Text style={[styles.filterCountText, active ? styles.filterCountTextActive : null]}>{count}</Text></View>
            </Pressable>;
          })}
        </View>
      </> : null}

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading events…</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No active events</Text><Text style={styles.emptyBody}>Create one manually, start from a template, import one, or plan it with AI.</Text></View> : null}
      {!loading && items.length > 0 && visibleItems.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing in this view</Text><Text style={styles.emptyBody}>Choose another filter to see your active events.</Text></View> : null}

      {visibleItems.map(({ campaign, operations, duplicateCount }) => {
        const past = isPastCampaign(campaign, clockNow);
        const attention = needsAttention({ campaign, operations, duplicateCount }, clockNow);
        const overdue = operations.overdueTaskCount;
        const scheduling = operations.needsSchedulingCount;
        const profit = operations.profitCents / 100;

        return <View key={campaign.id} style={[styles.card, attention ? styles.cardAttention : null]}>
          <View style={styles.cardTop}>
            <View style={styles.cardMain}>
              <View style={styles.kickerRow}>
                <View style={[styles.statusPill, campaign.status === 'live' ? styles.statusPillLive : null]}><Text style={[styles.cardKicker, campaign.status === 'live' ? styles.cardKickerLive : null]}>{campaign.status.toUpperCase()}</Text></View>
                {past ? <View style={styles.attentionPill}><Text style={styles.attentionPillText}>DATE PASSED</Text></View> : null}
                {!past && attention ? <View style={styles.attentionPill}><Text style={styles.attentionPillText}>NEEDS ATTENTION</Text></View> : null}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{campaign.shortTitle}</Text>
              <Text style={styles.cardMeta} numberOfLines={2}>{campaign.location}</Text>
              <Text style={styles.cardDate}>{dateLabel(campaign.startsAt)} · {timingLabel(campaign, clockNow)}</Text>
            </View>
            <View style={styles.progressBlock}>
              <Text style={styles.ready}>{operations.progress}%</Text>
              <Text style={styles.readyLabel}>TASKS DONE</Text>
            </View>
          </View>

          <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(operations.progress, 100))}%` }]} /></View>

          {past ? <View style={styles.dateWarning}>
            <Text style={styles.dateWarningTitle}>Event date has passed</Text>
            <Text style={styles.dateWarningText}>This event is still marked {campaign.status}. Review the dates or close the campaign so it does not stay in the active list.</Text>
          </View> : operations.dateAssessment.state === 'review' ? <View style={styles.dateWarning}>
            <Text style={styles.dateWarningTitle}>Review event dates</Text>
            <Text style={styles.dateWarningText}>{operations.dateAssessment.reason}</Text>
          </View> : null}

          {duplicateCount ? <View style={styles.duplicateWarning}><Text style={styles.duplicateWarningText}>Possible duplicate · {duplicateCount + 1} records found</Text></View> : null}

          <View style={styles.statGrid}>
            <View style={styles.statTile}><Text style={metricTone(overdue, true)}>{overdue}</Text><Text style={styles.statLabel}>Overdue</Text></View>
            <View style={styles.statTile}><Text style={styles.metricValue}>{operations.openTaskCount}</Text><Text style={styles.statLabel}>Open tasks</Text></View>
            <View style={styles.statTile}><Text style={metricTone(scheduling, true)}>{scheduling}</Text><Text style={styles.statLabel}>Need scheduling</Text></View>
            <View style={styles.statTile}><Text style={styles.metricValue}>${profit.toLocaleString()}</Text><Text style={styles.statLabel}>Profit</Text></View>
          </View>

          <Pressable style={styles.workspaceButton} onPress={() => router.push(`/host/event-work/${campaign.slug}` as never)}>
            <Text style={styles.workspaceButtonText}>Open Event Workspace</Text>
            <Text style={styles.workspaceArrow}>›</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable style={styles.analytics} onPress={() => router.push(`/host/analytics/${campaign.adventureId}` as never)}><Text style={styles.analyticsText}>Analytics</Text></Pressable>
            <Pressable style={styles.ai} onPress={() => router.push(`/host/assistant/${campaign.adventureId}` as never)}><Text style={styles.aiText}>✦ Assistant</Text></Pressable>
          </View>
        </View>;
      })}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  content: { padding: 18, paddingBottom: 88 },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 17 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 31, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#92A097', fontSize: 11, lineHeight: 17, marginTop: 5 },
  activeBadge: { minWidth: 58, borderRadius: 14, borderWidth: 1, borderColor: '#354139', backgroundColor: '#111813', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  activeBadgeValue: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  activeBadgeLabel: { color: '#77847B', fontSize: 7, fontWeight: '900', marginTop: 1, letterSpacing: .8 },
  primary: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  summaryCard: { flex: 1, minHeight: 70, borderRadius: 13, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#111813', padding: 10, justifyContent: 'space-between' },
  summaryLabel: { color: '#7F8C83', fontSize: 8, lineHeight: 11, fontWeight: '800' },
  summaryValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  summaryValueAlert: { color: '#E8A05C' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12, marginBottom: 2 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, borderRadius: 18, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111813', paddingLeft: 11, paddingRight: 7 },
  filterChipActive: { borderColor: '#8B7135', backgroundColor: '#241F12' },
  filterText: { color: '#849087', fontSize: 9, fontWeight: '800' },
  filterTextActive: { color: '#E7C464' },
  filterCount: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#202923', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterCountActive: { backgroundColor: '#D7B45A' },
  filterCountText: { color: '#A4AFA8', fontSize: 8, fontWeight: '900' },
  filterCountTextActive: { color: '#172017' },
  loading: { paddingVertical: 35, alignItems: 'center', gap: 8 },
  muted: { color: '#7F8B83', fontSize: 10 },
  error: { color: '#FF9D92', fontSize: 10, marginTop: 12 },
  empty: { borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 18, marginTop: 14 },
  emptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  emptyBody: { color: '#849087', fontSize: 10, lineHeight: 15, marginTop: 4 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 14, marginTop: 12 },
  cardAttention: { borderColor: '#5A4930' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardMain: { flex: 1 },
  kickerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  statusPill: { borderRadius: 8, backgroundColor: '#282315', paddingHorizontal: 7, paddingVertical: 4 },
  statusPillLive: { backgroundColor: '#142319' },
  cardKicker: { color: '#D7B45A', fontSize: 7, fontWeight: '900', letterSpacing: .7 },
  cardKickerLive: { color: '#9ED1A9' },
  attentionPill: { borderRadius: 8, backgroundColor: '#2A1D13', paddingHorizontal: 7, paddingVertical: 4 },
  attentionPillText: { color: '#E8A05C', fontSize: 7, fontWeight: '900', letterSpacing: .4 },
  cardTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 7 },
  cardMeta: { color: '#A4AFA8', fontSize: 9, lineHeight: 13, marginTop: 4 },
  cardDate: { color: '#718077', fontSize: 8, marginTop: 3 },
  progressBlock: { minWidth: 58, alignItems: 'flex-end' },
  ready: { color: '#E7C464', fontSize: 20, fontWeight: '900' },
  readyLabel: { color: '#77847B', fontSize: 6, fontWeight: '800', marginTop: 1, letterSpacing: .5 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#29332D', overflow: 'hidden', marginTop: 12 },
  fill: { height: 5, backgroundColor: '#D7B45A' },
  dateWarning: { borderRadius: 11, borderWidth: 1, borderColor: '#6A5030', backgroundColor: '#251D12', padding: 10, marginTop: 10 },
  dateWarningTitle: { color: '#E7B86A', fontSize: 9, fontWeight: '900' },
  dateWarningText: { color: '#B8A27C', fontSize: 8, lineHeight: 12, marginTop: 2 },
  duplicateWarning: { borderRadius: 9, backgroundColor: '#211A12', paddingHorizontal: 9, paddingVertical: 7, marginTop: 8 },
  duplicateWarningText: { color: '#D29B63', fontSize: 8, fontWeight: '800' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  statTile: { width: '48%', minHeight: 52, borderRadius: 10, backgroundColor: '#101611', borderWidth: 1, borderColor: '#252F29', paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },
  metricValue: { color: '#E5ECE7', fontSize: 14, fontWeight: '900' },
  metricValueAlert: { color: '#E8A05C', fontSize: 14, fontWeight: '900' },
  statLabel: { color: '#6F7C73', fontSize: 7, fontWeight: '800', marginTop: 2 },
  workspaceButton: { minHeight: 44, borderRadius: 11, backgroundColor: '#1D291F', borderWidth: 1, borderColor: '#45584A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, marginTop: 12 },
  workspaceButtonText: { color: '#E0E8E2', fontSize: 9, fontWeight: '900' },
  workspaceArrow: { color: '#D7B45A', fontSize: 22, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 7 },
  analytics: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#42634D', backgroundColor: '#152018', alignItems: 'center', justifyContent: 'center' },
  analyticsText: { color: '#9ED1A9', fontSize: 9, fontWeight: '900' },
  ai: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#5C4B80', backgroundColor: '#1B1724', alignItems: 'center', justifyContent: 'center' },
  aiText: { color: '#C6B0F4', fontSize: 9, fontWeight: '900' },
});
