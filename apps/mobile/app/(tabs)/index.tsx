import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { getWeather, type WeatherForecast } from '../../src/weather/api';

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
  const [journey, setJourney] = useState<any[]>([]);
  const [stampCount, setStampCount] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState(1);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const listRef = useRef<FlatList<AdventureSummary>>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const featured = useMemo(
    () => adventures.filter((item) => item.status !== 'cancelled').slice(0, 5),
    [adventures],
  );

  const loop = useMemo<AdventureSummary[]>(() => {
    if (featured.length <= 1) return featured;
    const first = featured[0];
    const last = featured[featured.length - 1];
    if (!first || !last) return featured;
    return [last, ...featured, first];
  }, [featured]);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const [nextQueue, groups, nextJourney, stamps, badges, nextAdventures, profileResult] = await Promise.all([
        getAdventureQueue(), getGroups(), getJourney(), getPassportStamps(), getMemberBadges(), listAdventures(),
        userId ? supabase.from('profiles').select('first_name,display_name,home_city,home_state').eq('id', userId).single() : Promise.resolve({ data: null, error: null }),
      ]);
      setQueue(nextQueue);
      setGroupCount(groups.filter((group) => group.is_member).length);
      setJourney(nextJourney);
      setStampCount(stamps.length);
      setBadgeCount(badges.length);
      setAdventures(nextAdventures);
      const profile = profileResult.data as { first_name?: string | null; display_name?: string | null; home_city?: string | null; home_state?: string | null } | null;
      setFirstName(profile?.first_name || profile?.display_name?.split(' ')[0] || 'Adventurer');
      setLocation([profile?.home_city, profile?.home_state].filter(Boolean).join(', '));
      if (profile?.home_city && profile?.home_state) {
        try { setWeather(await getWeather(profile.home_city, profile.home_state)); } catch { setWeather(null); }
      } else setWeather(null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Trailhead.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);
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
    if (index === 0) { next = featured.length; listRef.current?.scrollToIndex({ index: next, animated: false }); }
    else if (index === featured.length + 1) { next = 1; listRef.current?.scrollToIndex({ index: next, animated: false }); }
    setActiveFeature(next);
  }

  const statesVisited = new Set(journey.map((item: any) => item.state).filter(Boolean));
  const currentRank = rankFor(journey.length);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}>
      <View style={styles.topRow}><View style={styles.brandMark}><Text style={styles.brandText}>MA</Text></View><View style={styles.topActions}><Pressable onPress={() => router.push('/notifications')}><Text style={styles.topLink}>Alerts</Text></Pressable><Pressable onPress={() => router.push('/member/profile')}><Text style={styles.topLink}>Profile</Text></Pressable></View></View>
      <Text style={styles.greeting}>{greeting(new Date().getHours())}, {firstName}</Text><Text style={styles.title}>What’s next on your trail?</Text>
      {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}{error ? <Text style={styles.error}>{error}</Text> : null}
      {featured.length ? <View style={styles.section}><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Featured Adventures</Text><Text style={styles.count}>{featured.length > 1 ? `${Math.max(1, Math.min(featured.length, activeFeature))} of ${featured.length}` : '1 of 1'}</Text></View><FlatList ref={listRef} horizontal data={loop} keyExtractor={(item, index) => `${item.id}-${index}`} initialScrollIndex={featured.length > 1 ? 1 : 0} getItemLayout={(_, index) => ({ length: CARD_WIDTH, offset: CARD_WIDTH * index, index })} pagingEnabled showsHorizontalScrollIndicator={false} onTouchStart={pauseCarousel} onScrollBeginDrag={pauseCarousel} onMomentumScrollEnd={(event) => settleCarousel(Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH))} renderItem={({ item }) => <Pressable style={{ width: CARD_WIDTH }} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}><ImageBackground source={item.hero_image_url ? { uri: item.hero_image_url } : undefined} style={styles.hero} imageStyle={styles.heroRadius}><View style={styles.heroShade} /><View style={styles.heroBody}><Text style={styles.eyebrow}>{item.is_featured ? 'FEATURED ADVENTURE' : 'OFFICIAL MA ADVENTURE'}</Text><Text style={styles.heroTitle}>{item.title}</Text><Text style={styles.heroMeta}>{shortDate(item.starts_at)} · {item.city}, {item.state}</Text><Text style={styles.link}>View Adventure →</Text></View></ImageBackground></Pressable>} /></View> : null}
      <Pressable style={styles.weatherCard} onPress={() => router.push('/member/weather' as never)}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>WEATHER</Text><Text style={styles.weatherTitle}>{weather ? `${weather.location.name}, ${weather.location.region} · ${Math.round(weather.current.temp_f)}°` : location || 'Set your location'}</Text><Text style={styles.muted}>{weather ? `${weather.current.condition.text} · Feels ${Math.round(weather.current.feelslike_f)}°` : 'Open Weather & Location'}</Text></View><Text style={styles.weatherGlyph}>☁︎</Text></Pressable>
      <View style={styles.duo}><Pressable style={styles.halfCard} onPress={() => router.push('/(tabs)/community')}><Text style={styles.eyebrow}>COMMUNITY</Text><Text style={styles.bigNumber}>{groupCount}</Text><Text style={styles.cardTitle}>Your Groups</Text><Text style={styles.muted}>Adventure, local and interest communities.</Text><Text style={styles.link}>View Groups →</Text></Pressable><Pressable style={styles.halfCard} onPress={() => router.push('/(tabs)/passport')}><Text style={styles.eyebrow}>PASSPORT</Text><Text style={styles.cardTitle}>{currentRank}</Text><Text style={styles.bigNumber}>{stampCount}</Text><Text style={styles.muted}>{stampCount} stamps · {badgeCount} badges</Text><Text style={styles.link}>View Passport →</Text></Pressable></View>
      <Pressable style={styles.journeyCard} onPress={() => router.push('/(tabs)/passport')}><Text style={styles.eyebrow}>MY JOURNEY</Text><View style={styles.journeyStats}><View><Text style={styles.stat}>{journey.length}</Text><Text style={styles.statLabel}>Adventures</Text></View><View><Text style={styles.stat}>{statesVisited.size}</Text><Text style={styles.statLabel}>States</Text></View><View><Text style={styles.stat}>{groupCount}</Text><Text style={styles.statLabel}>Communities</Text></View></View><Text style={styles.link}>Open Journey in Passport →</Text></Pressable>
      <View style={styles.section}><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Current Reservations</Text><Pressable onPress={() => router.push('/member/trips')}><Text style={styles.link}>Manage</Text></Pressable></View>{queue.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGap}>{queue.slice(0, 4).map((item) => <Pressable key={item.order_id} style={styles.reservationCard} onPress={() => router.push('/member/trips')}><Text style={styles.eyebrow}>{item.order_status === 'held' || item.order_status === 'payment_pending' ? 'RESERVATION HELD' : 'CONFIRMED'}</Text><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{shortDate(item.starts_at)} · {item.city}, {item.state}</Text><Text style={styles.link}>View Reservation →</Text></Pressable>)}</ScrollView> : <View style={styles.emptyCard}><Text style={styles.cardTitle}>No active reservations</Text><Text style={styles.muted}>When you book an Adventure, the essentials will live here.</Text></View>}</View>
      <View style={styles.section}><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Upcoming Adventures</Text><Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.link}>Explore</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGap}>{adventures.slice(0, 5).map((item) => <Pressable key={item.id} style={styles.upcomingCard} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}><ImageBackground source={item.hero_image_url ? { uri: item.hero_image_url } : undefined} style={styles.thumbnail} imageStyle={styles.thumbnailRadius} /><Text style={styles.upcomingTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.muted}>{shortDate(item.starts_at)} · {item.city}</Text></Pressable>)}</ScrollView></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1713' }, content: { paddingHorizontal: 18, paddingTop: 52, paddingBottom: 48, gap: 15 }, topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brandMark: { width: 52, height: 42, borderWidth: 1, borderColor: '#D7B45A', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, brandText: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.7, fontSize: 18 }, topActions: { flexDirection: 'row', gap: 18 }, topLink: { color: '#E3D8BB', fontWeight: '800' }, greeting: { color: '#D7B45A', fontWeight: '800', marginTop: 8 }, title: { color: '#FFF8E8', fontSize: 35, lineHeight: 39, fontWeight: '900' }, loader: { margin: 18 }, error: { color: '#FFB4A9' }, section: { gap: 10 }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' }, count: { color: '#7F8C84', fontSize: 12 }, hero: { height: 300, justifyContent: 'flex-end', backgroundColor: '#26372D', borderRadius: 24, overflow: 'hidden' }, heroRadius: { borderRadius: 24 }, heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,12,9,0.48)' }, heroBody: { padding: 20, gap: 6 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, heroTitle: { color: '#FFF8E8', fontSize: 28, lineHeight: 31, fontWeight: '900' }, heroMeta: { color: '#E0E5E1' }, link: { color: '#D7B45A', fontWeight: '900', marginTop: 8 }, weatherCard: { backgroundColor: '#1A2821', borderRadius: 18, borderWidth: 1, borderColor: '#32453A', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, weatherTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 5 }, weatherGlyph: { color: '#F0D083', fontSize: 32, marginLeft: 10 }, muted: { color: '#96A39B', lineHeight: 19, marginTop: 3 }, duo: { flexDirection: 'row', gap: 10 }, halfCard: { flex: 1, minHeight: 180, backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 15 }, bigNumber: { color: '#FFF8E8', fontSize: 30, fontWeight: '900', marginTop: 10 }, cardTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 5 }, journeyCard: { backgroundColor: '#17211C', borderRadius: 20, borderWidth: 1, borderColor: '#3A493F', padding: 17 }, journeyStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 }, stat: { color: '#FFF8E8', fontSize: 26, fontWeight: '900' }, statLabel: { color: '#8F9A93', fontSize: 11, marginTop: 2 }, horizontalGap: { gap: 10 }, reservationCard: { width: 270, backgroundColor: '#1A2821', borderRadius: 18, borderWidth: 1, borderColor: '#33483B', padding: 16 }, emptyCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 16 }, upcomingCard: { width: 165, backgroundColor: '#17211C', borderRadius: 16, padding: 10 }, thumbnail: { width: '100%', height: 105, backgroundColor: '#26372D' }, thumbnailRadius: { borderRadius: 14 }, upcomingTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 15, lineHeight: 19, marginTop: 9 },
});
