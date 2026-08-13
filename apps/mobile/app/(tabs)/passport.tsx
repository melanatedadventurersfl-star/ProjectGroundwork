import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const photoCount = useMemo(() => journey.reduce((total, item) => total + item.photo_count, 0), [journey]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={journey}
        keyExtractor={(item) => item.adventure_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#D7B45A" />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR ADVENTURE HISTORY</Text>
            <Text style={styles.title}>Passport</Text>
            <Text style={styles.intro}>The places you went, the stamps you earned, and the memories you decided to keep.</Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statNumber}>{journey.length}</Text><Text style={styles.statLabel}>Adventures</Text></View>
              <View style={styles.stat}><Text style={styles.statNumber}>{stamps.length}</Text><Text style={styles.statLabel}>Stamps</Text></View>
              <View style={styles.stat}><Text style={styles.statNumber}>{photoCount}</Text><Text style={styles.statLabel}>Photos</Text></View>
            </View>

            {stamps.length ? (
              <View style={styles.stampSection}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionTitle}>Stamps & badges</Text>
                  <Text style={styles.sectionMeta}>{stamps.length} earned</Text>
                </View>
                <View style={styles.stampRail}>
                  {stamps.slice(0, 6).map((stamp) => (
                    <View key={`${stamp.stamp_id}-${stamp.adventure_id ?? ''}`} style={styles.stamp}>
                      <Text style={styles.stampMark}>✦</Text>
                      <Text style={styles.stampTitle}>{stamp.title}</Text>
                      <Text style={styles.stampDate}>{new Date(stamp.earned_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Journey timeline</Text>
              <Text style={styles.sectionMeta}>Completed experiences</Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your first chapter is still ahead.</Text>
            <Text style={styles.empty}>Completed registered adventures will appear here automatically.</Text>
            <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.emptyAction}>Explore adventures →</Text></Pressable>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={styles.timelineDot} />
              {index < journey.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <Pressable style={styles.card} onPress={() => router.push(`/passport/reflection/${item.adventure_id}`)}>
              <Text style={styles.date}>{new Date(item.experienced_at ?? item.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.category} · {item.city}, {item.state}</Text>
              <View style={styles.memoryStats}>
                <Text style={styles.memoryStat}>{item.stamp_count} stamp{Number(item.stamp_count) === 1 ? '' : 's'}</Text>
                <Text style={styles.memoryStat}>{item.photo_count} photo{item.photo_count === 1 ? '' : 's'}</Text>
              </View>
              {item.highlight ? <Text style={styles.highlight}>“{item.highlight}”</Text> : <Text style={styles.prompt}>Add a reflection and memories →</Text>}
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 42 },
  header: { gap: 12, marginBottom: 15 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  intro: { color: '#C7D0CA', fontSize: 16, lineHeight: 23 },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 2 },
  stat: { flex: 1, backgroundColor: '#17211C', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#28362E' },
  statNumber: { color: '#FFF8E8', fontSize: 26, fontWeight: '900' },
  statLabel: { color: '#8F9A93', fontSize: 12, marginTop: 3 },
  stampSection: { gap: 10, marginTop: 6 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginTop: 4 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  sectionMeta: { color: '#7F8B83', fontSize: 11 },
  stampRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stamp: { width: '48%', borderWidth: 1, borderColor: '#5C5134', backgroundColor: '#161F1A', borderRadius: 14, padding: 12 },
  stampMark: { color: '#D7B45A', fontSize: 18 },
  stampTitle: { color: '#FFF8E8', fontWeight: '900', marginTop: 4 },
  stampDate: { color: '#89958D', fontSize: 12, marginTop: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineRail: { width: 28, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D7B45A', marginTop: 20 },
  timelineLine: { width: 1, flex: 1, backgroundColor: '#405047', marginTop: 5 },
  card: { flex: 1, backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#28362E', padding: 17, gap: 6, marginBottom: 12 },
  date: { color: '#D7B45A', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  cardTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  meta: { color: '#99A49D' },
  memoryStats: { flexDirection: 'row', gap: 13, marginTop: 3 },
  memoryStat: { color: '#D6DFD9', fontSize: 12, fontWeight: '700' },
  highlight: { color: '#E4E9E5', fontSize: 15, lineHeight: 22, marginTop: 7 },
  prompt: { color: '#D7B45A', fontWeight: '800', marginTop: 7 },
  emptyCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 20, marginTop: 12, gap: 7 },
  emptyTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', textAlign: 'center' },
  empty: { color: '#AAB4AE', textAlign: 'center', lineHeight: 20 },
  emptyAction: { color: '#D7B45A', fontWeight: '900', textAlign: 'center', marginTop: 5 },
  error: { color: '#FFB4A9' },
});
