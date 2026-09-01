import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEventFromDraft, draftFromTemplate, type EventDraft } from '../../src/hosting/creation';
import { listHostLibraryItems, type HostLibraryItem } from '../../src/hosting/library';

export default function CreateFromTemplateScreen() {
  const [templates, setTemplates] = useState<HostLibraryItem[]>([]);
  const [selected, setSelected] = useState<HostLibraryItem | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => { setLoading(true); setError(''); try { setTemplates(await listHostLibraryItems('template')); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load templates.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const taskCount = useMemo(() => selected && Array.isArray(selected.content.tasks) ? selected.content.tasks.length : 0, [selected]);
  const milestoneCount = useMemo(() => selected && Array.isArray(selected.content.default_milestones) ? selected.content.default_milestones.length : 0, [selected]);

  function choose(template: HostLibraryItem) { setSelected(template); setDraft(draftFromTemplate(template)); setError(''); }
  function setField<K extends keyof EventDraft>(key: K, value: EventDraft[K]) { setDraft((current) => current ? { ...current, [key]: value } : current); }

  async function create() {
    if (!draft || !selected) return;
    setSaving(true); setError('');
    try { const result = await createEventFromDraft(draft, { template: selected }); router.replace(`/host/campaigns/${result.campaign.slug}` as never); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create this event.'); }
    finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Create Event</Text></Pressable>
    <Text style={styles.eyebrow}>START FROM TEMPLATE</Text><Text style={styles.title}>Pick the structure.</Text><Text style={styles.subtitle}>The template brings the reusable work. You supply the new event details.</Text>
    {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading templates…</Text></View> : null}
    {!loading && !selected ? templates.map((template) => <Pressable key={template.id} style={styles.templateCard} onPress={() => choose(template)}><Text style={styles.kicker}>{template.scope === 'personal' ? 'MY TEMPLATE' : 'GO MELANATED'}</Text><Text style={styles.cardTitle}>{template.title}</Text><Text style={styles.cardBody}>{template.summary}</Text><Text style={styles.meta}>{Array.isArray(template.content.default_milestones) ? template.content.default_milestones.length : 0} milestones · {Array.isArray(template.content.tasks) ? template.content.tasks.length : 0} tasks</Text></Pressable>) : null}
    {selected && draft ? <>
      <Pressable style={styles.change} onPress={() => { setSelected(null); setDraft(null); }}><Text style={styles.changeText}>Change template</Text></Pressable>
      <View style={styles.summaryCard}><Text style={styles.kicker}>TEMPLATE</Text><Text style={styles.cardTitle}>{selected.title}</Text><Text style={styles.meta}>{milestoneCount} milestones · {taskCount} tasks · statuses reset to Not Started</Text></View>
      <Field label="Event title" value={draft.title} onChangeText={(value: string) => setField('title', value)} placeholder="Weekend camping adventure" />
      <View style={styles.row}><View style={styles.flex}><Field label="Starts" value={draft.startsAt} onChangeText={(value: string) => setField('startsAt', value)} placeholder="2026-10-30T15:00" /></View><View style={styles.flex}><Field label="Ends" value={draft.endsAt} onChangeText={(value: string) => setField('endsAt', value)} placeholder="2026-11-01T11:00" /></View></View>
      <Field label="Venue" value={draft.venueName} onChangeText={(value: string) => setField('venueName', value)} placeholder="Campground or meeting place" />
      <View style={styles.row}><View style={styles.flex}><Field label="City" value={draft.city} onChangeText={(value: string) => setField('city', value)} placeholder="Brooksville" /></View><View style={styles.state}><Field label="State" value={draft.state} onChangeText={(value: string) => setField('state', value.toUpperCase())} placeholder="FL" /></View></View>
      <Field label="Capacity" value={draft.capacity == null ? '' : String(draft.capacity)} onChangeText={(value: string) => setField('capacity', value ? Number.parseInt(value, 10) || null : null)} placeholder="20" keyboardType="number-pad" />
      <Text style={styles.review}>Review before create: dates, location, capacity, pricing and guest-facing details are never inherited as decided facts.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={saving} style={styles.primary} onPress={() => void create()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Create Draft from Template</Text>}</Pressable>
    </> : null}
    {!selected && error ? <Text style={styles.error}>{error}</Text> : null}
  </ScrollView></SafeAreaView>;
}

function Field({ label, ...props }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#69736D" style={styles.input} /></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 70 }, back: { color: '#C8D1CB', fontSize: 12, fontWeight: '900', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 18 }, loading: { alignItems: 'center', gap: 8, paddingVertical: 28 }, muted: { color: '#7E8982', fontSize: 11 }, templateCard: { borderRadius: 17, borderWidth: 1, borderColor: '#334039', backgroundColor: '#151B17', padding: 15, marginBottom: 10 }, summaryCard: { borderRadius: 16, borderWidth: 1, borderColor: '#5A4D26', backgroundColor: '#1B1810', padding: 15, marginTop: 10 }, kicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 }, cardTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 5 }, cardBody: { color: '#929D96', fontSize: 11, lineHeight: 17, marginTop: 5 }, meta: { color: '#7F8A83', fontSize: 10, marginTop: 8 }, change: { alignSelf: 'flex-start' }, changeText: { color: '#D7B45A', fontSize: 11, fontWeight: '900' }, field: { marginTop: 14 }, label: { color: '#D5DBD7', fontSize: 11, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', color: '#FFF8E8', paddingHorizontal: 12 }, row: { flexDirection: 'row', gap: 10 }, flex: { flex: 1 }, state: { width: 90 }, review: { color: '#8D9891', fontSize: 10.5, lineHeight: 16, marginTop: 18 }, error: { color: '#FF8A80', fontSize: 11, lineHeight: 17, marginTop: 14 }, primary: { minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 20 }, primaryText: { color: '#172017', fontSize: 14, fontWeight: '900' } });