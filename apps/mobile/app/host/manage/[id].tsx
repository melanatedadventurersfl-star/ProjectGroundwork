import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkInCredential, getHostOutingMetrics, listHostAttendees, listMyHostOutings, publishHostOuting, type HostOuting } from '../../../src/hosting/api';
import { listHostTicketTypes } from '../../../src/hosting/tickets';

export default function ManageHostOutingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [outing, setOuting] = useState<HostOuting | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ orders: 0, grossCents: 0 });
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    if (!id) return;
    setError('');
    try {
      const [outings, ticketRows, attendeeRows, nextMetrics] = await Promise.all([
        listMyHostOutings(),
        listHostTicketTypes(id),
        listHostAttendees(id),
        getHostOutingMetrics(id),
      ]);
      setOuting(outings.find((item) => item.id === id) ?? null);
      setTickets(ticketRows);
      setOrders(attendeeRows);
      setMetrics(nextMetrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this outing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [id]);

  const attendees = useMemo(() => orders.flatMap((order) => order.order_attendees ?? []), [orders]);
  const checkedIn = attendees.filter((attendee) => attendee.ticket_credentials?.checked_in_at).length;

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

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  if (!outing) {
    return <SafeAreaView style={styles.center}><Text style={styles.error}>This outing is not available in your Host Hub.</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></SafeAreaView>;
  }

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

        {outing.status === 'draft' || outing.status === 'scheduled' ? (
          <View style={styles.launchCard}>
            <Text style={styles.cardEyebrow}>READY TO LAUNCH?</Text>
            <Text style={styles.cardTitle}>Publish when the details and ticket are ready.</Text>
            <Text style={styles.body}>Publishing makes the outing discoverable. Paid outings require paid-host permission before this action succeeds.</Text>
            <Pressable disabled={working} style={styles.primary} onPress={() => void publish()}><Text style={styles.primaryText}>{working ? 'Working…' : 'Publish Outing'}</Text></Pressable>
          </View>
        ) : (
          <Pressable style={styles.shareButton} onPress={() => void shareOuting()}><Text style={styles.shareText}>Promote / Share Outing</Text></Pressable>
        )}

        <Text style={styles.sectionTitle}>Admission</Text>
        {tickets.length === 0 ? <Text style={styles.empty}>No ticket types yet.</Text> : tickets.map((ticket) => (
          <View key={ticket.id} style={styles.card}>
            <View style={{ flex: 1 }}><Text style={styles.cardTitleSmall}>{ticket.name}</Text><Text style={styles.cardMeta}>{ticket.capacity ? `${ticket.capacity} available` : 'No ticket cap'}</Text></View>
            <Text style={styles.price}>{ticket.price_cents === 0 ? 'FREE' : `$${(ticket.price_cents / 100).toFixed(2)}`}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Check-in</Text>
        <View style={styles.checkinCard}>
          <Text style={styles.cardTitleSmall}>Enter a ticket credential</Text>
          <Text style={styles.cardMeta}>The database verifies that the credential belongs to one of your outings before marking attendance.</Text>
          <TextInput value={credential} onChangeText={setCredential} autoCapitalize="none" placeholder="Credential code" placeholderTextColor="#69756D" style={styles.input} />
          <Pressable disabled={working || !credential.trim()} style={[styles.secondary, (!credential.trim() || working) && styles.disabled]} onPress={() => void manualCheckIn()}><Text style={styles.secondaryText}>Check In Attendee</Text></Pressable>
        </View>

        <Text style={styles.sectionTitle}>Attendees</Text>
        {attendees.length === 0 ? <Text style={styles.empty}>Registrations will appear here.</Text> : attendees.map((attendee) => {
          const credentialRow = attendee.ticket_credentials;
          return (
            <View key={attendee.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitleSmall}>{attendee.first_name} {attendee.last_name}</Text>
                <Text style={styles.cardMeta}>{credentialRow?.checked_in_at ? `Checked in ${new Date(credentialRow.checked_in_at).toLocaleTimeString()}` : 'Not checked in'}</Text>
              </View>
              <Text style={credentialRow?.checked_in_at ? styles.good : styles.muted}>{credentialRow?.checked_in_at ? 'PRESENT' : 'EXPECTED'}</Text>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Lifecycle</Text>
        <View style={styles.lifecycle}>
          <Lifecycle label="Before" text="Promote, prepare, message, and confirm details." />
          <Lifecycle label="During" text="Check in attendees and run the outing." />
          <Lifecycle label="After" text="Attendance becomes the bridge into memories and Your Trail." />
        </View>

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
  cardTitleSmall: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  cardMeta: { color: '#8D9891', fontSize: 11, lineHeight: 16, marginTop: 3 },
  price: { color: '#E7C464', fontSize: 13, fontWeight: '900' },
  checkinCard: { borderRadius: 15, backgroundColor: '#121A15', borderWidth: 1, borderColor: '#304038', padding: 15 },
  input: { minHeight: 47, borderRadius: 12, backgroundColor: '#0C120F', borderWidth: 1, borderColor: '#344039', color: '#FFF8E8', paddingHorizontal: 12, marginTop: 12 },
  secondary: { minHeight: 45, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  secondaryText: { color: '#172017', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: .45 },
  good: { color: '#8FD1A9', fontSize: 9, fontWeight: '900' },
  muted: { color: '#8A948E', fontSize: 9, fontWeight: '900' },
  empty: { color: '#77827B', fontSize: 12, paddingVertical: 6 },
  lifecycle: { borderRadius: 15, borderWidth: 1, borderColor: '#2D3731', backgroundColor: '#151B17', overflow: 'hidden' },
  lifecycleRow: { padding: 14, flexDirection: 'row', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#334038' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#D7B45A', marginTop: 5 },
  lifecycleTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  error: { color: '#FF8A80', fontSize: 12, lineHeight: 18, marginTop: 16 },
});
