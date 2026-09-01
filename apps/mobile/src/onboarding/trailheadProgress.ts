import * as SQLite from 'expo-sqlite';

export type TrailheadAction =
  | 'profile'
  | 'trail-guide'
  | 'save-place'
  | 'adventure'
  | 'outpost'
  | 'ask-go';

export const TRAILHEAD_ACTIONS: TrailheadAction[] = [
  'profile',
  'trail-guide',
  'save-place',
  'adventure',
  'outpost',
  'ask-go',
];

const db = SQLite.openDatabaseSync('ma-local.db');
const MASK_KEY = 'trailhead_action_mask_v1';

function ensureTable() {
  db.execSync('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
}

function readMask() {
  ensureTable();
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ? LIMIT 1', MASK_KEY);
  const parsed = Number.parseInt(row?.value ?? '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function writeMask(mask: number) {
  ensureTable();
  db.runSync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', MASK_KEY, String(mask));
}

export function markTrailheadAction(action: TrailheadAction) {
  const index = TRAILHEAD_ACTIONS.indexOf(action);
  if (index < 0) return;
  writeMask(readMask() | (1 << index));
}

export function getTrailheadProgress() {
  const mask = readMask();
  const completed = TRAILHEAD_ACTIONS.map((action, index) => ({ action, complete: Boolean(mask & (1 << index)) }));
  return {
    mask,
    completed,
    count: completed.filter((item) => item.complete).length,
    allComplete: completed.every((item) => item.complete),
    nextAction: completed.find((item) => !item.complete)?.action ?? null,
  };
}

export function resetTrailheadProgress() {
  writeMask(0);
}
