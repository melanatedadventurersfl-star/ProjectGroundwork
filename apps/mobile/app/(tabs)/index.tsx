import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { AdventureImageBackground } from '../../src/adventures/AdventureImage';
import type { AdventureSummary } from '../../src/adventures/types';
import { useAuth } from '../../src/auth/AuthProvider';
import { getCommunityFeed, type CommunityPost } from '../../src/community/api';
import { getCircles } from '../../src/community/circles';
import { listLocalEvents, type LocalEvent } from '../../src/local-events/api';
import { removeProfileCover, uploadProfileCover } from '../../src/member/api';
import { supabase } from '../../src/lib/supabase';
import { getJourney } from '../../src/passport/api';
import { rankFor } from '../../src/passport/RankEmblem';
import { getAdventureQueue } from '../../src/readiness/api';
import type { AdventureQueueItem } from '../../src/readiness/types';
import { TrailheadCover } from '../../src/trailhead/TrailheadCover';
import { AppIcon } from '../../src/ui/AppIcon';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COMPACT_CARD_WIDTH = 176;
const WIDE_CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 430);
const UPCOMING_CAMPFIRE_CARD_WIDTH = Math.min(Math.max(SCREEN_WIDTH * 0.72, 244), 310);
const CAMPFIRE_CARD_WIDTH = Math.min(Math.max(SCREEN_WIDTH * 0.64, 214), 264);
type CampfireMode = 'general' | 'circle';

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function shortTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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

