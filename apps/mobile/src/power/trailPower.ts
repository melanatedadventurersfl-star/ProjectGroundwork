import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type TrailPowerMode = 'normal' | 'suggested' | 'trail_power' | 'critical';

export type TrailPowerSnapshot = {
  batteryLevel: number;
  lowPowerMode: boolean;
  manualEnabled: boolean;
  mode: TrailPowerMode;
};

type Listener = (snapshot: TrailPowerSnapshot) => void;

let batteryLevel = -1;
let lowPowerMode = false;
let manualEnabled = false;
let started = false;
let batterySubscription: { remove: () => void } | null = null;
let lowPowerSubscription: { remove: () => void } | null = null;
let suggestedNoticeSent = false;
let criticalNoticeSent = false;
const listeners = new Set<Listener>();

function modeForState(): TrailPowerMode {
  if (batteryLevel >= 0 && batteryLevel <= 0.15) return 'critical';
  if (manualEnabled || lowPowerMode) return 'trail_power';
  if (batteryLevel >= 0 && batteryLevel <= 0.30) return 'suggested';
  return 'normal';
}

export function getTrailPowerSnapshot(): TrailPowerSnapshot {
  return { batteryLevel, lowPowerMode, manualEnabled, mode: modeForState() };
}

function emit() {
  const snapshot = getTrailPowerSnapshot();
  listeners.forEach((listener) => listener(snapshot));
  void maybeNotify(snapshot);
}

async function maybeNotify(snapshot: TrailPowerSnapshot) {
  if (Platform.OS === 'web') return;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return;

  if (snapshot.mode === 'suggested' && !suggestedNoticeSent) {
    suggestedNoticeSent = true;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Battery at 30%',
        body: 'Trail Power Mode is available to reduce nonessential work before your battery gets low.',
        sound: 'default',
      },
      trigger: null,
    });
  }

  if (snapshot.mode === 'critical' && !criticalNoticeSent) {
    criticalNoticeSent = true;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Trail Power Mode enabled',
        body: 'Battery is at 15% or lower. Go Melanated will reduce location sampling while keeping safety controls available.',
        sound: 'default',
      },
      trigger: null,
    });
  }
}

export function subscribeTrailPower(listener: Listener) {
  listeners.add(listener);
  listener(getTrailPowerSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function setTrailPowerManualEnabled(enabled: boolean) {
  manualEnabled = enabled;
  emit();
}

export function getTrailLocationPolicy() {
  const mode = modeForState();
  if (mode === 'critical') return { distanceInterval: 75, timeInterval: 180_000, breadcrumbDistance: 75 };
  if (mode === 'trail_power') return { distanceInterval: 50, timeInterval: 120_000, breadcrumbDistance: 50 };
  return { distanceInterval: 30, timeInterval: 60_000, breadcrumbDistance: 30 };
}

export function shouldDeferNonessentialWork() {
  const mode = modeForState();
  return mode === 'trail_power' || mode === 'critical';
}

export function startTrailPowerMonitor() {
  if (started) return () => undefined;
  started = true;

  void Battery.getPowerStateAsync().then((state) => {
    batteryLevel = state.batteryLevel;
    lowPowerMode = state.lowPowerMode;
    emit();
  }).catch(() => undefined);

  batterySubscription = Battery.addBatteryLevelListener((event) => {
    batteryLevel = event.batteryLevel;
    emit();
  });
  lowPowerSubscription = Battery.addLowPowerModeListener((event) => {
    lowPowerMode = event.lowPowerMode;
    emit();
  });

  return () => {
    batterySubscription?.remove();
    lowPowerSubscription?.remove();
    batterySubscription = null;
    lowPowerSubscription = null;
    started = false;
  };
}
