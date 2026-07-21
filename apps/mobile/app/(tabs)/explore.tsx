import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdventureCard } from '../../src/adventures/AdventureCard';
import { listAdventures, setAdventureSaved } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';

const categories = ['All', 'Camping', 'Hiking', 'Water', 'Travel', 'Culture'];

export default function ExploreScreen() {
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      search,
      category: category === 'All' ? undefined : category,
      savedOnly,
    }),
    [search, category, savedOnly],
  );

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setAdventures(await listAdventures(filters));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load adventures.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function toggleSaved(adventure: AdventureSummary) {
    const nextSaved = !adventure.is_saved;
    setAdventures((current) => current.map((item) => item.id === adventure.id ? { ...item, is_saved: nextSaved } : item));
    try {
      await setAdventureSaved(adventure.id, nextSaved);
      if (savedOnly && !nextSaved) setAdventures((current) => current.filter((item) => item.id !== adventure.id));
    } catch (caught) {
      setAdventures((current) => current.map((item) => item.id === adventure.id ? { ...item, is_saved: adventure.is_saved } : item));
      setError(caught instanceof Error ? caught.message : 'Unable to update saved adventure.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={adventures}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Find your next outside</Text>
            <Text style={styles.heading}>Explore Adventures</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by adventure, city, or vibe"
              placeholderTextColor="#7f8c84"
              style={styles.search}
              accessibilityLabel="Search adventures"
            />
            <View style={styles.filterRow}>
              {categories.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.filter, category === item && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, category === item && styles.filterTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setSavedOnly((value) => !value)} style={styles.savedToggle}>
              <Text style={styles.savedToggleText}>{savedOnly ? 'Showing saved adventures' : 'Show saved adventures'}</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? <ActivityIndicator /> : null}
          </View>
        }
        renderItem={({ item }) => <AdventureCard adventure={item} onToggleSaved={toggleSaved} />}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No adventures match those filters yet.</Text> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  content: { padding: 18, paddingBottom: 36 },
  header: { gap: 14, marginBottom: 18 },
  eyebrow: { color: '#d3a94f', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  heading: { color: '#fff8e8', fontSize: 34, lineHeight: 38, fontWeight: '900' },
  search: { backgroundColor: '#17211c', color: '#fff8e8', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderWidth: 1, borderColor: '#526057', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  filterSelected: { backgroundColor: '#d3a94f', borderColor: '#d3a94f' },
  filterText: { color: '#d4d8d5', fontWeight: '700' },
  filterTextSelected: { color: '#17211c' },
  savedToggle: { alignSelf: 'flex-start' },
  savedToggleText: { color: '#f2ead8', textDecorationLine: 'underline', fontWeight: '700' },
  error: { color: '#ffb4a9' },
  empty: { color: '#aeb8b2', textAlign: 'center', paddingVertical: 48 },
});
