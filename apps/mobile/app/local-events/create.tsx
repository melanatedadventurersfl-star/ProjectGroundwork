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

function campfireCategory(value?: string) {
  if (value === 'Hiking') return 'Hiking';
  if (value === 'Water') return 'Water';
  if (value === 'Camping') return 'Camping';
  return 'Hangout';
}

export default function CreateLocalEventScreen() {
  const {
    groupId,
    groupName,
    trailGuidePlaceId,
    trailGuidePlaceName,
    trailGuideArea,
    trailGuideCity,
    trailGuideCategory,
  } = useLocalSearchParams<{
    groupId?: string;
    groupName?: string;
    trailGuidePlaceId?: string;
    trailGuidePlaceName?: string;
    trailGuideArea?: string;
    trailGuideCity?: string;
    trailGuideCategory?: string;
  }>();
  const communityScoped = Boolean(groupId);
  const trailGuideScoped = Boolean(trailGuidePlaceId && trailGuidePlaceName);
  const suggestedCity = trailGuideCity === 'orlando' ? 'Orlando' : trailGuideCity === 'jacksonville' ? 'Jacksonville' : '';
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [title, setTitle] = useState(trailGuidePlaceName ? `${trailGuidePlaceName} meetup` : '');
  const [description, setDescription] = useState(trailGuidePlaceName ? `Thinking about heading to ${trailGuidePlaceName}. Who wants to join?` : '');
  const [category, setCategory] = useState(campfireCategory(trailGuideCategory));
  const [quickTime, setQuickTime] = useState<QuickTime>('tonight');
  const [startsAt, setStartsAt] = useState(() => localInputValue(quickDate('tonight')));
  const [venueName, setVenueName] = useState(trailGuidePlaceName ?? '');
  const [state, setState] = useState(trailGuideScoped ? 'FL' : '');
  const [city, setCity] = useState(trailGuideScoped ? suggestedCity : '');
  const [stateSearch, setStateSearch] = useState(trailGuideScoped ? 'Florida' : '');
  const [citySearch, setCitySearch] = useState(trailGuideScoped ? suggestedCity : '');
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
    if (trailGuideScoped) return;
    getMemberBasecamp().then((basecamp) => {
      const homeState = basecamp.profile?.home_state ?? '';
      const homeCity = basecamp.profile?.home_city ?? '';
      if (homeState) {
        setState(homeState);
        const stateName = US_STATES.find((item) => item.abbreviation === homeState)?.name || homeState;
        setStateSearch(stateName);
      }
      if (homeCity) {
        setCity(homeCity);
        setCitySearch(homeCity);
      }
    }).catch(() => undefined);
  }, [trailGuideScoped]);

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
      setError(caught instanceof Error ? caught.message : 'Unable to start this Campfire.');
    } finally {
      setSaving(false);
    }
  }

  if (allowed === null) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.denied}>
          <View style={styles.fireMark}><Ionicons name="bonfire-outline" size={28} color="#D7B45A" /></View>
          <Text style={styles.title}>{communityScoped ? 'Community leaders only' : 'Hosting is invitation-based'}</Text>
          <Text style={styles.body}>{communityScoped ? `Only Community Leaders and master accounts can start Campfires for ${groupName || 'this Community'}.` : 'Trusted Hosts, Community Leads, and staff can start Campfires. Everyone can browse and join them.'}</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Go back</Text></Pressable>
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
            <Text style={styles.eyebrow}>{communityScoped ? 'COMMUNITY CAMPFIRE' : trailGuideScoped ? 'TRAIL GUIDE CAMPFIRE' : 'CAMPFIRE'}</Text>
            <Text style={styles.title}>{trailGuideScoped ? `Meet at ${trailGuidePlaceName}` : 'What are you doing?'}</Text>
          </View>
        </View>
        <Text style={styles.body}>{trailGuideScoped ? 'We brought the place over from Trail Guide. Pick a time, tweak the details, and invite people nearby.' : 'Keep it casual. Say what you’re doing, when, and where. People nearby can jump in.'}</Text>

        {trailGuideScoped ? (
          <View style={styles.trailGuideCard}>
            <View style={styles.trailGuideIcon}><Ionicons name="map-outline" size={20} color="#D7B45A" /></View>
            <View style={styles.flex}>
              <Text style={styles.trailGuideLabel}>FROM TRAIL GUIDE</Text>
              <Text style={styles.trailGuideName}>{trailGuidePlaceName}</Text>
              <Text style={styles.trailGuideMeta}>{trailGuideArea || suggestedCity}{trailGuideCategory ? ` · ${trailGuideCategory}` : ''}</Text>
            </View>
            <Ionicons name="bonfire-outline" size={20} color="#D7B45A" />
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
          <Ionicons name="bonfire-outline" size={19} color="#17211C" />
          <Text style={styles.primaryButtonText}>{saving ? 'Starting…' : 'Start Campfire'}</Text>
        </Pressable>
        <Text style={styles.disclaimer}>Campfires are casual member-led plans, not official Adventures.</Text>
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
  trailGuideCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#191B12', borderWidth: 1, borderColor: '#4A4423', borderRadius: 15, padding: 13 },
  trailGuideIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#2A2818', alignItems: 'center', justifyContent: 'center' },
  trailGuideLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  trailGuideName: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', marginTop: 1 },
  trailGuideMeta: { color: '#9EAAA2', fontSize: 11, marginTop: 2 },
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
