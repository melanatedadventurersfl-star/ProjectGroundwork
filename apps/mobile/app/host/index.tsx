import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAssignedAdventures } from '../../src/operations/api';

export default function HostOperationsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAssignedAdventures()
      .then(setItems)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load assignments.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>FIELD OPERATIONS</Text>
        <Text style={styles.title}>Host dashboard</Text>
        <Text style={styles.intro}>Assigned adventures, check-in, safety, schedules, and headcounts.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {items.length === 0 ? <Text style={styles.empty}>No active staff assignments.</Text> : null}
        {items.map((item) => {
          const adventure = item.adventures;
          return (
            <Pressable key={`${item.adventure_id}-${item.role}`} style={styles.card} onPress={() => router.push(`/host/${item.adventure_id}`)}>
              <Text style={styles.cardTitle}>{adventure?.title ?? 'Adventure'}</Text>
              <Text style={styles.cardMeta}>{item.role.replace('_', ' ')}{item.station ? ` • ${item.station}` : ''}</Text>
              <Text style={styles.cardMeta}>{adventure?.city}, {adventure?.state}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1713' },
  content: { padding: 22, gap: 14 },
  eyebrow: { color: '#d3a94f', fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#fff8e8', fontSize: 34, fontWeight: '900' },
  intro: { color: '#c9d0cb', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#17211c', padding: 18, borderRadius: 16, gap: 6 },
  cardTitle: { color: '#fff8e8', fontSize: 20, fontWeight: '900' },
  cardMeta: { color: '#c9d0cb', textTransform: 'capitalize' },
  empty: { color: '#c9d0cb', marginTop: 16 },
  error: { color: '#ffb4a9' },
});