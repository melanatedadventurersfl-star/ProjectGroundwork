import Ionicons from '@react-native-vector-icons/ionicons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { useAuth } from '../src/auth/AuthProvider';
import { getGroups, joinGroup, type CommunityGroup } from '../src/community/api';
import { supabase } from '../src/lib/supabase';
import { getStateOption, loadCitiesForState, US_STATES } from '../src/onboarding/locations';
import { completeOnboarding, loadOnboardingProfile } from '../src/onboarding/onboardingService';
import { markGuidedTutorialCompleted } from '../src/onboarding/tutorialPreference';
import {
  ADVENTURE_PREFERENCE_OPTIONS,
  INITIAL_ONBOARDING_FORM,
  INTENT_OPTIONS,
  INTEREST_OPTIONS,
  type ExperienceLevel,
  type OnboardingForm,
} from '../src/onboarding/types';
import { requestConnection } from '../src/social/api';

const GOLD = '#D7B45A';
const BG = '#08100C';
const TEXT = '#FFF9EB';
const MUTED = '#C4CCC7';
const TOTAL_STEPS = 11;

const BACKGROUNDS = [
  require('../assets/onboarding/onboarding-welcome.jpg'),
  require('../assets/onboarding/onboarding-welcome.jpg'),
  require('../assets/onboarding/onboarding-plan.jpg'),
  require('../assets/onboarding/onboarding-places.jpg'),
  require('../assets/onboarding/onboarding-places.jpg'),
  require('../assets/onboarding/onboarding-share.jpg'),
  require('../assets/onboarding/onboarding-people.jpg'),
  require('../assets/onboarding/onboarding-people.jpg'),
  require('../assets/onboarding/onboarding-share.jpg'),
  require('../assets/onboarding/onboarding-plan.jpg'),
  require('../assets/onboarding/onboarding-complete.jpg'),
] as const;

const STAGES = [
  'Welcome',
  'Your name',
  'Meet the app',
  'Trail Guide',
  'Trail Guide',
  'Adventures',
  'Outpost',
  'Trailmates',
  'Campfires',
  'Stay in the loop',
  'Ready',
] as const;

const EXPERIENCE_COPY: Record<ExperienceLevel, string> = {
  new: 'Just getting started',
  beginner: 'Building confidence',
  intermediate: 'Comfortable outside',
  experienced: 'Seasoned adventurer',
};

const DEMO_SECTIONS = [
  ['Trail Guide', 'map-outline', 'Places, guides, local outdoor knowledge'],
  ['Adventures', 'trail-sign-outline', 'Trips, camps, events, and experiences'],
  ['Outpost', 'chatbubbles-outline', 'What your community is sharing nearby'],
  ['Trailmates', 'people-outline', 'Mutual connections with people who get outside'],
  ['Campfires', 'flame-outline', 'Smaller communities around shared interests'],
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

function initials(value?: string | null) {
  return String(value || 'GM').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function Avatar({ person }: { person: CommunitySuggestion }) {
  if (person.avatar_url) return <Image source={{ uri: person.avatar_url }} style={styles.avatar} />;
  return <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{initials(person.display_name || person.username)}</Text></View>;
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
  }).slice(0, 6);
}

