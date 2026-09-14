import * as SQLite from 'expo-sqlite';

import { createOfflineUuid } from '../offline/safetyStore';
import type { LocalArrivalScan } from './types';

const databasePromise = SQLite.openDatabaseAsync('ma-offline.db');
let schemaPromise: Promise<void> | null = null;

async function getDb() {
  const db = await databasePromise;
  if (!schemaPromise) {
    schemaPromise = db.execAsync(`
      create table if not exists offline_arrival_scans (
        id text primary key not null,
        adventure_id text not null,
        attendee_id text not null,
        payload text not null,
        scanned_at text not null
      );
      create index if not exists offline_arrival_scans_event_idx
        on offline_arrival_scans (adventure_id, scanned_at desc);
      create table if not exists offline_arrival_meta (
        meta_key text primary key not null,
        meta_value text not null
      );
    `);
  }
  await schemaPromise;
  return db;
}

export async function getArrivalDeviceId() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ meta_value: string }>(
    'select meta_value from offline_arrival_meta where meta_key = ?',
    'device_id',
  );
  if (row?.meta_value) return row.meta_value;
  const id = createOfflineUuid();
  await db.runAsync(
    'insert or replace into offline_arrival_meta (meta_key, meta_value) values (?, ?)',
    'device_id',
    id,
  );
  return id;
}

export async function saveLocalArrivalScan(scan: LocalArrivalScan) {
  const db = await getDb();
  await db.runAsync(
    'insert or replace into offline_arrival_scans (id, adventure_id, attendee_id, payload, scanned_at) values (?, ?, ?, ?, ?)',
    scan.id,
    scan.adventureId,
    scan.attendeeId,
    JSON.stringify(scan),
    scan.scannedAt,
  );
}

export async function getLocalArrivalScans(adventureId: string): Promise<LocalArrivalScan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>(
    'select payload from offline_arrival_scans where adventure_id = ? order by scanned_at desc',
    adventureId,
  );
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.payload) as LocalArrivalScan];
    } catch {
      return [];
    }
  });
}

export async function getLocalArrivalScan(id: string): Promise<LocalArrivalScan | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    'select payload from offline_arrival_scans where id = ?',
    id,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as LocalArrivalScan;
  } catch {
    return null;
  }
}

export async function updateLocalArrivalScan(id: string, patch: Partial<LocalArrivalScan>) {
  const current = await getLocalArrivalScan(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await saveLocalArrivalScan(next);
  return next;
}

export async function clearLocalArrivalData() {
  const db = await getDb();
  await db.execAsync('delete from offline_arrival_scans; delete from offline_arrival_meta;');
}
