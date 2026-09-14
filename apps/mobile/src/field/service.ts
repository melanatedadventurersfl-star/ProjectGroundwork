import { listHostMessages, type HostMessageAudience } from '../hosting/communications';
import { supabase } from '../lib/supabase';
import { ensureSafetyOwner } from '../offline/safetyOwner';
import {
  countPendingOfflineActions,
  createOfflineUuid,
  listPendingOfflineActions,
  queueOfflineAction,
} from '../offline/safetyStore';
import { flushOfflineQueue } from '../offline/syncQueue';
import type { OfflineHostMessage } from '../offline/safetyTypes';
import { getHeadcounts, getIncidents, getRoster, getSchedule } from '../operations/api';
import type { IncidentSeverity, RosterEntry } from '../operations/types';
import { getHostFieldSnapshot, saveHostFieldSnapshot } from './store';
import type { HostFieldSnapshot } from './types';

async function currentProfileId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const profileId = data.session?.user.id;
  if (!profileId) throw new Error('Sign in to use Host Field Mode.');
  await ensureSafetyOwner(profileId);
  return profileId;
}

function asOfflineMessages(rows: Awaited<ReturnType<typeof listHostMessages>>): OfflineHostMessage[] {
  return rows.map((row) => ({
    id: String(row.id),
    audience: row.audience as HostMessageAudience,
    subject: String(row.subject),
    body: String(row.body),
    sent_at: String(row.sent_at),
    delivery_status: 'sent',
  }));
}

export async function refreshHostFieldSnapshot(adventureId: string): Promise<HostFieldSnapshot> {
  await currentProfileId();
  const [rosterRows, schedule, headcounts, incidents, messages] = await Promise.all([
    getRoster(adventureId),
    getSchedule(adventureId),
    getHeadcounts(adventureId),
    getIncidents(adventureId),
    listHostMessages(adventureId),
  ]);

  const roster = rosterRows.map((entry) => ({ ...entry, email: null }));
  const snapshot: HostFieldSnapshot = {
    adventureId,
    roster,
    schedule,
    headcounts,
    incidents,
    messages: asOfflineMessages(messages),
    savedAt: new Date().toISOString(),
  };
  await saveHostFieldSnapshot(snapshot);
  return snapshot;
}

export async function getCachedHostFieldSnapshot(adventureId: string) {
  await currentProfileId();
  return getHostFieldSnapshot(adventureId);
}

async function requireSnapshot(adventureId: string) {
  const snapshot = await getHostFieldSnapshot(adventureId);
  if (!snapshot) throw new Error('Download field data before making offline changes.');
  return snapshot;
}

async function saveOptimistic(snapshot: HostFieldSnapshot) {
  const next = { ...snapshot, savedAt: new Date().toISOString() };
  await saveHostFieldSnapshot(next);
  return next;
}

export async function queueFieldCheckIn(adventureId: string, attendee: RosterEntry) {
  const profileId = await currentProfileId();
  const snapshot = await requireSnapshot(adventureId);
  const recordedAt = new Date().toISOString();
  const nextRoster = snapshot.roster.map((entry) => entry.attendee_id === attendee.attendee_id
    ? { ...entry, checked_in_at: recordedAt, check_in_method: 'offline_sync' as const }
    : entry);

  await queueOfflineAction('field_check_in', {
    adventure_id: adventureId,
    attendee_id: attendee.attendee_id,
    checked_in_by: profileId,
    method: 'offline_sync',
    credential_code: attendee.credential_code ?? null,
    offline_recorded_at: recordedAt,
  }, 55);

  const next = await saveOptimistic({ ...snapshot, roster: nextRoster });
  void flushOfflineQueue();
  return next;
}

