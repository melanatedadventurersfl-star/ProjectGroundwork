import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAiPrivacyPreferences, type AiPrivacyPreferences } from '../../src/hosting/aiPlanner';
import { AI_PRIVACY_DEFAULTS, clearAiMemories, saveAiPrivacyPreferences } from '../../src/hosting/aiPrivacy';
import { markHostSetupReviewed } from '../../src/hosting/hostEntry';

type Key = keyof AiPrivacyPreferences;
const rows: { key: Key; title: string; body: string }[] = [
  { key: 'personal_memory_enabled', title: 'Personal Memory', body: 'Remember planning preferences you explicitly allow, such as common event types, locations, attendance ranges and preferred setup patterns.' },
  { key: 'event_history_learning_enabled', title: 'Learn From Event History', body: 'Use your past event decisions to suggest future defaults. This stays off unless you enable it.' },
  { key: 'organization_memory_enabled', title: 'Shared Organization Memory', body: 'Use approved Go Melanated operational knowledge that your account is already allowed to access.' },
  { key: 'save_conversations_enabled', title: 'Save AI Planning Conversations', body: 'Keep AI planning conversations so you can return to them later.' },
  { key: 'recommendation_history_enabled', title: 'Recommendation History', body: 'Remember which AI recommendations you accepted or changed so future planning can become more relevant.' },
  { key: 'product_analytics_enabled', title: 'Product Improvement Analytics', body: 'Share structured planning signals such as event type, feature use and planning completion. Raw AI conversation text is not required for this setting.' },
];

export default function AiPrivacyScreen() {
  const [prefs, setPrefs] = useState<AiPrivacyPreferences>(AI_PRIVACY_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { void getAiPrivacyPreferences().then(setPrefs).catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load settings.')).finally(() => setLoading(false)); }, []);

  async function toggle(key: Key, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true); setMessage('');
    try {
      await saveAiPrivacyPreferences(next);
      await markHostSetupReviewed('ai_privacy');
      setMessage('Saved');
    }
    catch (error) { setPrefs(prefs); setMessage(error instanceof Error ? error.message : 'Unable to save.'); }
    finally { setSaving(false); }
  }

  async function clearMemory() {
    setSaving(true); setMessage('');
    try { await clearAiMemories(); setMessage('Saved AI memory cleared.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to clear memory.'); }
    finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>AI & PRIVACY</Text>
    <Text style={styles.title}>You decide what the AI remembers.</Text>
    <Text style={styles.subtitle}>All optional AI memory, personalization and product analytics start off. Turn on only the features you want.</Text>

    <View style={styles.notice}><Text style={styles.noticeTitle}>Default: private, session-only planning</Text><Text style={styles.noticeBody}>Turning a setting off stops that type of future learning. Existing saved memory can be cleared separately.</Text></View>

    {loading ? <ActivityIndicator color="#D7B45A" style={{ marginTop: 30 }} /> : <View style={styles.list}>{rows.map((row) => <View key={row.key} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{row.title}</Text><Text style={styles.rowBody}>{row.body}</Text></View><Switch value={prefs[row.key]} onValueChange={(value) => void toggle(row.key, value)} trackColor={{ false: '#303A34', true: '#715D28' }} thumbColor={prefs[row.key] ? '#E7C464' : '#94A098'} /></View>)}</View>}

    <Pressable style={styles.clear} disabled={saving} onPress={() => void clearMemory()}><Text style={styles.clearText}>Clear Saved AI Memory</Text></Pressable>
    {message ? <Text style={styles.message}>{saving ? 'Saving…' : message}</Text> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 70 }, back: { color: '#D7B45A', fontSize: 12, fontWeight: '900', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 12, lineHeight: 18, marginTop: 6 }, notice: { borderRadius: 15, borderWidth: 1, borderColor: '#594B24', backgroundColor: '#1D1A10', padding: 13, marginTop: 16 }, noticeTitle: { color: '#F0D27D', fontSize: 12, fontWeight: '900' }, noticeBody: { color: '#AAA28C', fontSize: 10, lineHeight: 15, marginTop: 4 }, list: { marginTop: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#313D35' }, row: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, backgroundColor: '#141B16', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2D3831' }, rowTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' }, rowBody: { color: '#8E9992', fontSize: 10, lineHeight: 15, marginTop: 4 }, clear: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#6B3D38', backgroundColor: '#241513', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, clearText: { color: '#F0A199', fontSize: 11, fontWeight: '900' }, message: { color: '#AAB5AE', fontSize: 10, textAlign: 'center', marginTop: 10 } });
