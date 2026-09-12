import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import type { LocalEvent } from '../local-events/api';
import type { CommunityGroup, CommunityPost } from './api';
import { PostEngagementBar } from './PostEngagementBar';
import { featuredPostKind } from './featuredPosts';

const GOLD = '#D7B45A';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const GREEN = '#7F9D68';
const PANEL = '#16201B';
const GAP = 12;

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
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function stopAndRun(event: any, action: () => void) {
  event.stopPropagation?.();
  action();
}

function FeaturedPostCard({
  post,
  group,
  event,
  width,
  fallbackSource,
}: {
  post: CommunityPost;
  group?: CommunityGroup;
  event?: LocalEvent | null;
  width: number;
  fallbackSource: ImageSourcePropType;
}) {
  const kind = featuredPostKind(post, group, event);
  const media = post.image_url || (post.media_type === 'image' ? post.media_url : null);
  const groupCover = group?.cover_image_url || group?.image_url || null;
  const source = media
    ? { uri: media }
    : event?.image_url
      ? { uri: event.image_url }
      : groupCover
        ? { uri: groupCover }
        : fallbackSource;
  const label = group?.name || (kind === 'outing' ? 'OUTING CONVERSATION' : 'AROUND THE OUTPOST');
  const bodyLines = kind === 'media' ? 3 : kind === 'outing' ? 3 : 5;
  const accessibilityLabel = `${post.author_name}. ${group?.name ? `${group.name}. ` : ''}${post.body || 'Post'}. ${post.reaction_count || 0} reactions. ${post.comment_count || 0} comments.`;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
      onPress={() => router.push(`/community/${post.id}`)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <ImageBackground source={source} style={styles.background} imageStyle={styles.backgroundImage}>
        <View style={[styles.shade, kind !== 'media' && styles.shadeStrong]} />

        <View style={styles.topRow}>
          {group ? (
            <Pressable
              style={styles.contextPill}
              onPress={(tap) => stopAndRun(tap, () => router.push({ pathname: '/groups/[id]', params: { id: group.id } }))}
              accessibilityRole="button"
              accessibilityLabel={`Open ${group.name}`}
            >
              <Text style={styles.contextText} numberOfLines={1}>{label.toUpperCase()}</Text>
            </Pressable>
          ) : <View style={styles.contextPill}><Text style={styles.contextText}>{label}</Text></View>}
          {kind === 'video' ? <View style={styles.playBadge}><Ionicons name="play" size={16} color={TEXT} /></View> : null}
        </View>

        <View style={styles.copyArea}>
          <Pressable
            style={styles.authorRow}
            onPress={(tap) => stopAndRun(tap, () => router.push({ pathname: '/community-profile/[id]', params: { id: post.author_id } }))}
            accessibilityRole="button"
            accessibilityLabel={`Open ${post.author_name}'s profile`}
          >
            <View style={styles.avatar}>
              {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}
            </View>
            <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
            <Text style={styles.time}>{relativeTime(post.created_at)}</Text>
          </Pressable>

          {post.body ? <Text style={styles.body} numberOfLines={bodyLines}>{post.body}</Text> : <Text style={styles.body}>Shared a moment from outside.</Text>}

          {event ? (
            <Pressable
              style={styles.eventStrip}
              onPress={(tap) => stopAndRun(tap, () => router.push({ pathname: '/local-events/[id]', params: { id: event.id } }))}
              accessibilityRole="button"
              accessibilityLabel={`Open outing ${event.title}`}
            >
              <View style={styles.eventIcon}><Ionicons name="calendar-outline" size={17} color={GOLD} /></View>
              <View style={styles.flex}>
                <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{eventTime(event)} · {[event.venue_name || event.city, event.state].filter(Boolean).join(', ')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={GOLD} />
            </Pressable>
          ) : null}

          <View style={styles.engagementWrap}>
            <PostEngagementBar postId={post.id} initialReactionCount={post.reaction_count || 0} commentCount={post.comment_count || 0} />
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
  const railRef = useRef<ScrollView | null>(null);
  const cardWidth = Math.min(390, Math.max(270, viewportWidth * 0.9));
  const snap = cardWidth + GAP;
  const firstPostId = posts[0]?.id;

  const eventByPost = useMemo(() => {
    const map = new Map<string, LocalEvent | null>();
    for (const post of posts) {
      const metadata = post.metadata ?? {};
      const possible = [metadata.local_event_id, metadata.event_id, metadata.outing_id].find((value) => typeof value === 'string') as string | undefined;
      map.set(post.id, possible ? events.get(possible) ?? null : null);
    }
    return map;
  }, [events, posts]);

  useEffect(() => {
    onIndexChange(0);
    railRef.current?.scrollTo({ x: 0, animated: false });
  }, [firstPostId]);

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

  return (
    <>
      <ScrollView
        ref={railRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snap}
        snapToAlignment="start"
        contentContainerStyle={styles.rail}
        onMomentumScrollEnd={(event) => {
          const next = Math.max(0, Math.min(posts.length - 1, Math.round(event.nativeEvent.contentOffset.x / snap)));
          onIndexChange(next);
        }}
      >
        {posts.map((post) => (
          <FeaturedPostCard
            key={post.id}
            post={post}
            group={post.group_id ? groups.get(post.group_id) : undefined}
            event={eventByPost.get(post.id)}
            width={cardWidth}
            fallbackSource={fallbackSource}
          />
        ))}
      </ScrollView>
      {posts.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Featured post ${activeIndex + 1} of ${posts.length}`}>
          {posts.map((post, index) => <View key={post.id} style={[styles.dot, activeIndex === index && styles.dotActive]} />)}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rail: { gap: GAP, paddingRight: 48, paddingBottom: 3 },
  card: { height: 338, borderRadius: 24, overflow: 'hidden', backgroundColor: PANEL, borderWidth: 1, borderColor: '#334238' },
  background: { flex: 1, justifyContent: 'space-between' },
  backgroundImage: { resizeMode: 'cover' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.36)' },
  shadeStrong: { backgroundColor: 'rgba(4,9,6,0.58)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14 },
  contextPill: { maxWidth: '82%', borderRadius: 999, backgroundColor: 'rgba(10,18,13,0.82)', paddingHorizontal: 10, paddingVertical: 6 },
  contextText: { color: '#E9EDE8', fontSize: 9.5, lineHeight: 12, fontWeight: '900', letterSpacing: 0.75 },
  playBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,18,13,0.82)' },
  copyArea: { marginTop: 'auto', paddingHorizontal: 15, paddingBottom: 12, backgroundColor: 'rgba(7,13,9,0.74)' },
  authorRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 10 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: '#536258' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  authorName: { color: TEXT, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  time: { color: '#CDD5D0', fontSize: 11.5, fontWeight: '700', marginLeft: 'auto' },
  body: { color: TEXT, fontSize: 20, lineHeight: 27, fontWeight: '900', letterSpacing: -0.2, marginTop: 4, marginBottom: 10 },
  eventStrip: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, backgroundColor: 'rgba(22,32,27,0.94)', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 7 },
  eventIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26342A' },
  eventTitle: { color: TEXT, fontSize: 12.5, fontWeight: '900' },
  eventMeta: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  engagementWrap: { minHeight: 38 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#455249' },
  dotActive: { width: 19, backgroundColor: GOLD },
  emptyCard: { minHeight: 190, borderRadius: 22, backgroundColor: '#151F1A', padding: 18, alignItems: 'flex-start' },
  emptyIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26342A' },
  emptyTitle: { color: TEXT, fontSize: 19, fontWeight: '900', marginTop: 13 },
  emptyCopy: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 420 },
  emptyButton: { borderRadius: 999, backgroundColor: '#253229', paddingHorizontal: 13, paddingVertical: 8, marginTop: 14 },
  emptyButtonText: { color: GOLD, fontSize: 11.5, fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
