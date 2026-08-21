import Ionicons from '@react-native-vector-icons/ionicons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
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

const GOLD = '#F5B82E';
const BG = '#07100C';
const TEXT = '#FFF9EC';
const MUTED = '#B7C0BA';
const SURFACE = '#101913';
const SURFACE_2 = '#16221B';
const BORDER = '#29372F';
const TOTAL_STEPS = 9;

const BACKGROUNDS = {
  welcome: require('../../assets/onboarding/onboarding-welcome.jpg'),
  trailhead: require('../../assets/onboarding/onboarding-plan.jpg'),
  people: require('../../assets/onboarding/onboarding-people.jpg'),
  places: require('../../assets/onboarding/onboarding-places.jpg'),
  share: require('../../assets/onboarding/onboarding-share.jpg'),
  complete: require('../../assets/onboarding/onboarding-complete.jpg'),
} as const;

const LOGO = require('../../assets/go-melanated-logo.png');

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

const ADVENTURE_OPTIONS = [
  'Camping trips',
  'Day trips',
  'Weekend trips',
  'Water adventures',
  'Road trips',
  'Beginner experiences',
] as const;

const OUTPOST_OPTIONS = [
  ['Find people to adventure with', 'Meet new people', 'people-outline'],
  ['Learn how to get outdoors', 'Get advice', 'chatbubble-outline'],
  ['Discover things happening nearby', 'Find events', 'calendar-outline'],
  ['Share my adventures', 'Share adventures', 'images-outline'],
  ['Explore new places', 'Explore locally', 'compass-outline'],
] as const;

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
    <Pressable style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color={BG} />
    </Pressable>
  );
}

