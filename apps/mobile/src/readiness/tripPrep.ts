import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

type TripPrepAdventure = {
  id: string;
  title: string;
  starts_at: string;
};

const PREP_OFFSETS_HOURS = [48, 24] as const;
const MIN_LEAD_MS = 60_000;

function asAdventure(value: unknown): TripPrepAdventure | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const candidate = row as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string' || typeof candidate.starts_at !== 'string') return null;
  return { id: candidate.id, title: candidate.title, starts_at: candidate.starts_at };
}

async function notificationsGranted() {
  if (Platform.OS === 'web') return false;
  const permission = await Notifications.getPermissionsAsync();
  return permission.status === 'granted';
}

export async function scheduleTripPrepReminders(adventure: TripPrepAdventure) {
  if (!(await notificationsGranted())) return 0;

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of existing) {
    if (notification.content.data?.trip_prep_adventure_id === adventure.id) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  const startsAt = new Date(adventure.starts_at).getTime();
  if (!Number.isFinite(startsAt) || startsAt <= Date.now()) return 0;

  let scheduled = 0;
  for (const hours of PREP_OFFSETS_HOURS) {
    const triggerAt = startsAt - hours * 60 * 60 * 1000;
    if (triggerAt <= Date.now() + MIN_LEAD_MS) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Prepare for offline use',
        body: `${adventure.title} is coming up. Save your event pack, map, updates, and safety essentials before you lose signal.`,
        sound: 'default',
        data: {
          action_url: `/readiness/${adventure.id}`,
          trip_prep_adventure_id: adventure.id,
          trip_prep_hours_before: hours,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerAt),
        ...(Platform.OS === 'android' ? { channelId: 'general' } : {}),
      },
    });
    scheduled += 1;
  }

  return scheduled;
}

export async function refreshTripPrepRemindersForCurrentUser() {
  if (Platform.OS === 'web' || !(await notificationsGranted())) return { adventures: 0, reminders: 0 };

  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError) throw authError;
  const userId = authData.session?.user.id;
  if (!userId) return { adventures: 0, reminders: 0 };

  const [purchasedResult, attendeeResult] = await Promise.all([
    supabase
      .from('orders')
      .select('adventure_id,adventures(id,title,starts_at)')
      .eq('purchaser_id', userId)
      .eq('status', 'paid'),
    supabase
      .from('order_attendees')
      .select('orders!inner(status,adventures(id,title,starts_at))')
      .eq('profile_id', userId)
      .eq('orders.status', 'paid'),
  ]);

  if (purchasedResult.error) throw purchasedResult.error;
  if (attendeeResult.error) throw attendeeResult.error;

  const adventures = new Map<string, TripPrepAdventure>();
  for (const row of purchasedResult.data ?? []) {
    const adventure = asAdventure((row as Record<string, unknown>).adventures);
    if (adventure && new Date(adventure.starts_at).getTime() > Date.now()) adventures.set(adventure.id, adventure);
  }
  for (const row of attendeeResult.data ?? []) {
    const orders = Array.isArray((row as Record<string, unknown>).orders)
      ? ((row as Record<string, unknown>).orders as unknown[])[0]
      : (row as Record<string, unknown>).orders;
    if (!orders || typeof orders !== 'object') continue;
    const adventure = asAdventure((orders as Record<string, unknown>).adventures);
    if (adventure && new Date(adventure.starts_at).getTime() > Date.now()) adventures.set(adventure.id, adventure);
  }

  let reminders = 0;
  for (const adventure of adventures.values()) reminders += await scheduleTripPrepReminders(adventure);
  return { adventures: adventures.size, reminders };
}
