import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTrailGuidePlace, type TrailGuideCityKey } from '../../src/trailGuide/catalog';
import { resolveGoogleTrailGuidePlaceGallery } from '../../src/trailGuide/googlePlacePhotos';
import { useTrailGuidePlacePhoto, type TrailGuidePhoto } from '../../src/trailGuide/placePhotos';
import { AppIcon } from '../../src/ui/AppIcon';

function outingCategory(category: string) {
  if (category === 'Hiking' || category === 'Water' || category === 'Camping') return category;
  return 'Hangout';
}

function trailGuideCity(city: TrailGuideCityKey) {
  const cityLabels: Record<TrailGuideCityKey, string> = {
    jacksonville: 'Jacksonville',
    orlando: 'Orlando',
    miami: 'Miami',
    tampa: 'Tampa',
    'st-petersburg': 'St. Petersburg',
    'fort-lauderdale': 'Fort Lauderdale',
    'west-palm-beach': 'West Palm Beach',
    naples: 'Naples',
    'fort-myers': 'Fort Myers',
    sarasota: 'Sarasota',
  };
  return cityLabels[city];
}

function photoSourceLabel(photo: TrailGuidePhoto) {
  const source = photo.sourceUrl.toLowerCase();
  if (source.includes('google.com') || source.includes('maps.google')) return 'Google Maps';
  if (source.includes('wikipedia.org') || source.includes('wikimedia.org')) return 'Wikipedia / Wikimedia';
  return 'destination source';
}

