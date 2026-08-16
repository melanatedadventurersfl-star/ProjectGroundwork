import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ma-local.db');
const GUEST_PROMPT_KEY = 'guest_tutorial_prompt_seen';
const GUIDED_TUTORIAL_KEY = 'guided_tutorial_completed_v1';

function ensureTable() {
  db.execSync('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
}

function getFlag(key: string) {
  ensureTable();
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ? LIMIT 1', key);
  return row?.value === '1';
}

function setFlag(key: string, value: boolean) {
  ensureTable();
  db.runSync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', key, value ? '1' : '0');
}

export function hasSeenGuestTutorialPrompt() {
  return getFlag(GUEST_PROMPT_KEY);
}

export function markGuestTutorialPromptSeen() {
  setFlag(GUEST_PROMPT_KEY, true);
}

export function hasCompletedGuidedTutorial() {
  return getFlag(GUIDED_TUTORIAL_KEY);
}

export function markGuidedTutorialCompleted() {
  setFlag(GUIDED_TUTORIAL_KEY, true);
}

export function resetGuidedTutorial() {
  setFlag(GUIDED_TUTORIAL_KEY, false);
}
