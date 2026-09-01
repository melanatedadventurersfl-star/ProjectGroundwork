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

const MASK_KEY = 'trailhead_action_mask_v1';

function readMask() {
  if (typeof localStorage === 'undefined') return 0;
  const parsed = Number.parseInt(localStorage.getItem(MASK_KEY) ?? '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function writeMask(mask: number) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(MASK_KEY, String(mask));
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
