import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { uploadProfilePhoto } from '../member/api';
import { getStateOption, loadCitiesForState, US_STATES } from './locations';
import { completeOnboarding, loadOnboardingProfile, saveOnboardingProgress } from './onboardingService';
import { markGuidedTutorialCompleted } from './tutorialPreference';
import {
  INITIAL_ONBOARDING_FORM,
  type LocationPermissionStatus,
  type OnboardingForm,
  type TravelRange,
} from './types';

const GOLD = '#F5B82E';
const BG = '#07100C';
const SURFACE = '#111C16';
const SURFACE_2 = '#17241C';
const BORDER = '#304038';
const TEXT = '#FFF9EC';
const MUTED = '#B7C0BA';
const TOTAL_STEPS = 5;
const MIN_INTERESTS = 3;

const BACKGROUNDS = {
  welcome: require('../../assets/onboarding/onboarding-welcome.jpg'),
  profile: require('../../assets/onboarding/onboarding-people.jpg'),
  interests: require('../../assets/onboarding/onboarding-plan.jpg'),
  location: require('../../assets/onboarding/onboarding-places.jpg'),
  complete: require('../../assets/onboarding/onboarding-complete.jpg'),
} as const;

const LOGO = require('../../assets/ma-app-icon.png');

const FIRST_USE_INTERESTS = [
  { value: 'Camping', label: 'Camping', icon: 'bonfire-outline' },
  { value: 'Hiking', label: 'Hiking and walking', icon: 'walk-outline' },
  { value: 'Water adventures', label: 'Water adventures', icon: 'water-outline' },
  { value: 'Road trips', label: 'Road trips', icon: 'car-outline' },
  { value: 'Family adventures', label: 'Family outings', icon: 'people-outline' },
  { value: 'Food and culture', label: 'Food and outdoors', icon: 'restaurant-outline' },
  { value: 'Beginner-friendly experiences', label: 'Beginner adventures', icon: 'leaf-outline' },
  { value: 'Festivals and group events', label: 'Festivals and group events', icon: 'calendar-outline' },
] as const;

const TRAVEL_RANGES: { id: TravelRange; label: string; detail: string; miles: number }[] = [
  { id: 'nearby', label: 'Nearby', detail: 'Up to 25 miles', miles: 25 },
  { id: 'one_hour', label: 'Up to 1 hour', detail: 'Local day trips', miles: 50 },
  { id: 'two_hours', label: 'Up to 2 hours', detail: 'Wider day trips', miles: 100 },
  { id: 'weekend', label: 'Weekend trips', detail: 'Show farther options', miles: 250 },
];

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'GM';
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function isTravelRange(value: unknown): value is TravelRange {
  return TRAVEL_RANGES.some((item) => item.id === value);
}

function travelRangeFromMiles(miles: number | null | undefined): TravelRange {
  if (!miles || miles <= 25) return 'nearby';
  if (miles <= 50) return 'one_hour';
  if (miles <= 100) return 'two_hours';
  return 'weekend';
}

function isLocationPermissionStatus(value: unknown): value is LocationPermissionStatus {
  return value === 'unknown' || value === 'granted' || value === 'denied' || value === 'manual';
}

function Progress({ step }: { step: number }) {
  return (
    <View style={styles.progressWrap}>
      <Text style={styles.progressText}>STEP {step} OF {TOTAL_STEPS}</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: step }}
        accessibilityLabel={`Onboarding step ${step} of ${TOTAL_STEPS}`}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled = false, loading = false }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.primaryButton, (disabled || loading) && styles.disabled]}
    >
      {loading ? <ActivityIndicator color={BG} /> : null}
      <Text style={styles.primaryButtonText}>{loading ? 'Saving…' : label}</Text>
      {!loading ? <Ionicons name="arrow-forward" size={18} color={BG} /> : null}
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={onPress} style={styles.backButton}>
      <Ionicons name="chevron-back" size={22} color={TEXT} />
    </Pressable>
  );
}

