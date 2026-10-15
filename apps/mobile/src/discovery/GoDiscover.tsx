import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { distanceMiles, pointForCity, type GeoPoint } from '../explore/location';
import { supabase } from '../lib/supabase';
import { AppIcon } from '../ui/AppIcon';
import { filterDiscovery, loadDiscoveryItems, proximityReason, type DiscoveryFilters, type DiscoveryItem } from './catalog';
import { ExperienceCard } from './GoHome';

const NAVY = '#172E49';
const INK = '#172122';
const BG = '#F7F8FA';
const MUTED = '#65727A';
const DEFAULT_FILTERS: DiscoveryFilters = { mode: 'all', query: '', when: 'any', radius: null, freeOnly: false, savedOnly: false };
const dateButtons: { key: DiscoveryFilters['when']; label: string }[] = [
  { key: 'any', label: 'Anytime' }, { key: 'today', label: 'Today' },
  { key: 'weekend', label: 'This Weekend' }, { key: 'week', label: 'Next 7 Days' },
];
const distanceButtons: { key: number | null; label: string }[] = [
  { key: null, label: 'Anywhere' }, { key: 10, label: '10 mi' },
  { key: 25, label: '25 mi' }, { key: 50, label: '50 mi' }, { key: 100, label: '100 mi' },
];
function openItem(item: DiscoveryItem) {
  if (item.source === 'adventure') router.push({ pathname: '/adventures/[id]', params: { id: item.id } });
  else if (item.source === 'demo') router.push({ pathname: '/demo-events/[id]', params: { id: item.id } });
  else router.push({ pathname: '/local-events/[id]', params: { id: item.id } });
}
function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }}
    onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>;
}

