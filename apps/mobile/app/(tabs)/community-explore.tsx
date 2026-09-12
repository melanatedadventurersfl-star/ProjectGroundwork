import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { setAdventureSaved } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { supabase } from '../../src/lib/supabase';
import { experienceLabel, type ActiveExperienceContext } from '../../src/platform/experience';
import { AppIcon } from '../../src/ui/AppIcon';

type CommunityExploreProps = {
  context: ActiveExperienceContext;
};

type EventRow = AdventureSummary & {
  public_experience_id?: string | null;
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function priceLabel(cents: number) {
  if (!cents) return 'Free';
  const dollars = cents / 100;
  return `From ${dollars.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: dollars % 1 ? 2 : 0,
  })}`;
}

export default function CommunityExplore({ context }: CommunityExploreProps) {
  const { experience } = context;
  const [events, setEvents] = useState<EventRow[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const brandName = textValue(experience.branding.brand_name, experience.name);
  const eventsLabel = experienceLabel(experience, 'events', 'Events');
  const accent = textValue(experience.branding.accent, '#D7B45A');
  const primary = textValue(experience.branding.primary, '#0F1713');
  const surface = textValue(experience.branding.surface, '#17211C');
  const text = textValue(experience.branding.text, '#FFF8E8');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [{ data: rows, error: eventError }, { data: sessionData }] = await Promise.all([
        supabase
          .from('adventures')
          .select('id,slug,title,summary,category,difficulty,status,starts_at,ends_at,address,city,state,latitude,longitude,timezone,venue_name,hero_image_url,capacity,spots_remaining,starting_price_cents,is_featured,access_level,go_plus_early_access_at,public_registration_at,created_by,public_experience_id')
          .eq('public_experience_id', experience.id)
          .in('status', ['published', 'sold_out'])
          .gte('ends_at', new Date().toISOString())
          .order('is_featured', { ascending: false })
          .order('starts_at', { ascending: true }),
        supabase.auth.getSession(),
      ]);

      if (eventError) throw eventError;
      const baseRows = (rows ?? []) as EventRow[];
      const profileId = sessionData.session?.user.id;

      if (!profileId || !baseRows.length) {
        setEvents(baseRows.map((event) => ({ ...event, is_saved: false })));
      } else {
        const { data: savedRows, error: savedError } = await supabase
          .from('saved_adventures')
          .select('adventure_id')
          .eq('profile_id', profileId)
          .in('adventure_id', baseRows.map((event) => event.id));
        if (savedError) throw savedError;
        const savedIds = new Set((savedRows ?? []).map((row) => row.adventure_id as string));
        setEvents(baseRows.map((event) => ({ ...event, is_saved: savedIds.has(event.id) })));
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to load ${eventsLabel.toLowerCase()}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventsLabel, experience.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const values = [...new Set(events.map((event) => event.category?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return ['All', ...values];
  }, [events]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory('All');
  }, [categories, category]);

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      if (category !== 'All' && event.category !== category) return false;
      if (!query) return true;
      const searchable = `${event.title} ${event.summary} ${event.category} ${event.city} ${event.state} ${event.venue_name ?? ''}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [category, events, search]);

  const featured = useMemo(
    () => visibleEvents.find((event) => event.is_featured) ?? visibleEvents[0] ?? null,
    [visibleEvents],
  );

  const remaining = useMemo(
    () => visibleEvents.filter((event) => event.id !== featured?.id),
    [featured?.id, visibleEvents],
  );

  async function toggleSaved(event: EventRow) {
    if (savingId) return;
    setSavingId(event.id);
    const nextSaved = !event.is_saved;
    setEvents((current) => current.map((item) => item.id === event.id ? { ...item, is_saved: nextSaved } : item));
    try {
      await setAdventureSaved(event.id, nextSaved);
    } catch (caught) {
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, is_saved: event.is_saved } : item));
      setError(caught instanceof Error ? caught.message : 'Unable to update saved event.');
    } finally {
      setSavingId(null);
    }
  }

  return <ScrollView
    style={[styles.screen, { backgroundColor: primary }]}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} tintColor={accent} onRefresh={() => void load(true)} />}
  >
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text style={[styles.eyebrow, { color: accent }]}>{brandName.toUpperCase()}</Text>
        <Text style={[styles.title, { color: text }]}>{eventsLabel}</Text>
        <Text style={styles.subtitle}>Discover what {brandName} has published.</Text>
      </View>
      <View style={[styles.brandMark, { borderColor: `${accent}88`, backgroundColor: surface }]}>
        <Text style={[styles.brandMarkText, { color: accent }]}>{brandName.slice(0, 1).toUpperCase()}</Text>
      </View>
    </View>

    <View style={[styles.searchBox, { backgroundColor: surface }]}>
      <AppIcon name="search" color={accent} size={19} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${eventsLabel.toLowerCase()}, locations, categories…`}
        placeholderTextColor="#78847D"
        style={[styles.searchInput, { color: text }]}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><AppIcon name="close" color="#98A69E" size={18} /></Pressable> : null}
    </View>

    {categories.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
      {categories.map((item) => {
        const active = item === category;
        return <Pressable
          key={item}
          onPress={() => setCategory(item)}
          style={[styles.categoryChip, { backgroundColor: active ? accent : surface, borderColor: active ? accent : '#35423A' }]}
        >
          <Text style={[styles.categoryText, { color: active ? '#101612' : text }]}>{item}</Text>
        </Pressable>;
      })}
    </ScrollView> : null}

    {loading ? <View style={styles.loading}><ActivityIndicator color={accent} size="large" /><Text style={styles.loadingText}>Loading {eventsLabel.toLowerCase()}…</Text></View> : null}
    {error ? <View style={styles.errorCard}><AppIcon name="alert-circle" color="#FFB4A9" size={19} /><Text style={styles.errorText}>{error}</Text></View> : null}

    {!loading && featured ? <Pressable
      style={[styles.featuredCard, { backgroundColor: surface }]}
      onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: featured.id } })}
    >
      {featured.hero_image_url ? <Image source={{ uri: featured.hero_image_url }} style={styles.featuredImage} /> : <View style={[styles.featuredImage, styles.imageFallback]}><AppIcon name="calendar" color={accent} size={34} /></View>}
      <View style={styles.featuredBody}>
        <View style={styles.featuredTop}>
          <Text style={[styles.featuredLabel, { color: accent }]}>{featured.is_featured ? 'FEATURED' : 'UP NEXT'}</Text>
          <Pressable
            disabled={savingId === featured.id}
            accessibilityLabel={featured.is_saved ? 'Unsave event' : 'Save event'}
            style={[styles.saveButton, featured.is_saved && { backgroundColor: accent }]}
            onPress={(pressEvent) => { pressEvent.stopPropagation(); void toggleSaved(featured); }}
          >
            {savingId === featured.id ? <ActivityIndicator color={featured.is_saved ? '#111713' : text} size="small" /> : <AppIcon name="bookmark" color={featured.is_saved ? '#111713' : text} size={17} />}
          </Pressable>
        </View>
        <Text style={[styles.featuredTitle, { color: text }]}>{featured.title}</Text>
        <Text style={styles.featuredMeta}>{dateLabel(featured.starts_at)} · {featured.city}, {featured.state}</Text>
        {featured.summary ? <Text style={styles.featuredSummary} numberOfLines={3}>{featured.summary}</Text> : null}
        <View style={styles.featuredFooter}>
          <Text style={[styles.price, { color: text }]}>{priceLabel(featured.starting_price_cents)}</Text>
          <Text style={[styles.openText, { color: accent }]}>View {eventsLabel.replace(/s$/i, '') || 'event'} →</Text>
        </View>
      </View>
    </Pressable> : null}

    {!loading && remaining.length ? <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: text }]}>Upcoming {eventsLabel}</Text>
        <Text style={styles.count}>{visibleEvents.length}</Text>
      </View>
      <View style={styles.eventList}>
        {remaining.map((event) => <Pressable
          key={event.id}
          style={[styles.eventCard, { backgroundColor: surface }]}
          onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: event.id } })}
        >
          {event.hero_image_url ? <Image source={{ uri: event.hero_image_url }} style={styles.eventImage} /> : <View style={[styles.eventImage, styles.imageFallback]}><AppIcon name="calendar" color={accent} size={24} /></View>}
          <View style={styles.eventCopy}>
            <Text style={[styles.eventCategory, { color: accent }]} numberOfLines={1}>{event.category}</Text>
            <Text style={[styles.eventTitle, { color: text }]} numberOfLines={2}>{event.title}</Text>
            <Text style={styles.eventMeta}>{dateLabel(event.starts_at)}</Text>
            <Text style={styles.eventMeta} numberOfLines={1}>{event.venue_name ? `${event.venue_name} · ` : ''}{event.city}, {event.state}</Text>
            <Text style={[styles.eventPrice, { color: text }]}>{priceLabel(event.starting_price_cents)}</Text>
          </View>
          <Pressable
            disabled={savingId === event.id}
            accessibilityLabel={event.is_saved ? 'Unsave event' : 'Save event'}
            style={[styles.smallSave, event.is_saved && { backgroundColor: accent, borderColor: accent }]}
            onPress={(pressEvent) => { pressEvent.stopPropagation(); void toggleSaved(event); }}
          >
            {savingId === event.id ? <ActivityIndicator color={event.is_saved ? '#111713' : text} size="small" /> : <AppIcon name="bookmark" color={event.is_saved ? '#111713' : text} size={16} />}
          </Pressable>
        </Pressable>)}
      </View>
    </View> : null}

    {!loading && !visibleEvents.length ? <View style={[styles.emptyCard, { backgroundColor: surface }]}>
      <View style={[styles.emptyIcon, { backgroundColor: `${accent}22` }]}><AppIcon name="calendar" color={accent} size={27} /></View>
      <Text style={[styles.emptyTitle, { color: text }]}>{events.length ? `No ${eventsLabel.toLowerCase()} match that search.` : `No ${eventsLabel.toLowerCase()} published yet.`}</Text>
      <Text style={styles.emptyText}>{events.length ? 'Try another category or search term.' : `When ${brandName} publishes an event, it will appear here automatically.`}</Text>
      {(search || category !== 'All') ? <Pressable style={[styles.resetButton, { borderColor: `${accent}88` }]} onPress={() => { setSearch(''); setCategory('All'); }}><Text style={[styles.resetText, { color: accent }]}>Clear filters</Text></Pressable> : null}
    </View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 56, gap: 16, maxWidth: 900, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 14 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  title: { fontSize: 31, lineHeight: 35, fontWeight: '900' },
  subtitle: { color: '#98A69E', fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  brandMark: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontSize: 20, fontWeight: '900' },
  searchBox: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#35423A', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, minHeight: 48, fontSize: 12.5, fontWeight: '600' },
  categoryRow: { gap: 8, paddingRight: 18 },
  categoryChip: { minHeight: 38, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  categoryText: { fontSize: 10.5, fontWeight: '900' },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#98A69E', fontSize: 11 },
  errorCard: { borderRadius: 14, padding: 12, backgroundColor: '#271B1A', borderWidth: 1, borderColor: '#6A3A37', flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { color: '#FFB4A9', fontSize: 11, lineHeight: 16, flex: 1 },
  featuredCard: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)' },
  featuredImage: { width: '100%', height: 210, resizeMode: 'cover' },
  imageFallback: { backgroundColor: '#1D2922', alignItems: 'center', justifyContent: 'center' },
  featuredBody: { padding: 16, gap: 6 },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  featuredLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  saveButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#526158', backgroundColor: 'rgba(12,18,15,0.70)', alignItems: 'center', justifyContent: 'center' },
  featuredTitle: { fontSize: 24, lineHeight: 28, fontWeight: '900' },
  featuredMeta: { color: '#B3BDB7', fontSize: 11.5, fontWeight: '700' },
  featuredSummary: { color: '#98A69E', fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  featuredFooter: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  price: { fontSize: 12, fontWeight: '900' },
  openText: { fontSize: 11, fontWeight: '900' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 20, fontWeight: '900' },
  count: { color: '#89968E', fontSize: 10.5, fontWeight: '800' },
  eventList: { gap: 9 },
  eventCard: { minHeight: 122, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  eventImage: { width: 102, height: 102, borderRadius: 13, resizeMode: 'cover' },
  eventCopy: { flex: 1, minWidth: 0 },
  eventCategory: { fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  eventTitle: { fontSize: 15, lineHeight: 19, fontWeight: '900', marginTop: 2 },
  eventMeta: { color: '#98A69E', fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  eventPrice: { fontSize: 10.5, fontWeight: '900', marginTop: 5 },
  smallSave: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: '#48554D', alignItems: 'center', justifyContent: 'center' },
  emptyCard: { minHeight: 230, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 22, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, lineHeight: 21, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: '#98A69E', fontSize: 11.5, lineHeight: 17, textAlign: 'center', maxWidth: 430, marginTop: 6 },
  resetButton: { minHeight: 40, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  resetText: { fontSize: 10.5, fontWeight: '900' },
});
