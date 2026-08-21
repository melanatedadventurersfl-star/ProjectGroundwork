import * as Location from 'expo-location';
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

const sortOptions: Array<{ value: SortMode; label: string; helper: string }> = [
  { value: 'closest', label: 'Closest', helper: 'Nearest to you' },
  { value: 'soonest', label: 'Soonest', helper: 'Coming up next' },
  { value: 'newest', label: 'Newest', helper: 'Recently added' },
  { value: 'price', label: 'Price', helper: 'Lowest first' },
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
        <ImageBackground
          source={{ uri: adventure.hero_image_url }}
          style={[s.tileImage, wide && s.tileImageWide]}
          imageStyle={s.tileImageCorners}
        >
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
        <View style={[s.tileImage, wide && s.tileImageWide, s.tileFallback]}>
          <Text style={s.tileFallbackIcon}>↗</Text>
        </View>
      )}
      <View style={s.tileCopy}>
        <Text style={s.tileTitle} numberOfLines={wide ? 2 : 1}>{adventure.title}</Text>
        <Text style={s.tileMeta} numberOfLines={1}>{adventure.category} · {adventure.city}, {adventure.state}</Text>
        <Text style={s.tileDate}>
          {new Date(adventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </View>
    </Pressable>
  );
}

function FeaturedHero({ adventure }: { adventure: AdventureSummary }) {
  const start = new Date(adventure.starts_at);
  const dateLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const content = (
    <View style={s.featureHeroShade}>
      <View style={s.featureHeroCopy}>
        <Text style={s.featureHeroEyebrow}>FEATURED ADVENTURE</Text>
        <Text style={s.featureHeroTitle} numberOfLines={2}>{adventure.title}</Text>
        <Text style={s.featureHeroMeta} numberOfLines={1}>⌖ {adventure.city}, {adventure.state}   ·   {dateLabel}</Text>
        {adventure.summary ? <Text style={s.featureHeroBody} numberOfLines={2}>{adventure.summary}</Text> : null}
        <View style={s.featureHeroButton}>
          <Text style={s.featureHeroButtonText}>View Adventure  →</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Pressable
      style={s.featureHero}
      onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: adventure.id } })}
    >
      {adventure.hero_image_url ? (
        <ImageBackground source={{ uri: adventure.hero_image_url }} style={s.featureHeroImage} imageStyle={s.featureHeroImageCorners}>
          {content}
        </ImageBackground>
      ) : (
        <View style={[s.featureHeroImage, s.featureHeroFallback]}>{content}</View>
      )}
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
      <ImageBackground source={imageSource} style={s.eventVisual} imageStyle={s.eventVisualImage}>
        <View style={s.eventVisualShade} />
      </ImageBackground>
      <View style={s.eventCopy}>
        <Text style={s.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={s.eventMeta} numberOfLines={1}>{event.category} · {event.city}, {event.state}</Text>
        <Text style={s.eventDateLine}>
          {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          {distance != null ? ` · ${distance.toFixed(0)} mi` : ''}
        </Text>
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
  const [showFilters, setShowFilters] = useState(false);
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
    const distanceMatch = radius === 'Anywhere' || distance == null || distance <= radiusLimit;
    return textMatch && distanceMatch && matchesQuickTags(event, selectedTags);
  }).sort((a, b) => sort === 'closest'
    ? (a.distance ?? 9999) - (b.distance ?? 9999)
    : new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()),
  [events, radius, radiusLimit, savedCenter, search, searchCenter, selectedTags, sort]);

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

  function toggleExpanded(section: Exclude<ExpandedSection, null>) {
    setExpandedSection((current) => current === section ? null : section);
  }

  function resetFilters() {
    setSort('closest');
    setSelectedTags([]);
    setRadius('50');
  }

  const featured = visibleAdventures
    .filter((item) => item.is_featured)
    .concat(visibleAdventures.filter((item) => !item.is_featured));
  const heroAdventure = adventures.find((item) => item.is_featured && item.hero_image_url) ?? adventures.find((item) => item.hero_image_url) ?? adventures[0];
  const featuredPreview = featured.slice(0, 6);
  const popular = visibleAdventures.slice(6, 18).length ? visibleAdventures.slice(6, 18) : visibleAdventures;
  const popularPreview = popular.slice(0, 6);
  const nearby = localEvents;
  const nearbyPreview = nearby.slice(0, 6);
  const isSearching = search.trim().length > 0;
  const resultCount = visibleAdventures.length + localEvents.length;
  const filterCount = (sort !== 'closest' ? 1 : 0) + selectedTags.length + (radius !== '50' ? 1 : 0);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#F5C542" />}
      >
        <View style={s.hero}>
          <Text style={s.title}>Melanated Adventures</Text>

          {!loading && !isSearching && heroAdventure ? <FeaturedHero adventure={heroAdventure} /> : null}

          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search places, adventures & events"
              placeholderTextColor="#909A95"
              style={s.input}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <Pressable style={[s.filterIconButton, filterCount > 0 && s.filterIconButtonActive]} onPress={() => setShowFilters(true)}>
              <Text style={[s.filterIcon, filterCount > 0 && s.filterIconActive]}>☷</Text>
              {filterCount > 0 ? <View style={s.filterCountBadge}><Text style={s.filterCountText}>{filterCount}</Text></View> : null}
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
            {categories.map((item) => (
              <Pressable
                key={item}
                onPress={() => chooseCategory(item)}
                style={[s.categoryChip, category === item && s.categoryChipActive]}
              >
                <Text style={[s.categoryIcon, category === item && s.categoryTextActive]}>{categoryIcons[item]}</Text>
                <Text style={[s.categoryText, category === item && s.categoryTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#F5C542" style={s.loader} /> : null}

        {!loading && featuredPreview.length ? (
          <View style={s.section}>
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
            <SectionHeader
              title={`Popular Around ${currentLocationLabel.split(',')[0] ?? currentLocationLabel}`}
              expanded={expandedSection === 'popular'}
              onPress={() => toggleExpanded('popular')}
            />
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
            <Text style={s.emptyTitle}>{isSearching ? 'No matches found' : 'Nothing nearby yet'}</Text>
            <Text style={s.emptyBody}>{isSearching ? 'Try another keyword, city, or activity.' : 'Try widening your radius or clearing a filter.'}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={s.modalRoot}>
          <Pressable style={s.modalBackdrop} onPress={() => setShowFilters(false)} />
          <View style={[s.filterSheet, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={s.sheetHandle} />
            <View style={s.filterPanelTop}>
              <View style={s.filterHeadingCopy}>
                <Text style={s.filterPanelTitle}>Refine Adventures</Text>
                <Text style={s.filterPanelSubtitle}>Fine-tune what shows up around {currentLocationLabel.split(',')[0] ?? currentLocationLabel}.</Text>
              </View>
              <Pressable onPress={resetFilters} hitSlop={8} style={s.resetButton}>
                <Text style={s.resetFilter}>Clear</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.filterScrollContent}>
              <View style={s.filterSection}>
                <Text style={s.filterLabel}>SORT BY</Text>
                <View style={s.sortGrid}>
                  {sortOptions.map((option) => {
                    const active = sort === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setSort(option.value)}
                        style={[s.sortCard, active && s.sortCardActive]}
                      >
                        <View style={[s.radioOuter, active && s.radioOuterActive]}>
                          {active ? <View style={s.radioInner} /> : null}
                        </View>
                        <View style={s.sortCardCopy}>
                          <Text style={[s.sortCardTitle, active && s.sortCardTitleActive]}>{option.label}</Text>
                          <Text style={[s.sortCardHelper, active && s.sortCardHelperActive]}>{option.helper}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={s.filterDivider} />

              <View style={s.filterSection}>
                <View style={s.filterSectionHeading}>
                  <Text style={s.filterLabel}>DISTANCE</Text>
                  <Text style={s.filterSectionValue}>{radius === 'Anywhere' ? 'Anywhere in Florida' : `Within ${radius} miles`}</Text>
                </View>
                <View style={s.radiusRail}>
                  {radii.map((value) => {
                    const active = radius === value;
                    return (
                      <Pressable key={value} onPress={() => setRadius(value)} style={[s.radiusOption, active && s.radiusOptionActive]}>
                        <Text style={[s.radiusOptionText, active && s.radiusOptionTextActive]}>{value === 'Anywhere' ? 'Any' : value}</Text>
                        <Text style={[s.radiusOptionUnit, active && s.radiusOptionTextActive]}>{value === 'Anywhere' ? 'Florida' : 'mi'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={s.filterDivider} />

              <View style={s.filterSection}>
                <Text style={s.filterLabel}>GOOD FOR</Text>
                <View style={s.quickFilterGrid}>
                  {quickTags.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <Pressable key={tag} onPress={() => toggleTag(tag)} style={[s.quickFilterCard, active && s.quickFilterCardActive]}>
                        <View style={[s.checkBox, active && s.checkBoxActive]}>
                          {active ? <Text style={s.checkMark}>✓</Text> : null}
                        </View>
                        <Text style={[s.quickFilterText, active && s.quickFilterTextActive]}>{tag}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={s.filterFooter}>
              <View style={s.filterSummary}>
                <Text style={s.filterSummaryNumber}>{resultCount}</Text>
                <Text style={s.filterSummaryLabel}>{resultCount === 1 ? 'result' : 'results'}</Text>
              </View>
              <Pressable style={s.showResultsButton} onPress={() => setShowFilters(false)}>
                <Text style={s.showResultsText}>Show adventures</Text>
              </Pressable>
            </View>
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
  locationRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7 },
  locationMarker: { color: '#F5C542', fontSize: 17, fontWeight: '900' },
  location: { color: '#F5C542', fontSize: 16, fontWeight: '900' },
  featureHero: { height: 194, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#5C5631', backgroundColor: '#16241F' },
  featureHeroImage: { flex: 1 },
  featureHeroImageCorners: { borderRadius: 19 },
  featureHeroFallback: { backgroundColor: '#173127' },
  featureHeroShade: { flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: 'rgba(3,8,7,.43)' },
  featureHeroCopy: { maxWidth: '88%' },
  featureHeroEyebrow: { color: '#F5C542', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  featureHeroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 28, fontWeight: '900', marginTop: 4, letterSpacing: -.5 },
  featureHeroMeta: { color: '#F0F3F1', fontSize: 10, fontWeight: '700', marginTop: 6 },
  featureHeroBody: { color: '#D6DED9', fontSize: 10, lineHeight: 14, marginTop: 6 },
  featureHeroButton: { alignSelf: 'flex-start', marginTop: 11, borderRadius: 999, backgroundColor: '#F5C542', paddingHorizontal: 15, paddingVertical: 9 },
  featureHeroButtonText: { color: '#121816', fontSize: 11, fontWeight: '900' },
  searchWrap: { height: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#3A4540', backgroundColor: '#151C1A', paddingLeft: 15 },
  searchIcon: { color: '#C7CECA', fontSize: 26, marginRight: 7, marginTop: -2 },
  input: { flex: 1, color: '#F7F7F4', fontSize: 15, paddingVertical: 13 },
  filterIconButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  filterIconButtonActive: { backgroundColor: '#F5C542' },
  filterIcon: { color: '#C7CECA', fontSize: 20, fontWeight: '900' },
  filterIconActive: { color: '#111816' },
  filterCountBadge: { position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F4' },
  filterCountText: { color: '#111816', fontSize: 9, fontWeight: '900' },
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
  eventCard: { width: 320, minHeight: 112, flexDirection: 'row', overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#303A35', backgroundColor: '#111715' },
  eventCardWide: { width: '100%' },
  eventVisual: { width: 112, alignSelf: 'stretch' },
  eventVisualImage: { resizeMode: 'cover' },
  eventVisualShade: { flex: 1, backgroundColor: 'rgba(8,13,12,.10)' },
  eventCopy: { flex: 1, justifyContent: 'center', padding: 12 },
  eventTitle: { color: '#F7F7F4', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  eventMeta: { color: '#AEB8B2', fontSize: 10, marginTop: 5 },
  eventDateLine: { color: '#F5C542', fontSize: 10, fontWeight: '800', marginTop: 6 },
  empty: { marginHorizontal: 18, marginTop: 28, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: '#2E3934', backgroundColor: '#111715', alignItems: 'center' },
  emptyTitle: { color: '#F7F7F4', fontSize: 18, fontWeight: '900' },
  emptyBody: { color: '#AAB5AF', fontSize: 12, marginTop: 5, textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,.70)' },
  filterSheet: { maxHeight: '82%', backgroundColor: '#101714', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: '#344039', paddingHorizontal: 18, paddingTop: 10 },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#52605A', alignSelf: 'center', marginBottom: 14 },
  filterPanelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 4 },
  filterHeadingCopy: { flex: 1 },
  filterPanelTitle: { color: '#F7F7F4', fontSize: 23, lineHeight: 28, fontWeight: '900', letterSpacing: -.4 },
  filterPanelSubtitle: { color: '#98A49E', fontSize: 11, lineHeight: 15, marginTop: 4 },
  resetButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: '#47534C', alignItems: 'center', justifyContent: 'center' },
  resetFilter: { color: '#F5C542', fontSize: 11, fontWeight: '900' },
  filterScrollContent: { paddingTop: 14, paddingBottom: 10 },
  filterSection: { gap: 10 },
  filterSectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  filterLabel: { color: '#89958E', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  filterSectionValue: { color: '#D9DEDB', fontSize: 10, fontWeight: '800' },
  filterDivider: { height: 1, backgroundColor: '#26312C', marginVertical: 17 },
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortCard: { width: '48.7%', minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#3B4841', backgroundColor: '#131B18' },
  sortCardActive: { borderColor: '#F5C542', backgroundColor: '#1D2117' },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#66736C', alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: '#F5C542' },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#F5C542' },
  sortCardCopy: { flex: 1 },
  sortCardTitle: { color: '#E4E9E6', fontSize: 12, fontWeight: '900' },
  sortCardTitleActive: { color: '#F7F7F4' },
  sortCardHelper: { color: '#7F8B84', fontSize: 9, marginTop: 2 },
  sortCardHelperActive: { color: '#B6BDAF' },
  radiusRail: { flexDirection: 'row', gap: 7 },
  radiusOption: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#3B4841', backgroundColor: '#131B18' },
  radiusOptionActive: { borderColor: '#F5C542', backgroundColor: '#F5C542' },
  radiusOptionText: { color: '#E0E5E2', fontSize: 13, fontWeight: '900' },
  radiusOptionUnit: { color: '#78857E', fontSize: 8, fontWeight: '800', marginTop: 1 },
  radiusOptionTextActive: { color: '#111816' },
  quickFilterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickFilterCard: { width: '48.7%', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: '#3B4841', backgroundColor: '#131B18' },
  quickFilterCardActive: { borderColor: '#6C6230', backgroundColor: '#222315' },
  checkBox: { width: 19, height: 19, borderRadius: 6, borderWidth: 1.5, borderColor: '#66736C', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { borderColor: '#F5C542', backgroundColor: '#F5C542' },
  checkMark: { color: '#111816', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  quickFilterText: { flex: 1, color: '#D9DEDB', fontSize: 10, fontWeight: '800' },
  quickFilterTextActive: { color: '#F7F7F4' },
  filterFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#26312C' },
  filterSummary: { minWidth: 58, alignItems: 'center' },
  filterSummaryNumber: { color: '#F7F7F4', fontSize: 20, lineHeight: 21, fontWeight: '900' },
  filterSummaryLabel: { color: '#89958E', fontSize: 9, fontWeight: '800', marginTop: 2 },
  showResultsButton: { flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: '#F5C542', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  showResultsText: { color: '#111816', fontSize: 14, fontWeight: '900' },
});