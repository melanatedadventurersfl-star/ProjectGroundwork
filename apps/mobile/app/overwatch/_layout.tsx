import { router, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOverwatchAccess } from '../../src/overwatch/api';

export default function OverwatchLayout() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getOverwatchAccess()
      .then((value) => {
        if (!active) return;
        setAuthorized(value);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to verify Overwatch access.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Verifying Overwatch access…</Text></View></SafeAreaView>;
  }

  if (!authorized) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.eyebrow}>FOUNDER ACCESS</Text><Text style={styles.title}>Overwatch is locked.</Text><Text style={styles.muted}>{error || 'This workspace is reserved for the active founder account.'}</Text><Pressable style={styles.button} onPress={() => router.replace('/admin' as never)}><Text style={styles.buttonText}>Return to Admin</Text></Pressable></View></SafeAreaView>;
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B120E' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 28, fontWeight: '900', marginTop: 5 },
  muted: { color: '#93A098', fontSize: 12, lineHeight: 18, marginTop: 8, textAlign: 'center', maxWidth: 440 },
  button: { marginTop: 18, minHeight: 46, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7B45A' },
  buttonText: { color: '#172017', fontSize: 11, fontWeight: '900' },
});
