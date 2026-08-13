import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getGroups } from '../../src/community/api';
import { supabase } from '../../src/lib/supabase';
import { getJourney, getPassportStamps } from '../../src/passport/api';
import { getAdventureQueue } from '../../src/readiness/api';
import type { AdventureQueueItem } from '../../src/readiness/types';

function isPaymentPending(item: AdventureQueueItem) {
  return item.order_status === 'held' || item.order_status === 'payment_pending';
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function daysUntil(value: string) {
  const start = new Date(value).getTime();
  const today = Date.now();
  return Math.max(0, Math.ceil((start - today) / 86400000));
}

export default function TrailheadScreen() {
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [firstName, setFirstName] = useState('Adventurer');
  const [groupCount, setGroupCount] = useState(0);
  const [journeyCount, setJourneyCount] = useState(0);
  const [stampCount, setStampCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const [nextQueue, groups, journey, stamps, profileResult] = await Promise.all([
        getAdventureQueue(),
        getGroups(),
        getJourney(),
        getPassportStamps(),
        userId
          ? supabase.from('profiles').select('first_name, display_name').eq('id', userId).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      setQueue(nextQueue);
      setGroupCount(groups.filter((group) => group.is_member).length);
      setJourneyCount(journey.length);
      setStampCount(stamps.length);
      const profile = profileResult.data as { first_name?: string | null; display_name?: string | null } | null;
      setFirstName(profile?.first_name || profile?.display_name?.split(' ')[0] || 'Adventurer');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Trailhead.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const primaryAdventure = queue[0];
  const primaryPaymentPending = primaryAdventure ? isPaymentPending(primaryAdventure) : false;
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}
    >
      <View style={styles.topRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetters}>MA</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.iconButton}><Text style={styles.iconGlyph}>◌</Text><Text style={styles.iconLabel}>Alerts</Text></Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/(tabs)/menu')}><Text style={styles.iconGlyph}>≡</Text><Text style={styles.iconLabel}>Menu</Text></Pressable>
        </View>
      </View>

      <Text style={styles.greeting}>{greeting}, {firstName}</Text>
      <Text style={styles.title}>{primaryAdventure ? 'Your next adventure is getting close.' : 'Your next adventure starts here.'}</Text>
      <Text style={styles.statusLine}>{primaryAdventure ? 'Keep the details close and the excitement closer.' : 'Explore what is coming up and find your people.'}</Text>

      {loading ? <ActivityIndicator color="#D7B45A" style={{ marginVertical: 12 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {primaryAdventure ? (
        <Pressable
          style={styles.hero}
          onPress={() => primaryPaymentPending
            ? router.push({ pathname: '/adventures/[id]', params: { id: primaryAdventure.adventure_id } })
            : router.push({ pathname: '/readiness/[orderId]', params: { orderId: primaryAdventure.order_id } })}
        >
          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>{primaryPaymentPending ? 'RESERVATION HELD' : 'NEXT ADVENTURE'}</Text>
            <View style={styles.countdown}><Text style={styles.countdownNumber}>{daysUntil(primaryAdventure.starts_at)}</Text><Text style={styles.countdownLabel}>DAYS</Text></View>
          </View>
          <Text style={styles.heroTitle}>{primaryAdventure.title}</Text>
          <Text style={styles.heroMeta}>{new Date(primaryAdventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {primaryAdventure.city}, {primaryAdventure.state}</Text>
          {primaryPaymentPending ? (
            <View style={styles.pendingPanel}>
              <Text style={styles.pendingTitle}>Payment pending</Text>
              <Text style={styles.pendingBody}>Your reservation is held. Readiness and the private adventure group unlock after payment is confirmed.</Text>
            </View>
          ) : (
            <View style={styles.readinessRow}>
              <Text style={styles.readiness}>{primaryAdventure.readiness_score}% ready</Text>
              <Text style={primaryAdventure.blocker_count > 0 ? styles.blocker : styles.clear}>
                {primaryAdventure.blocker_count > 0 ? `${primaryAdventure.blocker_count} blocker${primaryAdventure.blocker_count === 1 ? '' : 's'}` : 'No blockers'}
              </Text>
            </View>
          )}
          <Text style={styles.heroAction}>{primaryPaymentPending ? 'View reservation →' : 'Continue readiness →'}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.heroEmpty} onPress={() => router.push('/(tabs)/explore')}>
          <Text style={styles.heroLabel}>DISCOVER</Text>
          <Text style={styles.heroTitle}>Find your next outside.</Text>
          <Text style={styles.heroMeta}>Official adventures and local member-hosted events are waiting in Explore.</Text>
          <Text style={styles.heroAction}>Explore adventures →</Text>
        </Pressable>
      )}

      <View style={styles.twoColumn}>
        <Pressable style={styles.summaryCard} onPress={() => router.push('/(tabs)/community')}>
          <Text style={styles.cardEyebrow}>GROUPS</Text>
          <Text style={styles.cardNumber}>{groupCount}</Text>
          <Text style={styles.cardTitle}>Your campfires</Text>
          <Text style={styles.cardBody}>{groupCount ? 'Trip conversations and shared plans.' : 'Confirmed adventures will create private groups here.'}</Text>
          <Text style={styles.cardAction}>View Groups →</Text>
        </Pressable>

        <Pressable style={styles.summaryCard} onPress={() => router.push('/(tabs)/passport')}>
          <Text style={styles.cardEyebrow}>PASSPORT</Text>
          <Text style={styles.cardNumber}>{stampCount}</Text>
          <Text style={styles.cardTitle}>Stamps earned</Text>
          <Text style={styles.cardBody}>{journeyCount} completed adventure{journeyCount === 1 ? '' : 's'} in your journey.</Text>
          <Text style={styles.cardAction}>View Passport →</Text>
        </Pressable>
      </View>

      <Pressable style={styles.journeyStrip} onPress={() => router.push('/(tabs)/passport')}>
        <View>
          <Text style={styles.cardEyebrow}>YOUR JOURNEY</Text>
          <Text style={styles.journeyTitle}>Adventure history</Text>
        </View>
        <View style={styles.journeyStats}>
          <View><Text style={styles.journeyNumber}>{journeyCount}</Text><Text style={styles.journeyLabel}>Adventures</Text></View>
          <View><Text style={styles.journeyNumber}>{stampCount}</Text><Text style={styles.journeyLabel}>Stamps</Text></View>
        </View>
        <Text style={styles.cardAction}>Open timeline →</Text>
      </Pressable>

      <Pressable style={styles.exploreCard} onPress={() => router.push('/(tabs)/explore')}>
        <Text style={styles.cardEyebrow}>EXPLORE</Text>
        <Text style={styles.exploreTitle}>What should we do next?</Text>
        <Text style={styles.exploreBody}>Browse MA Adventures, Local Events, and everything you saved for later.</Text>
        <Text style={styles.exploreAction}>Start exploring →</Text>
      </Pressable>

      {queue.length > 1 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More upcoming</Text>
          {queue.slice(1).map((item) => (
            <Pressable
              key={item.order_id}
              style={styles.queueCard}
              onPress={() => isPaymentPending(item)
                ? router.push({ pathname: '/adventures/[id]', params: { id: item.adventure_id } })
                : router.push({ pathname: '/readiness/[orderId]', params: { orderId: item.order_id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.queueTitle}>{item.title}</Text>
                <Text style={styles.queueMeta}>{new Date(item.starts_at).toLocaleDateString()} · {item.city}</Text>
              </View>
              <Text style={isPaymentPending(item) ? styles.queuePending : styles.queueScore}>{isPaymentPending(item) ? 'Payment pending' : `${item.readiness_score}%`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0F1713', paddingHorizontal: 18, paddingTop: 54, paddingBottom: 34 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandMark: { width: 54, height: 42, borderWidth: 1, borderColor: '#D7B45A', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandLetters: { color: '#D7B45A', fontSize: 19, fontWeight: '900', letterSpacing: 1.6 },
  topActions: { flexDirection: 'row', gap: 10 },
  iconButton: { alignItems: 'center', minWidth: 44 },
  iconGlyph: { color: '#E8DDC0', fontSize: 24, fontWeight: '300', lineHeight: 25 },
  iconLabel: { color: '#7F8C84', fontSize: 10, marginTop: 2 },
  greeting: { color: '#D7B45A', fontWeight: '800', fontSize: 15, marginTop: 28 },
  title: { color: '#FFF8E8', fontSize: 35, lineHeight: 39, fontWeight: '900', marginTop: 7, maxWidth: 580 },
  statusLine: { color: '#9DA8A1', fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  error: { color: '#FFB4A9', marginBottom: 12 },
  hero: { backgroundColor: '#1E3027', borderRadius: 24, borderWidth: 1, borderColor: '#33483B', padding: 20, gap: 8, marginBottom: 16, minHeight: 270, justifyContent: 'flex-end' },
  heroEmpty: { backgroundColor: '#1B2A22', borderRadius: 24, borderWidth: 1, borderColor: '#33483B', padding: 20, gap: 10, marginBottom: 16, minHeight: 220, justifyContent: 'flex-end' },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroLabel: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 },
  countdown: { backgroundColor: '#0B100D', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  countdownNumber: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  countdownLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: '#FFF8E8', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  heroMeta: { color: '#C6CEC8', lineHeight: 21 },
  heroAction: { color: '#D7B45A', fontWeight: '900', marginTop: 5 },
  pendingPanel: { backgroundColor: '#111A15', borderRadius: 14, padding: 13, marginTop: 5, gap: 3 },
  pendingTitle: { color: '#F0D083', fontWeight: '900', fontSize: 16 },
  pendingBody: { color: '#BFC8C2', lineHeight: 20 },
  readinessRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 5 },
  readiness: { color: '#FFF8E8', fontWeight: '900' },
  blocker: { color: '#FFB4A9', fontWeight: '800' },
  clear: { color: '#BFE2C9', fontWeight: '800' },
  twoColumn: { flexDirection: 'row', gap: 11, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#17211C', borderRadius: 20, padding: 16, minHeight: 205, borderWidth: 1, borderColor: '#28362E' },
  cardEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardNumber: { color: '#FFF8E8', fontSize: 31, fontWeight: '900', marginTop: 12 },
  cardTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 3 },
  cardBody: { color: '#98A49D', fontSize: 13, lineHeight: 18, marginTop: 7, flex: 1 },
  cardAction: { color: '#D7B45A', fontWeight: '900', fontSize: 13, marginTop: 9 },
  journeyStrip: { backgroundColor: '#17211C', borderRadius: 20, padding: 17, marginBottom: 12, borderWidth: 1, borderColor: '#28362E' },
  journeyTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 4 },
  journeyStats: { flexDirection: 'row', gap: 38, marginTop: 16 },
  journeyNumber: { color: '#FFF8E8', fontSize: 26, fontWeight: '900' },
  journeyLabel: { color: '#8F9A93', fontSize: 12, marginTop: 2 },
  exploreCard: { backgroundColor: '#29392D', borderRadius: 20, padding: 18, marginBottom: 20, minHeight: 150, justifyContent: 'flex-end' },
  exploreTitle: { color: '#FFF8E8', fontSize: 23, fontWeight: '900', marginTop: 7 },
  exploreBody: { color: '#C2CBC5', lineHeight: 20, marginTop: 5 },
  exploreAction: { color: '#F0D083', fontWeight: '900', marginTop: 10 },
  section: { gap: 9, marginTop: 2 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  queueCard: { backgroundColor: '#17211C', borderRadius: 15, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  queueTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 16 },
  queueMeta: { color: '#8F9A93', marginTop: 4 },
  queueScore: { color: '#D7B45A', fontWeight: '900' },
  queuePending: { color: '#F0D083', fontSize: 12, fontWeight: '900' },
});
