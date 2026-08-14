import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAdventure,
  getAdventureRsvpSummary,
  listAdventureTicketTypes,
  setAdventureRsvp,
  setAdventureSaved,
  type AdventureAttendanceVisibility,
  type AdventureRsvpStatus,
  type AdventureRsvpSummary,
  type AdventureTicketType,
} from '../../src/adventures/api';
import type { AdventureDetail } from '../../src/adventures/types';

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdventureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [adventure, setAdventure] = useState<AdventureDetail | null>(null);
  const [tickets, setTickets] = useState<AdventureTicketType[]>([]);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [rsvp, setRsvp] = useState<AdventureRsvpSummary>({ interested: 0, going: 0, myStatus: null, myVisibility: 'private' });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [nextAdventure, nextTickets, nextRsvp] = await Promise.all([
        getAdventure(id),
        listAdventureTicketTypes(id),
        getAdventureRsvpSummary(id),
      ]);
      setAdventure(nextAdventure);
      setSaved(Boolean(nextAdventure.is_saved));
      setTickets(nextTickets);
      setRsvp(nextRsvp);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load adventure.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const priceLabel = useMemo(() => {
    if (!adventure) return '';
    if (!tickets.length) return adventure.starting_price_cents === 0 ? 'Free' : `$${Math.round(adventure.starting_price_cents / 100)}`;
    const minimum = Math.min(...tickets.map((ticket) => ticket.price_cents));
    if (tickets.length === 1) return minimum === 0 ? 'Free' : `$${Math.round(minimum / 100)}`;
    return minimum === 0 ? 'From Free' : `From $${Math.round(minimum / 100)}`;
  }, [adventure, tickets]);

  async function toggleSaved() {
    if (!adventure) return;
    const next = !saved;
    setSaved(next);
    setNotice(next ? 'Adventure saved.' : 'Removed from Saved.');
    try { await setAdventureSaved(adventure.id, next); }
    catch (caught) { setSaved(!next); setError(caught instanceof Error ? caught.message : 'Unable to update saved adventure.'); }
  }

  async function chooseRsvp(status: AdventureRsvpStatus) {
    if (!adventure) return;
    setWorking(true);
    try {
      await setAdventureRsvp(adventure.id, status, rsvp.myVisibility);
      await load();
      setNotice(status === 'not_going' ? 'Marked Not Going. This does not cancel an active reservation.' : `Marked ${titleCase(status)}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update RSVP.'); }
    finally { setWorking(false); }
  }

  async function setVisibility(visibility: AdventureAttendanceVisibility) {
    if (!adventure) return;
    const status = rsvp.myStatus ?? 'interested';
    setWorking(true);
    try { await setAdventureRsvp(adventure.id, status, visibility); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update attendance privacy.'); }
    finally { setWorking(false); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!adventure) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Adventure not found.'}</Text></SafeAreaView>;

  const soldOut = adventure.status === 'sold_out';
  const cancelled = adventure.status === 'cancelled';
  const closed = soldOut || cancelled || adventure.status === 'completed';
  const publicLocation = [adventure.venue_name, `${adventure.city}, ${adventure.state}`].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <ImageBackground source={adventure.hero_image_url ? { uri: adventure.hero_image_url } : undefined} style={styles.hero} imageStyle={styles.heroRadius}>
            <View style={styles.heroShade} />
            <View style={styles.heroTop}>
              <View style={styles.heroNavGroup}>
                <Pressable accessibilityLabel="Back" style={styles.heroButton} onPress={() => router.back()}><Text style={styles.heroButtonText}>‹</Text></Pressable>
                <Pressable accessibilityLabel="Trailhead" style={styles.heroButton} onPress={() => router.replace('/(tabs)')}><Text style={styles.homeGlyph}>⌂</Text></Pressable>
              </View>
              <Pressable accessibilityLabel={saved ? 'Remove from Saved' : 'Save Adventure'} style={styles.heroButton} onPress={() => void toggleSaved()}><Text style={styles.saveGlyph}>{saved ? '★' : '☆'}</Text></Pressable>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.eyebrow}>{adventure.is_featured ? 'FEATURED ADVENTURE' : 'OFFICIAL MA ADVENTURE'}</Text>
              <Text style={styles.title}>{adventure.title}</Text>
              <Text style={styles.heroMeta}>{formatDate(adventure.starts_at)} · {adventure.city}, {adventure.state}</Text>
            </View>
          </ImageBackground>
        </View>

        {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.factGrid}>
          <View style={styles.fact}><Text style={styles.factLabel}>DATE</Text><Text style={styles.factValue}>{new Date(adventure.starts_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</Text></View>
          <View style={styles.fact}><Text style={styles.factLabel}>LOCATION</Text><Text style={styles.factValue}>{adventure.city}, {adventure.state}</Text></View>
          <View style={styles.fact}><Text style={styles.factLabel}>PRICE</Text><Text style={styles.factValue}>{priceLabel}</Text></View>
          <View style={styles.fact}><Text style={styles.factLabel}>AVAILABILITY</Text><Text style={styles.factValue}>{soldOut ? 'Sold Out' : adventure.spots_remaining == null ? 'Open' : `${adventure.spots_remaining} spots`}</Text></View>
        </View>

        <View style={styles.chips}><Text style={styles.chip}>{titleCase(adventure.difficulty)}</Text><Text style={styles.chip}>{titleCase(adventure.category)}</Text></View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Community RSVP</Text>
          <Text style={styles.body}>{rsvp.going} going · {rsvp.interested} interested</Text>
          <View style={styles.rsvpRow}>{(['interested','going','not_going'] as AdventureRsvpStatus[]).map((status) => <Pressable key={status} disabled={working} style={[styles.rsvpButton, rsvp.myStatus === status && styles.rsvpActive]} onPress={() => void chooseRsvp(status)}><Text style={[styles.rsvpText, rsvp.myStatus === status && styles.rsvpTextActive]}>{titleCase(status)}</Text></Pressable>)}</View>
          <Text style={styles.privacyLabel}>Attendance privacy</Text>
          <View style={styles.rsvpRow}><Pressable style={[styles.privacyButton, rsvp.myVisibility === 'private' && styles.privacyActive]} onPress={() => void setVisibility('private')}><Text style={styles.privacyText}>Private Going</Text></Pressable><Pressable style={[styles.privacyButton, rsvp.myVisibility === 'community' && styles.privacyActive]} onPress={() => void setVisibility('community')}><Text style={styles.privacyText}>Visible to Community</Text></Pressable></View>
          <Text style={styles.microcopy}>Private attendance can still count toward totals without exposing your name.</Text>
        </View>

        <View style={styles.card}><Text style={styles.sectionTitle}>About</Text><Text style={styles.body}>{adventure.description}</Text></View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.mapPlaceholder}><Text style={styles.mapPin}>⌖</Text><Text style={styles.mapTitle}>{publicLocation}</Text><Text style={styles.microcopy}>Public Adventures show the organizer-provided location. Private meetup details can still be reserved for confirmed attendees.</Text></View>
        </View>

        {adventure.meeting_instructions ? <View style={styles.card}><Text style={styles.sectionTitle}>Meeting information</Text><Text style={styles.body}>{adventure.meeting_instructions}</Text></View> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Choose your experience</Text>
          <Text style={styles.microcopy}>Tap an option to see what is included before choosing tickets.</Text>
          {tickets.length ? tickets.map((ticket) => {
            const expanded = expandedTicket === ticket.id;
            const admissions = (ticket as AdventureTicketType & { admissions_per_unit?: number }).admissions_per_unit ?? 1;
            return <Pressable key={ticket.id} style={styles.ticketBox} onPress={() => setExpandedTicket(expanded ? null : ticket.id)}>
              <View style={styles.ticketRow}><View style={{flex:1}}><Text style={styles.ticketName}>{ticket.name}</Text><Text style={styles.microcopy}>{admissions > 1 ? `Includes admission for ${admissions} people` : 'Admission for 1 person'}</Text></View><View style={styles.ticketPriceWrap}><Text style={styles.ticketPrice}>{ticket.price_cents === 0 ? 'Free' : `$${Math.round(ticket.price_cents / 100)}`}</Text><Text style={styles.expandGlyph}>{expanded ? '−' : '+'}</Text></View></View>
              {expanded ? <View style={styles.ticketDetails}><Text style={styles.detailLabel}>{"WHAT'S INCLUDED"}</Text><Text style={styles.body}>{ticket.description || 'Standard admission for this experience.'}</Text><Text style={styles.detailLabel}>ATTENDEES</Text><Text style={styles.body}>{admissions > 1 ? `This option requires ${admissions} attendee assignments per bundle.` : 'Assign one attendee during checkout.'}</Text><Text style={styles.microcopy}>Eligibility, exclusions, cancellation notes, and anything to bring should be listed by the organizer in the ticket description.</Text></View> : null}
            </Pressable>;
          }) : <Text style={styles.body}>Ticket options are being finalized for this adventure.</Text>}
        </View>

        <View style={styles.card}><Text style={styles.sectionTitle}>What to expect</Text><Text style={styles.body}>Your reservation flow includes attendee assignment, Trail Family or Connection selection, readiness, waivers, and trip updates. Packing and host instructions appear with confirmed trip information.</Text></View>

        <Pressable style={[styles.primaryButton, closed && styles.disabled]} disabled={closed || !tickets.length} onPress={() => router.push(`/checkout/${adventure.id}`)}><Text style={styles.primaryButtonText}>{cancelled ? 'Adventure cancelled' : soldOut ? 'Sold out' : tickets.length ? 'Choose tickets' : 'Tickets coming soon'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#0F1713'},center:{flex:1,backgroundColor:'#0F1713',alignItems:'center',justifyContent:'center',padding:24},content:{padding:18,paddingBottom:54,gap:14},heroWrap:{borderRadius:24,overflow:'hidden'},hero:{height:390,justifyContent:'space-between',backgroundColor:'#26372D'},heroRadius:{borderRadius:24},heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(6,11,8,0.42)'},heroTop:{flexDirection:'row',justifyContent:'space-between',padding:14},heroNavGroup:{flexDirection:'row',gap:8},heroButton:{width:42,height:42,borderRadius:21,backgroundColor:'rgba(15,23,19,0.78)',alignItems:'center',justifyContent:'center'},heroButtonText:{color:'#FFF8E8',fontSize:30},homeGlyph:{color:'#FFF8E8',fontSize:22,fontWeight:'900'},saveGlyph:{color:'#F0D083',fontSize:25},heroBottom:{padding:20},eyebrow:{color:'#F0D083',fontWeight:'900',letterSpacing:1,fontSize:11},title:{color:'#FFF8E8',fontSize:35,lineHeight:39,fontWeight:'900',marginTop:6},heroMeta:{color:'#E5E9E6',marginTop:7,fontWeight:'700'},notice:{backgroundColor:'#24352B',borderRadius:12,padding:11},noticeText:{color:'#CDE0D2',fontWeight:'700'},error:{color:'#FFB4A9'},factGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},fact:{width:'48%',backgroundColor:'#17211C',borderRadius:15,padding:14,borderWidth:1,borderColor:'#2A3830'},factLabel:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:.8},factValue:{color:'#FFF8E8',fontSize:16,fontWeight:'900',marginTop:5},chips:{flexDirection:'row',gap:8,flexWrap:'wrap'},chip:{color:'#F0D083',backgroundColor:'#24352B',paddingHorizontal:11,paddingVertical:7,borderRadius:999,fontWeight:'800'},card:{backgroundColor:'#17211C',borderRadius:18,padding:17,borderWidth:1,borderColor:'#29372F',gap:9},sectionTitle:{color:'#FFF8E8',fontSize:21,fontWeight:'900'},body:{color:'#D1D8D3',fontSize:15,lineHeight:23},rsvpRow:{flexDirection:'row',gap:7,flexWrap:'wrap'},rsvpButton:{flexGrow:1,borderWidth:1,borderColor:'#536159',borderRadius:11,paddingVertical:10,paddingHorizontal:11,alignItems:'center'},rsvpActive:{backgroundColor:'#D7B45A',borderColor:'#D7B45A'},rsvpText:{color:'#E8ECE9',fontWeight:'800',fontSize:12},rsvpTextActive:{color:'#17211C'},privacyLabel:{color:'#FFF8E8',fontWeight:'800',marginTop:3},privacyButton:{borderWidth:1,borderColor:'#44534A',borderRadius:999,paddingHorizontal:11,paddingVertical:8},privacyActive:{borderColor:'#D7B45A',backgroundColor:'#26362C'},privacyText:{color:'#E7ECE8',fontSize:12,fontWeight:'700'},microcopy:{color:'#8F9B93',fontSize:12,lineHeight:18},mapPlaceholder:{minHeight:155,backgroundColor:'#1F3027',borderRadius:14,alignItems:'center',justifyContent:'center',padding:18},mapPin:{color:'#D7B45A',fontSize:32},mapTitle:{color:'#FFF8E8',fontSize:18,fontWeight:'900',marginBottom:5,textAlign:'center'},ticketBox:{borderTopWidth:1,borderTopColor:'#26332C',paddingVertical:10},ticketRow:{flexDirection:'row',gap:12,alignItems:'center'},ticketName:{color:'#FFF8E8',fontWeight:'900',fontSize:16},ticketPriceWrap:{alignItems:'flex-end',gap:3},ticketPrice:{color:'#F0D083',fontWeight:'900'},expandGlyph:{color:'#D7B45A',fontSize:20,fontWeight:'900'},ticketDetails:{backgroundColor:'#101813',borderRadius:12,padding:12,gap:5,marginTop:10},detailLabel:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:.8,marginTop:4},primaryButton:{backgroundColor:'#D7B45A',borderRadius:14,padding:16,alignItems:'center',marginTop:2},primaryButtonText:{color:'#17211C',fontWeight:'900',fontSize:16},disabled:{opacity:.5}
});