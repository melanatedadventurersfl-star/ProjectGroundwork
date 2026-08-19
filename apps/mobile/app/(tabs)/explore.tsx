import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listAdventures, setAdventureSaved } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { useAuth } from '../../src/auth/AuthProvider';
import { distanceMiles, pointForCity, resolveSearchCenter } from '../../src/explore/location';
import { listLocalEvents, type LocalEvent } from '../../src/local-events/api';
import { supabase } from '../../src/lib/supabase';

type SortMode = 'soonest' | 'closest' | 'newest' | 'price';
type Point = { latitude: number; longitude: number };
type ExpandedSection = 'featured' | 'events' | 'popular' | null;

const categories = ['Camping', 'Hiking', 'Water', 'Fishing', 'Cycling'];
const categoryIcons: Record<string, string> = {
  Camping: '⛺',
  Hiking: '🥾',
  Water: '≋',
  Fishing: '◌',
  Cycling: '◉',
};
const quickTags = ['Weekend', 'Family Friendly', 'Beginner Friendly', 'Accessible'];
const radii = ['25', '50', '100', 'Anywhere'];
const DEFAULT_EVENT_IMAGE = require('../../assets/explore/default-event.jpg');

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
  return tags.every((tag) => tag === 'Weekend' ? isWeekend(item.starts_at) : tagsForItem.includes(tag));
}

function SectionHeader({ title, expanded, onPress }: { title: string; expanded: boolean; onPress: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={s.sectionAction}>{expanded ? 'Show less' : 'See all'}  ›</Text>
      </Pressable>
    </View>
  );
}

function AdventureTile({ adventure, distance, onToggleSaved, wide = false }: {
  adventure: AdventureSummary;
  distance?: number | null;
  onToggleSaved: (adventure: AdventureSummary) => void;
  wide?: boolean;
}) {
  return (
    <Pressable
      style={[s.adventureTile, wide && s.adventureTileWide]}
      onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: adventure.id } })}
    >
      {adventure.hero_image_url ? (
        <ImageBackground source={{ uri: adventure.hero_image_url }} style={[s.tileImage, wide && s.tileImageWide]} imageStyle={s.tileImageCorners}>
          <View style={s.tileShade}>
            <View style={s.tileTopRow}>
              {distance != null ? <Text style={s.distanceBadge}>⌖ {distance.toFixed(0)} mi</Text> : <View />}
              <Pressable
                style={s.heartButton}
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleSaved(adventure);
                }}
              >
                <Text style={s.heart}>{adventure.is_saved ? '★' : '☆'}</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={[s.tileImage, wide && s.tileImageWide, s.tileFallback]}><Text style={s.tileFallbackIcon}>↗</Text></View>
      )}
      <View style={s.tileCopy}>
        <Text style={s.tileTitle} numberOfLines={wide ? 2 : 1}>{adventure.title}</Text>
        <Text style={s.tileMeta} numberOfLines={1}>{adventure.category} · {adventure.city}, {adventure.state}</Text>
        <Text style={s.tileDate}>{new Date(adventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
      </View>
    </Pressable>
  );
}

