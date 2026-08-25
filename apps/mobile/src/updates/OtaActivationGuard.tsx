import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clearExpectedOtaUpdate, verifyExpectedOtaActivation, type OtaActivationResult } from './otaActivation';

export function OtaActivationGuard() {
  const [result, setResult] = useState<OtaActivationResult | null>(null);

  useEffect(() => {
    let mounted = true;
    void verifyExpectedOtaActivation().then((next) => {
      if (mounted && next && next.status !== 'activated') setResult(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!result) return null;

  const expected = result.expected.commit?.slice(0, 7) || result.expected.updateId?.slice(0, 8) || 'new update';
  const active = result.activeCommit?.slice(0, 7) || result.activeUpdateId?.slice(0, 8) || 'embedded build';
  const emergency = result.status === 'emergency-launch';

  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.eyebrow}>{emergency ? 'UPDATE ROLLED BACK' : 'UPDATE DID NOT ACTIVATE'}</Text>
      <Text style={styles.title}>Go Melanated restored the previous version.</Text>
      <Text style={styles.body}>
        Expected {expected}, but this launch is running {active}. The app will not report itself as current until the new update actually starts successfully.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss update activation warning"
        style={styles.button}
        onPress={() => {
          void clearExpectedOtaUpdate();
          setResult(null);
        }}
      >
        <Text style={styles.buttonText}>Dismiss</Text>
      </Pressable>
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
  button: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#D7B45A',
  },
  buttonText: {
    color: '#0F1713',
    fontWeight: '800',
  },
});
