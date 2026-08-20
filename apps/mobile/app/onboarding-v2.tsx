import Ionicons from '@react-native-vector-icons/ionicons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  INITIAL_ONBOARDING_FORM,
  INTENT_OPTIONS,
  INTEREST_OPTIONS,
  type ExperienceLevel,
  type OnboardingForm,
} from '../src/onboarding/types';
import { requestConnection } from '../src/social/api';

const GOLD = '#D7B45A';
const BG = '#0B120F';
const TEXT = '#FFF8E8';
const MUTED = '#B8C1BC';
const TOTAL_STEPS = 11;

const BACKGROUNDS = [
  require('../assets/onboarding/onboarding-welcome.jpg'),
  require('../assets/onboarding/onboarding-places.jpg'),
  require('../assets/onboarding/onboarding-plan.jpg'),
  require('../assets/onboarding/onboarding-places.jpg'),
  require('../assets/onboarding/onboarding-people.jpg'),
  require('../assets/onboarding/onboarding-people.jpg'),
  require('../assets/onboarding/onboarding-people.jpg'),
  require('../assets/onboarding/onboarding-share.jpg'),
  require('../assets/onboarding/onboarding-share.jpg'),
  require('../assets/onboarding/onboarding-plan.jpg'),
  require('../assets/onboarding/onboarding-complete.jpg'),
] as const;

const STEP_META = [
  ['WELCOME', 'Find your people. Find your outside.', 'Go Melanated starts with a few choices so Home feels useful the moment you arrive.'],
  ['YOUR OUTSIDE', 'What does outside look like for you?', 'Pick everything that feels like you. There is no minimum experience required to belong here.'],
  ['YOUR WHY', 'What brought you here?', 'Tell us what you want Go Melanated to help you do.'],
  ['NEARBY', 'What is happening around you?', 'Your home area helps surface nearby people, adventures, groups, posts, and places.'],
  ['COMMUNITY', 'Your people are already here.', 'See a live glimpse of the community before you ever reach the feed.'],
  ['PROFILE', 'How should people know you?', 'Give the community a name to call you and enough context to make your profile feel human.'],
  ['YOUR CIRCLE', 'Start with a few Trailmates.', 'Connections are optional. We recommend people from the community directory.'],
  ['COMMUNITIES', 'Pick a few campfires.', 'Join communities that match your interests so your feed starts with useful context.'],
  ['INVITES', 'Outside is better with your people.', 'Your unique invites stay tied to you, so you can bring someone along now or later.'],
  ['STAY IN THE LOOP', 'Do not miss the plan.', 'Choose how you want to hear about messages, adventures, invitations, and replies.'],
  ['READY', 'You are in. Let us get outside.', 'Your Go Melanated experience is ready.'],
] as const;

