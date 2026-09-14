import * as SQLite from 'expo-sqlite';

import type { OfflineMapPack } from './types';

const databasePromise = SQLite.openDatabaseAsync('ma-offline.db');
let schemaPromise: Promise<void> | null = null;

type MapPackRow = {
  adventure_id: string;
  native_pack_id: string | null;
  style_url: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  min_zoom: number;
  max_zoom: number;
  state: OfflineMapPack['state'];
  percentage: number;
  completed_resource_count: number;
  completed_resource_size: number;
  updated_at: string;
  error: string | null;
};

async function getDb() {
  const db = await databasePromise;
  if (!schemaPromise) {
    schemaPromise = db.execAsync(`
      create table if not exists offline_map_packs (
        adventure_id text primary key not null,
        native_pack_id text,
        style_url text not null,
        center_latitude real not null,
        center_longitude real not null,
        radius_km real not null,
        min_zoom real not null,
        max_zoom real not null,
        state text not null,
        percentage real not null default 0,
        completed_resource_count integer not null default 0,
        completed_resource_size integer not null default 0,
        updated_at text not null,
        error text
      );
    `);
  }
  await schemaPromise;
  return db;
}

function fromRow(row: MapPackRow): OfflineMapPack {
  return {
    adventureId: row.adventure_id,
    nativePackId: row.native_pack_id,
    styleUrl: row.style_url,
    centerLatitude: row.center_latitude,
    centerLongitude: row.center_longitude,
    radiusKm: row.radius_km,
    minZoom: row.min_zoom,
    maxZoom: row.max_zoom,
    state: row.state,
    percentage: row.percentage,
    completedResourceCount: row.completed_resource_count,
    completedResourceSize: row.completed_resource_size,
    updatedAt: row.updated_at,
    error: row.error,
  };
}

export async function saveMapPack(pack: OfflineMapPack) {
  const db = await getDb();
  await db.runAsync(
    `insert or replace into offline_map_packs (
      adventure_id, native_pack_id, style_url, center_latitude, center_longitude,
      radius_km, min_zoom, max_zoom, state, percentage, completed_resource_count,
      completed_resource_size, updated_at, error
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    pack.adventureId,
    pack.nativePackId,
    pack.styleUrl,
    pack.centerLatitude,
    pack.centerLongitude,
    pack.radiusKm,
    pack.minZoom,
    pack.maxZoom,
    pack.state,
    pack.percentage,
    pack.completedResourceCount,
    pack.completedResourceSize,
    pack.updatedAt,
    pack.error,
  );
}

export async function getMapPack(adventureId: string): Promise<OfflineMapPack | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MapPackRow>(
    'select * from offline_map_packs where adventure_id = ?',
    adventureId,
  );
  return row ? fromRow(row) : null;
}

export async function removeMapPack(adventureId: string) {
  const db = await getDb();
  await db.runAsync('delete from offline_map_packs where adventure_id = ?', adventureId);
}
