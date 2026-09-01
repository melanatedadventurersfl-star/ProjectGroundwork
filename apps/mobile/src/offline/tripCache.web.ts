import type { MemberTrip } from '../member/api';

const KEY = 'go_melanated_member_trips_cache';

type CachedTrips = { trips: MemberTrip[]; savedAt: string };

export async function saveTripsOffline(trips: MemberTrip[]) {
  if (typeof localStorage === 'undefined') return;
  const value: CachedTrips = { trips, savedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(value));
}

export async function getOfflineTrips(): Promise<CachedTrips | null> {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedTrips;
    return Array.isArray(parsed.trips) && typeof parsed.savedAt === 'string' ? parsed : null;
  } catch {
    return null;
  }
}