const EXPERIENCE_COPY: Record<ExperienceLevel, string> = {
  new: 'Just getting started',
  beginner: 'Building confidence',
  intermediate: 'Comfortable outside',
  experienced: 'Seasoned adventurer',
};

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
  const [inviteCount, setInviteCount] = useState(0);
  const [openInvitesAfterFinish, setOpenInvitesAfterFinish] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleList = (key: 'interests' | 'intents', value: string) => setForm((current) => {
    const list = current[key];
    return { ...current, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] };
  });

  useEffect(() => {
    let active = true;
    async function load() {
      if (!userId) return setLoading(false);
      const [profile, identity, invites] = await Promise.all([
        loadOnboardingProfile(userId),
        supabase.from('profiles').select('username').eq('id', userId).single(),
        supabase.from('member_invites').select('id', { count: 'exact', head: true }).eq('sender_profile_id', userId).eq('status', 'available'),
      ]);
      if (!active) return;
      if (identity.error) throw identity.error;
      const communication = (profile.communication_preferences ?? {}) as Record<string, unknown>;
      const intents = Array.isArray(communication.discovery_intents)
        ? communication.discovery_intents.filter((value): value is string => typeof value === 'string') : [];
      setUsername(identity.data?.username ?? null);
      setInviteCount(invites.count ?? 0);
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
    if (!userId || step < 5) return;
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
    if (step < 8) return;
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
    if (step === 2) return form.interests.length > 0;
    if (step === 3) return form.intents.length > 0;
    if (step === 4) return Boolean(form.homeState.trim() && form.homeCity.trim());
    if (step === 6) return Boolean(form.firstName.trim() && form.lastName.trim() && form.displayName.trim());
    return true;
  }, [form, step]);

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
      update('homeState', state.abbreviation); update('homeCity', city); setStateSearch(state.name); setCitySearch(city); setStateOpen(false);
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
      setNotificationPermission(permission.status); update('pushEnabled', permission.status === 'granted');
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
      communication_preferences: { push: form.pushEnabled, email: form.emailEnabled, sms: form.smsEnabled, discovery_intents: form.intents },
    }).eq('id', userId);
    if (error) throw error;
  }

  async function finish() {
    if (saving || !canContinue) return;
    setSaving(true);
    try {
      if (wasAlreadyComplete) await saveReplayProfile(); else await completeOnboarding(form);
      markGuidedTutorialCompleted();
      router.replace(openInvitesAfterFinish ? '/member/invites' as never : '/(tabs)' as never);
    } catch (error) { Alert.alert('Unable to finish setup', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  }

  if (loading) return <ImageBackground source={BACKGROUNDS[0]} style={styles.background}><View style={styles.scrim}><SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={GOLD} size="large" /><Text style={styles.body}>Preparing your Go Melanated welcome…</Text></View></SafeAreaView></View></ImageBackground>;

  const meta = STEP_META[step - 1]!;
  const locationLabel = [form.homeCity, form.homeState].filter(Boolean).join(', ');
  const joinedGroupCount = groupSuggestions.filter((group) => group.is_member).length;

  const card = (children: React.ReactNode) => <View style={styles.card}>{children}</View>;
  const row = (children: React.ReactNode) => <View style={styles.rowCard}>{children}</View>;

  return (
    <ImageBackground source={BACKGROUNDS[step - 1]} style={styles.background} resizeMode="cover">
      <View style={[styles.scrim, step === 11 && styles.scrimLight]}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.topBar}>
              <Text style={styles.brand}>GO MELANATED</Text>
              {wasAlreadyComplete ? <Pressable onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.exit}>Exit replay</Text></Pressable> : null}
            </View>
            <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.progressRow}><Text style={styles.kicker}>{meta[0]}</Text><Text style={styles.stepCount}>{step}/{TOTAL_STEPS}</Text></View>
              <View style={styles.progressRail}>{Array.from({ length: TOTAL_STEPS }, (_, index) => <View key={index} style={[styles.progressSegment, index < step && styles.progressActive]} />)}</View>
              <Text style={styles.title}>{meta[1]}</Text><Text style={styles.body}>{meta[2]}</Text>

              {step === 1 ? card(<><Text style={styles.cardTitle}>Built for us. Built for outside.</Text><Text style={styles.cardCopy}>Discover adventures, meet your people, find places, join communities, and share what you learn along the way.</Text><View style={styles.promise}><Ionicons name="compass-outline" size={22} color={GOLD} /><Text style={styles.cardCopy}>Adventure · Culture · Connection</Text></View></>) : null}

              {step === 2 ? <View style={styles.stack}><View style={styles.chips}>{(Object.keys(EXPERIENCE_COPY) as ExperienceLevel[]).map((value) => <Pressable key={value} style={[styles.chip, form.experienceLevel === value && styles.selected]} onPress={() => update('experienceLevel', value)}><Text style={styles.chipText}>{EXPERIENCE_COPY[value]}</Text></Pressable>)}</View><View style={styles.grid}>{INTEREST_OPTIONS.map((interest) => <Pressable key={interest} style={[styles.tile, form.interests.includes(interest) && styles.selected]} onPress={() => toggleList('interests', interest)}><Ionicons name={form.interests.includes(interest) ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={form.interests.includes(interest) ? GOLD : MUTED} /><Text style={styles.tileText}>{interest}</Text></Pressable>)}</View></View> : null}

              {step === 3 ? <View style={styles.stack}>{INTENT_OPTIONS.map((intent) => <Pressable key={intent} style={[styles.rowCard, form.intents.includes(intent) && styles.selected]} onPress={() => toggleList('intents', intent)}><Text style={styles.rowText}>{intent}</Text><Ionicons name={form.intents.includes(intent) ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={form.intents.includes(intent) ? GOLD : MUTED} /></Pressable>)}</View> : null}

              {step === 4 ? <View style={styles.stack}>{card(<><Ionicons name="location" size={30} color={GOLD} /><Text style={styles.cardTitle}>Use your location</Text><Text style={styles.cardCopy}>This makes Nearby useful. You can choose a city instead.</Text><Pressable style={styles.goldButton} disabled={locating} onPress={() => void requestCurrentLocation()}><Text style={styles.goldText}>{locating ? 'Finding you…' : 'Use my location'}</Text></Pressable></>)}<View style={styles.field}><Text style={styles.label}>State</Text><TextInput style={styles.input} value={stateSearch} placeholder="Start typing your state" placeholderTextColor="#869089" onFocus={() => setStateOpen(true)} onChangeText={(value) => { setStateSearch(value); setStateOpen(true); update('homeState', ''); update('homeCity', ''); setCitySearch(''); }} />{stateOptions.length ? <View style={styles.autocomplete}>{stateOptions.map((state) => <Pressable key={state.abbreviation} style={styles.autoRow} onPress={() => { setStateSearch(state.name); update('homeState', state.abbreviation); update('homeCity', ''); setCitySearch(''); setStateOpen(false); }}><Text style={styles.rowText}>{state.name}</Text><Text style={styles.kicker}>{state.abbreviation}</Text></Pressable>)}</View> : null}</View><View style={styles.field}><Text style={styles.label}>City</Text><TextInput style={styles.input} editable={Boolean(form.homeState) && !citiesLoading} value={citySearch} placeholder={form.homeState ? 'Start typing your city' : 'Choose a state first'} placeholderTextColor="#869089" onChangeText={(value) => { setCitySearch(value); update('homeCity', ''); }} />{cityOptions.length ? <View style={styles.autocomplete}>{cityOptions.map((city) => <Pressable key={city} style={styles.autoRow} onPress={() => { setCitySearch(city); update('homeCity', city); }}><Text style={styles.rowText}>{city}</Text></Pressable>)}</View> : null}</View>{locationLabel ? <Text style={styles.confirm}>✓ Nearby will start around {locationLabel}</Text> : null}</View> : null}

              {step === 5 ? <View style={styles.stack}>{suggestionsLoading ? <ActivityIndicator color={GOLD} /> : null}{suggestions.map((person) => row(<><Avatar person={person} /><View style={styles.flex}><Text style={styles.personName}>{person.display_name || person.username || 'Go Melanated member'}</Text><Text style={styles.cardCopy}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Community member'}</Text></View></>))}{!suggestionsLoading && !suggestions.length ? card(<><Text style={styles.cardTitle}>Your community will fill in here.</Text><Text style={styles.cardCopy}>Nearby discovery keeps growing as members, adventures, and posts appear around your area.</Text></>) : null}</View> : null}

              {step === 6 ? <View style={styles.stack}>{card(<View style={styles.profileRow}><View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{initials(form.displayName || username)}</Text></View><View style={styles.flex}><Text style={styles.personName}>{form.displayName || username || 'Your profile'}</Text>{username ? <Text style={styles.kicker}>@{username}</Text> : null}<Text style={styles.cardCopy}>{locationLabel}</Text></View></View>)}{[['First name','firstName'],['Last name','lastName'],['Display name','displayName']].map(([label, key]) => <View style={styles.field} key={key}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={String(form[key as 'firstName' | 'lastName' | 'displayName'])} onChangeText={(value) => update(key as 'firstName' | 'lastName' | 'displayName', value)} /></View>)}</View> : null}

              {step === 7 ? <View style={styles.stack}>{suggestions.slice(0, 5).map((person) => row(<><Avatar person={person} /><View style={styles.flex}><Text style={styles.personName}>{person.display_name || person.username || 'Go Melanated member'}</Text><Text style={styles.cardCopy}>{[person.home_city, person.home_state].filter(Boolean).join(', ')}</Text></View><Pressable style={[styles.smallButton, connectionSentIds.has(person.id) && styles.smallButtonDone]} disabled={connectionSentIds.has(person.id) || connectingId === person.id} onPress={() => void connect(person)}><Text style={styles.smallButtonText}>{connectionSentIds.has(person.id) ? 'Requested' : connectingId === person.id ? 'Sending…' : 'Connect'}</Text></Pressable></>))}</View> : null}

              {step === 8 ? <View style={styles.stack}>{groupsLoading ? <ActivityIndicator color={GOLD} /> : null}{groupSuggestions.map((group) => row(<><Ionicons name={group.kind === 'local' ? 'location-outline' : 'people-outline'} size={24} color={GOLD} /><View style={styles.flex}><Text style={styles.personName}>{group.name}</Text><Text style={styles.cardCopy}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text></View><Pressable style={[styles.smallButton, group.is_member && styles.smallButtonDone]} disabled={group.is_member || groupBusyId === group.id} onPress={() => void joinSuggestedGroup(group)}><Text style={styles.smallButtonText}>{group.is_member ? 'Joined ✓' : groupBusyId === group.id ? 'Joining…' : 'Join'}</Text></Pressable></>))}</View> : null}

              {step === 9 ? <View style={styles.stack}>{card(<><Text style={styles.bigNumber}>{inviteCount}</Text><Text style={styles.cardTitle}>unique invites available</Text><Text style={styles.cardCopy}>Invites stay tied to your account so Go Melanated knows who brought someone into the community.</Text></>)}<Pressable style={[styles.rowCard, openInvitesAfterFinish && styles.selected]} onPress={() => setOpenInvitesAfterFinish((value) => !value)}><Text style={styles.rowText}>Open Invite Friends after setup</Text><Ionicons name={openInvitesAfterFinish ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={openInvitesAfterFinish ? GOLD : MUTED} /></Pressable></View> : null}

              {step === 10 ? <View style={styles.stack}>{card(<>{['Messages from your crew','Adventure updates','Invitations','Replies to your posts'].map((label) => <View style={styles.notice} key={label}><Ionicons name="notifications-outline" size={18} color={GOLD} /><Text style={styles.rowText}>{label}</Text><Ionicons name="checkmark-circle" size={18} color={GOLD} /></View>)}</>)}<View style={styles.preference}><View style={styles.flex}><Text style={styles.personName}>Push notifications</Text><Text style={styles.cardCopy}>Messages, adventure changes, invites, and relevant activity.</Text></View><Switch value={form.pushEnabled} onValueChange={(value) => update('pushEnabled', value)} /></View><View style={styles.preference}><View style={styles.flex}><Text style={styles.personName}>Email updates</Text><Text style={styles.cardCopy}>Useful account and community updates.</Text></View><Switch value={form.emailEnabled} onValueChange={(value) => update('emailEnabled', value)} /></View><Pressable style={styles.goldButton} onPress={() => void requestNotificationPermission()}><Text style={styles.goldText}>{notificationPermission === 'granted' ? 'Notifications enabled ✓' : 'Allow notifications'}</Text></Pressable></View> : null}

              {step === 11 ? <View style={styles.stack}>{card(<><View style={styles.readyIcon}><Ionicons name="checkmark" size={34} color={BG} /></View><Text style={styles.readyTitle}>Your Go Melanated is ready.</Text><Text style={styles.cardCopy}>Your interests, location, community, and preferences are ready to shape what you see next.</Text></>)}{card(<><View style={styles.notice}><Ionicons name="checkmark-circle" size={20} color={GOLD} /><Text style={styles.rowText}>{form.interests.length} interests selected</Text></View><View style={styles.notice}><Ionicons name="checkmark-circle" size={20} color={GOLD} /><Text style={styles.rowText}>Nearby: {locationLabel || 'your home area'}</Text></View><View style={styles.notice}><Ionicons name="checkmark-circle" size={20} color={GOLD} /><Text style={styles.rowText}>{connectionSentIds.size} Trailmate request{connectionSentIds.size === 1 ? '' : 's'}</Text></View><View style={styles.notice}><Ionicons name="checkmark-circle" size={20} color={GOLD} /><Text style={styles.rowText}>{joinedGroupCount} campfire{joinedGroupCount === 1 ? '' : 's'} joined</Text></View></>)}</View> : null}

              <View style={styles.footer}>{step > 1 ? <Pressable style={styles.back} disabled={saving} onPress={() => setStep((value) => Math.max(1, value - 1))}><Text style={styles.backText}>Back</Text></Pressable> : <View style={styles.backSpacer} />}<Pressable style={[styles.next, (!canContinue || saving) && styles.disabled]} disabled={!canContinue || saving} onPress={() => step < TOTAL_STEPS ? setStep((value) => value + 1) : void finish()}><Text style={styles.nextText}>{saving ? 'Finishing…' : step === TOTAL_STEPS ? (openInvitesAfterFinish ? 'Finish & Invite Friends' : 'See What’s Happening') : 'Next'}</Text>{!saving && step < TOTAL_STEPS ? <Ionicons name="arrow-forward" size={18} color={BG} /> : null}</Pressable></View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(5,10,8,0.64)' },
  scrimLight: { backgroundColor: 'rgba(5,10,8,0.48)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 },
  topBar: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(7,12,10,0.38)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.13)' },
  brand: { color: TEXT, fontWeight: '900', letterSpacing: 1.6, fontSize: 14 },
  exit: { color: '#D8DED9', fontWeight: '800', fontSize: 12 },
  content: { padding: 20, paddingBottom: 44 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: '#F3C85B', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  stepCount: { color: '#D3DAD5', fontSize: 10, fontWeight: '900' },
  progressRail: { flexDirection: 'row', gap: 4, marginTop: 10, marginBottom: 24 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressActive: { backgroundColor: GOLD },
  title: { color: TEXT, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -0.7, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8 },
  body: { color: '#E0E6E2', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  stack: { gap: 12 },
  card: { backgroundColor: 'rgba(12,20,16,0.88)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 18, gap: 10 },
  rowCard: { minHeight: 64, backgroundColor: 'rgba(12,20,16,0.88)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selected: { borderColor: GOLD, backgroundColor: 'rgba(43,39,20,0.92)' },
  cardTitle: { color: TEXT, fontSize: 19, lineHeight: 24, fontWeight: '900' },
  cardCopy: { color: '#C8D0CB', fontSize: 12, lineHeight: 18 },
  promise: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(12,20,16,0.86)', paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { color: TEXT, fontWeight: '800', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  tile: { width: '48.5%', minHeight: 70, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(12,20,16,0.86)', padding: 13, justifyContent: 'space-between' },
  tileText: { color: TEXT, fontWeight: '800', fontSize: 13, marginTop: 8 },
  rowText: { flex: 1, color: TEXT, fontWeight: '800', fontSize: 13 },
  goldButton: { minHeight: 48, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 4 },
  goldText: { color: BG, fontWeight: '900', fontSize: 14 },
  field: { gap: 7 },
  label: { color: '#F0F3F1', fontWeight: '800', fontSize: 12 },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(7,13,10,0.9)', paddingHorizontal: 14, color: TEXT, fontSize: 15 },
  autocomplete: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(7,13,10,0.96)', borderRadius: 13, overflow: 'hidden' },
  autoRow: { minHeight: 45, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  confirm: { color: '#D8F0DE', fontWeight: '800', fontSize: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: BG, fontWeight: '900', fontSize: 15 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personName: { color: TEXT, fontWeight: '900', fontSize: 14 },
  smallButton: { minWidth: 80, minHeight: 38, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  smallButtonDone: { backgroundColor: '#38443D' },
  smallButtonText: { color: BG, fontWeight: '900', fontSize: 11 },
  bigNumber: { color: GOLD, fontSize: 50, fontWeight: '900', textAlign: 'center' },
  notice: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10 },
  preference: { backgroundColor: 'rgba(12,20,16,0.88)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  readyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  readyTitle: { color: TEXT, fontWeight: '900', fontSize: 24, textAlign: 'center' },
  footer: { flexDirection: 'row', gap: 10, marginTop: 28, alignItems: 'center' },
  back: { minHeight: 50, minWidth: 78, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(9,15,12,0.72)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: TEXT, fontWeight: '900' },
  backSpacer: { width: 78 },
  next: { flex: 1, minHeight: 50, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  nextText: { color: BG, fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.45 },
});
