import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { markTrailheadAction } from '../../src/onboarding/trailheadProgress';
import { getTrailGuidePlace, trailGuidePlaces, type TrailGuideCityKey, type TrailGuidePlace } from '../../src/trailGuide/catalog';
import { TrailGuideCommunitySection } from '../../src/trailGuide/TrailGuideCommunitySection';
import { resolveGoogleTrailGuidePlaceDetails, type GoogleTrailGuidePlaceDetails } from '../../src/trailGuide/googlePlacePhotos';
import { useTrailGuideHeroCandidates, type TrailGuideHeroPhoto } from '../../src/trailGuide/heroSelection';
import { useTrailGuidePlacePhoto } from '../../src/trailGuide/placePhotos';
import { isTrailGuidePlaceSaved, setTrailGuidePlaceSaved } from '../../src/trailGuide/savedPlaces';
import { TrailGuidePlaceMoreDetails, TrailGuidePlacePracticalDetails } from '../../src/trailGuide/TrailGuidePlacePracticalDetails';
import { AppIcon } from '../../src/ui/AppIcon';

function outingCategory(category: string) {
  if (category === 'Hiking' || category === 'Water' || category === 'Camping') return category;
  return 'Hangout';
}

function trailGuideCity(city: TrailGuideCityKey) {
  const cityLabels: Record<TrailGuideCityKey, string> = {
    jacksonville: 'Jacksonville', orlando: 'Orlando', miami: 'Miami', tampa: 'Tampa',
    'st-petersburg': 'St. Petersburg', 'fort-lauderdale': 'Fort Lauderdale',
    'west-palm-beach': 'West Palm Beach', naples: 'Naples', 'fort-myers': 'Fort Myers', sarasota: 'Sarasota',
  };
  return cityLabels[city];
}

function emotionalSummary(place: TrailGuidePlace) {
  if (place.id === 'huguenot-memorial-park') {
    return 'Beach camping with electric sites, water access, fishing, boating, and Atlantic beach access.';
  }
  return place.summary;
}

function heroCreditLabel(photo: TrailGuideHeroPhoto) {
  if (photo.representative) return 'Representative image';
  const credit = photo.credit?.trim();
  if (!credit || credit === photo.sourceLabel) return photo.sourceLabel;
  return `${photo.sourceLabel} · ${credit}`;
}

function NearbyCard({ place }: { place: TrailGuidePlace }) {
  const photo = useTrailGuidePlacePhoto(place);
  return (
    <Pressable onPress={() => router.push(`/trail-guide/${place.id}` as never)} style={({ pressed }) => [styles.nearbyCard, pressed && styles.pressed]}>
      {photo ? <Image source={{ uri: photo.url }} style={styles.nearbyImage} resizeMode="cover" /> : <View style={[styles.nearbyImage, styles.nearbyImageFallback]}><AppIcon name="photo" color="#66736B" size={22} /></View>}
      <View style={styles.nearbyShade} />
      <View style={styles.nearbyCopy}>
        <Text numberOfLines={2} style={styles.nearbyName}>{place.name}</Text>
        <Text numberOfLines={1} style={styles.nearbyMeta}>{place.category} · {place.area}</Text>
      </View>
    </Pressable>
  );
}

