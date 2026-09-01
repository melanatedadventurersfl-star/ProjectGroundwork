import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ma-local.db');

function ensureTable() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS trail_guide_saved_places (
      user_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (user_id, place_id)
    );
  `);
}

export function isTrailGuidePlaceSaved(userId: string, placeId: string) {
  ensureTable();
  const row = db.getFirstSync<{ place_id: string }>(
    'SELECT place_id FROM trail_guide_saved_places WHERE user_id = ? AND place_id = ? LIMIT 1',
    userId,
    placeId,
  );
  return Boolean(row?.place_id);
}

export function setTrailGuidePlaceSaved(userId: string, placeId: string, shouldSave: boolean) {
  ensureTable();
  if (shouldSave) {
    db.runSync(
      'INSERT OR REPLACE INTO trail_guide_saved_places (user_id, place_id, saved_at) VALUES (?, ?, ?)',
      userId,
      placeId,
      new Date().toISOString(),
    );
    return;
  }

  db.runSync(
    'DELETE FROM trail_guide_saved_places WHERE user_id = ? AND place_id = ?',
    userId,
    placeId,
  );
}

export function getSavedTrailGuidePlaceIds(userId: string) {
  ensureTable();
  return db
    .getAllSync<{ place_id: string }>(
      'SELECT place_id FROM trail_guide_saved_places WHERE user_id = ? ORDER BY saved_at DESC',
      userId,
    )
    .map((row) => row.place_id);
}
