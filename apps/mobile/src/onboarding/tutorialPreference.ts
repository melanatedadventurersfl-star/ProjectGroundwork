import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ma-local.db');
const GUEST_PROMPT_KEY = 'guest_tutorial_prompt_seen';
const GUIDED_TUTORIAL_KEY = 'guided_tutorial_completed_v1';
const GUIDED_TUTORIAL_FINISHED_KEY = 'guided_tutorial_finished_v1';
const GUIDED_TUTORIAL_STEP_KEY = 'guided_tutorial_step_v1';

function ensureTable() {
  db.execSync('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
}

function getValue(key: string) {
  ensureTable();
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ? LIMIT 1', key);
  return row?.value ?? null;
}

function setValue(key: string, value: string) {
  ensureTable();
  db.runSync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', key, value);
}

function getFlag(key: string) {
  return getValue(key) === '1';
}

function setFlag(key: string, value: boolean) {
  setValue(key, value ? '1' : '0');
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

export function hasFinishedGuidedTutorial() {
  return getFlag(GUIDED_TUTORIAL_FINISHED_KEY);
}

export function getGuidedTutorialStep() {
  const parsed = Number.parseInt(getValue(GUIDED_TUTORIAL_STEP_KEY) ?? '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function setGuidedTutorialStep(step: number) {
  const safeStep = Math.max(0, Math.floor(step));
  setValue(GUIDED_TUTORIAL_STEP_KEY, String(safeStep));
}

export function markGuidedTutorialCompleted() {
  setFlag(GUIDED_TUTORIAL_KEY, true);
}

export function markGuidedTutorialFinished() {
  setFlag(GUIDED_TUTORIAL_KEY, true);
  setFlag(GUIDED_TUTORIAL_FINISHED_KEY, true);
  setGuidedTutorialStep(6);
}

export function resetGuidedTutorial() {
  setFlag(GUIDED_TUTORIAL_KEY, false);
  setFlag(GUIDED_TUTORIAL_FINISHED_KEY, false);
  setGuidedTutorialStep(0);
}
