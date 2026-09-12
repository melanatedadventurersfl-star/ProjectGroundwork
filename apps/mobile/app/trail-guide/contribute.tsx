import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTrailGuidePlace } from '../../src/trailGuide/catalog';
import { submitTrailGuideReview, uploadTrailGuidePhoto } from '../../src/trailGuide/community';
import { loadTrailGuideReviewForEdit, updateTrailGuideReview } from '../../src/trailGuide/memberContributions';

type Photo = { uri: string; base64?: string | null };
type Mode = 'review' | 'photos';
type CampingType = 'tent' | 'rv' | 'cabin' | 'day_visit' | 'other';

const PHOTO_CATEGORIES = [
  ['campsite', 'Campsite'],
  ['beach', 'Beach'],
  ['landscape', 'Landscape'],
  ['trail', 'Trail'],
  ['rv_site', 'RV Site'],
  ['tent_site', 'Tent Site'],
  ['facilities', 'Facilities'],
  ['activities', 'Activities'],
  ['wildlife', 'Wildlife'],
  ['bathroom', 'Bathroom'],
  ['other', 'Other'],
] as const;

const CAMPING_TYPES: [CampingType, string][] = [
  ['tent', 'Tent'],
  ['rv', 'RV'],
  ['cabin', 'Cabin'],
  ['day_visit', 'Day Visit'],
  ['other', 'Other'],
];

const REVIEW_CATEGORIES = [
  ['cleanliness', 'Cleanliness'],
  ['campsites', 'Campsites'],
  ['bathrooms', 'Bathrooms'],
  ['location', 'Location'],
  ['family_friendly', 'Family Friendly'],
] as const;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Please try again.';
}

function formatUsDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseUsDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) throw new Error('Enter the visit date as MM/DD/YYYY.');
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw new Error('Enter a valid visit date as MM/DD/YYYY.');
  }
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function usDateFromIso(value: string | null) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : '';
}

