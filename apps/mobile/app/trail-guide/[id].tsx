import { router, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTrailGuidePlace, type TrailGuideCityKey } from '../../src/trailGuide/catalog';
import { useTrailGuidePlacePhoto } from '../../src/trailGuide/placePhotos';
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

export default function TrailGuidePlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = getTrailGuidePlace(id);
  const photo = useTrailGuidePlacePhoto(place);

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

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {photo ? (
            <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}>
              <AppIcon name="photo" color="#65726B" size={38} />
              <Text style={styles.photoLoading}>Loading destination photo…</Text>
            </View>
          )}
          <View style={styles.shade} />
          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.backLabel}>Trail Guide</Text>
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.type}>{currentPlace.category.toUpperCase()} · {currentPlace.type.toUpperCase()}</Text>
            <Text style={styles.title}>{currentPlace.name}</Text>
            <Text style={styles.area}>{currentPlace.area}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.summary}>{currentPlace.summary}</Text>
          <View style={styles.metaCard}>
            <Text style={styles.meta}>{currentPlace.meta}</Text>
          </View>
          <View style={styles.tags}>
            {currentPlace.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What to know</Text>
            {currentPlace.details.map((detail) => (
              <View key={detail} style={styles.detailRow}>
                <View style={styles.bullet} />
                <Text style={styles.detailText}>{detail}</Text>
              </View>
            ))}
          </View>
          <Pressable style={styles.planButton} onPress={planOuting}>
            <AppIcon name="calendar" color="#172017" size={18} />
            <Text style={styles.planButtonText}>Plan an outing here</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  hero: { height: 360, backgroundColor: '#18211C', justifyContent: 'flex-end' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#151D18' },
  photoLoading: { color: '#7F8A83', fontSize: 12, fontWeight: '700' },
  back: { position: 'absolute', top: 18, left: 16, minHeight: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(12,17,14,0.68)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  backLabel: { color: '#FFFDF6', fontSize: 12, fontWeight: '800' },
  heroCopy: { padding: 20, gap: 4 },
  type: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900' },
  area: { color: '#D9E0DB', fontSize: 14 },
  body: { padding: 20, paddingBottom: 44 },
  summary: { color: '#E6ECE8', fontSize: 16, lineHeight: 24 },
  metaCard: { marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: '#34423A', backgroundColor: '#121914', padding: 14 },
  meta: { color: '#B8C2BC', fontSize: 13, lineHeight: 19 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: { borderRadius: 14, borderWidth: 1, borderColor: '#31533F', backgroundColor: '#12241A', paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { color: '#A9D995', fontSize: 10, fontWeight: '800' },
  section: { marginTop: 28 },
  sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 11 },
  bullet: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D7B45A', marginTop: 7 },
  detailText: { flex: 1, color: '#B7C0BA', fontSize: 13.5, lineHeight: 20 },
  planButton: { minHeight: 48, borderRadius: 16, backgroundColor: '#D7B45A', marginTop: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  planButtonText: { color: '#172017', fontSize: 14, fontWeight: '900' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  backButton: { borderRadius: 16, backgroundColor: '#D7B45A', paddingHorizontal: 18, paddingVertical: 12 },
  backText: { color: '#172017', fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
