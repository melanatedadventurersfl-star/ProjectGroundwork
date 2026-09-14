import { OfflineManager } from '@maplibre/maplibre-react-native';

import { env } from '../config/env';
import { getMapPack, removeMapPack, saveMapPack } from './mapPackStore';
import type { OfflineMapDownloadInput, OfflineMapPack, OfflineMapProgress } from './types';

const MIN_ZOOM = 9;
const MAX_ZOOM = 16;

function boundsAround(latitude: number, longitude: number, radiusKm: number): [number, number, number, number] {
  const latDelta = radiusKm / 111.32;
  const cosLatitude = Math.max(Math.cos(latitude * Math.PI / 180), 0.2);
  const lonDelta = radiusKm / (111.32 * cosLatitude);
  return [longitude - lonDelta, latitude - latDelta, longitude + lonDelta, latitude + latDelta];
}

function safePercentage(value: number | undefined, complete: boolean) {
  if (complete) return 100;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value ?? 0));
}

export function isOfflineMapConfigured() {
  return Boolean(env.mapStyleUrl);
}

export function getOfflineMapStyleUrl() {
  return env.mapStyleUrl;
}

export async function getOfflineMapPack(adventureId: string) {
  return getMapPack(adventureId);
}

export async function downloadOfflineMapPack(
  input: OfflineMapDownloadInput,
  onProgress?: (progress: OfflineMapProgress) => void,
): Promise<OfflineMapPack> {
  const styleUrl = env.mapStyleUrl;
  if (!styleUrl) {
    throw new Error('Offline maps are not configured for this build.');
  }

  const existing = await getMapPack(input.adventureId);
  if (existing?.nativePackId) {
    try {
      OfflineManager.removeListener(existing.nativePackId);
      await OfflineManager.deletePack(existing.nativePackId);
    } catch {
      // A missing/stale native pack should not block a clean replacement download.
    }
  }

  let latest: OfflineMapPack = {
    adventureId: input.adventureId,
    nativePackId: null,
    styleUrl,
    centerLatitude: input.latitude,
    centerLongitude: input.longitude,
    radiusKm: input.radiusKm,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    state: 'downloading',
    percentage: 0,
    completedResourceCount: 0,
    completedResourceSize: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  };
  await saveMapPack(latest);

  OfflineManager.setProgressEventThrottle(1_000);
  const nativePack = await OfflineManager.createPack(
    {
      mapStyle: styleUrl,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      bounds: boundsAround(input.latitude, input.longitude, input.radiusKm),
      metadata: {
        goMelanatedAdventureId: input.adventureId,
        radiusKm: input.radiusKm,
        createdAt: new Date().toISOString(),
      },
    },
    (pack, status) => {
      const complete = status.state === 'complete';
      latest = {
        ...latest,
        nativePackId: pack.id,
        state: complete ? 'complete' : 'downloading',
        percentage: safePercentage(status.percentage, complete),
        completedResourceCount: status.completedResourceCount ?? 0,
        completedResourceSize: status.completedResourceSize ?? 0,
        updatedAt: new Date().toISOString(),
        error: null,
      };
      void saveMapPack(latest);
      onProgress?.({
        state: latest.state,
        percentage: latest.percentage,
        completedResourceCount: latest.completedResourceCount,
        completedResourceSize: latest.completedResourceSize,
        error: null,
      });
    },
    (pack, error) => {
      latest = {
        ...latest,
        nativePackId: pack.id,
        state: 'error',
        updatedAt: new Date().toISOString(),
        error: error.message || 'Map download failed.',
      };
      void saveMapPack(latest);
      onProgress?.({
        state: 'error',
        percentage: latest.percentage,
        completedResourceCount: latest.completedResourceCount,
        completedResourceSize: latest.completedResourceSize,
        error: latest.error,
      });
    },
  );

  latest = {
    ...latest,
    nativePackId: nativePack.id,
    updatedAt: new Date().toISOString(),
  };
  await saveMapPack(latest);
  return latest;
}

export async function deleteOfflineMapPack(adventureId: string) {
  const existing = await getMapPack(adventureId);
  if (existing?.nativePackId) {
    try {
      OfflineManager.removeListener(existing.nativePackId);
      await OfflineManager.deletePack(existing.nativePackId);
    } catch {
      // Local metadata should still be removable if the native map database was reset.
    }
  }
  await removeMapPack(adventureId);
}

export function formatOfflineMapBytes(bytes: number) {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
