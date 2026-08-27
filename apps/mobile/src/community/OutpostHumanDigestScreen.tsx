import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
const CARD_INSET = '#101A15';
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
  return parts.length ? parts.join(' · ') : 'Quiet right now';
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
          <Text style={styles.sectionActionText}>{action}</Text><Ionicons name="arrow-forward" size={13} color={GOLD} />
        </Pressable>
      ) : null}
    </View>
  );
}

function NotificationRow({ item, now, onOpen, isLast }: { item: MemberNotification; now: number; onOpen: (item: MemberNotification) => void; isLast: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.noticeRow, !isLast && styles.internalDivider, pressed && styles.pressed]} onPress={() => onOpen(item)}>
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
          <View style={styles.avatar}>{post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}</View>
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

function CampActivityBlock({ digest, now, isLast }: { digest: CommunityDigest; now: number; isLast: boolean }) {
  const hasActivity = digest.recentPosts.length > 0 && Boolean(digest.highlight);
  return (
    <View style={[styles.campBlock, !isLast && styles.campDivider]}>
      <Pressable style={styles.campBlockHeader} onPress={() => router.push({ pathname: '/groups/[id]', params: { id: digest.group.id } })}>
        <GroupImage group={digest.group} size={52} />
        <View style={styles.flex}>
          <View style={styles.nameLine}>
            <Text style={styles.campName} numberOfLines={1}>{digest.group.name}</Text>
            {isOfficialCommunity(digest.group) ? <Ionicons name="checkmark-circle" size={14} color={GOLD} /> : null}
          </View>
          <Text style={[styles.campSummary, !hasActivity && styles.campSummaryQuiet]}>{digestSummary(digest)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={GOLD} />
      </Pressable>
      {hasActivity && digest.highlight ? <FeaturedPost post={digest.highlight} now={now} /> : null}
    </View>
  );
}

function ComingUpCard({ event, onRsvp, fullWidth = false }: { event: LocalEvent; onRsvp: (event: LocalEvent) => void; fullWidth?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.comingCard, fullWidth && styles.comingCardFull, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
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
          <Pressable style={styles.interestedButton} onPress={(pressEvent) => { pressEvent.stopPropagation(); onRsvp(event); }}><Text style={styles.interestedText}>Interested</Text></Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function OfficialCommunityCard({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const cover = communityCover(group);
  return (
    <Pressable style={({ pressed }) => [styles.officialCommunityCard, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      {cover ? <Image source={{ uri: cover }} style={styles.officialCommunityImage} /> : <View style={[styles.officialCommunityImage, styles.officialCommunityFallback]}><Text style={styles.officialCommunityInitials}>{initials(group.name)}</Text></View>}
      <View style={styles.officialCommunityShade} />
      <View style={styles.officialCommunityBadge}><Ionicons name="checkmark" size={10} color="#101510" /><Text style={styles.officialCommunityBadgeText}>Official</Text></View>
      {group.is_member ? <View style={styles.officialJoinedBadge}><Ionicons name="checkmark" size={10} color={TEXT} /><Text style={styles.officialJoinedBadgeText}>Joined</Text></View> : null}
      <View style={styles.officialCommunityCopy}>
        <Text style={styles.officialCommunityTitle} numberOfLines={2}>{group.name}</Text>
        <View style={styles.officialCommunityFooter}>
          <Ionicons name="people-outline" size={13} color="#EEF2EF" />
          <Text style={styles.officialCommunityMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
          {!group.is_member ? <Text style={styles.officialCommunityJoin}>{joining ? 'Joining…' : 'Join'}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function JoinedCommunityRow({ group, now, latestPost }: { group: CommunityGroup; now: number; latestPost?: CommunityPost }) {
  const activity = latestPost ? `${latestPost.author_name} posted · ${relativeTime(latestPost.created_at, now)}` : `${group.member_count} member${group.member_count === 1 ? '' : 's'}`;
  return (
    <Pressable style={({ pressed }) => [styles.joinedCommunityRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}>
      <GroupImage group={group} size={54} />
      <View style={styles.flex}>
        <View style={styles.nameLine}><Text style={styles.joinedCommunityName} numberOfLines={1}>{group.name}</Text>{isOfficialCommunity(group) ? <Ionicons name="checkmark-circle" size={14} color={GOLD} /> : null}</View>
        <Text style={[styles.joinedCommunityActivity, latestPost && styles.joinedCommunityActivityLive]} numberOfLines={1}>{activity}</Text>
      </View>
      {latestPost ? <View style={styles.activityDot} /> : null}
      <Ionicons name="chevron-forward" size={18} color={GOLD} />
    </Pressable>
  );
}

function DiscoverCommunityCard({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const cover = communityCover(group);
  return (
    <Pressable style={({ pressed }) => [styles.discoverCommunityCard, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      {cover ? <Image source={{ uri: cover }} style={styles.discoverCommunityImage} /> : <View style={[styles.discoverCommunityImage, styles.discoverCommunityFallback]}><Text style={styles.discoverCommunityInitials}>{initials(group.name)}</Text></View>}
      <View style={styles.discoverCommunityShade} />
      <View style={styles.discoverCommunityCopy}>
        <Text style={styles.discoverCommunityTitle} numberOfLines={2}>{group.name}</Text>
        <Text style={styles.discoverCommunityMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
      </View>
      {!group.is_member ? <View style={styles.discoverJoinPill}><Text style={styles.discoverJoinText}>{joining ? 'Joining…' : 'Join'}</Text></View> : null}
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
  const [communityQuery, setCommunityQuery] = useState('');

  const loadAll = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    const snapshot = new Date().getTime();
    const [feedResult, groupsResult, eventsResult, notificationsResult, profileResult] = await Promise.allSettled([getCommunityFeed(), getGroups(), listLocalEvents(), listNotifications(), getMemberBasecamp()]);
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

  const latestPostByGroup = useMemo(() => {
    const result = new Map<string, CommunityPost>();
    const ordered = feed.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (const post of ordered) if (post.group_id && !result.has(post.group_id)) result.set(post.group_id, post);
    return result;
  }, [feed]);

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
        <View style={styles.segmentedControl}>
          {digestFilters.map((filter) => {
            const selected = digestFilter === filter.value;
            return <Pressable key={filter.value} style={[styles.segment, selected && styles.segmentSelected]} onPress={() => setDigestFilter(filter.value)}><Ionicons name={filter.icon as any} size={16} color={selected ? GOLD : MUTED} /><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{filter.label}</Text></Pressable>;
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
          <View style={[styles.sectionCard, styles.importantCard]}>
            <SectionHeader title="Important" detail="Only the things that need your attention." action={important.length ? 'View all' : undefined} onAction={() => router.push('/notifications' as never)} />
            {errors.notifications ? <Text style={styles.inlineError}>{errors.notifications}</Text> : important.length ? important.map((item, index) => <NotificationRow key={item.id} item={item} now={loadedAt} onOpen={handleNotification} isLast={index === important.length - 1} />) : (
              <View style={styles.allClearRow}>
                <View style={styles.allClearIcon}><Ionicons name="checkmark" size={17} color={GREEN} /></View>
                <View style={styles.flex}><Text style={styles.allClearTitle}>Nothing urgent right now.</Text><Text style={styles.allClearCopy}>You’re all caught up.</Text></View>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <SectionHeader title="Coming up" detail={digestFilter === 'nearby' ? 'Outings close to your area.' : 'Plans from your communities and the people around you.'} action="See all" onAction={() => setActiveTab('outings')} />
          {errors.events ? <Text style={styles.inlineError}>{errors.events}</Text> : comingUp.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comingRail}>{comingUp.map((event) => <ComingUpCard key={event.id} event={event} onRsvp={handleRsvp} />)}</ScrollView>
          ) : <View style={styles.compactEmpty}><Ionicons name="calendar-outline" size={19} color={GREEN} /><Text style={styles.compactEmptyText}>No upcoming outings found.</Text></View>}
        </View>

        {!noCamps ? (
          <View style={styles.sectionCard}>
            <SectionHeader title="Around the Campfire" detail={digestFilter === 'nearby' ? 'Highlights from camps near your area.' : 'Highlights from the communities you’re part of.'} action={digestFilter === 'for-you' && digests.length > visibleDigests.length ? 'See all' : undefined} onAction={() => setDigestFilter('my-camps')} />
            {errors.feed || errors.groups ? <Text style={styles.inlineError}>{errors.feed ?? errors.groups}</Text> : visibleDigests.length ? visibleDigests.map((digest, index) => <CampActivityBlock key={digest.group.id} digest={digest} now={loadedAt} isLast={index === visibleDigests.length - 1} />) : <View style={styles.compactEmpty}><Ionicons name="compass-outline" size={19} color={GREEN} /><Text style={styles.compactEmptyText}>No camp activity to show here yet.</Text></View>}
          </View>
        ) : null}
      </>
    );
  };

  const renderCommunities = () => {
    const query = communityQuery.trim().toLowerCase();
    const matches = (group: CommunityGroup) => !query || `${group.name} ${group.description ?? ''} ${group.city ?? ''} ${group.state ?? ''}`.toLowerCase().includes(query);
    const filteredOfficial = officialGroups.filter(matches);
    const filteredJoined = joinedGroups.filter(matches);
    const discoverCandidates = groups.filter((group) => !group.is_member && matches(group));
    const discover = [
      ...discoverCandidates.filter((group) => !isOfficialCommunity(group)),
      ...discoverCandidates.filter(isOfficialCommunity),
    ].slice(0, 8);

    return (
      <View style={styles.communitiesPage}>
        <View style={styles.communitySearch}>
          <Ionicons name="search-outline" size={19} color={MUTED} />
          <TextInput
            value={communityQuery}
            onChangeText={setCommunityQuery}
            placeholder="Search communities"
            placeholderTextColor="#7F8B84"
            style={styles.communitySearchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {communityQuery ? <Pressable onPress={() => setCommunityQuery('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={MUTED} /></Pressable> : null}
        </View>

        <View style={styles.communitySection}>
          <SectionHeader title="Official Communities" detail="Go Melanated spaces built around how you get outside." />
          {errors.groups ? <Text style={styles.inlineError}>{errors.groups}</Text> : filteredOfficial.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.officialCommunityRail}>
              {filteredOfficial.map((group) => <OfficialCommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}
            </ScrollView>
          ) : <Text style={styles.emptyText}>No official communities match your search.</Text>}
        </View>

        <View style={styles.communitySection}>
          <SectionHeader title="Your Communities" detail={filteredJoined.length ? `${filteredJoined.length} joined` : undefined} />
          {filteredJoined.length ? (
            <View style={styles.joinedCommunityList}>{filteredJoined.map((group) => <JoinedCommunityRow key={group.id} group={group} now={loadedAt} latestPost={latestPostByGroup.get(group.id)} />)}</View>
          ) : <Text style={styles.emptyText}>{query ? 'None of your communities match this search.' : 'Join a community and it will show up here.'}</Text>}
        </View>

        <View style={styles.communitySection}>
          <SectionHeader title="Discover More Communities" detail="More ways to find your people and get outside." />
          {discover.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoverCommunityRail}>
              {discover.map((group) => <DiscoverCommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}
            </ScrollView>
          ) : <Text style={styles.emptyText}>{query ? 'No more communities match your search.' : 'You’ve joined everything available right now.'}</Text>}
        </View>
      </View>
    );
  };

  const renderOutings = () => (
    <View style={styles.sectionCard}>
      <SectionHeader title="Outings" detail="Turn the conversation into a real day outside." />
      {errors.events ? <Text style={styles.inlineError}>{errors.events}</Text> : events.length ? events.map((event) => <ComingUpCard key={event.id} event={event} onRsvp={handleRsvp} fullWidth />) : <Text style={styles.emptyText}>No upcoming outings found.</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll(true)} tintColor={GOLD} colors={[GOLD]} />} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.flex}><Text style={styles.title}>Outpost</Text><View style={styles.locationLine}><Ionicons name="location-outline" size={16} color={GREEN} /><Text style={styles.locationText}>{homeCity ? locationLabel(homeCity, homeState) : 'Your area'}</Text></View></View>
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
  segmentedControl: { flexDirection: 'row', gap: 4, padding: 4, marginTop: 2, marginBottom: 10, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 24 },
  segment: { flex: 1, minHeight: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  segmentSelected: { backgroundColor: '#1B251C', borderWidth: 1, borderColor: GOLD },
  segmentText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  segmentTextSelected: { color: TEXT },
  sectionCard: { marginTop: 14, padding: 16, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 20, overflow: 'hidden' },
  importantCard: { marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  sectionTitle: { color: TEXT, fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.4 },
  sectionDetail: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 2 },
  sectionAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 },
  sectionActionText: { color: GOLD, fontSize: 12, fontWeight: '800' },
  loadingWrap: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: MUTED, fontSize: 14 },
  internalDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  noticeRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  noticeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#253124', alignItems: 'center', justifyContent: 'center' },
  noticeIconCritical: { backgroundColor: '#54231F' },
  noticeTitle: { color: TEXT, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  noticeBody: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 1 },
  noticeMeta: { color: GREEN, fontSize: 11, marginTop: 4, fontWeight: '700' },
  allClearRow: { minHeight: 58, borderRadius: 15, backgroundColor: CARD_INSET, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 10 },
  allClearIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  allClearTitle: { color: TEXT, fontSize: 14, fontWeight: '800' },
  allClearCopy: { color: MUTED, fontSize: 12, marginTop: 2 },
  compactEmpty: { minHeight: 52, borderRadius: 14, backgroundColor: CARD_INSET, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  compactEmptyText: { color: MUTED, fontSize: 13 },
  comingRail: { gap: 12, paddingRight: 4 },
  comingCard: { width: 268, backgroundColor: CARD_INSET, borderWidth: 1, borderColor: BORDER, borderRadius: 17, overflow: 'hidden' },
  comingCardFull: { width: '100%', marginBottom: 12 },
  comingImage: { width: '100%', height: 132, backgroundColor: CARD },
  eventFallback: { alignItems: 'center', justifyContent: 'center' },
  comingContent: { padding: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 22 },
  statusPill: { backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillText: { color: '#101510', fontSize: 10, fontWeight: '900' },
  statusPillSoft: { backgroundColor: '#253124', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillSoftText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  rsvpCount: { color: MUTED, fontSize: 11, fontWeight: '700' },
  comingTitle: { color: TEXT, fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 6 },
  comingMeta: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3 },
  interestedButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: GOLD, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginTop: 10 },
  interestedText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  campBlock: { paddingVertical: 12 },
  campDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  campBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  campName: { color: TEXT, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  campSummary: { color: GREEN, fontSize: 12, lineHeight: 17, marginTop: 3, fontWeight: '700' },
  campSummaryQuiet: { color: MUTED, fontWeight: '600' },
  featuredPost: { marginTop: 10, backgroundColor: CARD_INSET, borderRadius: 16, overflow: 'hidden' },
  featuredImage: { width: '100%', height: 190, backgroundColor: CARD },
  featuredBody: { padding: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#26352B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 13, fontWeight: '900', flexShrink: 1 },
  postTime: { color: MUTED, fontSize: 11 },
  featuredText: { color: TEXT, fontSize: 15, lineHeight: 22, marginTop: 9, fontWeight: '700' },
  engagementRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 11 },
  engagementText: { color: MUTED, fontSize: 12, marginRight: 9 },
  groupFallback: { backgroundColor: '#26352B', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  groupFallbackText: { color: GOLD, fontSize: 16, fontWeight: '900' },
  communitiesPage: { paddingTop: 4 },
  communitySearch: { minHeight: 46, borderRadius: 15, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD_SOFT, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginTop: 4, marginBottom: 6 },
  communitySearchInput: { flex: 1, color: TEXT, fontSize: 14, paddingVertical: 10 },
  communitySection: { marginTop: 20 },
  officialCommunityRail: { gap: 12, paddingRight: 6 },
  officialCommunityCard: { width: 214, height: 154, borderRadius: 20, overflow: 'hidden', backgroundColor: CARD, borderWidth: 1, borderColor: '#405046' },
  officialCommunityImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  officialCommunityFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#26352B' },
  officialCommunityInitials: { color: GOLD, fontSize: 30, fontWeight: '900' },
  officialCommunityShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,7,0.38)' },
  officialCommunityBadge: { position: 'absolute', left: 10, top: 10, borderRadius: 999, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4 },
  officialCommunityBadgeText: { color: '#101510', fontSize: 9, fontWeight: '900' },
  officialJoinedBadge: { position: 'absolute', right: 10, top: 10, borderRadius: 999, backgroundColor: 'rgba(17,28,22,0.86)', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4 },
  officialJoinedBadgeText: { color: TEXT, fontSize: 9, fontWeight: '900' },
  officialCommunityCopy: { position: 'absolute', left: 12, right: 12, bottom: 11 },
  officialCommunityTitle: { color: '#FFFDF6', fontSize: 18, lineHeight: 22, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  officialCommunityFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  officialCommunityMeta: { color: '#EEF2EF', fontSize: 11, fontWeight: '700' },
  officialCommunityJoin: { marginLeft: 'auto', color: '#FFE49A', fontSize: 11, fontWeight: '900' },
  joinedCommunityList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  joinedCommunityRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  joinedCommunityName: { color: TEXT, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  joinedCommunityActivity: { color: MUTED, fontSize: 11.5, marginTop: 4, fontWeight: '600' },
  joinedCommunityActivityLive: { color: GREEN, fontWeight: '800' },
  activityDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN },
  discoverCommunityRail: { gap: 12, paddingRight: 6 },
  discoverCommunityCard: { width: 176, height: 132, borderRadius: 18, overflow: 'hidden', backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  discoverCommunityImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  discoverCommunityFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#26352B' },
  discoverCommunityInitials: { color: GOLD, fontSize: 26, fontWeight: '900' },
  discoverCommunityShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.34)' },
  discoverCommunityCopy: { position: 'absolute', left: 11, right: 11, bottom: 10 },
  discoverCommunityTitle: { color: '#FFFDF6', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  discoverCommunityMeta: { color: '#E1E8E3', fontSize: 10.5, marginTop: 4, fontWeight: '700' },
  discoverJoinPill: { position: 'absolute', right: 9, top: 9, borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 9, paddingVertical: 5 },
  discoverJoinText: { color: '#101510', fontSize: 9.5, fontWeight: '900' },
  discoveryCard: { marginTop: 6, padding: 20, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 20 },
  discoveryIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#253124', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  discoveryEyebrow: { color: GREEN, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  discoveryTitle: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 6 },
  discoveryCopy: { color: MUTED, fontSize: 14, lineHeight: 21, marginTop: 8 },
  primaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  primaryButtonText: { color: '#101510', fontSize: 14, fontWeight: '900' },
  inlineError: { color: '#F4B5AA', fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  emptyText: { color: MUTED, fontSize: 13, lineHeight: 18, paddingVertical: 12 },
  pressed: { opacity: 0.72 },
});