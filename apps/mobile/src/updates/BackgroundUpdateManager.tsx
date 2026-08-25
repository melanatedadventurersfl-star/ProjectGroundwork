import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logStartupStage, withStartupTimeout } from '../reliability/startup';

const UPDATE_NETWORK_TIMEOUT_MS = 10000;
const FIRST_CHECK_DELAY_MS = 2500;
const FOREGROUND_CHECK_THROTTLE_MS = 15 * 60 * 1000;

type UpdateState = 'idle' | 'checking' | 'ready' | 'error';

export function BackgroundUpdateManager({ disabled = false }: { disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<UpdateState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);
  const dismissedRef = useRef(false);

  async function checkForUpdate(force = false) {
    if (disabled || !Updates.isEnabled || checkingRef.current || dismissedRef.current) return;

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
      await withStartupTimeout(
        Updates.fetchUpdateAsync(),
        'Background update download',
        UPDATE_NETWORK_TIMEOUT_MS,
      );

      setState('ready');
      setMessage('An update is ready. Restart once to apply it.');
    } catch (error) {
      console.warn('[updates] Background OTA check failed', error);
      setState('error');
      setMessage(null);
    } finally {
      checkingRef.current = false;
    }
  }

  useEffect(() => {
    if (disabled || !Updates.isEnabled) return;

    const timer = setTimeout(() => {
      void checkForUpdate(true);
    }, FIRST_CHECK_DELAY_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void checkForUpdate(false);
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [disabled]);

  if (state !== 'ready' || !message) return null;

  return (
    <View style={[styles.banner, { top: Math.max(insets.top, 8) + 8 }]}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>UPDATE READY</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Restart to apply update"
        style={styles.restartButton}
        onPress={() => {
          logStartupStage('background-update-reload');
          void Updates.reloadAsync();
        }}
      >
        <Text style={styles.restartText}>Restart</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apply update later"
        hitSlop={10}
        onPress={() => {
          dismissedRef.current = true;
          setState('idle');
          setMessage(null);
        }}
      >
        <Text style={styles.laterText}>Later</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 200,
    elevation: 20,
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#4A5A4E',
    backgroundColor: '#17211C',
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  copy: { flex: 1, gap: 2 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  message: { color: '#FFF8E8', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  restartButton: { borderRadius: 12, backgroundColor: '#D7B45A', paddingHorizontal: 12, paddingVertical: 9 },
  restartText: { color: '#102018', fontSize: 12, fontWeight: '900' },
  laterText: { color: '#A7B0AA', fontSize: 12, fontWeight: '800' },
});
