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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { getStateOption, loadCitiesForState, US_STATES } from '../src/onboarding/locations';
import { completeOnboarding, loadOnboardingProfile } from '../src/onboarding/onboardingService';
import { markGuidedTutorialCompleted } from '../src/onboarding/tutorialPreference';
import {
  INITIAL_ONBOARDING_FORM,
  INTEREST_OPTIONS,
  type ExperienceLevel,
  type HouseholdMode,
  type OnboardingForm,
} from '../src/onboarding/types';

const STEP_META = [
  {
    kicker: 'YOUR IDENTITY',
    title: 'Make Melanated yours',
    body: 'Start with how you want the community to know you. Your public name can be different from your account name.',
  },
  {
    kicker: 'EXPLORE',
    title: 'Find your kind of adventure',
    body: 'Tell us what gets you outside. Explore uses these choices to make the app feel more like your trail map and less like a catalog.',
  },
  {
    kicker: 'NEARBY',
    title: 'See what is happening around you',
    body: 'Your home area helps Melanated surface nearby people, posts, groups, adventures, and events without limiting destination trips.',
  },
  {
    kicker: 'THE OUTPOST',
    title: 'Stay connected to your community',
    body: 'Choose how Melanated should reach you for community activity, trip updates, and important account messages.',
  },
  {
    kicker: 'ADVENTURE READY',
    title: 'Set yourself up for better trips',
    body: 'Optional details can help hosts plan more inclusive adventures. You can also connect an adventure household now or later.',
  },
  {
    kicker: 'YOUR PASSPORT',
    title: 'Your place in Melanated is ready',
    body: 'Your profile, interests, local discovery, and Passport now work together as your adventure story grows.',
  },
] as const;

const EXPERIENCE_COPY: Record<ExperienceLevel, string> = {
  new: 'Just getting started',
  beginner: 'Building confidence',
  intermediate: 'Comfortable outside',
  experienced: 'Seasoned adventurer',
};

function formatUsPhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return digits.length === 10 ? `+1${digits}` : null;
}

function phoneIsValid(value: string) {
  return normalizeUsPhone(value) !== null;
}

