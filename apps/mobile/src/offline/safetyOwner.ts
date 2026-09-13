import * as SQLite from 'expo-sqlite';

const databasePromise = SQLite.openDatabaseAsync('ma-offline.db');
const SAFETY_TABLES = [
  'offline_event_packs',
  'offline_safety_sessions',
  'offline_safety_breadcrumbs',
  'offline_action_queue',
  'offline_roster_sweep',
] as const;

async function getDb() {
  const db = await databasePromise;
  await db.execAsync(`
    create table if not exists offline_safety_meta (
      meta_key text primary key not null,
      meta_value text not null
    );
  `);
  return db;
}

async function clearKnownSafetyTables() {
  const db = await getDb();
  for (const table of SAFETY_TABLES) {
    const exists = await db.getFirstAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table' and name = ?",
      table,
    );
    if (exists) await db.execAsync(`delete from ${table};`);
  }
}

export async function ensureSafetyOwner(profileId: string) {
  const db = await getDb();
  const owner = await db.getFirstAsync<{ meta_value: string }>(
    'select meta_value from offline_safety_meta where meta_key = ?',
    'owner_profile_id',
  );

  if (owner && owner.meta_value !== profileId) {
    await clearKnownSafetyTables();
  }

  await db.runAsync(
    'insert or replace into offline_safety_meta (meta_key, meta_value) values (?, ?)',
    'owner_profile_id',
    profileId,
  );
}

export async function clearOfflineSafetyData() {
  const db = await getDb();
  await clearKnownSafetyTables();
  await db.runAsync('delete from offline_safety_meta where meta_key = ?', 'owner_profile_id');
}
