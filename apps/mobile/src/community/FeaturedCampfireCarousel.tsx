import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
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
const PANEL_2 = '#1A261F';
const IMAGE_CARD_HEIGHT = 258;
const TEXT_CARD_HEIGHT = 226;
const CARD_GAP = 12;

type ReactionValue = 'like' | 'love' | 'celebrate' | 'support';
type CarouselItem =
  | { key: string; kind: 'post'; post: CommunityPost }
  | { key: string; kind: 'outing'; event: LocalEvent };

type PostCardProps = {
  post: CommunityPost;
  group?: CommunityGroup;
  event?: LocalEvent | null;
  width: number;
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

function eventDate(event: LocalEvent) {
  return new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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
}: PostCardProps) {
  const kind = featuredPostKind(post, group, event);
  const directImage = post.image_url || (post.media_type === 'image' ? post.media_url : null);
  const visual = directImage || event?.image_url || null;
  const label = group?.name || (kind === 'outing' ? 'OUTING CONVERSATION' : 'AROUND THE OUTPOST');
  const openPost = () => router.push(`/community/${post.id}`);
  const openProfile = () => router.push({ pathname: '/community-profile/[id]', params: { id: post.author_id } });
  const openGroup = () => group && router.push({ pathname: '/groups/[id]', params: { id: group.id } });
  const openEvent = () => event && router.push({ pathname: '/local-events/[id]', params: { id: event.id } });

  if (!visual) {
    return (
      <Pressable style={[styles.textCard, { width }]} onPress={openPost}>
        <View style={styles.topoRingOne} />
        <View style={styles.topoRingTwo} />
        <View style={styles.topRow}>
          {group ? (
            <Pressable style={styles.contextPill} onPress={(tap) => stopAndRun(tap, openGroup)}>
              <Text style={styles.contextText} numberOfLines={1}>{label.toUpperCase()}</Text>
            </Pressable>
          ) : <View style={styles.contextPill}><Text style={styles.contextText}>{label}</Text></View>}
          {kind === 'video' ? <View style={styles.playBadge}><Ionicons name="play" size={14} color={TEXT} /></View> : null}
        </View>
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
    <Pressable style={[styles.imageCard, { width }]} onPress={openPost}>
      <ImageBackground source={{ uri: visual }} style={styles.background} imageStyle={styles.backgroundImage}>
        <View style={styles.shade} />
        <View style={styles.topRow}>
          {group ? (
            <Pressable style={styles.contextPill} onPress={(tap) => stopAndRun(tap, openGroup)}>
              <Text style={styles.contextText} numberOfLines={1}>{label.toUpperCase()}</Text>
            </Pressable>
          ) : <View style={styles.contextPill}><Text style={styles.contextText}>{label}</Text></View>}
          {kind === 'video' ? <View style={styles.playBadge}><Ionicons name="play" size={14} color={TEXT} /></View> : null}
        </View>
        <View style={styles.copyArea}>
          <PostAuthor post={post} onPress={openProfile} />
          <Text style={styles.imageBody} numberOfLines={event ? 1 : 2}>{post.body || 'Shared a moment from outside.'}</Text>
          {event ? (
            <Pressable style={styles.eventStrip} onPress={(tap) => stopAndRun(tap, openEvent)}>
              <Ionicons name="calendar-outline" size={14} color={GOLD} />
              <Text style={styles.eventText} numberOfLines={1}>{event.title} · {eventDate(event)}</Text>
              <Ionicons name="chevron-forward" size={14} color={GOLD} />
            </Pressable>
          ) : null}
          <EngagementRow post={post} myReaction={myReaction} reactionCount={reactionCount} reacting={reacting} onToggleReaction={onToggleReaction} />
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function OutingCard({ event, width }: { event: LocalEvent; width: number }) {
  const openEvent = () => router.push({ pathname: '/local-events/[id]', params: { id: event.id } });
  const location = [event.venue_name || event.city, event.state].filter(Boolean).join(', ');
  const rsvpLabel = event.my_rsvp === 'going' ? 'YOU’RE GOING' : event.my_rsvp === 'interested' ? 'INTERESTED' : 'UPCOMING OUTING';

  const content = (
    <>
      <View style={styles.outingTopRow}>
        <View style={styles.outingPill}><Ionicons name="calendar-outline" size={13} color={GOLD} /><Text style={styles.outingPillText}>{rsvpLabel}</Text></View>
        <Text style={styles.outingDate}>{eventDate(event)}</Text>
      </View>
      <View style={styles.outingCopy}>
        <Text style={styles.outingTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.outingMeta} numberOfLines={1}>{eventTime(event)} · {location}</Text>
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
      <View style={styles.outingFallbackIcon}><Ionicons name="compass-outline" size={48} color="rgba(215,180,90,0.18)" /></View>
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
  viewportWidth: number;
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onExploreCommunities: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, activeIndex));
  const [deckReady, setDeckReady] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [deckState, setDeckState] = useState<CampfireDeckState | null>(null);
  const [myReactions, setMyReactions] = useState<Map<string, ReactionValue>>(new Map());
  const [reactionCounts, setReactionCounts] = useState<Map<string, number>>(new Map());
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);

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
    .filter((event) => event.status === 'published' && new Date(event.starts_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [events]);

  const items = useMemo(() => buildCarouselItems(posts, outings), [outings, posts]);
  const signature = useMemo(() => items.map((item) => item.key).join('|'), [items]);
  const safeIndex = items.length ? Math.min(currentIndex, items.length - 1) : 0;

  useEffect(() => {
    let active = true;
    setDeckReady(false);

    async function hydrate() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      const stored = await loadCampfireDeckState(userId);
      if (!active) return;

      setViewerId(userId);
      setDeckState(stored);

      let nextIndex = Math.max(0, Math.min(activeIndex, Math.max(0, items.length - 1)));
      if (items.length && shouldResumeCampfirePosition(stored) && stored.currentPostId) {
        const resumeIndex = items.findIndex((item) => item.kind === 'post' ? item.post.id === stored.currentPostId : item.key === stored.currentPostId);
        if (resumeIndex >= 0) nextIndex = resumeIndex;
      } else if (items.length) {
        const freshIndex = items.findIndex((item) => item.kind === 'post' && campfirePostHasFreshActivity(stored, item.post));
        if (freshIndex >= 0) nextIndex = freshIndex;
      }

      setCurrentIndex(nextIndex);
      onIndexChange(nextIndex);
      setDeckReady(true);
    }

    void hydrate();
    return () => { active = false; };
  }, [activeIndex, items, onIndexChange, signature]);

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
    if (next === currentIndex) return;

    const previousItem = items[currentIndex];
    const nextItem = items[next];
    setDeckState((current) => {
      if (!current) return current;
      let updated = current;
      if (next > currentIndex && previousItem?.kind === 'post') updated = markCampfirePostSeen(updated, previousItem.post);
      const resumeKey = nextItem?.kind === 'post' ? nextItem.post.id : nextItem?.key ?? null;
      updated = updateCampfirePosition(updated, resumeKey, false);
      void saveCampfireDeckState(viewerId, updated);
      return updated;
    });
    setCurrentIndex(next);
    onIndexChange(next);
  }, [currentIndex, deckReady, items, onIndexChange, viewerId]);

  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    settleIndex(Math.round(offset / snapInterval));
  }, [settleIndex, snapInterval]);

  if (!items.length) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}><Ionicons name="bonfire-outline" size={23} color={GOLD} /></View>
        <Text style={styles.emptyTitle}>The Outpost is quiet right now.</Text>
        <Text style={styles.emptyCopy}>Posts and upcoming outings will show up here as your community gets moving.</Text>
        <Pressable style={styles.emptyButton} onPress={onExploreCommunities}><Text style={styles.emptyButtonText}>Explore communities</Text></Pressable>
      </View>
    );
  }

  if (!deckReady) return <View style={styles.loadingRail} />;

  return (
    <View style={styles.carouselWrap}>
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
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        style={{ width: viewportWidth }}
      >
        {items.map((item, index) => (
          <View key={item.key} style={[styles.railItem, { width: cardWidth, marginRight: index === items.length - 1 ? 0 : CARD_GAP }]}>
            {item.kind === 'outing' ? (
              <OutingCard event={item.event} width={cardWidth} />
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
              />
            )}
          </View>
        ))}
      </ScrollView>
      <View style={styles.deckFooter}>
        <View style={styles.peekHint}><Ionicons name="chevron-back" size={13} color={safeIndex > 0 ? GOLD : '#46524A'} /></View>
        <Text style={styles.counter}>{safeIndex + 1} of {items.length}</Text>
        <View style={styles.peekHint}><Ionicons name="chevron-forward" size={13} color={safeIndex < items.length - 1 ? GOLD : '#46524A'} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselWrap: { alignItems: 'center' },
  loadingRail: { height: IMAGE_CARD_HEIGHT + 38, borderRadius: 22, backgroundColor: '#121C17' },
  railItem: { height: IMAGE_CARD_HEIGHT + 8, justifyContent: 'center' },
  imageCard: { height: IMAGE_CARD_HEIGHT, borderRadius: 21, overflow: 'hidden', backgroundColor: PANEL, borderWidth: 1, borderColor: '#34433A', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  textCard: { height: TEXT_CARD_HEIGHT, alignSelf: 'center', borderRadius: 21, overflow: 'hidden', backgroundColor: PANEL_2, borderWidth: 1, borderColor: '#35473C', padding: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  topoRingOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(215,180,90,0.08)', right: -55, top: -60 },
  topoRingTwo: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(215,180,90,0.07)', right: -18, top: -26 },
  background: { flex: 1, justifyContent: 'space-between' },
  backgroundImage: { resizeMode: 'cover' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.36)' },
  outingShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,7,0.54)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 11 },
  contextPill: { maxWidth: '82%', borderRadius: 999, backgroundColor: 'rgba(10,18,13,0.84)', paddingHorizontal: 9, paddingVertical: 5 },
  contextText: { color: '#E9EDE8', fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.7 },
  playBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,18,13,0.82)' },
  copyArea: { marginTop: 'auto', paddingHorizontal: 13, paddingBottom: 9, backgroundColor: 'rgba(7,13,9,0.78)' },
  textCardBody: { flex: 1, justifyContent: 'flex-end' },
  authorRow: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.2, borderColor: '#536258' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 9.5, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 14.5, fontWeight: '900', flexShrink: 1 },
  time: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '700', marginLeft: 'auto' },
  imageBody: { color: TEXT, fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.15, marginTop: 2, marginBottom: 7 },
  textOnlyBody: { color: TEXT, fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.15, marginTop: 7, marginBottom: 9, maxWidth: '94%' },
  eventStrip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, backgroundColor: 'rgba(22,32,27,0.94)', paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 },
  eventText: { color: '#E8ECE9', fontSize: 10.5, fontWeight: '800', flex: 1 },
  engagementRow: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(213,226,217,0.24)', paddingTop: 5 },
  engagementAction: { minWidth: 42, minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 5 },
  engagementCount: { color: '#E2E7E3', fontSize: 11.5, fontWeight: '800' },
  engagementCountActive: { color: GOLD },
  outingCard: { height: IMAGE_CARD_HEIGHT, borderRadius: 21, overflow: 'hidden', backgroundColor: '#17241C', borderWidth: 1, borderColor: '#3D4E43', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  outingFallback: { padding: 13, justifyContent: 'space-between' },
  outingFallbackIcon: { position: 'absolute', right: 22, top: 58 },
  outingTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12 },
  outingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: 'rgba(10,18,13,0.86)', paddingHorizontal: 9, paddingVertical: 6 },
  outingPillText: { color: '#F2E4AE', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  outingDate: { color: '#F3EBD7', fontSize: 11, fontWeight: '900' },
  outingCopy: { marginTop: 'auto', padding: 13, backgroundColor: 'rgba(7,13,9,0.80)' },
  outingTitle: { color: TEXT, fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  outingMeta: { color: '#D7DFDA', fontSize: 11.5, lineHeight: 17, fontWeight: '700', marginTop: 5 },
  outingFooter: { minHeight: 34, marginTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(213,226,217,0.24)', paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  outingAttendance: { color: MUTED, fontSize: 10.5, fontWeight: '800' },
  viewOuting: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewOutingText: { color: GOLD, fontSize: 10.5, fontWeight: '900' },
  deckFooter: { width: '100%', minHeight: 28, marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  peekHint: { width: 24, alignItems: 'center' },
  counter: { color: TEXT, fontSize: 11.5, fontWeight: '900', minWidth: 44, textAlign: 'center' },
  emptyCard: { minHeight: 165, borderRadius: 20, backgroundColor: '#151F1A', padding: 16, alignItems: 'flex-start' },
  emptyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26342A' },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 11 },
  emptyCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 4, maxWidth: 420 },
  emptyButton: { borderRadius: 999, backgroundColor: '#253229', paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  emptyButtonText: { color: GOLD, fontSize: 11, fontWeight: '900' },
});
