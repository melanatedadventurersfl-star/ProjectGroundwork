import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getJourney, getPassportStamps, type JourneyItem, type PassportStamp } from '../../src/passport/api';

export default function PassportScreen() {
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextJourney, nextStamps] = await Promise.all([getJourney(), getPassportStamps()]);
      setJourney(nextJourney);
      setStamps(nextStamps);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your Passport.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={journey}
        keyExtractor={(item) => item.adventure_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR EXPERIENCES</Text>
            <Text style={styles.title}>Passport</Text>
            <Text style={styles.intro}>A living record of where you went, what you earned, and what stayed with you.</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statNumber}>{journey.length}</Text><Text style={styles.statLabel}>Adventures</Text></View>
              <View style={styles.stat}><Text style={styles.statNumber}>{stamps.length}</Text><Text style={styles.statLabel}>Stamps</Text></View>
              <View style={styles.stat}><Text style={styles.statNumber}>{journey.filter((item) => item.reflection).length}</Text><Text style={styles.statLabel}>Reflections</Text></View>
            </View>
            {stamps.length ? (
              <View style={styles.stampRail}>
                {stamps.slice(0, 6).map((stamp) => (
                  <View key={`${stamp.stamp_id}-${stamp.adventure_id ?? ''}`} style={styles.stamp}>
                    <Text style={styles.stampTitle}>{stamp.title}</Text>
                    <Text style={styles.stampDate}>{new Date(stamp.earned_at).toLocaleDateString()}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>Journey</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Your first completed adventure will begin this timeline.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/passport/reflection/${item.adventure_id}`)}>
            <Text style={styles.date}>{new Date(item.experienced_at ?? item.starts_at).toLocaleDateString()}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>{item.category} · {item.city}, {item.state}</Text>
            <Text style={styles.meta}>{item.stamp_count} stamp{Number(item.stamp_count) === 1 ? '' : 's'} earned</Text>
            {item.highlight ? <Text style={styles.highlight}>“{item.highlight}”</Text> : <Text style={styles.prompt}>Add a reflection</Text>}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  center: { flex: 1, backgroundColor: '#0f1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 42, gap: 12 },
  header: { gap: 12, marginBottom: 4 },
  eyebrow: { color: '#d3a94f', fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#fff8e8', fontSize: 34, fontWeight: '900' },
  intro: { color: '#cbd2cd', fontSize: 16, lineHeight: 23 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: '#17211c', borderRadius: 16, padding: 14 },
  statNumber: { color: '#fff8e8', fontSize: 26, fontWeight: '900' },
  statLabel: { color: '#9fa9a2', fontSize: 12, marginTop: 3 },
  stampRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stamp: { width: '48%', borderWidth: 1, borderColor: '#d3a94f', borderRadius: 14, padding: 12 },
  stampTitle: { color: '#fff8e8', fontWeight: '900' },
  stampDate: { color: '#9fa9a2', fontSize: 12, marginTop: 5 },
  sectionTitle: { color: '#fff8e8', fontSize: 23, fontWeight: '900', marginTop: 4 },
  card: { backgroundColor: '#17211c', borderRadius: 18, padding: 17, gap: 6 },
  date: { color: '#d3a94f', fontWeight: '900', fontSize: 12 },
  cardTitle: { color: '#fff8e8', fontSize: 20, fontWeight: '900' },
  meta: { color: '#9fa9a2' },
  highlight: { color: '#e4e9e5', fontSize: 16, lineHeight: 23, marginTop: 8 },
  prompt: { color: '#d3a94f', fontWeight: '800', marginTop: 8 },
  error: { color: '#ffb4a9' },
  empty: { color: '#cbd2cd', textAlign: 'center', marginTop: 32 },
});
