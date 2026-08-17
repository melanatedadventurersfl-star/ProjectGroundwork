import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdventureCard } from '../../src/adventures/AdventureCard';
import { listAdventures, setAdventureSaved } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { useAuth } from '../../src/auth/AuthProvider';
import { distanceMiles, pointForCity, resolveSearchCenter } from '../../src/explore/location';
import { getEventHostAccess, listLocalEvents, type LocalEvent } from '../../src/local-events/api';
import { supabase } from '../../src/lib/supabase';
import { getMemberTrips, type MemberTrip } from '../../src/member/api';

type Mode = 'adventures' | 'local' | 'saved' | 'reservations';
type SortMode = 'soonest' | 'closest' | 'newest' | 'price';
type Point = { latitude: number; longitude: number };
type ReservationRow = { kind: 'trip'; id: string; trip: MemberTrip } | { kind: 'local'; id: string; event: LocalEvent };

const categories = ['All', 'Camping', 'Hiking', 'Water', 'Fishing', 'Cycling', 'Travel', 'Culture'];
const visibleCategories = ['Camping', 'Hiking', 'Water', 'Fishing', 'Cycling'];
const categoryIcons: Record<string, string> = {
  Camping: '⛺',
  Hiking: '🥾',
  Water: '≋',
  Fishing: '🎣',
  Cycling: '🚲',
};
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

function textTags(value: { title: string; description?: string | null; category?: string | null }) {
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
  const inferred = textTags(item);
  return tags.every((tag) =>
    tag === 'Upcoming'
      ? new Date(item.starts_at).getTime() >= Date.now()
      : tag === 'Weekend'
        ? isWeekend(item.starts_at)
        : inferred.includes(tag),
  );
}

