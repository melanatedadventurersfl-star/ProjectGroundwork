import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCampaignForAdventure } from '../../../src/hosting/eventBuilder';
import { getEventVenue, updateEventVenue, type EventVenue } from '../../../src/hosting/eventVenue';
import { supabase } from '../../../src/lib/supabase';

type VenueTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_label: string;
  target_focus: string | null;
};

const bookingStatuses = ['researching','contacted','hold','contract_pending','confirmed'] as const;
const contractStatuses = ['not_started','requested','reviewing','signed','not_required'] as const;

function cents(value: string) {
  const amount = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}
function dollars(value: number | null) {
  return value == null ? '' : (value / 100).toFixed(2);
}
function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : '';
}
function dateIso(value: string) {
  if (!value.trim()) return null;
  const date = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function EventVenueWorkspaceScreen() {
  const { id, focus, taskId } = useLocalSearchParams<{ id: string; focus?: string; taskId?: string }>();
  const [venue, setVenue] = useState<EventVenue | null>(null);
  const [tasks, setTasks] = useState<VenueTask[]>([]);
  const [campaignTitle, setCampaignTitle] = useState('Event');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [bookingStatus, setBookingStatus] = useState('researching');
  const [contractStatus, setContractStatus] = useState('not_started');
  const [deposit, setDeposit] = useState('');
  const [depositDue, setDepositDue] = useState('');
  const [balance, setBalance] = useState('');
  const [balanceDue, setBalanceDue] = useState('');
  const [parking, setParking] = useState('');
  const [power, setPower] = useState('');
  const [accessibility, setAccessibility] = useState('');
  const [loadIn, setLoadIn] = useState('');
  const [restrooms, setRestrooms] = useState('');
  const [wifi, setWifi] = useState('');
  const [arrival, setArrival] = useState('');

  const hydrate = useCallback((next: EventVenue) => {
    setVenue(next);
    setContactName(next.contactName);
    setContactEmail(next.contactEmail);
    setContactPhone(next.contactPhone);
    setBookingStatus(next.bookingStatus);
    setContractStatus(next.contractStatus);
    setDeposit(dollars(next.depositAmountCents));
    setDepositDue(dateOnly(next.depositDueAt));
    setBalance(dollars(next.balanceAmountCents));
    setBalanceDue(dateOnly(next.balanceDueAt));
    setParking(next.parkingNotes);
    setPower(next.powerNotes);
    setAccessibility(next.accessibilityNotes);
    setLoadIn(next.loadInNotes);
    setRestrooms(next.restroomNotes);
    setWifi(next.wifiNotes);
    setArrival(next.arrivalNotes);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [nextVenue, campaign] = await Promise.all([getEventVenue(id), getCampaignForAdventure(id)]);
      if (nextVenue) hydrate(nextVenue);
      else setVenue(null);
      if (campaign) {
        setCampaignTitle(campaign.title || 'Event');
        const { data, error: taskError } = await supabase
          .from('host_campaign_tasks')
          .select('id,title,status,priority,due_label,target_focus')
          .eq('campaign_id', campaign.id)
          .eq('target_component', 'venue')
          .order('due_at', { ascending: true, nullsFirst: false });
        if (taskError) throw taskError;
        setTasks((data ?? []) as VenueTask[]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load venue workspace.');
    } finally {
      setLoading(false);
    }
  }, [hydrate, id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (!id || !venue) return;
    setSaving(true);
    setSaved('');
    setError('');
    try {
      const next = await updateEventVenue(id, {
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        booking_status: bookingStatus,
        contract_status: contractStatus,
        deposit_amount_cents: cents(deposit),
        deposit_due_at: dateIso(depositDue),
        balance_amount_cents: cents(balance),
        balance_due_at: dateIso(balanceDue),
        parking_notes: parking.trim() || null,
        power_notes: power.trim() || null,
        accessibility_notes: accessibility.trim() || null,
        load_in_notes: loadIn.trim() || null,
        restroom_notes: restrooms.trim() || null,
        wifi_notes: wifi.trim() || null,
        arrival_notes: arrival.trim() || null,
      });
      hydrate(next);
      setSaved('Venue details saved');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save venue details.');
    } finally {
      setSaving(false);
    }
  }

  async function chooseContract() {
    if (!id || !venue || uploading) return;
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const profileId = sessionData.session?.user.id;
      if (!profileId) throw new Error('You must be signed in.');
      const fileResponse = await fetch(asset.uri);
      if (!fileResponse.ok) throw new Error('Unable to read the selected contract file.');
      const bytes = await fileResponse.arrayBuffer();
      const safeName = (asset.name || `venue-contract-${Date.now()}`).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
      const path = `${profileId}/venue-docs/${id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('event-media').upload(path, bytes, {
        contentType: asset.mimeType || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('event-media').getPublicUrl(path);
      const next = await updateEventVenue(id, { contract_document_url: publicUrl.publicUrl, contract_status: 'reviewing' });
      hydrate(next);
      setSaved('Contract uploaded');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload contract.');
    } finally {
      setUploading(false);
    }
  }

  async function toggleTask(task: VenueTask) {
    const nextStatus = task.status === 'complete' ? 'not_started' : 'complete';
    const { error: updateError } = await supabase.from('host_campaign_tasks').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', task.id);
    if (updateError) { setError(updateError.message); return; }
    await load();
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Opening venue…</Text></View></SafeAreaView>;
  if (!venue) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Venue not connected yet</Text><Text style={styles.muted}>Choose the event venue from Google Places or enter a custom location first.</Text><Pressable style={styles.primary} onPress={() => router.replace(`/host/edit/${id}` as never)}><Text style={styles.primaryText}>Edit event location</Text></Pressable></View></SafeAreaView>;

  const bookingFocused = focus === 'booking' || taskId === tasks.find((task) => task.target_focus === 'booking')?.id;
  const logisticsFocused = focus === 'logistics' || taskId === tasks.find((task) => task.target_focus === 'logistics')?.id;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ {campaignTitle}</Text></Pressable>

      <View style={styles.heroCard}>
        {venue.photoUrl ? <Image source={{ uri: venue.photoUrl }} style={styles.heroImage} /> : <View style={styles.heroFallback}><Text style={styles.heroFallbackText}>⌖</Text></View>}
        <View style={styles.heroBody}>
          <View style={styles.sourceRow}><Text style={venue.provider === 'google_places' ? styles.googleBadge : styles.sourceBadge}>{venue.provider === 'google_places' ? '✓ Google Places' : venue.provider.replace(/_/g, ' ')}</Text>{venue.rating ? <Text style={styles.rating}>★ {venue.rating.toFixed(1)}{venue.ratingCount ? ` (${venue.ratingCount})` : ''}</Text> : null}</View>
          <Text style={styles.title}>{venue.venueName}</Text>
          <Text style={styles.address}>{[venue.address, [venue.city, venue.state, venue.postalCode].filter(Boolean).join(' ')].filter(Boolean).join('\n')}</Text>
          <View style={styles.linkRow}>{venue.googleMapsUrl ? <Pressable style={styles.linkButton} onPress={() => void Linking.openURL(venue.googleMapsUrl as string)}><Text style={styles.linkText}>Google Maps</Text></Pressable> : null}{venue.websiteUrl ? <Pressable style={styles.linkButton} onPress={() => void Linking.openURL(venue.websiteUrl as string)}><Text style={styles.linkText}>Website</Text></Pressable> : null}<Pressable style={styles.linkButton} onPress={() => router.push(`/host/edit/${id}` as never)}><Text style={styles.linkText}>Change venue</Text></Pressable></View>
        </View>
      </View>

      <View style={[styles.section, bookingFocused && styles.focused]}>
        <Text style={styles.eyebrow}>BOOKING</Text><Text style={styles.sectionTitle}>Contract, deposits and contact</Text>
        <Text style={styles.label}>Booking status</Text><View style={styles.chips}>{bookingStatuses.map((status) => <Chip key={status} label={status.replace(/_/g, ' ')} active={bookingStatus === status} onPress={() => setBookingStatus(status)} />)}</View>
        <Text style={styles.label}>Contract status</Text><View style={styles.chips}>{contractStatuses.map((status) => <Chip key={status} label={status.replace(/_/g, ' ')} active={contractStatus === status} onPress={() => setContractStatus(status)} />)}</View>
        <View style={styles.row}><Field label="Venue contact" value={contactName} onChangeText={setContactName} /><Field label="Phone" value={contactPhone} onChangeText={setContactPhone} /></View>
        <Field label="Email" value={contactEmail} onChangeText={setContactEmail} autoCapitalize="none" keyboardType="email-address" />
        <View style={styles.row}><Field label="Deposit amount" value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" placeholder="0.00" /><Field label="Deposit due" value={depositDue} onChangeText={setDepositDue} placeholder="YYYY-MM-DD" /></View>
        <View style={styles.row}><Field label="Balance amount" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="0.00" /><Field label="Balance due" value={balanceDue} onChangeText={setBalanceDue} placeholder="YYYY-MM-DD" /></View>
      </View>

      <View style={[styles.section, focus === 'documents' && styles.focused]}>
        <Text style={styles.eyebrow}>DOCUMENTS</Text><Text style={styles.sectionTitle}>Venue contract</Text>
        {venue.contractDocumentUrl ? <Pressable style={styles.documentCard} onPress={() => void Linking.openURL(venue.contractDocumentUrl)}><View><Text style={styles.documentTitle}>Venue contract</Text><Text style={styles.documentMeta}>Open uploaded contract</Text></View><Text style={styles.chevron}>›</Text></Pressable> : <Text style={styles.sectionCopy}>No venue contract uploaded yet.</Text>}
        <Pressable disabled={uploading} style={styles.secondary} onPress={() => void chooseContract()}>{uploading ? <ActivityIndicator color="#D7B45A" /> : <Text style={styles.secondaryText}>{venue.contractDocumentUrl ? 'Replace contract' : 'Upload contract'}</Text>}</Pressable>
      </View>

      <View style={[styles.section, logisticsFocused && styles.focused]}>
        <Text style={styles.eyebrow}>LOGISTICS</Text><Text style={styles.sectionTitle}>Event-day venue details</Text>
        <Field label="Parking" value={parking} onChangeText={setParking} multiline />
        <Field label="Power" value={power} onChangeText={setPower} multiline />
        <Field label="Accessibility" value={accessibility} onChangeText={setAccessibility} multiline />
        <Field label="Load-in and access" value={loadIn} onChangeText={setLoadIn} multiline />
        <Field label="Restrooms" value={restrooms} onChangeText={setRestrooms} multiline />
        <Field label="Wi-Fi" value={wifi} onChangeText={setWifi} multiline />
        <Field label="Arrival instructions" value={arrival} onChangeText={setArrival} multiline />
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>VENUE TASKS</Text><Text style={styles.sectionTitle}>Work that belongs here</Text>
        {tasks.length ? tasks.map((task) => <Pressable key={task.id} style={[styles.task, task.id === taskId && styles.taskFocused]} onPress={() => void toggleTask(task)}><View style={[styles.taskCheck, task.status === 'complete' && styles.taskCheckDone]}><Text style={styles.taskCheckText}>{task.status === 'complete' ? '✓' : ''}</Text></View><View style={styles.flex}><Text style={[styles.taskTitle, task.status === 'complete' && styles.taskDone]}>{task.title}</Text><Text style={styles.taskMeta}>{task.due_label} · {task.priority}</Text></View><Text style={styles.taskAction}>{task.status === 'complete' ? 'Reopen' : 'Complete'}</Text></Pressable>) : <Text style={styles.sectionCopy}>No venue tasks are connected to this event.</Text>}
      </View>

      {saved ? <Text style={styles.saved}>{saved}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={saving} style={styles.primary} onPress={() => void save()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Save venue details</Text>}</Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function Field({ label, multiline = false, ...props }: React.ComponentProps<typeof TextInput> & { label: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor="#657168" style={[styles.input, multiline && styles.multiline]} /></View>;
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 80, maxWidth: 760, width: '100%', alignSelf: 'center' }, center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 },
  back: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900', marginBottom: 12 }, muted: { color: '#849188', fontSize: 10, textAlign: 'center' }, flex: { flex: 1 },
  heroCard: { borderRadius: 20, borderWidth: 1, borderColor: '#2D3A32', backgroundColor: '#121914', overflow: 'hidden' }, heroImage: { width: '100%', height: 210, backgroundColor: '#18221C' }, heroFallback: { height: 130, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172019' }, heroFallbackText: { color: '#D7B45A', fontSize: 28 }, heroBody: { padding: 15 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }, googleBadge: { color: '#9CC9FF', backgroundColor: '#132033', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, fontSize: 7.5, fontWeight: '900' }, sourceBadge: { color: '#B4BEB8', backgroundColor: '#1B2420', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, fontSize: 7.5, fontWeight: '900', textTransform: 'capitalize' }, rating: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900' },
  title: { color: '#FFF8E8', fontSize: 26, lineHeight: 31, fontWeight: '900', marginTop: 7 }, address: { color: '#929F97', fontSize: 9.5, lineHeight: 15, marginTop: 5 }, linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }, linkButton: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: '#38463E', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }, linkText: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900' },
  section: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111814', padding: 13 }, focused: { borderColor: '#D7B45A', borderWidth: 2 }, eyebrow: { color: '#D7B45A', fontSize: 7.5, fontWeight: '900', letterSpacing: 1 }, sectionTitle: { color: '#F3F0E7', fontSize: 15, fontWeight: '900', marginTop: 3 }, sectionCopy: { color: '#7F8B83', fontSize: 9, lineHeight: 14, marginTop: 6 },
  label: { color: '#BFC7C2', fontSize: 9, fontWeight: '900', marginTop: 10, marginBottom: 5 }, row: { flexDirection: 'row', gap: 8 }, field: { flex: 1 }, input: { minHeight: 43, borderRadius: 11, borderWidth: 1, borderColor: '#344139', backgroundColor: '#0D1410', color: '#FFF8E8', paddingHorizontal: 10, fontSize: 12 }, multiline: { minHeight: 82, paddingTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, chip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#35423A', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' }, chipActive: { backgroundColor: '#352D16', borderColor: '#806A2C' }, chipText: { color: '#8E9A92', fontSize: 8.5, fontWeight: '800', textTransform: 'capitalize' }, chipTextActive: { color: '#E7C867' },
  documentCard: { minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: '#344139', backgroundColor: '#0D1410', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11, marginTop: 9 }, documentTitle: { color: '#E8EDEA', fontSize: 10, fontWeight: '900' }, documentMeta: { color: '#7E8A82', fontSize: 8, marginTop: 2 }, chevron: { color: '#D7B45A', fontSize: 20 }, secondary: { minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 8 }, secondaryText: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  task: { minHeight: 62, borderRadius: 12, borderWidth: 1, borderColor: '#2F3B34', backgroundColor: '#0D1410', padding: 10, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 9 }, taskFocused: { borderColor: '#D7B45A' }, taskCheck: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: '#5B5946', alignItems: 'center', justifyContent: 'center' }, taskCheckDone: { backgroundColor: '#1E3826', borderColor: '#5E8A68' }, taskCheckText: { color: '#9CD2A7', fontSize: 10, fontWeight: '900' }, taskTitle: { color: '#E5EAE7', fontSize: 10, fontWeight: '900' }, taskDone: { textDecorationLine: 'line-through', color: '#7D8981' }, taskMeta: { color: '#758178', fontSize: 8, marginTop: 2 }, taskAction: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  primary: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#172017', fontSize: 10, fontWeight: '900' }, saved: { color: '#8FD09E', fontSize: 9, fontWeight: '800', marginTop: 10 }, error: { color: '#FF9D93', fontSize: 9, lineHeight: 14, marginTop: 10 },
});
