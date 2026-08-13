import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberTrips, type MemberTrip } from '../../src/member/api';

function statusLabel(status: string) {
  if (status === 'held') return 'Reservation held';
  if (status === 'payment_pending') return 'Payment pending';
  if (status === 'paid') return 'Confirmed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'expired') return 'Expired';
  if (status === 'refunded') return 'Refunded';
  return status.replace('_', ' ');
}

export default function TripsScreen() {
  const [upcoming, setUpcoming] = useState<MemberTrip[]>([]);
  const [history, setHistory] = useState<MemberTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const trips = await getMemberTrips();
      const now = Date.now();
      const nextUpcoming = trips.filter((trip) => trip.adventures && new Date(trip.adventures.starts_at).getTime() >= now && !['cancelled', 'refunded', 'expired'].includes(trip.status));
      const upcomingIds = new Set(nextUpcoming.map((trip) => trip.id));
      setUpcoming(nextUpcoming);
      setHistory(trips.filter((trip) => !upcomingIds.has(trip.id)));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load trips and payments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function TripCard({ trip }: { trip: MemberTrip }) {
    const adventure = trip.adventures;
    if (!adventure) return null;
    const amount = trip.total_cents === 0 ? 'Free' : `$${(trip.total_cents / 100).toFixed(2)}`;
    const pending = trip.status === 'held' || trip.status === 'payment_pending';
    return (
      <Pressable style={styles.tripCard} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: adventure.id } })}>
        {adventure.hero_image_url ? (
          <ImageBackground source={{ uri: adventure.hero_image_url }} style={styles.image} imageStyle={styles.imageRadius}>
            <View style={styles.imageShade} />
            <Text style={styles.statusBadge}>{statusLabel(trip.status).toUpperCase()}</Text>
          </ImageBackground>
        ) : null}
        <View style={styles.tripContent}>
          <View style={styles.topLine}>
            <Text style={styles.tripTitle}>{adventure.title}</Text>
            <Text style={[styles.status, pending && styles.pending]}>{statusLabel(trip.status)}</Text>
          </View>
          <Text style={styles.meta}>{new Date(adventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {adventure.city}, {adventure.state}</Text>
          <Text style={styles.amount}>{amount}</Text>
          {trip.status === 'held' && trip.hold_expires_at ? <Text style={styles.warning}>Hold expires {new Date(trip.hold_expires_at).toLocaleString()}</Text> : null}
          {trip.status === 'paid' ? <Text style={styles.confirmed}>Payment confirmed{trip.paid_at ? ` · ${new Date(trip.paid_at).toLocaleDateString()}` : ''}</Text> : null}
          {pending ? <Text style={styles.note}>Stripe checkout is not connected yet, so this build can show payment state but does not process a real payment.</Text> : null}
          <Text style={styles.action}>View adventure →</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.eyebrow}>YOUR BOOKINGS</Text>
        <Text style={styles.title}>Trips & Payments</Text>
        <Text style={styles.intro}>Reservations, payment status, confirmed trips, and booking history all live here.</Text>

        {loading ? <ActivityIndicator color="#D7B45A" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {upcoming.length ? upcoming.map((trip) => <TripCard key={trip.id} trip={trip} />) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No upcoming trips</Text><Text style={styles.emptyBody}>When you reserve or confirm an adventure, it will appear here.</Text><Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.action}>Explore adventures →</Text></Pressable></View>}
        </View>

        {history.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>History</Text>
            {history.map((trip) => <TripCard key={trip.id} trip={trip} />)}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 50, gap: 11 }, back: { color: '#D7B45A', fontWeight: '800', fontSize: 16 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginTop: 4 }, title: { color: '#FFF8E8', fontSize: 34, fontWeight: '900' }, intro: { color: '#AEB8B2', lineHeight: 21, marginBottom: 8 }, error: { color: '#FFB4A9' },
  section: { gap: 11, marginTop: 8 }, sectionTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' }, tripCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#29372F', overflow: 'hidden' }, image: { height: 130, justifyContent: 'flex-start', alignItems: 'flex-start', padding: 12 }, imageRadius: { borderTopLeftRadius: 18, borderTopRightRadius: 18 }, imageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,7,0.28)' }, statusBadge: { color: '#FFF8E8', backgroundColor: 'rgba(15,23,19,0.78)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: '900' },
  tripContent: { padding: 16, gap: 6 }, topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, tripTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', flex: 1 }, status: { color: '#BFE2C9', fontSize: 12, fontWeight: '900', textTransform: 'capitalize' }, pending: { color: '#F0D083' }, meta: { color: '#AEB8B2' }, amount: { color: '#FFF8E8', fontWeight: '900', marginTop: 3 }, warning: { color: '#F0D083', fontWeight: '700' }, confirmed: { color: '#BFE2C9', fontWeight: '700' }, note: { color: '#89968E', fontSize: 12, lineHeight: 17, marginTop: 4 }, action: { color: '#D7B45A', fontWeight: '900', marginTop: 5 },
  emptyCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#29372F' }, emptyTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 18 }, emptyBody: { color: '#AEB8B2', lineHeight: 20, marginTop: 6 },
});
