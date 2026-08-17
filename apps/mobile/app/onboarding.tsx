import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthProvider';
import { getStateOption, loadCitiesForState, US_STATES } from '../src/onboarding/locations';
import {
  completeOnboarding,
  loadOnboardingProfile,
  saveOnboardingProgress,
} from '../src/onboarding/onboardingService';
import {
  INITIAL_ONBOARDING_FORM,
  INTEREST_OPTIONS,
  type ExperienceLevel,
  type HouseholdMode,
  type OnboardingForm,
} from '../src/onboarding/types';

const TITLES = [
  'Tell us who you are',
  'Where are you starting from?',
  'What calls you outside?',
  'How should we reach you?',
  'Help us support you',
  'Your Trailhead is ready',
];

const SUBTITLES = [
  'Start with the name your trail community will know you by.',
  'We’ll use this to surface adventures, people, and events closer to home.',
  'Choose what feels like you. You can change these preferences anytime.',
  'Pick the updates you want. Safety notices for joined adventures are handled separately.',
  'Share only what helps us make your adventures safer and more comfortable.',
  'One last optional choice, then you’re in.',
];

function formatUsPhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function phoneIsValid(value: string) {
  return value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').length === 10;
}

export default function OnboardingScreen() {
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(INITIAL_ONBOARDING_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;

    loadOnboardingProfile(session.user.id)
      .then((profile) => {
        const communication = (profile.communication_preferences ?? {}) as Record<string, boolean>;
        const state = profile.home_state ?? '';
        const city = profile.home_city ?? '';
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
        setStateSearch(getStateOption(state)?.name ?? '');
        setCitySearch(city);
        setStep(Math.min(Math.max(profile.onboarding_step ?? 1, 1), 6));
      })
      .catch((error: Error) => Alert.alert('Unable to load onboarding', error.message))
      .finally(() => setIsLoading(false));
  }, [session?.user.id]);

  useEffect(() => {
    if (!form.homeState) {
      setCities([]);
      return;
    }

    let active = true;
    setCitiesLoading(true);
    setCitiesError(null);
    loadCitiesForState(form.homeState)
      .then((nextCities) => {
        if (active) setCities(nextCities);
      })
      .catch(() => {
        if (active) setCitiesError('We could not load the official city list. Try again.');
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.homeState]);

  const stateOptions = useMemo(() => {
    const query = stateSearch.trim().toLowerCase();
    if (!query || form.homeState) return [];
    return US_STATES.filter(
      (state) => state.name.toLowerCase().includes(query) || state.abbreviation.toLowerCase().startsWith(query),
    ).slice(0, 8);
  }, [form.homeState, stateSearch]);

  const cityOptions = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!form.homeState || !query || form.homeCity) return [];
    return cities.filter((city) => city.toLowerCase().includes(query)).slice(0, 10);
  }, [cities, citySearch, form.homeCity, form.homeState]);

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(form.firstName.trim() && form.lastName.trim() && form.displayName.trim());
    if (step === 2) return Boolean(getStateOption(form.homeState) && cities.includes(form.homeCity));
    if (step === 3) return form.interests.length > 0;
    if (step === 4) return !form.smsEnabled || (phoneIsValid(form.phoneNumber) && form.smsConsent);
    if (step === 6) {
      if (form.householdMode === 'create') return Boolean(form.householdName.trim());
      if (form.householdMode === 'join') return /^[A-Z0-9]{8}$/.test(form.householdInviteCode.trim().toUpperCase());
    }
    return true;
  }, [cities, form, step]);

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectState = (abbreviation: string) => {
    const state = getStateOption(abbreviation);
    if (!state) return;
    setStateSearch(state.name);
    setCitySearch('');
    setForm((current) => ({ ...current, homeState: state.abbreviation, homeCity: '' }));
  };

  const next = async () => {
    if (!session?.user.id || !canContinue) return;
    setIsSaving(true);
    try {
      if (step < 6) {
        const nextStep = step + 1;
        await saveOnboardingProgress(session.user.id, nextStep, form);
        setStep(nextStep);
      } else {
        await completeOnboarding(form);
        router.replace('/(tabs)');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert(
        'Unable to save',
        message.includes('Household invite code not found')
          ? 'That household invite code was not found. Check the code and try again.'
          : message,
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>MA</Text></View>
        <ActivityIndicator color="#D7B45A" size="large" />
        <Text style={styles.loadingText}>Setting up your Trailhead…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMarkSmall}><Text style={styles.brandMarkSmallText}>MA</Text></View>
          <Text style={styles.brandName}>MELANATED ADVENTURERS</Text>
        </View>

        <View style={styles.header}>
          <View style={styles.stepRow}>
            <Text style={styles.eyebrow}>STEP {step} OF 6</Text>
            <Text style={styles.stepCount}>{step}/6</Text>
          </View>
          <View style={styles.progressRail}>
            {Array.from({ length: 6 }, (_, index) => (
              <View key={index} style={[styles.progressSegment, index < step && styles.progressSegmentActive]} />
            ))}
          </View>
          <Text style={styles.title}>{TITLES[step - 1]}</Text>
          <Text style={styles.subtitle}>{SUBTITLES[step - 1]}</Text>
        </View>

        <View style={styles.card}>
          {step === 1 && (
            <View style={styles.section}>
              <Field label="First name" value={form.firstName} onChangeText={(value) => update('firstName', value)} />
              <Field label="Last name" value={form.lastName} onChangeText={(value) => update('lastName', value)} />
              <Field
                label="Display name"
                value={form.displayName}
                onChangeText={(value) => update('displayName', value)}
                helper="This is the name other members will see around the app."
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.section}>
              <View style={styles.field}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={styles.input}
                  placeholder="Start typing your state"
                  placeholderTextColor="#758078"
                  value={stateSearch}
                  onFocus={() => {
                    if (form.homeState) {
                      setStateSearch('');
                      setCitySearch('');
                      setForm((current) => ({ ...current, homeState: '', homeCity: '' }));
                    }
                  }}
                  onChangeText={(value) => {
                    setStateSearch(value);
                    update('homeState', '');
                    update('homeCity', '');
                    setCitySearch('');
                  }}
                />
                {stateOptions.length ? (
                  <View style={styles.autocompleteMenu}>
                    {stateOptions.map((state, index) => (
                      <Pressable
                        key={state.abbreviation}
                        style={[styles.searchOption, index > 0 && styles.searchOptionDivider]}
                        onPress={() => selectState(state.abbreviation)}
                      >
                        <Text style={styles.searchOptionText}>{state.name}</Text>
                        <Text style={styles.searchOptionMeta}>{state.abbreviation}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {!form.homeState && stateSearch.trim() ? <Text style={styles.help}>Choose a state from the suggestions.</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={Boolean(form.homeState) && !citiesLoading}
                  style={[styles.input, (!form.homeState || citiesLoading) && styles.inputDisabled]}
                  placeholder={form.homeState ? 'Start typing your city' : 'Choose a state first'}
                  placeholderTextColor="#758078"
                  value={citySearch}
                  onFocus={() => {
                    if (form.homeCity) {
                      setCitySearch('');
                      update('homeCity', '');
                    }
                  }}
                  onChangeText={(value) => {
                    setCitySearch(value);
                    update('homeCity', '');
                  }}
                />
                {citiesLoading ? <Text style={styles.help}>Loading cities…</Text> : null}
                {citiesError ? <Text style={styles.errorText}>{citiesError}</Text> : null}
                {cityOptions.length ? (
                  <View style={styles.autocompleteMenu}>
                    {cityOptions.map((city, index) => (
                      <Pressable
                        key={city}
                        style={[styles.searchOption, index > 0 && styles.searchOptionDivider]}
                        onPress={() => {
                          setCitySearch(city);
                          update('homeCity', city);
                        }}
                      >
                        <Text style={styles.searchOptionText}>{city}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {form.homeState && !form.homeCity && citySearch.trim() && !citiesLoading ? (
                  <Text style={styles.help}>Choose a city from the suggestions.</Text>
                ) : null}
              </View>

              <View style={styles.preferenceBlock}>
                <Text style={styles.label}>Local adventure range</Text>
                <Text style={styles.help}>How far would you usually travel for a nearby adventure?</Text>
                <View style={styles.optionRow}>
                  {[25, 50, 100, 250].map((radius) => (
                    <Choice
                      key={radius}
                      selected={form.discoveryRadiusMiles === radius}
                      label={radius === 250 ? '250+ mi' : `${radius} mi`}
                      onPress={() => update('discoveryRadiusMiles', radius)}
                    />
                  ))}
                </View>
                <Text style={styles.microcopy}>Destination trips and special events can still appear outside this range.</Text>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.section}>
              <View style={styles.preferenceBlock}>
                <Text style={styles.label}>Experience level</Text>
                <View style={styles.optionRow}>
                  {(['new', 'beginner', 'intermediate', 'experienced'] as ExperienceLevel[]).map((level) => (
                    <Choice
                      key={level}
                      selected={form.experienceLevel === level}
                      label={level.charAt(0).toUpperCase() + level.slice(1)}
                      onPress={() => update('experienceLevel', level)}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.preferenceBlock}>
                <Text style={styles.label}>Interests</Text>
                <Text style={styles.help}>Pick one or more. We’ll use these to personalize your Trailhead.</Text>
                <View style={styles.optionRow}>
                  {INTEREST_OPTIONS.map((interest) => (
                    <Choice
                      key={interest}
                      selected={form.interests.includes(interest)}
                      label={interest}
                      onPress={() => update(
                        'interests',
                        form.interests.includes(interest)
                          ? form.interests.filter((item) => item !== interest)
                          : [...form.interests, interest],
                      )}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.sectionCompact}>
              <Toggle
                label="Push notifications"
                description="Trip updates, reminders, and community activity."
                value={form.pushEnabled}
                onValueChange={(value) => update('pushEnabled', value)}
              />
              <Toggle
                label="Email updates"
                description="Adventure news, confirmations, and account updates."
                value={form.emailEnabled}
                onValueChange={(value) => update('emailEnabled', value)}
              />
              <Toggle
                label="Text messages"
                description="Time-sensitive booking and readiness messages."
                value={form.smsEnabled}
                onValueChange={(value) => {
                  update('smsEnabled', value);
                  if (!value) update('smsConsent', false);
                }}
              />

              {form.smsEnabled ? (
                <View style={styles.smsPanel}>
                  <Field
                    label="Mobile phone number"
                    value={form.phoneNumber}
                    onChangeText={(value) => update('phoneNumber', formatUsPhone(value))}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="(555) 555-5555"
                  />
                  <Pressable style={styles.checkboxRow} onPress={() => update('smsConsent', !form.smsConsent)}>
                    <View style={[styles.checkbox, form.smsConsent && styles.checkboxChecked]}>
                      {form.smsConsent ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkboxLabel}>I agree to receive text messages about bookings, readiness, safety, and account updates. Message and data rates may apply. Reply STOP to opt out.</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.noteCard}>
                <Text style={styles.noteIcon}>!</Text>
                <Text style={styles.noteText}>Emergency and safety alerts may still use required channels for an adventure you join.</Text>
              </View>
            </View>
          )}

          {step === 5 && (
            <View style={styles.section}>
              <Field
                multiline
                optional
                label="Accessibility needs"
                value={form.accessibilityNeeds}
                onChangeText={(value) => update('accessibilityNeeds', value)}
                placeholder="Mobility, sensory, communication, or other needs"
              />
              <Field
                multiline
                optional
                label="Dietary needs"
                value={form.dietaryNeeds}
                onChangeText={(value) => update('dietaryNeeds', value)}
                placeholder="Allergies, restrictions, or preferences"
              />
              <Field
                multiline
                optional
                label="Anything else that would help us support you?"
                value={form.supportNotes}
                onChangeText={(value) => update('supportNotes', value)}
                placeholder="Share anything useful for hosts or support staff"
              />
              <View style={styles.privacyCard}>
                <Text style={styles.privacyTitle}>Private by default</Text>
                <Text style={styles.help}>These details are only shown to authorized staff when they’re needed to support you.</Text>
              </View>
            </View>
          )}

          {step === 6 && (
            <View style={styles.section}>
              <View style={styles.householdIntro}>
                <Text style={styles.sectionTitle}>Adventure with your household</Text>
                <Text style={styles.body}>Manage shared bookings, waivers, payments, and readiness in one place. This is optional and can be set up later.</Text>
              </View>

              <View style={styles.householdChoices}>
                <HouseholdChoice
                  title="Create a household"
                  description="Start a new household and invite your people."
                  selected={form.householdMode === 'create'}
                  onPress={() => update('householdMode', 'create')}
                />
                <HouseholdChoice
                  title="Join a household"
                  description="Use an invite code from an existing household."
                  selected={form.householdMode === 'join'}
                  onPress={() => update('householdMode', 'join')}
                />
              </View>

              {form.householdMode === 'create' ? (
                <Field
                  label="Household name"
                  value={form.householdName}
                  onChangeText={(value) => update('householdName', value)}
                  placeholder="The Carr Crew"
                  helper="After it’s created, you’ll get an invite code to share."
                />
              ) : null}

              {form.householdMode === 'join' ? (
                <Field
                  label="Household invite code"
                  value={form.householdInviteCode}
                  onChangeText={(value) => update('householdInviteCode', value.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="AB12CD34"
                  helper="Ask the household owner for their 8-character invite code."
                />
              ) : null}

              <Pressable
                onPress={() => update('householdMode', 'skip')}
                style={[styles.notNowButton, form.householdMode === 'skip' && styles.notNowButtonSelected]}
              >
                <Text style={[styles.notNowText, form.householdMode === 'skip' && styles.notNowTextSelected]}>
                  {form.householdMode === 'skip' ? '✓ Not now' : 'Not now'}
                </Text>
              </Pressable>

              <View style={styles.summary}>
                <View style={styles.summaryTopRow}>
                  <View style={styles.readyBadge}><Text style={styles.readyBadgeText}>✓</Text></View>
                  <View style={styles.summaryHeading}>
                    <Text style={styles.summaryEyebrow}>READY TO EXPLORE</Text>
                    <Text style={styles.summaryTitle}>Welcome, {form.displayName || 'Adventurer'}</Text>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryGrid}>
                  <SummaryItem label="HOME BASE" value={`${form.homeCity}, ${form.homeState}`} />
                  <SummaryItem label="EXPERIENCE" value={form.experienceLevel.charAt(0).toUpperCase() + form.experienceLevel.slice(1)} />
                  <SummaryItem label="INTERESTS" value={`${form.interests.length} selected`} />
                  <SummaryItem label="LOCAL RANGE" value={`${form.discoveryRadiusMiles === 250 ? '250+' : form.discoveryRadiusMiles} mi`} />
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 ? (
          <Pressable
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={() => setStep((current) => current - 1)}
            disabled={isSaving}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={[styles.primaryButton, !canContinue && styles.disabled]}
          onPress={() => void next()}
          disabled={!canContinue || isSaving}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving…' : step === 6 ? 'Enter Trailhead' : 'Continue'}</Text>
          {!isSaving ? <Text style={styles.primaryButtonArrow}>→</Text> : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  multiline?: boolean;
  optional?: boolean;
  helper?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

function Field({ label, multiline = false, optional = false, helper, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>OPTIONAL</Text> : null}
      </View>
      <TextInput
        {...props}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
        placeholderTextColor="#758078"
      />
      {helper ? <Text style={styles.help}>{helper}</Text> : null}
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={onPress}
    >
      {selected ? <Text style={styles.choiceCheck}>✓</Text> : null}
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#C9D0CB', true: '#7FA58E' }}
        thumbColor={value ? '#24543B' : '#F7F3EA'}
      />
    </View>
  );
}

function HouseholdChoice({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.householdChoice, selected && styles.householdChoiceSelected]}
    >
      <View style={[styles.householdChoiceIcon, selected && styles.householdChoiceIconSelected]}>
        <Text style={[styles.householdChoiceIconText, selected && styles.householdChoiceIconTextSelected]}>{selected ? '✓' : '+'}</Text>
      </View>
      <View style={styles.householdChoiceCopy}>
        <Text style={styles.householdChoiceTitle}>{title}</Text>
        <Text style={styles.householdChoiceDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryItemLabel}>{label}</Text>
      <Text style={styles.summaryItemValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0E5' },
  scroll: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 28 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: '#17211B' },
  loadingText: { color: '#DCE3DE', fontSize: 14, fontWeight: '700' },
  brandMark: { width: 72, height: 62, borderRadius: 18, borderWidth: 2, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFF8E8', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 26 },
  brandMarkSmall: { width: 34, height: 30, borderRadius: 9, backgroundColor: '#17211B', alignItems: 'center', justifyContent: 'center' },
  brandMarkSmallText: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  brandName: { color: '#334039', fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  header: { gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.35, color: '#3D7657' },
  stepCount: { fontSize: 12, fontWeight: '800', color: '#68736C' },
  progressRail: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  progressSegment: { flex: 1, height: 5, borderRadius: 999, backgroundColor: '#DCD5C8' },
  progressSegmentActive: { backgroundColor: '#D7A23B' },
  title: { fontSize: 31, lineHeight: 37, fontWeight: '900', color: '#17211B', letterSpacing: -0.45 },
  subtitle: { maxWidth: 560, fontSize: 15, lineHeight: 22, color: '#526058' },
  card: { marginTop: 24, padding: 18, borderWidth: 1, borderColor: '#E3DBCE', borderRadius: 20, backgroundColor: '#FFFCF6' },
  section: { gap: 18 },
  sectionCompact: { gap: 12 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', color: '#17211B' },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 13, fontWeight: '800', color: '#26342C' },
  optional: { color: '#7A837D', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  input: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1.2, borderColor: '#B9C1BB', borderRadius: 12, backgroundColor: '#FFFFFF', color: '#17211B', fontSize: 15 },
  inputDisabled: { opacity: 0.48 },
  multiline: { minHeight: 78, paddingTop: 13, paddingBottom: 13, textAlignVertical: 'top' },
  autocompleteMenu: { borderWidth: 1, borderColor: '#D8D2C6', borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', marginTop: -2 },
  searchOption: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  searchOptionDivider: { borderTopWidth: 1, borderTopColor: '#EEE9DF' },
  searchOptionText: { color: '#17211B', fontWeight: '700' },
  searchOptionMeta: { color: '#56615A', fontWeight: '700' },
  preferenceBlock: { gap: 10 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  choice: { minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.2, borderColor: '#B9C1BB', borderRadius: 999, backgroundColor: '#FFFFFF' },
  choiceSelected: { borderColor: '#24543B', backgroundColor: '#E2EFE7' },
  choiceCheck: { color: '#24543B', fontWeight: '900', fontSize: 12 },
  choiceText: { color: '#344139', fontWeight: '700' },
  choiceTextSelected: { color: '#183D2A', fontWeight: '900' },
  toggleRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: '#E1DBD0', borderRadius: 14, backgroundColor: '#FFFFFF' },
  toggleCopy: { flex: 1, gap: 3 },
  toggleLabel: { color: '#17211B', fontSize: 15, fontWeight: '800' },
  toggleDescription: { color: '#68736C', fontSize: 12, lineHeight: 17 },
  smsPanel: { gap: 14, padding: 15, borderWidth: 1, borderColor: '#D8D2C6', borderRadius: 14, backgroundColor: '#F3EDE2' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 22, height: 22, marginTop: 2, borderWidth: 2, borderColor: '#24543B', borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxChecked: { backgroundColor: '#24543B' },
  checkmark: { color: '#FFFFFF', fontWeight: '900' },
  checkboxLabel: { flex: 1, color: '#4E5C54', fontSize: 12, lineHeight: 18 },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#F1E7D2' },
  noteIcon: { width: 20, height: 20, textAlign: 'center', textAlignVertical: 'center', borderRadius: 10, overflow: 'hidden', backgroundColor: '#D7A23B', color: '#17211B', fontWeight: '900' },
  noteText: { flex: 1, color: '#4D574F', fontSize: 12, lineHeight: 18 },
  privacyCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: '#EDF2EE' },
  privacyTitle: { color: '#24543B', fontSize: 13, fontWeight: '900' },
  householdIntro: { gap: 7 },
  householdChoices: { gap: 10 },
  householdChoice: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderWidth: 1.2, borderColor: '#C7CEC9', borderRadius: 14, backgroundColor: '#FFFFFF' },
  householdChoiceSelected: { borderColor: '#24543B', backgroundColor: '#EAF2ED' },
  householdChoiceIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF0EC' },
  householdChoiceIconSelected: { backgroundColor: '#24543B' },
  householdChoiceIconText: { color: '#516057', fontSize: 18, fontWeight: '900' },
  householdChoiceIconTextSelected: { color: '#FFFFFF' },
  householdChoiceCopy: { flex: 1, gap: 3 },
  householdChoiceTitle: { color: '#17211B', fontSize: 14, fontWeight: '900' },
  householdChoiceDescription: { color: '#68736C', fontSize: 12, lineHeight: 17 },
  notNowButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  notNowButtonSelected: { backgroundColor: '#EFE7D8' },
  notNowText: { color: '#5F6B64', fontSize: 13, fontWeight: '800' },
  notNowTextSelected: { color: '#24543B' },
  body: { fontSize: 15, lineHeight: 22, color: '#56615A' },
  help: { fontSize: 12, lineHeight: 18, color: '#68736C' },
  microcopy: { fontSize: 11, lineHeight: 16, color: '#7A837D' },
  errorText: { color: '#A23D2B', fontSize: 12, fontWeight: '700' },
  summary: { gap: 14, padding: 16, borderWidth: 1, borderColor: '#C9D7CE', borderRadius: 17, backgroundColor: '#E7F0EA' },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readyBadge: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#24543B', alignItems: 'center', justifyContent: 'center' },
  readyBadgeText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  summaryHeading: { flex: 1, gap: 2 },
  summaryEyebrow: { color: '#5E7C69', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  summaryTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', color: '#17211B' },
  summaryDivider: { height: 1, backgroundColor: '#C9D7CE' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryItem: { width: '47%', gap: 2 },
  summaryItemLabel: { color: '#6C786F', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  summaryItemValue: { color: '#26342C', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, borderTopWidth: 1, borderTopColor: '#DDD5C8', backgroundColor: '#FFFCF6' },
  primaryButton: { flex: 1, minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, backgroundColor: '#24543B' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  primaryButtonArrow: { color: '#D7B45A', fontSize: 19, fontWeight: '900' },
  secondaryButton: { minHeight: 54, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.2, borderColor: '#9AA69E', borderRadius: 14, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#334039', fontWeight: '900' },
  disabled: { opacity: 0.42 },
});
