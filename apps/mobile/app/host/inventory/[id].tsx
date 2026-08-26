import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addHostAddon, listHostAddons, setHostAddonActive, updateHostAddon, type HostAddon } from '../../../src/hosting/addons';
import { addHostTicketType, listHostTicketTypes, setHostTicketActive, updateHostTicketType, type HostTicketType } from '../../../src/hosting/tickets';

type InventoryMode = 'ticket' | 'addon';

export default function HostInventoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mode, setMode] = useState<InventoryMode>('ticket');
  const [tickets, setTickets] = useState<HostTicketType[]>([]);
  const [addons, setAddons] = useState<HostAddon[]>([]);
  const [editingTicket, setEditingTicket] = useState<HostTicketType | null>(null);
  const [editingAddon, setEditingAddon] = useState<HostAddon | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [capacity, setCapacity] = useState('');
  const [maxPerOrder, setMaxPerOrder] = useState('10');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    if (!id) return;
    setError('');
    try {
      const [ticketRows, addonRows] = await Promise.all([listHostTicketTypes(id), listHostAddons(id)]);
      setTickets(ticketRows);
      setAddons(addonRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [id]);

  function resetForm(nextMode = mode) {
    setMode(nextMode);
    setEditingTicket(null);
    setEditingAddon(null);
    setName('');
    setDescription('');
    setPrice('0');
    setCapacity('');
    setMaxPerOrder('10');
    setError('');
  }

  function editTicket(ticket: HostTicketType) {
    setMode('ticket');
    setEditingTicket(ticket);
    setEditingAddon(null);
    setName(ticket.name);
    setDescription(ticket.description ?? '');
    setPrice((ticket.price_cents / 100).toFixed(2));
    setCapacity(ticket.capacity == null ? '' : String(ticket.capacity));
    setMaxPerOrder(String(ticket.max_per_order));
  }

  function editAddon(addon: HostAddon) {
    setMode('addon');
    setEditingAddon(addon);
    setEditingTicket(null);
    setName(addon.name);
    setDescription(addon.description ?? '');
    setPrice((addon.price_cents / 100).toFixed(2));
    setCapacity(addon.capacity == null ? '' : String(addon.capacity));
    setMaxPerOrder(String(addon.max_per_order));
  }

  function parsedValues() {
    const dollars = Number.parseFloat(price || '0');
    const parsedCapacity = capacity.trim() ? Number.parseInt(capacity, 10) : null;
    const parsedMax = Number.parseInt(maxPerOrder || '10', 10);
    if (!Number.isFinite(dollars) || dollars < 0) throw new Error('Enter a valid price.');
    if (capacity.trim() && (!Number.isFinite(parsedCapacity) || parsedCapacity == null || parsedCapacity < 0)) throw new Error('Enter a valid capacity.');
    if (!Number.isFinite(parsedMax) || parsedMax < 1) throw new Error('Max per order must be at least 1.');
    return { priceCents: Math.round(dollars * 100), parsedCapacity, parsedMax };
  }

  async function save() {
    if (!id) return;
    setWorking(true);
    setError('');
    try {
      const { priceCents, parsedCapacity, parsedMax } = parsedValues();
      if (mode === 'ticket') {
        const input = { name, description, priceCents, capacity: parsedCapacity, minPerOrder: 1, maxPerOrder: parsedMax };
        if (editingTicket) await updateHostTicketType(id, editingTicket.id, input);
        else await addHostTicketType(id, input);
      } else {
        const input = { name, description, priceCents, capacity: parsedCapacity, maxPerOrder: parsedMax };
        if (editingAddon) await updateHostAddon(id, editingAddon.id, input);
        else await addHostAddon(id, input);
      }
      await refresh();
      resetForm(mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save inventory.');
    } finally {
      setWorking(false);
    }
  }

  async function toggleTicket(ticket: HostTicketType) {
    if (!id) return;
    setWorking(true);
    try {
      await setHostTicketActive(id, ticket.id, !ticket.is_active);
      await refresh();
    } catch (caught) {
      Alert.alert('Unable to update ticket', caught instanceof Error ? caught.message : 'Please try again.');
    } finally { setWorking(false); }
  }

  async function toggleAddon(addon: HostAddon) {
    if (!id) return;
    setWorking(true);
    try {
      await setHostAddonActive(id, addon.id, !addon.is_active);
      await refresh();
    } catch (caught) {
      Alert.alert('Unable to update add-on', caught instanceof Error ? caught.message : 'Please try again.');
    } finally { setWorking(false); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Manage outing</Text></Pressable>
        <Text style={styles.eyebrow}>ADMISSION & EXTRAS</Text>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>Keep historical inventory intact by deactivating old options instead of deleting them.</Text>

        <View style={styles.segment}>
          <Pressable style={[styles.segmentButton, mode === 'ticket' && styles.segmentActive]} onPress={() => resetForm('ticket')}><Text style={[styles.segmentText, mode === 'ticket' && styles.segmentTextActive]}>Tickets</Text></Pressable>
          <Pressable style={[styles.segmentButton, mode === 'addon' && styles.segmentActive]} onPress={() => resetForm('addon')}><Text style={[styles.segmentText, mode === 'addon' && styles.segmentTextActive]}>Add-ons</Text></Pressable>
        </View>

        <Text style={styles.sectionTitle}>{mode === 'ticket' ? 'Ticket types' : 'Add-ons'}</Text>
        {mode === 'ticket' ? (
          tickets.length === 0 ? <Text style={styles.empty}>No ticket types yet.</Text> : tickets.map((ticket) => (
            <View key={ticket.id} style={styles.card}>
              <Pressable style={styles.cardMain} onPress={() => editTicket(ticket)}>
                <Text style={styles.cardTitle}>{ticket.name}</Text>
                <Text style={styles.cardMeta}>{ticket.capacity == null ? 'No cap' : `${ticket.capacity} capacity`} · max {ticket.max_per_order}/order</Text>
              </Pressable>
              <View style={styles.cardRight}><Text style={styles.price}>{ticket.price_cents === 0 ? 'FREE' : `$${(ticket.price_cents / 100).toFixed(2)}`}</Text><Pressable disabled={working} onPress={() => void toggleTicket(ticket)}><Text style={ticket.is_active ? styles.active : styles.inactive}>{ticket.is_active ? 'ACTIVE' : 'OFF'}</Text></Pressable></View>
            </View>
          ))
        ) : (
          addons.length === 0 ? <Text style={styles.empty}>No add-ons yet.</Text> : addons.map((addon) => (
            <View key={addon.id} style={styles.card}>
              <Pressable style={styles.cardMain} onPress={() => editAddon(addon)}>
                <Text style={styles.cardTitle}>{addon.name}</Text>
                <Text style={styles.cardMeta}>{addon.capacity == null ? 'No cap' : `${addon.capacity} capacity`} · max {addon.max_per_order}/order</Text>
              </Pressable>
              <View style={styles.cardRight}><Text style={styles.price}>{addon.price_cents === 0 ? 'FREE' : `$${(addon.price_cents / 100).toFixed(2)}`}</Text><Pressable disabled={working} onPress={() => void toggleAddon(addon)}><Text style={addon.is_active ? styles.active : styles.inactive}>{addon.is_active ? 'ACTIVE' : 'OFF'}</Text></Pressable></View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>{editingTicket || editingAddon ? 'Edit option' : `Add ${mode === 'ticket' ? 'ticket type' : 'add-on'}`}</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder={mode === 'ticket' ? 'Youth Admission' : 'Kayak Rental'} />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="What does this include?" multiline />
        <View style={styles.row}>
          <View style={styles.flex}><Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" prefix="$" /></View>
          <View style={styles.flex}><Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="No cap" /></View>
        </View>
        <Field label="Max per order" value={maxPerOrder} onChangeText={setMaxPerOrder} keyboardType="number-pad" />
        <Text style={styles.helper}>Paid options require paid-host permission. Deactivating an option preserves existing registrations and order history.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={working} style={styles.primary} onPress={() => void save()}><Text style={styles.primaryText}>{working ? 'Saving…' : editingTicket || editingAddon ? 'Save Changes' : 'Add Option'}</Text></Pressable>
        {editingTicket || editingAddon ? <Pressable onPress={() => resetForm(mode)}><Text style={styles.cancelEdit}>Cancel editing</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, prefix, multiline = false, ...props }: any) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}>{prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}<TextInput {...props} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor="#66736B" style={[styles.input, multiline && styles.multiline]} /></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 64 },
  back: { color: '#D7B45A', fontWeight: '800', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 33, lineHeight: 39, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A7B0AA', fontSize: 13, lineHeight: 20, marginTop: 5, marginBottom: 18 },
  segment: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, borderColor: '#344039', overflow: 'hidden' },
  segmentButton: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151B17' },
  segmentActive: { backgroundColor: '#443616' },
  segmentText: { color: '#9FA9A3', fontWeight: '800', fontSize: 12 },
  segmentTextActive: { color: '#E7C464' },
  sectionTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 24, marginBottom: 8 },
  empty: { color: '#77827B', fontSize: 12, paddingVertical: 7 },
  card: { minHeight: 72, borderRadius: 14, backgroundColor: '#171D19', borderWidth: 1, borderColor: '#2D3731', padding: 14, marginBottom: 8, flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardMain: { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 7 },
  cardTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  cardMeta: { color: '#8D9891', fontSize: 11, lineHeight: 16, marginTop: 3 },
  price: { color: '#E7C464', fontSize: 13, fontWeight: '900' },
  active: { color: '#8FD1A9', fontSize: 9, fontWeight: '900' },
  inactive: { color: '#8A948E', fontSize: 9, fontWeight: '900' },
  field: { marginTop: 13 },
  label: { color: '#D4DAD6', fontSize: 12, fontWeight: '800', marginBottom: 7 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', borderRadius: 13 },
  input: { flex: 1, minHeight: 48, color: '#FFF8E8', paddingHorizontal: 13, fontSize: 14 },
  multiline: { minHeight: 92, paddingTop: 13 },
  prefix: { color: '#D7B45A', fontSize: 15, fontWeight: '900', marginLeft: 13 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  helper: { color: '#738078', fontSize: 10, lineHeight: 15, marginTop: 9 },
  error: { color: '#FF8A80', fontSize: 12, lineHeight: 18, marginTop: 14 },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { color: '#172017', fontSize: 14, fontWeight: '900' },
  cancelEdit: { color: '#A7B0AA', textAlign: 'center', fontSize: 12, fontWeight: '800', marginTop: 13 },
});
