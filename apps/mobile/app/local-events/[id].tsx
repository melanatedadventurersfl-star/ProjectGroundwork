import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLocalEvent, setLocalEventRsvp, type LocalEvent } from '../../src/local-events/api';
import { getTrailGuidePlace } from '../../src/trailGuide/catalog';

export default function LocalEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<LocalEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try {
      setError(null);
      setEvent(await getLocalEvent(id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this Campfire.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function rsvp(status: 'going' | 'interested') {
    if (!id) return;
    setSaving(true);
    try {
      await setLocalEventRsvp(id, status);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update your RSVP.');
    } finally {
      setSaving(false);
    }
  }

  async function shareEvent() {
    if (!event) return;
    const when = new Date(event.starts_at).toLocaleString();
    await Share.share({ message: `${event.title}\n${when}\n${event.city}, ${event.state}\nCampfire hosted by ${event.host_name}` });
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!event) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Campfire not found.'}</Text></SafeAreaView>;

  const start = new Date(event.starts_at);
  const trailGuidePlace = event.trail_guide_place_id ? getTrailGuidePlace(event.trail_guide_place_id) : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Outpost</Text></Pressable>
        <Text style={styles.badge}>MEMBER-LED CAMPFIRE</Text>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.host}>Hosted by {event.host_name}</Text>

        {trailGuidePlace ? (
          <Pressable
            onPress={() => router.push({ pathname: '/trail-guide/[id]', params: { id: trailGuidePlace.id } })}
            style={({ pressed }) => [styles.trailGuideCard, pressed && styles.pressed]}
          >
            <View style={styles.trailGuideMark}><Text style={styles.trailGuideMarkText}>TG</Text></View>
            <View style={styles.trailGuideCopy}>
              <Text style={styles.trailGuideEyebrow}>FROM TRAIL GUIDE</Text>
              <Text style={styles.trailGuideName}>{trailGuidePlace.name}</Text>
              <Text style={styles.trailGuideMeta}>{trailGuidePlace.area} · {trailGuidePlace.category}</Text>
            </View>
            <Text style={styles.trailGuideArrow}>›</Text>
          </Pressable>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.label}>When</Text>
          <Text style={styles.value}>{start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
          <Text style={styles.label}>Where</Text>
          <Text style={styles.value}>{event.venue_name ? `${event.venue_name} · ` : ''}{event.city}, {event.state}</Text>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.value}>{event.category}</Text>
          <Text style={styles.label}>Cost</Text>
          <Text style={styles.value}>{event.is_free ? 'Free' : 'Paid meetup'}</Text>
        </View>

        <Text style={styles.sectionTitle}>About this Campfire</Text>
        <Text style={styles.body}>{event.description}</Text>
        {event.meeting_details ? <Text style={styles.body}>{event.meeting_details}</Text> : null}

        <View style={styles.rsvpPanel}>
          <Text style={styles.rsvpCount}>{event.rsvp_count} member{event.rsvp_count === 1 ? '' : 's'} going or interested</Text>
          <View style={styles.rsvpRow}>
            <Pressable disabled={saving} onPress={() => void rsvp('going')} style={[styles.primaryButton, event.my_rsvp === 'going' && styles.selectedButton]}>
              <Text style={styles.primaryButtonText}>{event.my_rsvp === 'going' ? 'Going ✓' : 'I’m going'}</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={() => void rsvp('interested')} style={[styles.secondaryButton, event.my_rsvp === 'interested' && styles.selectedSecondary]}>
              <Text style={styles.secondaryButtonText}>{event.my_rsvp === 'interested' ? 'Interested ✓' : 'Interested'}</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => void shareEvent()} style={styles.shareButton}><Text style={styles.shareText}>Share Campfire</Text></Pressable>
        {event.group_id ? (
          <Pressable onPress={() => router.push({ pathname: '/groups/[id]', params: { id: event.group_id! } })} style={styles.groupButton}>
            <Text style={styles.groupText}>Open Campfire group →</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.disclaimer}>Campfires are member-led meetups unless specifically marked as an official Melanated Adventurers experience.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 22, paddingBottom: 48, gap: 13 },
  back: { color: '#D7B45A', fontWeight: '800', fontSize: 16 },
  badge: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1, fontSize: 11, marginTop: 6 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 38, fontWeight: '900' },
  host: { color: '#D7B45A', fontWeight: '700' },
  trailGuideCard: { backgroundColor: '#191B12', borderRadius: 16, borderWidth: 1, borderColor: '#4A4423', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  trailGuideMark: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A2818' },
  trailGuideMarkText: { color: '#D7B45A', fontWeight: '900', fontSize: 12 },
  trailGuideCopy: { flex: 1 },
  trailGuideEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  trailGuideName: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', marginTop: 1 },
  trailGuideMeta: { color: '#9EAAA2', fontSize: 11, marginTop: 2 },
  trailGuideArrow: { color: '#D7B45A', fontSize: 24, fontWeight: '800' },
  panel: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#29372F', padding: 17, gap: 4 },
  label: { color: '#8E9A92', fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginTop: 7, textTransform: 'uppercase' },
  value: { color: '#FFF8E8', fontSize: 16, lineHeight: 22 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 5 },
  body: { color: '#D2D9D4', fontSize: 16, lineHeight: 24 },
  rsvpPanel: { backgroundColor: '#141E19', borderRadius: 18, padding: 16, gap: 12, marginTop: 4 },
  rsvpCount: { color: '#FFF8E8', fontWeight: '800' },
  rsvpRow: { flexDirection: 'row', gap: 9 },
  primaryButton: { flex: 1, backgroundColor: '#D7B45A', padding: 13, borderRadius: 12, alignItems: 'center' },
  selectedButton: { opacity: 0.85 },
  primaryButtonText: { color: '#17211C', fontWeight: '900' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#D7B45A', padding: 13, borderRadius: 12, alignItems: 'center' },
  selectedSecondary: { backgroundColor: '#2A332A' },
  secondaryButtonText: { color: '#F4E6BB', fontWeight: '900' },
  shareButton: { alignItems: 'center', padding: 13 },
  shareText: { color: '#D7B45A', fontWeight: '900' },
  groupButton: { backgroundColor: '#17211C', borderRadius: 14, padding: 14, alignItems: 'center' },
  groupText: { color: '#FFF8E8', fontWeight: '900' },
  disclaimer: { color: '#7E8B83', fontSize: 12, lineHeight: 18, marginTop: 8 },
  error: { color: '#FFB4A9', textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
