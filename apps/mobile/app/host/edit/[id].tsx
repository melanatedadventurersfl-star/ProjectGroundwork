import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listMyHostOutings, updateHostOuting, type HostOuting } from '../../../src/hosting/api';

const difficulties = ['easy', 'moderate', 'challenging'] as const;
type Difficulty = (typeof difficulties)[number];

function localInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditHostOutingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [outing, setOuting] = useState<HostOuting | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Social');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [capacity, setCapacity] = useState('');
  const [meetingInstructions, setMeetingInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const found = (await listMyHostOutings()).find((item) => item.id === id) ?? null;
        setOuting(found);
        if (!found) return;
        setTitle(found.title);
        setSummary(found.summary);
        setDescription(found.description);
        setCategory(found.category);
        setDifficulty(found.difficulty);
        setStartsAt(localInputValue(found.starts_at));
        setEndsAt(localInputValue(found.ends_at));
        setVenueName(found.venue_name ?? '');
        setCity(found.city);
        setState(found.state);
        setCapacity(found.capacity == null ? '' : String(found.capacity));
        setMeetingInstructions(found.meeting_instructions ?? '');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load this outing.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function save() {
    if (!id) return;
    const parsedCapacity = capacity.trim() ? Number.parseInt(capacity, 10) : null;
    if (capacity.trim() && (!Number.isFinite(parsedCapacity) || parsedCapacity == null || parsedCapacity < 1)) {
      setError('Capacity must be a whole number of at least 1.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateHostOuting(id, {
        title,
        summary,
        description,
        category,
        difficulty,
        startsAt,
        endsAt,
        city,
        state,
        venueName,
        capacity: parsedCapacity,
        meetingInstructions,
      });
      router.replace(`/host/manage/${id}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!outing) return <SafeAreaView style={styles.center}><Text style={styles.error}>Outing not found.</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></SafeAreaView>;
  const readOnly = outing.status === 'cancelled' || outing.status === 'completed';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Manage outing</Text></Pressable>
        <Text style={styles.eyebrow}>OUTING DETAILS</Text>
        <Text style={styles.title}>{readOnly ? 'Archived details' : 'Edit the outing'}</Text>
        <Text style={styles.subtitle}>{readOnly ? 'Completed and cancelled outings are kept read-only for a reliable history.' : 'Changes save directly to this outing. Existing registrations stay attached.'}</Text>

        <Field label="Title" value={title} onChangeText={setTitle} editable={!readOnly} />
        <Field label="Short hook" value={summary} onChangeText={setSummary} editable={!readOnly} />
        <Field label="Description" value={description} onChangeText={setDescription} editable={!readOnly} multiline />
        <Field label="Category" value={category} onChangeText={setCategory} editable={!readOnly} />

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chips}>{difficulties.map((item) => (
          <Pressable key={item} disabled={readOnly} style={[styles.chip, difficulty === item && styles.chipActive]} onPress={() => setDifficulty(item)}>
            <Text style={[styles.chipText, difficulty === item && styles.chipTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
          </Pressable>
        ))}</View>

        <Field label="Starts" value={startsAt} onChangeText={setStartsAt} editable={!readOnly} placeholder="2026-09-12T09:00" />
        <Field label="Ends" value={endsAt} onChangeText={setEndsAt} editable={!readOnly} placeholder="2026-09-12T12:00" />
        <Field label="Venue / meeting place" value={venueName} onChangeText={setVenueName} editable={!readOnly} />
        <View style={styles.row}>
          <View style={styles.flex}><Field label="City" value={city} onChangeText={setCity} editable={!readOnly} /></View>
          <View style={styles.state}><Field label="State" value={state} onChangeText={setState} editable={!readOnly} /></View>
        </View>
        <Field label="Capacity" value={capacity} onChangeText={setCapacity} editable={!readOnly} keyboardType="number-pad" placeholder="No cap" />
        <Field label="Meeting instructions" value={meetingInstructions} onChangeText={setMeetingInstructions} editable={!readOnly} multiline />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!readOnly ? <Pressable disabled={saving} style={styles.primary} onPress={() => void save()}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save Changes'}</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, multiline = false, editable = true, ...props }: any) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} editable={editable} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor="#66736B" style={[styles.input, multiline && styles.multiline, !editable && styles.readOnly]} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 64 },
  back: { color: '#D7B45A', fontWeight: '800', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 32, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A7B0AA', fontSize: 13, lineHeight: 20, marginTop: 5, marginBottom: 14 },
  field: { marginTop: 14 },
  label: { color: '#D4DAD6', fontSize: 12, fontWeight: '800', marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', borderRadius: 13, color: '#FFF8E8', paddingHorizontal: 13, fontSize: 14 },
  multiline: { minHeight: 105, paddingTop: 13 },
  readOnly: { opacity: .62 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: '#364139', paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#151B17' },
  chipActive: { backgroundColor: '#443616', borderColor: '#8A6A25' },
  chipText: { color: '#A9B1AC', fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#E7C464' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  state: { width: 95 },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryText: { color: '#172017', fontSize: 15, fontWeight: '900' },
  error: { color: '#FF8A80', fontSize: 12, lineHeight: 18, marginTop: 16 },
});
