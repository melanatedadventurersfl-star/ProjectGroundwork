import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listAdventures } from '../adventures/api';
import type { AdventureSummary } from '../adventures/types';
import { listLocalEvents, setLocalEventRsvp, type LocalEvent } from '../local-events/api';
import { getMemberBasecamp } from '../member/api';
import { TRAIL_GUIDE_CITIES, TRAIL_GUIDE_DEFAULT_BACKGROUND } from '../trailGuide/locationBackgrounds';
import { getCommunityFeed, getGroups, type CommunityGroup, type CommunityPost } from './api';
import { getConnections, type Connection } from './circles';
import { isPeopleCommunity, communityOwnershipLabel } from './communityModel';
import { FeaturedCampfireCarousel } from './FeaturedCampfireCarousel';
import { PostEngagementBar } from './PostEngagementBar';
import { selectFeaturedPosts, selectSecondaryFeed } from './featuredPosts';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const SURFACE = '#16201B';
const SURFACE_2 = '#101A15';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const GREEN = '#7F9D68';

function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GM';
}

function normalizePlace(value?: string | null) {
  return value?.trim().toLowerCase().replace(/florida/g, 'fl').replace(/[^a-z0-9]+/g, '-') ?? '';
}

function sameLocation(cityA?: string | null, stateA?: string | null, cityB?: string | null, stateB?: string | null) {
  if (!cityA || !cityB) return false;
  const stateOne = normalizePlace(stateA);
  const stateTwo = normalizePlace(stateB);
  return normalizePlace(cityA) === normalizePlace(cityB) && (!stateOne || !stateTwo || stateOne === stateTwo);
}

function locationBackground(city?: string | null, state?: string | null): ImageSourcePropType {
  if (!city) return TRAIL_GUIDE_DEFAULT_BACKGROUND;
  const cityKey = normalizePlace(city);
  const region = normalizePlace(state);
  if (region && region !== 'fl') return TRAIL_GUIDE_DEFAULT_BACKGROUND;
  return TRAIL_GUIDE_CITIES.find((item) => item.key === cityKey)?.source ?? TRAIL_GUIDE_DEFAULT_BACKGROUND;
}

