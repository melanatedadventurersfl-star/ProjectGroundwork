import { getAdventure } from '../adventures/api';
import { supabase } from '../lib/supabase';
import { getRoster, getSchedule } from '../operations/api';
import { ensureSafetyOwner } from './safetyOwner';
import {
  getEventPack as getStoredEventPack,
  removeEventPack as removeStoredEventPack,
  saveEventPack,
} from './safetyStore';
import type { OfflineAnnouncement, OfflineEventPack } from './safetyTypes';

async function ensureCurrentOwner() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const profileId = data.session?.user.id;
  if (!profileId) return null;
  await ensureSafetyOwner(profileId);
  return profileId;
}

async function getAnnouncements(adventureId: string): Promise<OfflineAnnouncement[]> {
  const now = Date.now();
  const { data, error } = await supabase
    .from('announcements')
    .select('id,title,body,priority,starts_at,expires_at')
    .eq('adventure_id', adventureId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((item) => !item.expires_at || new Date(item.expires_at).getTime() > now) as OfflineAnnouncement[];
}

export async function downloadEventPack(adventureId: string): Promise<OfflineEventPack> {
  const profileId = await ensureCurrentOwner();
  if (!profileId) throw new Error('Sign in to download this event for offline use.');

  const adventure = await getAdventure(adventureId);
  const [schedule, announcements, rosterResult] = await Promise.all([
    getSchedule(adventureId).catch(() => []),
    getAnnouncements(adventureId).catch(() => []),
    getRoster(adventureId).catch(() => []),
  ]);
  const roster = rosterResult.map((person) => ({ ...person, email: null }));
  const pack: OfflineEventPack = {
    version: 1,
    adventure,
    schedule,
    announcements,
    roster,
    downloadedAt: new Date().toISOString(),
  };
  await saveEventPack(pack);
  return pack;
}

export async function getEventPack(adventureId: string) {
  const profileId = await ensureCurrentOwner();
  if (!profileId) return null;
  return getStoredEventPack(adventureId);
}

export async function removeEventPack(adventureId: string) {
  const profileId = await ensureCurrentOwner();
  if (!profileId) return;
  await removeStoredEventPack(adventureId);
}

export function isEventPackStale(pack: OfflineEventPack, maxAgeHours = 24) {
  const age = Date.now() - new Date(pack.downloadedAt).getTime();
  return age > maxAgeHours * 60 * 60 * 1000;
}
