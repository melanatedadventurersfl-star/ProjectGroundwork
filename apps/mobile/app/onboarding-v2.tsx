import Ionicons from '@react-native-vector-icons/ionicons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
const CARD = '#141D19';
const CARD_ALT = '#18231D';
const BORDER = '#2A3730';
const TEXT = '#FFF8E8';
const MUTED = '#9AA59E';
const TOTAL_STEPS = 11;

const EXPERIENCE_COPY: Record<ExperienceLevel, string> = {
  new: 'Just getting started',
  beginner: 'Building confidence',
  intermediate: 'Comfortable outside',
  experienced: 'Seasoned adventurer',
};

const STEP_META = [
  ['WELCOME', 'Find your people. Find your outside.', 'A few choices now make Melanated feel useful the moment you land on Home.'],
  ['YOUR OUTSIDE', 'What does outside look like for you?', 'Pick everything that feels like you. There is no minimum experience required to belong here.'],
  ['YOUR WHY', 'What brought you here?', 'Tell us what you want Melanated to help you do. We will use this to shape discovery over time.'],
  ['NEARBY', 'What is happening around you?', 'Your home area helps surface nearby people, adventures, groups, posts, and places.'],
  ['COMMUNITY', 'Your people are already here.', 'See a live glimpse of members around your area before you ever reach the feed.'],
  ['PROFILE', 'How should people know you?', 'Give the community a name to call you and enough context to make your profile feel human.'],
  ['YOUR CIRCLE', 'Start with a few Trailmates.', 'Connection requests are optional. We recommend people based on location and the community directory.'],
  ['COMMUNITIES', 'Pick a few campfires.', 'Join communities that match your interests so your Campfire has useful conversations from day one.'],
  ['INVITES', 'Outside is better with your people.', 'Every member starts with unique invites. Bring someone along now or come back to this later.'],
  ['STAY IN THE LOOP', 'Do not miss the plan.', 'Choose what matters. We keep notification choices useful instead of turning every tap into a buzz.'],
  ['READY', 'You are in. Let us get outside.', 'Your Home experience is ready with your interests, nearby discovery, and community context.'],
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
  return String(value || 'M')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function Avatar({ person, size = 48 }: { person: CommunitySuggestion; size?: number }) {
  if (person.avatar_url) {
    return <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
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
        const interestScore = needles.reduce((total, needle) => total + (haystack.includes(needle) ? 4 : 0), 0);
        const locationScore = (group.state === state ? 2 : 0) + (group.city?.toLowerCase() === city.toLowerCase() ? 3 : 0);
        const curatedScore = group.kind === 'interest' ? 2 : group.kind === 'local' ? 1 : 0;
        return interestScore + locationScore + curatedScore + Math.min(group.member_count, 20) / 20;
      };
      return score(b) - score(a);
    })
    .slice(0, 6);
}

