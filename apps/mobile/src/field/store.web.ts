import type { HostFieldSnapshot } from './types';

const KEY = 'ma.offlineSafety.hostFieldSnapshots';

function storage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function read(): Record<string, HostFieldSnapshot> {
  const raw = storage()?.getItem(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, HostFieldSnapshot>;
  } catch {
    return {};
  }
}

function write(value: Record<string, HostFieldSnapshot>) {
  storage()?.setItem(KEY, JSON.stringify(value));
}

export async function saveHostFieldSnapshot(snapshot: HostFieldSnapshot) {
  const all = read();
  all[snapshot.adventureId] = snapshot;
  write(all);
}

export async function getHostFieldSnapshot(adventureId: string): Promise<HostFieldSnapshot | null> {
  return read()[adventureId] ?? null;
}

export async function removeHostFieldSnapshot(adventureId: string) {
  const all = read();
  delete all[adventureId];
  write(all);
}
