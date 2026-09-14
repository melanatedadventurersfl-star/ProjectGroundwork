import { updateLocalArrivalScan } from '../arrival/store';
import { supabase } from '../lib/supabase';
import {
  completeOfflineAction,
  countPendingOfflineActions,
  failOfflineAction,
  listPendingOfflineActions,
} from './safetyStore';

export type OfflineSyncResult = {
  synced: number;
  pending: number;
  lastError: string | null;
};

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
    return;
  }

  if (action.kind === 'arrival_scan') {
    const scanId = String(payload.scan_id ?? '');
    const { data, error } = await supabase.rpc('sync_adventure_arrival_scan', {
      p_scan_id: scanId,
      p_adventure_id: String(payload.adventure_id ?? ''),
      p_attendee_id: String(payload.attendee_id ?? ''),
      p_device_id: String(payload.device_id ?? ''),
      p_scanned_at: String(payload.scanned_at ?? ''),
      p_scan_method: String(payload.scan_method ?? ''),
      p_credential_code: payload.credential_code ? String(payload.credential_code) : null,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (scanId && result) {
      await updateLocalArrivalScan(scanId, {
        reconciliationStatus: result.scan_status === 'duplicate' ? 'duplicate' : 'valid',
        duplicateCount: Number(result.duplicate_count ?? 0),
        lastError: null,
      });
    }
    return;
  }

  if (action.kind === 'field_check_in') {
    const { error } = await supabase
      .from('adventure_check_ins')
      .upsert(payload, { onConflict: 'adventure_id,attendee_id' });
    if (error) throw error;
    return;
  }

  if (action.kind === 'field_headcount') {
    const { error } = await supabase.from('adventure_headcounts').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  if (action.kind === 'field_incident') {
    const { error } = await supabase.from('adventure_incidents').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  if (action.kind === 'field_host_message') {
    const { error } = await supabase.from('host_outing_messages').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  throw new Error(`Unsupported offline action: ${action.kind}`);
}

let flushPromise: Promise<OfflineSyncResult> | null = null;

export async function flushOfflineQueue(): Promise<OfflineSyncResult> {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) throw new Error('Sign in to sync offline changes.');

    let synced = 0;
    let lastError: string | null = null;
    const actions = await listPendingOfflineActions(100);

    for (const action of actions) {
      try {
        await syncAction(action);
        await completeOfflineAction(action.id);
        synced += 1;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Sync failed.';
        lastError = message;
        if (action.kind === 'arrival_scan') {
          try {
            const payload = JSON.parse(action.payload) as { scan_id?: string };
            if (payload.scan_id) await updateLocalArrivalScan(payload.scan_id, { reconciliationStatus: 'failed', lastError: message });
          } catch {
            // Keep the queue failure as the source of truth if the local scan cannot be updated.
          }
        }
        await failOfflineAction(action.id, message);
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