function ScreenShell({ step, onBack, children }: { step: number; onBack: () => void; children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <BackButton onPress={onBack} />
          <Progress step={step} />
          <View style={styles.headerSpacer} />
        </View>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function FirstUseOnboardingExperience() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(INITIAL_ONBOARDING_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wasAlreadyComplete, setWasAlreadyComplete] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [locating, setLocating] = useState(false);

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

      const profile = await loadOnboardingProfile(userId);
      if (!active) return;

      const communication = (profile.communication_preferences ?? {}) as Record<string, unknown>;
      const complete = Boolean(profile.onboarding_completed_at);
      const savedStep = typeof profile.onboarding_step === 'number' ? profile.onboarding_step : 1;
      const travelRange = isTravelRange(communication.travel_range)
        ? communication.travel_range
        : travelRangeFromMiles(profile.discovery_radius_miles);
      const locationPermissionStatus = isLocationPermissionStatus(communication.location_permission_status)
        ? communication.location_permission_status
        : 'unknown';

      setWasAlreadyComplete(complete);
      setAvatarUrl(profile.avatar_url ?? null);
      setForm((current) => ({
        ...current,
        firstName: profile.first_name ?? '',
        lastName: profile.last_name ?? '',
        displayName: profile.display_name ?? '',
        homeCity: profile.home_city ?? '',
        homeState: profile.home_state ?? '',
        discoveryRadiusMiles: profile.discovery_radius_miles ?? 50,
        travelRange,
        locationPermissionStatus,
        experienceLevel: profile.experience_level ?? 'new',
        interests: Array.isArray(profile.interests) ? profile.interests : [],
        adventurePreferences: Array.isArray(communication.adventure_preferences)
          ? communication.adventure_preferences.filter((value): value is string => typeof value === 'string')
          : [],
        intents: Array.isArray(communication.discovery_intents)
          ? communication.discovery_intents.filter((value): value is string => typeof value === 'string')
          : [],
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
      setDisplayNameTouched(Boolean(profile.display_name?.trim()));
      setStep(complete ? 1 : Math.min(Math.max(savedStep, 1), TOTAL_STEPS));
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

  const stateOptions = useMemo(() => {
    if (!stateOpen) return [];
    const query = stateSearch.trim().toLowerCase();
    return US_STATES
      .filter((state) => !query || state.name.toLowerCase().includes(query) || state.abbreviation.toLowerCase().startsWith(query))
      .slice(0, 8);
  }, [stateOpen, stateSearch]);

  const cityOptions = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    return cities.filter((city) => !query || city.toLowerCase().includes(query)).slice(0, 12);
  }, [cities, citySearch]);

  const profileReady = Boolean(form.firstName.trim() && form.lastName.trim() && form.displayName.trim());
  const locationReady = Boolean(form.homeCity.trim() && form.homeState.trim());
  const selectedRange = TRAVEL_RANGES.find((item) => item.id === form.travelRange) ?? TRAVEL_RANGES[1]!;

  function changeNamePart(key: 'firstName' | 'lastName', value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (!displayNameTouched) next.displayName = [next.firstName, next.lastName].filter(Boolean).join(' ');
      return next;
    });
  }

  async function advance(nextStep: number) {
    if (saving) return;
    if (!userId) {
      Alert.alert('Sign in required', 'Sign in again to continue setup.');
      return;
    }
    setSaving(true);
    try {
      if (!wasAlreadyComplete) await saveOnboardingProgress(userId, nextStep, form);
      setStep(nextStep);
    } catch (error) {
      Alert.alert('Unable to save progress', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function chooseProfilePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access is optional', 'You can skip the photo and add one later from your profile.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoBusy(true);
    try {
      const asset = result.assets[0];
      const nextAvatarUrl = await uploadProfilePhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType });
      setAvatarUrl(nextAvatarUrl);
    } catch (error) {
      Alert.alert('Unable to add photo', error instanceof Error ? error.message : 'Skip it for now and try again later.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function selectTravelRange(range: (typeof TRAVEL_RANGES)[number]) {
    setForm((current) => ({
      ...current,
      travelRange: range.id,
      discoveryRadiusMiles: range.miles,
    }));
  }

  async function requestCurrentLocation() {
    setLocationPromptOpen(false);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        update('locationPermissionStatus', 'denied');
        Alert.alert('Location is off', 'Choose your home area instead. You can enable location later in Settings.');
        setCityPickerOpen(true);
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const place = (await Location.reverseGeocodeAsync(position.coords))[0];
      const region = place?.region ?? '';
      const state = US_STATES.find((option) => option.name.toLowerCase() === region.toLowerCase() || option.abbreviation.toLowerCase() === region.toLowerCase());
      const city = place?.city || place?.subregion || '';
      if (!state || !city) {
        update('locationPermissionStatus', 'granted');
        Alert.alert('Choose your home area', 'Location is on, but we could not match your city cleanly.');
        setCityPickerOpen(true);
        return;
      }

      setForm((current) => ({
        ...current,
        homeState: state.abbreviation,
        homeCity: city,
        locationPermissionStatus: 'granted',
      }));
      setStateSearch(state.name);
      setCitySearch(city);
      setStateOpen(false);
    } catch (error) {
      Alert.alert('Unable to use location', error instanceof Error ? error.message : 'Choose your home area instead.');
      setCityPickerOpen(true);
    } finally {
      setLocating(false);
    }
  }

  async function saveReplayProfile() {
    if (!userId) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        display_name: form.displayName.trim(),
        home_city: form.homeCity.trim(),
        home_state: form.homeState.trim().toUpperCase(),
        discovery_radius_miles: form.discoveryRadiusMiles,
        experience_level: form.experienceLevel,
        interests: form.interests,
        communication_preferences: {
          push: form.pushEnabled,
          email: form.emailEnabled,
          sms: form.smsEnabled,
          discovery_intents: form.intents,
          adventure_preferences: form.adventurePreferences,
          travel_range: form.travelRange,
          location_permission_status: form.locationPermissionStatus,
          onboarding_version: 3,
        },
      })
      .eq('id', userId);
    if (error) throw error;
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    try {
      if (wasAlreadyComplete) await saveReplayProfile();
      else await completeOnboarding(form);
      markGuidedTutorialCompleted();
      router.replace('/(tabs)' as never);
    } catch (error) {
      Alert.alert('Unable to finish setup', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ImageBackground source={BACKGROUNDS.welcome} style={styles.fullScreen}>
        <View style={styles.scrimStrong} />
        <SafeAreaView style={styles.loadingStage}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.loadingText}>Preparing your welcome…</Text>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (step === 1) {
    return (
      <ImageBackground source={BACKGROUNDS.welcome} style={styles.fullScreen}>
        <View style={styles.scrim} />
        <SafeAreaView style={styles.welcomeStage}>
          <View style={styles.welcomeTopRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            {wasAlreadyComplete ? (
              <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)' as never)}>
                <Text style={styles.exitText}>Exit replay</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.welcomeCopyWrap}>
            <Text style={styles.eyebrow}>WELCOME TO GO MELANATED</Text>
            <Text style={styles.welcomeTitle}>Find somewhere to go.{`\n`}<Text style={styles.gold}>Find people to go with.</Text></Text>
            <Text style={styles.welcomeBody}>Discover outdoor places, local adventures, and a community built around getting outside.</Text>
          </View>
          <View>
            <Progress step={1} />
            <PrimaryButton label="Get started" loading={saving} onPress={() => void advance(2)} />
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (step === 2) {
    return (
      <ScreenShell step={2} onBack={() => setStep(1)}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>YOUR PROFILE</Text>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.body}>Your display name and photo appear across Go Melanated. You can change them later.</Text>

          <View style={styles.photoRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={avatarUrl ? 'Change profile photo' : 'Choose profile photo'} disabled={photoBusy} onPress={() => void chooseProfilePhoto()} style={styles.avatarButton}>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(form.displayName || form.firstName)}</Text>}
              <View style={styles.cameraBadge}><Ionicons name="camera" size={15} color={BG} /></View>
              {photoBusy ? <View style={styles.photoBusy}><ActivityIndicator color={GOLD} /></View> : null}
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.photoTitle}>Profile photo</Text>
              <Text style={styles.photoCopy}>Optional. Skip it now if you want.</Text>
              <Pressable disabled={photoBusy} onPress={() => void chooseProfilePhoto()}><Text style={styles.inlineAction}>{avatarUrl ? 'Change photo' : 'Choose photo'}</Text></Pressable>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>First name</Text>
              <TextInput autoCapitalize="words" value={form.firstName} onChangeText={(value) => changeNamePart('firstName', value)} placeholder="First name" placeholderTextColor="#718079" style={styles.input} />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Last name</Text>
              <TextInput autoCapitalize="words" value={form.lastName} onChangeText={(value) => changeNamePart('lastName', value)} placeholder="Last name" placeholderTextColor="#718079" style={styles.input} />
            </View>
          </View>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            autoCapitalize="words"
            value={form.displayName}
            onChangeText={(value) => { setDisplayNameTouched(true); update('displayName', value); }}
            placeholder="What members will see"
            placeholderTextColor="#718079"
            style={styles.input}
          />

          <View style={styles.pageFooter}>
            <PrimaryButton label="Continue" disabled={!profileReady} loading={saving} onPress={() => { Keyboard.dismiss(); void advance(3); }} />
          </View>
        </ScrollView>
      </ScreenShell>
    );
  }

  if (step === 3) {
    return (
      <ScreenShell step={3} onBack={() => setStep(2)}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
          <Text style={styles.title}>What sounds like you?</Text>
          <Text style={styles.body}>Pick at least three. These choices shape what appears on Trailhead and in Trail Guide.</Text>

          <View style={styles.interestGrid}>
            {FIRST_USE_INTERESTS.map((item) => {
              const selected = form.interests.includes(item.value);
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => update('interests', toggleValue(form.interests, item.value))}
                  style={[styles.interestCard, selected && styles.interestCardSelected]}
                >
                  <Ionicons name={item.icon as never} size={22} color={selected ? BG : GOLD} />
                  <Text style={[styles.interestText, selected && styles.interestTextSelected]}>{item.label}</Text>
                  {selected ? <Ionicons name="checkmark-circle" size={18} color={BG} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.selectionRow}>
            <Ionicons name={form.interests.length >= MIN_INTERESTS ? 'checkmark-circle' : 'radio-button-off'} size={18} color={form.interests.length >= MIN_INTERESTS ? GOLD : MUTED} />
            <Text style={styles.selectionText}>{form.interests.length} selected · Choose at least {MIN_INTERESTS}</Text>
          </View>

          <View style={styles.pageFooter}>
            <PrimaryButton label="Continue" disabled={form.interests.length < MIN_INTERESTS} loading={saving} onPress={() => void advance(4)} />
          </View>
        </ScrollView>
      </ScreenShell>
    );
  }

  if (step === 4) {
    return (
      <ScreenShell step={4} onBack={() => setStep(3)}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>YOUR HOME AREA</Text>
          <Text style={styles.title}>What should we show near you?</Text>
          <Text style={styles.body}>Choose a city or let the app find your area. Your exact location is never shown to other members.</Text>

          <View style={styles.locationCard}>
            <View style={styles.locationIcon}><Ionicons name="location" size={24} color={GOLD} /></View>
            <View style={styles.flex}>
              <Text style={styles.locationLabel}>{locationReady ? `${form.homeCity}, ${form.homeState}` : 'Home area not set'}</Text>
              <Text style={styles.locationMeta}>{locationReady ? 'Used for nearby places, adventures, and Campfires' : 'Choose one option below'}</Text>
            </View>
          </View>

          <View style={styles.locationActions}>
            <Pressable accessibilityRole="button" onPress={() => setCityPickerOpen(true)} style={styles.secondaryButton}>
              <Ionicons name="search" size={18} color={GOLD} />
              <Text style={styles.secondaryButtonText}>Choose home area</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={locating} onPress={() => setLocationPromptOpen(true)} style={styles.secondaryButton}>
              {locating ? <ActivityIndicator color={GOLD} /> : <Ionicons name="navigate" size={18} color={GOLD} />}
              <Text style={styles.secondaryButtonText}>{locating ? 'Finding area…' : 'Use my location'}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>How far do you usually travel?</Text>
          <View style={styles.rangeList}>
            {TRAVEL_RANGES.map((range) => {
              const selected = range.id === form.travelRange;
              return (
                <Pressable key={range.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => selectTravelRange(range)} style={[styles.rangeCard, selected && styles.rangeCardSelected]}>
                  <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                  <View style={styles.flex}><Text style={styles.rangeTitle}>{range.label}</Text><Text style={styles.rangeDetail}>{range.detail}</Text></View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.rangeSummary}>We’ll prioritize places near {form.homeCity || 'your home area'} within your {selectedRange.label.toLowerCase()} range.</Text>

          <View style={styles.pageFooter}>
            <PrimaryButton label="Continue" disabled={!locationReady} loading={saving} onPress={() => void advance(5)} />
          </View>
        </ScrollView>

        <Modal transparent animationType="fade" visible={locationPromptOpen} onRequestClose={() => setLocationPromptOpen(false)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.permissionCard}>
              <View style={styles.permissionIcon}><Ionicons name="navigate" size={28} color={GOLD} /></View>
              <Text style={styles.permissionTitle}>See what is happening near you</Text>
              <Text style={styles.permissionBody}>Location helps Go Melanated show nearby places, adventures, and Campfires. Your exact location is not shown to other members.</Text>
              <PrimaryButton label="Use my location" onPress={() => void requestCurrentLocation()} />
              <Pressable accessibilityRole="button" onPress={() => { setLocationPromptOpen(false); update('locationPermissionStatus', 'manual'); setCityPickerOpen(true); }} style={styles.permissionSecondary}>
                <Text style={styles.permissionSecondaryText}>Use my home area</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal transparent animationType="slide" visible={cityPickerOpen} onRequestClose={() => setCityPickerOpen(false)}>
          <View style={styles.modalBackdrop}>
            <SafeAreaView style={styles.cityModal} edges={['bottom']}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.flex}><Text style={styles.modalTitle}>Choose your home area</Text><Text style={styles.modalCopy}>Pick a state, then search for your city.</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close city picker" hitSlop={10} onPress={() => setCityPickerOpen(false)}><Ionicons name="close" size={24} color={TEXT} /></Pressable>
              </View>

              <Text style={styles.label}>State</Text>
              <TextInput
                value={stateSearch}
                onFocus={() => setStateOpen(true)}
                onChangeText={(value) => {
                  setStateSearch(value);
                  setStateOpen(true);
                  update('homeState', '');
                  update('homeCity', '');
                  setCitySearch('');
                }}
                placeholder="Search state"
                placeholderTextColor="#718079"
                style={styles.input}
              />
              {stateOptions.length ? (
                <View style={styles.suggestionList}>
                  {stateOptions.map((state) => (
                    <Pressable key={state.abbreviation} onPress={() => {
                      setStateSearch(state.name);
                      setStateOpen(false);
                      setCitySearch('');
                      setForm((current) => ({ ...current, homeState: state.abbreviation, homeCity: '', locationPermissionStatus: 'manual' }));
                    }} style={styles.suggestionRow}>
                      <Text style={styles.suggestionText}>{state.name}</Text>
                      <Text style={styles.suggestionMeta}>{state.abbreviation}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Text style={styles.label}>City</Text>
              <TextInput editable={Boolean(form.homeState) && !citiesLoading} value={citySearch} onChangeText={setCitySearch} placeholder={form.homeState ? 'Search city' : 'Choose a state first'} placeholderTextColor="#718079" style={styles.input} />
              <ScrollView style={styles.cityResults} keyboardShouldPersistTaps="handled">
                {citiesLoading ? <ActivityIndicator color={GOLD} style={styles.cityLoader} /> : cityOptions.map((city) => (
                  <Pressable key={city} onPress={() => {
                    setCitySearch(city);
                    setForm((current) => ({ ...current, homeCity: city, locationPermissionStatus: 'manual' }));
                    setCityPickerOpen(false);
                  }} style={styles.cityRow}>
                    <Ionicons name="location-outline" size={18} color={GOLD} />
                    <Text style={styles.cityText}>{city}, {form.homeState}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </ScreenShell>
    );
  }

  return (
    <ImageBackground source={BACKGROUNDS.complete} style={styles.fullScreen}>
      <View style={styles.scrimStrong} />
      <SafeAreaView style={styles.completeStage}>
        <Progress step={5} />
        <View style={styles.completeCopyWrap}>
          <View style={styles.completeCheck}><Ionicons name="checkmark" size={28} color={BG} /></View>
          <Text style={styles.completeTitle}>Your Trail is ready to start.</Text>
          <Text style={styles.completeBody}>Trailhead will open with nearby ideas, upcoming adventures, and a short checklist that teaches the app through real actions.</Text>
          <View style={styles.savedSummary}>
            <View style={styles.summaryRow}><Ionicons name="checkmark-circle" size={19} color={GOLD} /><Text style={styles.summaryText}>{form.interests.length} interests selected</Text></View>
            <View style={styles.summaryRow}><Ionicons name="location" size={19} color={GOLD} /><Text style={styles.summaryText}>{form.homeCity}, {form.homeState}</Text></View>
            <View style={styles.summaryRow}><Ionicons name="compass" size={19} color={GOLD} /><Text style={styles.summaryText}>{selectedRange.label} travel range</Text></View>
          </View>
        </View>
        <View style={styles.completeActions}>
          <PrimaryButton label="Go to Trailhead" loading={saving} onPress={() => void finish()} />
          <Pressable accessibilityRole="button" onPress={() => setStep(4)} style={styles.editButton}><Text style={styles.editButtonText}>Back to edit</Text></Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  scrim: { position: 'absolute', inset: 0, backgroundColor: 'rgba(3, 8, 6, 0.58)' },
  scrimStrong: { position: 'absolute', inset: 0, backgroundColor: 'rgba(3, 8, 6, 0.72)' },
  gold: { color: GOLD },
  eyebrow: { color: GOLD, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { marginTop: 8, color: TEXT, fontSize: 32, lineHeight: 37, fontWeight: '900', letterSpacing: -0.7 },
  body: { marginTop: 10, color: MUTED, fontSize: 15, lineHeight: 22 },
  loadingStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: TEXT, fontSize: 14, fontWeight: '700' },
  welcomeStage: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 22, justifyContent: 'space-between' },
  welcomeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 82, height: 82 },
  exitText: { color: TEXT, fontSize: 13, fontWeight: '800' },
  welcomeCopyWrap: { gap: 10, maxWidth: 560 },
  welcomeTitle: { color: TEXT, fontSize: 42, lineHeight: 47, fontWeight: '900', letterSpacing: -1.4 },
  welcomeBody: { color: '#E0E5E1', fontSize: 17, lineHeight: 25, maxWidth: 520 },
  progressWrap: { flex: 1, maxWidth: 260 },
  progressText: { color: '#CAD3CE', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 },
  progressTrack: { height: 5, borderRadius: 999, backgroundColor: '#3A4941', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: GOLD },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#1E2A24' },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE_2 },
  headerSpacer: { width: 42 },
  page: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 30 },
  pageFooter: { marginTop: 26 },
  primaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: GOLD, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryButtonText: { color: BG, fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.4 },
  photoRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, borderRadius: 18, padding: 14 },
  avatarButton: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#234439', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 78, height: 78, borderRadius: 39 },
  avatarText: { color: TEXT, fontSize: 27, fontWeight: '900' },
  cameraBadge: { position: 'absolute', right: -2, bottom: 1, width: 28, height: 28, borderRadius: 14, backgroundColor: GOLD, borderWidth: 2, borderColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  photoBusy: { position: 'absolute', inset: 0, borderRadius: 39, backgroundColor: 'rgba(7,16,12,0.72)', alignItems: 'center', justifyContent: 'center' },
  photoTitle: { color: TEXT, fontSize: 16, fontWeight: '900' },
  photoCopy: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3 },
  inlineAction: { color: GOLD, fontSize: 13, fontWeight: '900', marginTop: 6 },
  fieldRow: { marginTop: 22, flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  label: { color: '#E7ECE8', fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 7 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, color: TEXT, fontSize: 15, paddingHorizontal: 14 },
  interestGrid: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestCard: { width: '48%', minHeight: 92, flexGrow: 1, flexBasis: 150, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 14, justifyContent: 'space-between', gap: 8 },
  interestCardSelected: { borderColor: GOLD, backgroundColor: GOLD },
  interestText: { color: TEXT, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  interestTextSelected: { color: BG },
  selectionRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  locationCard: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: BORDER, borderRadius: 17, backgroundColor: SURFACE, padding: 15 },
  locationIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1F3E33', alignItems: 'center', justifyContent: 'center' },
  locationLabel: { color: TEXT, fontSize: 16, fontWeight: '900' },
  locationMeta: { color: MUTED, fontSize: 11, lineHeight: 16, marginTop: 3 },
  locationActions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#52675D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  secondaryButtonText: { color: TEXT, fontSize: 12, fontWeight: '900' },
  sectionLabel: { color: TEXT, fontSize: 17, fontWeight: '900', marginTop: 28, marginBottom: 10 },
  rangeList: { gap: 9 },
  rangeCard: { minHeight: 62, borderRadius: 15, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  rangeCardSelected: { borderColor: GOLD, backgroundColor: '#17251D' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#6D7C74', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: GOLD },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD },
  rangeTitle: { color: TEXT, fontSize: 14, fontWeight: '900' },
  rangeDetail: { color: MUTED, fontSize: 11, marginTop: 2 },
  rangeSummary: { color: '#9FB0A7', fontSize: 11, lineHeight: 17, marginTop: 12 },
  modalBackdropCentered: { flex: 1, backgroundColor: 'rgba(1,6,3,0.76)', justifyContent: 'center', padding: 20 },
  permissionCard: { width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#496055', backgroundColor: '#102019', padding: 22 },
  permissionIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#203D33', alignItems: 'center', justifyContent: 'center' },
  permissionTitle: { color: TEXT, fontSize: 25, lineHeight: 30, fontWeight: '900', marginTop: 18 },
  permissionBody: { color: MUTED, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 20 },
  permissionSecondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  permissionSecondaryText: { color: TEXT, fontSize: 14, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(1,6,3,0.68)' },
  cityModal: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#0D1712', paddingHorizontal: 20, paddingTop: 10 },
  modalHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#526159', alignSelf: 'center', marginBottom: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  modalTitle: { color: TEXT, fontSize: 22, fontWeight: '900' },
  modalCopy: { color: MUTED, fontSize: 12, marginTop: 4 },
  suggestionList: { borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: 'hidden', marginTop: 4 },
  suggestionRow: { minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#24332B', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggestionText: { color: TEXT, fontSize: 14, fontWeight: '800' },
  suggestionMeta: { color: GOLD, fontSize: 12, fontWeight: '900' },
  cityResults: { minHeight: 120, maxHeight: 280, marginTop: 8 },
  cityLoader: { marginTop: 30 },
  cityRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#233129' },
  cityText: { color: TEXT, fontSize: 14, fontWeight: '800' },
  completeStage: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 22, justifyContent: 'space-between' },
  completeCopyWrap: { alignItems: 'flex-start' },
  completeCheck: { width: 60, height: 60, borderRadius: 30, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  completeTitle: { color: TEXT, fontSize: 36, lineHeight: 41, fontWeight: '900', marginTop: 20 },
  completeBody: { color: '#D5DDD8', fontSize: 15, lineHeight: 22, marginTop: 11 },
  savedSummary: { width: '100%', borderRadius: 17, borderWidth: 1, borderColor: '#526159', backgroundColor: 'rgba(12,26,20,0.86)', padding: 15, gap: 11, marginTop: 22 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { color: TEXT, fontSize: 13, fontWeight: '800' },
  completeActions: { gap: 4 },
  editButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  editButtonText: { color: TEXT, fontSize: 13, fontWeight: '800' },
});
