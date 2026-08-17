import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdventureCard } from '../../src/adventures/AdventureCard';
import { listAdventures, setAdventureSaved } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { useAuth } from '../../src/auth/AuthProvider';
import { distanceMiles, pointForCity, resolveSearchCenter } from '../../src/explore/location';
import { listLocalEvents, type LocalEvent } from '../../src/local-events/api';
import { supabase } from '../../src/lib/supabase';

type Mode = 'adventures' | 'local' | 'saved';
type SortMode = 'soonest' | 'closest' | 'newest' | 'price';
type Point = { latitude: number; longitude: number };

const categories = ['All', 'Camping', 'Hiking', 'Water', 'Fishing', 'Cycling', 'Travel', 'Culture'];
const visibleCategories = ['Camping', 'Hiking', 'Water', 'Fishing', 'Cycling'];
const categoryIcons: Record<string, string> = { Camping: '⛺', Hiking: '🥾', Water: '≋', Fishing: '◌', Cycling: '◉' };
const adventureRadii = ['25', '50', '100', '250', 'Anywhere'];
const localRadii = ['10', '25', '50'];
const quickTags = ['Upcoming', 'Family Friendly', 'Beginner Friendly', 'Weekend', 'Gear Provided', 'Accessible'];
const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'soonest', label: 'Soonest' },
  { value: 'closest', label: 'Closest' },
  { value: 'newest', label: 'Newest' },
  { value: 'price', label: 'Price: Low to High' },
];

function promptForAccount(destination: string) {
  Alert.alert('Sign in to continue', `${destination} is available to members. Sign in or create an account to continue.`, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Create account', onPress: () => router.push('/(auth)/sign-up' as never) },
    { text: 'Sign in', onPress: () => router.push('/(auth)/sign-in' as never) },
  ]);
}

function inferredTags(value: { title: string; description?: string | null; category?: string | null }) {
  const text = `${value.title} ${value.description ?? ''} ${value.category ?? ''}`.toLowerCase();
  const tags: string[] = [];
  if (/family|kid|children|all ages/.test(text)) tags.push('Family Friendly');
  if (/beginner|easy|intro|first[- ]timer/.test(text)) tags.push('Beginner Friendly');
  if (/gear provided|equipment provided|gear included/.test(text)) tags.push('Gear Provided');
  if (/accessible|wheelchair|ada/.test(text)) tags.push('Accessible');
  return tags;
}

function isWeekend(date: string) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

function matchesQuickTags(item: { title: string; description?: string | null; category?: string | null; starts_at: string }, tags: string[]) {
  if (!tags.length) return true;
  const tagsForItem = inferredTags(item);
  return tags.every((tag) => tag === 'Upcoming' ? new Date(item.starts_at).getTime() >= Date.now() : tag === 'Weekend' ? isWeekend(item.starts_at) : tagsForItem.includes(tag));
}

