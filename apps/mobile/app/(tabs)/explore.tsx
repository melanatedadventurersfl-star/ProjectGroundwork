import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
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
type ReservationRow = { kind: 'trip'; id: string; trip: MemberTrip } | { kind: 'local'; id: string; event: LocalEvent };

const categories = ['All', 'Camping', 'Hiking', 'Water', 'Travel', 'Culture'];
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

function isWeekend(date: string) { const day = new Date(date).getDay(); return day === 0 || day === 6; }
function matchesQuickTags(item: { title: string; description?: string | null; category?: string | null; starts_at: string }, tags: string[]) {
  if (!tags.length) return true;
  const inferred = textTags(item);
  return tags.every((tag) => tag === 'Upcoming' ? new Date(item.starts_at).getTime() >= Date.now() : tag === 'Weekend' ? isWeekend(item.starts_at) : inferred.includes(tag));
}

function LocalCard({ event, distance }: { event: LocalEvent; distance?: number | null }) {
  const tags = textTags(event);
  return <Pressable style={s.card} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}><View style={s.cardTopRow}><Text style={s.badge}>LOCAL EVENT</Text>{distance != null ? <Text style={s.distance}>{Math.round(distance)} mi</Text> : null}</View><Text style={s.cardTitle}>{event.title}</Text><Text style={s.meta}>{new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {event.city}, {event.state}</Text>{tags.length ? <View style={s.miniTags}>{tags.slice(0, 3).map((tag) => <Text key={tag} style={s.miniTag}>{tag}</Text>)}</View> : null}<Text style={s.gold}>Hosted by {event.host_name}</Text><Text style={s.body} numberOfLines={2}>{event.description}</Text><Text style={s.gold}>View Local Event →</Text></Pressable>;
}
function TripCard({ trip }: { trip: MemberTrip }) { const a = trip.adventures; return <Pressable style={s.card} onPress={() => router.push('/member/trips')}><Text style={s.badge}>{trip.status === 'held' || trip.status === 'payment_pending' ? 'RESERVATION HELD' : 'RESERVATION'}</Text><Text style={s.cardTitle}>{a?.title ?? 'Adventure reservation'}</Text><Text style={s.meta}>{a ? `${new Date(a.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${a.city}, ${a.state}` : 'Trip details'}</Text><Text style={s.body}>{trip.status.replaceAll('_', ' ')}</Text><Text style={s.gold}>Manage Reservation →</Text></Pressable>; }
function LocalReservationCard({ event }: { event: LocalEvent }) { return <Pressable style={s.card} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}><Text style={s.badge}>FREE EVENT · GOING</Text><Text style={s.cardTitle}>{event.title}</Text><Text style={s.meta}>{new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {event.city}, {event.state}</Text><Text style={s.body}>Your RSVP is confirmed. No payment required.</Text><Text style={s.gold}>View Event →</Text></Pressable>; }

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => ({ search: search || undefined, category: category === 'All' ? undefined : category, savedOnly: session && mode === 'saved' ? true : undefined }), [search, category, mode, session]);

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
      setAdventures(a); setEvents(e); setTrips(t); setCanCreate(h.canCreate); setHomeCity(profile.data?.home_city ?? ''); setHomeState(profile.data?.home_state ?? ''); setError(null);
    } catch (x) { setError(x instanceof Error ? x.message : 'Unable to load Explore.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filters, session?.user.id]);

  useEffect(() => { const timer = setTimeout(() => void load(), 200); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (mode === 'local' && (radius === '100' || radius === '250' || radius === 'Anywhere')) setRadius('50'); }, [mode, radius]);

  function chooseMode(next: Mode) {
    if (!session && (next === 'saved' || next === 'reservations')) { promptForAccount(next === 'saved' ? 'Saved adventures' : 'Reservations'); return; }
    setMode(next);
  }

  async function toggle(a: AdventureSummary) {
    if (!session) { promptForAccount('Saving adventures'); return; }
    const next = !a.is_saved;
    setAdventures((current) => current.map((x) => x.id === a.id ? { ...x, is_saved: next } : x));
    try { await setAdventureSaved(a.id, next); } catch { void load(); }
  }

  const searchCenter = useMemo(() => resolveSearchCenter(search, homeCity, homeState), [search, homeCity, homeState]);
  const radiusLimit = radius === 'Anywhere' ? Number.POSITIVE_INFINITY : Number(radius);
  const localWithDistance = useMemo(() => events.map((event) => { const point = pointForCity(event.city, event.state); return { event, distance: searchCenter && point ? distanceMiles(searchCenter, point) : null }; }).filter(({ event, distance }) => { const q = search.trim().toLowerCase(); const searchable = `${event.title} ${event.host_name} ${event.city} ${event.state} ${event.category} ${event.description}`.toLowerCase(); const locationTerms = ['florida', 'fl', event.city.toLowerCase(), event.state.toLowerCase()]; const textMatch = !q || searchable.includes(q) || (searchCenter != null && locationTerms.some((term) => q.includes(term))); const distanceMatch = distance == null || distance <= Math.min(50, radiusLimit); return textMatch && distanceMatch && matchesQuickTags(event, selectedTags); }), [events, radiusLimit, search, searchCenter, selectedTags]);
  const sortedLocal = useMemo(() => [...localWithDistance].sort((a, b) => sort === 'closest' ? (a.distance ?? 9999) - (b.distance ?? 9999) : sort === 'newest' ? b.event.id.localeCompare(a.event.id) : new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()), [localWithDistance, sort]);
  const filteredAdventures = useMemo(() => adventures.filter((item) => matchesQuickTags(item, selectedTags)).sort((a, b) => sort === 'newest' ? b.id.localeCompare(a.id) : sort === 'price' ? 0 : new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [adventures, selectedTags, sort]);
  const reservationRows = useMemo<ReservationRow[]>(() => [...trips.map((trip) => ({ kind: 'trip' as const, id: `trip-${trip.id}`, trip })), ...events.filter((event) => event.is_free && event.my_rsvp === 'going').map((event) => ({ kind: 'local' as const, id: `local-${event.id}`, event }))], [trips, events]);
  const rows: any[] = mode === 'local' ? sortedLocal : mode === 'reservations' ? reservationRows : filteredAdventures;
  const radii = mode === 'local' ? localRadii : adventureRadii;
  function toggleTag(tag: string) { setSelectedTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]); }

  return <SafeAreaView style={s.safe}><FlatList data={rows} keyExtractor={(x: any) => x.id ?? x.event?.id ?? x.trip?.id} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />} ListHeaderComponent={<View style={s.header}><Text style={s.eyebrow}>FIND YOUR NEXT OUTSIDE</Text><Text style={s.title}>Explore</Text><View style={s.tabs}>{([['adventures', 'Adventures'], ['local', 'Local Events'], ['saved', 'Saved'], ['reservations', 'Reservations']] as [Mode, string][]).map(([v, l]) => <Pressable key={v} onPress={() => chooseMode(v)} style={[s.tab, mode === v && s.tabActive]}><Text style={[s.tabText, mode === v && s.tabTextActive]}>{l}</Text></Pressable>)}</View><Pressable style={s.trailGuideCard} onPress={() => router.push('/trail-guide' as never)}><View style={s.trailGuideCopy}><Text style={s.trailGuideEyebrow}>TRAIL GUIDE</Text><Text style={s.trailGuideTitle}>Know before you go.</Text><Text style={s.trailGuideBody}>Camping, hiking, water, gear, weather and safety tips.</Text></View><Text style={s.trailGuideArrow}>→</Text></Pressable>{mode === 'reservations' ? <View style={s.note}><Text style={s.cardTitle}>Everything you’re going to</Text><Text style={s.body}>Paid reservations and free Local Events marked Going appear together here.</Text><Pressable onPress={() => router.push('/member/trips')}><Text style={s.gold}>Open Trips & Payments →</Text></Pressable></View> : <><TextInput value={search} onChangeText={setSearch} placeholder={mode === 'local' ? 'Search event, host, city, state or type' : 'Search adventure, keyword, city, state or type'} placeholderTextColor="#728078" style={s.input} /><View style={s.controlRow}><Pressable style={s.controlButton} onPress={() => { setShowFilters((value) => !value); setShowSort(false); }}><Text style={s.controlText}>Filter{selectedTags.length ? ` · ${selectedTags.length}` : ''}</Text></Pressable><Pressable style={s.controlButton} onPress={() => { setShowSort((value) => !value); setShowFilters(false); }}><Text style={s.controlText}>Sort · {sortOptions.find((item) => item.value === sort)?.label}</Text></Pressable></View>{showSort ? <View style={s.panel}>{sortOptions.map((option) => <Pressable key={option.value} onPress={() => { setSort(option.value); setShowSort(false); }} style={[s.option, sort === option.value && s.optionActive]}><Text style={[s.optionText, sort === option.value && s.optionTextActive]}>{option.label}</Text></Pressable>)}</View> : null}{showFilters ? <View style={s.panel}><Text style={s.filterLabel}>QUICK FILTERS</Text><View style={s.chips}>{quickTags.map((tag) => <Pressable key={tag} onPress={() => toggleTag(tag)} style={[s.chip, selectedTags.includes(tag) && s.chipActive]}><Text style={[s.chipText, selectedTags.includes(tag) && s.chipTextActive]}>{tag}</Text></Pressable>)}</View><Text style={s.filterLabel}>RADIUS{mode === 'local' ? ' · MAX 50 MI' : ''}</Text><View style={s.chips}>{radii.map((r) => <Pressable key={r} onPress={() => setRadius(r)} style={[s.chip, radius === r && s.chipActive]}><Text style={[s.chipText, radius === r && s.chipTextActive]}>{r === 'Anywhere' ? r : `${r} mi`}</Text></Pressable>)}</View>{mode !== 'local' ? <><Text style={s.filterLabel}>ADVENTURE TYPE</Text><View style={s.chips}>{categories.map((c) => <Pressable key={c} onPress={() => setCategory(c)} style={[s.chip, category === c && s.chipActive]}><Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text></Pressable>)}</View></> : null}</View> : null}{mode === 'local' ? <View style={s.note}><Text style={s.cardTitle}>Member-hosted, truly local.</Text><Text style={s.body}>Local Events are capped at 50 miles from the searched or saved location.</Text>{canCreate ? <Pressable onPress={() => router.push('/local-events/create')}><Text style={s.gold}>Create Local Event →</Text></Pressable> : null}</View> : null}</>}{error ? <Text style={s.error}>{error}</Text> : null}{loading ? <ActivityIndicator color="#D7B45A" /> : null}</View>} renderItem={({ item }) => mode === 'local' ? <LocalCard event={item.event as LocalEvent} distance={item.distance} /> : mode === 'reservations' ? item.kind === 'local' ? <LocalReservationCard event={item.event as LocalEvent} /> : <TripCard trip={item.trip as MemberTrip} /> : <AdventureCard adventure={item as AdventureSummary} onToggleSaved={toggle} />} ItemSeparatorComponent={() => <View style={{ height: 14 }} />} /></SafeAreaView>;
}