export default function OnboardingV2Screen() {
  const { session } = useAuth();
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

  useEffect(() => {
    let active = true;
    async function load() {
      if (!session?.user.id) {
        if (active) setLoading(false);
        return;
      }
      const [profile, identity, invites] = await Promise.all([
        loadOnboardingProfile(session.user.id),
        supabase.from('profiles').select('username').eq('id', session.user.id).single(),
        supabase
          .from('member_invites')
          .select('id', { count: 'exact', head: true })
          .eq('sender_profile_id', session.user.id)
          .eq('status', 'available'),
      ]);
      if (!active) return;
      if (identity.error) throw identity.error;
      if (invites.error) console.warn('[onboarding] Unable to load invite count', invites.error.message);

      const communication = (profile.communication_preferences ?? {}) as Record<string, unknown>;
      const state = profile.home_state ?? '';
      const city = profile.home_city ?? '';
      const intentValue = Array.isArray(communication.discovery_intents)
        ? communication.discovery_intents.filter((value): value is string => typeof value === 'string')
        : [];

      setUsername(identity.data?.username ?? null);
      setInviteCount(invites.count ?? 0);
      setWasAlreadyComplete(Boolean(profile.onboarding_completed_at));
      setForm((current) => ({
        ...current,
        firstName: profile.first_name ?? '',
        lastName: profile.last_name ?? '',
        displayName: profile.display_name ?? identity.data?.username ?? '',
        homeCity: city,
        homeState: state,
        discoveryRadiusMiles: profile.discovery_radius_miles ?? 50,
        experienceLevel: (profile.experience_level ?? 'new') as ExperienceLevel,
        interests: profile.interests ?? [],
        intents: intentValue,
        pushEnabled: typeof communication.push === 'boolean' ? communication.push : true,
        emailEnabled: typeof communication.email === 'boolean' ? communication.email : true,
        smsEnabled: typeof communication.sms === 'boolean' ? communication.sms : false,
        phoneNumber: profile.phone_number ?? '',
        smsConsent: Boolean(profile.sms_consent_at),
        accessibilityNeeds: profile.accessibility_needs ?? '',
        dietaryNeeds: profile.dietary_needs ?? '',
        supportNotes: profile.support_notes ?? '',
      }));
      setStateSearch(getStateOption(state)?.name ?? state);
      setCitySearch(city);
      setLoading(false);
    }

    void load().catch((error) => {
      if (!active) return;
      Alert.alert('Unable to start setup', error instanceof Error ? error.message : 'Please try again.');
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!form.homeState) {
      setCities([]);
      return;
    }
    let active = true;
    setCitiesLoading(true);
    loadCitiesForState(form.homeState)
      .then((nextCities) => {
        if (active) setCities(nextCities);
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
    if (!session?.user.id || step < 5) return;
    let active = true;
    setSuggestionsLoading(true);

    async function loadSuggestions() {
      let query = supabase
        .from('community_profile_directory')
        .select('*')
        .neq('id', session!.user.id)
        .limit(6);
      if (form.homeState) query = query.eq('home_state', form.homeState);
      let result = await query;
      if (result.error && form.homeState) {
        result = await supabase
          .from('community_profile_directory')
          .select('*')
          .neq('id', session!.user.id)
          .limit(6);
      }
      if (result.error) throw result.error;
      if (active) setSuggestions((result.data ?? []) as CommunitySuggestion[]);
    }

    void loadSuggestions()
      .catch((error) => console.warn('[onboarding] Unable to load community preview', error instanceof Error ? error.message : error))
      .finally(() => {
        if (active) setSuggestionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form.homeState, session?.user.id, step]);

  useEffect(() => {
    if (step < 8) return;
    let active = true;
    setGroupsLoading(true);
    void getGroups()
      .then((groups) => {
        if (active) setGroupSuggestions(rankGroups(groups, form.interests, form.homeCity, form.homeState));
      })
      .catch((error) => console.warn('[onboarding] Unable to load group suggestions', error instanceof Error ? error.message : error))
      .finally(() => {
        if (active) setGroupsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form.homeCity, form.homeState, form.interests, step]);

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleList = (key: 'interests' | 'intents', value: string) => {
    setForm((current) => {
      const values = current[key];
      return {
        ...current,
        [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  };

  const stateOptions = useMemo(() => {
    if (!stateOpen) return [];
    const query = stateSearch.trim().toLowerCase();
    return US_STATES.filter(
      (state) =>
        !query ||
        state.name.toLowerCase().includes(query) ||
        state.abbreviation.toLowerCase().startsWith(query),
    ).slice(0, 8);
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

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location is optional', 'Choose a city instead and Melanated will use that for nearby discovery.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync(position.coords);
      const place = places[0];
      const region = place?.region ?? '';
      const state =
        US_STATES.find(
          (option) =>
            option.name.toLowerCase() === region.toLowerCase() ||
            option.abbreviation.toLowerCase() === region.toLowerCase(),
        ) ?? null;
      const city = place?.city || place?.subregion || '';
      if (!state || !city) {
        Alert.alert('Choose your city', 'We found your location but could not match it cleanly to a U.S. city.');
        return;
      }
      update('homeState', state.abbreviation);
      update('homeCity', city);
      setStateSearch(state.name);
      setCitySearch(city);
      setStateOpen(false);
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
      Alert.alert('Unable to send request', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setConnectingId(null);
    }
  }

  async function joinSuggestedGroup(group: CommunityGroup) {
    if (group.is_member || groupBusyId) return;
    setGroupBusyId(group.id);
    try {
      await joinGroup(group.id);
      setGroupSuggestions((current) => current.map((item) => (
        item.id === group.id ? { ...item, is_member: true, member_count: item.member_count + 1 } : item
      )));
    } catch (error) {
      Alert.alert('Unable to join group', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setGroupBusyId(null);
    }
  }

  async function requestNotificationPermission() {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('general', {
          name: 'General',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: GOLD,
        });
      }
      const permission = await Notifications.requestPermissionsAsync();
      setNotificationPermission(permission.status);
      update('pushEnabled', permission.status === 'granted');
      if (permission.status !== 'granted') {
        Alert.alert('Notifications are off', 'You can turn them on later from your device settings or Melanated notification preferences.');
      }
    } catch (error) {
      console.warn('[onboarding] Notification permission request failed', error);
      setNotificationPermission('unavailable');
    }
  }

  async function saveReplayProfile() {
    if (!session?.user.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({
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
        },
      })
      .eq('id', session.user.id);
    if (error) throw error;
  }

  async function finish() {
    if (saving || !canContinue) return;
    setSaving(true);
    try {
      if (wasAlreadyComplete) await saveReplayProfile();
      else await completeOnboarding(form);
      try {
        markGuidedTutorialCompleted();
      } catch (error) {
        console.warn('[onboarding] Unable to mark legacy tutorial complete', error);
      }
      router.replace(openInvitesAfterFinish ? ('/member/invites' as never) : ('/(tabs)' as never));
    } catch (error) {
      Alert.alert('Unable to finish setup', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (!canContinue) return;
    if (step < TOTAL_STEPS) setStep((current) => current + 1);
    else void finish();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Image source={require('../assets/ma-pathfinder-mark.png')} style={styles.loadingLogo} resizeMode="contain" />
          <ActivityIndicator color={GOLD} size="large" />
          <Text style={styles.loadingText}>Preparing your Melanated welcome…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STEP_META[step - 1]!;
  const locationLabel = [form.homeCity, form.homeState].filter(Boolean).join(', ');
  const selectedExperience = EXPERIENCE_COPY[form.experienceLevel];
  const joinedGroupCount = groupSuggestions.filter((group) => group.is_member).length;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/ma-pathfinder-mark.png')} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.brandName}>MELANATED</Text>
          </View>
          {wasAlreadyComplete ? (
            <Pressable hitSlop={10} onPress={() => router.replace('/(tabs)' as never)}>
              <Text style={styles.exitText}>Exit preview</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressRow}>
            <Text style={styles.kicker}>{meta[0]}</Text>
            <Text style={styles.stepCount}>{step}/{TOTAL_STEPS}</Text>
          </View>
          <View style={styles.progressRail}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <View key={index} style={[styles.progressSegment, index < step && styles.progressSegmentActive]} />
            ))}
          </View>

          <Text style={styles.title}>{meta[1]}</Text>
          <Text style={styles.body}>{meta[2]}</Text>

          {step === 1 ? (
            <View style={styles.heroCard}>
              <View style={styles.heroMark}>
                <Image source={require('../assets/ma-pathfinder-mark.png')} style={styles.heroLogo} resizeMode="contain" />
              </View>
              <Text style={styles.heroStatement}>Built for us. Built for outside.</Text>
              <View style={styles.promiseList}>
                {[
                  ['compass-outline', 'Discover adventures', 'Find events, trips, places, and experiences near you and beyond.'],
                  ['people-outline', 'Meet your people', 'Build real connections without turning community into a follower contest.'],
                  ['flame-outline', 'Share and inspire', 'Bring your stories, questions, knowledge, and wins to the Campfire.'],
                ].map(([icon, heading, copy]) => (
                  <View key={heading} style={styles.promiseRow}>
                    <View style={styles.iconDisc}><Ionicons name={icon as never} size={20} color={GOLD} /></View>
                    <View style={styles.flex}>
                      <Text style={styles.promiseTitle}>{heading}</Text>
                      <Text style={styles.promiseCopy}>{copy}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.sectionGap}>
              <View style={styles.experienceRow}>
                {(Object.keys(EXPERIENCE_COPY) as ExperienceLevel[]).map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.experienceChip, form.experienceLevel === value && styles.experienceChipActive]}
                    onPress={() => update('experienceLevel', value)}
                  >
                    <Text style={[styles.experienceText, form.experienceLevel === value && styles.experienceTextActive]}>
                      {EXPERIENCE_COPY[value]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.microLabel}>PICK ALL THAT APPLY</Text>
              <View style={styles.optionGrid}>
                {INTEREST_OPTIONS.map((interest) => {
                  const selected = form.interests.includes(interest);
                  return (
                    <Pressable
                      key={interest}
                      style={[styles.optionTile, selected && styles.optionTileSelected]}
                      onPress={() => toggleList('interests', interest)}
                    >
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? GOLD : '#6F7B74'} />
                      <Text style={[styles.optionTileText, selected && styles.optionTileTextSelected]}>{interest}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.stack}>
              {INTENT_OPTIONS.map((intent) => {
                const selected = form.intents.includes(intent);
                return (
                  <Pressable
                    key={intent}
                    style={[styles.intentRow, selected && styles.intentRowSelected]}
                    onPress={() => toggleList('intents', intent)}
                  >
                    <View style={styles.intentIcon}><Ionicons name="sparkles-outline" size={18} color={selected ? GOLD : MUTED} /></View>
                    <Text style={[styles.intentText, selected && styles.intentTextSelected]}>{intent}</Text>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? GOLD : '#657169'} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.stack}>
              <View style={styles.locationCard}>
                <Ionicons name="location" size={34} color={GOLD} />
                <Text style={styles.cardTitle}>Use your location for nearby discovery</Text>
                <Text style={styles.cardCopy}>We use this to make Nearby useful. You can choose a city instead and change it later.</Text>
                <Pressable style={styles.primaryInline} disabled={locating} onPress={() => void useCurrentLocation()}>
                  <Text style={styles.primaryInlineText}>{locating ? 'Finding you…' : 'Use my location'}</Text>
                </Pressable>
              </View>

              <Text style={styles.orLabel}>OR CHOOSE A CITY</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>State</Text>
                <TextInput
                  style={styles.input}
                  value={stateSearch}
                  placeholder="Start typing your state"
                  placeholderTextColor="#657169"
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
                  <View style={styles.autocomplete}>
                    {stateOptions.map((state) => (
                      <Pressable
                        key={state.abbreviation}
                        style={styles.autoRow}
                        onPress={() => {
                          setStateSearch(state.name);
                          update('homeState', state.abbreviation);
                          update('homeCity', '');
                          setCitySearch('');
                          setStateOpen(false);
                        }}
                      >
                        <Text style={styles.autoText}>{state.name}</Text>
                        <Text style={styles.autoMeta}>{state.abbreviation}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>City</Text>
                <TextInput
                  style={[styles.input, !form.homeState && styles.inputDisabled]}
                  editable={Boolean(form.homeState) && !citiesLoading}
                  value={citySearch}
                  placeholder={form.homeState ? 'Start typing your city' : 'Choose a state first'}
                  placeholderTextColor="#657169"
                  onChangeText={(value) => {
                    setCitySearch(value);
                    update('homeCity', '');
                  }}
                />
                {citiesLoading ? <Text style={styles.helper}>Loading cities…</Text> : null}
                {cityOptions.length ? (
                  <View style={styles.autocomplete}>
                    {cityOptions.map((city) => (
                      <Pressable
                        key={city}
                        style={styles.autoRow}
                        onPress={() => {
                          setCitySearch(city);
                          update('homeCity', city);
                        }}
                      >
                        <Text style={styles.autoText}>{city}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              {locationLabel ? <Text style={styles.locationConfirmation}>✓ Nearby will start around {locationLabel}</Text> : null}
            </View>
          ) : null}

          {step === 5 ? (
            <View style={styles.stack}>
              <View style={styles.communitySummary}>
                <View>
                  <Text style={styles.summaryNumber}>{suggestions.length || '—'}</Text>
                  <Text style={styles.summaryLabel}>members surfaced</Text>
                </View>
                <View>
                  <Text style={styles.summaryNumber}>{form.interests.length}</Text>
                  <Text style={styles.summaryLabel}>interests shaping discovery</Text>
                </View>
                <View>
                  <Text style={styles.summaryNumber}>{form.intents.length}</Text>
                  <Text style={styles.summaryLabel}>reasons you are here</Text>
                </View>
              </View>
              <Text style={styles.microLabel}>{locationLabel ? `AROUND ${locationLabel.toUpperCase()}` : 'COMMUNITY PREVIEW'}</Text>
              {suggestionsLoading ? <ActivityIndicator color={GOLD} /> : null}
              {suggestions.map((person) => (
                <View key={person.id} style={styles.personCard}>
                  <Avatar person={person} />
                  <View style={styles.flex}>
                    <Text style={styles.personName}>{person.display_name || person.username || 'Melanated member'}</Text>
                    <Text style={styles.personMeta}>
                      {[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Community member'}
                    </Text>
                    {person.interests?.length ? (
                      <Text style={styles.personInterest} numberOfLines={1}>{person.interests.slice(0, 2).join(' · ')}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
              {!suggestionsLoading && !suggestions.length ? (
                <View style={styles.infoCard}>
                  <Text style={styles.cardTitle}>Your community will fill in here.</Text>
                  <Text style={styles.cardCopy}>Nearby discovery will keep expanding as members, adventures, and posts appear around your area.</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 6 ? (
            <View style={styles.stack}>
              <View style={styles.profilePreview}>
                <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{initials(form.displayName || username)}</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.profileName}>{form.displayName || username || 'Your profile'}</Text>
                  {username ? <Text style={styles.profileHandle}>@{username}</Text> : null}
                  <Text style={styles.personMeta}>{locationLabel || 'Add your home area'}</Text>
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>First name</Text>
                <TextInput style={styles.input} value={form.firstName} onChangeText={(value) => update('firstName', value)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Last name</Text>
                <TextInput style={styles.input} value={form.lastName} onChangeText={(value) => update('lastName', value)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Display name</Text>
                <TextInput style={styles.input} value={form.displayName} onChangeText={(value) => update('displayName', value)} />
                <Text style={styles.helper}>This is what people will see across Melanated.</Text>
              </View>
            </View>
          ) : null}

          {step === 7 ? (
            <View style={styles.stack}>
              <Text style={styles.microLabel}>SUGGESTED TRAILMATES</Text>
              {suggestionsLoading ? <ActivityIndicator color={GOLD} /> : null}
              {suggestions.slice(0, 5).map((person) => {
                const sent = connectionSentIds.has(person.id);
                return (
                  <View key={person.id} style={styles.personCard}>
                    <Avatar person={person} />
                    <View style={styles.flex}>
                      <Text style={styles.personName}>{person.display_name || person.username || 'Melanated member'}</Text>
                      <Text style={styles.personMeta}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Member'}</Text>
                    </View>
                    <Pressable
                      disabled={sent || connectingId === person.id}
                      style={[styles.connectButton, sent && styles.connectButtonSent]}
                      onPress={() => void connect(person)}
                    >
                      <Text style={[styles.connectButtonText, sent && styles.connectButtonTextSent]}>
                        {sent ? 'Requested' : connectingId === person.id ? 'Sending…' : 'Connect'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Connections, not follower counts.</Text>
                <Text style={styles.cardCopy}>Trailmates are mutual relationships. They can accept or decline, and you can manage your Crew anytime.</Text>
              </View>
            </View>
          ) : null}

          {step === 8 ? (
            <View style={styles.stack}>
              <Text style={styles.microLabel}>RECOMMENDED FOR YOUR OUTSIDE</Text>
              {groupsLoading ? <ActivityIndicator color={GOLD} /> : null}
              {groupSuggestions.map((group) => (
                <View key={group.id} style={styles.groupCard}>
                  <View style={styles.groupIcon}>
                    <Ionicons name={group.kind === 'local' ? 'location-outline' : group.kind === 'adventure' ? 'trail-sign-outline' : 'people-outline'} size={22} color={GOLD} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.personName}>{group.name}</Text>
                    <Text style={styles.personMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'} · {group.kind === 'interest' ? 'Curated group' : group.kind}</Text>
                    {group.description ? <Text style={styles.groupDescription} numberOfLines={2}>{group.description}</Text> : null}
                  </View>
                  <Pressable
                    disabled={group.is_member || groupBusyId === group.id}
                    style={[styles.connectButton, group.is_member && styles.connectButtonSent]}
                    onPress={() => void joinSuggestedGroup(group)}
                  >
                    <Text style={[styles.connectButtonText, group.is_member && styles.connectButtonTextSent]}>
                      {group.is_member ? 'Joined ✓' : groupBusyId === group.id ? 'Joining…' : 'Join'}
                    </Text>
                  </Pressable>
                </View>
              ))}
              {!groupsLoading && !groupSuggestions.length ? (
                <View style={styles.infoCard}>
                  <Text style={styles.cardTitle}>Campfires are still taking shape.</Text>
                  <Text style={styles.cardCopy}>You can continue now. New curated groups will appear in Melanated as they become available.</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 9 ? (
            <View style={styles.stack}>
              <View style={styles.inviteHero}>
                <Image source={require('../assets/ma-pathfinder-mark.png')} style={styles.inviteLogo} resizeMode="contain" />
                <Text style={styles.inviteCount}>{inviteCount}</Text>
                <Text style={styles.inviteAvailable}>unique invites available</Text>
                <Text style={styles.cardCopy}>Invites stay tied to you, so when someone joins from your link Melanated knows who brought them in.</Text>
              </View>
              <Pressable
                style={[styles.intentRow, openInvitesAfterFinish && styles.intentRowSelected]}
                onPress={() => setOpenInvitesAfterFinish((value) => !value)}
              >
                <Ionicons name="people-outline" size={21} color={GOLD} />
                <View style={styles.flex}>
                  <Text style={styles.intentText}>Open Invite Friends when setup is done</Text>
                  <Text style={styles.helper}>Optional. You can always invite from Menu later.</Text>
                </View>
                <Ionicons name={openInvitesAfterFinish ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={openInvitesAfterFinish ? GOLD : MUTED} />
              </Pressable>
            </View>
          ) : null}

          {step === 10 ? (
            <View style={styles.stack}>
              <View style={styles.notificationCard}>
                {[
                  ['Messages from your crew', true],
                  ['Adventure updates', true],
                  ['Invitations', true],
                  ['Replies to your posts', true],
                  ['Nearby activity worth knowing about', form.pushEnabled],
                ].map(([label, enabled]) => (
                  <View key={String(label)} style={styles.notificationRow}>
                    <Ionicons name="notifications-outline" size={19} color={GOLD} />
                    <Text style={styles.notificationText}>{String(label)}</Text>
                    <Ionicons name={enabled ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={enabled ? GOLD : MUTED} />
                  </View>
                ))}
              </View>
              <View style={styles.preferenceRow}>
                <View style={styles.flex}>
                  <Text style={styles.preferenceTitle}>Push notifications</Text>
                  <Text style={styles.helper}>Messages, adventure changes, invites, and relevant community activity.</Text>
                </View>
                <Switch value={form.pushEnabled} onValueChange={(value) => update('pushEnabled', value)} trackColor={{ false: '#344139', true: '#6D7B3D' }} />
              </View>
              <View style={styles.preferenceRow}>
                <View style={styles.flex}>
                  <Text style={styles.preferenceTitle}>Email updates</Text>
                  <Text style={styles.helper}>Useful account and community updates without duplicating every push.</Text>
                </View>
                <Switch value={form.emailEnabled} onValueChange={(value) => update('emailEnabled', value)} trackColor={{ false: '#344139', true: '#6D7B3D' }} />
              </View>
              <Pressable style={styles.primaryInline} onPress={() => void requestNotificationPermission()}>
                <Text style={styles.primaryInlineText}>
                  {notificationPermission === 'granted' ? 'Notifications enabled ✓' : 'Allow notifications'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {step === 11 ? (
            <View style={styles.stack}>
              <View style={styles.readyHero}>
                <View style={styles.readyIcon}><Ionicons name="checkmark" size={34} color={BG} /></View>
                <Text style={styles.readyTitle}>Your Melanated is ready.</Text>
                <Text style={styles.cardCopy}>We will keep learning from what you actually do in the app, so your experience can evolve instead of freezing at signup.</Text>
              </View>
              <View style={styles.readyList}>
                {[
                  [`${form.interests.length} interests selected`, selectedExperience],
                  ['Nearby discovery', locationLabel || 'Your selected home area'],
                  [`${connectionSentIds.size} Trailmate request${connectionSentIds.size === 1 ? '' : 's'} sent`, 'Completely optional'],
                  [`${joinedGroupCount} campfire${joinedGroupCount === 1 ? '' : 's'} joined`, 'Your community feed starts with context'],
                  ['Invites', openInvitesAfterFinish ? 'Open after setup' : `${inviteCount} available later`],
                ].map(([heading, copy]) => (
                  <View key={heading} style={styles.readyRow}>
                    <Ionicons name="checkmark-circle" size={22} color={GOLD} />
                    <View style={styles.flex}>
                      <Text style={styles.readyRowTitle}>{heading}</Text>
                      <Text style={styles.helper}>{copy}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.footer}>
            {step > 1 ? (
              <Pressable style={styles.backButton} disabled={saving} onPress={() => setStep((current) => Math.max(1, current - 1))}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            ) : <View style={styles.backSpacer} />}
            <Pressable
              style={[styles.nextButton, (!canContinue || saving) && styles.nextButtonDisabled]}
              disabled={!canContinue || saving}
              onPress={next}
            >
              <Text style={styles.nextButtonText}>
                {saving ? 'Finishing…' : step === TOTAL_STEPS ? (openInvitesAfterFinish ? 'Finish & Invite Friends' : 'See What’s Happening') : 'Next'}
              </Text>
              {!saving && step < TOTAL_STEPS ? <Ionicons name="arrow-forward" size={18} color={BG} /> : null}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 },
  loadingLogo: { width: 82, height: 82 },
  loadingText: { color: MUTED, fontSize: 14 },
  topBar: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#17201C' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandLogo: { width: 28, height: 28 },
  brandName: { color: TEXT, fontWeight: '900', letterSpacing: 1.4, fontSize: 13 },
  exitText: { color: MUTED, fontWeight: '800', fontSize: 12 },
  scrollContent: { padding: 20, paddingBottom: 42 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  stepCount: { color: '#718078', fontSize: 10, fontWeight: '900' },
  progressRail: { flexDirection: 'row', gap: 4, marginTop: 10, marginBottom: 24 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#253129' },
  progressSegmentActive: { backgroundColor: GOLD },
  title: { color: TEXT, fontSize: 32, lineHeight: 37, fontWeight: '900', letterSpacing: -0.8, maxWidth: 520 },
  body: { color: MUTED, fontSize: 15, lineHeight: 22, marginTop: 9, marginBottom: 24, maxWidth: 620 },
  heroCard: { backgroundColor: CARD, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 18 },
  heroMark: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#1E281B', alignItems: 'center', justifyContent: 'center' },
  heroLogo: { width: 50, height: 50 },
  heroStatement: { color: TEXT, fontSize: 25, lineHeight: 30, fontWeight: '900' },
  promiseList: { gap: 15 },
  promiseRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#242D20', alignItems: 'center', justifyContent: 'center' },
  promiseTitle: { color: TEXT, fontWeight: '900', fontSize: 15 },
  promiseCopy: { color: MUTED, lineHeight: 18, fontSize: 12, marginTop: 3 },
  sectionGap: { gap: 18 },
  stack: { gap: 12 },
  experienceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  experienceChip: { borderWidth: 1, borderColor: BORDER, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: CARD },
  experienceChipActive: { borderColor: GOLD, backgroundColor: '#2A2A19' },
  experienceText: { color: MUTED, fontWeight: '800', fontSize: 11 },
  experienceTextActive: { color: '#F1D68A' },
  microLabel: { color: '#748178', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  optionTile: { width: '48.5%', minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 13, justifyContent: 'space-between' },
  optionTileSelected: { borderColor: GOLD, backgroundColor: '#24271B' },
  optionTileText: { color: '#C7D0CA', fontWeight: '800', fontSize: 13, marginTop: 9 },
  optionTileTextSelected: { color: TEXT },
  intentRow: { minHeight: 62, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  intentRowSelected: { borderColor: GOLD, backgroundColor: '#21251A' },
  intentIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#202923', alignItems: 'center', justifyContent: 'center' },
  intentText: { flex: 1, color: '#D7DDD9', fontWeight: '800', fontSize: 14 },
  intentTextSelected: { color: TEXT },
  locationCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 18, gap: 10 },
  cardTitle: { color: TEXT, fontWeight: '900', fontSize: 18, lineHeight: 22 },
  cardCopy: { color: MUTED, lineHeight: 20, fontSize: 13 },
  primaryInline: { minHeight: 48, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 4 },
  primaryInlineText: { color: BG, fontWeight: '900', fontSize: 14 },
  orLabel: { color: '#6F7B74', fontWeight: '900', letterSpacing: 1, fontSize: 10, textAlign: 'center', marginVertical: 2 },
  field: { gap: 7 },
  fieldLabel: { color: '#B9C3BD', fontWeight: '800', fontSize: 12 },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#344239', backgroundColor: '#111915', paddingHorizontal: 14, color: TEXT, fontSize: 15 },
  inputDisabled: { opacity: 0.5 },
  autocomplete: { borderWidth: 1, borderColor: BORDER, backgroundColor: '#111915', borderRadius: 13, overflow: 'hidden' },
  autoRow: { minHeight: 45, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#253129' },
  autoText: { color: TEXT, fontWeight: '700' },
  autoMeta: { color: GOLD, fontWeight: '900', fontSize: 11 },
  helper: { color: '#849189', fontSize: 11, lineHeight: 16 },
  locationConfirmation: { color: '#BBD5C2', fontWeight: '800', fontSize: 12 },
  communitySummary: { flexDirection: 'row', gap: 8 },
  summaryNumber: { color: GOLD, fontWeight: '900', fontSize: 23 },
  summaryLabel: { color: MUTED, fontSize: 10, lineHeight: 14, marginTop: 2, maxWidth: 95 },
  personCard: { minHeight: 68, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatarFallback: { backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: BG, fontWeight: '900', fontSize: 16 },
  personName: { color: TEXT, fontWeight: '900', fontSize: 14 },
  personMeta: { color: MUTED, fontSize: 11, marginTop: 2 },
  personInterest: { color: '#C9B773', fontSize: 10, marginTop: 4 },
  infoCard: { backgroundColor: CARD_ALT, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 6 },
  profilePreview: { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: BG, fontWeight: '900', fontSize: 21 },
  profileName: { color: TEXT, fontSize: 19, fontWeight: '900' },
  profileHandle: { color: GOLD, fontWeight: '800', fontSize: 12, marginTop: 1 },
  connectButton: { minWidth: 82, minHeight: 38, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  connectButtonSent: { backgroundColor: '#26322B' },
  connectButtonText: { color: BG, fontWeight: '900', fontSize: 11 },
  connectButtonTextSent: { color: '#B9C5BD' },
  groupCard: { minHeight: 82, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  groupIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#202923', alignItems: 'center', justifyContent: 'center' },
  groupDescription: { color: '#87948C', fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  inviteHero: { backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 22, alignItems: 'center', gap: 7 },
  inviteLogo: { width: 70, height: 70, marginBottom: 6 },
  inviteCount: { color: GOLD, fontSize: 42, fontWeight: '900' },
  inviteAvailable: { color: TEXT, fontWeight: '900', fontSize: 16, marginBottom: 6 },
  notificationCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 18, overflow: 'hidden' },
  notificationRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#28342D' },
  notificationText: { flex: 1, color: '#D8DEDA', fontWeight: '700', fontSize: 13 },
  preferenceRow: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  preferenceTitle: { color: TEXT, fontWeight: '900', fontSize: 14 },
  readyHero: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 22, padding: 22, alignItems: 'center', gap: 10 },
  readyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  readyTitle: { color: TEXT, fontWeight: '900', fontSize: 24, textAlign: 'center' },
  readyList: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 6 },
  readyRow: { flexDirection: 'row', gap: 11, alignItems: 'center', padding: 12 },
  readyRowTitle: { color: TEXT, fontWeight: '800', fontSize: 13 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 28, alignItems: 'center' },
  backButton: { minHeight: 50, minWidth: 78, borderRadius: 13, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  backButtonText: { color: '#C7D0CA', fontWeight: '900' },
  backSpacer: { width: 78 },
  nextButton: { flex: 1, minHeight: 50, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  nextButtonDisabled: { opacity: 0.4 },
  nextButtonText: { color: BG, fontWeight: '900', fontSize: 14 },
});
