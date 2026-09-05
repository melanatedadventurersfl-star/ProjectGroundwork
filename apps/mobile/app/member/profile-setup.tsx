import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp, saveProfileDetails, uploadProfilePhoto } from '../../src/member/api';
import { getTrailheadProgress, markTrailheadAction } from '../../src/onboarding/trailheadProgress';
import { openTrailheadAction } from '../../src/onboarding/trailheadExperience';
import { AppIcon } from '../../src/ui/AppIcon';
import { searchWeatherLocations, type WeatherLocationSuggestion } from '../../src/weather/api';

type SetupStep = 'photo' | 'name' | 'bio' | 'location' | 'complete';

type ProfileDraft = {
  avatar_url?: string | null;
  display_name?: string | null;
  username?: string | null;
  bio?: string | null;
  home_city?: string | null;
  home_state?: string | null;
};

type Celebration = {
  title: string;
  body: string;
};

const stateCodes: Record<string, string> = {
  Alabama:'AL', Alaska:'AK', Arizona:'AZ', Arkansas:'AR', California:'CA', Colorado:'CO', Connecticut:'CT', Delaware:'DE', Florida:'FL', Georgia:'GA', Hawaii:'HI', Idaho:'ID', Illinois:'IL', Indiana:'IN', Iowa:'IA', Kansas:'KS', Kentucky:'KY', Louisiana:'LA', Maine:'ME', Maryland:'MD', Massachusetts:'MA', Michigan:'MI', Minnesota:'MN', Mississippi:'MS', Missouri:'MO', Montana:'MT', Nebraska:'NE', Nevada:'NV', 'New Hampshire':'NH', 'New Jersey':'NJ', 'New Mexico':'NM', 'New York':'NY', 'North Carolina':'NC', 'North Dakota':'ND', Ohio:'OH', Oklahoma:'OK', Oregon:'OR', Pennsylvania:'PA', 'Rhode Island':'RI', 'South Carolina':'SC', 'South Dakota':'SD', Tennessee:'TN', Texas:'TX', Utah:'UT', Vermont:'VT', Virginia:'VA', Washington:'WA', 'West Virginia':'WV', Wisconsin:'WI', Wyoming:'WY',
};

function firstMissing(profile: ProfileDraft): SetupStep {
  if (!profile.avatar_url) return 'photo';
  if (!profile.display_name?.trim()) return 'name';
  if (!profile.bio?.trim()) return 'bio';
  if (!profile.home_city?.trim() || !profile.home_state?.trim()) return 'location';
  return 'complete';
}

const copy: Record<Exclude<SetupStep, 'complete'>, { eyebrow: string; title: string; body: string }> = {
  photo: {
    eyebrow: 'FIRST, LET PEOPLE RECOGNIZE YOU',
    title: 'Add a profile photo',
    body: 'Choose a photo that feels like you. This is the face people will see around Go Melanated.',
  },
  name: {
    eyebrow: 'HOW SHOULD PEOPLE KNOW YOU?',
    title: 'Add your display name',
    body: 'Use the name you want other members to see when you post, join outings and meet people.',
  },
  bio: {
    eyebrow: 'A LITTLE ABOUT YOU',
    title: 'Tell us what outside looks like for you',
    body: 'A sentence or two is enough. Hiking, camping, beaches, food stops, beginner adventures, whatever feels like you.',
  },
  location: {
    eyebrow: 'WHERE DO YOUR ADVENTURES START?',
    title: 'Set your home location',
    body: 'We use your home area to make nearby places, weather and adventures more relevant.',
  },
};

