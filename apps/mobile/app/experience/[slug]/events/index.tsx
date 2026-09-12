import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../../../src/auth/AuthProvider';
import { supabase } from '../../../../src/lib/supabase';
import { experienceLabel } from '../../../../src/platform/experience';
import { useTenantExperience } from '../../../../src/platform/TenantExperienceProvider';
import { AppIcon } from '../../../../src/ui/AppIcon';

type EventRow = {
  id: string;
  title: string;
  summary: string;
  category: string;
  starts_at: string;
  ends_at: string;
  city: string;
  state: string;
  venue_name: string | null;
  hero_image_url: string | null;
  starting_price_cents: number;
  is_featured: boolean;
  isSaved: boolean;
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function priceLabel(cents: number) {
  if (!cents) return 'Free';
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function TenantEventsScreen() {
  const { session } = useAuth();
  const { context, moduleEnabled } = useTenantExperience();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!context || !moduleEnabled('events')) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: rows, error: eventError } = await supabase
        .from('adventures')
        .select('id,title,summary,category,starts_at,ends_at,city,state,venue_name,hero_image_url,starting_price_cents,is_featured')
        .eq('public_experience_id', context.experience.id)
        .in('status', ['published', 'sold_out'])
        .gte('ends_at', new Date().toISOString())
        .order('is_featured', { ascending: false })
        .order('starts_at', { ascending: true });
      if (eventError) throw eventError;

      const base = (rows ?? []) as Omit<EventRow, 'isSaved'>[];
      const eventIds = base.map((item) => item.id);
      let saved = new Set<string>();
      if (session?.user.id && moduleEnabled('saved') && eventIds.length) {
        const { data: savedRows, error: savedError } = await supabase
          .from('organization_saved_adventures')
          .select('adventure_id')
          .eq('organization_id', context.organization.id)
          .eq('profile_id', session.user.id)
          .in('adventure_id', eventIds);
        if (savedError) throw savedError;
        saved = new Set((savedRows ?? []).map((row) => row.adventure_id as string));
      }
      setEvents(base.map((item) => ({ ...item, isSaved: saved.has(item.id) })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load events.');
    } finally {
      setLoading(false);
    }
  }, [context, moduleEnabled, session?.user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) => `${event.title} ${event.summary} ${event.category} ${event.city} ${event.state} ${event.venue_name ?? ''}`.toLowerCase().includes(query));
  }, [events, search]);

  if (!context) return null;

  const { experience, organization } = context;
  const brandName = textValue(experience.branding.brand_name, experience.name);
  const accent = textValue(experience.branding.accent, '#D7B45A');
  const surface = textValue(experience.branding.surface, '#17211C');
  const text = textValue(experience.branding.text, '#FFF8E8');
  const eventsLabel = experienceLabel(experience, 'events', 'Events');
  const base = `/experience/${experience.publicSlug}`;

  async function toggleSaved(event: EventRow) {
    if (!session?.user.id || !moduleEnabled('saved') || savingId) return;
    setSavingId(event.id);
    setError('');
    try {
      if (event.isSaved) {
        const { error: removeError } = await supabase
          .from('organization_saved_adventures')
          .delete()
          .eq('organization_id', organization.id)
          .eq('profile_id', session.user.id)
          .eq('adventure_id', event.id);
        if (removeError) throw removeError;
      } else {
        const { error: saveError } = await supabase
          .from('organization_saved_adventures')
          .insert({ organization_id: organization.id, profile_id: session.user.id, adventure_id: event.id });
        if (saveError) throw saveError;
      }
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, isSaved: !event.isSaved } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update saved event.');
    } finally {
      setSavingId(null);
    }
  }

  if (!moduleEnabled('events')) {
    return <View style={styles.center}><Text style={[styles.title, { color: text }]}>Events are not enabled for this app.</Text></View>;
  }

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={[styles.eyebrow, { color: accent }]}>{brandName.toUpperCase()}</Text>
    <Text style={[styles.title, { color: text }]}>{eventsLabel}</Text>
    <Text style={styles.subtitle}>Everything here belongs to {brandName}.</Text>

    <View style={[styles.search, { backgroundColor: surface }]}><AppIcon name="search" color={accent} size={18} /><TextInput value={search} onChangeText={setSearch} placeholder={`Search ${eventsLabel.toLowerCase()}…`} placeholderTextColor="#6E7A72" style={[styles.searchInput, { color: text }]} /></View>

    {loading ? <ActivityIndicator color={accent} style={{ marginVertical: 30 }} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !visible.length ? <View style={[styles.empty, { backgroundColor: surface }]}><Text style={[styles.emptyTitle, { color: text }]}>No {eventsLabel.toLowerCase()} found.</Text></View> : null}

    <View style={styles.list}>{visible.map((event) => <Pressable key={event.id} style={[styles.card, { backgroundColor: surface }]} onPress={() => router.push(`${base}/events/${event.id}` as never)}>
      {event.hero_image_url ? <Image source={{ uri: event.hero_image_url }} style={styles.image} /> : <View style={[styles.image, styles.imageFallback]}><AppIcon name="calendar" color={accent} size={28} /></View>}
      <View style={styles.copy}>
        <Text style={[styles.category, { color: accent }]}>{event.category}</Text>
        <Text style={[styles.eventTitle, { color: text }]}>{event.title}</Text>
        <Text style={styles.meta}>{new Date(event.starts_at).toLocaleDateString()} · {event.city}, {event.state}</Text>
        <Text style={[styles.price, { color: text }]}>{priceLabel(event.starting_price_cents)}</Text>
      </View>
      {moduleEnabled('saved') ? <Pressable disabled={savingId === event.id} style={[styles.save, event.isSaved && { backgroundColor: accent, borderColor: accent }]} onPress={(pressEvent) => { pressEvent.stopPropagation(); void toggleSaved(event); }}>
        {savingId === event.id ? <ActivityIndicator size="small" color={event.isSaved ? '#101510' : text} /> : <AppIcon name="bookmark" color={event.isSaved ? '#101510' : text} size={17} />}
      </Pressable> : null}
    </Pressable>)}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 28, maxWidth: 900, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 29, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#8F9D94', fontSize: 11, marginTop: 5 },
  search: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginTop: 18 },
  searchInput: { flex: 1, fontSize: 13 },
  list: { gap: 10, marginTop: 14 },
  card: { borderRadius: 17, overflow: 'hidden', minHeight: 108, flexDirection: 'row', alignItems: 'center' },
  image: { width: 118, height: 108 },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#101713' },
  copy: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  category: { fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  eventTitle: { fontSize: 14, fontWeight: '900', marginTop: 3 },
  meta: { color: '#859189', fontSize: 9.5, marginTop: 5 },
  price: { fontSize: 11, fontWeight: '900', marginTop: 7 },
  save: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#46534B', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  error: { color: '#F0A199', fontSize: 10.5, marginTop: 10 },
  empty: { borderRadius: 16, padding: 18, marginTop: 16 },
  emptyTitle: { fontSize: 12.5, fontWeight: '900' },
});
