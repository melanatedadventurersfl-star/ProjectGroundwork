import * as Location from 'expo-location';
import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAdventures, setAdventureSaved } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { useAuth } from '../../src/auth/AuthProvider';
import { distanceMiles, pointForCity, resolveSearchCenter } from '../../src/explore/location';
import { listLocalEvents, type LocalEvent } from '../../src/local-events/api';
import { supabase } from '../../src/lib/supabase';

type SortMode =
  | 'closest'
  | 'farthest'
  | 'soonest'
  | 'latest'
  | 'price_low'
  | 'price_high'
  | 'activity'
  | 'title';
type Point = { latitude: number; longitude: number };
type ExpandedSection = 'featured' | 'events' | 'popular' | null;
type SmartFilter = 'activity' | 'distance' | 'goodFor' | 'sort' | null;

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

const sortOptions: Array<{ value: SortMode; label: string; helper: string }> = [
  { value: 'closest', label: 'Closest', helper: 'Nearest first' },
  { value: 'farthest', label: 'Farthest', helper: 'Farthest first' },
  { value: 'soonest', label: 'Soonest', helper: 'Coming up next' },
  { value: 'latest', label: 'Latest date', helper: 'Farthest date first' },
  { value: 'price_low', label: 'Price: Low to High', helper: 'Lowest price first' },
  { value: 'price_high', label: 'Price: High to Low', helper: 'Highest price first' },
  { value: 'activity', label: 'Activity', helper: 'Activity A to Z' },
  { value: 'title', label: 'Name', helper: 'Adventure name A to Z' },
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
  if (/accessible|wheelchair|ada/.test(text)) tags.push('Accessible');
  return tags;
}

function isWeekend(date: string) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

function matchesQuickTags(
  item: { title: string; description?: string | null; category?: string | null; starts_at: string },
  tags: string[],
) {
  if (!tags.length) return true;
  const tagsForItem = inferredTags(item);
  return tags.every((tag) => (tag === 'Weekend' ? isWeekend(item.starts_at) : tagsForItem.includes(tag)));
}

function formatPrice(cents: number) {
  if (!cents) return 'Free';
  const dollars = cents / 100;
  return `From ${dollars.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: dollars % 1 ? 2 : 0 })}`;
}

function SectionHeader({ title, expanded, onPress }: { title: string; expanded: boolean; onPress: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={s.sectionAction}>{expanded ? 'Show less' : 'See all'} ›</Text>
      </Pressable>
    </View>
  );
}

function AdventureTile({
  adventure,
  distance,
  onToggleSaved,
  wide = false,
}: {
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
              <View style={s.tileBadges}>
                {adventure.is_demo ? <Text style={s.demoBadge}>DEMO</Text> : null}
                {distance != null ? <Text style={s.distanceBadge}>⌖ {distance.toFixed(0)} mi</Text> : null}
              </View>
              <Pressable
                style={[s.saveButton, adventure.is_saved && s.saveButtonActive]}
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleSaved(adventure);
                }}
              >
                <Ionicons name={adventure.is_saved ? 'bookmark' : 'bookmark-outline'} size={18} color={adventure.is_saved ? '#111816' : '#FFFFFF'} />
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
        <View style={s.tileBottomRow}>
          <Text style={s.tileDate}>{new Date(adventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          <Text style={s.tilePrice}>{formatPrice(adventure.starting_price_cents)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function FeaturedHero({ adventure }: { adventure: AdventureSummary }) {
  const dateLabel = new Date(adventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const content = (
    <View style={s.featureHeroShade}>
      <View style={s.featureHeroCopy}>
        <Text style={s.featureHeroEyebrow}>FEATURED ADVENTURE</Text>
        <Text style={s.featureHeroTitle} numberOfLines={2}>{adventure.title}</Text>
        <Text style={s.featureHeroMeta} numberOfLines={1}>⌖ {adventure.city}, {adventure.state} · {dateLabel}</Text>
        <Text style={s.featureHeroPrice}>{formatPrice(adventure.starting_price_cents)}</Text>
        {adventure.summary ? <Text style={s.featureHeroBody} numberOfLines={2}>{adventure.summary}</Text> : null}
        <View style={s.featureHeroButton}><Text style={s.featureHeroButtonText}>View Adventure →</Text></View>
      </View>
    </View>
  );
  return (
    <Pressable style={s.featureHero} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: adventure.id } })}>
      {adventure.hero_image_url ? (
        <ImageBackground source={{ uri: adventure.hero_image_url }} style={s.featureHeroImage} imageStyle={s.featureHeroImageCorners}>{content}</ImageBackground>
      ) : <View style={[s.featureHeroImage, s.featureHeroFallback]}>{content}</View>}
    </Pressable>
  );
}

