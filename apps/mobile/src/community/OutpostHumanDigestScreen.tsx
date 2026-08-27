import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { distanceMiles, pointForCity } from '../explore/location';
import { listLocalEvents, setLocalEventRsvp, type LocalEvent } from '../local-events/api';
import { getMemberBasecamp } from '../member/api';
import { listNotifications, markNotificationRead } from '../notifications/api';
import type { MemberNotification } from '../notifications/types';
import { getCommunityFeed, getGroups, joinGroup, type CommunityGroup, type CommunityPost } from './api';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const CARD_SOFT = '#141E19';
const BORDER = '#28362E';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const GREEN = '#7F9D68';
const NEAR_RADIUS_MILES = 50;
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type OutpostTab = 'campfires' | 'communities' | 'outings';
type DigestFilter = 'for-you' | 'my-camps' | 'nearby';
type LoadErrors = { feed?: string; groups?: string; events?: string; notifications?: string; profile?: string };

type CommunityDigest = {
  group: CommunityGroup;
  posts: CommunityPost[];
  recentPosts: CommunityPost[];
  highlight: CommunityPost | null;
  outingCount: number;
  score: number;
};

const tabs: { value: OutpostTab; label: string }[] = [
  { value: 'campfires', label: 'Campfires' },
  { value: 'communities', label: 'Communities' },
  { value: 'outings', label: 'Outings' },
];

const digestFilters: { value: DigestFilter; label: string; icon: string }[] = [
  { value: 'for-you', label: 'For You', icon: 'sparkles-outline' },
  { value: 'my-camps', label: 'My Camps', icon: 'people-outline' },
  { value: 'nearby', label: 'Nearby', icon: 'location-outline' },
];

function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function communityCover(group: CommunityGroup) {
  return group.cover_image_url || group.image_url;
}

function isOfficialCommunity(group: CommunityGroup) {
  return group.kind === 'interest';
}

function locationLabel(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(', ');
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

function eventTime(event: LocalEvent) {
  const date = new Date(event.starts_at);
  return `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function isPriorityNotification(notification: MemberNotification) {
  return notification.priority === 'high' || notification.priority === 'critical' || notification.kind === 'announcement' || notification.kind === 'emergency' || notification.kind === 'registration' || notification.kind === 'community';
}

function notificationIcon(notification: MemberNotification) {
  if (notification.kind === 'emergency') return 'warning-outline';
  if (notification.kind === 'registration') return 'calendar-outline';
  if (notification.kind === 'announcement') return 'megaphone-outline';
  if (notification.kind === 'community') return 'chatbubble-outline';
  return 'notifications-outline';
}

function digestSummary(digest: CommunityDigest) {
  const parts: string[] = [];
  if (digest.recentPosts.length) parts.push(`${digest.recentPosts.length} conversation${digest.recentPosts.length === 1 ? '' : 's'} this week`);
  if (digest.outingCount) parts.push(`${digest.outingCount} upcoming outing${digest.outingCount === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'No recent activity';
}

function GroupImage({ group, size = 56 }: { group: CommunityGroup; size?: number }) {
  const cover = communityCover(group);
  return cover ? <Image source={{ uri: cover }} style={{ width: size, height: size, borderRadius: 14, backgroundColor: CARD }} /> : (
    <View style={[styles.groupFallback, { width: size, height: size, borderRadius: 14 }]}><Text style={styles.groupFallbackText}>{initials(group.name)}</Text></View>
  );
}

function SectionHeader({ title, detail, action, onAction }: { title: string; detail?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable style={styles.sectionAction} onPress={onAction} accessibilityRole="button">
          <Text style={styles.sectionActionText}>{action}</Text><Ionicons name="arrow-forward" size={14} color={GOLD} />
        </Pressable>
      ) : null}
    </View>
  );
}

