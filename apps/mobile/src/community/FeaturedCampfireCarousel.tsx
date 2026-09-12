import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { LocalEvent } from '../local-events/api';
import { supabase } from '../lib/supabase';
import { setReaction, type CommunityGroup, type CommunityPost } from './api';
import {
  campfirePostHasFreshActivity,
  dismissCampfireItem,
  isCampfireItemDismissed,
  loadCampfireDeckState,
  markCampfirePostSeen,
  restoreCampfireItem,
  saveCampfireDeckState,
  shouldResumeCampfirePosition,
  updateCampfirePosition,
  type CampfireDeckState,
} from './campfireDeckState';
import { featuredPostKind, type FeaturedPostKind } from './featuredPosts';

const GOLD = '#D7B45A';
const GOLD_DARK = '#2D2716';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const PANEL = '#16201B';
const PANEL_2 = '#1A261F';
const IMAGE_CARD_HEIGHT = 340;
const PHOTO_STAGE_HEIGHT = 214;
const TEXT_CARD_HEIGHT = 226;
const CARD_GAP = 12;
const UNDO_WINDOW_MS = 5000;
const VERTICAL_CAPTURE_DISTANCE = 54;
const VERTICAL_ACTION_DISTANCE = 82;
const VERTICAL_DOMINANCE_RATIO = 1.7;

type ReactionValue = 'like' | 'love' | 'celebrate' | 'support';
type CarouselItem =
  | { key: string; kind: 'post'; post: CommunityPost }
  | { key: string; kind: 'outing'; event: LocalEvent };

type UndoItem = {
  key: string;
  index: number;
  label: string;
};

type PostCardProps = {
  post: CommunityPost;
  group?: CommunityGroup;
  event?: LocalEvent | null;
  width: number;
  myReaction?: ReactionValue | null;
  reactionCount?: number;
  reacting?: boolean;
  onToggleReaction?: (post: CommunityPost) => void;
  onDismiss: () => void;
};

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

