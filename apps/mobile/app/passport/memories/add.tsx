import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addMemoryPhoto, getJourney, type JourneyItem, type MemoryVisibility } from '../../../src/passport/api';

const visibilityOptions: { value: MemoryVisibility; label: string }[] = [
  { value: 'private', label: 'Only me' },
  { value: 'group', label: 'MA Members' },
  { value: 'public', label: 'Public' },
];

export default function AddMemoryScreen() {
  const params = useLocalSearchParams<{ adventureId?: string; imageUrl?: string; sourcePhotoId?: string }>();
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [adventureId, setAdventureId] = useState(params.adventureId ?? '');
  const [imageUrl, setImageUrl] = useState(params.imageUrl ?? '');
  const [caption, setCaption] = useState('');
  const [reflection, setReflection] = useState('');
  const [visibility, setVisibility] = useState<MemoryVisibility>('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getJourney().then(setJourney).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load completed adventures.'));
  }, []);

  const selected = useMemo(() => journey.find((item) => item.adventure_id === adventureId) ?? null, [adventureId, journey]);
  const fromEventGallery = Boolean(params.imageUrl);

  async function save() {
    if (!adventureId) {
      setError('Choose a completed adventure first.');
      return;
    }
    if (!imageUrl.trim()) {
      setError('Add a photo URL to save this memory.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const memory = await addMemoryPhoto({
        adventureId,
        imageUrl,
        caption,
        reflection,
        visibility,
        sourceKind: fromEventGallery ? 'event_gallery' : 'personal',
        sourcePhotoId: params.sourcePhotoId,
      });
      router.replace(`/passport/memories/photo/${memory.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save memory.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Memories</Text></Pressable>
        <Text style={styles.eyebrow}>{fromEventGallery ? 'SAVE FROM EVENT GALLERY' : 'ADD TO YOUR PASSPORT'}</Text>
        <Text style={styles.title}>Add Memory</Text>
        <Text style={styles.subtitle}>Choose a completed adventure, add the moment, then decide whether it stays private or becomes part of your shared Passport.</Text>

        <Text style={styles.label}>1. Choose a completed adventure</Text>
        <View style={styles.adventureStack}>
          {journey.map((item) => {
            const active = item.adventure_id === adventureId;
            return (
              <Pressable key={item.adventure_id} style={[styles.adventureCard, active && styles.adventureCardActive]} onPress={() => setAdventureId(item.adventure_id)}>
                <Text style={[styles.adventureTitle, active && styles.adventureTitleActive]}>{item.title}</Text>
                <Text style={styles.adventureMeta}>{new Date(item.experienced_at || item.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {item.city}, {item.state}</Text>
              </Pressable>
            );
          })}
        </View>

        {!journey.length ? <Text style={styles.emptyText}>Completed official adventures will appear here automatically.</Text> : null}

        <Text style={styles.label}>2. Add the photo</Text>
        {fromEventGallery ? (
          <View style={styles.lockedSource}>
            <Text style={styles.lockedTitle}>Event photo selected</Text>
            <Text style={styles.lockedBody}>This saves a personal copy to your Memories. Removing it later will not delete the original event photo.</Text>
          </View>
        ) : (
          <>
            <TextInput value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" keyboardType="url" placeholder="Photo URL" placeholderTextColor="#748078" style={styles.input} />
            <Text style={styles.helper}>Device photo picking is not wired into the current mobile dependency set yet. This field keeps the flow functional now and is also the handoff point for event-gallery saves.</Text>
          </>
        )}

        <Text style={styles.label}>3. Add context (optional)</Text>
        <TextInput value={caption} onChangeText={setCaption} maxLength={240} placeholder="Caption" placeholderTextColor="#748078" style={styles.input} />
        <TextInput value={reflection} onChangeText={setReflection} multiline maxLength={2000} placeholder="What do you want to remember about this moment?" placeholderTextColor="#748078" style={[styles.input, styles.reflectionInput]} />

        <Text style={styles.label}>4. Privacy</Text>
        <View style={styles.visibilityStack}>
          {visibilityOptions.map((option) => {
            const active = visibility === option.value;
            return (
              <Pressable key={option.value} style={[styles.visibility, active && styles.visibilityActive]} onPress={() => setVisibility(option.value)}>
                <Text style={[styles.visibilityText, active && styles.visibilityTextActive]}>{option.label}</Text>
                {option.value === 'private' ? <Text style={styles.defaultBadge}>DEFAULT</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {selected ? <Text style={styles.selectedNote}>Saving to: {selected.title}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.primary, saving && styles.disabled]} disabled={saving} onPress={() => void save()}>
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save Memory'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 6 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 39, fontWeight: '900' },
  subtitle: { color: '#98A49C', lineHeight: 20 },
  label: { color: '#FFF8E8', fontWeight: '900', marginTop: 7 },
  adventureStack: { gap: 8 },
  adventureCard: { borderWidth: 1, borderColor: '#3B4B41', borderRadius: 14, padding: 13, backgroundColor: '#151F1A' },
  adventureCardActive: { borderColor: '#D7B45A', backgroundColor: '#1B2922' },
  adventureTitle: { color: '#B8C1BB', fontWeight: '900' },
  adventureTitleActive: { color: '#FFF8E8' },
  adventureMeta: { color: '#7F8D84', fontSize: 11, marginTop: 4 },
  input: { backgroundColor: '#17211C', borderRadius: 14, borderWidth: 1, borderColor: '#2B3931', padding: 14, color: '#FFF8E8', fontSize: 15 },
  reflectionInput: { minHeight: 120, textAlignVertical: 'top' },
  helper: { color: '#748078', fontSize: 11, lineHeight: 16 },
  lockedSource: { backgroundColor: '#17211C', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#395043' },
  lockedTitle: { color: '#FFF8E8', fontWeight: '900' },
  lockedBody: { color: '#8F9C94', lineHeight: 18, marginTop: 4 },
  visibilityStack: { gap: 8 },
  visibility: { borderWidth: 1, borderColor: '#46564C', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between' },
  visibilityActive: { borderColor: '#D7B45A', backgroundColor: '#17211C' },
  visibilityText: { color: '#AAB4AD', fontWeight: '800' },
  visibilityTextActive: { color: '#FFF8E8' },
  defaultBadge: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  selectedNote: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
  primary: { backgroundColor: '#D7B45A', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#142019', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#FFB4A9' },
  emptyText: { color: '#8F9C94', lineHeight: 18 },
});