function EventCard({ event, distance, wide = false }: { event: LocalEvent; distance?: number | null; wide?: boolean }) {
  const date = new Date(event.starts_at);
  const imageSource = event.image_url ? { uri: event.image_url } : DEFAULT_EVENT_IMAGE;
  return (
    <Pressable style={[s.eventCard, wide && s.eventCardWide]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      <ImageBackground source={imageSource} style={s.eventVisual} imageStyle={s.eventVisualImage}><View style={s.eventVisualShade} /></ImageBackground>
      <View style={s.eventCopy}>
        <Text style={s.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={s.eventMeta} numberOfLines={1}>{event.category} · {event.city}, {event.state}</Text>
        <Text style={s.eventDateLine}>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{distance != null ? ` · ${distance.toFixed(0)} mi` : ''}</Text>
        <Text style={s.eventPrice}>{event.is_free ? 'Free' : 'See outing for price'}</Text>
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [radius, setRadius] = useState('50');
  const [sort, setSort] = useState<SortMode>('closest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeSmartFilter, setActiveSmartFilter] = useState<SmartFilter>(null);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
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
        // Profile location remains the fallback when device location is unavailable.
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
        userId ? supabase.from('profiles').select('home_city,home_state').eq('id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      setAdventures(nextAdventures);
      setEvents(nextEvents);
      setHomeCity(profile.data?.home_city ?? '');
      setHomeState(profile.data?.home_state ?? '');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Melanated Adventures.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  const savedCenter = useMemo(() => resolveSearchCenter(search, homeCity, homeState), [search, homeCity, homeState]);
  const searchCenter = search.trim() ? savedCenter : currentPoint ?? savedCenter;
  const radiusLimit = radius === 'Anywhere' ? Number.POSITIVE_INFINITY : Number(radius);

  const compareAdventure = useCallback((a: AdventureSummary, b: AdventureSummary) => {
    if (sort === 'price_low') return a.starting_price_cents - b.starting_price_cents;
    if (sort === 'price_high') return b.starting_price_cents - a.starting_price_cents;
    if (sort === 'soonest') return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    if (sort === 'latest') return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    if (sort === 'activity') return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (searchCenter) {
      const ad = a.latitude == null || a.longitude == null ? 9999 : distanceMiles(searchCenter, { latitude: a.latitude, longitude: a.longitude });
      const bd = b.latitude == null || b.longitude == null ? 9999 : distanceMiles(searchCenter, { latitude: b.latitude, longitude: b.longitude });
      return sort === 'farthest' ? bd - ad : ad - bd;
    }
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  }, [searchCenter, sort]);

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
    .sort(compareAdventure), [adventures, category, compareAdventure, radius, radiusLimit, savedCenter, search, searchCenter, selectedTags]);

  const localEvents = useMemo(() => events.map((event) => {
    const point = pointForCity(event.city, event.state);
    return { event, distance: searchCenter && point ? distanceMiles(searchCenter, point) : null };
  }).filter(({ event, distance }) => {
    const query = search.trim().toLowerCase();
    const searchable = `${event.title} ${event.host_name} ${event.city} ${event.state} ${event.category} ${event.description}`.toLowerCase();
    return (!query || searchable.includes(query) || savedCenter != null)
      && (radius === 'Anywhere' || distance == null || distance <= radiusLimit)
      && matchesQuickTags(event, selectedTags);
  }).sort((a, b) => {
    if (sort === 'farthest') return (b.distance ?? -1) - (a.distance ?? -1);
    if (sort === 'closest') return (a.distance ?? 9999) - (b.distance ?? 9999);
    if (sort === 'latest') return new Date(b.event.starts_at).getTime() - new Date(a.event.starts_at).getTime();
    if (sort === 'activity') return a.event.category.localeCompare(b.event.category) || a.event.title.localeCompare(b.event.title);
    if (sort === 'title') return a.event.title.localeCompare(b.event.title);
    return new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime();
  }), [events, radius, radiusLimit, savedCenter, search, searchCenter, selectedTags, sort]);

  async function toggle(adventure: AdventureSummary) {
    if (!session) return promptForAccount('Saving adventures');
    const next = !adventure.is_saved;
    setAdventures((current) => current.map((item) => item.id === adventure.id ? { ...item, is_saved: next } : item));
    try { await setAdventureSaved(adventure.id, next); } catch { void load(); }
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]);
  }

  function distanceFor(adventure: AdventureSummary) {
    if (!searchCenter || adventure.latitude == null || adventure.longitude == null) return null;
    return distanceMiles(searchCenter, { latitude: adventure.latitude, longitude: adventure.longitude });
  }

  function resetFilters() {
    setCategory('All');
    setRadius('50');
    setSelectedTags([]);
  }

  const featured = visibleAdventures.filter((item) => item.is_featured).concat(visibleAdventures.filter((item) => !item.is_featured));
  const heroAdventure = adventures.find((item) => item.is_featured && item.hero_image_url) ?? adventures.find((item) => item.hero_image_url) ?? adventures[0];
  const featuredPreview = featured.slice(0, 6);
  const popular = visibleAdventures.slice(6, 18).length ? visibleAdventures.slice(6, 18) : visibleAdventures;
  const popularPreview = popular.slice(0, 6);
  const nearbyPreview = localEvents.slice(0, 6);
  const isSearching = search.trim().length > 0;
  const resultCount = visibleAdventures.length + localEvents.length;
  const filterCount = (category !== 'All' ? 1 : 0) + selectedTags.length + (radius !== '50' ? 1 : 0);
  const currentSort = sortOptions.find((option) => option.value === sort) ?? sortOptions[0];

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#F5C542" />}>
        <View style={s.hero}>
          <Text style={s.title}>Melanated Adventures</Text>
          {!loading && !isSearching && heroAdventure ? <FeaturedHero adventure={heroAdventure} /> : null}

          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search places, adventures & events" placeholderTextColor="#909A95" style={s.input} returnKeyType="search" clearButtonMode="while-editing" />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.smartBar}>
            <Pressable onPress={() => setActiveSmartFilter('activity')} style={[s.smartChip, category !== 'All' && s.smartChipActive]}>
              <Text style={[s.smartChipText, category !== 'All' && s.smartChipTextActive]}>{category === 'All' ? 'Activity' : `${categoryIcons[category] ?? ''} ${category}`}</Text><Text style={s.smartChevron}>⌄</Text>
            </Pressable>
            <Pressable onPress={() => setActiveSmartFilter('distance')} style={[s.smartChip, radius !== '50' && s.smartChipActive]}>
              <Text style={[s.smartChipText, radius !== '50' && s.smartChipTextActive]}>{radius === 'Anywhere' ? 'Florida' : `${radius} mi`}</Text><Text style={s.smartChevron}>⌄</Text>
            </Pressable>
            <Pressable onPress={() => setActiveSmartFilter('goodFor')} style={[s.smartChip, selectedTags.length > 0 && s.smartChipActive]}>
              <Text style={[s.smartChipText, selectedTags.length > 0 && s.smartChipTextActive]}>{selectedTags.length ? `${selectedTags.length} good for` : 'Good for'}</Text><Text style={s.smartChevron}>⌄</Text>
            </Pressable>
            <Pressable onPress={() => setActiveSmartFilter('sort')} style={s.sortChip}>
              <Ionicons name="swap-vertical" size={14} color="#111816" />
              <Text style={s.sortChipText}>Sort: {currentSort.label}</Text><Text style={s.sortChipText}>⌄</Text>
            </Pressable>
          </ScrollView>

          <View style={s.smartSummary}>
            <Text style={s.smartSummaryText}>{resultCount} {resultCount === 1 ? 'result' : 'results'} · Sorted by {currentSort.label}</Text>
            {filterCount > 0 ? <Pressable onPress={resetFilters} hitSlop={8}><Text style={s.smartClear}>Clear filters</Text></Pressable> : null}
          </View>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#F5C542" style={s.loader} /> : null}

        {!loading && featuredPreview.length ? (
          <View style={s.section}>
            <SectionHeader title="Featured Adventures" expanded={expandedSection === 'featured'} onPress={() => setExpandedSection((current) => current === 'featured' ? null : 'featured')} />
            {expandedSection === 'featured' ? <View style={s.expandedList}>{featured.map((adventure) => <AdventureTile key={adventure.id} adventure={adventure} distance={distanceFor(adventure)} onToggleSaved={toggle} wide />)}</View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalContent}>{featuredPreview.map((adventure) => <AdventureTile key={adventure.id} adventure={adventure} distance={distanceFor(adventure)} onToggleSaved={toggle} />)}</ScrollView>}
          </View>
        ) : null}

        {!loading && nearbyPreview.length ? (
          <View style={s.section}>
            <SectionHeader title="Outings Happening Near You" expanded={expandedSection === 'events'} onPress={() => setExpandedSection((current) => current === 'events' ? null : 'events')} />
            {expandedSection === 'events' ? <View style={s.expandedList}>{localEvents.map(({ event, distance }) => <EventCard key={event.id} event={event} distance={distance} wide />)}</View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalContent}>{nearbyPreview.map(({ event, distance }) => <EventCard key={event.id} event={event} distance={distance} />)}</ScrollView>}
          </View>
        ) : null}

        {!loading && popularPreview.length ? (
          <View style={s.section}>
            <SectionHeader title={`Popular Around ${currentLocationLabel.split(',')[0] ?? currentLocationLabel}`} expanded={expandedSection === 'popular'} onPress={() => setExpandedSection((current) => current === 'popular' ? null : 'popular')} />
            {expandedSection === 'popular' ? <View style={s.expandedList}>{popular.map((adventure) => <AdventureTile key={`popular-${adventure.id}`} adventure={adventure} distance={distanceFor(adventure)} onToggleSaved={toggle} wide />)}</View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalContent}>{popularPreview.map((adventure) => <AdventureTile key={`popular-${adventure.id}`} adventure={adventure} distance={distanceFor(adventure)} onToggleSaved={toggle} />)}</ScrollView>}
          </View>
        ) : null}

        {!loading && !featuredPreview.length && !nearbyPreview.length ? <View style={s.empty}><Text style={s.emptyTitle}>{isSearching ? 'No matches found' : 'Nothing nearby yet'}</Text><Text style={s.emptyBody}>{isSearching ? 'Try another keyword, city, or activity.' : 'Try widening your radius or clearing a filter.'}</Text></View> : null}
      </ScrollView>

      <Modal visible={activeSmartFilter !== null} transparent animationType="fade" onRequestClose={() => setActiveSmartFilter(null)}>
        <View style={s.quickModalRoot}>
          <Pressable style={s.quickModalBackdrop} onPress={() => setActiveSmartFilter(null)} />
          <View style={[s.quickSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={s.quickSheetHandle} />
            <View style={s.quickSheetHeader}>
              <Text style={s.quickSheetTitle}>{activeSmartFilter === 'activity' ? 'Activity' : activeSmartFilter === 'distance' ? 'Distance' : activeSmartFilter === 'goodFor' ? 'Good for' : 'Sort results'}</Text>
              <Pressable onPress={() => setActiveSmartFilter(null)} hitSlop={8}><Text style={s.quickDone}>Done</Text></Pressable>
            </View>

            {activeSmartFilter === 'activity' ? <View style={s.quickOptionWrap}><Pressable onPress={() => setCategory('All')} style={[s.quickOption, category === 'All' && s.quickOptionActive]}><Text style={[s.quickOptionText, category === 'All' && s.quickOptionTextActive]}>All activities</Text></Pressable>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[s.quickOption, category === item && s.quickOptionActive]}><Text style={[s.quickOptionText, category === item && s.quickOptionTextActive]}>{categoryIcons[item] ?? ''} {item}</Text></Pressable>)}</View> : null}
            {activeSmartFilter === 'distance' ? <View style={s.quickOptionWrap}>{radii.map((value) => <Pressable key={value} onPress={() => setRadius(value)} style={[s.quickOption, radius === value && s.quickOptionActive]}><Text style={[s.quickOptionText, radius === value && s.quickOptionTextActive]}>{value === 'Anywhere' ? 'Anywhere in Florida' : `Within ${value} miles`}</Text></Pressable>)}</View> : null}
            {activeSmartFilter === 'goodFor' ? <View style={s.quickOptionWrap}>{quickTags.map((tag) => { const active = selectedTags.includes(tag); return <Pressable key={tag} onPress={() => toggleTag(tag)} style={[s.quickOption, active && s.quickOptionActive]}><Text style={[s.quickOptionText, active && s.quickOptionTextActive]}>{active ? '✓ ' : ''}{tag}</Text></Pressable>; })}</View> : null}
            {activeSmartFilter === 'sort' ? <View style={s.sortOptionList}>{sortOptions.map((option) => <Pressable key={option.value} onPress={() => { setSort(option.value); setActiveSmartFilter(null); }} style={[s.sortOption, sort === option.value && s.sortOptionActive]}><View style={s.sortOptionCopy}><Text style={[s.quickOptionText, sort === option.value && s.quickOptionTextActive]}>{option.label}</Text><Text style={[s.quickOptionHelper, sort === option.value && s.quickOptionHelperActive]}>{option.helper}</Text></View>{sort === option.value ? <Ionicons name="checkmark-circle" size={20} color="#111816" /> : null}</Pressable>)}</View> : null}
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
  title: { color: '#F8F8F4', fontSize: 39, lineHeight: 43, fontWeight: '900', letterSpacing: -1.2 },
  featureHero: { height: 205, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#5C5631', backgroundColor: '#16241F' },
  featureHeroImage: { flex: 1 },
  featureHeroImageCorners: { borderRadius: 19 },
  featureHeroFallback: { backgroundColor: '#173127' },
  featureHeroShade: { flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: 'rgba(3,8,7,.43)' },
  featureHeroCopy: { maxWidth: '90%' },
  featureHeroEyebrow: { color: '#F5C542', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  featureHeroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 28, fontWeight: '900', marginTop: 4, letterSpacing: -.5 },
  featureHeroMeta: { color: '#F0F3F1', fontSize: 10, fontWeight: '700', marginTop: 6 },
  featureHeroPrice: { color: '#F5C542', fontSize: 12, fontWeight: '900', marginTop: 5 },
  featureHeroBody: { color: '#D6DED9', fontSize: 10, lineHeight: 14, marginTop: 5 },
  featureHeroButton: { alignSelf: 'flex-start', marginTop: 9, borderRadius: 999, backgroundColor: '#F5C542', paddingHorizontal: 15, paddingVertical: 8 },
  featureHeroButtonText: { color: '#121816', fontSize: 11, fontWeight: '900' },
  searchWrap: { height: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#3A4540', backgroundColor: '#151C1A', paddingLeft: 15 },
  searchIcon: { color: '#C7CECA', fontSize: 26, marginRight: 7, marginTop: -2 },
  input: { flex: 1, color: '#F7F7F4', fontSize: 15, paddingVertical: 13 },
  smartBar: { gap: 8, paddingRight: 18, paddingBottom: 1 },
  smartChip: { minHeight: 38, maxWidth: 170, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: '#3A4540', backgroundColor: '#111715', paddingHorizontal: 13 },
  smartChipActive: { borderColor: '#F5C542', backgroundColor: '#F5C542' },
  smartChipText: { color: '#E2E7E4', fontSize: 11, fontWeight: '800' },
  smartChipTextActive: { color: '#111816' },
  smartChevron: { color: '#8F9A94', fontSize: 12, fontWeight: '900' },
  sortChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#F5C542', paddingHorizontal: 13 },
  sortChipText: { color: '#111816', fontSize: 11, fontWeight: '900' },
  smartSummary: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#26312C', paddingTop: 8 },
  smartSummaryText: { color: '#AEB7B2', fontSize: 10, fontWeight: '700' },
  smartClear: { color: '#F5C542', fontSize: 10, fontWeight: '900' },
  quickModalRoot: { flex: 1, justifyContent: 'flex-end' },
  quickModalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,.58)' },
  quickSheet: { maxHeight: '82%', backgroundColor: '#101714', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#344039', paddingHorizontal: 18, paddingTop: 9 },
  quickSheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#52605A', alignSelf: 'center', marginBottom: 12 },
  quickSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  quickSheetTitle: { color: '#F7F7F4', fontSize: 20, fontWeight: '900' },
  quickDone: { color: '#F5C542', fontSize: 12, fontWeight: '900' },
  quickOptionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickOption: { minHeight: 42, minWidth: '47%', flexGrow: 1, justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#3B4841', backgroundColor: '#131B18', paddingHorizontal: 13, paddingVertical: 9 },
  quickOptionActive: { borderColor: '#F5C542', backgroundColor: '#F5C542' },
  quickOptionText: { color: '#E3E8E5', fontSize: 12, fontWeight: '800' },
  quickOptionTextActive: { color: '#111816' },
  quickOptionHelper: { color: '#7F8B84', fontSize: 9, marginTop: 2 },
  quickOptionHelperActive: { color: '#3B3A2C' },
  sortOptionList: { gap: 8 },
  sortOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, borderWidth: 1, borderColor: '#3B4841', backgroundColor: '#131B18', paddingHorizontal: 14, paddingVertical: 9 },
  sortOptionActive: { borderColor: '#F5C542', backgroundColor: '#F5C542' },
  sortOptionCopy: { flex: 1 },
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
  tileBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  demoBadge: { color: '#111816', backgroundColor: '#F5C542', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  distanceBadge: { color: '#FFFFFF', backgroundColor: 'rgba(8,13,12,.72)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '900' },
  saveButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(8,13,12,.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,.5)', alignItems: 'center', justifyContent: 'center' },
  saveButtonActive: { backgroundColor: '#F5C542', borderColor: '#F5C542' },
  tileFallback: { backgroundColor: '#1E3A31', alignItems: 'center', justifyContent: 'center' },
  tileFallbackIcon: { color: '#F5C542', fontSize: 35, fontWeight: '900' },
  tileCopy: { padding: 11 },
  tileTitle: { color: '#F7F7F4', fontSize: 15, fontWeight: '900' },
  tileMeta: { color: '#AEB8B2', fontSize: 10, marginTop: 4 },
  tileBottomRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tileDate: { color: '#F5C542', fontSize: 10, fontWeight: '800' },
  tilePrice: { color: '#F7F7F4', fontSize: 10, fontWeight: '900' },
  eventCard: { width: 320, minHeight: 120, flexDirection: 'row', overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#303A35', backgroundColor: '#111715' },
  eventCardWide: { width: '100%' },
  eventVisual: { width: 112, alignSelf: 'stretch' },
  eventVisualImage: { resizeMode: 'cover' },
  eventVisualShade: { flex: 1, backgroundColor: 'rgba(8,13,12,.10)' },
  eventCopy: { flex: 1, justifyContent: 'center', padding: 12 },
  eventTitle: { color: '#F7F7F4', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  eventMeta: { color: '#AEB8B2', fontSize: 10, marginTop: 5 },
  eventDateLine: { color: '#D6DED9', fontSize: 10, fontWeight: '700', marginTop: 6 },
  eventPrice: { color: '#F5C542', fontSize: 10, fontWeight: '900', marginTop: 5 },
  empty: { marginHorizontal: 18, marginTop: 28, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: '#2E3934', backgroundColor: '#111715', alignItems: 'center' },
  emptyTitle: { color: '#F7F7F4', fontSize: 18, fontWeight: '900' },
  emptyBody: { color: '#AAB5AF', fontSize: 12, marginTop: 5, textAlign: 'center' },
});