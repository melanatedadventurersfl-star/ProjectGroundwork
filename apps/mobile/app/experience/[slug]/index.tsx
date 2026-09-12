import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../../src/lib/supabase';
import { experienceLabel } from '../../../src/platform/experience';
import { useTenantExperience } from '../../../src/platform/TenantExperienceProvider';
import { AppIcon } from '../../../src/ui/AppIcon';

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  city: string;
  state: string;
  hero_image_url: string | null;
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function TenantHomeScreen() {
  const { context, moduleEnabled } = useTenantExperience();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (!context || !moduleEnabled('events')) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('adventures')
      .select('id,title,starts_at,city,state,hero_image_url')
      .eq('public_experience_id', context.experience.id)
      .in('status', ['published', 'sold_out'])
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(4);
    if (error) console.warn('[tenant-app] Unable to load upcoming events', error.message);
    setEvents((data ?? []) as EventRow[]);
    setLoading(false);
  }, [context, moduleEnabled]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  if (!context) return null;

  const { experience } = context;
  const brandName = textValue(experience.branding.brand_name, experience.name);
  const accent = textValue(experience.branding.accent, '#D7B45A');
  const surface = textValue(experience.branding.surface, '#17211C');
  const text = textValue(experience.branding.text, '#FFF8E8');
  const cover = textValue(experience.branding.cover_image_url, '');
  const homeLabel = experienceLabel(experience, 'home', 'Home');
  const eventsLabel = experienceLabel(experience, 'events', 'Events');
  const tagline = textValue(experience.publicSettings.tagline, `Welcome to ${brandName}.`);
  const base = `/experience/${experience.publicSlug}`;

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={[styles.hero, { backgroundColor: surface, borderColor: `${accent}66` }]}>
      {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : null}
      <View style={styles.heroBody}>
        <Text style={[styles.eyebrow, { color: accent }]}>{homeLabel.toUpperCase()}</Text>
        <Text style={[styles.title, { color: text }]}>{brandName}</Text>
        <Text style={styles.tagline}>{tagline}</Text>
        {moduleEnabled('events') ? <Pressable style={[styles.primaryButton, { backgroundColor: accent }]} onPress={() => router.push(`${base}/events` as never)}><AppIcon name="calendar" color="#101510" size={18} /><Text style={styles.primaryButtonText}>Browse {eventsLabel}</Text></Pressable> : null}
      </View>
    </View>

    {moduleEnabled('events') ? <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: text }]}>Upcoming {eventsLabel}</Text><Pressable onPress={() => router.push(`${base}/events` as never)}><Text style={[styles.link, { color: accent }]}>See all</Text></Pressable></View>
      {loading ? <ActivityIndicator color={accent} style={{ marginVertical: 20 }} /> : null}
      {!loading && !events.length ? <View style={[styles.empty, { backgroundColor: surface }]}><Text style={[styles.emptyTitle, { color: text }]}>Nothing scheduled yet</Text><Text style={styles.emptyText}>New {eventsLabel.toLowerCase()} will appear here when {brandName} publishes them.</Text></View> : null}
      <View style={styles.list}>{events.map((event) => <Pressable key={event.id} style={[styles.eventCard, { backgroundColor: surface }]} onPress={() => router.push(`${base}/events/${event.id}` as never)}>
        {event.hero_image_url ? <Image source={{ uri: event.hero_image_url }} style={styles.eventImage} /> : <View style={[styles.eventImage, styles.eventFallback]}><AppIcon name="calendar" color={accent} size={24} /></View>}
        <View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: text }]} numberOfLines={2}>{event.title}</Text><Text style={styles.eventMeta}>{new Date(event.starts_at).toLocaleDateString()} · {event.city}, {event.state}</Text></View>
        <AppIcon name="chevron-forward" color={accent} size={18} />
      </Pressable>)}</View>
    </View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32, gap: 22, maxWidth: 900, width: '100%', alignSelf: 'center' },
  hero: { borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  cover: { width: '100%', height: 190 },
  heroBody: { padding: 20, gap: 9 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 31, lineHeight: 36, fontWeight: '900' },
  tagline: { color: '#A9B4AD', fontSize: 13, lineHeight: 19, maxWidth: 580 },
  primaryButton: { alignSelf: 'flex-start', marginTop: 7, minHeight: 43, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryButtonText: { color: '#101510', fontSize: 12, fontWeight: '900' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '900' },
  link: { fontSize: 11, fontWeight: '900' },
  list: { gap: 9 },
  eventCard: { minHeight: 86, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 11, paddingRight: 13 },
  eventImage: { width: 94, height: 86 },
  eventFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111A15' },
  eventCopy: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '900' },
  eventMeta: { color: '#89968E', fontSize: 10, marginTop: 5 },
  empty: { borderRadius: 16, padding: 16 },
  emptyTitle: { fontSize: 13, fontWeight: '900' },
  emptyText: { color: '#89968E', fontSize: 10.5, lineHeight: 16, marginTop: 4 },
});
