import { getAdventure } from '../adventures/api';
import { getRoster, getSchedule } from '../operations/api';
import { supabase } from '../lib/supabase';
import { getEventPack, removeEventPack, saveEventPack } from './safetyStore';
import type { OfflineAnnouncement, OfflineEventPack } from './safetyTypes';

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
  const adventure = await getAdventure(adventureId);
  const [schedule, announcements, roster] = await Promise.all([
    getSchedule(adventureId).catch(() => []),
    getAnnouncements(adventureId).catch(() => []),
    getRoster(adventureId).catch(() => []),
  ]);
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

export { getEventPack, removeEventPack };

export function isEventPackStale(pack: OfflineEventPack, maxAgeHours = 24) {
  const age = Date.now() - new Date(pack.downloadedAt).getTime();
  return age > maxAgeHours * 60 * 60 * 1000;
}