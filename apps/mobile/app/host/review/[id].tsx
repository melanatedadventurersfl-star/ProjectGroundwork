import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, publishHostOuting, type HostOuting } from '../../../src/hosting/api';
import { createCampaignWorkspace } from '../../../src/hosting/creation';
import { addEventComponent, getCampaignForAdventure, getEventOperationsSummary, listEventComponents, type EventOperationsSummary } from '../../../src/hosting/eventBuilder';
import { recommendedEventComponents } from '../../../src/hosting/eventBuilderTemplates';
import { evaluateEventReadiness, type EventReadinessAction, type EventReadinessResult } from '../../../src/hosting/eventReadiness';
import { listHostTicketTypes, type HostTicketType } from '../../../src/hosting/tickets';

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

function locationLabel(event: HostOuting) {
  if (event.location_type === 'online') return event.online_url ? 'Online event' : 'Online link needed';
  if (event.location_type === 'tbd') return 'Location to be announced';
  const physical = [event.venue_name, event.city, event.state].filter(Boolean).join(', ');
  return event.location_type === 'hybrid' ? `${physical || 'Physical location needed'} + online` : physical || 'Location needed';
}

export default function EventReadinessScreen() {
  const { id, warning } = useLocalSearchParams<{ id: string; warning?: string }>();
  const [event, setEvent] = useState<HostOuting | null>(null);
  const [tickets, setTickets] = useState<HostTicketType[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [operations, setOperations] = useState<EventOperationsSummary>(emptyOperations);
  const [campaignSlug, setCampaignSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [nextEvent, nextTickets] = await Promise.all([
        getHostOutingById(id),
        listHostTicketTypes(id),
      ]);

      let campaign = await getCampaignForAdventure(id).catch(() => null);
      let repairedWorkspace = false;
      if (!campaign) {
        await createCampaignWorkspace({
          adventureId: nextEvent.id,
          title: nextEvent.title,
          location: locationLabel(nextEvent),
          startsAt: nextEvent.starts_at,
          endsAt: nextEvent.ends_at,
        });
        campaign = await getCampaignForAdventure(id);
        repairedWorkspace = true;
      }

      let nextComponents = campaign ? await listEventComponents(campaign.id).catch(() => []) : [];
      const hasActiveComponents = nextComponents.some((item) => item.status !== 'disabled');
      if (campaign && (repairedWorkspace || !hasActiveComponents)) {
        const paid = nextTickets.some((ticket) => ticket.is_active && ticket.price_cents > 0);
        const recommended = recommendedEventComponents(nextEvent.category, nextEvent.location_type, paid);
        await Promise.allSettled(recommended.map((component) => addEventComponent(campaign!.id, component, nextEvent.starts_at)));
        nextComponents = await listEventComponents(campaign.id).catch(() => nextComponents);
      }

      const nextOperations = campaign ? await getEventOperationsSummary(campaign.id).catch(() => emptyOperations) : emptyOperations;
      setEvent(nextEvent);
      setTickets(nextTickets);
      setComponents(nextComponents as ComponentRow[]);
      setOperations(nextOperations);
      setCampaignSlug((campaign as { slug?: string } | null)?.slug ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load event readiness.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const readiness = useMemo<EventReadinessResult | null>(() => {
    if (!event) return null;
    return evaluateEventReadiness({ event, tickets, components, operations });
  }, [components, event, operations, tickets]);

  function commandCenterRoute() {
    return campaignSlug ? `/host/campaigns/${campaignSlug}` : '/host/events';
  }

  function openAction(action: EventReadinessAction) {
    if (!event) return;
    if (action === 'cover') return router.push(`/host/edit/${event.id}?focus=cover` as never);
    if (action === 'details' || action === 'location') return router.push(`/host/edit/${event.id}` as never);
    if (action === 'tickets') return router.push(`/host/inventory/${event.id}` as never);
    if (action === 'communications') return router.push(`/host/event-communications/${event.id}` as never);
    return router.push(`/host/build/${event.id}?focus=schedule` as never);
  }

  async function publish() {
    if (!event || !readiness || event.status !== 'draft' || readiness.percent < 100 || publishing) return;
    setPublishing(true);
    setError('');
    try {
      await publishHostOuting(event.id);
      await load();
      router.replace(commandCenterRoute() as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish this event.');
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Checking event readiness…</Text></SafeAreaView>;
  if (!event || !readiness) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Event unavailable.'}</Text><Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.back}>Back to Events</Text></Pressable></SafeAreaView>;

  const isDraft = event.status === 'draft';
  const canPublish = isDraft && readiness.percent === 100;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace(commandCenterRoute() as never)}><Text style={styles.back}>‹ Event Command Center</Text></Pressable>
      <Text style={styles.eyebrow}>{isDraft ? 'REVIEW & PUBLISH' : 'EVENT READINESS'}</Text>
      <Text style={styles.title}>{readiness.percent}% ready</Text>
      <Text style={styles.subtitle}>{readiness.incomplete.length ? `${readiness.incomplete.length} item${readiness.incomplete.length === 1 ? '' : 's'} still need attention. Open an item below to fix it in the workspace that owns it.` : isDraft ? 'Required setup is complete. This draft is ready to publish.' : 'Required setup is complete.'}</Text>

      {warning ? <View style={styles.warning}><Text style={styles.warningTitle}>Setup needs attention</Text><Text style={styles.warningText}>{decodeURIComponent(String(warning))}</Text></View> : null}
      {error ? <View style={styles.warning}><Text style={styles.warningTitle}>Action needs attention</Text><Text style={styles.warningText}>{error}</Text></View> : null}

      <View style={styles.progressCard}>
        <View style={styles.progressTop}><Text style={styles.progressLabel}>Overall readiness</Text><Text style={styles.progressValue}>{readiness.percent}%</Text></View>
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, readiness.percent))}%` }]} /></View>
      </View>

      <Text style={styles.sectionLabel}>READINESS AREAS</Text>
      <View style={styles.areaList}>{readiness.areas.map((area) => <View key={area.key} style={styles.areaCard}>
        <View style={styles.areaHeader}><View style={styles.flex}><Text style={styles.areaTitle}>{area.label}</Text><Text style={styles.areaMeta}>{area.readyCount}/{area.items.length} ready</Text></View><Text style={[styles.areaCount, area.complete && styles.areaCountDone]}>{area.complete ? 'Ready' : `${area.readyCount}/${area.items.length}`}</Text></View>
        <View style={styles.checkList}>{area.items.map((item) => <Pressable key={item.key} style={styles.checkRow} onPress={() => openAction(item.action)}>
          <View style={[styles.checkMark, item.done && styles.checkMarkDone]}><Text style={styles.checkMarkText}>{item.done ? '✓' : '○'}</Text></View>
          <View style={styles.flex}><Text style={styles.checkLabel}>{item.label}</Text><Text style={styles.checkDetail}>{item.detail}</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>)}</View>
      </View>)}</View>

      <Text style={styles.sectionLabel}>MILESTONES</Text>
      <View style={styles.milestoneCard}>{readiness.milestones.map((milestone) => <View key={milestone.key} style={styles.milestoneRow}>
        <View style={[styles.milestoneMark, milestone.done && styles.milestoneMarkDone]}><Text style={styles.milestoneMarkText}>{milestone.done ? '✓' : ''}</Text></View>
        <View style={styles.flex}><Text style={styles.milestoneTitle}>{milestone.label}</Text><Text style={styles.milestoneDetail}>{milestone.detail}</Text></View>
      </View>)}</View>

      {isDraft ? <View style={styles.publishCard}>
        <Text style={styles.publishEyebrow}>DRAFT</Text>
        <Text style={styles.publishTitle}>{canPublish ? 'Ready to publish' : 'Finish the remaining setup first'}</Text>
        <Text style={styles.publishBody}>{canPublish ? 'Publishing makes the event available through its configured discovery and registration surfaces.' : 'Publishing stays locked until all required readiness items are complete.'}</Text>
        {canPublish ? <Pressable disabled={publishing} style={styles.primary} onPress={() => void publish()}>{publishing ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Publish event</Text>}</Pressable> : <Pressable style={styles.primary} onPress={() => router.push(`/host/build/${event.id}` as never)}><Text style={styles.primaryText}>Continue event setup</Text></Pressable>}
      </View> : <Pressable style={styles.primary} onPress={() => router.replace(commandCenterRoute() as never)}><Text style={styles.primaryText}>Back to Event Command Center</Text></Pressable>}

      <Pressable style={styles.secondary} onPress={() => router.push(`/host/edit/${event.id}` as never)}><Text style={styles.secondaryText}>Edit event details</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 9 },
  content: { padding: 18, paddingBottom: 88, maxWidth: 760, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  back: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900', marginBottom: 14 },
  eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#8D9A91', fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  muted: { color: '#819087', fontSize: 10 },
  error: { color: '#EE9D93', fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  warning: { marginTop: 14, borderRadius: 13, borderWidth: 1, borderColor: '#6B552A', backgroundColor: '#251F12', padding: 12 },
  warningTitle: { color: '#ECD58A', fontSize: 10.5, fontWeight: '900' },
  warningText: { color: '#C7B474', fontSize: 9.5, lineHeight: 15, marginTop: 4 },
  progressCard: { marginTop: 16, borderRadius: 15, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', padding: 13 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: '#D7DED9', fontSize: 10.5, fontWeight: '900' },
  progressValue: { color: '#E6C361', fontSize: 15, fontWeight: '900' },
  track: { height: 6, borderRadius: 5, backgroundColor: '#283129', overflow: 'hidden', marginTop: 10 },
  fill: { height: 6, backgroundColor: '#D7B45A' },
  sectionLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  areaList: { gap: 8 },
  areaCard: { borderRadius: 15, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', padding: 11 },
  areaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  areaTitle: { color: '#EBEFEC', fontSize: 12, fontWeight: '900' },
  areaMeta: { color: '#748078', fontSize: 8.5, marginTop: 2 },
  areaCount: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900' },
  areaCountDone: { color: '#8FD09A' },
  checkList: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A352E' },
  checkRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#273129', paddingVertical: 8 },
  checkMark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#626D66', alignItems: 'center', justifyContent: 'center' },
  checkMarkDone: { borderColor: '#6BAA7D', backgroundColor: '#183023' },
  checkMarkText: { color: '#D7E0DA', fontSize: 10, fontWeight: '900' },
  checkLabel: { color: '#F1F3F1', fontSize: 10.5, fontWeight: '900' },
  checkDetail: { color: '#76827A', fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  chevron: { color: '#77837C', fontSize: 18 },
  milestoneCard: { borderRadius: 15, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', overflow: 'hidden' },
  milestoneRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#273129' },
  milestoneMark: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, borderColor: '#626D66', alignItems: 'center', justifyContent: 'center' },
  milestoneMarkDone: { borderColor: '#6BAA7D', backgroundColor: '#183023' },
  milestoneMarkText: { color: '#B9E0C5', fontSize: 10, fontWeight: '900' },
  milestoneTitle: { color: '#EBEFEC', fontSize: 10.5, fontWeight: '900' },
  milestoneDetail: { color: '#748078', fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  publishCard: { marginTop: 20, borderRadius: 16, borderWidth: 1, borderColor: '#6B552A', backgroundColor: '#211C10', padding: 15 },
  publishEyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  publishTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 4 },
  publishBody: { color: '#A69A78', fontSize: 9.5, lineHeight: 15, marginTop: 5 },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: '#172017', fontSize: 11.5, fontWeight: '900' },
  secondary: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#39453E', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  secondaryText: { color: '#D4DDD7', fontSize: 10.5, fontWeight: '900' },
});
