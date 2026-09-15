import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, type HostOuting } from '../../../src/hosting/api';
import { createCampaignWorkspace } from '../../../src/hosting/creation';
import { addEventComponent, getCampaignForAdventure, listEventComponents } from '../../../src/hosting/eventBuilder';
import { recommendedEventComponents } from '../../../src/hosting/eventBuilderTemplates';
import { listHostTicketTypes, type HostTicketType } from '../../../src/hosting/tickets';
import { listMyOrganizations, type OrganizationWorkspace } from '../../../src/platform/organizations';

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

type ComponentRow = { component_key: string; status: string };
type CheckItem = { key: string; label: string; done: boolean; status: string; onPress?: () => void };
type ReadinessGroup = { title: string; detail: string; items: CheckItem[] };
type FixItem = { key: string; title: string; copy: string; action: string; onPress: () => void };

export default function ReviewEventDraftScreen() {
  const { id, warning } = useLocalSearchParams<{ id: string; warning?: string }>();
  const [event, setEvent] = useState<HostOuting | null>(null);
  const [tickets, setTickets] = useState<HostTicketType[]>([]);
  const [organization, setOrganization] = useState<OrganizationWorkspace | null>(null);
  const [components, setComponents] = useState<ComponentRow[]>([]);
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

      setEvent(nextEvent);
      setTickets(nextTickets);
      setOrganization(owningOrganization);
      setComponents(nextComponents as ComponentRow[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this event draft.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const readiness = useMemo<ReadinessGroup[]>(() => {
    if (!event) return [];
    const added = new Set(components.filter((item) => item.status !== 'disabled').map((item) => item.component_key));
    const activeTickets = tickets.filter((ticket) => ticket.is_active);
    const capacityAligned = event.capacity == null || activeTickets.some((ticket) => ticket.capacity == null || ticket.capacity <= event.capacity!);
    const locationReady = event.location_type === 'tbd'
      || (event.location_type === 'online' ? Boolean(event.online_url) : Boolean(event.venue_name && event.city && event.state));
    const edit = () => router.push(`/host/edit/${event.id}` as never);
    const build = (focus: string) => () => router.push(`/host/build/${event.id}?focus=${focus}` as never);

    return [
      {
        title: 'Core details',
        detail: 'The attendee-facing facts that define the event.',
        items: [
          { key: 'identity', label: 'Event name & description', done: Boolean(event.title && event.summary), status: event.title && event.summary ? 'Ready' : 'Needs details', onPress: edit },
          { key: 'schedule', label: 'Date & time', done: Boolean(event.starts_at && event.ends_at), status: event.starts_at && event.ends_at ? 'Ready' : 'Needs schedule', onPress: edit },
          { key: 'location', label: 'Location', done: locationReady, status: locationReady ? 'Ready' : 'Needs location', onPress: edit },
          { key: 'access', label: 'Access', done: Boolean(event.visibility), status: event.visibility ? event.visibility.charAt(0).toUpperCase() + event.visibility.slice(1) : 'Needs access' },
        ],
      },
      {
        title: 'Registration',
        detail: 'Admission and capacity setup for attendees.',
        items: [
          { key: 'ticket', label: 'Active admission', done: activeTickets.length > 0, status: activeTickets.length ? `${activeTickets.length} active` : 'Not set up', onPress: build('tickets') },
          { key: 'capacity', label: 'Capacity alignment', done: capacityAligned && activeTickets.length > 0, status: capacityAligned && activeTickets.length ? 'Aligned' : 'Review capacity', onPress: build('tickets') },
        ],
      },
      {
        title: 'Operations',
        detail: 'These counts show which operating areas are connected to the event.',
        items: [
          { key: 'team', label: 'Team', done: added.has('team'), status: added.has('team') ? 'Added' : 'Not set up', onPress: build('team') },
          { key: 'finance', label: 'Finance', done: added.has('finance'), status: added.has('finance') ? 'Added' : 'Not set up', onPress: build('finance') },
          { key: 'venue-schedule', label: 'Venue or schedule', done: added.has('schedule') || added.has('venue'), status: added.has('schedule') || added.has('venue') ? 'Added' : 'Not set up', onPress: build(added.has('venue') ? 'venue' : 'schedule') },
        ],
      },
      {
        title: 'Communications',
        detail: 'Attendee messaging and public event information.',
        items: [
          { key: 'communications', label: 'Attendee communications', done: added.has('communications'), status: added.has('communications') ? 'Schedule added' : 'Not set up', onPress: () => router.push(`/host/event-communications/${event.id}` as never) },
          { key: 'pages', label: 'Event pages', done: added.has('pages'), status: added.has('pages') ? 'Added' : 'Not set up', onPress: build('pages') },
        ],
      },
    ];
  }, [components, event, tickets]);

  const fixItems = useMemo<FixItem[]>(() => {
    if (!event) return [];
    const items: FixItem[] = [];
    const added = new Set(components.filter((item) => item.status !== 'disabled').map((item) => item.component_key));
    if (!event.hero_image_url) items.push({ key: 'cover', title: 'Add an event cover', copy: 'Add the image attendees will see on the event page.', action: 'Add cover', onPress: () => router.push(`/host/edit/${event.id}?focus=cover` as never) });
    if (event.location_type !== 'tbd' && event.location_type !== 'online' && (!event.venue_name || !event.city || !event.state)) items.push({ key: 'location', title: 'Finish the venue', copy: 'Confirm the venue and its location.', action: 'Fix location', onPress: () => router.push(`/host/edit/${event.id}` as never) });
    if (event.location_type === 'online' && !event.online_url) items.push({ key: 'online', title: 'Add the event link', copy: 'Attendees need the online destination.', action: 'Add link', onPress: () => router.push(`/host/edit/${event.id}` as never) });
    if (!tickets.some((ticket) => ticket.is_active)) items.push({ key: 'tickets', title: 'Configure admission', copy: 'Add at least one active admission option.', action: 'Set up tickets', onPress: () => router.push(`/host/build/${event.id}?focus=tickets` as never) });
    if (!added.has('communications')) items.push({ key: 'communications', title: 'Set attendee communications', copy: 'Create confirmations and reminder messages for this event.', action: 'Set messages', onPress: () => router.push(`/host/event-communications/${event.id}` as never) });
    return items;
  }, [components, event, tickets]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Preparing event setup…</Text></SafeAreaView>;
  if (!event) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Event draft unavailable.'}</Text><Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.back}>Back to events</Text></Pressable></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.back}>‹ Events</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT CREATED</Text>
        <Text style={styles.title}>Finish the setup</Text>
        <Text style={styles.subtitle}>Each count below now shows the exact items behind it. Tap any row to work on that part of the event.</Text>

        {warning ? <View style={styles.warning}><Text style={styles.warningTitle}>Some setup needs attention</Text><Text style={styles.warningText}>{decodeURIComponent(String(warning))}</Text></View> : null}
        {error ? <View style={styles.warning}><Text style={styles.warningTitle}>Workspace setup needs attention</Text><Text style={styles.warningText}>{error}</Text></View> : null}

        <ImageBackground source={event.hero_image_url ? { uri: event.hero_image_url } : undefined} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroPill}><Text style={styles.heroPillText}>{event.category}</Text></View>
          <View><Text style={styles.heroTitle}>{event.title}</Text><Text style={styles.heroMeta}>{scheduleLabel(event)} · {admissionLabel(tickets)}</Text></View>
        </ImageBackground>

        <Text style={styles.sectionLabel}>SETUP CHECKLIST</Text>
        <Text style={styles.sectionHelp}>Operations and Communications counts show setup areas connected to this event. Open each row to finish the work inside it.</Text>
        <View style={styles.readinessGrid}>
          {readiness.map((group) => {
            const ready = group.items.filter((item) => item.done).length;
            const complete = ready === group.items.length;
            return <View key={group.title} style={styles.readinessCard}>
              <View style={styles.readinessTop}><View style={styles.flex}><Text style={styles.readinessTitle}>{group.title}</Text><Text style={styles.readinessDetail}>{group.detail}</Text></View><Text style={[styles.readinessCount, complete && styles.readinessComplete]}>{ready}/{group.items.length}</Text></View>
              <View style={styles.track}><View style={[styles.fill, { width: `${Math.round((ready / Math.max(group.items.length, 1)) * 100)}%` }]} /></View>
              <View style={styles.checkList}>{group.items.map((item) => <Pressable key={item.key} disabled={!item.onPress} style={styles.checkRow} onPress={item.onPress}>
                <View style={[styles.checkMark, item.done && styles.checkMarkDone]}><Text style={styles.checkMarkText}>{item.done ? '✓' : '○'}</Text></View>
                <Text style={styles.checkLabel}>{item.label}</Text>
                <Text style={[styles.checkStatus, item.done && styles.checkStatusDone]}>{item.status}{item.onPress ? ' ›' : ''}</Text>
              </Pressable>)}</View>
            </View>;
          })}
        </View>

        {fixItems.length ? <><Text style={styles.sectionLabel}>NEEDS ATTENTION</Text><View style={styles.fixList}>{fixItems.map((item) => <Pressable key={item.key} style={styles.fixCard} onPress={item.onPress}><View style={styles.fixIcon}><Text style={styles.fixIconText}>!</Text></View><View style={styles.fixCopy}><Text style={styles.fixTitle}>{item.title}</Text><Text style={styles.fixText}>{item.copy}</Text></View><Text style={styles.fixAction}>{item.action} ›</Text></Pressable>)}</View></> : null}

        <Text style={styles.sectionLabel}>EVENT SUMMARY</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label="Date & time" value={scheduleLabel(event)} />
          <SummaryRow label="Location" value={locationLabel(event)} />
          <SummaryRow label="Access" value={event.visibility.charAt(0).toUpperCase() + event.visibility.slice(1)} />
          <SummaryRow label="Admission" value={admissionLabel(tickets)} />
          <SummaryRow label="Capacity" value={event.capacity == null ? 'No limit' : `${event.capacity} attendees`} />
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Organizer</Text><View style={styles.organizerValue}>{organization?.logoUrl ? <Image source={{ uri: organization.logoUrl }} style={styles.logo} /> : <View style={styles.logoFallback}><Text style={styles.logoFallbackText}>{(organization?.name ?? 'O').charAt(0)}</Text></View>}<Text style={styles.summaryValue}>{organization?.name ?? 'Event organization'}</Text></View></View>
        </View>

        <Pressable style={styles.editButton} onPress={() => router.push(`/host/edit/${event.id}` as never)}><Text style={styles.editButtonText}>Edit Event Details</Text></Pressable>
        <Pressable style={styles.primary} onPress={() => router.replace(`/host/build/${event.id}` as never)}><Text style={styles.primaryText}>Continue Event Setup</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace(`/host/manage/${event.id}` as never)}><Text style={styles.secondaryText}>Open Event Workspace</Text></Pressable>
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
  title: { color: '#FFF8E8', fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#8D9A91', fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  warning: { marginTop: 14, borderRadius: 13, borderWidth: 1, borderColor: '#6B552A', backgroundColor: '#251F12', padding: 12 },
  warningTitle: { color: '#ECD58A', fontSize: 10.5, fontWeight: '900' },
  warningText: { color: '#C7B474', fontSize: 9.5, lineHeight: 15, marginTop: 4 },
  hero: { minHeight: 220, borderRadius: 20, overflow: 'hidden', padding: 14, justifyContent: 'space-between', backgroundColor: '#1A2820', marginTop: 15 },
  heroImage: { borderRadius: 20, resizeMode: 'cover' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,11,8,.48)' },
  heroPill: { alignSelf: 'flex-start', borderRadius: 99, backgroundColor: 'rgba(9,14,11,.75)', paddingHorizontal: 9, paddingVertical: 6 },
  heroPillText: { color: '#E7C464', fontSize: 8, fontWeight: '900' },
  heroTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  heroMeta: { color: '#D1D9D3', fontSize: 9, marginTop: 5 },
  sectionLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 6 },
  sectionHelp: { color: '#748078', fontSize: 8.8, lineHeight: 13, marginBottom: 8 },
  readinessGrid: { gap: 8 },
  readinessCard: { borderRadius: 14, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', padding: 11 },
  readinessTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  readinessTitle: { color: '#E9EEEB', fontSize: 11, fontWeight: '900' },
  readinessCount: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900' },
  readinessComplete: { color: '#8FD09E' },
  readinessDetail: { color: '#748078', fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  track: { height: 3, borderRadius: 3, backgroundColor: '#283129', overflow: 'hidden', marginTop: 8 },
  fill: { height: 3, backgroundColor: '#D7B45A' },
  checkList: { marginTop: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A352F' },
  checkRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#253029' },
  checkMark: { width: 19, height: 19, borderRadius: 10, borderWidth: 1, borderColor: '#59645E', alignItems: 'center', justifyContent: 'center' },
  checkMarkDone: { borderColor: '#568167', backgroundColor: '#17301F' },
  checkMarkText: { color: '#9ED3AB', fontSize: 8, fontWeight: '900' },
  checkLabel: { flex: 1, color: '#CBD3CE', fontSize: 9.5, fontWeight: '800' },
  checkStatus: { color: '#D7B45A', fontSize: 8.5, fontWeight: '800' },
  checkStatusDone: { color: '#8EA99A' },
  fixList: { gap: 7 },
  fixCard: { minHeight: 62, borderRadius: 13, borderWidth: 1, borderColor: '#4C4029', backgroundColor: '#19170F', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  fixIcon: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#3C3017', alignItems: 'center', justifyContent: 'center' },
  fixIconText: { color: '#E7C464', fontSize: 11, fontWeight: '900' },
  fixCopy: { flex: 1 },
  fixTitle: { color: '#EEE8D8', fontSize: 10.5, fontWeight: '900' },
  fixText: { color: '#8C8675', fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  fixAction: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900' },
  summaryCard: { borderRadius: 14, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', paddingHorizontal: 11 },
  summaryRow: { minHeight: 45, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: '#78857D', fontSize: 9 },
  summaryValue: { color: '#DCE3DE', fontSize: 9.5, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  organizerValue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, flex: 1 },
  logo: { width: 25, height: 25, borderRadius: 7 },
  logoFallback: { width: 25, height: 25, borderRadius: 7, backgroundColor: '#1B2B21', alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  editButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  editButtonText: { color: '#D7DDD9', fontSize: 10, fontWeight: '900' },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { color: '#172017', fontSize: 10.5, fontWeight: '900' },
  secondary: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#4A442D', backgroundColor: '#171810', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  error: { color: '#FF9A8F', fontSize: 10, lineHeight: 15, textAlign: 'center' },
});