function eventDate(event: LocalEvent) {
  return new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function eventDay(event: LocalEvent) {
  return new Date(event.starts_at).toLocaleDateString(undefined, { day: '2-digit' });
}

function eventMonth(event: LocalEvent) {
  return new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
}

function eventTime(event: LocalEvent) {
  return new Date(event.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function stopAndRun(event: any, action: () => void) {
  event.stopPropagation?.();
  action();
}

function linkedEventId(post: CommunityPost) {
  const metadata = post.metadata ?? {};
  const value = [metadata['local_event_id'], metadata['event_id'], metadata['outing_id']]
    .find((item) => typeof item === 'string');
  return typeof value === 'string' ? value : null;
}

function buildCarouselItems(posts: CommunityPost[], outings: LocalEvent[]) {
  const items: CarouselItem[] = [];
  const eventQueue = outings.slice(0, 5);
  let eventIndex = 0;

  posts.forEach((post, index) => {
    items.push({ key: `post:${post.id}`, kind: 'post', post });
    if ((index + 1) % 2 === 0 && eventIndex < eventQueue.length) {
      const event = eventQueue[eventIndex];
      if (event) items.push({ key: `outing:${event.id}`, kind: 'outing', event });
      eventIndex += 1;
    }
  });

  while (eventIndex < eventQueue.length) {
    const event = eventQueue[eventIndex];
    if (event) items.push({ key: `outing:${event.id}`, kind: 'outing', event });
    eventIndex += 1;
  }

  return items;
}

function itemResumeKey(item?: CarouselItem) {
  if (!item) return null;
  return item.kind === 'post' ? item.post.id : item.key;
}

function itemLabel(item: CarouselItem) {
  return item.kind === 'outing' ? item.event.title : item.post.body || 'Post';
}

function typePresentation(kind: FeaturedPostKind) {
  if (kind === 'outing') return { label: 'OUTING POST', icon: 'calendar-outline' as const, outing: true };
  if (kind === 'video') return { label: 'VIDEO', icon: 'videocam-outline' as const, outing: false };
  if (kind === 'media') return { label: 'PHOTO', icon: 'image-outline' as const, outing: false };
  if (kind === 'community') return { label: 'COMMUNITY', icon: 'people-outline' as const, outing: false };
  return { label: 'POST', icon: 'chatbubble-ellipses-outline' as const, outing: false };
}

function PostTypeHeader({
  kind,
  groupName,
  onDismiss,
}: {
  kind: FeaturedPostKind;
  groupName?: string | null;
  onDismiss: () => void;
}) {
  const presentation = typePresentation(kind);
  return (
    <View style={styles.postTypeHeader}>
      <View style={styles.typeStack}>
        <View style={[styles.typeBadge, presentation.outing && styles.typeBadgeOuting]}>
          <Ionicons name={presentation.icon} size={12} color={presentation.outing ? GOLD_DARK : GOLD} />
          <Text style={[styles.typeBadgeText, presentation.outing && styles.typeBadgeTextOuting]}>{presentation.label}</Text>
        </View>
        {groupName ? <Text style={styles.groupContext} numberOfLines={1}>{groupName}</Text> : null}
      </View>
      <Pressable
        accessibilityLabel="Hide from featured carousel"
        hitSlop={8}
        style={styles.hideButton}
        onPress={(event) => stopAndRun(event, onDismiss)}
      >
        <Ionicons name="close" size={17} color="#F3EBD7" />
      </Pressable>
    </View>
  );
}

function PostAuthor({ post, onPress }: { post: CommunityPost; onPress: () => void }) {
  return (
    <Pressable style={styles.authorRow} onPress={(event) => stopAndRun(event, onPress)}>
      <View style={styles.avatar}>
        {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}
      </View>
      <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
      <Text style={styles.time}>{relativeTime(post.created_at)}</Text>
    </Pressable>
  );
}

function EngagementRow({
  post,
  myReaction,
  reactionCount,
  reacting,
  onToggleReaction,
}: {
  post: CommunityPost;
  myReaction: ReactionValue | null;
  reactionCount: number;
  reacting: boolean;
  onToggleReaction?: (post: CommunityPost) => void;
}) {
  const openPost = () => router.push(`/community/${post.id}`);
  return (
    <View style={styles.engagementRow}>
      <Pressable
        style={styles.engagementAction}
        disabled={reacting}
        onPress={(event) => stopAndRun(event, () => onToggleReaction?.(post))}
      >
        <Ionicons name={myReaction ? 'heart' : 'heart-outline'} size={18} color={myReaction ? GOLD : '#E2E7E3'} />
        <Text style={[styles.engagementCount, myReaction && styles.engagementCountActive]}>{reactionCount}</Text>
      </Pressable>
      <Pressable style={styles.engagementAction} onPress={(event) => stopAndRun(event, openPost)}>
        <Ionicons name="chatbubble-outline" size={17} color="#E2E7E3" />
        <Text style={styles.engagementCount}>{post.comment_count || 0}</Text>
      </Pressable>
    </View>
  );
}

function FeaturedPostCard({
  post,
  group,
  event,
  width,
  myReaction = null,
  reactionCount = post.reaction_count || 0,
  reacting = false,
  onToggleReaction,
  onDismiss,
}: PostCardProps) {
  const kind = featuredPostKind(post, group, event);
  const directImage = post.image_url || (post.media_type === 'image' ? post.media_url : null);
  const visual = directImage || event?.image_url || null;
  const openPost = () => router.push(`/community/${post.id}`);
  const openProfile = () => router.push({ pathname: '/community-profile/[id]', params: { id: post.author_id } });
  const openEvent = () => event && router.push({ pathname: '/local-events/[id]', params: { id: event.id } });

  if (!visual) {
    return (
      <Pressable style={[styles.textCard, { width }]} onPress={openPost}>
        <View style={styles.topoRingOne} />
        <View style={styles.topoRingTwo} />
        <PostTypeHeader kind={kind} groupName={group?.name} onDismiss={onDismiss} />
        <View style={styles.textCardBody}>
          <PostAuthor post={post} onPress={openProfile} />
          <Text style={styles.textOnlyBody} numberOfLines={5}>{post.body || 'Shared a new update.'}</Text>
          {event ? (
            <Pressable style={styles.eventStrip} onPress={(tap) => stopAndRun(tap, openEvent)}>
              <Ionicons name="calendar-outline" size={14} color={GOLD} />
              <Text style={styles.eventText} numberOfLines={1}>{event.title} · {eventDate(event)}</Text>
              <Ionicons name="chevron-forward" size={14} color={GOLD} />
            </Pressable>
          ) : null}
          <EngagementRow post={post} myReaction={myReaction} reactionCount={reactionCount} reacting={reacting} onToggleReaction={onToggleReaction} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.imageCard, kind === 'outing' && styles.outingPostCard, { width }]} onPress={openPost}>
      <View style={styles.photoStage}>
        <ImageBackground source={{ uri: visual }} style={styles.photoBackground} imageStyle={styles.photoImage}>
          <View style={styles.photoShade} />
          <PostTypeHeader kind={kind} groupName={group?.name} onDismiss={onDismiss} />
          {kind === 'video' ? (
            <View style={styles.videoCenterBadge} pointerEvents="none">
              <Ionicons name="play" size={24} color={TEXT} />
            </View>
          ) : null}
        </ImageBackground>
      </View>
      <View style={styles.photoCopyArea}>
        <PostAuthor post={post} onPress={openProfile} />
        <Text style={styles.imageBody} numberOfLines={event ? 1 : 2}>{post.body || 'Shared a moment from outside.'}</Text>
        {event ? (
          <Pressable style={styles.eventStripStrong} onPress={(tap) => stopAndRun(tap, openEvent)}>
            <Ionicons name="calendar" size={15} color={GOLD_DARK} />
            <View style={styles.eventStripCopy}>
              <Text style={styles.eventStripEyebrow}>LINKED OUTING</Text>
              <Text style={styles.eventStripTitle} numberOfLines={1}>{event.title} · {eventDate(event)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={GOLD_DARK} />
          </Pressable>
        ) : null}
        <EngagementRow post={post} myReaction={myReaction} reactionCount={reactionCount} reacting={reacting} onToggleReaction={onToggleReaction} />
      </View>
    </Pressable>
  );
}

function OutingCard({ event, width, onDismiss }: { event: LocalEvent; width: number; onDismiss: () => void }) {
  const openEvent = () => router.push({ pathname: '/local-events/[id]', params: { id: event.id } });
  const location = [event.venue_name || event.city, event.state].filter(Boolean).join(', ');
  const rsvpLabel = event.my_rsvp === 'going' ? 'YOU’RE GOING' : event.my_rsvp === 'interested' ? 'INTERESTED' : 'UPCOMING';

  const content = (
    <>
      <View style={styles.outingBanner}>
        <View style={styles.outingBannerLabel}>
          <Ionicons name="calendar" size={14} color={GOLD_DARK} />
          <Text style={styles.outingBannerText}>OUTING</Text>
          <View style={styles.outingStatusDot} />
          <Text style={styles.outingStatusText}>{rsvpLabel}</Text>
        </View>
        <Pressable
          accessibilityLabel="Hide outing from featured carousel"
          hitSlop={8}
          style={styles.outingHideButton}
          onPress={(tap) => stopAndRun(tap, onDismiss)}
        >
          <Ionicons name="close" size={17} color={GOLD_DARK} />
        </Pressable>
      </View>
      <View style={styles.outingCopy}>
        <View style={styles.outingHeadlineRow}>
          <View style={styles.outingDateBlock}>
            <Text style={styles.outingMonth}>{eventMonth(event)}</Text>
            <Text style={styles.outingDay}>{eventDay(event)}</Text>
          </View>
          <View style={styles.outingTitleWrap}>
            <Text style={styles.outingTitle} numberOfLines={2}>{event.title}</Text>
            <Text style={styles.outingMeta} numberOfLines={1}>{eventTime(event)} · {location}</Text>
          </View>
        </View>
        <View style={styles.outingFooter}>
          <Text style={styles.outingAttendance}>{event.rsvp_count > 0 ? `${event.rsvp_count} attending` : 'Be one of the first'}</Text>
          <View style={styles.viewOuting}><Text style={styles.viewOutingText}>View outing</Text><Ionicons name="chevron-forward" size={14} color={GOLD} /></View>
        </View>
      </View>
    </>
  );

  if (event.image_url) {
    return (
      <Pressable style={[styles.outingCard, { width }]} onPress={openEvent}>
        <ImageBackground source={{ uri: event.image_url }} style={styles.background} imageStyle={styles.backgroundImage}>
          <View style={styles.outingShade} />
          {content}
        </ImageBackground>
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.outingCard, styles.outingFallback, { width }]} onPress={openEvent}>
      <View style={styles.outingFallbackIcon}><Ionicons name="compass-outline" size={58} color="rgba(215,180,90,0.16)" /></View>
      {content}
    </Pressable>
  );
}

export function FeaturedCampfireCarousel({
  posts,
  groups,
  events,
  viewportWidth,
  activeIndex,
  onIndexChange,
  onExploreCommunities,
}: {
  posts: CommunityPost[];
  groups: Map<string, CommunityGroup>;
  events: Map<string, LocalEvent>;
  fallbackSource?: unknown;
  viewportWidth: number;
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onExploreCommunities: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, activeIndex));
  const [displayIndex, setDisplayIndex] = useState(() => Math.max(0, activeIndex));
  const [deckReady, setDeckReady] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [deckState, setDeckState] = useState<CampfireDeckState | null>(null);
  const [myReactions, setMyReactions] = useState<Map<string, ReactionValue>>(new Map());
  const [reactionCounts, setReactionCounts] = useState<Map<string, number>>(new Map());
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [nowMs] = useState(() => Date.now());
  const latestScrollOffsetRef = useRef(0);
  const verticalSwipeY = useRef(new Animated.Value(0)).current;

  const cardWidth = Math.min(350, Math.max(248, viewportWidth * 0.84));
  const snapInterval = cardWidth + CARD_GAP;
  const sideInset = Math.max(14, (viewportWidth - cardWidth) / 2);

  const eventByPost = useMemo(() => {
    const map = new Map<string, LocalEvent | null>();
    for (const post of posts) {
      const eventId = linkedEventId(post);
      map.set(post.id, eventId ? events.get(eventId) ?? null : null);
    }
    return map;
  }, [events, posts]);

  const outings = useMemo(() => Array.from(events.values())
    .filter((event) => event.status === 'published' && new Date(event.starts_at).getTime() >= nowMs)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [events, nowMs]);

  const allItems = useMemo(() => buildCarouselItems(posts, outings), [outings, posts]);
  const allSignature = useMemo(() => allItems.map((item) => item.key).join('|'), [allItems]);
  const items = useMemo(
    () => allItems.filter((item) => !isCampfireItemDismissed(deckState, item.key)),
    [allItems, deckState],
  );
  const signature = useMemo(() => items.map((item) => item.key).join('|'), [items]);
  const safeIndex = items.length ? Math.min(currentIndex, items.length - 1) : 0;
  const safeDisplayIndex = items.length ? Math.min(displayIndex, items.length - 1) : 0;
  const latestDismissed = useMemo(() => {
    if (!deckState) return null;
    let latest: { item: CarouselItem; allIndex: number; dismissedAt: number } | null = null;
    allItems.forEach((item, allIndex) => {
      const dismissedAt = deckState.dismissed[item.key] ?? 0;
      if (!dismissedAt) return;
      if (!latest || dismissedAt > latest.dismissedAt) latest = { item, allIndex, dismissedAt };
    });
    return latest;
  }, [allItems, deckState]);

  useEffect(() => {
    let active = true;
    setDeckReady(false);

    async function hydrate() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      const stored = await loadCampfireDeckState(userId);
      if (!active) return;

      const available = allItems.filter((item) => !isCampfireItemDismissed(stored, item.key));
      setViewerId(userId);
      setDeckState(stored);

      let nextIndex = 0;
      if (available.length && shouldResumeCampfirePosition(stored) && stored.currentPostId) {
        const resumeIndex = available.findIndex((item) => itemResumeKey(item) === stored.currentPostId);
        if (resumeIndex >= 0) nextIndex = resumeIndex;
      } else if (available.length) {
        const freshIndex = available.findIndex((item) => item.kind === 'post' && campfirePostHasFreshActivity(stored, item.post));
        if (freshIndex >= 0) nextIndex = freshIndex;
      }

      setCurrentIndex(nextIndex);
      setDisplayIndex(nextIndex);
      latestScrollOffsetRef.current = nextIndex * snapInterval;
      onIndexChange(nextIndex);
      setDeckReady(true);
    }

    void hydrate();
    return () => { active = false; };
  }, [allItems, allSignature, onIndexChange, snapInterval]);

  useEffect(() => {
    if (!undoItem) return;
    const timeout = setTimeout(() => setUndoItem(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timeout);
  }, [undoItem]);

  useEffect(() => {
    setReactionCounts(new Map(posts.map((post) => [post.id, post.reaction_count || 0])));
    let active = true;

    async function loadMyReactions() {
      if (!posts.length) {
        if (active) setMyReactions(new Map());
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;
      const { data, error } = await supabase
        .from('community_reactions')
        .select('post_id,reaction')
        .eq('profile_id', userId)
        .in('post_id', posts.map((post) => post.id));
      if (!active || error) return;
      setMyReactions(new Map((data ?? []).map((row: any) => [row.post_id as string, row.reaction as ReactionValue])));
    }

    void loadMyReactions();
    return () => { active = false; };
  }, [posts]);

  const toggleReaction = useCallback(async (post: CommunityPost) => {
    if (reactingPostId) return;
    const previous = myReactions.get(post.id) ?? null;
    const next: ReactionValue | null = previous ? null : 'like';
    const previousCount = reactionCounts.get(post.id) ?? post.reaction_count ?? 0;
    setReactingPostId(post.id);
    setMyReactions((current) => {
      const copy = new Map(current);
      if (next) copy.set(post.id, next);
      else copy.delete(post.id);
      return copy;
    });
    setReactionCounts((current) => new Map(current).set(post.id, Math.max(0, previousCount + (next ? 1 : -1))));

    try {
      await setReaction(post.id, next);
    } catch {
      setMyReactions((current) => {
        const copy = new Map(current);
        if (previous) copy.set(post.id, previous);
        else copy.delete(post.id);
        return copy;
      });
      setReactionCounts((current) => new Map(current).set(post.id, previousCount));
    } finally {
      setReactingPostId(null);
    }
  }, [myReactions, reactingPostId, reactionCounts]);

  const settleIndex = useCallback((nextIndex: number) => {
    if (!deckReady || !items.length) return;
    const next = Math.max(0, Math.min(nextIndex, items.length - 1));
    const previousItem = items[currentIndex];
    const nextItem = items[next];

    setDeckState((current) => {
      if (!current) return current;
      let updated = current;
      if (next > currentIndex && previousItem?.kind === 'post') updated = markCampfirePostSeen(updated, previousItem.post);
      updated = updateCampfirePosition(updated, itemResumeKey(nextItem), false);
      void saveCampfireDeckState(viewerId, updated);
      return updated;
    });
    setCurrentIndex(next);
    setDisplayIndex(next);
    onIndexChange(next);
  }, [currentIndex, deckReady, items, onIndexChange, viewerId]);

  const dismissItem = useCallback((item: CarouselItem, index: number) => {
    const remaining = items.filter((candidate) => candidate.key !== item.key);
    const nextIndex = remaining.length ? Math.min(index, remaining.length - 1) : 0;
    const nextItem = remaining[nextIndex];

    setDeckState((current) => {
      if (!current) return current;
      let updated = current;
      if (item.kind === 'post') updated = markCampfirePostSeen(updated, item.post);
      updated = dismissCampfireItem(updated, item.key);
      updated = updateCampfirePosition(updated, itemResumeKey(nextItem), false);
      void saveCampfireDeckState(viewerId, updated);
      return updated;
    });

    setUndoItem({ key: item.key, index, label: itemLabel(item) });
    setCurrentIndex(nextIndex);
    setDisplayIndex(nextIndex);
    latestScrollOffsetRef.current = nextIndex * snapInterval;
    onIndexChange(nextIndex);
  }, [items, onIndexChange, snapInterval, viewerId]);

  const restoreDismissedItem = useCallback((itemKey: string) => {
    const restored = allItems.find((item) => item.key === itemKey);
    if (!restored) return false;
    const allIndex = allItems.findIndex((item) => item.key === itemKey);
    const targetIndex = allItems.slice(0, allIndex).filter((item) => !isCampfireItemDismissed(deckState, item.key)).length;

    setDeckState((current) => {
      if (!current) return current;
      let updated = restoreCampfireItem(current, itemKey);
      updated = updateCampfirePosition(updated, itemResumeKey(restored), false);
      void saveCampfireDeckState(viewerId, updated);
      return updated;
    });
    setCurrentIndex(targetIndex);
    setDisplayIndex(targetIndex);
    latestScrollOffsetRef.current = targetIndex * snapInterval;
    onIndexChange(targetIndex);
    if (undoItem?.key === itemKey) setUndoItem(null);
    return true;
  }, [allItems, deckState, onIndexChange, snapInterval, undoItem, viewerId]);

  const undoDismiss = useCallback(() => {
    if (!undoItem) return;
    restoreDismissedItem(undoItem.key);
  }, [restoreDismissedItem, undoItem]);

  const resetVerticalSwipe = useCallback(() => {
    Animated.spring(verticalSwipeY, {
      toValue: 0,
      tension: 150,
      friction: 16,
      useNativeDriver: true,
    }).start();
  }, [verticalSwipeY]);

  const hideCurrentWithAnimation = useCallback(() => {
    const target = items[safeDisplayIndex];
    if (!target) {
      resetVerticalSwipe();
      return;
    }

    Animated.timing(verticalSwipeY, {
      toValue: -170,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      dismissItem(target, safeDisplayIndex);
      verticalSwipeY.setValue(34);
      Animated.spring(verticalSwipeY, {
        toValue: 0,
        tension: 150,
        friction: 16,
        useNativeDriver: true,
      }).start();
    });
  }, [dismissItem, items, resetVerticalSwipe, safeDisplayIndex, verticalSwipeY]);

  const restoreLatestWithAnimation = useCallback(() => {
    if (!latestDismissed) {
      resetVerticalSwipe();
      return;
    }

    Animated.timing(verticalSwipeY, {
      toValue: 86,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      const restored = restoreDismissedItem(latestDismissed.item.key);
      if (!restored) {
        verticalSwipeY.setValue(0);
        return;
      }
      verticalSwipeY.setValue(-82);
      Animated.spring(verticalSwipeY, {
        toValue: 0,
        tension: 145,
        friction: 15,
        useNativeDriver: true,
      }).start();
    });
  }, [latestDismissed, resetVerticalSwipe, restoreDismissedItem, verticalSwipeY]);

  const verticalPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * VERTICAL_DOMINANCE_RATIO;
      if (!vertical || Math.abs(gestureState.vy) < 0.55) return false;
      if (gestureState.dy < -VERTICAL_CAPTURE_DISTANCE) return items.length > 0;
      if (gestureState.dy > VERTICAL_CAPTURE_DISTANCE) return Boolean(latestDismissed);
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gestureState) => {
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * VERTICAL_DOMINANCE_RATIO;
      if (!vertical || Math.abs(gestureState.vy) < 0.55) return false;
      if (gestureState.dy < -VERTICAL_CAPTURE_DISTANCE) return items.length > 0;
      if (gestureState.dy > VERTICAL_CAPTURE_DISTANCE) return Boolean(latestDismissed);
      return false;
    },
    onPanResponderGrant: () => {
      verticalSwipeY.stopAnimation();
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy < 0 && items.length > 0) {
        verticalSwipeY.setValue(Math.max(-155, gestureState.dy * 0.88));
        return;
      }
      if (gestureState.dy > 0 && latestDismissed) {
        verticalSwipeY.setValue(Math.min(135, gestureState.dy * 0.88));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * VERTICAL_DOMINANCE_RATIO;
      if (vertical && gestureState.dy <= -VERTICAL_ACTION_DISTANCE && items.length > 0) {
        hideCurrentWithAnimation();
        return;
      }
      if (vertical && gestureState.dy >= VERTICAL_ACTION_DISTANCE && latestDismissed) {
        restoreLatestWithAnimation();
        return;
      }
      resetVerticalSwipe();
    },
    onPanResponderTerminate: resetVerticalSwipe,
    onPanResponderTerminationRequest: () => false,
  }), [hideCurrentWithAnimation, items.length, latestDismissed, resetVerticalSwipe, restoreLatestWithAnimation, verticalSwipeY]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!items.length) return;
    const offset = event.nativeEvent.contentOffset.x;
    latestScrollOffsetRef.current = offset;
    const next = Math.max(0, Math.min(Math.round(offset / snapInterval), items.length - 1));
    setDisplayIndex(next);
  }, [items.length, snapInterval]);

  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    latestScrollOffsetRef.current = offset;
    settleIndex(Math.round(offset / snapInterval));
  }, [settleIndex, snapInterval]);

  const animatedRailOpacity = verticalSwipeY.interpolate({
    inputRange: [-180, 0, 140],
    outputRange: [0.36, 1, 0.72],
    extrapolate: 'clamp',
  });

  if (!items.length) {
    const cleared = deckReady && allItems.length > 0;
    return (
      <Animated.View
        {...verticalPanResponder.panHandlers}
        style={[styles.emptyGestureWrap, { transform: [{ translateY: verticalSwipeY }], opacity: animatedRailOpacity }]}
      >
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Ionicons name={cleared ? 'checkmark' : 'bonfire-outline'} size={23} color={GOLD} /></View>
          <Text style={styles.emptyTitle}>{cleared ? 'You cleared the featured carousel.' : 'The Outpost is quiet right now.'}</Text>
          <Text style={styles.emptyCopy}>{cleared ? 'Hidden cards stay out of this carousel for today. Their posts and outings are still available elsewhere in the app.' : 'Posts and upcoming outings will show up here as your community gets moving.'}</Text>
          {latestDismissed ? <Text style={styles.emptyRestoreHint}>Swipe down to bring the last hidden card back.</Text> : null}
          <Pressable style={styles.emptyButton} onPress={onExploreCommunities}><Text style={styles.emptyButtonText}>Explore communities</Text></Pressable>
        </View>
      </Animated.View>
    );
  }

  if (!deckReady) return <View style={styles.loadingRail} />;

  return (
    <View style={styles.carouselWrap}>
      <Animated.View
        {...verticalPanResponder.panHandlers}
        style={[styles.animatedRail, { transform: [{ translateY: verticalSwipeY }], opacity: animatedRailOpacity }]}
      >
        <ScrollView
          key={signature}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          contentOffset={{ x: safeIndex * snapInterval, y: 0 }}
          contentContainerStyle={{ paddingHorizontal: sideInset }}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
          style={{ width: viewportWidth }}
        >
          {items.map((item, index) => (
            <View key={item.key} style={[styles.railItem, { width: cardWidth, marginRight: index === items.length - 1 ? 0 : CARD_GAP }]}>
              {item.kind === 'outing' ? (
                <OutingCard event={item.event} width={cardWidth} onDismiss={() => dismissItem(item, index)} />
              ) : (
                <FeaturedPostCard
                  post={item.post}
                  group={item.post.group_id ? groups.get(item.post.group_id) : undefined}
                  event={eventByPost.get(item.post.id)}
                  width={cardWidth}
                  myReaction={myReactions.get(item.post.id) ?? null}
                  reactionCount={reactionCounts.get(item.post.id) ?? item.post.reaction_count ?? 0}
                  reacting={reactingPostId === item.post.id}
                  onToggleReaction={toggleReaction}
                  onDismiss={() => dismissItem(item, index)}
                />
              )}
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      <View style={styles.counterPill} pointerEvents="none">
        <Ionicons name="chevron-back" size={13} color={safeDisplayIndex > 0 ? GOLD_DARK : 'rgba(45,39,22,0.34)'} />
        <Text style={styles.counterText}>{safeDisplayIndex + 1} / {items.length}</Text>
        <Ionicons name="chevron-forward" size={13} color={safeDisplayIndex < items.length - 1 ? GOLD_DARK : 'rgba(45,39,22,0.34)'} />
      </View>
      <View style={styles.gestureHintRow}>
        <Ionicons name="swap-horizontal" size={12} color="#8F9D95" />
        <Text style={styles.swipeHint}>Sideways to browse · Up to hide{latestDismissed ? ' · Down to restore' : ''}</Text>
      </View>

      {undoItem ? (
        <View style={styles.undoToast}>
          <View style={styles.undoCopy}>
            <Text style={styles.undoTitle}>Hidden for today</Text>
            <Text style={styles.undoLabel} numberOfLines={1}>{undoItem.label}</Text>
          </View>
          <Pressable style={styles.undoButton} onPress={undoDismiss}><Text style={styles.undoButtonText}>Undo</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carouselWrap: { alignItems: 'center', position: 'relative' },
  animatedRail: { width: '100%', alignItems: 'center' },
  emptyGestureWrap: { width: '100%' },
  loadingRail: { height: IMAGE_CARD_HEIGHT + 48, borderRadius: 22, backgroundColor: '#121C17' },
  railItem: { height: IMAGE_CARD_HEIGHT + 8, justifyContent: 'center' },
  imageCard: { height: IMAGE_CARD_HEIGHT, borderRadius: 21, overflow: 'hidden', backgroundColor: PANEL, borderWidth: 1, borderColor: '#34433A', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  outingPostCard: { borderWidth: 1.5, borderColor: 'rgba(215,180,90,0.82)' },
  textCard: { height: TEXT_CARD_HEIGHT, alignSelf: 'center', borderRadius: 21, overflow: 'hidden', backgroundColor: PANEL_2, borderWidth: 1, borderColor: '#35473C', padding: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  topoRingOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(215,180,90,0.08)', right: -55, top: -60 },
  topoRingTwo: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(215,180,90,0.07)', right: -18, top: -26 },
  photoStage: { height: PHOTO_STAGE_HEIGHT, backgroundColor: '#0B120E', overflow: 'hidden' },
  photoBackground: { flex: 1 },
  photoImage: { resizeMode: 'cover' },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.10)' },
  photoCopyArea: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 13, paddingTop: 5, paddingBottom: 8, backgroundColor: '#0D1711' },
  background: { flex: 1, justifyContent: 'space-between' },
  backgroundImage: { resizeMode: 'cover' },
  outingShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,7,0.20)' },
  postTypeHeader: { minHeight: 47, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: 10 },
  typeStack: { flex: 1, alignItems: 'flex-start', gap: 4 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: 'rgba(10,18,13,0.88)', borderWidth: 1, borderColor: 'rgba(215,180,90,0.40)', paddingHorizontal: 9, paddingVertical: 5 },
  typeBadgeOuting: { backgroundColor: GOLD, borderColor: GOLD },
  typeBadgeText: { color: '#F3EBD7', fontSize: 9, lineHeight: 11, fontWeight: '900', letterSpacing: 0.8 },
  typeBadgeTextOuting: { color: GOLD_DARK },
  groupContext: { maxWidth: '80%', color: '#F0E6CA', fontSize: 9, fontWeight: '800', letterSpacing: 0.25, backgroundColor: 'rgba(8,14,10,0.70)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  hideButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,15,11,0.80)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  videoCenterBadge: { position: 'absolute', left: '50%', top: '54%', width: 52, height: 52, marginLeft: -26, marginTop: -26, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,14,10,0.70)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' },
  textCardBody: { flex: 1, justifyContent: 'flex-end' },
  authorRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.2, borderColor: '#536258' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 9.5, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 14.5, fontWeight: '900', flexShrink: 1 },
  time: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '700', marginLeft: 'auto' },
  imageBody: { color: TEXT, fontSize: 15.5, lineHeight: 19, fontWeight: '900', letterSpacing: -0.1, marginTop: 2, marginBottom: 5 },
  textOnlyBody: { color: TEXT, fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.15, marginTop: 7, marginBottom: 9, maxWidth: '94%' },
  eventStrip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, backgroundColor: 'rgba(22,32,27,0.94)', paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 },
  eventText: { color: '#E8ECE9', fontSize: 10.5, fontWeight: '800', flex: 1 },
  eventStripStrong: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, backgroundColor: GOLD, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 5 },
  eventStripCopy: { flex: 1 },
  eventStripEyebrow: { color: 'rgba(45,39,22,0.72)', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  eventStripTitle: { color: GOLD_DARK, fontSize: 10.5, fontWeight: '900', marginTop: 1 },
  engagementRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(213,226,217,0.24)', paddingTop: 4 },
  engagementAction: { minWidth: 42, minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 5 },
  engagementCount: { color: '#E2E7E3', fontSize: 11.5, fontWeight: '800' },
  engagementCountActive: { color: GOLD },
  outingCard: { height: IMAGE_CARD_HEIGHT, borderRadius: 21, overflow: 'hidden', backgroundColor: '#17241C', borderWidth: 2, borderColor: GOLD, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 11, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  outingFallback: { justifyContent: 'space-between' },
  outingFallbackIcon: { position: 'absolute', right: 22, top: 82 },
  outingBanner: { minHeight: 42, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: GOLD },
  outingBannerLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  outingBannerText: { color: GOLD_DARK, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  outingStatusDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(45,39,22,0.48)', marginLeft: 2 },
  outingStatusText: { color: GOLD_DARK, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.55 },
  outingHideButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(45,39,22,0.10)' },
  outingCopy: { marginTop: 'auto', padding: 13, backgroundColor: 'rgba(7,13,9,0.90)' },
  outingHeadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  outingDateBlock: { width: 50, minHeight: 57, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD },
  outingMonth: { color: GOLD_DARK, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  outingDay: { color: GOLD_DARK, fontSize: 24, lineHeight: 27, fontWeight: '900' },
  outingTitleWrap: { flex: 1 },
  outingTitle: { color: TEXT, fontSize: 20, lineHeight: 23, fontWeight: '900', letterSpacing: -0.3 },
  outingMeta: { color: '#D7DFDA', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  outingFooter: { minHeight: 34, marginTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(213,226,217,0.24)', paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  outingAttendance: { color: MUTED, fontSize: 10.5, fontWeight: '800' },
  viewOuting: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewOutingText: { color: GOLD, fontSize: 10.5, fontWeight: '900' },
  counterPill: { minWidth: 104, height: 34, marginTop: -15, zIndex: 8, borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: GOLD, borderWidth: 2, borderColor: '#101912', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 7 },
  counterText: { color: GOLD_DARK, fontSize: 12.5, fontWeight: '900', minWidth: 42, textAlign: 'center' },
  gestureHintRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 5 },
  swipeHint: { color: '#8F9D95', fontSize: 9.5, fontWeight: '700' },
  undoToast: { position: 'absolute', left: 14, right: 14, bottom: -62, minHeight: 52, borderRadius: 14, backgroundColor: '#202C25', borderWidth: 1, borderColor: '#45564B', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.30, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 9, zIndex: 20 },
  undoCopy: { flex: 1 },
  undoTitle: { color: TEXT, fontSize: 11, fontWeight: '900' },
  undoLabel: { color: MUTED, fontSize: 9.5, marginTop: 2 },
  undoButton: { borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 7 },
  undoButtonText: { color: GOLD_DARK, fontSize: 10.5, fontWeight: '900' },
  emptyCard: { minHeight: 165, borderRadius: 20, backgroundColor: '#151F1A', padding: 16, alignItems: 'flex-start' },
  emptyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26342A' },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 11 },
  emptyCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 4, maxWidth: 420 },
  emptyRestoreHint: { color: GOLD, fontSize: 10.5, fontWeight: '800', marginTop: 8 },
  emptyButton: { borderRadius: 999, backgroundColor: '#253229', paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  emptyButtonText: { color: GOLD, fontSize: 11, fontWeight: '900' },
});