function NotificationRow({ item, now, onOpen }: { item: MemberNotification; now: number; onOpen: (item: MemberNotification) => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.noticeRow, pressed && styles.pressed]} onPress={() => onOpen(item)}>
      <View style={[styles.noticeIcon, item.priority === 'critical' && styles.noticeIconCritical]}>
        <Ionicons name={notificationIcon(item) as any} size={20} color={item.priority === 'critical' ? '#FFD6CF' : GOLD} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.noticeTitle} numberOfLines={2}>{item.title}</Text>
        {item.body ? <Text style={styles.noticeBody} numberOfLines={2}>{item.body}</Text> : null}
        <Text style={styles.noticeMeta}>{relativeTime(item.created_at, now)} · New</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={MUTED} />
    </Pressable>
  );
}

function FeaturedPost({ post, now }: { post: CommunityPost; now: number }) {
  const media = post.image_url || (post.media_type === 'image' ? post.media_url : null);
  return (
    <Pressable style={({ pressed }) => [styles.featuredPost, pressed && styles.pressed]} onPress={() => router.push(`/community/${post.id}`)}>
      {media ? <Image source={{ uri: media }} style={styles.featuredImage} resizeMode="cover" /> : null}
      <View style={styles.featuredBody}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}
          </View>
          <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
          <Text style={styles.postTime}>{relativeTime(post.created_at, now)}</Text>
        </View>
        {post.body ? <Text style={styles.featuredText} numberOfLines={3}>{post.body}</Text> : null}
        <View style={styles.engagementRow}>
          <Ionicons name="heart-outline" size={16} color={MUTED} /><Text style={styles.engagementText}>{post.reaction_count || 0}</Text>
          <Ionicons name="chatbubble-outline" size={15} color={MUTED} /><Text style={styles.engagementText}>{post.comment_count || 0}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CampActivityBlock({ digest, now }: { digest: CommunityDigest; now: number }) {
  const hasActivity = digest.recentPosts.length > 0 || Boolean(digest.highlight);
  return (
    <View style={styles.campBlock}>
      <Pressable style={styles.campBlockHeader} onPress={() => router.push({ pathname: '/groups/[id]', params: { id: digest.group.id } })}>
        <GroupImage group={digest.group} size={52} />
        <View style={styles.flex}>
          <View style={styles.nameLine}>
            <Text style={styles.campName} numberOfLines={1}>{digest.group.name}</Text>
            {isOfficialCommunity(digest.group) ? <Ionicons name="checkmark-circle" size={14} color={GOLD} /> : null}
          </View>
          <Text style={styles.campSummary}>{digestSummary(digest)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={GOLD} />
      </Pressable>
      {hasActivity && digest.highlight ? <FeaturedPost post={digest.highlight} now={now} /> : null}
    </View>
  );
}

function ComingUpCard({ event, onRsvp }: { event: LocalEvent; onRsvp: (event: LocalEvent) => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.comingCard, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      {event.image_url ? <Image source={{ uri: event.image_url }} style={styles.comingImage} /> : <View style={[styles.comingImage, styles.eventFallback]}><Ionicons name="calendar-outline" size={30} color={GOLD} /></View>}
      <View style={styles.comingContent}>
        <View style={styles.statusRow}>
          {event.my_rsvp === 'going' ? <View style={styles.statusPill}><Text style={styles.statusPillText}>You’re going</Text></View> : event.my_rsvp === 'interested' ? <View style={styles.statusPillSoft}><Text style={styles.statusPillSoftText}>Interested</Text></View> : null}
          {event.rsvp_count > 0 ? <Text style={styles.rsvpCount}>{event.rsvp_count} attending</Text> : null}
        </View>
        <Text style={styles.comingTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.comingMeta}>{eventTime(event)}</Text>
        <Text style={styles.comingMeta} numberOfLines={1}>{locationLabel(event.venue_name || event.city, event.state)}</Text>
        {!event.my_rsvp || event.my_rsvp === 'cancelled' ? (
          <Pressable style={styles.interestedButton} onPress={(pressEvent) => { pressEvent.stopPropagation(); onRsvp(event); }}>
            <Text style={styles.interestedText}>Interested</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function CommunityRow({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.communityRow, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      <GroupImage group={group} size={58} />
      <View style={styles.flex}>
        <View style={styles.nameLine}><Text style={styles.communityName} numberOfLines={1}>{group.name}</Text>{isOfficialCommunity(group) ? <Ionicons name="checkmark-circle" size={14} color={GOLD} /> : null}</View>
        {group.description ? <Text style={styles.communityDescription} numberOfLines={2}>{group.description}</Text> : null}
        <Text style={styles.communityMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
      </View>
      {group.is_member ? <Ionicons name="chevron-forward" size={18} color={MUTED} /> : (
        <Pressable disabled={joining} style={[styles.joinButton, joining && styles.buttonDisabled]} onPress={(event) => { event.stopPropagation(); onJoin(group); }}>
          <Text style={styles.joinButtonText}>{joining ? 'Joining…' : 'Join'}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function OutpostHumanDigestScreen() {
  const [activeTab, setActiveTab] = useState<OutpostTab>('campfires');
  const [digestFilter, setDigestFilter] = useState<DigestFilter>('for-you');
  const [feed, setFeed] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [errors, setErrors] = useState<LoadErrors>({});

  const loadAll = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    const snapshot = new Date().getTime();
    const [feedResult, groupsResult, eventsResult, notificationsResult, profileResult] = await Promise.allSettled([
      getCommunityFeed(), getGroups(), listLocalEvents(), listNotifications(), getMemberBasecamp(),
    ]);
    const nextErrors: LoadErrors = {};
    if (feedResult.status === 'fulfilled') setFeed(feedResult.value); else nextErrors.feed = 'Community activity is temporarily unavailable.';
    if (groupsResult.status === 'fulfilled') setGroups(groupsResult.value); else nextErrors.groups = 'Communities are temporarily unavailable.';
    if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value); else nextErrors.events = 'Upcoming outings are temporarily unavailable.';
    if (notificationsResult.status === 'fulfilled') setNotifications(notificationsResult.value); else nextErrors.notifications = 'Important updates are temporarily unavailable.';
    if (profileResult.status === 'fulfilled') {
      setHomeCity((profileResult.value.profile?.home_city as string | null | undefined) ?? null);
      setHomeState((profileResult.value.profile?.home_state as string | null | undefined) ?? null);
    } else nextErrors.profile = 'Your area could not be loaded.';
    setLoadedAt(snapshot);
    setErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void loadAll(false); }, [loadAll]));

  const joinedGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const officialGroups = useMemo(() => groups.filter(isOfficialCommunity), [groups]);
  const homePoint = useMemo(() => homeCity && homeState ? pointForCity(homeCity, homeState) : null, [homeCity, homeState]);

  const isNearbyGroup = useCallback((group: CommunityGroup) => {
    if (!homePoint || !group.city || !group.state) return false;
    const point = pointForCity(group.city, group.state);
    return point ? distanceMiles(homePoint, point) <= NEAR_RADIUS_MILES : false;
  }, [homePoint]);

  const isNearbyEvent = useCallback((event: LocalEvent) => {
    if (!homePoint) return false;
    const point = pointForCity(event.city, event.state);
    return point ? distanceMiles(homePoint, point) <= NEAR_RADIUS_MILES : false;
  }, [homePoint]);

  const digests = useMemo(() => {
    const byGroup = new Map<string, CommunityPost[]>();
    for (const post of feed) {
      if (!post.group_id) continue;
      const current = byGroup.get(post.group_id) ?? [];
      current.push(post);
      byGroup.set(post.group_id, current);
    }
    const recentCutoff = loadedAt - RECENT_WINDOW_MS;
    return joinedGroups.map((group): CommunityDigest => {
      const posts = (byGroup.get(group.id) ?? []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const recentPosts = posts.filter((post) => new Date(post.created_at).getTime() >= recentCutoff);
      const outingCount = events.filter((event) => event.group_id === group.id).length;
      const highlight = recentPosts.slice().sort((a, b) => ((b.image_url || b.media_url ? 5 : 0) + b.comment_count * 2 + b.reaction_count) - ((a.image_url || a.media_url ? 5 : 0) + a.comment_count * 2 + a.reaction_count))[0] ?? posts[0] ?? null;
      const latestTime = posts[0] ? new Date(posts[0].created_at).getTime() : 0;
      const recencyBoost = latestTime && loadedAt ? Math.max(0, 7 - ((loadedAt - latestTime) / (24 * 60 * 60 * 1000))) : 0;
      const visualBoost = highlight && (highlight.image_url || highlight.media_url) ? 4 : 0;
      const score = recentPosts.length * 3 + outingCount * 2 + recencyBoost + visualBoost;
      return { group, posts, recentPosts, highlight, outingCount, score };
    });
  }, [events, feed, joinedGroups, loadedAt]);

  const visibleDigests = useMemo(() => {
    const activeFirst = (items: CommunityDigest[]) => items.slice().sort((a, b) => {
      const aActive = a.recentPosts.length || a.outingCount ? 1 : 0;
      const bActive = b.recentPosts.length || b.outingCount ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.score - a.score;
    });
    if (digestFilter === 'nearby') return activeFirst(digests.filter((digest) => isNearbyGroup(digest.group))).slice(0, 5);
    if (digestFilter === 'my-camps') return activeFirst(digests);
    return activeFirst(digests).slice(0, 5);
  }, [digestFilter, digests, isNearbyGroup]);

  const important = useMemo(() => notifications.filter((item) => !item.read_at && isPriorityNotification(item)).slice(0, 3), [notifications]);

  const comingUp = useMemo(() => {
    const sorted = events.slice().sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    if (digestFilter === 'nearby') return sorted.filter(isNearbyEvent).slice(0, 4);
    const joinedIds = new Set(joinedGroups.map((group) => group.id));
    const relevant = sorted.filter((event) => event.my_rsvp === 'going' || event.my_rsvp === 'interested' || (event.group_id && joinedIds.has(event.group_id)));
    return (relevant.length ? relevant : sorted).slice(0, 4);
  }, [digestFilter, events, isNearbyEvent, joinedGroups]);

  const handleJoin = useCallback(async (group: CommunityGroup) => {
    if (joiningId) return;
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      setGroups((current) => current.map((item) => item.id === group.id ? { ...item, is_member: true, member_count: item.member_count + 1 } : item));
    } finally { setJoiningId(null); }
  }, [joiningId]);

  const handleNotification = useCallback(async (notification: MemberNotification) => {
    if (!notification.read_at) {
      try {
        await markNotificationRead(notification.id);
        const readAt = new Date().toISOString();
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item));
      } catch { /* navigation still works */ }
    }
    if (notification.action_url?.startsWith('/')) router.push(notification.action_url as never); else router.push('/notifications' as never);
  }, []);

  const handleRsvp = useCallback(async (event: LocalEvent) => {
    try {
      await setLocalEventRsvp(event.id, 'interested');
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, my_rsvp: 'interested' } : item));
    } catch { /* detail screen remains available */ }
  }, []);

  const renderCampfires = () => {
    if (loading && !groups.length && !feed.length && !events.length) return <View style={styles.loadingWrap}><ActivityIndicator color={GOLD} /><Text style={styles.loadingText}>Catching up your Outpost…</Text></View>;
    const noCamps = joinedGroups.length === 0;
    return (
      <>
        <View style={styles.filterRow}>
          {digestFilters.map((filter) => {
            const selected = digestFilter === filter.value;
            return <Pressable key={filter.value} style={[styles.filterButton, selected && styles.filterButtonSelected]} onPress={() => setDigestFilter(filter.value)}><Ionicons name={filter.icon as any} size={16} color={selected ? GOLD : MUTED} /><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter.label}</Text></Pressable>;
          })}
        </View>

        {noCamps ? (
          <View style={styles.discoveryCard}>
            <View style={styles.discoveryIcon}><Ionicons name="people-outline" size={28} color={GOLD} /></View>
            <Text style={styles.discoveryEyebrow}>YOUR OUTPOST STARTS HERE</Text>
            <Text style={styles.discoveryTitle}>Find your people outdoors.</Text>
            <Text style={styles.discoveryCopy}>Join a community and this page becomes your living catch-up across conversations, photos, and outings.</Text>
            <Pressable style={styles.primaryButton} onPress={() => setActiveTab('communities')}><Text style={styles.primaryButtonText}>Explore communities</Text><Ionicons name="arrow-forward" size={17} color="#101510" /></Pressable>
          </View>
        ) : null}

        {!noCamps && digestFilter === 'for-you' ? (
          <View style={styles.section}>
            <SectionHeader title="Important" detail="Only the things that need your attention." action={important.length ? 'View all' : undefined} onAction={() => router.push('/notifications' as never)} />
            {errors.notifications ? <Text style={styles.inlineError}>{errors.notifications}</Text> : important.length ? important.map((item) => <NotificationRow key={item.id} item={item} now={loadedAt} onOpen={handleNotification} />) : <View style={styles.quietState}><Ionicons name="checkmark-circle-outline" size={20} color={GREEN} /><Text style={styles.quietStateText}>Nothing urgent right now.</Text></View>}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Coming up" detail={digestFilter === 'nearby' ? 'Outings close to your area.' : 'Plans from your communities and the people around you.'} action="See all" onAction={() => setActiveTab('outings')} />
          {errors.events ? <Text style={styles.inlineError}>{errors.events}</Text> : comingUp.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comingRail}>{comingUp.map((event) => <ComingUpCard key={event.id} event={event} onRsvp={handleRsvp} />)}</ScrollView>
          ) : <View style={styles.quietState}><Ionicons name="calendar-outline" size={20} color={GREEN} /><Text style={styles.quietStateText}>No upcoming outings found.</Text></View>}
        </View>

        {!noCamps ? (
          <View style={styles.section}>
            <SectionHeader title="Around the Campfire" detail={digestFilter === 'nearby' ? 'Highlights from camps near your area.' : 'Highlights from the communities you’re part of.'} action={digestFilter === 'for-you' && digests.length > visibleDigests.length ? 'See all' : undefined} onAction={() => setDigestFilter('my-camps')} />
            {errors.feed || errors.groups ? <Text style={styles.inlineError}>{errors.feed ?? errors.groups}</Text> : visibleDigests.length ? visibleDigests.map((digest) => <CampActivityBlock key={digest.group.id} digest={digest} now={loadedAt} />) : <View style={styles.quietState}><Ionicons name="compass-outline" size={20} color={GREEN} /><Text style={styles.quietStateText}>No camp activity to show here yet.</Text></View>}
          </View>
        ) : null}
      </>
    );
  };

  const renderCommunities = () => (
    <View style={styles.section}>
      <SectionHeader title="Communities" detail="Find your interests, local crews, and official Go Melanated spaces." />
      {errors.groups ? <Text style={styles.inlineError}>{errors.groups}</Text> : officialGroups.map((group) => <CommunityRow key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}
      {groups.filter((group) => !isOfficialCommunity(group)).map((group) => <CommunityRow key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}
    </View>
  );

  const renderOutings = () => (
    <View style={styles.section}>
      <SectionHeader title="Outings" detail="Turn the conversation into a real day outside." />
      {errors.events ? <Text style={styles.inlineError}>{errors.events}</Text> : events.length ? events.map((event) => <ComingUpCard key={event.id} event={event} onRsvp={handleRsvp} />) : <Text style={styles.emptyText}>No upcoming outings found.</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll(true)} tintColor={GOLD} colors={[GOLD]} />}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.title}>Outpost</Text>
            <View style={styles.locationLine}><Ionicons name="location-outline" size={16} color={GREEN} /><Text style={styles.locationText}>{homeCity ? locationLabel(homeCity, homeState) : 'Your area'}</Text></View>
          </View>
          <Pressable style={styles.headerAction} onPress={() => router.push('/notifications' as never)} accessibilityLabel="Open notifications"><Ionicons name="notifications-outline" size={21} color={TEXT} />{notifications.some((item) => !item.read_at) ? <View style={styles.unreadDot} /> : null}</Pressable>
        </View>

        <View style={styles.tabs}>{tabs.map((tab) => { const selected = activeTab === tab.value; return <Pressable key={tab.value} style={[styles.tab, selected && styles.tabSelected]} onPress={() => setActiveTab(tab.value)}><Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text></Pressable>; })}</View>
        {activeTab === 'campfires' ? renderCampfires() : activeTab === 'communities' ? renderCommunities() : renderOutings()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 44 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { color: TEXT, fontSize: 38, lineHeight: 43, fontWeight: '800', letterSpacing: -1.2 },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  locationText: { color: GREEN, fontSize: 14, fontWeight: '700' },
  headerAction: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  unreadDot: { position: 'absolute', right: 8, top: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD, borderWidth: 1.5, borderColor: BG },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, marginBottom: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabSelected: { borderBottomColor: GOLD },
  tabText: { color: MUTED, fontSize: 15, fontWeight: '700' },
  tabTextSelected: { color: GOLD },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, marginBottom: 2 },
  filterButton: { flex: 1, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  filterButtonSelected: { borderColor: GOLD, backgroundColor: '#1B251C' },
  filterText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  filterTextSelected: { color: TEXT },
  section: { marginTop: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 10 },
  sectionTitle: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.5 },
  sectionDetail: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 2 },
  sectionAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 8 },
  sectionActionText: { color: GOLD, fontSize: 13, fontWeight: '800' },
  loadingWrap: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: MUTED, fontSize: 14 },
  noticeRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  noticeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#253124', alignItems: 'center', justifyContent: 'center' },
  noticeIconCritical: { backgroundColor: '#54231F' },
  noticeTitle: { color: TEXT, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  noticeBody: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 1 },
  noticeMeta: { color: GREEN, fontSize: 11, marginTop: 4, fontWeight: '700' },
  quietState: { minHeight: 58, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 3 },
  quietStateText: { color: MUTED, fontSize: 14 },
  comingRail: { gap: 12, paddingRight: 8 },
  comingCard: { width: 286, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 18, overflow: 'hidden', marginBottom: 10 },
  comingImage: { width: '100%', height: 142, backgroundColor: CARD },
  eventFallback: { alignItems: 'center', justifyContent: 'center' },
  comingContent: { padding: 13 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 },
  statusPill: { backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillText: { color: '#101510', fontSize: 10, fontWeight: '900' },
  statusPillSoft: { backgroundColor: '#253124', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillSoftText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  rsvpCount: { color: MUTED, fontSize: 11, fontWeight: '700' },
  comingTitle: { color: TEXT, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 6 },
  comingMeta: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3 },
  interestedButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: GOLD, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginTop: 10 },
  interestedText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  campBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER, paddingTop: 10, paddingBottom: 14 },
  campBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 10 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  campName: { color: TEXT, fontSize: 17, fontWeight: '900', flexShrink: 1 },
  campSummary: { color: GREEN, fontSize: 12, lineHeight: 17, marginTop: 3, fontWeight: '700' },
  featuredPost: { backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 18, overflow: 'hidden' },
  featuredImage: { width: '100%', height: 210, backgroundColor: CARD },
  featuredBody: { padding: 13 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#26352B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 13, fontWeight: '900', flexShrink: 1 },
  postTime: { color: MUTED, fontSize: 11 },
  featuredText: { color: TEXT, fontSize: 16, lineHeight: 23, marginTop: 10, fontWeight: '700' },
  engagementRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  engagementText: { color: MUTED, fontSize: 12, marginRight: 9 },
  groupFallback: { backgroundColor: '#26352B', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  groupFallbackText: { color: GOLD, fontSize: 16, fontWeight: '900' },
  communityRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  communityName: { color: TEXT, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  communityDescription: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 2 },
  communityMeta: { color: GREEN, fontSize: 11, marginTop: 4, fontWeight: '700' },
  joinButton: { minWidth: 56, minHeight: 36, borderRadius: 18, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  joinButtonText: { color: '#101510', fontSize: 12, fontWeight: '900' },
  buttonDisabled: { opacity: 0.55 },
  discoveryCard: { marginTop: 12, padding: 20, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 20 },
  discoveryIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#253124', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  discoveryEyebrow: { color: GREEN, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  discoveryTitle: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 6 },
  discoveryCopy: { color: MUTED, fontSize: 14, lineHeight: 21, marginTop: 8 },
  primaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  primaryButtonText: { color: '#101510', fontSize: 14, fontWeight: '900' },
  inlineError: { color: '#F4B5AA', fontSize: 13, lineHeight: 18, paddingVertical: 12 },
  emptyText: { color: MUTED, fontSize: 13, lineHeight: 18, paddingVertical: 12 },
  pressed: { opacity: 0.72 },
});
