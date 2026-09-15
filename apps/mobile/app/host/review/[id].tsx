import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, type HostOuting } from '../../../src/hosting/api';
import { createCampaignWorkspace } from '../../../src/hosting/creation';
import { addEventComponent, getCampaignForAdventure, getEventOperationsSummary, listEventComponents, type EventOperationsSummary } from '../../../src/hosting/eventBuilder';
import { recommendedEventComponents } from '../../../src/hosting/eventBuilderTemplates';
import { evaluateEventReadiness, type EventReadinessAction, type EventReadinessResult } from '../../../src/hosting/eventReadiness';
import { listHostTicketTypes, type HostTicketType } from '../../../src/hosting/tickets';
import { listMyOrganizations, type OrganizationWorkspace } from '../../../src/platform/organizations';

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

function scheduleLabel(event: HostOuting) {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const sameDay = start.toDateString() === end.toDateString();
  const startLabel = start.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const endLabel = sameDay
    ? end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : end.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `${startLabel} to ${endLabel}`;
}

function locationLabel(event: HostOuting) {
  if (event.location_type === 'online') return event.online_url ? 'Online event' : 'Online link needed';
  if (event.location_type === 'tbd') return 'Location to be announced';
  const physical = [event.venue_name, event.city, event.state].filter(Boolean).join(', ');
  return event.location_type === 'hybrid' ? `${physical || 'Physical location needed'} + online` : physical || 'Location needed';
}

function admissionLabel(tickets: HostTicketType[]) {
  const active = tickets.filter((ticket) => ticket.is_active);
  if (!active.length) return 'Admission not configured';
  const lowest = Math.min(...active.map((ticket) => ticket.price_cents));
  return lowest === 0 ? 'Free' : `From $${(lowest / 100).toFixed(2)}`;
}

