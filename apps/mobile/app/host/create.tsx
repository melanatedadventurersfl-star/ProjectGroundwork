import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createDraftOuting, getOutingHostAccess } from '../../src/hosting/api';
import { HostCopilotCard } from '../../src/hosting/HostCopilotCard';
import { addGeneralAdmissionTicket } from '../../src/hosting/tickets';

const categories = ['Hiking', 'Camping', 'Paddling', 'Beach', 'Cycling', 'Social', 'Workshop', 'Volunteer', 'Other'];
const difficulties = ['easy', 'moderate', 'challenging'] as const;

type Difficulty = (typeof difficulties)[number];

export default function CreateHostOutingScreen() {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Social');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [capacity, setCapacity] = useState('20');
  const [meetingInstructions, setMeetingInstructions] = useState('');
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const capacityNumber = useMemo(() => {
    const value = Number.parseInt(capacity, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [capacity]);

  async function createOuting() {
    setSaving(true);
    setError('');
    try {
      const access = await getOutingHostAccess();
      if (!access.approved) throw new Error('Approved host access is required.');
      if (paid && !access.paidEnabled) throw new Error('Paid hosting has not been enabled for your account yet. You can still create a free outing.');

      const dollars = Number.parseFloat(price || '0');
      const priceCents = paid ? Math.round(dollars * 100) : 0;
      if (paid && (!Number.isFinite(dollars) || dollars <= 0)) throw new Error('Enter a valid ticket price.');

      const outing = await createDraftOuting({
        title,
        summary,
        description,
        category,
        difficulty,
        startsAt,
        endsAt,
        city,
        state,
        venueName,
        capacity: capacityNumber,
        meetingInstructions,
      });

      await addGeneralAdmissionTicket(outing.id, capacityNumber, priceCents);
      router.replace(`/host/manage/${outing.id}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this outing.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Hub</Text></Pressable>
        <Text style={styles.eyebrow}>NEW OUTING</Text>
        <Text style={styles.title}>What are we doing?</Text>
        <Text style={styles.subtitle}>Start with an idea. Copilot can shape the first draft, or you can build it yourself below.</Text>

        <HostCopilotCard
          city={city}
          state={state}
          onApply={(plan) => {
            setTitle(plan.title);
            setSummary(plan.summary);
            setDescription(plan.description);
            setCategory(categories.includes(plan.category) ? plan.category : 'Other');
            setDifficulty(difficulties.includes(plan.difficulty) ? plan.difficulty : 'easy');
            if (plan.startsAt) setStartsAt(plan.startsAt);
            if (plan.endsAt) setEndsAt(plan.endsAt);
            if (plan.venueName) setVenueName(plan.venueName);
            if (plan.city) setCity(plan.city);
            if (plan.state) setState(plan.state.toUpperCase());
            if (plan.capacity) setCapacity(String(plan.capacity));
            setMeetingInstructions(plan.meetingInstructions);
            setError('');
          }}
        />

        <Text style={styles.manualLabel}>OUTING DETAILS</Text>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Sunset paddle on the river" />
        <Field label="Short hook" value={summary} onChangeText={setSummary} placeholder="An easygoing evening paddle for beginners and regulars." />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="What should someone know before they decide to join?" multiline />

        <Text style={styles.label}>Outing type</Text>
        <View style={styles.chips}>{categories.map((item) => <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />)}</View>

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chips}>{difficulties.map((item) => <Chip key={item} label={item.charAt(0).toUpperCase() + item.slice(1)} active={difficulty === item} onPress={() => setDifficulty(item)} />)}</View>

        <View style={styles.twoCol}>
          <View style={styles.flex}><Field label="Starts" value={startsAt} onChangeText={setStartsAt} placeholder="2026-09-12T09:00" /></View>
          <View style={styles.flex}><Field label="Ends" value={endsAt} onChangeText={setEndsAt} placeholder="2026-09-12T12:00" /></View>
        </View>
        <Text style={styles.helper}>Use local date and time in YYYY-MM-DDTHH:MM format. Copilot leaves uncertain times blank rather than guessing.</Text>

        <Field label="Venue / meeting place" value={venueName} onChangeText={setVenueName} placeholder="Riverfront launch" />
        <View style={styles.twoCol}>
          <View style={styles.flex}><Field label="City" value={city} onChangeText={setCity} placeholder="Jacksonville" /></View>
          <View style={styles.stateCol}><Field label="State" value={state} onChangeText={setState} placeholder="FL" /></View>
        </View>
        <Field label="Capacity" value={capacity} onChangeText={setCapacity} placeholder="20" keyboardType="number-pad" />
        <Field label="Meeting instructions" value={meetingInstructions} onChangeText={setMeetingInstructions} placeholder="Parking, where to meet, arrival window, or anything people need before they show up." multiline />

        <Text style={styles.sectionLabel}>Admission</Text>
        <View style={styles.segment}>
          <Pressable style={[styles.segmentButton, !paid && styles.segmentActive]} onPress={() => { setPaid(false); setPrice('0'); }}><Text style={[styles.segmentText, !paid && styles.segmentTextActive]}>Free outing</Text></Pressable>
          <Pressable style={[styles.segmentButton, paid && styles.segmentActive]} onPress={() => setPaid(true)}><Text style={[styles.segmentText, paid && styles.segmentTextActive]}>Paid outing</Text></Pressable>
        </View>
        {paid ? <Field label="General admission price" value={price} onChangeText={setPrice} placeholder="35.00" keyboardType="decimal-pad" prefix="$" /> : null}
        <Text style={styles.helper}>Copilot never changes pricing. This creates a General Admission ticket automatically; additional tiers and add-ons belong in Manage Outing.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable disabled={saving} style={styles.primary} onPress={() => void createOuting()}>
          {saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Create Draft Outing</Text>}
        </Pressable>
        <Text style={styles.micro}>Drafts are private until you publish them. Review AI-generated details before saving.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, prefix, multiline = false, ...props }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor="#66736B"
          style={[styles.input, multiline && styles.multiline]}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 64 },
  back: { color: '#D7B45A', fontWeight: '800', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 35, lineHeight: 41, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A7B0AA', fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 18 },
  manualLabel: { color: '#8F9A93', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 2 },
  fieldWrap: { marginTop: 14 },
  label: { color: '#D4DAD6', fontSize: 12, fontWeight: '800', marginBottom: 7 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', borderRadius: 13 },
  input: { flex: 1, minHeight: 48, color: '#FFF8E8', paddingHorizontal: 13, fontSize: 14 },
  multiline: { minHeight: 110, paddingTop: 13 },
  prefix: { color: '#D7B45A', fontSize: 15, fontWeight: '900', marginLeft: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 3 },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: '#364139', paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#151B17' },
  chipActive: { backgroundColor: '#443616', borderColor: '#8A6A25' },
  chipText: { color: '#A9B1AC', fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#E7C464' },
  twoCol: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  stateCol: { width: 95 },
  helper: { color: '#738078', fontSize: 10, lineHeight: 15, marginTop: 7 },
  sectionLabel: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 26, marginBottom: 9, textTransform: 'uppercase' },
  segment: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, borderColor: '#344039', overflow: 'hidden' },
  segmentButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151B17' },
  segmentActive: { backgroundColor: '#443616' },
  segmentText: { color: '#9FA9A3', fontWeight: '800', fontSize: 12 },
  segmentTextActive: { color: '#E7C464' },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryText: { color: '#172017', fontSize: 15, fontWeight: '900' },
  micro: { color: '#707C75', fontSize: 10, textAlign: 'center', marginTop: 9, lineHeight: 15 },
  error: { color: '#FF8A80', fontSize: 12, lineHeight: 18, marginTop: 15 },
});
