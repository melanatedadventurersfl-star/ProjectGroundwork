import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getJourney, saveReflection } from '../../../../src/passport/api';

export default function EditReflectionScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [rating, setRating] = useState(0);
  const [highlight, setHighlight] = useState('');
  const [reflection, setReflection] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'community'>('private');
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadExisting() {
      if (!adventureId) {
        setLoadingExisting(false);
        return;
      }

      try {
        const journey = await getJourney();
        const item = journey.find((entry) => entry.adventure_id === adventureId);
        if (!active || !item) return;
        if (item.rating) setRating(item.rating);
        setHighlight(item.highlight ?? '');
        setReflection(item.reflection ?? '');
      } catch {
        // Memory editing remains usable even if preload fails.
      } finally {
        if (active) setLoadingExisting(false);
      }
    }

    void loadExisting();
    return () => { active = false; };
  }, [adventureId]);

  async function submit() {
    if (!adventureId || rating < 1) return;
    setSaving(true);
    setError(null);
    try {
      await saveReflection({ adventureId, rating, highlight, reflection, visibility });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your memory.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
          <Text style={styles.topTitle}>YOUR MEMORY</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={styles.eyebrow}>LOOK BACK</Text>
        <Text style={styles.title}>{loadingExisting ? 'Opening your memory…' : 'How do you remember it?'}</Text>
        <Text style={styles.intro}>Rate the experience, save a private note, or share a short reflection with the community.</Text>

        <Text style={styles.label}>Your rating</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              style={styles.starButton}
              onPress={() => setRating(value)}
              accessibilityRole="button"
              accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
              accessibilityState={{ selected: rating === value }}
            >
              <Text style={[styles.star, value <= rating && styles.starSelected]}>★</Text>
            </Pressable>
          ))}
        </View>
        {!rating ? <Text style={styles.hint}>Choose 1–5 stars to save this memory.</Text> : null}

        <Text style={styles.label}>One moment you want to remember</Text>
        <TextInput
          value={highlight}
          onChangeText={setHighlight}
          maxLength={180}
          placeholder="The view, the laugh, the first step…"
          placeholderTextColor="#77827b"
          style={styles.input}
        />

        <Text style={styles.label}>Your notes or review</Text>
        <TextInput
          value={reflection}
          onChangeText={setReflection}
          multiline
          maxLength={5000}
          placeholder="What happened? What surprised you? What do you want to remember later?"
          placeholderTextColor="#77827b"
          style={[styles.input, styles.largeInput]}
        />

        <Text style={styles.label}>Who can see this reflection?</Text>
        <View style={styles.visibilityRow}>
          <Pressable
            style={[styles.visibility, visibility === 'private' && styles.visibilitySelected]}
            onPress={() => setVisibility('private')}
          >
            <View style={styles.radio}>{visibility === 'private' ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.visibilityCopy}>
              <Text style={styles.visibilityTitle}>Only Me</Text>
              <Text style={styles.visibilityBody}>Keep your rating and notes as a private Passport memory.</Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.visibility, visibility === 'community' && styles.visibilitySelected]}
            onPress={() => setVisibility('community')}
          >
            <View style={styles.radio}>{visibility === 'community' ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.visibilityCopy}>
              <Text style={styles.visibilityTitle}>Share Reflection</Text>
              <Text style={styles.visibilityBody}>Make this reflection available for future community-facing adventure experiences.</Text>
            </View>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, (saving || rating < 1) && styles.disabled]} disabled={saving || rating < 1} onPress={() => void submit()}>
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save to Memory'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 48, gap: 13 },
  topBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, color: '#FFF8E8', fontSize: 38, lineHeight: 40, fontWeight: '300' },
  topTitle: { color: '#D7B45A', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  spacer: { width: 42 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 10 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 35, fontWeight: '900' },
  intro: { color: '#96A199', fontSize: 13.5, lineHeight: 20, marginBottom: 4 },
  label: { color: '#FFF8E8', fontWeight: '900', marginTop: 7 },
  ratingRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  starButton: { width: 50, height: 48, alignItems: 'center', justifyContent: 'center' },
  star: { color: '#46524C', fontSize: 36, lineHeight: 40 },
  starSelected: { color: '#F5C341' },
  hint: { color: '#7F8A83', fontSize: 11.5 },
  input: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2F3E35', borderRadius: 14, padding: 14, color: '#FFF8E8', fontSize: 15 },
  largeInput: { minHeight: 145, textAlignVertical: 'top' },
  visibilityRow: { gap: 9 },
  visibility: { borderWidth: 1, borderColor: '#3B4A41', backgroundColor: '#151F1A', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  visibilitySelected: { borderColor: '#D7B45A', backgroundColor: '#18241E' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D7B45A' },
  visibilityCopy: { flex: 1, gap: 3 },
  visibilityTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  visibilityBody: { color: '#8F9B94', fontSize: 12, lineHeight: 17 },
  button: { backgroundColor: '#D7B45A', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#17211C', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.45 },
  error: { color: '#FFB4A9' },
});
