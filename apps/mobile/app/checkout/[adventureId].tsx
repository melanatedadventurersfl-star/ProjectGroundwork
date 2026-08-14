import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAdventureRsvpSummary, setAdventureRsvp } from '../../src/adventures/api';
import { createHeldOrder, getCheckoutOptions } from '../../src/checkout/api';
import type { AdventureAddon, CheckoutAttendee, TicketType, Waiver } from '../../src/checkout/types';
import { supabase } from '../../src/lib/supabase';

type AttendeeDraft = CheckoutAttendee & { useSelf: boolean };

export default function CheckoutScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [addons, setAddons] = useState<AdventureAddon[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [selfProfile, setSelfProfile] = useState<{ id: string; firstName: string; lastName: string; displayName: string; email: string | null } | null>(null);
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([]);
  const [signatureName, setSignatureName] = useState('');
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adventureId) return;
    async function load() {
      try {
        const [{ tickets: nextTickets, addons: nextAddons, waivers: nextWaivers }, userData] = await Promise.all([
          getCheckoutOptions(adventureId),
          supabase.auth.getUser(),
        ]);
        setTickets(nextTickets);
        setAddons(nextAddons);
        setWaivers(nextWaivers);
        const user = userData.data.user;
        if (!user) throw new Error('You must be signed in to register.');
        const { data: profile, error: profileError } = await supabase.from('profiles').select('id,display_name,first_name,last_name,email').eq('id', user.id).single();
        if (profileError) throw profileError;
        const firstName = profile.first_name || '';
        const lastName = profile.last_name || '';
        setSelfProfile({ id: user.id, firstName, lastName, displayName: profile.display_name || [firstName,lastName].filter(Boolean).join(' ') || 'Me', email: profile.email || user.email || null });
        if (!signatureName && firstName && lastName) setSignatureName(`${firstName} ${lastName}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load registration.');
      } finally { setLoading(false); }
    }
    void load();
  }, [adventureId, signatureName]);

  const ticketCount = useMemo(() => Object.values(ticketQuantities).reduce((sum, value) => sum + value, 0), [ticketQuantities]);
  const attendeeTicketIds = useMemo(() => tickets.flatMap((ticket) => {
    const units = ticketQuantities[ticket.id] ?? 0;
    const admissions = Math.max(1, ticket.admissions_per_unit ?? 1);
    return Array.from({ length: units * admissions }, () => ticket.id);
  }), [tickets, ticketQuantities]);

  useEffect(() => {
    setAttendees((current) => attendeeTicketIds.map((ticketTypeId, index) => {
      const existing = current[index];
      if (existing?.ticketTypeId === ticketTypeId) return existing;
      if (index === 0 && selfProfile) return { ticketTypeId, kind: 'self', profileId: selfProfile.id, firstName: selfProfile.firstName, lastName: selfProfile.lastName, email: selfProfile.email ?? undefined, useSelf: true };
      return { ticketTypeId, kind: 'guest', firstName: '', lastName: '', useSelf: false };
    }));
  }, [attendeeTicketIds, selfProfile]);

  const hasRequiredWaiver = waivers.some((item) => item.required);
  const attendeesComplete = attendeeTicketIds.length > 0 && attendees.length === attendeeTicketIds.length && attendees.every((item) => Boolean(item.firstName.trim() && item.lastName.trim()));
  const canSubmit = ticketCount > 0 && attendeesComplete && (!hasRequiredWaiver || (waiverAccepted && Boolean(signatureName.trim())));

  const total = useMemo(() => {
    const ticketTotal = tickets.reduce((sum, item) => sum + item.price_cents * (ticketQuantities[item.id] ?? 0), 0);
    const addonTotal = addons.reduce((sum, item) => sum + item.price_cents * (addonQuantities[item.id] ?? 0), 0);
    return ticketTotal + addonTotal;
  }, [tickets, addons, ticketQuantities, addonQuantities]);

  function changeQuantity(id: string, delta: number, maximum: number, setter: typeof setTicketQuantities) {
    setter((current) => ({ ...current, [id]: Math.max(0, Math.min(maximum, (current[id] ?? 0) + delta)) }));
  }

  function updateAttendee(index: number, patch: Partial<AttendeeDraft>) {
    setAttendees((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function chooseSelf(index: number) {
    if (!selfProfile) return;
    updateAttendee(index, { useSelf: true, kind: 'self', profileId: selfProfile.id, firstName: selfProfile.firstName, lastName: selfProfile.lastName, email: selfProfile.email ?? undefined });
  }

  function chooseOther(index: number) {
    updateAttendee(index, { useSelf: false, kind: 'guest', profileId: undefined, firstName: '', lastName: '', email: undefined });
  }

  async function continueToPayment() {
    if (!adventureId || ticketCount < 1) return setError('Choose at least one ticket.');
    if (!attendeesComplete) return setError('Assign a person to every admission.');
    if (hasRequiredWaiver && (!waiverAccepted || !signatureName.trim())) return setError('Accept and sign the required waiver.');

    setSubmitting(true);
    setError(null);
    try {
      const order = await createHeldOrder(adventureId, {
        ticketQuantities,
        addonQuantities,
        attendees: attendees.map(({ useSelf: _useSelf, ...attendee }) => attendee),
        signatureName: signatureName.trim(),
        waiverAccepted,
      });
      const rsvp = await getAdventureRsvpSummary(adventureId);
      await setAdventureRsvp(adventureId, 'going', rsvp.myVisibility ?? 'private');
      router.push(`/checkout/confirmation/${order.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to reserve registration.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.navRow}><Pressable onPress={() => router.back()}><Text style={styles.navLink}>‹ Back</Text></Pressable><Pressable onPress={() => router.replace('/(tabs)')}><Text style={styles.navLink}>⌂ Trailhead</Text></Pressable></View>
        <Text style={styles.kicker}>Registration</Text><Text style={styles.title}>Choose your experience</Text>

        <Text style={styles.sectionTitle}>Tickets</Text>
        {tickets.map((ticket) => {
          const admissions = Math.max(1, ticket.admissions_per_unit ?? 1);
          return <View key={ticket.id} style={styles.card}><View style={styles.flex}><Text style={styles.cardTitle}>{ticket.name}</Text>{ticket.description ? <Text style={styles.muted}>{ticket.description}</Text> : null}<Text style={styles.bundleNote}>{admissions > 1 ? `${admissions} admissions included per bundle` : '1 admission'}</Text><Text style={styles.price}>{ticket.price_cents === 0 ? 'Free' : `$${(ticket.price_cents / 100).toFixed(2)}`}</Text></View><View style={styles.quantityRow}><Pressable style={styles.quantityButton} onPress={() => changeQuantity(ticket.id, -1, ticket.max_per_order, setTicketQuantities)}><Text style={styles.quantityText}>−</Text></Pressable><Text style={styles.quantityValue}>{ticketQuantities[ticket.id] ?? 0}</Text><Pressable style={styles.quantityButton} onPress={() => changeQuantity(ticket.id, 1, ticket.max_per_order, setTicketQuantities)}><Text style={styles.quantityText}>+</Text></Pressable></View></View>;
        })}

        {addons.length ? <Text style={styles.sectionTitle}>Add-ons</Text> : null}
        {addons.map((addon) => <View key={addon.id} style={styles.card}><View style={styles.flex}><Text style={styles.cardTitle}>{addon.name}</Text><Text style={styles.price}>${(addon.price_cents / 100).toFixed(2)}</Text></View><View style={styles.quantityRow}><Pressable style={styles.quantityButton} onPress={() => changeQuantity(addon.id, -1, addon.max_per_order, setAddonQuantities)}><Text style={styles.quantityText}>−</Text></Pressable><Text style={styles.quantityValue}>{addonQuantities[addon.id] ?? 0}</Text><Pressable style={[styles.quantityButton, ticketCount === 0 && styles.controlDisabled]} disabled={ticketCount === 0} onPress={() => changeQuantity(addon.id, 1, addon.max_per_order, setAddonQuantities)}><Text style={styles.quantityText}>+</Text></Pressable></View></View>)}

        {attendeeTicketIds.length ? <><Text style={styles.sectionTitle}>Who’s attending?</Text><Text style={styles.muted}>Every admission needs a person. Your account is selected for the first spot by default.</Text>{attendees.map((attendee, index) => {
          const ticket = tickets.find((item) => item.id === attendee.ticketTypeId);
          return <View key={`${attendee.ticketTypeId}-${index}`} style={styles.attendeeCard}><Text style={styles.attendeeNumber}>ATTENDEE {index + 1} · {ticket?.name ?? 'Ticket'}</Text>{index === 0 && selfProfile ? <View style={styles.choiceRow}><Pressable style={[styles.choice, attendee.useSelf && styles.choiceActive]} onPress={() => chooseSelf(index)}><Text style={[styles.choiceText, attendee.useSelf && styles.choiceTextActive]}>{selfProfile.displayName}</Text></Pressable><Pressable style={[styles.choice, !attendee.useSelf && styles.choiceActive]} onPress={() => chooseOther(index)}><Text style={[styles.choiceText, !attendee.useSelf && styles.choiceTextActive]}>Someone else</Text></Pressable></View> : null}{attendee.useSelf ? <Text style={styles.selfLine}>{attendee.firstName} {attendee.lastName}</Text> : <><TextInput style={styles.input} placeholder="First name" placeholderTextColor="#7f8a84" value={attendee.firstName} onChangeText={(value) => updateAttendee(index, { firstName: value })} /><TextInput style={styles.input} placeholder="Last name" placeholderTextColor="#7f8a84" value={attendee.lastName} onChangeText={(value) => updateAttendee(index, { lastName: value })} /><Text style={styles.muted}>Use this for another adult, child, Trail Family member, Connection, or guest. Saved-person selection can be layered onto this same slot model.</Text></>}</View>;
        })}</> : null}

        {waivers.length ? <><Text style={styles.sectionTitle}>Waiver</Text>{waivers.map((waiver) => <View key={waiver.id} style={styles.waiverCard}><Text style={styles.cardTitle}>{waiver.title}</Text><Text style={styles.muted}>{waiver.body}</Text></View>)}<Pressable style={styles.checkboxRow} onPress={() => setWaiverAccepted((value) => !value)}><View style={[styles.checkbox, waiverAccepted && styles.checkboxChecked]}>{waiverAccepted ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={styles.checkboxLabel}>I agree to the required waiver terms.</Text></Pressable><TextInput style={styles.input} placeholder="Type your full name as signature" placeholderTextColor="#7f8a84" value={signatureName} onChangeText={setSignatureName} /></> : null}

        <View style={styles.summary}><Text style={styles.cardTitle}>Order review</Text><Text style={styles.muted}>{ticketCount} ticket unit{ticketCount === 1 ? '' : 's'} · {attendeeTicketIds.length} attendee{attendeeTicketIds.length === 1 ? '' : 's'}</Text><Text style={styles.total}>Total ${(total / 100).toFixed(2)}</Text><Text style={styles.muted}>Continuing reserves your space and marks your RSVP as Going.</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.primaryButton, (!canSubmit || submitting) && styles.primaryButtonDisabled]} disabled={!canSubmit || submitting} onPress={() => void continueToPayment()}><Text style={styles.primaryButtonText}>{submitting ? 'Reserving…' : total === 0 ? 'Complete registration' : 'Continue to payment'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({safeArea:{flex:1,backgroundColor:'#0f1713'},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#0f1713'},content:{padding:22,paddingBottom:50,gap:12},navRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},navLink:{color:'#d3a94f',fontWeight:'900'},kicker:{color:'#d3a94f',fontWeight:'900',textTransform:'uppercase',letterSpacing:1},title:{color:'#fff8e8',fontSize:34,fontWeight:'900'},sectionTitle:{color:'#fff8e8',fontSize:21,fontWeight:'900',marginTop:12},card:{backgroundColor:'#17211c',borderRadius:16,padding:16,flexDirection:'row',gap:12},waiverCard:{backgroundColor:'#17211c',borderRadius:16,padding:16,gap:8},flex:{flex:1},cardTitle:{color:'#fff8e8',fontWeight:'900',fontSize:17},muted:{color:'#b7c0bb',lineHeight:20},bundleNote:{color:'#d9c896',fontSize:12,fontWeight:'800',marginTop:5},price:{color:'#d3a94f',fontWeight:'900',marginTop:6},quantityRow:{flexDirection:'row',alignItems:'center',gap:10},quantityButton:{width:34,height:34,borderRadius:17,backgroundColor:'#25342c',alignItems:'center',justifyContent:'center'},controlDisabled:{opacity:.35},quantityText:{color:'#fff8e8',fontSize:22},quantityValue:{color:'#fff8e8',fontWeight:'900',minWidth:20,textAlign:'center'},attendeeCard:{backgroundColor:'#17211c',borderRadius:16,padding:15,gap:9,borderWidth:1,borderColor:'#2e3c34'},attendeeNumber:{color:'#d3a94f',fontSize:10,fontWeight:'900',letterSpacing:.8},choiceRow:{flexDirection:'row',gap:7},choice:{flex:1,borderWidth:1,borderColor:'#4b5a51',borderRadius:11,padding:10,alignItems:'center'},choiceActive:{backgroundColor:'#d3a94f',borderColor:'#d3a94f'},choiceText:{color:'#e7ece8',fontWeight:'800',fontSize:12},choiceTextActive:{color:'#17211c'},selfLine:{color:'#fff8e8',fontWeight:'900',fontSize:16},input:{backgroundColor:'#101813',color:'#fff8e8',borderRadius:12,padding:14,borderWidth:1,borderColor:'#314039'},checkboxRow:{flexDirection:'row',alignItems:'center',gap:10},checkbox:{width:22,height:22,borderWidth:2,borderColor:'#d3a94f',borderRadius:5,alignItems:'center',justifyContent:'center'},checkboxChecked:{backgroundColor:'#d3a94f'},checkmark:{color:'#17211c',fontWeight:'900'},checkboxLabel:{color:'#fff8e8',flex:1},summary:{backgroundColor:'#202d26',borderRadius:16,padding:18,gap:5},total:{color:'#fff8e8',fontSize:24,fontWeight:'900'},error:{color:'#ffb4a9'},primaryButton:{backgroundColor:'#d3a94f',borderRadius:14,padding:16,alignItems:'center'},primaryButtonDisabled:{opacity:.4},primaryButtonText:{color:'#17211c',fontWeight:'900',fontSize:16}});