export default function GoDiscover() {
  const { session } = useAuth();
  const { mode: routeMode, q } = useLocalSearchParams<{ mode?: string; q?: string }>();
  const { width } = useWindowDimensions();
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [moreFilters, setMoreFilters] = useState(false);
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [homeLocation, setHomeLocation] = useState<{ city: string; state: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const setFilter = <K extends keyof DiscoveryFilters>(key: K, value: DiscoveryFilters[K]) =>
    setFilters(current => ({ ...current, [key]: value }));
  useEffect(() => {
    if (routeMode === 'nature' || routeMode === 'night' || routeMode === 'all') {
      setFilters(prev => ({ ...prev, mode: routeMode, query: typeof q === 'string' ? q : '' }));
    }
  }, [routeMode, q]);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    const [result, location] = await Promise.allSettled([
      loadDiscoveryItems(),
      session?.user.id
        ? supabase.from('profiles').select('home_city,home_state').eq('id', session.user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (result.status === 'fulfilled') { setItems(result.value); setError(null); }
    else setError('Unable to load discoveries right now. Pull down to retry.');
    if (location.status === 'fulfilled' && location.value.data?.home_city && location.value.data?.home_state) {
      setHomeLocation({ city: location.value.data.home_city, state: location.value.data.home_state });
    } else setHomeLocation(null);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const center: GeoPoint | null = useMemo(() => homeLocation ? pointForCity(homeLocation.city, homeLocation.state) : null, [homeLocation?.city, homeLocation?.state]);
  const visible = useMemo(() => filterDiscovery(items, filters, center), [items, filters, center]);
  const savedCategories = useMemo(() => new Set(items.filter(item => item.saved).map(item => item.category.trim().toLowerCase())), [items]);
  const recommended = useMemo(() => [...visible].sort((a, b) =>
    Number(savedCategories.has(b.category.toLowerCase())) - Number(savedCategories.has(a.category.toLowerCase())) ||
    Number(b.featured) - Number(a.featured) ||
    Date.parse(a.startsAt) - Date.parse(b.startsAt)
  ).slice(0, 6), [visible, savedCategories]);
  const nearYou = useMemo(() => center ? [...visible].filter(item => item.point)
    .sort((a, b) => distanceMiles(center, a.point!) - distanceMiles(center, b.point!)).slice(0, 5) : [], [visible, center]);
  const upcoming = useMemo(() => [...visible].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)), [visible]);
  const activeLabel = filters.mode === 'all' ? 'Everything' : filters.mode === 'nature' ? 'Nature' : 'Nights';
  const tileWidth = Math.min(width * 0.60, 250);
  const onSavedChange = (id: string, saved: boolean) =>
    setItems(current => current.map(item => item.id === id && item.source === 'adventure' ? { ...item, saved } : item));
  const showIntro = !filters.query && filters.when === 'any' && !filters.savedOnly;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={NAVY}/>}>
    <View style={styles.intro}>
      <Text style={styles.overline}>GO MELANATED DISCOVER</Text>
      <Text style={styles.title}>Where to next?</Text>
      <Text style={styles.subtitle}>Explore adventures, places, and experiences, all in one place.</Text>
    </View>
    <View style={styles.searchRow}>
      <AppIcon name="search" color={MUTED} size={21}/>
      <TextInput style={styles.search} value={filters.query} onChangeText={value => setFilter('query', value)}
        placeholder="Search events, places, activities…" placeholderTextColor="#76838C" returnKeyType="search"
        accessibilityLabel="Search all experiences"/>
      {filters.query ? <Pressable accessibilityLabel="Clear search" onPress={() => setFilter('query', '')}><AppIcon name="close" color={MUTED} size={20}/></Pressable> : null}
    </View>
    <View style={styles.modeRow}>
      {(['all', 'nature', 'night'] as const).map(mode =>
        <Pressable key={mode} onPress={() => setFilter('mode', mode)}
          accessibilityRole="button" accessibilityState={{ selected: filters.mode === mode }}
          style={[styles.modePill, filters.mode === mode && (mode === 'nature' ? styles.selectedNature : mode === 'night' ? styles.selectedNight : styles.selectedAll)]}>
          <Text style={[styles.modePillText, filters.mode === mode && styles.selectedText]}>{mode === 'all' ? 'Everything' : mode === 'nature' ? '🌿 Nature' : '🌆 Nights'}</Text>
        </Pressable>)}
    </View>
    <View style={styles.filterToolbar}>
      <Pressable onPress={() => setMoreFilters(current => !current)} style={[styles.moreButton, moreFilters && styles.moreButtonActive]}>
        <AppIcon name="filter" color={moreFilters ? '#FFFFFF' : NAVY} size={16}/>
        <Text style={[styles.moreText, moreFilters && { color: '#FFFFFF' }]}>Filters</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactFilters}>
        <Chip label={dateButtons.find(x => x.key === filters.when)?.label || 'Anytime'}
          active={filters.when !== 'any'} onPress={() => setMoreFilters(true)}/>
        <Chip label={filters.radius == null ? 'Any distance' : `${filters.radius} mi`}
          active={filters.radius != null} onPress={() => setMoreFilters(true)}/>
        <Chip label="Free" active={filters.freeOnly} onPress={() => setFilter('freeOnly', !filters.freeOnly)}/>
        <Chip label="Saved" active={filters.savedOnly} onPress={() => setFilter('savedOnly', !filters.savedOnly)}/>
      </ScrollView>
    </View>
    {moreFilters && <View style={styles.filtersBox}>
      <Text style={styles.filterTitle}>When</Text>
      <View style={styles.chipsWrap}>
        {dateButtons.map(x => <Chip key={x.key} label={x.label} active={filters.when === x.key}
          onPress={() => setFilter('when', x.key)}/>)}
      </View>
      <Text style={styles.filterTitle}>Distance from {homeLocation ? `${homeLocation.city}, ${homeLocation.state}` : 'your home location'}</Text>
      {!center && <Text style={styles.helper}>Add a supported home city and state in your profile to filter by distance.</Text>}
      <View style={styles.chipsWrap}>
        {distanceButtons.map(x => <Chip key={String(x.key)} label={x.label}
          active={filters.radius === x.key} onPress={() => setFilter('radius', center ? x.key : null)}/>)}
      </View>
      <Pressable onPress={() => { setFilters({ ...DEFAULT_FILTERS, mode: filters.mode }); setMoreFilters(false); }}>
        <Text style={styles.reset}>Reset filters</Text>
      </Pressable>
    </View>}

    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading ? <ActivityIndicator color={NAVY} style={styles.loader}/> : null}
    {!loading && <View style={styles.resultsCount}><Text style={styles.resultsText}>{visible.length} {activeLabel.toLowerCase()} {visible.length === 1 ? 'experience' : 'experiences'}</Text>
      {homeLocation && <Text style={styles.resultsLocation}>{homeLocation.city}, {homeLocation.state}</Text>}</View>}

    {!loading && !visible.length ? <View style={styles.empty}>
      <AppIcon name="search" color={MUTED} size={30}/>
      <Text style={styles.emptyTitle}>No matching experiences right now</Text>
      <Text style={styles.helper}>Try another date, increase the distance, or clear your filters.</Text>
      <Pressable style={styles.clearButton} onPress={() => setFilters(DEFAULT_FILTERS)}><Text style={styles.clearText}>Clear filters</Text></Pressable>
    </View> : null}

    {!loading && visible.length > 0 && <>
      {showIntro && <View style={styles.sectionHeader}><View>
        <Text style={styles.sectionTitle}>For You</Text>
        <Text style={styles.sectionNote}>{savedCategories.size ? 'Your saved interests and upcoming experiences' : 'A selection of upcoming experiences'}</Text>
      </View></View>}
      {showIntro && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
        {recommended.map(item => <View key={`rec:${item.source}:${item.id}`} style={{ width: tileWidth }}>
          <ExperienceCard item={item} width={tileWidth} onSavedChange={onSavedChange}/>
          {savedCategories.has(item.category.toLowerCase()) && <Text style={styles.reason}>Because you saved {item.category.toLowerCase()} experiences</Text>}
        </View>)}
      </ScrollView>}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Happening Soon</Text>
        <Pressable onPress={() => setExpanded(value => !value)}>
          <Text style={styles.sectionLink}>{expanded ? 'Show less' : 'See all'} →</Text>
        </Pressable>
      </View>
      {(expanded ? upcoming : upcoming.slice(0, 5)).map(item => <Pressable key={`soon:${item.source}:${item.id}`}
        onPress={() => openItem(item)} style={styles.resultRow}>
        <View style={[styles.kind, { backgroundColor: item.mode === 'nature' ? '#DCF1D6' : '#EBDFF5' }]}>
          <AppIcon name={item.mode === 'nature' ? 'trail' : 'calendar'} color={item.mode === 'nature' ? '#26683D' : '#6F3BA2'} size={19}/>
        </View>
        <View style={styles.flex}>
          <Text style={styles.resultName} numberOfLines={2}>{item.title}{item.source === 'demo' ? ' · DEMO' : ''}</Text>
          <Text style={styles.resultMeta}>{dateLabel(item.startsAt)} · {item.city}, {item.state}</Text>
          <Text style={styles.resultMeta}>{item.priceLabel} · {item.mode === 'nature' ? 'Nature' : 'Nights'}</Text>
        </View>
        <AppIcon name="chevron-forward" size={19} color={MUTED}/>
      </Pressable>)}

      {center && !!nearYou.length && <View>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Near You</Text>
          <Text style={styles.sectionNote}>From {homeLocation?.city}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
          {nearYou.map(item => <View key={`near:${item.source}:${item.id}`} style={{ width: tileWidth }}>
            <ExperienceCard item={item} width={tileWidth} onSavedChange={onSavedChange}/>
            <Text style={styles.reason}>{proximityReason(item, center)}</Text>
          </View>)}
        </ScrollView>
      </View>}

      {filters.mode === 'all' && <View style={styles.tryCard}>
        <AppIcon name="sparkles" color="#33759A" size={25}/>
        <View style={styles.flex}>
          <Text style={styles.tryTitle}>Try something different</Text>
          <Text style={styles.helper}>Switch between Nature and Nights to explore the city, from morning coffee to evening music.</Text>
        </View>
      </View>}
      <Pressable style={styles.communityLink} onPress={() => router.push('/communities')}>
        <AppIcon name="community" color={NAVY} size={21}/>
        <Text style={styles.communityLinkText}>Find communities and people to explore with</Text>
        <AppIcon name="chevron-forward" size={18} color={NAVY}/>
      </Pressable>
    </>}
    <View style={{ height: 24 }}/>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { backgroundColor: BG, flex: 1 },
  content: { maxWidth: 970, width: '100%', alignSelf: 'center', paddingHorizontal: 17, paddingTop: 16, paddingBottom: 20 },
  intro: { backgroundColor: NAVY, borderRadius: 19, padding: 22, marginBottom: 15 },
  overline: { color: '#C5D5E8', fontWeight: '900', fontSize: 10, letterSpacing: 1.4 },
  title: { color: 'white', fontSize: 27, fontWeight: '900', marginTop: 9 },
  subtitle: { color: '#E0EAF4', fontSize: 13, lineHeight: 19, marginTop: 6 },
  searchRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderColor: '#DFE6EA', borderWidth: 1, borderRadius: 13, gap: 10, paddingHorizontal: 12, height: 49, alignItems: 'center', marginBottom: 12 },
  search: { flex: 1, height: '100%', color: INK, fontSize: 13 },
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  modePill: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: '#E8EDF0' },
  selectedAll: { backgroundColor: '#233E5D' }, selectedNature: { backgroundColor: '#275D43' }, selectedNight: { backgroundColor: '#56327B' },
  modePillText: { color: '#48565D', fontSize: 12, fontWeight: '800' }, selectedText: { color: '#FFFFFF' },
  filterToolbar: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  moreButton: { backgroundColor: '#E1E9EE', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  moreButtonActive: { backgroundColor: NAVY },
  moreText: { color: NAVY, fontWeight: '800', fontSize: 12 },
  compactFilters: { alignItems: 'center', gap: 6, paddingRight: 6 },
  chip: { borderRadius: 13, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: '#E9EFF2', borderWidth: 1, borderColor: '#DAE2E6' },
  chipActive: { backgroundColor: '#D2E9FA', borderColor: '#95C8EB' },
  chipText: { color: '#52636E', fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#194B77' },
  filtersBox: { padding: 15, marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DFE6E9', gap: 9 },
  filterTitle: { fontSize: 13, color: INK, fontWeight: '900', marginTop: 3 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 6 },
  helper: { fontSize: 12, color: MUTED, lineHeight: 18, marginTop: 4 },
  reset: { color: '#2478AC', fontWeight: '800', fontSize: 12, paddingVertical: 9 },
  resultsCount: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  resultsText: { fontWeight: '900', color: INK, fontSize: 12 }, resultsLocation: { color: MUTED, fontSize: 11 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10, gap: 10 },
  sectionTitle: { color: INK, fontSize: 20, fontWeight: '900' },
  sectionNote: { color: MUTED, fontSize: 11, marginTop: 4 }, sectionLink: { color: '#2176AD', fontSize: 12, fontWeight: '800' },
  cardRow: { gap: 12, paddingBottom: 8 },
  reason: { fontSize: 11, color: '#587081', marginTop: 6, marginHorizontal: 3 },
  resultRow: { flexDirection: 'row', paddingVertical: 14, borderBottomColor: '#DFE5E8', borderBottomWidth: 1, alignItems: 'center', gap: 11 },
  kind: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  flex: { flex: 1 }, resultName: { fontSize: 14, fontWeight: '900', color: INK },
  resultMeta: { fontSize: 11, color: MUTED, marginTop: 4 },
  tryCard: { backgroundColor: '#E3EEF6', borderRadius: 15, flexDirection: 'row', gap: 14, padding: 16, marginTop: 23 },
  tryTitle: { color: INK, fontWeight: '900', fontSize: 14 },
  communityLink: { marginTop: 18, padding: 15, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 10 },
  communityLinkText: { flex: 1, color: INK, fontWeight: '800', fontSize: 12 },
  empty: { marginTop: 19, alignItems: 'center', paddingVertical: 30, paddingHorizontal: 23, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 10 },
  emptyTitle: { color: INK, fontWeight: '900', fontSize: 17, textAlign: 'center' },
  clearButton: { backgroundColor: NAVY, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, marginTop: 10 },
  clearText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  error: { color: '#A63C3C', fontSize: 12, fontWeight: '800', marginTop: 10 },
  loader: { marginTop: 30 },
});
