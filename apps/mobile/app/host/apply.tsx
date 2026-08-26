import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../src/lib/supabase';

const outingOptions = ['Hiking', 'Camping', 'Paddling', 'Beach', 'Cycling', 'Social', 'Workshop', 'Volunteer'];
const orientation = [
  ['Plan clearly', 'Publish accurate difficulty, timing, meeting, accessibility, and preparation details.'],
  ['Communicate early', 'Keep attendees informed when weather, timing, capacity, or meeting details change.'],
  ['Lead for safety', 'Check conditions, stay within your experience, and escalate incidents when needed.'],
  ['Welcome the group', 'Create an inclusive outing where people understand what to expect and how to participate.'],
  ['Close the loop', 'Use check-in, finish the outing, and leave accurate attendance behind for the community record.'],
] as const;

export default function HostApplicationScreen() {
  const [types, setTypes] = useState<string[]>([]);
  const [homeArea, setHomeArea] = useState('');
  const [experience, setExperience] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [paid, setPaid] = useState(false);
  const [certifications, setCertifications] = useState('');
  const [motivation, setMotivation] = useState('');
  const [orientationAccepted, setOrientationAccepted] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggleType(value: string) {
    setTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function submit() {
    if (!types.length) return Alert.alert('Choose an outing type', 'Select at least one kind of outing you want to host.');
    if (!homeArea.trim()) return Alert.alert('Add your area', 'Tell us where you expect to host most often.');
    if (experience.trim().length < 20) return Alert.alert('Tell us a little more', 'Describe your group leadership or outdoor experience.');
    if (motivation.trim().length < 20) return Alert.alert('Tell us why', 'Share why you want to host with Go Melanated.');
    if (!orientationAccepted || !safetyAccepted) return Alert.alert('Finish the Host Pathway', 'Complete the orientation and safety acknowledgements before submitting.');

    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const profileId = data.session?.user.id;
      if (!profileId) throw new Error('You must be signed in.');
      const now = new Date().toISOString();
      const { error } = await supabase.from('outing_hosts').insert({
        profile_id: profileId,
        status: 'pending',
        host_type: 'community',
        risk_tier: 'standard',
        can_create_paid_outings: false,
        payout_status: 'not_started',
        application_note: motivation.trim(),
        desired_outing_types: types,
        home_area: homeArea.trim(),
        leadership_experience: experience.trim(),
        expected_group_size: groupSize.trim() || null,
        requested_paid_access: paid,
        certifications: certifications.trim() || null,
        motivation: motivation.trim(),
        safety_acknowledged_at: now,
        orientation_completed_at: now,
        orientation_version: '1.0',
        terms_accepted_at: now,
      });
      if (error) throw error;
      Alert.alert('Application submitted', 'Your Host Pathway is complete. We will review your application before hosting tools unlock.', [
        { text: 'Back to Host Hub', onPress: () => router.replace('/host' as never) },
      ]);
    } catch (caught) {
      Alert.alert('Unable to submit', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Hub</Text></Pressable>
        <Text style={styles.eyebrow}>HOST PATHWAY</Text>
        <Text style={styles.title}>Ready to lead an outing?</Text>
        <Text style={styles.subtitle}>We keep approval lightweight, but we want every host to understand the responsibility that comes with bringing people together outdoors.</Text>

        <Section title="1 · Your hosting idea">
          <Text style={styles.label}>What would you like to host?</Text>
          <View style={styles.chips}>{outingOptions.map((item) => <Pressable key={item} onPress={() => toggleType(item)} style={[styles.chip, types.includes(item) && styles.chipActive]}><Text style={[styles.chipText, types.includes(item) && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
          <Field label="Where will you usually host?" value={homeArea} onChangeText={setHomeArea} placeholder="Tampa Bay, Jacksonville, Orlando…" />
          <Field label="Group leadership / outdoor experience" value={experience} onChangeText={setExperience} placeholder="Tell us about groups you have led, outdoor experience, volunteering, clubs, or similar experience." multiline />
          <Field label="Typical group size" value={groupSize} onChangeText={setGroupSize} placeholder="10–20 people" />
          <Field label="Relevant certifications (optional)" value={certifications} onChangeText={setCertifications} placeholder="CPR, Wilderness First Aid, guide certifications…" />
          <Field label="Why do you want to host with Go Melanated?" value={motivation} onChangeText={setMotivation} placeholder="What kind of experience do you want to create for the community?" multiline />
          <Pressable onPress={() => setPaid((value) => !value)} style={[styles.choice, paid && styles.choiceActive]}><Text style={styles.choiceTitle}>{paid ? '✓ ' : ''}I may want to host paid outings</Text><Text style={styles.choiceText}>Paid hosting is reviewed separately and still requires payout onboarding before money can be collected.</Text></Pressable>
        </Section>

        <Section title="2 · Host orientation">
          {orientation.map(([heading, body]) => <View key={heading} style={styles.orientationRow}><View style={styles.numberDot}><Text style={styles.dotText}>•</Text></View><View style={{ flex: 1 }}><Text style={styles.orientationTitle}>{heading}</Text><Text style={styles.orientationBody}>{body}</Text></View></View>)}
          <Pressable onPress={() => setOrientationAccepted((value) => !value)} style={[styles.ack, orientationAccepted && styles.ackActive]}><Text style={styles.ackTitle}>{orientationAccepted ? '✓ Orientation complete' : 'Mark orientation complete'}</Text></Pressable>
        </Section>

        <Section title="3 · Safety & community commitment">
          <Text style={styles.commitment}>I will provide accurate outing information, communicate meaningful changes, stay within my experience, follow Go Melanated community standards, and understand that hosting privileges may be paused when safety or trust concerns require review.</Text>
          <Pressable onPress={() => setSafetyAccepted((value) => !value)} style={[styles.ack, safetyAccepted && styles.ackActive]}><Text style={styles.ackTitle}>{safetyAccepted ? '✓ I agree' : 'I understand and agree'}</Text></Pressable>
        </Section>

        <Pressable disabled={saving} onPress={() => void submit()} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Submitting…' : 'Submit Host Application'}</Text></Pressable>
        <Text style={styles.micro}>Approval unlocks free community outings first. Paid-outing permission remains a separate trust and payout decision.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Field({ label, multiline, ...props }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor="#68736C" style={[styles.input, multiline && styles.multiline]} /></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 60 }, back: { color: '#D7B45A', fontWeight: '800', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#A7B0AA', fontSize: 14, lineHeight: 21, marginTop: 6 },
  section: { marginTop: 24, borderRadius: 18, borderWidth: 1, borderColor: '#2E3932', backgroundColor: '#151B17', padding: 16 }, sectionTitle: { color: '#E7C464', fontSize: 13, fontWeight: '900', marginBottom: 13 },
  label: { color: '#D6DDD8', fontSize: 11, fontWeight: '800', marginBottom: 7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: '#39433D', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 }, chipActive: { borderColor: '#8A6A25', backgroundColor: '#3A3017' }, chipText: { color: '#9EA8A2', fontWeight: '800', fontSize: 11 }, chipTextActive: { color: '#E7C464' },
  field: { marginTop: 14 }, input: { minHeight: 47, borderWidth: 1, borderColor: '#344039', borderRadius: 12, backgroundColor: '#0E1511', color: '#FFF8E8', paddingHorizontal: 12 }, multiline: { minHeight: 105, paddingTop: 12 },
  choice: { marginTop: 15, borderRadius: 13, borderWidth: 1, borderColor: '#38443D', padding: 13 }, choiceActive: { borderColor: '#8A6A25', backgroundColor: '#2D2818' }, choiceTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 12 }, choiceText: { color: '#89948D', fontSize: 10, lineHeight: 15, marginTop: 4 },
  orientationRow: { flexDirection: 'row', gap: 10, marginBottom: 14 }, numberDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#3C3219', alignItems: 'center', justifyContent: 'center' }, dotText: { color: '#E7C464', fontSize: 16 }, orientationTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' }, orientationBody: { color: '#8F9A93', fontSize: 11, lineHeight: 17, marginTop: 2 },
  commitment: { color: '#B5BDB8', fontSize: 12, lineHeight: 19 }, ack: { marginTop: 12, minHeight: 43, borderWidth: 1, borderColor: '#49534D', borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, ackActive: { borderColor: '#587E65', backgroundColor: '#173021' }, ackTitle: { color: '#E7ECE8', fontWeight: '900', fontSize: 11 },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 22 }, primaryText: { color: '#172017', fontWeight: '900', fontSize: 14 }, micro: { color: '#748078', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 9 },
});
