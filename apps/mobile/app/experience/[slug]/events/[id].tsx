import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../../../src/lib/supabase';
import { useTenantExperience } from '../../../../src/platform/TenantExperienceProvider';
import { AppIcon } from '../../../../src/ui/AppIcon';

type EventDetail = {
  id: string;
  title: string;
  summary: string;
  category: string;
  starts_at: string;
  ends_at: string;
  city: string;
  state: string;
  address: string | null;
  venue_name: string | null;
  hero_image_url: string | null;
  starting_price_cents: number;
  spots_remaining: number | null;
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TenantEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { context, moduleEnabled } = useTenantExperience();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!context || !moduleEnabled('events') || !id) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    void supabase
      .from('adventures')
      .select('id,title,summary,category,starts_at,ends_at,city,state,address,venue_name,hero_image_url,starting_price_cents,spots_remaining')
      .eq('id', id)
      .eq('public_experience_id', context.experience.id)
      .in('status', ['published', 'sold_out'])
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) throw queryError;
        if (!data) {
          setEvent(null);
          setError('This event is not available in this app.');
          return;
        }
        setEvent(data as EventDetail);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to open this event.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [context, id, moduleEnabled]);

  if (!context) return null;

  const accent = textValue(context.experience.branding.accent, '#D7B45A');
  const surface = textValue(context.experience.branding.surface, '#17211C');
  const text = textValue(context.experience.branding.text, '#FFF8E8');

  if (!moduleEnabled('events')) {
    return <View style={styles.center}><Text style={[styles.errorTitle, { color: text }]}>Events are not enabled for this app.</Text></View>;
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} size="large" /></View>;
  if (error || !event) return <View style={styles.center}><Text style={[styles.errorTitle, { color: text }]}>Event unavailable</Text><Text style={styles.errorText}>{error || 'This event is unavailable.'}</Text></View>;

  const location = [event.venue_name, event.address, [event.city, event.state].filter(Boolean).join(', ')].filter(Boolean).join('\n');
  const price = event.starting_price_cents
    ? (event.starting_price_cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
    : 'Free';

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    {event.hero_image_url ? <Image source={{ uri: event.hero_image_url }} style={styles.hero} /> : <View style={[styles.hero, styles.heroFallback, { backgroundColor: surface }]}><AppIcon name="calendar" color={accent} size={42} /></View>}
    <View style={styles.copy}>
      <Text style={[styles.category, { color: accent }]}>{event.category.toUpperCase()}</Text>
      <Text style={[styles.title, { color: text }]}>{event.title}</Text>
      <Text style={styles.summary}>{event.summary}</Text>

      <View style={[styles.card, { backgroundColor: surface }]}>
        <DetailRow icon="calendar" label="Starts" value={formatDate(event.starts_at)} accent={accent} text={text} />
        <DetailRow icon="calendar" label="Ends" value={formatDate(event.ends_at)} accent={accent} text={text} />
        {location ? <DetailRow icon="location" label="Location" value={location} accent={accent} text={text} /> : null}
        <DetailRow icon="badge" label="Price" value={price} accent={accent} text={text} />
        {typeof event.spots_remaining === 'number' ? <DetailRow icon="connections" label="Availability" value={`${event.spots_remaining} spot${event.spots_remaining === 1 ? '' : 's'} remaining`} accent={accent} text={text} /> : null}
      </View>

      <View style={[styles.notice, { borderColor: `${accent}55` }]}>
        <Text style={[styles.noticeTitle, { color: text }]}>Registration stays inside this organization experience.</Text>
        <Text style={styles.noticeText}>A separate tenant-safe checkout will be connected here before public ticket sales are enabled.</Text>
      </View>
    </View>
  </ScrollView>;
}

function DetailRow({ icon, label, value, accent, text }: { icon: 'calendar' | 'location' | 'badge' | 'connections'; label: string; value: string; accent: string; text: string }) {
  return <View style={styles.detailRow}>
    <View style={[styles.detailIcon, { backgroundColor: `${accent}20` }]}><AppIcon name={icon} color={accent} size={18} /></View>
    <View style={styles.flex}><Text style={styles.detailLabel}>{label}</Text><Text style={[styles.detailValue, { color: text }]}>{value}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, maxWidth: 900, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
  hero: { width: '100%', height: 270 },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { padding: 18 },
  flex: { flex: 1 },
  category: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '900', marginTop: 5 },
  summary: { color: '#AAB5AE', fontSize: 13, lineHeight: 20, marginTop: 10 },
  card: { borderRadius: 18, padding: 14, marginTop: 20, gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  detailIcon: { width: 37, height: 37, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { color: '#7F8D84', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { fontSize: 11.5, lineHeight: 17, fontWeight: '700', marginTop: 3 },
  notice: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 15, backgroundColor: 'rgba(255,255,255,0.025)' },
  noticeTitle: { fontSize: 11.5, fontWeight: '900' },
  noticeText: { color: '#89968E', fontSize: 10, lineHeight: 15, marginTop: 4 },
  errorTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  errorText: { color: '#9AA79F', fontSize: 11, lineHeight: 17, textAlign: 'center', maxWidth: 430 },
});
