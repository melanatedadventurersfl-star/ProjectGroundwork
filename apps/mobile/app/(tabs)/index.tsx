import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
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
import { getCommunityFeed, type CommunityPost } from '../../src/community/api';
import { getCircles } from '../../src/community/circles';
import { removeProfileCover, uploadProfileCover } from '../../src/member/api';
import { supabase } from '../../src/lib/supabase';
import { getJourney } from '../../src/passport/api';
import { rankFor } from '../../src/passport/RankEmblem';
import { getAdventureQueue } from '../../src/readiness/api';
import type { AdventureQueueItem } from '../../src/readiness/types';
import { TrailheadCover } from '../../src/trailhead/TrailheadCover';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeather } from '../../src/weather/api';
import type { WeatherForecast } from '../../src/weather/api';

const CARD_WIDTH = Dimensions.get('window').width - 36;
type CampfireMode = 'general' | 'circle';

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : shortDate(value);
}

export default function TrailheadScreen() {
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [displayName, setDisplayName] = useState('Adventurer');
  const [location, setLocation] = useState('');
  const [completedCount, setCompletedCount] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [circleCount, setCircleCount] = useState(0);
  const [campfireMode, setCampfireMode] = useState<CampfireMode>('general');
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
  const memberRank = useMemo(() => rankFor(completedCount), [completedCount]);
  const campfirePosts = useMemo(() => {
    const filtered = communityPosts.filter((post) => campfireMode === 'circle'
      ? post.audience === 'circle'
      : post.audience === 'everyone' || post.audience === 'connections');
    return filtered.slice(0, 3);
  }, [communityPosts, campfireMode]);
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
      const [nextQueue, nextJourney, nextAdventures, profileResult, nextPosts, nextCircles] = await Promise.all([
        getAdventureQueue(),
        getJourney(),
        listAdventures(),
        userId
          ? supabase.from('profiles').select('*').eq('id', userId).single()
          : Promise.resolve({ data: null, error: null }),
        getCommunityFeed().catch(() => [] as CommunityPost[]),
        getCircles().catch(() => []),
      ]);

      setQueue(nextQueue);
      setCompletedCount(nextJourney.length);
      setAdventures(nextAdventures);
      setCommunityPosts(nextPosts);
      setCircleCount(nextCircles.length);
      const profile = profileResult.data as {
        first_name?: string | null;
        display_name?: string | null;
        home_city?: string | null;
        home_state?: string | null;
        cover_url?: string | null;
      } | null;
      setDisplayName(profile?.display_name?.trim() || profile?.first_name?.trim() || 'Adventurer');
      setLocation([profile?.home_city, profile?.home_state].filter(Boolean).join(', '));
      setCoverUrl(profile?.cover_url ?? null);
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

  async function chooseCoverPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to choose a Trailhead cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 6],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setCoverBusy(true);
    try {
      const asset = result.assets[0];
      const nextCoverUrl = await uploadProfileCover({ uri: asset.uri, mimeType: asset.mimeType });
      setCoverUrl(nextCoverUrl);
    } catch (caught) {
      Alert.alert('Cover photo', caught instanceof Error ? caught.message : 'Unable to update your Trailhead cover.');
    } finally {
      setCoverBusy(false);
    }
  }

  async function restoreDefaultCover() {
    setCoverBusy(true);
    try {
      await removeProfileCover();
      setCoverUrl(null);
    } catch (caught) {
      Alert.alert('Cover photo', caught instanceof Error ? caught.message : 'Unable to restore the default cover.');
    } finally {
      setCoverBusy(false);
    }
  }

  function coverMenu() {
    if (!coverUrl) {
      void chooseCoverPhoto();
      return;
    }
    Alert.alert('Trailhead cover', 'Choose what you want to do.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change photo', onPress: () => void chooseCoverPhoto() },
      { text: 'Use default scenery', onPress: () => void restoreDefaultCover() },
    ]);
  }

  const todayForecast = weather?.forecast.forecastday[0]?.day;

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

      <TrailheadCover
        coverUrl={coverUrl}
        displayName={displayName}
        greeting={greeting(new Date().getHours())}
        rank={memberRank}
        busy={coverBusy}
        onEdit={coverMenu}
        onRankPress={() => router.push('/member/profile')}
      />

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

      <View style={styles.utilityRow}>
        <Pressable
          style={[styles.utilityCard, styles.weatherCard]}
          onPress={() => router.push('/member/weather' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open weather details"
        >
          <Text style={styles.utilityEyebrow}>WEATHER</Text>
          <Text style={styles.weatherTemp}>{weather ? `${Math.round(weather.current.temp_f)}°` : '—'}</Text>
          <Text style={styles.utilityTitle} numberOfLines={2}>{weather?.current.condition.text || 'Check the forecast'}</Text>
          <Text style={styles.utilityMeta} numberOfLines={1}>
            {todayForecast ? `H ${Math.round(todayForecast.maxtemp_f)}°  L ${Math.round(todayForecast.mintemp_f)}°` : location || 'Your local weather'}
          </Text>
        </Pressable>

        {nextReservation ? (
          <Pressable
            style={styles.utilityCard}
            accessibilityRole="button"
            accessibilityLabel={`Get ready for ${nextReservation.title}`}
            onPress={() => router.push({ pathname: '/readiness/[orderId]', params: { orderId: nextReservation.order_id } })}
          >
            <ImageBackground
              source={nextReservationAdventure?.hero_image_url ? { uri: nextReservationAdventure.hero_image_url } : undefined}
              style={styles.utilityImage}
              imageStyle={styles.utilityImageRadius}
            >
              <View style={styles.utilityShade} />
              <View style={styles.utilityImageBody}>
                <Text style={styles.utilityEyebrow}>NEXT ADVENTURE</Text>
                <Text style={styles.countdownSmall}>{countdown(nextReservation.starts_at)}</Text>
                <Text style={styles.utilityTitle} numberOfLines={2}>{nextReservation.title}</Text>
                <Text style={styles.utilityMeta} numberOfLines={1}>{nextReservation.city}, {nextReservation.state}</Text>
              </View>
            </ImageBackground>
          </Pressable>
        ) : (
          <Pressable style={styles.utilityCard} onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.utilityEyebrow}>NEXT ADVENTURE</Text>
            <Text style={styles.utilityTitle}>Your next trail is waiting.</Text>
            <Text style={styles.utilityMeta}>Explore upcoming adventures</Text>
            <Text style={styles.link}>Find one →</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.campfireCard}>
        <View style={styles.campfireTopRow}>
          <View style={styles.campfireHeading}>
            <Text style={styles.utilityEyebrow}>COMMUNITY</Text>
            <Text style={styles.campfireTitle}>Around the Campfire</Text>
          </View>
          {circleCount > 0 ? <View style={styles.campfireBadge}>
            <Text style={styles.campfireBadgeText}>{circleCount} {circleCount === 1 ? 'crew' : 'crews'}</Text>
          </View> : null}
        </View>

        <View style={styles.campfireSwitch} accessibilityRole="tablist">
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: campfireMode === 'general' }}
            style={[styles.campfireSwitchButton, campfireMode === 'general' && styles.campfireSwitchActive]}
            onPress={() => setCampfireMode('general')}
          >
            <Text style={[styles.campfireSwitchText, campfireMode === 'general' && styles.campfireSwitchTextActive]}>General</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: campfireMode === 'circle' }}
            style={[styles.campfireSwitchButton, campfireMode === 'circle' && styles.campfireSwitchActive]}
            onPress={() => setCampfireMode('circle')}
          >
            <Text style={[styles.campfireSwitchText, campfireMode === 'circle' && styles.campfireSwitchTextActive]}>Crew</Text>
          </Pressable>
        </View>

        <View style={styles.campfireFeed}>
          {campfirePosts.length ? campfirePosts.map((post) => (
            <Pressable
              key={post.id}
              style={({ pressed }) => [styles.campfirePost, pressed && styles.campfirePostPressed]}
              onPress={() => router.push(`/community/${post.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open post from ${post.author_name}`}
            >
              <View style={styles.campfireAvatar}>
                {post.avatar_url
                  ? <Image source={{ uri: post.avatar_url }} style={styles.campfireAvatarImage} />
                  : <Text style={styles.campfireAvatarText}>{initials(post.author_name)}</Text>}
              </View>
              <View style={styles.campfirePostBody}>
                <View style={styles.campfireAuthorRow}>
                  <Text style={styles.campfireAuthor} numberOfLines={1}>{post.author_name}</Text>
                  <Text style={styles.campfireTime}>{relativeTime(post.created_at)}</Text>
                </View>
                <Text style={styles.campfirePostText} numberOfLines={2}>{post.body}</Text>
                <Text style={styles.campfireEngagement}>{post.reaction_count || 0} reactions · {post.comment_count || 0} comments</Text>
              </View>
              <Text style={styles.campfireChevron}>›</Text>
            </Pressable>
          )) : (
            <View style={styles.campfireEmpty}>
              <Text style={styles.campfireEmptyTitle}>{campfireMode === 'circle' && circleCount === 0 ? 'Your Crew starts here.' : 'Quiet around the fire right now.'}</Text>
              <Text style={styles.campfireEmptyText}>
                {campfireMode === 'circle' && circleCount === 0
                  ? 'Join or create a Crew to see your Crew posts here.'
                  : campfireMode === 'circle'
                    ? 'New posts from your Crews will show up here.'
                    : 'Recent community posts will show up here.'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.campfireFooter}>
          <Text style={styles.campfirePrompt}>{campfireMode === 'circle' ? 'Catch up with your people.' : 'What’s happening on the trail?'}</Text>
          <Pressable onPress={() => router.push('/(tabs)/community')} accessibilityRole="button">
            <Text style={styles.linkBare}>Open Campfire →</Text>
          </Pressable>
        </View>
      </View>

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
  utilityRow: { flexDirection: 'row', gap: 12 },
  utilityCard: { flex: 1, minHeight: 164, borderRadius: 20, borderWidth: 1, borderColor: '#324239', backgroundColor: '#17211C', padding: 16, overflow: 'hidden', justifyContent: 'flex-end' },
  weatherCard: { backgroundColor: '#1A2821' },
  utilityEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  weatherTemp: { color: '#FFF8E8', fontSize: 38, lineHeight: 42, fontWeight: '900', marginTop: 8 },
  utilityTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 20, fontWeight: '900', marginTop: 7 },
  utilityMeta: { color: '#AFC0B6', fontSize: 11, lineHeight: 15, marginTop: 5 },
  utilityImage: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  utilityImageRadius: { borderRadius: 20 },
  utilityShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,12,9,0.58)' },
  utilityImageBody: { padding: 16, zIndex: 2 },
  countdownSmall: { alignSelf: 'flex-start', backgroundColor: '#D7B45A', color: '#17211C', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900', marginTop: 8 },
  campfireCard: { borderRadius: 24, padding: 18, backgroundColor: '#1B2A22', borderWidth: 1, borderColor: '#3D5146', gap: 13 },
  campfireTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  campfireHeading: { flex: 1 },
  campfireTitle: { color: '#FFF8E8', fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 4 },
  campfireBadge: { borderRadius: 999, backgroundColor: '#263A30', paddingHorizontal: 10, paddingVertical: 6 },
  campfireBadgeText: { color: '#D8E2DC', fontSize: 11, fontWeight: '800' },
  campfireSwitch: { alignSelf: 'flex-start', flexDirection: 'row', backgroundColor: '#132019', borderRadius: 999, padding: 3, gap: 2, borderWidth: 1, borderColor: '#31443A' },
  campfireSwitchButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  campfireSwitchActive: { backgroundColor: '#D7B45A' },
  campfireSwitchText: { color: '#AFC0B6', fontSize: 12, fontWeight: '800' },
  campfireSwitchTextActive: { color: '#17211C' },
  campfireFeed: { gap: 2 },
  campfirePost: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#314238' },
  campfirePostPressed: { opacity: 0.72 },
  campfireAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' },
  campfireAvatarImage: { width: '100%', height: '100%' },
  campfireAvatarText: { color: '#F0D083', fontSize: 11, fontWeight: '900' },
  campfirePostBody: { flex: 1, gap: 2 },
  campfireAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  campfireAuthor: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', flexShrink: 1 },
  campfireTime: { color: '#87968D', fontSize: 10, fontWeight: '700' },
  campfirePostText: { color: '#C8D1CC', fontSize: 12, lineHeight: 17 },
  campfireEngagement: { color: '#829087', fontSize: 10, marginTop: 2 },
  campfireChevron: { color: '#7F9086', fontSize: 22, marginLeft: 2 },
  campfireEmpty: { borderTopWidth: 1, borderTopColor: '#314238', paddingVertical: 14, gap: 4 },
  campfireEmptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  campfireEmptyText: { color: '#9FAAA4', fontSize: 12, lineHeight: 17 },
  campfireFooter: { borderTopWidth: 1, borderTopColor: '#34463C', paddingTop: 12, gap: 6 },
  campfirePrompt: { color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
  upcomingCard: { width: 180 },
  thumbnail: { height: 118, backgroundColor: '#26372D', borderRadius: 17 },
  thumbnailRadius: { borderRadius: 17 },
  upcomingTitle: { color: '#FFF8E8', fontWeight: '900', marginTop: 8, lineHeight: 18 },
});