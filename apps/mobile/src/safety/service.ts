import { supabase } from '../lib/supabase';
import { ensureSafetyOwner } from '../offline/safetyOwner';
import {
  addBreadcrumb,
  countPendingOfflineActions as countLocalPendingOfflineActions,
  createOfflineUuid,
  getActiveSafetySession as getLocalActiveSafetySession,
  getBreadcrumbs,
  queueOfflineAction,
  saveSafetySession,
  updateLocalSafetySession,
} from '../offline/safetyStore';
import { flushOfflineQueue } from '../offline/syncQueue';
import type {
  GeoPoint,
  LocalSafetySession,
  SafetyCheckInStatus,
} from '../offline/safetyTypes';

async function currentProfileId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Sign in to use Adventure Safety Mode.');
  const profileId = data.session.user.id;
  await ensureSafetyOwner(profileId);
  return profileId;
}

export async function startSafetySession(input: {
  adventureId: string;
  expectedReturnAt?: string | null;
  safePoint?: Pick<GeoPoint, 'latitude' | 'longitude'> | null;
}) {
  const profileId = await currentProfileId();
  const now = new Date().toISOString();
  const session: LocalSafetySession = {
    id: createOfflineUuid(),
    adventureId: input.adventureId,
    profileId,
    status: 'active',
    startedAt: now,
    expectedReturnAt: input.expectedReturnAt ?? null,
    endedAt: null,
    safePointLatitude: input.safePoint?.latitude ?? null,
    safePointLongitude: input.safePoint?.longitude ?? null,
    lastCheckIn: 'starting',
    lastCheckInAt: now,
  };

  await saveSafetySession(session);
  await queueOfflineAction('safety_session_start', {
    id: session.id,
    adventure_id: session.adventureId,
    profile_id: session.profileId,
    status: session.status,
    started_at: session.startedAt,
    expected_return_at: session.expectedReturnAt,
    safe_point_latitude: session.safePointLatitude,
    safe_point_longitude: session.safePointLongitude,
    last_check_in: session.lastCheckIn,
    last_check_in_at: session.lastCheckInAt,
  }, 2000);

  await queueSafetyCheckIn(session, 'starting', input.safePoint ?? null);
  void flushOfflineQueue();
  return session;
}

export async function markSafePoint(
  session: LocalSafetySession,
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
) {
  await ensureSafetyOwner(session.profileId);
  const next = await updateLocalSafetySession(session, {
    safePointLatitude: point.latitude,
    safePointLongitude: point.longitude,
  });
  await queueOfflineAction('safety_session_update', {
    session_id: next.id,
    patch: {
      safe_point_latitude: next.safePointLatitude,
      safe_point_longitude: next.safePointLongitude,
      updated_at: new Date().toISOString(),
    },
  }, 90);
  void flushOfflineQueue();
  return next;
}

export async function queueSafetyCheckIn(
  session: LocalSafetySession,
  status: SafetyCheckInStatus,
  point?: Pick<GeoPoint, 'latitude' | 'longitude'> | null,
) {
  await ensureSafetyOwner(session.profileId);
  const now = new Date().toISOString();
  const next = await updateLocalSafetySession(session, {
    lastCheckIn: status,
    lastCheckInAt: now,
    status: status === 'back' ? 'completed' : session.status,
    endedAt: status === 'back' ? now : session.endedAt,
  });

  await queueOfflineAction('safety_check_in', {
    id: createOfflineUuid(),
    session_id: next.id,
    adventure_id: next.adventureId,
    profile_id: next.profileId,
    status,
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    recorded_at: now,
  }, status === 'need_help' ? 1000 : 100);

  await queueOfflineAction('safety_session_update', {
    session_id: next.id,
    patch: {
      status: next.status,
      ended_at: next.endedAt,
      last_check_in: status,
      last_check_in_at: now,
      updated_at: now,
    },
  }, status === 'need_help' ? 999 : 95);

  void flushOfflineQueue();
  return next;
}

export async function recordSafetyBreadcrumb(sessionId: string, point: GeoPoint) {
  await addBreadcrumb({
    sessionId,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: point.accuracy,
    recordedAt: point.recordedAt,
  });
}

export async function flushSafetyQueue() {
  await currentProfileId();
  return flushOfflineQueue();
}

export async function getActiveSafetySession(adventureId: string) {
  await currentProfileId();
  return getLocalActiveSafetySession(adventureId);
}

export async function countPendingOfflineActions() {
  await currentProfileId();
  return countLocalPendingOfflineActions();
}

export { getBreadcrumbs };
