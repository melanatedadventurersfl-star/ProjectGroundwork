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

import { listLocalEvents, setLocalEventRsvp, type LocalEvent } from '../local-events/api';
import { getMemberBasecamp } from '../member/api';
import { TRAIL_GUIDE_CITIES, TRAIL_GUIDE_DEFAULT_BACKGROUND } from '../trailGuide/locationBackgrounds';
import { getCommunityFeed, getGroups, joinGroup, type CommunityGroup, type CommunityPost } from './api';
import { getConnections, type Connection } from './circles';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const SURFACE = '#16201B';
const SURFACE_2 = '#101A15';
const BORDER = '#2A382F';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const GREEN = '#7F9D68';

type Tab = 'campfires' | 'communities' | 'outings';
type FeedFilter = 'for-you' | 'latest' | 'nearby';
type PulseAvatar = { id: string; name: string; uri: string | null };

const tabs: { value: Tab; label: string }[] = [
  { value: 'campfires', label: 'Campfires' },
  { value: 'communities', label: 'Communities' },
  { value: 'outings', label: 'Outings' },
];

const filters: { value: FeedFilter; label: string }[] = [
  { value: 'for-you', label: 'For You' },
  { value: 'latest', label: 'Latest' },
  { value: 'nearby', label: 'Nearby' },
];

