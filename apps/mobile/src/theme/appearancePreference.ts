import * as SQLite from 'expo-sqlite';

export type AppearancePreference = 'auto' | 'day' | 'dark';
export type ResolvedAppearance = 'day' | 'dark';

const db = SQLite.openDatabaseSync('ma-local.db');
const key = (userId: string) => `go_appearance_v1:${userId || 'guest'}`;
const overrides = new Map<string, AppearancePreference>();
type Listener = (userId: string, value: AppearancePreference) => void;
const listeners = new Set<Listener>();

function ensureTable() {
  db.execSync('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
}

function valid(value: unknown): value is AppearancePreference {
  return value === 'auto' || value === 'day' || value === 'dark';
}

export function getAppearancePreference(userId: string): AppearancePreference {
  if (overrides.has(userId)) return overrides.get(userId)!;
  try {
    ensureTable();
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ?', key(userId));
    return valid(row?.value) ? row.value : 'auto';
  } catch {
    return 'auto';
  }
}

export function setAppearancePreference(userId: string, preference: AppearancePreference) {
  overrides.set(userId, preference);
  try {
    ensureTable();
    db.runSync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', key(userId), preference);
  } catch { /* Keep the selected theme for this session if storage is unavailable. */ }
  listeners.forEach(listener => listener(userId, preference));
}

export function subscribeAppearance(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Automatic appearance follows device-local hours. It is independent of the
// Nature/Nights experience and does not request GPS or change saved content.
export function resolveAppearance(preference: AppearancePreference, now = new Date()): ResolvedAppearance {
  if (preference !== 'auto') return preference;
  const hour = now.getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'dark';
}
