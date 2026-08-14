import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getJourney, getMemoryPhoto, removeMemoryPhoto, updateMemoryPhoto, type JourneyItem, type MemoryPhoto, type MemoryVisibility } from '../../../../src/passport/api';

const visibilityOptions: { value: MemoryVisibility; label: string }[] = [
  { value: 'private', label: 'Only me' },
  { value: 'group', label: 'MA Members' },
  { value: 'public', label: 'Public' },
];

export default function MemoryDetailScreen() {
  const { memoryId } = useLocalSearchParams<{ memoryId: string }>();
  const [memory, setMemory] = useState<MemoryPhoto | null>(null);
  const [adventure, setAdventure] = useState<JourneyItem | null>(null);
  const [caption, setCaption] = useState('');
  const [reflection, setReflection] = useState('');
  const [visibility, setVisibility] = useState<MemoryVisibility>('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!memoryId) return;
    void (async () => {
      try {
        const [nextMemory, journey] = await Promise.all([getMemoryPhoto(memoryId), getJourney()]);
        setMemory(nextMemory);
        setAdventure(journey.find((item) => item.adventure_id === nextMemory.adventure_id) ?? null);
        setCaption(nextMemory.caption ?? '');
        setReflection(nextMemory.reflection ?? '');
        setVisibility(nextMemory.visibility);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load this memory.');
      }
    })();
  }, [memoryId]);

  async function save() {
    if (!memoryId) return;
    try {
      setSaving(true);
      const updated = await updateMemoryPhoto(memoryId, { caption, reflection, visibility });
      setMemory(updated);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this memory.');
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove() {
    Alert.alert('Remove from Memories?', memory?.source_kind === 'event_gallery' ? 'This only removes the saved copy from your Passport. The original event photo is not deleted.' : 'This removes the memory from your Passport.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          if (!memoryId) return;
          void removeMemoryPhoto(memoryId).then(() => router.back()).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to remove this memory.'));
        },
      },
    ]);
  }

  if (!memory) {
    return <SafeAreaView style={styles.center}><Text style={styles.loading}>{error || 'Loading memory…'}</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Image source={{ uri: memory.image_url }} style={styles.hero} resizeMode="cover" />

        <View style={styles.eventCard}>
          <Text style={styles.eyebrow}>MEMORY FROM</Text>
          <Text style={styles.eventTitle}>{adventure?.title ?? 'Completed Adventure'}</Text>
          {adventure ? <Text style={styles.meta}>{new Date(adventure.experienced_at || adventure.starts_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · {adventure.city}, {adventure.state}</Text> : null}
          <Pressable onPress={() => router.push(`/adventures/${memory.adventure_id}`)}><Text style={styles.link}>View Adventure</Text></Pressable>
        </View>

        <Text style={styles.label}>Caption</Text>
        <TextInput value={caption} onChangeText={setCaption} maxLength={240} placeholder="What was happening here?" placeholderTextColor="#748078" style={styles.input} />

        <Text style={styles.label}>Personal reflection</Text>
        <TextInput value={reflection} onChangeText={setReflection} multiline maxLength={2000} placeholder="What do you want to remember about this moment?" placeholderTextColor="#748078" style={[styles.input, styles.reflectionInput]} />

        <Text style={styles.label}>Who can see this memory?</Text>
        <View style={styles.visibilityStack}>
          {visibilityOptions.map((option) => (
            <Pressable key={option.value} style={[styles.visibilityOption, visibility === option.value && styles.visibilitySelected]} onPress={() => setVisibility(option.value)}>
              <Text style={[styles.visibilityText, visibility === option.value && styles.visibilityTextSelected]}>{option.label}</Text>
              {option.value === 'private' ? <Text style={styles.visibilityHint}>Default</Text> : null}
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.primary, saving && styles.disabled]} disabled={saving} onPress={() => void save()}>
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void Share.share({ message: `${caption || adventure?.title || 'Adventure memory'}\n${memory.image_url}` })}>
          <Text style={styles.secondaryText}>Share Memory</Text>
        </Pressable>
        <Pressable style={styles.remove} onPress={confirmRemove}>
          <Text style={styles.removeText}>Remove from Memories</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loading: { color: '#FFF8E8', textAlign: 'center' },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15 },
  hero: { width: '100%', aspectRatio: 0.86, borderRadius: 24, backgroundColor: '#1A2821' },
  eventCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#2B3931', gap: 4 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  eventTitle: { color: '#FFF8E8', fontSize: 21, lineHeight: 26, fontWeight: '900' },
  meta: { color: '#98A49C', fontSize: 12 },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 6 },
  label: { color: '#FFF8E8', fontWeight: '900', marginTop: 5 },
  input: { backgroundColor: '#17211C', borderRadius: 14, borderWidth: 1, borderColor: '#2B3931', padding: 14, color: '#FFF8E8', fontSize: 15 },
  reflectionInput: { minHeight: 120, textAlignVertical: 'top' },
  visibilityStack: { gap: 8 },
  visibilityOption: { borderWidth: 1, borderColor: '#46564C', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between' },
  visibilitySelected: { borderColor: '#D7B45A', backgroundColor: '#17211C' },
  visibilityText: { color: '#AAB4AD', fontWeight: '800' },
  visibilityTextSelected: { color: '#FFF8E8' },
  visibilityHint: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  primary: { backgroundColor: '#D7B45A', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#142019', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: '#59675E', borderRadius: 14, padding: 15, alignItems: 'center' },
  secondaryText: { color: '#FFF8E8', fontWeight: '900' },
  remove: { padding: 14, alignItems: 'center' },
  removeText: { color: '#FFB4A9', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#FFB4A9' },
});