export default function OnboardingV2Screen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(INITIAL_ONBOARDING_FORM);
  const [wasAlreadyComplete, setWasAlreadyComplete] = useState(false);
  const [role, setRole] = useState('admin');
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stateSearch, setStateSearch] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!session?.user.id) {
        if (active) setLoading(false);
        return;
      }

      const [adminResult, onboardingResult, identityResult] = await Promise.all([
        supabase.rpc('is_platform_admin'),
        loadOnboardingProfile(session.user.id),
        supabase
          .from('profiles')
          .select('username,avatar_url,platform_role')
          .eq('id', session.user.id)
          .single(),
      ]);

      if (!active) return;
      if (adminResult.error || adminResult.data !== true) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      if (identityResult.error) throw identityResult.error;

      const profile = onboardingResult;
      const communication = (profile.communication_preferences ?? {}) as Record<string, boolean>;
      const state = profile.home_state ?? '';
      const city = profile.home_city ?? '';

      setAuthorized(true);
      setRole(identityResult.data.platform_role ?? 'admin');
      setUsername(identityResult.data.username ?? null);
      setAvatarUrl(identityResult.data.avatar_url ?? null);
      setWasAlreadyComplete(Boolean(profile.onboarding_completed_at));
      setForm((current) => ({
        ...current,
        firstName: profile.first_name ?? '',
        lastName: profile.last_name ?? '',
        displayName: profile.display_name ?? '',
        homeCity: city,
        homeState: state,
        discoveryRadiusMiles: profile.discovery_radius_miles ?? 50,
        experienceLevel: (profile.experience_level ?? 'new') as ExperienceLevel,
        interests: profile.interests ?? [],
        pushEnabled: communication.push ?? true,
        emailEnabled: communication.email ?? true,
        smsEnabled: communication.sms ?? false,
        phoneNumber: profile.phone_number ? formatUsPhone(profile.phone_number) : '',
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
      Alert.alert('Unable to load onboarding preview', error instanceof Error ? error.message : 'Please try again.');
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

  const stateOptions = useMemo(() => {
    if (!stateOpen) return [];
    const query = stateSearch.trim().toLowerCase();
    return US_STATES.filter((state) =>
      !query || state.name.toLowerCase().includes(query) || state.abbreviation.toLowerCase().startsWith(query),
    ).slice(0, 8);
  }, [stateOpen, stateSearch]);

  const cityOptions = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!form.homeState || !query || form.homeCity === citySearch) return [];
    return cities.filter((city) => city.toLowerCase().includes(query)).slice(0, 8);
  }, [cities, citySearch, form.homeCity, form.homeState]);

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(form.displayName.trim() && form.firstName.trim() && form.lastName.trim());
    if (step === 2) return form.interests.length > 0;
    if (step === 3) return Boolean(form.homeState.trim() && form.homeCity.trim());
    if (step === 4) return !form.smsEnabled || (phoneIsValid(form.phoneNumber) && form.smsConsent);
    if (step === 5 && form.householdMode === 'create') return Boolean(form.householdName.trim());
    if (step === 5 && form.householdMode === 'join') return /^[A-Z0-9]{8}$/.test(form.householdInviteCode.trim().toUpperCase());
    return true;
  }, [form, step]);

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

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
        },
        phone_number: normalizeUsPhone(form.phoneNumber),
        sms_consent_at: form.smsEnabled && form.smsConsent ? new Date().toISOString() : null,
        accessibility_needs: form.accessibilityNeeds.trim() || null,
        dietary_needs: form.dietaryNeeds.trim() || null,
        support_notes: form.supportNotes.trim() || null,
      })
      .eq('id', session.user.id);
    if (error) throw error;
  }

  async function finish() {
    if (saving || !canContinue) return;
    setSaving(true);
    try {
      if (wasAlreadyComplete) {
        await saveReplayProfile();
      } else {
        await completeOnboarding(form);
      }
      try {
        markGuidedTutorialCompleted();
      } catch (error) {
        console.warn('[onboarding-v2] Unable to mark legacy tutorial complete', error);
      }
      router.replace('/(tabs)' as never);
    } catch (error) {
      Alert.alert(
        'Unable to finish setup',
        error instanceof Error ? error.message : 'Your information could not be saved. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    if (!canContinue) return;
    if (step < 6) {
      setStep((current) => Math.min(current + 1, 6));
      return;
    }
    void finish();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <View style={styles.brandDisc}><Text style={styles.brandDiscText}>M</Text></View>
          <ActivityIndicator color="#D7B45A" size="large" />
          <Text style={styles.loadingText}>Preparing your Melanated welcome…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.restrictedWrap}>
          <Text style={styles.previewTag}>TEST PREVIEW</Text>
          <Text style={styles.restrictedTitle}>Admin access required</Text>
          <Text style={styles.restrictedBody}>Onboarding v2 is currently limited to Admin and Founder accounts while it is being tested.</Text>
          <Pressable style={styles.darkButton} onPress={() => router.replace('/(tabs)' as never)}>
            <Text style={styles.darkButtonText}>Return to Melanated</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STEP_META[step - 1]!;
  const roleLabel = role === 'founder' ? 'FOUNDER PREVIEW' : 'ADMIN PREVIEW';
  const displayName = form.displayName.trim() || username || 'Your profile';
  const location = [form.homeCity, form.homeState].filter(Boolean).join(', ') || 'Add your home area';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandDiscSmall}><Text style={styles.brandDiscSmallText}>M</Text></View>
            <Text style={styles.brandName}>MELANATED</Text>
          </View>
          <Pressable hitSlop={10} onPress={() => router.replace('/(tabs)' as never)}>
            <Text style={styles.exitText}>Exit preview</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressHeader}>
            <View style={styles.previewRow}>
              <Text style={styles.previewTag}>{roleLabel}</Text>
              <Text style={styles.stepCount}>{step} OF 6</Text>
            </View>
            <View style={styles.progressRail} accessibilityLabel={`Step ${step} of 6`}>
              {STEP_META.map((_, index) => (
                <View key={index} style={[styles.progressSegment, index < step && styles.progressSegmentActive]} />
              ))}
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>{meta.kicker}</Text>
            <Text style={styles.title}>{meta.title}</Text>
            <Text style={styles.body}>{meta.body}</Text>
          </View>

          {step === 1 ? (
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>PUBLIC IDENTITY</Text>
              <Field
                label="Display name"
                value={form.displayName}
                onChangeText={(value) => update('displayName', value)}
                placeholder="What should the community call you?"
                helper="This is the name members will see around Melanated."
              />
              <View style={styles.inlineFields}>
                <View style={styles.halfField}>
                  <Field label="First name" value={form.firstName} onChangeText={(value) => update('firstName', value)} placeholder="First" />
                </View>
                <View style={styles.halfField}>
                  <Field label="Last name" value={form.lastName} onChangeText={(value) => update('lastName', value)} placeholder="Last" />
                </View>
              </View>
              <View style={styles.infoStrip}>
                <Text style={styles.infoStripTitle}>Why we ask</Text>
                <Text style={styles.infoStripBody}>Your first and last name stay separate from your display name and support account, booking, and safety workflows.</Text>
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>PERSONALIZE EXPLORE</Text>
              <Text style={styles.cardTitle}>What calls you outside?</Text>
              <Text style={styles.cardBody}>Pick at least one. These choices shape recommendations and the adventures we surface first.</Text>
              <View style={styles.chips}>
                {INTEREST_OPTIONS.map((interest) => (
                  <Chip
                    key={interest}
                    label={interest}
                    selected={form.interests.includes(interest)}
                    onPress={() => update(
                      'interests',
                      form.interests.includes(interest)
                        ? form.interests.filter((item) => item !== interest)
                        : [...form.interests, interest],
                    )}
                  />
                ))}
              </View>
              <View style={styles.divider} />
              <Text style={styles.cardTitle}>Your comfort level</Text>
              <View style={styles.stackChoices}>
                {(['new', 'beginner', 'intermediate', 'experienced'] as ExperienceLevel[]).map((level) => (
                  <ChoiceRow
                    key={level}
                    title={EXPERIENCE_COPY[level]}
                    subtitle={level.charAt(0).toUpperCase() + level.slice(1)}
                    selected={form.experienceLevel === level}
                    onPress={() => update('experienceLevel', level)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.card}>
              <View style={styles.featureCallout}>
                <Text style={styles.featureNumber}>NEARBY</Text>
                <Text style={styles.featureTitle}>People + posts + adventures</Text>
                <Text style={styles.featureBody}>Nearby uses your area to make the community around you visible, while Explore can still take you anywhere.</Text>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="Search state"
                  placeholderTextColor="#849088"
                  style={styles.input}
                  value={stateSearch}
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
                    {stateOptions.map((state, index) => (
                      <Pressable
                        key={state.abbreviation}
                        style={[styles.autocompleteRow, index > 0 && styles.autocompleteDivider]}
                        onPress={() => {
                          setStateSearch(state.name);
                          setStateOpen(false);
                          setCitySearch('');
                          setForm((current) => ({ ...current, homeState: state.abbreviation, homeCity: '' }));
                        }}
                      >
                        <Text style={styles.autocompleteTitle}>{state.name}</Text>
                        <Text style={styles.autocompleteMeta}>{state.abbreviation}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={Boolean(form.homeState) && !citiesLoading}
                  placeholder={form.homeState ? 'Search city' : 'Choose a state first'}
                  placeholderTextColor="#849088"
                  style={[styles.input, (!form.homeState || citiesLoading) && styles.inputDisabled]}
                  value={citySearch}
                  onFocus={() => {
                    if (form.homeCity) {
                      update('homeCity', '');
                    }
                  }}
                  onChangeText={(value) => {
                    setCitySearch(value);
                    update('homeCity', value);
                  }}
                />
                {citiesLoading ? <Text style={styles.helper}>Loading cities…</Text> : null}
                {cityOptions.length ? (
                  <View style={styles.autocomplete}>
                    {cityOptions.map((city, index) => (
                      <Pressable
                        key={city}
                        style={[styles.autocompleteRow, index > 0 && styles.autocompleteDivider]}
                        onPress={() => {
                          setCitySearch(city);
                          update('homeCity', city);
                        }}
                      >
                        <Text style={styles.autocompleteTitle}>{city}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <Text style={styles.label}>How far feels local?</Text>
              <View style={styles.chips}>
                {[25, 50, 100, 250].map((radius) => (
                  <Chip
                    key={radius}
                    label={radius === 250 ? '250+ mi' : `${radius} mi`}
                    selected={form.discoveryRadiusMiles === radius}
                    onPress={() => update('discoveryRadiusMiles', radius)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.card}>
              <View style={styles.featureCallout}>
                <Text style={styles.featureNumber}>OUTPOST</Text>
                <Text style={styles.featureTitle}>The community campfire</Text>
                <Text style={styles.featureBody}>Follow conversations, people nearby, groups, and plans. You decide which updates follow you off the app.</Text>
              </View>
              <ToggleRow
                label="Push notifications"
                description="Trip updates, reminders, and community activity."
                value={form.pushEnabled}
                onValueChange={(value) => update('pushEnabled', value)}
              />
              <ToggleRow
                label="Email updates"
                description="Confirmations, adventure news, and account updates."
                value={form.emailEnabled}
                onValueChange={(value) => update('emailEnabled', value)}
              />
              <ToggleRow
                label="Text messages"
                description="Time-sensitive booking and readiness messages."
                value={form.smsEnabled}
                onValueChange={(value) => {
                  update('smsEnabled', value);
                  if (!value) update('smsConsent', false);
                }}
              />
              {form.smsEnabled ? (
                <View style={styles.smsBlock}>
                  <Field
                    label="Mobile number"
                    value={form.phoneNumber}
                    onChangeText={(value) => update('phoneNumber', formatUsPhone(value))}
                    keyboardType="phone-pad"
                    placeholder="(555) 555-5555"
                  />
                  <Pressable style={styles.consentRow} onPress={() => update('smsConsent', !form.smsConsent)}>
                    <View style={[styles.checkbox, form.smsConsent && styles.checkboxSelected]}>
                      {form.smsConsent ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <Text style={styles.consentCopy}>I agree to receive Melanated text messages at this number. Message and data rates may apply.</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 5 ? (
            <View style={styles.card}>
              <View style={styles.featureCallout}>
                <Text style={styles.featureNumber}>ADVENTURES</Text>
                <Text style={styles.featureTitle}>Better context makes better trips</Text>
                <Text style={styles.featureBody}>These details are optional. They can help with planning and readiness without becoming part of your public profile.</Text>
              </View>
              <Field
                label="Accessibility needs"
                value={form.accessibilityNeeds}
                onChangeText={(value) => update('accessibilityNeeds', value)}
                placeholder="Anything that helps us plan access"
                multiline
              />
              <Field
                label="Dietary needs"
                value={form.dietaryNeeds}
                onChangeText={(value) => update('dietaryNeeds', value)}
                placeholder="Allergies, preferences, or restrictions"
                multiline
              />
              <Field
                label="Other support notes"
                value={form.supportNotes}
                onChangeText={(value) => update('supportNotes', value)}
                placeholder="Anything else useful for trip readiness"
                multiline
              />

              <View style={styles.divider} />
              <Text style={styles.cardTitle}>Adventure household</Text>
              <Text style={styles.cardBody}>Plan together with people you regularly adventure with. This is optional.</Text>
              <View style={styles.householdChoices}>
                {([
                  ['skip', 'Not now', 'You can set this up later.'],
                  ['create', 'Create a household', 'Start a shared adventure household.'],
                  ['join', 'Join with a code', 'Connect to an existing household.'],
                ] as [HouseholdMode, string, string][]).map(([mode, title, subtitle]) => (
                  <ChoiceRow
                    key={mode}
                    title={title}
                    subtitle={subtitle}
                    selected={form.householdMode === mode}
                    onPress={() => update('householdMode', mode)}
                  />
                ))}
              </View>
              {form.householdMode === 'create' ? (
                <Field label="Household name" value={form.householdName} onChangeText={(value) => update('householdName', value)} placeholder="Weekend Crew" />
              ) : null}
              {form.householdMode === 'join' ? (
                <Field
                  label="8-character invite code"
                  value={form.householdInviteCode}
                  onChangeText={(value) => update('householdInviteCode', value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  placeholder="AB12CD34"
                  autoCapitalize="characters"
                />
              ) : null}
              {wasAlreadyComplete && form.householdMode !== 'skip' ? (
                <Text style={styles.helper}>Replay mode will preview this household choice without creating or joining one again.</Text>
              ) : null}
            </View>
          ) : null}

          {step === 6 ? (
            <View style={styles.finishStack}>
              <View style={styles.profileCard}>
                <View style={styles.avatarWrap}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitial}>{displayName.slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.profileRole}>{role === 'founder' ? 'FOUNDER' : 'MEMBER'}</Text>
                  <Text style={styles.profileName}>{displayName}</Text>
                  {username ? <Text style={styles.profileHandle}>@{username.replace(/^@/, '')}</Text> : null}
                  <Text style={styles.profileLocation}>{location}</Text>
                </View>
              </View>

              <View style={styles.passportCard}>
                <Text style={styles.cardEyebrow}>PASSPORT STARTS HERE</Text>
                <Text style={styles.passportTitle}>Your adventure story grows with you.</Text>
                <Text style={styles.passportBody}>Join adventures, collect stamps, earn badges, save memories, and climb the ranks as your Melanated story builds.</Text>
                <View style={styles.summaryGrid}>
                  <SummaryStat value={String(form.interests.length)} label="Interests" />
                  <SummaryStat value={`${form.discoveryRadiusMiles}${form.discoveryRadiusMiles === 250 ? '+' : ''} mi`} label="Nearby range" />
                  <SummaryStat value={form.experienceLevel === 'new' ? 'New' : form.experienceLevel} label="Experience" />
                </View>
              </View>

              <View style={styles.readyList}>
                <ReadyRow number="01" title="Explore" body="Personalized adventures and events based on what you enjoy." />
                <ReadyRow number="02" title="Outpost" body="Nearby people, posts, groups, and community conversations." />
                <ReadyRow number="03" title="Passport" body="Stamps, badges, memories, and rank progression over time." />
              </View>

              {wasAlreadyComplete ? (
                <View style={styles.testNotice}>
                  <Text style={styles.testNoticeTitle}>Preview replay</Text>
                  <Text style={styles.testNoticeBody}>Finishing will save profile preferences, but it will not reset onboarding completion or re-run household actions.</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step > 1 ? (
            <Pressable style={styles.backButton} disabled={saving} onPress={() => setStep((current) => Math.max(current - 1, 1))}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.primaryButton, step === 1 && styles.primaryButtonFull, (!canContinue || saving) && styles.buttonDisabled]}
            disabled={!canContinue || saving}
            onPress={goNext}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving…' : step === 6 ? 'Enter Melanated' : 'Continue'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helper?: string;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function Field({ label, helper, multiline, ...inputProps }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        autoCorrect={false}
        placeholderTextColor="#849088"
        style={[styles.input, multiline && styles.multilineInput]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{selected ? '✓ ' : ''}{label}</Text>
    </Pressable>
  );
}

function ChoiceRow({ title, subtitle, selected, onPress }: { title: string; subtitle: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.choiceRow, selected && styles.choiceRowSelected]} onPress={onPress}>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

function ToggleRow({ label, description, value, onValueChange }: { label: string; description: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{label}</Text>
        <Text style={styles.toggleBody}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#CDD3CF', true: '#567A63' }} thumbColor={value ? '#D7B45A' : '#F6F4ED'} />
    </View>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ReadyRow({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <View style={styles.readyRow}>
      <Text style={styles.readyNumber}>{number}</Text>
      <View style={styles.readyCopy}>
        <Text style={styles.readyTitle}>{title}</Text>
        <Text style={styles.readyBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#F4F0E6' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28, backgroundColor: '#0F1713' },
  brandDisc: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  brandDiscText: { color: '#132019', fontSize: 28, fontWeight: '900' },
  loadingText: { color: '#B2BDB6', fontSize: 14, fontWeight: '700' },
  restrictedWrap: { flex: 1, padding: 28, justifyContent: 'center', gap: 12, backgroundColor: '#0F1713' },
  restrictedTitle: { color: '#FFF8E8', fontSize: 32, lineHeight: 38, fontWeight: '900' },
  restrictedBody: { color: '#A9B4AD', fontSize: 15, lineHeight: 22 },
  darkButton: { marginTop: 8, minHeight: 52, borderRadius: 15, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  darkButtonText: { color: '#17211C', fontSize: 15, fontWeight: '900' },
  topBar: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#D9D7CF', backgroundColor: '#F4F0E6' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandDiscSmall: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#183428', alignItems: 'center', justifyContent: 'center' },
  brandDiscSmallText: { color: '#D7B45A', fontSize: 16, fontWeight: '900' },
  brandName: { color: '#183428', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  exitText: { color: '#5D6A62', fontSize: 12, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  progressHeader: { gap: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTag: { color: '#8A6B1F', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  stepCount: { color: '#6F7973', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  progressRail: { flexDirection: 'row', gap: 6 },
  progressSegment: { height: 4, flex: 1, borderRadius: 2, backgroundColor: '#D7D8D2' },
  progressSegmentActive: { backgroundColor: '#D7B45A' },
  heroCopy: { paddingTop: 26, paddingBottom: 18, gap: 7 },
  kicker: { color: '#8A6B1F', fontSize: 11, fontWeight: '900', letterSpacing: 1.25 },
  title: { color: '#15261D', fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.7 },
  body: { color: '#5D6962', fontSize: 15, lineHeight: 22, maxWidth: 600 },
  card: { backgroundColor: '#FFFDF7', borderRadius: 22, borderWidth: 1, borderColor: '#E0DED5', padding: 17, gap: 15, shadowColor: '#101914', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  cardEyebrow: { color: '#8A6B1F', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  cardTitle: { color: '#1B2A22', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  cardBody: { color: '#68746D', fontSize: 13, lineHeight: 19 },
  fieldWrap: { gap: 7 },
  label: { color: '#26362D', fontSize: 13, fontWeight: '900' },
  input: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#C9CEC9', paddingHorizontal: 14, backgroundColor: '#FFFFFF', color: '#17211C', fontSize: 15 },
  inputDisabled: { opacity: 0.55, backgroundColor: '#F1F1EC' },
  multilineInput: { minHeight: 84, paddingTop: 14, paddingBottom: 14 },
  helper: { color: '#748078', fontSize: 11, lineHeight: 16 },
  inlineFields: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  infoStrip: { borderRadius: 14, padding: 13, backgroundColor: '#EEF3EE', borderWidth: 1, borderColor: '#D8E1D9', gap: 3 },
  infoStripTitle: { color: '#244835', fontSize: 12, fontWeight: '900' },
  infoStripBody: { color: '#5B6A61', fontSize: 11, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: '#C8CDC9', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  chipSelected: { borderColor: '#365C48', backgroundColor: '#E5EFE7' },
  chipText: { color: '#5C6861', fontSize: 12, fontWeight: '800' },
  chipTextSelected: { color: '#234B36' },
  divider: { height: 1, backgroundColor: '#E5E3DB', marginVertical: 2 },
  stackChoices: { gap: 8 },
  choiceRow: { minHeight: 62, borderRadius: 14, borderWidth: 1, borderColor: '#D4D7D2', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  choiceRowSelected: { borderColor: '#54745F', backgroundColor: '#EEF4EF' },
  choiceCopy: { flex: 1, gap: 2 },
  choiceTitle: { color: '#25352C', fontSize: 13, fontWeight: '900' },
  choiceSubtitle: { color: '#758078', fontSize: 11, lineHeight: 15 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B8BFBA', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#31583F' },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#31583F' },
  featureCallout: { borderRadius: 18, backgroundColor: '#183428', padding: 16, gap: 5 },
  featureNumber: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  featureTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  featureBody: { color: '#B6C4BB', fontSize: 12, lineHeight: 18 },
  autocomplete: { borderRadius: 13, borderWidth: 1, borderColor: '#D6D9D4', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  autocompleteRow: { minHeight: 46, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autocompleteDivider: { borderTopWidth: 1, borderTopColor: '#E7E8E3' },
  autocompleteTitle: { color: '#27372F', fontSize: 13, fontWeight: '800' },
  autocompleteMeta: { color: '#869188', fontSize: 11, fontWeight: '800' },
  toggleRow: { minHeight: 70, borderBottomWidth: 1, borderBottomColor: '#E5E4DE', flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleCopy: { flex: 1, gap: 3 },
  toggleTitle: { color: '#26362D', fontSize: 14, fontWeight: '900' },
  toggleBody: { color: '#728078', fontSize: 11, lineHeight: 16 },
  smsBlock: { gap: 12, paddingTop: 2 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#AEB6B0', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxSelected: { backgroundColor: '#31583F', borderColor: '#31583F' },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  consentCopy: { flex: 1, color: '#66736B', fontSize: 11, lineHeight: 16 },
  householdChoices: { gap: 8 },
  finishStack: { gap: 14 },
  profileCard: { borderRadius: 22, backgroundColor: '#183428', padding: 17, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { width: 74, height: 74, borderRadius: 37, borderWidth: 2, borderColor: '#D7B45A', backgroundColor: '#244838', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { color: '#FFF8E8', fontSize: 28, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0, gap: 2 },
  profileRole: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  profileName: { color: '#FFF8E8', fontSize: 23, fontWeight: '900' },
  profileHandle: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
  profileLocation: { color: '#B9C4BD', fontSize: 11, marginTop: 2 },
  passportCard: { borderRadius: 22, borderWidth: 1, borderColor: '#E0DED5', backgroundColor: '#FFFDF7', padding: 17, gap: 8 },
  passportTitle: { color: '#1E3026', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  passportBody: { color: '#66726B', fontSize: 13, lineHeight: 19 },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 5 },
  summaryStat: { flex: 1, minHeight: 72, borderRadius: 14, backgroundColor: '#F1F3ED', padding: 10, justifyContent: 'center', gap: 2 },
  summaryValue: { color: '#244936', fontSize: 15, fontWeight: '900', textTransform: 'capitalize' },
  summaryLabel: { color: '#7A857E', fontSize: 9, fontWeight: '800' },
  readyList: { borderRadius: 22, borderWidth: 1, borderColor: '#E0DED5', backgroundColor: '#FFFDF7', overflow: 'hidden' },
  readyRow: { minHeight: 72, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D8D8D1' },
  readyNumber: { color: '#B38C31', fontSize: 11, fontWeight: '900', paddingTop: 2 },
  readyCopy: { flex: 1, gap: 2 },
  readyTitle: { color: '#26362D', fontSize: 14, fontWeight: '900' },
  readyBody: { color: '#748078', fontSize: 11, lineHeight: 16 },
  testNotice: { borderRadius: 15, borderWidth: 1, borderColor: '#D5C17D', backgroundColor: '#FFF7D9', padding: 13, gap: 3 },
  testNoticeTitle: { color: '#735813', fontSize: 12, fontWeight: '900' },
  testNoticeBody: { color: '#786A3D', fontSize: 11, lineHeight: 16 },
  footer: { minHeight: 76, paddingTop: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#D8D7D0', backgroundColor: '#F4F0E6' },
  backButton: { minHeight: 52, minWidth: 92, paddingHorizontal: 18, borderRadius: 15, borderWidth: 1, borderColor: '#BFC5C0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF7' },
  backButtonText: { color: '#31513F', fontSize: 14, fontWeight: '900' },
  primaryButton: { flex: 1, minHeight: 52, borderRadius: 15, backgroundColor: '#214A36', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonFull: { flex: 1 },
  primaryButtonText: { color: '#FFFDF7', fontSize: 15, fontWeight: '900' },
  buttonDisabled: { opacity: 0.42 },
});
