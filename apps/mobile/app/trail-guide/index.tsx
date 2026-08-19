import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../../src/ui/AppIcon';

type GuideCategory = 'Getting Started' | 'Camping' | 'Hiking' | 'Gear' | 'Safety';
type DiscoveryCategory = 'Hiking' | 'Camping' | 'Parks' | 'Water' | 'Scenic';

type GuideArticle = {
  id: string;
  category: GuideCategory;
  title: string;
  summary: string;
  readTime: string;
  level?: string;
  bullets: string[];
};

const discoveryCategories: { label: DiscoveryCategory; query: string }[] = [
  { label: 'Hiking', query: 'hiking trails' },
  { label: 'Camping', query: 'campgrounds' },
  { label: 'Parks', query: 'parks' },
  { label: 'Water', query: 'lakes beaches kayaking' },
  { label: 'Scenic', query: 'scenic outdoor places' },
];

const nearbyIdeas = [
  { title: 'Parks & trails near you', subtitle: 'Find a quick hike, greenway, or nature preserve.', query: 'parks hiking trails' },
  { title: 'Campgrounds near you', subtitle: 'Scout tent camping, cabins, and weekend base camps.', query: 'campgrounds camping' },
  { title: 'Water days near you', subtitle: 'Explore lakes, beaches, paddling, and swimming spots.', query: 'lakes beaches kayaking swimming' },
];

const guideCategories: GuideCategory[] = ['Getting Started', 'Camping', 'Hiking', 'Gear', 'Safety'];

const articles: GuideArticle[] = [
  {
    id: 'camping-beginners',
    category: 'Getting Started',
    title: 'Camping for Beginners',
    summary: 'Everything you need to know for a comfortable and memorable first trip.',
    readTime: '7 min read',
    level: 'Beginner',
    bullets: ['Choose a campground with simple amenities for your first trip.', 'Set up shelter before unpacking the rest of camp.', 'Keep food and scented items secured away from your sleeping area.'],
  },
  {
    id: 'camp-setup',
    category: 'Camping',
    title: 'Camp Setup Basics',
    summary: 'A simple setup order that keeps camp comfortable before the sun disappears.',
    readTime: '4 min read',
    bullets: ['Choose level, well-drained ground.', 'Pitch shelter before organizing camp furniture and food.', 'Create clear zones for sleeping, cooking, and hanging out.'],
  },
  {
    id: 'trail-etiquette',
    category: 'Hiking',
    title: 'Trail Etiquette 101',
    summary: 'Share the trail respectfully, safely, and without making the woods weird.',
    readTime: '3 min read',
    bullets: ['Stay on marked trails whenever possible.', 'Yield according to local trail guidance and communicate when passing.', 'Pack out trash and leave natural objects where you found them.'],
  },
  {
    id: 'day-hike',
    category: 'Gear',
    title: 'Day Hike Essentials',
    summary: 'The gear you actually need for a safe, comfortable day outside.',
    readTime: '5 min read',
    bullets: ['Bring water, snacks, navigation, and sun protection.', 'Carry a light weather layer and a small first-aid kit.', 'Start with what you own before buying specialty gear.'],
  },
  {
    id: 'trip-plan',
    category: 'Safety',
    title: 'Leave a Simple Trip Plan',
    summary: 'Someone should know where you are going and when to expect you back.',
    readTime: '3 min read',
    bullets: ['Share the park, trail, or campground name.', 'Include your expected return time.', 'Update your contact if the plan changes.'],
  },
];

