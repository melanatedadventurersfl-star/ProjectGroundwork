import * as Location from 'expo-location';
import { useMemo, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../../src/ui/AppIcon';

type DiscoveryCategory = 'All' | 'Hiking' | 'Camping' | 'Parks' | 'Water' | 'Scenic';

type NearbyPlace = {
  id: string;
  category: Exclude<DiscoveryCategory, 'All'>;
  name: string;
  distance: string;
  type: string;
  tags: string[];
  meta: string;
  image: string;
  availability?: string;
  availabilityTone?: 'good' | 'warning';
};

type GuideCard = {
  id: string;
  title: string;
  image: string;
};

const discoveryCategories: DiscoveryCategory[] = ['All', 'Hiking', 'Camping', 'Parks', 'Water', 'Scenic'];

const nearbyPlaces: NearbyPlace[] = [
  {
    id: 'hanna',
    category: 'Parks',
    name: 'Kathryn Abbey Hanna Park',
    distance: '5.2 mi away',
    type: 'Park',
    tags: ['Trails', 'Beach'],
    meta: 'Easy–Moderate  •  7 trails',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'baldwin',
    category: 'Hiking',
    name: 'Jacksonville-Baldwin Rail Trail',
    distance: '8.7 mi away',
    type: 'Paved Trail',
    tags: ['Walking', 'Cycling'],
    meta: '14.5 miles  •  Paved  •  Easy',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'timucuan',
    category: 'Scenic',
    name: 'Timucuan Preserve',
    distance: '11 mi away',
    type: 'Nature Preserve',
    tags: ['Nature Preserve', 'Kayaking'],
    meta: 'Trails  •  Historic Sites',
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'little-talbot-camp',
    category: 'Camping',
    name: 'Little Talbot Island Campground',
    distance: '6.1 mi away',
    type: 'Campground',
    tags: ['Tent', 'RV', 'Cabins'],
    meta: 'Restrooms  •  Showers  •  Fire Rings',
    availability: 'Available',
    availabilityTone: 'good',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'huguenot',
    category: 'Camping',
    name: 'Huguenot Memorial Park',
    distance: '9.3 mi away',
    type: 'Campground',
    tags: ['Tent', 'RV'],
    meta: 'Picnic Tables  •  Restrooms  •  Fire Rings',
    availability: '2 sites left',
    availabilityTone: 'warning',
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'talbot-water',
    category: 'Water',
    name: 'Little Talbot Island Beach',
    distance: '6.3 mi away',
    type: 'Beach',
    tags: ['Swimming', 'Surfing'],
    meta: 'Showers  •  Wildlife  •  Easy Access',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  },
];

const guides: GuideCard[] = [
  {
    id: 'camping-essentials',
    title: 'Camping Essentials Checklist',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'hiking-safety',
    title: 'Hiking Safety Tips',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'leave-no-trace',
    title: 'Leave No Trace Principles',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
  },
];

export default function TrailGuideScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DiscoveryCategory>('All');
  const [locationLabel, setLocationLabel] = useState('Near me');
  const [locationBusy, setLocationBusy] = useState(false);

  const visiblePlaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    return nearbyPlaces.filter((place) => {
      const matchesCategory = category === 'All' || place.category === category;
      const haystack = `${place.name} ${place.type} ${place.tags.join(' ')} ${place.meta}`.toLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [category, search]);

  const parksAndTrails = visiblePlaces.filter((place) => place.category === 'Parks' || place.category === 'Hiking' || place.category === 'Scenic');
  const campgrounds = visiblePlaces.filter((place) => place.category === 'Camping');
  const water = visiblePlaces.filter((place) => place.category === 'Water');

  async function requestCurrentLocation() {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationLabel('Location off');
        return;
      }
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationLabel('Near me');
    } finally {
      setLocationBusy(false);
    }
  }

  function renderPlace(place: NearbyPlace) {
    return (
      <View key={place.id} style={styles.placeCard}>
        <Image source={{ uri: place.image }} style={styles.placeImage} />
        <View style={styles.placeCopy}>
          <View style={styles.placeTitleRow}>
            <Text numberOfLines={2} style={styles.placeName}>{place.name}</Text>
            <AppIcon name="guide" color="#F5C400" size={19} />
          </View>
          <Text style={styles.distance}>{place.distance}</Text>
          <View style={styles.tagRow}>
            {place.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}
          </View>
          <View style={styles.metaRow}>
            <Text numberOfLines={2} style={styles.metaText}>{place.meta}</Text>
            {place.availability ? (
              <View style={[styles.availability, place.availabilityTone === 'warning' && styles.availabilityWarning]}>
                <Text style={[styles.availabilityText, place.availabilityTone === 'warning' && styles.availabilityWarningText]}>{place.availability}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=82' }}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <Text style={styles.title}>Trail Guide</Text>
            <Text style={styles.intro}>Find somewhere to go, learn what you need, then turn it into your next adventure.</Text>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.searchWrap}>
            <AppIcon name="search" color="#7D8882" size={19} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search trails, parks, camping & guides"
              placeholderTextColor="#7D8882"
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {discoveryCategories.map((item) => {
              const active = category === item;
              return (
                <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryChip, active && styles.categoryChipActive]}>
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.exploreHeader}>
            <View>
              <Text style={styles.sectionTitle}>Explore Nearby</Text>
              <Text style={styles.sectionSubtitle}>Outdoor places around your current area.</Text>
            </View>
            <Pressable onPress={() => void requestCurrentLocation()} style={styles.locationButton}>
              <AppIcon name="location" color="#F5C400" size={17} />
              <Text style={styles.locationText}>{locationBusy ? 'Locating…' : locationLabel}</Text>
            </Pressable>
          </View>

          {parksAndTrails.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionLabelWrap}>
                  <View style={styles.sectionIcon}><AppIcon name="explore" color="#79B76A" size={18} /></View>
                  <Text style={styles.listTitle}>Parks & Trails</Text>
                </View>
                <Pressable onPress={() => setCategory('Parks')}><Text style={styles.seeAll}>See all ›</Text></Pressable>
              </View>
              <View style={styles.list}>{parksAndTrails.slice(0, 3).map(renderPlace)}</View>
            </View>
          ) : null}

          {campgrounds.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionLabelWrap}>
                  <View style={styles.sectionIcon}><AppIcon name="trailhead" color="#79B76A" size={18} /></View>
                  <Text style={styles.listTitle}>Campgrounds</Text>
                </View>
                <Pressable onPress={() => setCategory('Camping')}><Text style={styles.seeAll}>See all ›</Text></Pressable>
              </View>
              <View style={styles.list}>{campgrounds.slice(0, 2).map(renderPlace)}</View>
            </View>
          ) : null}

          {water.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionLabelWrap}>
                  <View style={styles.sectionIcon}><AppIcon name="weather" color="#79B76A" size={18} /></View>
                  <Text style={styles.listTitle}>Water</Text>
                </View>
                <Pressable onPress={() => setCategory('Water')}><Text style={styles.seeAll}>See all ›</Text></Pressable>
              </View>
              <View style={styles.list}>{water.slice(0, 2).map(renderPlace)}</View>
            </View>
          ) : null}

          {visiblePlaces.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No nearby matches yet</Text>
              <Text style={styles.emptyText}>Try another category or a broader search.</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <View style={styles.sectionLabelWrap}>
                <View style={styles.sectionIcon}><AppIcon name="guide" color="#79B76A" size={18} /></View>
                <Text style={styles.listTitle}>Guides & Know-How</Text>
              </View>
              <Text style={styles.seeAll}>See all ›</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guideRow}>
              {guides.map((guide) => (
                <View key={guide.id} style={styles.guideCard}>
                  <ImageBackground source={{ uri: guide.image }} style={styles.guideImage} imageStyle={styles.guideImageRadius}>
                    <View style={styles.guideShade} />
                    <Text style={styles.guideTitle}>{guide.title}</Text>
                  </ImageBackground>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08100C' },
  hero: { height: 300, justifyContent: 'flex-end' },
  heroImage: { resizeMode: 'cover' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.48)' },
  heroContent: { paddingHorizontal: 22, paddingBottom: 24 },
  title: { color: '#FFFDF6', fontSize: 42, lineHeight: 46, fontWeight: '900' },
  intro: { color: '#F1F3EF', fontSize: 14, lineHeight: 21, maxWidth: 390, marginTop: 8 },
  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 76 },
  searchWrap: { minHeight: 50, borderRadius: 16, backgroundColor: '#171E1A', borderWidth: 1, borderColor: '#27322C', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: '#FFFDF6', fontSize: 14, paddingVertical: 13 },
  categoryRow: { gap: 9, paddingVertical: 16, paddingRight: 8 },
  categoryChip: { borderRadius: 999, borderWidth: 1, borderColor: '#334139', backgroundColor: '#17211B', paddingHorizontal: 15, paddingVertical: 9 },
  categoryChipActive: { backgroundColor: '#F5C400', borderColor: '#F5C400' },
  categoryText: { color: '#F0F3F0', fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#11150F' },
  exploreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 3, marginBottom: 18 },
  sectionTitle: { color: '#FFFDF6', fontSize: 25, fontWeight: '900' },
  sectionSubtitle: { color: '#99A49D', fontSize: 12, marginTop: 3 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8 },
  locationText: { color: '#F5C400', fontSize: 12, fontWeight: '900' },
  section: { marginBottom: 24 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#1B2C20', alignItems: 'center', justifyContent: 'center' },
  listTitle: { color: '#FFFDF6', fontSize: 19, fontWeight: '900' },
  seeAll: { color: '#F5C400', fontSize: 12, fontWeight: '900' },
  list: { gap: 9 },
  placeCard: { minHeight: 126, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#28332D', backgroundColor: '#111915', flexDirection: 'row' },
  placeImage: { width: 132, alignSelf: 'stretch', backgroundColor: '#1D2A23' },
  placeCopy: { flex: 1, padding: 12, justifyContent: 'center' },
  placeTitleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  placeName: { color: '#FFFDF6', fontSize: 16, lineHeight: 20, fontWeight: '900', flex: 1 },
  distance: { color: '#8CCB78', fontSize: 12.5, fontWeight: '800', marginTop: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  tag: { backgroundColor: '#233027', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: '#E5EBE6', fontSize: 10.5, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 },
  metaText: { color: '#A8B0AB', fontSize: 10.5, lineHeight: 15, flex: 1 },
  availability: { borderRadius: 999, backgroundColor: '#1D3421', paddingHorizontal: 8, paddingVertical: 5 },
  availabilityText: { color: '#8ED47A', fontSize: 9.5, fontWeight: '900' },
  availabilityWarning: { backgroundColor: '#332711' },
  availabilityWarningText: { color: '#F0A71F' },
  emptyState: { borderRadius: 16, borderWidth: 1, borderColor: '#29342E', backgroundColor: '#121A16', padding: 20, marginBottom: 24 },
  emptyTitle: { color: '#FFFDF6', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#98A39C', marginTop: 4, fontSize: 12 },
  guideRow: { gap: 10, paddingRight: 12 },
  guideCard: { width: 148, height: 142, borderRadius: 16, overflow: 'hidden' },
  guideImage: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  guideImageRadius: { borderRadius: 16 },
  guideShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,7,0.45)' },
  guideTitle: { color: '#FFFDF6', fontSize: 15, lineHeight: 19, fontWeight: '900' },
});
