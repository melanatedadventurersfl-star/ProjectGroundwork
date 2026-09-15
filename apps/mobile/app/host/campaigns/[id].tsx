import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, type HostOuting } from '../../../src/hosting/api';
import { getCampaignDaysUntil, getHostCampaign, listCampaignTeam, type HostCampaign } from '../../../src/hosting/campaigns';
import { listCampaignMarketingItems } from '../../../src/hosting/campaignMarketing';
import { getEventAnalyticsSummary, type EventAnalyticsSummary } from '../../../src/hosting/eventAnalytics';
import { getEventOperationsSummary, listEventComponents, type EventOperationsSummary } from '../../../src/hosting/eventBuilder';
import { evaluateEventReadiness, type EventReadinessAction, type EventReadinessResult } from '../../../src/hosting/eventReadiness';
import { PositionedEventCover } from '../../../src/hosting/PositionedEventCover';
import { listHostTicketTypes, type HostTicketType } from '../../../src/hosting/tickets';

const emptyAnalytics: EventAnalyticsSummary = {
  impressions: 0,
  reach: 0,
  views: 0,
  clicks: 0,
  pageViews: 0,
  checkoutStarts: 0,
  orders: 0,
  tickets: 0,
  refunds: 0,
  checkIns: 0,
  grossRevenueCents: 0,
  refundedCents: 0,
  capacity: 0,
  sold: 0,
  bySource: [],
};

const emptyOperations: EventOperationsSummary = {
  progress: 0,
  taskCount: 0,
  completeTaskCount: 0,
  openTaskCount: 0,
  overdueTaskCount: 0,
  needsSchedulingCount: 0,
  revenueCents: 0,
  expenseCents: 0,
  profitCents: 0,
  confirmedVendors: 0,
  pendingVendors: 0,
  scheduledCommunications: 0,
  draftCommunications: 0,
};

type ComponentRow = { component_key: string; status: string };
type ActionItem = { key: string; title: string; detail: string; onPress: () => void; urgent?: boolean };
type ManageCard = { key: string; title: string; status: string; onPress: () => void };

function eventRange(startValue: string, endValue: string) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const sameDay = start.toDateString() === end.toDateString();
  const startText = start.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const endText = sameDay
    ? end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : end.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `${startText} to ${endText}`;
}

function locationLabel(event: HostOuting) {
  if (event.location_type === 'online') return 'Online event';
  if (event.location_type === 'tbd') return 'Location TBA';
  const location = [event.venue_name, event.city, event.state].filter(Boolean).join(', ');
  return event.location_type === 'hybrid' ? `${location || 'Location needed'} + online` : location || 'Location needed';
}