export default function TrailGuidePlaceDetailScreen() {
  const { id, notice } = useLocalSearchParams<{ id: string; notice?: string }>();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const place = getTrailGuidePlace(id);
  const heroCandidates = useTrailGuideHeroCandidates(place);
  const [googleDetails, setGoogleDetails] = useState<GoogleTrailGuidePlaceDetails | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setGoogleDetails(null);
    setActivePhotoIndex(0);
    setFailedPhotoUrls([]);
    if (!place) return () => { active = false; };
    void resolveGoogleTrailGuidePlaceDetails(place).then((details) => { if (active) setGoogleDetails(details); });
    return () => { active = false; };
  }, [place]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !place) {
      setSaved(false);
      return;
    }
    setSaved(isTrailGuidePlaceSaved(userId, place.id));
  }, [place, session?.user.id]);

  const gallery = useMemo(
    () => heroCandidates.filter((photo) => !failedPhotoUrls.includes(photo.url)),
    [failedPhotoUrls, heroCandidates],
  );

  useEffect(() => {
    if (activePhotoIndex >= gallery.length) setActivePhotoIndex(0);
  }, [activePhotoIndex, gallery.length]);

  const nearby = useMemo(() => {
    if (!place) return [];
    return trailGuidePlaces
      .filter((candidate) => candidate.city === place.city && candidate.id !== place.id)
      .sort((a, b) => Number(b.category === place.category) - Number(a.category === place.category))
      .slice(0, 4);
  }, [place]);

  if (!place) {
    return <SafeAreaView style={styles.safe}><View style={styles.missing}><Text style={styles.title}>Place unavailable</Text><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Back to Trail Guide</Text></Pressable></View></SafeAreaView>;
  }

  const currentPlace = place;
  const currentPhoto = gallery[activePhotoIndex] ?? gallery[0] ?? null;
  const mapsUrl = googleDetails?.mapsUrl ?? currentPhoto?.sourceUrl ?? null;
  const openState = googleDetails?.openNow == null ? null : googleDetails.openNow ? 'Open now' : 'Closed now';
  const ratingLabel = googleDetails?.rating != null ? `${googleDetails.rating.toFixed(1)} ★${googleDetails.userRatingCount ? ` · ${googleDetails.userRatingCount.toLocaleString()} reviews` : ''}` : null;
  const noticeText = notice === 'review-updated'
    ? 'Your review was updated.'
    : notice === 'review-posted'
      ? 'Your review is live.'
      : notice === 'photos-submitted'
        ? 'Photos submitted for review.'
        : null;

  const planOuting = () => router.push({ pathname: '/local-events/create', params: { source: 'trail-guide', trailGuidePlaceId: currentPlace.id, title: currentPlace.name, description: `Planning an outing to ${currentPlace.name}. ${currentPlace.summary}`, category: outingCategory(currentPlace.category), venueName: currentPlace.name, state: 'FL', city: trailGuideCity(currentPlace.city) } });
  const openDirections = async () => { const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentPlace.name}, ${currentPlace.area}, Florida`)}`; await Linking.openURL(mapsUrl || fallback); };
  const sharePlace = async () => { await Share.share({ message: `${currentPlace.name} · ${currentPlace.area}\n${mapsUrl || ''}`.trim(), title: currentPlace.name }); };
  const toggleSaved = () => {
    const userId = session?.user.id;
    if (!userId) {
      router.push('/(auth)/sign-in' as never);
      return;
    }
    const next = !saved;
    setTrailGuidePlaceSaved(userId, currentPlace.id, next);
    setSaved(next);
    if (next) markTrailheadAction('save-place');
  };

  const markPhotoFailed = (photoUrl: string) => {
    setFailedPhotoUrls((current) => current.includes(photoUrl) ? current : [...current, photoUrl]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {gallery.length > 0 ? (
            <ScrollView horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setActivePhotoIndex(Math.round(event.nativeEvent.contentOffset.x / width))}>
              {gallery.map((photo, index) => <Image key={`${photo.url}-${index}`} source={{ uri: photo.url }} style={{ width, height: 205 }} resizeMode="cover" onError={() => markPhotoFailed(photo.url)} />)}
            </ScrollView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}><AppIcon name="photo" color="#65726B" size={38} /><Text style={styles.photoLoading}>Destination image unavailable</Text></View>
          )}
          <View pointerEvents="none" style={styles.heroShade} />
          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.roundHeroButton, styles.backHeroButton, pressed && styles.pressed]}><AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} /></Pressable>
          <Pressable hitSlop={10} onPress={() => void sharePlace()} style={({ pressed }) => [styles.roundHeroButton, styles.shareHeroButton, pressed && styles.pressed]}><AppIcon name="share" color="#FFFDF6" size={18} /></Pressable>
          {gallery.length > 1 ? <View style={styles.photoCounter}><Text style={styles.photoCounterText}>{activePhotoIndex + 1}/{gallery.length}</Text></View> : null}
        </View>

        <View style={styles.body}>
          {currentPhoto ? <Text style={[styles.photoCredit, currentPhoto.representative && styles.representativeCredit]} numberOfLines={1}>{heroCreditLabel(currentPhoto)}</Text> : null}
          {noticeText ? <View style={styles.notice}><AppIcon name="check" color="#8ED380" size={14} /><Text style={styles.noticeText}>{noticeText}</Text></View> : null}

          <View style={styles.identityRow}>
            <View style={styles.identityCopy}>
              <Text style={styles.type}>{currentPlace.category.toUpperCase()} · {currentPlace.type.toUpperCase()}</Text>
              <Text style={styles.title}>{currentPlace.name}</Text>
              <View style={styles.metaLine}>
                <Text style={styles.area}>{currentPlace.area}</Text>
                {ratingLabel ? <Text style={styles.rating}>{ratingLabel}</Text> : null}
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={saved ? `Remove ${currentPlace.name} from saved places` : `Save ${currentPlace.name}`} accessibilityState={{ selected: saved }} onPress={toggleSaved} style={({ pressed }) => [styles.saveCircle, saved && styles.saveCircleActive, pressed && styles.pressed]}><AppIcon name="bookmark" color={saved ? '#17211C' : '#E6C463'} size={18} /></Pressable>
          </View>

          {openState ? <Text style={[styles.openState, openState === 'Open now' && styles.openStateActive]}>{openState}</Text> : null}
          <Text numberOfLines={2} style={styles.summary}>{emotionalSummary(currentPlace)}</Text>

          <View style={styles.utilityRow}>
            <Pressable onPress={() => void openDirections()} style={({ pressed }) => [styles.utilityButton, pressed && styles.pressed]}><AppIcon name="location" color="#D7B45A" size={15} /><Text style={styles.utilityText}>Directions</Text></Pressable>
            <Pressable onPress={toggleSaved} style={({ pressed }) => [styles.utilityButton, pressed && styles.pressed]}><AppIcon name="bookmark" color="#D7B45A" size={15} /><Text style={styles.utilityText}>{saved ? 'Saved' : 'Save'}</Text></Pressable>
          </View>

          <TrailGuidePlacePracticalDetails
            placeId={currentPlace.id}
            category={currentPlace.category}
            fallbackDetails={currentPlace.details}
            formattedAddress={googleDetails?.formattedAddress}
            weekdayDescription={googleDetails?.weekdayDescriptions?.[0]}
          />

          <TrailGuideCommunitySection placeId={currentPlace.id} />

          <TrailGuidePlaceMoreDetails
            placeId={currentPlace.id}
            formattedAddress={googleDetails?.formattedAddress}
            weekdayDescription={googleDetails?.weekdayDescriptions?.[0]}
          />

          <Pressable onPress={planOuting} style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}>
            <View style={styles.planIcon}><AppIcon name="calendar" color="#D7B45A" size={18} /></View>
            <View style={styles.planCopy}><Text style={styles.planTitle}>Going with a group?</Text><Text style={styles.planBody}>Turn this destination into a Go Melanated outing.</Text></View>
            <Text style={styles.planAction}>Plan outing</Text>
          </Pressable>

          {nearby.length > 0 ? (
            <View style={styles.nearbySection}>
              <View style={styles.sectionHeaderRow}><View><Text style={styles.sectionTitle}>Nearby destinations</Text><Text style={styles.sectionHint}>Make a weekend of it</Text></View><Text style={styles.cityHint}>{trailGuideCity(currentPlace.city)}</Text></View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>{nearby.map((candidate) => <NearbyCard key={candidate.id} place={candidate} />)}</ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  hero: { height: 205, backgroundColor: '#111914', overflow: 'hidden' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,5,0.09)' },
  roundHeroButton: { position: 'absolute', top: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(7,12,9,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  backHeroButton: { left: 14 },
  shareHeroButton: { right: 14 },
  photoCounter: { position: 'absolute', right: 14, bottom: 12, borderRadius: 999, backgroundColor: 'rgba(7,12,9,0.72)', paddingHorizontal: 9, paddingVertical: 5 },
  photoCounterText: { color: '#FFFDF6', fontSize: 9, fontWeight: '900' },
  body: { paddingHorizontal: 15, paddingBottom: 36 },
  photoCredit: { color: '#617068', fontSize: 8, marginTop: 5, marginBottom: 5 },
  representativeCredit: { color: '#A88948', fontWeight: '800' },
  notice: { minHeight: 34, borderRadius: 11, borderWidth: 1, borderColor: '#31583A', backgroundColor: '#132516', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, marginBottom: 7 },
  noticeText: { color: '#BDE1B7', fontSize: 9.5, fontWeight: '800' },
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  identityCopy: { flex: 1 },
  type: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: '#FFF8E8', fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 4 },
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 5 },
  area: { color: '#B7C1BB', fontSize: 11, fontWeight: '800' },
  rating: { color: '#DCC163', fontSize: 10, fontWeight: '900' },
  saveCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#5F5129', backgroundColor: '#121A15', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveCircleActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  openState: { alignSelf: 'flex-start', color: '#D2A49A', backgroundColor: '#241915', borderWidth: 1, borderColor: '#5D3C33', borderRadius: 999, fontSize: 8.5, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, marginTop: 7 },
  openStateActive: { color: '#8ED380', backgroundColor: '#132516', borderColor: '#31583A' },
  summary: { color: '#C5CEC8', fontSize: 12, lineHeight: 17, marginTop: 8 },
  utilityRow: { flexDirection: 'row', gap: 7, marginTop: 9 },
  utilityButton: { minHeight: 36, borderRadius: 11, borderWidth: 1, borderColor: '#2D3B33', backgroundColor: '#111A15', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  utilityText: { color: '#E2E7E4', fontSize: 9.5, fontWeight: '900' },
  planCard: { marginTop: 10, minHeight: 62, borderRadius: 14, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#121C16', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11 },
  planIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#1D2B22', alignItems: 'center', justifyContent: 'center' },
  planCopy: { flex: 1 },
  planTitle: { color: '#F3EEE3', fontSize: 11, fontWeight: '900' },
  planBody: { color: '#7F8C84', fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  planAction: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  nearbySection: { marginTop: 15 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 9 },
  sectionTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  sectionHint: { color: '#78847D', fontSize: 9, marginTop: 2 },
  cityHint: { color: '#D7B45A', fontSize: 9, fontWeight: '800' },
  nearbyRow: { gap: 9, paddingRight: 8 },
  nearbyCard: { width: 160, height: 118, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#29352E', backgroundColor: '#111914' },
  nearbyImage: { ...StyleSheet.absoluteFillObject },
  nearbyImageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#151D18' },
  nearbyShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.25)' },
  nearbyCopy: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 9, backgroundColor: 'rgba(5,10,7,0.64)' },
  nearbyName: { color: '#FFF8E8', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  nearbyMeta: { color: '#AFC7B6', fontSize: 8, marginTop: 3, fontWeight: '800' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoLoading: { color: '#7E8982', fontSize: 11, fontWeight: '700' },
  missing: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  backButton: { marginTop: 18, borderRadius: 12, borderWidth: 1, borderColor: '#6D5A28', paddingHorizontal: 15, paddingVertical: 11 },
  backText: { color: '#D7B45A', fontWeight: '900' },
  pressed: { opacity: 0.78 },
});