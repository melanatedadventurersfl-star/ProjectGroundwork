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
  type ImageSourcePropType,
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
import { requestConnection } from '../social/api';
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

const GOLD = '#E7BD55';
const BG = '#07100C';
const TEXT = '#FFF9EC';
const MUTED = '#B6C0BA';
const SURFACE = '#0C1712';
const SURFACE_2 = '#132019';
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

const PREVIEW_IMAGES = {
  trailhead: require('../../assets/onboarding/onboarding-plan.jpg'),
  people: require('../../assets/onboarding/onboarding-people.jpg'),
  places: require('../../assets/onboarding/onboarding-places.jpg'),
  share: require('../../assets/onboarding/onboarding-share.jpg'),
} as const;

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

type PrimaryProps = { label?: string; disabled?: boolean; onPress: () => void };
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

function PreviewHero({ image, kicker, title, copy }: { image: ImageSourcePropType; kicker: string; title: string; copy: string }) {
  return (
    <ImageBackground source={image} style={styles.heroCard} imageStyle={styles.heroImage} resizeMode="cover">
      <View style={styles.heroShade} />
      <View style={styles.heroTextBlock}>
        <Text style={styles.cardKicker}>{kicker}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.cardCopy}>{copy}</Text>
      </View>
    </ImageBackground>
  );
}

function PreviewTile({ image, kicker, title, copy }: { image?: ImageSourcePropType; kicker: string; title: string; copy?: string }) {
  const body = (
    <>
      {image ? <View style={styles.tileShade} /> : null}
      <View style={styles.tileTextBlock}>
        <Text style={styles.cardKicker}>{kicker}</Text>
        <Text style={styles.previewTitle}>{title}</Text>
        {copy ? <Text style={styles.tileCopy}>{copy}</Text> : null}
      </View>
    </>
  );
  if (image) return <ImageBackground source={image} style={styles.previewCard} imageStyle={styles.previewImage}>{body}</ImageBackground>;
  return <View style={[styles.previewCard, styles.previewCardPlain]}>{body}</View>;
}

