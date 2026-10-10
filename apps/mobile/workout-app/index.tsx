import Constants from 'expo-constants';
import { NativeModules, Platform, StyleSheet, View } from 'react-native';

import WorkoutWebFrame from '../src/workout-app/WorkoutWebFrame';

type HealthPayload = {
  toggles?: Record<string, boolean>;
  days?: number;
};

type NativeHealthModule = {
  getStatus: () => Promise<unknown>;
  requestPermissions: (toggles: Record<string, boolean>) => Promise<unknown>;
  revokePermissions: () => Promise<void>;
  readSamsungWorkouts: (days: number, toggles: Record<string, boolean>) => Promise<unknown>;
};

function configValue(key: string) {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function healthModule(): NativeHealthModule {
  if (Platform.OS !== 'android') {
    throw new Error('Samsung Health connection is available in the Android app.');
  }
  const module = NativeModules.GoWorkoutHealthConnect as NativeHealthModule | undefined;
  if (!module) throw new Error('Health Connect is not available in this build.');
  return module;
}

async function healthRequest(action: string, payload: HealthPayload) {
  const health = healthModule();
  switch (action) {
    case 'getStatus':
      return health.getStatus();
    case 'requestPermissions':
      return health.requestPermissions(payload.toggles ?? {});
    case 'revokePermissions':
      await health.revokePermissions();
      return null;
    case 'readSamsungWorkouts':
      return health.readSamsungWorkouts(
        Math.min(30, Math.max(1, Number(payload.days) || 30)),
        payload.toggles ?? {},
      );
    default:
      throw new Error('Unsupported native health action.');
  }
}

export default function WorkoutAppScreen() {
  const workoutWebUrl =
    configValue('workoutWebUrl') ||
    'https://melanatedadventurersfl-star.github.io/ProjectGroundwork/goworkout/';

  return (
    <View style={styles.screen}>
      <WorkoutWebFrame
        url={workoutWebUrl}
        healthRequest={healthRequest}
        dom={{ containerStyle: styles.frame }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0D0B' },
  frame: { flex: 1, backgroundColor: '#0A0D0B' },
});
