import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { generateHostCopilotPlan, type HostCopilotPlan, type HostCopilotResponse } from './copilot';

type Props = {
  city?: string;
  state?: string;
  onApply: (plan: HostCopilotPlan) => void;
};

function ownershipLabel(tags: string[]) {
  return tags.map((tag) => tag.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())).join(' · ');
}

export function HostCopilotCard({ city, state, onApply }: Props) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<HostCopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const next = await generateHostCopilotPlan({ prompt, city, state });
      setResult(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to build a plan right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.spark}><Text style={styles.sparkText}>✦</Text></View>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>PLAN WITH COPILOT</Text>
          <Text style={styles.title}>Describe it. We’ll build the first draft.</Text>
        </View>
      </View>
      <Text style={styles.body}>Tell us the vibe, location, timing, group size, or who it’s for. Copilot can structure the outing and prioritize verified Black- and brown-owned stops when they fit.</Text>

      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        multiline
        maxLength={2000}
        placeholder="Beginner sunset hike near Tampa next Saturday for about 15 people, with a community-owned food stop afterward if there’s a verified option nearby."
        placeholderTextColor="#69766F"
        style={styles.input}
        textAlignVertical="top"
      />
      <View style={styles.promptFooter}>
        <Text style={styles.helper}>{prompt.length}/2000</Text>
        <Pressable disabled={loading || prompt.trim().length < 10} onPress={() => void generate()} style={[styles.generateButton, (loading || prompt.trim().length < 10) && styles.disabled]}>
          {loading ? <ActivityIndicator color="#172017" size="small" /> : <Text style={styles.generateText}>Build my plan</Text>}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result ? (
        <View style={styles.preview}>
          <View style={styles.previewTop}>
            <View style={styles.flex}>
              <Text style={styles.previewEyebrow}>{result.source === 'ai' ? 'COPILOT DRAFT' : 'PLANNING STARTER'}</Text>
              <Text style={styles.previewTitle}>{result.plan.title}</Text>
              <Text style={styles.previewSummary}>{result.plan.summary}</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>{result.plan.difficulty}</Text></View>
          </View>

          <View style={styles.facts}>
            <Text style={styles.fact}>{result.plan.category}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.fact}>{result.plan.capacity} people</Text>
            {result.plan.city ? <><Text style={styles.dot}>•</Text><Text style={styles.fact}>{result.plan.city}, {result.plan.state}</Text></> : null}
          </View>

          {result.plan.safetyNotes.length ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>HOST CHECK</Text>
              {result.plan.safetyNotes.slice(0, 3).map((note) => <Text key={note} style={styles.note}>• {note}</Text>)}
            </View>
          ) : null}

          {result.plan.backupPlan ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>BACKUP PLAN</Text>
              <Text style={styles.note}>{result.plan.backupPlan}</Text>
            </View>
          ) : null}

          {result.plan.communityStops.length ? (
            <View style={styles.communityBox}>
              <Text style={styles.communityTitle}>COMMUNITY-CENTERED STOPS</Text>
              <Text style={styles.communityIntro}>Ownership labels below come only from verified Go Melanated place records.</Text>
              {result.plan.communityStops.map((stop) => (
                <View key={stop.placeId} style={styles.stop}>
                  <Text style={styles.stopName}>{stop.name}</Text>
                  <Text style={styles.ownership}>{ownershipLabel(stop.ownershipTags)}</Text>
                  <Text style={styles.stopReason}>{stop.reason}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noStops}>No verified community-owned stop was matched yet. Copilot will never guess business ownership.</Text>
          )}

          {result.plan.confidenceNotes.length ? <Text style={styles.confidence}>{result.plan.confidenceNotes.join(' ')}</Text> : null}

          <Pressable onPress={() => onApply(result.plan)} style={styles.applyButton}>
            <Text style={styles.applyText}>Use this plan</Text>
          </Pressable>
          <Text style={styles.disclaimer}>Nothing publishes automatically. Review every detail before creating the draft.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, borderColor: '#4E4325', backgroundColor: '#161711', padding: 16, marginBottom: 8 },
  headingRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  spark: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3D3215', borderWidth: 1, borderColor: '#806521' },
  sparkText: { color: '#E7C464', fontSize: 18, fontWeight: '900' },
  flex: { flex: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF5D9', fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 3 },
  body: { color: '#AEB6B0', fontSize: 12, lineHeight: 18, marginTop: 10 },
  input: { minHeight: 112, marginTop: 13, borderRadius: 14, borderWidth: 1, borderColor: '#3B443D', backgroundColor: '#0E1511', color: '#FFF8E8', paddingHorizontal: 13, paddingVertical: 12, fontSize: 13, lineHeight: 19 },
  promptFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  helper: { color: '#6F7B74', fontSize: 10 },
  generateButton: { minHeight: 42, minWidth: 126, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  generateText: { color: '#172017', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.42 },
  error: { color: '#FFB4A9', fontSize: 11, lineHeight: 16, marginTop: 10 },
  preview: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#342F1E', paddingTop: 14 },
  previewTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewEyebrow: { color: '#B69A4D', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  previewTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 3 },
  previewSummary: { color: '#AAB3AD', fontSize: 11, lineHeight: 17, marginTop: 4 },
  badge: { borderRadius: 99, backgroundColor: '#26271D', borderWidth: 1, borderColor: '#555138', paddingHorizontal: 9, paddingVertical: 6 },
  badgeText: { color: '#D9C46D', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 10 },
  fact: { color: '#C6CEC9', fontSize: 10, fontWeight: '700' },
  dot: { color: '#756C45', fontSize: 10 },
  noteBox: { borderRadius: 12, backgroundColor: '#111A15', borderWidth: 1, borderColor: '#2E3A32', padding: 11, marginTop: 10 },
  noteTitle: { color: '#9E8B51', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 5 },
  note: { color: '#AAB4AE', fontSize: 10.5, lineHeight: 16, marginTop: 2 },
  communityBox: { borderRadius: 12, backgroundColor: '#132018', borderWidth: 1, borderColor: '#31533F', padding: 11, marginTop: 10 },
  communityTitle: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  communityIntro: { color: '#809086', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  stop: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#263A2D' },
  stopName: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },
  ownership: { color: '#D7B45A', fontSize: 9, fontWeight: '800', marginTop: 2 },
  stopReason: { color: '#9DA9A1', fontSize: 10, lineHeight: 15, marginTop: 3 },
  noStops: { color: '#7C8880', fontSize: 9.5, lineHeight: 14, marginTop: 10 },
  confidence: { color: '#727D76', fontSize: 9.5, lineHeight: 14, marginTop: 10 },
  applyButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#2E4B38', borderWidth: 1, borderColor: '#477358', alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  applyText: { color: '#E9F2EC', fontSize: 12, fontWeight: '900' },
  disclaimer: { color: '#6F7B74', fontSize: 9, textAlign: 'center', lineHeight: 13, marginTop: 7 },
});
