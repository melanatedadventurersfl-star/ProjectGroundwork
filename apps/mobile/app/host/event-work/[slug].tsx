import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LegacyEventWorkRedirect() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();

  useEffect(() => {
    if (!slug) {
      router.replace('/host/events' as never);
      return;
    }
    router.replace(`/host/campaigns/${slug}/tasks` as never);
  }, [slug]);

  return <SafeAreaView style={styles.safe}>
    <View style={styles.center}>
      <ActivityIndicator color="#D7B45A" />
      <Text style={styles.muted}>Opening event tasks…</Text>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#8D9891', fontSize: 11 },
});
