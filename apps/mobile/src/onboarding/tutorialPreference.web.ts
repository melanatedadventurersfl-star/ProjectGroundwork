const GUEST_PROMPT_KEY = 'guest_tutorial_prompt_seen';
const GUIDED_TUTORIAL_KEY = 'guided_tutorial_completed_v1';
const GUIDED_TUTORIAL_FINISHED_KEY = 'guided_tutorial_finished_v1';
const GUIDED_TUTORIAL_STEP_KEY = 'guided_tutorial_step_v1';

function getValue(key: string) {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

function setValue(key: string, value: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
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
