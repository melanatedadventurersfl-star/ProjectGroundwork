import * as SQLite from 'expo-sqlite';

import type { MemberTrip } from '../member/api';

const databasePromise = SQLite.openDatabaseAsync('ma-offline.db');

async function ensureTable() {
  const db = await databasePromise;
  await db.execAsync(`
    create table if not exists cached_trip_data (
      cache_key text primary key not null,
      payload text not null,
      saved_at text not null
    );
  `);
  return db;
}

export async function saveTripsOffline(trips: MemberTrip[]) {
  const db = await ensureTable();
  await db.runAsync(
    'insert or replace into cached_trip_data (cache_key, payload, saved_at) values (?, ?, ?)',
    'member-trips',
    JSON.stringify(trips),
    new Date().toISOString(),
  );
}

export async function getOfflineTrips(): Promise<{ trips: MemberTrip[]; savedAt: string } | null> {
  const db = await ensureTable();
  const row = await db.getFirstAsync<{ payload: string; saved_at: string }>(
    'select payload, saved_at from cached_trip_data where cache_key = ?',
    'member-trips',
  );
  if (!row) return null;
  try {
    return { trips: JSON.parse(row.payload) as MemberTrip[], savedAt: row.saved_at };
  } catch {
    return null;
  }
}