export async function queueFieldHeadcount(adventureId: string, actualCount: number, expectedCount: number, notes?: string) {
  const profileId = await currentProfileId();
  const snapshot = await requireSnapshot(adventureId);
  const id = createOfflineUuid();
  const recordedAt = new Date().toISOString();
  const record = {
    id,
    label: 'Field headcount',
    expected_count: expectedCount,
    actual_count: actualCount,
    recorded_at: recordedAt,
    notes: notes?.trim() || null,
  };

  await queueOfflineAction('field_headcount', {
    id,
    adventure_id: adventureId,
    label: record.label,
    expected_count: expectedCount,
    actual_count: actualCount,
    recorded_by: profileId,
    recorded_at: recordedAt,
    notes: record.notes,
  }, 40);

  const next = await saveOptimistic({ ...snapshot, headcounts: [record, ...snapshot.headcounts] });
  void flushOfflineQueue();
  return next;
}

export async function queueFieldIncident(input: {
  adventureId: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  location?: string;
  actionsTaken?: string;
  emergencyServicesContacted?: boolean;
}) {
  const profileId = await currentProfileId();
  const snapshot = await requireSnapshot(input.adventureId);
  const id = createOfflineUuid();
  const occurredAt = new Date().toISOString();
  const record = {
    id,
    title: input.title.trim() || 'Needs follow-up',
    severity: input.severity,
    status: 'open' as const,
    occurred_at: occurredAt,
    location: input.location?.trim() || null,
    description: input.description.trim() || 'Field incident recorded for follow-up.',
  };
  const priority = input.severity === 'critical' ? 85 : input.severity === 'high' ? 75 : input.severity === 'moderate' ? 65 : 50;

  await queueOfflineAction('field_incident', {
    id,
    adventure_id: input.adventureId,
    reported_by: profileId,
    severity: input.severity,
    status: 'open',
    occurred_at: occurredAt,
    location: record.location,
    title: record.title,
    description: record.description,
    actions_taken: input.actionsTaken?.trim() || null,
    emergency_services_contacted: input.emergencyServicesContacted === true,
  }, priority);

  const next = await saveOptimistic({ ...snapshot, incidents: [record, ...snapshot.incidents] });
  void flushOfflineQueue();
  return next;
}

export async function queueHostBroadcast(input: {
  adventureId: string;
  audience: HostMessageAudience;
  subject: string;
  body: string;
}) {
  const profileId = await currentProfileId();
  const snapshot = await requireSnapshot(input.adventureId);
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error('Add a subject.');
  if (body.length < 3) throw new Error('Add a message.');

  const id = createOfflineUuid();
  const sentAt = new Date().toISOString();
  const message: OfflineHostMessage = {
    id,
    audience: input.audience,
    subject,
    body,
    sent_at: sentAt,
    delivery_status: 'queued',
  };

  await queueOfflineAction('field_host_message', {
    id,
    adventure_id: input.adventureId,
    host_id: profileId,
    audience: input.audience,
    subject,
    body,
    sent_at: sentAt,
    created_at: sentAt,
  }, 60);

  const next = await saveOptimistic({ ...snapshot, messages: [message, ...snapshot.messages] });
  void flushOfflineQueue();
  return next;
}

export async function countPendingFieldActions(adventureId: string) {
  await currentProfileId();
  const actions = await listPendingOfflineActions(100);
  return actions.filter((action) => {
    if (!action.kind.startsWith('field_')) return false;
    try {
      const payload = JSON.parse(action.payload) as { adventure_id?: string };
      return payload.adventure_id === adventureId;
    } catch {
      return false;
    }
  }).length;
}

export async function syncFieldChanges(adventureId: string) {
  await currentProfileId();
  const result = await flushOfflineQueue();
  let snapshot = await getHostFieldSnapshot(adventureId);
  if (result.synced > 0) {
    try {
      snapshot = await refreshHostFieldSnapshot(adventureId);
    } catch {
      // Keep the local field snapshot if refresh is unavailable after writes sync.
    }
  }
  return {
    ...result,
    pending: await countPendingOfflineActions(),
    fieldPending: await countPendingFieldActions(adventureId),
    snapshot,
  };
}
