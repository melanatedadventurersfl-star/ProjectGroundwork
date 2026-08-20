import Ionicons from '@react-native-vector-icons/ionicons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { getGroups, joinGroup, type CommunityGroup } from '../community/api';
import { supabase } from '../lib/supabase';
import { getStateOption, loadCitiesForState, US_STATES } from './locations';
import { completeOnboarding, loadOnboardingProfile } from './onboardingService';
import { markGuidedTutorialCompleted } from './tutorialPreference';
import {
  ADVENTURE_PREFERENCE_OPTIONS,
  INITIAL_ONBOARDING_FORM,
  INTENT_OPTIONS,
  INTEREST_OPTIONS,
  type OnboardingForm,
} from './types';
import { requestConnection } from '../social/api';

const GOLD = '#E1B94F';
const BG = '#07100C';
const TEXT = '#FFF9EC';
const MUTED = '#BEC8C2';
const TOTAL_STEPS = 15;

const BACKGROUNDS = [
  require('../../assets/onboarding/onboarding-welcome.jpg'),
  require('../../assets/onboarding/onboarding-welcome.jpg'),
  require('../../assets/onboarding/onboarding-plan.jpg'),
  require('../../assets/onboarding/onboarding-people.jpg'),
  require('../../assets/onboarding/onboarding-people.jpg'),
  require('../../assets/onboarding/onboarding-people.jpg'),
  require('../../assets/onboarding/onboarding-places.jpg'),
  require('../../assets/onboarding/onboarding-places.jpg'),
  require('../../assets/onboarding/onboarding-share.jpg'),
  require('../../assets/onboarding/onboarding-share.jpg'),
  require('../../assets/onboarding/onboarding-people.jpg'),
  require('../../assets/onboarding/onboarding-share.jpg'),
  require('../../assets/onboarding/onboarding-plan.jpg'),
  require('../../assets/onboarding/onboarding-complete.jpg'),
  require('../../assets/onboarding/onboarding-people.jpg'),
] as const;

const APP_SECTIONS = [
  ['Trailhead', 'home-outline', 'Your home base for what is happening'],
  ['Adventures', 'trail-sign-outline', 'Trips, camps, events, and experiences'],
  ['Trail Guide', 'map-outline', 'Places, guides, tips, and local knowledge'],
  ['Outpost', 'chatbubbles-outline', 'The community feed and nearby activity'],
  ['Trailmates', 'people-outline', 'People you mutually connect with'],
  ['Campfires', 'flame-outline', 'Groups around interests and places'],
] as const;

type CommunitySuggestion = {
  id: string;
  display_name: string | null;
  username: string | null;
  home_city: string | null;
  home_state: string | null;
  avatar_url: string | null;
  interests: string[] | null;
};

type SectionName = 'Trailhead' | 'Adventures' | 'Trail Guide' | 'Outpost' | 'Trailmates' | 'Campfires';

type PrimaryProps = {
  label?: string;
  disabled?: boolean;
  onPress: () => void;
};

type QuestionSheetProps = {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  label?: string;
  disabled?: boolean;
  onPress: () => void;
};

