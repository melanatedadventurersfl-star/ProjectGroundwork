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
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthProvider';
import {
  completeOnboarding,
  loadOnboardingProfile,
  saveOnboardingProgress,
} from '../src/onboarding/onboardingService';
import {
  INITIAL_ONBOARDING_FORM,
  INTEREST_OPTIONS,
  type ExperienceLevel,
  type OnboardingForm,
} from '../src/onboarding/types';

const TITLES = [
  'Tell us who you are',
  'Choose your adventure radius',
  'What calls you outside?',
  'How should we reach you?',
  'Help us support you',
  'Bring your household along',
];

export default function OnboardingScreen() {
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(INITIAL_ONBOARDING_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!session?.user.id) return;

    loadOnboardingProfile(session.user.id)
      .then((profile) => {
        const communication = (profile.communication_preferences ?? {}) as Record<string, boolean>;
        setForm((current) => ({
          ...current,
          firstName: profile.first_name ?? '',
          lastName: profile.last_name ?? '',
          displayName: profile.display_name ?? '',
          homeCity: profile.home_city ?? '',
          homeState: profile.home_state ?? 'FL',
          discoveryRadiusMiles: profile.discovery_radius_miles ?? 50,
          experienceLevel: (profile.experience_level ?? 'new') as ExperienceLevel,
          interests: profile.interests ?? [],
          pushEnabled: communication.push ?? true,
          emailEnabled: communication.email ?? true,
          smsEnabled: communication.sms ?? false,
          accessibilityNeeds: profile.accessibility_needs ?? '',
          dietaryNeeds: profile.dietary_needs ?? '',
          supportNotes: profile.support_notes ?? '',
        }));
        setStep(Math.min(Math.max(profile.onboarding_step ?? 1, 1), 6));
      })
      .catch((error: Error) => Alert.alert('Unable to load onboarding', error.message))
      .finally(() => setIsLoading(false));
  }, [session?.user.id]);

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(form.firstName.trim() && form.lastName.trim() && form.displayName.trim());
    if (step === 2) return Boolean(form.homeCity.trim() && form.homeState.trim());
    if (step === 3) return form.interests.length > 0;
    return true;
  }, [form, step]);

  const update = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
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
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.');
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
          <Field label="Home city" value={form.homeCity} onChangeText={(value) => update('homeCity', value)} />
          <Field label="State" value={form.homeState} onChangeText={(value) => update('homeState', value.toUpperCase())} />
          <Text style={styles.label}>Discovery radius</Text>
          <View style={styles.optionRow}>
            {[25, 50, 100, 250].map((radius) => (
              <Choice key={radius} selected={form.discoveryRadiusMiles === radius} label={`${radius} mi`} onPress={() => update('discoveryRadiusMiles', radius)} />
            ))}
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
          <Toggle label="Text messages" value={form.smsEnabled} onValueChange={(value) => update('smsEnabled', value)} />
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
          <Text style={styles.body}>Create a household now to manage shared bookings and readiness. You can skip this and add one later.</Text>
          <Field label="Household name (optional)" value={form.householdName} onChangeText={(value) => update('householdName', value)} />
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Your Trailhead is ready</Text>
            <Text style={styles.body}>{form.displayName} · {form.homeCity}, {form.homeState}</Text>
            <Text style={styles.body}>{form.interests.length} interests selected · {form.discoveryRadiusMiles}-mile discovery radius</Text>
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
          onPress={next}
          disabled={!canContinue || isSaving}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving…' : step === 6 ? 'Enter Trailhead' : 'Continue'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({ label, multiline = false, ...props }: { label: string; multiline?: boolean; value: string; onChangeText: (value: string) => void }) {
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
  multiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#B8BEB9', borderRadius: 999, backgroundColor: '#FFFFFF' },
  choiceSelected: { borderColor: '#24543B', backgroundColor: '#24543B' },
  choiceText: { textTransform: 'capitalize', color: '#17211B', fontWeight: '600' },
  choiceTextSelected: { color: '#FFFFFF' },
  toggleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#FFFFFF' },
  body: { fontSize: 16, lineHeight: 24, color: '#56615A' },
  help: { fontSize: 13, lineHeight: 18, color: '#56615A' },
  summary: { padding: 18, gap: 8, borderRadius: 12, backgroundColor: '#EEE7DA' },
  summaryTitle: { fontSize: 20, fontWeight: '800', color: '#17211B' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 36, paddingBottom: 36 },
  primaryButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#24543B' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 52, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#24543B', borderRadius: 8 },
  secondaryButtonText: { color: '#24543B', fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
