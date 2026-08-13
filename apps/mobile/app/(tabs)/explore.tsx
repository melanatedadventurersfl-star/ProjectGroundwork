import { router } from 'expo-router';
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
import { getEventHostAccess, listLocalEvents, type LocalEvent } from '../../src/local-events/api';

const categories = ['All', 'Camping', 'Hiking', 'Water', 'Travel', 'Culture'];
type ExploreMode = 'adventures' | 'local' | 'saved';

function LocalEventCard({ event }: { event: LocalEvent }) {
  const start = new Date(event.starts_at);
  return (
    <Pressable
      style={styles.localCard}
      onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}
    >
      <View style={styles.localTopRow}>
        <Text style={styles.localBadge}>LOCAL EVENT</Text>
        <Text style={styles.localRsvp}>{event.rsvp_count} going/interested</Text>
      </View>
      <Text style={styles.localTitle}>{event.title}</Text>
      <Text style={styles.localMeta}>
        {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {event.city}, {event.state}
      </Text>
      <Text style={styles.localHost}>Hosted by {event.host_name}</Text>
      <Text style={styles.localDescription} numberOfLines={3}>{event.description}</Text>
      <Text style={styles.localAction}>View local event →</Text>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const [mode, setMode] = useState<ExploreMode>('adventures');
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [canCreateLocalEvent, setCanCreateLocalEvent] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      search,
      category: category === 'All' ? undefined : category,
      savedOnly: mode === 'saved',
    }),
    [search, category, mode],
  );

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [nextAdventures, nextLocalEvents, access] = await Promise.all([
        listAdventures(filters),
        listLocalEvents(),
        getEventHostAccess(),
      ]);
      setAdventures(nextAdventures);
      setLocalEvents(nextLocalEvents);
      setCanCreateLocalEvent(access.canCreate);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Explore.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  async function toggleSaved(adventure: AdventureSummary) {
    const nextSaved = !adventure.is_saved;
    setAdventures((current) => current.map((item) => item.id === adventure.id ? { ...item, is_saved: nextSaved } : item));
    try {
      await setAdventureSaved(adventure.id, nextSaved);
      if (mode === 'saved' && !nextSaved) {
        setAdventures((current) => current.filter((item) => item.id !== adventure.id));
      }
    } catch (caught) {
      setAdventures((current) => current.map((item) => item.id === adventure.id ? { ...item, is_saved: adventure.is_saved } : item));
      setError(caught instanceof Error ? caught.message : 'Unable to update saved adventure.');
    }
  }

  const rows = mode === 'local' ? localEvents : adventures;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={rows as Array<AdventureSummary | LocalEvent>}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>FIND YOUR NEXT OUTSIDE</Text>
            <Text style={styles.heading}>Explore</Text>
            <View style={styles.modeRow}>
              {([
                ['adventures', 'Adventures'],
                ['local', 'Local Events'],
                ['saved', 'Saved'],
              ] as Array<[ExploreMode, string]>).map(([value, label]) => (
                <Pressable key={value} onPress={() => setMode(value)} style={[styles.modeButton, mode === value && styles.modeButtonActive]}>
                  <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'local' ? (
              <View style={styles.localIntro}>
                <Text style={styles.localIntroTitle}>Member-hosted, close to home.</Text>
                <Text style={styles.localIntroBody}>Local Events are lighter meetups hosted by trusted members. Official MA Adventures are always labeled separately.</Text>
                {canCreateLocalEvent ? (
                  <Pressable style={styles.createButton} onPress={() => router.push('/local-events/create')}>
                    <Text style={styles.createButtonText}>Create local event</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.hostNote}>Event posting unlocks for approved community hosts.</Text>
                )}
              </View>
            ) : (
              <>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={mode === 'saved' ? 'Search your saved adventures' : 'Search by adventure, city, or vibe'}
                  placeholderTextColor="#7F8C84"
                  style={styles.search}
                  accessibilityLabel="Search adventures"
                />
                <View style={styles.filterRow}>
                  {categories.map((item) => (
                    <Pressable key={item} onPress={() => setCategory(item)} style={[styles.filter, category === item && styles.filterSelected]}>
                      <Text style={[styles.filterText, category === item && styles.filterTextSelected]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
                {mode === 'saved' ? <Text style={styles.savedHint}>Everything you bookmark lives here.</Text> : null}
              </>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? <ActivityIndicator color="#D7B45A" /> : null}
          </View>
        }
        renderItem={({ item }) => mode === 'local'
          ? <LocalEventCard event={item as LocalEvent} />
          : <AdventureCard adventure={item as AdventureSummary} onToggleSaved={toggleSaved} />}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{mode === 'saved' ? 'No saved adventures yet' : mode === 'local' ? 'No local events nearby yet' : 'No adventures match those filters'}</Text>
            <Text style={styles.empty}>{mode === 'saved' ? 'Use the bookmark action on any adventure and it will show up here.' : 'Try another filter or check back soon.'}</Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 18, paddingBottom: 36 },
  header: { gap: 14, marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 12 },
  heading: { color: '#FFF8E8', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  modeRow: { flexDirection: 'row', backgroundColor: '#151F1A', borderRadius: 14, padding: 4, gap: 4 },
  modeButton: { flex: 1, borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  modeButtonActive: { backgroundColor: '#D7B45A' },
  modeText: { color: '#AAB4AE', fontWeight: '800', fontSize: 13 },
  modeTextActive: { color: '#152019' },
  search: { backgroundColor: '#17211C', color: '#FFF8E8', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#26342C' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderWidth: 1, borderColor: '#526057', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  filterSelected: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  filterText: { color: '#D4D8D5', fontWeight: '700' },
  filterTextSelected: { color: '#17211C' },
  savedHint: { color: '#98A49D', lineHeight: 20 },
  localIntro: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#29372F', padding: 16, gap: 8 },
  localIntroTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  localIntroBody: { color: '#C6CEC8', lineHeight: 21 },
  createButton: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#D7B45A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  createButtonText: { color: '#17211C', fontWeight: '900' },
  hostNote: { color: '#D7B45A', fontWeight: '800', marginTop: 4 },
  localCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#29372F', padding: 17, gap: 7 },
  localTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  localBadge: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  localRsvp: { color: '#87948B', fontSize: 12 },
  localTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 26, fontWeight: '900' },
  localMeta: { color: '#AEB8B2' },
  localHost: { color: '#D7B45A', fontWeight: '700' },
  localDescription: { color: '#D5DBD7', lineHeight: 21, marginTop: 2 },
  localAction: { color: '#FFF1C7', fontWeight: '900', marginTop: 5 },
  error: { color: '#FFB4A9' },
  emptyCard: { backgroundColor: '#151F1A', borderRadius: 18, padding: 20, marginTop: 8 },
  emptyTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  empty: { color: '#AEB8B2', textAlign: 'center', paddingTop: 7, lineHeight: 20 },
});
