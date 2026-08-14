import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Dimensions,
  FlatList,
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
import { getJourney, getMemberBadges, getPassportStamps } from '../../src/passport/api';
import { getAdventureQueue } from '../../src/readiness/api';
import type { AdventureQueueItem } from '../../src/readiness/types';
import { TrailheadIdentityCards } from '../../src/trailhead/TrailheadIdentityCards';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeather } from '../../src/weather/api';
import { WeatherScene } from '../../src/weather/WeatherScene';

const CARD_WIDTH = Dimensions.get('window').width - 36;

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function rankFor(count: number) {
  if (count >= 20) return 'Legacy Adventurer';
  if (count >= 10) return 'Summiteer';
  if (count >= 5) return 'Wayfinder';
  if (count >= 3) return 'Trailblazer';
  if (count >= 1) return 'Pathfinder';
  return 'Explorer';
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function countdown(value: string) {
  const start = new Date(value);
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.ceil((startDay - today) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export default function TrailheadScreen() {
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [displayName, setDisplayName] = useState('Adventurer');
  const [location, setLocation] = useState('');
  const [groupCount, setGroupCount] = useState(0);
  const [journey, setJourney] = useState<any[]>([]);
  const [stampCount, setStampCount] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState(1);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const listRef = useRef<FlatList<AdventureSummary>>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeAdventures = useMemo(
    () => adventures.filter((item) => item.status !== 'cancelled'),
    [adventures],
  );
  const featured = useMemo(() => activeAdventures.slice(0, 5), [activeAdventures]);
  const adventureById = useMemo(() => new Map(adventures.map((item) => [item.id, item])), [adventures]);
  const nextReservation = queue[0];
  const nextReservationAdventure = nextReservation ? adventureById.get(nextReservation.adventure_id) : undefined;
  const loop = useMemo<AdventureSummary[]>(() => {
    if (featured.length <= 1) return featured;
    const first = featured[0];
    const last = featured[featured.length - 1];
    if (!first || !last) return featured;
    return [last, ...featured, first];
  }, [featured]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const [nextQueue, groups, nextJourney, stamps, badges, nextAdventures, profileResult] = await Promise.all([
        getAdventureQueue(),
        getGroups(),
        getJourney(),
        getPassportStamps(),
        getMemberBadges(),
        listAdventures(),
        userId
          ? supabase.from('profiles').select('first_name,display_name,home_city,home_state').eq('id', userId).single()
          : Promise.resolve({ data: null, error: null }),
      ]);
      const myGroupIds = groups.filter((group) => group.is_member).map((group) => group.id);

      setQueue(nextQueue);
      setGroupCount(myGroupIds.length);
      setJourney(nextJourney);
      setStampCount(stamps.length);
      setBadgeCount(badges.length);
      setAdventures(nextAdventures);
      const profile = profileResult.data as {
        first_name?: string | null;
        display_name?: string | null;
        home_city?: string | null;
        home_state?: string | null;
      } | null;
      setDisplayName(profile?.display_name?.trim() || profile?.first_name?.trim() || 'Adventurer');
      setLocation([profile?.home_city, profile?.home_state].filter(Boolean).join(', '));
      if (profile?.home_city && profile?.home_state) {
        try {
          setWeather(await getWeather(profile.home_city, profile.home_state));
        } catch {
          setWeather(null);
        }
      } else {
        setWeather(null);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Trailhead.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);
  useEffect(() => {
    if (reduceMotion || paused || loop.length < 2) return;
    const timer = setInterval(() => {
      setActiveFeature((current) => {
        const next = current + 1;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [reduceMotion, paused, loop.length]);

  function pauseCarousel() {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 4500);
  }

  function settleCarousel(index: number) {
    if (featured.length < 2) return;
    let next = index;
    if (index === 0) {
      next = featured.length;
      listRef.current?.scrollToIndex({ index: next, animated: false });
    } else if (index === featured.length + 1) {
      next = 1;
      listRef.current?.scrollToIndex({ index: next, animated: false });
    }
    setActiveFeature(next);
  }

  const statesVisited = new Set(journey.map((item: any) => item.state).filter(Boolean));
  const currentRank = rankFor(journey.length);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}
    >
      <View style={styles.topRow}>
        <ImageBackground
          source={require('../../assets/ma-pathfinder-mark.png')}
          style={{ width: 56, height: 56 }}
          resizeMode="contain"
          accessibilityLabel="Melanated Adventurers"
        />
        <View style={styles.topActions}>
          <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.iconButton}>
            <AppIcon name="notifications" color="#F6F4EE" size={22} />
          </Pressable>
          <Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.iconButton}>
            <AppIcon name="profile" color="#F6F4EE" size={22} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.greeting}>{greeting(new Date().getHours())}, {displayName}</Text>
      <Text style={styles.title}>What’s next on your trail?</Text>
      {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {featured.length ? (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Featured Adventures</Text>
            <Text style={styles.count}>{featured.length > 1 ? `${Math.max(1, Math.min(featured.length, activeFeature))} of ${featured.length}` : '1 of 1'}</Text>
          </View>
          <FlatList
            ref={listRef}
            horizontal
            data={loop}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            initialScrollIndex={featured.length > 1 ? 1 : 0}
            getItemLayout={(_, index) => ({ length: CARD_WIDTH, offset: CARD_WIDTH * index, index })}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onTouchStart={pauseCarousel}
            onScrollBeginDrag={pauseCarousel}
            onMomentumScrollEnd={(event) => settleCarousel(Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH))}
            renderItem={({ item }) => (
              <Pressable style={{ width: CARD_WIDTH }} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}>
                <ImageBackground source={item.hero_image_url ? { uri: item.hero_image_url } : undefined} style={styles.hero} imageStyle={styles.heroRadius}>
                  <View style={styles.heroShade} />
                  <View style={styles.heroBody}>
                    <Text style={styles.eyebrow}>{item.is_featured ? 'FEATURED ADVENTURE' : 'OFFICIAL MA ADVENTURE'}</Text>
                    <Text style={styles.heroTitle}>{item.title}</Text>
                    <Text style={styles.heroMeta}>{shortDate(item.starts_at)} · {item.city}, {item.state}</Text>
                    <Text style={styles.link}>View Adventure →</Text>
                  </View>
                </ImageBackground>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <Pressable onPress={() => router.push('/member/weather' as never)} accessibilityRole="button" accessibilityLabel="Open weather details">
        <WeatherScene weather={weather} fallbackLocation={location} reduceMotion={reduceMotion} />
      </Pressable>

      {nextReservation ? (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Your Next Move</Text>
            <Pressable onPress={() => router.push('/member/trips')}><Text style={styles.linkBare}>Manage</Text></Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Get ready for ${nextReservation.title}`}
            onPress={() => router.push({ pathname: '/readiness/[orderId]', params: { orderId: nextReservation.order_id } })}
          >
            <ImageBackground
              source={nextReservationAdventure?.hero_image_url ? { uri: nextReservationAdventure.hero_image_url } : undefined}
              style={styles.nextMoveCard}
              imageStyle={styles.nextMoveImage}
            >
              <View style={styles.nextMoveShade} />
              <View style={styles.nextMoveTopRow}>
                <View style={styles.countdownPill}>
                  <Text style={styles.countdownText}>{countdown(nextReservation.starts_at)}</Text>
                </View>
                <View style={styles.readyPill}>
                  <Text style={styles.readyText}>{Math.round(nextReservation.readiness_score)}% ready</Text>
                </View>
              </View>
              <View style={styles.nextMoveBody}>
                <Text style={styles.eyebrow}>YOUR NEXT ADVENTURE</Text>
                <Text style={styles.nextMoveHeadline}>You’re headed to {nextReservation.city} next.</Text>
                <Text style={styles.nextMoveTitle}>{nextReservation.title}</Text>
                <Text style={styles.nextMoveMeta}>{shortDate(nextReservation.starts_at)} · {nextReservation.city}, {nextReservation.state}</Text>
                <View style={styles.nextMoveFooter}>
                  <Text style={styles.link}>Get Ready →</Text>
                  {queue.length > 1 ? <Text style={styles.moreBookings}>+{queue.length - 1} more booked</Text> : null}
                </View>
              </View>
            </ImageBackground>
          </Pressable>
        </View>
      ) : null}

      <TrailheadIdentityCards
        groupCount={groupCount}
        currentRank={currentRank}
        journeyCount={journey.length}
        stateCount={statesVisited.size}
        stampCount={stampCount}
        badgeCount={badgeCount}
      />

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Upcoming Adventures</Text>
          <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.linkBare}>Explore</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGap}>
          {activeAdventures.slice(0, 5).map((item) => (
            <Pressable key={item.id} style={styles.upcomingCard} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}>
              <ImageBackground source={item.hero_image_url ? { uri: item.hero_image_url } : undefined} style={styles.thumbnail} imageStyle={styles.thumbnailRadius} />
              <Text style={styles.upcomingTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.muted}>{shortDate(item.starts_at)} · {item.city}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1713' },
  content: { paddingHorizontal: 18, paddingTop: 52, paddingBottom: 48, gap: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topActions: { flexDirection: 'row', gap: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#405047', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  greeting: { color: '#D7B45A', fontWeight: '800', marginTop: 8 },
  title: { color: '#FFF8E8', fontSize: 35, lineHeight: 39, fontWeight: '900' },
  loader: { margin: 18 },
  error: { color: '#FFB4A9' },
  section: { gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  count: { color: '#7F8C84', fontSize: 12 },
  hero: { height: 300, justifyContent: 'flex-end', backgroundColor: '#26372D', borderRadius: 24, overflow: 'hidden' },
  heroRadius: { borderRadius: 24 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,12,9,0.48)' },
  heroBody: { padding: 20, gap: 6 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#FFF8E8', fontSize: 28, lineHeight: 31, fontWeight: '900' },
  heroMeta: { color: '#E0E5E1' },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 8 },
  linkBare: { color: '#D7B45A', fontWeight: '900' },
  muted: { color: '#A7B1AA', lineHeight: 19, marginTop: 3 },
  horizontalGap: { gap: 12, paddingRight: 8 },
  nextMoveCard: { height: 230, borderRadius: 22, overflow: 'hidden', backgroundColor: '#25342C', justifyContent: 'space-between' },
  nextMoveImage: { borderRadius: 22 },
  nextMoveShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,11,8,0.57)' },
  nextMoveTopRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, zIndex: 2 },
  countdownPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: '#D7B45A' },
  countdownText: { color: '#17211C', fontSize: 11, fontWeight: '900' },
  readyPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: 'rgba(15,23,19,0.76)', borderWidth: 1, borderColor: 'rgba(246,244,238,0.24)' },
  readyText: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' },
  nextMoveBody: { padding: 18, paddingTop: 8, zIndex: 2 },
  nextMoveHeadline: { color: '#FFF8E8', fontSize: 23, lineHeight: 27, fontWeight: '900', marginTop: 5 },
  nextMoveTitle: { color: '#E7EAE7', fontSize: 14, lineHeight: 18, fontWeight: '800', marginTop: 5 },
  nextMoveMeta: { color: '#C9D1CC', marginTop: 3, fontSize: 12 },
  nextMoveFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  moreBookings: { color: '#B8C1BB', fontSize: 11, fontWeight: '700', marginBottom: 1 },
  upcomingCard: { width: 180 },
  thumbnail: { height: 118, backgroundColor: '#26372D', borderRadius: 17 },
  thumbnailRadius: { borderRadius: 17 },
  upcomingTitle: { color: '#FFF8E8', fontWeight: '900', marginTop: 8, lineHeight: 18 },
});