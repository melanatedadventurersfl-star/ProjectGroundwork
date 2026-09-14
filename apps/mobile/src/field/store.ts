import * as SQLite from 'expo-sqlite';

import type { HostFieldSnapshot } from './types';

const databasePromise = SQLite.openDatabaseAsync('ma-offline.db');
let schemaPromise: Promise<void> | null = null;

async function getDb() {
  const db = await databasePromise;
  if (!schemaPromise) {
    schemaPromise = db.execAsync(`
      create table if not exists offline_host_field_snapshots (
        adventure_id text primary key not null,
        payload text not null,
        saved_at text not null
      );
    `);
  }
  await schemaPromise;
  return db;
}

export async function saveHostFieldSnapshot(snapshot: HostFieldSnapshot) {
  const db = await getDb();
  await db.runAsync(
    'insert or replace into offline_host_field_snapshots (adventure_id, payload, saved_at) values (?, ?, ?)',
    snapshot.adventureId,
    JSON.stringify(snapshot),
    snapshot.savedAt,
  );
}

export async function getHostFieldSnapshot(adventureId: string): Promise<HostFieldSnapshot | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    'select payload from offline_host_field_snapshots where adventure_id = ?',
    adventureId,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as HostFieldSnapshot;
  } catch {
    return null;
  }
}

export async function listHostFieldSnapshots(): Promise<HostFieldSnapshot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>(
    'select payload from offline_host_field_snapshots order by saved_at desc',
  );
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.payload) as HostFieldSnapshot];
    } catch {
      return [];
    }
  });
}

export async function removeHostFieldSnapshot(adventureId: string) {
  const db = await getDb();
  await db.runAsync('delete from offline_host_field_snapshots where adventure_id = ?', adventureId);
}
