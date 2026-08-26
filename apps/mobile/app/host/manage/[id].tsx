import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkInCredential, getHostOutingMetrics, listHostAttendees, listMyHostOutings, publishHostOuting, transitionHostOuting, type HostOuting } from '../../../src/hosting/api';
import { listHostAddons } from '../../../src/hosting/addons';
import { listHostTicketTypes } from '../../../src/hosting/tickets';

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function answersSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, answer]) => answer != null && String(answer).trim());
  if (entries.length === 0) return null;
  return entries.slice(0, 3).map(([question, answer]) => `${question}: ${String(answer)}`).join(' · ');
}

export default function ManageHostOutingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [outing, setOuting] = useState<HostOuting | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ orders: 0, grossCents: 0 });
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [outings, ticketRows, addonRows, attendeeRows, nextMetrics] = await Promise.all([
        listMyHostOutings(),
        listHostTicketTypes(id),
        listHostAddons(id),
        listHostAttendees(id),
        getHostOutingMetrics(id),
      ]);
      setOuting(outings.find((item) => item.id === id) ?? null);
      setTickets(ticketRows);
      setAddons(addonRows);
      setOrders(attendeeRows);
      setMetrics(nextMetrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this outing.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const attendees = useMemo(() => orders.flatMap((order) => order.order_attendees ?? []), [orders]);
  const checkedIn = attendees.filter((attendee) => firstRelation(attendee.ticket_credentials)?.checked_in_at).length;
  const isClosed = outing?.status === 'cancelled' || outing?.status === 'completed';

  async function publish() {
    if (!id) return;
    setWorking(true);
    try {
      await publishHostOuting(id);
      await refresh();
      Alert.alert('Outing published', 'Your outing is now available through Go Melanated discovery.');
    } catch (caught) {
      Alert.alert('Unable to publish', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  }

  async function shareOuting() {
    if (!outing) return;
    await Share.share({
      message: `${outing.title} · ${new Date(outing.starts_at).toLocaleDateString()} · ${outing.city}, ${outing.state}\nFind it in Go Melanated.`,
      title: outing.title,
    });
  }

  async function manualCheckIn() {
    setWorking(true);
    try {
      await checkInCredential(credential);
      setCredential('');
      await refresh();
      Alert.alert('Checked in', 'The attendee is marked present.');
    } catch (caught) {
      Alert.alert('Check-in failed', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  }

  function confirmCancel() {
    if (!id) return;
    Alert.alert(
      'Cancel this outing?',
      'Registrations will remain in the system. This version does not automatically issue refunds, so paid orders must be handled through the payments workflow.',
      [
        { text: 'Keep Outing', style: 'cancel' },
        {
          text: 'Cancel Outing',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setWorking(true);
              try {
                await transitionHostOuting(id, 'cancelled');
                await refresh();
              } catch (caught) {
                Alert.alert('Unable to cancel', caught instanceof Error ? caught.message : 'Please try again.');
              } finally { setWorking(false); }
            })();
          },
        },
      ],
    );
  }

  function confirmComplete() {
    if (!id) return;
    Alert.alert(
      'Mark outing complete?',
      'Attendance will be preserved and this outing will move into your host history.',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Complete Outing',
          onPress: () => {
            void (async () => {
              setWorking(true);
              try {
                await transitionHostOuting(id, 'completed');
                await refresh();
              } catch (caught) {
                Alert.alert('Unable to complete', caught instanceof Error ? caught.message : 'Please try again.');
              } finally { setWorking(false); }
            })();
          },
        },
      ],
    );
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  if (!outing) {
    return <SafeAreaView style={styles.center}><Text style={styles.error}>This outing is not available in your Host Hub.</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></SafeAreaView>;
  }

  const canComplete = outing.status === 'published' || outing.status === 'sold_out';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host dashboard</Text></Pressable>
        <Text style={styles.eyebrow}>{outing.status.toUpperCase()}</Text>
        <Text style={styles.title}>{outing.title}</Text>
        <Text style={styles.subtitle}>{new Date(outing.starts_at).toLocaleString()} · {outing.city}, {outing.state}</Text>

        <View style={styles.metrics}>
          <Metric value={String(attendees.length)} label="Attendees" />
          <Metric value={String(checkedIn)} label="Checked in" />
          <Metric value={`$${(metrics.grossCents / 100).toFixed(0)}`} label="Gross" />
        </View>

        <View style={styles.toolsRow}>
          <Pressable style={styles.toolCard} onPress={() => router.push(`/host/edit/${outing.id}` as never)}>
            <Text style={styles.toolTitle}>Edit Details</Text><Text style={styles.toolMeta}>{isClosed ? 'View archived details' : 'Schedule, venue, capacity'}</Text>
          </Pressable>
          <Pressable disabled={isClosed} style={[styles.toolCard, isClosed && styles.disabled]} onPress={() => router.push(`/host/inventory/${outing.id}` as never)}>
            <Text style={styles.toolTitle}>Tickets & Extras</Text><Text style={styles.toolMeta}>{tickets.length} tickets · {addons.length} add-ons</Text>
          </Pressable>
        </View>

        {outing.status === 'draft' || outing.status === 'scheduled' ? (
          <View style={styles.launchCard}>
            <Text style={styles.cardEyebrow}>READY TO LAUNCH?</Text>
            <Text style={styles.cardTitle}>Publish when the details and ticket are ready.</Text>
            <Text style={styles.body}>Publishing makes the outing discoverable. Paid outings require paid-host permission before this action succeeds.</Text>
            <Pressable disabled={working} style={styles.primary} onPress={() => void publish()}><Text style={styles.primaryText}>{working ? 'Working…' : 'Publish Outing'}</Text></Pressable>
          </View>
        ) : outing.status === 'published' || outing.status === 'sold_out' ? (
          <Pressable style={styles.shareButton} onPress={() => void shareOuting()}><Text style={styles.shareText}>Promote / Share Outing</Text></Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>Admission</Text>
        {tickets.length === 0 ? <Text style={styles.empty}>No ticket types yet.</Text> : tickets.map((ticket) => (
          <View key={ticket.id} style={styles.card}>
            <View style={{ flex: 1 }}><Text style={styles.cardTitleSmall}>{ticket.name}</Text><Text style={styles.cardMeta}>{ticket.capacity ? `${ticket.capacity} capacity` : 'No ticket cap'} · {ticket.is_active ? 'Active' : 'Off'}</Text></View>
            <Text style={styles.price}>{ticket.price_cents === 0 ? 'FREE' : `$${(ticket.price_cents / 100).toFixed(2)}`}</Text>
          </View>
        ))}

        {!isClosed ? <>
          <Text style={styles.sectionTitle}>Check-in</Text>
          <View style={styles.checkinCard}>
            <Text style={styles.cardTitleSmall}>Enter a ticket credential</Text>
            <Text style={styles.cardMeta}>The database verifies that the credential belongs to one of your outings before marking attendance.</Text>
            <TextInput value={credential} onChangeText={setCredential} autoCapitalize="none" placeholder="Credential code" placeholderTextColor="#69756D" style={styles.input} />
            <Pressable disabled={working || !credential.trim()} style={[styles.secondary, (!credential.trim() || working) && styles.disabled]} onPress={() => void manualCheckIn()}><Text style={styles.secondaryText}>Check In Attendee</Text></Pressable>
          </View>
        </> : null}

        <Text style={styles.sectionTitle}>Attendees</Text>
        {attendees.length === 0 ? <Text style={styles.empty}>Registrations will appear here.</Text> : attendees.map((attendee) => {
          const credentialRow = firstRelation<any>(attendee.ticket_credentials);
          const ticketRow = firstRelation<any>(attendee.ticket_types);
          const answers = answersSummary(attendee.registration_answers);
          return (
            <View key={attendee.id} style={styles.attendeeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitleSmall}>{attendee.first_name} {attendee.last_name}</Text>
                <Text style={styles.cardMeta}>{ticketRow?.name || 'Admission'}{attendee.email ? ` · ${attendee.email}` : ''}</Text>
                {answers ? <Text style={styles.answers}>{answers}</Text> : null}
              </View>
              <Text style={credentialRow?.checked_in_at ? styles.good : styles.muted}>{credentialRow?.checked_in_at ? 'PRESENT' : 'EXPECTED'}</Text>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Lifecycle</Text>
        <View style={styles.lifecycle}>
          <Lifecycle label="Before" text="Promote, prepare, confirm details, and watch registrations." />
          <Lifecycle label="During" text="Check in attendees and run the outing." />
          <Lifecycle label="After" text="Close the outing so attendance can feed memories, reputation, and Your Trail." />
        </View>

        {!isClosed ? <View style={styles.closeSection}>
          {canComplete ? <Pressable disabled={working} style={styles.completeButton} onPress={confirmComplete}><Text style={styles.completeText}>Mark Outing Complete</Text></Pressable> : null}
          <Pressable disabled={working} style={styles.cancelButton} onPress={confirmCancel}><Text style={styles.cancelText}>Cancel Outing</Text></Pressable>
        </View> : <View style={styles.closedCard}><Text style={styles.closedTitle}>{outing.status === 'completed' ? 'Outing complete' : 'Outing cancelled'}</Text><Text style={styles.cardMeta}>This outing is preserved in host history and is now read-only.</Text></View>}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function Lifecycle({ label, text }: { label: string; text: string }) {
  return <View style={styles.lifecycleRow}><View style={styles.dot} /><View style={{ flex: 1 }}><Text style={styles.lifecycleTitle}>{label}</Text><Text style={styles.cardMeta}>{text}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 60 },
  back: { color: '#D7B45A', fontWeight: '800', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 33, lineHeight: 39, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A6B0AA', marginTop: 5, fontSize: 13, lineHeight: 19 },
  metrics: { flexDirection: 'row', gap: 9, marginTop: 18 },
  metric: { flex: 1, backgroundColor: '#171D19', borderRadius: 14, borderWidth: 1, borderColor: '#2D3731', padding: 12 },
  metricValue: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  metricLabel: { color: '#859089', fontSize: 9, fontWeight: '800', marginTop: 2 },
  toolsRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  toolCard: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', padding: 13 },
  toolTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  toolMeta: { color: '#87928B', fontSize: 10, lineHeight: 14, marginTop: 4 },
  launchCard: { borderRadius: 18, backgroundColor: '#443615', borderWidth: 1, borderColor: '#7E6324', padding: 17, marginTop: 17 },
  cardEyebrow: { color: '#E7C464', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#FFF5DA', fontSize: 20, lineHeight: 26, fontWeight: '900', marginTop: 5 },
  body: { color: '#CBBB90', fontSize: 12, lineHeight: 18, marginTop: 6 },
  primary: { minHeight: 47, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: '#172017', fontWeight: '900', fontSize: 14 },
  shareButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#8A6A25', alignItems: 'center', justifyContent: 'center', marginTop: 17, backgroundColor: '#2D2718' },
  shareText: { color: '#E7C464', fontWeight: '900' },
  sectionTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 25, marginBottom: 8 },
  card: { minHeight: 68, borderRadius: 14, backgroundColor: '#171D19', borderWidth: 1, borderColor: '#2D3731', padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  attendeeCard: { minHeight: 76, borderRadius: 14, backgroundColor: '#171D19', borderWidth: 1, borderColor: '#2D3731', padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitleSmall: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  cardMeta: { color: '#8D9891', fontSize: 11, lineHeight: 16, marginTop: 3 },
  answers: { color: '#B8C0BB', fontSize: 10, lineHeight: 15, marginTop: 6 },
  price: { color: '#E7C464', fontSize: 13, fontWeight: '900' },
  checkinCard: { borderRadius: 15, backgroundColor: '#121A15', borderWidth: 1, borderColor: '#304038', padding: 15 },
  input: { minHeight: 47, borderRadius: 12, backgroundColor: '#0C120F', borderWidth: 1, borderColor: '#344039', color: '#FFF8E8', paddingHorizontal: 12, marginTop: 12 },
  secondary: { minHeight: 45, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  secondaryText: { color: '#172017', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: .45 },
  good: { color: '#8FD1A9', fontSize: 9, fontWeight: '900', marginTop: 3 },
  muted: { color: '#8A948E', fontSize: 9, fontWeight: '900', marginTop: 3 },
  empty: { color: '#77827B', fontSize: 12, paddingVertical: 6 },
  lifecycle: { borderRadius: 15, borderWidth: 1, borderColor: '#2D3731', backgroundColor: '#151B17', overflow: 'hidden' },
  lifecycleRow: { padding: 14, flexDirection: 'row', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#334038' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#D7B45A', marginTop: 5 },
  lifecycleTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  closeSection: { marginTop: 24, gap: 10 },
  completeButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#426B54', backgroundColor: '#16251C', alignItems: 'center', justifyContent: 'center' },
  completeText: { color: '#9AD1AE', fontSize: 13, fontWeight: '900' },
  cancelButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#6B3F3A', backgroundColor: '#251614', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#E9968C', fontSize: 12, fontWeight: '900' },
  closedCard: { borderRadius: 14, borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', padding: 15, marginTop: 22 },
  closedTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  error: { color: '#FF8A80', fontSize: 12, lineHeight: 18, marginTop: 16 },
});