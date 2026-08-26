import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createLocalEvent, getEventHostAccess, getGroupCampfireAccess } from '../../src/local-events/api';
import { getMemberBasecamp } from '../../src/member/api';
import { loadCitiesForState, US_STATES } from '../../src/onboarding/locations';

const categories = ['Hangout', 'Hiking', 'Water', 'Food & drinks', 'Wellness', 'Family', 'Camping', 'Other'];
type QuickTime = 'now' | 'tonight' | 'tomorrow' | 'weekend' | 'custom';

function quickDate(choice: Exclude<QuickTime, 'custom'>) {
  const date = new Date();
  date.setSeconds(0, 0);
  if (choice === 'now') {
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15);
    return date;
  }
  if (choice === 'tonight') {
    date.setHours(19, 0, 0, 0);
    if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
    return date;
  }
  if (choice === 'tomorrow') {
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
    return date;
  }
  const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  date.setHours(10, 0, 0, 0);
  return date;
}

function localInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateLocalEventScreen() {
  const {
    groupId,
    groupName,
    source,
    title: initialTitle,
    description: initialDescription,
    category: initialCategory,
    venueName: initialVenueName,
    state: initialState,
    city: initialCity,
  } = useLocalSearchParams<{
    groupId?: string;
    groupName?: string;
    source?: string;
    trailGuidePlaceId?: string;
    title?: string;
    description?: string;
    category?: string;
    venueName?: string;
    state?: string;
    city?: string;
  }>();
  const communityScoped = Boolean(groupId);
  const fromTrailGuide = source === 'trail-guide';
  const initialStateName = initialState ? US_STATES.find((item) => item.abbreviation === initialState)?.name || initialState : '';
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [title, setTitle] = useState(initialTitle ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [category, setCategory] = useState(categories.includes(initialCategory ?? '') ? initialCategory! : 'Hangout');
  const [quickTime, setQuickTime] = useState<QuickTime>('tonight');
  const [startsAt, setStartsAt] = useState(() => localInputValue(quickDate('tonight')));
  const [venueName, setVenueName] = useState(initialVenueName ?? '');
  const [state, setState] = useState(initialState ?? '');
  const [city, setCity] = useState(initialCity ?? '');
  const [stateSearch, setStateSearch] = useState(initialStateName);
  const [citySearch, setCitySearch] = useState(initialCity ?? '');
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessPromise = groupId
      ? getGroupCampfireAccess(groupId)
      : getEventHostAccess().then((access) => access.canCreate);
    accessPromise.then(setAllowed).catch(() => setAllowed(false));
  }, [groupId]);

  useEffect(() => {
    getMemberBasecamp().then((basecamp) => {
      const homeState = basecamp.profile?.home_state ?? '';
      const homeCity = basecamp.profile?.home_city ?? '';
      if (homeState) {
        setState((current) => current || homeState);
        setStateSearch((current) => current || US_STATES.find((item) => item.abbreviation === homeState)?.name || homeState);
      }
      if (homeCity) {
        setCity((current) => current || homeCity);
        setCitySearch((current) => current || homeCity);
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!state) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    loadCitiesForState(state)
      .then(setCities)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load cities.'))
      .finally(() => setLoadingCities(false));
  }, [state]);

  const filteredStates = useMemo(() => {
    const term = stateSearch.trim().toLowerCase();
    if (!term || state) return US_STATES.filter((item) => !state || item.abbreviation === state);
    return US_STATES.filter((item) => item.name.toLowerCase().includes(term) || item.abbreviation.toLowerCase().includes(term)).slice(0, 10);
  }, [state, stateSearch]);

  const filteredCities = useMemo(() => {
    const term = citySearch.trim().toLowerCase();
    if (!term || city) return cities.filter((item) => !city || item === city).slice(0, 10);
    return cities.filter((item) => item.toLowerCase().includes(term)).slice(0, 12);
  }, [cities, city, citySearch]);

  const parsedStart = startsAt ? new Date(startsAt) : null;
  const validDate = Boolean(parsedStart && !Number.isNaN(parsedStart.getTime()));
  const canSubmit = Boolean(allowed && title.trim() && description.trim() && validDate && state && city && !saving);

  function chooseQuickTime(choice: Exclude<QuickTime, 'custom'>) {
    setQuickTime(choice);
    setStartsAt(localInputValue(quickDate(choice)));
  }

  async function submit() {
    if (!canSubmit || !parsedStart) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createLocalEvent({
        title,
        description,
        category,
        startsAt: parsedStart.toISOString(),
        city,
        state,
        venueName,
        groupId: groupId ?? null,
      });
      router.replace({ pathname: '/local-events/[id]', params: { id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this Outing.');
    } finally {
      setSaving(false);
    }
  }

  if (allowed === null) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.denied}>
          <View style={styles.fireMark}><Ionicons name={communityScoped ? 'people-outline' : 'compass-outline'} size={28} color="#D7B45A" /></View>
          <Text style={styles.eyebrow}>{communityScoped ? 'COMMUNITY OUTING' : 'HOST AN OUTING'}</Text>
          <Text style={styles.title}>{communityScoped ? 'Community leaders only' : 'Want to bring people together?'}</Text>
          <Text style={styles.body}>{communityScoped ? `Only Community Leaders and master accounts can plan Outings for ${groupName || 'this Community'}.` : 'Approved Hosts can create public Outings, invite the community, and manage the people joining them. Apply once, then your planning tools unlock here automatically.'}</Text>
          {!communityScoped ? (
            <View style={styles.hostBenefits}>
              <View style={styles.hostBenefit}><Ionicons name="calendar-outline" size={17} color="#D7B45A" /><Text style={styles.hostBenefitText}>Create and publish community Outings</Text></View>
              <View style={styles.hostBenefit}><Ionicons name="people-outline" size={17} color="#D7B45A" /><Text style={styles.hostBenefitText}>Manage RSVPs and attendees</Text></View>
              <View style={styles.hostBenefit}><Ionicons name="checkmark-circle-outline" size={17} color="#D7B45A" /><Text style={styles.hostBenefitText}>Run check-in from your Host Hub</Text></View>
            </View>
          ) : null}
          <Pressable onPress={() => communityScoped ? router.back() : router.push('/host' as never)} style={styles.primaryButton}>
            <Ionicons name={communityScoped ? 'arrow-back-outline' : 'trail-sign-outline'} size={19} color="#17211C" />
            <Text style={styles.primaryButtonText}>{communityScoped ? 'Go back' : 'Open Host Hub'}</Text>
          </Pressable>
          {!communityScoped ? <Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Not now</Text></Pressable> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="chevron-back" size={21} color="#FFF8E8" /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{communityScoped ? 'COMMUNITY OUTING' : fromTrailGuide ? 'TRAIL GUIDE · OUTING' : 'OUTING'}</Text>
            <Text style={styles.title}>{fromTrailGuide ? 'Plan this Outing' : 'What are you doing?'}</Text>
          </View>
        </View>
        <Text style={styles.body}>{fromTrailGuide ? 'The Trail Guide filled in the destination details. Choose when you want to go, adjust anything you need, and invite the community.' : 'Keep it casual. Say what you’re doing, when, and where. People nearby can jump in.'}</Text>

        {fromTrailGuide && initialVenueName ? (
          <View style={styles.trailGuideContext}>
            <Ionicons name="map-outline" size={19} color="#D7B45A" />
            <View style={styles.flex}>
              <Text style={styles.trailGuideContextLabel}>FROM THE TRAIL GUIDE</Text>
              <Text style={styles.trailGuideContextTitle}>{initialVenueName}</Text>
            </View>
          </View>
        ) : null}

        <TextInput value={title} onChangeText={setTitle} placeholder="Riverwalk + drinks" placeholderTextColor="#718078" style={styles.bigInput} maxLength={80} />

        <Text style={styles.label}>When?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRail}>
          {([
            ['now', 'Now'],
            ['tonight', 'Tonight'],
            ['tomorrow', 'Tomorrow'],
            ['weekend', 'This weekend'],
          ] as const).map(([value, label]) => <Pressable key={value} onPress={() => chooseQuickTime(value)} style={[styles.quickChip, quickTime === value && styles.quickChipActive]}><Text style={[styles.quickChipText, quickTime === value && styles.quickChipTextActive]}>{label}</Text></Pressable>)}
          <Pressable onPress={() => setQuickTime('custom')} style={[styles.quickChip, quickTime === 'custom' && styles.quickChipActive]}><Text style={[styles.quickChipText, quickTime === 'custom' && styles.quickChipTextActive]}>Pick a time</Text></Pressable>
        </ScrollView>
        {quickTime === 'custom' ? <><TextInput value={startsAt} onChangeText={setStartsAt} autoCapitalize="none" placeholder="2026-08-23T18:30" placeholderTextColor="#718078" style={styles.input} /><Text style={styles.help}>YYYY-MM-DDTHH:MM</Text></> : <View style={styles.selectedTime}><Ionicons name="time-outline" size={16} color="#D7B45A" /><Text style={styles.selectedTimeText}>{parsedStart?.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text></View>}

        <Text style={styles.label}>Where?</Text>
        <TextInput value={venueName} onChangeText={setVenueName} placeholder="Park, trailhead, coffee shop…" placeholderTextColor="#718078" style={styles.input} />
        <View style={styles.locationGrid}>
          <View style={styles.locationColumn}>
            <Text style={styles.microLabel}>State</Text>
            <TextInput value={stateSearch} onChangeText={(value) => { setStateSearch(value); setState(''); setCity(''); setCitySearch(''); }} placeholder="State" placeholderTextColor="#718078" style={styles.input} />
            {!state ? <View style={styles.options}>{filteredStates.map((item) => <Pressable key={item.abbreviation} onPress={() => { setState(item.abbreviation); setStateSearch(item.name); setCity(''); setCitySearch(''); }} style={styles.option}><Text style={styles.optionText}>{item.name}</Text></Pressable>)}</View> : null}
          </View>
          <View style={styles.locationColumn}>
            <Text style={styles.microLabel}>City</Text>
            <TextInput editable={Boolean(state)} value={citySearch} onChangeText={(value) => { setCitySearch(value); setCity(''); }} placeholder={state ? 'City' : 'Choose state'} placeholderTextColor="#718078" style={[styles.input, !state && styles.disabled]} />
            {state && !city ? loadingCities ? <ActivityIndicator color="#D7B45A" style={styles.cityLoader} /> : <View style={styles.options}>{filteredCities.map((item) => <Pressable key={item} onPress={() => { setCity(item); setCitySearch(item); }} style={styles.option}><Text style={styles.optionText}>{item}</Text></Pressable>)}</View> : null}
          </View>
        </View>

        <Text style={styles.label}>What’s the vibe?</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Going for a walk around the Riverwalk and probably grabbing a drink after. Anyone around?" placeholderTextColor="#718078" multiline maxLength={600} style={[styles.input, styles.multiline]} />

        <Text style={styles.label}>What kind of hang?</Text>
        <View style={styles.chips}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable disabled={!canSubmit} onPress={() => void submit()} style={[styles.primaryButton, !canSubmit && styles.disabled]}>
          <Ionicons name="calendar-outline" size={19} color="#17211C" />
          <Text style={styles.primaryButtonText}>{saving ? 'Creating…' : 'Create Outing'}</Text>
        </Pressable>
        <Text style={styles.disclaimer}>Outings are casual member-led plans, not official Adventures.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 48, gap: 11 },
  denied: { flex: 1, padding: 24, justifyContent: 'center', gap: 14 },
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#334139', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  fireMark: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#25281F', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1, fontSize: 10 },
  title: { color: '#FFF8E8', fontSize: 27, lineHeight: 31, fontWeight: '900' },
  body: { color: '#AEB8B2', fontSize: 13, lineHeight: 19, marginBottom: 3 },
  hostBenefits: { borderRadius: 16, borderWidth: 1, borderColor: '#2F4036', backgroundColor: '#131E18', padding: 14, gap: 12 },
  hostBenefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostBenefitText: { flex: 1, color: '#D5DDD8', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#9BA79F', fontSize: 12, fontWeight: '800' },
  trailGuideContext: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#4A4021', backgroundColor: '#1B1A11', paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  trailGuideContextLabel: { color: '#9C8A53', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  trailGuideContextTitle: { color: '#FFF3CE', fontSize: 13, fontWeight: '900', marginTop: 2 },
  bigInput: { minHeight: 62, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#35443A', color: '#FFF8E8', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 15, fontSize: 18, fontWeight: '800' },
  label: { color: '#FFF3CE', fontWeight: '900', marginTop: 7, fontSize: 13 },
  microLabel: { color: '#8F9B93', fontWeight: '800', fontSize: 10, marginBottom: 4 },
  input: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2A382F', color: '#FFF8E8', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12 },
  multiline: { minHeight: 104, textAlignVertical: 'top', lineHeight: 19 },
  help: { color: '#7F8C84', fontSize: 10.5 },
  quickRail: { gap: 7, paddingRight: 8 },
  quickChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 99, borderWidth: 1, borderColor: '#3B4941', backgroundColor: '#141E19' },
  quickChipActive: { borderColor: '#9A8E3E', backgroundColor: '#302E1A' },
  quickChipText: { color: '#B5BFB8', fontSize: 11.5, fontWeight: '800' },
  quickChipTextActive: { color: '#F1D879' },
  selectedTime: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#2A382F' },
  selectedTimeText: { color: '#DCE2DE', fontSize: 12, fontWeight: '700' },
  locationGrid: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  locationColumn: { flex: 1 },
  options: { marginTop: 4, gap: 3, maxHeight: 190 },
  option: { backgroundColor: '#1B2720', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9 },
  optionText: { color: '#E8EDE9', fontSize: 11.5 },
  cityLoader: { marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: '#4E5C53', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  chipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  chipText: { color: '#D4DBD6', fontWeight: '700', fontSize: 11.5 },
  chipTextActive: { color: '#17211C' },
  primaryButton: { minHeight: 50, backgroundColor: '#D7B45A', borderRadius: 14, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryButtonText: { color: '#17211C', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.4 },
  disclaimer: { color: '#7F8C84', fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 1 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 10 },
});