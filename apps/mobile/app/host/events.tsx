import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { getUnifiedEventOperationsSummary } from '../../src/hosting/eventOperations';
import {
  listEventDraftPreviews,
  loadEventPortfolioSignals,
  type EventDraftPreview,
  type EventGate,
  type EventHealth,
  type EventLifecycle,
  type EventPortfolioSignals,
} from '../../src/hosting/eventPortfolio';
import { canonicalCampaigns, duplicateCampaignCount } from '../../src/hosting/workModel';

type EventRow = {
  campaign: HostCampaign;
  operations: Awaited<ReturnType<typeof getUnifiedEventOperationsSummary>>;
  duplicateCount: number;
  portfolio: EventPortfolioSignals;
};

type PageView = 'active' | 'drafts' | 'wrapup' | 'history';
type ActiveFilter = 'all' | 'attention' | 'planning' | 'selling' | 'ready' | 'live';

const ACTIVE_FILTERS: { key: ActiveFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'planning', label: 'Planning' },
  { key: 'selling', label: 'Selling' },
  { key: 'ready', label: 'Ready' },
  { key: 'live', label: 'Live' },
];

const QUICK_CREATE = [
  { label: 'AI Planner', icon: '✦', route: '/host/plan-ai' },
  { label: 'Scan Flyer', icon: '▧', route: '/host/scan-flyer' },
  { label: 'Manual', icon: '+', route: '/host/create-scratch' },
  { label: 'Template', icon: '▦', route: '/host/create-template' },
  { label: 'Import', icon: '⇧', route: '/host/import-event?mode=files' },
] as const;

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function timingLabel(campaign: HostCampaign, now: number) {
  const start = new Date(campaign.startsAt).getTime();
  const end = new Date(campaign.endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Date needs review';
  if (start <= now && end >= now) return 'Happening now';
  if (end < now) return 'Date passed';
  const days = Math.ceil((start - now) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 14) return `In ${days} days`;
  return 'Upcoming';
}

function money(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function lifecycleKey(lifecycle: EventLifecycle) {
  return lifecycle.toLowerCase().replace(/[^a-z]/g, '');
}

function healthLabel(health: EventHealth) {
  if (health === 'at_risk') return 'AT RISK';
  if (health === 'attention') return 'NEEDS ATTENTION';
  return 'ON TRACK';
}

function gateSymbol(gate: EventGate) {
  if (gate.state === 'ready') return '✓';
  if (gate.state === 'in_progress') return '◐';
  if (gate.state === 'attention') return '!';
  if (gate.state === 'not_required') return '–';
  return '○';
}

function gateText(gate: EventGate) {
  if (gate.state === 'ready') return 'Ready';
  if (gate.state === 'in_progress') return 'In progress';
  if (gate.state === 'attention') return 'Review';
  if (gate.state === 'not_required') return 'Not required';
  return 'Not set up';
}

function isActiveLifecycle(lifecycle: EventLifecycle) {
  return ['Planning', 'Selling', 'Ready', 'Live'].includes(lifecycle);
}

export default function HostEventsScreen() {
  const [items, setItems] = useState<EventRow[]>([]);
  const [drafts, setDrafts] = useState<EventDraftPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<PageView>('active');
  const [filter, setFilter] = useState<ActiveFilter>('all');
  const [clockNow, setClockNow] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rawCampaigns, savedDrafts] = await Promise.all([
        listHostCampaigns(),
        listEventDraftPreviews().catch(() => []),
      ]);
      const campaigns = canonicalCampaigns(rawCampaigns);
      const rows = await Promise.all(campaigns.map(async (campaign) => {
        const operations = await getUnifiedEventOperationsSummary(campaign);
        const duplicateCount = duplicateCampaignCount(campaign, rawCampaigns);
        const portfolio = await loadEventPortfolioSignals(campaign, operations, duplicateCount);
        return { campaign, operations, duplicateCount, portfolio };
      }));
      setClockNow(Date.now());
      setItems(rows);
      setDrafts(savedDrafts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeItems = useMemo(() => items.filter((item) => isActiveLifecycle(item.portfolio.lifecycle)), [items]);
  const campaignDrafts = useMemo(() => items.filter((item) => item.portfolio.lifecycle === 'Draft'), [items]);
  const wrapupItems = useMemo(() => items.filter((item) => item.portfolio.lifecycle === 'Wrap-up'), [items]);
  const historyItems = useMemo(() => items.filter((item) => ['Completed', 'Cancelled'].includes(item.portfolio.lifecycle)), [items]);

  const summary = useMemo(() => {
    const attention = [...activeItems, ...wrapupItems].filter((item) => item.portfolio.health !== 'on_track').length;
    const registrations = activeItems.reduce((sum, item) => sum + item.portfolio.attendees, 0);
    const revenue = activeItems.reduce((sum, item) => sum + item.portfolio.trackedRevenueCents, 0);
    return { attention, registrations, revenue };
  }, [activeItems, wrapupItems]);

  const nextEvent = useMemo(() => {
    const live = activeItems.find((item) => item.portfolio.lifecycle === 'Live');
    if (live) return live;
    return [...activeItems]
      .filter((item) => new Date(item.campaign.startsAt).getTime() >= clockNow)
      .sort((a, b) => new Date(a.campaign.startsAt).getTime() - new Date(b.campaign.startsAt).getTime())[0] ?? null;
  }, [activeItems, clockNow]);

  const attentionQueue = useMemo(() => [...activeItems, ...wrapupItems]
    .filter((item) => item.portfolio.health !== 'on_track')
    .sort((a, b) => {
      const risk = Number(b.portfolio.health === 'at_risk') - Number(a.portfolio.health === 'at_risk');
      if (risk) return risk;
      return new Date(a.campaign.startsAt).getTime() - new Date(b.campaign.startsAt).getTime();
    })
    .slice(0, 4), [activeItems, wrapupItems]);

  const visibleActive = useMemo(() => {
    const filtered = activeItems.filter((item) => {
      if (filter === 'attention') return item.portfolio.health !== 'on_track';
      if (filter === 'planning') return item.portfolio.lifecycle === 'Planning';
      if (filter === 'selling') return item.portfolio.lifecycle === 'Selling';
      if (filter === 'ready') return item.portfolio.lifecycle === 'Ready';
      if (filter === 'live') return item.portfolio.lifecycle === 'Live';
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (a.portfolio.lifecycle === 'Live' && b.portfolio.lifecycle !== 'Live') return -1;
      if (b.portfolio.lifecycle === 'Live' && a.portfolio.lifecycle !== 'Live') return 1;
      return new Date(a.campaign.startsAt).getTime() - new Date(b.campaign.startsAt).getTime();
    });
  }, [activeItems, filter]);

  const viewCounts: Record<PageView, number> = {
    active: activeItems.length,
    drafts: drafts.length + campaignDrafts.length,
    wrapup: wrapupItems.length,
    history: historyItems.length,
  };

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
        <Pressable onPress={() => router.push('/host/calendar' as never)}><Text style={styles.calendarLink}>Calendar ›</Text></Pressable>
      </View>

      <Text style={styles.eyebrow}>EVENT COMMAND CENTER</Text>
      <Text style={styles.title}>Events</Text>
      <Text style={styles.subtitle}>See how every event is doing, what needs intervention, and where to go next.</Text>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading event portfolio…</Text></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

      {!loading ? <>
        <View style={styles.portfolioGrid}>
          <MetricCard value={String(activeItems.length)} label="Active events" />
          <MetricCard value={String(summary.attention)} label="Need attention" alert={summary.attention > 0} />
          <MetricCard value={String(summary.registrations)} label="Registrations" />
          <MetricCard value={money(summary.revenue)} label="Tracked ticket revenue" />
        </View>

        {nextEvent ? <View style={styles.nextCard}>
          {nextEvent.campaign.heroImageUrl ? <Image source={{ uri: nextEvent.campaign.heroImageUrl }} style={styles.nextImage} /> : null}
          <View style={styles.nextBody}>
            <View style={styles.sectionHeadingRow}><Text style={styles.sectionEyebrow}>NEXT EVENT</Text><Text style={styles.timing}>{timingLabel(nextEvent.campaign, clockNow)}</Text></View>
            <Text style={styles.nextTitle}>{nextEvent.campaign.shortTitle}</Text>
            <Text style={styles.nextMeta}>{dateLabel(nextEvent.campaign.startsAt)} · {nextEvent.campaign.location}</Text>
            <View style={styles.nextStats}>
              <SmallStat value={nextEvent.portfolio.capacity == null ? String(nextEvent.portfolio.attendees) : `${nextEvent.portfolio.attendees}/${nextEvent.portfolio.capacity}`} label="Registered" />
              <SmallStat value={`${nextEvent.portfolio.readiness}%`} label="Readiness" />
              <SmallStat value={healthLabel(nextEvent.portfolio.health).replace('NEEDS ', '')} label="Health" alert={nextEvent.portfolio.health !== 'on_track'} />
            </View>
            <Pressable style={styles.nextButton} onPress={() => router.push(`/host/manage/${nextEvent.campaign.adventureId}` as never)}><Text style={styles.nextButtonText}>Open Event Workspace</Text><Text style={styles.nextButtonArrow}>›</Text></Pressable>
          </View>
        </View> : null}

        {attentionQueue.length ? <View style={styles.sectionBlock}>
          <SectionHeader eyebrow="NEEDS YOUR ATTENTION" title="Resolve the event, not the whole task list." />
          <View style={styles.attentionList}>{attentionQueue.map((item) => <Pressable key={item.campaign.id} style={[styles.attentionRow, item.portfolio.health === 'at_risk' ? styles.attentionRowRisk : null]} onPress={() => router.push(item.portfolio.attentionRoute as never)}>
            <View style={styles.attentionCopy}><Text style={styles.attentionEvent}>{item.campaign.shortTitle}</Text><Text style={styles.attentionReason}>{item.portfolio.healthReason}</Text></View>
            <View style={styles.attentionAction}><Text style={styles.attentionActionText}>Review</Text><Text style={styles.attentionChevron}>›</Text></View>
          </Pressable>)}</View>
        </View> : null}

        <View style={styles.sectionBlock}>
          <SectionHeader eyebrow="QUICK CREATE" title="Start the way the event already exists in your head." />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {QUICK_CREATE.map((item) => <Pressable key={item.label} style={styles.quickCard} onPress={() => router.push(item.route as never)}>
              <Text style={styles.quickIcon}>{item.icon}</Text><Text style={styles.quickLabel}>{item.label}</Text>
            </Pressable>)}
          </ScrollView>
        </View>

        <View style={styles.viewTabs}>
          <ViewTab label="Active" count={viewCounts.active} active={view === 'active'} onPress={() => setView('active')} />
          <ViewTab label="Drafts" count={viewCounts.drafts} active={view === 'drafts'} onPress={() => setView('drafts')} />
          <ViewTab label="Wrap-up" count={viewCounts.wrapup} active={view === 'wrapup'} onPress={() => setView('wrapup')} />
          <ViewTab label="History" count={viewCounts.history} active={view === 'history'} onPress={() => setView('history')} />
        </View>

        {view === 'active' ? <>
          <View style={styles.filters}>{ACTIVE_FILTERS.map((item) => {
            const count = item.key === 'all' ? activeItems.length
              : item.key === 'attention' ? activeItems.filter((row) => row.portfolio.health !== 'on_track').length
                : activeItems.filter((row) => lifecycleKey(row.portfolio.lifecycle) === item.key).length;
            return <FilterChip key={item.key} label={item.label} count={count} active={filter === item.key} onPress={() => setFilter(item.key)} />;
          })}</View>
          {!visibleActive.length ? <Empty title="No events in this view" body="Choose another filter or create a new event." /> : visibleActive.map((item) => <EventCard key={item.campaign.id} item={item} now={clockNow} />)}
        </> : null}

        {view === 'drafts' ? <>
          {drafts.length ? <View style={styles.draftGroup}>
            <Text style={styles.groupLabel}>SAVED IMPORTS & FLYER DRAFTS</Text>
            {drafts.map((draft) => <DraftCard key={draft.id} draft={draft} />)}
          </View> : null}
          {campaignDrafts.length ? <View style={styles.draftGroup}>
            <Text style={styles.groupLabel}>CREATED EVENT DRAFTS</Text>
            {campaignDrafts.map((item) => <EventCard key={item.campaign.id} item={item} now={clockNow} />)}
          </View> : null}
          {!drafts.length && !campaignDrafts.length ? <Empty title="No saved drafts" body="Flyer scans, file imports, and unfinished event drafts will appear here." /> : null}
        </> : null}

        {view === 'wrapup' ? <>
          {!wrapupItems.length ? <Empty title="Nothing waiting for closeout" body="Events move here after their date until closeout is complete." /> : wrapupItems.map((item) => <EventCard key={item.campaign.id} item={item} now={clockNow} />)}
        </> : null}

        {view === 'history' ? <>
          {!historyItems.length ? <Empty title="No event history yet" body="Completed and cancelled events will remain available here for reference and reuse." /> : historyItems.map((item) => <HistoryCard key={item.campaign.id} item={item} />)}
        </> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function EventCard({ item, now }: { item: EventRow; now: number }) {
  const { campaign, operations, portfolio } = item;
  const profitText = portfolio.financeConfigured ? money(operations.profitCents) : 'Not set up';
  const marketingText = portfolio.marketingPublished + portfolio.marketingScheduled > 0
    ? `${portfolio.marketingPublished} live · ${portfolio.marketingScheduled} scheduled`
    : portfolio.marketingDrafts > 0 ? `${portfolio.marketingDrafts} draft${portfolio.marketingDrafts === 1 ? '' : 's'}` : 'Not started';
  const teamText = portfolio.teamCount > 0 ? `${portfolio.teamCount} assigned` : 'Not set up';

  return <View style={[styles.eventCard, portfolio.health === 'at_risk' ? styles.eventCardRisk : portfolio.health === 'attention' ? styles.eventCardAttention : null]}>
    {campaign.heroImageUrl ? <Image source={{ uri: campaign.heroImageUrl }} style={styles.eventImage} /> : null}
    <View style={styles.eventBody}>
      <View style={styles.pillRow}>
        <View style={styles.lifecyclePill}><Text style={styles.lifecycleText}>{portfolio.lifecycle.toUpperCase()}</Text></View>
        <View style={[styles.healthPill, portfolio.health === 'at_risk' ? styles.healthRisk : portfolio.health === 'attention' ? styles.healthAttention : styles.healthTrack]}><Text style={[styles.healthText, portfolio.health === 'at_risk' ? styles.healthTextRisk : portfolio.health === 'attention' ? styles.healthTextAttention : styles.healthTextTrack]}>{healthLabel(portfolio.health)}</Text></View>
        {portfolio.visibility ? <Text style={styles.visibility}>{portfolio.visibility.toUpperCase()}</Text> : null}
      </View>

      <Text style={styles.eventTitle}>{campaign.shortTitle}</Text>
      <Text style={styles.eventMeta}>{dateLabel(campaign.startsAt)} · {timingLabel(campaign, now)}</Text>
      <Text style={styles.eventLocation}>{campaign.location}</Text>

      <View style={styles.registrationRow}>
        <View><Text style={styles.registrationValue}>{portfolio.capacity == null ? portfolio.attendees : `${portfolio.attendees} / ${portfolio.capacity}`}</Text><Text style={styles.registrationLabel}>REGISTERED</Text></View>
        <View style={styles.readinessBlock}><View style={styles.readinessCopy}><Text style={styles.readinessLabel}>READINESS</Text><Text style={styles.readinessValue}>{portfolio.readiness}%</Text></View><View style={styles.readinessTrack}><View style={[styles.readinessFill, { width: `${Math.max(0, Math.min(100, portfolio.readiness))}%` }]} /></View></View>
      </View>

      <View style={styles.gates}>{portfolio.gates.map((item) => <View key={item.key} style={styles.gate}>
        <View style={[styles.gateIcon, item.state === 'ready' ? styles.gateReady : item.state === 'attention' ? styles.gateAttention : item.state === 'in_progress' ? styles.gateProgress : styles.gateNeutral]}><Text style={styles.gateIconText}>{gateSymbol(item)}</Text></View>
        <View style={styles.gateCopy}><Text style={styles.gateLabel}>{item.label}</Text><Text style={styles.gateState}>{gateText(item)}</Text></View>
      </View>)}</View>

      <View style={styles.pulseRow}>
        <Pulse label="Marketing" value={marketingText} />
        <Pulse label="Team" value={teamText} />
        <Pulse label="Finance" value={profitText} />
      </View>

      {portfolio.healthReason ? <Pressable style={[styles.healthCallout, portfolio.health === 'at_risk' ? styles.healthCalloutRisk : null]} onPress={() => router.push(portfolio.attentionRoute as never)}>
        <View style={styles.healthCalloutCopy}><Text style={styles.healthCalloutLabel}>{portfolio.health === 'at_risk' ? 'AT RISK' : 'NEEDS ATTENTION'}</Text><Text style={styles.healthCalloutText}>{portfolio.healthReason}</Text></View><Text style={styles.healthCalloutArrow}>›</Text>
      </Pressable> : null}

      <Pressable style={styles.workspaceButton} onPress={() => router.push(`/host/manage/${campaign.adventureId}` as never)}><Text style={styles.workspaceButtonText}>Open Event Workspace</Text><Text style={styles.workspaceArrow}>›</Text></Pressable>
      <View style={styles.secondaryActions}>
        <Pressable style={styles.secondaryAction} onPress={() => router.push(`/host/event-work/${campaign.slug}` as never)}><Text style={styles.secondaryActionText}>Work</Text></Pressable>
        <Pressable style={styles.secondaryAction} onPress={() => router.push(`/host/analytics/${campaign.adventureId}` as never)}><Text style={styles.secondaryActionText}>Analytics</Text></Pressable>
        <Pressable style={styles.secondaryAction} onPress={() => router.push(`/host/assistant/${campaign.adventureId}` as never)}><Text style={styles.secondaryActionText}>✦ Assistant</Text></Pressable>
      </View>
    </View>
  </View>;
}

function DraftCard({ draft }: { draft: EventDraftPreview }) {
  return <View style={styles.draftCard}>
    <View style={styles.draftTop}><View style={styles.draftSource}><Text style={styles.draftSourceText}>{draft.sourceKind}</Text></View><Text style={styles.draftUpdated}>{dateLabel(draft.updatedAt)}</Text></View>
    <Text style={styles.draftTitle}>{draft.title}</Text>
    <Text style={styles.draftMeta}>{draft.completeness}% core details found</Text>
    <View style={styles.draftTrack}><View style={[styles.draftFill, { width: `${draft.completeness}%` }]} /></View>
    <Text style={styles.draftMissing}>{draft.missing.length ? `Still needed: ${draft.missing.slice(0, 3).join(', ')}` : 'Core event details are ready for review.'}</Text>
    <Pressable style={styles.draftButton} onPress={() => router.push(`/host/drafts/${draft.id}` as never)}><Text style={styles.draftButtonText}>Continue Draft</Text><Text style={styles.draftButtonArrow}>›</Text></Pressable>
  </View>;
}

function HistoryCard({ item }: { item: EventRow }) {
  return <View style={styles.historyCard}>
    <View style={styles.historyTop}><View><Text style={styles.historyLifecycle}>{item.portfolio.lifecycle.toUpperCase()}</Text><Text style={styles.historyTitle}>{item.campaign.shortTitle}</Text><Text style={styles.historyMeta}>{dateLabel(item.campaign.startsAt)} · {item.campaign.location}</Text></View><Text style={styles.historyRegistration}>{item.portfolio.attendees}<Text style={styles.historyRegistrationLabel}> guests</Text></Text></View>
    <View style={styles.historyStats}><Pulse label="Tracked revenue" value={money(item.portfolio.trackedRevenueCents)} /><Pulse label="Final task progress" value={`${item.operations.progress}%`} /></View>
    <Pressable style={styles.historyButton} onPress={() => router.push(`/host/campaigns/${item.campaign.slug}/edit` as never)}><Text style={styles.historyButtonText}>Open History / Run Again</Text><Text style={styles.historyButtonArrow}>›</Text></Pressable>
  </View>;
}

function MetricCard({ value, label, alert = false }: { value: string; label: string; alert?: boolean }) {
  return <View style={styles.metricCard}><Text style={[styles.metricValue, alert ? styles.metricAlert : null]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function SmallStat({ value, label, alert = false }: { value: string; label: string; alert?: boolean }) {
  return <View style={styles.smallStat}><Text style={[styles.smallStatValue, alert ? styles.smallStatAlert : null]}>{value}</Text><Text style={styles.smallStatLabel}>{label}</Text></View>;
}

function Pulse({ label, value }: { label: string; value: string }) {
  return <View style={styles.pulse}><Text style={styles.pulseLabel}>{label}</Text><Text style={styles.pulseValue} numberOfLines={2}>{value}</Text></View>;
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text></View>;
}

function ViewTab({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.viewTab, active ? styles.viewTabActive : null]} onPress={onPress}><Text style={[styles.viewTabText, active ? styles.viewTabTextActive : null]}>{label}</Text><View style={[styles.viewCount, active ? styles.viewCountActive : null]}><Text style={[styles.viewCountText, active ? styles.viewCountTextActive : null]}>{count}</Text></View></Pressable>;
}

function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.filterChip, active ? styles.filterChipActive : null]} onPress={onPress}><Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{label}</Text><Text style={[styles.filterNumber, active ? styles.filterNumberActive : null]}>{count}</Text></Pressable>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09100C' },
  content: { padding: 18, paddingBottom: 96 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  calendarLink: { color: '#9BB9D4', fontSize: 10, fontWeight: '900' },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 32, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#98A49C', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 520 },
  loading: { paddingVertical: 42, alignItems: 'center', gap: 8 },
  muted: { color: '#7F8B83', fontSize: 10 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#6C3732', backgroundColor: '#251413', padding: 12, marginTop: 14 },
  error: { color: '#FF9D92', fontSize: 10, lineHeight: 15 },

  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  metricCard: { width: '48.5%', minHeight: 78, borderRadius: 15, borderWidth: 1, borderColor: '#2A382F', backgroundColor: '#111914', padding: 12, justifyContent: 'space-between' },
  metricValue: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  metricAlert: { color: '#E9A15C' },
  metricLabel: { color: '#7F8C83', fontSize: 8, lineHeight: 11, fontWeight: '800' },

  nextCard: { borderRadius: 18, borderWidth: 1, borderColor: '#66572F', backgroundColor: '#171811', overflow: 'hidden', marginTop: 12 },
  nextImage: { width: '100%', height: 142, backgroundColor: '#18221B' },
  nextBody: { padding: 15 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionEyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  timing: { color: '#9CB1A2', fontSize: 9, fontWeight: '800' },
  nextTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 4 },
  nextMeta: { color: '#94A097', fontSize: 9, lineHeight: 14, marginTop: 4 },
  nextStats: { flexDirection: 'row', gap: 8, marginTop: 13 },
  smallStat: { flex: 1, borderRadius: 11, backgroundColor: '#101711', borderWidth: 1, borderColor: '#2B372F', padding: 9 },
  smallStatValue: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  smallStatAlert: { color: '#E7A05C' },
  smallStatLabel: { color: '#758279', fontSize: 7, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  nextButton: { minHeight: 45, borderRadius: 12, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 12 },
  nextButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' },
  nextButtonArrow: { color: '#172017', fontSize: 22, fontWeight: '900' },

  sectionBlock: { marginTop: 22 },
  sectionHeader: { marginBottom: 9 },
  sectionTitle: { color: '#FFF8E8', fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 2 },
  attentionList: { gap: 7 },
  attentionRow: { borderRadius: 13, borderWidth: 1, borderColor: '#66502F', backgroundColor: '#201A11', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  attentionRowRisk: { borderColor: '#753E36', backgroundColor: '#231413' },
  attentionCopy: { flex: 1 },
  attentionEvent: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' },
  attentionReason: { color: '#B4A17D', fontSize: 9, lineHeight: 14, marginTop: 3 },
  attentionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attentionActionText: { color: '#E7B466', fontSize: 9, fontWeight: '900' },
  attentionChevron: { color: '#E7B466', fontSize: 20, fontWeight: '900' },

  quickRow: { gap: 8, paddingRight: 12 },
  quickCard: { width: 94, height: 78, borderRadius: 14, borderWidth: 1, borderColor: '#2D3A32', backgroundColor: '#121A15', padding: 10, justifyContent: 'space-between' },
  quickIcon: { color: '#D7B45A', fontSize: 21, fontWeight: '900' },
  quickLabel: { color: '#D8E0DB', fontSize: 9, fontWeight: '900' },

  viewTabs: { flexDirection: 'row', gap: 6, marginTop: 22, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#263229' },
  viewTab: { flex: 1, minHeight: 38, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#111813' },
  viewTabActive: { backgroundColor: '#282214', borderWidth: 1, borderColor: '#735F2B' },
  viewTabText: { color: '#7F8C83', fontSize: 8, fontWeight: '900' },
  viewTabTextActive: { color: '#E7C464' },
  viewCount: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#202923', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  viewCountActive: { backgroundColor: '#D7B45A' },
  viewCountText: { color: '#9AA59E', fontSize: 7, fontWeight: '900' },
  viewCountTextActive: { color: '#172017' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12, marginBottom: 2 },
  filterChip: { minHeight: 32, borderRadius: 17, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111813', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  filterChipActive: { borderColor: '#7B652D', backgroundColor: '#231F12' },
  filterText: { color: '#829087', fontSize: 8, fontWeight: '800' },
  filterTextActive: { color: '#E7C464' },
  filterNumber: { color: '#647169', fontSize: 7, fontWeight: '900' },
  filterNumberActive: { color: '#D7B45A' },

  eventCard: { borderRadius: 18, borderWidth: 1, borderColor: '#2C3931', backgroundColor: '#121A15', overflow: 'hidden', marginTop: 11 },
  eventCardAttention: { borderColor: '#67522F' },
  eventCardRisk: { borderColor: '#754038' },
  eventImage: { width: '100%', height: 126, backgroundColor: '#19241C' },
  eventBody: { padding: 14 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  lifecyclePill: { borderRadius: 8, backgroundColor: '#2A2517', paddingHorizontal: 7, paddingVertical: 4 },
  lifecycleText: { color: '#D7B45A', fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  healthPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  healthTrack: { backgroundColor: '#17301D' },
  healthAttention: { backgroundColor: '#332614' },
  healthRisk: { backgroundColor: '#351B18' },
  healthText: { fontSize: 7, fontWeight: '900', letterSpacing: .4 },
  healthTextTrack: { color: '#8AD39A' },
  healthTextAttention: { color: '#E7AE61' },
  healthTextRisk: { color: '#F08A7F' },
  visibility: { color: '#6F7D74', fontSize: 7, fontWeight: '900', marginLeft: 'auto' },
  eventTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 8 },
  eventMeta: { color: '#A1ADA5', fontSize: 9, marginTop: 4 },
  eventLocation: { color: '#718078', fontSize: 8, lineHeight: 12, marginTop: 3 },

  registrationRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: 13 },
  registrationValue: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  registrationLabel: { color: '#6F7D74', fontSize: 7, fontWeight: '900', marginTop: 1 },
  readinessBlock: { flex: 1 },
  readinessCopy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readinessLabel: { color: '#6F7D74', fontSize: 7, fontWeight: '900' },
  readinessValue: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  readinessTrack: { height: 5, borderRadius: 3, backgroundColor: '#29342D', overflow: 'hidden', marginTop: 5 },
  readinessFill: { height: 5, backgroundColor: '#D7B45A' },

  gates: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  gate: { width: '48.5%', minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: '#28342D', backgroundColor: '#0F1611', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  gateIcon: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  gateReady: { backgroundColor: '#17301D' },
  gateAttention: { backgroundColor: '#382116' },
  gateProgress: { backgroundColor: '#2A2618' },
  gateNeutral: { backgroundColor: '#1F2822' },
  gateIconText: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  gateCopy: { flex: 1 },
  gateLabel: { color: '#D6DDD8', fontSize: 8, fontWeight: '900' },
  gateState: { color: '#748178', fontSize: 7, marginTop: 2 },

  pulseRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  pulse: { flex: 1, minHeight: 51, borderRadius: 10, backgroundColor: '#101711', padding: 8 },
  pulseLabel: { color: '#68766D', fontSize: 7, fontWeight: '900', textTransform: 'uppercase' },
  pulseValue: { color: '#C8D1CB', fontSize: 8, lineHeight: 12, fontWeight: '800', marginTop: 3 },

  healthCallout: { borderRadius: 11, borderWidth: 1, borderColor: '#67512F', backgroundColor: '#201A11', padding: 10, marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  healthCalloutRisk: { borderColor: '#733D36', backgroundColor: '#241413' },
  healthCalloutCopy: { flex: 1 },
  healthCalloutLabel: { color: '#E7A95D', fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  healthCalloutText: { color: '#B8A482', fontSize: 8, lineHeight: 12, marginTop: 2 },
  healthCalloutArrow: { color: '#D7B45A', fontSize: 20, fontWeight: '900' },
  workspaceButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#4C654F', backgroundColor: '#162219', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: 12 },
  workspaceButtonText: { color: '#A9D9B2', fontSize: 9, fontWeight: '900' },
  workspaceArrow: { color: '#A9D9B2', fontSize: 20, fontWeight: '900' },
  secondaryActions: { flexDirection: 'row', gap: 7, marginTop: 7 },
  secondaryAction: { flex: 1, minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: '#2D3932', alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: '#98A49C', fontSize: 8, fontWeight: '900' },

  draftGroup: { marginTop: 12 },
  groupLabel: { color: '#6E7B73', fontSize: 8, fontWeight: '900', letterSpacing: .8, marginBottom: 4 },
  draftCard: { borderRadius: 16, borderWidth: 1, borderColor: '#33423A', backgroundColor: '#121A15', padding: 13, marginTop: 8 },
  draftTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  draftSource: { borderRadius: 7, backgroundColor: '#292419', paddingHorizontal: 7, paddingVertical: 4 },
  draftSourceText: { color: '#D7B45A', fontSize: 7, fontWeight: '900' },
  draftUpdated: { color: '#68766D', fontSize: 7 },
  draftTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', marginTop: 8 },
  draftMeta: { color: '#92A097', fontSize: 8, marginTop: 3 },
  draftTrack: { height: 4, borderRadius: 2, backgroundColor: '#29342D', overflow: 'hidden', marginTop: 8 },
  draftFill: { height: 4, backgroundColor: '#D7B45A' },
  draftMissing: { color: '#7C8981', fontSize: 8, lineHeight: 12, marginTop: 7 },
  draftButton: { minHeight: 38, borderRadius: 10, backgroundColor: '#282214', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, marginTop: 10 },
  draftButtonText: { color: '#E7C464', fontSize: 8, fontWeight: '900' },
  draftButtonArrow: { color: '#E7C464', fontSize: 18, fontWeight: '900' },

  historyCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2C3931', backgroundColor: '#111813', padding: 13, marginTop: 10 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  historyLifecycle: { color: '#6E7B73', fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  historyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', marginTop: 3 },
  historyMeta: { color: '#7A877F', fontSize: 8, marginTop: 3 },
  historyRegistration: { color: '#D7B45A', fontSize: 16, fontWeight: '900' },
  historyRegistrationLabel: { color: '#718078', fontSize: 7, fontWeight: '800' },
  historyStats: { flexDirection: 'row', gap: 7, marginTop: 10 },
  historyButton: { minHeight: 39, borderRadius: 10, borderWidth: 1, borderColor: '#33423A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, marginTop: 9 },
  historyButtonText: { color: '#AAB5AE', fontSize: 8, fontWeight: '900' },
  historyButtonArrow: { color: '#AAB5AE', fontSize: 18, fontWeight: '900' },

  empty: { borderRadius: 16, borderWidth: 1, borderColor: '#2C3931', backgroundColor: '#111813', padding: 18, marginTop: 12 },
  emptyTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  emptyBody: { color: '#7D8A82', fontSize: 9, lineHeight: 14, marginTop: 4 },
});
