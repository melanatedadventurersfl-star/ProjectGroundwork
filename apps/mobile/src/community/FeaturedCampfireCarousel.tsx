import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import type { LocalEvent } from '../local-events/api';
import { supabase } from '../lib/supabase';
import { setReaction, type CommunityGroup, type CommunityPost } from './api';
import {
  campfirePostHasFreshActivity,
  loadCampfireDeckState,
  markCampfirePostSeen,
  saveCampfireDeckState,
  shouldResumeCampfirePosition,
  updateCampfirePosition,
  type CampfireDeckState,
} from './campfireDeckState';
import { featuredPostKind } from './featuredPosts';

const GOLD = '#D7B45A';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const PANEL = '#16201B';
const CARD_HEIGHT = 258;
const WEB_SWIPE_STYLE: ViewStyle | undefined = Platform.OS === 'web'
  ? ({ touchAction: 'pan-y' } as unknown as ViewStyle)
  : undefined;

type ReactionValue = 'like' | 'love' | 'celebrate' | 'support';
type VisibleCard = { post: CommunityPost; index: number; offset: number };

type CardProps = {
  post: CommunityPost;
  group?: CommunityGroup;
  event?: LocalEvent | null;
  width: number;
  fallbackSource: ImageSourcePropType;
  interactive?: boolean;
  myReaction?: ReactionValue | null;
  reactionCount?: number;
  reacting?: boolean;
  onToggleReaction?: (post: CommunityPost) => void;
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

function eventTime(event: LocalEvent) {
  return new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function stopAndRun(event: any, action: () => void) {
  event.stopPropagation?.();
  action();
}

function resolveSource(post: CommunityPost, group: CommunityGroup | undefined, event: LocalEvent | null | undefined, fallbackSource: ImageSourcePropType) {
  const media = post.image_url || (post.media_type === 'image' ? post.media_url : null);
  const groupCover = group?.cover_image_url || group?.image_url || null;
  if (media) return { uri: media };
  if (event?.image_url) return { uri: event.image_url };
  if (groupCover) return { uri: groupCover };
  return fallbackSource;
}

function FeaturedPostCard({
  post,
  group,
  event,
  width,
  fallbackSource,
  interactive = false,
  myReaction = null,
  reactionCount = post.reaction_count || 0,
  reacting = false,
  onToggleReaction,
}: CardProps) {
  const kind = featuredPostKind(post, group, event);
  const source = resolveSource(post, group, event, fallbackSource);
  const label = group?.name || (kind === 'outing' ? 'OUTING CONVERSATION' : 'AROUND THE OUTPOST');
  const bodyLines = event ? 1 : kind === 'media' ? 2 : 3;
  const accessibilityLabel = `${post.author_name}. ${group?.name ? `${group.name}. ` : ''}${post.body || 'Post'}. ${reactionCount} reactions. ${post.comment_count || 0} comments.`;

  const openPost = () => router.push(`/community/${post.id}`);
  const openProfile = () => router.push({ pathname: '/community-profile/[id]', params: { id: post.author_id } });
  const openGroup = () => group && router.push({ pathname: '/groups/[id]', params: { id: group.id } });
  const openEvent = () => event && router.push({ pathname: '/local-events/[id]', params: { id: event.id } });

  return (
    <Pressable
      disabled={!interactive}
      style={[styles.card, { width }]}
      onPress={interactive ? openPost : undefined}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={interactive ? accessibilityLabel : undefined}
    >
      <ImageBackground source={source} style={styles.background} imageStyle={styles.backgroundImage}>
        <View style={[styles.shade, kind !== 'media' && styles.shadeStrong]} />

        <View style={styles.topRow}>
          {interactive && group ? (
            <Pressable
              style={styles.contextPill}
              onPress={(tap) => stopAndRun(tap, openGroup)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${group.name}`}
            >
              <Text style={styles.contextText} numberOfLines={1}>{label.toUpperCase()}</Text>
            </Pressable>
          ) : (
            <View style={styles.contextPill}><Text style={styles.contextText} numberOfLines={1}>{label.toUpperCase()}</Text></View>
          )}
          {kind === 'video' ? <View style={styles.playBadge}><Ionicons name="play" size={15} color={TEXT} /></View> : null}
        </View>

        <View style={styles.copyArea}>
          {interactive ? (
            <Pressable
              style={styles.authorRow}
              onPress={(tap) => stopAndRun(tap, openProfile)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${post.author_name}'s profile`}
            >
              <View style={styles.avatar}>
                {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}
              </View>
              <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
              <Text style={styles.time}>{relativeTime(post.created_at)}</Text>
            </Pressable>
          ) : (
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}
              </View>
              <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
              <Text style={styles.time}>{relativeTime(post.created_at)}</Text>
            </View>
          )}

          {post.body ? <Text style={styles.body} numberOfLines={bodyLines}>{post.body}</Text> : <Text style={styles.body}>Shared a moment from outside.</Text>}

          {event ? (
            interactive ? (
              <Pressable style={styles.eventStrip} onPress={(tap) => stopAndRun(tap, openEvent)} accessibilityRole="button" accessibilityLabel={`Open outing ${event.title}`}>
                <Ionicons name="calendar-outline" size={14} color={GOLD} />
                <Text style={styles.eventText} numberOfLines={1}>{event.title} · {eventTime(event)}</Text>
                <Ionicons name="chevron-forward" size={14} color={GOLD} />
              </Pressable>
            ) : (
              <View style={styles.eventStrip}>
                <Ionicons name="calendar-outline" size={14} color={GOLD} />
                <Text style={styles.eventText} numberOfLines={1}>{event.title} · {eventTime(event)}</Text>
              </View>
            )
          ) : null}

          <View style={styles.engagementRow}>
            {interactive ? (
              <>
                <Pressable
                  style={styles.engagementAction}
                  disabled={reacting}
                  onPress={(tap) => stopAndRun(tap, () => onToggleReaction?.(post))}
                  accessibilityRole="button"
                  accessibilityLabel={myReaction ? 'Remove reaction' : 'Like post'}
                >
                  <Ionicons name={myReaction ? 'heart' : 'heart-outline'} size={18} color={myReaction ? GOLD : '#E2E7E3'} />
                  <Text style={[styles.engagementCount, myReaction && styles.engagementCountActive]}>{reactionCount}</Text>
                </Pressable>
                <Pressable style={styles.engagementAction} onPress={(tap) => stopAndRun(tap, openPost)} accessibilityRole="button" accessibilityLabel={`${post.comment_count || 0} comments`}>
                  <Ionicons name="chatbubble-outline" size={17} color="#E2E7E3" />
                  <Text style={styles.engagementCount}>{post.comment_count || 0}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.engagementAction}><Ionicons name="heart-outline" size={18} color="#E2E7E3" /><Text style={styles.engagementCount}>{reactionCount}</Text></View>
                <View style={styles.engagementAction}><Ionicons name="chatbubble-outline" size={17} color="#E2E7E3" /><Text style={styles.engagementCount}>{post.comment_count || 0}</Text></View>
              </>
            )}
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

export function FeaturedCampfireCarousel({
  posts,
  groups,
  events,
  fallbackSource,
  viewportWidth,
  activeIndex,
  onIndexChange,
  onExploreCommunities,
}: {
  posts: CommunityPost[];
  groups: Map<string, CommunityGroup>;
  events: Map<string, LocalEvent>;
  fallbackSource: ImageSourcePropType;
  viewportWidth: number;
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onExploreCommunities: () => void;
}) {
  const [position] = useState(() => new Animated.ValueXY());
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, activeIndex));
  const [caughtUp, setCaughtUp] = useState(false);
  const [deckReady, setDeckReady] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [, setDeckState] = useState<CampfireDeckState | null>(null);
  const [myReactions, setMyReactions] = useState<Map<string, ReactionValue>>(new Map());
  const [reactionCounts, setReactionCounts] = useState<Map<string, number>>(new Map());
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);
  const cardWidth = Math.min(360, Math.max(270, viewportWidth * 0.9));
  const safeIndex = posts.length ? Math.min(currentIndex, posts.length - 1) : 0;

  const eventByPost = useMemo(() => {
    const map = new Map<string, LocalEvent | null>();
    for (const post of posts) {
      const metadata = post.metadata ?? {};
      const possible = [metadata['local_event_id'], metadata['event_id'], metadata['outing_id']].find((value) => typeof value === 'string') as string | undefined;
      map.set(post.id, possible ? events.get(possible) ?? null : null);
    }
    return map;
  }, [events, posts]);

  const visible = useMemo<VisibleCard[]>(() => {
    if (!posts.length || caughtUp) return [];
    const cards: VisibleCard[] = [];
    for (let offset = 0; offset < 3; offset += 1) {
      const index = safeIndex + offset;
      if (index >= posts.length) break;
      const post = posts[index];
      if (post) cards.push({ post, index, offset });
    }
    return cards;
  }, [caughtUp, posts, safeIndex]);

  useEffect(() => {
    let active = true;
    setDeckReady(false);
    position.setValue({ x: 0, y: 0 });

    async function hydrateDeck() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      const stored = await loadCampfireDeckState(userId);
      if (!active) return;

      setViewerId(userId);
      setDeckState(stored);

      if (!posts.length) {
        setCurrentIndex(0);
        setCaughtUp(false);
        setDeckReady(true);
        return;
      }

      const freshIndex = posts.findIndex((post) => campfirePostHasFreshActivity(stored, post));
      const resumeIndex = shouldResumeCampfirePosition(stored) && stored.currentPostId
        ? posts.findIndex((post) => post.id === stored.currentPostId)
        : -1;

      if (stored.caughtUp && freshIndex < 0) {
        setCurrentIndex(Math.max(0, posts.length - 1));
        setCaughtUp(true);
        onIndexChange(posts.length);
      } else if (resumeIndex >= 0) {
        setCurrentIndex(resumeIndex);
        setCaughtUp(false);
        onIndexChange(resumeIndex);
      } else if (freshIndex >= 0) {
        setCurrentIndex(freshIndex);
        setCaughtUp(false);
        onIndexChange(freshIndex);
      } else {
        setCurrentIndex(Math.max(0, posts.length - 1));
        setCaughtUp(true);
        onIndexChange(posts.length);
      }
      setDeckReady(true);
    }

    void hydrateDeck();
    return () => { active = false; };
  }, [onIndexChange, position, posts]);

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
  }, [myReactions, reactionCounts, reactingPostId]);

  const persistTransition = useCallback((post: CommunityPost, nextPostId: string | null, nextCaughtUp: boolean) => {
    setDeckState((current) => {
      if (!current) return current;
      const seen = markCampfirePostSeen(current, post);
      const next = updateCampfirePosition(seen, nextPostId, nextCaughtUp);
      void saveCampfireDeckState(viewerId, next);
      return next;
    });
  }, [viewerId]);

  const springBack = useCallback(() => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 7,
      tension: 70,
    }).start();
  }, [position]);

  const moveCard = useCallback((direction: -1 | 1) => {
    if (!deckReady || !posts.length) {
      springBack();
      return;
    }

    const index = Math.min(currentIndex, posts.length - 1);
    const currentPost = posts[index];
    if (!currentPost) {
      springBack();
      return;
    }

    const movingForward = direction === -1;
    const nextIndex = movingForward ? index + 1 : index - 1;

    if (!movingForward && nextIndex < 0) {
      springBack();
      return;
    }

    Animated.timing(position, {
      toValue: { x: direction * Math.max(cardWidth * 1.35, 430), y: 18 },
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      if (movingForward && nextIndex >= posts.length) {
        persistTransition(currentPost, null, true);
        setCaughtUp(true);
        onIndexChange(posts.length);
      } else {
        const nextPost = posts[nextIndex];
        if (nextPost) {
          persistTransition(currentPost, nextPost.id, false);
          setCurrentIndex(nextIndex);
          setCaughtUp(false);
          onIndexChange(nextIndex);
        }
      }
      position.setValue({ x: 0, y: 0 });
    });
  }, [cardWidth, currentIndex, deckReady, onIndexChange, persistTransition, position, posts, springBack]);

  const reviewLastPost = useCallback(() => {
    if (!posts.length) return;
    const index = posts.length - 1;
    const post = posts[index];
    if (!post) return;
    setCurrentIndex(index);
    setCaughtUp(false);
    position.setValue({ x: 0, y: 0 });
    setDeckState((current) => {
      if (!current) return current;
      const next = updateCampfirePosition(current, post.id, false);
      void saveCampfireDeckState(viewerId, next);
      return next;
    });
    onIndexChange(index);
  }, [onIndexChange, position, posts, viewerId]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => deckReady && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => deckReady && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderMove: (_event, gesture) => position.setValue({ x: gesture.dx, y: gesture.dy * 0.1 }),
    onPanResponderRelease: (_event, gesture) => {
      const threshold = cardWidth * 0.24;
      if (Math.abs(gesture.dx) > threshold || Math.abs(gesture.vx) > 0.55) {
        moveCard(gesture.dx < 0 ? -1 : 1);
      } else {
        springBack();
      }
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: springBack,
  }), [cardWidth, deckReady, moveCard, position, springBack]);

  if (!posts.length) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}><Ionicons name="bonfire-outline" size={23} color={GOLD} /></View>
        <Text style={styles.emptyTitle}>The campfire is quiet right now.</Text>
        <Text style={styles.emptyCopy}>New conversations from your Outpost and communities will show up here.</Text>
        <Pressable style={styles.emptyButton} onPress={onExploreCommunities}><Text style={styles.emptyButtonText}>Explore communities</Text></Pressable>
      </View>
    );
  }

  if (caughtUp) {
    return (
      <View style={styles.caughtUpCard}>
        <View style={styles.caughtUpIcon}><Ionicons name="checkmark" size={22} color="#101510" /></View>
        <Text style={styles.caughtUpTitle}>You’re caught up</Text>
        <Text style={styles.caughtUpCopy}>You’ve seen the featured posts around your Outpost. Keep scrolling for Happening now, or explore another community.</Text>
        <View style={styles.caughtUpActions}>
          <Pressable style={styles.reviewButton} onPress={reviewLastPost}><Ionicons name="arrow-back" size={14} color={TEXT} /><Text style={styles.reviewButtonText}>Review last post</Text></Pressable>
          <Pressable style={styles.emptyButton} onPress={onExploreCommunities}><Text style={styles.emptyButtonText}>Explore communities</Text></Pressable>
        </View>
      </View>
    );
  }

  const rotate = position.x.interpolate({ inputRange: [-cardWidth, 0, cardWidth], outputRange: ['-6deg', '0deg', '6deg'], extrapolate: 'clamp' });
  const nextScale = position.x.interpolate({ inputRange: [-cardWidth, 0, cardWidth], outputRange: [1, 0.965, 1], extrapolate: 'clamp' });
  const nextTranslateY = position.x.interpolate({ inputRange: [-cardWidth, 0, cardWidth], outputRange: [0, 8, 0], extrapolate: 'clamp' });

  return (
    <View>
      <View style={[styles.deck, { height: CARD_HEIGHT + 22 }]}>
        {visible.slice().reverse().map(({ post, offset }) => {
          const group = post.group_id ? groups.get(post.group_id) : undefined;
          const event = eventByPost.get(post.id);
          if (offset === 0) {
            return (
              <Animated.View
                key={post.id}
                style={[styles.cardLayer, WEB_SWIPE_STYLE, { width: cardWidth, zIndex: 30, transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]}
                {...panResponder.panHandlers}
              >
                <FeaturedPostCard
                  post={post}
                  group={group}
                  event={event}
                  width={cardWidth}
                  fallbackSource={fallbackSource}
                  interactive
                  myReaction={myReactions.get(post.id) ?? null}
                  reactionCount={reactionCounts.get(post.id) ?? post.reaction_count ?? 0}
                  reacting={reactingPostId === post.id}
                  onToggleReaction={toggleReaction}
                />
              </Animated.View>
            );
          }

          const staticScale = offset === 1 ? 0.965 : 0.93;
          const staticOffset = offset === 1 ? 8 : 16;
          const animatedStyle = offset === 1
            ? { transform: [{ scale: nextScale }, { translateY: nextTranslateY }] }
            : { transform: [{ scale: staticScale }, { translateY: staticOffset }] };

          return (
            <Animated.View key={`${post.id}-${offset}`} pointerEvents="none" style={[styles.cardLayer, { width: cardWidth, zIndex: 30 - offset }, animatedStyle]}>
              <FeaturedPostCard post={post} group={group} event={event} width={cardWidth} fallbackSource={fallbackSource} reactionCount={reactionCounts.get(post.id) ?? post.reaction_count ?? 0} />
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.deckFooter}>
        <View style={styles.directionHint}><Ionicons name="arrow-back" size={14} color={GOLD} /><Text style={styles.directionText}>Next</Text></View>
        <Text style={styles.counter}>{safeIndex + 1} of {posts.length}</Text>
        <View style={[styles.directionHint, styles.directionHintRight]}><Text style={styles.directionText}>{safeIndex > 0 ? 'Back' : 'Start'}</Text><Ionicons name="arrow-forward" size={14} color={safeIndex > 0 ? GOLD : '#566159'} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { position: 'relative', alignItems: 'center', justifyContent: 'flex-start', overflow: 'visible' },
  cardLayer: { position: 'absolute', top: 0, alignSelf: 'center' },
  card: { height: CARD_HEIGHT, borderRadius: 21, overflow: 'hidden', backgroundColor: PANEL, borderWidth: 1, borderColor: '#34433A', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  background: { flex: 1, justifyContent: 'space-between' },
  backgroundImage: { resizeMode: 'cover' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.30)' },
  shadeStrong: { backgroundColor: 'rgba(4,9,6,0.54)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 11 },
  contextPill: { maxWidth: '82%', borderRadius: 999, backgroundColor: 'rgba(10,18,13,0.82)', paddingHorizontal: 9, paddingVertical: 5 },
  contextText: { color: '#E9EDE8', fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.7 },
  playBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,18,13,0.82)' },
  copyArea: { marginTop: 'auto', paddingHorizontal: 13, paddingBottom: 9, backgroundColor: 'rgba(7,13,9,0.76)' },
  authorRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 7 },
  avatar: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.2, borderColor: '#536258' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 9.5, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 14.5, fontWeight: '900', flexShrink: 1 },
  time: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '700', marginLeft: 'auto' },
  body: { color: TEXT, fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.15, marginTop: 2, marginBottom: 7 },
  eventStrip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, backgroundColor: 'rgba(22,32,27,0.94)', paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 },
  eventText: { color: '#E8ECE9', fontSize: 10.5, fontWeight: '800', flex: 1 },
  engagementRow: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(213,226,217,0.24)', paddingTop: 5 },
  engagementAction: { minWidth: 42, minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 5 },
  engagementCount: { color: '#E2E7E3', fontSize: 11.5, fontWeight: '800' },
  engagementCountActive: { color: GOLD },
  deckFooter: { minHeight: 34, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 },
  directionHint: { minWidth: 64, flexDirection: 'row', alignItems: 'center', gap: 5 },
  directionHintRight: { justifyContent: 'flex-end' },
  directionText: { color: MUTED, fontSize: 10.5, fontWeight: '800' },
  counter: { color: TEXT, fontSize: 11.5, fontWeight: '900' },
  emptyCard: { minHeight: 165, borderRadius: 20, backgroundColor: '#151F1A', padding: 16, alignItems: 'flex-start' },
  emptyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26342A' },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 11 },
  emptyCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 4, maxWidth: 420 },
  emptyButton: { borderRadius: 999, backgroundColor: '#253229', paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  emptyButtonText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  caughtUpCard: { minHeight: 190, borderRadius: 20, backgroundColor: '#151F1A', padding: 18, alignItems: 'flex-start', justifyContent: 'center' },
  caughtUpIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD },
  caughtUpTitle: { color: TEXT, fontSize: 21, fontWeight: '900', marginTop: 12 },
  caughtUpCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 4, maxWidth: 430 },
  caughtUpActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9, marginTop: 2 },
  reviewButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#253229', paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  reviewButtonText: { color: TEXT, fontSize: 11, fontWeight: '900' },
});