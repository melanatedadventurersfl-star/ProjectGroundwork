import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOwnedLocalEvent, updateLocalEvent, uploadLocalEventImage } from '../../../src/local-events/api';

const categories = ['Hangout', 'Hiking', 'Water', 'Food & drinks', 'Wellness', 'Family', 'Camping', 'Other'];

type PickedPhoto = { uri: string; mimeType?: string | null };

function localInputValue(value: string) {
  const date = new Date(value);
  const pad = (next: number) => String(next).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function photoFormat(mimeType?: string | null): { contentType: 'image/jpeg' | 'image/png' | 'image/webp'; extension: 'jpg' | 'png' | 'webp' } {
  if (mimeType === 'image/png') return { contentType: 'image/png', extension: 'png' };
  if (mimeType === 'image/webp') return { contentType: 'image/webp', extension: 'webp' };
  return { contentType: 'image/jpeg', extension: 'jpg' };
}

export default function EditLocalEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hangout');
  const [startsAt, setStartsAt] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [capacity, setCapacity] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pickedPhoto, setPickedPhoto] = useState<PickedPhoto | null>(null);

  useEffect(() => {
    if (!id) return;
    getOwnedLocalEvent(id)
      .then((event) => {
        setTitle(event.title);
        setDescription(event.description);
        setCategory(event.category);
        setStartsAt(localInputValue(event.starts_at));
        setVenueName(event.venue_name ?? '');
        setCity(event.city);
        setState(event.state);
        setCapacity(event.capacity == null ? '' : String(event.capacity));
        setImageUrl(event.image_url);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load this outing.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function choosePhoto() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to add an outing photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.88 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (asset) setPickedPhoto({ uri: asset.uri, mimeType: asset.mimeType });
  }

  async function save() {
    if (!id || saving) return;
    setSaving(true);
    setError('');
    try {
      let nextImageUrl = imageUrl;
      if (pickedPhoto) {
        const response = await fetch(pickedPhoto.uri);
        if (!response.ok) throw new Error('Unable to read the selected photo.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        const format = photoFormat(pickedPhoto.mimeType);
        nextImageUrl = await uploadLocalEventImage({ bytes, ...format });
      }

      const numericCapacity = capacity.trim() ? Number(capacity) : null;
      await updateLocalEvent(id, {
        title,
        description,
        category,
        startsAt,
        city,
        state,
        venueName,
        capacity: numericCapacity,
        imageUrl: nextImageUrl,
      });
      Alert.alert('Outing updated', 'Your changes are live.');
      router.replace({ pathname: '/local-events/[id]', params: { id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this outing.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  const preview = pickedPhoto?.uri ?? imageUrl;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.eyebrow}>YOUR OUTING</Text>
        <Text style={styles.title}>Edit outing</Text>
        <Text style={styles.subtitle}>Update the plan people see in Outpost.</Text>

        <Text style={styles.label}>Photo</Text>
        {preview ? <Image source={{ uri: preview }} style={styles.photo} resizeMode="cover" /> : <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderText}>Add a photo to make this outing stand out.</Text></View>}
        <View style={styles.photoActions}>
          <Pressable style={styles.secondary} onPress={() => void choosePhoto()}><Text style={styles.secondaryText}>{preview ? 'Replace Photo' : 'Choose Photo'}</Text></Pressable>
          {preview ? <Pressable style={styles.remove} onPress={() => { setPickedPhoto(null); setImageUrl(null); }}><Text style={styles.removeText}>Remove</Text></Pressable> : null}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} maxLength={80} />

        <Text style={styles.label}>Description</Text>
        <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.multiline]} multiline maxLength={600} />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>

        <Text style={styles.label}>Start</Text>
        <TextInput value={startsAt} onChangeText={setStartsAt} style={styles.input} autoCapitalize="none" placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor="#738078" />

        <Text style={styles.label}>Venue</Text>
        <TextInput value={venueName} onChangeText={setVenueName} style={styles.input} placeholder="Park, trailhead, coffee shop…" placeholderTextColor="#738078" />

        <View style={styles.row}>
          <View style={styles.flex}><Text style={styles.label}>City</Text><TextInput value={city} onChangeText={setCity} style={styles.input} /></View>
          <View style={styles.state}><Text style={styles.label}>State</Text><TextInput value={state} onChangeText={setState} style={styles.input} autoCapitalize="characters" maxLength={2} /></View>
        </View>

        <Text style={styles.label}>Capacity</Text>
        <TextInput value={capacity} onChangeText={setCapacity} style={styles.input} keyboardType="number-pad" placeholder="No limit" placeholderTextColor="#738078" />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={saving} style={[styles.primary, saving && styles.disabled]} onPress={() => void save()}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save Changes'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 60 },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15, marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 32, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#AEB8B2', fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 20 },
  label: { color: '#FFF3CE', fontWeight: '900', fontSize: 12, marginTop: 15, marginBottom: 6 },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, backgroundColor: '#17211C' },
  photoPlaceholder: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#4A5B50', backgroundColor: '#141E19', alignItems: 'center', justifyContent: 'center', padding: 24 },
  photoPlaceholderText: { color: '#89958D', textAlign: 'center', lineHeight: 20 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondary: { flex: 1, borderWidth: 1, borderColor: '#D7B45A', borderRadius: 12, padding: 12, alignItems: 'center' },
  secondaryText: { color: '#F4E6BB', fontWeight: '900' },
  remove: { paddingHorizontal: 16, justifyContent: 'center' },
  removeText: { color: '#FFB4A9', fontWeight: '900' },
  input: { borderRadius: 13, borderWidth: 1, borderColor: '#2B3A31', backgroundColor: '#17211C', color: '#FFF8E8', paddingHorizontal: 13, paddingVertical: 12 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#4E5C53', paddingHorizontal: 11, paddingVertical: 7 },
  chipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  chipText: { color: '#D4DBD6', fontWeight: '800', fontSize: 11 },
  chipTextActive: { color: '#17211C' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  state: { width: 90 },
  primary: { marginTop: 24, minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#17211C', fontWeight: '900', fontSize: 15 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 10, marginTop: 16 },
  disabled: { opacity: 0.5 },
});