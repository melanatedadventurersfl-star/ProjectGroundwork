import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLocalEvent, setLocalEventRsvp, type LocalEvent } from '../../src/local-events/api';
import { supabase } from '../../src/lib/supabase';

export default function LocalEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<LocalEvent | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [nextEvent, sessionResult] = await Promise.all([
        getLocalEvent(id),
        supabase.auth.getSession(),
      ]);
      setEvent(nextEvent);
      setCurrentUserId(sessionResult.data.session?.user.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this Outing.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

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
    await Share.share({ message: `${event.title}\n${when}\n${event.city}, ${event.state}\nOuting hosted by ${event.host_name}` });
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!event) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Outing not found.'}</Text></SafeAreaView>;

  const start = new Date(event.starts_at);
  const isOwner = Boolean(currentUserId && event.host_id === currentUserId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Outpost</Text></Pressable>
          {isOwner ? <Pressable style={styles.editButton} onPress={() => router.push({ pathname: '/local-events/edit/[id]', params: { id: event.id } })}><Text style={styles.editText}>Edit</Text></Pressable> : null}
        </View>
        <Text style={styles.badge}>MEMBER-LED OUTING</Text>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.host}>Hosted by {event.host_name}</Text>

        {event.image_url ? <Image source={{ uri: event.image_url }} style={styles.heroImage} resizeMode="cover" /> : isOwner ? (
          <Pressable style={styles.addPhotoCard} onPress={() => router.push({ pathname: '/local-events/edit/[id]', params: { id: event.id } })}>
            <Text style={styles.addPhotoTitle}>Add an outing photo</Text>
            <Text style={styles.addPhotoText}>Give people a quick visual reason to join.</Text>
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
          <Text style={styles.value}>{event.is_free ? 'Free' : 'Paid outing'}</Text>
        </View>

        <Text style={styles.sectionTitle}>About this Outing</Text>
        <Text style={styles.body}>{event.description}</Text>
        {event.meeting_details ? <Text style={styles.body}>{event.meeting_details}</Text> : null}

        {!isOwner ? <View style={styles.rsvpPanel}>
          <Text style={styles.rsvpCount}>{event.rsvp_count} member{event.rsvp_count === 1 ? '' : 's'} going or interested</Text>
          <View style={styles.rsvpRow}>
            <Pressable disabled={saving} onPress={() => void rsvp('going')} style={[styles.primaryButton, event.my_rsvp === 'going' && styles.selectedButton]}>
              <Text style={styles.primaryButtonText}>{event.my_rsvp === 'going' ? 'Going ✓' : 'I’m going'}</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={() => void rsvp('interested')} style={[styles.secondaryButton, event.my_rsvp === 'interested' && styles.selectedSecondary]}>
              <Text style={styles.secondaryButtonText}>{event.my_rsvp === 'interested' ? 'Interested ✓' : 'Interested'}</Text>
            </Pressable>
          </View>
        </View> : <View style={styles.ownerPanel}><Text style={styles.ownerTitle}>You planned this outing</Text><Text style={styles.ownerText}>{event.rsvp_count ? `${event.rsvp_count} member${event.rsvp_count === 1 ? '' : 's'} have responded.` : 'No one has responded yet.'}</Text></View>}

        <Pressable onPress={() => void shareEvent()} style={styles.shareButton}><Text style={styles.shareText}>Share Outing</Text></Pressable>
        {event.group_id ? (
          <Pressable onPress={() => router.push({ pathname: '/groups/[id]', params: { id: event.group_id! } })} style={styles.groupButton}>
            <Text style={styles.groupText}>Open community →</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.disclaimer}>Outings are member-led plans unless specifically marked as an official Melanated Adventurers experience.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 22, paddingBottom: 48, gap: 13 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#D7B45A', fontWeight: '800', fontSize: 16 },
  editButton: { borderWidth: 1, borderColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 15, paddingVertical: 7 },
  editText: { color: '#F4E6BB', fontWeight: '900' },
  badge: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1, fontSize: 11, marginTop: 6 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 38, fontWeight: '900' },
  host: { color: '#D7B45A', fontWeight: '700' },
  heroImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, backgroundColor: '#17211C' },
  addPhotoCard: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#53635A', borderRadius: 18, backgroundColor: '#141E19', padding: 18 },
  addPhotoTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 16 },
  addPhotoText: { color: '#8D9991', marginTop: 3, lineHeight: 18 },
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
  ownerPanel: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#38483E', padding: 15 },
  ownerTitle: { color: '#FFF8E8', fontWeight: '900' },
  ownerText: { color: '#95A198', marginTop: 4 },
  shareButton: { alignItems: 'center', padding: 13 },
  shareText: { color: '#D7B45A', fontWeight: '900' },
  groupButton: { backgroundColor: '#17211C', borderRadius: 14, padding: 14, alignItems: 'center' },
  groupText: { color: '#FFF8E8', fontWeight: '900' },
  disclaimer: { color: '#7E8B83', fontSize: 12, lineHeight: 18, marginTop: 8 },
  error: { color: '#FFB4A9', textAlign: 'center' },
});