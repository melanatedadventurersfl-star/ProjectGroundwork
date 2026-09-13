import { supabase } from '../lib/supabase';
import {
  addBreadcrumb,
  completeOfflineAction,
  countPendingOfflineActions,
  createOfflineUuid,
  failOfflineAction,
  getActiveSafetySession,
  getBreadcrumbs,
  listPendingOfflineActions,
  queueOfflineAction,
  saveSafetySession,
  updateLocalSafetySession,
} from '../offline/safetyStore';
import type {
  GeoPoint,
  LocalSafetySession,
  SafetyCheckInStatus,
} from '../offline/safetyTypes';

export type SafetySyncResult = {
  synced: number;
  pending: number;
  lastError: string | null;
};

async function currentProfileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to use Adventure Safety Mode.');
  return data.user.id;
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
  }, 100);

  await queueSafetyCheckIn(session, 'starting', input.safePoint ?? null);
  void flushSafetyQueue();
  return session;
}

export async function markSafePoint(
  session: LocalSafetySession,
  point: Pick<GeoPoint, 'latitude' | 'longitude'>,
) {
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
  void flushSafetyQueue();
  return next;
}

export async function queueSafetyCheckIn(
  session: LocalSafetySession,
  status: SafetyCheckInStatus,
  point?: Pick<GeoPoint, 'latitude' | 'longitude'> | null,
) {
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

  void flushSafetyQueue();
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

async function syncAction(action: Awaited<ReturnType<typeof listPendingOfflineActions>>[number]) {
  const payload = JSON.parse(action.payload) as Record<string, unknown>;

  if (action.kind === 'safety_session_start') {
    const { error } = await supabase.from('adventure_safety_sessions').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  if (action.kind === 'safety_session_update') {
    const sessionId = String(payload.session_id ?? '');
    const patch = payload.patch as Record<string, unknown> | undefined;
    if (!sessionId || !patch) throw new Error('Invalid queued safety session update.');
    const { error } = await supabase.from('adventure_safety_sessions').update(patch).eq('id', sessionId);
    if (error) throw error;
    return;
  }

  if (action.kind === 'safety_check_in') {
    const { error } = await supabase.from('adventure_safety_check_ins').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }
}

let flushPromise: Promise<SafetySyncResult> | null = null;

export async function flushSafetyQueue(): Promise<SafetySyncResult> {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    let synced = 0;
    let lastError: string | null = null;
    const actions = await listPendingOfflineActions();

    for (const action of actions) {
      try {
        await syncAction(action);
        await completeOfflineAction(action.id);
        synced += 1;
      } catch (caught) {
        lastError = caught instanceof Error ? caught.message : 'Sync failed.';
        await failOfflineAction(action.id, lastError);
        break;
      }
    }

    return {
      synced,
      pending: await countPendingOfflineActions(),
      lastError,
    };
  })();

  try {
    return await flushPromise;
  } finally {
    flushPromise = null;
  }
}

export { countPendingOfflineActions, getActiveSafetySession, getBreadcrumbs };