function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function eventTime(event: LocalEvent) {
  const date = new Date(event.starts_at);
  return `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function groupCover(group?: CommunityGroup | null) {
  return group?.cover_image_url || group?.image_url || null;
}

function isOfficialCommunity(group: CommunityGroup) {
  return group.kind === 'interest';
}

function normalizePlace(value?: string | null) {
  return value?.trim().toLowerCase().replace(/florida/g, 'fl').replace(/[^a-z0-9]+/g, '-') ?? '';
}

function sameLocation(cityA?: string | null, stateA?: string | null, cityB?: string | null, stateB?: string | null) {
  if (!cityA || !cityB) return false;
  const stateOne = normalizePlace(stateA);
  const stateTwo = normalizePlace(stateB);
  const stateMatches = !stateOne || !stateTwo || stateOne === stateTwo;
  return normalizePlace(cityA) === normalizePlace(cityB) && stateMatches;
}

function locationBackground(city?: string | null, state?: string | null): ImageSourcePropType {
  if (!city) return TRAIL_GUIDE_DEFAULT_BACKGROUND;
  const cityKey = normalizePlace(city);
  const region = normalizePlace(state);
  if (region && region !== 'fl') return TRAIL_GUIDE_DEFAULT_BACKGROUND;
  return TRAIL_GUIDE_CITIES.find((item) => item.key === cityKey)?.source ?? TRAIL_GUIDE_DEFAULT_BACKGROUND;
}

function campfireEyebrow(hour: number) {
  if (hour < 12) return 'THIS MORNING AROUND THE CAMPFIRE';
  if (hour < 17) return 'THIS AFTERNOON AROUND THE CAMPFIRE';
  return 'TONIGHT AROUND THE CAMPFIRE';
}

function Avatar({ post }: { post: CommunityPost }) {
  return (
    <View style={styles.avatar}>
      {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}
    </View>
  );
}

function PulseCard({
  icon,
  eyebrow,
  title,
  detail,
  actionLabel,
  width,
  imageSource,
  avatars = [],
  onPress,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
  width: number;
  imageSource?: ImageSourcePropType | null;
  avatars?: PulseAvatar[];
  onPress?: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.pulseCard, { width }, pressed && styles.pressed]} onPress={onPress}>
      {imageSource ? (
        <ImageBackground source={imageSource} style={styles.pulseVisual} imageStyle={styles.pulseVisualImage}>
          <View style={styles.pulseVisualShade} />
          <View style={styles.pulseVisualIcon}><Ionicons name={icon as any} size={18} color={TEXT} /></View>
        </ImageBackground>
      ) : (
        <View style={styles.pulseVisualPlain}>
          <View style={styles.pulseIcon}><Ionicons name={icon as any} size={18} color={GOLD} /></View>
          {avatars.length ? (
            <View style={styles.pulseAvatars}>
              {avatars.slice(0, 3).map((avatar, index) => (
                <View key={avatar.id} style={[styles.pulseAvatar, index > 0 && styles.pulseAvatarOverlap]}>
                  {avatar.uri ? <Image source={{ uri: avatar.uri }} style={styles.pulseAvatarImage} /> : <Text style={styles.pulseAvatarText}>{initials(avatar.name)}</Text>}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
      <View style={styles.pulseBody}>
        <Text style={styles.pulseEyebrow}>{eyebrow}</Text>
        <Text style={styles.pulseTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.pulseDetail} numberOfLines={1}>{detail}</Text>
        <View style={styles.pulseAction}><Text style={styles.pulseActionText}>{actionLabel}</Text><Ionicons name="arrow-forward" size={14} color={GOLD} /></View>
      </View>
    </Pressable>
  );
}

function ConversationCard({ post, group }: { post: CommunityPost; group?: CommunityGroup }) {
  const media = post.image_url || (post.media_type === 'image' ? post.media_url : null);
  return (
    <Pressable style={({ pressed }) => [styles.conversationCard, pressed && styles.pressed]} onPress={() => router.push(`/community/${post.id}`)}>
      <View style={styles.contextLine}>
        <Text style={styles.contextText}>{group ? group.name.toUpperCase() : 'TRAILMATE UPDATE'}</Text>
        <Text style={styles.contextTime}>{relativeTime(post.created_at)}</Text>
      </View>
      <View style={styles.authorRow}><Avatar post={post} /><Text style={styles.authorName}>{post.author_name}</Text></View>
      {post.body ? <Text style={styles.conversationText} numberOfLines={4}>{post.body}</Text> : null}
      {media ? <Image source={{ uri: media }} style={styles.conversationImage} resizeMode="cover" /> : null}
      <View style={styles.engagementRow}>
        <View style={styles.engagementItem}><Ionicons name="heart-outline" size={17} color={MUTED} /><Text style={styles.engagementText}>{post.reaction_count || 0}</Text></View>
        <View style={styles.engagementItem}><Ionicons name="chatbubble-outline" size={16} color={MUTED} /><Text style={styles.engagementText}>{post.comment_count || 0}</Text></View>
        <Text style={styles.openConversation}>Open conversation</Text>
      </View>
    </Pressable>
  );
}

function EventCard({ event, onInterested, fullWidth = false }: { event: LocalEvent; onInterested: (event: LocalEvent) => void; fullWidth?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.eventCard, fullWidth && styles.eventCardFull, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      {event.image_url ? <Image source={{ uri: event.image_url }} style={[styles.eventImage, fullWidth && styles.eventImageFull]} /> : <View style={[styles.eventImage, fullWidth && styles.eventImageFull, styles.eventFallback]}><Ionicons name="calendar-outline" size={30} color={GOLD} /></View>}
      <View style={styles.eventBody}>
        {event.my_rsvp === 'going' ? <View style={styles.goingPill}><Text style={styles.goingText}>YOU’RE GOING</Text></View> : null}
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.eventMeta}>{eventTime(event)}</Text>
        <Text style={styles.eventMeta} numberOfLines={1}>{[event.venue_name || event.city, event.state].filter(Boolean).join(', ')}</Text>
        <View style={styles.eventFooter}>
          {event.rsvp_count > 0 ? <Text style={styles.eventAttendance}>{event.rsvp_count} attending</Text> : <View />}
          {!event.my_rsvp || event.my_rsvp === 'cancelled' ? <Pressable style={styles.interestedButton} onPress={(e) => { e.stopPropagation(); onInterested(event); }}><Text style={styles.interestedText}>Interested</Text></Pressable> : null}
        </View>
      </View>
    </Pressable>
  );
}

function CommunityRow({ group, latest }: { group: CommunityGroup; latest?: CommunityPost }) {
  const cover = groupCover(group);
  return (
    <Pressable style={({ pressed }) => [styles.communityRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}>
      <View style={styles.communityImageWrap}>{cover ? <Image source={{ uri: cover }} style={styles.communityImage} /> : <Text style={styles.communityInitials}>{initials(group.name)}</Text>}</View>
      <View style={styles.flex}>
        <View style={styles.communityNameLine}><Text style={styles.communityName} numberOfLines={1}>{group.name}</Text>{isOfficialCommunity(group) ? <Ionicons name="checkmark-circle" size={14} color={GOLD} /> : null}</View>
        <Text style={[styles.communityActivity, latest && styles.communityActivityLive]} numberOfLines={1}>{latest ? `${latest.author_name} posted · ${relativeTime(latest.created_at)}` : `${group.member_count} member${group.member_count === 1 ? '' : 's'} · Quiet right now`}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={GOLD} />
    </Pressable>
  );
}

function OfficialCommunityCard({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const cover = groupCover(group);
  return (
    <Pressable style={({ pressed }) => [styles.officialCard, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      {cover ? <Image source={{ uri: cover }} style={styles.officialCardImage} /> : <View style={[styles.officialCardImage, styles.officialFallback]}><Text style={styles.officialInitials}>{initials(group.name)}</Text></View>}
      <View style={styles.officialShade} />
      <View style={styles.officialBadge}><Ionicons name="checkmark" size={10} color="#101510" /><Text style={styles.officialBadgeText}>Official</Text></View>
      {group.is_member ? <View style={styles.joinedBadge}><Ionicons name="checkmark" size={10} color={TEXT} /><Text style={styles.joinedBadgeText}>Joined</Text></View> : null}
      <View style={styles.officialCopy}>
        <Text style={styles.officialTitle} numberOfLines={2}>{group.name}</Text>
        <Text style={styles.officialMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
        {!group.is_member ? <View style={styles.joinButton}><Text style={styles.joinButtonText}>{joining ? 'Joining…' : 'Join community'}</Text></View> : null}
      </View>
    </Pressable>
  );
}

function DiscoverCommunityCard({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const cover = groupCover(group);
  return (
    <Pressable style={({ pressed }) => [styles.discoverCard, pressed && styles.pressed]} onPress={() => onJoin(group)}>
      {cover ? <Image source={{ uri: cover }} style={styles.discoverImage} /> : <View style={[styles.discoverImage, styles.officialFallback]}><Text style={styles.discoverInitials}>{initials(group.name)}</Text></View>}
      <View style={styles.discoverShade} />
      <View style={styles.discoverCopy}><Text style={styles.discoverTitle} numberOfLines={2}>{group.name}</Text><Text style={styles.discoverMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text></View>
      <View style={styles.discoverJoin}><Text style={styles.discoverJoinText}>{joining ? 'Joining…' : 'Join'}</Text></View>
    </Pressable>
  );
}

export default function OutpostAliveScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<Tab>('campfires');
  const [filter, setFilter] = useState<FeedFilter>('for-you');
  const [pulseIndex, setPulseIndex] = useState(0);
  const [feed, setFeed] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    const [feedResult, groupsResult, eventsResult, profileResult, connectionsResult] = await Promise.allSettled([getCommunityFeed(), getGroups(), listLocalEvents(), getMemberBasecamp(), getConnections()]);
    if (feedResult.status === 'fulfilled') setFeed(feedResult.value);
    if (groupsResult.status === 'fulfilled') setGroups(groupsResult.value);
    if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
    if (connectionsResult.status === 'fulfilled') setConnections(connectionsResult.value);
    if (profileResult.status === 'fulfilled') {
      setHomeCity((profileResult.value.profile?.home_city as string | null | undefined) ?? null);
      setHomeState((profileResult.value.profile?.home_state as string | null | undefined) ?? null);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const joinedGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const officialGroups = useMemo(() => groups.filter(isOfficialCommunity), [groups]);
  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const latestByGroup = useMemo(() => {
    const map = new Map<string, CommunityPost>();
    for (const post of feed.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())) if (post.group_id && !map.has(post.group_id)) map.set(post.group_id, post);
    return map;
  }, [feed]);
  const latestPosts = useMemo(() => feed.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [feed]);
  const forYouPosts = useMemo(() => {
    const joinedIds = new Set(joinedGroups.map((group) => group.id));
    const preferred = latestPosts.filter((post) => !post.group_id || joinedIds.has(post.group_id));
    return preferred.length ? preferred : latestPosts;
  }, [joinedGroups, latestPosts]);
  const comingUp = useMemo(() => events.slice().sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()).slice(0, 8), [events]);
  const nearbyGroups = useMemo(() => homeCity ? groups.filter((group) => sameLocation(group.city, group.state, homeCity, homeState)) : [], [groups, homeCity, homeState]);
  const nearbyGroupIds = useMemo(() => new Set(nearbyGroups.map((group) => group.id)), [nearbyGroups]);
  const nearbyPosts = useMemo(() => latestPosts.filter((post) => post.group_id && nearbyGroupIds.has(post.group_id)), [latestPosts, nearbyGroupIds]);
  const localComingUp = useMemo(() => homeCity ? comingUp.filter((event) => sameLocation(event.city, event.state, homeCity, homeState)) : [], [comingUp, homeCity, homeState]);
  const campfireComingUp = localComingUp.length ? localComingUp : comingUp;
  const filteredPosts = useMemo(() => {
    if (filter === 'latest') return latestPosts;
    if (filter === 'nearby') return nearbyPosts;
    return forYouPosts;
  }, [filter, forYouPosts, latestPosts, nearbyPosts]);
  const displayedPosts = filteredPosts.slice(0, 4);
  const activeGroupCount = useMemo(() => joinedGroups.filter((group) => latestByGroup.has(group.id)).length, [joinedGroups, latestByGroup]);
  const localActiveGroupCount = useMemo(() => nearbyGroups.filter((group) => latestByGroup.has(group.id)).length, [nearbyGroups, latestByGroup]);
  const discoverGroups = useMemo(() => groups
    .filter((group) => !group.is_member && !isOfficialCommunity(group))
    .sort((a, b) => Number(sameLocation(b.city, b.state, homeCity, homeState)) - Number(sameLocation(a.city, a.state, homeCity, homeState)))
    .slice(0, 8), [groups, homeCity, homeState]);
  const trailmates = useMemo(() => connections.filter((row) => row.status === 'accepted'), [connections]);
  const pendingTrailmates = useMemo(() => connections.filter((row) => row.status === 'pending' && row.direction === 'incoming'), [connections]);
  const trailmatePreview = trailmates.slice(0, 5);
  const locationLabel = [homeCity, homeState].filter(Boolean).join(', ') || 'Your area';
  const outpostBackground = useMemo(() => locationBackground(homeCity, homeState), [homeCity, homeState]);
  const pulseCardWidth = Math.min(310, Math.max(244, windowWidth - 96));
  const pulseSnap = pulseCardWidth + 12;
  const firstConversation = forYouPosts[0];
  const pulseCommunity = nearbyGroups.find((group) => latestByGroup.has(group.id)) || joinedGroups.find((group) => latestByGroup.has(group.id)) || nearbyGroups[0] || groups[0];
  const pulseOuting = localComingUp[0] || comingUp[0];
  const conversationAuthors = useMemo<PulseAvatar[]>(() => {
    const seen = new Set<string>();
    const result: PulseAvatar[] = [];
    for (const post of forYouPosts) {
      if (seen.has(post.author_id)) continue;
      seen.add(post.author_id);
      result.push({ id: post.author_id, name: post.author_name, uri: post.avatar_url });
      if (result.length === 3) break;
    }
    return result;
  }, [forYouPosts]);
  const localConversationCount = homeCity ? nearbyPosts.length : forYouPosts.length;
  const localCommunityCount = homeCity ? nearbyGroups.length : groups.length;
  const localOutingCount = homeCity ? localComingUp.length : comingUp.length;
  const campfireLabel = useMemo(() => campfireEyebrow(new Date().getHours()), []);

  const handleInterested = useCallback(async (event: LocalEvent) => {
    try {
      await setLocalEventRsvp(event.id, 'interested');
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, my_rsvp: 'interested' } : item));
    } catch { /* detail screen remains available */ }
  }, []);

  const handleJoin = useCallback(async (group: CommunityGroup) => {
    if (joiningId) return;
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      setGroups((current) => current.map((item) => item.id === group.id ? { ...item, is_member: true, member_count: item.member_count + 1 } : item));
    } finally {
      setJoiningId(null);
    }
  }, [joiningId]);

  const renderCampfires = () => (
    <>
      <View style={styles.filterRow}>{filters.map((item) => <Pressable key={item.value} style={[styles.filterChip, filter === item.value && styles.filterChipSelected]} onPress={() => setFilter(item.value)}><Text style={[styles.filterText, filter === item.value && styles.filterTextSelected]}>{item.label}</Text></Pressable>)}</View>

      <View style={styles.sectionIntro}>
        <Text style={styles.sectionEyebrow}>{campfireLabel}</Text>
        <Text style={styles.sectionLead}>See who’s here, what people are talking about, and what you can join.</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={pulseSnap}
        decelerationRate="fast"
        contentContainerStyle={styles.pulseRail}
        onMomentumScrollEnd={(event) => setPulseIndex(Math.max(0, Math.min(2, Math.round(event.nativeEvent.contentOffset.x / pulseSnap))))}
      >
        <PulseCard
          icon="chatbubbles-outline"
          eyebrow="CONVERSATIONS"
          title={forYouPosts.length ? `${forYouPosts.length} conversations moving` : 'The fire is quiet for a minute'}
          detail={forYouPosts.length ? 'Fresh voices from around your Outpost' : 'New conversations will show up here'}
          actionLabel={firstConversation ? 'Jump in' : 'Check back'}
          width={pulseCardWidth}
          avatars={conversationAuthors}
          onPress={firstConversation ? () => router.push(`/community/${firstConversation.id}`) : undefined}
        />
        <PulseCard
          icon="people-outline"
          eyebrow="COMMUNITIES"
          title={(homeCity ? localActiveGroupCount : activeGroupCount) ? `${homeCity ? localActiveGroupCount : activeGroupCount} active right now` : 'Find a community that fits'}
          detail={pulseCommunity ? `${pulseCommunity.name} · ${pulseCommunity.member_count} members` : 'Spaces built around how you get outside'}
          actionLabel="Explore communities"
          width={pulseCardWidth}
          imageSource={groupCover(pulseCommunity) ? { uri: groupCover(pulseCommunity)! } : outpostBackground}
          onPress={() => setActiveTab('communities')}
        />
        <PulseCard
          icon="calendar-outline"
          eyebrow="OUTINGS"
          title={campfireComingUp.length ? `${campfireComingUp.length} ways to get outside` : 'No outings posted yet'}
          detail={pulseOuting ? `${pulseOuting.title} · ${eventTime(pulseOuting)}` : 'New plans from local hosts will land here'}
          actionLabel="See outings"
          width={pulseCardWidth}
          imageSource={pulseOuting?.image_url ? { uri: pulseOuting.image_url } : outpostBackground}
          onPress={() => setActiveTab('outings')}
        />
      </ScrollView>
      <View style={styles.carouselDots} accessibilityLabel={`Carousel item ${pulseIndex + 1} of 3`}>
        {[0, 1, 2].map((index) => <View key={index} style={[styles.carouselDot, pulseIndex === index && styles.carouselDotSelected]} />)}
      </View>

      <Pressable style={({ pressed }) => [styles.trailCrewCard, pressed && styles.pressed]} onPress={() => router.push('/connections' as never)}>
        <View style={styles.trailCrewAccent} />
        <View style={styles.trailCrewTopRow}>
          <View>
            <Text style={styles.trailCrewEyebrow}>YOUR TRAIL CREW</Text>
            <Text style={styles.trailCrewTitle}>{trailmates.length} Trailmate{trailmates.length === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.trailCrewOpen}><Text style={styles.trailCrewOpenText}>View crew</Text><Ionicons name="chevron-forward" size={16} color={GOLD} /></View>
        </View>
        <View style={styles.trailCrewBottomRow}>
          <View style={styles.trailCrewAvatars}>
            {trailmatePreview.map((row, index) => (
              <View key={row.connection_id} style={[styles.trailCrewAvatar, index > 0 && styles.trailCrewAvatarOverlap]}>
                {row.avatar_url ? <Image source={{ uri: row.avatar_url }} style={styles.trailCrewAvatarImage} /> : <Text style={styles.trailCrewAvatarText}>{initials(row.display_name)}</Text>}
              </View>
            ))}
            {trailmates.length > trailmatePreview.length ? <View style={[styles.trailCrewAvatar, styles.trailCrewAvatarOverlap, styles.trailCrewMore]}><Text style={styles.trailCrewMoreText}>+{trailmates.length - trailmatePreview.length}</Text></View> : null}
            {!trailmates.length ? <View style={styles.trailCrewEmptyIcon}><Ionicons name="people-outline" size={18} color={GOLD} /></View> : null}
          </View>
          <Text style={styles.trailCrewMeta}>{pendingTrailmates.length ? `${pendingTrailmates.length} request${pendingTrailmates.length === 1 ? '' : 's'} waiting` : trailmates.length ? 'Your people across Go Melanated' : 'Start connecting with people you meet'}</Text>
        </View>
      </Pressable>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Happening now</Text><Text style={styles.sectionSubtitle}>{filter === 'nearby' ? `Fresh conversation around ${homeCity || 'your Outpost'}.` : 'Fresh conversation from across your Outpost.'}</Text></View>
      {displayedPosts.length ? displayedPosts.map((post) => <ConversationCard key={post.id} post={post} group={post.group_id ? groupMap.get(post.group_id) : undefined} />) : <View style={styles.emptyState}><Ionicons name="bonfire-outline" size={25} color={GREEN} /><Text style={styles.emptyTitle}>{filter === 'nearby' ? 'No nearby conversations yet.' : 'The fire’s quiet for a minute.'}</Text><Text style={styles.emptyCopy}>{filter === 'nearby' ? 'Try For You or Latest, or check back as local communities post.' : 'New conversations from your communities will land here.'}</Text></View>}

      <View style={styles.sectionHeaderRow}><View><Text style={styles.sectionTitle}>Coming up</Text><Text style={styles.sectionSubtitle}>Turn the conversation into a real day outside.</Text></View><Pressable onPress={() => setActiveTab('outings')}><Text style={styles.seeAll}>See all →</Text></Pressable></View>
      {campfireComingUp.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={292} decelerationRate="fast" contentContainerStyle={styles.eventRail}>{campfireComingUp.slice(0, 5).map((event) => <EventCard key={event.id} event={event} onInterested={handleInterested} />)}</ScrollView> : <View style={styles.emptyState}><Ionicons name="calendar-outline" size={24} color={GREEN} /><Text style={styles.emptyTitle}>Nothing scheduled nearby yet.</Text><Text style={styles.emptyCopy}>New outings will appear here as hosts publish them.</Text></View>}

      <View style={styles.sectionHeaderRow}><View><Text style={styles.sectionTitle}>Your Campfires</Text><Text style={styles.sectionSubtitle}>The communities you keep coming back to.</Text></View><Pressable onPress={() => setActiveTab('communities')}><Text style={styles.seeAll}>See all →</Text></Pressable></View>
      {joinedGroups.length ? <View style={styles.communityList}>{joinedGroups.slice(0, 3).map((group) => <CommunityRow key={group.id} group={group} latest={latestByGroup.get(group.id)} />)}</View> : <View style={styles.emptyState}><Ionicons name="people-outline" size={24} color={GREEN} /><Text style={styles.emptyTitle}>Your communities will live here.</Text><Text style={styles.emptyCopy}>Explore Communities to find a space that fits how you get outside.</Text></View>}
    </>
  );

  const renderCommunities = () => (
    <View style={styles.communitiesPage}>
      <ImageBackground source={outpostBackground} style={styles.communityHero} imageStyle={styles.communityHeroImage}>
        <View style={styles.heroShade} />
        <View style={styles.communityHeroContent}>
          <Text style={styles.communityHeroEyebrow}>{homeCity ? `${homeCity.toUpperCase()} COMMUNITIES` : 'GO MELANATED COMMUNITIES'}</Text>
          <Text style={styles.communityHeroTitle}>Find your people. Keep getting outside.</Text>
          <Text style={styles.communityHeroCopy}>Official spaces, communities you already call home, and new crews worth discovering.</Text>
        </View>
      </ImageBackground>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Official Communities</Text><Text style={styles.sectionSubtitle}>Go Melanated spaces built around how you get outside.</Text></View>
      {officialGroups.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.officialRail}>{officialGroups.map((group) => <OfficialCommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}</ScrollView> : <Text style={styles.emptyCopy}>Official communities are being prepared.</Text>}

      <View style={styles.sectionHeaderRow}><View><Text style={styles.sectionTitle}>Your Communities</Text><Text style={styles.sectionSubtitle}>{joinedGroups.length ? `${joinedGroups.length} joined · activity first` : 'Your joined communities will live here.'}</Text></View></View>
      {joinedGroups.length ? <View style={styles.communityList}>{joinedGroups.map((group) => <CommunityRow key={group.id} group={group} latest={latestByGroup.get(group.id)} />)}</View> : <View style={styles.emptyState}><Ionicons name="people-outline" size={24} color={GREEN} /><Text style={styles.emptyTitle}>Your circle starts here.</Text><Text style={styles.emptyCopy}>Join an official community or discover a crew below.</Text></View>}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Discover More</Text><Text style={styles.sectionSubtitle}>{homeCity ? `Nearby ${homeCity} communities appear first.` : 'More ways to find your people outdoors.'}</Text></View>
      {discoverGroups.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoverRail}>{discoverGroups.map((group) => <DiscoverCommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}</ScrollView> : <Text style={styles.emptyCopy}>You’ve joined everything available right now.</Text>}
    </View>
  );

  const outingsForDisplay = useMemo(() => comingUp.slice().sort((a, b) => {
    const aLocal = Number(sameLocation(a.city, a.state, homeCity, homeState));
    const bLocal = Number(sameLocation(b.city, b.state, homeCity, homeState));
    if (aLocal !== bLocal) return bLocal - aLocal;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  }), [comingUp, homeCity, homeState]);

  const renderOutings = () => (
    <View>
      <ImageBackground source={pulseOuting?.image_url ? { uri: pulseOuting.image_url } : outpostBackground} style={styles.outingsHero} imageStyle={styles.outingsHeroImage}>
        <View style={styles.heroShade} />
        <View style={styles.outingsHeroContent}>
          <Text style={styles.communityHeroEyebrow}>{homeCity ? `AROUND ${homeCity.toUpperCase()}` : 'AROUND YOUR OUTPOST'}</Text>
          <Text style={styles.outingsHeroTitle}>{outingsForDisplay.length ? `${outingsForDisplay.length} ways to get outside` : 'Your next outing will show up here'}</Text>
          <Text style={styles.outingsHeroCopy}>Local plans first, then more adventures from across Go Melanated.</Text>
        </View>
      </ImageBackground>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Outings</Text><Text style={styles.sectionSubtitle}>Plans are better when they get off the screen.</Text></View>
      {outingsForDisplay.length ? outingsForDisplay.map((event) => <View key={event.id} style={styles.fullEventWrap}><EventCard event={event} onInterested={handleInterested} fullWidth /></View>) : <View style={styles.emptyState}><Ionicons name="calendar-outline" size={24} color={GREEN} /><Text style={styles.emptyTitle}>No upcoming outings yet.</Text><Text style={styles.emptyCopy}>New plans will appear here as hosts publish them.</Text></View>}
    </View>
  );

  if (loading && !feed.length && !groups.length && !events.length) return <SafeAreaView style={styles.loading}><ActivityIndicator color={GOLD} /><Text style={styles.loadingText}>Gathering the Outpost…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={GOLD} />}>
        <ImageBackground source={outpostBackground} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}><Ionicons name="location-outline" size={13} color={GOLD} /><Text style={styles.heroBadgeText}>YOUR LOCAL OUTPOST</Text></View>
            <Text style={styles.title}>Outpost</Text>
            <View style={styles.locationRow}><Ionicons name="location" size={15} color={GOLD} /><Text style={styles.locationText}>{locationLabel}</Text></View>
          </View>
        </ImageBackground>

        <View style={styles.tabs}>{tabs.map((tab) => <Pressable key={tab.value} style={[styles.tab, activeTab === tab.value && styles.tabSelected]} onPress={() => setActiveTab(tab.value)}><Text style={[styles.tabText, activeTab === tab.value && styles.tabTextSelected]}>{tab.label}</Text></Pressable>)}</View>

        <View style={styles.localPulse}>
          <View style={styles.localPulseDot} />
          <Text style={styles.localPulseText} numberOfLines={2}>{`${localConversationCount} conversation${localConversationCount === 1 ? '' : 's'} · ${localCommunityCount} communit${localCommunityCount === 1 ? 'y' : 'ies'} · ${localOutingCount} outing${localOutingCount === 1 ? '' : 's'} ahead`}</Text>
        </View>

        {activeTab === 'campfires' ? renderCampfires() : activeTab === 'communities' ? renderCommunities() : renderOutings()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 56 },
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: MUTED, fontSize: 14, fontWeight: '700' },
  hero: { minHeight: 182, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 14, backgroundColor: SURFACE },
  heroImage: { borderRadius: 24 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,11,8,0.53)' },
  heroContent: { padding: 18, paddingTop: 52 },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: 'rgba(12,21,16,0.78)', paddingHorizontal: 9, paddingVertical: 5, marginBottom: 7 },
  heroBadgeText: { color: TEXT, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: TEXT, fontSize: 40, lineHeight: 44, fontWeight: '900', letterSpacing: -1.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  locationText: { color: '#F4E7BC', fontSize: 14, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderRadius: 15, backgroundColor: SURFACE_2, padding: 4, gap: 3, marginBottom: 9 },
  tab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabSelected: { backgroundColor: '#213026' },
  tabText: { color: MUTED, fontSize: 13.5, fontWeight: '800' },
  tabTextSelected: { color: GOLD },
  localPulse: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 4 },
  localPulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  localPulseText: { flex: 1, color: MUTED, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 7, paddingVertical: 8 },
  filterChip: { borderRadius: 999, backgroundColor: '#121C17', paddingHorizontal: 13, paddingVertical: 7 },
  filterChipSelected: { backgroundColor: '#253229' },
  filterText: { color: MUTED, fontSize: 11.5, fontWeight: '800' },
  filterTextSelected: { color: TEXT },
  sectionIntro: { marginTop: 12, marginBottom: 12 },
  sectionEyebrow: { color: GOLD, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.15 },
  sectionLead: { color: TEXT, fontSize: 21, lineHeight: 28, fontWeight: '900', marginTop: 5, maxWidth: 540, letterSpacing: -0.2 },
  pulseRail: { gap: 12, paddingRight: 42, paddingBottom: 4 },
  pulseCard: { minHeight: 182, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: '#314137', overflow: 'hidden' },
  pulseVisual: { height: 68, justifyContent: 'flex-end', padding: 10, backgroundColor: SURFACE_2 },
  pulseVisualImage: { resizeMode: 'cover' },
  pulseVisualShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,12,8,0.35)' },
  pulseVisualPlain: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#1B2921' },
  pulseVisualIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(12,20,15,0.78)', alignItems: 'center', justifyContent: 'center' },
  pulseIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center' },
  pulseAvatars: { flexDirection: 'row', alignItems: 'center', paddingRight: 2 },
  pulseAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#1B2921', backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pulseAvatarOverlap: { marginLeft: -8 },
  pulseAvatarImage: { width: '100%', height: '100%' },
  pulseAvatarText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  pulseBody: { padding: 13, paddingTop: 11 },
  pulseEyebrow: { color: GREEN, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  pulseTitle: { color: TEXT, fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 4 },
  pulseDetail: { color: MUTED, fontSize: 11.5, marginTop: 5 },
  pulseAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 9 },
  pulseActionText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  carouselDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, marginBottom: 2 },
  carouselDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#445148' },
  carouselDotSelected: { width: 17, backgroundColor: GOLD },
  trailCrewCard: { minHeight: 98, marginTop: 17, marginBottom: 2, borderRadius: 19, backgroundColor: '#151F1A', paddingHorizontal: 15, paddingVertical: 13, gap: 10, overflow: 'hidden' },
  trailCrewAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: GOLD },
  trailCrewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  trailCrewEyebrow: { color: GREEN, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  trailCrewTitle: { color: TEXT, fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 2 },
  trailCrewOpen: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trailCrewOpenText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  trailCrewBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  trailCrewAvatars: { flexDirection: 'row', alignItems: 'center', paddingLeft: 1 },
  trailCrewAvatar: { width: 39, height: 39, borderRadius: 20, borderWidth: 2, borderColor: '#151F1A', backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  trailCrewAvatarOverlap: { marginLeft: -9 },
  trailCrewAvatarImage: { width: '100%', height: '100%' },
  trailCrewAvatarText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  trailCrewMore: { backgroundColor: '#223128' },
  trailCrewMoreText: { color: TEXT, fontSize: 9, fontWeight: '900' },
  trailCrewEmptyIcon: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center' },
  trailCrewMeta: { flex: 1, color: MUTED, fontSize: 11.5, lineHeight: 16 },
  sectionHeader: { marginTop: 28, marginBottom: 11 },
  sectionHeaderRow: { marginTop: 30, marginBottom: 11, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: TEXT, fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.55 },
  sectionSubtitle: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 2 },
  seeAll: { color: GOLD, fontSize: 12, fontWeight: '900', paddingBottom: 2 },
  conversationCard: { marginBottom: 14, borderRadius: 20, backgroundColor: SURFACE, overflow: 'hidden', padding: 15 },
  contextLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  contextText: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, flexShrink: 1 },
  contextTime: { color: MUTED, fontSize: 10.5 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 14, fontWeight: '900' },
  conversationText: { color: TEXT, fontSize: 16, lineHeight: 23, fontWeight: '700', marginTop: 11 },
  conversationImage: { width: '100%', height: 220, borderRadius: 15, backgroundColor: SURFACE_2, marginTop: 12 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  engagementItem: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 14 },
  engagementText: { color: MUTED, fontSize: 12 },
  openConversation: { marginLeft: 'auto', color: GOLD, fontSize: 11.5, fontWeight: '900' },
  eventRail: { gap: 12, paddingRight: 24 },
  eventCard: { width: 280, borderRadius: 19, overflow: 'hidden', backgroundColor: SURFACE },
  eventCardFull: { width: '100%' },
  fullEventWrap: { marginBottom: 15 },
  eventImage: { width: '100%', height: 150, backgroundColor: SURFACE_2 },
  eventImageFull: { height: 185 },
  eventFallback: { alignItems: 'center', justifyContent: 'center' },
  eventBody: { padding: 14 },
  goingPill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 7 },
  goingText: { color: '#101510', fontSize: 9.5, fontWeight: '900' },
  eventTitle: { color: TEXT, fontSize: 18, lineHeight: 22, fontWeight: '900' },
  eventMeta: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  eventFooter: { minHeight: 32, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventAttendance: { color: GREEN, fontSize: 11.5, fontWeight: '800' },
  interestedButton: { borderRadius: 999, borderWidth: 1, borderColor: GOLD, paddingHorizontal: 10, paddingVertical: 6 },
  interestedText: { color: GOLD, fontSize: 10.5, fontWeight: '900' },
  communityList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  communityRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, paddingVertical: 11 },
  communityImageWrap: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  communityImage: { width: '100%', height: '100%' },
  communityInitials: { color: GOLD, fontSize: 15, fontWeight: '900' },
  communityNameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  communityName: { color: TEXT, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  communityActivity: { color: MUTED, fontSize: 11.5, marginTop: 4, fontWeight: '700' },
  communityActivityLive: { color: GREEN },
  communitiesPage: { paddingBottom: 12 },
  communityHero: { minHeight: 185, borderRadius: 22, overflow: 'hidden', marginTop: 10, backgroundColor: SURFACE },
  communityHeroImage: { borderRadius: 22 },
  communityHeroContent: { flex: 1, justifyContent: 'flex-end', padding: 18, paddingTop: 56 },
  communityHeroEyebrow: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.05 },
  communityHeroTitle: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 5 },
  communityHeroCopy: { color: '#E4EAE6', fontSize: 13, lineHeight: 19, marginTop: 6 },
  officialRail: { gap: 12, paddingRight: 18 },
  officialCard: { width: 220, height: 170, borderRadius: 20, overflow: 'hidden', backgroundColor: SURFACE },
  officialCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  officialFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#26352B' },
  officialInitials: { color: GOLD, fontSize: 28, fontWeight: '900' },
  officialShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.40)' },
  officialBadge: { position: 'absolute', left: 10, top: 10, borderRadius: 999, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4 },
  officialBadgeText: { color: '#101510', fontSize: 9, fontWeight: '900' },
  joinedBadge: { position: 'absolute', right: 10, top: 10, borderRadius: 999, backgroundColor: 'rgba(17,28,22,0.86)', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4 },
  joinedBadgeText: { color: TEXT, fontSize: 9, fontWeight: '900' },
  officialCopy: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  officialTitle: { color: '#FFFDF6', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  officialMeta: { color: '#E6ECE8', fontSize: 11, fontWeight: '700', marginTop: 5 },
  joinButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  joinButtonText: { color: '#101510', fontSize: 10, fontWeight: '900' },
  discoverRail: { gap: 12, paddingRight: 18 },
  discoverCard: { width: 176, height: 136, borderRadius: 18, overflow: 'hidden', backgroundColor: SURFACE },
  discoverImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  discoverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.34)' },
  discoverCopy: { position: 'absolute', left: 11, right: 11, bottom: 10 },
  discoverTitle: { color: '#FFFDF6', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  discoverMeta: { color: '#E1E8E3', fontSize: 10.5, marginTop: 4, fontWeight: '700' },
  discoverJoin: { position: 'absolute', right: 9, top: 9, borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 9, paddingVertical: 5 },
  discoverJoinText: { color: '#101510', fontSize: 9.5, fontWeight: '900' },
  discoverInitials: { color: GOLD, fontSize: 24, fontWeight: '900' },
  outingsHero: { minHeight: 172, borderRadius: 22, overflow: 'hidden', marginTop: 10, backgroundColor: SURFACE },
  outingsHeroImage: { borderRadius: 22 },
  outingsHeroContent: { flex: 1, justifyContent: 'flex-end', padding: 18, paddingTop: 50 },
  outingsHeroTitle: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 5 },
  outingsHeroCopy: { color: '#E4EAE6', fontSize: 13, lineHeight: 19, marginTop: 6 },
  emptyState: { borderRadius: 18, backgroundColor: '#141E19', padding: 18, alignItems: 'flex-start' },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '900', marginTop: 10 },
  emptyCopy: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 4 },
  pressed: { opacity: 0.72 },
});
