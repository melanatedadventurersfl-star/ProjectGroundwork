import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logStartupStage, withStartupTimeout } from '../reliability/startup';
import { rememberExpectedOtaUpdate } from './otaActivation';

const UPDATE_NETWORK_TIMEOUT_MS = 10000;
const FIRST_CHECK_DELAY_MS = 2500;
const ACTIVE_POLL_INTERVAL_MS = 5 * 60 * 1000;
const FOREGROUND_CHECK_THROTTLE_MS = 60 * 1000;

type UpdateState = 'idle' | 'checking' | 'ready' | 'restarting' | 'error';
type DownloadedUpdateIdentity = { updateId: string | null; commit: string | null };

function downloadedUpdateIdentity(fetched: unknown): DownloadedUpdateIdentity {
  const manifest = (fetched as any)?.manifest;
  const candidates = [manifest?.extra?.expoClient?.extra, manifest?.extra?.expoGo?.extra, manifest?.extra];
  const extra = candidates.find((value) => value && typeof value === 'object');
  const commit = typeof extra?.buildCommit === 'string' && extra.buildCommit.trim() ? extra.buildCommit.trim() : null;
  const updateId = typeof manifest?.id === 'string' && manifest.id.trim() ? manifest.id.trim() : null;
  return { updateId, commit };
}

export function BackgroundUpdateManager({ disabled = false }: { disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<UpdateState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);
  const updateReadyRef = useRef(false);

  const checkForUpdate = useCallback(async (force = false) => {
    if (disabled || !Updates.isEnabled || checkingRef.current || updateReadyRef.current) return;

    const now = Date.now();
    if (!force && now - lastCheckRef.current < FOREGROUND_CHECK_THROTTLE_MS) return;

    checkingRef.current = true;
    lastCheckRef.current = now;
    setState('checking');
    logStartupStage('background-update-check');

    try {
      const result = await withStartupTimeout(
        Updates.checkForUpdateAsync(),
        'Background update check',
        UPDATE_NETWORK_TIMEOUT_MS,
      );

      if (!result.isAvailable) {
        setState('idle');
        setMessage(null);
        return;
      }

      logStartupStage('background-update-fetch');
      const fetched = await withStartupTimeout(
        Updates.fetchUpdateAsync(),
        'Background update download',
        UPDATE_NETWORK_TIMEOUT_MS,
      );

      if (!fetched.isNew) {
        setState('idle');
        setMessage(null);
        return;
      }

      const expected = downloadedUpdateIdentity(fetched);
      await rememberExpectedOtaUpdate({ ...expected, createdAt: new Date().toISOString() });
      logStartupStage('background-update-downloaded', expected);

      updateReadyRef.current = true;
      setState('ready');
      setMessage('A new Go Melanated update is ready. Restart once to apply it.');
    } catch (error) {
      console.warn('[updates] Background OTA check failed', error);
      setState('error');
      setMessage(null);
    } finally {
      checkingRef.current = false;
    }
  }, [disabled]);

  const restartAndUpdate = useCallback(async () => {
    if (!updateReadyRef.current || state === 'restarting') return;

    setState('restarting');
    setMessage('Restarting with the new update…');
    logStartupStage('background-update-reload-requested');

    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.warn('[updates] In-process OTA reload failed', error);
      setState('ready');
      setMessage('The update is downloaded. If restart does not complete, close and reopen Go Melanated once.');
    }
  }, [state]);

  useEffect(() => {
    if (disabled || !Updates.isEnabled) return;

    const initialTimer = setTimeout(() => void checkForUpdate(true), FIRST_CHECK_DELAY_MS);
    const pollTimer = setInterval(() => {
      if (AppState.currentState === 'active') void checkForUpdate(false);
    }, ACTIVE_POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void checkForUpdate(false);
    });

    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollTimer);
      subscription.remove();
    };
  }, [checkForUpdate, disabled]);

  if ((state !== 'ready' && state !== 'restarting') || !message) return null;

  const restarting = state === 'restarting';

  return (
    <View style={[styles.banner, { top: Math.max(insets.top, 8) + 8 }]}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{restarting ? 'APPLYING UPDATE' : 'UPDATE READY'}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Restart and apply update"
        disabled={restarting}
        style={[styles.restartButton, restarting && styles.restartButtonDisabled]}
        onPress={() => void restartAndUpdate()}
      >
        {restarting ? (
          <ActivityIndicator size="small" color="#102018" />
        ) : (
          <Text style={styles.restartText}>Restart & Update</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', left: 12, right: 12, zIndex: 200, elevation: 20, minHeight: 70,
    borderRadius: 18, borderWidth: 1, borderColor: '#4A5A4E', backgroundColor: '#17211C',
    paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  copy: { flex: 1, gap: 2 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  message: { color: '#FFF8E8', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  restartButton: { minWidth: 92, borderRadius: 12, backgroundColor: '#D7B45A', paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  restartButtonDisabled: { opacity: 0.75 },
  restartText: { color: '#102018', fontSize: 11, fontWeight: '900', textAlign: 'center' },
});
