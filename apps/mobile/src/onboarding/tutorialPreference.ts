import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ma-local.db');
const KEY = 'guest_tutorial_prompt_seen';

function ensureTable() {
  db.execSync('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
}

export function hasSeenGuestTutorialPrompt() {
  ensureTable();
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ? LIMIT 1', KEY);
  return row?.value === '1';
}

export function markGuestTutorialPromptSeen() {
  ensureTable();
  db.runSync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', KEY, '1');
}
