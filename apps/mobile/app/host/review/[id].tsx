import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, type HostOuting } from '../../../src/hosting/api';
import { listHostTicketTypes, type HostTicketType } from '../../../src/hosting/tickets';
import { getActiveOrganization, type OrganizationWorkspace } from '../../../src/platform/organizations';

function scheduleLabel(event: HostOuting) {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  return `${start.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} to ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void Promise.all([getHostOutingById(id), listHostTicketTypes(id), getActiveOrganization()])
      .then(([nextEvent, nextTickets, nextOrganization]) => {
        setEvent(nextEvent);
        setTickets(nextTickets);
        setOrganization(nextOrganization);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load this event draft.'))
      .finally(() => setLoading(false));
  }, [id]);

  const checks = useMemo(() => {
    if (!event) return [];
    return [
      { label: 'Event details', ok: Boolean(event.title && event.summary && event.description) },
      { label: 'Schedule', ok: Boolean(event.starts_at && event.ends_at) },
      { label: 'Location', ok: event.location_type === 'tbd' || event.location_type === 'online' ? Boolean(event.location_type === 'tbd' || event.online_url) : Boolean(event.city && event.state) },
      { label: 'Access', ok: Boolean(event.visibility) },
      { label: 'Admission', ok: tickets.some((ticket) => ticket.is_active) },
    ];
  }, [event, tickets]);
  const readyCount = checks.filter((item) => item.ok).length;

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Reviewing event draft…</Text></SafeAreaView>;
  if (!event) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Event draft unavailable.'}</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.replace('/host/events' as never)}><Text style={styles.back}>‹ Events</Text></Pressable>
        <Text style={styles.eyebrow}>DRAFT CREATED</Text>
        <Text style={styles.title}>Review the basics</Text>
        <Text style={styles.subtitle}>Check the attendee-facing details before you move into tickets, tasks, vendors, communications, finance, and promotion.</Text>

        {warning ? <View style={styles.warning}><Text style={styles.warningTitle}>Some setup still needs attention</Text><Text style={styles.warningText}>{decodeURIComponent(String(warning))}</Text></View> : null}

        <ImageBackground source={event.hero_image_url ? { uri: event.hero_image_url } : undefined} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroPill}><Text style={styles.heroPillText}>{event.category}</Text></View>
          <View><Text style={styles.heroTitle}>{event.title}</Text><Text style={styles.heroMeta}>{scheduleLabel(event)} · {admissionLabel(tickets)}</Text></View>
        </ImageBackground>

        <View style={styles.readinessCard}>
          <View style={styles.readinessTop}><View><Text style={styles.readinessLabel}>EVENT BASICS</Text><Text style={styles.readinessTitle}>{readyCount} of {checks.length} ready</Text></View><Text style={styles.readinessPercent}>{Math.round((readyCount / Math.max(checks.length, 1)) * 100)}%</Text></View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.round((readyCount / Math.max(checks.length, 1)) * 100)}%` }]} /></View>
          <View style={styles.checks}>{checks.map((item) => <View key={item.label} style={styles.checkRow}><Text style={[styles.checkIcon, item.ok ? styles.checkOk : styles.checkMissing]}>{item.ok ? '✓' : '!'}</Text><Text style={styles.checkText}>{item.label}</Text></View>)}</View>
        </View>

        <Text style={styles.sectionLabel}>EVENT SUMMARY</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label="Date & time" value={scheduleLabel(event)} />
          <SummaryRow label="Location" value={locationLabel(event)} />
          <SummaryRow label="Access" value={event.visibility.charAt(0).toUpperCase() + event.visibility.slice(1)} />
          <SummaryRow label="Admission" value={admissionLabel(tickets)} />
          <SummaryRow label="Capacity" value={event.capacity == null ? 'No limit' : `${event.capacity} attendees`} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Organizer</Text>
            <View style={styles.organizerValue}>{organization?.logoUrl ? <Image source={{ uri: organization.logoUrl }} style={styles.logo} /> : <View style={styles.logoFallback}><Text style={styles.logoFallbackText}>{(organization?.name ?? 'O').charAt(0)}</Text></View>}<Text style={styles.summaryValue}>{organization?.name ?? 'Current organization'}</Text></View>
          </View>
        </View>

        <Pressable style={styles.editButton} onPress={() => router.push(`/host/edit/${event.id}` as never)}><Text style={styles.editButtonText}>Edit Event Details</Text></Pressable>

        <Text style={styles.sectionLabel}>NEXT IN THE WORKSPACE</Text>
        <View style={styles.nextGrid}>
          {['Tickets & registration', 'Tasks & team', 'Vendors & staffing', 'Communications', 'Finance', 'Marketing'].map((item) => <View key={item} style={styles.nextCard}><Text style={styles.nextCheck}>○</Text><Text style={styles.nextText}>{item}</Text></View>)}
        </View>

        <Pressable style={styles.primary} onPress={() => router.replace(`/host/build/${event.id}` as never)}><Text style={styles.primaryText}>Continue to Event Builder</Text></Pressable>
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
  readinessCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#3D472F', backgroundColor: '#171B12', padding: 13 },
  readinessTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  readinessLabel: { color: '#8A968E', fontSize: 7.5, fontWeight: '900', letterSpacing: .9 },
  readinessTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', marginTop: 3 },
  readinessPercent: { color: '#D7B45A', fontSize: 17, fontWeight: '900' },
  track: { height: 4, borderRadius: 3, backgroundColor: '#2B3224', overflow: 'hidden', marginTop: 10 },
  fill: { height: 4, backgroundColor: '#D7B45A' },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  checkRow: { minHeight: 30, borderRadius: 9, backgroundColor: '#11170F', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkIcon: { fontSize: 9, fontWeight: '900' },
  checkOk: { color: '#8FD09E' },
  checkMissing: { color: '#E7A05C' },
  checkText: { color: '#AAB4AE', fontSize: 8.5, fontWeight: '800' },
  sectionLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
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
  nextGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nextCard: { width: '48.7%', minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#2E3932', backgroundColor: '#121914', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10 },
  nextCheck: { color: '#6E7B73', fontSize: 13 },
  nextText: { flex: 1, color: '#AAB4AE', fontSize: 9, fontWeight: '800' },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  secondary: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  secondaryText: { color: '#C8D1CB', fontSize: 10, fontWeight: '900' },
  error: { color: '#FFAAA0', fontSize: 10, lineHeight: 15 },
});
