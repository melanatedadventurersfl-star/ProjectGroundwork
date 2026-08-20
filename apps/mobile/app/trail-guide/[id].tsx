import { router, useLocalSearchParams } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../../src/ui/AppIcon';

type PlaceDetail = {
  name: string;
  type: string;
  distance: string;
  image: string;
  summary: string;
  tags: string[];
  details: string[];
};

const places: Record<string, PlaceDetail> = {
  hanna: {
    name: 'Kathryn Abbey Hanna Park',
    type: 'Park',
    distance: '5.2 mi away',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82',
    summary: 'A nearby coastal park option for trails, beach time, and an easy outdoor day.',
    tags: ['Trails', 'Beach', 'Easy–Moderate'],
    details: ['7 trails', 'Beach access', 'Good for a half-day outing'],
  },
  baldwin: {
    name: 'Jacksonville-Baldwin Rail Trail',
    type: 'Paved Trail',
    distance: '8.7 mi away',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82',
    summary: 'A long, approachable paved route suited for walking, running, and cycling.',
    tags: ['Walking', 'Cycling', 'Easy'],
    details: ['14.5 miles', 'Paved surface', 'Good for bikes and longer walks'],
  },
  timucuan: {
    name: 'Timucuan Preserve',
    type: 'Nature Preserve',
    distance: '11 mi away',
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=82',
    summary: 'Wetlands, trails, paddling, and historic sites in a broad nature preserve.',
    tags: ['Nature Preserve', 'Kayaking', 'Trails'],
    details: ['Historic sites', 'Paddling opportunities', 'Multiple outdoor activities'],
  },
  'little-talbot-camp': {
    name: 'Little Talbot Island Campground',
    type: 'Campground',
    distance: '6.1 mi away',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=82',
    summary: 'A close-to-home campground option with tent, RV, and cabin-style camping choices.',
    tags: ['Tent', 'RV', 'Cabins'],
    details: ['Restrooms', 'Showers', 'Fire rings'],
  },
  huguenot: {
    name: 'Huguenot Memorial Park',
    type: 'Campground',
    distance: '9.3 mi away',
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=82',
    summary: 'A relaxed campground and waterfront outing option with simple amenities.',
    tags: ['Tent', 'RV', 'Waterfront'],
    details: ['Picnic tables', 'Restrooms', 'Fire rings'],
  },
  'talbot-water': {
    name: 'Little Talbot Island Beach',
    type: 'Beach',
    distance: '6.3 mi away',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=82',
    summary: 'A nearby beach day option for swimming, surfing, wildlife, and shoreline time.',
    tags: ['Swimming', 'Surfing', 'Beach'],
    details: ['Showers', 'Wildlife', 'Easy access'],
  },
};

export default function TrailGuidePlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = id ? places[id] : undefined;

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

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground source={{ uri: place.image }} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.shade} />
          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.backLabel}>Trail Guide</Text>
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.type}>{place.type.toUpperCase()}</Text>
            <Text style={styles.title}>{place.name}</Text>
            <Text style={styles.distance}>{place.distance}</Text>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <Text style={styles.summary}>{place.summary}</Text>
          <View style={styles.tags}>{place.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>At a glance</Text>
            {place.details.map((detail) => (
              <View key={detail} style={styles.detailRow}>
                <View style={styles.dot} />
                <Text style={styles.detailText}>{detail}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08100C' },
  hero: { height: 340, justifyContent: 'space-between' },
  heroImage: { resizeMode: 'cover' },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,10,7,0.48)' },
  back: { marginTop: 14, marginLeft: 16, minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(9,16,12,0.58)' },
  backLabel: { color: '#FFFDF6', fontSize: 13, fontWeight: '900' },
  heroCopy: { padding: 22 },
  type: { color: '#F5C400', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFFDF6', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 5 },
  distance: { color: '#A7D795', fontSize: 13, fontWeight: '800', marginTop: 7 },
  body: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 76 },
  summary: { color: '#E2E7E3', fontSize: 16, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: { borderRadius: 999, backgroundColor: '#1E2C24', borderWidth: 1, borderColor: '#324338', paddingHorizontal: 11, paddingVertical: 7 },
  tagText: { color: '#EDF2EE', fontSize: 12, fontWeight: '800' },
  infoCard: { marginTop: 24, borderRadius: 18, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#111915', padding: 18 },
  infoTitle: { color: '#FFFDF6', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#79B76A' },
  detailText: { color: '#B8C1BB', fontSize: 14, flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backButton: { marginTop: 18, minHeight: 44, justifyContent: 'center', borderRadius: 14, backgroundColor: '#F5C400', paddingHorizontal: 18 },
  backText: { color: '#11150F', fontWeight: '900' },
  pressed: { opacity: 0.7 },
});