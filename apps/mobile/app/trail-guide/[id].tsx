import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { markTrailheadAction } from '../../src/onboarding/trailheadProgress';
import { getTrailGuidePlace, trailGuidePlaces, type TrailGuideCityKey, type TrailGuidePlace } from '../../src/trailGuide/catalog';
import { loadTrailGuideCommunity } from '../../src/trailGuide/community';
import { TrailGuideCommunitySection } from '../../src/trailGuide/TrailGuideCommunitySection';
import { resolveGoogleTrailGuidePlaceDetails, type GoogleTrailGuidePlaceDetails } from '../../src/trailGuide/googlePlacePhotos';
import { useTrailGuideHeroCandidates, useTrailGuidePrimaryPhoto, type TrailGuideHeroPhoto } from '../../src/trailGuide/heroSelection';
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
  if (photo.representative) return 'Representative Image';
  const credit = photo.credit?.trim();
  if (!credit || credit === photo.sourceLabel) return photo.sourceLabel;
  return `${photo.sourceLabel} · ${credit}`;
}

function NearbyCard({ place }: { place: TrailGuidePlace }) {
  const photo = useTrailGuidePrimaryPhoto(place);
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
  const [gmSummary, setGmSummary] = useState<{ averageRating: number | null; reviewCount: number } | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [transientNotice, setTransientNotice] = useState<string | null>(null);

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
    let active = true;
    setGmSummary(null);
    if (!place) return () => { active = false; };
    void loadTrailGuideCommunity(place.id)
      .then((data) => { if (active) setGmSummary({ averageRating: data.averageRating, reviewCount: data.reviewCount }); })
      .catch(() => { if (active) setGmSummary({ averageRating: null, reviewCount: 0 }); });
    return () => { active = false; };
  }, [notice, place]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !place) {
      setSaved(false);
      return;
    }
    setSaved(isTrailGuidePlaceSaved(userId, place.id));
  }, [place, session?.user.id]);

  useEffect(() => {
    const next = notice === 'review-updated'
      ? 'Your review was updated.'
      : notice === 'review-posted'
        ? 'Your review is live.'
        : notice === 'photos-submitted'
          ? 'Photos submitted for review.'
          : null;
    if (!next) return;
    setTransientNotice(next);
    const timer = setTimeout(() => {
      setTransientNotice(null);
      router.setParams({ notice: '' } as never);
    }, 3600);
    return () => clearTimeout(timer);
  }, [notice]);

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
  const googleReviewsUrl = googleDetails?.placeId ? `https://search.google.com/local/reviews?placeid=${encodeURIComponent(googleDetails.placeId)}` : mapsUrl;
  const openState = googleDetails?.openNow == null ? null : googleDetails.openNow ? 'Open now' : 'Closed now';
  const googleRatingLabel = googleDetails?.rating != null
    ? `${googleDetails.rating.toFixed(1)} ★${googleDetails.userRatingCount ? ` · ${googleDetails.userRatingCount.toLocaleString()} Google Reviews` : ' · Google Reviews'}`
    : 'Google Reviews';
  const gmRatingLabel = gmSummary?.reviewCount
    ? `${gmSummary.averageRating?.toFixed(1) ?? '—'} ★ · ${gmSummary.reviewCount} Go Melanated ${gmSummary.reviewCount === 1 ? 'Review' : 'Reviews'}`
    : 'No Go Melanated Reviews Yet';

  const planOuting = () => router.push({ pathname: '/local-events/create', params: { source: 'trail-guide', trailGuidePlaceId: currentPlace.id, title: currentPlace.name, description: `Planning an outing to ${currentPlace.name}. ${currentPlace.summary}`, category: outingCategory(currentPlace.category), venueName: currentPlace.name, state: 'FL', city: trailGuideCity(currentPlace.city) } });
  const openDirections = async () => {
    const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentPlace.name}, ${currentPlace.area}, Florida`)}`;
    await Linking.openURL(mapsUrl || fallback);
  };
  const openGoogleReviews = async () => { if (googleReviewsUrl) await Linking.openURL(googleReviewsUrl); };
  const openGmReviews = () => router.push(`/trail-guide/${currentPlace.id}/reviews` as never);
  const sharePlace = async () => { await Share.share({ message: `${currentPlace.name} · ${currentPlace.area}\n${mapsUrl || ''}`.trim(), title: currentPlace.name }); };

  const showLocalNotice = (message: string, duration = 2600) => {
    setTransientNotice(message);
    setTimeout(() => setTransientNotice((current) => current === message ? null : current), duration);
  };

  const toggleSaved = () => {
    const userId = session?.user.id;
    if (!userId) {
      router.push('/(auth)/sign-in' as never);
      return;
    }
    const next = !saved;
    setTrailGuidePlaceSaved(userId, currentPlace.id, next);
    setSaved(next);
    showLocalNotice(next ? 'Saved to Trail Guide.' : 'Removed from saved places.');
    if (next) markTrailheadAction('save-place');
  };

  const openReview = () => {
    setActionsOpen(false);
    router.push({ pathname: '/trail-guide/contribute', params: { placeId: currentPlace.id, mode: 'review' } } as never);
  };

  const openPhotos = () => {
    setActionsOpen(false);
    router.push({ pathname: '/trail-guide/contribute', params: { placeId: currentPlace.id, mode: 'photos' } } as never);
  };

  const openPlanOuting = () => {
    setActionsOpen(false);
    planOuting();
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
            <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}><AppIcon name="photo" color="#65726B" size={38} /><Text style={styles.photoLoading}>Finding destination photos…</Text></View>
          )}
          <View pointerEvents="none" style={styles.heroShade} />
          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.roundHeroButton, styles.backHeroButton, pressed && styles.pressed]}><AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={saved ? `Remove ${currentPlace.name} from saved places` : `Save ${currentPlace.name}`} accessibilityState={{ selected: saved }} hitSlop={10} onPress={toggleSaved} style={({ pressed }) => [styles.roundHeroButton, styles.saveHeroButton, saved && styles.saveHeroButtonActive, pressed && styles.pressed]}><AppIcon name="bookmark" color={saved ? '#17211C' : '#FFFDF6'} size={18} /></Pressable>
          <Pressable hitSlop={10} onPress={() => void sharePlace()} style={({ pressed }) => [styles.roundHeroButton, styles.shareHeroButton, pressed && styles.pressed]}><AppIcon name="share" color="#FFFDF6" size={18} /></Pressable>
          {gallery.length > 1 ? <View style={styles.photoCounter}><Text style={styles.photoCounterText}>{activePhotoIndex + 1}/{gallery.length}</Text></View> : null}
        </View>

        <View style={styles.body}>
          {currentPhoto ? <Text style={[styles.photoCredit, currentPhoto.representative && styles.representativeCredit]} numberOfLines={1}>{heroCreditLabel(currentPhoto)}</Text> : null}

          <View style={styles.identityCopy}>
            <Text style={styles.type}>{currentPlace.category.toUpperCase()} · {currentPlace.type.toUpperCase()}</Text>
            <Text style={styles.title}>{currentPlace.name}</Text>
            <Text style={styles.area}>{currentPlace.area}</Text>
            <Pressable disabled={!googleReviewsUrl} onPress={() => void openGoogleReviews()} style={({ pressed }) => [styles.externalRatingRow, pressed && styles.pressed]}>
              <Text style={styles.googleRating}>{googleRatingLabel}</Text><Text style={styles.ratingChevron}>›</Text>
            </Pressable>
            <Pressable onPress={openGmReviews} style={({ pressed }) => [styles.gmRatingRow, pressed && styles.pressed]}>
              <View style={styles.gmRatingCopy}><AppIcon name="group" color="#E1B94F" size={14} /><Text style={styles.gmRating}>{gmRatingLabel}</Text></View><Text style={styles.ratingChevron}>›</Text>
            </Pressable>
          </View>

          <View style={styles.placeStatusRow}>
            <Pressable onPress={() => void openDirections()} style={({ pressed }) => [styles.directionsInline, pressed && styles.pressed]}><AppIcon name="location" color="#D7B45A" size={14} /><Text style={styles.directionsInlineText}>Directions</Text></Pressable>
            {openState ? <Text style={[styles.openState, openState === 'Open now' && styles.openStateActive]}>{openState}</Text> : null}
          </View>
          <Text numberOfLines={2} style={styles.summary}>{emotionalSummary(currentPlace)}</Text>

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

          {nearby.length > 0 ? (
            <View style={styles.nearbySection}>
              <View style={styles.sectionHeaderRow}><View><Text style={styles.sectionTitle}>Nearby Destinations</Text><Text style={styles.sectionHint}>Make a weekend of it</Text></View><Text style={styles.cityHint}>{trailGuideCity(currentPlace.city)}</Text></View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>{nearby.map((candidate) => <NearbyCard key={candidate.id} place={candidate} />)}</ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {transientNotice ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${transientNotice} Dismiss`} onPress={() => setTransientNotice(null)} style={({ pressed }) => [styles.toast, pressed && styles.pressed]}>
          <AppIcon name="check" color="#8ED380" size={16} />
          <Text style={styles.toastText}>{transientNotice}</Text>
          <AppIcon name="close" color="#8CA096" size={15} />
        </Pressable>
      ) : null}

      <View pointerEvents="box-none" style={styles.fabWrap}>
        {actionsOpen ? (
          <View style={styles.fabMenu}>
            <Pressable onPress={openReview} style={({ pressed }) => [styles.fabAction, pressed && styles.pressed]}><Text style={styles.fabActionText}>Add Review</Text><View style={styles.fabActionIcon}><AppIcon name="edit" color="#E1B94F" size={17} /></View></Pressable>
            <Pressable onPress={openPhotos} style={({ pressed }) => [styles.fabAction, pressed && styles.pressed]}><Text style={styles.fabActionText}>Add Photos</Text><View style={styles.fabActionIcon}><AppIcon name="camera" color="#E1B94F" size={17} /></View></Pressable>
            <Pressable onPress={openPlanOuting} style={({ pressed }) => [styles.fabAction, pressed && styles.pressed]}><Text style={styles.fabActionText}>Plan Outing</Text><View style={styles.fabActionIcon}><AppIcon name="calendar" color="#E1B94F" size={17} /></View></Pressable>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={actionsOpen ? 'Close destination actions' : 'Open destination actions'} accessibilityState={{ expanded: actionsOpen }} onPress={() => setActionsOpen((open) => !open)} style={({ pressed }) => [styles.fab, actionsOpen && styles.fabOpen, pressed && styles.pressed]}>
          <AppIcon name={actionsOpen ? 'close' : 'add'} color="#17211C" size={24} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  hero: { height: 205, backgroundColor: '#111914', overflow: 'hidden' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,5,0.09)' },
  roundHeroButton: { position: 'absolute', top: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(7,12,9,0.78)', alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  backHeroButton: { left: 14 },
  saveHeroButton: { right: 62 },
  saveHeroButtonActive: { backgroundColor: '#D7B45A' },
  shareHeroButton: { right: 14 },
  photoCounter: { position: 'absolute', right: 14, bottom: 12, borderRadius: 999, backgroundColor: 'rgba(7,12,9,0.78)', paddingHorizontal: 9, paddingVertical: 5 },
  photoCounterText: { color: '#FFFDF6', fontSize: 9, fontWeight: '900' },
  body: { paddingHorizontal: 15, paddingBottom: 92 },
  photoCredit: { color: '#617068', fontSize: 8, marginTop: 5, marginBottom: 5 },
  representativeCredit: { color: '#A88948', fontWeight: '800' },
  toast: { position: 'absolute', top: 216, left: 15, right: 15, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: '#31583A', backgroundColor: '#132516', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, zIndex: 40, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 12 },
  toastText: { flex: 1, color: '#BDE1B7', fontSize: 10.5, fontWeight: '900' },
  identityCopy: { flex: 1 },
  type: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: '#FFF8E8', fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 4 },
  area: { color: '#B7C1BB', fontSize: 11, fontWeight: '800', marginTop: 5 },
  externalRatingRow: { alignSelf: 'flex-start', minHeight: 28, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  googleRating: { color: '#C5AA59', fontSize: 10, fontWeight: '800' },
  gmRatingRow: { alignSelf: 'stretch', minHeight: 38, marginTop: 3, borderRadius: 10, borderWidth: 1, borderColor: '#514722', backgroundColor: '#171D12', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gmRatingCopy: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  gmRating: { color: '#F0D16F', fontSize: 10.5, fontWeight: '900' },
  ratingChevron: { color: '#D7B45A', fontSize: 17, lineHeight: 18 },
  placeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  directionsInline: { minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: '#34433A', backgroundColor: '#111A15', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  directionsInlineText: { color: '#E2E7E4', fontSize: 8.5, fontWeight: '900' },
  openState: { alignSelf: 'center', color: '#D2A49A', backgroundColor: '#241915', borderWidth: 1, borderColor: '#5D3C33', borderRadius: 999, fontSize: 8.5, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 5 },
  openStateActive: { color: '#8ED380', backgroundColor: '#132516', borderColor: '#31583A' },
  summary: { color: '#C5CEC8', fontSize: 12, lineHeight: 17, marginTop: 8 },
  fabWrap: { position: 'absolute', right: 16, bottom: 24, alignItems: 'flex-end', zIndex: 30 },
  fabMenu: { alignItems: 'flex-end', gap: 7, marginBottom: 9 },
  fabAction: { minHeight: 46, minWidth: 148, borderRadius: 23, borderWidth: 1, borderColor: '#6B5A2B', backgroundColor: '#08100C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 15, paddingRight: 6, shadowColor: '#000', shadowOpacity: 0.42, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 10 },
  fabActionText: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' },
  fabActionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1D2A22', borderWidth: 1, borderColor: '#35463B', alignItems: 'center', justifyContent: 'center' },
  fab: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0D47D', shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 12 },
  fabOpen: { backgroundColor: '#E4C66A' },
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