const s = StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:18,paddingBottom:42},header:{gap:12,marginBottom:18},eyebrow:{color:'#D7B45A',fontWeight:'900',fontSize:11,letterSpacing:1.1},title:{color:'#FFF8E8',fontSize:36,fontWeight:'900'},gold:{color:'#D7B45A',fontWeight:'900',marginTop:7},tabs:{flexDirection:'row',backgroundColor:'#151F1A',borderRadius:14,padding:4,gap:3},tab:{flex:1,paddingVertical:10,paddingHorizontal:2,borderRadius:10,alignItems:'center'},tabActive:{backgroundColor:'#D7B45A'},tabText:{color:'#9FAAA3',fontSize:11,fontWeight:'800'},tabTextActive:{color:'#17211C'},trailGuideCard:{flexDirection:'row',alignItems:'center',borderRadius:16,borderWidth:1,borderColor:'#3C5145',backgroundColor:'#1B2A22',padding:14},trailGuideCopy:{flex:1},trailGuideEyebrow:{color:'#67CFC8',fontSize:9,fontWeight:'900',letterSpacing:1},trailGuideTitle:{color:'#FFF8E8',fontSize:17,fontWeight:'900',marginTop:2},trailGuideBody:{color:'#9FAEA6',fontSize:12,lineHeight:17,marginTop:3},trailGuideArrow:{color:'#D7B45A',fontSize:25,fontWeight:'900',marginLeft:10},input:{backgroundColor:'#17211C',borderWidth:1,borderColor:'#2A3930',borderRadius:13,color:'#FFF8E8',paddingHorizontal:13,paddingVertical:12},controlRow:{flexDirection:'row',gap:8},controlButton:{flex:1,backgroundColor:'#1A2821',borderWidth:1,borderColor:'#405047',borderRadius:12,paddingVertical:11,alignItems:'center'},controlText:{color:'#FFF3CE',fontWeight:'900',fontSize:12},panel:{backgroundColor:'#141E19',borderWidth:1,borderColor:'#29372F',borderRadius:16,padding:13,gap:10},filterLabel:{color:'#849188',fontSize:10,fontWeight:'900',letterSpacing:1,marginTop:2},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderWidth:1,borderColor:'#46554C',borderRadius:999,paddingHorizontal:10,paddingVertical:6},chipActive:{backgroundColor:'#D7B45A',borderColor:'#D7B45A'},chipText:{color:'#D2D8D4',fontWeight:'700',fontSize:12},chipTextActive:{color:'#17211C'},option:{borderWidth:1,borderColor:'#34433A',borderRadius:10,padding:10},optionActive:{borderColor:'#D7B45A',backgroundColor:'#253129'},optionText:{color:'#C7D0CA',fontWeight:'700'},optionTextActive:{color:'#FFF3CE'},note:{backgroundColor:'#17211C',borderWidth:1,borderColor:'#29372F',borderRadius:16,padding:15},card:{backgroundColor:'#17211C',borderRadius:18,borderWidth:1,borderColor:'#29372F',padding:16},cardTopRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},badge:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:.8},distance:{color:'#AAB5AE',fontSize:11,fontWeight:'800'},cardTitle:{color:'#FFF8E8',fontSize:20,fontWeight:'900',marginTop:4},meta:{color:'#AEB8B2',marginTop:5},body:{color:'#AEB8B2',lineHeight:20,marginTop:5},miniTags:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:8},miniTag:{color:'#DCE4DF',backgroundColor:'#26352D',paddingHorizontal:8,paddingVertical:4,borderRadius:999,fontSize:10,fontWeight:'800'},error:{color:'#FFB4A9'}});
