import * as SQLite from 'expo-sqlite';

export type GoMode = 'nature' | 'night';
const db = SQLite.openDatabaseSync('ma-local.db');
const key = (userId: string) => `go_mode_v1:${userId}`;
function ensureTable() {
  db.execSync('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
}
export function getGoMode(userId: string): GoMode {
  if (!userId) return 'nature';
  try {
    ensureTable();
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ?', key(userId));
    return row?.value === 'night' ? 'night' : 'nature';
  } catch { return 'nature'; }
}
export function setGoMode(userId: string, mode: GoMode) {
  if (!userId) return;
  ensureTable();
  db.runSync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', key(userId), mode);
  notify(userId, mode);
}
type Listener = (userId: string, mode: GoMode) => void;
const listeners = new Set<Listener>();
function notify(userId: string, mode: GoMode) { listeners.forEach(listener => listener(userId, mode)); }
export function subscribeGoMode(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
