import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cityKeyFromLocationLabel,
  discoveryCategories,
  trailGuidePlaces,
  type DiscoveryCategory,
  type TrailGuidePlace,
} from '../../src/trailGuide/catalog';
import { getTrailGuideConditionSignal } from '../../src/trailGuide/conditions';
import { trailGuideArticles, type TrailGuideArticle } from '../../src/trailGuide/guides';
import { distanceMiles, useTrailGuideLocationBackground } from '../../src/trailGuide/locationBackgrounds';
import {
  CURATED_TRAIL_GUIDE_PHOTOS,
  resolveTrailGuidePlacePhoto,
  type TrailGuidePhoto,
  useTrailGuidePlacePhoto,
} from '../../src/trailGuide/placePhotos';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeatherByQuery, type WeatherForecast } from '../../src/weather/api';

const EXPLORE_PREVIEW_LIMIT = 6;
const RECOMMENDED_LIMIT = 3;
const RECOMMENDED_PHOTO_POOL = 16;
const MAX_TRAIL_GUIDE_RADIUS_MILES = 50;

const GUIDE_ORDER_BY_CATEGORY: Record<DiscoveryCategory, string[]> = {
  All: ['camping-essentials', 'florida-heat-safety', 'hiking-safety', 'leave-no-trace', 'paddling-basics'],
  Hiking: ['hiking-safety', 'florida-heat-safety', 'leave-no-trace', 'wildlife-awareness', 'storm-season'],
  Camping: ['camping-essentials', 'first-camping-trip', 'florida-heat-safety', 'wildlife-awareness', 'leave-no-trace'],
  Parks: ['family-outdoors', 'wildlife-awareness', 'leave-no-trace', 'florida-heat-safety', 'storm-season'],
  Water: ['paddling-basics', 'storm-season', 'florida-heat-safety', 'wildlife-awareness', 'family-outdoors'],
  Scenic: ['weekend-planning', 'florida-heat-safety', 'wildlife-awareness', 'leave-no-trace', 'storm-season'],
};

type ActivityIndicator = {
  key: string;
  label: string;
  glyph: string;
};

const ACTIVITY_DEFINITIONS: ActivityIndicator[] = [
  { key: 'hiking', label: 'Hiking', glyph: '🥾' },
  { key: 'water', label: 'Water', glyph: '💧' },
  { key: 'camping', label: 'Camping', glyph: '⛺' },
  { key: 'paddling', label: 'Paddling', glyph: '🛶' },
  { key: 'scenic', label: 'Scenic', glyph: '🌿' },
  { key: 'wildlife', label: 'Wildlife', glyph: '🐦' },
  { key: 'family', label: 'Family', glyph: '👨‍👩‍👧' },
];

function getActivityIndicators(place: TrailGuidePlace): ActivityIndicator[] {
  const searchable = [place.category, place.type, ...place.tags, ...place.collections, place.meta, place.summary]
    .join(' ')
    .toLowerCase();

  const matches = new Set<string>();
  if (place.category === 'Hiking' || /trail|hiking|walking|on foot/.test(searchable)) matches.add('hiking');
  if (place.category === 'Camping' || /camp|overnight|campground/.test(searchable)) matches.add('camping');
  if (place.category === 'Water' || /water|beach|spring|river|creek|marsh|shore|swim/.test(searchable)) matches.add('water');
  if (/paddl|kayak|canoe|launch|tidal/.test(searchable)) matches.add('paddling');
  if (place.category === 'Scenic' || /scenic|photograph|landscape|view|historic|cultural/.test(searchable)) matches.add('scenic');
  if (/wildlife|bird|nature|ecological/.test(searchable)) matches.add('wildlife');
  if (place.category === 'Parks' || /family|easy outing|picnic|playground/.test(searchable)) matches.add('family');

  const categoryPriority: Record<Exclude<DiscoveryCategory, 'All'>, string[]> = {
    Hiking: ['hiking', 'scenic', 'wildlife', 'water', 'family', 'camping', 'paddling'],
    Camping: ['camping', 'hiking', 'water', 'scenic', 'wildlife', 'family', 'paddling'],
    Parks: ['family', 'hiking', 'scenic', 'wildlife', 'water', 'camping', 'paddling'],
    Water: ['water', 'paddling', 'scenic', 'wildlife', 'family', 'hiking', 'camping'],
    Scenic: ['scenic', 'wildlife', 'hiking', 'water', 'family', 'camping', 'paddling'],
  };

  const orderedKeys = categoryPriority[place.category]
    .filter((key) => matches.has(key))
    .slice(0, 3);

  return orderedKeys
    .map((key) => ACTIVITY_DEFINITIONS.find((activity) => activity.key === key))
    .filter((activity): activity is ActivityIndicator => Boolean(activity));
}

