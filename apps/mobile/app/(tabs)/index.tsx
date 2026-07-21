import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getAdventureQueue } from '../../src/readiness/api';
import type { AdventureQueueItem } from '../../src/readiness/types';

export default function TrailheadScreen() {
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setQueue(await getAdventureQueue());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your adventure queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const primaryAdventure = queue[0];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      <Text style={styles.eyebrow}>MELANATED ADVENTURERS</Text>
      <Text style={styles.title}>Trailhead</Text>
      <Text style={styles.intro}>Your starting point for getting outside, getting ready, and staying connected.</Text>

      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {primaryAdventure ? (
        <Pressable
          style={styles.primaryTile}
          onPress={() => router.push({ pathname: '/readiness/[orderId]', params: { orderId: primaryAdventure.order_id } })}
        >
          <Text style={styles.primaryLabel}>PRIMARY ADVENTURE</Text>
          <Text style={styles.primaryTitle}>{primaryAdventure.title}</Text>
          <Text style={styles.primaryMeta}>{new Date(primaryAdventure.starts_at).toLocaleDateString()} · {primaryAdventure.city}, {primaryAdventure.state}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{primaryAdventure.readiness_score}% ready</Text>
            <Text style={primaryAdventure.blocker_count > 0 ? styles.blocker : styles.clear}>
              {primaryAdventure.blocker_count > 0 ? `${primaryAdventure.blocker_count} blocker${primaryAdventure.blocker_count === 1 ? '' : 's'}` : 'No blockers'}
            </Text>
          </View>
          <Text style={styles.primaryAction}>Continue getting ready →</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.emptyTile} onPress={() => router.push('/(tabs)/explore')}>
          <Text style={styles.emptyTitle}>Find your next adventure</Text>
          <Text style={styles.emptyBody}>Explore upcoming experiences and build your first adventure queue.</Text>
        </Pressable>
      )}

      {queue.length > 1 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adventure Queue</Text>
          {queue.slice(1).map((item) => (
            <Pressable
              key={item.order_id}
              style={styles.queueCard}
              onPress={() => router.push({ pathname: '/readiness/[orderId]', params: { orderId: item.order_id } })}
            >
              <View style={styles.queueCopy}>
                <Text style={styles.queueTitle}>{item.title}</Text>
                <Text style={styles.queueMeta}>{new Date(item.starts_at).toLocaleDateString()} · {item.city}</Text>
              </View>
              <Text style={styles.queueScore}>{item.readiness_score}%</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.grid}>
        <Pressable style={styles.tile} onPress={() => router.push('/(tabs)/explore')}>
          <Text style={styles.tileTitle}>Find your next adventure</Text>
          <Text style={styles.tileDetail}>Explore upcoming experiences near you.</Text>
        </Pressable>
        <Pressable style={styles.tile} onPress={() => router.push('/(tabs)/community')}>
          <Text style={styles.tileTitle}>Around the campfire</Text>
          <Text style={styles.tileDetail}>Community updates and conversations live here.</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F7F3EA', paddingHorizontal: 16, paddingTop: 64, paddingBottom: 32 },
  eyebrow: { color: '#24543B', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#17211B', fontSize: 32, fontWeight: '800', marginTop: 8 },
  intro: { color: '#56615A', fontSize: 16, lineHeight: 24, marginTop: 8, marginBottom: 24 },
  primaryTile: { backgroundColor: '#24543B', borderRadius: 18, padding: 20, gap: 8, marginBottom: 20 },
  primaryLabel: { color: '#E4C56F', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  primaryTitle: { color: '#FFF8E8', fontSize: 26, lineHeight: 30, fontWeight: '900' },
  primaryMeta: { color: '#DCE6E0', fontSize: 14 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  score: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  blocker: { color: '#FFB4A9', fontWeight: '800' },
  clear: { color: '#BFE2C9', fontWeight: '800' },
  primaryAction: { color: '#E4C56F', fontWeight: '900', marginTop: 8 },
  emptyTile: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, gap: 8, marginBottom: 20 },
  emptyTitle: { color: '#17211B', fontSize: 22, fontWeight: '900' },
  emptyBody: { color: '#56615A', lineHeight: 21 },
  section: { marginBottom: 20, gap: 10 },
  sectionTitle: { color: '#17211B', fontSize: 22, fontWeight: '900' },
  queueCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  queueCopy: { flex: 1 },
  queueTitle: { color: '#17211B', fontSize: 17, fontWeight: '800' },
  queueMeta: { color: '#56615A', marginTop: 4 },
  queueScore: { color: '#24543B', fontSize: 18, fontWeight: '900' },
  grid: { gap: 12 },
  tile: { minHeight: 120, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, justifyContent: 'space-between' },
  tileTitle: { color: '#17211B', fontSize: 20, fontWeight: '700' },
  tileDetail: { color: '#56615A', fontSize: 14, lineHeight: 20, marginTop: 20 },
  error: { color: '#A23D2B', marginBottom: 12 },
});
