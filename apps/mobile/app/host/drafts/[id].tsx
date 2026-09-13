import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEventFromDraft, type EventDraft, type ImportPreviewResult } from '../../../src/hosting/creation';
import { loadEventDraftPreview } from '../../../src/hosting/eventPortfolio';

export default function SavedEventDraftScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const draftId = typeof params.id === 'string' ? params.id : '';
  const [result, setResult] = useState<ImportPreviewResult | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (!draftId) throw new Error('Draft ID is missing.');
        const preview = await loadEventDraftPreview(draftId);
        if (!active) return;
        setResult(preview);
        setDraft(preview.preview);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load this event draft.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [draftId]);

  const missing = useMemo(() => {
    if (!draft) return [];
    const fields = [
      !draft.title.trim() ? 'Event title' : '',
      !draft.startsAt ? 'Start date/time' : '',
      !draft.endsAt ? 'End date/time' : '',
      !draft.city.trim() ? 'City' : '',
      !draft.state.trim() ? 'State' : '',
    ];
    return fields.filter(Boolean);
  }, [draft]);

  function setField<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  async function createEvent() {
    if (!draft || !result) return;
    setSaving(true);
    setError('');
    try {
      const created = await createEventFromDraft(draft, { importId: result.importId });
      router.replace(`/host/campaigns/${created.campaign.slug}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this event.');
    } finally {
      setSaving(false);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Events</Text></Pressable>
      <Text style={styles.eyebrow}>SAVED DRAFT</Text>
      <Text style={styles.title}>Continue your event.</Text>
      <Text style={styles.subtitle}>Review the details that were extracted earlier. Missing information stays visible until you fill it in.</Text>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading draft…</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && result && draft ? <>
        <View style={styles.sourceCard}>
          <Text style={styles.sourceLabel}>SOURCE</Text>
          <Text style={styles.sourceTitle}>{result.sourceLabel}</Text>
          <Text style={styles.sourceMeta}>Saved extraction · review before creating</Text>
        </View>

        {result.duplicate?.adventureId ? <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Existing event linked to this draft</Text>
          <Text style={styles.warningBody}>Open the existing event instead of creating a duplicate unless you know this should become a separate event.</Text>
          <Pressable onPress={() => router.push(`/host/manage/${result.duplicate?.adventureId}` as never)}><Text style={styles.warningAction}>Open existing event →</Text></Pressable>
        </View> : null}

        {missing.length ? <View style={styles.missingCard}>
          <Text style={styles.missingTitle}>Still needed</Text>
          <Text style={styles.missingBody}>{missing.join(' · ')}</Text>
        </View> : <View style={styles.readyCard}><Text style={styles.readyTitle}>Core event details are complete</Text><Text style={styles.readyBody}>You can still edit anything below before creating the event.</Text></View>}

        <Field label="Event title" value={draft.title} onChangeText={(value) => setField('title', value)} />
        <Field label="Summary" value={draft.summary} onChangeText={(value) => setField('summary', value)} multiline />
        <View style={styles.row}>
          <View style={styles.flex}><Field label="Starts" value={draft.startsAt} onChangeText={(value) => setField('startsAt', value)} placeholder="YYYY-MM-DDTHH:MM" /></View>
          <View style={styles.flex}><Field label="Ends" value={draft.endsAt} onChangeText={(value) => setField('endsAt', value)} placeholder="YYYY-MM-DDTHH:MM" /></View>
        </View>
        <Field label="Venue" value={draft.venueName} onChangeText={(value) => setField('venueName', value)} />
        <Field label="Address" value={draft.address} onChangeText={(value) => setField('address', value)} />
        <View style={styles.row}>
          <View style={styles.flex}><Field label="City" value={draft.city} onChangeText={(value) => setField('city', value)} /></View>
          <View style={styles.state}><Field label="State" value={draft.state} onChangeText={(value) => setField('state', value.toUpperCase())} /></View>
        </View>
        <Field label="Capacity" value={draft.capacity == null ? '' : String(draft.capacity)} onChangeText={(value) => setField('capacity', value ? Number.parseInt(value, 10) || null : null)} keyboardType="number-pad" />

        <View style={styles.detailGrid}>
          <Detail value={draft.schedule.length} label="Schedule items" />
          <Detail value={draft.tickets.length} label="Ticket notes" />
          <Detail value={draft.meals.length} label="Meal notes" />
          <Detail value={draft.operations.length} label="Operations" />
        </View>

        {draft.confidenceNotes.length ? <View style={styles.reviewCard}><Text style={styles.reviewTitle}>Needs review</Text>{draft.confidenceNotes.slice(0, 5).map((note, index) => <Text key={`${note}-${index}`} style={styles.reviewItem}>• {note}</Text>)}</View> : null}

        <Pressable disabled={saving || Boolean(result.duplicate?.adventureId)} style={[styles.primary, (saving || Boolean(result.duplicate?.adventureId)) && styles.primaryDisabled]} onPress={() => void createEvent()}>
          {saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Create Reviewed Event</Text>}
        </Pressable>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Field({ label, value, onChangeText, multiline = false, placeholder = '', keyboardType = 'default' }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; placeholder?: string; keyboardType?: 'default' | 'number-pad' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} placeholder={placeholder} placeholderTextColor="#68746C" keyboardType={keyboardType} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function Detail({ value, label }: { value: number; label: string }) {
  return <View style={styles.detail}><Text style={styles.detailValue}>{value}</Text><Text style={styles.detailLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09100C' },
  content: { padding: 18, paddingBottom: 80 },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 31, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#98A49C', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 16 },
  loading: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  muted: { color: '#7F8B83', fontSize: 10 },
  error: { color: '#FF9D92', fontSize: 10, lineHeight: 15, marginVertical: 10 },
  sourceCard: { borderRadius: 16, borderWidth: 1, borderColor: '#304037', backgroundColor: '#121A15', padding: 14, marginBottom: 10 },
  sourceLabel: { color: '#78867D', fontSize: 8, fontWeight: '900', letterSpacing: .9 },
  sourceTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 3 },
  sourceMeta: { color: '#849087', fontSize: 9, marginTop: 3 },
  warningCard: { borderRadius: 14, borderWidth: 1, borderColor: '#765737', backgroundColor: '#241C12', padding: 13, marginBottom: 10 },
  warningTitle: { color: '#E9B46C', fontSize: 11, fontWeight: '900' },
  warningBody: { color: '#B6A07B', fontSize: 9, lineHeight: 14, marginTop: 4 },
  warningAction: { color: '#E9B46C', fontSize: 10, fontWeight: '900', marginTop: 8 },
  missingCard: { borderRadius: 14, borderWidth: 1, borderColor: '#6A4F2E', backgroundColor: '#211A11', padding: 13, marginBottom: 12 },
  missingTitle: { color: '#E8A05C', fontSize: 10, fontWeight: '900' },
  missingBody: { color: '#B89A75', fontSize: 9, lineHeight: 14, marginTop: 4 },
  readyCard: { borderRadius: 14, borderWidth: 1, borderColor: '#315C3C', backgroundColor: '#112017', padding: 13, marginBottom: 12 },
  readyTitle: { color: '#86D194', fontSize: 10, fontWeight: '900' },
  readyBody: { color: '#87A08D', fontSize: 9, lineHeight: 14, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  state: { width: 82 },
  field: { marginTop: 10 },
  fieldLabel: { color: '#8C9991', fontSize: 9, fontWeight: '800', marginBottom: 5 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#334139', backgroundColor: '#121A15', color: '#FFF8E8', paddingHorizontal: 12, fontSize: 11 },
  multiline: { minHeight: 82, paddingTop: 11, textAlignVertical: 'top' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  detail: { width: '48%', borderRadius: 12, borderWidth: 1, borderColor: '#2B3831', backgroundColor: '#111813', padding: 11 },
  detailValue: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  detailLabel: { color: '#7E8B83', fontSize: 8, marginTop: 2 },
  reviewCard: { borderRadius: 14, borderWidth: 1, borderColor: '#55472D', backgroundColor: '#1B1810', padding: 13, marginTop: 12 },
  reviewTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginBottom: 5 },
  reviewItem: { color: '#A99A74', fontSize: 9, lineHeight: 14, marginTop: 2 },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryDisabled: { opacity: .45 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
});
