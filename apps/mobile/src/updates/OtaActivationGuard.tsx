import Storage from 'expo-sqlite/kv-store';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { clearExpectedOtaUpdate, verifyExpectedOtaActivation, type OtaActivationResult } from './otaActivation';

const AUTO_RETRY_KEY = 'go-melanated:ota-auto-retry';

function expectedIdentity(result: OtaActivationResult) {
  return result.expected.updateId || result.expected.commit || result.expected.createdAt;
}

export function OtaActivationGuard() {
  const [result, setResult] = useState<OtaActivationResult | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const retryActivation = useCallback(async (next: OtaActivationResult, automatic = false) => {
    if (!Updates.isEnabled || next.status === 'emergency-launch') return;

    const identity = expectedIdentity(next);
    if (automatic) {
      const attempted = await Storage.getItem(AUTO_RETRY_KEY);
      if (attempted === identity) return;
      await Storage.setItem(AUTO_RETRY_KEY, identity);
    }

    setRetrying(true);
    setRetryError(null);
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.warn('[updates] OTA activation retry failed', error);
      setRetrying(false);
      setRetryError('The downloaded update could not restart automatically. Try again, or fully close and reopen the app once.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    void verifyExpectedOtaActivation().then((next) => {
      if (!mounted || !next || next.status === 'activated') return;
      setResult(next);

      if (next.status === 'mismatch' && Updates.isEnabled) {
        retryTimer = setTimeout(() => {
          if (mounted) void retryActivation(next, true);
        }, 900);
      }
    });

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [retryActivation]);

  if (!result) return null;

  const expected = result.expected.commit?.slice(0, 7) || result.expected.updateId?.slice(0, 8) || 'new update';
  const active = result.activeCommit?.slice(0, 7) || result.activeUpdateId?.slice(0, 8) || 'embedded build';
  const emergency = result.status === 'emergency-launch';

  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.eyebrow}>{emergency ? 'UPDATE ROLLED BACK' : retrying ? 'APPLYING DOWNLOADED UPDATE' : 'UPDATE DID NOT ACTIVATE'}</Text>
      <Text style={styles.title}>{emergency ? 'Go Melanated restored the previous version.' : 'A newer update is downloaded but this launch is still stale.'}</Text>
      <Text style={styles.body}>
        Expected {expected}, but this launch is running {active}. {emergency ? 'The app will stay on the stable version until another update is available.' : 'Go Melanated will retry the downloaded update once automatically.'}
      </Text>
      {retryError ? <Text style={styles.error}>{retryError}</Text> : null}
      <View style={styles.actions}>
        {!emergency ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try downloaded update again"
            disabled={retrying}
            style={[styles.button, retrying && styles.buttonDisabled]}
            onPress={() => void retryActivation(result, false)}
          >
            {retrying ? <ActivityIndicator size="small" color="#0F1713" /> : <Text style={styles.buttonText}>Try Update Again</Text>}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss update activation warning"
          style={styles.secondaryButton}
          onPress={() => {
            void clearExpectedOtaUpdate();
            setResult(null);
          }}
        >
          <Text style={styles.secondaryButtonText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#241C14',
    borderWidth: 1,
    borderColor: '#D7B45A',
  },
  eyebrow: {
    color: '#D7B45A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#FFF8E7',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },
  body: {
    color: '#E6DDCF',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  error: {
    color: '#FFB4A9',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  button: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#D7B45A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#0F1713',
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6E665B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#E6DDCF',
    fontWeight: '800',
  },
});
