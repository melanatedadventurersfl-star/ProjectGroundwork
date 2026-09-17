import Storage from 'expo-sqlite/kv-store';

import type { WorkoutStore } from './types';

const STORAGE_KEY = 'workout-mvp-store-v1';

const emptyStore: WorkoutStore = {
  history: [],
  activeWorkout: null,
};

export async function loadWorkoutStore(): Promise<WorkoutStore> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore;
    const parsed = JSON.parse(raw) as Partial<WorkoutStore>;
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      activeWorkout: parsed.activeWorkout ?? null,
    };
  } catch (error) {
    console.warn('[workout] Unable to load workout data', error);
    return emptyStore;
  }
}

export async function saveWorkoutStore(store: WorkoutStore): Promise<void> {
  try {
    await Storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('[workout] Unable to save workout data', error);
  }
}

export async function clearWorkoutStore(): Promise<void> {
  try {
    await Storage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[workout] Unable to clear workout data', error);
  }
}
