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

type CommunityDigest = {
  group: CommunityGroup;
  posts: CommunityPost[];
  recentPosts: CommunityPost[];
  photos: number;
  questions: number;
  outingCount: number;
  highlight: CommunityPost | null;
  score: number;
};

type LoadErrors = {
  feed?: string;
  groups?: string;
  events?: string;
  notifications?: string;
  profile?: string;
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
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'MA';
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

function locationLabel(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(', ');
}

function communityCover(group: CommunityGroup) {
  return group.cover_image_url || group.image_url;
}

function isOfficialCommunity(group: CommunityGroup) {
  return group.kind === 'interest';
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
  if (digest.photos) parts.push(`${digest.photos} photo${digest.photos === 1 ? '' : 's'}`);
  if (digest.outingCount) parts.push(`${digest.outingCount} upcoming outing${digest.outingCount === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'No recent activity';
}

function SectionHeader({ title, detail, action, onAction }: { title: string; detail?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable accessibilityRole="button" style={styles.sectionAction} onPress={onAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={GOLD} />
        </Pressable>
      ) : null}
    </View>
  );
}

function GroupImage({ group, size = 62 }: { group: CommunityGroup; size?: number }) {
  const cover = communityCover(group);
  return cover ? (
    <Image source={{ uri: cover }} style={{ width: size, height: size, borderRadius: 14, backgroundColor: CARD }} />
  ) : (
    <View style={[styles.groupFallback, { width: size, height: size, borderRadius: 14 }]}>
      <Text style={styles.groupFallbackText}>{initials(group.name)}</Text>
    </View>
  );
}

function NotificationRow({ item, onOpen }: { item: MemberNotification; onOpen: (item: MemberNotification) => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.noticeRow, pressed && styles.pressed]} onPress={() => onOpen(item)}>
      <View style={[styles.noticeIcon, item.priority === 'critical' && styles.noticeIconCritical]}>
        <Ionicons name={notificationIcon(item) as any} size={20} color={item.priority === 'critical' ? '#FFD6CF' : GOLD} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.noticeTitle} numberOfLines={2}>{item.title}</Text>
        {item.body ? <Text style={styles.noticeBody} numberOfLines={2}>{item.body}</Text> : null}
        <Text style={styles.noticeMeta}>{relativeTime(item.created_at)}{item.read_at ? '' : ' · New'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={MUTED} />
    </Pressable>
  );
}

function DigestRow({ digest }: { digest: CommunityDigest }) {
  const { group, highlight } = digest;
  return (
    <Pressable
      style={({ pressed }) => [styles.digestRow, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}. ${digestSummary(digest)}`}
    >
      <GroupImage group={group} size={70} />
      <View style={styles.digestContent}>
        <View style={styles.digestNameLine}>
          <Text style={styles.digestName} numberOfLines={1}>{group.name}</Text>
          {isOfficialCommunity(group) ? <Ionicons name="checkmark-circle" size={14} color={GOLD} /> : null}
        </View>
        <Text style={styles.digestMeta} numberOfLines={2}>{digestSummary(digest)}</Text>
        {highlight?.body ? <Text style={styles.digestHighlight} numberOfLines={1}>{highlight.body}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={GOLD} />
    </Pressable>
  );
}

function EventCard({ event, compact = false, onRsvp }: { event: LocalEvent; compact?: boolean; onRsvp?: (event: LocalEvent) => void }) {
  return (
    <Pressable
      style={({ pressed }) => [compact ? styles.eventCardCompact : styles.eventCard, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}
    >
      {event.image_url ? (
        <Image source={{ uri: event.image_url }} style={compact ? styles.eventImageCompact : styles.eventImage} />
      ) : (
        <View style={[compact ? styles.eventImageCompact : styles.eventImage, styles.eventImageFallback]}>
          <Ionicons name="calendar-outline" size={26} color={GOLD} />
        </View>
      )}
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.eventMeta}>{eventTime(event)}</Text>
        <View style={styles.inlineMeta}>
          <Ionicons name="location-outline" size={14} color={MUTED} />
          <Text style={styles.eventMeta} numberOfLines={1}>{locationLabel(event.city, event.state)}</Text>
        </View>
        <View style={styles.eventFooter}>
          {event.my_rsvp && event.my_rsvp !== 'cancelled' ? (
            <Text style={styles.rsvpStatus}>{event.my_rsvp === 'going' ? 'You’re going' : 'Interested'}</Text>
          ) : onRsvp ? (
            <Pressable
              style={styles.rsvpButton}
              onPress={(pressEvent) => {
                pressEvent.stopPropagation();
                onRsvp(event);
              }}
            >
              <Text style={styles.rsvpButtonText}>Interested</Text>
            </Pressable>
          ) : null}
          {event.rsvp_count > 0 ? <Text style={styles.attendeeText}>{event.rsvp_count} going</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function CommunityRow({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.communityRow, pressed && styles.pressed]}
      onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}
    >
      <GroupImage group={group} size={58} />
      <View style={styles.flex}>
        <View style={styles.digestNameLine}>
          <Text style={styles.communityName} numberOfLines={1}>{group.name}</Text>
          {isOfficialCommunity(group) ? <Ionicons name="checkmark-circle" size={14} color={GOLD} /> : null}
        </View>
        {group.description ? <Text style={styles.communityDescription} numberOfLines={2}>{group.description}</Text> : null}
        <Text style={styles.communityMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}{group.city || group.state ? ` · ${locationLabel(group.city, group.state)}` : ''}</Text>
      </View>
      {group.is_member ? (
        <Ionicons name="chevron-forward" size={18} color={MUTED} />
      ) : (
        <Pressable
          disabled={joining}
          style={[styles.joinButton, joining && styles.buttonDisabled]}
          onPress={(event) => {
            event.stopPropagation();
            onJoin(group);
          }}
        >
          <Text style={styles.joinButtonText}>{joining ? 'Joining…' : 'Join'}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export function OutpostDigestScreen() {
  const [activeTab, setActiveTab] = useState<OutpostTab>('campfires');
  const [digestFilter, setDigestFilter] = useState<DigestFilter>('for-you');
  const [feed, setFeed] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [errors, setErrors] = useState<LoadErrors>({});

  const loadAll = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    const [feedResult, groupsResult, eventsResult, notificationsResult, profileResult] = await Promise.allSettled([
      getCommunityFeed(),
      getGroups(),
      listLocalEvents(),
      listNotifications(),
      getMemberBasecamp(),
    ]);

    const nextErrors: LoadErrors = {};

    if (feedResult.status === 'fulfilled') setFeed(feedResult.value);
    else nextErrors.feed = 'Community activity is temporarily unavailable.';

    if (groupsResult.status === 'fulfilled') setGroups(groupsResult.value);
    else nextErrors.groups = 'Communities are temporarily unavailable.';

    if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
    else nextErrors.events = 'Upcoming outings are temporarily unavailable.';

    if (notificationsResult.status === 'fulfilled') setNotifications(notificationsResult.value);
    else nextErrors.notifications = 'Important updates are temporarily unavailable.';

    if (profileResult.status === 'fulfilled') {
      setHomeCity((profileResult.value.profile?.home_city as string | null | undefined) ?? null);
      setHomeState((profileResult.value.profile?.home_state as string | null | undefined) ?? null);
    } else {
      nextErrors.profile = 'Your area could not be loaded.';
    }

    setErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void loadAll(false);
  }, [loadAll]));

  const joinedGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const officialGroups = useMemo(() => groups.filter(isOfficialCommunity), [groups]);

  const homePoint = useMemo(() => homeCity && homeState ? pointForCity(homeCity, homeState) : null, [homeCity, homeState]);
  const isNearbyGroup = useCallback((group: CommunityGroup) => {
    if (!homePoint || !group.city || !group.state) return false;
    const groupPoint = pointForCity(group.city, group.state);
    return groupPoint ? distanceMiles(homePoint, groupPoint) <= NEAR_RADIUS_MILES : false;
  }, [homePoint]);
  const isNearbyEvent = useCallback((event: LocalEvent) => {
    if (!homePoint) return false;
    const eventPoint = pointForCity(event.city, event.state);
    return eventPoint ? distanceMiles(homePoint, eventPoint) <= NEAR_RADIUS_MILES : false;
  }, [homePoint]);

  const digests = useMemo(() => {
    const byGroup = new Map<string, CommunityPost[]>();
    for (const post of feed) {
      if (!post.group_id) continue;
      const current = byGroup.get(post.group_id) ?? [];
      current.push(post);
      byGroup.set(post.group_id, current);
    }

    const recentCutoff = Date.now() - RECENT_WINDOW_MS;
    return joinedGroups.map((group): CommunityDigest => {
      const posts = (byGroup.get(group.id) ?? []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const recentPosts = posts.filter((post) => new Date(post.created_at).getTime() >= recentCutoff);
      const photos = recentPosts.filter((post) => Boolean(post.image_url || post.media_url)).length;
      const questions = recentPosts.filter((post) => post.post_type === 'ask').length;
      const outingCount = events.filter((event) => event.group_id === group.id).length;
      const highlight = recentPosts.slice().sort((a, b) => (b.comment_count + b.reaction_count) - (a.comment_count + a.reaction_count))[0] ?? posts[0] ?? null;
      const latestTime = posts[0] ? new Date(posts[0].created_at).getTime() : 0;
      const recencyBoost = latestTime ? Math.max(0, 7 - ((Date.now() - latestTime) / (24 * 60 * 60 * 1000))) : 0;
      const score = recentPosts.length * 2 + photos + questions * 2 + outingCount * 3 + recencyBoost;
      return { group, posts, recentPosts, photos, questions, outingCount, highlight, score };
    });
  }, [events, feed, joinedGroups]);

  const visibleDigests = useMemo(() => {
    if (digestFilter === 'nearby') return digests.filter((digest) => isNearbyGroup(digest.group)).sort((a, b) => b.score - a.score);
    if (digestFilter === 'my-camps') return digests.slice().sort((a, b) => a.group.name.localeCompare(b.group.name));
    return digests.slice().sort((a, b) => b.score - a.score).slice(0, 5);
  }, [digestFilter, digests, isNearbyGroup]);

  const important = useMemo(() => notifications.filter((item) => !item.read_at && isPriorityNotification(item)).slice(0, 3), [notifications]);

  const comingUp = useMemo(() => {
    const sorted = events.slice().sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    if (digestFilter === 'nearby') return sorted.filter(isNearbyEvent).slice(0, 2);
    const joinedIds = new Set(joinedGroups.map((group) => group.id));
    const relevant = sorted.filter((event) => event.my_rsvp === 'going' || event.my_rsvp === 'interested' || (event.group_id && joinedIds.has(event.group_id)));
    return (relevant.length ? relevant : sorted).slice(0, 2);
  }, [digestFilter, events, isNearbyEvent, joinedGroups]);

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

  const handleNotification = useCallback(async (notification: MemberNotification) => {
    if (!notification.read_at) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
      } catch {
        // Navigation should still work if read-state persistence fails.
      }
    }
    if (notification.action_url?.startsWith('/')) router.push(notification.action_url as never);
    else router.push('/notifications' as never);
  }, []);

  const handleRsvp = useCallback(async (event: LocalEvent) => {
    try {
      await setLocalEventRsvp(event.id, 'interested');
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, my_rsvp: 'interested' } : item));
    } catch {
      // Leave the card unchanged; the event detail screen remains available.
    }
  }, []);

  const renderCampfires = () => {
    if (loading && !groups.length && !feed.length && !events.length) {
      return <View style={styles.loadingWrap}><ActivityIndicator color={GOLD} /><Text style={styles.loadingText}>Catching up your Outpost…</Text></View>;
    }

    const hasNoCamps = joinedGroups.length === 0;

    return (
      <>
        <View style={styles.filterRow}>
          {digestFilters.map((filter) => {
            const selected = digestFilter === filter.value;
            return (
              <Pressable key={filter.value} style={[styles.filterButton, selected && styles.filterButtonSelected]} onPress={() => setDigestFilter(filter.value)}>
                <Ionicons name={filter.icon as any} size={17} color={selected ? GOLD : MUTED} />
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {hasNoCamps ? (
          <View style={styles.discoveryCard}>
            <View style={styles.discoveryIcon}><Ionicons name="people-outline" size={28} color={GOLD} /></View>
            <Text style={styles.discoveryEyebrow}>YOUR OUTPOST STARTS HERE</Text>
            <Text style={styles.discoveryTitle}>Find your people outdoors.</Text>
            <Text style={styles.discoveryCopy}>Join a community and this page becomes your catch-up across conversations, photos, and outings.</Text>
            <Pressable style={styles.primaryButton} onPress={() => setActiveTab('communities')}>
              <Text style={styles.primaryButtonText}>Explore communities</Text>
              <Ionicons name="arrow-forward" size={17} color="#101510" />
            </Pressable>
          </View>
        ) : null}

        {!hasNoCamps && digestFilter === 'for-you' ? (
          <View style={styles.section}>
            <SectionHeader title="Important" detail="Only the things that need your attention." action={important.length ? 'View all' : undefined} onAction={() => router.push('/notifications' as never)} />
            {errors.notifications ? <Text style={styles.inlineError}>{errors.notifications}</Text> : important.length ? (
              <View style={styles.noticeList}>{important.map((item) => <NotificationRow key={item.id} item={item} onOpen={handleNotification} />)}</View>
            ) : (
              <View style={styles.quietState}>
                <Ionicons name="checkmark-circle-outline" size={20} color={GREEN} />
                <Text style={styles.quietStateText}>Nothing urgent right now.</Text>
              </View>
            )}
          </View>
        ) : null}

        {!hasNoCamps ? (
          <View style={styles.section}>
            <SectionHeader
              title={digestFilter === 'my-camps' ? 'My camps' : digestFilter === 'nearby' ? 'Nearby camps' : 'Around your camps'}
              detail={digestFilter === 'my-camps' ? 'Every community you’ve joined.' : digestFilter === 'nearby' ? `Within about ${NEAR_RADIUS_MILES} miles of your area.` : 'A quick catch-up, without the fire hose.'}
              action={digestFilter === 'for-you' && digests.length > visibleDigests.length ? 'View all' : undefined}
              onAction={() => setDigestFilter('my-camps')}
            />
            {errors.feed || errors.groups ? <Text style={styles.inlineError}>{errors.feed ?? errors.groups}</Text> : visibleDigests.length ? (
              <View style={styles.digestList}>{visibleDigests.map((digest) => <DigestRow key={digest.group.id} digest={digest} />)}</View>
            ) : (
              <View style={styles.quietState}><Ionicons name="compass-outline" size={20} color={GREEN} /><Text style={styles.quietStateText}>No camp activity to show here yet.</Text></View>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Coming up" detail={digestFilter === 'nearby' ? 'Outings close to your area.' : 'The next outings worth keeping on your radar.'} action="See all" onAction={() => setActiveTab('outings')} />
          {errors.events ? <Text style={styles.inlineError}>{errors.events}</Text> : comingUp.length ? (
            <View style={styles.eventGrid}>{comingUp.map((event) => <EventCard key={event.id} event={event} compact onRsvp={handleRsvp} />)}</View>
          ) : (
            <View style={styles.quietState}><Ionicons name="calendar-outline" size={20} color={GREEN} /><Text style={styles.quietStateText}>No upcoming outings found.</Text></View>
          )}
        </View>
      </>
    );
  };

  const renderCommunities = () => {
    const joinedIds = new Set(joinedGroups.map((group) => group.id));
    const suggested = officialGroups.filter((group) => !joinedIds.has(group.id));
    const memberCreated = groups.filter((group) => group.kind !== 'interest');
    return (
      <>
        <View style={styles.section}>
          <SectionHeader title="Official communities" detail="Go Melanated spaces built around how you get outside." />
          {errors.groups ? <Text style={styles.inlineError}>{errors.groups}</Text> : officialGroups.length ? officialGroups.map((group) => <CommunityRow key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />) : <Text style={styles.emptyText}>No official communities available.</Text>}
        </View>
        {joinedGroups.length ? (
          <View style={styles.section}>
            <SectionHeader title="Your communities" detail={`${joinedGroups.length} joined`} />
            {joinedGroups.filter((group) => !isOfficialCommunity(group)).map((group) => <CommunityRow key={group.id} group={group} joining={false} onJoin={handleJoin} />)}
            {!joinedGroups.some((group) => !isOfficialCommunity(group)) ? <Text style={styles.emptyText}>Your official communities are shown above.</Text> : null}
          </View>
        ) : null}
        {memberCreated.length ? (
          <View style={styles.section}>
            <SectionHeader title="Community-made" detail="Member-created spaces for more specific interests and local connections." />
            {memberCreated.slice(0, 8).map((group) => <CommunityRow key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}
          </View>
        ) : suggested.length ? null : null}
      </>
    );
  };

  const renderOutings = () => (
    <View style={styles.section}>
      <SectionHeader title="Outings" detail="Plans turn into people, places, and real days outside." />
      {errors.events ? <Text style={styles.inlineError}>{errors.events}</Text> : events.length ? events.map((event) => <EventCard key={event.id} event={event} onRsvp={handleRsvp} />) : <View style={styles.quietState}><Ionicons name="calendar-outline" size={20} color={GREEN} /><Text style={styles.quietStateText}>No upcoming outings found.</Text></View>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll(true)} tintColor={GOLD} colors={[GOLD]} />}
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.title}>Outpost</Text>
            <View style={styles.locationLine}>
              <Ionicons name="location-outline" size={16} color={GREEN} />
              <Text style={styles.locationText}>{homeCity ? locationLabel(homeCity, homeState) : 'Your area'}</Text>
            </View>
          </View>
          <Pressable style={styles.headerAction} onPress={() => router.push('/notifications' as never)} accessibilityRole="button" accessibilityLabel="Open notifications">
            <Ionicons name="notifications-outline" size={21} color={TEXT} />
            {notifications.some((item) => !item.read_at) ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.value;
            return (
              <Pressable key={tab.value} style={[styles.tab, selected && styles.tabSelected]} onPress={() => setActiveTab(tab.value)}>
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'campfires' ? renderCampfires() : activeTab === 'communities' ? renderCommunities() : renderOutings()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 44, gap: 8 },
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
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, marginBottom: 5 },
  filterButton: { flex: 1, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  filterButtonSelected: { borderColor: GOLD, backgroundColor: '#1B251C' },
  filterText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  filterTextSelected: { color: TEXT },
  section: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 10 },
  sectionTitle: { color: TEXT, fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.4 },
  sectionDetail: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 2 },
  sectionAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 8 },
  sectionActionText: { color: GOLD, fontSize: 13, fontWeight: '800' },
  loadingWrap: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: MUTED, fontSize: 14 },
  noticeList: { backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 18, overflow: 'hidden' },
  noticeRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  noticeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#253124', alignItems: 'center', justifyContent: 'center' },
  noticeIconCritical: { backgroundColor: '#54231F' },
  noticeTitle: { color: TEXT, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  noticeBody: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 1 },
  noticeMeta: { color: GREEN, fontSize: 11, marginTop: 4, fontWeight: '700' },
  quietState: { minHeight: 58, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 3 },
  quietStateText: { color: MUTED, fontSize: 14 },
  digestList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  digestRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  digestContent: { flex: 1, minWidth: 0 },
  digestNameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  digestName: { color: TEXT, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  digestMeta: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3 },
  digestHighlight: { color: GREEN, fontSize: 13, lineHeight: 18, marginTop: 4, fontWeight: '700' },
  groupFallback: { backgroundColor: '#26352B', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  groupFallbackText: { color: GOLD, fontSize: 16, fontWeight: '900' },
  eventGrid: { flexDirection: 'row', gap: 10 },
  eventCardCompact: { flex: 1, minWidth: 0, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 16, overflow: 'hidden' },
  eventCard: { flexDirection: 'row', minHeight: 126, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 18, overflow: 'hidden', marginBottom: 10 },
  eventImageCompact: { width: '100%', height: 104, backgroundColor: CARD },
  eventImage: { width: 116, minHeight: 126, backgroundColor: CARD },
  eventImageFallback: { alignItems: 'center', justifyContent: 'center' },
  eventContent: { flex: 1, padding: 12 },
  eventTitle: { color: TEXT, fontSize: 15, lineHeight: 19, fontWeight: '800' },
  eventMeta: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3, flexShrink: 1 },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  rsvpStatus: { color: GREEN, fontSize: 12, fontWeight: '800' },
  rsvpButton: { borderWidth: 1, borderColor: GOLD, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  rsvpButtonText: { color: GOLD, fontSize: 11, fontWeight: '800' },
  attendeeText: { color: MUTED, fontSize: 11 },
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
