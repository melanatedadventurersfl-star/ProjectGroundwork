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
import { getCommunityFeed, getGroups, type CommunityPost } from '../../src/community/api';
import { getCircles, getConnections } from '../../src/community/circles';
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
const WIDE_CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 430);
const SAVED_CARD_WIDTH = Math.min(Math.max(SCREEN_WIDTH * 0.66, 220), 276);
const OUTING_CARD_WIDTH = Math.min(Math.max(SCREEN_WIDTH * 0.76, 260), 318);
const CAMPFIRE_CARD_WIDTH = Math.min(Math.max(SCREEN_WIDTH * 0.64, 214), 264);

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function outingDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function outingTime(value: string) {
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

function outingReason(event: LocalEvent, joinedGroupIds: Set<string>) {
  if (event.my_rsvp === 'going') return 'You’re going';
  if (event.my_rsvp === 'interested') return 'You’re interested';
  if (event.group_id && joinedGroupIds.has(event.group_id)) return 'In your community';
  return 'Nearby outing';
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
  const [connectionIds, setConnectionIds] = useState<Set<string>>(new Set());
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [circleIds, setCircleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const reservedAdventureIds = useMemo(
    () => new Set(reservedAdventures.map((item) => item.adventure_id)),
    [reservedAdventures],
  );

  const savedAdventures = useMemo(() => {
    const now = Date.now();
    return adventures
      .filter((item) => item.is_saved)
      .sort((a, b) => {
        const aTime = new Date(a.starts_at).getTime();
        const bTime = new Date(b.starts_at).getTime();
        const aPast = aTime < now;
        const bPast = bTime < now;
        if (aPast !== bPast) return aPast ? 1 : -1;
        return aPast ? bTime - aTime : aTime - bTime;
      })
      .slice(0, 6);
  }, [adventures]);

  const memberRank = useMemo(() => rankFor(completedCount), [completedCount]);

  const upcomingOutings = useMemo(() => {
    const rank = (event: LocalEvent) => {
      if (event.my_rsvp === 'going') return 0;
      if (event.my_rsvp === 'interested') return 1;
      if (event.group_id && joinedGroupIds.has(event.group_id)) return 2;
      return 3;
    };
    return [...localEvents]
      .sort((a, b) => rank(a) - rank(b) || new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 6);
  }, [localEvents, joinedGroupIds]);

  const campfirePosts = useMemo(() => {
    const userId = session?.user.id;
    if (!userId) return [];

    return communityPosts
      .filter((post) => {
        if (!post.image_url?.trim()) return false;
        if (post.author_id === userId) return true;
        if (connectionIds.has(post.author_id)) return true;
        if (post.audience === 'connections') return true;
        if (post.audience === 'circle' && post.circle_id && circleIds.has(post.circle_id)) return true;
        if (post.audience === 'group' && post.group_id && joinedGroupIds.has(post.group_id)) return true;
        if (post.adventure_id && reservedAdventureIds.has(post.adventure_id)) return true;
        return false;
      })
      .slice(0, 4);
  }, [communityPosts, connectionIds, joinedGroupIds, circleIds, reservedAdventureIds, session?.user.id]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const userId = session?.user.id;
      const [nextQueue, nextJourney, nextAdventures, nextEvents, profileResult, nextPosts, nextCircles, nextConnections, nextGroups] = await Promise.all([
        userId ? getAdventureQueue() : Promise.resolve([] as AdventureQueueItem[]),
        userId ? getJourney() : Promise.resolve([]),
        listAdventures(),
        listLocalEvents().catch(() => [] as LocalEvent[]),
        userId ? supabase.from('profiles').select('*').eq('id', userId).single() : Promise.resolve({ data: null, error: null }),
        userId ? getCommunityFeed().catch(() => [] as CommunityPost[]) : Promise.resolve([] as CommunityPost[]),
        userId ? getCircles().catch(() => []) : Promise.resolve([]),
        userId ? getConnections().catch(() => []) : Promise.resolve([]),
        userId ? getGroups().catch(() => []) : Promise.resolve([]),
      ]);

      setQueue(nextQueue);
      setCompletedCount(nextJourney.length);
      setAdventures(nextAdventures);
      setLocalEvents(nextEvents);
      setCommunityPosts(nextPosts);
      setCircleIds(new Set(nextCircles.map((circle) => circle.id)));
      setConnectionIds(new Set(nextConnections.filter((connection) => connection.status === 'accepted').map((connection) => connection.profile_id)));
      setJoinedGroupIds(new Set(nextGroups.filter((group) => group.is_member).map((group) => group.id)));

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
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Your Next Adventure</Text>
            <Text style={styles.sectionSubtitle}>What you’re doing next.</Text>
          </View>
          {reservedAdventures.length > 1 ? <Text style={styles.count}>{reservedAdventures.length} reserved</Text> : null}
        </View>
        {reservedAdventures.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={WIDE_CARD_WIDTH + 12} decelerationRate="fast" contentContainerStyle={styles.wideRow}>
            {reservedAdventures.map((item, index) => {
              const adventure = adventureById.get(item.adventure_id);
              return (
                <Pressable key={item.adventure_id} style={styles.wideCard} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => router.push({ pathname: '/readiness/[orderId]', params: { orderId: item.order_id } })}>
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

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Saved Adventures</Text>
            <Text style={styles.sectionSubtitle}>The adventures you bookmarked to come back to.</Text>
          </View>
          {savedAdventures.length ? <Text style={styles.count}>{savedAdventures.length} saved</Text> : null}
        </View>
        {session && savedAdventures.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={SAVED_CARD_WIDTH + 12} contentContainerStyle={styles.savedRow}>
            {savedAdventures.map((adventure) => (
              <Pressable key={adventure.id} style={styles.savedCard} accessibilityRole="button" accessibilityLabel={`Open saved adventure ${adventure.title}`} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: adventure.id } })}>
                <AdventureImageBackground uri={adventure.hero_image_url} style={styles.savedImage} imageStyle={styles.savedImageRadius}>
                  <View style={styles.savedShade} />
                  <View style={styles.savedTopRow}>
                    <View style={styles.savedBadge}><AppIcon name="bookmark" color="#17211C" size={13} /><Text style={styles.savedBadgeText}>SAVED</Text></View>
                    <Text style={styles.savedDate}>{shortDate(adventure.starts_at)}</Text>
                  </View>
                </AdventureImageBackground>
                <View style={styles.savedBody}>
                  <Text style={styles.savedTitle} numberOfLines={2}>{adventure.title}</Text>
                  <Text style={styles.savedMeta} numberOfLines={1}>{adventure.category} · {adventure.city}, {adventure.state}</Text>
                  <Text style={styles.savedLink}>View adventure →</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Pressable style={styles.emptySavedCard} onPress={() => session ? router.push('/(tabs)/explore') : promptForAccount('Saved adventures')}>
            <View style={styles.emptySavedIcon}><AppIcon name="bookmark" color="#D7B45A" size={22} /></View>
            <View style={styles.emptySavedCopy}>
              <Text style={styles.emptySavedTitle}>{session ? 'Nothing saved yet.' : 'Keep adventures for later.'}</Text>
              <Text style={styles.emptySavedText}>{session ? 'Tap the bookmark on any adventure and it’ll live here on your Trailhead.' : 'Sign in to save adventures and find them here anytime.'}</Text>
              <Text style={styles.link}>{session ? 'Explore Adventures →' : 'Sign in →'}</Text>
            </View>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Upcoming Outings</Text>
            <Text style={styles.sectionSubtitle}>Gatherings from your communities and nearby.</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/community')}><Text style={styles.linkBare}>See all Outings →</Text></Pressable>
        </View>
        {upcomingOutings.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={OUTING_CARD_WIDTH + 12} contentContainerStyle={styles.outingRow}>
            {upcomingOutings.map((event) => (
              <Pressable key={event.id} style={styles.outingCard} accessibilityRole="button" accessibilityLabel={`Open outing ${event.title}`} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
                <View style={styles.outingImageWrap}>
                  {event.image_url ? <Image source={{ uri: event.image_url }} style={styles.outingImage} /> : <View style={styles.outingImageFallback}><AppIcon name="map" color="#D7B45A" size={28} /></View>}
                  <View style={styles.outingImageShade} />
                  <Text style={styles.outingCountdown}>{countdown(event.starts_at)}</Text>
                </View>
                <View style={styles.outingBody}>
                  <View style={styles.outingReasonRow}>
                    <Text style={styles.outingReason}>{outingReason(event, joinedGroupIds)}</Text>
                    <Text style={styles.outingRsvpCount}>{event.rsvp_count} attending</Text>
                  </View>
                  <Text style={styles.outingTitle} numberOfLines={2}>{event.title}</Text>
                  <Text style={styles.outingMeta}>{outingDate(event.starts_at)} · {outingTime(event.starts_at)}</Text>
                  <Text style={styles.outingMeta} numberOfLines={1}>{event.venue_name ? `${event.venue_name} · ` : ''}{event.city}, {event.state}</Text>
                  <View style={styles.outingFooter}>
                    <Text style={styles.outingHost} numberOfLines={1}>Hosted by {event.host_name}</Text>
                    <Text style={styles.outingLink}>View outing →</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No upcoming outings yet.</Text>
            <Text style={styles.emptyText}>When your communities plan something or a nearby outing opens up, it’ll show up here.</Text>
          </View>
        )}
      </View>

      <View style={styles.campfireSection}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionHeading}>
            <Text style={styles.campfireTitle}>Around the Campfire</Text>
            <Text style={styles.sectionSubtitle}>Updates from your trailmates, crews, groups, and upcoming adventures.</Text>
          </View>
          <Pressable onPress={() => session ? router.push('/(tabs)/community') : promptForAccount('Campfire')} accessibilityRole="button"><Text style={styles.linkBare}>{session ? 'See all →' : 'Sign in →'}</Text></Pressable>
        </View>
        {session && campfirePosts.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={CAMPFIRE_CARD_WIDTH + 12} contentContainerStyle={styles.campfireCardRow}>
            {campfirePosts.map((post) => (
              <Pressable key={post.id} style={({ pressed }) => [styles.campfireCard, pressed && styles.campfirePostPressed]} onPress={() => router.push(`/community/${post.id}`)} accessibilityRole="button" accessibilityLabel={`Open photo post from ${post.author_name}`}>
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{session ? 'Your circle is quiet right now.' : 'Meet your outdoor community.'}</Text>
            <Text style={styles.emptyText}>{session ? 'Posts from your trailmates, crews, groups, and adventures will show up here.' : 'Sign in to see what your trailmates and communities are doing.'}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1713' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48, gap: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 58 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  brandMark: { width: 50, height: 50 },
  pageTitle: { color: '#F6F4EE', fontSize: 15, fontWeight: '900', letterSpacing: 2.2 },
  topActions: { flexDirection: 'row', gap: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#405047', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  loader: { margin: 18 },
  error: { color: '#FFB4A9' },
  section: { gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  sectionHeading: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 26, fontWeight: '900', flexShrink: 1 },
  sectionSubtitle: { color: '#91A096', fontSize: 11.5, lineHeight: 16, fontWeight: '600' },
  count: { color: '#95A39A', fontSize: 12, fontWeight: '700', paddingTop: 5 },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 8 },
  linkBare: { color: '#D7B45A', fontWeight: '900', fontSize: 11.5, paddingTop: 5 },
  wideRow: { gap: 12, paddingRight: 18 },
  wideCard: { width: WIDE_CARD_WIDTH },
  wideImage: { height: 206, justifyContent: 'flex-end', borderRadius: 22, overflow: 'hidden', backgroundColor: '#26372D' },
  wideRadius: { borderRadius: 22 },
  wideShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,8,0.46)' },
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
  savedRow: { gap: 12, paddingRight: 24 },
  savedCard: { width: SAVED_CARD_WIDTH, borderRadius: 18, overflow: 'hidden', backgroundColor: '#17211C', borderWidth: 1, borderColor: '#31443A' },
  savedImage: { height: 132, padding: 10, backgroundColor: '#26372D' },
  savedImageRadius: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  savedShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.16)' },
  savedTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3C350', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  savedBadgeText: { color: '#17211C', fontSize: 8.5, lineHeight: 10, fontWeight: '900', letterSpacing: 0.6 },
  savedDate: { color: '#FFF8E8', backgroundColor: 'rgba(10,16,13,0.78)', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 9.5, fontWeight: '800' },
  savedBody: { padding: 12, gap: 4 },
  savedTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  savedMeta: { color: '#B8C4BD', fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  savedLink: { color: '#F0D083', fontSize: 10.5, fontWeight: '900', marginTop: 4 },
  emptySavedCard: { minHeight: 118, borderRadius: 18, borderWidth: 1, borderColor: '#31443A', backgroundColor: '#17211C', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptySavedIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#223128', alignItems: 'center', justifyContent: 'center' },
  emptySavedCopy: { flex: 1, minWidth: 0 },
  emptySavedTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  emptySavedText: { color: '#AFC0B6', fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  outingRow: { gap: 12, paddingRight: 24 },
  outingCard: { width: OUTING_CARD_WIDTH, borderRadius: 18, overflow: 'hidden', backgroundColor: '#17211C', borderWidth: 1, borderColor: '#31443A' },
  outingImageWrap: { height: 112, backgroundColor: '#203128', position: 'relative' },
  outingImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  outingImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outingImageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.12)' },
  outingCountdown: { position: 'absolute', top: 10, right: 10, color: '#FFF8E8', backgroundColor: 'rgba(10,16,13,0.78)', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: '800' },
  outingBody: { padding: 12, gap: 4 },
  outingReasonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  outingReason: { color: '#17211C', backgroundColor: '#E3C350', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 8.5, fontWeight: '900' },
  outingRsvpCount: { color: '#97A79D', fontSize: 9.5, fontWeight: '700' },
  outingTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 2 },
  outingMeta: { color: '#C7D1CB', fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  outingFooter: { marginTop: 4, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#2A3A31', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  outingHost: { color: '#9EACA3', fontSize: 9.5, fontWeight: '700', flex: 1 },
  outingLink: { color: '#F0D083', fontSize: 10.5, fontWeight: '900' },
  campfireSection: { gap: 10, paddingTop: 2 },
  campfireTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 26, fontWeight: '900', flexShrink: 1 },
  campfireCardRow: { gap: 12, paddingRight: 26 },
  campfireCard: { width: CAMPFIRE_CARD_WIDTH, height: 280, borderRadius: 18, overflow: 'hidden', backgroundColor: '#121D18', borderWidth: 1, borderColor: '#2B3B33' },
  campfirePostPressed: { opacity: 0.78 },
  campfireCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  campfireCardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,8,7,0.10)' },
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
  emptyCard: { borderRadius: 17, borderWidth: 1, borderColor: '#2B3B33', backgroundColor: '#121D18', padding: 14, gap: 4 },
  emptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  emptyText: { color: '#9FAAA4', fontSize: 12, lineHeight: 17 },
});