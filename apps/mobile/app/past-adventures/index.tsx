import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdventureCard } from '../../src/adventures/AdventureCard';
import { listPastAdventures, setAdventureSaved } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';

export default function PastAdventuresScreen() {
  const [items, setItems] = useState<AdventureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await listPastAdventures());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load past adventures.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleSaved(adventure: AdventureSummary) {
    const next = !adventure.is_saved;
    setItems((current) => current.map((item) => item.id === adventure.id ? { ...item, is_saved: next } : item));
    try {
      await setAdventureSaved(adventure.id, next);
    } catch (caught) {
      setItems((current) => current.map((item) => item.id === adventure.id ? { ...item, is_saved: adventure.is_saved } : item));
      setError(caught instanceof Error ? caught.message : 'Unable to update saved adventure.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
            <Text style={styles.eyebrow}>MEMORIES LIVE HERE</Text>
            <Text style={styles.title}>Past Adventures</Text>
            <Text style={styles.intro}>Revisit completed MA adventures. Verified attendees can add memories and shared photos from their Passport journey pages.</Text>
            {loading ? <ActivityIndicator color="#D7B45A" /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => <AdventureCard adventure={item} onToggleSaved={toggleSaved} />}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={!loading ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No past adventures yet</Text><Text style={styles.emptyBody}>Completed official adventures will collect here over time.</Text></View> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 18, paddingBottom: 42 }, header: { gap: 10, marginBottom: 18 }, back: { color: '#D7B45A', fontWeight: '800', fontSize: 16 }, eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, fontWeight: '900' }, intro: { color: '#AEB8B2', lineHeight: 21 }, error: { color: '#FFB4A9' }, emptyCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 20 }, emptyTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', textAlign: 'center' }, emptyBody: { color: '#AEB8B2', lineHeight: 20, textAlign: 'center', marginTop: 6 },
});
