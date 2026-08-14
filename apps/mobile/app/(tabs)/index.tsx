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
import { getCommunityFeed, getGroups, type CommunityPost } from '../../src/community/api';
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

export default function TrailheadScreen() {
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [firstName, setFirstName] = useState('Adventurer');
  const [location, setLocation] = useState('');
  const [groupCount, setGroupCount] = useState(0);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityIndex, setCommunityIndex] = useState(0);
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

  const featured = useMemo(() => adventures.filter((item) => item.status !== 'cancelled').slice(0, 5), [adventures]);
  const adventureById = useMemo(() => new Map(adventures.map((item) => [item.id, item])), [adventures]);
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
      const feed = await getCommunityFeed();
      const myFeed = feed
        .filter((post) => !post.group_id || myGroupIds.includes(post.group_id))
        .sort((a, b) => (b.reaction_count + b.comment_count * 2) - (a.reaction_count + a.comment_count * 2))
        .slice(0, 6);

      setQueue(nextQueue);
      setGroupCount(myGroupIds.length);
      setCommunityPosts(myFeed);
      setCommunityIndex((current) => myFeed.length ? current % myFeed.length : 0);
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
      setFirstName(profile?.first_name || profile?.display_name?.split(' ')[0] || 'Adventurer');
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
  useEffect(() => {
    if (reduceMotion || communityPosts.length < 2) return;
    const timer = setInterval(() => setCommunityIndex((current) => (current + 1) % communityPosts.length), 7000);
    return () => clearInterval(timer);
  }, [communityPosts.length, reduceMotion]);

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
  const currentCommunityPost = communityPosts[communityIndex];

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

      <Text style={styles.greeting}>{greeting(new Date().getHours())}, {firstName}</Text>
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

      <TrailheadIdentityCards
        communityPost={currentCommunityPost}
        groupCount={groupCount}
        currentRank={currentRank}
        journeyCount={journey.length}
        stateCount={statesVisited.size}
        stampCount={stampCount}
        badgeCount={badgeCount}
      />

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Current Reservations</Text>
          <Pressable onPress={() => router.push('/member/trips')}><Text style={styles.link}>Manage</Text></Pressable>
        </View>
        {queue.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGap}>
            {queue.slice(0, 4).map((item) => {
              const adventure = adventureById.get(item.adventure_id);
              return (
                <Pressable key={item.order_id} style={styles.reservationShell} onPress={() => router.push('/member/trips')}>
                  <ImageBackground source={adventure?.hero_image_url ? { uri: adventure.hero_image_url } : undefined} style={styles.reservationCard} imageStyle={styles.reservationImage}>
                    <View style={styles.reservationShade} />
                    <View style={styles.reservationBody}>
                      <Text style={styles.eyebrow}>{item.order_status === 'held' || item.order_status === 'payment_pending' ? 'RESERVATION HELD' : 'CONFIRMED'}</Text>
                      <Text style={styles.reservationTitle}>{item.title}</Text>
                      <Text style={styles.reservationMeta}>{shortDate(item.starts_at)} · {item.city}, {item.state}</Text>
                      <Text style={styles.link}>View Reservation →</Text>
                    </View>
                  </ImageBackground>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Nothing booked yet</Text>
            <Text style={styles.muted}>Your next confirmed adventure will land here with its event artwork.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Upcoming Adventures</Text>
          <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.link}>Explore</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGap}>
          {adventures.slice(0, 5).map((item) => (
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
  content: { paddingHorizontal: 18, paddingTop: 52, paddingBottom: 48, gap: 15 },
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
  muted: { color: '#A7B1AA', lineHeight: 19, marginTop: 3 },
  cardTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 5 },
  horizontalGap: { gap: 10 },
  reservationShell: { width: 278, height: 170, borderRadius: 18, overflow: 'hidden' },
  reservationCard: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#25342C' },
  reservationImage: { borderRadius: 18 },
  reservationShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,12,9,0.56)' },
  reservationBody: { padding: 15 },
  reservationTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 5 },
  reservationMeta: { color: '#DDE5E0', marginTop: 4 },
  emptyCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#29372F', padding: 17 },
  upcomingCard: { width: 158 },
  thumbnail: { height: 105, backgroundColor: '#26372D', borderRadius: 16 },
  thumbnailRadius: { borderRadius: 16 },
  upcomingTitle: { color: '#FFF8E8', fontWeight: '900', marginTop: 8, lineHeight: 18 },
});