function statusLabel(status: HostOuting['status']) {
  if (status === 'sold_out') return 'Sold out';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function money(valueCents: number) {
  return `$${Math.round(valueCents / 100).toLocaleString()}`;
}

export default function HostCampaignCommandCenter() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [event, setEvent] = useState<HostOuting | null>(null);
  const [tickets, setTickets] = useState<HostTicketType[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [operations, setOperations] = useState<EventOperationsSummary>(emptyOperations);
  const [analytics, setAnalytics] = useState<EventAnalyticsSummary>(emptyAnalytics);
  const [teamCount, setTeamCount] = useState(0);
  const [marketingCount, setMarketingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextCampaign = await getHostCampaign(String(params.id));
      if (!nextCampaign) {
        setCampaign(null);
        setEvent(null);
        return;
      }
      const [nextEvent, nextTickets, nextComponents, nextOperations, nextAnalytics, nextTeam, marketing] = await Promise.all([
        getHostOutingById(nextCampaign.adventureId),
        listHostTicketTypes(nextCampaign.adventureId).catch(() => []),
        listEventComponents(nextCampaign.id).catch(() => []),
        getEventOperationsSummary(nextCampaign.id).catch(() => emptyOperations),
        getEventAnalyticsSummary(nextCampaign.id).catch(() => emptyAnalytics),
        listCampaignTeam(nextCampaign).catch(() => []),
        listCampaignMarketingItems(nextCampaign.id).catch(() => []),
      ]);
      setCampaign(nextCampaign);
      setEvent(nextEvent);
      setTickets(nextTickets);
      setComponents(nextComponents as ComponentRow[]);
      setOperations(nextOperations);
      setAnalytics(nextAnalytics);
      setTeamCount(nextTeam.length);
      setMarketingCount(marketing.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this event.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const readiness = useMemo<EventReadinessResult | null>(() => {
    if (!event) return null;
    return evaluateEventReadiness({ event, tickets, components, operations });
  }, [components, event, operations, tickets]);

  if (loading && (!campaign || !event)) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Opening event…</Text></View></SafeAreaView>;
  }
  if (!campaign || !event || !readiness) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.pageTitle}>Event unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View></SafeAreaView>;
  }

  const eventId = event.id;
  const days = getCampaignDaysUntil(campaign, new Date(referenceNow));
  const activeTasks = campaign.tasks.filter((task) => task.status !== 'complete');
  const overdueTasks = activeTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < referenceNow);
  const activeComponents = new Set(components.filter((item) => item.status !== 'disabled').map((item) => item.component_key));
  const registered = analytics.sold > 0 ? analytics.sold : campaign.metrics.attendees;
  const revenue = operations.revenueCents || analytics.grossRevenueCents;

  function routeForReadiness(action: EventReadinessAction) {
    if (action === 'cover') return `/host/edit/${eventId}?focus=cover`;
    if (action === 'details' || action === 'location') return `/host/edit/${eventId}`;
    if (action === 'tickets') return `/host/inventory/${eventId}`;
    if (action === 'communications') return `/host/event-communications/${eventId}`;
    return `/host/build/${eventId}?focus=schedule`;
  }

  const nextActions: ActionItem[] = [];
  for (const task of overdueTasks.slice(0, 2)) {
    nextActions.push({
      key: `task-${task.id}`,
      title: task.title,
      detail: 'Overdue task',
      urgent: true,
      onPress: () => router.push(`/host/campaigns/${campaign.slug}/tasks/${task.id}` as never),
    });
  }
  for (const item of readiness.incomplete) {
    if (nextActions.length >= 5) break;
    nextActions.push({
      key: `readiness-${item.key}`,
      title: item.label,
      detail: item.detail,
      onPress: () => router.push(routeForReadiness(item.action) as never),
    });
  }

  const operationsActive = ['venue', 'schedule', 'activities', 'food', 'equipment', 'safety', 'transportation', 'lodging'].some((key) => activeComponents.has(key));
  const manageCards: ManageCard[] = [
    { key: 'registration', title: 'Registration', status: `${registered} registered`, onPress: () => router.push(`/host/inventory/${event.id}` as never) },
    { key: 'tasks', title: 'Tasks', status: overdueTasks.length ? `${activeTasks.length} open · ${overdueTasks.length} overdue` : `${activeTasks.length} open`, onPress: () => router.push(`/host/campaigns/${campaign.slug}/tasks` as never) },
  ];
  if (activeComponents.has('venue') && event.location_type !== 'online') manageCards.push({ key: 'venue', title: 'Venue', status: event.venue_name ? `${event.venue_name} · ${event.city}, ${event.state}` : 'Location needs attention', onPress: () => router.push(`/host/venue/${event.id}` as never) });
  if (activeComponents.has('communications')) manageCards.push({ key: 'communications', title: 'Communications', status: `${operations.scheduledCommunications} scheduled · ${operations.draftCommunications} draft`, onPress: () => router.push(`/host/event-communications/${event.id}` as never) });
  if (operationsActive) manageCards.push({ key: 'operations', title: 'Operations', status: operations.overdueTaskCount ? `${operations.overdueTaskCount} overdue` : `${operations.openTaskCount ?? activeTasks.length} open items`, onPress: () => router.push(`/host/build/${event.id}?focus=schedule` as never) });
  if (activeComponents.has('team')) manageCards.push({ key: 'team', title: 'Team', status: `${teamCount} ${teamCount === 1 ? 'person' : 'people'}`, onPress: () => router.push(`/host/build/${event.id}?focus=team` as never) });
  if (activeComponents.has('finance')) manageCards.push({ key: 'money', title: 'Money', status: `${money(operations.profitCents)} projected profit`, onPress: () => router.push(`/host/build/${event.id}?focus=finance` as never) });
  if (activeComponents.has('marketing')) manageCards.push({ key: 'marketing', title: 'Marketing', status: marketingCount ? `${marketingCount} campaign item${marketingCount === 1 ? '' : 's'}` : 'Not started', onPress: () => router.push(`/host/campaigns/${campaign.slug}/marketing` as never) });
  if (activeComponents.has('vendors')) manageCards.push({ key: 'vendors', title: 'Vendors', status: `${operations.confirmedVendors} confirmed · ${operations.pendingVendors} pending`, onPress: () => router.push(`/host/build/${event.id}?focus=vendors` as never) });

  const primaryAction = (() => {
    if (event.status === 'completed') return { label: 'View event report', onPress: () => router.push(`/host/analytics/${event.id}` as never) };
    if (event.status === 'cancelled') return { label: 'View event details', onPress: () => router.push(`/host/review/${event.id}` as never) };
    if (event.status === 'draft') return { label: readiness.percent === 100 ? 'Review & publish' : 'Finish setup', onPress: () => router.push(`/host/review/${event.id}` as never) };
    if (days === 0) return { label: 'Open check-in', onPress: () => router.push(`/arrival/${event.id}` as never) };
    return { label: 'Manage event', onPress: () => router.push(`/host/review/${event.id}` as never) };
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Events</Text></Pressable>
          <View style={styles.statusPill}><Text style={styles.statusText}>{statusLabel(event.status)}</Text></View>
        </View>

        <View style={styles.identityCard}>
          {event.hero_image_url ? <Pressable onPress={() => router.push(`/host/edit/${event.id}?focus=cover` as never)}><PositionedEventCover adventureId={event.id} imageUrl={event.hero_image_url} style={styles.cover} /></Pressable> : <Pressable style={styles.coverFallback} onPress={() => router.push(`/host/edit/${event.id}?focus=cover` as never)}><Text style={styles.coverPlus}>＋</Text><Text style={styles.coverFallbackText}>Add event cover</Text></Pressable>}
          <View style={styles.identityBody}>
            <Text style={styles.pageTitle}>{event.title}</Text>
            <Text style={styles.meta}>{eventRange(event.starts_at, event.ends_at)}</Text>
            <Text style={styles.meta}>{locationLabel(event)}</Text>
            <View style={styles.identityActions}>
              <Pressable style={styles.secondaryButton} onPress={() => router.push(`/host/edit/${event.id}` as never)}><Text style={styles.secondaryButtonText}>Edit</Text></Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: event.id } } as never)}><Text style={styles.secondaryButtonText}>Preview</Text></Pressable>
              <Pressable style={styles.primaryCompact} onPress={primaryAction.onPress}><Text style={styles.primaryCompactText}>{primaryAction.label}</Text></Pressable>
            </View>
          </View>
        </View>

        <Pressable style={styles.readinessCard} onPress={() => router.push(`/host/review/${event.id}` as never)}>
          <View style={styles.readinessHeader}>
            <View><Text style={styles.eyebrow}>EVENT READINESS</Text><Text style={styles.readinessValue}>{readiness.percent}% ready</Text></View>
            <Text style={styles.readinessLink}>View details ›</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${readiness.percent}%` }]} /></View>
          <Text style={styles.readinessCopy}>{readiness.incomplete.length ? `${readiness.incomplete.length} item${readiness.incomplete.length === 1 ? '' : 's'} need attention` : 'All required setup is ready'}</Text>
          <View style={styles.milestoneList}>
            {readiness.milestones.map((milestone) => <View key={milestone.key} style={styles.milestoneRow}><View style={[styles.dot, milestone.done && styles.dotDone]}><Text style={styles.dotText}>{milestone.done ? '✓' : ''}</Text></View><View style={styles.flex}><Text style={styles.milestoneTitle}>{milestone.label}</Text><Text style={styles.milestoneDetail}>{milestone.detail}</Text></View></View>)}
          </View>
        </Pressable>

        {nextActions.length ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next actions</Text>
          <Text style={styles.sectionCopy}>Only the items that need your attention now.</Text>
          <View style={styles.actionList}>{nextActions.map((item) => <Pressable key={item.key} style={[styles.actionRow, item.urgent && styles.actionUrgent]} onPress={item.onPress}><View style={styles.actionIcon}><Text style={styles.actionIconText}>{item.urgent ? '!' : '○'}</Text></View><View style={styles.flex}><Text style={styles.actionTitle}>{item.title}</Text><Text style={styles.actionDetail}>{item.detail}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>
        </View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event snapshot</Text>
          <View style={styles.snapshotGrid}>
            <Snapshot value={String(registered)} label="Registered" />
            <Snapshot value={days === 0 ? 'Today' : String(days)} label={days === 0 ? 'Event day' : 'Days away'} />
            <Snapshot value={String(activeTasks.length)} label="Open tasks" />
            <Snapshot value={money(revenue)} label="Revenue" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage event</Text>
          <Text style={styles.sectionCopy}>Only the areas connected to this event are shown.</Text>
          <View style={styles.manageGrid}>{manageCards.map((card) => <Pressable key={card.key} style={styles.manageCard} onPress={card.onPress}><Text style={styles.manageTitle}>{card.title}</Text><Text style={styles.manageStatus}>{card.status}</Text><Text style={styles.manageLink}>Open ›</Text></Pressable>)}</View>
        </View>

        <Pressable style={styles.aiCard} onPress={() => router.push(`/host/assistant/${event.id}` as never)}>
          <View style={styles.aiMark}><Text style={styles.aiMarkText}>✦</Text></View>
          <View style={styles.flex}><Text style={styles.aiTitle}>Ask Event Assistant</Text><Text style={styles.aiCopy}>Work on this event with its current setup and status in context.</Text></View><Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={styles.analyticsButton} onPress={() => router.push(`/host/analytics/${event.id}` as never)}><Text style={styles.analyticsText}>View analytics</Text></Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Snapshot({ value, label }: { value: string; label: string }) {
  return <View style={styles.snapshot}><Text style={styles.snapshotValue}>{value}</Text><Text style={styles.snapshotLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  muted: { color: '#7D8981', fontSize: 10 },
  error: { color: '#FF9D93', fontSize: 10, lineHeight: 15, marginTop: 12 },
  topRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  statusPill: { borderRadius: 99, backgroundColor: '#19221C', borderWidth: 1, borderColor: '#35433A', paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: '#BFC9C2', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .8 },
  identityCard: { marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111814', overflow: 'hidden' },
  cover: { width: '100%', height: 210 },
  coverFallback: { height: 150, backgroundColor: '#18231C', alignItems: 'center', justifyContent: 'center', gap: 5 },
  coverPlus: { color: '#D7B45A', fontSize: 25 },
  coverFallbackText: { color: '#B8C2BC', fontSize: 10, fontWeight: '900' },
  identityBody: { padding: 16 },
  pageTitle: { color: '#FFF8E8', fontSize: 27, lineHeight: 32, fontWeight: '900' },
  meta: { color: '#909D95', fontSize: 10, lineHeight: 15, marginTop: 3 },
  identityActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  secondaryButton: { minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: '#3B483F', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#CAD2CD', fontSize: 9.5, fontWeight: '900' },
  primaryCompact: { minHeight: 40, borderRadius: 11, backgroundColor: '#D7B45A', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryCompactText: { color: '#172017', fontSize: 9.5, fontWeight: '900' },
  readinessCard: { marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: '#4B432B', backgroundColor: '#181911', padding: 14 },
  readinessHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  eyebrow: { color: '#D7B45A', fontSize: 7.5, fontWeight: '900', letterSpacing: 1 },
  readinessValue: { color: '#FFF8E8', fontSize: 24, fontWeight: '900', marginTop: 3 },
  readinessLink: { color: '#D7B45A', fontSize: 9, fontWeight: '900', marginTop: 3 },
  track: { height: 5, borderRadius: 5, backgroundColor: '#313125', overflow: 'hidden', marginTop: 11 },
  fill: { height: 5, borderRadius: 5, backgroundColor: '#D7B45A' },
  readinessCopy: { color: '#A7A68D', fontSize: 9, marginTop: 7 },
  milestoneList: { gap: 8, marginTop: 13 },
  milestoneRow: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  dot: { width: 21, height: 21, borderRadius: 11, borderWidth: 1, borderColor: '#5B5946', alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: '#1E3826', borderColor: '#5E8A68' },
  dotText: { color: '#98D1A4', fontSize: 10, fontWeight: '900' },
  milestoneTitle: { color: '#E6E8DD', fontSize: 10, fontWeight: '900' },
  milestoneDetail: { color: '#858877', fontSize: 8.5, marginTop: 1 },
  section: { marginTop: 22 },
  sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  sectionCopy: { color: '#7E8A82', fontSize: 9, lineHeight: 14, marginTop: 3 },
  actionList: { gap: 7, marginTop: 10 },
  actionRow: { minHeight: 62, borderRadius: 14, borderWidth: 1, borderColor: '#303C34', backgroundColor: '#121914', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11 },
  actionUrgent: { borderColor: '#69473F', backgroundColor: '#201613' },
  actionIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#27291E', alignItems: 'center', justifyContent: 'center' },
  actionIconText: { color: '#D7B45A', fontSize: 12, fontWeight: '900' },
  actionTitle: { color: '#E9EEEB', fontSize: 10.5, fontWeight: '900' },
  actionDetail: { color: '#7E8A82', fontSize: 8.5, marginTop: 2 },
  chevron: { color: '#7C8980', fontSize: 18 },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  snapshot: { width: '48.7%', minHeight: 78, borderRadius: 14, borderWidth: 1, borderColor: '#2C3831', backgroundColor: '#121914', padding: 12 },
  snapshotValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  snapshotLabel: { color: '#758178', fontSize: 8.5, marginTop: 4 },
  manageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  manageCard: { width: '48.7%', minHeight: 112, borderRadius: 15, borderWidth: 1, borderColor: '#303C34', backgroundColor: '#121914', padding: 12 },
  manageTitle: { color: '#F0F3F1', fontSize: 12, fontWeight: '900' },
  manageStatus: { color: '#829087', fontSize: 8.5, lineHeight: 13, marginTop: 5, minHeight: 27 },
  manageLink: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', marginTop: 8 },
  aiCard: { marginTop: 22, minHeight: 76, borderRadius: 16, borderWidth: 1, borderColor: '#4A3F62', backgroundColor: '#18151F', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#2B2438', alignItems: 'center', justifyContent: 'center' },
  aiMarkText: { color: '#C9B0FF', fontSize: 18 },
  aiTitle: { color: '#F2EDF9', fontSize: 11, fontWeight: '900' },
  aiCopy: { color: '#8F869A', fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  analyticsButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#344139', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  analyticsText: { color: '#AEB8B1', fontSize: 9.5, fontWeight: '900' },
  primaryButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#D7B45A', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' },
});