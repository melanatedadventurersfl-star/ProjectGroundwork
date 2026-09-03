import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createDraftOuting, getOutingHostAccess } from '../../src/hosting/api';
import { createCampaignWorkspace } from '../../src/hosting/creation';
import { addEventComponent } from '../../src/hosting/eventBuilder';
import { setOutingVisibility } from '../../src/hosting/hostProfiles';
import { addGeneralAdmissionTicket } from '../../src/hosting/tickets';

function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] ?? '' : input ?? ''; }
function friendlyDate(input: string) { if (!input) return ''; const date = new Date(input); return Number.isNaN(date.getTime()) ? input : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }

export default function CreateFromOpportunityScreen() {
  const params = useLocalSearchParams();
  const sourceTitle = value(params.title);
  const sourceUrl = value(params.sourceUrl);
  const organizer = value(params.organizer);
  const ticketUrl = value(params.ticketUrl);
  const eventStarts = value(params.startsAt);
  const eventEnds = value(params.endsAt);
  const sourceVenue = value(params.venueName);
  const sourceCity = value(params.city);
  const sourceState = value(params.state) || 'FL';

  const [title, setTitle] = useState(sourceTitle ? `Go Melanated Meetup: ${sourceTitle}` : 'Go Melanated Meetup');
  const [summary, setSummary] = useState(value(params.summary));
  const [startsAt, setStartsAt] = useState(eventStarts ? friendlyDate(eventStarts) : '');
  const [endsAt, setEndsAt] = useState(eventEnds ? friendlyDate(eventEnds) : '');
  const [meetingPlace, setMeetingPlace] = useState(sourceVenue);
  const [city, setCity] = useState(sourceCity);
  const [state, setState] = useState(sourceState);
  const [capacity, setCapacity] = useState('20');
  const [meetingInstructions, setMeetingInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const capacityNumber = useMemo(() => { const n = Number.parseInt(capacity, 10); return Number.isFinite(n) && n > 0 ? n : null; }, [capacity]);

  async function createMeetup() {
    setSaving(true); setError('');
    try {
      const access = await getOutingHostAccess();
      if (!access.approved) throw new Error('Approved host access is required.');
      const start = new Date(startsAt);
      const end = new Date(endsAt);
      if (!title.trim()) throw new Error('Add an outing title.');
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Add valid meetup start and end times.');
      const sourceNote = [
        sourceTitle ? `Outside event: ${sourceTitle}` : '',
        organizer ? `Original organizer: ${organizer}` : '',
        sourceUrl ? `Original event: ${sourceUrl}` : '',
        ticketUrl ? `Original tickets: ${ticketUrl}` : '',
      ].filter(Boolean).join('\n');
      const outing = await createDraftOuting({
        title: title.trim(),
        summary: summary.trim(),
        description: sourceNote,
        category: 'Social',
        difficulty: 'easy',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        city: city.trim(),
        state: state.trim() || 'FL',
        venueName: meetingPlace.trim(),
        capacity: capacityNumber,
        meetingInstructions: [meetingInstructions.trim(), sourceUrl ? `This is a Go Melanated meetup at an outside event. Go Melanated is not the producer of the original event. Source: ${sourceUrl}` : ''].filter(Boolean).join('\n\n'),
      });
      await setOutingVisibility(outing.id, 'public', []);
      await addGeneralAdmissionTicket(outing.id, capacityNumber, 0);
      const campaign = await createCampaignWorkspace({ adventureId: outing.id, title: outing.title, location: [outing.venue_name, outing.city, outing.state].filter(Boolean).join(', '), startsAt: outing.starts_at, endsAt: outing.ends_at });
      await Promise.all([addEventComponent(campaign.id, 'tickets', outing.starts_at), addEventComponent(campaign.id, 'team', outing.starts_at), addEventComponent(campaign.id, 'finance', outing.starts_at)]);
      router.replace(`/host/build/${outing.id}` as never);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create this outing.'); }
    finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Opportunities</Text></Pressable>
    <Text style={styles.eyebrow}>SCHEDULE AN OUTING</Text><Text style={styles.title}>Meet up at this event</Text>
    <Text style={styles.subtitle}>The original event stays external. You are creating the Go Melanated meetup around it.</Text>

    <View style={styles.sourceCard}><Text style={styles.sourceKicker}>ORIGINAL EVENT</Text><Text style={styles.sourceTitle}>{sourceTitle || 'External event'}</Text><Text style={styles.sourceMeta}>{[friendlyDate(eventStarts), sourceVenue, sourceCity, sourceState].filter(Boolean).join(' · ')}</Text>{organizer ? <Text style={styles.sourceMeta}>Organizer: {organizer}</Text> : null}</View>

    <Field label="Outing title" value={title} onChangeText={setTitle} />
    <Field label="Short description" value={summary} onChangeText={setSummary} multiline />
    <Field label="Meetup starts" value={startsAt} onChangeText={setStartsAt} placeholder="Sep 19, 2026 5:30 PM" />
    <Field label="Meetup ends" value={endsAt} onChangeText={setEndsAt} placeholder="Sep 19, 2026 9:00 PM" />
    <Field label="Meetup location" value={meetingPlace} onChangeText={setMeetingPlace} placeholder="Main entrance, coffee shop, parking lot..." />
    <View style={styles.row}><View style={styles.flex}><Field label="City" value={city} onChangeText={setCity} /></View><View style={styles.state}><Field label="State" value={state} onChangeText={setState} /></View></View>
    <Field label="Attendee limit" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
    <Field label="Meeting instructions" value={meetingInstructions} onChangeText={setMeetingInstructions} placeholder="Where to meet, what to wear, parking, tickets, arrival window..." multiline />

    <View style={styles.note}><Text style={styles.noteTitle}>Outside-event label</Text><Text style={styles.noteBody}>The member-facing outing will keep a note that Go Melanated is organizing the meetup, not producing the original event.</Text></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable disabled={saving} style={styles.primary} onPress={() => void createMeetup()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Create Outing Draft</Text>}</Pressable>
  </ScrollView></SafeAreaView>;
}

function Field({ label, multiline = false, ...props }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#66736B" style={[styles.input, multiline && styles.multiline]} textAlignVertical={multiline ? 'top' : 'center'} /></View>; }
const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#0B100D'},content:{padding:20,paddingBottom:64},back:{color:'#D7B45A',fontWeight:'900',marginBottom:18},eyebrow:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:'#FFF8E8',fontSize:32,lineHeight:38,fontWeight:'900',marginTop:4},subtitle:{color:'#A7B0AA',fontSize:12,lineHeight:18,marginTop:5,marginBottom:14},sourceCard:{borderRadius:16,borderWidth:1,borderColor:'#5C4A22',backgroundColor:'#1B1A12',padding:13,marginBottom:4},sourceKicker:{color:'#D7B45A',fontSize:8,fontWeight:'900',letterSpacing:1},sourceTitle:{color:'#FFF8E8',fontSize:15,fontWeight:'900',marginTop:4},sourceMeta:{color:'#9DA7A0',fontSize:9,lineHeight:14,marginTop:4},field:{marginTop:13},label:{color:'#D4DAD6',fontSize:12,fontWeight:'800',marginBottom:7},input:{minHeight:48,borderWidth:1,borderColor:'#344039',backgroundColor:'#141A16',borderRadius:13,color:'#FFF8E8',paddingHorizontal:13,fontSize:14},multiline:{minHeight:88,paddingTop:13},row:{flexDirection:'row',gap:10},flex:{flex:1},state:{width:90},note:{borderRadius:14,borderWidth:1,borderColor:'#334039',backgroundColor:'#151B17',padding:12,marginTop:18},noteTitle:{color:'#D7B45A',fontSize:10,fontWeight:'900'},noteBody:{color:'#89958D',fontSize:9,lineHeight:14,marginTop:4},error:{color:'#FF8A80',fontSize:11,lineHeight:17,marginTop:14},primary:{minHeight:52,borderRadius:14,backgroundColor:'#D7B45A',alignItems:'center',justifyContent:'center',marginTop:20},primaryText:{color:'#172017',fontSize:14,fontWeight:'900'} });
