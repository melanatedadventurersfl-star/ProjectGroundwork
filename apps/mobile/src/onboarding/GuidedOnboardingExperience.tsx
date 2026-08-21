import Ionicons from '@react-native-vector-icons/ionicons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { getGroups, joinGroup, type CommunityGroup } from '../community/api';
import { supabase } from '../lib/supabase';
import { requestConnection } from '../social/api';
import { getStateOption, loadCitiesForState, US_STATES } from './locations';
import { completeOnboarding, loadOnboardingProfile } from './onboardingService';
import { markGuidedTutorialCompleted } from './tutorialPreference';
import { INITIAL_ONBOARDING_FORM, type OnboardingForm } from './types';

const GOLD = '#F5B82E';
const BG = '#07100C';
const TEXT = '#FFF9EC';
const MUTED = '#B7C0BA';
const SURFACE = '#101913';
const SURFACE_2 = '#16221B';
const BORDER = '#29372F';
const TOTAL_STEPS = 9;
const MIN_SELECTIONS = 2;

const BACKGROUNDS = {
  welcome: require('../../assets/onboarding/onboarding-welcome.jpg'),
  trailhead: require('../../assets/onboarding/onboarding-plan.jpg'),
  people: require('../../assets/onboarding/onboarding-people.jpg'),
  places: require('../../assets/onboarding/onboarding-places.jpg'),
  share: require('../../assets/onboarding/onboarding-share.jpg'),
  complete: require('../../assets/onboarding/onboarding-complete.jpg'),
} as const;

// The launcher asset is a cleaner/high-density source than the tiny legacy wordmark raster.
const LOGO = require('../../assets/ma-app-icon.png');
const EXPLORER_BADGE = require('../../assets/ranks/explorer.png');
const STICKER_PREVIEWS = [
  require('../../assets/badges/trailhead.png'),
  require('../../assets/badges/first-adventure.jpg'),
  require('../../assets/badges/camp-crew.jpg'),
] as const;

type CommunitySuggestion = {
  id: string;
  display_name: string | null;
  username: string | null;
  home_city: string | null;
  home_state: string | null;
  avatar_url: string | null;
  interests: string[] | null;
  isDemo?: boolean;
};

type MemberInvite = {
  id: string;
  token: string;
  status: string;
};

type SectionName = 'Trailhead' | 'Adventures' | 'Trail Guide' | 'Outpost' | 'Trailmates' | 'Campfires';

type NavItem = {
  section: Exclude<SectionName, 'Trailmates'>;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { section: 'Trailhead', label: 'Trailhead', icon: 'home-outline' },
  { section: 'Adventures', label: 'Adventures', icon: 'trail-sign-outline' },
  { section: 'Trail Guide', label: 'Guide', icon: 'map-outline' },
  { section: 'Outpost', label: 'Outpost', icon: 'people-outline' },
  { section: 'Campfires', label: 'Campfires', icon: 'flame-outline' },
];

const ADVENTURE_OPTIONS = ['Camping trips', 'Day trips', 'Weekend trips', 'Water adventures', 'Road trips', 'Beginner experiences'] as const;
const OUTPOST_OPTIONS = [
  ['Find people to adventure with', 'Meet new people', 'people-outline'],
  ['Learn how to get outdoors', 'Get advice', 'chatbubble-outline'],
  ['Discover things happening nearby', 'Find events', 'calendar-outline'],
  ['Share my adventures', 'Share adventures', 'images-outline'],
  ['Explore new places', 'Explore locally', 'compass-outline'],
] as const;

const DEMO_PEOPLE: CommunitySuggestion[] = [
  { id: 'demo-nia', display_name: 'Nia Carter', username: null, home_city: 'St. Petersburg', home_state: 'FL', avatar_url: null, interests: ['Water adventures'], isDemo: true },
  { id: 'demo-marcus', display_name: 'Marcus Ellis', username: null, home_city: 'Jacksonville', home_state: 'FL', avatar_url: null, interests: ['Hiking'], isDemo: true },
  { id: 'demo-devon', display_name: 'Devon Hill', username: null, home_city: 'Orlando', home_state: 'FL', avatar_url: null, interests: ['Camping'], isDemo: true },
];

function initials(value?: string | null) {
  return String(value || 'GM')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color={BG} />
    </Pressable>
  );
}