function PlacePhoto({ place, style }: { place: TrailGuidePlace; style: object }) {
  const photo = useTrailGuidePlacePhoto(place);
  if (!photo) {
    return (
      <View style={[style, styles.photoPlaceholder]}>
        <View style={styles.photoFallbackMark}>
          <AppIcon name="trail" color="#79D26A" size={22} />
        </View>
      </View>
    );
  }
  return <Image source={{ uri: photo.url }} style={style} resizeMode="cover" />;
}

function RecommendedCard({
  place,
  photo,
  weather,
  distance,
}: {
  place: TrailGuidePlace;
  photo: TrailGuidePhoto;
  weather: WeatherForecast | null;
  distance: string | null;
}) {
  const signal = getTrailGuideConditionSignal(place, weather);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${place.name}`}
      onPress={() => router.push(`/trail-guide/${place.id}` as never)}
      style={({ pressed }) => [styles.recommendedCard, pressed && styles.cardPressed]}
    >
      <View style={styles.recommendedImage}>
        <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={styles.cardShade} />
        <View style={[styles.signalBadge, signal.tone === 'good' && styles.signalGood, signal.tone === 'caution' && styles.signalCaution]}>
          <Text style={styles.signalBadgeText}>{signal.label}</Text>
        </View>
      </View>
      <View style={styles.recommendedCopy}>
        <Text numberOfLines={2} style={styles.recommendedName}>{place.name}</Text>
        <View style={styles.recommendedMetaRow}>
          <Text numberOfLines={1} style={styles.recommendedMeta}>{place.type}</Text>
          {distance ? <Text style={styles.recommendedDistance}>{distance}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function QuickGuideCard({ guide }: { guide: TrailGuideArticle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${guide.title}`}
      onPress={() => router.push(`/trail-guide/guide/${guide.id}` as never)}
      style={({ pressed }) => [styles.quickGuideCard, pressed && styles.cardPressed]}
    >
      <ImageBackground source={{ uri: guide.image }} style={styles.quickGuideImage} imageStyle={styles.quickGuideImageRadius}>
        <View style={styles.quickGuideShade} />
        <Text numberOfLines={2} style={styles.quickGuideTitle}>{guide.title}</Text>
      </ImageBackground>
    </Pressable>
  );
}

