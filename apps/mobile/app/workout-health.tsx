import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  connectSamsungHealth,
  DEFAULT_HEALTH_TOGGLES,
  disconnectSamsungHealth,
  getHealthConnectStatus,
  importSamsungHealthWorkouts,
  isHealthConnectSupported,
  type HealthConnectStatus,
  type HealthToggles,
} from '../src/workout/healthConnect';

type ToggleKey = keyof HealthToggles;

const BG = '#0A0D0B';
const CARD = '#151A17';
const LINE = '#29312C';
const TEXT = '#F7FAF8';
const MUTED = '#96A19B';
const ACCENT = '#D6FF43';

export default function WorkoutHealthScreen() {
  const [status, setStatus] = useState<HealthConnectStatus>({ available: false, connected: false, permissions: [] });
  const [toggles, setToggles] = useState<HealthToggles>(DEFAULT_HEALTH_TOGGLES);
  const [busy, setBusy] = useState<'status' | 'connect' | 'sync' | 'disconnect' | null>('status');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setBusy('status');
    try {
      setStatus(await getHealthConnectStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read Health Connect status.');
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect() {
    setBusy('connect');
    setMessage('');
    try {
      const next = await connectSamsungHealth(toggles);
      setStatus(next);
      setMessage(next.connected ? 'Samsung Health is connected through Health Connect.' : 'Workout access was not granted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Samsung Health could not be connected.');
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy('sync');
    setMessage('');
    try {
      const result = await importSamsungHealthWorkouts(30, toggles);
      if (result.imported.length) {
        setMessage(
          String(result.imported.length) +
            ' new Samsung Health workout' +
            (result.imported.length === 1 ? '' : 's') +
            ' added to history.',
        );
      } else {
        setMessage(
          'Sync complete. ' +
            String(result.found) +
            ' Samsung Health workout' +
            (result.found === 1 ? '' : 's') +
            ' found and no duplicates added.',
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Samsung Health sync failed.');
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy('disconnect');
    setMessage('');
    try {
      await disconnectSamsungHealth();
      const next = await getHealthConnectStatus();
      setStatus(next);
      setMessage('Health Connect access removed from Go Workout.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Health Connect access could not be removed.');
    } finally {
      setBusy(null);
    }
  }

  function toggle(key: ToggleKey, value: boolean) {
    if (key === 'workouts') return;
    setToggles((current) => ({ ...current, [key]: value }));
  }

  const supported = isHealthConnectSupported();
  const labels: Record<ToggleKey, string> = {
    workouts: 'Workouts',
    heartRate: 'Heart rate',
    calories: 'Calories',
    distance: 'Distance',
    steps: 'Steps',
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>‹ Workout</Text>
        </Pressable>

        <Text style={styles.eyebrow}>CONNECTED HEALTH</Text>
        <Text style={styles.title}>Samsung Health</Text>
        <Text style={styles.subtitle}>
          Galaxy Watch workout data reaches Go Workout through Samsung Health and Android Health Connect.
        </Text>

        <View style={[styles.statusCard, status.connected && styles.statusConnected]}>
          <Text style={styles.statusLabel}>STATUS</Text>
          <Text style={styles.statusValue}>
            {!supported
              ? 'ANDROID BUILD REQUIRED'
              : busy === 'status'
                ? 'CHECKING…'
                : status.connected
                  ? 'CONNECTED'
                  : status.available
                    ? 'READY TO CONNECT'
                    : 'HEALTH CONNECT UNAVAILABLE'}
          </Text>
          <Text style={styles.statusCopy}>Go Workout reads only the health categories you approve.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>SYNC</Text>
          <Text style={styles.cardTitle}>Workout data</Text>
          {(Object.keys(toggles) as ToggleKey[]).map((key) => (
            <View style={styles.row} key={key}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{labels[key]}</Text>
                {key === 'workouts' ? <Text style={styles.rowDetail}>Required to import exercise sessions</Text> : null}
              </View>
              <Switch
                value={toggles[key]}
                disabled={key === 'workouts' || !supported || Boolean(busy)}
                onValueChange={(value) => toggle(key, value)}
              />
            </View>
          ))}
        </View>

        {message ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        {supported && !status.connected ? (
          <Pressable style={styles.primary} onPress={() => void connect()} disabled={Boolean(busy)}>
            {busy === 'connect' ? <ActivityIndicator color={BG} /> : <Text style={styles.primaryText}>CONNECT SAMSUNG HEALTH</Text>}
          </Pressable>
        ) : null}

        {supported && status.connected ? (
          <View style={styles.actions}>
            <Pressable style={styles.primary} onPress={() => void sync()} disabled={Boolean(busy)}>
              {busy === 'sync' ? <ActivityIndicator color={BG} /> : <Text style={styles.primaryText}>SYNC LAST 30 DAYS</Text>}
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => void disconnect()} disabled={Boolean(busy)}>
              <Text style={styles.secondaryText}>DISCONNECT</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.privacy}>
          <Text style={styles.privacyTitle}>Private by default</Text>
          <Text style={styles.privacyText}>
            Imported heart rate and calories stay with your Workout data. They are not shared with workout partners.
            Imported wearable sessions do not create fake sets, reps, weights, or PRs.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  back: { color: ACCENT, fontWeight: '800', fontSize: 16 },
  eyebrow: { color: ACCENT, fontWeight: '900', fontSize: 10, letterSpacing: 1.4, marginTop: 8 },
  title: { color: TEXT, fontSize: 36, fontWeight: '900' },
  subtitle: { color: MUTED, lineHeight: 21, maxWidth: 620 },
  statusCard: { backgroundColor: CARD, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: LINE, gap: 6 },
  statusConnected: { borderColor: '#4D8B5C' },
  statusLabel: { color: MUTED, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  statusValue: { color: TEXT, fontSize: 18, fontWeight: '900' },
  statusCopy: { color: MUTED, lineHeight: 19 },
  card: { backgroundColor: CARD, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: LINE, gap: 3 },
  cardEyebrow: { color: ACCENT, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  cardTitle: { color: TEXT, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: TEXT, fontWeight: '800' },
  rowDetail: { color: MUTED, fontSize: 11 },
  message: { padding: 13, borderRadius: 12, backgroundColor: '#1D2821', borderWidth: 1, borderColor: '#35483C' },
  messageText: { color: '#C9D5CD', lineHeight: 19 },
  actions: { gap: 9 },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: BG, fontWeight: '900', letterSpacing: 0.5 },
  secondary: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: TEXT, fontWeight: '900' },
  privacy: { padding: 16, borderRadius: 14, backgroundColor: '#101612', borderWidth: 1, borderColor: LINE, gap: 5 },
  privacyTitle: { color: TEXT, fontWeight: '900' },
  privacyText: { color: MUTED, lineHeight: 19 },
});