function promptForAccount(destination: string) {
  Alert.alert(
    'Sign in to continue',
    `${destination} is part of your member experience. Sign in or create an account to continue.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Create account', onPress: () => router.push('/(auth)/sign-up' as never) },
      { text: 'Sign in', onPress: () => router.push('/(auth)/sign-in' as never) },
    ],
  );
}

export default function TrailheadScreen() {
  const { session } = useAuth();
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [displayName, setDisplayName] = useState('Adventurer');
  const [completedCount, setCompletedCount] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [circleCount, setCircleCount] = useState(0);
  const [campfireMode, setCampfireMode] = useState<CampfireMode>('general');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAdventures = useMemo(() => adventures.filter((item) => item.status !== 'cancelled'), [adventures]);
  const featured = useMemo(() => activeAdventures.slice(0, 8), [activeAdventures]);
  const adventureById = useMemo(() => new Map(adventures.map((item) => [item.id, item])), [adventures]);
  const reservedAdventures = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const unique = new Map<string, AdventureQueueItem>();
    [...queue]
      .filter((item) => new Date(item.starts_at).getTime() >= startOfToday.getTime())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .forEach((item) => {
        if (!unique.has(item.adventure_id)) unique.set(item.adventure_id, item);
      });
    return [...unique.values()];
  }, [queue]);
  const upcomingCampfires = useMemo(
    () => localEvents
      .filter((event) => event.my_rsvp === 'going' && event.status === 'published' && new Date(event.starts_at).getTime() >= Date.now())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [localEvents],
  );
  const memberRank = useMemo(() => rankFor(completedCount), [completedCount]);
  const campfirePosts = useMemo(() => {
    const filtered = communityPosts.filter((post) => {
      const matchesAudience = campfireMode === 'circle'
        ? post.audience === 'circle'
        : post.audience === 'everyone' || post.audience === 'connections';
      return matchesAudience && Boolean(post.image_url?.trim());
    });
    return filtered.slice(0, 3);
  }, [communityPosts, campfireMode]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const userId = session?.user.id;
      const [nextQueue, nextJourney, nextAdventures, profileResult, nextPosts, nextCircles, nextLocalEvents] = await Promise.all([
        userId ? getAdventureQueue() : Promise.resolve([] as AdventureQueueItem[]),
        userId ? getJourney() : Promise.resolve([]),
        listAdventures(),
        userId ? supabase.from('profiles').select('*').eq('id', userId).single() : Promise.resolve({ data: null, error: null }),
        userId ? getCommunityFeed().catch(() => [] as CommunityPost[]) : Promise.resolve([] as CommunityPost[]),
        userId ? getCircles().catch(() => []) : Promise.resolve([]),
        userId ? listLocalEvents().catch(() => [] as LocalEvent[]) : Promise.resolve([] as LocalEvent[]),
      ]);

      setQueue(nextQueue);
      setCompletedCount(nextJourney.length);
      setAdventures(nextAdventures);
      setCommunityPosts(nextPosts);
      setCircleCount(nextCircles.length);
      setLocalEvents(nextLocalEvents);
      const profile = profileResult.data as {
        first_name?: string | null;
        display_name?: string | null;
        cover_url?: string | null;
      } | null;
      setDisplayName(profile?.first_name?.trim() || profile?.display_name?.trim() || 'Adventurer');
      setCoverUrl(profile?.cover_url ?? null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Trailhead.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function chooseCoverPhoto() {
    if (!session) { promptForAccount('Trailhead personalization'); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to choose a Trailhead cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 6], base64: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    setCoverBusy(true);
    try {
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('That photo could not be prepared safely. Please choose it again.');
      const nextCoverUrl = await uploadProfileCover({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType });
      setCoverUrl(nextCoverUrl);
    } catch (caught) {
      Alert.alert('Cover photo', caught instanceof Error ? caught.message : 'Unable to update your Trailhead cover.');
    } finally { setCoverBusy(false); }
  }

  async function restoreDefaultCover() {
    if (!session) { promptForAccount('Trailhead personalization'); return; }
    setCoverBusy(true);
    try { await removeProfileCover(); setCoverUrl(null); }
    catch (caught) { Alert.alert('Cover photo', caught instanceof Error ? caught.message : 'Unable to restore the default cover.'); }
    finally { setCoverBusy(false); }
  }

  function coverMenu() {
    if (!session) { promptForAccount('Trailhead personalization'); return; }
    if (!coverUrl) { void chooseCoverPhoto(); return; }
    Alert.alert('Trailhead cover', 'Choose what you want to do.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change photo', onPress: () => void chooseCoverPhoto() },
      { text: 'Use default scenery', onPress: () => void restoreDefaultCover() },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <ImageBackground source={require('../../assets/ma-pathfinder-mark.png')} style={styles.brandMark} resizeMode="contain" accessibilityLabel="Melanated Adventurers" />
          <Text style={styles.pageTitle}>TRAILHEAD</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable accessibilityLabel="Notifications" onPress={() => session ? router.push('/notifications') : promptForAccount('Notifications')} style={styles.iconButton}><AppIcon name="notifications" color="#F6F4EE" size={22} /></Pressable>
          <Pressable accessibilityLabel="Menu" onPress={() => router.push('/menu')} style={styles.iconButton}><AppIcon name="menu" color="#F6F4EE" size={22} /></Pressable>
        </View>
      </View>

      <TrailheadCover coverUrl={coverUrl} displayName={displayName} greeting={greeting(new Date().getHours())} rank={memberRank} busy={coverBusy} onEdit={coverMenu} onRankPress={() => session ? router.push('/member/profile') : promptForAccount('Profile')} />

      {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your Next Adventure</Text>
          {reservedAdventures.length > 1 ? <Text style={styles.count}>{reservedAdventures.length} reserved</Text> : null}
        </View>
        {reservedAdventures.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={WIDE_CARD_WIDTH + 12} decelerationRate="fast" contentContainerStyle={styles.wideRow}>
            {reservedAdventures.map((item, index) => {
              const adventure = adventureById.get(item.adventure_id);
              return (
                <Pressable
                  key={item.adventure_id}
                  style={styles.wideCard}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title}`}
                  onPress={() => router.push({ pathname: '/readiness/[orderId]', params: { orderId: item.order_id } })}
                >
                  <AdventureImageBackground uri={adventure?.hero_image_url} style={styles.wideImage} imageStyle={styles.wideRadius}>
                    <View style={styles.wideShade} />
                    <View style={styles.wideBody}>
                      <View style={styles.wideTopRow}>
                        <Text style={styles.wideLabel}>{index === 0 ? 'NEXT UP' : 'RESERVED'}</Text>
                        <Text style={styles.wideCountdown}>{countdown(item.starts_at)}</Text>
                      </View>
                      <Text style={styles.wideTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.wideMeta}>{shortDate(item.starts_at)} · {item.city}, {item.state}</Text>
                      <View style={styles.wideFooter}><Text style={styles.wideLink}>View Adventure →</Text></View>
                    </View>
                  </AdventureImageBackground>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Pressable style={styles.emptyAdventureCard} onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.emptyAdventureTitle}>No adventures booked yet.</Text>
            <Text style={styles.emptyAdventureText}>Find something worth packing for.</Text>
            <Text style={styles.link}>Explore Adventures →</Text>
          </Pressable>
        )}
      </View>

      {upcomingCampfires.length ? (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Your Campfires</Text>
            <Text style={styles.count}>{upcomingCampfires.length} attending</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={UPCOMING_CAMPFIRE_CARD_WIDTH + 12}
            decelerationRate="fast"
            contentContainerStyle={styles.upcomingCampfireRow}
          >
            {upcomingCampfires.map((event) => (
              <Pressable
                key={event.id}
                style={({ pressed }) => [styles.upcomingCampfireCard, pressed && styles.campfirePostPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${event.title}`}
                onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}
              >
                {event.image_url ? (
                  <Image source={{ uri: event.image_url }} style={styles.upcomingCampfireImage} />
                ) : (
                  <View style={styles.upcomingCampfireFallback}>
                    <AppIcon name="local-fire-department" color="#F0D083" size={42} />
                  </View>
                )}
                <View pointerEvents="none" style={styles.upcomingCampfireShade} />
                <View style={styles.upcomingCampfireBody}>
                  <View style={styles.upcomingCampfireTopRow}>
                    <Text style={styles.upcomingCampfireGoing}>GOING</Text>
                    <Text style={styles.upcomingCampfireCountdown}>{countdown(event.starts_at)}</Text>
                  </View>
                  <View style={styles.upcomingCampfireTextBlock}>
                    <Text style={styles.upcomingCampfireTitle} numberOfLines={2}>{event.title}</Text>
                    <Text style={styles.upcomingCampfireMeta} numberOfLines={1}>{shortDate(event.starts_at)} · {shortTime(event.starts_at)}</Text>
                    <Text style={styles.upcomingCampfireMeta} numberOfLines={1}>{event.venue_name ? `${event.venue_name} · ` : ''}{event.city}, {event.state}</Text>
                  </View>
                  <View style={styles.upcomingCampfireFooter}>
                    <Text style={styles.upcomingCampfirePeople}>{event.rsvp_count} {event.rsvp_count === 1 ? 'person' : 'people'} going</Text>
                    <Text style={styles.upcomingCampfireLink}>View Campfire →</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {featured.length ? (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Featured Adventures</Text>
            <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.linkBare}>See all →</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactRow}>
            {featured.map((item) => (
              <Pressable key={item.id} style={styles.compactCard} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}>
                <AdventureImageBackground uri={item.hero_image_url} style={styles.compactImage} imageStyle={styles.compactRadius}>
                  <View style={styles.compactShade} />
                  <View style={styles.compactBody}>
                    {item.is_demo ? <Text style={styles.compactEyebrow}>DEMO</Text> : item.is_featured ? <Text style={styles.compactEyebrow}>FEATURED</Text> : null}
                    <Text style={styles.compactTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.compactMeta} numberOfLines={1}>{shortDate(item.starts_at)} · {item.city}</Text>
                  </View>
                </AdventureImageBackground>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.campfireSection}>
        <View style={styles.campfireTopRow}>
          <Text style={styles.campfireTitle}>Around the Campfire</Text>
          <Pressable onPress={() => session ? router.push('/(tabs)/community') : promptForAccount('Campfire')} accessibilityRole="button"><Text style={styles.linkBare}>{session ? 'See all →' : 'Sign in →'}</Text></Pressable>
        </View>
        {session ? (
          <View style={styles.campfireSwitch} accessibilityRole="tablist">
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: campfireMode === 'general' }} style={[styles.campfireSwitchButton, campfireMode === 'general' && styles.campfireSwitchActive]} onPress={() => setCampfireMode('general')}>
              <Text style={[styles.campfireSwitchText, campfireMode === 'general' && styles.campfireSwitchTextActive]}>General</Text>
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: campfireMode === 'circle' }} style={[styles.campfireSwitchButton, campfireMode === 'circle' && styles.campfireSwitchActive]} onPress={() => setCampfireMode('circle')}>
              <Text style={[styles.campfireSwitchText, campfireMode === 'circle' && styles.campfireSwitchTextActive]}>Crew</Text>
            </Pressable>
          </View>
        ) : null}
        {session && campfirePosts.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={CAMPFIRE_CARD_WIDTH + 12} contentContainerStyle={styles.campfireCardRow}>
            {campfirePosts.map((post) => (
              <Pressable
                key={post.id}
                style={({ pressed }) => [styles.campfireCard, pressed && styles.campfirePostPressed]}
                onPress={() => router.push(`/community/${post.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open photo post from ${post.author_name}`}
              >
                <Image source={{ uri: post.image_url! }} style={styles.campfireCardImage} />
                <View pointerEvents="none" style={styles.campfireCardShade} />
                <View style={styles.campfireCardContent}>
                  <View style={styles.campfireAuthorRow}>
                    <View style={styles.campfireAvatar}>
                      {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.campfireAvatarImage} /> : <Text style={styles.campfireAvatarText}>{initials(post.author_name)}</Text>}
                    </View>
                    <Text style={styles.campfireAuthor} numberOfLines={1}>{post.author_name}</Text>
                    <Text style={styles.campfireTime}>{relativeTime(post.created_at)}</Text>
                  </View>
                  <Text style={styles.campfirePostText} numberOfLines={2}>{post.body}</Text>
                  <View style={styles.campfireEngagementRow}>
                    <Text style={styles.campfireEngagement}>♡ {post.reaction_count || 0}</Text>
                    <Text style={styles.campfireEngagement}>◯ {post.comment_count || 0}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.campfireEmpty}>
            <Text style={styles.campfireEmptyTitle}>{session ? (campfireMode === 'circle' && circleCount === 0 ? 'Your Crew starts here.' : 'No photo posts around the fire yet.') : 'Meet your outdoor community.'}</Text>
            <Text style={styles.campfireEmptyText}>{session ? (campfireMode === 'circle' && circleCount === 0 ? 'Join or create a Crew to see Crew photo posts here.' : campfireMode === 'circle' ? 'Photo posts from your Crews will show up here.' : 'Recent community photo posts will show up here.') : 'Sign in to join Campfire conversations, groups, and crews.'}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1713' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48, gap: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 58 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  brandMark: { width: 50, height: 50 },
  pageTitle: { color: '#F6F4EE', fontSize: 15, fontWeight: '900', letterSpacing: 2.2 },
  topActions: { flexDirection: 'row', gap: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#405047', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  loader: { margin: 18 },
  error: { color: '#FFB4A9' },
  section: { gap: 11 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 26, fontWeight: '900', flexShrink: 1 },
  count: { color: '#95A39A', fontSize: 12, fontWeight: '700' },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 8 },
  linkBare: { color: '#D7B45A', fontWeight: '900' },
  compactRow: { gap: 10, paddingRight: 18 },
  compactCard: { width: COMPACT_CARD_WIDTH },
  compactImage: { height: 166, justifyContent: 'flex-end', borderRadius: 18, overflow: 'hidden', backgroundColor: '#26372D' },
  compactRadius: { borderRadius: 18 },
  compactShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,10,8,0.38)' },
  compactBody: { padding: 12, gap: 4 },
  compactEyebrow: { alignSelf: 'flex-start', color: '#17211C', backgroundColor: '#E3C350', borderRadius: 7, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginBottom: 2 },
  compactTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 19, fontWeight: '900' },
  compactMeta: { color: '#D7DFDA', fontSize: 11, fontWeight: '700' },
  wideRow: { gap: 12, paddingRight: 18 },
  wideCard: { width: WIDE_CARD_WIDTH },
  wideImage: { height: 206, justifyContent: 'flex-end', borderRadius: 22, overflow: 'hidden', backgroundColor: '#26372D' },
  wideRadius: { borderRadius: 22 },
  wideShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,10,8,0.46)' },
  wideBody: { padding: 16, gap: 6 },
  wideTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  wideLabel: { color: '#142019', backgroundColor: '#E3C350', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  wideCountdown: { color: '#FFF8E8', fontSize: 11, fontWeight: '800', backgroundColor: 'rgba(10,16,13,0.72)', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  wideTitle: { color: '#FFF8E8', fontSize: 23, lineHeight: 26, fontWeight: '900' },
  wideMeta: { color: '#D8E0DB', fontSize: 12, fontWeight: '700' },
  wideFooter: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  wideLink: { color: '#F0D083', fontSize: 12, fontWeight: '900' },
  emptyAdventureCard: { minHeight: 112, borderRadius: 20, borderWidth: 1, borderColor: '#34463C', backgroundColor: '#17211C', paddingHorizontal: 18, paddingVertical: 16, justifyContent: 'center' },
  emptyAdventureTitle: { color: '#FFF8E8', fontSize: 19, lineHeight: 23, fontWeight: '900' },
  emptyAdventureText: { color: '#AFC0B6', fontSize: 12, lineHeight: 17, marginTop: 4 },
  upcomingCampfireRow: { gap: 12, paddingRight: 18 },
  upcomingCampfireCard: { width: UPCOMING_CAMPFIRE_CARD_WIDTH, height: 190, borderRadius: 20, overflow: 'hidden', backgroundColor: '#203128', borderWidth: 1, borderColor: '#3B4B42' },
  upcomingCampfireImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', resizeMode: 'cover' },
  upcomingCampfireFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#23362B' },
  upcomingCampfireShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,9,7,0.50)' },
  upcomingCampfireBody: { flex: 1, padding: 14, justifyContent: 'space-between', gap: 8 },
  upcomingCampfireTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  upcomingCampfireGoing: { color: '#17211C', backgroundColor: '#E3C350', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  upcomingCampfireCountdown: { color: '#FFF8E8', fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(10,16,13,0.76)', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5 },
  upcomingCampfireTextBlock: { gap: 3 },
  upcomingCampfireTitle: { color: '#FFF8E8', fontSize: 20, lineHeight: 23, fontWeight: '900' },
  upcomingCampfireMeta: { color: '#D8E0DB', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  upcomingCampfireFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  upcomingCampfirePeople: { color: '#D4DDD8', fontSize: 10, fontWeight: '700', flexShrink: 1 },
  upcomingCampfireLink: { color: '#F0D083', fontSize: 11, fontWeight: '900' },
  campfireSection: { gap: 10, paddingTop: 2 },
  campfireTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  campfireTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 26, fontWeight: '900', flexShrink: 1 },
  campfireSwitch: { alignSelf: 'flex-start', flexDirection: 'row', backgroundColor: '#132019', borderRadius: 999, padding: 3, gap: 2, borderWidth: 1, borderColor: '#31443A' },
  campfireSwitchButton: { minWidth: 82, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, alignItems: 'center' },
  campfireSwitchActive: { backgroundColor: '#D7B45A' },
  campfireSwitchText: { color: '#AFC0B6', fontSize: 11, fontWeight: '800' },
  campfireSwitchTextActive: { color: '#17211C' },
  campfireCardRow: { gap: 12, paddingRight: 26 },
  campfireCard: { width: CAMPFIRE_CARD_WIDTH, height: 280, borderRadius: 18, overflow: 'hidden', backgroundColor: '#121D18', borderWidth: 1, borderColor: '#2B3B33' },
  campfirePostPressed: { opacity: 0.78 },
  campfireCardImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', resizeMode: 'cover' },
  campfireCardShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,8,7,0.10)' },
  campfireCardContent: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 112, paddingHorizontal: 12, paddingVertical: 10, gap: 6, justifyContent: 'space-between', backgroundColor: 'rgba(5,10,8,0.82)' },
  campfireAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  campfireAvatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' },
  campfireAvatarImage: { width: '100%', height: '100%' },
  campfireAvatarText: { color: '#F0D083', fontSize: 9, fontWeight: '900' },
  campfireAuthor: { color: '#FFF8E8', fontSize: 12, lineHeight: 15, fontWeight: '900', flexShrink: 1, maxWidth: '64%' },
  campfireTime: { color: '#9BA7A0', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  campfirePostText: { color: '#FFF8E8', fontSize: 13.5, lineHeight: 17, fontWeight: '800', minHeight: 34 },
  campfireEngagementRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 16 },
  campfireEngagement: { color: '#C4CEC8', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  campfireEmpty: { borderRadius: 17, borderWidth: 1, borderColor: '#2B3B33', backgroundColor: '#121D18', padding: 14, gap: 4 },
  campfireEmptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  campfireEmptyText: { color: '#9FAAA4', fontSize: 12, lineHeight: 17 },
});