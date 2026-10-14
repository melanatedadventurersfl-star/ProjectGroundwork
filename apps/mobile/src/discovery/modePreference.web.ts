export type GoMode = 'nature' | 'night';
const key = (userId: string) => `go_mode_v1:${userId}`;
export function getGoMode(userId: string): GoMode {
  if (!userId || typeof localStorage === 'undefined') return 'nature';
  try { return localStorage.getItem(key(userId)) === 'night' ? 'night' : 'nature'; }
  catch { return 'nature'; }
}
type Listener = (userId: string, mode: GoMode) => void;
const listeners = new Set<Listener>();
export function setGoMode(userId: string, mode: GoMode) {
  if (!userId) return;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key(userId), mode); }
  catch { /* Mode still changes in the current app session. */ }
  listeners.forEach(listener => listener(userId, mode));
}
export function subscribeGoMode(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
