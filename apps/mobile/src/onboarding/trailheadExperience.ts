import * as SQLite from 'expo-sqlite';
import { router } from 'expo-router';

import type { TrailheadAction } from './trailheadProgress';

export type TrailheadDestination = {
  action: TrailheadAction;
  title: string;
  route: string;
  tooltip: string;
  matches: (pathname: string) => boolean;
};

export const TRAILHEAD_DESTINATIONS: TrailheadDestination[] = [
  {
    action: 'profile',
    title: 'Complete your profile',
    route: '/member/profile-setup',
    tooltip: 'Trailhead will walk you through the first missing part of your profile.',
    matches: (pathname) => pathname.startsWith('/member/profile-setup'),
  },
  {
    action: 'trail-guide',
    title: 'Explore the Trail Guide',
    route: '/trail-guide',
    tooltip: 'Browse the recommendations and open a place that looks interesting.',
    matches: (pathname) => pathname === '/trail-guide',
  },
  {
    action: 'save-place',
    title: 'Save your first place',
    route: '/trail-guide',
    tooltip: 'Open any place, then tap Save on the place page.',
    matches: (pathname) => pathname === '/trail-guide' || /^\/trail-guide\/[^/]+$/.test(pathname),
  },
  {
    action: 'adventure',
    title: 'Find an adventure',
    route: '/(tabs)/explore',
    tooltip: 'Open an adventure to see its details. That completes this Trailhead step.',
    matches: (pathname) => pathname.includes('/explore') || /^\/adventures\/[^/]+$/.test(pathname),
  },
  {
    action: 'outpost',
    title: 'Visit the Outpost',
    route: '/(tabs)/community',
    tooltip: 'You made it to the Outpost. Browse the community and your Campfires.',
    matches: (pathname) => /\/community\/?$/.test(pathname),
  },
  {
    action: 'ask-go',
    title: 'Ask Go something',
    route: '/trail-guide/ask',
    tooltip: 'Send Go a question or ask it to plan an outdoor day. Sending the message completes this step.',
    matches: (pathname) => pathname.startsWith('/trail-guide/ask'),
  },
];

const db = SQLite.openDatabaseSync('ma-local.db');
const TOOLTIP_KEY = 'trailhead_pending_tooltip_v1';

function ensureTable() {
  db.execSync('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
}

export function getTrailheadDestination(action: TrailheadAction) {
  return TRAILHEAD_DESTINATIONS.find((item) => item.action === action) ?? null;
}

export function setPendingTrailheadTooltip(action: TrailheadAction | null) {
  ensureTable();
  if (!action) {
    db.runSync('DELETE FROM app_preferences WHERE key = ?', TOOLTIP_KEY);
    return;
  }
  db.runSync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', TOOLTIP_KEY, action);
}

export function getPendingTrailheadTooltip() {
  ensureTable();
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ? LIMIT 1', TOOLTIP_KEY);
  const value = row?.value as TrailheadAction | undefined;
  return TRAILHEAD_DESTINATIONS.some((item) => item.action === value) ? value ?? null : null;
}

export function openTrailheadAction(action: TrailheadAction) {
  const destination = getTrailheadDestination(action);
  if (!destination) return;
  // Profile has its own contextual coach flow, so avoid stacking the generic tooltip on top of it.
  setPendingTrailheadTooltip(action === 'profile' ? null : action);
  router.push(destination.route as never);
}