function ChoiceChip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${selected ? 'selected' : 'not selected'}`}
      style={[styles.choiceChip, selected && styles.choiceChipSelected]}
      onPress={onPress}
    >
      {icon ? <Ionicons name={icon as never} size={16} color={selected ? BG : GOLD} /> : null}
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={17} color={BG} /> : null}
    </Pressable>
  );
}

function SelectionStatus({ count, minimum = MIN_SELECTIONS }: { count: number; minimum?: number }) {
  const complete = count >= minimum;
  return (
    <View style={styles.selectionStatus}>
      <Ionicons name={complete ? 'checkmark-circle' : 'radio-button-off'} size={16} color={complete ? GOLD : '#718079'} />
      <Text style={[styles.selectionStatusText, complete && styles.selectionStatusTextReady]}>
        {complete ? `${count} selected` : `${count} selected · Choose at least ${minimum}`}
      </Text>
    </View>
  );
}

function StepProgress({ step }: { step: number }) {
  if (step <= 2 || step >= 9) return null;
  const sectionStep = step - 2;
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={[styles.progressSegment, index < sectionStep && styles.progressSegmentActive]} />
      ))}
    </View>
  );
}

function BottomNav({ active }: { active: SectionName }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {NAV_ITEMS.map((item) => {
        const selected = item.section === active || (active === 'Trailmates' && item.section === 'Outpost');
        return (
          <View key={item.section} style={styles.navItem}>
            <Ionicons name={item.icon as never} size={20} color={selected ? GOLD : '#7C8881'} />
            <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{item.label}</Text>
            {selected ? <View style={styles.navUnderline} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function SectionShell({ active, name, children, step, onBack, scrollEnabled = true }: { active: SectionName; name: string; children: ReactNode; step: number; onBack: () => void; scrollEnabled?: boolean }) {
  return (
    <SafeAreaView style={styles.sectionShell} edges={['top', 'left', 'right']}>
      <View style={styles.sectionHeader}>
        <Pressable accessibilityLabel="Back" hitSlop={10} style={styles.headerBack} onPress={onBack}>
          <Ionicons name="chevron-back" size={21} color={TEXT} />
        </Pressable>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionHeaderTitle}>{active}</Text>
          <Text style={styles.sectionGreeting}>Good morning, {name}</Text>
        </View>
        <Ionicons name="notifications-outline" size={22} color={GOLD} />
      </View>
      <StepProgress step={step} />
      <ScrollView
        contentContainerStyle={[styles.sectionScroll, !scrollEnabled && styles.sectionScrollFixed]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        <View style={[styles.contentFrame, !scrollEnabled && styles.contentFrameFixed]}>{children}</View>
      </ScrollView>
      <BottomNav active={active} />
    </SafeAreaView>
  );
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <View style={styles.sectionIntro}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCopy}>{copy}</Text>
    </View>
  );
}

function PreviewCard({ image, kicker, title, copy }: { image: number; kicker: string; title: string; copy: string }) {
  return (
    <ImageBackground source={image} style={styles.previewCard} imageStyle={styles.previewCardImage}>
      <View style={styles.previewShade} />
      <View style={styles.previewCardText}>
        <Text style={styles.previewKicker}>{kicker}</Text>
        <Text style={styles.previewTitle}>{title}</Text>
        <Text style={styles.previewCopy}>{copy}</Text>
      </View>
    </ImageBackground>
  );
}

function Avatar({ person }: { person: CommunitySuggestion }) {
  if (person.avatar_url) return <Image source={{ uri: person.avatar_url }} style={styles.personAvatar} />;
  return (
    <View style={[styles.personAvatar, styles.avatarFallback]}>
      <Text style={styles.avatarFallbackText}>{initials(person.display_name || person.username)}</Text>
    </View>
  );
}

function rankGroups(groups: CommunityGroup[], interests: string[], city: string, state: string) {
  const needles = interests.map((value) => value.toLowerCase());
  return [...groups]
    .sort((a, b) => {
      const score = (group: CommunityGroup) => {
        const haystack = `${group.name} ${group.description ?? ''}`.toLowerCase();
        return needles.reduce((sum, value) => sum + (haystack.includes(value) ? 4 : 0), 0)
          + (group.state === state ? 2 : 0)
          + (group.city?.toLowerCase() === city.toLowerCase() ? 3 : 0)
          + Math.min(group.member_count, 20) / 20;
      };
      return score(b) - score(a);
    })
    .slice(0, 3);
}

function inviteShareMessage(token: string) {
  const androidDownloadUrl = process.env.EXPO_PUBLIC_ANDROID_DOWNLOAD_URL?.trim();
  const inviteBaseUrl = process.env.EXPO_PUBLIC_INVITE_BASE_URL?.trim().replace(/\/$/, '');
  const inviteUrl = inviteBaseUrl ? `${inviteBaseUrl}/invite/${token}` : null;
  return [
    'Join me on Go Melanated.',
    androidDownloadUrl ? `Download the Android app: ${androidDownloadUrl}` : null,
    inviteUrl ? `Open my invite after installing: ${inviteUrl}` : null,
    `Invite code: ${token}`,
  ].filter(Boolean).join('\n\n');
}

function groupReason(group: CommunityGroup, interests: string[], city: string) {
  const haystack = `${group.name} ${group.description ?? ''}`.toLowerCase();
  const match = interests.find((interest) => haystack.includes(interest.toLowerCase()));
  if (match) return `Matches ${match.replace(' adventures', '')}`;
  if (city && group.city?.toLowerCase() === city.toLowerCase()) return `Near ${city}`;
  return group.kind === 'local' ? 'Local community' : 'Recommended for you';
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
  const [locating, setLocating] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CommunitySuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectionSentIds, setConnectionSentIds] = useState<Set<string>>(new Set());
  const [invite, setInvite] = useState<MemberInvite | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [groupSuggestions, setGroupSuggestions] = useState<CommunityGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupBusyId, setGroupBusyId] = useState<string | null>(null);

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    let active = true;
    async function load() {
      if (!userId) {
        setLoading(false);
        return;
      }
      const [profile, identity] = await Promise.all([
        loadOnboardingProfile(userId),
        supabase.from('profiles').select('username').eq('id', userId).single(),
      ]);
      if (!active) return;
      if (identity.error) throw identity.error;
      const communication = (profile.communication_preferences ?? {}) as Record<string, unknown>;
      const adventurePreferences = Array.isArray(communication.adventure_preferences)
        ? communication.adventure_preferences.filter((value): value is string => typeof value === 'string')
        : [];
      const intents = Array.isArray(communication.discovery_intents)
        ? communication.discovery_intents.filter((value): value is string => typeof value === 'string')
        : [];
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
        experienceLevel: 'new',
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
    void load().catch((error) => {
      Alert.alert('Unable to start setup', error instanceof Error ? error.message : 'Please try again.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!form.homeState) {
      setCities([]);
      return;
    }
    let active = true;
    setCitiesLoading(true);
    void loadCitiesForState(form.homeState)
      .then((values) => { if (active) setCities(values); })
      .catch(() => { if (active) setCities([]); })
      .finally(() => { if (active) setCitiesLoading(false); });
    return () => { active = false; };
  }, [form.homeState]);

  useEffect(() => {
    if (!userId || step !== 7) return;
    let active = true;
    setSuggestionsLoading(true);
    setInviteLoading(true);
    async function loadPeopleAndInvite() {
      let query = supabase.from('community_profile_directory').select('*').neq('id', userId).limit(6);
      if (form.homeState) query = query.eq('home_state', form.homeState);
      let result = await query;
      if (result.error && form.homeState) result = await supabase.from('community_profile_directory').select('*').neq('id', userId).limit(6);
      if (result.error) throw result.error;
      const inviteResult = await supabase
        .from('member_invites')
        .select('id,token,status')
        .eq('sender_profile_id', userId)
        .eq('status', 'available')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (active) {
        setSuggestions((result.data ?? []) as CommunitySuggestion[]);
        setInvite(inviteResult.data as MemberInvite | null);
      }
    }
    void loadPeopleAndInvite()
      .catch((error) => console.warn('[onboarding] trailmates preview failed', error))
      .finally(() => {
        if (active) {
          setSuggestionsLoading(false);
          setInviteLoading(false);
        }
      });
    return () => { active = false; };
  }, [form.homeState, step, userId]);

  useEffect(() => {
    if (step !== 8) return;
    let active = true;
    setGroupsLoading(true);
    void getGroups()
      .then((groups) => { if (active) setGroupSuggestions(rankGroups(groups, form.interests, form.homeCity, form.homeState)); })
      .catch((error) => console.warn('[onboarding] campfire preview failed', error))
      .finally(() => { if (active) setGroupsLoading(false); });
    return () => { active = false; };
  }, [form.homeCity, form.homeState, form.interests, step]);

  const stateOptions = useMemo(() => {
    if (!stateOpen) return [];
    const query = stateSearch.trim().toLowerCase();
    return US_STATES.filter((state) => !query || state.name.toLowerCase().includes(query) || state.abbreviation.toLowerCase().startsWith(query)).slice(0, 8);
  }, [stateOpen, stateSearch]);

  const cityOptions = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!form.homeState) return [];
    return cities.filter((city) => !query || city.toLowerCase().includes(query)).slice(0, 10);
  }, [cities, citySearch, form.homeState]);

  const greetingName = form.displayName.trim() || username || 'friend';
  const locationLabel = [form.homeCity, form.homeState].filter(Boolean).join(', ');
  const peopleToShow = suggestions.length ? suggestions.slice(0, 3) : DEMO_PEOPLE;

  async function requestCurrentLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location is optional', 'Choose a city instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const place = (await Location.reverseGeocodeAsync(position.coords))[0];
      const region = place?.region ?? '';
      const state = US_STATES.find((option) => option.name.toLowerCase() === region.toLowerCase() || option.abbreviation.toLowerCase() === region.toLowerCase());
      const city = place?.city || place?.subregion || '';
      if (!state || !city) {
        Alert.alert('Choose your city', 'We found your location but could not match it cleanly.');
        return;
      }
      update('homeState', state.abbreviation);
      update('homeCity', city);
      setStateSearch(state.name);
      setCitySearch(city);
      setStateOpen(false);
      setCityPickerOpen(false);
    } catch (error) {
      Alert.alert('Unable to use location', error instanceof Error ? error.message : 'Choose your city instead.');
    } finally {
      setLocating(false);
    }
  }

  async function connect(person: CommunitySuggestion) {
    if (person.isDemo || connectingId || connectionSentIds.has(person.id)) return;
    setConnectingId(person.id);
    try {
      await requestConnection(person.id);
      setConnectionSentIds((current) => new Set([...current, person.id]));
    } catch (error) {
      Alert.alert('Unable to connect', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setConnectingId(null);
    }
  }

  async function shareInvite() {
    if (inviteLoading) return;
    if (!invite?.token) {
      Alert.alert('Invites are getting ready', 'You can invite friends from your profile after setup.');
      return;
    }
    await Share.share({ title: 'Join me on Go Melanated', message: inviteShareMessage(invite.token) });
  }

  async function joinSuggestedGroup(group: CommunityGroup) {
    if (group.is_member || groupBusyId) return;
    setGroupBusyId(group.id);
    try {
      await joinGroup(group.id);
      setGroupSuggestions((current) => current.map((item) => item.id === group.id
        ? { ...item, is_member: true, member_count: item.member_count + 1 }
        : item));
    } catch (error) {
      Alert.alert('Unable to join group', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setGroupBusyId(null);
    }
  }

  async function saveReplayProfile() {
    if (!userId) return;
    const { error } = await supabase.from('profiles').update({
      display_name: form.displayName.trim() || null,
      home_city: form.homeCity.trim() || null,
      home_state: form.homeState.trim() || null,
      discovery_radius_miles: form.discoveryRadiusMiles,
      experience_level: 'new',
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
      const parts = form.displayName.trim().split(/\s+/).filter(Boolean);
      const completionForm: OnboardingForm = {
        ...form,
        firstName: form.firstName.trim() || parts[0] || '',
        lastName: form.lastName.trim() || parts.slice(1).join(' '),
        experienceLevel: 'new',
      };
      if (wasAlreadyComplete) await saveReplayProfile();
      else await completeOnboarding(completionForm);
      markGuidedTutorialCompleted();
      router.replace('/(tabs)' as never);
    } catch (error) {
      Alert.alert('Unable to finish setup', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step < TOTAL_STEPS) setStep((value) => value + 1);
  }

  function back() {
    if (step > 1) setStep((value) => value - 1);
  }

  if (loading) {
    return (
      <ImageBackground source={BACKGROUNDS.welcome} style={styles.fullScreen}>
        <View style={styles.backgroundShade} />
        <SafeAreaView style={styles.loadingStage}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.loadingText}>Preparing your Go Melanated welcome…</Text>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (step === 1) {
    return (
      <ImageBackground source={BACKGROUNDS.welcome} style={styles.fullScreen}>
        <View style={styles.backgroundShadeWelcome} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.welcomeStage}>
            <View style={styles.welcomeCluster}>
              <Image source={LOGO} style={styles.welcomeLogo} resizeMode="contain" />
              <Text style={styles.welcomeTitle}>Find your people.{`\n`}<Text style={styles.goldText}>Find your outside.</Text></Text>
              <Text style={styles.welcomeCopy}>Discover amazing places, find adventures, learn something new, and connect with a community built for us.</Text>
            </View>
            <PrimaryButton label="Get Started" onPress={next} />
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (step === 2) {
    return (
      <ImageBackground source={BACKGROUNDS.welcome} style={styles.fullScreen}>
        <View style={styles.backgroundShadeStrong} />
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={8}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.nameStage}>
                <View style={styles.nameTopRow}>
                  <Image source={LOGO} style={styles.nameLogo} resizeMode="contain" />
                  {wasAlreadyComplete ? <Pressable onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.skipText}>Exit replay</Text></Pressable> : null}
                </View>
                <Text style={styles.eyebrow}>FIRST THINGS FIRST</Text>
                <Text style={styles.nameTitle}>What should we call you?</Text>
                <Text style={styles.sectionCopy}>We’ll personalize the tour as we go.</Text>
                <View style={styles.nameInputWrap}>
                  <Ionicons name="person-outline" size={20} color={GOLD} />
                  <TextInput
                    autoFocus
                    returnKeyType="done"
                    style={styles.nameInput}
                    value={form.displayName}
                    placeholder="Your name"
                    placeholderTextColor="#718079"
                    onChangeText={(value) => update('displayName', value)}
                    onSubmitEditing={() => {
                      if (form.displayName.trim()) {
                        Keyboard.dismiss();
                        next();
                      }
                    }}
                  />
                </View>
                {form.displayName.trim() ? <Text style={styles.helloText}>Good to meet you, <Text style={styles.goldText}>{form.displayName.trim()}.</Text></Text> : null}
                <View style={styles.nameSpacer} />
                <PrimaryButton label="Continue" disabled={!form.displayName.trim()} onPress={() => { Keyboard.dismiss(); next(); }} />
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (step === 3) {
    return (
      <SectionShell active="Trailhead" name={greetingName} step={step} onBack={back} scrollEnabled={false}>
        <View style={styles.trailheadIntroStage}>
          <SectionIntro eyebrow="YOUR HOME BASE" title="This is your Trailhead." copy="Your rank, weather, badges, nearby places, guides, and community activity all start here." />
          <ImageBackground source={BACKGROUNDS.trailhead} style={styles.trailheadHero} imageStyle={styles.trailheadHeroImage}>
            <View style={styles.trailheadHeroShade} />
            <View style={styles.trailheadHeroMain}>
              <Image source={EXPLORER_BADGE} style={styles.trailheadExplorerBadge} resizeMode="contain" />
              <View style={styles.trailheadHeroCopy}>
                <View style={styles.trailheadRankRow}>
                  <Text style={styles.trailheadRankName}>EXPLORER</Text>
                  <Text style={styles.trailheadRankLevel}>· Level 1</Text>
                </View>
                <Text style={styles.trailheadRankSubcopy}>Everyone starts here.</Text>
                <View style={styles.trailheadWeatherRow}>
                  <Ionicons name="partly-sunny-outline" size={17} color={GOLD} />
                  <Text style={styles.trailheadWeatherText}>68° · Clear skies</Text>
                </View>
                <Text style={styles.trailheadLocationText}>{locationLabel || 'Your local weather'}</Text>
              </View>
            </View>
            <View style={styles.stickerTray}>
              {STICKER_PREVIEWS.map((source, index) => (
                <Image key={index} source={source} style={styles.stickerPreview} resizeMode="cover" />
              ))}
              <View style={styles.stickerCount}><Text style={styles.stickerCountText}>+12</Text></View>
            </View>
          </ImageBackground>
          <View style={styles.badgeGuideCard}>
            <View style={styles.badgeGuideHeading}>
              <Ionicons name="ribbon-outline" size={18} color={GOLD} />
              <Text style={styles.badgeGuideEyebrow}>HOW BADGES & STICKERS WORK</Text>
            </View>
            <View style={styles.badgeGuideRow}>
              <View style={styles.badgeGuideIcon}><Text style={styles.badgeGuideIconText}>1</Text></View>
              <View style={styles.flex}><Text style={styles.badgeGuideTitle}>Start as Explorer</Text><Text style={styles.badgeGuideText}>Everyone begins at Level 1.</Text></View>
            </View>
            <View style={styles.badgeGuideDivider} />
            <View style={styles.badgeGuideRow}>
              <View style={styles.badgeGuideIcon}><Text style={styles.badgeGuideIconText}>XP</Text></View>
              <View style={styles.flex}><Text style={styles.badgeGuideTitle}>Earn XP by showing up</Text><Text style={styles.badgeGuideText}>Join adventures, explore places, connect, and participate.</Text></View>
            </View>
            <View style={styles.badgeGuideDivider} />
            <View style={styles.badgeGuideRow}>
              <View style={styles.badgeGuideIcon}><Ionicons name="trophy-outline" size={16} color={GOLD} /></View>
              <View style={styles.flex}><Text style={styles.badgeGuideTitle}>Build your collection</Text><Text style={styles.badgeGuideText}>Unlock higher ranks, achievement badges, and collectible stickers over time.</Text></View>
            </View>
          </View>
          <View style={styles.trailheadContinue}><PrimaryButton label="Continue" onPress={next} /></View>
        </View>
      </SectionShell>
    );
  }

  if (step === 4) {
    return (
      <SectionShell active="Adventures" name={greetingName} step={step} onBack={back}>
        <SectionIntro eyebrow="PLAN · JOIN · EXPERIENCE" title="Adventures" copy="Discover upcoming trips, camps, events, and experiences, then reserve your spot when something feels right." />
        <View style={styles.featureRow}>
          <PreviewCard image={BACKGROUNDS.share} kicker="UPCOMING" title="Lil Camp of Horrors" copy="A fall camping weekend" />
          <PreviewCard image={BACKGROUNDS.trailhead} kicker="WINTER" title="Winter Camp" copy="Cold air, warm fire" />
          <PreviewCard image={BACKGROUNDS.places} kicker="ESCAPE" title="Great Beach Escape" copy="Sun, coast, community" />
        </View>
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Choose your adventure types</Text>
          <Text style={styles.actionCopy}>Select at least 2 so we can personalize your recommendations.</Text>
          <View style={styles.chipWrap}>
            {ADVENTURE_OPTIONS.map((option) => (
              <ChoiceChip key={option} label={option} selected={form.adventurePreferences.includes(option)} onPress={() => update('adventurePreferences', toggleValue(form.adventurePreferences, option))} />
            ))}
          </View>
          <SelectionStatus count={form.adventurePreferences.length} />
          <PrimaryButton label="Continue" disabled={form.adventurePreferences.length < MIN_SELECTIONS} onPress={next} />
        </View>
      </SectionShell>
    );
  }

  if (step === 5) {
    return (
      <SectionShell active="Trail Guide" name={greetingName} step={step} onBack={back}>
        <SectionIntro eyebrow="DISCOVER · LEARN · EXPLORE" title="Find places. Learn what to know." copy="Discover nearby outdoor places and practical guides before you go." />
        <ImageBackground source={BACKGROUNDS.places} style={styles.guideHero} imageStyle={styles.guideHeroImage}>
          <View style={styles.previewShade} />
          <View style={styles.guideHeroText}>
            <Text style={styles.previewKicker}>FEATURED NEAR YOU</Text>
            <Text style={styles.guideHeroTitle}>{locationLabel || 'Start close to home'}</Text>
            <Text style={styles.previewCopy}>Trails, parks, beaches, springs, campgrounds, and more.</Text>
          </View>
        </ImageBackground>
        <View style={styles.previewGrid}>
          <PreviewCard image={BACKGROUNDS.places} kicker="NEAR YOU" title="Timucuan Ecological Preserve" copy="Hiking · Easy · Local" />
          <PreviewCard image={BACKGROUNDS.share} kicker="GUIDES & KNOW-HOW" title="Beginner’s packing list" copy="Simple advice before you head out" />
        </View>
        <View style={styles.compactLocationCard}>
          <View style={styles.compactLocationHeader}>
            <Ionicons name="location-outline" size={19} color={GOLD} />
            <View style={styles.flex}>
              <Text style={styles.compactLocationTitle}>Make Trail Guide local</Text>
              <Text style={styles.compactLocationCopy}>{locationLabel || 'Use your location or choose a city.'}</Text>
            </View>
          </View>
          <View style={styles.locationButtonRow}>
            <Pressable style={styles.locationButton} disabled={locating} onPress={() => void requestCurrentLocation()}>
              <Ionicons name="navigate-outline" size={16} color={GOLD} />
              <Text style={styles.locationButtonText}>{locating ? 'Finding…' : 'Use location'}</Text>
            </Pressable>
            <Pressable style={styles.locationButton} onPress={() => setCityPickerOpen(true)}>
              <Ionicons name="search-outline" size={16} color={GOLD} />
              <Text style={styles.locationButtonText}>Choose city</Text>
            </Pressable>
          </View>
          <PrimaryButton label="Continue" disabled={!form.homeCity || !form.homeState} onPress={next} />
        </View>
        <Modal transparent animationType="slide" visible={cityPickerOpen} onRequestClose={() => setCityPickerOpen(false)}>
          <View style={styles.modalBackdrop}>
            <SafeAreaView style={styles.cityModal} edges={['bottom']}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Choose your city</Text>
                  <Text style={styles.modalCopy}>Pick a state, then search for your city.</Text>
                </View>
                <Pressable hitSlop={10} onPress={() => setCityPickerOpen(false)}><Ionicons name="close" size={24} color={TEXT} /></Pressable>
              </View>
              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.smallInput}
                value={stateSearch}
                placeholder="Search state"
                placeholderTextColor="#6D7A73"
                onFocus={() => setStateOpen(true)}
                onChangeText={(value) => {
                  setStateSearch(value);
                  setStateOpen(true);
                  update('homeState', '');
                  update('homeCity', '');
                  setCitySearch('');
                }}
              />
              {stateOptions.length ? <View style={styles.suggestionList}>
                {stateOptions.map((state) => <Pressable key={state.abbreviation} style={styles.suggestionRow} onPress={() => {
                  setStateSearch(state.name);
                  update('homeState', state.abbreviation);
                  update('homeCity', '');
                  setCitySearch('');
                  setStateOpen(false);
                }}><Text style={styles.suggestionText}>{state.name}</Text><Text style={styles.suggestionMeta}>{state.abbreviation}</Text></Pressable>)}
              </View> : null}
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.smallInput}
                editable={Boolean(form.homeState) && !citiesLoading}
                value={citySearch}
                placeholder={form.homeState ? 'Search city' : 'Choose a state first'}
                placeholderTextColor="#6D7A73"
                onChangeText={(value) => setCitySearch(value)}
              />
              <ScrollView style={styles.cityResults} keyboardShouldPersistTaps="handled">
                {citiesLoading ? <ActivityIndicator color={GOLD} style={styles.inlineLoader} /> : cityOptions.map((city) => (
                  <Pressable key={city} style={styles.cityResultRow} onPress={() => {
                    setCitySearch(city);
                    update('homeCity', city);
                    setCityPickerOpen(false);
                  }}><Ionicons name="location-outline" size={17} color={GOLD} /><Text style={styles.cityResultText}>{city}, {form.homeState}</Text></Pressable>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </SectionShell>
    );
  }

  if (step === 6) {
    return (
      <SectionShell active="Outpost" name={greetingName} step={step} onBack={back}>
        <SectionIntro eyebrow="CONNECT · SHARE · GET INSPIRED" title="Your community, outside." copy="See nearby posts, ask questions, share experiences, and find what’s happening around you." />
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.postAvatar}><Text style={styles.postAvatarText}>DM</Text></View>
            <View style={styles.flex}><Text style={styles.postAuthor}>Darius M.</Text><Text style={styles.postMeta}>2h ago · Nearby</Text></View>
            <Ionicons name="ellipsis-horizontal" size={20} color={MUTED} />
          </View>
          <Text style={styles.postBody}>Sunrise hike this weekend. Who is up for getting outside early?</Text>
          <Image source={BACKGROUNDS.people} style={styles.postImage} resizeMode="cover" />
          <View style={styles.postStats}><Text style={styles.postMeta}>♥ 24</Text><Text style={styles.postMeta}>7 comments</Text><View style={styles.postTag}><Text style={styles.postTagText}>Hiking</Text></View></View>
        </View>
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Choose what you want from Outpost</Text>
          <Text style={styles.actionCopy}>Pick at least 2 so we can personalize your community feed.</Text>
          <View style={styles.chipWrap}>
            {OUTPOST_OPTIONS.map(([value, label, icon]) => (
              <ChoiceChip key={value} label={label} icon={icon} selected={form.intents.includes(value)} onPress={() => update('intents', toggleValue(form.intents, value))} />
            ))}
          </View>
          <SelectionStatus count={form.intents.length} />
          <PrimaryButton label="Continue" disabled={form.intents.length < MIN_SELECTIONS} onPress={next} />
        </View>
      </SectionShell>
    );
  }

  if (step === 7) {
    return (
      <SectionShell active="Trailmates" name={greetingName} step={step} onBack={back}>
        <SectionIntro eyebrow="FIND YOUR PEOPLE" title="Trailmates" copy="Find people you already know, then discover people who share your interests and love getting outside." />
        <View style={styles.findFriendsCard}>
          <View style={styles.findFriendsIcon}><Ionicons name="person-add-outline" size={25} color={GOLD} /></View>
          <View style={styles.flex}>
            <Text style={styles.actionTitle}>Invite people you already know</Text>
            <Text style={styles.actionCopyStandalone}>Use your phone’s share sheet to choose a contact. Your address book stays on your phone.</Text>
          </View>
          <PrimaryButton label={inviteLoading ? 'Loading invite…' : 'Choose who to invite'} disabled={inviteLoading} onPress={() => void shareInvite()} />
        </View>
        <Text style={styles.subsectionTitle}>People you may want to know</Text>
        {suggestionsLoading ? <ActivityIndicator color={GOLD} style={styles.inlineLoader} /> : null}
        <View style={styles.peopleRow}>
          {peopleToShow.map((person) => {
            const sent = connectionSentIds.has(person.id);
            return (
              <View key={person.id} style={styles.personCard}>
                {person.isDemo ? <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>DEMO</Text></View> : null}
                <Avatar person={person} />
                <Text style={styles.personName} numberOfLines={1}>{person.display_name || person.username || 'Explorer'}</Text>
                <Text style={styles.personMeta} numberOfLines={1}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Go Melanated'}</Text>
                <Text style={styles.personInterest} numberOfLines={1}>{person.interests?.[0] || 'Outdoors'}</Text>
                <Pressable style={[styles.connectButton, sent && styles.connectButtonDone, person.isDemo && styles.connectButtonDemo]} disabled={person.isDemo || sent || connectingId === person.id} onPress={() => void connect(person)}>
                  <Text style={[styles.connectButtonText, sent && styles.connectButtonTextDone]}>{person.isDemo ? 'Preview' : sent ? 'Requested ✓' : connectingId === person.id ? 'Sending…' : 'Connect'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={styles.actionCardCompact}>
          <Text style={styles.actionTitle}>Connect now or keep exploring.</Text>
          <Text style={styles.actionCopy}>Trailmates will keep improving as your interests and local community grow.</Text>
          <PrimaryButton label="Continue" onPress={next} />
        </View>
      </SectionShell>
    );
  }

  if (step === 8) {
    const joinedCount = groupSuggestions.filter((group) => group.is_member).length;
    return (
      <SectionShell active="Campfires" name={greetingName} step={step} onBack={back}>
        <SectionIntro eyebrow="GROUPS · SUPPORT · BELONG" title="Campfires" copy="Interest- and place-based groups for deeper conversations, shared knowledge, and recurring connections." />
        <View style={styles.subsectionHeader}><Text style={styles.subsectionTitle}>Recommended for you</Text>{joinedCount ? <Text style={styles.joinedCount}>{joinedCount} joined</Text> : null}</View>
        {groupsLoading ? <ActivityIndicator color={GOLD} style={styles.inlineLoader} /> : null}
        <View style={styles.groupList}>
          {groupSuggestions.map((group) => (
            <View key={group.id} style={[styles.groupCard, group.is_member && styles.groupCardJoined]}>
              {group.image_url ? <Image source={{ uri: group.image_url }} style={styles.groupImage} /> : <Image source={BACKGROUNDS.people} style={styles.groupImage} />}
              <View style={styles.groupText}>
                <Text style={styles.previewKicker}>{groupReason(group, form.interests, form.homeCity).toUpperCase()}</Text>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>{group.member_count} members · {[group.city, group.state].filter(Boolean).join(', ') || 'Community'}</Text>
              </View>
              <Pressable style={[styles.joinButton, group.is_member && styles.joinButtonDone]} disabled={group.is_member || Boolean(groupBusyId)} onPress={() => void joinSuggestedGroup(group)}>
                <Text style={[styles.joinButtonText, group.is_member && styles.joinButtonTextDone]}>{group.is_member ? 'Joined ✓' : groupBusyId === group.id ? 'Joining…' : 'Join'}</Text>
              </Pressable>
            </View>
          ))}
          {!groupsLoading && !groupSuggestions.length ? (
            <View style={styles.emptyCard}><Ionicons name="flame-outline" size={28} color={GOLD} /><Text style={styles.emptyTitle}>Campfires are waiting for you.</Text><Text style={styles.emptyCopy}>You can explore groups by interest and location once you finish setup.</Text></View>
          ) : null}
        </View>
        <View style={styles.actionCardCompact}>
          <Text style={styles.actionTitle}>Choose Campfires to join</Text>
          <Text style={styles.actionCopy}>Join any that feel relevant. You can always explore more later.</Text>
          <PrimaryButton label="Continue" onPress={next} />
          <Pressable style={styles.secondaryAction} onPress={next}><Text style={styles.secondaryActionText}>Skip for now</Text></Pressable>
        </View>
      </SectionShell>
    );
  }

  return (
    <ImageBackground source={BACKGROUNDS.complete} style={styles.fullScreen}>
      <View style={styles.backgroundShadeStrong} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.completeStage}>
          <View style={styles.completeProgress}>{Array.from({ length: 6 }, (_, index) => <View key={index} style={styles.completeSegment} />)}<View style={styles.completeCheck}><Ionicons name="checkmark" size={14} color={BG} /></View></View>
          <Text style={styles.completeTitle}>You’re <Text style={styles.goldText}>all set.</Text></Text>
          <Text style={styles.completeCopy}>Your Trailhead is ready. We’ll keep personalizing Go Melanated as you explore.</Text>
          <Image source={LOGO} style={styles.completeLogo} resizeMode="contain" />
          <View style={styles.savedCard}><Ionicons name="checkmark-circle" size={30} color={GOLD} /><Text style={styles.savedTitle}>Preferences saved</Text></View>
          <View style={styles.completeSpacer} />
          <PrimaryButton label={saving ? 'Finishing…' : 'Go to Trailhead'} disabled={saving} onPress={() => void finish()} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  flex: { flex: 1 },
  backgroundShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,6,0.55)' },
  backgroundShadeWelcome: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,6,0.60)' },
  backgroundShadeStrong: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,6,0.72)' },
  goldText: { color: GOLD },
  loadingStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: MUTED, fontSize: 14 },
  primaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 22 },
  primaryButtonDisabled: { opacity: 0.38 },
  primaryButtonText: { color: BG, fontSize: 17, fontWeight: '900' },
  welcomeStage: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22, justifyContent: 'space-between' },
  welcomeCluster: { gap: 14, paddingTop: 18 },
  welcomeLogo: { width: 94, height: 94, alignSelf: 'center', marginBottom: 4 },
  welcomeTitle: { color: TEXT, fontSize: 40, lineHeight: 44, fontWeight: '900', letterSpacing: -1.4 },
  welcomeCopy: { color: '#E0E4E1', fontSize: 16, lineHeight: 23, maxWidth: 500 },
  nameStage: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  nameTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  nameLogo: { width: 64, height: 64 },
  skipText: { color: MUTED, fontSize: 14, fontWeight: '700' },
  eyebrow: { color: GOLD, fontSize: 11, fontWeight: '900', letterSpacing: 1.45, marginBottom: 7 },
  nameTitle: { color: TEXT, fontSize: 36, lineHeight: 40, fontWeight: '900', letterSpacing: -1 },
  nameInputWrap: { minHeight: 60, marginTop: 22, borderRadius: 16, borderWidth: 1, borderColor: '#836A29', backgroundColor: 'rgba(12,23,18,0.94)', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 },
  nameInput: { flex: 1, color: TEXT, fontSize: 19, paddingVertical: 15 },
  helloText: { color: '#E1E5E2', fontSize: 16, marginTop: 15 },
  nameSpacer: { flex: 1, minHeight: 12 },
  sectionShell: { flex: 1, backgroundColor: BG },
  sectionHeader: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerBack: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  sectionHeaderCopy: { flex: 1 },
  sectionHeaderTitle: { color: TEXT, fontSize: 27, fontWeight: '900', letterSpacing: -0.7 },
  sectionGreeting: { color: MUTED, fontSize: 12, marginTop: 1 },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 7 },
  progressSegment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: '#2B3530' },
  progressSegmentActive: { backgroundColor: GOLD },
  sectionScroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },
  sectionScrollFixed: { flexGrow: 1, paddingBottom: 10 },
  contentFrame: { width: '100%', maxWidth: 620, alignSelf: 'center' },
  contentFrameFixed: { flex: 1 },
  sectionIntro: { marginBottom: 13 },
  sectionTitle: { color: TEXT, fontSize: 29, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7 },
  sectionCopy: { color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 6 },
  bottomNav: { minHeight: 65, borderTopWidth: 1, borderTopColor: '#1E2A24', backgroundColor: '#09110D', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingHorizontal: 4, paddingTop: 9 },
  navItem: { minWidth: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navLabel: { color: '#7C8881', fontSize: 10 },
  navLabelActive: { color: GOLD, fontWeight: '800' },
  navUnderline: { width: 24, height: 3, borderRadius: 3, backgroundColor: GOLD, marginTop: 1 },
  trailheadIntroStage: { flex: 1 },
  trailheadHero: { height: 160, borderRadius: 20, overflow: 'hidden', padding: 13, marginBottom: 10, justifyContent: 'space-between' },
  trailheadHeroImage: { borderRadius: 20 },
  trailheadHeroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,6,0.42)' },
  trailheadHeroMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trailheadExplorerBadge: { width: 82, height: 82 },
  trailheadHeroCopy: { flex: 1, minWidth: 0 },
  trailheadRankRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5 },
  trailheadRankName: { color: TEXT, fontSize: 19, lineHeight: 22, fontWeight: '900', letterSpacing: 0.8 },
  trailheadRankLevel: { color: GOLD, fontSize: 15, fontWeight: '900' },
  trailheadRankSubcopy: { color: '#E5E9E6', fontSize: 11.5, marginTop: 2 },
  trailheadWeatherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  trailheadWeatherText: { color: TEXT, fontSize: 12.5, fontWeight: '800' },
  trailheadLocationText: { color: '#DFE4E1', fontSize: 10.5, marginTop: 2 },
  stickerTray: { alignSelf: 'flex-end', minHeight: 42, borderRadius: 999, backgroundColor: 'rgba(4,9,7,0.80)', borderWidth: 1, borderColor: 'rgba(245,184,46,0.38)', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 5 },
  stickerPreview: { width: 31, height: 31, borderRadius: 16, borderWidth: 1, borderColor: '#7D672A' },
  stickerCount: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#2B2B22', alignItems: 'center', justifyContent: 'center' },
  stickerCountText: { color: GOLD, fontSize: 10.5, fontWeight: '900' },
  badgeGuideCard: { borderRadius: 18, borderWidth: 1, borderColor: '#403D2D', backgroundColor: '#101612', padding: 11, gap: 6 },
  badgeGuideHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 1 },
  badgeGuideEyebrow: { color: GOLD, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 },
  badgeGuideRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeGuideIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#8B6D22', backgroundColor: '#171810', alignItems: 'center', justifyContent: 'center' },
  badgeGuideIconText: { color: GOLD, fontSize: 11.5, fontWeight: '900' },
  badgeGuideTitle: { color: TEXT, fontSize: 12.5, lineHeight: 16, fontWeight: '900' },
  badgeGuideText: { color: MUTED, fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  badgeGuideDivider: { height: 1, backgroundColor: '#293129', marginLeft: 44 },
  trailheadContinue: { marginTop: 'auto', paddingTop: 10 },
  rankHero: { height: 190, borderRadius: 21, overflow: 'hidden', padding: 16, justifyContent: 'space-between', marginBottom: 12 },
  rankHeroImage: { borderRadius: 21 },
  rankShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,6,0.40)' },
  rankTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  explorerBadge: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: GOLD, backgroundColor: 'rgba(5,10,8,0.75)', alignItems: 'center', justifyContent: 'center' },
  rankTitle: { color: TEXT, fontSize: 24, fontWeight: '900' },
  rankSubcopy: { color: '#DFE4E1', fontSize: 12, marginTop: 1 },
  weatherBlock: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  weatherTemp: { color: TEXT, fontSize: 42, fontWeight: '700' },
  weatherCondition: { color: TEXT, fontSize: 14, fontWeight: '800' },
  weatherLocation: { color: '#DFE4E1', fontSize: 11, marginTop: 2 },
  previewGrid: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  previewCard: { flex: 1, minHeight: 122, borderRadius: 17, overflow: 'hidden', justifyContent: 'flex-end' },
  previewCardImage: { borderRadius: 17 },
  previewShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,6,4,0.42)' },
  previewCardText: { padding: 12 },
  previewKicker: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  previewTitle: { color: TEXT, fontSize: 15, lineHeight: 18, fontWeight: '900', marginTop: 4 },
  previewCopy: { color: '#E3E7E4', fontSize: 10.5, lineHeight: 14, marginTop: 3 },
  actionCard: { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 15, gap: 11 },
  actionCardCompact: { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 15, gap: 10, marginTop: 12 },
  actionTitle: { color: TEXT, fontSize: 19, lineHeight: 23, fontWeight: '900' },
  actionCopy: { color: MUTED, fontSize: 12.5, lineHeight: 17, marginTop: -4 },
  actionCopyStandalone: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#3A4740', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#101713' },
  choiceChipSelected: { borderColor: GOLD, backgroundColor: GOLD },
  choiceChipText: { color: '#E3E7E4', fontSize: 12, fontWeight: '800' },
  choiceChipTextSelected: { color: BG },
  selectionStatus: { minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 7 },
  selectionStatusText: { color: '#8E9992', fontSize: 12, fontWeight: '700' },
  selectionStatusTextReady: { color: GOLD },
  moreInterests: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  moreInterestsText: { color: GOLD, fontSize: 12, fontWeight: '800' },
  featureRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  guideHero: { height: 145, borderRadius: 19, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 10 },
  guideHeroImage: { borderRadius: 19 },
  guideHeroText: { padding: 14 },
  guideHeroTitle: { color: TEXT, fontSize: 22, lineHeight: 25, fontWeight: '900', marginTop: 3 },
  compactLocationCard: { borderRadius: 19, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 13, gap: 10 },
  compactLocationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  compactLocationTitle: { color: TEXT, fontSize: 16, fontWeight: '900' },
  compactLocationCopy: { color: MUTED, fontSize: 11.5, lineHeight: 16, marginTop: 1 },
  locationButtonRow: { flexDirection: 'row', gap: 8 },
  locationButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#4A593F', backgroundColor: '#111B15', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  locationButtonText: { color: TEXT, fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.66)' },
  cityModal: { maxHeight: '82%', backgroundColor: '#0D1712', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 10 },
  modalHandle: { width: 42, height: 4, borderRadius: 3, backgroundColor: '#526159', alignSelf: 'center', marginBottom: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 15 },
  modalTitle: { color: TEXT, fontSize: 24, fontWeight: '900' },
  modalCopy: { color: MUTED, fontSize: 12, marginTop: 3 },
  inputLabel: { color: MUTED, fontSize: 11, fontWeight: '800', marginTop: 8, marginBottom: 5 },
  smallInput: { minHeight: 45, borderRadius: 11, borderWidth: 1, borderColor: '#37453D', color: TEXT, paddingHorizontal: 12, backgroundColor: '#0C1510', fontSize: 13 },
  suggestionList: { borderWidth: 1, borderColor: '#29372F', borderRadius: 11, marginTop: 5, overflow: 'hidden', maxHeight: 210 },
  suggestionRow: { minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#202D27', backgroundColor: '#101913' },
  suggestionText: { color: TEXT, fontSize: 13, fontWeight: '700' },
  suggestionMeta: { color: MUTED, fontSize: 11 },
  cityResults: { marginTop: 5, maxHeight: 250 },
  cityResultRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#202D27', paddingHorizontal: 5 },
  cityResultText: { color: TEXT, fontSize: 14, fontWeight: '700' },
  postCard: { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 13, marginBottom: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  postAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: GOLD, backgroundColor: '#324138', alignItems: 'center', justifyContent: 'center' },
  postAvatarText: { color: GOLD, fontWeight: '900', fontSize: 12 },
  postAuthor: { color: TEXT, fontSize: 14, fontWeight: '900' },
  postMeta: { color: MUTED, fontSize: 11 },
  postBody: { color: TEXT, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 11 },
  postImage: { width: '100%', height: 125, borderRadius: 14, marginTop: 10 },
  postStats: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 9 },
  postTag: { marginLeft: 'auto', borderRadius: 999, borderWidth: 1, borderColor: '#7A6528', paddingHorizontal: 9, paddingVertical: 4 },
  postTagText: { color: GOLD, fontSize: 10, fontWeight: '800' },
  findFriendsCard: { borderRadius: 20, borderWidth: 1, borderColor: '#4D4020', backgroundColor: '#121A14', padding: 15, gap: 12, marginBottom: 16 },
  findFriendsIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: '#6F5C26', backgroundColor: '#191D13', alignItems: 'center', justifyContent: 'center' },
  subsectionTitle: { color: TEXT, fontSize: 17, fontWeight: '900', marginBottom: 9 },
  subsectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  joinedCount: { color: GOLD, fontSize: 12, fontWeight: '800' },
  inlineLoader: { marginVertical: 14 },
  peopleRow: { flexDirection: 'row', gap: 8 },
  personCard: { flex: 1, minWidth: 0, borderRadius: 17, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 9, position: 'relative' },
  demoBadge: { position: 'absolute', top: 7, right: 7, zIndex: 2, borderRadius: 999, backgroundColor: '#2D301E', paddingHorizontal: 6, paddingVertical: 3 },
  demoBadgeText: { color: GOLD, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  personAvatar: { width: '100%', aspectRatio: 1, borderRadius: 13, marginBottom: 8 },
  avatarFallback: { backgroundColor: '#223129', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: GOLD, fontSize: 24, fontWeight: '900' },
  personName: { color: TEXT, fontSize: 12, fontWeight: '900' },
  personMeta: { color: MUTED, fontSize: 9.5, marginTop: 2 },
  personInterest: { color: GOLD, fontSize: 9.5, fontWeight: '800', marginTop: 5 },
  connectButton: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 5 },
  connectButtonDone: { backgroundColor: GOLD },
  connectButtonDemo: { borderColor: '#455249', opacity: 0.7 },
  connectButtonText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  connectButtonTextDone: { color: BG },
  groupList: { gap: 9 },
  groupCard: { minHeight: 82, borderRadius: 17, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupCardJoined: { borderColor: '#7D672A', backgroundColor: '#171A10' },
  groupImage: { width: 58, height: 58, borderRadius: 12 },
  groupText: { flex: 1 },
  groupName: { color: TEXT, fontSize: 14, fontWeight: '900', marginTop: 2 },
  groupMeta: { color: MUTED, fontSize: 10.5, marginTop: 3 },
  joinButton: { minWidth: 66, minHeight: 38, borderRadius: 11, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  joinButtonDone: { backgroundColor: GOLD },
  joinButtonText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  joinButtonTextDone: { color: BG },
  secondaryAction: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: GOLD, fontSize: 12, fontWeight: '800' },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE_2, padding: 18, alignItems: 'center', gap: 7 },
  emptyTitle: { color: TEXT, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { color: MUTED, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  completeStage: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 26, paddingBottom: 20 },
  completeProgress: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 28 },
  completeSegment: { width: 30, height: 4, borderRadius: 4, backgroundColor: GOLD },
  completeCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  completeTitle: { color: TEXT, fontSize: 39, lineHeight: 43, fontWeight: '900', letterSpacing: -1.2, textAlign: 'center' },
  completeCopy: { color: '#E2E6E3', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 460 },
  completeLogo: { width: 104, height: 104, marginTop: 28 },
  savedCard: { minHeight: 58, borderRadius: 17, borderWidth: 1, borderColor: '#526057', backgroundColor: 'rgba(11,20,15,0.84)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18, marginTop: 20, alignSelf: 'stretch' },
  savedTitle: { color: TEXT, fontSize: 15, fontWeight: '900' },
  completeSpacer: { flex: 1, minHeight: 22 },
});
