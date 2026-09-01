import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listLocalEvents, setLocalEventRsvp, type LocalEvent } from '../local-events/api';
import { getMemberBasecamp } from '../member/api';
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

function Avatar({ post }: { post: CommunityPost }) {
  return (
    <View style={styles.avatar}>
      {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}
    </View>
  );
}

function PulseCard({ icon, eyebrow, title, detail, onPress }: { icon: string; eyebrow: string; title: string; detail: string; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.pulseCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.pulseIcon}><Ionicons name={icon as any} size={18} color={GOLD} /></View>
      <Text style={styles.pulseEyebrow}>{eyebrow}</Text>
      <Text style={styles.pulseTitle} numberOfLines={2}>{title}</Text>
      <Text style={styles.pulseDetail} numberOfLines={1}>{detail}</Text>
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

function EventCard({ event, onInterested }: { event: LocalEvent; onInterested: (event: LocalEvent) => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      {event.image_url ? <Image source={{ uri: event.image_url }} style={styles.eventImage} /> : <View style={[styles.eventImage, styles.eventFallback]}><Ionicons name="calendar-outline" size={30} color={GOLD} /></View>}
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
  const [activeTab, setActiveTab] = useState<Tab>('campfires');
  const [filter, setFilter] = useState<FeedFilter>('for-you');
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
  const featuredPosts = useMemo(() => {
    const joinedIds = new Set(joinedGroups.map((group) => group.id));
    const preferred = latestPosts.filter((post) => !post.group_id || joinedIds.has(post.group_id));
    return (preferred.length ? preferred : latestPosts).slice(0, 4);
  }, [joinedGroups, latestPosts]);
  const comingUp = useMemo(() => events.slice().sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()).slice(0, 5), [events]);
  const activeGroupCount = useMemo(() => joinedGroups.filter((group) => latestByGroup.has(group.id)).length, [joinedGroups, latestByGroup]);
  const discoverGroups = useMemo(() => groups.filter((group) => !group.is_member && !isOfficialCommunity(group)).slice(0, 8), [groups]);
  const trailmates = useMemo(() => connections.filter((row) => row.status === 'accepted'), [connections]);
  const pendingTrailmates = useMemo(() => connections.filter((row) => row.status === 'pending' && row.direction === 'incoming'), [connections]);
  const trailmatePreview = trailmates.slice(0, 5);

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
      <View style={styles.sectionIntro}><Text style={styles.sectionEyebrow}>TONIGHT AROUND THE CAMPFIRE</Text><Text style={styles.sectionLead}>See who’s here, what people are talking about, and what you can join.</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pulseRail}>
        <PulseCard icon="chatbubbles-outline" eyebrow="CONVERSATIONS" title={`${featuredPosts.length || 0} worth catching up on`} detail="From your people" />
        <PulseCard icon="people-outline" eyebrow="YOUR CAMPS" title={`${activeGroupCount} active right now`} detail={`${joinedGroups.length} joined`} onPress={() => setActiveTab('communities')} />
        <PulseCard icon="calendar-outline" eyebrow="COMING UP" title={`${comingUp.length} outings on deck`} detail="Plans you can join" onPress={() => setActiveTab('outings')} />
      </ScrollView>

      <Pressable style={({ pressed }) => [styles.trailCrewCard, pressed && styles.pressed]} onPress={() => router.push('/connections' as never)}>
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

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Happening now</Text><Text style={styles.sectionSubtitle}>Fresh conversation from across your Outpost.</Text></View>
      {featuredPosts.length ? featuredPosts.map((post) => <ConversationCard key={post.id} post={post} group={post.group_id ? groupMap.get(post.group_id) : undefined} />) : <View style={styles.emptyState}><Ionicons name="bonfire-outline" size={25} color={GREEN} /><Text style={styles.emptyTitle}>The fire’s quiet for a minute.</Text><Text style={styles.emptyCopy}>New conversations from your communities will land here.</Text></View>}
      <View style={styles.sectionHeaderRow}><View><Text style={styles.sectionTitle}>Coming up</Text><Text style={styles.sectionSubtitle}>Turn the conversation into a real day outside.</Text></View><Pressable onPress={() => setActiveTab('outings')}><Text style={styles.seeAll}>See all →</Text></Pressable></View>
      {comingUp.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={292} decelerationRate="fast" contentContainerStyle={styles.eventRail}>{comingUp.map((event) => <EventCard key={event.id} event={event} onInterested={handleInterested} />)}</ScrollView> : null}
      <View style={styles.sectionHeaderRow}><View><Text style={styles.sectionTitle}>Your Campfires</Text><Text style={styles.sectionSubtitle}>The communities you keep coming back to.</Text></View><Pressable onPress={() => setActiveTab('communities')}><Text style={styles.seeAll}>See all →</Text></Pressable></View>
      <View style={styles.communityList}>{joinedGroups.slice(0, 3).map((group) => <CommunityRow key={group.id} group={group} latest={latestByGroup.get(group.id)} />)}</View>
    </>
  );

  const renderCommunities = () => (
    <View style={styles.communitiesPage}>
      <View style={styles.communityHero}><Text style={styles.communityHeroEyebrow}>GO MELANATED COMMUNITIES</Text><Text style={styles.communityHeroTitle}>Find your people. Keep getting outside.</Text><Text style={styles.communityHeroCopy}>Official spaces, the communities you already call home, and new crews worth discovering.</Text></View>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Official Communities</Text><Text style={styles.sectionSubtitle}>Go Melanated spaces built around how you get outside.</Text></View>
      {officialGroups.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.officialRail}>{officialGroups.map((group) => <OfficialCommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}</ScrollView> : <Text style={styles.emptyCopy}>Official communities are being prepared.</Text>}

      <View style={styles.sectionHeaderRow}><View><Text style={styles.sectionTitle}>Your Communities</Text><Text style={styles.sectionSubtitle}>{joinedGroups.length ? `${joinedGroups.length} joined · activity first` : 'Your joined communities will live here.'}</Text></View></View>
      {joinedGroups.length ? <View style={styles.communityList}>{joinedGroups.map((group) => <CommunityRow key={group.id} group={group} latest={latestByGroup.get(group.id)} />)}</View> : <View style={styles.emptyState}><Ionicons name="people-outline" size={24} color={GREEN} /><Text style={styles.emptyTitle}>Your circle starts here.</Text><Text style={styles.emptyCopy}>Join an official community or discover a crew below.</Text></View>}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Discover More</Text><Text style={styles.sectionSubtitle}>More ways to find your people outdoors.</Text></View>
      {discoverGroups.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoverRail}>{discoverGroups.map((group) => <DiscoverCommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}</ScrollView> : <Text style={styles.emptyCopy}>You’ve joined everything available right now.</Text>}
    </View>
  );

  const renderOutings = () => (
    <View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Outings</Text><Text style={styles.sectionSubtitle}>Plans are better when they get off the screen.</Text></View>
      {comingUp.length ? comingUp.map((event) => <View key={event.id} style={styles.fullEventWrap}><EventCard event={event} onInterested={handleInterested} /></View>) : <Text style={styles.emptyCopy}>No upcoming outings yet.</Text>}
    </View>
  );

  if (loading && !feed.length && !groups.length && !events.length) return <SafeAreaView style={styles.loading}><ActivityIndicator color={GOLD} /><Text style={styles.loadingText}>Gathering the Outpost…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={GOLD} />}>
        <View style={styles.header}>
          <View style={styles.flex}><Text style={styles.title}>Outpost</Text><View style={styles.locationRow}><Ionicons name="location-outline" size={15} color={GREEN} /><Text style={styles.locationText}>{[homeCity, homeState].filter(Boolean).join(', ') || 'Your area'}</Text></View></View>
          <Pressable style={styles.headerButton} onPress={() => router.push('/notifications' as never)}><Ionicons name="notifications-outline" size={20} color={TEXT} /></Pressable>
        </View>
        <View style={styles.tabs}>{tabs.map((tab) => <Pressable key={tab.value} style={[styles.tab, activeTab === tab.value && styles.tabSelected]} onPress={() => setActiveTab(tab.value)}><Text style={[styles.tabText, activeTab === tab.value && styles.tabTextSelected]}>{tab.label}</Text></Pressable>)}</View>
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { color: TEXT, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1.4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  locationText: { color: GREEN, fontSize: 14, fontWeight: '800' },
  headerButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, marginBottom: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabSelected: { borderBottomColor: GOLD },
  tabText: { color: MUTED, fontSize: 15, fontWeight: '800' },
  tabTextSelected: { color: GOLD },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 8 },
  filterChipSelected: { borderColor: GOLD, backgroundColor: '#1B251D' },
  filterText: { color: MUTED, fontSize: 12, fontWeight: '800' },
  filterTextSelected: { color: TEXT },
  sectionIntro: { marginTop: 12, marginBottom: 12 },
  sectionEyebrow: { color: GOLD, fontSize: 11, fontWeight: '900', letterSpacing: 1.15 },
  sectionLead: { color: TEXT, fontSize: 20, lineHeight: 27, fontWeight: '800', marginTop: 5, maxWidth: 540 },
  pulseRail: { gap: 10, paddingRight: 8, paddingBottom: 4 },
  pulseCard: { width: 168, minHeight: 128, borderRadius: 18, padding: 14, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  pulseIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  pulseEyebrow: { color: GREEN, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.85 },
  pulseTitle: { color: TEXT, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 4 },
  pulseDetail: { color: MUTED, fontSize: 11.5, marginTop: 6 },
  trailCrewCard: { minHeight: 82, marginTop: 15, marginBottom: 2, borderRadius: 18, borderWidth: 1, borderColor: '#405244', backgroundColor: SURFACE, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  trailCrewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  trailCrewEyebrow: { color: GREEN, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  trailCrewTitle: { color: TEXT, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 2 },
  trailCrewOpen: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trailCrewOpenText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  trailCrewBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  trailCrewAvatars: { flexDirection: 'row', alignItems: 'center', paddingLeft: 1 },
  trailCrewAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: SURFACE, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  trailCrewAvatarOverlap: { marginLeft: -9 },
  trailCrewAvatarImage: { width: '100%', height: '100%' },
  trailCrewAvatarText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  trailCrewMore: { backgroundColor: '#223128' },
  trailCrewMoreText: { color: TEXT, fontSize: 9, fontWeight: '900' },
  trailCrewEmptyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center' },
  trailCrewMeta: { flex: 1, color: MUTED, fontSize: 11.5, lineHeight: 16 },
  sectionHeader: { marginTop: 26, marginBottom: 10 },
  sectionHeaderRow: { marginTop: 28, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.45 },
  sectionSubtitle: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 2 },
  seeAll: { color: GOLD, fontSize: 12, fontWeight: '900', paddingBottom: 2 },
  conversationCard: { marginBottom: 12, borderRadius: 18, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, overflow: 'hidden', padding: 15 },
  contextLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  contextText: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, flexShrink: 1 },
  contextTime: { color: MUTED, fontSize: 10.5 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 14, fontWeight: '900' },
  conversationText: { color: TEXT, fontSize: 16, lineHeight: 23, fontWeight: '700', marginTop: 11 },
  conversationImage: { width: '100%', height: 220, borderRadius: 14, backgroundColor: SURFACE_2, marginTop: 12 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  engagementItem: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 14 },
  engagementText: { color: MUTED, fontSize: 12 },
  openConversation: { marginLeft: 'auto', color: GOLD, fontSize: 11.5, fontWeight: '900' },
  eventRail: { gap: 12, paddingRight: 24 },
  eventCard: { width: 280, borderRadius: 19, overflow: 'hidden', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  fullEventWrap: { marginBottom: 14 },
  eventImage: { width: '100%', height: 150, backgroundColor: SURFACE_2 },
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
  communityRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, paddingVertical: 10 },
  communityImageWrap: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  communityImage: { width: '100%', height: '100%' },
  communityInitials: { color: GOLD, fontSize: 15, fontWeight: '900' },
  communityNameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  communityName: { color: TEXT, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  communityActivity: { color: MUTED, fontSize: 11.5, marginTop: 4, fontWeight: '700' },
  communityActivityLive: { color: GREEN },
  communitiesPage: { paddingBottom: 12 },
  communityHero: { marginTop: 10, borderRadius: 20, padding: 18, backgroundColor: '#17231C', borderWidth: 1, borderColor: '#35483A' },
  communityHeroEyebrow: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.05 },
  communityHeroTitle: { color: TEXT, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 5 },
  communityHeroCopy: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 6 },
  officialRail: { gap: 12, paddingRight: 18 },
  officialCard: { width: 220, height: 170, borderRadius: 20, overflow: 'hidden', backgroundColor: SURFACE, borderWidth: 1, borderColor: '#425348' },
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
  discoverCard: { width: 176, height: 136, borderRadius: 18, overflow: 'hidden', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  discoverImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  discoverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.34)' },
  discoverCopy: { position: 'absolute', left: 11, right: 11, bottom: 10 },
  discoverTitle: { color: '#FFFDF6', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  discoverMeta: { color: '#E1E8E3', fontSize: 10.5, marginTop: 4, fontWeight: '700' },
  discoverJoin: { position: 'absolute', right: 9, top: 9, borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 9, paddingVertical: 5 },
  discoverJoinText: { color: '#101510', fontSize: 9.5, fontWeight: '900' },
  discoverInitials: { color: GOLD, fontSize: 24, fontWeight: '900' },
  emptyState: { borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 18, alignItems: 'flex-start' },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '900', marginTop: 10 },
  emptyCopy: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 4 },
  pressed: { opacity: 0.72 },
});
