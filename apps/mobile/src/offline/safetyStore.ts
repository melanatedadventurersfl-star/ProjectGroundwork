import * as SQLite from 'expo-sqlite';

import type {
  LocalSafetySession,
  OfflineEventPack,
  PendingOfflineAction,
  RosterSweepRecord,
  RosterSweepStatus,
  SafetyBreadcrumb,
} from './safetyTypes';

const databasePromise = SQLite.openDatabaseAsync('ma-offline.db');
let schemaPromise: Promise<void> | null = null;

type SafetySessionRow = {
  id: string;
  adventure_id: string;
  profile_id: string;
  status: LocalSafetySession['status'];
  started_at: string;
  expected_return_at: string | null;
  ended_at: string | null;
  safe_point_latitude: number | null;
  safe_point_longitude: number | null;
  last_check_in: LocalSafetySession['lastCheckIn'];
  last_check_in_at: string | null;
};

function makeId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function getDb() {
  const db = await databasePromise;
  if (!schemaPromise) {
    schemaPromise = db.execAsync(`
      create table if not exists offline_event_packs (
        adventure_id text primary key not null,
        payload text not null,
        saved_at text not null
      );

      create table if not exists offline_safety_sessions (
        id text primary key not null,
        adventure_id text not null,
        profile_id text not null,
        status text not null,
        started_at text not null,
        expected_return_at text,
        ended_at text,
        safe_point_latitude real,
        safe_point_longitude real,
        last_check_in text,
        last_check_in_at text
      );

      create index if not exists offline_safety_sessions_adventure_idx
        on offline_safety_sessions(adventure_id, status);

      create table if not exists offline_safety_breadcrumbs (
        id integer primary key autoincrement,
        session_id text not null,
        latitude real not null,
        longitude real not null,
        accuracy real,
        recorded_at text not null
      );

      create index if not exists offline_safety_breadcrumbs_session_idx
        on offline_safety_breadcrumbs(session_id, id);

      create table if not exists offline_action_queue (
        id text primary key not null,
        kind text not null,
        payload text not null,
        priority integer not null default 50,
        created_at text not null,
        attempts integer not null default 0,
        last_error text
      );

      create index if not exists offline_action_queue_priority_idx
        on offline_action_queue(priority desc, created_at asc);

      create table if not exists offline_roster_sweep (
        adventure_id text not null,
        attendee_id text not null,
        status text not null,
        updated_at text not null,
        primary key (adventure_id, attendee_id)
      );
    `);
  }
  await schemaPromise;
  return db;
}

export async function saveEventPack(pack: OfflineEventPack) {
  const db = await getDb();
  await db.runAsync(
    'insert or replace into offline_event_packs (adventure_id, payload, saved_at) values (?, ?, ?)',
    pack.adventure.id,
    JSON.stringify(pack),
    pack.downloadedAt,
  );
}

export async function getEventPack(adventureId: string): Promise<OfflineEventPack | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    'select payload from offline_event_packs where adventure_id = ?',
    adventureId,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as OfflineEventPack;
  } catch {
    return null;
  }
}

export async function removeEventPack(adventureId: string) {
  const db = await getDb();
  await db.runAsync('delete from offline_event_packs where adventure_id = ?', adventureId);
}

