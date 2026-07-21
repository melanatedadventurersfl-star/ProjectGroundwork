import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createHeldOrder, getCheckoutOptions } from '../../src/checkout/api';
import type { AdventureAddon, TicketType, Waiver } from '../../src/checkout/types';

export default function CheckoutScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [addons, setAddons] = useState<AdventureAddon[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adventureId) return;
    getCheckoutOptions(adventureId)
      .then(({ tickets: nextTickets, addons: nextAddons, waivers: nextWaivers }) => {
        setTickets(nextTickets);
        setAddons(nextAddons);
        setWaivers(nextWaivers);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load registration.'))
      .finally(() => setLoading(false));
  }, [adventureId]);

  const ticketCount = useMemo(() => Object.values(ticketQuantities).reduce((sum, value) => sum + value, 0), [ticketQuantities]);
  const total = useMemo(() => {
    const ticketTotal = tickets.reduce((sum, item) => sum + item.price_cents * (ticketQuantities[item.id] ?? 0), 0);
    const addonTotal = addons.reduce((sum, item) => sum + item.price_cents * (addonQuantities[item.id] ?? 0), 0);
    return ticketTotal + addonTotal;
  }, [tickets, addons, ticketQuantities, addonQuantities]);

  function changeQuantity(id: string, delta: number, maximum: number, setter: typeof setTicketQuantities) {
    setter((current) => ({ ...current, [id]: Math.max(0, Math.min(maximum, (current[id] ?? 0) + delta)) }));
  }

  async function continueToPayment() {
    if (!adventureId || ticketCount < 1) return setError('Choose at least one ticket.');
    if (!firstName.trim() || !lastName.trim()) return setError('Add the primary attendee name.');
    if (waivers.some((item) => item.required) && (!waiverAccepted || !signatureName.trim())) return setError('Accept and sign the required waiver.');

    setSubmitting(true);
    setError(null);
    try {
      const attendeeTicketIds = tickets.flatMap((ticket) => Array.from({ length: ticketQuantities[ticket.id] ?? 0 }, () => ticket.id));
      const order = await createHeldOrder(adventureId, {
        ticketQuantities,
        addonQuantities,
        attendees: attendeeTicketIds.map((ticketTypeId, index) => ({
          ticketTypeId,
          kind: index === 0 ? 'self' : 'guest',
          firstName: index === 0 ? firstName.trim() : `Guest ${index + 1}`,
          lastName: index === 0 ? lastName.trim() : lastName.trim(),
        })),
        signatureName: signatureName.trim(),
        waiverAccepted,
      });
      router.push(`/checkout/confirmation/${order.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to reserve registration.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Registration</Text>
        <Text style={styles.title}>Choose your experience</Text>

        <Text style={styles.sectionTitle}>Tickets</Text>
        {tickets.map((ticket) => (
          <View key={ticket.id} style={styles.card}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{ticket.name}</Text>
              {ticket.description ? <Text style={styles.muted}>{ticket.description}</Text> : null}
              <Text style={styles.price}>${(ticket.price_cents / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.quantityRow}>
              <Pressable style={styles.quantityButton} onPress={() => changeQuantity(ticket.id, -1, ticket.max_per_order, setTicketQuantities)}><Text style={styles.quantityText}>−</Text></Pressable>
              <Text style={styles.quantityValue}>{ticketQuantities[ticket.id] ?? 0}</Text>
              <Pressable style={styles.quantityButton} onPress={() => changeQuantity(ticket.id, 1, ticket.max_per_order, setTicketQuantities)}><Text style={styles.quantityText}>+</Text></Pressable>
            </View>
          </View>
        ))}

        {addons.length ? <Text style={styles.sectionTitle}>Add-ons</Text> : null}
        {addons.map((addon) => (
          <View key={addon.id} style={styles.card}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{addon.name}</Text>
              <Text style={styles.price}>${(addon.price_cents / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.quantityRow}>
              <Pressable style={styles.quantityButton} onPress={() => changeQuantity(addon.id, -1, addon.max_per_order, setAddonQuantities)}><Text style={styles.quantityText}>−</Text></Pressable>
              <Text style={styles.quantityValue}>{addonQuantities[addon.id] ?? 0}</Text>
              <Pressable style={styles.quantityButton} onPress={() => changeQuantity(addon.id, 1, addon.max_per_order, setAddonQuantities)}><Text style={styles.quantityText}>+</Text></Pressable>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Primary attendee</Text>
        <TextInput style={styles.input} placeholder="First name" placeholderTextColor="#7f8a84" value={firstName} onChangeText={setFirstName} />
        <TextInput style={styles.input} placeholder="Last name" placeholderTextColor="#7f8a84" value={lastName} onChangeText={setLastName} />
        {ticketCount > 1 ? <Text style={styles.muted}>Additional guest details can be refined before check-in.</Text> : null}

        {waivers.length ? (
          <>
            <Text style={styles.sectionTitle}>Waiver</Text>
            {waivers.map((waiver) => <View key={waiver.id} style={styles.card}><Text style={styles.cardTitle}>{waiver.title}</Text><Text style={styles.muted}>{waiver.body}</Text></View>)}
            <Pressable style={styles.checkboxRow} onPress={() => setWaiverAccepted((value) => !value)}>
              <View style={[styles.checkbox, waiverAccepted && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>I agree to the required waiver terms.</Text>
            </Pressable>
            <TextInput style={styles.input} placeholder="Type your full name as signature" placeholderTextColor="#7f8a84" value={signatureName} onChangeText={setSignatureName} />
          </>
        ) : null}

        <View style={styles.summary}>
          <Text style={styles.cardTitle}>Order review</Text>
          <Text style={styles.muted}>{ticketCount} ticket{ticketCount === 1 ? '' : 's'}</Text>
          <Text style={styles.total}>Total ${(total / 100).toFixed(2)}</Text>
          <Text style={styles.muted}>A 15-minute reservation hold begins when you continue.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primaryButton} disabled={submitting} onPress={() => void continueToPayment()}>
          <Text style={styles.primaryButtonText}>{submitting ? 'Reserving…' : total === 0 ? 'Complete registration' : 'Continue to payment'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1713' }, content: { padding: 22, paddingBottom: 50, gap: 12 },
  kicker: { color: '#d3a94f', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }, title: { color: '#fff8e8', fontSize: 34, fontWeight: '900' }, sectionTitle: { color: '#fff8e8', fontSize: 21, fontWeight: '900', marginTop: 12 },
  card: { backgroundColor: '#17211c', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12 }, flex: { flex: 1 }, cardTitle: { color: '#fff8e8', fontWeight: '900', fontSize: 17 }, muted: { color: '#b7c0bb', lineHeight: 20 }, price: { color: '#d3a94f', fontWeight: '900', marginTop: 6 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, quantityButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#25342c', alignItems: 'center', justifyContent: 'center' }, quantityText: { color: '#fff8e8', fontSize: 22 }, quantityValue: { color: '#fff8e8', fontWeight: '900', minWidth: 20, textAlign: 'center' },
  input: { backgroundColor: '#17211c', color: '#fff8e8', borderRadius: 14, padding: 15 }, checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#d3a94f', borderRadius: 5 }, checkboxChecked: { backgroundColor: '#d3a94f' }, checkboxLabel: { color: '#fff8e8', flex: 1 },
  summary: { backgroundColor: '#202d26', borderRadius: 16, padding: 18, gap: 5 }, total: { color: '#fff8e8', fontSize: 24, fontWeight: '900' }, error: { color: '#ffb4a9' }, primaryButton: { backgroundColor: '#d3a94f', borderRadius: 14, padding: 16, alignItems: 'center' }, primaryButtonText: { color: '#17211c', fontWeight: '900', fontSize: 16 },
});