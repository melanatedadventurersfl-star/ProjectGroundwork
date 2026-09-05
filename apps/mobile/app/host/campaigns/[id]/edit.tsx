import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign, updateCampaignDetails, type HostCampaign } from '../../../../src/hosting/campaigns';

type EventStatus = HostCampaign['status'];

export default function EditHostCampaignScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [title, setTitle] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [status, setStatus] = useState<EventStatus>('planning');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await getHostCampaign(String(params.id));
      setCampaign(next);
      if (!next) return;
      setTitle(next.title);
      setShortTitle(next.shortTitle);
      setLocation(next.location);
      setStartsAt(toLocalInput(next.startsAt));
      setEndsAt(toLocalInput(next.endsAt));
      setHeroImageUrl(next.heroImageUrl ?? '');
      setStatus(next.status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load event details.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (!campaign || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateCampaignDetails(campaign, {
        title,
        shortTitle,
        location,
        startsAt: parseLocalInput(startsAt),
        endsAt: parseLocalInput(endsAt),
        status,
        heroImageUrl: heroImageUrl.trim() || null,
      });
      setMessage('Event details updated.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save event details.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !campaign) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Opening event details…</Text></View></SafeAreaView>;
  if (!campaign) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Event unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT DETAILS</Text>
      </View>

      <Text style={styles.title}>Edit event</Text>
      <Text style={styles.subtitle}>Changes update the Host Center event record. Title, dates, and cover photo also update the linked public adventure.</Text>

      <View style={styles.coverCard}>
        {heroImageUrl.trim() ? <Image source={{ uri: heroImageUrl.trim() }} style={styles.cover} resizeMode="cover" /> : <View style={styles.coverFallback}><Text style={styles.coverFallbackText}>No cover photo</Text></View>}
        <View style={styles.coverCopy}><Text style={styles.cardTitle}>Cover photo</Text><Text style={styles.help}>Paste the existing hosted image URL or a new image URL. The event header updates after you save.</Text></View>
      </View>
      <Field label="Cover photo URL" value={heroImageUrl} onChangeText={setHeroImageUrl} placeholder="https://…" />

      <Field label="Full event title" value={title} onChangeText={setTitle} />
      <Field label="Short title" value={shortTitle} onChangeText={setShortTitle} help="Used in compact Host Center views." />
      <Field label="Location" value={location} onChangeText={setLocation} />
      <Field label="Starts" value={startsAt} onChangeText={setStartsAt} placeholder="2026-09-12 18:00" help="Use YYYY-MM-DD HH:MM." />
      <Field label="Ends" value={endsAt} onChangeText={setEndsAt} placeholder="2026-09-12 22:00" help="Use YYYY-MM-DD HH:MM." />

      <Text style={styles.label}>Status</Text>
      <View style={styles.statusRow}>
        {(['planning', 'live', 'complete'] as EventStatus[]).map((item) => <Pressable key={item} style={[styles.statusChip, status === item && styles.statusChipActive]} onPress={() => setStatus(item)}><Text style={[styles.statusText, status === item && styles.statusTextActive]}>{capitalize(item)}</Text></Pressable>)}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Pressable disabled={saving || !campaign.canManage} style={[styles.saveButton, (saving || !campaign.canManage) && styles.disabled]} onPress={() => void save()}>
        {saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
      </Pressable>
      {!campaign.canManage ? <Text style={styles.permission}>You can view this event, but your account does not have permission to edit it.</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Field({ label, value, onChangeText, placeholder, help }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; help?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#657169" style={styles.input} autoCapitalize="sentences" autoCorrect={false} />{help ? <Text style={styles.help}>{help}</Text> : null}</View>;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalInput(value: string) {
  const normalized = value.trim().replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 18, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#CBD4CE', fontSize: 12, fontWeight: '900' },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 18 },
  subtitle: { color: '#8D9891', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 18 },
  coverCard: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#314039', backgroundColor: '#121A16', padding: 12, marginBottom: 16 },
  cover: { width: 88, height: 108, borderRadius: 12, backgroundColor: '#18211B' },
  coverFallback: { width: 88, height: 108, borderRadius: 12, backgroundColor: '#1A211D', borderWidth: 1, borderColor: '#354139', alignItems: 'center', justifyContent: 'center', padding: 8 },
  coverFallbackText: { color: '#78847D', fontSize: 9, fontWeight: '800', textAlign: 'center' },
  coverCopy: { flex: 1 },
  cardTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  field: { marginBottom: 15 },
  label: { color: '#D6DDD8', fontSize: 10, fontWeight: '900', marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#354139', backgroundColor: '#121A16', color: '#FFF8E8', fontSize: 12, paddingHorizontal: 12 },
  help: { color: '#748079', fontSize: 9, lineHeight: 14, marginTop: 5 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statusChip: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#354139', backgroundColor: '#121A16', alignItems: 'center', justifyContent: 'center' },
  statusChipActive: { borderColor: '#7DA735', backgroundColor: '#1A3118' },
  statusText: { color: '#87928B', fontSize: 10, fontWeight: '900' },
  statusTextActive: { color: '#C9E678' },
  saveButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#E1BC4D', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  saveButtonText: { color: '#172017', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: .45 },
  error: { color: '#FF8178', fontSize: 10, lineHeight: 15, marginBottom: 10 },
  success: { color: '#A8CF55', fontSize: 10, fontWeight: '800', marginBottom: 10 },
  muted: { color: '#8D9891', fontSize: 11 },
  permission: { color: '#7E8982', fontSize: 9.5, lineHeight: 14, textAlign: 'center', marginTop: 10 },
});
