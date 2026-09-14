import type { OfflineMapDownloadInput, OfflineMapProgress } from './types';

export function isOfflineMapConfigured() {
  return false;
}

export function getOfflineMapStyleUrl() {
  return null;
}

export async function getOfflineMapPack() {
  return null;
}

export async function downloadOfflineMapPack(
  _input: OfflineMapDownloadInput,
  _onProgress?: (progress: OfflineMapProgress) => void,
) {
  throw new Error('Downloadable map packs are available in the iOS and Android app.');
}

export async function deleteOfflineMapPack() {
  return undefined;
}

export function formatOfflineMapBytes(bytes: number) {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