export async function saveSafetySession(session: LocalSafetySession) {
  const db = await getDb();
  await db.runAsync(
    `insert or replace into offline_safety_sessions (
      id, adventure_id, profile_id, status, started_at, expected_return_at, ended_at,
      safe_point_latitude, safe_point_longitude, last_check_in, last_check_in_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.adventureId,
    session.profileId,
    session.status,
    session.startedAt,
    session.expectedReturnAt,
    session.endedAt,
    session.safePointLatitude,
    session.safePointLongitude,
    session.lastCheckIn,
    session.lastCheckInAt,
  );
}

function rowToSession(row: SafetySessionRow): LocalSafetySession {
  return {
    id: row.id,
    adventureId: row.adventure_id,
    profileId: row.profile_id,
    status: row.status,
    startedAt: row.started_at,
    expectedReturnAt: row.expected_return_at,
    endedAt: row.ended_at,
    safePointLatitude: row.safe_point_latitude,
    safePointLongitude: row.safe_point_longitude,
    lastCheckIn: row.last_check_in,
    lastCheckInAt: row.last_check_in_at,
  };
}

export async function getActiveSafetySession(adventureId: string): Promise<LocalSafetySession | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SafetySessionRow>(
    `select * from offline_safety_sessions
     where adventure_id = ? and status = 'active'
     order by started_at desc limit 1`,
    adventureId,
  );
  return row ? rowToSession(row) : null;
}

export async function updateLocalSafetySession(
  session: LocalSafetySession,
  patch: Partial<LocalSafetySession>,
) {
  const next = { ...session, ...patch };
  await saveSafetySession(next);
  return next;
}

export async function addBreadcrumb(input: {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt?: string;
}) {
  const db = await getDb();
  await db.runAsync(
    `insert into offline_safety_breadcrumbs
      (session_id, latitude, longitude, accuracy, recorded_at)
     values (?, ?, ?, ?, ?)`,
    input.sessionId,
    input.latitude,
    input.longitude,
    input.accuracy ?? null,
    input.recordedAt ?? new Date().toISOString(),
  );
}

export async function getBreadcrumbs(sessionId: string): Promise<SafetyBreadcrumb[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    session_id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recorded_at: string;
  }>(
    `select id, session_id, latitude, longitude, accuracy, recorded_at
     from offline_safety_breadcrumbs where session_id = ? order by id`,
    sessionId,
  );
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    recordedAt: row.recorded_at,
  }));
}

export async function queueOfflineAction(
  kind: PendingOfflineAction['kind'],
  payload: unknown,
  priority = 50,
) {
  const db = await getDb();
  const id = makeId();
  await db.runAsync(
    `insert into offline_action_queue
      (id, kind, payload, priority, created_at, attempts, last_error)
     values (?, ?, ?, ?, ?, 0, null)`,
    id,
    kind,
    JSON.stringify(payload),
    priority,
    new Date().toISOString(),
  );
  return id;
}

export async function listPendingOfflineActions(limit = 25): Promise<PendingOfflineAction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    kind: PendingOfflineAction['kind'];
    payload: string;
    priority: number;
    created_at: string;
    attempts: number;
    last_error: string | null;
  }>(
    `select id, kind, payload, priority, created_at, attempts, last_error
     from offline_action_queue
     order by priority desc, created_at asc limit ?`,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    priority: row.priority,
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}

export async function completeOfflineAction(id: string) {
  const db = await getDb();
  await db.runAsync('delete from offline_action_queue where id = ?', id);
}

export async function failOfflineAction(id: string, error: string) {
  const db = await getDb();
  await db.runAsync(
    'update offline_action_queue set attempts = attempts + 1, last_error = ? where id = ?',
    error.slice(0, 500),
    id,
  );
}

export async function countPendingOfflineActions() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('select count(*) as count from offline_action_queue');
  return row?.count ?? 0;
}

export async function setRosterSweepStatus(
  adventureId: string,
  attendeeId: string,
  status: RosterSweepStatus,
) {
  const db = await getDb();
  const updatedAt = new Date().toISOString();
  await db.runAsync(
    `insert or replace into offline_roster_sweep
      (adventure_id, attendee_id, status, updated_at) values (?, ?, ?, ?)`,
    adventureId,
    attendeeId,
    status,
    updatedAt,
  );
  return { adventureId, attendeeId, status, updatedAt } satisfies RosterSweepRecord;
}

export async function getRosterSweep(adventureId: string): Promise<RosterSweepRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    adventure_id: string;
    attendee_id: string;
    status: RosterSweepStatus;
    updated_at: string;
  }>(
    'select adventure_id, attendee_id, status, updated_at from offline_roster_sweep where adventure_id = ?',
    adventureId,
  );
  return rows.map((row) => ({
    adventureId: row.adventure_id,
    attendeeId: row.attendee_id,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

export { makeId as createOfflineUuid };
