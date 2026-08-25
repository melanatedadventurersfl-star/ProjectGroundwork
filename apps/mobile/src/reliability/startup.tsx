import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type StartupStage =
  | 'root-mounted'
  | 'auth-restoring'
  | 'auth-ready'
  | 'navigation-ready'
  | 'update-check'
  | 'update-fetch'
  | 'update-reload'
  | 'first-screen';

const BOOT_WATCHDOG_MS = 12000;

export function logStartupStage(stage: StartupStage, details?: Record<string, unknown>) {
  const payload = {
    stage,
    at: new Date().toISOString(),
    ...details,
  };
  console.info('[startup]', JSON.stringify(payload));
}

export async function withStartupTimeout<T>(
  task: Promise<T>,
  label: string,
  timeoutMs = BOOT_WATCHDOG_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function useStartupWatchdog(ready: boolean, onTimeout: () => void, timeoutMs = BOOT_WATCHDOG_MS) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (ready) {
      firedRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      console.warn('[startup] Boot watchdog expired');
      onTimeout();
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [onTimeout, ready, timeoutMs]);
}

export function StartupLoadingView({ message = 'Getting the trail ready…' }: { message?: string }) {
  return (
    <View style={styles.screen} testID="startup-loading-screen">
      <Text style={styles.eyebrow}>GO MELANATED</Text>
      <Text style={styles.title}>Starting up</Text>
      <Text style={styles.copy}>{message}</Text>
    </View>
  );
}

export function StartupFailureView({
  error,
  onRetry,
}: {
  error?: unknown;
  onRetry: () => void;
}) {
  const diagnostic = error instanceof Error ? error.message : 'The app did not finish starting.';

  return (
    <View style={styles.screen} testID="startup-recovery-screen">
      <Text style={styles.eyebrow}>GO MELANATED</Text>
      <Text style={styles.title}>We hit a trail snag</Text>
      <Text style={styles.copy}>The app could not finish loading. Your account and data are still safe.</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
      <Text selectable style={styles.diagnostic}>Diagnostic: {diagnostic}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F1713',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 12,
  },
  eyebrow: {
    color: '#D7B45A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: '#FFF8E8',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  copy: {
    color: '#B7C0BA',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 420,
  },
  button: {
    marginTop: 10,
    minWidth: 180,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7B45A',
  },
  buttonText: {
    color: '#102018',
    fontSize: 16,
    fontWeight: '900',
  },
  diagnostic: {
    marginTop: 8,
    color: '#738078',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
