import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
  'Bring your household along',
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
      Alert.alert('Unable to save', message.includes('Household invite code not found') ? 'That household invite code was not found. Check the code and try again.' : message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>STEP {step} OF 6</Text>
      <Text style={styles.title}>{TITLES[step - 1]}</Text>
      <Text style={styles.progress}>{'●'.repeat(step)}{'○'.repeat(6 - step)}</Text>

      {step === 1 && (
        <View style={styles.section}>
          <Field label="First name" value={form.firstName} onChangeText={(value) => update('firstName', value)} />
          <Field label="Last name" value={form.lastName} onChangeText={(value) => update('lastName', value)} />
          <Field label="Display name" value={form.displayName} onChangeText={(value) => update('displayName', value)} />
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
              placeholderTextColor="#7B827D"
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
              placeholderTextColor="#7B827D"
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
            {form.homeState && !form.homeCity && citySearch.trim() && !citiesLoading ? <Text style={styles.help}>Choose a city from the suggestions.</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>How far are you willing to travel for a local adventure?</Text>
            <Text style={styles.help}>This helps us show you nearby experiences. Destination trips and special events may still appear outside this range.</Text>
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
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.section}>
          <Text style={styles.label}>Experience level</Text>
          <View style={styles.optionRow}>
            {(['new', 'beginner', 'intermediate', 'experienced'] as ExperienceLevel[]).map((level) => (
              <Choice key={level} selected={form.experienceLevel === level} label={level} onPress={() => update('experienceLevel', level)} />
            ))}
          </View>
          <Text style={styles.label}>Interests</Text>
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
      )}

      {step === 4 && (
        <View style={styles.section}>
          <Toggle label="Push notifications" value={form.pushEnabled} onValueChange={(value) => update('pushEnabled', value)} />
          <Toggle label="Email updates" value={form.emailEnabled} onValueChange={(value) => update('emailEnabled', value)} />
          <Toggle
            label="Text messages"
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
          <Text style={styles.help}>Emergency and safety alerts may still use required channels for an adventure you join.</Text>
        </View>
      )}

      {step === 5 && (
        <View style={styles.section}>
          <Field multiline label="Accessibility needs" value={form.accessibilityNeeds} onChangeText={(value) => update('accessibilityNeeds', value)} />
          <Field multiline label="Dietary needs" value={form.dietaryNeeds} onChangeText={(value) => update('dietaryNeeds', value)} />
          <Field multiline label="Anything else that would help us support you?" value={form.supportNotes} onChangeText={(value) => update('supportNotes', value)} />
          <Text style={styles.help}>These details are private and only shown to authorized staff when needed.</Text>
        </View>
      )}

      {step === 6 && (
        <View style={styles.section}>
          <Text style={styles.body}>Adventure together. A household lets you manage shared bookings, waivers, payments, and readiness in one place.</Text>
          <View style={styles.optionRow}>
            {([
              ['skip', 'Skip for now'],
              ['create', 'Create new'],
              ['join', 'Join existing'],
            ] as [HouseholdMode, string][]).map(([mode, label]) => (
              <Choice key={mode} selected={form.householdMode === mode} label={label} onPress={() => update('householdMode', mode)} />
            ))}
          </View>

          {form.householdMode === 'create' ? (
            <>
              <Field label="Household name" value={form.householdName} onChangeText={(value) => update('householdName', value)} placeholder="The Carr Crew" />
              <Text style={styles.help}>After your household is created, it will have an invite code you can share with people you want to add.</Text>
            </>
          ) : null}

          {form.householdMode === 'join' ? (
            <>
              <Field
                label="Household invite code"
                value={form.householdInviteCode}
                onChangeText={(value) => update('householdInviteCode', value.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase())}
                autoCapitalize="characters"
                placeholder="AB12CD34"
              />
              <Text style={styles.help}>Ask the household owner for their 8-character invite code. Household names are not used for joining.</Text>
            </>
          ) : null}

          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Your Trailhead is ready</Text>
            <Text style={styles.body}>{form.displayName} · {form.homeCity}, {form.homeState}</Text>
            <Text style={styles.body}>{form.interests.length} interests selected · {form.discoveryRadiusMiles === 250 ? '250+' : form.discoveryRadiusMiles}-mile local range</Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        {step > 1 && (
          <Pressable style={styles.secondaryButton} onPress={() => setStep((current) => current - 1)} disabled={isSaving}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.primaryButton, !canContinue && styles.disabled]}
          onPress={() => void next()}
          disabled={!canContinue || isSaving}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving…' : step === 6 ? 'Enter Trailhead' : 'Continue'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type FieldProps = {
  label: string;
  multiline?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

function Field({ label, multiline = false, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} multiline={multiline} style={[styles.input, multiline && styles.multiline]} placeholderTextColor="#7B827D" />
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.body}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, padding: 24, paddingTop: 64, backgroundColor: '#F7F3EA' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4, color: '#3D7657' },
  title: { marginTop: 10, fontSize: 30, lineHeight: 36, fontWeight: '800', color: '#17211B' },
  progress: { marginTop: 12, fontSize: 18, letterSpacing: 5, color: '#D89B2B' },
  section: { marginTop: 30, gap: 18 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#17211B' },
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#B8BEB9', borderRadius: 8, backgroundColor: '#FFFFFF', color: '#17211B' },
  inputDisabled: { opacity: 0.55 },
  multiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  autocompleteMenu: { borderWidth: 1, borderColor: '#D8D2C6', borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', marginTop: -2 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#B8BEB9', borderRadius: 999, backgroundColor: '#FFFFFF' },
  choiceSelected: { borderColor: '#24543B', backgroundColor: '#24543B' },
  choiceText: { color: '#17211B', fontWeight: '600' },
  choiceTextSelected: { color: '#FFFFFF' },
  searchOption: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  searchOptionDivider: { borderTopWidth: 1, borderTopColor: '#EEE9DF' },
  searchOptionText: { color: '#17211B', fontWeight: '700' },
  searchOptionMeta: { color: '#56615A' },
  toggleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#FFFFFF' },
  smsPanel: { gap: 14, padding: 16, borderRadius: 12, backgroundColor: '#EEE7DA' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 22, height: 22, marginTop: 2, borderWidth: 2, borderColor: '#24543B', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#24543B' },
  checkmark: { color: '#FFFFFF', fontWeight: '900' },
  checkboxLabel: { flex: 1, color: '#56615A', fontSize: 13, lineHeight: 19 },
  body: { fontSize: 16, lineHeight: 24, color: '#56615A' },
  help: { fontSize: 13, lineHeight: 18, color: '#56615A' },
  errorText: { color: '#A23D2B', fontSize: 13 },
  summary: { padding: 18, gap: 8, borderRadius: 12, backgroundColor: '#EEE7DA' },
  summaryTitle: { fontSize: 20, fontWeight: '800', color: '#17211B' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 36, paddingBottom: 36 },
  primaryButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#24543B' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 52, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#24543B', borderRadius: 8 },
  secondaryButtonText: { color: '#24543B', fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
