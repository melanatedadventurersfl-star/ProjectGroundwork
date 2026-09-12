import Storage from 'expo-sqlite/kv-store';

import type { CommunityPost } from './api';

const STORAGE_PREFIX = 'go-melanated:campfire-deck:v1:';
const RESUME_WINDOW_MS = 4 * 60 * 60 * 1000;

export type CampfireSeenSnapshot = {
  seenAt: number;
  reactionCount: number;
  commentCount: number;
};

export type CampfireDeckState = {
  dayKey: string;
  currentPostId: string | null;
  positionUpdatedAt: number;
  caughtUp: boolean;
  seen: Record<string, CampfireSeenSnapshot>;
};

let sessionSeenPostIds = new Set<string>();

function dayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function freshState(): CampfireDeckState {
  return {
    dayKey: dayKey(),
    currentPostId: null,
    positionUpdatedAt: 0,
    caughtUp: false,
    seen: {},
  };
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function normalizeState(value: unknown): CampfireDeckState {
  if (!value || typeof value !== 'object') return freshState();
  const candidate = value as Partial<CampfireDeckState>;
  if (candidate.dayKey !== dayKey()) return freshState();
  return {
    dayKey: candidate.dayKey,
    currentPostId: typeof candidate.currentPostId === 'string' ? candidate.currentPostId : null,
    positionUpdatedAt: typeof candidate.positionUpdatedAt === 'number' ? candidate.positionUpdatedAt : 0,
    caughtUp: candidate.caughtUp === true,
    seen: candidate.seen && typeof candidate.seen === 'object' ? candidate.seen : {},
  };
}

export async function loadCampfireDeckState(userId: string | null): Promise<CampfireDeckState> {
  if (!userId) {
    const state = freshState();
    sessionSeenPostIds = new Set();
    return state;
  }

  try {
    const raw = await Storage.getItem(storageKey(userId));
    const state = normalizeState(raw ? JSON.parse(raw) : null);
    sessionSeenPostIds = new Set(Object.keys(state.seen));
    return state;
  } catch {
    const state = freshState();
    sessionSeenPostIds = new Set();
    return state;
  }
}

export async function saveCampfireDeckState(userId: string | null, state: CampfireDeckState) {
  if (!userId) return;
  try {
    await Storage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // The deck still works in memory if local persistence is unavailable.
  }
}

export function markCampfirePostSeen(state: CampfireDeckState, post: CommunityPost, now = Date.now()): CampfireDeckState {
  sessionSeenPostIds.add(post.id);
  return {
    ...state,
    seen: {
      ...state.seen,
      [post.id]: {
        seenAt: now,
        reactionCount: post.reaction_count || 0,
        commentCount: post.comment_count || 0,
      },
    },
  };
}

export function updateCampfirePosition(state: CampfireDeckState, currentPostId: string | null, caughtUp: boolean, now = Date.now()): CampfireDeckState {
  return {
    ...state,
    currentPostId,
    caughtUp,
    positionUpdatedAt: now,
  };
}

export function campfirePostHasFreshActivity(state: CampfireDeckState, post: CommunityPost) {
  const snapshot = state.seen[post.id];
  if (!snapshot) return true;
  return (post.comment_count || 0) > snapshot.commentCount || (post.reaction_count || 0) > snapshot.reactionCount;
}

export function shouldResumeCampfirePosition(state: CampfireDeckState, now = Date.now()) {
  return Boolean(state.currentPostId && now - state.positionUpdatedAt <= RESUME_WINDOW_MS);
}

export function getSessionSeenCampfirePostIds() {
  return sessionSeenPostIds;
}