export default function TrailGuideScreen() {
  const [search, setSearch] = useState('');
  const [guideCategory, setGuideCategory] = useState<GuideCategory>('Getting Started');
  const [openArticle, setOpenArticle] = useState<string | null>('camping-beginners');
  const [locationLabel, setLocationLabel] = useState('Near me');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);

  const visibleArticles = useMemo(
    () => articles.filter((article) => article.category === guideCategory),
    [guideCategory],
  );

  async function useCurrentLocation() {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationLabel('Search an area');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationLabel('Using your location');
    } finally {
      setLocationBusy(false);
    }
  }

  async function openNearbySearch(query: string) {
    const locationSuffix = coords ? ` near ${coords.latitude},${coords.longitude}` : ' near me';
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query}${locationSuffix}`)}`);
  }

  async function runSearch() {
    const query = search.trim();
    if (!query) return;
    await openNearbySearch(query);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <AppIcon name="chevron-forward" color="#D7B45A" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}><AppIcon name="guide" color="#17211C" size={24} /></View>
          <Text style={styles.title}>Trail Guide</Text>
          <Text style={styles.intro}>Find somewhere to go, learn what you need, then turn it into your next adventure.</Text>
        </View>

        <View style={styles.searchWrap}>
          <AppIcon name="search" color="#738178" size={20} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void runSearch()}
            placeholder="Search trails, parks, camping & guides"
            placeholderTextColor="#738178"
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryChips}>
          {discoveryCategories.map((item) => (
            <Pressable key={item.label} onPress={() => void openNearbySearch(item.query)} style={styles.discoveryChip}>
              <Text style={styles.discoveryChipText}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Explore Nearby</Text>
            <Text style={styles.sectionSubtitle}>Outdoor places around your current area.</Text>
          </View>
          <Pressable onPress={() => void useCurrentLocation()} style={styles.locationButton}>
            <AppIcon name="location" color="#D7B45A" size={16} />
            <Text style={styles.locationButtonText}>{locationBusy ? 'Locating…' : locationLabel}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>
          {nearbyIdeas.map((place, index) => (
            <Pressable key={place.title} onPress={() => void openNearbySearch(place.query)} style={styles.nearbyCard}>
              <View style={[styles.nearbyArt, index === 1 && styles.nearbyArtCamp, index === 2 && styles.nearbyArtWater]}>
                <AppIcon name={index === 1 ? 'trailhead' : index === 2 ? 'weather' : 'explore'} color="#FFF8E8" size={30} />
              </View>
              <Text style={styles.nearbyTitle}>{place.title}</Text>
              <Text style={styles.nearbySubtitle}>{place.subtitle}</Text>
              <View style={styles.nearbyMeta}><AppIcon name="location" color="#D7B45A" size={14} /><Text style={styles.nearbyMetaText}>Open nearby results</Text></View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.planCard}>
          <View style={styles.planIcon}><AppIcon name="adventure" color="#17211C" size={23} /></View>
          <View style={styles.planCopy}>
            <Text style={styles.planEyebrow}>DISCOVER → PLAN</Text>
            <Text style={styles.planTitle}>Found the spot?</Text>
            <Text style={styles.planText}>Jump into Explore to find an adventure or start organizing your next outing around it.</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/explore' as never)} style={styles.planButton}><Text style={styles.planButtonText}>Explore</Text></Pressable>
        </View>

        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Learn Something</Text><Text style={styles.sectionSubtitle}>Practical guides for getting outside with confidence.</Text></View></View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guideChips}>
          {guideCategories.map((value) => (
            <Pressable key={value} onPress={() => setGuideCategory(value)} style={[styles.guideChip, guideCategory === value && styles.guideChipActive]}>
              <Text style={[styles.guideChipText, guideCategory === value && styles.guideChipTextActive]}>{value}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {visibleArticles.map((article) => {
          const open = openArticle === article.id;
          return (
            <Pressable key={article.id} onPress={() => setOpenArticle(open ? null : article.id)} style={styles.articleCard}>
              <View style={styles.articleTop}>
                <View style={styles.articleIcon}><AppIcon name="guide" color="#D7B45A" size={21} /></View>
                <View style={styles.articleCopy}>
                  <Text style={styles.articleCategory}>{article.category.toUpperCase()}</Text>
                  <Text style={styles.articleTitle}>{article.title}</Text>
                  <Text style={styles.articleSummary}>{article.summary}</Text>
                  <Text style={styles.articleMeta}>{article.readTime}{article.level ? `  •  ${article.level}` : ''}</Text>
                </View>
                <AppIcon name="chevron-forward" color="#D7B45A" size={21} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
              </View>
              {open ? <View style={styles.details}>{article.bullets.map((bullet) => <View key={bullet} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{bullet}</Text></View>)}</View> : null}
            </Pressable>
          );
        })}

        <View style={styles.footerCard}>
          <Text style={styles.footerEyebrow}>TRAIL GUIDE</Text>
          <Text style={styles.footerTitle}>Built to grow with the community</Text>
          <Text style={styles.footerText}>This structure is ready for richer destination pages, saved places, community tips, trail data, editorial guides, and a native map layer without changing the core experience.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 72, gap: 14 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: '#D7B45A', fontWeight: '900' },
  hero: { alignItems: 'center', paddingTop: 2, paddingBottom: 4 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  title: { color: '#FFF8E8', fontSize: 38, lineHeight: 42, fontWeight: '900' },
  intro: { color: '#AEB8B2', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 430, marginTop: 6 },
  searchWrap: { minHeight: 52, borderRadius: 18, backgroundColor: '#F5F0E5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 10 },
  searchInput: { flex: 1, color: '#17211C', fontSize: 14, paddingVertical: 14 },
  discoveryChips: { gap: 8, paddingRight: 12, paddingVertical: 2 },
  discoveryChip: { borderRadius: 999, backgroundColor: '#1B2A22', borderWidth: 1, borderColor: '#405047', paddingHorizontal: 14, paddingVertical: 9 },
  discoveryChipText: { color: '#E3E9E5', fontSize: 12, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 4 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  sectionSubtitle: { color: '#86938B', fontSize: 12, lineHeight: 17, marginTop: 2 },
  locationButton: { maxWidth: 155, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: '#4B594F', paddingHorizontal: 10, paddingVertical: 7 },
  locationButtonText: { color: '#D7B45A', fontWeight: '900', fontSize: 10 },
  nearbyRow: { gap: 11, paddingRight: 14 },
  nearbyCard: { width: 218, borderRadius: 20, borderWidth: 1, borderColor: '#2C3B33', backgroundColor: '#17211C', overflow: 'hidden', paddingBottom: 14 },
  nearbyArt: { height: 98, backgroundColor: '#31533C', alignItems: 'center', justifyContent: 'center' },
  nearbyArtCamp: { backgroundColor: '#725A2F' },
  nearbyArtWater: { backgroundColor: '#31576A' },
  nearbyTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginHorizontal: 13, marginTop: 12 },
  nearbySubtitle: { color: '#AEB8B2', fontSize: 12, lineHeight: 18, marginHorizontal: 13, marginTop: 4, minHeight: 54 },
  nearbyMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 13, marginTop: 4 },
  nearbyMetaText: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900' },
  planCard: { borderRadius: 20, borderWidth: 1, borderColor: '#526047', backgroundColor: '#1C2B23', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  planIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  planCopy: { flex: 1 },
  planEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  planTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 2 },
  planText: { color: '#AEB8B2', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  planButton: { borderRadius: 12, backgroundColor: '#D7B45A', paddingHorizontal: 12, paddingVertical: 10 },
  planButtonText: { color: '#17211C', fontSize: 11, fontWeight: '900' },
  guideChips: { gap: 8, paddingRight: 12 },
  guideChip: { borderWidth: 1, borderColor: '#405047', backgroundColor: '#17211C', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  guideChipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  guideChipText: { color: '#D7DFDA', fontSize: 12, fontWeight: '800' },
  guideChipTextActive: { color: '#17211C' },
  articleCard: { borderRadius: 18, borderWidth: 1, borderColor: '#2C3B33', backgroundColor: '#17211C', padding: 15 },
  articleTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  articleIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#22332A', alignItems: 'center', justifyContent: 'center' },
  articleCopy: { flex: 1 },
  articleCategory: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  articleTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 3 },
  articleSummary: { color: '#AEB8B2', fontSize: 13, lineHeight: 19, marginTop: 4 },
  articleMeta: { color: '#718078', fontSize: 10.5, fontWeight: '800', marginTop: 7 },
  details: { borderTopWidth: 1, borderTopColor: '#2B3932', marginTop: 12, paddingTop: 12, gap: 9 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#67CFC8', marginTop: 7 },
  bulletText: { color: '#D0D8D3', fontSize: 13, lineHeight: 20, flex: 1 },
  footerCard: { borderRadius: 18, backgroundColor: '#111A17', borderWidth: 1, borderColor: '#28362E', padding: 16, marginTop: 4 },
  footerEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  footerTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 3 },
  footerText: { color: '#8F9C94', fontSize: 12.5, lineHeight: 19, marginTop: 5 },
});
