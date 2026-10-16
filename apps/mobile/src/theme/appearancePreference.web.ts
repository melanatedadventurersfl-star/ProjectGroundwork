export type AppearancePreference = 'auto' | 'day' | 'dark';
export type ResolvedAppearance = 'day' | 'dark';

const key = (userId: string) => `go_appearance_v1:${userId || 'guest'}`;
const sessionValues = new Map<string, AppearancePreference>();
type Listener = (userId: string, value: AppearancePreference) => void;
const listeners = new Set<Listener>();
function valid(value: unknown): value is AppearancePreference {
  return value === 'auto' || value === 'day' || value === 'dark';
}

export function getAppearancePreference(userId: string): AppearancePreference {
  if (sessionValues.has(userId)) return sessionValues.get(userId)!;
  try {
    const value = typeof window !== 'undefined' ? window.localStorage.getItem(key(userId)) : null;
    return valid(value) ? value : 'auto';
  } catch { return 'auto'; }
}

export function setAppearancePreference(userId: string, preference: AppearancePreference) {
  sessionValues.set(userId, preference);
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key(userId), preference);
  } catch { /* Keep the choice active in this tab if storage is blocked. */ }
  listeners.forEach(listener => listener(userId, preference));
}

export function subscribeAppearance(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resolveAppearance(preference: AppearancePreference, now = new Date()): ResolvedAppearance {
  if (preference !== 'auto') return preference;
  const hour = now.getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'dark';
}
