import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEventFromDraft, previewHostImport, type EventDraft, type ImportPreviewResult } from '../../src/hosting/creation';

export default function ImportEventScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const fileMode = params.mode === 'files';
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [useText, setUseText] = useState(false);
  const [result, setResult] = useState<ImportPreviewResult | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sourceMode = fileMode ? (useText ? 'pasted_text' : 'file_url') : 'event_site';
  const counts = useMemo(() => draft ? { schedule: draft.schedule.length, tickets: draft.tickets.length, meals: draft.meals.length, policies: draft.policies.length, photos: draft.photos.length } : null, [draft]);

  async function analyze() {
    setLoading(true); setError('');
    try {
      const next = await previewHostImport({ mode: sourceMode, sourceUrl: sourceMode === 'pasted_text' ? undefined : sourceUrl, sourceText: sourceMode === 'pasted_text' ? sourceText : undefined });
      setResult(next); setDraft(next.preview);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to import this source.'); }
    finally { setLoading(false); }
  }

  function setField<K extends keyof EventDraft>(key: K, value: EventDraft[K]) { setDraft((current) => current ? { ...current, [key]: value } : current); }

  async function create() {
    if (!draft || !result) return;
    setSaving(true); setError('');
    try { const created = await createEventFromDraft(draft, { importId: result.importId }); router.replace(`/host/campaigns/${created.campaign.slug}` as never); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create this imported event.'); }
    finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Create Event</Text></Pressable>
    <Text style={styles.eyebrow}>{fileMode ? 'IMPORT FILES' : 'IMPORT EVENT SITE'}</Text>
    <Text style={styles.title}>{fileMode ? 'Bring your event materials.' : 'Paste the event page.'}</Text>
    <Text style={styles.subtitle}>{fileMode ? 'Use a public PDF, DOCX, TXT or ZIP package link, or paste the event details directly.' : 'Use a public Eventbrite, Meetup, ticketing, venue or organization event page.'}</Text>

    {!result ? <>
      {fileMode ? <View style={styles.toggle}><Pressable style={[styles.toggleButton, !useText && styles.toggleActive]} onPress={() => setUseText(false)}><Text style={[styles.toggleText, !useText && styles.toggleTextActive]}>File URL</Text></Pressable><Pressable style={[styles.toggleButton, useText && styles.toggleActive]} onPress={() => setUseText(true)}><Text style={[styles.toggleText, useText && styles.toggleTextActive]}>Paste details</Text></Pressable></View> : null}
      {sourceMode === 'pasted_text' ? <TextInput value={sourceText} onChangeText={setSourceText} multiline placeholder="Paste event description, schedule, ticket details, policies, meals, or notes…" placeholderTextColor="#69736D" style={[styles.input, styles.textArea]} /> : <TextInput value={sourceUrl} onChangeText={setSourceUrl} autoCapitalize="none" keyboardType="url" placeholder={fileMode ? 'https://…/event-package.pdf' : 'https://eventbrite.com/e/…'} placeholderTextColor="#69736D" style={styles.input} />}
      <View style={styles.ruleCard}><Text style={styles.ruleTitle}>Review before save</Text><Text style={styles.ruleText}>Dates, ticket prices, policies and public copy stay proposals until you approve the draft. The source is saved with the import record.</Text></View>
      {fileMode ? <Text style={styles.note}>V1 handles public file links and pasted details. Native on-device document selection needs Expo DocumentPicker added to the mobile dependency lockfile in a native build.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={loading} style={styles.primary} onPress={() => void analyze()}>{loading ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Analyze Source</Text>}</Pressable>
    </> : null}

    {result && draft && counts ? <>
      <View style={styles.sourceCard}><Text style={styles.kicker}>SOURCE</Text><Text style={styles.sourceTitle}>{result.sourceLabel}</Text><Text style={styles.sourceMeta}>{result.sourceUrl ?? 'Pasted details'} · {result.extractionSource === 'ai' ? 'Structured extraction' : 'Basic extraction'}</Text></View>
      {result.duplicate ? <View style={styles.duplicateCard}><Text style={styles.duplicateTitle}>This source was imported before</Text><Text style={styles.duplicateText}>{result.duplicate.adventureId ? 'An event was already created from this source. Review carefully before creating another copy.' : 'A previous import preview exists for this source.'}</Text>{result.duplicate.adventureId ? <Pressable onPress={() => router.push(`/host/manage/${result.duplicate?.adventureId}` as never)}><Text style={styles.duplicateAction}>Open existing event →</Text></Pressable> : null}</View> : null}
      <Text style={styles.section}>IMPORT PREVIEW</Text>
      <Field label="Title" value={draft.title} onChangeText={(value: string) => setField('title', value)} />
      <Field label="Summary" value={draft.summary} onChangeText={(value: string) => setField('summary', value)} />
      <Field label="Description" value={draft.description} onChangeText={(value: string) => setField('description', value)} multiline />
      <View style={styles.row}><View style={styles.flex}><Field label="Starts" value={draft.startsAt} onChangeText={(value: string) => setField('startsAt', value)} placeholder="YYYY-MM-DDTHH:MM" /></View><View style={styles.flex}><Field label="Ends" value={draft.endsAt} onChangeText={(value: string) => setField('endsAt', value)} placeholder="YYYY-MM-DDTHH:MM" /></View></View>
      <Field label="Venue" value={draft.venueName} onChangeText={(value: string) => setField('venueName', value)} />
      <Field label="Address" value={draft.address} onChangeText={(value: string) => setField('address', value)} />
      <View style={styles.row}><View style={styles.flex}><Field label="City" value={draft.city} onChangeText={(value: string) => setField('city', value)} /></View><View style={styles.state}><Field label="State" value={draft.state} onChangeText={(value: string) => setField('state', value.toUpperCase())} /></View></View>
      <Field label="Capacity" value={draft.capacity == null ? '' : String(draft.capacity)} onChangeText={(value: string) => setField('capacity', value ? Number.parseInt(value, 10) || null : null)} keyboardType="number-pad" />
      <View style={styles.countGrid}><Metric label="Schedule" value={counts.schedule} /><Metric label="Tickets" value={counts.tickets} /><Metric label="Meals" value={counts.meals} /><Metric label="Policies" value={counts.policies} /><Metric label="Media" value={counts.photos} /></View>
      {draft.tickets.length ? <PreviewList title="Ticket details found" items={draft.tickets.map((ticket) => `${ticket.label}${ticket.priceText ? ` · ${ticket.priceText}` : ''}`)} /> : null}
      {draft.schedule.length ? <PreviewList title="Schedule found" items={draft.schedule.map((item) => `${item.time}${item.time ? ' · ' : ''}${item.title}`)} /> : null}
      {draft.meals.length ? <PreviewList title="Meals found" items={draft.meals} /> : null}
      {draft.policies.length ? <PreviewList title="Policies found" items={draft.policies} /> : null}
      {draft.confidenceNotes.length ? <PreviewList title="Needs review" items={draft.confidenceNotes} /> : null}
      <View style={styles.warning}><Text style={styles.warningTitle}>Imported ticket details are reference only</Text><Text style={styles.warningText}>This creates a $0 General Admission shell. Review and configure actual ticket tiers and prices inside the event before publishing.</Text></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={saving} style={styles.primary} onPress={() => void create()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Create Reviewed Draft Event</Text>}</Pressable>
      <Pressable style={styles.secondary} onPress={() => { setResult(null); setDraft(null); }}><Text style={styles.secondaryText}>Start over</Text></Pressable>
    </> : null}
  </ScrollView></SafeAreaView>;
}

function Field({ label, multiline = false, ...props }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#69736D" style={[styles.input, multiline && styles.textArea]} textAlignVertical={multiline ? 'top' : 'center'} /></View>; }
function Metric({ label, value }: { label: string; value: number }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function PreviewList({ title, items }: { title: string; items: string[] }) { return <View style={styles.previewCard}><Text style={styles.previewTitle}>{title}</Text>{items.slice(0, 8).map((item, index) => <Text key={`${title}-${index}`} style={styles.previewLine}>• {item}</Text>)}</View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 70 }, back: { color: '#C8D1CB', fontSize: 12, fontWeight: '900', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 18 }, toggle: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, borderColor: '#344039', overflow: 'hidden', marginBottom: 14 }, toggleButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, toggleActive: { backgroundColor: '#443616' }, toggleText: { color: '#8F9A93', fontSize: 11, fontWeight: '900' }, toggleTextActive: { color: '#E7C464' }, input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', color: '#FFF8E8', paddingHorizontal: 12, fontSize: 13 }, textArea: { minHeight: 120, paddingTop: 12 }, ruleCard: { borderRadius: 14, borderWidth: 1, borderColor: '#4B3F20', backgroundColor: '#1C1910', padding: 13, marginTop: 14 }, ruleTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, ruleText: { color: '#9F967F', fontSize: 10.5, lineHeight: 16, marginTop: 4 }, note: { color: '#78837C', fontSize: 10, lineHeight: 16, marginTop: 12 }, error: { color: '#FF8A80', fontSize: 11, lineHeight: 17, marginTop: 14 }, primary: { minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primaryText: { color: '#172017', fontSize: 14, fontWeight: '900' }, sourceCard: { borderRadius: 16, borderWidth: 1, borderColor: '#5A4D26', backgroundColor: '#1B1810', padding: 15 }, kicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 }, sourceTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 5 }, sourceMeta: { color: '#887F69', fontSize: 9.5, marginTop: 4 }, duplicateCard: { borderRadius: 14, borderWidth: 1, borderColor: '#735B28', backgroundColor: '#241C0F', padding: 13, marginTop: 10 }, duplicateTitle: { color: '#F0D47B', fontSize: 12, fontWeight: '900' }, duplicateText: { color: '#BBAA7D', fontSize: 10.5, lineHeight: 16, marginTop: 4 }, duplicateAction: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginTop: 8 }, section: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .9, marginTop: 22 }, field: { marginTop: 13 }, label: { color: '#D5DBD7', fontSize: 11, fontWeight: '800', marginBottom: 6 }, row: { flexDirection: 'row', gap: 10 }, flex: { flex: 1 }, state: { width: 90 }, countGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }, metric: { minWidth: '30%', flexGrow: 1, borderRadius: 13, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 11 }, metricValue: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, metricLabel: { color: '#7F8A83', fontSize: 9, marginTop: 2 }, previewCard: { borderRadius: 14, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 13, marginTop: 10 }, previewTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', marginBottom: 6 }, previewLine: { color: '#9AA49E', fontSize: 10.5, lineHeight: 16, marginBottom: 2 }, warning: { borderRadius: 14, borderWidth: 1, borderColor: '#684139', backgroundColor: '#211715', padding: 13, marginTop: 14 }, warningTitle: { color: '#F0C1B9', fontSize: 11, fontWeight: '900' }, warningText: { color: '#B3918B', fontSize: 10, lineHeight: 15, marginTop: 4 }, secondary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, secondaryText: { color: '#C3CBC6', fontSize: 11, fontWeight: '900' } });