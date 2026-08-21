import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cityCollections,
  cityKeyFromLocationLabel,
  discoveryCategories,
  trailGuidePlaces,
  type DiscoveryCategory,
  type TrailGuidePlace,
} from '../../src/trailGuide/catalog';
import { trailGuideArticles } from '../../src/trailGuide/guides';
import { useTrailGuideLocationBackground } from '../../src/trailGuide/locationBackgrounds';
import { AppIcon } from '../../src/ui/AppIcon';

export default function TrailGuideScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DiscoveryCategory>('All');
  const [collection, setCollection] = useState<string | null>(null);
  const { backgroundSource, locationLabel, locationBusy, requestCurrentLocation } = useTrailGuideLocationBackground();
  const cityKey = cityKeyFromLocationLabel(locationLabel);
  const cityName = cityKey === 'orlando' ? 'Orlando' : 'Jacksonville';

  const visiblePlaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    return trailGuidePlaces.filter((place) => {
      if (place.city !== cityKey) return false;
      if (category !== 'All' && place.category !== category) return false;
      if (collection && !place.collections.includes(collection)) return false;
      const haystack = `${place.name} ${place.area} ${place.type} ${place.tags.join(' ')} ${place.meta} ${place.collections.join(' ')}`.toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [category, cityKey, collection, search]);

  function chooseCategory(next: DiscoveryCategory) {
    setCategory(next);
  }

  function chooseCollection(next: string) {
    setCollection((current) => (current === next ? null : next));
  }

  function renderPlace(place: TrailGuidePlace) {
    return (
      <Pressable
        key={place.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${place.name}`}
        hitSlop={4}
        onPress={() => router.push(`/trail-guide/${place.id}` as never)}
        style={({ pressed }) => [styles.placeCard, pressed && styles.cardPressed]}
      >
        <Image source={{ uri: place.image }} style={styles.placeImage} />
        <View style={styles.placeCopy}>
          <View style={styles.placeTitleRow}>
            <Text numberOfLines={2} style={styles.placeName}>{place.name}</Text>
            <AppIcon name="chevron-forward" color="#F5C400" size={19} />
          </View>
          <Text style={styles.area}>{place.area}</Text>
          <View style={styles.tagRow}>
            {place.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}
          </View>
          <Text numberOfLines={2} style={styles.metaText}>{place.meta}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ImageBackground source={backgroundSource} style={styles.hero} imageStyle={styles.heroImage}>
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
              placeholder="Search places, activities & guides"
              placeholderTextColor="#7D8882"
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {discoveryCategories.map((item) => {
              const active = category === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  onPress={() => chooseCategory(item)}
                  style={({ pressed }) => [styles.categoryChip, active && styles.categoryChipActive, pressed && styles.chipPressed]}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.exploreHeader}>
            <View style={styles.exploreHeaderCopy}>
              <Text style={styles.sectionTitle}>{cityName} Field Guide</Text>
              <Text style={styles.sectionSubtitle}>40 outdoor places curated around the reference city.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => void requestCurrentLocation()}
              style={({ pressed }) => [styles.locationButton, pressed && styles.chipPressed]}
            >
              <AppIcon name="location" color="#F5C400" size={17} />
              <Text numberOfLines={1} style={styles.locationText}>{locationBusy ? 'Locating…' : locationLabel}</Text>
            </Pressable>
          </View>

          <View style={styles.collectionHeader}>
            <Text style={styles.collectionTitle}>Curated collections</Text>
            {collection ? <Pressable hitSlop={8} onPress={() => setCollection(null)}><Text style={styles.clearText}>Clear</Text></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRow}>
            {cityCollections[cityKey].map((item) => {
              const active = collection === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => chooseCollection(item)}
                  style={({ pressed }) => [styles.collectionChip, active && styles.collectionChipActive, pressed && styles.chipPressed]}
                >
                  <Text style={[styles.collectionText, active && styles.collectionTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.resultsHeader}>
            <Text style={styles.listTitle}>{visiblePlaces.length} {visiblePlaces.length === 1 ? 'place' : 'places'}</Text>
            {(category !== 'All' || collection || search.trim()) ? (
              <Text style={styles.resultsHint}>Filtered results</Text>
            ) : <Text style={styles.resultsHint}>Browse the full city guide</Text>}
          </View>

          {visiblePlaces.length > 0 ? (
            <View style={styles.list}>{visiblePlaces.map(renderPlace)}</View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No matches in this collection</Text>
              <Text style={styles.emptyText}>Try another category, clear the collection, or broaden your search.</Text>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <View style={styles.sectionLabelWrap}>
                <View style={styles.sectionIcon}><AppIcon name="guide" color="#79B76A" size={18} /></View>
                <View>
                  <Text style={styles.listTitle}>Guides & Know-How</Text>
                  <Text style={styles.guideSubtitle}>Practical knowledge for Florida outdoor days.</Text>
                </View>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guideRow}>
              {trailGuideArticles.map((guide) => (
                <Pressable
                  key={guide.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/trail-guide/guide/${guide.id}` as never)}
                  style={({ pressed }) => [styles.guideCard, pressed && styles.cardPressed]}
                >
                  <ImageBackground source={{ uri: guide.image }} style={styles.guideImage} imageStyle={styles.guideImageRadius}>
                    <View style={styles.guideShade} />
                    <Text style={styles.guideTopic}>{guide.topic.toUpperCase()}</Text>
                    <Text style={styles.guideTitle}>{guide.title}</Text>
                  </ImageBackground>
                </Pressable>
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
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,10,7,0.48)' },
  heroContent: { paddingHorizontal: 22, paddingBottom: 24 },
  title: { color: '#FFFDF6', fontSize: 42, lineHeight: 46, fontWeight: '900' },
  intro: { color: '#F1F3EF', fontSize: 14, lineHeight: 21, maxWidth: 390, marginTop: 8 },
  body: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 76 },
  searchWrap: { minHeight: 52, borderRadius: 16, backgroundColor: '#171E1A', borderWidth: 1, borderColor: '#27322C', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: '#FFFDF6', fontSize: 14, paddingVertical: 13 },
  categoryRow: { gap: 9, paddingVertical: 16, paddingRight: 8 },
  categoryChip: { minHeight: 42, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#334139', backgroundColor: '#17211B', paddingHorizontal: 15, paddingVertical: 9 },
  categoryChipActive: { backgroundColor: '#F5C400', borderColor: '#F5C400' },
  categoryText: { color: '#F0F3F0', fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#11150F' },
  exploreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 4, marginBottom: 15 },
  exploreHeaderCopy: { flex: 1 },
  sectionTitle: { color: '#FFFDF6', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  sectionSubtitle: { color: '#8E9B94', fontSize: 12, lineHeight: 18, marginTop: 4 },
  locationButton: { maxWidth: 170, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: '#344139', backgroundColor: '#142019', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  locationText: { flexShrink: 1, color: '#E4EAE6', fontSize: 11, fontWeight: '800' },
  collectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  collectionTitle: { color: '#DCE4DF', fontSize: 13, fontWeight: '900' },
  clearText: { color: '#F5C400', fontSize: 12, fontWeight: '900' },
  collectionRow: { gap: 8, paddingVertical: 12, paddingRight: 8 },
  collectionChip: { minHeight: 38, justifyContent: 'center', borderRadius: 13, backgroundColor: '#111915', borderWidth: 1, borderColor: '#29362F', paddingHorizontal: 13 },
  collectionChipActive: { backgroundColor: '#213627', borderColor: '#79B76A' },
  collectionText: { color: '#A9B4AE', fontSize: 11, fontWeight: '800' },
  collectionTextActive: { color: '#CFF3C2' },
  resultsHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  resultsHint: { color: '#7F8C85', fontSize: 11, fontWeight: '700' },
  listTitle: { color: '#FFFDF6', fontSize: 18, fontWeight: '900' },
  list: { gap: 10 },
  placeCard: { minHeight: 126, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111915', borderWidth: 1, borderColor: '#27332C', flexDirection: 'row' },
  placeImage: { width: 116, minHeight: 126, backgroundColor: '#1B241F' },
  placeCopy: { flex: 1, padding: 13 },
  placeTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  placeName: { color: '#FFFDF6', fontSize: 15, lineHeight: 20, fontWeight: '900', flex: 1 },
  area: { color: '#8ED47A', fontSize: 11, fontWeight: '800', marginTop: 3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  tag: { borderRadius: 999, backgroundColor: '#1C2922', paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: '#D5DED8', fontSize: 9, fontWeight: '800' },
  metaText: { color: '#8F9B94', fontSize: 10, lineHeight: 15, marginTop: 8 },
  section: { marginTop: 30 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#19251E', alignItems: 'center', justifyContent: 'center' },
  guideSubtitle: { color: '#7F8C85', fontSize: 10, marginTop: 2 },
  guideRow: { gap: 11, paddingRight: 6 },
  guideCard: { width: 210, height: 146, borderRadius: 18, overflow: 'hidden' },
  guideImage: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  guideImageRadius: { borderRadius: 18 },
  guideShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(4,9,6,0.48)' },
  guideTopic: { color: '#F5C400', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  guideTitle: { color: '#FFFDF6', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  emptyState: { borderRadius: 18, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#111915', padding: 22, alignItems: 'center' },
  emptyTitle: { color: '#FFFDF6', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#8D9992', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  cardPressed: { opacity: 0.78 },
  chipPressed: { opacity: 0.75 },
});
