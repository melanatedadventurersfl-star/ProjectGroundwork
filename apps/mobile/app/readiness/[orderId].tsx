import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getNextBestAction, getReadinessItems, updateReadinessStatus } from '../../src/readiness/api';
import type { ReadinessItem, ReadinessStatus } from '../../src/readiness/types';

export default function ReadinessScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!orderId) return;
    try {
      setLoading(true);
      setItems(await getReadinessItems(orderId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load readiness.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orderId]);

  const required = items.filter((item) => item.is_required);
  const complete = required.filter((item) => ['complete', 'waived'].includes(item.status)).length;
  const score = required.length === 0 ? 100 : Math.round((complete / required.length) * 100);
  const nextAction = useMemo(() => getNextBestAction(items), [items]);

  async function setStatus(item: ReadinessItem, status: ReadinessStatus) {
    try {
      await updateReadinessStatus(item.id, status);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status } : entry)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update task.');
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ADVENTURE READINESS</Text>
        <Text style={styles.title}>{score}% ready</Text>
        <Text style={styles.subtitle}>{complete} of {required.length} required items complete</Text>

        {nextAction ? (
          <View style={styles.nextAction}>
            <Text style={styles.nextLabel}>NEXT BEST ACTION</Text>
            <Text style={styles.nextTitle}>{nextAction.title}</Text>
            <Text style={styles.nextBody}>{nextAction.description ?? 'Complete this item to keep your adventure on track.'}</Text>
          </View>
        ) : (
          <View style={styles.readyPanel}>
            <Text style={styles.readyTitle}>You are ready.</Text>
            <Text style={styles.nextBody}>Everything required for this adventure is complete.</Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {items.map((item) => (
          <View key={item.id} style={[styles.card, item.blocks_check_in && item.status !== 'complete' && styles.blockerCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.status}>{item.status.replace('_', ' ')}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.description ? <Text style={styles.cardBody}>{item.description}</Text> : null}
            {item.due_at ? <Text style={styles.due}>Due {new Date(item.due_at).toLocaleString()}</Text> : null}
            {item.blocks_check_in ? <Text style={styles.blocker}>Must be complete before check-in</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={() => void setStatus(item, 'in_progress')}>
                <Text style={styles.secondaryText}>In progress</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => void setStatus(item, 'complete')}>
                <Text style={styles.primaryText}>Mark complete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1713' },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  eyebrow: { color: '#d3a94f', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#fff8e8', fontSize: 36, fontWeight: '900' },
  subtitle: { color: '#cbd3ce', fontSize: 16 },
  nextAction: { backgroundColor: '#d3a94f', borderRadius: 18, padding: 18, gap: 6 },
  readyPanel: { backgroundColor: '#1f5d3f', borderRadius: 18, padding: 18, gap: 6 },
  nextLabel: { color: '#17211c', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  nextTitle: { color: '#17211c', fontSize: 22, fontWeight: '900' },
  readyTitle: { color: '#fff8e8', fontSize: 22, fontWeight: '900' },
  nextBody: { color: '#27352e', lineHeight: 21 },
  card: { backgroundColor: '#17211c', borderRadius: 18, padding: 17, gap: 8 },
  blockerCard: { borderWidth: 1, borderColor: '#d9785d' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  category: { color: '#d3a94f', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  status: { color: '#cbd3ce', fontSize: 12, textTransform: 'capitalize' },
  cardTitle: { color: '#fff8e8', fontSize: 19, fontWeight: '800' },
  cardBody: { color: '#cbd3ce', lineHeight: 21 },
  due: { color: '#f1d690', fontSize: 13 },
  blocker: { color: '#ffb4a9', fontWeight: '800', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryButton: { flex: 1, backgroundColor: '#d3a94f', borderRadius: 12, padding: 12, alignItems: 'center' },
  primaryText: { color: '#17211c', fontWeight: '900' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#f2ead8', borderRadius: 12, padding: 12, alignItems: 'center' },
  secondaryText: { color: '#f2ead8', fontWeight: '800' },
  error: { color: '#ffb4a9' },
});
