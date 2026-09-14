import { listHostFieldSnapshots, getHostFieldSnapshot, saveHostFieldSnapshot } from '../field/store';
import { supabase } from '../lib/supabase';
import { ensureSafetyOwner } from '../offline/safetyOwner';
import {
  createOfflineUuid,
  listPendingOfflineActions,
  queueOfflineAction,
} from '../offline/safetyStore';
import { flushOfflineQueue } from '../offline/syncQueue';
import { getRoster } from '../operations/api';
import type { RosterEntry } from '../operations/types';
import {
  getArrivalDeviceId,
  getLocalArrivalScans,
  saveLocalArrivalScan,
  updateLocalArrivalScan,
} from './store';
import type {
  ArrivalScanMethod,
  ArrivalValidation,
  LocalArrivalScan,
  ServerArrivalScan,
} from './types';

async function currentProfileId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const profileId = data.session?.user.id;
  if (!profileId) throw new Error('Sign in to use Arrival Mode.');
  await ensureSafetyOwner(profileId);
  return profileId;
}

function cleanCode(value: string) {
  return value.trim();
}

export function extractCredentialCode(rawValue: string) {
  const raw = rawValue.trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate = parsed.credential_code ?? parsed.credentialCode ?? parsed.code ?? parsed.ticket;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  } catch {
    // Plain ticket codes and URLs are expected too.
  }

  try {
    const url = new URL(raw);
    const queryCode = url.searchParams.get('credential') ?? url.searchParams.get('code') ?? url.searchParams.get('ticket');
    if (queryCode) return queryCode.trim();
    const lastSegment = url.pathname.split('/').filter(Boolean).at(-1);
    if (lastSegment) return decodeURIComponent(lastSegment).trim();
  } catch {
    // Not a URL. Treat the complete value as the credential.
  }

  return raw;
}

function findCredential(roster: RosterEntry[], code: string) {
  const normalized = cleanCode(code);
  return roster.find((entry) => entry.credential_code && cleanCode(entry.credential_code) === normalized) ?? null;
}

export async function validateCredentialOffline(adventureId: string, rawValue: string): Promise<ArrivalValidation> {
  await currentProfileId();
  const code = extractCredentialCode(rawValue);
  if (!code) return { status: 'invalid_ticket', attendee: null };

  const snapshot = await getHostFieldSnapshot(adventureId);
  if (!snapshot) throw new Error('Download the field roster before scanning tickets offline.');

  const attendee = findCredential(snapshot.roster, code);
  if (attendee) {
    const localScans = await getLocalArrivalScans(adventureId);
    const alreadyLocal = localScans.some((scan) => scan.attendeeId === attendee.attendee_id);
    if (attendee.checked_in_at || alreadyLocal) return { status: 'already_checked_in', attendee };
    return { status: 'valid', attendee };
  }

  const snapshots = await listHostFieldSnapshots();
  const other = snapshots.find((item) => item.adventureId !== adventureId && findCredential(item.roster, code));
  if (other) return { status: 'wrong_event', attendee: null, otherAdventureId: other.adventureId };
  return { status: 'invalid_ticket', attendee: null };
}

export async function queueArrivalCheckIn(input: {
  adventureId: string;
  attendee: RosterEntry;
  method: ArrivalScanMethod;
  credentialCode?: string | null;
}) {
  await currentProfileId();
  const snapshot = await getHostFieldSnapshot(input.adventureId);
  if (!snapshot) throw new Error('Download the field roster before checking people in offline.');

  const existingScans = await getLocalArrivalScans(input.adventureId);
  const prior = existingScans.find((scan) => scan.attendeeId === input.attendee.attendee_id);
  if (input.attendee.checked_in_at || prior) {
    return { scan: prior ?? null, snapshot, alreadyCheckedIn: true };
  }

  const deviceId = await getArrivalDeviceId();
  const scan: LocalArrivalScan = {
    id: createOfflineUuid(),
    adventureId: input.adventureId,
    attendeeId: input.attendee.attendee_id,
    attendeeName: `${input.attendee.first_name} ${input.attendee.last_name}`.trim(),
    method: input.method,
    credentialCode: input.credentialCode ? cleanCode(input.credentialCode) : null,
    deviceId,
    scannedAt: new Date().toISOString(),
    reconciliationStatus: 'pending',
    duplicateCount: 0,
    lastError: null,
  };

  await saveLocalArrivalScan(scan);
  await queueOfflineAction('arrival_scan', {
    scan_id: scan.id,
    adventure_id: scan.adventureId,
    attendee_id: scan.attendeeId,
    device_id: scan.deviceId,
    scanned_at: scan.scannedAt,
    scan_method: scan.method,
    credential_code: scan.credentialCode,
  }, 80);

  const roster = snapshot.roster.map((entry) => entry.attendee_id === scan.attendeeId
    ? {
        ...entry,
        checked_in_at: scan.scannedAt,
        check_in_method: scan.method,
      }
    : entry);
  const nextSnapshot = { ...snapshot, roster, savedAt: new Date().toISOString() };
  await saveHostFieldSnapshot(nextSnapshot);

  void flushOfflineQueue();
  return { scan, snapshot: nextSnapshot, alreadyCheckedIn: false };
}