function ChoiceChip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: string }) {
  return (
    <Pressable style={[styles.choiceChip, selected && styles.choiceChipSelected]} onPress={onPress}>
      {icon ? <Ionicons name={icon as never} size={15} color={selected ? BG : GOLD} /> : null}
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={15} color={BG} /> : null}
    </Pressable>
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
  return (
    <View style={styles.bottomNav}>
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

function SectionShell({ active, name, children, step }: { active: SectionName; name: string; children: React.ReactNode; step: number }) {
  return (
    <View style={styles.sectionShell}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionHeaderTitle}>{active}</Text>
          <Text style={styles.sectionGreeting}>Good morning, {name}</Text>
        </View>
        <Ionicons name="notifications-outline" size={22} color={GOLD} />
      </View>
      <StepProgress step={step} />
      <ScrollView contentContainerStyle={styles.sectionScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <BottomNav active={active} />
    </View>
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
    void load().catch((error) => {
      Alert.alert('Unable to start setup', error instanceof Error ? error.message : 'Please try again.');
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!form.homeState) {
      setCities([]);
      return;
    }
    let active = true;
    setCitiesLoading(true);
    void loadCitiesForState(form.homeState)
      .then((values) => {
        if (active) setCities(values);
      })
      .catch(() => {
        if (active) setCities([]);
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form.homeState]);

  useEffect(() => {
    if (!userId || step !== 7) return;
    let active = true;
    setSuggestionsLoading(true);
    async function loadSuggestions() {
      let query = supabase.from('community_profile_directory').select('*').neq('id', userId).limit(6);
      if (form.homeState) query = query.eq('home_state', form.homeState);
      let result = await query;
      if (result.error && form.homeState) {
        result = await supabase.from('community_profile_directory').select('*').neq('id', userId).limit(6);
      }
      if (result.error) throw result.error;
      if (active) setSuggestions((result.data ?? []) as CommunitySuggestion[]);
    }
    void loadSuggestions()
      .catch((error) => console.warn('[onboarding] trailmates preview failed', error))
      .finally(() => {
        if (active) setSuggestionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form.homeState, step, userId]);

  useEffect(() => {
    if (step !== 8) return;
    let active = true;
    setGroupsLoading(true);
    void getGroups()
      .then((groups) => {
        if (active) setGroupSuggestions(rankGroups(groups, form.interests, form.homeCity, form.homeState));
      })
      .catch((error) => console.warn('[onboarding] campfire preview failed', error))
      .finally(() => {
        if (active) setGroupsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form.homeCity, form.homeState, form.interests, step]);

  const stateOptions = useMemo(() => {
    if (!stateOpen) return [];
    const query = stateSearch.trim().toLowerCase();
    return US_STATES.filter((state) => !query || state.name.toLowerCase().includes(query) || state.abbreviation.toLowerCase().startsWith(query)).slice(0, 7);
  }, [stateOpen, stateSearch]);

  const cityOptions = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!form.homeState || !query || citySearch === form.homeCity) return [];
    return cities.filter((city) => city.toLowerCase().includes(query)).slice(0, 7);
  }, [cities, citySearch, form.homeCity, form.homeState]);

  const greetingName = form.displayName.trim() || username || 'friend';
  const locationLabel = [form.homeCity, form.homeState].filter(Boolean).join(', ');

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
    if (connectingId || connectionSentIds.has(person.id)) return;
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

  function skipTour() {
    if (wasAlreadyComplete) router.replace('/(tabs)' as never);
    else setStep(9);
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
        <View style={styles.backgroundShadeStrong} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.welcomeStage}>
            <Image source={LOGO} style={styles.welcomeLogo} resizeMode="contain" />
            <View>
              <Text style={styles.welcomeTitle}>Find your people.{`\n`}<Text style={styles.goldText}>Find your outside.</Text></Text>
              <Text style={styles.welcomeCopy}>Discover amazing places, find adventures, learn something new, and connect with a community built for us.</Text>
            </View>
            <View style={styles.flex} />
            <PrimaryButton label="Get started" onPress={next} />
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
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.nameStage}>
                <View style={styles.nameTopRow}>
                  <Image source={LOGO} style={styles.nameLogo} resizeMode="contain" />
                  {wasAlreadyComplete ? <Pressable onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.skipText}>Exit replay</Text></Pressable> : null}
                </View>
                <Text style={styles.eyebrow}>FIRST THINGS FIRST</Text>
                <Text style={styles.nameTitle}>What should we call you?</Text>
                <Text style={styles.sectionCopy}>We will personalize the tour as we go.</Text>
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
                <View style={styles.flex} />
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
      <SectionShell active="Trailhead" name={greetingName} step={step}>
        <SectionIntro eyebrow="YOUR HOME BASE" title="Welcome to your Trailhead" copy="Your Trailhead brings your rank, weather, upcoming adventures, nearby finds, guides, and community activity into one place." />
        <ImageBackground source={BACKGROUNDS.trailhead} style={styles.rankHero} imageStyle={styles.rankHeroImage}>
          <View style={styles.rankShade} />
          <View style={styles.rankTopRow}>
            <View style={styles.explorerBadge}><Ionicons name="compass-outline" size={27} color={GOLD} /></View>
            <View style={styles.flex}>
              <Text style={styles.previewKicker}>EXPLORER</Text>
              <Text style={styles.rankTitle}>Level 1</Text>
              <Text style={styles.rankSubcopy}>Everyone starts here.</Text>
            </View>
          </View>
          <View style={styles.weatherBlock}>
            <Text style={styles.weatherTemp}>68°</Text>
            <View><Text style={styles.weatherCondition}>Clear skies</Text><Text style={styles.weatherLocation}>{locationLabel || 'Your local weather'}</Text></View>
          </View>
        </ImageBackground>
        <View style={styles.previewGrid}>
          <PreviewCard image={BACKGROUNDS.share} kicker="UPCOMING" title="Weekend Camping Trip" copy="Your next adventure at a glance" />
          <PreviewCard image={BACKGROUNDS.places} kicker="NEAR YOU" title="Places worth exploring" copy="Local ideas that fit your interests" />
        </View>
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>What kinds of things are you interested in?</Text>
          <Text style={styles.actionCopy}>Pick a few so your Trailhead can start feeling like yours.</Text>
          <View style={styles.chipWrap}>
            {INTEREST_OPTIONS.slice(0, 9).map((interest) => (
              <ChoiceChip key={interest} label={interest} selected={form.interests.includes(interest)} onPress={() => update('interests', toggleValue(form.interests, interest))} />
            ))}
          </View>
          <PrimaryButton label="Update my Trailhead" disabled={!form.interests.length} onPress={next} />
        </View>
      </SectionShell>
    );
  }

  if (step === 4) {
    return (
      <SectionShell active="Adventures" name={greetingName} step={step}>
        <SectionIntro eyebrow="PLAN · JOIN · EXPERIENCE" title="Adventures" copy="Discover upcoming trips, camps, events, and experiences created for the community, then reserve your spot when something feels right." />
        <View style={styles.featureRow}>
          <PreviewCard image={BACKGROUNDS.share} kicker="UPCOMING" title="Lil Camp of Horrors" copy="A fall camping weekend" />
          <PreviewCard image={BACKGROUNDS.trailhead} kicker="WINTER" title="Winter Camp" copy="Cold air, warm fire" />
          <PreviewCard image={BACKGROUNDS.places} kicker="ESCAPE" title="Great Beach Escape" copy="Sun, coast, and community" />
        </View>
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>What kinds of adventures excite you?</Text>
          <Text style={styles.actionCopy}>Select a few to personalize recommendations.</Text>
          <View style={styles.chipWrap}>
            {ADVENTURE_OPTIONS.map((option) => (
              <ChoiceChip key={option} label={option} selected={form.adventurePreferences.includes(option)} onPress={() => update('adventurePreferences', toggleValue(form.adventurePreferences, option))} />
            ))}
          </View>
          <PrimaryButton label="Save & continue" disabled={!form.adventurePreferences.length} onPress={next} />
        </View>
        <Pressable style={styles.backLink} onPress={back}><Ionicons name="chevron-back" size={16} color={MUTED} /><Text style={styles.backLinkText}>Back</Text></Pressable>
      </SectionShell>
    );
  }

  if (step === 5) {
    return (
      <SectionShell active="Trail Guide" name={greetingName} step={step}>
        <SectionIntro eyebrow="DISCOVER · LEARN · EXPLORE" title="Find places. Learn what to know." copy="Trail Guide helps you discover outdoor places nearby and gives you practical knowledge to feel prepared before you go." />
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
          <PreviewCard image={BACKGROUNDS.share} kicker="GUIDES & KNOW-HOW" title="Beginner&apos;s packing list" copy="Simple advice before you head out" />
        </View>
        <View style={styles.miniRail}>
          {['Springs', 'Camping', 'Scenic escapes'].map((item) => <View key={item} style={styles.miniChip}><Text style={styles.miniChipText}>{item}</Text></View>)}
        </View>
        <View style={styles.compactLocationCard}>
          <View style={styles.compactLocationHeader}>
            <Ionicons name="location-outline" size={19} color={GOLD} />
            <View style={styles.flex}>
              <Text style={styles.compactLocationTitle}>Make Trail Guide local</Text>
              <Text style={styles.compactLocationCopy}>{locationLabel || 'Use your location or choose a city for nearby recommendations.'}</Text>
            </View>
          </View>
          <View style={styles.locationButtonRow}>
            <Pressable style={styles.locationButton} disabled={locating} onPress={() => void requestCurrentLocation()}>
              <Ionicons name="navigate-outline" size={16} color={GOLD} />
              <Text style={styles.locationButtonText}>{locating ? 'Finding…' : 'Use location'}</Text>
            </Pressable>
            <Pressable style={styles.locationButton} onPress={() => setCityPickerOpen((value) => !value)}>
              <Ionicons name="search-outline" size={16} color={GOLD} />
              <Text style={styles.locationButtonText}>Choose city</Text>
            </Pressable>
          </View>
          {cityPickerOpen ? (
            <View style={styles.cityPicker}>
              <View>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={styles.smallInput}
                  value={stateSearch}
                  placeholder="Start typing your state"
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
                {stateOptions.length ? (
                  <View style={styles.suggestionList}>
                    {stateOptions.map((state) => (
                      <Pressable key={state.abbreviation} style={styles.suggestionRow} onPress={() => {
                        setStateSearch(state.name);
                        update('homeState', state.abbreviation);
                        update('homeCity', '');
                        setCitySearch('');
                        setStateOpen(false);
                      }}>
                        <Text style={styles.suggestionText}>{state.name}</Text>
                        <Text style={styles.suggestionMeta}>{state.abbreviation}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              <View>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.smallInput}
                  editable={Boolean(form.homeState) && !citiesLoading}
                  value={citySearch}
                  placeholder={form.homeState ? 'Start typing your city' : 'Choose a state first'}
                  placeholderTextColor="#6D7A73"
                  onChangeText={(value) => {
                    setCitySearch(value);
                    update('homeCity', '');
                  }}
                />
                {cityOptions.length ? (
                  <View style={styles.suggestionList}>
                    {cityOptions.map((city) => (
                      <Pressable key={city} style={styles.suggestionRow} onPress={() => {
                        setCitySearch(city);
                        update('homeCity', city);
                        setCityPickerOpen(false);
                      }}>
                        <Text style={styles.suggestionText}>{city}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
          <PrimaryButton label="Continue" disabled={!form.homeCity || !form.homeState} onPress={next} />
        </View>
        <Pressable style={styles.backLink} onPress={back}><Ionicons name="chevron-back" size={16} color={MUTED} /><Text style={styles.backLinkText}>Back</Text></Pressable>
      </SectionShell>
    );
  }

  if (step === 6) {
    return (
      <SectionShell active="Outpost" name={greetingName} step={step}>
        <SectionIntro eyebrow="CONNECT · SHARE · GET INSPIRED" title="Outpost" copy="Outpost is your community feed for nearby posts, questions, experiences, recommendations, and local happenings." />
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
          <Text style={styles.actionTitle}>What do you want most from Outpost?</Text>
          <Text style={styles.actionCopy}>This helps us shape your community experience.</Text>
          <View style={styles.chipWrap}>
            {OUTPOST_OPTIONS.map(([value, label, icon]) => (
              <ChoiceChip key={value} label={label} icon={icon} selected={form.intents.includes(value)} onPress={() => update('intents', toggleValue(form.intents, value))} />
            ))}
          </View>
          <PrimaryButton label="Continue" disabled={!form.intents.length} onPress={next} />
        </View>
        <Pressable style={styles.backLink} onPress={back}><Ionicons name="chevron-back" size={16} color={MUTED} /><Text style={styles.backLinkText}>Back</Text></Pressable>
      </SectionShell>
    );
  }

  if (step === 7) {
    return (
      <SectionShell active="Trailmates" name={greetingName} step={step}>
        <SectionIntro eyebrow="FIND YOUR PEOPLE" title="Trailmates" copy="Discover people who share your interests and build mutual connections for future adventures, questions, and local plans." />
        {suggestionsLoading ? <ActivityIndicator color={GOLD} style={styles.inlineLoader} /> : null}
        <View style={styles.peopleRow}>
          {suggestions.slice(0, 3).map((person) => {
            const sent = connectionSentIds.has(person.id);
            return (
              <View key={person.id} style={styles.personCard}>
                <Avatar person={person} />
                <Text style={styles.personName} numberOfLines={1}>{person.display_name || person.username || 'Explorer'}</Text>
                <Text style={styles.personMeta} numberOfLines={1}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Go Melanated'}</Text>
                <Text style={styles.personInterest} numberOfLines={1}>{person.interests?.[0] || 'Outdoors'}</Text>
                <Pressable style={[styles.connectButton, sent && styles.connectButtonDone]} disabled={sent || connectingId === person.id} onPress={() => void connect(person)}>
                  <Text style={[styles.connectButtonText, sent && styles.connectButtonTextDone]}>{sent ? 'Sent' : connectingId === person.id ? 'Sending…' : 'Connect'}</Text>
                </Pressable>
              </View>
            );
          })}
          {!suggestionsLoading && !suggestions.length ? (
            <View style={styles.emptyCard}><Ionicons name="people-outline" size={28} color={GOLD} /><Text style={styles.emptyTitle}>Suggestions will grow with you.</Text><Text style={styles.emptyCopy}>As more people join nearby, Trailmates will surface better matches.</Text></View>
          ) : null}
        </View>
        <View style={styles.actionCardCompact}>
          <Text style={styles.actionTitle}>Connect now or keep exploring.</Text>
          <Text style={styles.actionCopy}>You can always find more Trailmates later.</Text>
          <PrimaryButton label="Continue" onPress={next} />
          <Pressable style={styles.secondaryAction} onPress={next}><Text style={styles.secondaryActionText}>I will do this later</Text></Pressable>
        </View>
        <Pressable style={styles.backLink} onPress={back}><Ionicons name="chevron-back" size={16} color={MUTED} /><Text style={styles.backLinkText}>Back</Text></Pressable>
      </SectionShell>
    );
  }

  if (step === 8) {
    return (
      <SectionShell active="Campfires" name={greetingName} step={step}>
        <SectionIntro eyebrow="GROUPS · SUPPORT · BELONG" title="Campfires" copy="Campfires are interest and place-based groups where deeper conversations, shared knowledge, and recurring connections happen." />
        {groupsLoading ? <ActivityIndicator color={GOLD} style={styles.inlineLoader} /> : null}
        <View style={styles.groupList}>
          {groupSuggestions.map((group) => (
            <View key={group.id} style={styles.groupCard}>
              {group.image_url ? <Image source={{ uri: group.image_url }} style={styles.groupImage} /> : <Image source={BACKGROUNDS.people} style={styles.groupImage} />}
              <View style={styles.groupText}>
                <Text style={styles.previewKicker}>{group.kind.toUpperCase()}</Text>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>{group.member_count} members · {[group.city, group.state].filter(Boolean).join(', ') || 'Community'}</Text>
              </View>
              <Pressable style={[styles.joinButton, group.is_member && styles.joinButtonDone]} disabled={group.is_member || Boolean(groupBusyId)} onPress={() => void joinSuggestedGroup(group)}>
                <Text style={[styles.joinButtonText, group.is_member && styles.joinButtonTextDone]}>{group.is_member ? 'Joined' : groupBusyId === group.id ? 'Joining…' : 'Join'}</Text>
              </Pressable>
            </View>
          ))}
          {!groupsLoading && !groupSuggestions.length ? (
            <View style={styles.emptyCard}><Ionicons name="flame-outline" size={28} color={GOLD} /><Text style={styles.emptyTitle}>Campfires are waiting for you.</Text><Text style={styles.emptyCopy}>You can explore groups by interest and location once you finish setup.</Text></View>
          ) : null}
        </View>
        <View style={styles.actionCardCompact}>
          <Text style={styles.actionTitle}>Join a few or keep moving.</Text>
          <Text style={styles.actionCopy}>Your Campfires stay available from the main navigation.</Text>
          <PrimaryButton label="Continue" onPress={next} />
          <Pressable style={styles.secondaryAction} onPress={next}><Text style={styles.secondaryActionText}>I will explore groups later</Text></Pressable>
        </View>
        <Pressable style={styles.backLink} onPress={back}><Ionicons name="chevron-back" size={16} color={MUTED} /><Text style={styles.backLinkText}>Back</Text></Pressable>
      </SectionShell>
    );
  }

  return (
    <ImageBackground source={BACKGROUNDS.complete} style={styles.fullScreen}>
      <View style={styles.backgroundShadeStrong} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.completeStage}>
          <View style={styles.completeProgress}>{Array.from({ length: 6 }, (_, index) => <View key={index} style={styles.completeSegment} />)}<View style={styles.completeCheck}><Ionicons name="checkmark" size={14} color={BG} /></View></View>
          <Text style={styles.completeTitle}>You are <Text style={styles.goldText}>all set.</Text></Text>
          <Text style={styles.completeCopy}>Your Trailhead is ready. Go Melanated will keep learning from what you like so adventures, places, and community feel more personal from here.</Text>
          <Image source={LOGO} style={styles.completeLogo} resizeMode="contain" />
          <View style={styles.savedCard}><Ionicons name="checkmark-circle-outline" size={34} color={GOLD} /><View style={styles.flex}><Text style={styles.savedTitle}>Your preferences are saved</Text><Text style={styles.savedCopy}>You can change them anytime as you explore.</Text></View></View>
          <View style={styles.flex} />
          <PrimaryButton label={saving ? 'Finishing…' : 'Go to Trailhead'} disabled={saving} onPress={() => void finish()} />
          {step > 1 ? <Pressable style={styles.completeBack} onPress={back}><Text style={styles.secondaryActionText}>Back</Text></Pressable> : null}
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
  backgroundShadeStrong: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,6,0.70)' },
  goldText: { color: GOLD },
  loadingStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: MUTED, fontSize: 14 },
  primaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 22 },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: BG, fontSize: 17, fontWeight: '900' },
  welcomeStage: { flex: 1, paddingHorizontal: 26, paddingTop: 44, paddingBottom: 22, gap: 28 },
  welcomeLogo: { width: 160, height: 160, alignSelf: 'center' },
  welcomeTitle: { color: TEXT, fontSize: 43, lineHeight: 48, fontWeight: '900', letterSpacing: -1.5 },
  welcomeCopy: { color: '#E0E4E1', fontSize: 17, lineHeight: 25, marginTop: 18 },
  nameStage: { flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18 },
  nameTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 38 },
  nameLogo: { width: 78, height: 78 },
  skipText: { color: MUTED, fontSize: 14, fontWeight: '700' },
  eyebrow: { color: GOLD, fontSize: 12, fontWeight: '900', letterSpacing: 1.6, marginBottom: 8 },
  nameTitle: { color: TEXT, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1 },
  nameInputWrap: { minHeight: 62, marginTop: 28, borderRadius: 16, borderWidth: 1, borderColor: '#836A29', backgroundColor: 'rgba(12,23,18,0.92)', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 },
  nameInput: { flex: 1, color: TEXT, fontSize: 19, paddingVertical: 16 },
  helloText: { color: '#E1E5E2', fontSize: 16, marginTop: 18 },
  sectionShell: { flex: 1, backgroundColor: BG },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderTitle: { color: TEXT, fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  sectionGreeting: { color: MUTED, fontSize: 13, marginTop: 2 },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 9 },
  progressSegment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: '#2B3530' },
  progressSegmentActive: { backgroundColor: GOLD },
  sectionScroll: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24 },
  sectionIntro: { marginBottom: 16 },
  sectionTitle: { color: TEXT, fontSize: 31, lineHeight: 35, fontWeight: '900', letterSpacing: -0.8 },
  sectionCopy: { color: MUTED, fontSize: 15, lineHeight: 22, marginTop: 7 },
  bottomNav: { minHeight: 67, borderTopWidth: 1, borderTopColor: '#1E2A24', backgroundColor: '#09110D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4, paddingBottom: 4 },
  navItem: { minWidth: 60, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { color: '#7C8881', fontSize: 10 },
  navLabelActive: { color: GOLD, fontWeight: '800' },
  navUnderline: { width: 24, height: 3, borderRadius: 3, backgroundColor: GOLD, marginTop: 1 },
  rankHero: { height: 218, borderRadius: 22, overflow: 'hidden', padding: 18, justifyContent: 'space-between', marginBottom: 14 },
  rankHeroImage: { borderRadius: 22 },
  rankShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,8,6,0.42)' },
  rankTopRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  explorerBadge: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: GOLD, backgroundColor: 'rgba(5,10,8,0.75)', alignItems: 'center', justifyContent: 'center' },
  rankTitle: { color: TEXT, fontSize: 25, fontWeight: '900' },
  rankSubcopy: { color: '#DFE4E1', fontSize: 12, marginTop: 2 },
  weatherBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weatherTemp: { color: TEXT, fontSize: 46, fontWeight: '700' },
  weatherCondition: { color: TEXT, fontSize: 15, fontWeight: '800' },
  weatherLocation: { color: '#DFE4E1', fontSize: 12, marginTop: 3 },
  previewGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  previewCard: { flex: 1, minHeight: 145, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  previewCardImage: { borderRadius: 18 },
  previewShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,6,4,0.42)' },
  previewCardText: { padding: 13 },
  previewKicker: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  previewTitle: { color: TEXT, fontSize: 16, lineHeight: 19, fontWeight: '900', marginTop: 5 },
  previewCopy: { color: '#E3E7E4', fontSize: 11, lineHeight: 15, marginTop: 4 },
  actionCard: { borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 16, gap: 13 },
  actionCardCompact: { borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 16, gap: 11, marginTop: 14 },
  actionTitle: { color: TEXT, fontSize: 20, lineHeight: 24, fontWeight: '900' },
  actionCopy: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: -5 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: '#3A4740', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#101713' },
  choiceChipSelected: { borderColor: GOLD, backgroundColor: GOLD },
  choiceChipText: { color: '#E3E7E4', fontSize: 12, fontWeight: '700' },
  choiceChipTextSelected: { color: BG },
  featureRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  backLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 11 },
  backLinkText: { color: MUTED, fontSize: 13 },
  guideHero: { height: 165, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 12 },
  guideHeroImage: { borderRadius: 20 },
  guideHeroText: { padding: 15 },
  guideHeroTitle: { color: TEXT, fontSize: 23, lineHeight: 27, fontWeight: '900', marginTop: 4 },
  miniRail: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  miniChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: SURFACE_2, borderWidth: 1, borderColor: BORDER },
  miniChipText: { color: '#DDE3DF', fontSize: 11, fontWeight: '700' },
  compactLocationCard: { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 14, gap: 11 },
  compactLocationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  compactLocationTitle: { color: TEXT, fontSize: 16, fontWeight: '900' },
  compactLocationCopy: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 2 },
  locationButtonRow: { flexDirection: 'row', gap: 8 },
  locationButton: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#4A593F', backgroundColor: '#111B15', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  locationButtonText: { color: TEXT, fontSize: 12, fontWeight: '800' },
  cityPicker: { gap: 10, paddingTop: 2 },
  inputLabel: { color: MUTED, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  smallInput: { minHeight: 43, borderRadius: 11, borderWidth: 1, borderColor: '#37453D', color: TEXT, paddingHorizontal: 12, backgroundColor: '#0C1510', fontSize: 13 },
  suggestionList: { borderWidth: 1, borderColor: '#314038', borderRadius: 10, overflow: 'hidden', marginTop: 5, backgroundColor: '#0A120E' },
  suggestionRow: { minHeight: 39, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#25322B' },
  suggestionText: { color: TEXT, fontSize: 12 },
  suggestionMeta: { color: MUTED, fontSize: 11 },
  postCard: { borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 14, marginBottom: 14 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  postAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#553C10', borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  postAvatarText: { color: TEXT, fontWeight: '900' },
  postAuthor: { color: TEXT, fontSize: 14, fontWeight: '900' },
  postMeta: { color: MUTED, fontSize: 11, marginTop: 2 },
  postBody: { color: '#EEF1EF', fontSize: 15, lineHeight: 21, marginTop: 12 },
  postImage: { width: '100%', height: 145, borderRadius: 14, marginTop: 11 },
  postStats: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 10 },
  postTag: { marginLeft: 'auto', borderRadius: 999, borderWidth: 1, borderColor: '#735916', paddingHorizontal: 9, paddingVertical: 5 },
  postTagText: { color: GOLD, fontSize: 10, fontWeight: '800' },
  inlineLoader: { marginVertical: 18 },
  peopleRow: { flexDirection: 'row', gap: 8 },
  personCard: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 9 },
  personAvatar: { width: '100%', aspectRatio: 0.9, borderRadius: 13, marginBottom: 8 },
  avatarFallback: { backgroundColor: '#19271F', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: GOLD, fontSize: 24, fontWeight: '900' },
  personName: { color: TEXT, fontSize: 13, fontWeight: '900' },
  personMeta: { color: MUTED, fontSize: 10, marginTop: 2 },
  personInterest: { color: GOLD, fontSize: 10, fontWeight: '700', marginTop: 7 },
  connectButton: { minHeight: 35, borderRadius: 10, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  connectButtonDone: { backgroundColor: GOLD },
  connectButtonText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  connectButtonTextDone: { color: BG },
  secondaryAction: { alignItems: 'center', paddingVertical: 5 },
  secondaryActionText: { color: GOLD, fontSize: 12, fontWeight: '800' },
  groupList: { gap: 9 },
  groupCard: { minHeight: 94, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', padding: 9, gap: 10 },
  groupImage: { width: 74, height: 74, borderRadius: 13 },
  groupText: { flex: 1, minWidth: 0 },
  groupName: { color: TEXT, fontSize: 15, fontWeight: '900', marginTop: 3 },
  groupMeta: { color: MUTED, fontSize: 10, lineHeight: 14, marginTop: 4 },
  joinButton: { minWidth: 60, minHeight: 35, borderRadius: 10, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  joinButtonDone: { backgroundColor: GOLD },
  joinButtonText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  joinButtonTextDone: { color: BG },
  emptyCard: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, alignItems: 'center', padding: 20, gap: 8 },
  emptyTitle: { color: TEXT, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { color: MUTED, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  completeStage: { flex: 1, paddingHorizontal: 25, paddingTop: 42, paddingBottom: 20, alignItems: 'stretch' },
  completeProgress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 38 },
  completeSegment: { width: 34, height: 4, borderRadius: 4, backgroundColor: GOLD },
  completeCheck: { width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  completeTitle: { color: TEXT, fontSize: 42, lineHeight: 47, fontWeight: '900', textAlign: 'center' },
  completeCopy: { color: '#E0E5E2', fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 18 },
  completeLogo: { width: 185, height: 185, alignSelf: 'center', marginTop: 25 },
  savedCard: { borderRadius: 18, borderWidth: 1, borderColor: '#48564E', backgroundColor: 'rgba(10,18,14,0.90)', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  savedTitle: { color: TEXT, fontSize: 15, fontWeight: '900' },
  savedCopy: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3 },
  completeBack: { alignItems: 'center', paddingVertical: 12 },
});
