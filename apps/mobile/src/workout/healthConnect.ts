import { NativeModules, Platform } from 'react-native';

import { loadWorkoutStore, saveWorkoutStore } from './storage';
import type { WorkoutHistoryEntry } from './types';

const SAMSUNG_HEALTH_PACKAGE = 'com.sec.android.app.shealth';

export type HealthToggles = {
  workouts: boolean;
  heartRate: boolean;
  calories: boolean;
  distance: boolean;
  steps: boolean;
};

export const DEFAULT_HEALTH_TOGGLES: HealthToggles = {
  workouts: true,
  heartRate: true,
  calories: true,
  distance: true,
  steps: true,
};

export type HealthConnectStatus = {
  available: boolean;
  connected: boolean;
  permissions: string[];
};

export type SamsungWorkoutRecord = {
  recordId: string;
  sourcePackage: string;
  title?: string | null;
  exerciseType?: number;
  startTime: string;
  endTime: string;
  sourceDevice?: string;
  avgHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  caloriesKcal?: number;
  distanceMeters?: number;
  steps?: number;
};

export type HealthWorkoutHistoryEntry = WorkoutHistoryEntry & {
  externalWorkout: true;
  manualWorkoutCompletion: true;
  externalSource: {
    provider: 'samsung_health';
    healthConnectRecordId: string;
    sourcePackage: string;
    sourceDevice?: string;
    importedAt: string;
  };
  healthMetrics: {
    averageHeartRateBpm: number;
    maxHeartRateBpm: number;
    minHeartRateBpm: number;
    caloriesKcal: number;
    distanceMeters: number;
    steps: number;
  };
};

type NativeHealthModule = {
  getStatus: () => Promise<HealthConnectStatus>;
  requestPermissions: (toggles: HealthToggles) => Promise<HealthConnectStatus>;
  revokePermissions: () => Promise<void>;
  readSamsungWorkouts: (days: number, toggles: HealthToggles) => Promise<{ records: SamsungWorkoutRecord[] }>;
};

function healthModule(): NativeHealthModule | null {
  if (Platform.OS !== 'android') return null;
  return (NativeModules.GoWorkoutHealthConnect as NativeHealthModule | undefined) ?? null;
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160);
}

function normalizeRecord(record: SamsungWorkoutRecord): HealthWorkoutHistoryEntry | null {
  if (!record.recordId || record.sourcePackage !== SAMSUNG_HEALTH_PACKAGE) return null;
  const start = new Date(record.startTime);
  const end = new Date(record.endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return null;
  const seconds = Math.max(1, Math.round((end.getTime() - start.getTime()) / 1000));
  const importedAt = new Date().toISOString();
  return {
    id: 'health-samsung_health-' + cleanId(record.recordId),
    routineId: 'samsung-health',
    routineName: record.title?.trim() || 'Samsung Health workout',
    startedAt: start.toISOString(),
    completedAt: end.toISOString(),
    durationMinutes: Math.max(1, Math.round(seconds / 60)),
    exercises: [],
    totalVolume: 0,
    completedSets: 0,
    manualWorkoutCompletion: true,
    externalWorkout: true,
    externalSource: {
      provider: 'samsung_health',
      healthConnectRecordId: record.recordId,
      sourcePackage: record.sourcePackage,
      sourceDevice: record.sourceDevice || '',
      importedAt,
    },
    healthMetrics: {
      averageHeartRateBpm: number(record.avgHeartRate),
      maxHeartRateBpm: number(record.maxHeartRate),
      minHeartRateBpm: number(record.minHeartRate),
      caloriesKcal: number(record.caloriesKcal),
      distanceMeters: number(record.distanceMeters),
      steps: Math.max(0, Math.round(number(record.steps))),
    },
  };
}

export function isHealthConnectSupported() {
  return Platform.OS === 'android' && Boolean(healthModule());
}

export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  const health = healthModule();
  if (!health) return { available: false, connected: false, permissions: [] };
  return health.getStatus();
}

export async function connectSamsungHealth(toggles = DEFAULT_HEALTH_TOGGLES) {
  const health = healthModule();
  if (!health) throw new Error('Health Connect is available only in the Android build.');
  return health.requestPermissions(toggles);
}

export async function disconnectSamsungHealth() {
  const health = healthModule();
  if (!health) return;
  await health.revokePermissions();
}

export async function importSamsungHealthWorkouts(days = 30, toggles = DEFAULT_HEALTH_TOGGLES) {
  const health = healthModule();
  if (!health) throw new Error('Health Connect is available only in the Android build.');
  const result = await health.readSamsungWorkouts(Math.min(30, Math.max(1, days)), toggles);
  const entries = (result.records ?? [])
    .map(normalizeRecord)
    .filter((entry): entry is HealthWorkoutHistoryEntry => Boolean(entry));
  const store = await loadWorkoutStore();
  const existing = new Set(store.history.map((entry) => entry.id));
  const imported = entries.filter((entry) => !existing.has(entry.id));
  if (imported.length) {
    await saveWorkoutStore({
      ...store,
      history: [...imported, ...store.history].sort(
        (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      ),
    });
  }
  return { imported, found: entries.length };
}
