import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { saveReflection } from '../../../src/passport/api';

export default function ReflectionScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [rating, setRating] = useState(5);
  const [highlight, setHighlight] = useState('');
  const [reflection, setReflection] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'community'>('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!adventureId) return;
    setSaving(true);
    setError(null);
    try {
      await saveReflection({ adventureId, rating, highlight, reflection, visibility });
      router.replace('/(tabs)/passport');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save reflection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>LOOK BACK</Text>
        <Text style={styles.title}>Reflect on the adventure</Text>
        <Text style={styles.label}>How was it?</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable key={value} style={[styles.rating, rating === value && styles.ratingSelected]} onPress={() => setRating(value)}>
              <Text style={[styles.ratingText, rating === value && styles.ratingTextSelected]}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>One moment you want to remember</Text>
        <TextInput value={highlight} onChangeText={setHighlight} maxLength={180} placeholder="The view, the laugh, the first step…" placeholderTextColor="#77827b" style={styles.input} />
        <Text style={styles.label}>Your reflection</Text>
        <TextInput value={reflection} onChangeText={setReflection} multiline maxLength={5000} placeholder="What changed, surprised, challenged, or delighted you?" placeholderTextColor="#77827b" style={[styles.input, styles.largeInput]} />
        <Text style={styles.label}>Visibility</Text>
        <View style={styles.visibilityRow}>
          {(['private', 'community'] as const).map((option) => (
            <Pressable key={option} style={[styles.visibility, visibility === option && styles.visibilitySelected]} onPress={() => setVisibility(option)}>
              <Text style={styles.visibilityText}>{option === 'private' ? 'Only me' : 'Share with community'}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, saving && styles.disabled]} disabled={saving} onPress={() => void submit()}>
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save reflection'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  content: { padding: 20, paddingBottom: 48, gap: 13 },
  eyebrow: { color: '#d3a94f', fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#fff8e8', fontSize: 32, lineHeight: 36, fontWeight: '900' },
  label: { color: '#fff8e8', fontWeight: '900', marginTop: 7 },
  ratingRow: { flexDirection: 'row', gap: 9 },
  rating: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#55625a', alignItems: 'center', justifyContent: 'center' },
  ratingSelected: { backgroundColor: '#d3a94f', borderColor: '#d3a94f' },
  ratingText: { color: '#fff8e8', fontWeight: '900' },
  ratingTextSelected: { color: '#17211c' },
  input: { backgroundColor: '#17211c', borderRadius: 14, padding: 14, color: '#fff8e8', fontSize: 16 },
  largeInput: { minHeight: 150, textAlignVertical: 'top' },
  visibilityRow: { gap: 9 },
  visibility: { borderWidth: 1, borderColor: '#55625a', borderRadius: 13, padding: 14 },
  visibilitySelected: { borderColor: '#d3a94f', backgroundColor: '#17211c' },
  visibilityText: { color: '#fff8e8', fontWeight: '800' },
  button: { backgroundColor: '#d3a94f', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#17211c', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.5 },
  error: { color: '#ffb4a9' },
});