function LocalCard({ event, distance }: { event: LocalEvent; distance?: number | null }) {
  const tags = textTags(event);
  return (
    <Pressable style={s.card} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      <View style={s.cardTopRow}>
        <Text style={s.badge}>LOCAL EVENT</Text>
        {distance != null ? <Text style={s.distance}>{Math.round(distance)} mi</Text> : null}
      </View>
      <Text style={s.cardTitle}>{event.title}</Text>
      <Text style={s.meta}>{new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {event.city}, {event.state}</Text>
      {tags.length ? <View style={s.miniTags}>{tags.slice(0, 3).map((tag) => <Text key={tag} style={s.miniTag}>{tag}</Text>)}</View> : null}
      <Text style={s.gold}>Hosted by {event.host_name}</Text>
      <Text style={s.body} numberOfLines={2}>{event.description}</Text>
      <Text style={s.gold}>View Local Event →</Text>
    </Pressable>
  );
}

function TripCard({ trip }: { trip: MemberTrip }) {
  const a = trip.adventures;
  return (
    <Pressable style={s.card} onPress={() => router.push('/member/trips')}>
      <Text style={s.badge}>{trip.status === 'held' || trip.status === 'payment_pending' ? 'RESERVATION HELD' : 'RESERVATION'}</Text>
      <Text style={s.cardTitle}>{a?.title ?? 'Adventure reservation'}</Text>
      <Text style={s.meta}>{a ? `${new Date(a.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${a.city}, ${a.state}` : 'Trip details'}</Text>
      <Text style={s.body}>{trip.status.replaceAll('_', ' ')}</Text>
      <Text style={s.gold}>Manage Reservation →</Text>
    </Pressable>
  );
}

function LocalReservationCard({ event }: { event: LocalEvent }) {
  return (
    <Pressable style={s.card} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      <Text style={s.badge}>FREE EVENT · GOING</Text>
      <Text style={s.cardTitle}>{event.title}</Text>
      <Text style={s.meta}>{new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {event.city}, {event.state}</Text>
      <Text style={s.body}>Your RSVP is confirmed. No payment required.</Text>
      <Text style={s.gold}>View Event →</Text>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('adventures');
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [trips, setTrips] = useState<MemberTrip[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [radius, setRadius] = useState('50');
  const [sort, setSort] = useState<SortMode>('soonest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
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
        if (city && state) setCurrentLocationLabel(`Near ${city}, ${state}`);
        else if (city) setCurrentLocationLabel(`Near ${city}`);
      } catch {
        // Explore continues with the saved-location fallback when device location is unavailable.
      }
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const userId = session?.user.id;
      const [a, e, t, h, profile] = await Promise.all([
        listAdventures(filters),
        listLocalEvents(),
        userId ? getMemberTrips() : Promise.resolve([] as MemberTrip[]),
        userId ? getEventHostAccess() : Promise.resolve({ canCreate: false }),
        userId ? supabase.from('profiles').select('home_city,home_state').eq('id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      setAdventures(a);
      setEvents(e);
      setTrips(t);
      setCanCreate(h.canCreate);
      setHomeCity(profile.data?.home_city ?? '');
      setHomeState(profile.data?.home_state ?? '');
      setError(null);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Unable to load Explore.');
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
    if (!session && (next === 'saved' || next === 'reservations')) {
      promptForAccount(next === 'saved' ? 'Saved adventures' : 'Reservations');
      return;
    }
    setMode(next);
  }

  async function toggle(a: AdventureSummary) {
    if (!session) {
      promptForAccount('Saving adventures');
      return;
    }
    const next = !a.is_saved;
    setAdventures((current) => current.map((x) => x.id === a.id ? { ...x, is_saved: next } : x));
    try {
      await setAdventureSaved(a.id, next);
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
    const q = search.trim().toLowerCase();
    const searchable = `${event.title} ${event.host_name} ${event.city} ${event.state} ${event.category} ${event.description}`.toLowerCase();
    const textMatch = !q || searchable.includes(q) || (searchCenter != null && q.includes(event.city.toLowerCase()));
    const distanceMatch = distance == null || distance <= Math.min(50, radiusLimit);
    return textMatch && distanceMatch && matchesQuickTags(event, selectedTags);
  }), [events, radiusLimit, search, searchCenter, selectedTags]);

  const sortedLocal = useMemo(() => [...localWithDistance].sort((a, b) =>
    sort === 'closest'
      ? (a.distance ?? 9999) - (b.distance ?? 9999)
      : sort === 'newest'
        ? b.event.id.localeCompare(a.event.id)
        : new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime(),
  ), [localWithDistance, sort]);

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

  const reservationRows = useMemo<ReservationRow[]>(() => [
    ...trips.map((trip) => ({ kind: 'trip' as const, id: `trip-${trip.id}`, trip })),
    ...events.filter((event) => event.is_free && event.my_rsvp === 'going').map((event) => ({ kind: 'local' as const, id: `local-${event.id}`, event })),
  ], [trips, events]);

  const featuredAdventure = mode === 'adventures'
    ? filteredAdventures.find((item) => item.is_featured) ?? filteredAdventures[0]
    : undefined;
  const nearbyEvent = sortedLocal[0];
  const adventureRows = featuredAdventure ? filteredAdventures.filter((item) => item.id !== featuredAdventure.id) : filteredAdventures;
  const rows: any[] = mode === 'local' ? sortedLocal : mode === 'reservations' ? reservationRows : adventureRows;
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

  const header = (
    <View style={s.header}>
      <Text style={s.eyebrow}>FIND YOUR NEXT OUTSIDE</Text>
      <Text style={s.title}>Explore</Text>

      <Text style={s.location}>⌖  {currentLocationLabel} ⌄</Text>

      <View style={s.tabs}>
        {([['adventures', 'Adventures'], ['local', 'Local Events'], ['saved', 'Saved'], ['reservations', 'Reservations']] as [Mode, string][]).map(([v, label]) => (
          <Pressable key={v} onPress={() => chooseMode(v)} style={[s.tab, mode === v && s.tabActive]}>
            <Text style={[s.tabText, mode === v && s.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'reservations' ? (
        <View style={s.note}>
          <Text style={s.cardTitle}>Everything you’re going to</Text>
          <Text style={s.body}>Paid reservations and free Local Events marked Going appear together here.</Text>
          <Pressable onPress={() => router.push('/member/trips')}><Text style={s.gold}>Open Trips & Payments →</Text></Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={mode === 'local' ? 'Search events, hosts or places' : 'Where do you want to get outside?'}
            placeholderTextColor="#7F8A84"
            style={s.input}
          />

          {mode === 'adventures' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
              {visibleCategories.map((item) => (
                <Pressable key={item} onPress={() => chooseCategory(item)} style={[s.categoryChip, category === item && s.categoryChipActive]}>
                  <Text style={[s.categoryIcon, category === item && s.categoryTextActive]}>{categoryIcons[item]}</Text>
                  <Text style={[s.categoryText, category === item && s.categoryTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {mode === 'adventures' ? (
            <View style={s.todayCard}>
              <View style={s.todayIconWrap}><Text style={s.todayIcon}>☀</Text></View>
              <View style={s.todayCopy}>
                <Text style={s.todayEyebrow}>GOOD FOR TODAY</Text>
                <Text style={s.todayTitle}>See what’s happening around you.</Text>
                <Text style={s.todayBody}>Explore nearby adventures and events using your current location.</Text>
              </View>
            </View>
          ) : null}

          {featuredAdventure ? (
            <Pressable style={s.featuredCard} onPress={() => router.push({ pathname: '/adventures/[slug]', params: { slug: featuredAdventure.slug } })}>
              {featuredAdventure.hero_image_url ? (
                <ImageBackground source={{ uri: featuredAdventure.hero_image_url }} style={s.featuredImage} imageStyle={s.featuredImageCorners}>
                  <View style={s.featuredOverlay}>
                    <View style={s.featuredTopRow}>
                      <Text style={s.featuredBadge}>FEATURED</Text>
                      <Pressable style={s.saveButton} onPress={(event) => { event.stopPropagation(); void toggle(featuredAdventure); }}>
                        <Text style={s.saveIcon}>{featuredAdventure.is_saved ? '★' : '☆'}</Text>
                      </Pressable>
                    </View>
                    <View>
                      <Text style={s.featuredTitle}>{featuredAdventure.title}</Text>
                      <Text style={s.featuredMeta}>{featuredDistance != null ? `${featuredDistance.toFixed(1)} mi away · ` : ''}{featuredAdventure.city}, {featuredAdventure.state}</Text>
                      <Text style={s.featuredMeta}>{featuredAdventure.category} · {new Date(featuredAdventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    </View>
                  </View>
                </ImageBackground>
              ) : (
                <View style={[s.featuredImage, s.featuredFallback]}>
                  <View style={s.featuredTopRow}>
                    <Text style={s.featuredBadge}>FEATURED</Text>
                    <Pressable style={s.saveButton} onPress={(event) => { event.stopPropagation(); void toggle(featuredAdventure); }}><Text style={s.saveIcon}>{featuredAdventure.is_saved ? '★' : '☆'}</Text></Pressable>
                  </View>
                  <View>
                    <Text style={s.featuredTitle}>{featuredAdventure.title}</Text>
                    <Text style={s.featuredMeta}>{featuredAdventure.city}, {featuredAdventure.state}</Text>
                    <Text style={s.featuredMeta}>{featuredAdventure.category} · {new Date(featuredAdventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  </View>
                </View>
              )}
              <View style={s.featuredFooter}>
                <Text style={s.fromPrice}>From <Text style={s.price}>${Math.round(featuredAdventure.starting_price_cents / 100)}</Text></Text>
                <Text style={s.trusted}>✓ Trusted Host</Text>
              </View>
            </Pressable>
          ) : null}

          {mode === 'adventures' && nearbyEvent ? (
            <View>
              <View style={s.sectionHeadingRow}>
                <Text style={s.sectionTitle}>Happening near you</Text>
                <Pressable onPress={() => setMode('local')}><Text style={s.sectionLink}>View all ›</Text></Pressable>
              </View>
              <Pressable style={s.nearbyCard} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: nearbyEvent.event.id } })}>
                <View style={s.nearbyAccent}><Text style={s.nearbyAccentIcon}>↗</Text></View>
                <View style={s.nearbyCopy}>
                  <Text style={s.nearbyEyebrow}>THIS WEEK</Text>
                  <Text style={s.nearbyTitle} numberOfLines={1}>{nearbyEvent.event.title}</Text>
                  <Text style={s.nearbyMeta}>{nearbyEvent.distance != null ? `${nearbyEvent.distance.toFixed(1)} mi away · ` : ''}{nearbyEvent.event.city}, {nearbyEvent.event.state}</Text>
                  <Text style={s.nearbyMeta}>{new Date(nearbyEvent.event.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                </View>
                <Text style={s.nearbyArrow}>›</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={s.controlRow}>
            <Pressable style={s.controlButton} onPress={() => { setShowFilters((value) => !value); setShowSort(false); }}>
              <Text style={s.controlText}>☷  Filters{selectedTags.length ? ` · ${selectedTags.length}` : ''}</Text>
            </Pressable>
            <Pressable style={s.controlButton} onPress={() => { setShowSort((value) => !value); setShowFilters(false); }}>
              <Text style={s.controlText}>◷  {sortOptions.find((item) => item.value === sort)?.label}⌄</Text>
            </Pressable>
            <Pressable style={s.controlButtonSmall} onPress={() => Alert.alert('Map view', 'Map discovery is next in the Explore rollout.')}>
              <Text style={s.controlText}>⌖ Map</Text>
            </Pressable>
          </View>

          {showSort ? (
            <View style={s.panel}>{sortOptions.map((option) => (
              <Pressable key={option.value} onPress={() => { setSort(option.value); setShowSort(false); }} style={[s.option, sort === option.value && s.optionActive]}>
                <Text style={[s.optionText, sort === option.value && s.optionTextActive]}>{option.label}</Text>
              </Pressable>
            ))}</View>
          ) : null}

          {showFilters ? (
            <View style={s.panel}>
              <Text style={s.filterLabel}>QUICK FILTERS</Text>
              <View style={s.chips}>{quickTags.map((tag) => (
                <Pressable key={tag} onPress={() => toggleTag(tag)} style={[s.chip, selectedTags.includes(tag) && s.chipActive]}>
                  <Text style={[s.chipText, selectedTags.includes(tag) && s.chipTextActive]}>{tag}</Text>
                </Pressable>
              ))}</View>
              <Text style={s.filterLabel}>RADIUS{mode === 'local' ? ' · MAX 50 MI' : ''}</Text>
              <View style={s.chips}>{radii.map((r) => (
                <Pressable key={r} onPress={() => setRadius(r)} style={[s.chip, radius === r && s.chipActive]}>
                  <Text style={[s.chipText, radius === r && s.chipTextActive]}>{r === 'Anywhere' ? r : `${r} mi`}</Text>
                </Pressable>
              ))}</View>
              {mode !== 'local' ? (
                <>
                  <Text style={s.filterLabel}>ADVENTURE TYPE</Text>
                  <View style={s.chips}>{categories.map((c) => (
                    <Pressable key={c} onPress={() => setCategory(c)} style={[s.chip, category === c && s.chipActive]}>
                      <Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text>
                    </Pressable>
                  ))}</View>
                </>
              ) : null}
            </View>
          ) : null}

          {mode === 'local' ? (
            <View style={s.note}>
              <Text style={s.cardTitle}>Member-hosted, truly local.</Text>
              <Text style={s.body}>Local Events are capped at 50 miles from your current or searched location.</Text>
              {canCreate ? <Pressable onPress={() => router.push('/local-events/create')}><Text style={s.gold}>Create Local Event →</Text></Pressable> : null}
            </View>
          ) : null}

          <Pressable style={s.trailGuideCompact} onPress={() => router.push('/trail-guide' as never)}>
            <View>
              <Text style={s.trailGuideEyebrow}>TRAIL GUIDE</Text>
              <Text style={s.trailGuideTitle}>Weather, gear & safety</Text>
            </View>
            <Text style={s.trailGuideArrow}>→</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#F5C542" /> : null}
      {!loading && rows.length > 0 ? <Text style={s.listHeading}>{mode === 'adventures' || mode === 'saved' ? 'More to explore' : mode === 'local' ? 'Local events' : 'Your plans'}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <FlatList
        data={rows}
        keyExtractor={(x: any) => x.id ?? x.event?.id ?? x.trip?.id}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#F5C542" />}
        ListHeaderComponent={header}
        renderItem={({ item }) => mode === 'local'
          ? <LocalCard event={item.event as LocalEvent} distance={item.distance} />
          : mode === 'reservations'
            ? item.kind === 'local'
              ? <LocalReservationCard event={item.event as LocalEvent} />
              : <TripCard trip={item.trip as MemberTrip} />
            : <AdventureCard adventure={item as AdventureSummary} onToggleSaved={toggle} />}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={!loading ? <View style={s.empty}><Text style={s.emptyTitle}>Nothing here yet</Text><Text style={s.body}>Try widening your radius or clearing a filter.</Text></View> : null}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1110' },
  content: { padding: 18, paddingBottom: 44 },
  header: { gap: 14, marginBottom: 18 },
  eyebrow: { color: '#F5C542', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  title: { color: '#F7F7F4', fontSize: 42, lineHeight: 46, fontWeight: '900' },
  location: { color: '#D8DED9', fontWeight: '700', fontSize: 15 },
  gold: { color: '#F5C542', fontWeight: '900', marginTop: 7 },
  tabs: { flexDirection: 'row', backgroundColor: '#111A17', borderRadius: 13, padding: 4, gap: 3 },
  tab: { flex: 1, paddingVertical: 9, paddingHorizontal: 2, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#F5C542' },
  tabText: { color: '#8D9992', fontSize: 10, fontWeight: '800' },
  tabTextActive: { color: '#111A17' },
  input: { backgroundColor: '#171E1C', borderWidth: 1, borderColor: '#343D39', borderRadius: 18, color: '#F7F7F4', paddingHorizontal: 16, paddingVertical: 15, fontSize: 15 },
  categoryRow: { gap: 8, paddingRight: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#315248', backgroundColor: '#10241F', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
  categoryChipActive: { backgroundColor: '#F5C542', borderColor: '#F5C542' },
  categoryIcon: { color: '#E1E7E3', fontSize: 16, fontWeight: '900' },
  categoryText: { color: '#E1E7E3', fontSize: 13, fontWeight: '800' },
  categoryTextActive: { color: '#111A17' },
  todayCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12332D', borderWidth: 1, borderColor: '#34685E', borderRadius: 20, padding: 16 },
  todayIconWrap: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#193D35', marginRight: 12 },
  todayIcon: { color: '#F5C542', fontSize: 31 },
  todayCopy: { flex: 1 },
  todayEyebrow: { color: '#F5C542', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  todayTitle: { color: '#F7F7F4', fontSize: 17, fontWeight: '900', marginTop: 3 },
  todayBody: { color: '#B5C1BB', fontSize: 12, lineHeight: 17, marginTop: 3 },
  featuredCard: { overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#3E4944', backgroundColor: '#111A17' },
  featuredImage: { minHeight: 300, justifyContent: 'space-between' },
  featuredImageCorners: { borderTopLeftRadius: 21, borderTopRightRadius: 21 },
  featuredOverlay: { flex: 1, justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' },
  featuredFallback: { padding: 16, backgroundColor: '#183128' },
  featuredTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredBadge: { color: '#111A17', backgroundColor: '#F5C542', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, fontWeight: '900', fontSize: 10, letterSpacing: .8 },
  saveButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#C6CECA', backgroundColor: 'rgba(8,13,12,.68)', alignItems: 'center', justifyContent: 'center' },
  saveIcon: { color: '#FFFFFF', fontSize: 22 },
  featuredTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 33, fontWeight: '900' },
  featuredMeta: { color: '#E2E7E4', fontSize: 13, fontWeight: '700', marginTop: 5 },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#101714' },
  fromPrice: { color: '#E5EAE7', fontSize: 15 },
  price: { color: '#F5C542', fontSize: 26, fontWeight: '900' },
  trusted: { color: '#75D2C0', backgroundColor: '#153128', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, fontSize: 11, fontWeight: '900' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: '#F7F7F4', fontSize: 21, fontWeight: '900' },
  sectionLink: { color: '#F5C542', fontSize: 13, fontWeight: '900' },
  nearbyCard: { flexDirection: 'row', alignItems: 'center', minHeight: 108, overflow: 'hidden', borderRadius: 18, backgroundColor: '#13231E', borderWidth: 1, borderColor: '#31443C' },
  nearbyAccent: { width: 78, alignSelf: 'stretch', backgroundColor: '#1A453A', alignItems: 'center', justifyContent: 'center' },
  nearbyAccentIcon: { color: '#F5C542', fontSize: 30, fontWeight: '900' },
  nearbyCopy: { flex: 1, paddingHorizontal: 13, paddingVertical: 12 },
  nearbyEyebrow: { color: '#F5C542', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  nearbyTitle: { color: '#F7F7F4', fontSize: 17, fontWeight: '900', marginTop: 4 },
  nearbyMeta: { color: '#AEBAB4', fontSize: 11, marginTop: 4 },
  nearbyArrow: { color: '#F5C542', fontSize: 30, marginRight: 13 },
  controlRow: { flexDirection: 'row', gap: 8 },
  controlButton: { flex: 1, backgroundColor: '#17231F', borderWidth: 1, borderColor: '#405047', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  controlButtonSmall: { minWidth: 76, backgroundColor: '#17231F', borderWidth: 1, borderColor: '#405047', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  controlText: { color: '#E4E9E6', fontWeight: '900', fontSize: 11 },
  panel: { backgroundColor: '#121B18', borderWidth: 1, borderColor: '#29372F', borderRadius: 16, padding: 13, gap: 10 },
  filterLabel: { color: '#849188', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: '#46554C', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#F5C542', borderColor: '#F5C542' },
  chipText: { color: '#D2D8D4', fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#17211C' },
  option: { borderWidth: 1, borderColor: '#34433A', borderRadius: 10, padding: 10 },
  optionActive: { borderColor: '#F5C542', backgroundColor: '#253129' },
  optionText: { color: '#C7D0CA', fontWeight: '700' },
  optionTextActive: { color: '#FFF3CE' },
  note: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#29372F', borderRadius: 16, padding: 15 },
  trailGuideCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 15, borderWidth: 1, borderColor: '#315248', backgroundColor: '#10241F', padding: 13 },
  trailGuideEyebrow: { color: '#67CFC8', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  trailGuideTitle: { color: '#F7F7F4', fontSize: 14, fontWeight: '900', marginTop: 2 },
  trailGuideArrow: { color: '#F5C542', fontSize: 23, fontWeight: '900' },
  listHeading: { color: '#F7F7F4', fontSize: 20, fontWeight: '900', marginTop: 3 },
  card: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#29372F', padding: 16 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: '#F5C542', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  distance: { color: '#AAB5AE', fontSize: 11, fontWeight: '800' },
  cardTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 4 },
  meta: { color: '#AEB8B2', marginTop: 5 },
  body: { color: '#AEB8B2', lineHeight: 20, marginTop: 5 },
  miniTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  miniTag: { color: '#DCE4DF', backgroundColor: '#26352D', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, fontSize: 10, fontWeight: '800' },
  error: { color: '#FFB4A9' },
  empty: { backgroundColor: '#121B18', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#28332E' },
  emptyTitle: { color: '#F7F7F4', fontWeight: '900', fontSize: 18 },
});