function ChoicePill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.choicePill, selected && styles.choicePillSelected]} onPress={onPress}>
      {selected ? <Ionicons name="checkmark" size={14} color={BG} /> : null}
      <Text style={[styles.choicePillText, selected && styles.choicePillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function StageDots({ step }: { step: number }) {
  if (step === 1) return null;
  return (
    <View style={styles.stageDots}>
      {Array.from({ length: TOTAL_STEPS - 1 }, (_, index) => (
        <View key={index} style={[styles.stageDot, index + 2 === step && styles.stageDotActive, index + 2 < step && styles.stageDotDone]} />
      ))}
    </View>
  );
}

export default function OnboardingV2Screen() {
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
  const [demoSection, setDemoSection] = useState('Trail Guide');
  const transition = useRef(new Animated.Value(1)).current;

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleList = (key: 'interests' | 'adventurePreferences' | 'intents', value: string) => setForm((current) => {
    const list = current[key];
    return { ...current, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] };
  });

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, { toValue: 1, duration: 320, useNativeDriver: true }).start();
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
      const intents = Array.isArray(communication.discovery_intents)
        ? communication.discovery_intents.filter((value): value is string => typeof value === 'string') : [];
      const adventurePreferences = Array.isArray(communication.adventure_preferences)
        ? communication.adventure_preferences.filter((value): value is string => typeof value === 'string') : [];
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
        experienceLevel: (profile.experience_level ?? 'new') as ExperienceLevel,
        interests: profile.interests ?? [],
        adventurePreferences,
        intents,
        pushEnabled: typeof communication.push === 'boolean' ? communication.push : true,
        emailEnabled: typeof communication.email === 'boolean' ? communication.email : true,
        smsEnabled: typeof communication.sms === 'boolean' ? communication.sms : false,
        phoneNumber: profile.phone_number ?? '',
        smsConsent: Boolean(profile.sms_consent_at),
        accessibilityNeeds: profile.accessibility_needs ?? '',
        dietaryNeeds: profile.dietary_needs ?? '',
        supportNotes: profile.support_notes ?? '',
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
    if (!userId || step < 7) return;
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
    if (step < 9) return;
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
    if (step === 4) return form.interests.length > 0;
    if (step === 5) return Boolean(form.homeState.trim() && form.homeCity.trim());
    if (step === 6) return form.adventurePreferences.length > 0;
    if (step === 7) return form.intents.length > 0;
    return true;
  }, [form, step]);

  const locationLabel = [form.homeCity, form.homeState].filter(Boolean).join(', ');
  const greetingName = form.displayName.trim() || username || 'friend';
  const trailInterest = form.interests[0] || 'Outdoor places';
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
      communication_preferences: {
        push: form.pushEnabled,
        email: form.emailEnabled,
        sms: form.smsEnabled,
        discovery_intents: form.intents,
        adventure_preferences: form.adventurePreferences,
      },
    }).eq('id', userId);
    if (error) throw error;
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    try {
      const nameParts = form.displayName.trim().split(/\s+/).filter(Boolean);
      const completionForm: OnboardingForm = {
        ...form,
        firstName: form.firstName.trim() || nameParts[0] || '',
        lastName: form.lastName.trim() || nameParts.slice(1).join(' '),
      };
      if (wasAlreadyComplete) await saveReplayProfile(); else await completeOnboarding(completionForm);
      markGuidedTutorialCompleted();
      router.replace('/(tabs)' as never);
    } catch (error) { Alert.alert('Unable to finish setup', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  }

  function goNext() {
    if (!canContinue || saving) return;
    if (step < TOTAL_STEPS) setStep((value) => value + 1);
    else void finish();
  }

  if (loading) {
    return (
      <ImageBackground source={BACKGROUNDS[0]} style={styles.background}>
        <View style={styles.scrim}><SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={GOLD} size="large" /><Text style={styles.bodyCopy}>Preparing your Go Melanated welcome…</Text></View></SafeAreaView></View>
      </ImageBackground>
    );
  }

  const animatedStyle = {
    opacity: transition,
    transform: [{ translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };

  return (
    <ImageBackground source={BACKGROUNDS[step - 1]} style={styles.background} resizeMode="cover">
      <View style={[styles.scrim, step === 11 && styles.scrimLight]}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {step > 1 ? (
              <View style={styles.topBar}>
                <View>
                  <Text style={styles.brand}>GO MELANATED</Text>
                  <Text style={styles.sectionLabel}>{STAGES[step - 1]}</Text>
                </View>
                {wasAlreadyComplete ? <Pressable onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.exit}>Exit replay</Text></Pressable> : null}
              </View>
            ) : null}
            <StageDots step={step} />

            <Animated.View style={[styles.flex, animatedStyle]}>
              <ScrollView style={styles.flex} contentContainerStyle={[styles.content, step === 1 && styles.welcomeContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {step === 1 ? (
                  <View style={styles.welcomeWrap}>
                    <View style={styles.welcomeMark}><Ionicons name="mountain-outline" size={30} color={GOLD} /></View>
                    <Text style={styles.welcomeBrand}>GO MELANATED</Text>
                    <Text style={styles.welcomeHeadline}>Find your people.{`\n`}Find your outside.</Text>
                    <Text style={styles.welcomeCopy}>A community built to help you discover places, find adventures, learn, connect, and get outside.</Text>
                    <View style={styles.flex} />
                    <Pressable style={styles.primaryButton} onPress={goNext}><Text style={styles.primaryButtonText}>Get Started</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable>
                  </View>
                ) : null}

                {step === 2 ? (
                  <View style={styles.centeredStage}>
                    <Text style={styles.eyebrow}>FIRST THINGS FIRST</Text>
                    <Text style={styles.stageTitle}>What should we call you?</Text>
                    <Text style={styles.stageCopy}>We’ll use this to make Go Melanated feel a little more like yours.</Text>
                    <View style={styles.nameFieldWrap}>
                      <Ionicons name="person-outline" size={19} color={GOLD} />
                      <TextInput
                        autoFocus
                        style={styles.nameInput}
                        value={form.displayName}
                        placeholder="Your name"
                        placeholderTextColor="#7F8A84"
                        onChangeText={(value) => setForm((current) => ({
                          ...current,
                          displayName: value,
                          firstName: current.firstName.trim() ? current.firstName : value.trim().split(/\s+/)[0] || '',
                        }))}
                      />
                    </View>
                    {form.displayName.trim() ? <Text style={styles.greeting}>👋 Good to meet you, {form.displayName.trim()}.</Text> : null}
                    <View style={styles.flex} />
                    <Pressable style={[styles.primaryButton, !canContinue && styles.disabled]} disabled={!canContinue} onPress={goNext}><Text style={styles.primaryButtonText}>Continue</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable>
                  </View>
                ) : null}

                {step === 3 ? (
                  <View style={styles.appDemoStage}>
                    <Text style={styles.eyebrow}>HERE’S YOUR GO MELANATED</Text>
                    <Text style={styles.stageTitle}>Everything you need to get outside, together.</Text>
                    <View style={styles.demoPreview}>
                      <Text style={styles.demoPreviewKicker}>{demoSection.toUpperCase()}</Text>
                      <Text style={styles.demoPreviewTitle}>{DEMO_SECTIONS.find(([name]) => name === demoSection)?.[2]}</Text>
                      <View style={styles.demoPreviewArt}><Ionicons name={(DEMO_SECTIONS.find(([name]) => name === demoSection)?.[1] ?? 'compass-outline') as never} size={44} color={GOLD} /></View>
                    </View>
                    <View style={styles.demoList}>
                      {DEMO_SECTIONS.map(([name, icon, copy]) => {
                        const active = demoSection === name;
                        return (
                          <Pressable key={name} style={[styles.demoRow, active && styles.demoRowActive]} onPress={() => setDemoSection(name)}>
                            <View style={[styles.demoIcon, active && styles.demoIconActive]}><Ionicons name={icon as never} size={20} color={active ? BG : GOLD} /></View>
                            <View style={styles.flex}><Text style={styles.demoRowTitle}>{name}</Text><Text style={styles.demoRowCopy}>{copy}</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={MUTED} />
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable style={styles.primaryButton} onPress={goNext}><Text style={styles.primaryButtonText}>Show me around</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable>
                  </View>
                ) : null}

                {step === 4 ? (
                  <View style={styles.featureStage}>
                    <View style={styles.previewHeader}><View><Text style={styles.previewKicker}>TRAIL GUIDE</Text><Text style={styles.previewTitle}>{trailInterest}</Text></View><Ionicons name="map-outline" size={25} color={GOLD} /></View>
                    <View style={styles.previewHero}><Text style={styles.previewHeroLabel}>{form.interests.length ? 'Personalizing as you choose' : 'Discover your outside'}</Text><Text style={styles.previewHeroTitle}>{form.interests.length ? `${form.interests.slice(0, 2).join(' + ')} ideas are moving up` : 'Places, guides, tips, and local ideas'}</Text></View>
                    <View style={styles.previewCards}>
                      {['Near you', form.interests[0] || 'Hiking', form.interests[1] || 'Camping'].map((label, index) => <View key={`${label}-${index}`} style={styles.previewMiniCard}><Ionicons name={index === 0 ? 'location-outline' : 'leaf-outline'} size={18} color={GOLD} /><Text style={styles.previewMiniTitle}>{label}</Text><Text style={styles.previewMiniCopy}>{index === 0 ? 'Local places and weekend ideas' : `Guides and recommendations for ${label.toLowerCase()}`}</Text></View>)}
                    </View>
                    <View style={styles.questionSheet}>
                      <Text style={styles.sheetEyebrow}>MAKE THIS YOURS</Text>
                      <Text style={styles.sheetTitle}>What sounds like your kind of outside?</Text>
                      <View style={styles.choiceWrap}>{INTEREST_OPTIONS.map((interest) => <ChoicePill key={interest} label={interest} selected={form.interests.includes(interest)} onPress={() => toggleList('interests', interest)} />)}</View>
                      <View style={styles.experienceRow}>{(Object.keys(EXPERIENCE_COPY) as ExperienceLevel[]).map((level) => <ChoicePill key={level} label={EXPERIENCE_COPY[level]} selected={form.experienceLevel === level} onPress={() => update('experienceLevel', level)} />)}</View>
                      <Pressable style={[styles.primaryButton, !canContinue && styles.disabled]} disabled={!canContinue} onPress={goNext}><Text style={styles.primaryButtonText}>Looks good</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable>
                    </View>
                  </View>
                ) : null}

                {step === 5 ? (
                  <View style={styles.featureStage}>
                    <View style={styles.previewHeader}><View><Text style={styles.previewKicker}>TRAIL GUIDE</Text><Text style={styles.previewTitle}>{locationLabel ? `Around ${locationLabel}` : 'Around you'}</Text></View><Ionicons name="location-outline" size={25} color={GOLD} /></View>
                    <View style={styles.locationPreview}><View style={styles.locationMapPin}><Ionicons name="location" size={26} color={BG} /></View><Text style={styles.locationPreviewTitle}>{locationLabel || 'Your local outdoor map'}</Text><Text style={styles.locationPreviewCopy}>Trails · Parks · Camping · Water · Weekend ideas</Text></View>
                    <View style={styles.questionSheet}>
                      <Text style={styles.sheetEyebrow}>LOCAL DISCOVERY</Text>
                      <Text style={styles.sheetTitle}>Where should we start exploring?</Text>
                      <Pressable style={styles.locationButton} disabled={locating} onPress={() => void requestCurrentLocation()}><Ionicons name="navigate" size={19} color={BG} /><Text style={styles.locationButtonText}>{locating ? 'Finding you…' : 'Use my location'}</Text></Pressable>
                      <Text style={styles.orText}>or choose a city</Text>
                      <View style={styles.field}><Text style={styles.label}>State</Text><TextInput style={styles.input} value={stateSearch} placeholder="Start typing your state" placeholderTextColor="#7C8781" onFocus={() => setStateOpen(true)} onChangeText={(value) => { setStateSearch(value); setStateOpen(true); update('homeState', ''); update('homeCity', ''); setCitySearch(''); }} />{stateOptions.length ? <View style={styles.autocomplete}>{stateOptions.map((state) => <Pressable key={state.abbreviation} style={styles.autoRow} onPress={() => { setStateSearch(state.name); update('homeState', state.abbreviation); update('homeCity', ''); setCitySearch(''); setStateOpen(false); }}><Text style={styles.autoText}>{state.name}</Text><Text style={styles.autoMeta}>{state.abbreviation}</Text></Pressable>)}</View> : null}</View>
                      <View style={styles.field}><Text style={styles.label}>City</Text><TextInput style={styles.input} editable={Boolean(form.homeState) && !citiesLoading} value={citySearch} placeholder={form.homeState ? 'Start typing your city' : 'Choose a state first'} placeholderTextColor="#7C8781" onChangeText={(value) => { setCitySearch(value); update('homeCity', ''); }} />{cityOptions.length ? <View style={styles.autocomplete}>{cityOptions.map((city) => <Pressable key={city} style={styles.autoRow} onPress={() => { setCitySearch(city); update('homeCity', city); }}><Text style={styles.autoText}>{city}</Text></Pressable>)}</View> : null}</View>
                      <Pressable style={[styles.primaryButton, !canContinue && styles.disabled]} disabled={!canContinue} onPress={goNext}><Text style={styles.primaryButtonText}>Explore from here</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable>
                    </View>
                  </View>
                ) : null}

                {step === 6 ? (
                  <View style={styles.featureStage}>
                    <View style={styles.previewHeader}><View><Text style={styles.previewKicker}>ADVENTURES</Text><Text style={styles.previewTitle}>Ready when you are.</Text></View><Ionicons name="trail-sign-outline" size={25} color={GOLD} /></View>
                    <View style={styles.adventureList}>
                      {[
                        ['Little Camp of Horrors', 'Oct 30 – Nov 1 · Lake Wales, FL'],
                        ['Kayak the Springs', '1 day · Silver Springs, FL'],
                        ['Blue Ridge Getaway', 'Weekend · Blue Ridge, GA'],
                      ].map(([title, meta], index) => <View key={title} style={[styles.adventureCard, form.adventurePreferences.length && index === 0 && styles.previewHighlighted]}><View style={styles.adventureImage}><Ionicons name={index === 1 ? 'boat-outline' : 'bonfire-outline'} size={24} color={GOLD} /></View><View style={styles.flex}><Text style={styles.adventureTitle}>{title}</Text><Text style={styles.adventureMeta}>{meta}</Text></View></View>)}
                    </View>
                    <View style={styles.questionSheet}>
                      <Text style={styles.sheetEyebrow}>TUNE YOUR ADVENTURES</Text>
                      <Text style={styles.sheetTitle}>What kinds of adventures would you actually want to hear about?</Text>
                      <View style={styles.choiceWrap}>{ADVENTURE_PREFERENCE_OPTIONS.map((preference) => <ChoicePill key={preference} label={preference} selected={form.adventurePreferences.includes(preference)} onPress={() => toggleList('adventurePreferences', preference)} />)}</View>
                      <Pressable style={[styles.primaryButton, !canContinue && styles.disabled]} disabled={!canContinue} onPress={goNext}><Text style={styles.primaryButtonText}>That sounds like me</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable>
                    </View>
                  </View>
                ) : null}

                {step === 7 ? (
                  <View style={styles.featureStage}>
                    <View style={styles.previewHeader}><View><Text style={styles.previewKicker}>OUTPOST</Text><Text style={styles.previewTitle}>Outside is better together.</Text></View><Ionicons name="chatbubbles-outline" size={25} color={GOLD} /></View>
                    <View style={styles.outpostPost}><View style={styles.postHeader}><View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>TR</Text></View><View><Text style={styles.personName}>Tasha R.</Text><Text style={styles.postMeta}>{locationLabel || 'Nearby'} · 2h ago</Text></View></View><Text style={styles.postText}>Perfect morning for a trail walk. Anybody else getting outside today?</Text><View style={styles.postPhoto}><Ionicons name="image-outline" size={30} color={GOLD} /></View><View style={styles.postStats}><Text style={styles.postMeta}>♥ 28</Text><Text style={styles.postMeta}>6 replies</Text></View></View>
                    <View style={styles.questionSheet}>
                      <Text style={styles.sheetEyebrow}>SHAPE YOUR COMMUNITY</Text>
                      <Text style={styles.sheetTitle}>What are you hoping to find here?</Text>
                      <View style={styles.choiceWrap}>{INTENT_OPTIONS.map((intent) => <ChoicePill key={intent} label={intent} selected={form.intents.includes(intent)} onPress={() => toggleList('intents', intent)} />)}</View>
                      <Pressable style={[styles.primaryButton, !canContinue && styles.disabled]} disabled={!canContinue} onPress={goNext}><Text style={styles.primaryButtonText}>Keep going</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable>
                    </View>
                  </View>
                ) : null}

                {step === 8 ? (
                  <View style={styles.featureStage}>
                    <View style={styles.previewHeader}><View><Text style={styles.previewKicker}>TRAILMATES</Text><Text style={styles.previewTitle}>Meet your people.</Text></View><Ionicons name="people-outline" size={25} color={GOLD} /></View>
                    <Text style={styles.previewIntro}>Trailmates are mutual connections, not followers. Connect if someone feels like your kind of outside.</Text>
                    <View style={styles.peopleList}>{suggestionsLoading ? <ActivityIndicator color={GOLD} /> : suggestions.slice(0, 5).map((person) => <View key={person.id} style={styles.personRow}><Avatar person={person} /><View style={styles.flex}><Text style={styles.personName}>{person.display_name || person.username || 'Go Melanated member'}</Text><Text style={styles.personMeta}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Community member'}</Text><Text style={styles.personInterests}>{person.interests?.slice(0, 2).join(' · ') || 'Outside · Community'}</Text></View><Pressable style={[styles.connectButton, connectionSentIds.has(person.id) && styles.connectButtonDone]} disabled={connectionSentIds.has(person.id) || connectingId === person.id} onPress={() => void connect(person)}><Text style={styles.connectButtonText}>{connectionSentIds.has(person.id) ? 'Requested' : connectingId === person.id ? 'Sending…' : 'Connect'}</Text></Pressable></View>)}</View>
                    {!suggestionsLoading && !suggestions.length ? <View style={styles.emptyCard}><Text style={styles.cardTitle}>Your Trailmates will show up here.</Text><Text style={styles.cardCopy}>We’ll keep looking for people whose location and interests overlap with yours.</Text></View> : null}
                    <View style={styles.questionSheetCompact}><Text style={styles.sheetTitle}>Anyone look like your kind of people?</Text><Text style={styles.sheetCopy}>Connect now or keep moving. You can always come back later.</Text><Pressable style={styles.primaryButton} onPress={goNext}><Text style={styles.primaryButtonText}>Continue</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable></View>
                  </View>
                ) : null}

                {step === 9 ? (
                  <View style={styles.featureStage}>
                    <View style={styles.previewHeader}><View><Text style={styles.previewKicker}>CAMPFIRES</Text><Text style={styles.previewTitle}>Find your campfire.</Text></View><Ionicons name="flame-outline" size={25} color={GOLD} /></View>
                    <Text style={styles.previewIntro}>These are smaller communities shaped by the interests and location you already chose.</Text>
                    <View style={styles.peopleList}>{groupsLoading ? <ActivityIndicator color={GOLD} /> : groupSuggestions.map((group) => <View key={group.id} style={styles.groupRow}><View style={styles.groupIcon}><Ionicons name={group.kind === 'local' ? 'location-outline' : 'flame-outline'} size={22} color={GOLD} /></View><View style={styles.flex}><Text style={styles.personName}>{group.name}</Text><Text style={styles.personMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text></View><Pressable style={[styles.joinButton, group.is_member && styles.connectButtonDone]} disabled={group.is_member || groupBusyId === group.id} onPress={() => void joinSuggestedGroup(group)}><Text style={styles.connectButtonText}>{group.is_member ? 'Joined ✓' : groupBusyId === group.id ? 'Joining…' : 'Join'}</Text></Pressable></View>)}</View>
                    <View style={styles.questionSheetCompact}><Text style={styles.sheetTitle}>Join a few to get started.</Text><Text style={styles.sheetCopy}>Your Campfire feed will begin with context instead of an empty room.</Text><Pressable style={styles.primaryButton} onPress={goNext}><Text style={styles.primaryButtonText}>Continue</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable></View>
                  </View>
                ) : null}

                {step === 10 ? (
                  <View style={styles.featureStage}>
                    <View style={styles.previewHeader}><View><Text style={styles.previewKicker}>STAY IN THE LOOP</Text><Text style={styles.previewTitle}>Never miss what matters.</Text></View><Ionicons name="notifications-outline" size={25} color={GOLD} /></View>
                    <View style={styles.notificationPreview}>{[
                      ['Adventure updates', 'Changes, reminders, new trips', 'trail-sign-outline'],
                      ['Trailmate activity', 'Requests, messages, connections', 'people-outline'],
                      ['Campfire replies', 'New posts and comments', 'flame-outline'],
                      ['Nearby activity', 'Events and local happenings', 'location-outline'],
                    ].map(([title, copy, icon]) => <View key={title} style={styles.notificationRow}><View style={styles.notificationIcon}><Ionicons name={icon as never} size={20} color={GOLD} /></View><View style={styles.flex}><Text style={styles.personName}>{title}</Text><Text style={styles.personMeta}>{copy}</Text></View></View>)}</View>
                    <View style={styles.questionSheet}>
                      <Text style={styles.sheetEyebrow}>YOUR CHOICE</Text>
                      <Text style={styles.sheetTitle}>Want us to let you know when something worth seeing happens?</Text>
                      <View style={styles.preferenceRow}><View style={styles.flex}><Text style={styles.personName}>Push notifications</Text><Text style={styles.personMeta}>Messages, adventure changes, invites, and relevant activity.</Text></View><Switch value={form.pushEnabled} onValueChange={(value) => update('pushEnabled', value)} /></View>
                      <View style={styles.preferenceRow}><View style={styles.flex}><Text style={styles.personName}>Email updates</Text><Text style={styles.personMeta}>Useful account and community updates.</Text></View><Switch value={form.emailEnabled} onValueChange={(value) => update('emailEnabled', value)} /></View>
                      <Pressable style={styles.primaryButton} onPress={() => void requestNotificationPermission()}><Text style={styles.primaryButtonText}>{notificationPermission === 'granted' ? 'Notifications enabled ✓' : 'Keep me in the loop'}</Text></Pressable>
                      <Pressable style={styles.textButton} onPress={goNext}><Text style={styles.textButtonText}>Continue</Text></Pressable>
                    </View>
                  </View>
                ) : null}

                {step === 11 ? (
                  <View style={styles.completeStage}>
                    <View style={styles.completeMark}><Ionicons name="checkmark" size={34} color={BG} /></View>
                    <Text style={styles.completeTitle}>{greetingName}, you’re in.</Text>
                    <Text style={styles.completeCopy}>Your Go Melanated is already shaped around what you told us.</Text>
                    <View style={styles.summaryCard}>
                      <View style={styles.summaryRow}><View style={styles.summaryIcon}><Ionicons name="map-outline" size={19} color={GOLD} /></View><View style={styles.flex}><Text style={styles.summaryTitle}>Trail Guide</Text><Text style={styles.summaryCopy}>{form.interests.slice(0, 3).join(', ') || 'Ready to explore'}</Text></View></View>
                      <View style={styles.summaryRow}><View style={styles.summaryIcon}><Ionicons name="location-outline" size={19} color={GOLD} /></View><View style={styles.flex}><Text style={styles.summaryTitle}>Nearby</Text><Text style={styles.summaryCopy}>{locationLabel || 'Your selected home area'}</Text></View></View>
                      <View style={styles.summaryRow}><View style={styles.summaryIcon}><Ionicons name="trail-sign-outline" size={19} color={GOLD} /></View><View style={styles.flex}><Text style={styles.summaryTitle}>Adventures</Text><Text style={styles.summaryCopy}>{form.adventurePreferences.slice(0, 2).join(' · ') || 'Ready for recommendations'}</Text></View></View>
                      <View style={styles.summaryRow}><View style={styles.summaryIcon}><Ionicons name="flame-outline" size={19} color={GOLD} /></View><View style={styles.flex}><Text style={styles.summaryTitle}>Community</Text><Text style={styles.summaryCopy}>{joinedGroupCount} campfire{joinedGroupCount === 1 ? '' : 's'} joined · {connectionSentIds.size} connection{connectionSentIds.size === 1 ? '' : 's'} started</Text></View></View>
                    </View>
                    <View style={styles.flex} />
                    <Pressable style={[styles.primaryButton, saving && styles.disabled]} disabled={saving} onPress={() => void finish()}><Text style={styles.primaryButtonText}>{saving ? 'Finishing…' : 'Start Exploring'}</Text><Ionicons name="arrow-forward" size={18} color={BG} /></Pressable>
                  </View>
                ) : null}
              </ScrollView>
            </Animated.View>

            {step > 2 && step < 11 ? (
              <Pressable style={styles.backFloating} onPress={() => setStep((value) => Math.max(1, value - 1))}><Ionicons name="chevron-back" size={18} color={TEXT} /><Text style={styles.backFloatingText}>Back</Text></Pressable>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(4,9,7,0.64)' },
  scrimLight: { backgroundColor: 'rgba(4,9,7,0.43)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 },
  bodyCopy: { color: MUTED, fontSize: 14 },
  topBar: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(5,10,8,0.34)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  brand: { color: TEXT, fontWeight: '900', letterSpacing: 1.7, fontSize: 13 },
  sectionLabel: { color: GOLD, fontWeight: '800', fontSize: 9, letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' },
  exit: { color: '#D7DEDA', fontWeight: '800', fontSize: 12 },
  stageDots: { flexDirection: 'row', gap: 5, paddingHorizontal: 20, paddingTop: 10 },
  stageDot: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.14)' },
  stageDotActive: { backgroundColor: GOLD },
  stageDotDone: { backgroundColor: 'rgba(215,180,90,0.45)' },
  content: { padding: 20, paddingBottom: 94 },
  welcomeContent: { flexGrow: 1, paddingBottom: 24 },
  welcomeWrap: { flex: 1, minHeight: 590, alignItems: 'center', paddingTop: 46 },
  welcomeMark: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: GOLD, backgroundColor: 'rgba(8,16,12,0.48)', alignItems: 'center', justifyContent: 'center' },
  welcomeBrand: { color: TEXT, fontSize: 15, fontWeight: '900', letterSpacing: 2.4, marginTop: 18 },
  welcomeHeadline: { color: TEXT, fontSize: 38, lineHeight: 44, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8, marginTop: 32, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 10 },
  welcomeCopy: { color: '#E4EAE6', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 440, marginTop: 18 },
  primaryButton: { minHeight: 54, borderRadius: 15, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 18 },
  primaryButtonText: { color: BG, fontWeight: '900', fontSize: 15 },
  disabled: { opacity: 0.42 },
  centeredStage: { flex: 1, minHeight: 590, paddingTop: 64 },
  eyebrow: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.35 },
  stageTitle: { color: TEXT, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.7, marginTop: 10 },
  stageCopy: { color: '#D6DDD9', fontSize: 14, lineHeight: 21, maxWidth: 520, marginTop: 9 },
  nameFieldWrap: { marginTop: 34, minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(8,15,12,0.8)', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: { flex: 1, color: TEXT, fontSize: 17, fontWeight: '700' },
  greeting: { color: '#F2D77C', fontSize: 14, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  appDemoStage: { gap: 14 },
  demoPreview: { minHeight: 156, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(7,14,11,0.78)', padding: 18, overflow: 'hidden' },
  demoPreviewKicker: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  demoPreviewTitle: { color: TEXT, fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 8, maxWidth: 280 },
  demoPreviewArt: { position: 'absolute', right: 20, bottom: 18, width: 78, height: 78, borderRadius: 24, backgroundColor: 'rgba(215,180,90,0.12)', alignItems: 'center', justifyContent: 'center' },
  demoList: { gap: 8 },
  demoRow: { minHeight: 68, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(8,15,12,0.72)', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  demoRowActive: { borderColor: GOLD, backgroundColor: 'rgba(30,35,20,0.88)' },
  demoIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(215,180,90,0.12)', alignItems: 'center', justifyContent: 'center' },
  demoIconActive: { backgroundColor: GOLD },
  demoRowTitle: { color: TEXT, fontSize: 14, fontWeight: '900' },
  demoRowCopy: { color: '#B9C3BD', fontSize: 11, lineHeight: 15, marginTop: 2 },
  featureStage: { gap: 14 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  previewKicker: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  previewTitle: { color: TEXT, fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.6, marginTop: 4 },
  previewIntro: { color: '#D5DDD8', fontSize: 13, lineHeight: 19 },
  previewHero: { minHeight: 146, borderRadius: 22, backgroundColor: 'rgba(7,14,11,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', padding: 18, justifyContent: 'flex-end' },
  previewHeroLabel: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  previewHeroTitle: { color: TEXT, fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 6, maxWidth: 400 },
  previewCards: { flexDirection: 'row', gap: 8 },
  previewMiniCard: { flex: 1, minHeight: 104, borderRadius: 16, backgroundColor: 'rgba(8,15,12,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12 },
  previewMiniTitle: { color: TEXT, fontSize: 12, fontWeight: '900', marginTop: 8 },
  previewMiniCopy: { color: '#AEB9B2', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  questionSheet: { borderRadius: 24, backgroundColor: 'rgba(7,13,10,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', padding: 18, gap: 14, marginTop: 4 },
  questionSheetCompact: { borderRadius: 24, backgroundColor: 'rgba(7,13,10,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', padding: 18, gap: 10, marginTop: 4 },
  sheetEyebrow: { color: GOLD, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2 },
  sheetTitle: { color: TEXT, fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.35 },
  sheetCopy: { color: '#BCC6C0', fontSize: 12, lineHeight: 18 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choicePill: { minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(20,29,24,0.84)', paddingHorizontal: 12, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  choicePillSelected: { backgroundColor: GOLD, borderColor: GOLD },
  choicePillText: { color: TEXT, fontSize: 11, fontWeight: '800' },
  choicePillTextSelected: { color: BG },
  experienceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 2 },
  locationPreview: { minHeight: 184, borderRadius: 22, backgroundColor: 'rgba(11,25,17,0.73)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  locationMapPin: { width: 50, height: 50, borderRadius: 25, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  locationPreviewTitle: { color: TEXT, fontSize: 20, fontWeight: '900', marginTop: 14 },
  locationPreviewCopy: { color: '#C5CEC8', fontSize: 11, marginTop: 5, textAlign: 'center' },
  locationButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#7BA45F', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  locationButtonText: { color: BG, fontWeight: '900', fontSize: 14 },
  orText: { color: '#8F9A93', fontSize: 10, textAlign: 'center', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  field: { gap: 6 },
  label: { color: '#E5EAE7', fontWeight: '800', fontSize: 11 },
  input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(8,15,12,0.88)', paddingHorizontal: 14, color: TEXT, fontSize: 14 },
  autocomplete: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#09110D', borderRadius: 13, overflow: 'hidden' },
  autoRow: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  autoText: { color: TEXT, fontWeight: '700' },
  autoMeta: { color: GOLD, fontWeight: '900', fontSize: 10 },
  adventureList: { gap: 9 },
  adventureCard: { minHeight: 76, borderRadius: 16, backgroundColor: 'rgba(8,15,12,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  previewHighlighted: { borderColor: GOLD },
  adventureImage: { width: 54, height: 54, borderRadius: 14, backgroundColor: 'rgba(215,180,90,0.12)', alignItems: 'center', justifyContent: 'center' },
  adventureTitle: { color: TEXT, fontSize: 14, fontWeight: '900' },
  adventureMeta: { color: '#B3BDB7', fontSize: 10.5, marginTop: 3 },
  outpostPost: { borderRadius: 20, backgroundColor: 'rgba(8,15,12,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postMeta: { color: '#AAB5AE', fontSize: 10 },
  postText: { color: TEXT, fontSize: 13, lineHeight: 19, marginTop: 12 },
  postPhoto: { minHeight: 120, borderRadius: 14, backgroundColor: 'rgba(215,180,90,0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  postStats: { flexDirection: 'row', gap: 16, marginTop: 10 },
  peopleList: { gap: 9 },
  personRow: { minHeight: 72, borderRadius: 16, backgroundColor: 'rgba(8,15,12,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: BG, fontWeight: '900', fontSize: 14 },
  personName: { color: TEXT, fontWeight: '900', fontSize: 13 },
  personMeta: { color: '#B1BBB5', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  personInterests: { color: '#D6BD6A', fontSize: 9.5, marginTop: 3 },
  connectButton: { minWidth: 74, minHeight: 36, borderRadius: 11, backgroundColor: '#7BA7D6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  joinButton: { minWidth: 68, minHeight: 36, borderRadius: 11, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  connectButtonDone: { backgroundColor: '#3A463F' },
  connectButtonText: { color: BG, fontWeight: '900', fontSize: 10.5 },
  emptyCard: { borderRadius: 18, backgroundColor: 'rgba(8,15,12,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16 },
  cardTitle: { color: TEXT, fontWeight: '900', fontSize: 16 },
  cardCopy: { color: '#BBC5BF', fontSize: 11, lineHeight: 17, marginTop: 4 },
  groupRow: { minHeight: 66, borderRadius: 16, backgroundColor: 'rgba(8,15,12,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(215,180,90,0.12)', alignItems: 'center', justifyContent: 'center' },
  notificationPreview: { gap: 8 },
  notificationRow: { minHeight: 62, borderRadius: 15, backgroundColor: 'rgba(8,15,12,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(215,180,90,0.12)', alignItems: 'center', justifyContent: 'center' },
  preferenceRow: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(15,23,19,0.72)', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  textButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { color: '#D0D8D3', fontWeight: '800', fontSize: 12 },
  completeStage: { flex: 1, minHeight: 600, alignItems: 'center', paddingTop: 50 },
  completeMark: { width: 66, height: 66, borderRadius: 33, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  completeTitle: { color: TEXT, fontSize: 35, lineHeight: 40, fontWeight: '900', textAlign: 'center', letterSpacing: -0.7, marginTop: 22 },
  completeCopy: { color: '#E1E7E3', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 440, marginTop: 8 },
  summaryCard: { width: '100%', borderRadius: 22, backgroundColor: 'rgba(8,15,12,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', padding: 10, marginTop: 24 },
  summaryRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.09)' },
  summaryIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(215,180,90,0.11)', alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { color: TEXT, fontWeight: '900', fontSize: 13 },
  summaryCopy: { color: '#B8C2BC', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  backFloating: { position: 'absolute', left: 18, bottom: 16, minHeight: 38, borderRadius: 999, backgroundColor: 'rgba(5,10,8,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 3 },
  backFloatingText: { color: TEXT, fontWeight: '800', fontSize: 11 },
});
