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
import { trailGuideArticles } from '../../src/trailGuide/guides';
import { distanceMiles, useTrailGuideLocationBackground } from '../../src/trailGuide/locationBackgrounds';
import {
  resolveTrailGuidePlacePhoto,
  type TrailGuidePhoto,
  useTrailGuidePlacePhoto,
} from '../../src/trailGuide/placePhotos';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeatherByQuery, type WeatherForecast } from '../../src/weather/api';

const EXPLORE_PREVIEW_LIMIT = 6;
const RECOMMENDED_LIMIT = 3;
const RECOMMENDED_PHOTO_POOL = 16;

function PlacePhoto({ place, style }: { place: TrailGuidePlace; style: object }) {
  const photo = useTrailGuidePlacePhoto(place);
  if (!photo) {
    return (
      <View style={[style, styles.photoPlaceholder]}>
        <AppIcon name="photo" color="#65726B" size={24} />
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

export default function TrailGuideScreen() {
  const [category, setCategory] = useState<DiscoveryCategory>('All');
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [distanceById, setDistanceById] = useState<Record<string, number>>({});
  const [photoById, setPhotoById] = useState<Record<string, TrailGuidePhoto>>({});
  const [photoPoolBusy, setPhotoPoolBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { backgroundSource, coordinates, locationLabel, locationBusy, requestCurrentLocation } = useTrailGuideLocationBackground();
  const cityKey = cityKeyFromLocationLabel(locationLabel);
  const cityName = cityKey === 'orlando' ? 'Orlando' : 'Jacksonville';

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
    const unresolved = cityPlaces.filter((place) => distanceById[place.id] == null).slice(0, 16);
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

  const rankedCityPlaces = useMemo(() => {
    return [...cityPlaces].sort((a, b) => {
      const conditionDelta = getTrailGuideConditionSignal(b, weather).score - getTrailGuideConditionSignal(a, weather).score;
      if (conditionDelta !== 0) return conditionDelta;
      return (distanceById[a.id] ?? Number.POSITIVE_INFINITY) - (distanceById[b.id] ?? Number.POSITIVE_INFINITY);
    });
  }, [cityPlaces, distanceById, weather]);

  useEffect(() => {
    let active = true;
    const candidates = rankedCityPlaces
      .filter((place) => photoById[place.id] == null)
      .slice(0, RECOMMENDED_PHOTO_POOL);
    if (candidates.length === 0) return;

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
  }, [photoById, rankedCityPlaces]);

  const recommendedPlaces = rankedCityPlaces.filter((place) => photoById[place.id]).slice(0, RECOMMENDED_LIMIT);
  const filteredPlaces = category === 'All' ? rankedCityPlaces : rankedCityPlaces.filter((place) => place.category === category);
  const explorePlaces = showAll ? filteredPlaces : filteredPlaces.slice(0, EXPLORE_PREVIEW_LIMIT);
  const categoryLabel = category === 'All' ? 'places' : `${category.toLowerCase()} spots`;
  const primaryGuideArticles = trailGuideArticles.slice(0, 5);

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
                {weather ? <Text style={styles.heroWeatherMeta}>Feels {Math.round(weather.current.feelslike_f)}° · {weather.forecast.forecastday[0]?.day.daily_chance_of_rain ?? 0}% rain · {Math.round(weather.current.wind_mph)} mph wind</Text> : null}
              </View>
              <AppIcon name="weather" color="#F5C400" size={22} />
            </View>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {discoveryCategories.map((item) => {
              const active = category === item;
              return (
                <Pressable key={item} accessibilityRole="button" onPress={() => selectCategory(item)} style={({ pressed }) => [styles.categoryChip, active && styles.categoryChipActive, pressed && styles.chipPressed]}>
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended today</Text>
            <Text style={styles.sectionSubtitle}>Top picks based on current conditions{coordinates ? ' and your location.' : '.'}</Text>
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
              <Text style={styles.recommendationLoadingText}>{photoPoolBusy ? 'Finding photo-ready picks…' : 'No verified photo-ready picks yet.'}</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Guides & Know-How</Text>
            <Text style={styles.sectionSubtitle}>Tips, guides and inspiration for every adventure.</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guidesRow}>
            {primaryGuideArticles.map((guide) => (
              <Pressable key={guide.id} accessibilityRole="button" onPress={() => router.push(`/trail-guide/guide/${guide.id}` as never)} style={({ pressed }) => [styles.guideCard, pressed && styles.cardPressed]}>
                <ImageBackground source={{ uri: guide.image }} style={styles.guideImage} imageStyle={styles.guideImageRadius}>
                  <View style={styles.cardShade} />
                  <Text style={styles.guideTopic}>{guide.topic.toUpperCase()}</Text>
                </ImageBackground>
                <View style={styles.guideCopy}><Text numberOfLines={2} style={styles.guideTitle}>{guide.title}</Text><Text style={styles.guideAction}>Start here</Text></View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.exploreSectionHeader}>
            <View style={styles.exploreTitleRow}><Text style={styles.sectionTitle}>Explore {cityName}</Text><Text style={styles.dynamicCount}>{filteredPlaces.length} {categoryLabel}</Text></View>
            <Text style={styles.sectionSubtitle}>Real destination photos, curated outdoor places.</Text>
          </View>

          {explorePlaces.length > 0 ? (
            <View style={styles.exploreGrid}>
              {explorePlaces.map((place) => {
                const signal = getTrailGuideConditionSignal(place, weather);
                const distance = formatDistance(place);
                return (
                  <Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`Open ${place.name}`} onPress={() => router.push(`/trail-guide/${place.id}` as never)} style={({ pressed }) => [styles.exploreCard, pressed && styles.cardPressed]}>
                    <PlacePhoto place={place} style={styles.exploreImage} />
                    <View style={styles.exploreCopy}>
                      <Text numberOfLines={2} style={styles.exploreName}>{place.name}</Text>
                      <View style={styles.exploreMetaRow}><Text style={styles.exploreType}>{place.type}</Text>{distance ? <Text style={styles.exploreDistance}>{distance}</Text> : null}</View>
                      <View style={[styles.smallSignal, signal.tone === 'good' && styles.smallSignalGood, signal.tone === 'caution' && styles.smallSignalCaution]}><Text style={styles.smallSignalText}>{signal.label}</Text></View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}><Text style={styles.emptyTitle}>No {categoryLabel} yet</Text><Text style={styles.emptyText}>Try another category to keep exploring {cityName}.</Text></View>
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
  hero: { height: 286, justifyContent: 'flex-end' },
  heroImage: { resizeMode: 'cover' },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,10,7,0.50)' },
  heroContent: { paddingHorizontal: 18, paddingBottom: 18 },
  heroEyebrow: { color: '#D7E0DA', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  cityTitle: { color: '#FFFDF6', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 3 },
  locationRow: { alignSelf: 'flex-start', minHeight: 34, borderRadius: 999, backgroundColor: 'rgba(7,15,10,0.68)', paddingHorizontal: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { color: '#F4F7F4', fontSize: 11, fontWeight: '800' },
  heroWeatherRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroWeatherCopy: { flex: 1 },
  heroWeatherTitle: { color: '#FFFDF6', fontSize: 17, fontWeight: '900' },
  heroWeatherMeta: { color: '#D7DED9', fontSize: 10, lineHeight: 15, marginTop: 3 },
  body: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 6 },
  categoryRow: { gap: 8, paddingVertical: 14, paddingRight: 4 },
  categoryChip: { minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#344139', backgroundColor: '#111A15', paddingHorizontal: 15 },
  categoryChipActive: { backgroundColor: '#79D26A', borderColor: '#79D26A' },
  categoryText: { color: '#F2F5F2', fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#0C140D' },
  sectionHeader: { marginTop: 10, marginBottom: 10 },
  exploreSectionHeader: { marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: '#FFFDF6', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  sectionSubtitle: { color: '#8D9992', fontSize: 11, lineHeight: 16, marginTop: 3 },
  recommendedRow: { gap: 10, paddingRight: 4 },
  recommendationLoading: { minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  recommendationLoadingText: { color: '#AEB9B2', fontSize: 11, fontWeight: '800' },
  recommendedCard: { width: 164, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814' },
  recommendedImage: { height: 118, justifyContent: 'flex-end', padding: 9, overflow: 'hidden' },
  cardShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,9,6,0.24)' },
  signalBadge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#26352D', paddingHorizontal: 8, paddingVertical: 4 },
  signalGood: { backgroundColor: '#1E5A2A' },
  signalCaution: { backgroundColor: '#856A0A' },
  signalBadgeText: { color: '#FFFDF6', fontSize: 9, fontWeight: '900' },
  recommendedCopy: { minHeight: 78, padding: 10 },
  recommendedName: { color: '#FFFDF6', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  recommendedMetaRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  recommendedMeta: { flex: 1, color: '#78D36B', fontSize: 9, fontWeight: '800' },
  recommendedDistance: { color: '#9CA8A1', fontSize: 9, fontWeight: '800' },
  guidesRow: { gap: 10, paddingRight: 4 },
  guideCard: { width: 128, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814' },
  guideImage: { height: 94, justifyContent: 'flex-end', padding: 9 },
  guideImageRadius: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  guideTopic: { color: '#FFFDF6', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  guideCopy: { minHeight: 72, padding: 9 },
  guideTitle: { color: '#FFFDF6', fontSize: 11, lineHeight: 15, fontWeight: '900' },
  guideAction: { color: '#79D26A', fontSize: 9, fontWeight: '800', marginTop: 5 },
  exploreTitleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 7 },
  dynamicCount: { color: '#79D26A', fontSize: 12, fontWeight: '900' },
  exploreGrid: { gap: 9 },
  exploreCard: { minHeight: 108, borderRadius: 16, overflow: 'hidden', backgroundColor: '#101814', borderWidth: 1, borderColor: '#29352E', flexDirection: 'row' },
  exploreImage: { width: 112, minHeight: 108, backgroundColor: '#17201B' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#17201B' },
  exploreCopy: { flex: 1, padding: 11 },
  exploreName: { color: '#FFFDF6', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  exploreMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  exploreType: { color: '#79D26A', fontSize: 10, fontWeight: '800' },
  exploreDistance: { color: '#8F9B94', fontSize: 10, fontWeight: '800' },
  smallSignal: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#243029', paddingHorizontal: 7, paddingVertical: 3, marginTop: 7 },
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