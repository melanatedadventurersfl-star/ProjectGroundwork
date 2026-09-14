import type { OfflineMapPack } from './types';

const KEY = 'ma.offlineMaps.packs';

function storage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function read(): Record<string, OfflineMapPack> {
  const raw = storage()?.getItem(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, OfflineMapPack>;
  } catch {
    return {};
  }
}

export async function saveMapPack(pack: OfflineMapPack) {
  const packs = read();
  packs[pack.adventureId] = pack;
  storage()?.setItem(KEY, JSON.stringify(packs));
}

export async function getMapPack(adventureId: string): Promise<OfflineMapPack | null> {
  return read()[adventureId] ?? null;
}

export async function removeMapPack(adventureId: string) {
  const packs = read();
  delete packs[adventureId];
  storage()?.setItem(KEY, JSON.stringify(packs));
}
