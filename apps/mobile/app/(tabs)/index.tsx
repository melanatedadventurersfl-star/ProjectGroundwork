import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listAdventures } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { getGroups } from '../../src/community/api';
import { supabase } from '../../src/lib/supabase';
import { getJourney, getPassportStamps } from '../../src/passport/api';
import { getAdventureQueue } from '../../src/readiness/api';
import type { AdventureQueueItem } from '../../src/readiness/types';

const CARD_WIDTH = Dimensions.get('window').width - 36;

function isPaymentPending(item: AdventureQueueItem) {
  return item.order_status === 'held' || item.order_status === 'payment_pending';
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function daysUntil(value: string) {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}

function adventureStatusLabel(adventure: AdventureSummary) {
  if (adventure.status === 'sold_out') return 'SOLD OUT';
  if (adventure.status === 'cancelled') return 'CANCELLED';
  if (adventure.spots_remaining != null && adventure.spots_remaining <= 3) return 'ALMOST FULL';
  return adventure.is_featured ? 'FEATURED ADVENTURE' : 'UPCOMING ADVENTURE';
}

export default function TrailheadScreen() {
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [featured, setFeatured] = useState<AdventureSummary[]>([]);
  const [firstName, setFirstName] = useState('Adventurer');
  const [homeLocation, setHomeLocation] = useState('');
  const [groupCount, setGroupCount] = useState(0);
  const [journeyCount, setJourneyCount] = useState(0);
  const [stampCount, setStampCount] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const [nextQueue, groups, journey, stamps, adventures, profileResult] = await Promise.all([
        getAdventureQueue(),
        getGroups(),
        getJourney(),
        getPassportStamps(),
        listAdventures(),
        userId
          ? supabase.from('profiles').select('first_name, display_name, home_city, home_state').eq('id', userId).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      setQueue(nextQueue);
      setGroupCount(groups.filter((group) => group.is_member).length);
      setJourneyCount(journey.length);
      setStampCount(stamps.length);
      setFeatured(adventures.filter((item) => item.status !== 'cancelled').slice(0, 6));

      const profile = profileResult.data as {
        first_name?: string | null;
        display_name?: string | null;
        home_city?: string | null;
        home_state?: string | null;
      } | null;
      setFirstName(profile?.first_name || profile?.display_name?.split(' ')[0] || 'Adventurer');
      setHomeLocation([profile?.home_city, profile?.home_state].filter(Boolean).join(', '));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Trailhead.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const primaryAdventure = queue[0];
  const primaryPaymentPending = primaryAdventure ? isPaymentPending(primaryAdventure) : false;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}
    >
      <View style={styles.topRow}>
        <View style={styles.brandMark}><Text style={styles.brandLetters}>MA</Text></View>
        <View style={styles.topActions}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/notifications')}>
            <Text style={styles.iconGlyph}>◌</Text><Text style={styles.iconLabel}>Alerts</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/member/profile')}>
            <Text style={styles.profileGlyph}>{firstName.slice(0, 1).toUpperCase()}</Text><Text style={styles.iconLabel}>Profile</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.greeting}>{greeting}, {firstName}</Text>
      <Text style={styles.title}>What’s next on your trail?</Text>
      <Text style={styles.statusLine}>Upcoming adventures, trip updates, and your community in one place.</Text>

      {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {featured.length ? (
        <View style={styles.featureSection}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Upcoming adventures</Text>
            <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.sectionAction}>See all</Text></Pressable>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH}
            onMomentumScrollEnd={(event) => setActiveFeature(Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH))}
          >
            {featured.map((adventure) => (
              <Pressable
                key={adventure.id}
                style={{ width: CARD_WIDTH }}
                onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: adventure.id } })}
              >
                <ImageBackground
                  source={adventure.hero_image_url ? { uri: adventure.hero_image_url } : undefined}
                  style={styles.featureImage}
                  imageStyle={styles.featureImageRadius}
                >
                  <View style={styles.featureShade} />
                  <View style={styles.featureContent}>
                    <View style={styles.featureTopRow}>
                      <Text style={styles.featureBadge}>{adventureStatusLabel(adventure)}</Text>
                      {adventure.spots_remaining != null && adventure.status === 'published' ? (
                        <Text style={styles.featureSpots}>{adventure.spots_remaining} spots</Text>
                      ) : null}
                    </View>
                    <Text style={styles.featureTitle}>{adventure.title}</Text>
                    <Text style={styles.featureMeta}>
                      {new Date(adventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {adventure.city}, {adventure.state}
                    </Text>
                    <Text style={styles.featureAction}>View adventure →</Text>
                  </View>
                </ImageBackground>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {featured.map((item, index) => <View key={item.id} style={[styles.dot, index === activeFeature && styles.dotActive]} />)}
          </View>
        </View>
      ) : null}

      {primaryAdventure ? (
        <Pressable
          style={styles.tripCard}
          onPress={() => primaryPaymentPending
            ? router.push('/member/trips')
            : router.push({ pathname: '/readiness/[orderId]', params: { orderId: primaryAdventure.order_id } })}
        >
          <View style={styles.tripTopRow}>
            <Text style={styles.cardEyebrow}>{primaryPaymentPending ? 'RESERVATION HELD' : 'YOUR NEXT TRIP'}</Text>
            <Text style={styles.tripCountdown}>{daysUntil(primaryAdventure.starts_at)} days</Text>
          </View>
          <Text style={styles.tripTitle}>{primaryAdventure.title}</Text>
          <Text style={styles.tripMeta}>{new Date(primaryAdventure.starts_at).toLocaleDateString()} · {primaryAdventure.city}, {primaryAdventure.state}</Text>
          <Text style={styles.tripStatus}>{primaryPaymentPending ? 'Payment pending' : `${primaryAdventure.readiness_score}% ready`}</Text>
          <Text style={styles.cardAction}>{primaryPaymentPending ? 'Manage reservation →' : 'Continue readiness →'}</Text>
        </Pressable>
      ) : null}

      <View style={styles.quickGrid}>
        <Pressable style={styles.quickCard} onPress={() => router.push('/member/trips')}>
          <Text style={styles.cardEyebrow}>TRIPS & PAYMENTS</Text>
          <Text style={styles.quickTitle}>Reservations</Text>
          <Text style={styles.quickBody}>Manage bookings, payment status, tickets, and readiness.</Text>
          <Text style={styles.cardAction}>Open →</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => router.push('/(tabs)/community')}>
          <Text style={styles.cardEyebrow}>GROUPS</Text>
          <Text style={styles.quickNumber}>{groupCount}</Text>
          <Text style={styles.quickTitle}>Your clubhouse</Text>
          <Text style={styles.cardAction}>Open →</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => router.push('/(tabs)/passport')}>
          <Text style={styles.cardEyebrow}>PASSPORT</Text>
          <Text style={styles.quickNumber}>{stampCount}</Text>
          <Text style={styles.quickTitle}>Official stamps</Text>
          <Text style={styles.cardAction}>Open →</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => router.push('/(tabs)/explore')}>
          <Text style={styles.cardEyebrow}>EXPLORE</Text>
          <Text style={styles.quickNumber}>{journeyCount}</Text>
          <Text style={styles.quickTitle}>Adventures completed</Text>
          <Text style={styles.cardAction}>Find more →</Text>
        </Pressable>
      </View>

      <View style={styles.weatherCard}>
        <View>
          <Text style={styles.cardEyebrow}>WEATHER</Text>
          <Text style={styles.weatherTitle}>{homeLocation || 'Your area'}</Text>
          <Text style={styles.weatherBody}>Live trail weather will appear here once the weather provider is connected.</Text>
        </View>
        <Text style={styles.weatherGlyph}>☁︎</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1713' },
  container: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 34 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandMark: { width: 54, height: 42, borderWidth: 1, borderColor: '#D7B45A', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandLetters: { color: '#D7B45A', fontSize: 19, fontWeight: '900', letterSpacing: 1.6 },
  topActions: { flexDirection: 'row', gap: 12 },
  iconButton: { alignItems: 'center', minWidth: 44 },
  iconGlyph: { color: '#E8DDC0', fontSize: 24, lineHeight: 25 },
  profileGlyph: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#D7B45A', color: '#17211C', textAlign: 'center', textAlignVertical: 'center', fontWeight: '900' },
  iconLabel: { color: '#7F8C84', fontSize: 10, marginTop: 3 },
  greeting: { color: '#D7B45A', fontWeight: '800', fontSize: 15, marginTop: 26 },
  title: { color: '#FFF8E8', fontSize: 35, lineHeight: 39, fontWeight: '900', marginTop: 7 },
  statusLine: { color: '#9DA8A1', fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  loader: { marginVertical: 12 },
  error: { color: '#FFB4A9', marginBottom: 12 },
  featureSection: { marginBottom: 18 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  sectionAction: { color: '#D7B45A', fontWeight: '800' },
  featureImage: { height: 300, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 24, backgroundColor: '#26372D' },
  featureImageRadius: { borderRadius: 24 },
  featureShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,12,9,0.48)' },
  featureContent: { padding: 20, gap: 7 },
  featureTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  featureBadge: { color: '#F0D083', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  featureSpots: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' },
  featureTitle: { color: '#FFF8E8', fontSize: 28, lineHeight: 31, fontWeight: '900' },
  featureMeta: { color: '#E0E5E1', fontSize: 14 },
  featureAction: { color: '#F0D083', fontWeight: '900', marginTop: 5 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#435148' },
  dotActive: { width: 18, backgroundColor: '#D7B45A' },
  tripCard: { backgroundColor: '#1B2A22', borderRadius: 20, borderWidth: 1, borderColor: '#33483B', padding: 18, gap: 6, marginBottom: 14 },
  tripTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  tripCountdown: { color: '#FFF8E8', fontWeight: '900' },
  tripTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  tripMeta: { color: '#AEB8B2' },
  tripStatus: { color: '#F0D083', fontWeight: '800', marginTop: 3 },
  cardEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardAction: { color: '#D7B45A', fontWeight: '900', fontSize: 13, marginTop: 8 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: { width: '48%', minHeight: 165, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#28362E', borderRadius: 18, padding: 15 },
  quickNumber: { color: '#FFF8E8', fontSize: 28, fontWeight: '900', marginTop: 11 },
  quickTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 7 },
  quickBody: { color: '#98A49D', fontSize: 12, lineHeight: 18, marginTop: 7 },
  weatherCard: { marginTop: 14, backgroundColor: '#1B2A2D', borderRadius: 18, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#2C4145' },
  weatherTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 5 },
  weatherBody: { color: '#9EAAA6', lineHeight: 19, marginTop: 5, maxWidth: 260 },
  weatherGlyph: { color: '#D7E1DD', fontSize: 38 },
});
