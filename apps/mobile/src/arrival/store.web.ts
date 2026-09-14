import { createOfflineUuid } from '../offline/safetyStore';
import type { LocalArrivalScan } from './types';

const SCANS_KEY = 'ma.offlineArrival.scans';
const DEVICE_KEY = 'ma.offlineArrival.deviceId';

function storage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function readScans(): LocalArrivalScan[] {
  const raw = storage()?.getItem(SCANS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalArrivalScan[];
  } catch {
    return [];
  }
}

function writeScans(scans: LocalArrivalScan[]) {
  storage()?.setItem(SCANS_KEY, JSON.stringify(scans));
}

export async function getArrivalDeviceId() {
  const target = storage();
  if (!target) return 'web-session';
  const existing = target.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = createOfflineUuid();
  target.setItem(DEVICE_KEY, id);
  return id;
}

export async function saveLocalArrivalScan(scan: LocalArrivalScan) {
  const scans = readScans();
  const index = scans.findIndex((item) => item.id === scan.id);
  if (index >= 0) scans[index] = scan;
  else scans.push(scan);
  writeScans(scans);
}

export async function getLocalArrivalScans(adventureId: string): Promise<LocalArrivalScan[]> {
  return readScans()
    .filter((scan) => scan.adventureId === adventureId)
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}

export async function getLocalArrivalScan(id: string): Promise<LocalArrivalScan | null> {
  return readScans().find((scan) => scan.id === id) ?? null;
}

export async function updateLocalArrivalScan(id: string, patch: Partial<LocalArrivalScan>) {
  const current = await getLocalArrivalScan(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await saveLocalArrivalScan(next);
  return next;
}

export async function clearLocalArrivalData() {
  storage()?.removeItem(SCANS_KEY);
  storage()?.removeItem(DEVICE_KEY);
}