export default function TrailheadProfileSetupScreen() {
  const [profile, setProfile] = useState<ProfileDraft>({});
  const [step, setStep] = useState<SetupStep>('photo');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [suggestions, setSuggestions] = useState<WeatherLocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocationSuggestion | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getMemberBasecamp().then((base) => {
      if (!active) return;
      const next = (base.profile ?? {}) as ProfileDraft;
      setProfile(next);
      setName(next.display_name ?? '');
      setBio(next.bio ?? '');
      setLocationQuery(next.home_city ?? '');
      setStep(firstMissing(next));
    }).catch(() => {
      if (active) setError('Unable to load your profile right now.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (step !== 'location' || locationQuery.trim().length < 2 || selectedLocation?.name === locationQuery.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchWeatherLocations(locationQuery.trim())
        .then((rows) => {
          if (!active) return;
          setSuggestions(rows.filter((row) => row.country === 'United States').slice(0, 6));
        })
        .catch(() => { if (active) setSuggestions([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [locationQuery, selectedLocation?.name, step]);

  const progressLabel = useMemo(() => {
    const completeCount = [profile.avatar_url, profile.display_name?.trim(), profile.bio?.trim(), profile.home_city?.trim() && profile.home_state?.trim()].filter(Boolean).length;
    return `${completeCount} of 4 profile details ready`;
  }, [profile]);

  function celebrate(title: string, body: string) {
    setCelebration({ title, body });
  }

  function continueFromCelebration() {
    setCelebration(null);
    const next = firstMissing(profile);
    setStep(next);
    if (next === 'complete') finishProfileSetup();
  }

  function finishProfileSetup() {
    markTrailheadAction('profile');
    setStep('complete');
    setCelebration({
      title: 'Your profile is ready.',
      body: 'You’ve finished the first part of Trailhead. Let’s keep going.',
    });
  }

  function continueTrailhead() {
    markTrailheadAction('profile');
    const next = getTrailheadProgress().nextAction;
    if (next && next !== 'profile') {
      openTrailheadAction(next);
      return;
    }
    router.replace('/(tabs)' as never);
  }

  async function choosePhoto() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], base64: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    setBusy(true);
    try {
      const asset = result.assets[0];
      const avatarUrl = await uploadProfilePhoto({ uri: asset.uri, base64: asset.base64 ?? undefined, mimeType: asset.mimeType });
      const next = { ...profile, avatar_url: avatarUrl };
      setProfile(next);
      celebrate('Glad to put a face to the name.', 'Your profile is starting to feel like you.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update your profile photo.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTextStep(kind: 'name' | 'bio') {
    const value = kind === 'name' ? name.trim() : bio.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      const next: ProfileDraft = {
        ...profile,
        display_name: kind === 'name' ? value : profile.display_name,
        bio: kind === 'bio' ? value : profile.bio,
      };
      await saveProfileDetails({
        display_name: next.display_name ?? '',
        username: next.username || null,
        bio: next.bio || null,
        home_city: next.home_city || null,
        home_state: next.home_state || 'FL',
      });
      setProfile(next);
      if (kind === 'name') celebrate('There you are.', 'That’s how people will know you around Go Melanated.');
      else celebrate('Now we know a little more about you.', 'That gives people something real to connect with before you ever meet.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save that profile detail.');
    } finally {
      setBusy(false);
    }
  }

  async function saveLocation() {
    if (!selectedLocation) return;
    const stateCode = stateCodes[selectedLocation.region] ?? profile.home_state ?? 'FL';
    setBusy(true);
    setError('');
    try {
      const next: ProfileDraft = { ...profile, home_city: selectedLocation.name, home_state: stateCode };
      await saveProfileDetails({
        display_name: next.display_name ?? '',
        username: next.username || null,
        bio: next.bio || null,
        home_city: next.home_city || null,
        home_state: next.home_state || stateCode,
      });
      setProfile(next);
      celebrate('Now we know where to start looking.', 'We’ll use your home area to make nearby places and adventures more useful.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your home location.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#E0B84B" /></SafeAreaView>;

  const activeCopy = step === 'complete' ? null : copy[step];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <AppIcon name="chevron-forward" color="#E0B84B" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>Profile</Text>
        </Pressable>
        <Text style={styles.trailheadLabel}>TRAILHEAD</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{progressLabel}</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${([profile.avatar_url, profile.display_name?.trim(), profile.bio?.trim(), profile.home_city?.trim() && profile.home_state?.trim()].filter(Boolean).length / 4) * 100}%` }]} /></View>
        </View>

        {step !== 'complete' && activeCopy ? (
          <View style={styles.guideCard}>
            <Text style={styles.eyebrow}>{activeCopy.eyebrow}</Text>
            <Text style={styles.title}>{activeCopy.title}</Text>
            <Text style={styles.body}>{activeCopy.body}</Text>
          </View>
        ) : null}

        {step === 'photo' ? (
          <View style={styles.focusCard}>
            <View style={styles.photoRow}>
              <Pressable onPress={() => void choosePhoto()} disabled={busy} style={styles.photoButton}>
                {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><AppIcon name="camera" color="#E0B84B" size={28} /></View>}
                <View style={styles.cameraBadge}><AppIcon name="camera" color="#10251E" size={14} /></View>
              </Pressable>
              <View style={styles.fieldCopy}>
                <Text style={styles.fieldTitle}>Profile photo</Text>
                <Text style={styles.fieldBody}>Your main photo across Go Melanated.</Text>
                <Pressable onPress={() => void choosePhoto()} disabled={busy}><Text style={styles.actionText}>{busy ? 'Adding photo…' : 'Choose photo'}</Text></Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {step === 'name' ? (
          <View style={styles.focusCard}>
            <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
            <TextInput value={name} onChangeText={setName} autoFocus placeholder="Your name" placeholderTextColor="#708078" style={styles.input} />
            <Pressable disabled={busy || !name.trim()} onPress={() => void saveTextStep('name')} style={[styles.primary, (busy || !name.trim()) && styles.disabled]}>
              <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save name'}</Text>
              <Text style={styles.primaryArrow}>›</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'bio' ? (
          <View style={styles.focusCard}>
            <Text style={styles.fieldLabel}>ABOUT YOU</Text>
            <TextInput value={bio} onChangeText={setBio} autoFocus multiline maxLength={280} placeholder="Tell the community what kind of outside you love." placeholderTextColor="#708078" style={[styles.input, styles.bio]} />
            <Text style={styles.characterCount}>{bio.length}/280</Text>
            <Pressable disabled={busy || !bio.trim()} onPress={() => void saveTextStep('bio')} style={[styles.primary, (busy || !bio.trim()) && styles.disabled]}>
              <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save description'}</Text>
              <Text style={styles.primaryArrow}>›</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'location' ? (
          <View style={styles.focusCard}>
            <Text style={styles.fieldLabel}>HOME CITY</Text>
            <TextInput
              value={locationQuery}
              onChangeText={(value) => { setLocationQuery(value); setSelectedLocation(null); }}
              onSubmitEditing={() => Keyboard.dismiss()}
              autoFocus
              autoCorrect={false}
              placeholder="Search your city"
              placeholderTextColor="#708078"
              style={styles.input}
            />
            {searching ? <View style={styles.searching}><ActivityIndicator size="small" color="#E0B84B" /><Text style={styles.fieldBody}>Finding cities…</Text></View> : null}
            {suggestions.length ? <View style={styles.suggestions}>{suggestions.map((item) => (
              <Pressable key={`${item.id}-${item.name}`} style={styles.suggestion} onPress={() => { setSelectedLocation(item); setLocationQuery(item.name); setSuggestions([]); Keyboard.dismiss(); }}>
                <View><Text style={styles.suggestionTitle}>{item.name}</Text><Text style={styles.fieldBody}>{item.region}</Text></View>
                <AppIcon name="chevron-forward" color="#E0B84B" size={18} />
              </Pressable>
            ))}</View> : null}
            {selectedLocation ? <Text style={styles.selected}>Selected: {selectedLocation.name}, {selectedLocation.region}</Text> : null}
            <Pressable disabled={busy || !selectedLocation} onPress={() => void saveLocation()} style={[styles.primary, (busy || !selectedLocation) && styles.disabled]}>
              <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save home location'}</Text>
              <Text style={styles.primaryArrow}>›</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {celebration ? (
        <View pointerEvents="box-none" style={styles.celebrationLayer}>
          <View style={styles.celebrationCard}>
            <View style={styles.celebrationIcon}><Text style={styles.celebrationCheck}>✓</Text></View>
            <View style={styles.celebrationCopy}>
              <Text style={styles.celebrationTitle}>{celebration.title}</Text>
              <Text style={styles.celebrationBody}>{celebration.body}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={step === 'complete' ? continueTrailhead : continueFromCelebration}
              style={styles.continueButton}
            >
              <Text style={styles.continueText}>{step === 'complete' ? 'Continue Trailhead' : 'Continue'}</Text>
              <Text style={styles.continueArrow}>›</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  center: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center' },
  topBar: { minHeight: 56, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#24332C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 88, flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: '#E0B84B', fontSize: 13, fontWeight: '900' },
  trailheadLabel: { color: '#E0B84B', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  topSpacer: { width: 88 },
  content: { padding: 18, paddingBottom: 170, gap: 14 },
  progressRow: { gap: 7 },
  progressText: { color: '#AEBDB5', fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 5, borderRadius: 999, backgroundColor: '#29483B', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#E0B84B' },
  guideCard: { paddingVertical: 10, gap: 5 },
  eyebrow: { color: '#E0B84B', fontSize: 9, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: '#FFF8E8', fontSize: 27, lineHeight: 31, fontWeight: '900' },
  body: { color: '#B6C3BC', fontSize: 13, lineHeight: 19, maxWidth: 420 },
  focusCard: { borderRadius: 20, borderWidth: 1, borderColor: '#886F31', backgroundColor: '#11251D', padding: 16, gap: 11, shadowColor: '#D7B45A', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  photoButton: { width: 92, height: 92, borderRadius: 46, position: 'relative' },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarPlaceholder: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: '#4E6257', backgroundColor: '#172B22', alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', right: -1, bottom: 4, width: 29, height: 29, borderRadius: 15, borderWidth: 3, borderColor: '#11251D', backgroundColor: '#E0B84B', alignItems: 'center', justifyContent: 'center' },
  fieldCopy: { flex: 1, gap: 4 },
  fieldTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  fieldBody: { color: '#A8B6AE', fontSize: 12, lineHeight: 17 },
  actionText: { color: '#E0B84B', fontSize: 13, fontWeight: '900', marginTop: 2 },
  fieldLabel: { color: '#E0B84B', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3D5147', backgroundColor: '#0D1813', paddingHorizontal: 13, paddingVertical: 12, color: '#FFF8E8', fontSize: 15 },
  bio: { minHeight: 132, textAlignVertical: 'top' },
  characterCount: { color: '#7F9087', fontSize: 10, textAlign: 'right', marginTop: -5 },
  primary: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 12, backgroundColor: '#E0B84B', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryText: { color: '#10251E', fontSize: 13, fontWeight: '900' },
  primaryArrow: { color: '#10251E', fontSize: 22, lineHeight: 22 },
  disabled: { opacity: 0.45 },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestions: { borderWidth: 1, borderColor: '#34483E', borderRadius: 13, overflow: 'hidden' },
  suggestion: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#293930', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggestionTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  selected: { color: '#E0B84B', fontSize: 12, fontWeight: '800' },
  error: { color: '#FF8A80', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  celebrationLayer: { position: 'absolute', left: 14, right: 14, bottom: 88, zIndex: 50, alignItems: 'center' },
  celebrationCard: { width: '100%', maxWidth: 480, borderRadius: 19, borderWidth: 1, borderColor: '#D7B45A', backgroundColor: '#102D25', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 16 },
  celebrationIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0B84B', alignItems: 'center', justifyContent: 'center' },
  celebrationCheck: { color: '#10251E', fontSize: 20, fontWeight: '900' },
  celebrationCopy: { flex: 1, minWidth: 0 },
  celebrationTitle: { color: '#FFF8E8', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  celebrationBody: { color: '#B8C6BE', fontSize: 11, lineHeight: 16, marginTop: 2 },
  continueButton: { minHeight: 38, borderRadius: 11, backgroundColor: '#E0B84B', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  continueText: { color: '#10251E', fontSize: 11, fontWeight: '900' },
  continueArrow: { color: '#10251E', fontSize: 19, lineHeight: 19 },
});