export async function countPendingArrivalActions(adventureId: string) {
  await currentProfileId();
  const actions = await listPendingOfflineActions(150);
  return actions.filter((action) => {
    if (action.kind !== 'arrival_scan') return false;
    try {
      const payload = JSON.parse(action.payload) as { adventure_id?: string };
      return payload.adventure_id === adventureId;
    } catch {
      return false;
    }
  }).length;
}

async function mergeServerScans(adventureId: string, serverScans: ServerArrivalScan[]) {
  const snapshot = await getHostFieldSnapshot(adventureId);
  const localBefore = await getLocalArrivalScans(adventureId);
  const localById = new Map(localBefore.map((scan) => [scan.id, scan]));

  for (const server of serverScans) {
    const existing = localById.get(server.id);
    if (existing) {
      await updateLocalArrivalScan(server.id, {
        reconciliationStatus: server.reconciliation_status,
        lastError: null,
      });
      continue;
    }
    const attendee = snapshot?.roster.find((entry) => entry.attendee_id === server.attendee_id);
    const scan: LocalArrivalScan = {
      id: server.id,
      adventureId: server.adventure_id,
      attendeeId: server.attendee_id,
      attendeeName: attendee ? `${attendee.first_name} ${attendee.last_name}`.trim() : 'Attendee',
      method: server.scan_method,
      credentialCode: null,
      deviceId: server.device_id,
      scannedAt: server.scanned_at,
      reconciliationStatus: server.reconciliation_status,
      duplicateCount: 0,
      lastError: null,
    };
    await saveLocalArrivalScan(scan);
    localById.set(scan.id, scan);
  }

  const all = await getLocalArrivalScans(adventureId);
  const counts = new Map<string, number>();
  all.filter((scan) => scan.reconciliationStatus === 'valid' || scan.reconciliationStatus === 'duplicate')
    .forEach((scan) => counts.set(scan.attendeeId, (counts.get(scan.attendeeId) ?? 0) + 1));
  for (const scan of all) {
    const duplicateCount = Math.max((counts.get(scan.attendeeId) ?? 1) - 1, 0);
    if (scan.duplicateCount !== duplicateCount) await updateLocalArrivalScan(scan.id, { duplicateCount });
  }
}

export async function syncArrivalChanges(adventureId: string) {
  await currentProfileId();
  const sync = await flushOfflineQueue();
  let lastError = sync.lastError;

  try {
    const { data, error } = await supabase
      .from('adventure_arrival_scans')
      .select('id,adventure_id,attendee_id,device_id,scan_method,scanned_at,reconciliation_status')
      .eq('adventure_id', adventureId)
      .order('scanned_at', { ascending: false });
    if (error) throw error;
    await mergeServerScans(adventureId, (data ?? []) as ServerArrivalScan[]);

    const roster = await getRoster(adventureId);
    const snapshot = await getHostFieldSnapshot(adventureId);
    if (snapshot) {
      await saveHostFieldSnapshot({
        ...snapshot,
        roster: roster.map((entry) => ({ ...entry, email: null })),
        savedAt: new Date().toISOString(),
      });
    }
    lastError = null;
  } catch (caught) {
    if (!lastError) lastError = caught instanceof Error ? caught.message : 'Arrival reconciliation is unavailable.';
  }

  return {
    synced: sync.synced,
    pending: await countPendingArrivalActions(adventureId),
    lastError,
    scans: await getLocalArrivalScans(adventureId),
    snapshot: await getHostFieldSnapshot(adventureId),
  };
}

export async function getArrivalState(adventureId: string) {
  await currentProfileId();
  return {
    snapshot: await getHostFieldSnapshot(adventureId),
    scans: await getLocalArrivalScans(adventureId),
    pending: await countPendingArrivalActions(adventureId),
  };
}