export default function ReviewEventDraftScreen() {
  const { id, warning } = useLocalSearchParams<{ id: string; warning?: string }>();
  const [event, setEvent] = useState<HostOuting | null>(null);
  const [tickets, setTickets] = useState<HostTicketType[]>([]);
  const [organization, setOrganization] = useState<OrganizationWorkspace | null>(null);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [operations, setOperations] = useState<EventOperationsSummary>(emptyOperations);
  const [campaignSlug, setCampaignSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [nextEvent, nextTickets, organizations] = await Promise.all([
        getHostOutingById(id),
        listHostTicketTypes(id),
        listMyOrganizations(),
      ]);
      const owningOrganization = organizations.find((item) => item.id === nextEvent.platform_organization_id)
        ?? organizations.find((item) => item.isActive)
        ?? organizations[0]
        ?? null;

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
      setOrganization(owningOrganization);
      setComponents(nextComponents as ComponentRow[]);
      setOperations(nextOperations);
      setCampaignSlug((campaign as { slug?: string } | null)?.slug ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this event.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const readiness = useMemo<EventReadinessResult | null>(() => {
    if (!event) return null;
    return evaluateEventReadiness({ event, tickets, components, operations });
  }, [components, event, operations, tickets]);

  function openAction(action: EventReadinessAction) {
    if (!event) return;
    if (action === 'cover') return router.push(`/host/edit/${event.id}?focus=cover` as never);
    if (action === 'details' || action === 'location') return router.push(`/host/edit/${event.id}` as never);
    if (action === 'tickets') return router.push(`/host/inventory/${event.id}` as never);
    if (action === 'communications') return router.push(`/host/event-communications/${event.id}` as never);
    if (action === 'team') return router.push(`/host/build/${event.id}?focus=team` as never);
    if (action === 'finance') return router.push(`/host/build/${event.id}?focus=finance` as never);
    if (action === 'pages') return router.push(`/host/build/${event.id}?focus=pages` as never);
    return router.push(`/host/build/${event.id}?focus=schedule` as never);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Checking event readiness…</Text></SafeAreaView>;
  if (!event || !readiness) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Event unavailable.'}</Text><Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.back}>Back to events</Text></Pressable></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => campaignSlug ? router.replace(`/host/campaigns/${campaignSlug}` as never) : router.replace('/host/events' as never)}><Text style={styles.back}>‹ Event overview</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT READINESS</Text>
        <Text style={styles.title}>{readiness.percent}% ready</Text>
        <Text style={styles.subtitle}>{readiness.incomplete.length ? `${readiness.incomplete.length} item${readiness.incomplete.length === 1 ? '' : 's'} still need attention. Each row below uses the same readiness rules as the event overview.` : 'All required setup is ready.'}</Text>

        {warning ? <View style={styles.warning}><Text style={styles.warningTitle}>Some setup needs attention</Text><Text style={styles.warningText}>{decodeURIComponent(String(warning))}</Text></View> : null}
        {error ? <View style={styles.warning}><Text style={styles.warningTitle}>Workspace setup needs attention</Text><Text style={styles.warningText}>{error}</Text></View> : null}

        <ImageBackground source={event.hero_image_url ? { uri: event.hero_image_url } : undefined} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroPill}><Text style={styles.heroPillText}>{event.category}</Text></View>
          <View><Text style={styles.heroTitle}>{event.title}</Text><Text style={styles.heroMeta}>{scheduleLabel(event)} · {admissionLabel(tickets)}</Text></View>
        </ImageBackground>

        <View style={styles.overallTrack}><View style={[styles.overallFill, { width: `${readiness.percent}%` }]} /></View>

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

        <Text style={styles.sectionLabel}>EVENT SUMMARY</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label="Date & time" value={scheduleLabel(event)} />
          <SummaryRow label="Location" value={locationLabel(event)} />
          <SummaryRow label="Access" value={event.visibility.charAt(0).toUpperCase() + event.visibility.slice(1)} />
          <SummaryRow label="Admission" value={admissionLabel(tickets)} />
          <SummaryRow label="Capacity" value={event.capacity == null ? 'No limit' : `${event.capacity} attendees`} />
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Organizer</Text><View style={styles.organizerValue}>{organization?.logoUrl ? <Image source={{ uri: organization.logoUrl }} style={styles.logo} /> : <View style={styles.logoFallback}><Text style={styles.logoFallbackText}>{(organization?.name ?? 'O').charAt(0)}</Text></View>}<Text style={styles.summaryValue}>{organization?.name ?? 'Event organization'}</Text></View></View>
        </View>

        <Pressable style={styles.primary} onPress={() => router.push(`/host/build/${event.id}` as never)}><Text style={styles.primaryText}>Open event setup</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push(`/host/edit/${event.id}` as never)}><Text style={styles.secondaryText}>Edit event details</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  center: { flex: 1, backgroundColor: '#0A0F0C', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 9 },
  content: { padding: 18, paddingBottom: 88, maxWidth: 760, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  muted: { color: '#819087', fontSize: 10 },
  back: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900', marginBottom: 14 },
  eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#8D9A91', fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  warning: { marginTop: 14, borderRadius: 13, borderWidth: 1, borderColor: '#6B552A', backgroundColor: '#251F12', padding: 12 },
  warningTitle: { color: '#ECD58A', fontSize: 10.5, fontWeight: '900' },
  warningText: { color: '#C7B474', fontSize: 9.5, lineHeight: 15, marginTop: 4 },
  hero: { minHeight: 210, borderRadius: 20, overflow: 'hidden', padding: 14, justifyContent: 'space-between', backgroundColor: '#1A2820', marginTop: 15 },
  heroImage: { borderRadius: 20, resizeMode: 'cover' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,11,8,.48)' },
  heroPill: { alignSelf: 'flex-start', borderRadius: 99, backgroundColor: 'rgba(9,14,11,.75)', paddingHorizontal: 9, paddingVertical: 6 },
  heroPillText: { color: '#E7C464', fontSize: 8, fontWeight: '900' },
  heroTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  heroMeta: { color: '#D1D9D3', fontSize: 9, marginTop: 5 },
  overallTrack: { height: 5, borderRadius: 5, backgroundColor: '#283129', overflow: 'hidden', marginTop: 12 },
  overallFill: { height: 5, backgroundColor: '#D7B45A' },
  sectionLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  areaList: { gap: 8 },
  areaCard: { borderRadius: 15, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', padding: 11 },
  areaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  areaTitle: { color: '#EBEFEC', fontSize: 12, fontWeight: '900' },
  areaMeta: { color: '#748078', fontSize: 8.5, marginTop: 2 },
  areaCount: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900' },
  areaCountDone: { color: '#8FD09E' },
  checkList: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A352F' },
  checkRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#27322C', paddingVertical: 8 },
  checkMark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#526057', alignItems: 'center', justifyContent: 'center' },
  checkMarkDone: { backgroundColor: '#1E3826', borderColor: '#5F8968' },
  checkMarkText: { color: '#91C99C', fontSize: 11, fontWeight: '900' },
  checkLabel: { color: '#DCE3DE', fontSize: 10, fontWeight: '900' },
  checkDetail: { color: '#748078', fontSize: 8.3, marginTop: 2 },
  chevron: { color: '#758178', fontSize: 18 },
  milestoneCard: { borderRadius: 15, borderWidth: 1, borderColor: '#3D3B2B', backgroundColor: '#171810', padding: 11, gap: 9 },
  milestoneRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9 },
  milestoneMark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#5E5A42', alignItems: 'center', justifyContent: 'center' },
  milestoneMarkDone: { backgroundColor: '#1F3826', borderColor: '#638B69' },
  milestoneMarkText: { color: '#92CF9E', fontSize: 10, fontWeight: '900' },
  milestoneTitle: { color: '#E7EADF', fontSize: 10, fontWeight: '900' },
  milestoneDetail: { color: '#858978', fontSize: 8.3, marginTop: 2 },
  summaryCard: { borderRadius: 15, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', paddingHorizontal: 12 },
  summaryRow: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A352F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: '#758178', fontSize: 9 },
  summaryValue: { color: '#DCE3DE', fontSize: 9.5, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  organizerValue: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  logo: { width: 25, height: 25, borderRadius: 7 },
  logoFallback: { width: 25, height: 25, borderRadius: 7, backgroundColor: '#1B2B21', alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: '#172017', fontSize: 10.5, fontWeight: '900' },
  secondary: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#36433B', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: '#B8C2BC', fontSize: 9.5, fontWeight: '900' },
  error: { color: '#FF9D93', fontSize: 10, lineHeight: 15 },
});
