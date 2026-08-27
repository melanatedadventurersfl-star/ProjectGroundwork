import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTrailGuidePlace, trailGuidePlaces, type TrailGuideCityKey, type TrailGuidePlace } from '../../src/trailGuide/catalog';
import { resolveGoogleTrailGuidePlaceDetails, type GoogleTrailGuidePlaceDetails } from '../../src/trailGuide/googlePlacePhotos';
import { useTrailGuidePlacePhoto, type TrailGuidePhoto } from '../../src/trailGuide/placePhotos';
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

function photoSourceLabel(photo?: TrailGuidePhoto | null) {
  if (!photo) return null;
  if (/google/i.test(photo.credit ?? '') || /google\.com|maps\.google/i.test(photo.sourceUrl)) return 'Google Maps';
  if (/wikimedia|wikipedia/i.test(`${photo.credit ?? ''} ${photo.sourceUrl}`)) return 'Wikimedia';
  return 'Source';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const place = getTrailGuidePlace(id);
  const fallbackPhoto = useTrailGuidePlacePhoto(place);
  const [googleDetails, setGoogleDetails] = useState<GoogleTrailGuidePlaceDetails | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  useEffect(() => {
    let active = true;
    setGoogleDetails(null);
    setActivePhotoIndex(0);
    setShowMoreInfo(false);
    if (!place) return () => { active = false; };
    void resolveGoogleTrailGuidePlaceDetails(place).then((details) => { if (active) setGoogleDetails(details); });
    return () => { active = false; };
  }, [place]);

  const gallery = useMemo(() => {
    const googlePhotos = googleDetails?.photos ?? [];
    if (googlePhotos.length > 0) return googlePhotos;
    return fallbackPhoto ? [fallbackPhoto] : [];
  }, [fallbackPhoto, googleDetails]);

  const nearby = useMemo(() => {
    if (!place) return [];
    return trailGuidePlaces
      .filter((candidate) => candidate.city === place.city && candidate.id !== place.id)
      .sort((a, b) => Number(b.category === place.category) - Number(a.category === place.category))
      .slice(0, 3);
  }, [place]);

  if (!place) {
    return <SafeAreaView style={styles.safe}><View style={styles.missing}><Text style={styles.title}>Place unavailable</Text><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Back to Trail Guide</Text></Pressable></View></SafeAreaView>;
  }

  const currentPlace = place;
  const currentPhoto = gallery[activePhotoIndex] ?? gallery[0] ?? null;
  const mapsUrl = googleDetails?.mapsUrl ?? currentPhoto?.sourceUrl ?? null;
  const openState = googleDetails?.openNow == null ? null : googleDetails.openNow ? 'Open now' : 'Closed now';
  const ratingLabel = googleDetails?.rating != null ? `${googleDetails.rating.toFixed(1)}★${googleDetails.userRatingCount ? ` (${googleDetails.userRatingCount.toLocaleString()})` : ''}` : null;
  const practicalDetails = currentPlace.details.slice(0, 3);

  const planOuting = () => router.push({ pathname: '/local-events/create', params: { source: 'trail-guide', trailGuidePlaceId: currentPlace.id, title: currentPlace.name, description: `Planning an outing to ${currentPlace.name}. ${currentPlace.summary}`, category: outingCategory(currentPlace.category), venueName: currentPlace.name, state: 'FL', city: trailGuideCity(currentPlace.city) } });
  const openDirections = async () => { const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentPlace.name}, ${currentPlace.area}, Florida`)}`; await Linking.openURL(mapsUrl || fallback); };
  const openWebsite = async () => { if (googleDetails?.websiteUrl) await Linking.openURL(googleDetails.websiteUrl); };
  const sharePlace = async () => { await Share.share({ message: `${currentPlace.name} · ${currentPlace.area}\n${mapsUrl || ''}`.trim(), title: currentPlace.name }); };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {gallery.length > 0 ? (
            <ScrollView horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setActivePhotoIndex(Math.round(event.nativeEvent.contentOffset.x / width))}>
              {gallery.map((photo, index) => <Image key={`${photo.url}-${index}`} source={{ uri: photo.url }} style={{ width, height: 320 }} resizeMode="cover" />)}
            </ScrollView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}><AppIcon name="photo" color="#65726B" size={38} /><Text style={styles.photoLoading}>Loading destination photos…</Text></View>
          )}

          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} /><Text style={styles.backLabel}>Trail Guide</Text></Pressable>
          {gallery.length > 1 ? <View style={styles.photoCounter}><Text style={styles.photoCounterText}>{activePhotoIndex + 1} / {gallery.length}</Text></View> : null}

          <View pointerEvents="none" style={styles.heroCopy}>
            <Text style={styles.type}>{currentPlace.category.toUpperCase()} · {currentPlace.type.toUpperCase()}</Text>
            <Text numberOfLines={2} style={styles.title}>{currentPlace.name}</Text>
            <View style={styles.heroMetaRow}>
              <Text style={styles.area}>{currentPlace.area}</Text>
              {openState ? <View style={[styles.openPill, openState === 'Open now' && styles.openPillActive]}><Text style={[styles.openPillText, openState === 'Open now' && styles.openPillTextActive]}>{openState}</Text></View> : null}
            </View>
            <View style={styles.heroDecisionRow}>
              {ratingLabel ? <Text style={styles.heroDecisionText}>{ratingLabel}</Text> : null}
              <Text style={styles.heroDecisionText}>{currentPlace.category}</Text>
              <Text style={styles.heroDecisionText}>Trail Guide pick</Text>
            </View>
            {gallery.length > 1 ? <View style={styles.photoDots}>{gallery.slice(0, 8).map((_, index) => <View key={index} style={[styles.photoDot, index === activePhotoIndex && styles.photoDotActive]} />)}</View> : null}
          </View>
        </View>

        <View style={styles.body}>
          {currentPhoto ? <Text style={styles.photoCredit} numberOfLines={1}>{photoSourceLabel(currentPhoto) ? `${photoSourceLabel(currentPhoto)} · ` : ''}{currentPhoto.credit ?? 'Destination photo'}</Text> : null}

          <View style={styles.actionBar}>
            <Pressable onPress={() => void openDirections()} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><AppIcon name="location" color="#181D18" size={18} /><Text style={styles.primaryActionText}>Directions</Text></Pressable>
            {googleDetails?.websiteUrl ? <Pressable onPress={() => void openWebsite()} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><AppIcon name="connections" color="#E6C463" size={18} /><Text style={styles.iconActionText}>Website</Text></Pressable> : null}
            <Pressable onPress={() => void sharePlace()} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><AppIcon name="share" color="#E6C463" size={18} /><Text style={styles.iconActionText}>Share</Text></Pressable>
          </View>

          <View style={styles.whyBlock}>
            <Text style={styles.sectionEyebrow}>WHY GO</Text>
            <Text numberOfLines={3} style={styles.summary}>{currentPlace.summary}</Text>
            <View style={styles.tags}>{currentPlace.tags.slice(0, 5).map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>
          </View>

          <View style={styles.knowSection}>
            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Know before you go</Text><Text style={styles.sectionHint}>Only what matters</Text></View>
            <View style={styles.knowGrid}>{practicalDetails.map((detail, index) => <View key={detail} style={styles.knowRow}><View style={styles.knowIcon}><Text style={styles.knowIconText}>{index === 0 ? '🥾' : index === 1 ? '🌦️' : '🎒'}</Text></View><Text style={styles.knowText}>{detail}</Text></View>)}</View>

            {googleDetails?.formattedAddress || googleDetails?.weekdayDescriptions?.length ? (
              <Pressable onPress={() => setShowMoreInfo((current) => !current)} style={({ pressed }) => [styles.moreInfoButton, pressed && styles.pressed]}>
                <Text style={styles.moreInfoText}>{showMoreInfo ? 'Hide place details' : 'More place details'}</Text>
                <AppIcon name={showMoreInfo ? 'chevron-up' : 'chevron-forward'} color="#D7B45A" size={17} />
              </Pressable>
            ) : null}

            {showMoreInfo ? <View style={styles.infoPanel}>{googleDetails?.formattedAddress ? <View style={styles.infoLine}><AppIcon name="location" color="#79D26A" size={16} /><Text style={styles.infoLineText}>{googleDetails.formattedAddress}</Text></View> : null}{googleDetails?.weekdayDescriptions?.[0] ? <View style={styles.infoLine}><AppIcon name="time" color="#79D26A" size={16} /><Text style={styles.infoLineText}>{googleDetails.weekdayDescriptions[0]}</Text></View> : null}<Text style={styles.infoSource}>Live place info from Google Places</Text></View> : null}
          </View>

          <Pressable onPress={planOuting} style={({ pressed }) => [styles.planButton, pressed && styles.pressed]}><AppIcon name="calendar" color="#17211C" size={20} /><Text style={styles.planButtonText}>Plan an outing here</Text><AppIcon name="chevron-forward" color="#17211C" size={18} /></Pressable>

          {nearby.length > 0 ? <View style={styles.nearbySection}><View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Keep exploring nearby</Text><Text style={styles.sectionHint}>More in {trailGuideCity(currentPlace.city)}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>{nearby.map((candidate) => <NearbyCard key={candidate.id} place={candidate} />)}</ScrollView></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  hero: { height: 320, justifyContent: 'flex-end', backgroundColor: '#111914', overflow: 'hidden' },
  back: { position: 'absolute', top: 14, left: 15, minHeight: 40, paddingHorizontal: 11, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(8,14,10,0.66)', zIndex: 4 },
  backLabel: { color: '#FFFDF6', fontWeight: '800', fontSize: 12 },
  photoCounter: { position: 'absolute', top: 16, right: 16, borderRadius: 999, backgroundColor: 'rgba(8,14,10,0.66)', paddingHorizontal: 9, paddingVertical: 5, zIndex: 4 },
  photoCounterText: { color: '#FFFDF6', fontSize: 10, fontWeight: '900' },
  heroCopy: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: 14, paddingTop: 54, backgroundColor: 'rgba(5,10,7,0.18)' },
  type: { color: '#E0BE62', fontSize: 9, fontWeight: '900', letterSpacing: 1.05, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  title: { color: '#FFF9E9', fontSize: 28, lineHeight: 32, fontWeight: '900', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 7, textShadowOffset: { width: 0, height: 2 } },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  area: { color: '#F0F4F1', fontSize: 12, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5 },
  openPill: { borderRadius: 999, borderWidth: 1, borderColor: '#6A4A3D', backgroundColor: 'rgba(37,20,16,0.72)', paddingHorizontal: 8, paddingVertical: 3 },
  openPillActive: { borderColor: '#2E7A38', backgroundColor: 'rgba(12,53,20,0.75)' },
  openPillText: { color: '#D9B6AB', fontSize: 9, fontWeight: '900' },
  openPillTextActive: { color: '#91E282' },
  heroDecisionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  heroDecisionText: { color: '#F5F7F5', fontSize: 9, fontWeight: '800', backgroundColor: 'rgba(8,14,10,0.64)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  photoDots: { flexDirection: 'row', gap: 5, marginTop: 8 },
  photoDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.46)' },
  photoDotActive: { width: 16, backgroundColor: '#E4C363' },
  body: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 54 },
  photoCredit: { color: '#707C75', fontSize: 8, lineHeight: 12, marginBottom: 9 },
  actionBar: { flexDirection: 'row', gap: 8 },
  primaryAction: { flex: 1.35, minHeight: 46, borderRadius: 13, backgroundColor: '#E1BE61', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryActionText: { color: '#181D18', fontSize: 11, fontWeight: '900' },
  iconAction: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#364039', backgroundColor: '#141B17', alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconActionText: { color: '#E7EDE9', fontSize: 8, fontWeight: '900' },
  whyBlock: { marginTop: 20 },
  sectionEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.35, marginBottom: 6 },
  summary: { color: '#D5DDD7', fontSize: 15, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  tag: { borderRadius: 999, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', paddingHorizontal: 9, paddingVertical: 5 },
  tagText: { color: '#C3CCC6', fontSize: 9, fontWeight: '800' },
  knowSection: { marginTop: 22 },
  sectionHeaderRow: { marginBottom: 9 },
  sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  sectionHint: { color: '#78847D', fontSize: 9, marginTop: 2 },
  knowGrid: { gap: 7 },
  knowRow: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: '#26312B', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  knowIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#18221D', alignItems: 'center', justifyContent: 'center' },
  knowIconText: { fontSize: 14 },
  knowText: { flex: 1, color: '#C7D0CA', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  moreInfoButton: { minHeight: 44, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2E3932', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  moreInfoText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  infoPanel: { marginTop: 7, borderRadius: 12, backgroundColor: '#101713', padding: 12, gap: 8 },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoLineText: { flex: 1, color: '#C6D0C9', fontSize: 10, lineHeight: 15 },
  infoSource: { color: '#68746D', fontSize: 8, marginTop: 2 },
  planButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#E0BE62', marginTop: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planButtonText: { flex: 1, color: '#17211C', fontSize: 13, fontWeight: '900' },
  nearbySection: { marginTop: 24 },
  nearbyRow: { gap: 9, paddingRight: 8 },
  nearbyCard: { width: 168, height: 126, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#29352E', backgroundColor: '#111914' },
  nearbyImage: { ...StyleSheet.absoluteFillObject },
  nearbyImageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#151D18' },
  nearbyShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.28)' },
  nearbyCopy: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: 'rgba(5,10,7,0.58)' },
  nearbyName: { color: '#FFF8E8', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  nearbyMeta: { color: '#AFC7B6', fontSize: 8, marginTop: 4, fontWeight: '800' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoLoading: { color: '#7E8982', fontSize: 11, fontWeight: '700' },
  missing: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  backButton: { marginTop: 18, borderRadius: 12, borderWidth: 1, borderColor: '#6D5A28', paddingHorizontal: 15, paddingVertical: 11 },
  backText: { color: '#D7B45A', fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
