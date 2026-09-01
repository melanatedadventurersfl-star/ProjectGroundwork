const KEY = 'whats_new_last_seen_release';

export function hasSeenRelease(releaseId: string) {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KEY) === releaseId;
}

export function markReleaseSeen(releaseId: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, releaseId);
}