function AppChrome({ active, children, name }: { active: SectionName; children: React.ReactNode; name: string }) {
  return (
    <View style={styles.appFrame}>
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.appSection}>{active}</Text>
          <Text style={styles.appGreeting}>Good morning, {name}</Text>
        </View>
        <View style={styles.bellButton}><Ionicons name="notifications-outline" size={21} color={TEXT} /></View>
      </View>
      <View style={styles.appBody}>{children}</View>
      <View style={styles.bottomNav}>
        {[
          ['Trailhead', 'home-outline'],
          ['Adventures', 'trail-sign-outline'],
          ['Trail Guide', 'map-outline'],
          ['Outpost', 'chatbubbles-outline'],
          ['Campfires', 'flame-outline'],
        ].map(([label, icon]) => {
          const selected = active === label || (active === 'Trailmates' && label === 'Outpost');
          return (
            <View key={label} style={styles.navItem}>
              <View style={[styles.navIconWrap, selected && styles.navIconWrapActive]}><Ionicons name={icon as never} size={18} color={selected ? GOLD : '#79857E'} /></View>
              <Text style={[styles.navText, selected && styles.navTextActive]}>{label === 'Trail Guide' ? 'Guide' : label}</Text>
            </View>
          );
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
  const appStep = step >= 4 && step !== 14;

  return (
    <ImageBackground source={BACKGROUNDS[step - 1]} style={styles.background} resizeMode="cover">
      <View style={[styles.scrim, appStep && styles.scrimApp, step >= 14 && styles.scrimLight]}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {step > 1 ? <View style={[styles.topBar, appStep && styles.topBarApp]}><Text style={styles.brand}>GO MELANATED</Text>{wasAlreadyComplete ? <Pressable onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.exit}>Exit replay</Text></Pressable> : null}</View> : null}
            <Progress step={step} />
            <Animated.View style={[styles.flex, animatedStyle]}>
              <ScrollView style={styles.flex} contentContainerStyle={[styles.content, step === 1 && styles.fill, appStep && styles.appContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {step === 1 ? <View style={styles.welcome}><View style={styles.logo}><Ionicons name="trail-sign-outline" size={30} color={GOLD} /></View><Text style={styles.welcomeBrand}>GO MELANATED</Text><Text style={styles.welcomeTitle}>Find your people.{`\n`}Find your outside.</Text><Text style={styles.welcomeCopy}>Discover places, find adventures, learn, connect, and get outside with a community built for us.</Text><View style={styles.flex} /><Primary label="Get Started" onPress={next} /></View> : null}

                {step === 2 ? <View style={styles.nameStage}><Text style={styles.eyebrow}>FIRST THINGS FIRST</Text><Text style={styles.bigTitle}>What should we call you?</Text><Text style={styles.copy}>We will personalize the tour as we go.</Text><View style={styles.nameField}><Ionicons name="person-outline" size={18} color={GOLD} /><TextInput autoFocus style={styles.nameInput} value={form.displayName} placeholder="Your name" placeholderTextColor="#77817C" onChangeText={(value) => update('displayName', value)} /></View>{form.displayName.trim() ? <Text style={styles.hello}>👋 Good to meet you, {form.displayName.trim()}.</Text> : null}<View style={styles.flex} /><Primary disabled={!canContinue} onPress={next} /></View> : null}

                {step === 3 ? <View style={styles.stack}><Text style={styles.eyebrow}>HERE IS YOUR GO MELANATED</Text><Text style={styles.bigTitle}>Everything works together.</Text><Text style={styles.copy}>We will walk through the app the same way you will use it, starting from your Trailhead.</Text><View style={styles.sectionList}>{APP_SECTIONS.map(([name, icon, copy]) => <Pressable key={name} onPress={() => setTourSection(name as SectionName)}><SectionCard icon={icon} title={name} copy={copy} active={tourSection === name} /></Pressable>)}</View><Primary label="Take the tour" onPress={next} /></View> : null}

                {step === 4 ? <AppChrome active="Trailhead" name={greetingName}><PreviewHero image={PREVIEW_IMAGES.trailhead} kicker="UPCOMING ADVENTURE" title="Weekend Camping Trip" copy="A few days outside, good people, and room around the fire." /><View style={styles.previewGrid}><PreviewTile image={PREVIEW_IMAGES.places} kicker="NEAR YOU" title="Places worth exploring" /><PreviewTile kicker="FOR YOU" title="Beginner hiking tips" copy="Helpful guides without the gatekeeping." /></View><View style={styles.guideBubble}><View style={styles.guideIcon}><Ionicons name="home-outline" size={18} color={GOLD} /></View><View style={styles.guideText}><Text style={styles.guideBubbleTitle}>This is your Trailhead.</Text><Text style={styles.guideBubbleCopy}>Your home base for adventures, nearby finds, useful guides, and community activity.</Text></View><Primary label="Make it mine" onPress={next} /></View></AppChrome> : null}

                {step === 5 ? <AppChrome active="Trailhead" name={greetingName}><PreviewHero image={PREVIEW_IMAGES.trailhead} kicker="UPCOMING FOR YOU" title={form.interests.includes('Camping') ? 'Camp under the stars' : 'Find your next outside day'} copy="Your choices below change what rises to the top." /><View style={styles.previewGrid}><PreviewTile image={PREVIEW_IMAGES.places} kicker="FOR YOU" title={form.interests[0] || 'Outdoor ideas'} /><PreviewTile kicker="TRY NEXT" title={form.interests[1] || 'Something new'} /></View><QuestionSheet eyebrow="MAKE IT YOURS" title="What are you into?" label="Update my Trailhead" disabled={!canContinue} onPress={next}><View style={styles.pills}>{INTEREST_OPTIONS.map((interest) => <ChoicePill key={interest} label={interest} selected={form.interests.includes(interest)} onPress={() => toggleList('interests', interest)} />)}</View></QuestionSheet></AppChrome> : null}

                {step === 6 ? <AppChrome active="Trailhead" name={greetingName}><Text style={styles.sectionHeading}>Your Trailhead, personalized.</Text><PreviewHero image={PREVIEW_IMAGES.trailhead} kicker="UPCOMING FOR YOU" title={form.interests.includes('Camping') ? 'Sunrise Campout' : `${form.interests[0] || 'Outdoor'} weekend`} copy={`Recommendations now lean toward ${form.interests.slice(0, 3).join(', ').toLowerCase()}.`} /><View style={styles.previewGrid}><PreviewTile image={PREVIEW_IMAGES.places} kicker="TRAIL GUIDE" title={form.interests[0] || 'Explore'} /><PreviewTile kicker="NEARBY" title="Add your location next" /></View><Primary label="Show me the Trail Guide" onPress={next} /></AppChrome> : null}

                {step === 7 ? <AppChrome active="Trail Guide" name={greetingName}><Text style={styles.sectionHeading}>Find your outside.</Text><PreviewHero image={PREVIEW_IMAGES.places} kicker="TRAIL GUIDE" title={locationLabel || 'Choose where to explore'} copy="Nearby recommendations get better when we know where to start." /><QuestionSheet eyebrow="TRAIL GUIDE" title="Where should we start exploring?" label="Explore from here" disabled={!canContinue} onPress={next}><Pressable style={styles.locationButton} onPress={() => void requestCurrentLocation()} disabled={locating}><Ionicons name="navigate" size={18} color={BG} /><Text style={styles.locationButtonText}>{locating ? 'Finding you…' : 'Use my location'}</Text></Pressable><Text style={styles.or}>or choose a city</Text><View style={styles.field}><Text style={styles.label}>State</Text><TextInput style={styles.input} value={stateSearch} placeholder="Start typing your state" placeholderTextColor="#78837D" onFocus={() => setStateOpen(true)} onChangeText={(value) => { setStateSearch(value); setStateOpen(true); update('homeState', ''); update('homeCity', ''); setCitySearch(''); }} />{stateOptions.length ? <View style={styles.autocomplete}>{stateOptions.map((state) => <Pressable key={state.abbreviation} style={styles.autoRow} onPress={() => { setStateSearch(state.name); update('homeState', state.abbreviation); update('homeCity', ''); setCitySearch(''); setStateOpen(false); }}><Text style={styles.autoText}>{state.name}</Text><Text style={styles.autoMeta}>{state.abbreviation}</Text></Pressable>)}</View> : null}</View><View style={styles.field}><Text style={styles.label}>City</Text><TextInput style={styles.input} editable={Boolean(form.homeState) && !citiesLoading} value={citySearch} placeholder={form.homeState ? 'Start typing your city' : 'Choose a state first'} placeholderTextColor="#78837D" onChangeText={(value) => { setCitySearch(value); update('homeCity', ''); }} />{cityOptions.length ? <View style={styles.autocomplete}>{cityOptions.map((city) => <Pressable key={city} style={styles.autoRow} onPress={() => { setCitySearch(city); update('homeCity', city); }}><Text style={styles.autoText}>{city}</Text></Pressable>)}</View> : null}</View></QuestionSheet></AppChrome> : null}

                {step === 8 ? <AppChrome active="Trail Guide" name={greetingName}><Text style={styles.sectionHeading}>Around {locationLabel || 'you'}</Text><View style={styles.chipRow}>{['Nearby', 'Trails', 'Camping', 'Water'].map((item) => <View key={item} style={[styles.smallChip, item === 'Nearby' && styles.smallChipActive]}><Text style={styles.smallChipText}>{item}</Text></View>)}</View><PreviewHero image={PREVIEW_IMAGES.places} kicker="RECOMMENDED FOR YOU" title={form.interests.includes('Water adventures') ? 'A spring worth the drive' : 'A trail for your next free morning'} copy="Trail Guide is now combining your location with what you told us you enjoy." /><Primary label="Show me Adventures" onPress={next} /></AppChrome> : null}

                {step === 9 ? <AppChrome active="Adventures" name={greetingName}><Text style={styles.sectionHeading}>Adventures you can join.</Text><View style={styles.adventureList}>{[['Lake Louisa Camping Trip','Weekend · Clermont, FL'],['Beginner Hike & Picnic','Day trip · Orlando, FL'],['Silver Springs Kayak Tour','Water · Ocala, FL']].map(([title, meta], index) => <View key={title} style={[styles.adventureRow, form.adventurePreferences.length > 0 && index === 0 && styles.rowHighlighted]}><ImageBackground source={index === 2 ? PREVIEW_IMAGES.places : PREVIEW_IMAGES.trailhead} style={styles.thumb} imageStyle={styles.thumbImage}><View style={styles.thumbShade} /><Ionicons name={index === 2 ? 'boat-outline' : 'bonfire-outline'} size={21} color={TEXT} /></ImageBackground><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{meta}</Text></View></View>)}</View><QuestionSheet eyebrow="ADVENTURES" title="Which kinds should we keep an eye out for?" label="Show me these adventures" disabled={!canContinue} onPress={next}><View style={styles.pills}>{ADVENTURE_PREFERENCE_OPTIONS.map((preference) => <ChoicePill key={preference} label={preference} selected={form.adventurePreferences.includes(preference)} onPress={() => toggleList('adventurePreferences', preference)} />)}</View></QuestionSheet></AppChrome> : null}

                {step === 10 ? <AppChrome active="Outpost" name={greetingName}><Text style={styles.sectionHeading}>The community, outside.</Text><View style={styles.post}><View style={styles.postHeader}><View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>TR</Text></View><View><Text style={styles.rowTitle}>Tasha R.</Text><Text style={styles.rowMeta}>{locationLabel || 'Nearby'} · 2h</Text></View></View><Text style={styles.postText}>Sunset hike was everything. Anybody else getting outside this weekend?</Text><ImageBackground source={PREVIEW_IMAGES.share} style={styles.postPhoto} imageStyle={styles.postPhotoImage}><View style={styles.postPhotoShade} /></ImageBackground></View><QuestionSheet eyebrow="OUTPOST" title="What are you hoping to get out of the community?" label="Shape my Outpost" disabled={!canContinue} onPress={next}><View style={styles.pills}>{INTENT_OPTIONS.map((intent) => <ChoicePill key={intent} label={intent} selected={form.intents.includes(intent)} onPress={() => toggleList('intents', intent)} />)}</View></QuestionSheet></AppChrome> : null}

                {step === 11 ? <AppChrome active="Trailmates" name={greetingName}><Text style={styles.sectionHeading}>Find people to get outside with.</Text>{suggestionsLoading ? <ActivityIndicator color={GOLD} /> : <View style={styles.people}>{suggestions.slice(0, 4).map((person) => <View key={person.id} style={styles.personRow}><Avatar person={person} /><View style={styles.flex}><Text style={styles.rowTitle}>{person.display_name || person.username || 'Go Melanated member'}</Text><Text style={styles.rowMeta}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Community member'}</Text><Text style={styles.interestMeta}>{person.interests?.slice(0, 2).join(' · ') || 'Outside · Community'}</Text></View><Pressable style={[styles.connect, connectionSentIds.has(person.id) && styles.done]} disabled={connectionSentIds.has(person.id) || connectingId === person.id} onPress={() => void connect(person)}><Text style={styles.connectText}>{connectionSentIds.has(person.id) ? 'Requested' : 'Connect'}</Text></Pressable></View>)}</View>}<View style={styles.guideBubble}><View style={styles.guideIcon}><Ionicons name="people-outline" size={18} color={GOLD} /></View><View style={styles.guideText}><Text style={styles.guideBubbleTitle}>Want to start your circle?</Text><Text style={styles.guideBubbleCopy}>Connect if somebody feels like your kind of people. Skipping is completely fine.</Text></View><Primary onPress={next} /></View></AppChrome> : null}

                {step === 12 ? <AppChrome active="Campfires" name={greetingName}><Text style={styles.sectionHeading}>Smaller circles, shared interests.</Text>{groupsLoading ? <ActivityIndicator color={GOLD} /> : <View style={styles.people}>{groupSuggestions.map((group) => <View key={group.id} style={styles.groupRow}><View style={styles.groupIcon}><Ionicons name={group.kind === 'local' ? 'map-outline' : 'flame-outline'} size={20} color={GOLD} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{group.name}</Text><Text style={styles.rowMeta}>{group.member_count} members</Text></View><Pressable style={[styles.join, group.is_member && styles.done]} disabled={group.is_member || groupBusyId === group.id} onPress={() => void joinSuggestedGroup(group)}><Text style={styles.connectText}>{group.is_member ? 'Joined ✓' : 'Join'}</Text></Pressable></View>)}</View>}<View style={styles.guideBubble}><View style={styles.guideIcon}><Ionicons name="flame-outline" size={18} color={GOLD} /></View><View style={styles.guideText}><Text style={styles.guideBubbleTitle}>A few that may fit you.</Text><Text style={styles.guideBubbleCopy}>These already use the interests and location you picked earlier.</Text></View><Primary onPress={next} /></View></AppChrome> : null}

                {step === 13 ? <AppChrome active="Trailhead" name={greetingName}><Text style={styles.sectionHeading}>Stay in the loop.</Text><View style={styles.noticeList}>{[['Adventure updates','Changes, reminders, new trips','trail-sign-outline'],['Trailmate activity','Requests, messages, connections','people-outline'],['Campfire replies','New posts and comments','flame-outline'],['Nearby activity','Events and local happenings','map-outline']].map(([title, copy, icon]) => <View key={title} style={styles.noticeRow}><View style={styles.noticeIcon}><Ionicons name={icon as never} size={18} color={GOLD} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{copy}</Text></View></View>)}</View><View style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Want us to keep you in the loop?</Text><View style={styles.preference}><View style={styles.flex}><Text style={styles.rowTitle}>Push notifications</Text><Text style={styles.rowMeta}>Relevant activity, messages, and adventure updates.</Text></View><Switch value={form.pushEnabled} onValueChange={(value) => update('pushEnabled', value)} /></View><View style={styles.preference}><View style={styles.flex}><Text style={styles.rowTitle}>Email updates</Text><Text style={styles.rowMeta}>Useful account and community updates.</Text></View><Switch value={form.emailEnabled} onValueChange={(value) => update('emailEnabled', value)} /></View><Primary label={notificationPermission === 'granted' ? 'Notifications enabled ✓' : 'Keep me in the loop'} onPress={() => void requestNotificationPermission()} /><Pressable style={styles.textButton} onPress={next}><Text style={styles.textButtonText}>Continue</Text></Pressable></View></AppChrome> : null}

                {step === 14 ? <View style={styles.complete}><View style={styles.completeIcon}><Ionicons name="checkmark" size={32} color={BG} /></View><Text style={styles.completeTitle}>You are in, {greetingName}.</Text><Text style={styles.completeCopy}>Here is what your Go Melanated now knows about you.</Text><View style={styles.summary}><SectionCard icon="home-outline" title="Trailhead" copy={`Built around ${form.interests.slice(0, 3).join(', ') || 'your interests'}`} /><SectionCard icon="trail-sign-outline" title="Adventures" copy={form.adventurePreferences.slice(0, 3).join(' · ') || 'Ready for recommendations'} /><SectionCard icon="map-outline" title="Trail Guide" copy={`Exploring around ${locationLabel || 'your area'}`} /><SectionCard icon="flame-outline" title="Campfires" copy={`${joinedGroupCount} joined · ${connectionSentIds.size} Trailmate connection${connectionSentIds.size === 1 ? '' : 's'} started`} /></View><Primary label="See my Trailhead" onPress={next} /></View> : null}

                {step === 15 ? <AppChrome active="Trailhead" name={greetingName}><Text style={styles.sectionHeading}>Your Trailhead is ready.</Text><PreviewHero image={PREVIEW_IMAGES.trailhead} kicker="UPCOMING FOR YOU" title={form.adventurePreferences.includes('Camping trips') ? 'Lake Louisa Camping Trip' : 'Your next adventure is waiting'} copy="Recommendations are now tuned to your interests, location, and adventure preferences." /><View style={styles.previewGrid}><PreviewTile image={PREVIEW_IMAGES.places} kicker="TRAIL GUIDE" title={`${locationLabel || 'Nearby'} ideas`} /><PreviewTile kicker="COMMUNITY" title={`${joinedGroupCount || 'New'} Campfires`} /></View><View style={styles.guideBubble}><View style={styles.guideIcon}><Ionicons name="checkmark" size={18} color={GOLD} /></View><View style={styles.guideText}><Text style={styles.guideBubbleTitle}>That is it.</Text><Text style={styles.guideBubbleCopy}>You have already been using the app. From here we simply remove the guide layer.</Text></View><Primary label={saving ? 'Finishing…' : 'Explore my Trailhead'} disabled={saving} onPress={() => void finish()} /></View></AppChrome> : null}
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
  background: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(4,9,7,0.66)' },
  scrimApp: { backgroundColor: 'rgba(4,9,7,0.42)' },
  scrimLight: { backgroundColor: 'rgba(4,9,7,0.48)' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  muted: { color: MUTED },
  topBar: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(4,9,7,0.4)' },
  topBarApp: { minHeight: 44, backgroundColor: '#08110D', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.07)' },
  brand: { color: TEXT, fontWeight: '900', letterSpacing: 1.6, fontSize: 13 },
  exit: { color: MUTED, fontSize: 11, fontWeight: '800' },
  progressRail: { flexDirection: 'row', gap: 3, paddingHorizontal: 18, paddingTop: 7, paddingBottom: 5, backgroundColor: 'rgba(7,16,12,0.96)' },
  progressSegment: { flex: 1, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.11)' },
  progressSegmentActive: { backgroundColor: GOLD },
  content: { padding: 18, paddingBottom: 82 },
  appContent: { padding: 0, paddingBottom: 54, backgroundColor: BG },
  fill: { flexGrow: 1, paddingBottom: 22 },
  stack: { gap: 14 },
  welcome: { flex: 1, minHeight: 590, alignItems: 'center', paddingTop: 42 },
  logo: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: GOLD, backgroundColor: 'rgba(6,13,10,0.54)', alignItems: 'center', justifyContent: 'center' },
  welcomeBrand: { color: TEXT, fontSize: 15, fontWeight: '900', letterSpacing: 2.3, marginTop: 17 },
  welcomeTitle: { color: TEXT, fontSize: 38, lineHeight: 44, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8, marginTop: 34 },
  welcomeCopy: { color: '#E4EAE6', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420, marginTop: 16 },
  primary: { minHeight: 52, borderRadius: 15, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  primaryText: { color: BG, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  nameStage: { flex: 1, minHeight: 590, paddingTop: 64 },
  eyebrow: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  bigTitle: { color: TEXT, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.7, marginTop: 9 },
  copy: { color: '#D4DCD7', fontSize: 13, lineHeight: 19, marginTop: 7 },
  nameField: { minHeight: 56, marginTop: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(7,14,11,0.82)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  nameInput: { flex: 1, color: TEXT, fontSize: 16, fontWeight: '700' },
  hello: { color: '#F0D374', textAlign: 'center', marginTop: 17, fontWeight: '800' },
  sectionList: { gap: 8 },
  sectionCard: { minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(8,15,12,0.82)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionCardActive: { borderColor: GOLD, backgroundColor: 'rgba(34,34,18,0.9)' },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(225,185,79,0.12)', alignItems: 'center', justifyContent: 'center' },
  sectionIconActive: { backgroundColor: GOLD },
  sectionCardTitle: { color: TEXT, fontWeight: '900', fontSize: 13 },
  sectionCardCopy: { color: '#AFBAB3', fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  appFrame: { flex: 1, minHeight: 650, backgroundColor: BG },
  appHeader: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG },
  appSection: { color: TEXT, fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9 },
  appGreeting: { color: '#98A49D', fontSize: 12, marginTop: 3 },
  bellButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: SURFACE_2, alignItems: 'center', justifyContent: 'center' },
  appBody: { paddingHorizontal: 16, paddingBottom: 18, gap: 13 },
  bottomNav: { marginTop: 'auto', minHeight: 66, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: '#08110D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, paddingBottom: 2 },
  navItem: { alignItems: 'center', gap: 3, minWidth: 56 },
  navIconWrap: { minWidth: 34, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: 'rgba(231,189,85,0.11)' },
  navText: { color: '#79857E', fontSize: 9, fontWeight: '700' },
  navTextActive: { color: GOLD },
  sectionHeading: { color: TEXT, fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.7, marginTop: 2 },
  heroCard: { minHeight: 210, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: SURFACE_2 },
  heroImage: { borderRadius: 24 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,9,7,0.42)' },
  heroTextBlock: { padding: 18, paddingTop: 70 },
  cardKicker: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: TEXT, fontSize: 24, lineHeight: 28, fontWeight: '900', marginTop: 6, letterSpacing: -0.4 },
  cardCopy: { color: '#E2E8E4', fontSize: 12, lineHeight: 17, marginTop: 6 },
  previewGrid: { flexDirection: 'row', gap: 10 },
  previewCard: { flex: 1, minHeight: 128, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: SURFACE_2 },
  previewCardPlain: { backgroundColor: SURFACE_2 },
  previewImage: { borderRadius: 20 },
  tileShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,9,7,0.38)' },
  tileTextBlock: { padding: 13, minHeight: 128, justifyContent: 'flex-end' },
  previewTitle: { color: TEXT, fontWeight: '900', fontSize: 15, lineHeight: 19, marginTop: 5 },
  tileCopy: { color: '#AEB9B2', fontSize: 10, lineHeight: 14, marginTop: 5 },
  guideBubble: { borderRadius: 22, backgroundColor: '#101A15', padding: 16, gap: 11, borderWidth: 1, borderColor: 'rgba(231,189,85,0.18)' },
  guideIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(231,189,85,0.1)', alignItems: 'center', justifyContent: 'center' },
  guideText: { gap: 4 },
  guideBubbleTitle: { color: TEXT, fontWeight: '900', fontSize: 18 },
  guideBubbleCopy: { color: '#BCC6C0', fontSize: 12, lineHeight: 17 },
  sheet: { marginHorizontal: -16, marginBottom: -18, marginTop: 2, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#101A15', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20, gap: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 4 },
  sheetEyebrow: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sheetTitle: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choicePill: { minHeight: 39, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#18241D', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5 },
  choicePillSelected: { backgroundColor: GOLD, borderColor: GOLD },
  choicePillText: { color: TEXT, fontSize: 11, fontWeight: '800' },
  choicePillTextSelected: { color: BG },
  locationButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#88A866', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  locationButtonText: { color: BG, fontWeight: '900', fontSize: 13 },
  or: { color: '#849088', textAlign: 'center', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  field: { gap: 5 },
  label: { color: '#DDE3DF', fontSize: 10.5, fontWeight: '800' },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#08110D', paddingHorizontal: 12, color: TEXT, fontSize: 13 },
  autocomplete: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#09120E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  autoRow: { minHeight: 41, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  autoText: { color: TEXT, fontWeight: '700' },
  autoMeta: { color: GOLD, fontWeight: '900', fontSize: 9 },
  chipRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  smallChip: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: SURFACE_2, paddingHorizontal: 11, paddingVertical: 7 },
  smallChipActive: { backgroundColor: '#476C39', borderColor: '#476C39' },
  smallChipText: { color: TEXT, fontSize: 9, fontWeight: '800' },
  adventureList: { gap: 9 },
  adventureRow: { minHeight: 76, borderRadius: 18, backgroundColor: SURFACE, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowHighlighted: { backgroundColor: '#17231B' },
  thumb: { width: 58, height: 58, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImage: { borderRadius: 15 },
  thumbShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,9,7,0.42)' },
  rowTitle: { color: TEXT, fontSize: 13, fontWeight: '900' },
  rowMeta: { color: '#AEB8B2', fontSize: 10, lineHeight: 14, marginTop: 3 },
  post: { borderRadius: 20, backgroundColor: SURFACE, padding: 13 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  postText: { color: TEXT, fontSize: 12, lineHeight: 18, marginTop: 11 },
  postPhoto: { minHeight: 180, borderRadius: 16, overflow: 'hidden', marginTop: 12 },
  postPhotoImage: { borderRadius: 16 },
  postPhotoShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,9,7,0.14)' },
  people: { gap: 8 },
  personRow: { minHeight: 72, borderRadius: 17, backgroundColor: SURFACE, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: BG, fontWeight: '900', fontSize: 13 },
  interestMeta: { color: '#D2B969', fontSize: 8.5, marginTop: 2 },
  connect: { minWidth: 70, minHeight: 34, borderRadius: 11, backgroundColor: '#7EA8D0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  join: { minWidth: 62, minHeight: 34, borderRadius: 11, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  done: { backgroundColor: '#39453F' },
  connectText: { color: BG, fontSize: 9.5, fontWeight: '900' },
  groupRow: { minHeight: 68, borderRadius: 17, backgroundColor: SURFACE, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  groupIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(231,189,85,0.1)', alignItems: 'center', justifyContent: 'center' },
  noticeList: { gap: 8 },
  noticeRow: { minHeight: 62, borderRadius: 16, backgroundColor: SURFACE, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(231,189,85,0.1)', alignItems: 'center', justifyContent: 'center' },
  preference: { minHeight: 62, borderRadius: 14, backgroundColor: '#15211A', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  textButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { color: '#C7D0CB', fontSize: 10.5, fontWeight: '800' },
  complete: { flex: 1, minHeight: 600, alignItems: 'center', paddingTop: 44 },
  completeIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  completeTitle: { color: TEXT, fontSize: 32, lineHeight: 37, fontWeight: '900', textAlign: 'center', marginTop: 19 },
  completeCopy: { color: '#DBE2DE', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  summary: { width: '100%', gap: 7, marginTop: 20, marginBottom: 18 },
  back: { position: 'absolute', left: 14, bottom: 12, minHeight: 36, borderRadius: 999, backgroundColor: 'rgba(7,16,12,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: TEXT, fontSize: 10.5, fontWeight: '800' },
});