function Stars({ value, onChange, size = 28 }: { value: number; onChange: (value: number) => void; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} hitSlop={5}>
          <Text style={[styles.star, { fontSize: size }, star <= value && styles.starActive]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TrailGuideContributeScreen() {
  const params = useLocalSearchParams<{ placeId?: string; mode?: string; reviewId?: string }>();
  const mode: Mode = params.mode === 'photos' ? 'photos' : 'review';
  const place = getTrailGuidePlace(params.placeId);
  const reviewId = mode === 'review' ? params.reviewId : undefined;
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [campingType, setCampingType] = useState<CampingType>('tent');
  const [campsiteLabel, setCampsiteLabel] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [photoCategory, setPhotoCategory] = useState<(typeof PHOTO_CATEGORIES)[number][0]>('campsite');
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!reviewId || mode !== 'review') return () => { active = false; };
    setLoadingExisting(true);
    setSubmitError(null);
    void loadTrailGuideReviewForEdit(reviewId)
      .then((review) => {
        if (!active) return;
        if (!review) throw new Error('Your review could not be found.');
        if (place && review.placeId !== place.id) throw new Error('This review belongs to another destination.');
        setRating(review.rating);
        setReviewText(review.reviewText);
        setCampingType(review.campingType);
        setCampsiteLabel(review.campsiteLabel);
        setVisitDate(usDateFromIso(review.visitDate));
        setCategoryRatings(review.categoryRatings);
      })
      .catch((error) => { if (active) setSubmitError(errorMessage(error)); })
      .finally(() => { if (active) setLoadingExisting(false); });
    return () => { active = false; };
  }, [mode, place, reviewId]);

  const editingReview = Boolean(reviewId && mode === 'review');
  const title = mode === 'review' ? editingReview ? 'Edit Your Review' : 'Review This Place' : 'Add Camper Photos';
  const canSubmit = useMemo(() => Boolean(place) && !saving && !loadingExisting && (mode === 'review' ? rating > 0 : photos.length > 0), [loadingExisting, mode, photos.length, place, rating, saving]);

  async function pickPhotos() {
    setSubmitError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to add Trail Guide photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 8 - photos.length),
      quality: 0.88,
      exif: false,
      base64: true,
    });
    if (result.canceled) return;
    const selected = result.assets
      .filter((asset) => asset.uri)
      .map((asset) => ({ uri: asset.uri, base64: asset.base64 }));
    setPhotos((current) => [...current, ...selected].slice(0, 8));
  }

  async function submit() {
    if (!place || !canSubmit) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const dateValue = parseUsDate(visitDate);
      let savedReviewId: string | null = reviewId ?? null;
      if (mode === 'review') {
        if (reviewId) {
          savedReviewId = await updateTrailGuideReview({
            reviewId,
            rating,
            reviewText,
            campingType,
            campsiteLabel,
            visitDate: dateValue,
            categoryRatings,
          });
        } else {
          savedReviewId = await submitTrailGuideReview({
            placeId: place.id,
            rating,
            reviewText,
            campingType,
            campsiteLabel,
            visitDate: dateValue,
            categoryRatings,
          });
        }
      }

      if (photos.length) {
        const submissionId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
        for (const photo of photos) {
          await uploadTrailGuidePhoto({
            placeId: place.id,
            localUri: photo.uri,
            base64: photo.base64,
            category: photoCategory,
            campsiteLabel,
            caption,
            visitDate: dateValue,
            reviewId: savedReviewId,
            submissionId,
          });
        }
      }

      router.replace({
        pathname: '/trail-guide/[id]',
        params: { id: place.id, notice: editingReview ? 'review-updated' : mode === 'review' ? 'review-posted' : 'photos-submitted' },
      } as never);
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!place) {
    return <SafeAreaView style={styles.safe}><View style={styles.missing}><Text style={styles.title}>Place unavailable</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Go back</Text></Pressable></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
          <Text style={styles.topTitle}>TRAIL GUIDE</Text>
          <View style={styles.spacer} />
        </View>

        <View>
          <Text style={styles.eyebrow}>{place.name}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{mode === 'review' ? editingReview ? 'Update your rating and visit details. Your existing review will be replaced with these changes.' : 'Help the next camper know what the place feels like in real life.' : 'Show future campers the sites, facilities, trails, water, and conditions they will find.'}</Text>
        </View>

        {mode === 'review' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Your Overall Rating</Text>
              <Stars value={rating} onChange={setRating} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>How Did You Visit?</Text>
              <View style={styles.pills}>{CAMPING_TYPES.map(([value, label]) => <Pressable key={value} onPress={() => setCampingType(value)} style={[styles.pill, campingType === value && styles.pillSelected]}><Text style={[styles.pillText, campingType === value && styles.pillTextSelected]}>{label}</Text></Pressable>)}</View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Your Review</Text>
              <TextInput value={reviewText} onChangeText={setReviewText} maxLength={2000} multiline placeholder="What should another camper know?" placeholderTextColor="#718078" style={[styles.input, styles.textArea]} />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Optional Quick Ratings</Text>
              {REVIEW_CATEGORIES.map(([key, label]) => (
                <View key={key} style={styles.ratingLine}>
                  <Text style={styles.ratingLabel}>{label}</Text>
                  <Stars value={categoryRatings[key] ?? 0} onChange={(value) => setCategoryRatings((current) => ({ ...current, [key]: value }))} size={20} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.twoColumn}>
          <View style={styles.fieldGroupHalf}>
            <Text style={styles.label}>Campsite</Text>
            <TextInput value={campsiteLabel} onChangeText={setCampsiteLabel} maxLength={80} placeholder="Site 18" placeholderTextColor="#718078" style={styles.input} />
          </View>
          <View style={styles.fieldGroupHalf}>
            <Text style={styles.label}>Visit Date</Text>
            <TextInput value={visitDate} onChangeText={(value) => setVisitDate(formatUsDateInput(value))} placeholder="MM/DD/YYYY" placeholderTextColor="#718078" style={styles.input} keyboardType="numbers-and-punctuation" maxLength={10} />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.inlineHeader}>
            <Text style={styles.label}>{mode === 'review' ? 'Add Photos' : 'Photos'}</Text>
            <Text style={styles.optional}>{photos.length}/8</Text>
          </View>
          {photos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.photoWrap}><Image source={{ uri: photo.uri }} style={styles.preview} /><Pressable onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} style={styles.removePhoto}><Text style={styles.removePhotoText}>×</Text></Pressable></View>)}</ScrollView> : null}
          <Pressable onPress={() => void pickPhotos()} style={styles.photoButton}><Text style={styles.photoButtonIcon}>＋</Text><View style={styles.photoButtonCopy}><Text style={styles.photoButtonTitle}>Choose Photos</Text><Text style={styles.photoButtonBody}>Select up to 8 from your library</Text></View><Text style={styles.chevron}>›</Text></Pressable>
        </View>

        {photos.length ? (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>What Do These Show?</Text>
              <View style={styles.pills}>{PHOTO_CATEGORIES.map(([value, label]) => <Pressable key={value} onPress={() => setPhotoCategory(value)} style={[styles.pill, photoCategory === value && styles.pillSelected]}><Text style={[styles.pillText, photoCategory === value && styles.pillTextSelected]}>{label}</Text></Pressable>)}</View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Photo Caption <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput value={caption} onChangeText={setCaption} maxLength={500} placeholder="What are we looking at?" placeholderTextColor="#718078" style={styles.input} />
            </View>
          </>
        ) : null}

        {submitError ? <View style={styles.errorBox}><Text style={styles.errorText}>{submitError}</Text></View> : null}
        <Pressable disabled={!canSubmit} onPress={() => void submit()} style={[styles.submit, !canSubmit && styles.disabled]}><Text style={styles.submitText}>{saving ? 'Saving…' : editingReview ? 'Save Review' : mode === 'review' ? 'Post Review' : 'Submit Photos'}</Text></Pressable>
        {photos.length ? <Text style={styles.moderationNote}>Camper photos appear publicly after moderation. Your pending uploads stay visible to you while they are reviewed. Location metadata is not requested by the app picker.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 18, paddingBottom: 54, gap: 18 },
  topBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, color: '#FFF8E8', fontSize: 38, lineHeight: 40 },
  topTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  spacer: { width: 42 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 32, fontWeight: '900', marginTop: 5 },
  body: { color: '#96A199', fontSize: 13, lineHeight: 19, marginTop: 6 },
  card: { backgroundColor: '#111A15', borderWidth: 1, borderColor: '#27352D', borderRadius: 16, padding: 14, gap: 10 },
  label: { color: '#F5F0E4', fontSize: 14, fontWeight: '900' },
  optional: { color: '#758179', fontSize: 11, fontWeight: '700' },
  starRow: { flexDirection: 'row', gap: 4 },
  star: { color: '#455048', lineHeight: 31 },
  starActive: { color: '#E1B94F' },
  fieldGroup: { gap: 9 },
  twoColumn: { flexDirection: 'row', gap: 10 },
  fieldGroupHalf: { flex: 1, gap: 8 },
  input: { minHeight: 46, backgroundColor: '#111A15', borderWidth: 1, borderColor: '#2B3A31', borderRadius: 13, paddingHorizontal: 12, color: '#FFF8E8', fontSize: 14 },
  textArea: { minHeight: 116, paddingTop: 12, textAlignVertical: 'top' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#111A15', paddingHorizontal: 11, paddingVertical: 8 },
  pillSelected: { borderColor: '#CFAF57', backgroundColor: '#283127' },
  pillText: { color: '#A6B0AA', fontSize: 11, fontWeight: '800' },
  pillTextSelected: { color: '#F0CC65' },
  ratingLine: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#223028', paddingTop: 8 },
  ratingLabel: { color: '#B7C0BA', fontSize: 12, fontWeight: '800' },
  inlineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  photoRow: { gap: 8, paddingRight: 8 },
  photoWrap: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: '#172019' },
  preview: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', right: 5, top: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(5,10,7,0.8)', alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: '#FFF', fontSize: 20, lineHeight: 22 },
  photoButton: { minHeight: 72, borderRadius: 15, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#111A15', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoButtonIcon: { width: 38, height: 38, borderRadius: 12, textAlign: 'center', textAlignVertical: 'center', paddingTop: 5, backgroundColor: '#D7B45A', color: '#142019', fontSize: 24, fontWeight: '700' },
  photoButtonCopy: { flex: 1 },
  photoButtonTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  photoButtonBody: { color: '#829087', fontSize: 11, marginTop: 2 },
  chevron: { color: '#D7B45A', fontSize: 28 },
  errorBox: { borderRadius: 12, borderWidth: 1, borderColor: '#75483F', backgroundColor: '#281B17', paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { color: '#E6B5AA', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  submit: { backgroundColor: '#D7B45A', borderRadius: 15, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#17211C', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  moderationNote: { color: '#748178', fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  link: { color: '#D7B45A', fontWeight: '900' },
});