function EventCard({ event, distance, wide = false }: { event: LocalEvent; distance?: number | null; wide?: boolean }) {
  const date = new Date(event.starts_at);
  const imageSource = event.image_url ? { uri: event.image_url } : DEFAULT_EVENT_IMAGE;

  return (
    <Pressable
      style={[s.eventCard, wide && s.eventCardWide]}
      onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}
    >
      <View style={s.eventDateBlock}>
        <Text style={s.eventMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text>
        <Text style={s.eventDay}>{date.getDate()}</Text>
        <Text style={s.eventWeekday}>{date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Text>
      </View>
      <ImageBackground source={imageSource} style={s.eventVisual} imageStyle={s.eventVisualImage}>
        <View style={s.eventVisualShade} />
      </ImageBackground>
      <View style={s.eventCopy}>
        <Text style={s.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={s.eventMeta} numberOfLines={1}>{event.city}, {event.state}</Text>
        <Text style={s.eventMeta}>{date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{distance != null ? ` · ${distance.toFixed(0)} mi` : ''}</Text>
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const { session } = useAuth();
  const pageRef = useRef<ScrollView>(null);
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [radius, setRadius] = useState('50');
  const [sort, setSort] = useState<SortMode>('closest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [featuredY, setFeaturedY] = useState(0);
  const [homeCity, setHomeCity] = useState('');
  const [homeState, setHomeState] = useState('');
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [currentLocationLabel, setCurrentLocationLabel] = useState('Near you');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Saved profile location remains the fallback when device location is unavailable.
      }
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const userId = session?.user.id;
      const [nextAdventures, nextEvents, profile] = await Promise.all([
        listAdventures({}),
        listLocalEvents(),
        userId
          ? supabase.from('profiles').select('home_city,home_state').eq('id', userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
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
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  const savedCenter = useMemo(() => resolveSearchCenter(search, homeCity, homeState), [search, homeCity, homeState]);
  const searchCenter = search.trim() ? savedCenter : currentPoint ?? savedCenter;
  const radiusLimit = radius === 'Anywhere' ? Number.POSITIVE_INFINITY : Number(radius);

  const visibleAdventures = useMemo(() => adventures
    .filter((item) => category === 'All' || item.category === category)
    .filter((item) => matchesQuickTags({ ...item, description: item.summary }, selectedTags))
    .filter((item) => {
      const query = search.trim().toLowerCase();
      const searchable = `${item.title} ${item.city} ${item.state} ${item.category} ${item.summary}`.toLowerCase();
      if (query && !searchable.includes(query) && !savedCenter) return false;
      if (!searchCenter || item.latitude == null || item.longitude == null || radius === 'Anywhere') return true;
      return distanceMiles(searchCenter, { latitude: item.latitude, longitude: item.longitude }) <= radiusLimit;
    })
    .sort((a, b) => {
      if (sort === 'newest') return b.id.localeCompare(a.id);
      if (sort === 'price') return a.starting_price_cents - b.starting_price_cents;
      if (sort === 'closest' && searchCenter) {
        const ad = a.latitude == null || a.longitude == null ? 9999 : distanceMiles(searchCenter, { latitude: a.latitude, longitude: a.longitude });
        const bd = b.latitude == null || b.longitude == null ? 9999 : distanceMiles(searchCenter, { latitude: b.latitude, longitude: b.longitude });
        return ad - bd;
      }
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    }), [adventures, category, radius, radiusLimit, savedCenter, search, searchCenter, selectedTags, sort]);

  const localEvents = useMemo(() => events.map((event) => {
    const point = pointForCity(event.city, event.state);
    return { event, distance: searchCenter && point ? distanceMiles(searchCenter, point) : null };
  }).filter(({ event, distance }) => {
    const query = search.trim().toLowerCase();
    const searchable = `${event.title} ${event.host_name} ${event.city} ${event.state} ${event.category} ${event.description}`.toLowerCase();
    const textMatch = !query || searchable.includes(query) || savedCenter != null;
    const distanceMatch = distance == null || distance <= Math.min(100, radiusLimit);
    return textMatch && distanceMatch && matchesQuickTags(event, selectedTags);
  }).sort((a, b) => sort === 'closest'
    ? (a.distance ?? 9999) - (b.distance ?? 9999)
    : new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()),
  [events, radiusLimit, savedCenter, search, searchCenter, selectedTags, sort]);

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

  function chooseCategory(next: string) {
    setCategory((current) => current === next ? 'All' : next);
    setExpandedSection(null);
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]);
  }

  function distanceFor(adventure: AdventureSummary) {
    if (!searchCenter || adventure.latitude == null || adventure.longitude == null) return null;
    return distanceMiles(searchCenter, { latitude: adventure.latitude, longitude: adventure.longitude });
  }

  function showIdeas() {
    setSort('closest');
    setExpandedSection(null);
    requestAnimationFrame(() => pageRef.current?.scrollTo({ y: Math.max(0, featuredY - 16), animated: true }));
  }

  function toggleExpanded(section: Exclude<ExpandedSection, null>) {
    setExpandedSection((current) => current === section ? null : section);
  }

  function resetFilters() {
    setSort('closest');
    setSelectedTags([]);
    setRadius('50');
  }

  const featured = visibleAdventures.filter((item) => item.is_featured).concat(visibleAdventures.filter((item) => !item.is_featured));
  const featuredPreview = featured.slice(0, 6);
  const popular = visibleAdventures.slice(6, 18).length ? visibleAdventures.slice(6, 18) : visibleAdventures;
  const popularPreview = popular.slice(0, 6);
  const nearby = localEvents;
  const nearbyPreview = nearby.slice(0, 4);

  const timeOfDay = new Date().getHours();
  const daypart = timeOfDay >= 17 ? 'evening' : timeOfDay >= 12 ? 'afternoon' : 'morning';
  const conditionTitle = `A good ${daypart} to get outside`;
  const conditionBody = category === 'All'
    ? `Discover something nearby in ${currentLocationLabel}.`
    : `Find ${category.toLowerCase()} ideas around ${currentLocationLabel}.`;

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <ScrollView
        ref={pageRef}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#F5C542" />}
      >
        <View style={s.hero}>
          <Text style={s.title}>Explore</Text>
          <View style={s.locationRow}>
            <Text style={s.locationMarker}>✦</Text>
            <Text style={s.location}>{currentLocationLabel}</Text>
            <Text style={s.locationChevron}>⌄</Text>
          </View>

          <View style={s.conditionCard}>
            <View style={s.conditionIconWrap}><Text style={s.conditionIcon}>☀</Text></View>
            <View style={s.conditionCopy}>
              <Text style={s.conditionTitle}>{conditionTitle}</Text>
              <Text style={s.conditionBody}>{conditionBody}</Text>
            </View>
            <Pressable style={s.conditionButton} onPress={showIdeas}>
              <Text style={s.conditionButtonText}>See ideas  ›</Text>
            </Pressable>
          </View>

          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search places, adventures & events"
              placeholderTextColor="#909A95"
              style={s.input}
            />
            <Pressable style={s.filterIconButton} onPress={() => setShowFilters(true)}>
              <Text style={s.filterIcon}>☷</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
            {categories.map((item) => (
              <Pressable key={item} onPress={() => chooseCategory(item)} style={[s.categoryChip, category === item && s.categoryChipActive]}>
                <Text style={[s.categoryIcon, category === item && s.categoryTextActive]}>{categoryIcons[item]}</Text>
                <Text style={[s.categoryText, category === item && s.categoryTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#F5C542" style={s.loader} /> : null}

        {!loading && featuredPreview.length ? (
          <View style={s.section} onLayout={(event) => setFeaturedY(event.nativeEvent.layout.y)}>
            <SectionHeader title="Featured Adventures" expanded={expandedSection === 'featured'} onPress={() => toggleExpanded('featured')} />
            {expandedSection === 'featured' ? (
              <View style={s.expandedList}>
                {featured.map((adventure) => (
                  <AdventureTile key={adventure.id} adventure={adventure} distance={distanceFor(adventure)} onToggleSaved={toggle} wide />
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalContent}>
                {featuredPreview.map((adventure) => (
                  <AdventureTile key={adventure.id} adventure={adventure} distance={distanceFor(adventure)} onToggleSaved={toggle} />
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {!loading && nearbyPreview.length ? (
          <View style={s.section}>
            <SectionHeader title="Happening Near You" expanded={expandedSection === 'events'} onPress={() => toggleExpanded('events')} />
            {expandedSection === 'events' ? (
              <View style={s.expandedList}>
                {nearby.map(({ event, distance }) => <EventCard key={event.id} event={event} distance={distance} wide />)}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalContent}>
                {nearbyPreview.map(({ event, distance }) => <EventCard key={event.id} event={event} distance={distance} />)}
              </ScrollView>
            )}
          </View>
        ) : null}

        {!loading && popularPreview.length ? (
          <View style={s.section}>
            <SectionHeader title={`Popular Around ${currentLocationLabel.split(',')[0] ?? currentLocationLabel}`} expanded={expandedSection === 'popular'} onPress={() => toggleExpanded('popular')} />
            {expandedSection === 'popular' ? (
              <View style={s.expandedList}>
                {popular.map((adventure) => (
                  <AdventureTile key={`popular-${adventure.id}`} adventure={adventure} distance={distanceFor(adventure)} onToggleSaved={toggle} wide />
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalContent}>
                {popularPreview.map((adventure) => (
                  <AdventureTile key={`popular-${adventure.id}`} adventure={adventure} distance={distanceFor(adventure)} onToggleSaved={toggle} />
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {!loading && !featuredPreview.length && !nearbyPreview.length ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Nothing nearby yet</Text>
            <Text style={s.emptyBody}>Try widening your radius or clearing a filter.</Text>
          </View>
        ) : null}

        <Pressable style={s.learnCard} onPress={() => router.push('/groups' as never)}>
          <View style={s.learnIconWrap}><Text style={s.learnIcon}>🎒</Text></View>
          <View style={s.learnCopy}>
            <Text style={s.learnEyebrow}>LEARN & PREP</Text>
            <Text style={s.learnTitle}>{category === 'Camping' ? 'New to camping?' : 'Build your outdoor confidence'}</Text>
            <Text style={s.learnBody}>Gear, safety, skills and practical tips for your next adventure.</Text>
          </View>
          <Text style={s.learnArrow}>›</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={s.modalRoot}>
          <Pressable style={s.modalBackdrop} onPress={() => setShowFilters(false)} />
          <View style={s.filterSheet}>
            <View style={s.sheetHandle} />
            <View style={s.filterPanelTop}>
              <Text style={s.filterPanelTitle}>Refine Explore</Text>
              <Pressable onPress={resetFilters} hitSlop={8}><Text style={s.resetFilter}>Reset</Text></Pressable>
            </View>

            <Text style={s.filterLabel}>SORT</Text>
            <View style={s.filterChips}>
              {(['closest', 'soonest', 'newest', 'price'] as SortMode[]).map((value) => (
                <Pressable key={value} onPress={() => setSort(value)} style={[s.filterChip, sort === value && s.filterChipActive]}>
                  <Text style={[s.filterChipText, sort === value && s.filterChipTextActive]}>
                    {value === 'price' ? 'Price' : value.charAt(0).toUpperCase() + value.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.filterLabel}>QUICK FILTERS</Text>
            <View style={s.filterChips}>
              {quickTags.map((tag) => (
                <Pressable key={tag} onPress={() => toggleTag(tag)} style={[s.filterChip, selectedTags.includes(tag) && s.filterChipActive]}>
                  <Text style={[s.filterChipText, selectedTags.includes(tag) && s.filterChipTextActive]}>{tag}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.filterLabel}>RADIUS</Text>
            <View style={s.filterChips}>
              {radii.map((value) => (
                <Pressable key={value} onPress={() => setRadius(value)} style={[s.filterChip, radius === value && s.filterChipActive]}>
                  <Text style={[s.filterChipText, radius === value && s.filterChipTextActive]}>{value === 'Anywhere' ? value : `${value} mi`}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={s.showResultsButton} onPress={() => setShowFilters(false)}>
              <Text style={s.showResultsText}>Show results</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#090F0E' },
  content: { paddingBottom: 120 },
  hero: { paddingHorizontal: 18, paddingTop: 22, gap: 13 },
  title: { color: '#F8F8F4', fontSize: 42, lineHeight: 46, fontWeight: '900', letterSpacing: -1.2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7 },
  locationMarker: { color: '#F5C542', fontSize: 15, fontWeight: '900' },
  location: { color: '#F5C542', fontSize: 16, fontWeight: '900' },
  locationChevron: { color: '#A7B0AB', fontSize: 16, fontWeight: '900' },
  conditionCard: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: '#39463F', backgroundColor: '#13201C' },
  conditionIconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A2924' },
  conditionIcon: { color: '#F5C542', fontSize: 28 },
  conditionCopy: { flex: 1 },
  conditionTitle: { color: '#F8F8F4', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  conditionBody: { color: '#AFBAB4', fontSize: 10, lineHeight: 14, marginTop: 3 },
  conditionButton: { borderRadius: 999, borderWidth: 1, borderColor: '#F5C542', paddingHorizontal: 12, paddingVertical: 8 },
  conditionButtonText: { color: '#F5C542', fontSize: 10, fontWeight: '900' },
  searchWrap: { height: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#3A4540', backgroundColor: '#151C1A', paddingLeft: 15 },
  searchIcon: { color: '#C7CECA', fontSize: 26, marginRight: 7, marginTop: -2 },
  input: { flex: 1, color: '#F7F7F4', fontSize: 15, paddingVertical: 13 },
  filterIconButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  filterIcon: { color: '#C7CECA', fontSize: 20, fontWeight: '900' },
  categoryRow: { gap: 9, paddingRight: 18, paddingBottom: 2 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, borderWidth: 1, borderColor: '#3A4540', backgroundColor: '#111715', paddingHorizontal: 15, paddingVertical: 10 },
  categoryChipActive: { backgroundColor: '#F5C542', borderColor: '#F5C542' },
  categoryIcon: { color: '#E5E9E6', fontSize: 15, fontWeight: '900' },
  categoryText: { color: '#E5E9E6', fontSize: 13, fontWeight: '800' },
  categoryTextActive: { color: '#121816' },
  loader: { marginTop: 28 },
  error: { color: '#FF9B8F', paddingHorizontal: 18, paddingTop: 14, fontWeight: '700' },
  section: { marginTop: 25 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 10 },
  sectionTitle: { color: '#F7F7F4', fontSize: 20, fontWeight: '900', letterSpacing: -.3 },
  sectionAction: { color: '#F5C542', fontSize: 12, fontWeight: '900' },
  horizontalContent: { paddingHorizontal: 18, gap: 11 },
  expandedList: { paddingHorizontal: 18, gap: 12 },
  adventureTile: { width: 220, overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#303A35', backgroundColor: '#111715' },
  adventureTileWide: { width: '100%' },
  tileImage: { height: 150 },
  tileImageWide: { height: 190 },
  tileImageCorners: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  tileShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.16)', padding: 9 },
  tileTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  distanceBadge: { color: '#FFFFFF', backgroundColor: 'rgba(8,13,12,.72)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '900' },
  heartButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(8,13,12,.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,.5)', alignItems: 'center', justifyContent: 'center' },
  heart: { color: '#FFFFFF', fontSize: 18 },
  tileFallback: { backgroundColor: '#1E3A31', alignItems: 'center', justifyContent: 'center' },
  tileFallbackIcon: { color: '#F5C542', fontSize: 35, fontWeight: '900' },
  tileCopy: { padding: 11 },
  tileTitle: { color: '#F7F7F4', fontSize: 15, fontWeight: '900' },
  tileMeta: { color: '#AEB8B2', fontSize: 10, marginTop: 4 },
  tileDate: { color: '#F5C542', fontSize: 10, fontWeight: '800', marginTop: 6 },
  eventCard: { width: 306, minHeight: 126, flexDirection: 'row', overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#303A35', backgroundColor: '#111715' },
  eventCardWide: { width: '100%' },
  eventDateBlock: { width: 62, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151E1B' },
  eventMonth: { color: '#F5C542', fontSize: 9, fontWeight: '900' },
  eventDay: { color: '#F8F8F4', fontSize: 29, lineHeight: 31, fontWeight: '900' },
  eventWeekday: { color: '#AAB4AE', fontSize: 9, fontWeight: '800' },
  eventVisual: { width: 92, alignSelf: 'stretch' },
  eventVisualImage: { resizeMode: 'cover' },
  eventVisualShade: { flex: 1, backgroundColor: 'rgba(8,13,12,.14)' },
  eventCopy: { flex: 1, justifyContent: 'center', padding: 12 },
  eventTitle: { color: '#F7F7F4', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  eventMeta: { color: '#AEB8B2', fontSize: 10, marginTop: 5 },
  learnCard: { marginHorizontal: 18, marginTop: 27, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#315248', backgroundColor: '#10241F' },
  learnIconWrap: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#203329', alignItems: 'center', justifyContent: 'center' },
  learnIcon: { fontSize: 26 },
  learnCopy: { flex: 1 },
  learnEyebrow: { color: '#F5C542', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  learnTitle: { color: '#F7F7F4', fontSize: 16, fontWeight: '900', marginTop: 2 },
  learnBody: { color: '#A9B6AF', fontSize: 10, lineHeight: 14, marginTop: 3 },
  learnArrow: { color: '#F5C542', fontSize: 28 },
  empty: { marginHorizontal: 18, marginTop: 28, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: '#2E3934', backgroundColor: '#111715', alignItems: 'center' },
  emptyTitle: { color: '#F7F7F4', fontSize: 18, fontWeight: '900' },
  emptyBody: { color: '#AAB5AF', fontSize: 12, marginTop: 5 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,.62)' },
  filterSheet: { maxHeight: '66%', backgroundColor: '#111816', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#303B36', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 13 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#52605A', alignSelf: 'center', marginBottom: 4 },
  filterPanelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterPanelTitle: { color: '#F7F7F4', fontSize: 20, fontWeight: '900' },
  resetFilter: { color: '#F5C542', fontSize: 12, fontWeight: '900' },
  filterLabel: { color: '#839088', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 3 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: '#46544C', paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { backgroundColor: '#F5C542', borderColor: '#F5C542' },
  filterChipText: { color: '#D6DDD9', fontSize: 11, fontWeight: '800' },
  filterChipTextActive: { color: '#151B18' },
  showResultsButton: { marginTop: 6, borderRadius: 16, backgroundColor: '#F5C542', alignItems: 'center', paddingVertical: 14 },
  showResultsText: { color: '#111816', fontSize: 14, fontWeight: '900' },
});
