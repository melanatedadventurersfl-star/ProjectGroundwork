import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTrailGuidePlace, trailGuidePlaces, type TrailGuideCityKey } from '../../src/trailGuide/catalog';
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

export default function TrailGuidePlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const place = getTrailGuidePlace(id);
  const fallbackPhoto = useTrailGuidePlacePhoto(place);
  const [googleDetails, setGoogleDetails] = useState<GoogleTrailGuidePlaceDetails | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setGoogleDetails(null);
    setActivePhotoIndex(0);
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

  const planOuting = () => router.push({ pathname: '/local-events/create', params: { source: 'trail-guide', trailGuidePlaceId: currentPlace.id, title: currentPlace.name, description: `Planning an outing to ${currentPlace.name}. ${currentPlace.summary}`, category: outingCategory(currentPlace.category), venueName: currentPlace.name, state: 'FL', city: trailGuideCity(currentPlace.city) } });
  const openDirections = async () => { const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentPlace.name}, ${currentPlace.area}, Florida`)}`; await Linking.openURL(mapsUrl || fallback); };
  const openWebsite = async () => { if (googleDetails?.websiteUrl) await Linking.openURL(googleDetails.websiteUrl); };
  const sharePlace = async () => { await Share.share({ message: `${currentPlace.name} · ${currentPlace.area}\n${mapsUrl || ''}`.trim(), title: currentPlace.name }); };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {gallery.length > 0 ? <ScrollView horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setActivePhotoIndex(Math.round(event.nativeEvent.contentOffset.x / width))}>{gallery.map((photo, index) => <Image key={`${photo.url}-${index}`} source={{ uri: photo.url }} style={{ width, height: 390 }} resizeMode="cover" />)}</ScrollView> : <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}><AppIcon name="photo" color="#65726B" size={38} /><Text style={styles.photoLoading}>Loading destination photos…</Text></View>}
          <View pointerEvents="none" style={styles.heroShade} />
          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} /><Text style={styles.backLabel}>Trail Guide</Text></Pressable>
          {gallery.length > 1 ? <View style={styles.photoCounter}><Text style={styles.photoCounterText}>{activePhotoIndex + 1} / {gallery.length}</Text></View> : null}
          <View pointerEvents="none" style={styles.heroCopy}><Text style={styles.type}>{currentPlace.category.toUpperCase()} · {currentPlace.type.toUpperCase()}</Text><Text style={styles.title}>{currentPlace.name}</Text><Text style={styles.area}>{currentPlace.area}</Text>{gallery.length > 1 ? <View style={styles.photoDots}>{gallery.slice(0, 8).map((_, index) => <View key={index} style={[styles.photoDot, index === activePhotoIndex && styles.photoDotActive]} />)}</View> : null}</View>
        </View>

        <View style={styles.body}>
          {currentPhoto ? <Text style={styles.photoCredit} numberOfLines={2}>{photoSourceLabel(currentPhoto) ? `${photoSourceLabel(currentPhoto)} · ` : ''}{currentPhoto.credit ?? 'Destination photo'}</Text> : null}
          <View style={styles.liveStrip}><View style={styles.liveItem}><Text style={styles.liveValue}>{ratingLabel ?? 'Local'}</Text><Text style={styles.liveLabel}>{ratingLabel ? 'Google rating' : 'Trail Guide pick'}</Text></View><View style={styles.liveDivider} /><View style={styles.liveItem}><Text style={[styles.liveValue, openState === 'Open now' && styles.liveOpen]}>{openState ?? 'Check ahead'}</Text><Text style={styles.liveLabel}>Live hours</Text></View><View style={styles.liveDivider} /><View style={styles.liveItem}><Text style={styles.liveValue}>{currentPlace.category}</Text><Text style={styles.liveLabel}>Best fit</Text></View></View>
          <View style={styles.actionRow}><Pressable onPress={() => void openDirections()} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><AppIcon name="location" color="#F0C75E" size={18} /><Text style={styles.actionText}>Directions</Text></Pressable>{googleDetails?.websiteUrl ? <Pressable onPress={() => void openWebsite()} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><AppIcon name="connections" color="#F0C75E" size={18} /><Text style={styles.actionText}>Website</Text></Pressable> : null}<Pressable onPress={() => void sharePlace()} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><AppIcon name="share" color="#F0C75E" size={18} /><Text style={styles.actionText}>Share</Text></Pressable></View>
          <Text style={styles.sectionEyebrow}>WHY GO</Text><Text style={styles.summary}>{currentPlace.summary}</Text>
          <Text style={styles.sectionEyebrow}>BEST FOR</Text><View style={styles.tags}>{currentPlace.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>
          <Pressable onPress={planOuting} style={({ pressed }) => [styles.planOuting, pressed && styles.pressed]}><View style={styles.planOutingIcon}><AppIcon name="calendar" color="#17211C" size={20} /></View><View style={styles.planOutingCopy}><Text style={styles.planOutingTitle}>Plan an outing</Text><Text style={styles.planOutingText}>Start with this destination already filled in.</Text></View><AppIcon name="chevron-forward" color="#E9CE7C" size={19} /></Pressable>
          <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Good to know</Text><Text style={styles.sectionHint}>Before you go</Text></View>
          <View style={styles.knowGrid}>{currentPlace.details.map((detail, index) => <View key={detail} style={styles.knowCard}><View style={styles.knowIcon}><Text style={styles.knowIconText}>{index === 0 ? '🥾' : index === 1 ? '🌦️' : '🎒'}</Text></View><Text style={styles.knowText}>{detail}</Text></View>)}</View>
          {googleDetails?.formattedAddress ? <View style={styles.infoCard}><Text style={styles.infoLabel}>LIVE PLACE INFO</Text><Text style={styles.infoAddress}>{googleDetails.formattedAddress}</Text>{googleDetails.weekdayDescriptions[0] ? <Text style={styles.infoHours}>{googleDetails.weekdayDescriptions[0]}</Text> : null}<Text style={styles.infoSource}>Powered by Google Places</Text></View> : null}
          {nearby.length > 0 ? <View style={styles.nearbySection}><Text style={styles.sectionTitle}>Keep exploring</Text><Text style={styles.sectionHint}>More Trail Guide picks in {trailGuideCity(currentPlace.city)}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>{nearby.map((candidate) => <Pressable key={candidate.id} onPress={() => router.push(`/trail-guide/${candidate.id}` as never)} style={({ pressed }) => [styles.nearbyCard, pressed && styles.pressed]}><Text numberOfLines={2} style={styles.nearbyName}>{candidate.name}</Text><Text style={styles.nearbyMeta}>{candidate.category} · {candidate.area}</Text><View style={styles.nearbyArrow}><AppIcon name="chevron-forward" color="#D7B45A" size={16} /></View></Pressable>)}</ScrollView></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, hero: { height: 390, justifyContent: 'flex-end', backgroundColor: '#111914', overflow: 'hidden' }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,7,0.24)' }, back: { position: 'absolute', top: 14, left: 15, minHeight: 42, paddingHorizontal: 11, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(8,14,10,0.68)', zIndex: 4 }, backLabel: { color: '#FFFDF6', fontWeight: '800', fontSize: 12 }, photoCounter: { position: 'absolute', top: 16, right: 16, borderRadius: 999, backgroundColor: 'rgba(8,14,10,0.68)', paddingHorizontal: 10, paddingVertical: 6, zIndex: 4 }, photoCounterText: { color: '#FFFDF6', fontSize: 10, fontWeight: '900' }, heroCopy: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22, paddingBottom: 24, paddingTop: 70, backgroundColor: 'rgba(5,10,7,0.34)' }, type: { color: '#E0BE62', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF9E9', fontSize: 32, lineHeight: 37, fontWeight: '900', marginTop: 5 }, area: { color: '#D9DFDB', fontSize: 13, fontWeight: '700', marginTop: 5 }, photoDots: { flexDirection: 'row', gap: 5, marginTop: 12 }, photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.42)' }, photoDotActive: { width: 18, backgroundColor: '#E4C363' }, body: { padding: 18, paddingBottom: 56 }, photoCredit: { color: '#748078', fontSize: 9, lineHeight: 13, marginBottom: 12 }, liveStrip: { borderRadius: 16, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#111914', paddingVertical: 13, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'stretch' }, liveItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, liveDivider: { width: 1, backgroundColor: '#2A352F' }, liveValue: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', textAlign: 'center' }, liveOpen: { color: '#79D26A' }, liveLabel: { color: '#78847D', fontSize: 8, fontWeight: '800', marginTop: 3, textAlign: 'center' }, actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 }, actionButton: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#3A403A', backgroundColor: '#151B17', alignItems: 'center', justifyContent: 'center', gap: 4 }, actionText: { color: '#E7EDE9', fontSize: 9, fontWeight: '900' }, sectionEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 24, marginBottom: 8 }, summary: { color: '#D5DDD7', fontSize: 16, lineHeight: 24 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, tag: { borderRadius: 14, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', paddingHorizontal: 10, paddingVertical: 6 }, tagText: { color: '#C3CCC6', fontSize: 10, fontWeight: '800' }, planOuting: { marginTop: 24, borderRadius: 17, borderWidth: 1, borderColor: '#A2863B', backgroundColor: '#2B2413', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, planOutingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E0BE62', alignItems: 'center', justifyContent: 'center' }, planOutingCopy: { flex: 1 }, planOutingTitle: { color: '#FFF5D7', fontSize: 15, fontWeight: '900' }, planOutingText: { color: '#C9B98A', fontSize: 10, lineHeight: 15, marginTop: 2 }, sectionHeaderRow: { marginTop: 28, marginBottom: 11 }, sectionTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, sectionHint: { color: '#78847D', fontSize: 10, marginTop: 3 }, knowGrid: { gap: 8 }, knowCard: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#111914', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }, knowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#1A241E', alignItems: 'center', justifyContent: 'center' }, knowIconText: { fontSize: 16 }, knowText: { flex: 1, color: '#C5CEC8', fontSize: 12, lineHeight: 18, fontWeight: '700' }, infoCard: { marginTop: 24, borderRadius: 16, borderWidth: 1, borderColor: '#2D3831', backgroundColor: '#101713', padding: 15 }, infoLabel: { color: '#79D26A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, infoAddress: { color: '#F1F4F2', fontSize: 13, lineHeight: 19, fontWeight: '800', marginTop: 8 }, infoHours: { color: '#A4AFA8', fontSize: 11, lineHeight: 16, marginTop: 5 }, infoSource: { color: '#68746D', fontSize: 8, marginTop: 10 }, nearbySection: { marginTop: 28 }, nearbyRow: { gap: 9, paddingTop: 11, paddingRight: 8 }, nearbyCard: { width: 178, minHeight: 112, borderRadius: 15, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#111914', padding: 13 }, nearbyName: { color: '#FFF8E8', fontSize: 14, lineHeight: 18, fontWeight: '900', paddingRight: 20 }, nearbyMeta: { color: '#79D26A', fontSize: 9, lineHeight: 13, fontWeight: '800', marginTop: 7 }, nearbyArrow: { position: 'absolute', right: 9, bottom: 9 }, photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 }, photoLoading: { color: '#7E8982', fontSize: 11, fontWeight: '700' }, missing: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }, backButton: { marginTop: 18, borderRadius: 12, borderWidth: 1, borderColor: '#6D5A28', paddingHorizontal: 15, paddingVertical: 11 }, backText: { color: '#D7B45A', fontWeight: '900' }, pressed: { opacity: 0.78 },
});
