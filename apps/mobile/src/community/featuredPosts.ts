import type { LocalEvent } from '../local-events/api';
import type { CommunityGroup, CommunityPost } from './api';
import { getSessionSeenCampfirePostIds } from './campfireDeckState';

export type OutpostFeedFilter = 'for-you' | 'latest' | 'nearby';

export type FeaturedPostContext = {
  joinedGroupIds: Set<string>;
  nearbyGroupIds: Set<string>;
  trailmateIds: Set<string>;
  nearbyTrailmateIds: Set<string>;
  eventIds: Set<string>;
  now?: number;
};

export type FeaturedPostKind = 'media' | 'text' | 'community' | 'outing' | 'video';

function metadataString(post: CommunityPost, keys: string[]) {
  for (const key of keys) {
    const value = post.metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function linkedEventId(post: CommunityPost, eventIds?: Set<string>) {
  const id = metadataString(post, ['local_event_id', 'event_id', 'outing_id']);
  if (!id) return null;
  return eventIds && !eventIds.has(id) ? null : id;
}

export function featuredPostKind(post: CommunityPost, group?: CommunityGroup, event?: LocalEvent | null): FeaturedPostKind {
  if (event) return 'outing';
  if (post.media_type === 'video') return 'video';
  if (post.image_url || post.media_type === 'image') return 'media';
  if (group) return 'community';
  return 'text';
}

function recencyPoints(post: CommunityPost, now: number) {
  const ageMs = Math.max(0, now - new Date(post.created_at).getTime());
  const hours = ageMs / 3_600_000;
  if (hours <= 24) return 10;
  if (hours <= 72) return 5;
  if (hours <= 168) return 2;
  return 0;
}

function relevanceScore(post: CommunityPost, context: FeaturedPostContext) {
  let score = 0;
  if (post.group_id && context.nearbyGroupIds.has(post.group_id)) score += 30;
  if (post.group_id && context.joinedGroupIds.has(post.group_id)) score += 25;
  if (context.trailmateIds.has(post.author_id)) score += 20;
  if (post.image_url || post.media_type === 'image') score += 15;
  if (linkedEventId(post, context.eventIds)) score += 15;
  score += Math.min(10, Math.max(0, (post.reaction_count || 0) + (post.comment_count || 0) * 2));
  score += recencyPoints(post, context.now ?? Date.now());
  return score;
}

function isNearby(post: CommunityPost, context: FeaturedPostContext) {
  return Boolean((post.group_id && context.nearbyGroupIds.has(post.group_id)) || context.nearbyTrailmateIds.has(post.author_id));
}

export function postsForFilter(posts: CommunityPost[], filter: OutpostFeedFilter, context: FeaturedPostContext) {
  const latest = posts.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (filter === 'latest') return latest;
  if (filter === 'nearby') return latest.filter((post) => isNearby(post, context));
  return latest.sort((a, b) => {
    const scoreDiff = relevanceScore(b, context) - relevanceScore(a, context);
    return scoreDiff || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function selectFeaturedPosts(posts: CommunityPost[], filter: OutpostFeedFilter, context: FeaturedPostContext, limit = 8) {
  return postsForFilter(posts, filter, context).slice(0, Math.max(1, limit));
}

export function selectSecondaryFeed(posts: CommunityPost[], featured: CommunityPost[], filter: OutpostFeedFilter, context: FeaturedPostContext, limit = 6) {
  const ordered = postsForFilter(posts, filter, context);
  const featuredIds = new Set(featured.map((post) => post.id));
  const seenIds = getSessionSeenCampfirePostIds();
  const seenFeatured = ordered.filter((post) => featuredIds.has(post.id) && seenIds.has(post.id));
  const remaining = ordered.filter((post) => !featuredIds.has(post.id));
  const combined = [...seenFeatured, ...remaining];
  return (combined.length ? combined : ordered).slice(0, Math.max(1, limit));
}
