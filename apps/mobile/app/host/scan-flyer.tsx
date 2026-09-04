import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEventFromDraft, type EventDraft, type ImportPreviewResult } from '../../src/hosting/creation';
import { uploadAndPreviewFlyer, type FlyerAsset } from '../../src/hosting/flyerImport';

export default function ScanFlyerScreen() {
  const [asset, setAsset] = useState<FlyerAsset | null>(null);
  const [result, setResult] = useState<ImportPreviewResult | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function choosePhoto(camera: boolean) {
    setError('');
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(camera ? 'Camera permission is required to photograph a flyer.' : 'Photo access is required to choose a flyer.');
      return;
    }
    const picked = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, selectionLimit: 1 });
    if (picked.canceled || !picked.assets[0]) return;
    const image = picked.assets[0];
    setAsset({ uri: image.uri, fileName: image.fileName, mimeType: image.mimeType, fileSize: image.fileSize });
    setResult(null);
    setDraft(null);
  }

  async function analyze() {
    if (!asset) return;
    setLoading(true);
    setError('');
    try {
      const next = await uploadAndPreviewFlyer(asset);
      setResult(next);
      setDraft(next.preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read this flyer.');
    } finally {
      setLoading(false);
    }
  }

  function setField<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!draft || !result) return;
    setSaving(true);
    setError('');
    try {
      const created = await createEventFromDraft(draft, { importId: result.importId });
      router.replace(`/host/campaigns/${created.campaign.slug}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this event draft.');
    } finally {
      setSaving(false);
    }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Create Event</Text></Pressable>
    <Text style={styles.eyebrow}>SCAN FLYER OR POSTER</Text>
    <Text style={styles.title}>Turn the flyer into a draft.</Text>
    <Text style={styles.subtitle}>Take a photo or choose a screenshot. Go Melanated reads the visible event details, flags uncertain fields, and lets you correct everything before creating the event.</Text>

    {!draft ? <>
      {asset ? <View style={styles.previewCard}><Image source={{ uri: asset.uri }} style={styles.flyer} resizeMode="contain" /><Text style={styles.fileName}>{asset.fileName || 'Event flyer'}</Text></View> : <View style={styles.emptyCard}><Text style={styles.emptyIcon}>▧</Text><Text style={styles.emptyTitle}>Add a flyer</Text><Text style={styles.emptyText}>Use a clear, straight-on image. JPG, PNG, and WebP are supported.</Text></View>}

      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={() => void choosePhoto(true)}><Text style={styles.secondaryText}>Take Photo</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => void choosePhoto(false)}><Text style={styles.secondaryText}>Choose Flyer</Text></Pressable>
      </View>

      <View style={styles.ruleCard}><Text style={styles.ruleTitle}>Nothing publishes automatically</Text><Text style={styles.ruleText}>Dates, prices, URLs, addresses, and other details stay editable. Missing or uncertain information is marked for review instead of guessed.</Text></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!asset || loading} style={[styles.primary, (!asset || loading) && styles.disabled]} onPress={() => void analyze()}>{loading ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Read Flyer & Build Draft</Text>}</Pressable>
    </> : <>
      <View style={styles.foundCard}><Text style={styles.foundEyebrow}>FLYER READ COMPLETE</Text><Text style={styles.foundTitle}>{draft.title || 'Event details found'}</Text><Text style={styles.foundText}>Review each field before creating the draft.</Text></View>

      <Field label="Event name" value={draft.title} onChangeText={(value) => setField('title', value)} />
      <Field label="Summary" value={draft.summary} onChangeText={(value) => setField('summary', value)} multiline />
      <View style={styles.row}><View style={styles.flex}><Field label="Starts" value={draft.startsAt} onChangeText={(value) => setField('startsAt', value)} placeholder="YYYY-MM-DDTHH:MM" /></View><View style={styles.flex}><Field label="Ends" value={draft.endsAt} onChangeText={(value) => setField('endsAt', value)} placeholder="YYYY-MM-DDTHH:MM" /></View></View>
      <Field label="Venue" value={draft.venueName} onChangeText={(value) => setField('venueName', value)} />
      <Field label="Address" value={draft.address} onChangeText={(value) => setField('address', value)} />
      <View style={styles.row}><View style={styles.flex}><Field label="City" value={draft.city} onChangeText={(value) => setField('city', value)} /></View><View style={styles.state}><Field label="State" value={draft.state} onChangeText={(value) => setField('state', value.toUpperCase())} /></View></View>
      <Field label="Arrival / parking / check-in" value={draft.meetingInstructions} onChangeText={(value) => setField('meetingInstructions', value)} multiline />

      {draft.tickets.length ? <List title="Ticket details found" items={draft.tickets.map((ticket) => `${ticket.label}${ticket.priceText ? ` · ${ticket.priceText}` : ''}`)} /> : null}
      {draft.guestInfo.length ? <List title="Guest information found" items={draft.guestInfo} /> : null}
      {draft.marketing.length ? <List title="Links and contact details" items={draft.marketing} /> : null}
      {draft.confidenceNotes.length ? <List title="Needs review" items={draft.confidenceNotes} warning /> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={saving || !draft.title || !draft.startsAt || !draft.city || !draft.state} style={[styles.primary, (saving || !draft.title || !draft.startsAt || !draft.city || !draft.state) && styles.disabled]} onPress={() => void save()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Create Reviewed Draft Event</Text>}</Pressable>
      <Pressable style={styles.secondaryWide} onPress={() => { setDraft(null); setResult(null); }}><Text style={styles.secondaryText}>Scan another flyer</Text></Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#657169" multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function List({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return <View style={[styles.listCard, warning && styles.warningCard]}><Text style={styles.listTitle}>{title}</Text>{items.map((item, index) => <Text key={`${title}-${index}`} style={styles.listItem}>• {item}</Text>)}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 70 }, back: { color: '#D7B45A', fontSize: 12, fontWeight: '900', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 32, lineHeight: 38, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 12, lineHeight: 19, marginTop: 7, marginBottom: 18 }, emptyCard: { minHeight: 220, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#4A574F', backgroundColor: '#121814', alignItems: 'center', justifyContent: 'center', padding: 24 }, emptyIcon: { color: '#D7B45A', fontSize: 40 }, emptyTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 8 }, emptyText: { color: '#8E9992', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 }, previewCard: { borderRadius: 18, borderWidth: 1, borderColor: '#37433B', backgroundColor: '#121814', padding: 10 }, flyer: { width: '100%', height: 320, borderRadius: 12 }, fileName: { color: '#A6B0A9', fontSize: 10, marginTop: 8 }, actions: { flexDirection: 'row', gap: 10, marginTop: 12 }, secondary: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#4A574F', alignItems: 'center', justifyContent: 'center', backgroundColor: '#151B17' }, secondaryWide: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#4A574F', alignItems: 'center', justifyContent: 'center', backgroundColor: '#151B17', marginTop: 10 }, secondaryText: { color: '#D9E0DB', fontSize: 11, fontWeight: '900' }, ruleCard: { borderRadius: 15, backgroundColor: '#181B15', borderWidth: 1, borderColor: '#4C4327', padding: 13, marginTop: 14 }, ruleTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, ruleText: { color: '#A59D82', fontSize: 10, lineHeight: 15, marginTop: 4 }, primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.4 }, error: { color: '#FF9D92', fontSize: 11, lineHeight: 16, marginTop: 10 }, foundCard: { borderRadius: 16, borderWidth: 1, borderColor: '#6A5725', backgroundColor: '#1D1B11', padding: 14, marginBottom: 15 }, foundEyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, foundTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 4 }, foundText: { color: '#A7A08A', fontSize: 10, marginTop: 4 }, field: { marginTop: 11 }, label: { color: '#AEB8B1', fontSize: 9, fontWeight: '900', marginBottom: 5 }, input: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#364239', backgroundColor: '#121814', color: '#FFF8E8', fontSize: 11, paddingHorizontal: 11, paddingVertical: 9 }, multiline: { minHeight: 82, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 10 }, flex: { flex: 1 }, state: { width: 88 }, listCard: { borderRadius: 14, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', padding: 12, marginTop: 12 }, warningCard: { borderColor: '#6B5522', backgroundColor: '#1D1A11' }, listTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', marginBottom: 5 }, listItem: { color: '#AAB4AD', fontSize: 10, lineHeight: 16, marginTop: 2 },
});
