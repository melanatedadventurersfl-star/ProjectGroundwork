import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createLocalEvent, getEventHostAccess, getGroupCampfireAccess, uploadLocalEventImage } from '../../src/local-events/api';
import { prepareLocalImage } from '../../src/lib/imageUpload';
import { loadCitiesForState, US_STATES } from '../../src/onboarding/locations';

const categories = ['Camping', 'Hiking', 'Water', 'Culture', 'Wellness', 'Family', 'Gear', 'Other'];

type EventPhoto = {
  uri: string;
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
};

export default function CreateLocalEventScreen() {
  const { groupId, groupName } = useLocalSearchParams<{ groupId?: string; groupName?: string }>();
  const communityScoped = Boolean(groupId);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(groupName?.toLowerCase().includes('camp') ? 'Camping' : 'Hiking');
  const [startsAt, setStartsAt] = useState('');
  const [venueName, setVenueName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [photo, setPhoto] = useState<EventPhoto | null>(null);
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessPromise = groupId
      ? getGroupCampfireAccess(groupId)
      : getEventHostAccess().then((access) => access.canCreate);
    accessPromise.then(setAllowed).catch(() => setAllowed(false));
  }, [groupId]);

  useEffect(() => {
    if (!state) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    setCity('');
    setCitySearch('');
    loadCitiesForState(state)
      .then(setCities)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load cities.'))
      .finally(() => setLoadingCities(false));
  }, [state]);

  const filteredStates = useMemo(() => {
    const term = stateSearch.trim().toLowerCase();
    if (!term) return US_STATES;
    return US_STATES.filter((item) => item.name.toLowerCase().includes(term) || item.abbreviation.toLowerCase().includes(term));
  }, [stateSearch]);

  const filteredCities = useMemo(() => {
    const term = citySearch.trim().toLowerCase();
    if (!term) return cities.slice(0, 12);
    return cities.filter((item) => item.toLowerCase().includes(term)).slice(0, 20);
  }, [cities, citySearch]);

  const parsedStart = startsAt ? new Date(startsAt) : null;
  const validDate = Boolean(parsedStart && !Number.isNaN(parsedStart.getTime()));
  const canSubmit = Boolean(allowed && title.trim() && description.trim() && category && validDate && state && city && !saving);

  async function choosePhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is required to add an event photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      base64: true,
      quality: 0.86,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const asset = result.assets[0];
      const prepared = await prepareLocalImage({ uri: asset.uri, base64: asset.base64 });
      setPhoto({ uri: asset.uri, bytes: new Uint8Array(prepared.bytes), contentType: prepared.contentType, extension: prepared.extension });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to prepare this photo.');
    }
  }

  async function submit() {
    if (!canSubmit || !parsedStart) return;
    setSaving(true);
    setError(null);
    try {
      const imageUrl = photo ? await uploadLocalEventImage(photo) : undefined;
      const id = await createLocalEvent({
        title,
        description,
        category,
        startsAt: parsedStart.toISOString(),
        city,
        state,
        venueName,
        imageUrl,
        groupId: groupId ?? null,
      });
      router.replace({ pathname: '/local-events/[id]', params: { id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this Campfire.');
    } finally {
      setSaving(false);
    }
  }

  if (allowed === null) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.denied}>
          <Text style={styles.eyebrow}>CAMPFIRES</Text>
          <Text style={styles.title}>{communityScoped ? 'Community leaders only' : 'Hosting is invitation-based'}</Text>
          <Text style={styles.body}>
            {communityScoped
              ? `Only Community Leaders and master accounts can create Campfires for ${groupName || 'this Community'}. Members can still view, RSVP, and participate.`
              : 'Trusted Hosts, Community Leads, and staff can start Campfires. Everyone can browse, RSVP, save, and share them.'}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Go back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ {communityScoped ? groupName || 'Community' : 'Outpost'}</Text></Pressable>
        <Text style={styles.eyebrow}>{communityScoped ? 'COMMUNITY CAMPFIRE' : 'MEMBER-LED CAMPFIRE'}</Text>
        <Text style={styles.title}>Start a Campfire</Text>
        <Text style={styles.body}>
          {communityScoped
            ? `Create a lightweight meetup for ${groupName || 'this Community'}. It will appear in the Community’s Campfire tab and the wider Outpost discovery experience.`
            : 'Campfires are lightweight member-led meetups: a hike, park hang, paddle, brewery stop, trail walk, or anything else worth gathering for. Official MA Adventures still use the full ticketing, waiver, payment, and readiness flow.'}
        </Text>

        <Text style={styles.label}>Campfire photo</Text>
        <Pressable onPress={() => void choosePhoto()} style={styles.photoPicker}>
          {photo ? <Image source={{ uri: photo.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : (
            <View style={styles.photoEmpty}>
              <Text style={styles.photoIcon}>＋</Text>
              <Text style={styles.photoTitle}>Add a cover photo</Text>
              <Text style={styles.photoHelp}>Stored in Melanated Adventures media storage</Text>
            </View>
          )}
        </Pressable>
        {photo ? <View style={styles.photoActions}><Pressable onPress={() => void choosePhoto()}><Text style={styles.photoActionText}>Change photo</Text></Pressable><Pressable onPress={() => setPhoto(null)}><Text style={styles.removePhotoText}>Remove</Text></Pressable></View> : null}

        <Text style={styles.label}>Campfire name</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Saturday morning trail walk" placeholderTextColor="#758179" style={styles.input} />

        <Text style={styles.label}>What’s the plan?</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Tell everyone what to expect." placeholderTextColor="#758179" multiline style={[styles.input, styles.multiline]} />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>

        <Text style={styles.label}>Date and time</Text>
        <TextInput value={startsAt} onChangeText={setStartsAt} autoCapitalize="none" placeholder="2026-08-22T09:00" placeholderTextColor="#758179" style={styles.input} />
        <Text style={styles.help}>Use YYYY-MM-DDTHH:MM in your local time.</Text>

        <Text style={styles.label}>Meet here</Text>
        <TextInput value={venueName} onChangeText={setVenueName} placeholder="Park, trailhead, or venue" placeholderTextColor="#758179" style={styles.input} />

        <Text style={styles.label}>State</Text>
        <TextInput value={stateSearch} onChangeText={setStateSearch} placeholder={state ? `Selected: ${state}` : 'Search state'} placeholderTextColor="#758179" style={styles.input} />
        <View style={styles.options}>{filteredStates.slice(0, stateSearch ? 12 : 6).map((item) => <Pressable key={item.abbreviation} onPress={() => { setState(item.abbreviation); setStateSearch(item.name); }} style={[styles.option, state === item.abbreviation && styles.optionActive]}><Text style={styles.optionText}>{item.name} ({item.abbreviation})</Text></Pressable>)}</View>

        {state ? <><Text style={styles.label}>City</Text><TextInput value={citySearch} onChangeText={setCitySearch} placeholder={city ? `Selected: ${city}` : 'Search city'} placeholderTextColor="#758179" style={styles.input} />{loadingCities ? <ActivityIndicator color="#D7B45A" /> : <View style={styles.options}>{filteredCities.map((item) => <Pressable key={item} onPress={() => { setCity(item); setCitySearch(item); }} style={[styles.option, city === item && styles.optionActive]}><Text style={styles.optionText}>{item}</Text></Pressable>)}</View>}</> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={!canSubmit} onPress={() => void submit()} style={[styles.primaryButton, !canSubmit && styles.disabled]}><Text style={styles.primaryButtonText}>{saving ? 'Uploading & starting…' : 'Start Campfire'}</Text></Pressable>
        <Text style={styles.disclaimer}>{communityScoped ? 'This Campfire will be linked to the Community.' : 'Campfires display the host’s name and are clearly marked as member-led, not official Melanated Adventurers experiences.'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 22, paddingBottom: 56, gap: 10 },
  denied: { flex: 1, padding: 24, justifyContent: 'center', gap: 14 },
  back: { color: '#D7B45A', fontWeight: '800', fontSize: 16 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1, fontSize: 11, marginTop: 5 },
  title: { color: '#FFF8E8', fontSize: 32, lineHeight: 36, fontWeight: '900' },
  body: { color: '#C9D1CC', fontSize: 16, lineHeight: 23, marginBottom: 4 },
  label: { color: '#FFF3CE', fontWeight: '900', marginTop: 7 },
  photoPicker: { height: 178, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#35513F', backgroundColor: '#17211C' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  photoIcon: { color: '#D7B45A', fontSize: 30, fontWeight: '400' },
  photoTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 4 },
  photoHelp: { color: '#7F8C84', fontSize: 11, marginTop: 4, textAlign: 'center' },
  photoActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  photoActionText: { color: '#D7B45A', fontWeight: '800', fontSize: 12 },
  removePhotoText: { color: '#FFB4A9', fontWeight: '800', fontSize: 12 },
  input: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2A382F', color: '#FFF8E8', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13 },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
  help: { color: '#7F8C84', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: '#4E5C53', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  chipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  chipText: { color: '#D4DBD6', fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#17211C' },
  options: { gap: 6 },
  option: { backgroundColor: '#151F1A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  optionActive: { borderWidth: 1, borderColor: '#D7B45A' },
  optionText: { color: '#E8EDE9' },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#17211C', fontWeight: '900', fontSize: 15 },
  disabled: { opacity: 0.4 },
  disclaimer: { color: '#7F8C84', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 3 },
  error: { color: '#FFB4A9' },
});