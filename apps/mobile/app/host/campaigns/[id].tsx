import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, transitionHostOuting, type HostOuting } from '../../../src/hosting/api';
import { archiveCampaignWorkspace, cancelCampaignEvent, duplicateCampaignEvent } from '../../../src/hosting/campaignLifecycle';
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
type BusyAction = 'duplicate' | 'complete' | 'cancel' | 'archive' | null;

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
  const [actionBusy, setActionBusy] = useState<BusyAction>(null);
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
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.pageTitle}>Event unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryButtonText}>Try again</Text></Pressable><Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.backLink}>Back to Events</Text></Pressable></View></SafeAreaView>;
  }

  const eventId = event.id;
  const days = getCampaignDaysUntil(campaign, new Date(referenceNow));
  const startTime = new Date(event.starts_at).getTime();
  const endTime = new Date(event.ends_at).getTime();
  const happeningNow = Number.isFinite(startTime) && Number.isFinite(endTime) && startTime <= referenceNow && endTime >= referenceNow;
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
    { key: 'guests', title: 'Guests & check-in', status: `${registered} expected`, onPress: () => router.push(`/host/${event.id}` as never) },
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
    if (event.status === 'cancelled') return { label: 'View archived details', onPress: () => router.push(`/host/edit/${event.id}` as never) };
    if (event.status === 'draft') return { label: readiness.percent === 100 ? 'Review & publish' : 'Finish setup', onPress: () => router.push(`/host/review/${event.id}` as never) };
    if (happeningNow) return { label: 'Open check-in', onPress: () => router.push(`/arrival/${event.id}` as never) };
    return { label: 'Event setup', onPress: () => router.push(`/host/build/${event.id}` as never) };
  })();

  async function duplicateEvent() {
    if (actionBusy) return;
    setActionBusy('duplicate');
    setError('');
    try {
      const copy = await duplicateCampaignEvent(campaign);
      router.replace(`/host/campaigns/${copy.slug}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to duplicate this event.');
    } finally {
      setActionBusy(null);
    }
  }

  function confirmComplete() {
    Alert.alert('Mark event complete?', 'The event will move to History and its Host workspace will close.', [
      { text: 'Keep event open', style: 'cancel' },
      { text: 'Mark complete', onPress: () => void completeEvent() },
    ]);
  }

  async function completeEvent() {
    if (actionBusy) return;
    setActionBusy('complete');
    setError('');
    try {
      await transitionHostOuting(event.id, 'completed');
      await archiveCampaignWorkspace(campaign);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to complete this event.');
    } finally {
      setActionBusy(null);
    }
  }

  function confirmCancel() {
    Alert.alert('Cancel event?', 'This cancels the linked public event and closes its Host workspace. Existing payment records remain in the system.', [
      { text: 'Keep event', style: 'cancel' },
      { text: 'Cancel event', style: 'destructive', onPress: () => void cancelEvent() },
    ]);
  }

  async function cancelEvent() {
    if (actionBusy) return;
    setActionBusy('cancel');
    setError('');
    try {
      await cancelCampaignEvent(campaign);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to cancel this event.');
    } finally {
      setActionBusy(null);
    }
  }

  function confirmArchive() {
    Alert.alert('Archive workspace?', 'This removes the Host workspace from active planning without cancelling the public event.', [
      { text: 'Keep workspace', style: 'cancel' },
      { text: 'Archive workspace', onPress: () => void archiveEvent() },
    ]);
  }

  async function archiveEvent() {
    if (actionBusy) return;
    setActionBusy('archive');
    setError('');
    try {
      await archiveCampaignWorkspace(campaign);
      router.replace('/host/events' as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to archive this workspace.');
    } finally {
      setActionBusy(null);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.backLink}>‹ Events</Text></Pressable>
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
        <View style={styles.readinessHeader}><View><Text style={styles.eyebrow}>EVENT READINESS</Text><Text style={styles.readinessValue}>{readiness.percent}% ready</Text></View><Text style={styles.readinessLink}>View checklist ›</Text></View>
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, readiness.percent))}%` }]} /></View>
        <Text style={styles.readinessCopy}>{readiness.incomplete.length ? `${readiness.incomplete.length} item${readiness.incomplete.length === 1 ? '' : 's'} need attention` : 'All required setup is ready'}</Text>
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
          <Snapshot value={happeningNow ? 'Today' : days === 1 ? '1 day' : `${days} days`} label="Until event" />
          <Snapshot value={String(activeTasks.length)} label="Open tasks" />
          <Snapshot value={money(revenue)} label="Revenue" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manage event</Text>
        <Text style={styles.sectionCopy}>Each area opens the workspace where that work belongs.</Text>
        <View style={styles.manageGrid}>{manageCards.map((card) => <Pressable key={card.key} style={styles.manageCard} onPress={card.onPress}><Text style={styles.manageTitle}>{card.title}</Text><Text style={styles.manageStatus}>{card.status}</Text><Text style={styles.manageArrow}>Open ›</Text></Pressable>)}</View>
      </View>

      <Pressable style={styles.assistantCard} onPress={() => router.push(`/host/assistant/${event.id}` as never)}>
        <View style={styles.assistantIcon}><Text style={styles.assistantIconText}>✦</Text></View>
        <View style={styles.flex}><Text style={styles.assistantEyebrow}>EVENT ASSISTANT</Text><Text style={styles.assistantTitle}>Work with the current event setup</Text><Text style={styles.assistantCopy}>Ask about the event, planning gaps, tasks, and next steps.</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={styles.analyticsButton} onPress={() => router.push(`/host/analytics/${event.id}` as never)}><Text style={styles.analyticsText}>View event analytics</Text><Text style={styles.chevron}>›</Text></Pressable>

      {campaign.canManage ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event actions</Text>
        <Text style={styles.sectionCopy}>Lifecycle actions live here instead of in a second event editor.</Text>
        <View style={styles.eventActions}>
          <Pressable disabled={Boolean(actionBusy)} style={styles.eventActionRow} onPress={() => void duplicateEvent()}><View style={styles.flex}><Text style={styles.eventActionTitle}>Duplicate event</Text><Text style={styles.eventActionCopy}>Create a new draft from this event and its planning work.</Text></View><Text style={styles.chevron}>{actionBusy === 'duplicate' ? '…' : '›'}</Text></Pressable>
          {['published', 'sold_out'].includes(event.status) ? <Pressable disabled={Boolean(actionBusy)} style={styles.eventActionRow} onPress={confirmComplete}><View style={styles.flex}><Text style={styles.eventActionTitle}>Mark event complete</Text><Text style={styles.eventActionCopy}>Move the event into History and close active planning.</Text></View><Text style={styles.chevron}>{actionBusy === 'complete' ? '…' : '›'}</Text></Pressable> : null}
          {!['cancelled', 'completed'].includes(event.status) ? <Pressable disabled={Boolean(actionBusy)} style={styles.eventActionRow} onPress={confirmArchive}><View style={styles.flex}><Text style={styles.eventActionTitle}>Archive workspace</Text><Text style={styles.eventActionCopy}>Close Host planning without cancelling the public event.</Text></View><Text style={styles.chevron}>{actionBusy === 'archive' ? '…' : '›'}</Text></Pressable> : null}
          {!['cancelled', 'completed'].includes(event.status) ? <Pressable disabled={Boolean(actionBusy)} style={[styles.eventActionRow, styles.dangerRow]} onPress={confirmCancel}><View style={styles.flex}><Text style={styles.dangerTitle}>Cancel event</Text><Text style={styles.eventActionCopy}>Cancel the public event and close its Host workspace.</Text></View><Text style={styles.dangerArrow}>{actionBusy === 'cancel' ? '…' : '›'}</Text></Pressable> : null}
        </View>
      </View> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Snapshot({ value, label }: { value: string; label: string }) {
  return <View style={styles.snapshot}><Text style={styles.snapshotValue}>{value}</Text><Text style={styles.snapshotLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  content: { padding: 18, paddingBottom: 90, maxWidth: 820, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  flex: { flex: 1 },
  muted: { color: '#829087', fontSize: 10 },
  error: { color: '#EF9E94', fontSize: 10.5, lineHeight: 16, marginTop: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  backLink: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900' },
  statusPill: { borderRadius: 99, borderWidth: 1, borderColor: '#39453E', backgroundColor: '#121914', paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: '#CDD6D0', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  identityCard: { borderRadius: 18, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', overflow: 'hidden' },
  cover: { width: '100%', height: 210 },
  coverFallback: { height: 170, backgroundColor: '#18231D', alignItems: 'center', justifyContent: 'center', gap: 5 },
  coverPlus: { color: '#D7B45A', fontSize: 28, fontWeight: '400' },
  coverFallbackText: { color: '#A6B1A9', fontSize: 10, fontWeight: '900' },
  identityBody: { padding: 15 },
  pageTitle: { color: '#FFF8E8', fontSize: 27, lineHeight: 33, fontWeight: '900' },
  meta: { color: '#89958D', fontSize: 10, lineHeight: 15, marginTop: 4 },
  identityActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  secondaryButton: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#39453E', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#D5DDD8', fontSize: 9.5, fontWeight: '900' },
  primaryCompact: { minHeight: 42, borderRadius: 11, backgroundColor: '#D7B45A', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryCompactText: { color: '#172017', fontSize: 9.5, fontWeight: '900' },
  readinessCard: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: '#3A443E', backgroundColor: '#111813', padding: 14 },
  readinessHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrow: { color: '#D7B45A', fontSize: 7.5, fontWeight: '900', letterSpacing: 1 },
  readinessValue: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 2 },
  readinessLink: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900' },
  track: { height: 5, borderRadius: 5, backgroundColor: '#283129', overflow: 'hidden', marginTop: 10 },
  fill: { height: 5, backgroundColor: '#D7B45A' },
  readinessCopy: { color: '#7E8B82', fontSize: 8.5, marginTop: 7 },
  section: { marginTop: 20 },
  sectionTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  sectionCopy: { color: '#78857D', fontSize: 8.5, lineHeight: 13, marginTop: 3, marginBottom: 8 },
  actionList: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121914', overflow: 'hidden' },
  actionRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#28332C' },
  actionUrgent: { backgroundColor: '#201713' },
  actionIcon: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: '#6B5A37', alignItems: 'center', justifyContent: 'center' },
  actionIconText: { color: '#E0BD66', fontSize: 10, fontWeight: '900' },
  actionTitle: { color: '#F4F1E8', fontSize: 10.5, fontWeight: '900' },
  actionDetail: { color: '#77847C', fontSize: 8.5, marginTop: 3 },
  chevron: { color: '#7D8981', fontSize: 18 },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  snapshot: { width: '48.5%', minHeight: 74, borderRadius: 13, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121914', padding: 11 },
  snapshotValue: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  snapshotLabel: { color: '#758178', fontSize: 8, marginTop: 3 },
  manageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  manageCard: { width: '48.5%', minHeight: 100, borderRadius: 14, borderWidth: 1, borderColor: '#2F3B34', backgroundColor: '#121914', padding: 12 },
  manageTitle: { color: '#F3F1E9', fontSize: 11.5, fontWeight: '900' },
  manageStatus: { color: '#78847C', fontSize: 8.5, lineHeight: 13, marginTop: 5, flex: 1 },
  manageArrow: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', marginTop: 10 },
  assistantCard: { marginTop: 20, minHeight: 90, borderRadius: 16, borderWidth: 1, borderColor: '#4D4631', backgroundColor: '#18170F', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  assistantIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#3A3116', alignItems: 'center', justifyContent: 'center' },
  assistantIconText: { color: '#E6C45F', fontSize: 18 },
  assistantEyebrow: { color: '#D7B45A', fontSize: 7.5, fontWeight: '900', letterSpacing: 1 },
  assistantTitle: { color: '#F6F1E4', fontSize: 11.5, fontWeight: '900', marginTop: 2 },
  assistantCopy: { color: '#8F8978', fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  analyticsButton: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#344039', marginTop: 9, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  analyticsText: { color: '#DCE3DE', fontSize: 10, fontWeight: '900' },
  eventActions: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111713', overflow: 'hidden' },
  eventActionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#28322C' },
  eventActionTitle: { color: '#F1F3EF', fontSize: 10.5, fontWeight: '900' },
  eventActionCopy: { color: '#768179', fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  dangerRow: { backgroundColor: '#1F1412' },
  dangerTitle: { color: '#F0A097', fontSize: 10.5, fontWeight: '900' },
  dangerArrow: { color: '#E58B80', fontSize: 18 },
  primaryButton: { minHeight: 46, borderRadius: 12, backgroundColor: '#D7B45A', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { color: '#172017', fontSize: 10.5, fontWeight: '900' },
});