export default function TrailGuideScreen() {
  const [category, setCategory] = useState<DiscoveryCategory>('All');
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [distanceById, setDistanceById] = useState<Record<string, number>>({});
  const [photoById, setPhotoById] = useState<Record<string, TrailGuidePhoto>>(() => ({ ...CURATED_TRAIL_GUIDE_PHOTOS }));
  const [photoPoolBusy, setPhotoPoolBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { backgroundSource, coordinates, locationLabel, locationBusy, requestCurrentLocation } = useTrailGuideLocationBackground();
  const cityKey = cityKeyFromLocationLabel(locationLabel);
  const cityName = cityKey === 'orlando' ? 'Orlando' : cityKey === 'tampa' ? 'Tampa' : 'Jacksonville';

  useEffect(() => {
    let active = true;
    setWeatherBusy(true);
    void getWeatherByQuery(`${cityName}, FL`)
      .then((data) => { if (active) setWeather(data); })
      .catch(() => { if (active) setWeather(null); })
      .finally(() => { if (active) setWeatherBusy(false); });
    return () => { active = false; };
  }, [cityName]);

  const cityPlaces = useMemo(() => trailGuidePlaces.filter((place) => place.city === cityKey), [cityKey]);

  useEffect(() => {
    if (!coordinates) return;
    let active = true;
    const unresolved = cityPlaces.filter((place) => distanceById[place.id] == null);
    if (unresolved.length === 0) return;

    void Promise.all(unresolved.map(async (place) => {
      try {
        const rows = await Location.geocodeAsync(`${place.name}, ${place.area}, Florida`);
        const match = rows[0];
        if (!match) return null;
        return [place.id, distanceMiles(coordinates.latitude, coordinates.longitude, match.latitude, match.longitude)] as const;
      } catch {
        return null;
      }
    })).then((rows) => {
      if (!active) return;
      const resolved = rows.filter((row): row is readonly [string, number] => row !== null);
      if (resolved.length > 0) setDistanceById((current) => ({ ...current, ...Object.fromEntries(resolved) }));
    });

    return () => { active = false; };
  }, [cityPlaces, coordinates, distanceById]);

  const radiusCityPlaces = useMemo(() => {
    if (cityKey !== 'tampa' || !coordinates) return cityPlaces;
    return cityPlaces.filter((place) => {
      const distance = distanceById[place.id];
      return typeof distance !== 'number' || distance <= MAX_TRAIL_GUIDE_RADIUS_MILES;
    });
  }, [cityKey, cityPlaces, coordinates, distanceById]);

  const rankedCityPlaces = useMemo(() => {
    return [...radiusCityPlaces].sort((a, b) => {
      const conditionDelta = getTrailGuideConditionSignal(b, weather).score - getTrailGuideConditionSignal(a, weather).score;
      if (conditionDelta !== 0) return conditionDelta;
      return (distanceById[a.id] ?? Number.POSITIVE_INFINITY) - (distanceById[b.id] ?? Number.POSITIVE_INFINITY);
    });
  }, [radiusCityPlaces, distanceById, weather]);

  const filteredPlaces = useMemo(
    () => category === 'All' ? rankedCityPlaces : rankedCityPlaces.filter((place) => place.category === category),
    [category, rankedCityPlaces],
  );

  useEffect(() => {
    const photoReadyCount = filteredPlaces.filter((place) => photoById[place.id] != null).length;
    if (photoReadyCount >= RECOMMENDED_LIMIT) {
      setPhotoPoolBusy(false);
      return;
    }

    let active = true;
    const candidates = filteredPlaces
      .filter((place) => photoById[place.id] == null)
      .slice(0, RECOMMENDED_PHOTO_POOL);
    if (candidates.length === 0) {
      setPhotoPoolBusy(false);
      return;
    }

    setPhotoPoolBusy(true);
    void Promise.all(candidates.map(async (place) => {
      const photo = await resolveTrailGuidePlacePhoto(place);
      return photo ? [place.id, photo] as const : null;
    }))
      .then((rows) => {
        if (!active) return;
        const resolved = rows.filter((row): row is readonly [string, TrailGuidePhoto] => row !== null);
        if (resolved.length > 0) setPhotoById((current) => ({ ...current, ...Object.fromEntries(resolved) }));
      })
      .finally(() => {
        if (active) setPhotoPoolBusy(false);
      });

    return () => { active = false; };
  }, [filteredPlaces, photoById]);

  const recommendedPlaces = useMemo(
    () => filteredPlaces.filter((place) => photoById[place.id]).slice(0, RECOMMENDED_LIMIT),
    [filteredPlaces, photoById],
  );

  const recommendedIds = useMemo(() => new Set(recommendedPlaces.map((place) => place.id)), [recommendedPlaces]);
  const explorePreviewPlaces = useMemo(
    () => filteredPlaces.filter((place) => !recommendedIds.has(place.id)).slice(0, EXPLORE_PREVIEW_LIMIT),
    [filteredPlaces, recommendedIds],
  );
  const explorePlaces = showAll ? filteredPlaces : explorePreviewPlaces;

  const rainChance = weather?.forecast.forecastday[0]?.day.daily_chance_of_rain ?? 0;
  const quickGuides = useMemo(() => {
    const preferred = [...GUIDE_ORDER_BY_CATEGORY[category]];
    if (rainChance >= 60) {
      const stormIndex = preferred.indexOf('storm-season');
      if (stormIndex >= 0) preferred.splice(stormIndex, 1);
      preferred.unshift('storm-season');
    }
    return preferred
      .map((id) => trailGuideArticles.find((guide) => guide.id === id))
      .filter((guide): guide is TrailGuideArticle => Boolean(guide))
      .slice(0, 5);
  }, [category, rainChance]);

  const categoryLabel = category === 'All' ? 'places' : `${category.toLowerCase()} spots`;
  const recommendationTitle = category === 'All' ? 'Recommended for today' : `${category} picks for today`;
  const exploreTitle = category === 'All' ? `Explore ${cityName}` : `Explore ${category} in ${cityName}`;

  function formatDistance(place: TrailGuidePlace) {
    const distance = distanceById[place.id];
    if (typeof distance !== 'number') return null;
    return `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} mi`;
  }

  function selectCategory(next: DiscoveryCategory) {
    setCategory(next);
    setShowAll(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
        <ImageBackground source={backgroundSource} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <Text style={styles.heroEyebrow}>TRAIL GUIDE</Text>
            <Text style={styles.cityTitle}>{cityName}</Text>
            <Pressable accessibilityRole="button" onPress={() => void requestCurrentLocation()} style={({ pressed }) => [styles.locationRow, pressed && styles.chipPressed]}>
              <AppIcon name="location" color="#F5C400" size={15} />
              <Text style={styles.locationText}>{locationBusy ? 'Locating…' : coordinates ? locationLabel : 'Use my location'}</Text>
            </Pressable>
            <View style={styles.heroWeatherRow}>
              <View style={styles.heroWeatherCopy}>
                <Text style={styles.heroWeatherTitle}>{weatherBusy ? 'Checking weather…' : weather ? `${Math.round(weather.current.temp_f)}° · ${weather.current.condition.text}` : 'Weather unavailable'}</Text>
                {weather ? <Text style={styles.heroWeatherMeta}>Feels {Math.round(weather.current.feelslike_f)}° · {rainChance}% rain · {Math.round(weather.current.wind_mph)} mph wind</Text> : null}
              </View>
              {weather && rainChance >= 60 ? (
                <View style={styles.weatherSignal}>
                  <AppIcon name="weather" color="#F5C400" size={17} />
                  <Text style={styles.weatherSignalText}>High rain chance</Text>
                </View>
              ) : (
                <AppIcon name="weather" color="#F5C400" size={22} />
              )}
            </View>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.quickGuidesHeader}>
            <View>
              <Text style={styles.sectionTitle}>Quick Guides</Text>
              <Text style={styles.sectionSubtitle}>Helpful tips for your next adventure.</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickGuidesRow}>
            {quickGuides.map((guide) => <QuickGuideCard key={guide.id} guide={guide} />)}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {discoveryCategories.map((item) => {
              const active = category === item;
              return (
                <Pressable key={item} accessibilityRole="button" onPress={() => selectCategory(item)} style={({ pressed }) => [styles.categoryChip, active && styles.categoryChipActive, pressed && styles.chipPressed]}>
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item === 'All' ? 'For You' : item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{recommendationTitle}</Text>
            <Text style={styles.sectionSubtitle}>Top picks based on current conditions{coordinates ? cityKey === 'tampa' ? ' within 50 miles of you.' : ' and your location.' : '.'}</Text>
          </View>
          {recommendedPlaces.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedRow}>
              {recommendedPlaces.map((place) => {
                const photo = photoById[place.id];
                if (!photo) return null;
                return <RecommendedCard key={place.id} place={place} photo={photo} weather={weather} distance={formatDistance(place)} />;
              })}
            </ScrollView>
          ) : (
            <View style={styles.recommendationLoading}>
              <AppIcon name="photo" color="#79D26A" size={18} />
              <Text style={styles.recommendationLoadingText}>{photoPoolBusy ? `Finding ${category === 'All' ? '' : `${category.toLowerCase()} `}picks…` : `No photo-ready ${category === 'All' ? '' : `${category.toLowerCase()} `}picks yet.`}</Text>
            </View>
          )}

          <View style={styles.exploreSectionHeader}>
            <View style={styles.exploreTitleRow}>
              <Text style={styles.sectionTitle}>{exploreTitle}</Text>
              <Text style={styles.dynamicCount}>{filteredPlaces.length} {categoryLabel}</Text>
            </View>
            <Text style={styles.sectionSubtitle}>{cityKey === 'tampa' && coordinates ? 'Outdoor places within 50 miles, ranked for current conditions.' : 'Curated outdoor places ranked for current conditions.'}</Text>
          </View>

          {explorePlaces.length > 0 ? (
            <View style={styles.exploreGrid}>
              {explorePlaces.map((place) => {
                const signal = getTrailGuideConditionSignal(place, weather);
                const distance = formatDistance(place);
                const activities = getActivityIndicators(place);
                return (
                  <Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`Open ${place.name}`} onPress={() => router.push(`/trail-guide/${place.id}` as never)} style={({ pressed }) => [styles.exploreCard, pressed && styles.cardPressed]}>
                    <PlacePhoto place={place} style={styles.exploreImage} />
                    <View style={styles.exploreCopy}>
                      <Text numberOfLines={2} style={styles.exploreName}>{place.name}</Text>
                      <View style={styles.exploreMetaRow}>
                        <Text numberOfLines={1} style={styles.exploreType}>{place.type}</Text>
                        {distance ? <Text style={styles.exploreDistance}>{distance}</Text> : null}
                      </View>
                      {activities.length > 0 ? (
                        <View style={styles.activityRow}>
                          {activities.map((activity) => (
                            <View key={activity.key} style={styles.activityChip}>
                              <Text style={styles.activityGlyph}>{activity.glyph}</Text>
                              <Text style={styles.activityText}>{activity.label}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      <View style={[styles.smallSignal, signal.tone === 'good' && styles.smallSignalGood, signal.tone === 'caution' && styles.smallSignalCaution]}>
                        <Text style={styles.smallSignalText}>{signal.label}</Text>
                      </View>
                    </View>
                    <AppIcon name="chevron-forward" color="#738078" size={18} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No {categoryLabel} yet</Text>
              <Text style={styles.emptyText}>Try another category to keep exploring {cityName}.</Text>
            </View>
          )}

          {filteredPlaces.length > EXPLORE_PREVIEW_LIMIT ? (
            <Pressable accessibilityRole="button" onPress={() => setShowAll((current) => !current)} style={({ pressed }) => [styles.seeAllButton, pressed && styles.chipPressed]}>
              <Text style={styles.seeAllText}>{showAll ? 'Show less' : `See all ${filteredPlaces.length} ${categoryLabel}`}</Text>
              <AppIcon name={showAll ? 'chevron-up' : 'chevron-forward'} color="#79D26A" size={18} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08100C' },
  page: { paddingBottom: 76 },
  hero: { height: 246, justifyContent: 'flex-end' },
  heroImage: { resizeMode: 'cover' },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,7,0.48)' },
  heroContent: { paddingHorizontal: 18, paddingBottom: 16 },
  heroEyebrow: { color: '#D7E0DA', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  cityTitle: { color: '#FFFDF6', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 3 },
  locationRow: { alignSelf: 'flex-start', minHeight: 32, borderRadius: 999, backgroundColor: 'rgba(7,15,10,0.68)', paddingHorizontal: 10, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { color: '#F4F7F4', fontSize: 11, fontWeight: '800' },
  heroWeatherRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroWeatherCopy: { flex: 1 },
  heroWeatherTitle: { color: '#FFFDF6', fontSize: 17, fontWeight: '900' },
  heroWeatherMeta: { color: '#D7DED9', fontSize: 10, lineHeight: 15, marginTop: 3 },
  weatherSignal: { maxWidth: 132, minHeight: 38, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(240,245,241,0.24)', backgroundColor: 'rgba(7,15,10,0.72)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherSignalText: { flexShrink: 1, color: '#FFFDF6', fontSize: 9, lineHeight: 12, fontWeight: '900' },
  body: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },
  quickGuidesHeader: { marginTop: 3, marginBottom: 9 },
  quickGuidesRow: { gap: 9, paddingRight: 4 },
  quickGuideCard: { width: 126, height: 112, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814' },
  quickGuideImage: { flex: 1, justifyContent: 'flex-end', padding: 10 },
  quickGuideImageRadius: { borderRadius: 14 },
  quickGuideShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,9,6,0.38)' },
  quickGuideTitle: { color: '#FFFDF6', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  categoryRow: { gap: 8, paddingTop: 15, paddingBottom: 10, paddingRight: 4 },
  categoryChip: { minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#344139', backgroundColor: '#111A15', paddingHorizontal: 15 },
  categoryChipActive: { backgroundColor: '#79D26A', borderColor: '#79D26A' },
  categoryText: { color: '#F2F5F2', fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#0C140D' },
  sectionHeader: { marginTop: 8, marginBottom: 10 },
  exploreSectionHeader: { marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: '#FFFDF6', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  sectionSubtitle: { color: '#8D9992', fontSize: 11, lineHeight: 16, marginTop: 3 },
  recommendedRow: { gap: 10, paddingRight: 4 },
  recommendationLoading: { minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  recommendationLoadingText: { color: '#AEB9B2', fontSize: 11, fontWeight: '800' },
  recommendedCard: { width: 184, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814' },
  recommendedImage: { height: 126, justifyContent: 'flex-end', padding: 9, overflow: 'hidden' },
  cardShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,9,6,0.24)' },
  signalBadge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#26352D', paddingHorizontal: 8, paddingVertical: 4 },
  signalGood: { backgroundColor: '#1E5A2A' },
  signalCaution: { backgroundColor: '#856A0A' },
  signalBadgeText: { color: '#FFFDF6', fontSize: 9, fontWeight: '900' },
  recommendedCopy: { minHeight: 72, padding: 10 },
  recommendedName: { color: '#FFFDF6', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  recommendedMetaRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  recommendedMeta: { flex: 1, color: '#78D36B', fontSize: 9, fontWeight: '800' },
  recommendedDistance: { color: '#9CA8A1', fontSize: 9, fontWeight: '800' },
  exploreTitleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 7 },
  dynamicCount: { color: '#79D26A', fontSize: 12, fontWeight: '900' },
  exploreGrid: { gap: 8 },
  exploreCard: { minHeight: 126, borderRadius: 15, overflow: 'hidden', backgroundColor: '#101814', borderWidth: 1, borderColor: '#29352E', flexDirection: 'row', alignItems: 'center', paddingRight: 9 },
  exploreImage: { width: 108, alignSelf: 'stretch', minHeight: 126, backgroundColor: '#17201B' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#132119' },
  photoFallbackMark: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3020', borderWidth: 1, borderColor: '#2D4D34' },
  exploreCopy: { flex: 1, paddingVertical: 9, paddingHorizontal: 11 },
  exploreName: { color: '#FFFDF6', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  exploreMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  exploreType: { flex: 1, color: '#79D26A', fontSize: 10, fontWeight: '800' },
  exploreDistance: { color: '#8F9B94', fontSize: 10, fontWeight: '800' },
  activityRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  activityChip: { minHeight: 21, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, borderWidth: 1, borderColor: '#2E4136', backgroundColor: '#16221B', paddingHorizontal: 6, paddingVertical: 2 },
  activityGlyph: { fontSize: 9, lineHeight: 12 },
  activityText: { color: '#C9D3CD', fontSize: 8, lineHeight: 11, fontWeight: '800' },
  smallSignal: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#243029', paddingHorizontal: 7, paddingVertical: 3, marginTop: 5 },
  smallSignalGood: { backgroundColor: '#1D4925' },
  smallSignalCaution: { backgroundColor: '#6C590B' },
  smallSignalText: { color: '#F3F6F3', fontSize: 8, fontWeight: '900' },
  seeAllButton: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#79D26A', marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  seeAllText: { color: '#79D26A', fontSize: 13, fontWeight: '900' },
  emptyState: { borderRadius: 16, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814', padding: 20, alignItems: 'center' },
  emptyTitle: { color: '#FFFDF6', fontSize: 15, fontWeight: '900' },
  emptyText: { color: '#8D9992', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  cardPressed: { opacity: 0.78 },
  chipPressed: { opacity: 0.74 },
});