function LocalCard({ event, distance }: { event: LocalEvent; distance?: number | null }) {
  return (
    <Pressable style={s.compactEvent} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      <View style={s.eventThumb}><Text style={s.eventThumbIcon}>↗</Text></View>
      <View style={s.eventCopy}>
        <Text style={s.eventEyebrow}>LOCAL EVENT</Text>
        <Text style={s.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={s.eventMeta}>{distance != null ? `${distance.toFixed(1)} mi away · ` : ''}{event.city}, {event.state}</Text>
        <Text style={s.eventMeta}>{new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
      </View>
      <Text style={s.eventArrow}>›</Text>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('adventures');
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [radius, setRadius] = useState('50');
  const [sort, setSort] = useState<SortMode>('soonest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [homeCity, setHomeCity] = useState('');
  const [homeState, setHomeState] = useState('');
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [currentLocationLabel, setCurrentLocationLabel] = useState('Near you');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => ({
    search: search || undefined,
    category: category === 'All' ? undefined : category,
    savedOnly: session && mode === 'saved' ? true : undefined,
  }), [search, category, mode, session]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setCurrentPoint(point);
        const places = await Location.reverseGeocodeAsync(point);
        if (!active || !places[0]) return;
        const place = places[0];
        const city = place.city || place.subregion || place.region;
        const state = place.region;
        if (city && state) setCurrentLocationLabel(`${city}, ${state}`);
        else if (city) setCurrentLocationLabel(city);
      } catch {
        // Explore uses the member's saved-location fallback when device location is unavailable.
      }
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const userId = session?.user.id;
      const [nextAdventures, nextEvents, profile] = await Promise.all([
        listAdventures(filters),
        listLocalEvents(),
        userId ? supabase.from('profiles').select('home_city,home_state').eq('id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      setAdventures(nextAdventures);
      setEvents(nextEvents);
      setHomeCity(profile.data?.home_city ?? '');
      setHomeState(profile.data?.home_state ?? '');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Explore.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, session?.user.id]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (mode === 'local' && (radius === '100' || radius === '250' || radius === 'Anywhere')) setRadius('50');
  }, [mode, radius]);

  function chooseMode(next: Mode) {
    if (!session && next === 'saved') {
      promptForAccount('Saved adventures');
      return;
    }
    setMode(next);
  }

  async function toggle(adventure: AdventureSummary) {
    if (!session) {
      promptForAccount('Saving adventures');
      return;
    }
    const next = !adventure.is_saved;
    setAdventures((current) => current.map((item) => item.id === adventure.id ? { ...item, is_saved: next } : item));
    try {
      await setAdventureSaved(adventure.id, next);
    } catch {
      void load();
    }
  }

  const savedCenter = useMemo(() => resolveSearchCenter(search, homeCity, homeState), [search, homeCity, homeState]);
  const searchCenter = search.trim() ? savedCenter : currentPoint ?? savedCenter;
  const radiusLimit = radius === 'Anywhere' ? Number.POSITIVE_INFINITY : Number(radius);

  const localWithDistance = useMemo(() => events.map((event) => {
    const point = pointForCity(event.city, event.state);
    return { event, distance: searchCenter && point ? distanceMiles(searchCenter, point) : null };
  }).filter(({ event, distance }) => {
    const query = search.trim().toLowerCase();
    const searchable = `${event.title} ${event.host_name} ${event.city} ${event.state} ${event.category} ${event.description}`.toLowerCase();
    const textMatch = !query || searchable.includes(query) || (searchCenter != null && query.includes(event.city.toLowerCase()));
    const distanceMatch = distance == null || distance <= Math.min(50, radiusLimit);
    return textMatch && distanceMatch && matchesQuickTags(event, selectedTags);
  }), [events, radiusLimit, search, searchCenter, selectedTags]);

  const sortedLocal = useMemo(() => [...localWithDistance].sort((a, b) => sort === 'closest'
    ? (a.distance ?? 9999) - (b.distance ?? 9999)
    : sort === 'newest'
      ? b.event.id.localeCompare(a.event.id)
      : new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()), [localWithDistance, sort]);

  const filteredAdventures = useMemo(() => adventures
    .filter((item) => matchesQuickTags(item, selectedTags))
    .filter((item) => {
      if (!searchCenter || item.latitude == null || item.longitude == null || radius === 'Anywhere') return true;
      return distanceMiles(searchCenter, { latitude: item.latitude, longitude: item.longitude }) <= radiusLimit;
    })
    .sort((a, b) => {
      if (sort === 'newest') return b.id.localeCompare(a.id);
      if (sort === 'price') return a.starting_price_cents - b.starting_price_cents;
      if (sort === 'closest' && searchCenter) {
        const aDistance = a.latitude == null || a.longitude == null ? 9999 : distanceMiles(searchCenter, { latitude: a.latitude, longitude: a.longitude });
        const bDistance = b.latitude == null || b.longitude == null ? 9999 : distanceMiles(searchCenter, { latitude: b.latitude, longitude: b.longitude });
        return aDistance - bDistance;
      }
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    }), [adventures, radius, radiusLimit, searchCenter, selectedTags, sort]);

  const featuredAdventure = mode === 'adventures' ? filteredAdventures.find((item) => item.is_featured) ?? filteredAdventures[0] : undefined;
  const nearbyEvent = sortedLocal[0];
  const adventureRows = featuredAdventure ? filteredAdventures.filter((item) => item.id !== featuredAdventure.id) : filteredAdventures;
  const rows: any[] = mode === 'local' ? sortedLocal : adventureRows;
  const radii = mode === 'local' ? localRadii : adventureRadii;

  function toggleTag(tag: string) {
    setSelectedTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]);
  }

  function chooseCategory(next: string) {
    setCategory((current) => current === next ? 'All' : next);
    setMode('adventures');
  }

  const featuredDistance = featuredAdventure && searchCenter && featuredAdventure.latitude != null && featuredAdventure.longitude != null
    ? distanceMiles(searchCenter, { latitude: featuredAdventure.latitude, longitude: featuredAdventure.longitude })
    : null;

  const todayMessage = category === 'All'
    ? `Explore what is happening near ${currentLocationLabel}.`
    : `A good day to discover ${category.toLowerCase()} near ${currentLocationLabel}.`;

  const header = (
    <View style={s.header}>
      <Text style={s.title}>Explore</Text>
      <Text style={s.location}>⌖  {currentLocationLabel}  ⌄</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={mode === 'local' ? 'Search events, hosts or places' : 'Where do you want to go outside?'}
        placeholderTextColor="#7F8A84"
        style={s.input}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
        {visibleCategories.map((item) => (
          <Pressable key={item} onPress={() => chooseCategory(item)} style={[s.categoryChip, category === item && s.categoryChipActive]}>
            <Text style={[s.categoryIcon, category === item && s.categoryTextActive]}>{categoryIcons[item]}</Text>
            <Text style={[s.categoryText, category === item && s.categoryTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {mode === 'adventures' ? (
        <View style={s.todayCard}>
          <View style={s.todayIconWrap}><Text style={s.todayIcon}>☀</Text></View>
          <View style={s.todayCopy}>
            <Text style={s.todayEyebrow}>GOOD DAY TO GET OUTSIDE</Text>
            <Text style={s.todayTitle}>{todayMessage}</Text>
          </View>
          <Pressable style={s.todayButton} onPress={() => setSort('closest')}><Text style={s.todayButtonText}>See ideas</Text></Pressable>
        </View>
      ) : null}

      <View style={s.tabs}>
        {([['adventures', 'Adventures'], ['local', 'Events'], ['saved', 'Saved']] as [Mode, string][]).map(([value, label]) => (
          <Pressable key={value} onPress={() => chooseMode(value)} style={[s.tab, mode === value && s.tabActive]}>
            <Text style={[s.tabText, mode === value && s.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {featuredAdventure ? (
        <>
          <Text style={s.sectionEyebrow}>FEATURED ADVENTURE</Text>
          <Pressable style={s.featuredCard} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: featuredAdventure.id } })}>
            {featuredAdventure.hero_image_url ? (
              <ImageBackground source={{ uri: featuredAdventure.hero_image_url }} style={s.featuredImage} imageStyle={s.featuredImageCorners}>
                <View style={s.featuredOverlay}>
                  <View style={s.featuredTopRow}>
                    <Text style={s.featuredBadge}>FEATURED</Text>
                    <Pressable style={s.saveButton} onPress={(event) => { event.stopPropagation(); void toggle(featuredAdventure); }}><Text style={s.saveIcon}>{featuredAdventure.is_saved ? '★' : '☆'}</Text></Pressable>
                  </View>
                  <View>
                    <Text style={s.featuredTitle}>{featuredAdventure.title}</Text>
                    <Text style={s.featuredMeta}>⌖ {featuredDistance != null ? `${featuredDistance.toFixed(1)} mi away · ` : ''}{featuredAdventure.city}, {featuredAdventure.state}</Text>
                    <Text style={s.featuredMeta}>▣ {new Date(featuredAdventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {featuredAdventure.category}</Text>
                  </View>
                </View>
              </ImageBackground>
            ) : <View style={[s.featuredImage, s.featuredFallback]}><Text style={s.featuredTitle}>{featuredAdventure.title}</Text></View>}
            <View style={s.featuredFooter}>
              <Text style={s.fromPrice}>{featuredAdventure.starting_price_cents === 0 ? <Text style={s.freePrice}>Free</Text> : <>From <Text style={s.price}>${Math.round(featuredAdventure.starting_price_cents / 100)}</Text></>}</Text>
              <Text style={s.trusted}>✓ Trusted Host</Text>
            </View>
          </Pressable>
        </>
      ) : null}

      {mode === 'adventures' && nearbyEvent ? (
        <View>
          <View style={s.sectionHeadingRow}>
            <Text style={s.sectionTitle}>Happening near you</Text>
            <Pressable onPress={() => setMode('local')}><Text style={s.sectionLink}>View all ›</Text></Pressable>
          </View>
          <LocalCard event={nearbyEvent.event} distance={nearbyEvent.distance} />
        </View>
      ) : null}

      <View style={s.controlRow}>
        <Pressable style={s.controlButton} onPress={() => setShowFilters((value) => !value)}><Text style={s.controlText}>☷  Filter{selectedTags.length ? ` · ${selectedTags.length}` : ''}</Text></Pressable>
        <Pressable style={s.controlButton} onPress={() => Alert.alert('Map view', 'Map discovery is next in the Explore rollout.')}><Text style={s.controlText}>⌖  Map View</Text></Pressable>
      </View>

      {showFilters ? (
        <View style={s.panel}>
          <Text style={s.filterLabel}>SORT</Text>
          <View style={s.chips}>{sortOptions.map((option) => <Pressable key={option.value} onPress={() => setSort(option.value)} style={[s.chip, sort === option.value && s.chipActive]}><Text style={[s.chipText, sort === option.value && s.chipTextActive]}>{option.label}</Text></Pressable>)}</View>
          <Text style={s.filterLabel}>QUICK FILTERS</Text>
          <View style={s.chips}>{quickTags.map((tag) => <Pressable key={tag} onPress={() => toggleTag(tag)} style={[s.chip, selectedTags.includes(tag) && s.chipActive]}><Text style={[s.chipText, selectedTags.includes(tag) && s.chipTextActive]}>{tag}</Text></Pressable>)}</View>
          <Text style={s.filterLabel}>RADIUS{mode === 'local' ? ' · MAX 50 MI' : ''}</Text>
          <View style={s.chips}>{radii.map((value) => <Pressable key={value} onPress={() => setRadius(value)} style={[s.chip, radius === value && s.chipActive]}><Text style={[s.chipText, radius === value && s.chipTextActive]}>{value === 'Anywhere' ? value : `${value} mi`}</Text></Pressable>)}</View>
          {mode !== 'local' ? <><Text style={s.filterLabel}>ADVENTURE TYPE</Text><View style={s.chips}>{categories.map((value) => <Pressable key={value} onPress={() => setCategory(value)} style={[s.chip, category === value && s.chipActive]}><Text style={[s.chipText, category === value && s.chipTextActive]}>{value}</Text></Pressable>)}</View></> : null}
        </View>
      ) : null}

      {mode === 'adventures' ? (
        <Pressable style={s.learnCard} onPress={() => router.push('/groups' as never)}>
          <View style={s.learnIcon}><Text style={s.learnIconText}>🎒</Text></View>
          <View style={s.learnCopy}><Text style={s.learnEyebrow}>LEARN</Text><Text style={s.learnTitle}>{category === 'Camping' ? 'New to camping?' : 'Build your outdoor confidence'}</Text><Text style={s.learnBody}>{category === 'Camping' ? 'Start with our beginner-friendly camping guides and tips.' : 'Gear, safety, skills and practical guides for your next adventure.'}</Text></View>
          <Text style={s.learnArrow}>›</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#F5C542" /> : null}
      {!loading && rows.length > 0 ? <Text style={s.listHeading}>{mode === 'local' ? 'Local events' : 'More to explore'}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <FlatList
        data={rows}
        keyExtractor={(item: any) => item.id ?? item.event?.id}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#F5C542" />}
        ListHeaderComponent={header}
        renderItem={({ item }) => mode === 'local' ? <LocalCard event={item.event as LocalEvent} distance={item.distance} /> : <AdventureCard adventure={item as AdventureSummary} onToggleSaved={toggle} />}
        ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
        ListEmptyComponent={!loading ? <View style={s.empty}><Text style={s.emptyTitle}>Nothing here yet</Text><Text style={s.body}>Try widening your radius or clearing a filter.</Text></View> : null}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1110' },
  content: { padding: 18, paddingBottom: 120 },
  header: { gap: 11, marginBottom: 14 },
  title: { color: '#F7F7F4', fontSize: 38, lineHeight: 42, fontWeight: '900' },
  location: { color: '#D8DED9', fontWeight: '700', fontSize: 15, marginTop: -3 },
  input: { backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#343D39', borderRadius: 17, color: '#F7F7F4', paddingHorizontal: 16, paddingVertical: 13, fontSize: 15 },
  categoryRow: { gap: 8, paddingRight: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#3B4842', backgroundColor: '#111816', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  categoryChipActive: { backgroundColor: '#F5C542', borderColor: '#F5C542' },
  categoryIcon: { color: '#E1E7E3', fontSize: 15, fontWeight: '900' },
  categoryText: { color: '#E1E7E3', fontSize: 13, fontWeight: '800' },
  categoryTextActive: { color: '#111A17' },
  todayCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12201C', borderWidth: 1, borderColor: '#33433C', borderRadius: 18, padding: 13, gap: 11 },
  todayIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B2924' },
  todayIcon: { color: '#F5C542', fontSize: 27 },
  todayCopy: { flex: 1 },
  todayEyebrow: { color: '#F5C542', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  todayTitle: { color: '#F7F7F4', fontSize: 14, lineHeight: 18, fontWeight: '800', marginTop: 3 },
  todayButton: { borderWidth: 1, borderColor: '#F5C542', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  todayButtonText: { color: '#F5C542', fontSize: 11, fontWeight: '900' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2A3530' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#F5C542' },
  tabText: { color: '#9DA8A2', fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#F7F7F4' },
  sectionEyebrow: { color: '#F5C542', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  featuredCard: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#3E4944', backgroundColor: '#111A17' },
  featuredImage: { minHeight: 255, justifyContent: 'space-between' },
  featuredImageCorners: { borderTopLeftRadius: 19, borderTopRightRadius: 19 },
  featuredOverlay: { flex: 1, justifyContent: 'space-between', padding: 15, backgroundColor: 'rgba(0,0,0,0.38)' },
  featuredFallback: { padding: 16, backgroundColor: '#183128', justifyContent: 'flex-end' },
  featuredTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredBadge: { color: '#111A17', backgroundColor: '#F5C542', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, fontWeight: '900', fontSize: 9, letterSpacing: .8 },
  saveButton: { width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: '#C6CECA', backgroundColor: 'rgba(8,13,12,.68)', alignItems: 'center', justifyContent: 'center' },
  saveIcon: { color: '#FFFFFF', fontSize: 21 },
  featuredTitle: { color: '#FFFFFF', fontSize: 26, lineHeight: 30, fontWeight: '900' },
  featuredMeta: { color: '#E2E7E4', fontSize: 12, fontWeight: '700', marginTop: 5 },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#101714' },
  fromPrice: { color: '#E5EAE7', fontSize: 14 },
  price: { color: '#F5C542', fontSize: 23, fontWeight: '900' },
  freePrice: { color: '#76D1B7', fontSize: 18, fontWeight: '900' },
  trusted: { color: '#75D2C0', backgroundColor: '#153128', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: '900' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, marginBottom: 7 },
  sectionTitle: { color: '#F7F7F4', fontSize: 20, fontWeight: '900' },
  sectionLink: { color: '#F5C542', fontSize: 12, fontWeight: '900' },
  compactEvent: { minHeight: 104, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 17, backgroundColor: '#121A18', borderWidth: 1, borderColor: '#2E3A35' },
  eventThumb: { width: 92, alignSelf: 'stretch', backgroundColor: '#224B40', alignItems: 'center', justifyContent: 'center' },
  eventThumbIcon: { color: '#F5C542', fontSize: 27, fontWeight: '900' },
  eventCopy: { flex: 1, paddingHorizontal: 13, paddingVertical: 11 },
  eventEyebrow: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  eventTitle: { color: '#F7F7F4', fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  eventMeta: { color: '#ABB5B0', fontSize: 10, marginTop: 3 },
  eventArrow: { color: '#F5C542', fontSize: 28, paddingRight: 13 },
  controlRow: { flexDirection: 'row', gap: 9 },
  controlButton: { flex: 1, backgroundColor: '#141D1A', borderWidth: 1, borderColor: '#3B4842', borderRadius: 13, paddingVertical: 11, alignItems: 'center' },
  controlText: { color: '#E4E9E6', fontWeight: '900', fontSize: 12 },
  panel: { backgroundColor: '#121B18', borderWidth: 1, borderColor: '#29372F', borderRadius: 16, padding: 13, gap: 10 },
  filterLabel: { color: '#849188', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: '#46554C', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#F5C542', borderColor: '#F5C542' },
  chipText: { color: '#D2D8D4', fontWeight: '700', fontSize: 11 },
  chipTextActive: { color: '#17211C' },
  learnCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, borderWidth: 1, borderColor: '#315248', backgroundColor: '#10241F', padding: 13 },
  learnIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#203329', alignItems: 'center', justifyContent: 'center' },
  learnIconText: { fontSize: 25 },
  learnCopy: { flex: 1 },
  learnEyebrow: { color: '#F5C542', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  learnTitle: { color: '#F7F7F4', fontSize: 15, fontWeight: '900', marginTop: 2 },
  learnBody: { color: '#AEBAB4', fontSize: 11, lineHeight: 15, marginTop: 2 },
  learnArrow: { color: '#F5C542', fontSize: 27, fontWeight: '900' },
  listHeading: { color: '#F7F7F4', fontSize: 20, fontWeight: '900', marginTop: 4 },
  error: { color: '#FFB4A9' },
  empty: { backgroundColor: '#121B18', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#28332E' },
  emptyTitle: { color: '#F7F7F4', fontWeight: '900', fontSize: 18 },
  body: { color: '#AEB8B2', lineHeight: 20, marginTop: 5 },
});