function relativeTime(value: string, now: number) {
  const diff = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function campfireEyebrow(hour: number) {
  if (hour < 12) return 'THIS MORNING AROUND THE CAMPFIRE';
  if (hour < 17) return 'THIS AFTERNOON AROUND THE CAMPFIRE';
  return 'TONIGHT AROUND THE CAMPFIRE';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function ConversationCard({ post, group, now }: { post: CommunityPost; group?: CommunityGroup; now: number }) {
  const media = post.image_url || (post.media_type === 'image' ? post.media_url : null);
  return (
    <Pressable style={({ pressed }) => [styles.conversationCard, pressed && styles.pressed]} onPress={() => router.push(`/community/${post.id}`)}>
      <View style={styles.contextLine}>
        <Text style={styles.contextText} numberOfLines={1}>{group?.name?.toUpperCase() || 'OUTPOST'}</Text>
        <Text style={styles.contextTime}>{relativeTime(post.created_at, now)}</Text>
      </View>
      <Pressable style={styles.authorRow} onPress={(event) => { event.stopPropagation(); router.push({ pathname: '/community-profile/[id]', params: { id: post.author_id } }); }}>
        <View style={styles.avatar}>{post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}</View>
        <Text style={styles.authorName}>{post.author_name}</Text>
      </Pressable>
      {post.body ? <Text style={styles.conversationText} numberOfLines={4}>{post.body}</Text> : null}
      {media ? <Image source={{ uri: media }} style={styles.conversationImage} resizeMode="cover" /> : null}
      <View style={styles.engagement}><PostEngagementBar postId={post.id} initialReactionCount={post.reaction_count || 0} commentCount={post.comment_count || 0} /></View>
    </Pressable>
  );
}

function CommunityRow({ group, latest, now }: { group: CommunityGroup; latest?: CommunityPost; now: number }) {
  const cover = group.cover_image_url || group.image_url;
  const status = latest ? `${latest.author_name} posted · ${relativeTime(latest.created_at, now)}` : `${group.member_count} member${group.member_count === 1 ? '' : 's'}`;
  return (
    <Pressable style={({ pressed }) => [styles.communityRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}>
      <View style={styles.communityImageWrap}>{cover ? <Image source={{ uri: cover }} style={styles.communityImage} /> : <Text style={styles.communityInitials}>{initials(group.name)}</Text>}</View>
      <View style={styles.flex}>
        <Text style={styles.communityName} numberOfLines={1}>{group.name}</Text>
        <Text style={styles.communityOwner} numberOfLines={1}>{communityOwnershipLabel(group)}</Text>
        <Text style={[styles.communityActivity, Boolean(latest) && styles.communityActivityLive]} numberOfLines={1}>{status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={GOLD} />
    </Pressable>
  );
}

type UpcomingItem =
  | { kind: 'adventure'; value: AdventureSummary }
  | { kind: 'local'; value: LocalEvent };

function UpcomingCard({ item, onInterested }: { item: UpcomingItem; onInterested: (event: LocalEvent) => void }) {
  if (item.kind === 'adventure') {
    const event = item.value;
    return (
      <Pressable style={({ pressed }) => [styles.upcomingCard, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: event.id } })}>
        {event.hero_image_url ? <Image source={{ uri: event.hero_image_url }} style={styles.upcomingImage} /> : <View style={[styles.upcomingImage, styles.eventFallback]}><Ionicons name="trail-sign-outline" size={30} color={GOLD} /></View>}
        <View style={styles.upcomingBody}>
          <Text style={styles.upcomingEyebrow}>HOST OUTING</Text>
          <Text style={styles.upcomingTitle} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.upcomingMeta}>{formatDate(event.starts_at)}</Text>
          <Text style={styles.upcomingMeta} numberOfLines={1}>{[event.venue_name || event.city, event.state].filter(Boolean).join(', ')}</Text>
          <View style={styles.tagRow}><View style={styles.tag}><Text style={styles.tagText}>{event.category}</Text></View></View>
        </View>
      </Pressable>
    );
  }

  const event = item.value;
  return (
    <Pressable style={({ pressed }) => [styles.upcomingCard, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      {event.image_url ? <Image source={{ uri: event.image_url }} style={styles.upcomingImage} /> : <View style={[styles.upcomingImage, styles.eventFallback]}><Ionicons name="calendar-outline" size={30} color={GOLD} /></View>}
      <View style={styles.upcomingBody}>
        <Text style={styles.upcomingEyebrow}>OUTING</Text>
        <Text style={styles.upcomingTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.upcomingMeta}>{formatDate(event.starts_at)}</Text>
        <Text style={styles.upcomingMeta} numberOfLines={1}>{[event.venue_name || event.city, event.state].filter(Boolean).join(', ')}</Text>
        {!event.my_rsvp || event.my_rsvp === 'cancelled' ? <Pressable style={styles.interestedButton} onPress={(tap) => { tap.stopPropagation(); onInterested(event); }}><Text style={styles.interestedText}>Interested</Text></Pressable> : <Text style={styles.rsvpText}>{event.my_rsvp === 'going' ? 'You’re going' : 'Interested'}</Text>}
      </View>
    </Pressable>
  );
}

export default function OutpostUnifiedScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [feed, setFeed] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageScrollEnabled, setPageScrollEnabled] = useState(true);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    const [feedResult, groupsResult, eventsResult, adventuresResult, profileResult, connectionsResult] = await Promise.allSettled([
      getCommunityFeed(),
      getGroups(),
      listLocalEvents(),
      listAdventures({}),
      getMemberBasecamp(),
      getConnections(),
    ]);
    if (feedResult.status === 'fulfilled') setFeed(feedResult.value);
    if (groupsResult.status === 'fulfilled') setGroups(groupsResult.value);
    if (eventsResult.status === 'fulfilled') setLocalEvents(eventsResult.value);
    if (adventuresResult.status === 'fulfilled') setAdventures(adventuresResult.value.filter((item) => new Date(item.ends_at).getTime() >= Date.now()));
    if (connectionsResult.status === 'fulfilled') setConnections(connectionsResult.value);
    if (profileResult.status === 'fulfilled') {
      setHomeCity((profileResult.value.profile?.home_city as string | null | undefined) ?? null);
      setHomeState((profileResult.value.profile?.home_state as string | null | undefined) ?? null);
    }
    setLoadedAt(Date.now());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const peopleGroups = useMemo(() => groups.filter(isPeopleCommunity), [groups]);
  const joinedGroups = useMemo(() => peopleGroups.filter((group) => group.is_member), [peopleGroups]);
  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const eventMap = useMemo(() => new Map(localEvents.map((event) => [event.id, event])), [localEvents]);
  const latestByGroup = useMemo(() => {
    const map = new Map<string, CommunityPost>();
    for (const post of feed.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())) {
      if (post.group_id && !map.has(post.group_id)) map.set(post.group_id, post);
    }
    return map;
  }, [feed]);

  const trailmates = useMemo(() => connections.filter((row) => row.status === 'accepted'), [connections]);
  const trailmateIds = useMemo(() => new Set(trailmates.map((row) => row.profile_id)), [trailmates]);
  const nearbyTrailmateIds = useMemo(() => new Set(trailmates.filter((row) => sameLocation(row.home_city, row.home_state, homeCity, homeState)).map((row) => row.profile_id)), [trailmates, homeCity, homeState]);
  const nearbyGroupIds = useMemo(() => new Set(groups.filter((group) => sameLocation(group.city, group.state, homeCity, homeState)).map((group) => group.id)), [groups, homeCity, homeState]);
  const eventIds = useMemo(() => new Set(localEvents.map((event) => event.id)), [localEvents]);
  const rankingContext = useMemo(() => ({
    joinedGroupIds: new Set(joinedGroups.map((group) => group.id)),
    nearbyGroupIds,
    trailmateIds,
    nearbyTrailmateIds,
    eventIds,
    now: loadedAt,
  }), [joinedGroups, nearbyGroupIds, trailmateIds, nearbyTrailmateIds, eventIds, loadedAt]);

  const featuredPosts = useMemo(() => selectFeaturedPosts(feed, 'for-you', rankingContext, 8), [feed, rankingContext]);
  const displayedPosts = useMemo(() => selectSecondaryFeed(feed, featuredPosts, 'for-you', rankingContext, 4), [feed, featuredPosts, rankingContext]);
  const locationLabel = [homeCity, homeState].filter(Boolean).join(', ') || 'Your area';
  const outpostBackground = useMemo(() => locationBackground(homeCity, homeState), [homeCity, homeState]);
  const campfireLabel = useMemo(() => campfireEyebrow(new Date(loadedAt).getHours()), [loadedAt]);

  const upcoming = useMemo<UpcomingItem[]>(() => {
    const adventureItems = adventures.map((value) => ({ kind: 'adventure' as const, value }));
    const localItems = localEvents.map((value) => ({ kind: 'local' as const, value }));
    return [...adventureItems, ...localItems]
      .sort((a, b) => {
        const aLocal = Number(sameLocation(a.value.city, a.value.state, homeCity, homeState));
        const bLocal = Number(sameLocation(b.value.city, b.value.state, homeCity, homeState));
        if (aLocal !== bLocal) return bLocal - aLocal;
        return new Date(a.value.starts_at).getTime() - new Date(b.value.starts_at).getTime();
      })
      .slice(0, 6);
  }, [adventures, localEvents, homeCity, homeState]);

  const handleInterested = useCallback(async (event: LocalEvent) => {
    try {
      await setLocalEventRsvp(event.id, 'interested');
      setLocalEvents((current) => current.map((item) => item.id === event.id ? { ...item, my_rsvp: 'interested' } : item));
    } catch {
      // Event detail remains available if the optimistic action fails.
    }
  }, []);

  if (loading && !feed.length && !groups.length && !localEvents.length && !adventures.length) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator color={GOLD} /><Text style={styles.loadingText}>Gathering the Outpost…</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        scrollEnabled={pageScrollEnabled}
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={GOLD} />}
      >
        <ImageBackground source={outpostBackground} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}><Ionicons name="location-outline" size={12} color={GOLD} /><Text style={styles.heroBadgeText}>YOUR LOCAL OUTPOST</Text></View>
            <View style={styles.heroBottomRow}>
              <Text style={styles.title}>Outpost</Text>
              <View style={styles.locationRow}><Ionicons name="location" size={14} color={GOLD} /><Text style={styles.locationText}>{locationLabel}</Text></View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.sectionIntro}>
          <Text style={styles.sectionEyebrow}>{campfireLabel}</Text>
          <Text style={styles.sectionLead}>What your Outpost is sharing right now.</Text>
        </View>

        <FeaturedCampfireCarousel
          posts={featuredPosts}
          groups={groupMap}
          events={eventMap}
          fallbackSource={outpostBackground}
          viewportWidth={Math.max(300, windowWidth - 36)}
          activeIndex={featuredIndex}
          onIndexChange={setFeaturedIndex}
          onExploreCommunities={() => router.push('/communities' as never)}
          onVerticalGestureActive={(active) => setPageScrollEnabled(!active)}
        />

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Happening now</Text><Text style={styles.sectionSubtitle}>Conversation worth stepping into.</Text></View>
        {displayedPosts.length ? displayedPosts.map((post) => <ConversationCard key={post.id} post={post} group={post.group_id ? groupMap.get(post.group_id) : undefined} now={loadedAt} />) : <View style={styles.emptyState}><Ionicons name="bonfire-outline" size={24} color={GREEN} /><Text style={styles.emptyTitle}>The fire’s quiet for a minute.</Text><Text style={styles.emptyCopy}>New conversations will appear here.</Text></View>}

        <View style={styles.sectionHeaderRow}>
          <View style={styles.flex}><Text style={styles.sectionTitle}>Coming up</Text><Text style={styles.sectionSubtitle}>Outings from hosts and your local community.</Text></View>
          <Pressable onPress={() => router.push('/(tabs)/explore' as never)}><Text style={styles.seeAll}>See all</Text></Pressable>
        </View>
        {upcoming.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingRail}>{upcoming.map((item) => <UpcomingCard key={`${item.kind}:${item.value.id}`} item={item} onInterested={handleInterested} />)}</ScrollView> : <View style={styles.emptyState}><Ionicons name="calendar-outline" size={24} color={GREEN} /><Text style={styles.emptyTitle}>Nothing scheduled yet.</Text><Text style={styles.emptyCopy}>Published host events and local outings will show up here.</Text></View>}

        <View style={styles.sectionHeaderRow}>
          <View style={styles.flex}><Text style={styles.sectionTitle}>Your Communities</Text><Text style={styles.sectionSubtitle}>Groups you belong to, ordered by activity.</Text></View>
          <Pressable onPress={() => router.push('/communities' as never)}><Text style={styles.seeAll}>See all</Text></Pressable>
        </View>
        {joinedGroups.length ? <View style={styles.communityList}>{joinedGroups.slice(0, 3).map((group) => <CommunityRow key={group.id} group={group} latest={latestByGroup.get(group.id)} now={loadedAt} />)}</View> : <View style={styles.emptyState}><Ionicons name="people-outline" size={24} color={GREEN} /><Text style={styles.emptyTitle}>Find a community that has people behind it.</Text><Text style={styles.emptyCopy}>Communities are groups run by hosts, members, or Go Melanated. Camping, hiking, and water stay as interests instead of separate rooms.</Text><Pressable style={styles.emptyButton} onPress={() => router.push('/communities' as never)}><Text style={styles.emptyButtonText}>Find Communities</Text></Pressable></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 56 },
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: MUTED, fontSize: 14, fontWeight: '700' },
  hero: { minHeight: 142, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 8, backgroundColor: SURFACE },
  heroImage: { borderRadius: 22 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,11,8,0.53)' },
  heroContent: { paddingHorizontal: 16, paddingVertical: 14, paddingTop: 40 },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: 'rgba(12,21,16,0.78)', paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 },
  heroBadgeText: { color: TEXT, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  heroBottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  title: { color: TEXT, fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4, flexShrink: 1 },
  locationText: { color: '#F4E7BC', fontSize: 12, fontWeight: '800' },
  sectionIntro: { marginTop: 4, marginBottom: 6 },
  sectionEyebrow: { color: GOLD, fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  sectionLead: { color: TEXT, fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 2, letterSpacing: -0.15 },
  sectionHeader: { marginTop: 22, marginBottom: 9 },
  sectionHeaderRow: { marginTop: 25, marginBottom: 9, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: TEXT, fontSize: 23, lineHeight: 28, fontWeight: '900', letterSpacing: -0.45 },
  sectionSubtitle: { color: MUTED, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  seeAll: { color: GOLD, fontSize: 12, fontWeight: '900', paddingBottom: 2 },
  conversationCard: { marginBottom: 12, borderRadius: 18, backgroundColor: SURFACE, overflow: 'hidden', padding: 14 },
  contextLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  contextText: { color: GREEN, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.75, flexShrink: 1 },
  contextTime: { color: MUTED, fontSize: 10.5 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 13.5, fontWeight: '900' },
  conversationText: { color: TEXT, fontSize: 15.5, lineHeight: 22, fontWeight: '700', marginTop: 10 },
  conversationImage: { width: '100%', height: 200, borderRadius: 14, backgroundColor: SURFACE_2, marginTop: 11 },
  engagement: { marginTop: 10 },
  upcomingRail: { gap: 12, paddingRight: 22 },
  upcomingCard: { width: 270, borderRadius: 18, overflow: 'hidden', backgroundColor: SURFACE },
  upcomingImage: { width: '100%', height: 126, backgroundColor: SURFACE_2 },
  eventFallback: { alignItems: 'center', justifyContent: 'center' },
  upcomingBody: { padding: 12 },
  upcomingEyebrow: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 0.9, marginBottom: 4 },
  upcomingTitle: { color: TEXT, fontSize: 16, lineHeight: 20, fontWeight: '900' },
  upcomingMeta: { color: MUTED, fontSize: 11, lineHeight: 16, marginTop: 3 },
  tagRow: { flexDirection: 'row', marginTop: 9 },
  tag: { borderRadius: 999, backgroundColor: '#243127', paddingHorizontal: 8, paddingVertical: 5 },
  tagText: { color: '#DCE5DE', fontSize: 9.5, fontWeight: '800' },
  interestedButton: { alignSelf: 'flex-start', marginTop: 9, borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 10, paddingVertical: 6 },
  interestedText: { color: '#152019', fontSize: 10, fontWeight: '900' },
  rsvpText: { color: GOLD, fontSize: 10.5, fontWeight: '900', marginTop: 9 },
  communityList: { gap: 8 },
  communityRow: { minHeight: 78, borderRadius: 16, backgroundColor: SURFACE, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  communityImageWrap: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: '#27342C', alignItems: 'center', justifyContent: 'center' },
  communityImage: { width: '100%', height: '100%' },
  communityInitials: { color: GOLD, fontSize: 14, fontWeight: '900' },
  communityName: { color: TEXT, fontSize: 14.5, fontWeight: '900' },
  communityOwner: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  communityActivity: { color: MUTED, fontSize: 10.5, marginTop: 4 },
  communityActivityLive: { color: '#A9C79A' },
  emptyState: { borderRadius: 18, backgroundColor: '#141E19', padding: 17, alignItems: 'flex-start' },
  emptyTitle: { color: TEXT, fontSize: 15.5, fontWeight: '900', marginTop: 9 },
  emptyCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  emptyButton: { marginTop: 12, borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 8 },
  emptyButtonText: { color: '#152019', fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