function initials(value?: string | null) {
  return String(value || 'GM').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function Avatar({ person }: { person: CommunitySuggestion }) {
  if (person.avatar_url) return <Image source={{ uri: person.avatar_url }} style={styles.avatar} />;
  return <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{initials(person.display_name || person.username)}</Text></View>;
}

function ChoicePill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.choicePill, selected && styles.choicePillSelected]} onPress={onPress}>
      {selected ? <Ionicons name="checkmark" size={13} color={BG} /> : null}
      <Text style={[styles.choicePillText, selected && styles.choicePillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Primary({ label = 'Continue', disabled = false, onPress }: PrimaryProps) {
  return (
    <Pressable style={[styles.primary, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.primaryText}>{label}</Text>
      <Ionicons name="arrow-forward" size={17} color={BG} />
    </Pressable>
  );
}

function QuestionSheet({ eyebrow, title, children, label = 'Continue', disabled = false, onPress }: QuestionSheetProps) {
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <Text style={styles.sheetEyebrow}>{eyebrow}</Text>
      <Text style={styles.sheetTitle}>{title}</Text>
      {children}
      <Primary label={label} disabled={disabled} onPress={onPress} />
    </View>
  );
}

function Progress({ step }: { step: number }) {
  if (step <= 2) return null;
  return (
    <View style={styles.progressRail}>
      {Array.from({ length: TOTAL_STEPS - 2 }, (_, index) => (
        <View key={index} style={[styles.progressSegment, index + 3 <= step && styles.progressSegmentActive]} />
      ))}
    </View>
  );
}

function AppChrome({ active, children, name }: { active: SectionName; children: React.ReactNode; name: string }) {
  return (
    <View style={styles.appFrame}>
      <View style={styles.appHeader}>
        <View><Text style={styles.appSection}>{active}</Text><Text style={styles.appGreeting}>Good morning, {name}</Text></View>
        <Ionicons name="notifications-outline" size={21} color={TEXT} />
      </View>
      <View style={styles.appBody}>{children}</View>
      <View style={styles.bottomNav}>
        {[
          ['Trailhead', 'home-outline'], ['Adventures', 'trail-sign-outline'], ['Trail Guide', 'map-outline'], ['Outpost', 'chatbubbles-outline'], ['Campfires', 'flame-outline'],
        ].map(([label, icon]) => {
          const selected = active === label || (active === 'Trailmates' && label === 'Outpost');
          return <View key={label} style={styles.navItem}><Ionicons name={icon as never} size={17} color={selected ? GOLD : '#7F8A84'} /><Text style={[styles.navText, selected && styles.navTextActive]}>{label === 'Trail Guide' ? 'Guide' : label}</Text></View>;
        })}
      </View>
    </View>
  );
}

function SectionCard({ icon, title, copy, active = false }: { icon: string; title: string; copy: string; active?: boolean }) {
  return (
    <View style={[styles.sectionCard, active && styles.sectionCardActive]}>
      <View style={[styles.sectionIcon, active && styles.sectionIconActive]}><Ionicons name={icon as never} size={19} color={active ? BG : GOLD} /></View>
      <View style={styles.flex}><Text style={styles.sectionCardTitle}>{title}</Text><Text style={styles.sectionCardCopy}>{copy}</Text></View>
      <Ionicons name="chevron-forward" size={17} color={MUTED} />
    </View>
  );
}

function rankGroups(groups: CommunityGroup[], interests: string[], city: string, state: string) {
  const needles = interests.map((value) => value.toLowerCase());
  return [...groups].sort((a, b) => {
    const score = (group: CommunityGroup) => {
      const haystack = `${group.name} ${group.description ?? ''}`.toLowerCase();
      return needles.reduce((sum, value) => sum + (haystack.includes(value) ? 4 : 0), 0)
        + (group.state === state ? 2 : 0)
        + (group.city?.toLowerCase() === city.toLowerCase() ? 3 : 0)
        + Math.min(group.member_count, 20) / 20;
    };
    return score(b) - score(a);
  }).slice(0, 5);
}

export default function GuidedOnboardingExperience() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(INITIAL_ONBOARDING_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wasAlreadyComplete, setWasAlreadyComplete] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [stateSearch, setStateSearch] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<CommunitySuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [connectionSentIds, setConnectionSentIds] = useState<Set<string>>(new Set());
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [groupSuggestions, setGroupSuggestions] = useState<CommunityGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupBusyId, setGroupBusyId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);
  const [tourSection, setTourSection] = useState<SectionName>('Trailhead');
  const [transition] = useState(() => new Animated.Value(1));

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleList = (key: 'interests' | 'adventurePreferences' | 'intents', value: string) => setForm((current) => {
    const list = current[key];
    return { ...current, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] };
  });

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [step, transition]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!userId) return setLoading(false);
      const [profile, identity] = await Promise.all([
        loadOnboardingProfile(userId),
        supabase.from('profiles').select('username').eq('id', userId).single(),
      ]);
      if (!active) return;
      if (identity.error) throw identity.error;
      const communication = (profile.communication_preferences ?? {}) as Record<string, unknown>;
      const intents = Array.isArray(communication.discovery_intents) ? communication.discovery_intents.filter((value): value is string => typeof value === 'string') : [];
      const adventurePreferences = Array.isArray(communication.adventure_preferences) ? communication.adventure_preferences.filter((value): value is string => typeof value === 'string') : [];
      setUsername(identity.data?.username ?? null);
      setWasAlreadyComplete(Boolean(profile.onboarding_completed_at));
      setForm((current) => ({
        ...current,
        firstName: profile.first_name ?? '',
        lastName: profile.last_name ?? '',
        displayName: profile.display_name ?? identity.data?.username ?? '',
        homeCity: profile.home_city ?? '',
        homeState: profile.home_state ?? '',
        discoveryRadiusMiles: profile.discovery_radius_miles ?? 50,
        experienceLevel: profile.experience_level ?? 'new',
        interests: profile.interests ?? [],
        adventurePreferences,
        intents,
        pushEnabled: typeof communication.push === 'boolean' ? communication.push : true,
        emailEnabled: typeof communication.email === 'boolean' ? communication.email : true,
      }));
      setStateSearch(getStateOption(profile.home_state ?? '')?.name ?? profile.home_state ?? '');
      setCitySearch(profile.home_city ?? '');
      setLoading(false);
    }
    void load().catch((error) => { Alert.alert('Unable to start setup', error instanceof Error ? error.message : 'Please try again.'); setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!form.homeState) return setCities([]);
    let active = true;
    setCitiesLoading(true);
    void loadCitiesForState(form.homeState).then((values) => { if (active) setCities(values); }).catch(() => { if (active) setCities([]); }).finally(() => { if (active) setCitiesLoading(false); });
    return () => { active = false; };
  }, [form.homeState]);

  useEffect(() => {
    if (!userId || step < 11) return;
    let active = true;
    setSuggestionsLoading(true);
    async function loadSuggestions() {
      let query = supabase.from('community_profile_directory').select('*').neq('id', userId).limit(6);
      if (form.homeState) query = query.eq('home_state', form.homeState);
      let result = await query;
      if (result.error && form.homeState) result = await supabase.from('community_profile_directory').select('*').neq('id', userId).limit(6);
      if (result.error) throw result.error;
      if (active) setSuggestions((result.data ?? []) as CommunitySuggestion[]);
    }
    void loadSuggestions().catch((error) => console.warn('[onboarding] community preview failed', error)).finally(() => { if (active) setSuggestionsLoading(false); });
    return () => { active = false; };
  }, [form.homeState, step, userId]);

  useEffect(() => {
    if (step < 12) return;
    let active = true;
    setGroupsLoading(true);
    void getGroups().then((groups) => { if (active) setGroupSuggestions(rankGroups(groups, form.interests, form.homeCity, form.homeState)); })
      .catch((error) => console.warn('[onboarding] group suggestions failed', error)).finally(() => { if (active) setGroupsLoading(false); });
    return () => { active = false; };
  }, [form.homeCity, form.homeState, form.interests, step]);

  const stateOptions = useMemo(() => {
    if (!stateOpen) return [];
    const query = stateSearch.trim().toLowerCase();
    return US_STATES.filter((state) => !query || state.name.toLowerCase().includes(query) || state.abbreviation.toLowerCase().startsWith(query)).slice(0, 8);
  }, [stateOpen, stateSearch]);

  const cityOptions = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!form.homeState || !query || form.homeCity === citySearch) return [];
    return cities.filter((city) => city.toLowerCase().includes(query)).slice(0, 8);
  }, [cities, citySearch, form.homeCity, form.homeState]);

  const canContinue = useMemo(() => {
    if (step === 2) return Boolean(form.displayName.trim());
    if (step === 5) return form.interests.length > 0;
    if (step === 7) return Boolean(form.homeState.trim() && form.homeCity.trim());
    if (step === 9) return form.adventurePreferences.length > 0;
    if (step === 10) return form.intents.length > 0;
    return true;
  }, [form, step]);

  const locationLabel = [form.homeCity, form.homeState].filter(Boolean).join(', ');
  const greetingName = form.displayName.trim() || username || 'friend';
  const joinedGroupCount = groupSuggestions.filter((group) => group.is_member).length;

  async function requestCurrentLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return Alert.alert('Location is optional', 'Choose a city instead.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const place = (await Location.reverseGeocodeAsync(position.coords))[0];
      const region = place?.region ?? '';
      const state = US_STATES.find((option) => option.name.toLowerCase() === region.toLowerCase() || option.abbreviation.toLowerCase() === region.toLowerCase());
      const city = place?.city || place?.subregion || '';
      if (!state || !city) return Alert.alert('Choose your city', 'We found your location but could not match it cleanly.');
      update('homeState', state.abbreviation);
      update('homeCity', city);
      setStateSearch(state.name);
      setCitySearch(city);
      setStateOpen(false);
    } catch (error) { Alert.alert('Unable to use location', error instanceof Error ? error.message : 'Choose your city instead.'); }
    finally { setLocating(false); }
  }

  async function connect(person: CommunitySuggestion) {
    if (connectingId || connectionSentIds.has(person.id)) return;
    setConnectingId(person.id);
    try { await requestConnection(person.id); setConnectionSentIds((current) => new Set([...current, person.id])); }
    catch (error) { Alert.alert('Unable to send request', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setConnectingId(null); }
  }

  async function joinSuggestedGroup(group: CommunityGroup) {
    if (group.is_member || groupBusyId) return;
    setGroupBusyId(group.id);
    try {
      await joinGroup(group.id);
      setGroupSuggestions((current) => current.map((item) => item.id === group.id ? { ...item, is_member: true, member_count: item.member_count + 1 } : item));
    } catch (error) { Alert.alert('Unable to join group', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setGroupBusyId(null); }
  }

  async function requestNotificationPermission() {
    try {
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('general', { name: 'General', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
      const permission = await Notifications.requestPermissionsAsync();
      setNotificationPermission(permission.status);
      update('pushEnabled', permission.status === 'granted');
    } catch { setNotificationPermission('unavailable'); }
  }

  async function saveReplayProfile() {
    if (!userId) return;
    const { error } = await supabase.from('profiles').update({
      first_name: form.firstName.trim() || null,
      last_name: form.lastName.trim() || null,
      display_name: form.displayName.trim() || null,
      home_city: form.homeCity.trim() || null,
      home_state: form.homeState.trim() || null,
      discovery_radius_miles: form.discoveryRadiusMiles,
      experience_level: form.experienceLevel,
      interests: form.interests,
      communication_preferences: { push: form.pushEnabled, email: form.emailEnabled, sms: form.smsEnabled, discovery_intents: form.intents, adventure_preferences: form.adventurePreferences },
    }).eq('id', userId);
    if (error) throw error;
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    try {
      const parts = form.displayName.trim().split(/\s+/).filter(Boolean);
      const completionForm: OnboardingForm = { ...form, firstName: form.firstName.trim() || parts[0] || '', lastName: form.lastName.trim() || parts.slice(1).join(' ') };
      if (wasAlreadyComplete) await saveReplayProfile(); else await completeOnboarding(completionForm);
      markGuidedTutorialCompleted();
      router.replace('/(tabs)' as never);
    } catch (error) { Alert.alert('Unable to finish setup', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  }

  function next() {
    if (!canContinue || saving) return;
    if (step < TOTAL_STEPS) setStep((value) => value + 1);
    else void finish();
  }

  if (loading) return <ImageBackground source={BACKGROUNDS[0]} style={styles.background}><View style={styles.scrim}><SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={GOLD} size="large" /><Text style={styles.muted}>Preparing your Go Melanated welcome…</Text></View></SafeAreaView></View></ImageBackground>;

  const animatedStyle = { opacity: transition, transform: [{ translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };

  return (
    <ImageBackground source={BACKGROUNDS[step - 1]} style={styles.background} resizeMode="cover">
      <View style={[styles.scrim, step >= 14 && styles.scrimLight]}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {step > 1 ? <View style={styles.topBar}><Text style={styles.brand}>GO MELANATED</Text>{wasAlreadyComplete ? <Pressable onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.exit}>Exit replay</Text></Pressable> : null}</View> : null}
            <Progress step={step} />
            <Animated.View style={[styles.flex, animatedStyle]}>
              <ScrollView style={styles.flex} contentContainerStyle={[styles.content, step === 1 && styles.fill]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {step === 1 ? <View style={styles.welcome}><View style={styles.logo}><Ionicons name="mountain-outline" size={30} color={GOLD} /></View><Text style={styles.welcomeBrand}>GO MELANATED</Text><Text style={styles.welcomeTitle}>Find your people.{`\n`}Find your outside.</Text><Text style={styles.welcomeCopy}>Discover places, find adventures, learn, connect, and get outside with a community built for us.</Text><View style={styles.flex} /><Primary label="Get Started" onPress={next} /></View> : null}

                {step === 2 ? <View style={styles.nameStage}><Text style={styles.eyebrow}>FIRST THINGS FIRST</Text><Text style={styles.bigTitle}>What should we call you?</Text><Text style={styles.copy}>We will personalize the tour as we go.</Text><View style={styles.nameField}><Ionicons name="person-outline" size={18} color={GOLD} /><TextInput autoFocus style={styles.nameInput} value={form.displayName} placeholder="Your name" placeholderTextColor="#77817C" onChangeText={(value) => update('displayName', value)} /></View>{form.displayName.trim() ? <Text style={styles.hello}>👋 Good to meet you, {form.displayName.trim()}.</Text> : null}<View style={styles.flex} /><Primary disabled={!canContinue} onPress={next} /></View> : null}

                {step === 3 ? <View style={styles.stack}><Text style={styles.eyebrow}>HERE IS YOUR GO MELANATED</Text><Text style={styles.bigTitle}>Everything works together.</Text><Text style={styles.copy}>We will walk through the app the same way you will use it, starting from your Trailhead.</Text><View style={styles.sectionList}>{APP_SECTIONS.map(([name, icon, copy]) => <Pressable key={name} onPress={() => setTourSection(name as SectionName)}><SectionCard icon={icon} title={name} copy={copy} active={tourSection === name} /></Pressable>)}</View><Primary label="Take the tour" onPress={next} /></View> : null}

                {step === 4 ? <AppChrome active="Trailhead" name={greetingName}><View style={styles.heroCard}><Text style={styles.cardKicker}>UPCOMING ADVENTURES</Text><Text style={styles.heroTitle}>Weekend Camping Trip</Text><Text style={styles.cardCopy}>A few days outside, good people, and room around the fire.</Text></View><View style={styles.previewGrid}><View style={styles.previewCard}><Text style={styles.cardKicker}>NEAR YOU</Text><Text style={styles.previewTitle}>Places worth exploring</Text><Text style={styles.cardCopy}>Trails, parks, water, and weekend ideas.</Text></View><View style={styles.previewCard}><Text style={styles.cardKicker}>FOR YOU</Text><Text style={styles.previewTitle}>Beginner hiking tips</Text><Text style={styles.cardCopy}>Helpful guides without the gatekeeping.</Text></View></View><View style={styles.guideBubble}><Text style={styles.guideBubbleTitle}>This is your Trailhead.</Text><Text style={styles.guideBubbleCopy}>It pulls together upcoming adventures, nearby activity, recommendations, people, and things you may want to explore.</Text><Primary label="Make it mine" onPress={next} /></View></AppChrome> : null}

                {step === 5 ? <AppChrome active="Trailhead" name={greetingName}><View style={styles.heroCard}><Text style={styles.cardKicker}>UPCOMING ADVENTURES</Text><Text style={styles.heroTitle}>{form.interests.includes('Camping') ? 'Camp under the stars' : 'Find your next outside day'}</Text><Text style={styles.cardCopy}>Your choices below change what rises to the top.</Text></View><View style={styles.previewGrid}><View style={styles.previewCard}><Text style={styles.cardKicker}>FOR YOU</Text><Text style={styles.previewTitle}>{form.interests[0] || 'Outdoor ideas'}</Text></View><View style={styles.previewCard}><Text style={styles.cardKicker}>TRY NEXT</Text><Text style={styles.previewTitle}>{form.interests[1] || 'Something new'}</Text></View></View><QuestionSheet eyebrow="LET US SHAPE YOUR TRAILHEAD" title="What are you into?" label="Update my Trailhead" disabled={!canContinue} onPress={next}><View style={styles.pills}>{INTEREST_OPTIONS.map((interest) => <ChoicePill key={interest} label={interest} selected={form.interests.includes(interest)} onPress={() => toggleList('interests', interest)} />)}</View></QuestionSheet></AppChrome> : null}

                {step === 6 ? <AppChrome active="Trailhead" name={greetingName}><Text style={styles.sectionHeading}>Your Trailhead, personalized.</Text><View style={styles.heroCard}><Text style={styles.cardKicker}>UPCOMING FOR YOU</Text><Text style={styles.heroTitle}>{form.interests.includes('Camping') ? 'Sunrise Campout' : `${form.interests[0] || 'Outdoor'} weekend`}</Text><Text style={styles.cardCopy}>Recommendations now lean toward {form.interests.slice(0, 3).join(', ').toLowerCase()}.</Text></View><View style={styles.previewGrid}><View style={styles.previewCard}><Text style={styles.cardKicker}>TRAIL GUIDE</Text><Text style={styles.previewTitle}>{form.interests[0] || 'Explore'}</Text></View><View style={styles.previewCard}><Text style={styles.cardKicker}>NEARBY</Text><Text style={styles.previewTitle}>Add your location next</Text></View></View><Primary label="Show me the Trail Guide" onPress={next} /></AppChrome> : null}

                {step === 7 ? <AppChrome active="Trail Guide" name={greetingName}><Text style={styles.sectionHeading}>Trail Guide</Text><Text style={styles.copy}>Find places, learn, and plan your next outside day.</Text><View style={styles.heroCard}><Text style={styles.cardKicker}>DISCOVERY STARTS HERE</Text><Text style={styles.heroTitle}>{locationLabel || 'Choose where to explore'}</Text><Text style={styles.cardCopy}>Nearby recommendations get better when we know where to start.</Text></View><QuestionSheet eyebrow="TRAIL GUIDE" title="Where should we start exploring?" label="Explore from here" disabled={!canContinue} onPress={next}><Pressable style={styles.locationButton} onPress={() => void requestCurrentLocation()} disabled={locating}><Ionicons name="navigate" size={18} color={BG} /><Text style={styles.locationButtonText}>{locating ? 'Finding you…' : 'Use my location'}</Text></Pressable><Text style={styles.or}>or choose a city</Text><View style={styles.field}><Text style={styles.label}>State</Text><TextInput style={styles.input} value={stateSearch} placeholder="Start typing your state" placeholderTextColor="#78837D" onFocus={() => setStateOpen(true)} onChangeText={(value) => { setStateSearch(value); setStateOpen(true); update('homeState', ''); update('homeCity', ''); setCitySearch(''); }} />{stateOptions.length ? <View style={styles.autocomplete}>{stateOptions.map((state) => <Pressable key={state.abbreviation} style={styles.autoRow} onPress={() => { setStateSearch(state.name); update('homeState', state.abbreviation); update('homeCity', ''); setCitySearch(''); setStateOpen(false); }}><Text style={styles.autoText}>{state.name}</Text><Text style={styles.autoMeta}>{state.abbreviation}</Text></Pressable>)}</View> : null}</View><View style={styles.field}><Text style={styles.label}>City</Text><TextInput style={styles.input} editable={Boolean(form.homeState) && !citiesLoading} value={citySearch} placeholder={form.homeState ? 'Start typing your city' : 'Choose a state first'} placeholderTextColor="#78837D" onChangeText={(value) => { setCitySearch(value); update('homeCity', ''); }} />{cityOptions.length ? <View style={styles.autocomplete}>{cityOptions.map((city) => <Pressable key={city} style={styles.autoRow} onPress={() => { setCitySearch(city); update('homeCity', city); }}><Text style={styles.autoText}>{city}</Text></Pressable>)}</View> : null}</View></QuestionSheet></AppChrome> : null}

                {step === 8 ? <AppChrome active="Trail Guide" name={greetingName}><Text style={styles.sectionHeading}>Around {locationLabel || 'you'}</Text><View style={styles.chipRow}>{['Nearby', 'Trails', 'Camping', 'Water'].map((item) => <View key={item} style={[styles.smallChip, item === 'Nearby' && styles.smallChipActive]}><Text style={styles.smallChipText}>{item}</Text></View>)}</View><View style={styles.heroCard}><Text style={styles.cardKicker}>RECOMMENDED FOR YOU</Text><Text style={styles.heroTitle}>{form.interests.includes('Water adventures') ? 'A spring worth the drive' : 'A trail for your next free morning'}</Text><Text style={styles.cardCopy}>Trail Guide is now combining your location with what you told us you enjoy.</Text></View><Primary label="Show me Adventures" onPress={next} /></AppChrome> : null}

                {step === 9 ? <AppChrome active="Adventures" name={greetingName}><Text style={styles.sectionHeading}>Adventures</Text><Text style={styles.copy}>Trips, events, and experiences you can actually join.</Text><View style={styles.adventureList}>{[['Lake Louisa Camping Trip','Weekend · Clermont, FL'],['Beginner Hike & Picnic','Day trip · Orlando, FL'],['Silver Springs Kayak Tour','Water · Ocala, FL']].map(([title, meta], index) => <View key={title} style={[styles.adventureRow, form.adventurePreferences.length > 0 && index === 0 && styles.rowHighlighted]}><View style={styles.thumb}><Ionicons name={index === 2 ? 'boat-outline' : 'bonfire-outline'} size={22} color={GOLD} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{meta}</Text></View></View>)}</View><QuestionSheet eyebrow="ADVENTURES" title="Which kinds should we keep an eye out for?" label="Show me these adventures" disabled={!canContinue} onPress={next}><View style={styles.pills}>{ADVENTURE_PREFERENCE_OPTIONS.map((preference) => <ChoicePill key={preference} label={preference} selected={form.adventurePreferences.includes(preference)} onPress={() => toggleList('adventurePreferences', preference)} />)}</View></QuestionSheet></AppChrome> : null}

                {step === 10 ? <AppChrome active="Outpost" name={greetingName}><Text style={styles.sectionHeading}>Outpost</Text><Text style={styles.copy}>Share, ask, learn, and see what is happening around the community.</Text><View style={styles.post}><View style={styles.postHeader}><View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>TR</Text></View><View><Text style={styles.rowTitle}>Tasha R.</Text><Text style={styles.rowMeta}>{locationLabel || 'Nearby'} · 2h</Text></View></View><Text style={styles.postText}>Sunset hike was everything. Anybody else getting outside this weekend?</Text><View style={styles.photoPlaceholder}><Ionicons name="image-outline" size={28} color={GOLD} /></View></View><QuestionSheet eyebrow="OUTPOST" title="What are you hoping to get out of the community?" label="Shape my Outpost" disabled={!canContinue} onPress={next}><View style={styles.pills}>{INTENT_OPTIONS.map((intent) => <ChoicePill key={intent} label={intent} selected={form.intents.includes(intent)} onPress={() => toggleList('intents', intent)} />)}</View></QuestionSheet></AppChrome> : null}

                {step === 11 ? <AppChrome active="Trailmates" name={greetingName}><Text style={styles.sectionHeading}>Trailmates</Text><Text style={styles.copy}>People you mutually connect with and may actually adventure with.</Text>{suggestionsLoading ? <ActivityIndicator color={GOLD} /> : <View style={styles.people}>{suggestions.slice(0, 4).map((person) => <View key={person.id} style={styles.personRow}><Avatar person={person} /><View style={styles.flex}><Text style={styles.rowTitle}>{person.display_name || person.username || 'Go Melanated member'}</Text><Text style={styles.rowMeta}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Community member'}</Text><Text style={styles.interestMeta}>{person.interests?.slice(0, 2).join(' · ') || 'Outside · Community'}</Text></View><Pressable style={[styles.connect, connectionSentIds.has(person.id) && styles.done]} disabled={connectionSentIds.has(person.id) || connectingId === person.id} onPress={() => void connect(person)}><Text style={styles.connectText}>{connectionSentIds.has(person.id) ? 'Requested' : 'Connect'}</Text></Pressable></View>)}</View>}<View style={styles.guideBubble}><Text style={styles.guideBubbleTitle}>Want to start your circle?</Text><Text style={styles.guideBubbleCopy}>Connect if somebody feels like your kind of people. Skipping is completely fine.</Text><Primary onPress={next} /></View></AppChrome> : null}

                {step === 12 ? <AppChrome active="Campfires" name={greetingName}><Text style={styles.sectionHeading}>Campfires</Text><Text style={styles.copy}>Smaller communities around what you love, where you live, and what you want to learn.</Text>{groupsLoading ? <ActivityIndicator color={GOLD} /> : <View style={styles.people}>{groupSuggestions.map((group) => <View key={group.id} style={styles.groupRow}><View style={styles.groupIcon}><Ionicons name={group.kind === 'local' ? 'location-outline' : 'flame-outline'} size={20} color={GOLD} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{group.name}</Text><Text style={styles.rowMeta}>{group.member_count} members</Text></View><Pressable style={[styles.join, group.is_member && styles.done]} disabled={group.is_member || groupBusyId === group.id} onPress={() => void joinSuggestedGroup(group)}><Text style={styles.connectText}>{group.is_member ? 'Joined ✓' : 'Join'}</Text></Pressable></View>)}</View>}<View style={styles.guideBubble}><Text style={styles.guideBubbleTitle}>A few that may fit you.</Text><Text style={styles.guideBubbleCopy}>These recommendations already use the interests and location you picked earlier.</Text><Primary onPress={next} /></View></AppChrome> : null}

                {step === 13 ? <AppChrome active="Trailhead" name={greetingName}><Text style={styles.sectionHeading}>There is a lot happening here.</Text><Text style={styles.copy}>Now that you have seen what Go Melanated can do, notifications have some context.</Text><View style={styles.noticeList}>{[['Adventure updates','Changes, reminders, new trips','trail-sign-outline'],['Trailmate activity','Requests, messages, connections','people-outline'],['Campfire replies','New posts and comments','flame-outline'],['Nearby activity','Events and local happenings','location-outline']].map(([title, copy, icon]) => <View key={title} style={styles.noticeRow}><View style={styles.noticeIcon}><Ionicons name={icon as never} size={18} color={GOLD} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{copy}</Text></View></View>)}</View><View style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Want us to keep you in the loop?</Text><View style={styles.preference}><View style={styles.flex}><Text style={styles.rowTitle}>Push notifications</Text><Text style={styles.rowMeta}>Relevant activity, messages, and adventure updates.</Text></View><Switch value={form.pushEnabled} onValueChange={(value) => update('pushEnabled', value)} /></View><View style={styles.preference}><View style={styles.flex}><Text style={styles.rowTitle}>Email updates</Text><Text style={styles.rowMeta}>Useful account and community updates.</Text></View><Switch value={form.emailEnabled} onValueChange={(value) => update('emailEnabled', value)} /></View><Primary label={notificationPermission === 'granted' ? 'Notifications enabled ✓' : 'Keep me in the loop'} onPress={() => void requestNotificationPermission()} /><Pressable style={styles.textButton} onPress={next}><Text style={styles.textButtonText}>Continue</Text></Pressable></View></AppChrome> : null}

                {step === 14 ? <View style={styles.complete}><View style={styles.completeIcon}><Ionicons name="checkmark" size={32} color={BG} /></View><Text style={styles.completeTitle}>You are in, {greetingName}.</Text><Text style={styles.completeCopy}>Here is what your Go Melanated now knows about you.</Text><View style={styles.summary}><SectionCard icon="home-outline" title="Trailhead" copy={`Built around ${form.interests.slice(0, 3).join(', ') || 'your interests'}`} /><SectionCard icon="trail-sign-outline" title="Adventures" copy={form.adventurePreferences.slice(0, 3).join(' · ') || 'Ready for recommendations'} /><SectionCard icon="map-outline" title="Trail Guide" copy={`Exploring around ${locationLabel || 'your area'}`} /><SectionCard icon="flame-outline" title="Campfires" copy={`${joinedGroupCount} joined · ${connectionSentIds.size} Trailmate connection${connectionSentIds.size === 1 ? '' : 's'} started`} /></View><Primary label="See my Trailhead" onPress={next} /></View> : null}

                {step === 15 ? <AppChrome active="Trailhead" name={greetingName}><Text style={styles.sectionHeading}>Your Trailhead is ready.</Text><View style={styles.heroCard}><Text style={styles.cardKicker}>UPCOMING FOR YOU</Text><Text style={styles.heroTitle}>{form.adventurePreferences.includes('Camping trips') ? 'Lake Louisa Camping Trip' : 'Your next adventure is waiting'}</Text><Text style={styles.cardCopy}>Recommendations are now tuned to your interests, location, and adventure preferences.</Text></View><View style={styles.previewGrid}><View style={styles.previewCard}><Text style={styles.cardKicker}>TRAIL GUIDE</Text><Text style={styles.previewTitle}>{locationLabel || 'Nearby'} ideas</Text></View><View style={styles.previewCard}><Text style={styles.cardKicker}>COMMUNITY</Text><Text style={styles.previewTitle}>{joinedGroupCount || 'New'} Campfires</Text></View></View><View style={styles.guideBubble}><Text style={styles.guideBubbleTitle}>That is it.</Text><Text style={styles.guideBubbleCopy}>No separate tutorial. You have already been using the app. We will simply remove the guide layer from here.</Text><Primary label={saving ? 'Finishing…' : 'Explore my Trailhead'} disabled={saving} onPress={() => void finish()} /></View></AppChrome> : null}
              </ScrollView>
            </Animated.View>
            {step > 2 && step < 15 ? <Pressable style={styles.back} onPress={() => setStep((value) => Math.max(1, value - 1))}><Ionicons name="chevron-back" size={17} color={TEXT} /><Text style={styles.backText}>Back</Text></Pressable> : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 }, scrim: { flex: 1, backgroundColor: 'rgba(4,9,7,0.66)' }, scrimLight: { backgroundColor: 'rgba(4,9,7,0.48)' }, safe: { flex: 1 }, flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }, muted: { color: MUTED },
  topBar: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(4,9,7,0.4)' }, brand: { color: TEXT, fontWeight: '900', letterSpacing: 1.6, fontSize: 13 }, exit: { color: MUTED, fontSize: 11, fontWeight: '800' },
  progressRail: { flexDirection: 'row', gap: 3, paddingHorizontal: 18, paddingTop: 8 }, progressSegment: { flex: 1, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.13)' }, progressSegmentActive: { backgroundColor: GOLD },
  content: { padding: 18, paddingBottom: 82 }, fill: { flexGrow: 1, paddingBottom: 22 }, stack: { gap: 14 },
  welcome: { flex: 1, minHeight: 590, alignItems: 'center', paddingTop: 42 }, logo: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: GOLD, backgroundColor: 'rgba(6,13,10,0.54)', alignItems: 'center', justifyContent: 'center' }, welcomeBrand: { color: TEXT, fontSize: 15, fontWeight: '900', letterSpacing: 2.3, marginTop: 17 }, welcomeTitle: { color: TEXT, fontSize: 38, lineHeight: 44, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8, marginTop: 34 }, welcomeCopy: { color: '#E4EAE6', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420, marginTop: 16 },
  primary: { minHeight: 52, borderRadius: 15, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 }, primaryText: { color: BG, fontSize: 14, fontWeight: '900' }, disabled: { opacity: 0.42 },
  nameStage: { flex: 1, minHeight: 590, paddingTop: 64 }, eyebrow: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, bigTitle: { color: TEXT, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.7, marginTop: 9 }, copy: { color: '#D4DCD7', fontSize: 13, lineHeight: 19, marginTop: 7 }, nameField: { minHeight: 56, marginTop: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(7,14,11,0.82)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 }, nameInput: { flex: 1, color: TEXT, fontSize: 16, fontWeight: '700' }, hello: { color: '#F0D374', textAlign: 'center', marginTop: 17, fontWeight: '800' },
  sectionList: { gap: 8 }, sectionCard: { minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(8,15,12,0.82)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, sectionCardActive: { borderColor: GOLD, backgroundColor: 'rgba(34,34,18,0.9)' }, sectionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(225,185,79,0.12)', alignItems: 'center', justifyContent: 'center' }, sectionIconActive: { backgroundColor: GOLD }, sectionCardTitle: { color: TEXT, fontWeight: '900', fontSize: 13 }, sectionCardCopy: { color: '#AFBAB3', fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  appFrame: { borderRadius: 25, overflow: 'hidden', backgroundColor: '#07100D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', minHeight: 610 }, appHeader: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' }, appSection: { color: TEXT, fontSize: 23, fontWeight: '900', letterSpacing: -0.5 }, appGreeting: { color: '#9EAAA3', fontSize: 10, marginTop: 1 }, appBody: { padding: 13, gap: 11 }, bottomNav: { marginTop: 'auto', minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4 }, navItem: { alignItems: 'center', gap: 2, minWidth: 48 }, navText: { color: '#7F8A84', fontSize: 8, fontWeight: '700' }, navTextActive: { color: GOLD },
  sectionHeading: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.5 }, heroCard: { minHeight: 128, borderRadius: 18, backgroundColor: 'rgba(18,30,24,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', padding: 15, justifyContent: 'flex-end' }, cardKicker: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, heroTitle: { color: TEXT, fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 5 }, cardCopy: { color: '#B8C3BC', fontSize: 11, lineHeight: 16, marginTop: 4 }, previewGrid: { flexDirection: 'row', gap: 8 }, previewCard: { flex: 1, minHeight: 95, borderRadius: 15, backgroundColor: 'rgba(15,25,20,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 11 }, previewTitle: { color: TEXT, fontWeight: '900', fontSize: 13, lineHeight: 17, marginTop: 5 },
  guideBubble: { borderRadius: 20, backgroundColor: 'rgba(7,13,10,0.98)', borderWidth: 1, borderColor: 'rgba(225,185,79,0.35)', padding: 15, gap: 9 }, guideBubbleTitle: { color: GOLD, fontWeight: '900', fontSize: 16 }, guideBubbleCopy: { color: '#C7D0CB', fontSize: 11.5, lineHeight: 17 },
  sheet: { borderRadius: 22, backgroundColor: '#0B1511', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', padding: 15, gap: 11 }, sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginBottom: 2 }, sheetEyebrow: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, sheetTitle: { color: TEXT, fontSize: 20, lineHeight: 25, fontWeight: '900' }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choicePill: { minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(23,33,28,0.9)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 4 }, choicePillSelected: { backgroundColor: GOLD, borderColor: GOLD }, choicePillText: { color: TEXT, fontSize: 10.5, fontWeight: '800' }, choicePillTextSelected: { color: BG },
  locationButton: { minHeight: 47, borderRadius: 13, backgroundColor: '#7FA65D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, locationButtonText: { color: BG, fontWeight: '900', fontSize: 13 }, or: { color: '#849088', textAlign: 'center', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, field: { gap: 5 }, label: { color: '#DDE3DF', fontSize: 10.5, fontWeight: '800' }, input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: '#08110D', paddingHorizontal: 12, color: TEXT, fontSize: 13 }, autocomplete: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#09120E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, autoRow: { minHeight: 41, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' }, autoText: { color: TEXT, fontWeight: '700' }, autoMeta: { color: GOLD, fontWeight: '900', fontSize: 9 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, smallChip: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6 }, smallChipActive: { backgroundColor: '#476C39', borderColor: '#476C39' }, smallChipText: { color: TEXT, fontSize: 9, fontWeight: '800' },
  adventureList: { gap: 7 }, adventureRow: { minHeight: 67, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,24,20,0.9)', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 }, rowHighlighted: { borderColor: GOLD }, thumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(225,185,79,0.1)', alignItems: 'center', justifyContent: 'center' }, rowTitle: { color: TEXT, fontSize: 12.5, fontWeight: '900' }, rowMeta: { color: '#AEB8B2', fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  post: { borderRadius: 17, backgroundColor: 'rgba(15,24,20,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 12 }, postHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 }, postText: { color: TEXT, fontSize: 11.5, lineHeight: 17, marginTop: 10 }, photoPlaceholder: { minHeight: 100, borderRadius: 13, backgroundColor: 'rgba(225,185,79,0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  people: { gap: 7 }, personRow: { minHeight: 66, borderRadius: 15, backgroundColor: 'rgba(15,24,20,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, avatar: { width: 43, height: 43, borderRadius: 22 }, avatarFallback: { backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: BG, fontWeight: '900', fontSize: 13 }, interestMeta: { color: '#D2B969', fontSize: 8.5, marginTop: 2 }, connect: { minWidth: 67, minHeight: 33, borderRadius: 10, backgroundColor: '#78A4D1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, join: { minWidth: 61, minHeight: 33, borderRadius: 10, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, done: { backgroundColor: '#39453F' }, connectText: { color: BG, fontSize: 9.5, fontWeight: '900' }, groupRow: { minHeight: 62, borderRadius: 15, backgroundColor: 'rgba(15,24,20,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, groupIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(225,185,79,0.1)', alignItems: 'center', justifyContent: 'center' },
  noticeList: { gap: 7 }, noticeRow: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,24,20,0.9)', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 }, noticeIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(225,185,79,0.1)', alignItems: 'center', justifyContent: 'center' }, preference: { minHeight: 60, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, textButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center' }, textButtonText: { color: '#C7D0CB', fontSize: 10.5, fontWeight: '800' },
  complete: { flex: 1, minHeight: 600, alignItems: 'center', paddingTop: 44 }, completeIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }, completeTitle: { color: TEXT, fontSize: 32, lineHeight: 37, fontWeight: '900', textAlign: 'center', marginTop: 19 }, completeCopy: { color: '#DBE2DE', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 }, summary: { width: '100%', gap: 7, marginTop: 20, marginBottom: 18 },
  back: { position: 'absolute', left: 16, bottom: 14, minHeight: 36, borderRadius: 999, backgroundColor: 'rgba(4,9,7,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 2 }, backText: { color: TEXT, fontSize: 10.5, fontWeight: '800' },
});