export default function TrailGuidePlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = getTrailGuidePlace(id);
  const fallbackPhoto = useTrailGuidePlacePhoto(place);
  const { width } = useWindowDimensions();
  const [googlePhotos, setGooglePhotos] = useState<TrailGuidePhoto[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setGooglePhotos([]);
    setActivePhotoIndex(0);
    if (!place) return () => { active = false; };

    void resolveGoogleTrailGuidePlaceGallery(place).then((photos) => {
      if (active && photos.length > 0) setGooglePhotos(photos);
    });

    return () => { active = false; };
  }, [place]);

  if (!place) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <Text style={styles.title}>Place unavailable</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Back to Trail Guide</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentPlace = place;
  const heroPhotos = googlePhotos.length > 0 ? googlePhotos : fallbackPhoto ? [fallbackPhoto] : [];
  const activePhoto = heroPhotos[Math.min(activePhotoIndex, Math.max(0, heroPhotos.length - 1))] ?? fallbackPhoto;

  const planOuting = () => {
    router.push({
      pathname: '/local-events/create',
      params: {
        source: 'trail-guide',
        trailGuidePlaceId: currentPlace.id,
        title: currentPlace.name,
        description: `Planning an outing to ${currentPlace.name}. ${currentPlace.summary}`,
        category: outingCategory(currentPlace.category),
        venueName: currentPlace.name,
        state: 'FL',
        city: trailGuideCity(currentPlace.city),
      },
    });
  };

  const handleHeroScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setActivePhotoIndex(Math.max(0, Math.min(next, heroPhotos.length - 1)));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {heroPhotos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleHeroScrollEnd}
              style={StyleSheet.absoluteFill}
            >
              {heroPhotos.map((photo, index) => (
                <View key={`${photo.url}-${index}`} style={{ width, height: 390 }}>
                  <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}>
              <AppIcon name="photo" color="#65726B" size={38} />
              <Text style={styles.photoLoading}>Loading destination photos…</Text>
            </View>
          )}

          <View pointerEvents="none" style={styles.shade} />
          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.backLabel}>Trail Guide</Text>
          </Pressable>

          {heroPhotos.length > 1 ? (
            <View pointerEvents="none" style={styles.photoPager}>
              <Text style={styles.photoCount}>{activePhotoIndex + 1} / {heroPhotos.length}</Text>
              <View style={styles.dots}>
                {heroPhotos.map((_, index) => <View key={index} style={[styles.dot, index === activePhotoIndex && styles.dotActive]} />)}
              </View>
            </View>
          ) : null}

          <View pointerEvents="none" style={styles.heroCopy}>
            <Text style={styles.type}>{currentPlace.category.toUpperCase()} · {currentPlace.type.toUpperCase()}</Text>
            <Text style={styles.title}>{currentPlace.name}</Text>
            <Text style={styles.area}>{currentPlace.area}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {activePhoto ? (
            <Text style={styles.photoCredit} numberOfLines={2}>
              Photo via {photoSourceLabel(activePhoto)}{activePhoto.credit ? ` · ${activePhoto.credit}` : ''}{activePhoto.license ? ` · ${activePhoto.license}` : ''}
            </Text>
          ) : null}

          <Text style={styles.summary}>{currentPlace.summary}</Text>
          <View style={styles.tags}>{currentPlace.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>

          <Pressable onPress={planOuting} style={({ pressed }) => [styles.planOuting, pressed && styles.pressed]}>
            <View style={styles.planOutingIcon}><AppIcon name="calendar" color="#17211C" size={20} /></View>
            <View style={styles.planOutingCopy}>
              <Text style={styles.planOutingTitle}>Plan an Outing here</Text>
              <Text style={styles.planOutingText}>Start an outing with this destination already filled in.</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionTitle}>Good to know</Text>
          {currentPlace.details.map((detail) => (
            <View key={detail} style={styles.detailRow}>
              <View style={styles.bullet} />
              <Text style={styles.detailText}>{detail}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  hero: { height: 390, justifyContent: 'flex-end', backgroundColor: '#111914', overflow: 'hidden' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,12,9,0.30)' },
  back: { position: 'absolute', top: 14, left: 15, minHeight: 42, paddingHorizontal: 11, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(8,14,10,0.68)' },
  backLabel: { color: '#FFFDF6', fontWeight: '800', fontSize: 12 },
  heroCopy: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22, paddingBottom: 26 },
  type: { color: '#E0BE62', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF9E9', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 5 },
  area: { color: '#D9DFDB', fontSize: 14, fontWeight: '700', marginTop: 5 },
  photoPager: { position: 'absolute', top: 17, right: 16, alignItems: 'flex-end', gap: 6 },
  photoCount: { color: '#FFFDF6', fontSize: 10, fontWeight: '900', backgroundColor: 'rgba(8,14,10,0.68)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  dots: { flexDirection: 'row', gap: 4, paddingHorizontal: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.42)' },
  dotActive: { width: 15, backgroundColor: '#E0BE62' },
  body: { padding: 20, paddingBottom: 48 },
  photoCredit: { color: '#68746D', fontSize: 9, lineHeight: 13, marginBottom: 12 },
  summary: { color: '#D5DDD7', fontSize: 16, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 16 },
  tag: { borderRadius: 14, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { color: '#C3CCC6', fontSize: 10, fontWeight: '800' },
  planOuting: { marginTop: 22, borderRadius: 16, borderWidth: 1, borderColor: '#806A2B', backgroundColor: '#2B2413', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planOutingIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  planOutingCopy: { flex: 1 },
  planOutingTitle: { color: '#FFF5D7', fontSize: 15, fontWeight: '900' },
  planOutingText: { color: '#C9B98A', fontSize: 11, lineHeight: 16, marginTop: 2 },
  sectionTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 28, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 11 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D7B45A', marginTop: 7 },
  detailText: { flex: 1, color: '#BCC6BF', fontSize: 13, lineHeight: 20 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoLoading: { color: '#7E8982', fontSize: 11, fontWeight: '700' },
  missing: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  backButton: { marginTop: 18, borderRadius: 12, borderWidth: 1, borderColor: '#6D5A28', paddingHorizontal: 15, paddingVertical: 11 },
  backText: { color: '#D7B45A', fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
