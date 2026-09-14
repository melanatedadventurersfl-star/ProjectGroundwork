import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, type HostOuting } from '../../../src/hosting/api';
import { getCampaignForAdventure, listEventComponents } from '../../../src/hosting/eventBuilder';
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

type ReadinessGroup = {
  title: string;
  ready: number;
  total: number;
  detail: string;
};

type FixItem = {
  key: string;
  title: string;
  copy: string;
  action: string;
  onPress: () => void;
};

export default function ReviewEventDraftScreen() {
  const { id, warning } = useLocalSearchParams<{ id: string; warning?: string }>();
  const [event, setEvent] = useState<HostOuting | null>(null);
  const [tickets, setTickets] = useState<HostTicketType[]>([]);
  const [organization, setOrganization] = useState<OrganizationWorkspace | null>(null);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [nextEvent, nextTickets, organizations, campaign] = await Promise.all([
          getHostOutingById(id),
          listHostTicketTypes(id),
          listMyOrganizations(),
          getCampaignForAdventure(id).catch(() => null),
        ]);
        const owningOrganization = organizations.find((item) => item.id === nextEvent.platform_organization_id)
          ?? organizations.find((item) => item.isActive)
          ?? organizations[0]
          ?? null;
        const nextComponents = campaign ? await listEventComponents(campaign.id).catch(() => []) : [];
        setEvent(nextEvent);
        setTickets(nextTickets);
        setOrganization(owningOrganization);
        setComponents(nextComponents as ComponentRow[]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load this event draft.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const readiness = useMemo<ReadinessGroup[]>(() => {
    if (!event) return [];
    const coreChecks = [
      Boolean(event.title && event.summary),
      Boolean(event.starts_at && event.ends_at),
      event.location_type === 'tbd'
        || (event.location_type === 'online' ? Boolean(event.online_url) : Boolean(event.venue_name && event.city && event.state)),
      Boolean(event.visibility),
    ];
    const eventCapacity = event.capacity;
    const registrationChecks = [
      tickets.some((ticket) => ticket.is_active),
      eventCapacity == null || tickets.some((ticket) => ticket.is_active && (ticket.capacity == null || ticket.capacity <= eventCapacity)),
    ];
    const added = new Set(components.filter((item) => item.status !== 'disabled').map((item) => item.component_key));
    const operationsChecks = [added.has('team'), added.has('finance'), added.has('schedule') || added.has('venue')];
    const communicationsChecks = [added.has('communications'), added.has('pages')];
    return [
      { title: 'Core details', ready: coreChecks.filter(Boolean).length, total: coreChecks.length, detail: 'Event identity, schedule, location, and access' },
      { title: 'Registration', ready: registrationChecks.filter(Boolean).length, total: registrationChecks.length, detail: 'Ticketing and capacity alignment' },
      { title: 'Operations', ready: operationsChecks.filter(Boolean).length, total: operationsChecks.length, detail: 'Team, finance, venue, and schedule setup' },
      { title: 'Communications', ready: communicationsChecks.filter(Boolean).length, total: communicationsChecks.length, detail: 'Attendee messages and public information' },
    ];
  }, [components, event, tickets]);

  const fixItems = useMemo<FixItem[]>(() => {
    if (!event) return [];
    const items: FixItem[] = [];
    if (!event.hero_image_url) items.push({ key: 'cover', title: 'Add an event cover', copy: 'Give the attendee page a strong visual before publishing.', action: 'Add cover', onPress: () => router.push(`/host/edit/${event.id}` as never) });
    if (event.location_type !== 'tbd' && event.location_type !== 'online' && (!event.venue_name || !event.city || !event.state)) items.push({ key: 'location', title: 'Finish the venue', copy: 'Venue name, city, and state should all be confirmed.', action: 'Fix location', onPress: () => router.push(`/host/edit/${event.id}` as never) });
    if (event.location_type === 'online' && !event.online_url) items.push({ key: 'online', title: 'Add the event link', copy: 'Attendees need the online meeting or streaming destination.', action: 'Add link', onPress: () => router.push(`/host/edit/${event.id}` as never) });
    if (!tickets.some((ticket) => ticket.is_active)) items.push({ key: 'tickets', title: 'Configure admission', copy: 'Add at least one active ticket type before publishing.', action: 'Open ticketing', onPress: () => router.push(`/host/build/${event.id}` as never) });
    if (!components.some((item) => item.component_key === 'communications' && item.status !== 'disabled')) items.push({ key: 'communications', title: 'Set attendee communications', copy: 'Prepare confirmations and event reminders before registrations arrive.', action: 'Open workspace', onPress: () => router.push(`/host/manage/${event.id}` as never) });
    return items;
  }, [components, event, tickets]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Preparing event setup…</Text></SafeAreaView>;
  if (!event) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Event draft unavailable.'}</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.back}>‹ Events</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT CREATED</Text>
        <Text style={styles.title}>Finish the setup</Text>
        <Text style={styles.subtitle}>The core event now exists. Use this screen to see what is ready and what still needs attention before publishing.</Text>

        {warning ? <View style={styles.warning}><Text style={styles.warningTitle}>Some setup needs attention</Text><Text style={styles.warningText}>{decodeURIComponent(String(warning))}</Text></View> : null}

        <ImageBackground source={event.hero_image_url ? { uri: event.hero_image_url } : undefined} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroPill}><Text style={styles.heroPillText}>{event.category}</Text></View>
          <View><Text style={styles.heroTitle}>{event.title}</Text><Text style={styles.heroMeta}>{scheduleLabel(event)} · {admissionLabel(tickets)}</Text></View>
        </ImageBackground>

        <Text style={styles.sectionLabel}>READINESS</Text>
        <View style={styles.readinessGrid}>
          {readiness.map((group) => {
            const complete = group.ready === group.total;
            return (
              <View key={group.title} style={styles.readinessCard}>
                <View style={styles.readinessTop}><Text style={styles.readinessTitle}>{group.title}</Text><Text style={[styles.readinessCount, complete && styles.readinessComplete]}>{group.ready}/{group.total}</Text></View>
                <Text style={styles.readinessDetail}>{group.detail}</Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.round((group.ready / Math.max(group.total, 1)) * 100)}%` }]} /></View>
              </View>
            );
          })}
        </View>

        {fixItems.length ? (
          <>
            <Text style={styles.sectionLabel}>NEEDS ATTENTION</Text>
            <View style={styles.fixList}>
              {fixItems.map((item) => <Pressable key={item.key} style={styles.fixCard} onPress={item.onPress}><View style={styles.fixIcon}><Text style={styles.fixIconText}>!</Text></View><View style={styles.fixCopy}><Text style={styles.fixTitle}>{item.title}</Text><Text style={styles.fixText}>{item.copy}</Text></View><Text style={styles.fixAction}>{item.action} ›</Text></Pressable>)}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>EVENT SUMMARY</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label="Date & time" value={scheduleLabel(event)} />
          <SummaryRow label="Location" value={locationLabel(event)} />
          <SummaryRow label="Access" value={event.visibility.charAt(0).toUpperCase() + event.visibility.slice(1)} />
          <SummaryRow label="Admission" value={admissionLabel(tickets)} />
          <SummaryRow label="Capacity" value={event.capacity == null ? 'No limit' : `${event.capacity} attendees`} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Organizer</Text>
            <View style={styles.organizerValue}>{organization?.logoUrl ? <Image source={{ uri: organization.logoUrl }} style={styles.logo} /> : <View style={styles.logoFallback}><Text style={styles.logoFallbackText}>{(organization?.name ?? 'O').charAt(0)}</Text></View>}<Text style={styles.summaryValue}>{organization?.name ?? 'Event organization'}</Text></View>
          </View>
        </View>

        <Pressable style={styles.editButton} onPress={() => router.push(`/host/edit/${event.id}` as never)}><Text style={styles.editButtonText}>Edit Event Details</Text></Pressable>
        <Pressable style={styles.primary} onPress={() => router.replace(`/host/build/${event.id}` as never)}><Text style={styles.primaryText}>Continue Event Setup</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace(`/host/manage/${event.id}` as never)}><Text style={styles.secondaryText}>Open Event Workspace</Text></Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  sectionLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  readinessGrid: { gap: 8 },
  readinessCard: { borderRadius: 14, borderWidth: 1, borderColor: '#303B34', backgroundColor: '#121914', padding: 11 },
  readinessTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  readinessTitle: { color: '#E9EEEB', fontSize: 11, fontWeight: '900' },
  readinessCount: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900' },
  readinessComplete: { color: '#8FD09E' },
  readinessDetail: { color: '#748078', fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  track: { height: 3, borderRadius: 3, backgroundColor: '#283129', overflow: 'hidden', marginTop: 8 },
  fill: { height: 3, backgroundColor: '#D7B45A' },
  fixList: { gap: 7 },
  fixCard: { minHeight: 62, borderRadius: 13, borderWidth: 1, borderColor: '#4C4029', backgroundColor: '#19170F', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  fixIcon: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#302616', alignItems: 'center', justifyContent: 'center' },
  fixIconText: { color: '#E7C464', fontSize: 11, fontWeight: '900' },
  fixCopy: { flex: 1 },
  fixTitle: { color: '#E8E3D4', fontSize: 10, fontWeight: '900' },
  fixText: { color: '#8D897A', fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  fixAction: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900' },
  summaryCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#131B16', overflow: 'hidden' },
  summaryRow: { minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A352F', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  summaryLabel: { color: '#748078', fontSize: 8, fontWeight: '900' },
  summaryValue: { color: '#E7ECE9', fontSize: 10.5, lineHeight: 15, fontWeight: '800', marginTop: 3 },
  organizerValue: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  logo: { width: 28, height: 28, borderRadius: 8 },
  logoFallback: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#1D2C22', alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  editButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#3B4840', backgroundColor: '#111814', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  editButtonText: { color: '#D8E0DA', fontSize: 10, fontWeight: '900' },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  secondary: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  secondaryText: { color: '#C8D1CB', fontSize: 10, fontWeight: '900' },
  error: { color: '#FFAAA0', fontSize: 10, lineHeight: 15 },
});
