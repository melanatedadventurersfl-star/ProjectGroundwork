import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { resolveTrailGuidePrimaryPhoto, type TrailGuideHeroPhoto, useTrailGuidePrimaryPhoto } from '../../src/trailGuide/heroSelection';
import {
  distanceMiles,
  TRAIL_GUIDE_SELECTABLE_CITIES,
  useTrailGuideLocationBackground,
} from '../../src/trailGuide/locationBackgrounds';
import { AppIcon } from '../../src/ui/AppIcon';
import { getWeatherByQuery, type WeatherForecast } from '../../src/weather/api';

const EXPLORE_PREVIEW_LIMIT = 6;
const RECOMMENDED_LIMIT = 4;
const PHOTO_POOL_TARGET = 8;
const MAX_TRAIL_GUIDE_RADIUS_MILES = 50;
const TRAIL_GUIDE_SCROLL_MEMORY = new Map<string, number>();

const GUIDE_ORDER_BY_CATEGORY: Record<DiscoveryCategory, string[]> = {
  All: ['camping-essentials', 'florida-heat-safety', 'hiking-safety', 'leave-no-trace', 'paddling-basics'],
  Hiking: ['hiking-safety', 'florida-heat-safety', 'leave-no-trace', 'wildlife-awareness', 'storm-season'],
  Camping: ['camping-essentials', 'first-camping-trip', 'florida-heat-safety', 'wildlife-awareness', 'leave-no-trace'],
  Parks: ['family-outdoors', 'wildlife-awareness', 'leave-no-trace', 'florida-heat-safety', 'storm-season'],
  Water: ['paddling-basics', 'storm-season', 'florida-heat-safety', 'wildlife-awareness', 'family-outdoors'],
  Scenic: ['weekend-planning', 'florida-heat-safety', 'wildlife-awareness', 'leave-no-trace', 'storm-season'],
};

const CITY_DESCRIPTORS: Record<string, string> = {
  jacksonville: 'River · Coast · Marsh · Trails',
  orlando: 'Springs · Lakes · Trails · Parks',
  miami: 'Coast · Mangroves · Water · Parks',
  tampa: 'Bay · River · Trails · Parks',
  'st-petersburg': 'Coast · Parks · Water · Trails',
  'fort-lauderdale': 'Coast · Water · Parks · Trails',
  'west-palm-beach': 'Coast · Water · Parks · Trails',
  naples: 'Coast · Preserves · Water · Trails',
  'fort-myers': 'River · Coast · Preserves · Trails',
  sarasota: 'Coast · Parks · Water · Trails',
};

type ActivityIndicator = { key: string; label: string; glyph: string };

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
  const searchable = [place.category, place.type, ...place.tags, ...place.collections, place.meta, place.summary].join(' ').toLowerCase();
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

  return categoryPriority[place.category]
    .filter((key) => matches.has(key))
    .slice(0, 3)
    .map((key) => ACTIVITY_DEFINITIONS.find((activity) => activity.key === key))
    .filter((activity): activity is ActivityIndicator => Boolean(activity));
}

function guideAccent(topic: string) {
  if (topic === 'Camping') return '#D7B45A';
  if (topic === 'Water') return '#61BFC4';
  if (topic === 'Hiking') return '#93C66D';
  if (topic === 'Conditions') return '#E39B55';
  if (topic === 'Wildlife') return '#A9C579';
  if (topic === 'Family') return '#E0BF79';
  if (topic === 'Stewardship') return '#78A982';
  return '#D7B45A';
}

function guideCategoryPreferences(topic: string): DiscoveryCategory[] {
  if (topic === 'Camping') return ['Camping', 'Parks', 'Scenic'];
  if (topic === 'Water') return ['Water', 'Parks', 'Scenic'];
  if (topic === 'Hiking') return ['Hiking', 'Parks', 'Scenic'];
  if (topic === 'Family') return ['Parks', 'Water', 'Hiking'];
  if (topic === 'Wildlife') return ['Parks', 'Scenic', 'Water'];
  if (topic === 'Conditions') return ['Scenic', 'Hiking', 'Water'];
  return ['Parks', 'Scenic', 'Hiking'];
}

function weatherUpdatedLabel(weather: WeatherForecast | null) {
  const localtime = weather?.location.localtime;
  if (!localtime) return null;
  const time = localtime.split(' ')[1];
  return time ? `Updated ${time}` : null;
}

function PlacePhoto({ place, style }: { place: TrailGuidePlace; style: object }) {
  const photo = useTrailGuidePrimaryPhoto(place);
  const [failed, setFailed] = useState(false);
  if (!photo || failed) {
    return (
      <View style={[style, styles.photoPlaceholder]}>
        <View style={styles.photoFallbackMark}><AppIcon name="trail" color="#79D26A" size={22} /></View>
      </View>
    );
  }
  return <Image source={{ uri: photo.url }} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

function QuickGuideCard({ guide, photo }: { guide: TrailGuideArticle; photo?: TrailGuideHeroPhoto }) {
  const [failed, setFailed] = useState(false);
  const accent = guideAccent(guide.topic);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${guide.title}`}
      onPress={() => router.push(`/trail-guide/guide/${guide.id}` as never)}
      style={({ pressed }) => [styles.quickGuideCard, { borderColor: accent }, pressed && styles.cardPressed]}
    >
      {photo && !failed ? (
        <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.quickGuideFallback]}>
          <AppIcon name={guide.topic === 'Water' ? 'weather' : guide.topic === 'Camping' ? 'trail' : 'guide'} color={accent} size={28} />
        </View>
      )}
      <View style={styles.quickGuideShade} />
      <View style={[styles.quickGuideTopicPill, { borderColor: accent }]}>
        <Text style={[styles.quickGuideTopic, { color: accent }]}>{guide.topic.toUpperCase()}</Text>
      </View>
      <Text numberOfLines={3} style={styles.quickGuideTitle}>{guide.title}</Text>
    </Pressable>
  );
}

function RecommendedCard({ place, photo, weather, distance }: { place: TrailGuidePlace; photo: TrailGuideHeroPhoto; weather: WeatherForecast | null; distance: string | null }) {
  const signal = getTrailGuideConditionSignal(place, weather);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${place.name}`} onPress={() => router.push(`/trail-guide/${place.id}` as never)} style={({ pressed }) => [styles.recommendedCard, pressed && styles.cardPressed]}>
      <View style={styles.recommendedImage}>
        <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={styles.cardShade} />
        <View style={[styles.signalBadge, signal.tone === 'good' && styles.signalGood, signal.tone === 'caution' && styles.signalCaution]}><Text style={styles.signalBadgeText}>{signal.label}</Text></View>
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

function FeaturedDestinationCard({ place, photo, weather, distance }: { place: TrailGuidePlace; photo: TrailGuideHeroPhoto; weather: WeatherForecast | null; distance: string | null }) {
  const signal = getTrailGuideConditionSignal(place, weather);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open featured destination ${place.name}`} onPress={() => router.push(`/trail-guide/${place.id}` as never)} style={({ pressed }) => [styles.featuredCard, pressed && styles.cardPressed]}>
      <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <View style={styles.featuredShade} />
      <View style={styles.featuredTopRow}>
        <View style={styles.featuredLabel}><Text style={styles.featuredLabelText}>BEST RIGHT NOW</Text></View>
        <View style={[styles.signalBadge, signal.tone === 'good' && styles.signalGood, signal.tone === 'caution' && styles.signalCaution]}><Text style={styles.signalBadgeText}>{signal.label}</Text></View>
      </View>
      <View style={styles.featuredCopy}>
        <Text style={styles.featuredName}>{place.name}</Text>
        <Text numberOfLines={2} style={styles.featuredSummary}>{place.summary}</Text>
        <View style={styles.featuredMetaRow}>
          <Text style={styles.featuredMeta}>{place.type}</Text>
          {distance ? <Text style={styles.featuredDistance}>{distance}</Text> : null}
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
  const [photoById, setPhotoById] = useState<Record<string, TrailGuideHeroPhoto>>({});
  const [photoPoolBusy, setPhotoPoolBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const restoredScrollKey = useRef<string | null>(null);

  const { backgroundSource, coordinates, locationLabel, locationBusy, manualCityKey, selectCity, requestCurrentLocation } = useTrailGuideLocationBackground();
  const cityKey = cityKeyFromLocationLabel(locationLabel);
  const selectedCity = TRAIL_GUIDE_SELECTABLE_CITIES.find((city) => city.key === cityKey);
  const cityName = selectedCity?.label.replace(', FL', '') ?? locationLabel.replace(', FL', '');
  const cityDescriptor = CITY_DESCRIPTORS[cityKey] ?? 'Trails · Parks · Water · Camping';
  const scrollKey = `${cityKey}:${category}`;

  useEffect(() => {
    let active = true;
    setWeatherBusy(true);
    void getWeatherByQuery(`${cityName}, FL`)
      .then((data) => { if (active) setWeather(data); })
      .catch(() => { if (active) setWeather(null); })
      .finally(() => { if (active) setWeatherBusy(false); });
    return () => { active = false; };
  }, [cityName]);

  useEffect(() => {
    restoredScrollKey.current = null;
  }, [scrollKey]);

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
    if (!coordinates) return cityPlaces;
    return cityPlaces.filter((place) => {
      const distance = distanceById[place.id];
      return typeof distance !== 'number' || distance <= MAX_TRAIL_GUIDE_RADIUS_MILES;
    });
  }, [cityPlaces, coordinates, distanceById]);

  const rankedCityPlaces = useMemo(() => [...radiusCityPlaces].sort((a, b) => {
    const conditionDelta = getTrailGuideConditionSignal(b, weather).score - getTrailGuideConditionSignal(a, weather).score;
    if (conditionDelta !== 0) return conditionDelta;
    return (distanceById[a.id] ?? Number.POSITIVE_INFINITY) - (distanceById[b.id] ?? Number.POSITIVE_INFINITY);
  }), [radiusCityPlaces, distanceById, weather]);

  const filteredPlaces = useMemo(() => category === 'All' ? rankedCityPlaces : rankedCityPlaces.filter((place) => place.category === category), [category, rankedCityPlaces]);

  useEffect(() => {
    const readyCount = cityPlaces.filter((place) => photoById[place.id] != null).length;
    if (readyCount >= Math.min(PHOTO_POOL_TARGET, cityPlaces.length)) {
      setPhotoPoolBusy(false);
      return;
    }

    let active = true;
    const priority = [
      ...filteredPlaces,
      ...cityPlaces.filter((place) => !filteredPlaces.some((candidate) => candidate.id === place.id)),
    ];
    const candidates = priority.filter((place) => photoById[place.id] == null).slice(0, Math.max(1, PHOTO_POOL_TARGET - readyCount));
    if (candidates.length === 0) {
      setPhotoPoolBusy(false);
      return;
    }

    setPhotoPoolBusy(true);
    void Promise.all(candidates.map(async (place) => {
      const photo = await resolveTrailGuidePrimaryPhoto(place);
      return photo ? [place.id, photo] as const : null;
    })).then((rows) => {
      if (!active) return;
      const resolved = rows.filter((row): row is readonly [string, TrailGuideHeroPhoto] => row !== null);
      if (resolved.length > 0) setPhotoById((current) => ({ ...current, ...Object.fromEntries(resolved) }));
    }).finally(() => { if (active) setPhotoPoolBusy(false); });

    return () => { active = false; };
  }, [cityPlaces, filteredPlaces, photoById]);

  const recommendedPlaces = useMemo(() => filteredPlaces.filter((place) => photoById[place.id]).slice(0, RECOMMENDED_LIMIT), [filteredPlaces, photoById]);
  const featuredPlace = recommendedPlaces[0] ?? null;
  const featuredPhoto = featuredPlace ? photoById[featuredPlace.id] ?? null : null;
  const secondaryRecommendedPlaces = featuredPlace ? recommendedPlaces.filter((place) => place.id !== featuredPlace.id) : recommendedPlaces;
  const explorePreviewPlaces = useMemo(() => filteredPlaces.slice(0, EXPLORE_PREVIEW_LIMIT), [filteredPlaces]);
  const explorePlaces = showAll ? filteredPlaces : explorePreviewPlaces;

  const rainChance = weather?.forecast.forecastday[0]?.day.daily_chance_of_rain ?? 0;
  const quickGuides = useMemo(
    () => GUIDE_ORDER_BY_CATEGORY[category].map((id) => trailGuideArticles.find((guide) => guide.id === id)).filter((guide): guide is TrailGuideArticle => Boolean(guide)).slice(0, 5),
    [category],
  );
  const guidePhotoById = useMemo(() => {
    const result: Record<string, TrailGuideHeroPhoto | undefined> = {};
    for (const guide of quickGuides) {
      const preferences = guideCategoryPreferences(guide.topic);
      for (const preferredCategory of preferences) {
        const candidate = cityPlaces.find((place) => place.category === preferredCategory && photoById[place.id]);
        if (candidate) {
          result[guide.id] = photoById[candidate.id];
          break;
        }
      }
    }
    return result;
  }, [cityPlaces, photoById, quickGuides]);

  const categoryLabel = category === 'All' ? 'places' : `${category.toLowerCase()} spots`;
  const recommendationTitle = category === 'All' ? 'More Good Picks' : `More ${category} Picks`;
  const exploreTitle = category === 'All' ? `Explore ${cityName}` : `Explore ${category} in ${cityName}`;
  const updatedWeather = weatherUpdatedLabel(weather);

  function formatDistance(place: TrailGuidePlace) {
    const distance = distanceById[place.id];
    if (typeof distance !== 'number') return null;
    return `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} mi`;
  }

  function selectCategory(next: DiscoveryCategory) {
    setCategory(next);
    setShowAll(false);
  }

  async function chooseCity(nextCityKey: string) {
    setShowCityPicker(false);
    setCategory('All');
    setShowAll(false);
    setDistanceById({});
    setPhotoById({});
    await selectCity(nextCityKey);
  }

  async function chooseCurrentLocation() {
    setShowCityPicker(false);
    setCategory('All');
    setShowAll(false);
    setDistanceById({});
    setPhotoById({});
    await requestCurrentLocation();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
        scrollEventThrottle={120}
        onScroll={(event) => TRAIL_GUIDE_SCROLL_MEMORY.set(scrollKey, event.nativeEvent.contentOffset.y)}
        onContentSizeChange={() => {
          if (restoredScrollKey.current === scrollKey) return;
          scrollRef.current?.scrollTo({ y: TRAIL_GUIDE_SCROLL_MEMORY.get(scrollKey) ?? 0, animated: false });
          restoredScrollKey.current = scrollKey;
        }}
      >
        <ImageBackground source={backgroundSource} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <Text style={styles.heroEyebrow}>TRAIL GUIDE</Text>
            <Text style={styles.cityTitle}>{cityName}</Text>
            <Text style={styles.cityDescriptor}>{cityDescriptor}</Text>

            <View style={styles.heroControlRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Change Trail Guide city" onPress={() => setShowCityPicker((current) => !current)} style={({ pressed }) => [styles.locationRow, pressed && styles.chipPressed]}>
                <AppIcon name="location" color="#F5C400" size={15} />
                <Text style={styles.locationText}>{locationBusy ? 'Updating…' : locationLabel}</Text>
                <AppIcon name={showCityPicker ? 'chevron-up' : 'chevron-forward'} color="#F4F7F4" size={13} />
              </Pressable>
            </View>

            {showCityPicker ? (
              <View style={styles.cityPicker}>
                <Text style={styles.cityPickerLabel}>View Trail Guide for</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityPickerRow}>
                  {TRAIL_GUIDE_SELECTABLE_CITIES.map((city) => {
                    const active = city.key === cityKey;
                    return <Pressable key={city.key} accessibilityRole="button" onPress={() => void chooseCity(city.key)} style={({ pressed }) => [styles.cityOption, active && styles.cityOptionActive, pressed && styles.chipPressed]}><Text style={[styles.cityOptionText, active && styles.cityOptionTextActive]}>{city.label.replace(', FL', '')}</Text></Pressable>;
                  })}
                  <Pressable accessibilityRole="button" onPress={() => void chooseCurrentLocation()} style={({ pressed }) => [styles.cityOption, manualCityKey == null && styles.cityOptionActive, pressed && styles.chipPressed]}>
                    <AppIcon name="location" color={manualCityKey == null ? '#0C140D' : '#F5C400'} size={12} />
                    <Text style={[styles.cityOptionText, manualCityKey == null && styles.cityOptionTextActive]}>My location</Text>
                  </Pressable>
                </ScrollView>
              </View>
            ) : null}

            {weatherBusy || weather ? (
              <View style={styles.weatherPanel}>
                {weatherBusy && !weather ? (
                  <View style={styles.weatherLoadingRow}><AppIcon name="weather" color="#F5C400" size={20} /><Text style={styles.weatherLoadingText}>Checking current conditions…</Text></View>
                ) : weather ? (
                  <>
                    <View style={styles.weatherMainRow}>
                      <Text style={styles.weatherTemperature}>{Math.round(weather.current.temp_f)}°</Text>
                      <View style={styles.weatherConditionCopy}>
                        <Text style={styles.weatherCondition}>{weather.current.condition.text}</Text>
                        <Text style={styles.weatherDetails}>Feels {Math.round(weather.current.feelslike_f)}° · {rainChance}% rain · {Math.round(weather.current.wind_mph)} mph wind</Text>
                      </View>
                    </View>
                    <View style={styles.weatherFootRow}>
                      {rainChance >= 60 ? <View style={styles.weatherSignal}><AppIcon name="weather" color="#F5C400" size={14} /><Text style={styles.weatherSignalText}>High Rain Chance</Text></View> : <Text style={styles.weatherCalmText}>Conditions factored into today's picks</Text>}
                      {updatedWeather ? <Text style={styles.weatherUpdated}>{updatedWeather}</Text> : null}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.guideShelf}>
            <View style={styles.quickGuidesHeader}>
              <View style={styles.flex}>
                <Text style={styles.guideShelfTitle}>Quick Guides</Text>
                <Text style={styles.guideShelfSubtitle}>Florida-ready help before you head out.</Text>
              </View>
              <Pressable onPress={() => router.push('/trail-guide/guides' as never)} style={({ pressed }) => [styles.seeGuidesButton, pressed && styles.chipPressed]}>
                <Text style={styles.seeGuidesText}>See All</Text>
                <AppIcon name="chevron-forward" color="#6B5927" size={14} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickGuidesRow}>
              {quickGuides.map((guide) => <QuickGuideCard key={guide.id} guide={guide} photo={guidePhotoById[guide.id]} />)}
              <Pressable onPress={() => router.push('/trail-guide/guides' as never)} style={({ pressed }) => [styles.moreGuidesCard, pressed && styles.cardPressed]}>
                <AppIcon name="guide" color="#6B5927" size={24} />
                <Text style={styles.moreGuidesTitle}>More Guides</Text>
                <Text style={styles.moreGuidesBody}>Safety, camping, water, weather, and planning.</Text>
              </Pressable>
            </ScrollView>
            <Text style={styles.swipeHint}>Swipe for more →</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {discoveryCategories.map((item) => {
              const active = category === item;
              return <Pressable key={item} accessibilityRole="button" onPress={() => selectCategory(item)} style={({ pressed }) => [styles.categoryChip, active && styles.categoryChipActive, pressed && styles.chipPressed]}><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item === 'All' ? 'For You' : item}</Text></Pressable>;
            })}
          </ScrollView>

          {featuredPlace && featuredPhoto ? (
            <View style={styles.featuredSection}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.flex}><Text style={styles.sectionTitle}>Best Right Now</Text><Text style={styles.sectionSubtitle}>A local pick ranked for current conditions.</Text></View>
                <Text style={styles.cityMicroLabel}>{cityName}</Text>
              </View>
              <FeaturedDestinationCard place={featuredPlace} photo={featuredPhoto} weather={weather} distance={formatDistance(featuredPlace)} />
            </View>
          ) : null}

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{recommendationTitle}</Text><Text style={styles.sectionSubtitle}>More places worth a look based on {cityName} conditions{coordinates ? ' within 50 miles.' : '.'}</Text></View>
          {secondaryRecommendedPlaces.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedRow}>
              {secondaryRecommendedPlaces.map((place) => {
                const photo = photoById[place.id];
                return photo ? <RecommendedCard key={place.id} place={place} photo={photo} weather={weather} distance={formatDistance(place)} /> : null;
              })}
            </ScrollView>
          ) : <View style={styles.recommendationLoading}><AppIcon name="photo" color="#79D26A" size={18} /><Text style={styles.recommendationLoadingText}>{photoPoolBusy ? `Finding ${category === 'All' ? '' : `${category.toLowerCase()} `}picks…` : `No photo-ready ${category === 'All' ? '' : `${category.toLowerCase()} `}picks yet.`}</Text></View>}

          <View style={styles.exploreSectionHeader}>
            <View style={styles.exploreTitleRow}><Text style={styles.sectionTitle}>{exploreTitle}</Text><Text style={styles.dynamicCount}>{filteredPlaces.length} {categoryLabel}</Text></View>
            <Text style={styles.sectionSubtitle}>{coordinates ? 'Outdoor places within 50 miles, ranked for current conditions.' : 'Curated outdoor places ranked for current conditions.'}</Text>
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
                      <View style={styles.exploreMetaRow}><Text numberOfLines={1} style={styles.exploreType}>{place.type}</Text>{distance ? <Text style={styles.exploreDistance}>{distance}</Text> : null}</View>
                      {activities.length > 0 ? <View style={styles.activityRow}>{activities.map((activity) => <View key={activity.key} style={styles.activityChip}><Text style={styles.activityGlyph}>{activity.glyph}</Text><Text style={styles.activityText}>{activity.label}</Text></View>)}</View> : null}
                      <View style={[styles.smallSignal, signal.tone === 'good' && styles.smallSignalGood, signal.tone === 'caution' && styles.smallSignalCaution]}><Text style={styles.smallSignalText}>{signal.label}</Text></View>
                    </View>
                    <AppIcon name="chevron-forward" color="#839087" size={20} />
                  </Pressable>
                );
              })}
            </View>
          ) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>No {categoryLabel} yet</Text><Text style={styles.emptyText}>Try another category to keep exploring {cityName}.</Text></View>}

          {filteredPlaces.length > EXPLORE_PREVIEW_LIMIT ? <Pressable accessibilityRole="button" onPress={() => setShowAll((current) => !current)} style={({ pressed }) => [styles.seeAllButton, pressed && styles.chipPressed]}><Text style={styles.seeAllText}>{showAll ? 'Show Less' : `See All ${filteredPlaces.length} ${categoryLabel}`}</Text><AppIcon name={showAll ? 'chevron-up' : 'chevron-forward'} color="#79D26A" size={18} /></Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08100C' },
  page: { paddingBottom: 78, backgroundColor: '#08100C' },
  flex: { flex: 1 },
  hero: { height: 208, flexShrink: 0, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: '#08100C' },
  heroImage: { resizeMode: 'cover' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.28)' },
  heroContent: { paddingHorizontal: 18, paddingBottom: 12, paddingTop: 22 },
  heroEyebrow: { color: '#F2EEE4', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  cityTitle: { color: '#FFFDF6', fontSize: 31, lineHeight: 34, fontWeight: '900', marginTop: 2 },
  cityDescriptor: { color: '#E1D8C3', fontSize: 9.5, fontWeight: '800', marginTop: 2, letterSpacing: 0.25 },
  heroControlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  locationRow: { alignSelf: 'flex-start', minHeight: 36, borderRadius: 999, backgroundColor: 'rgba(7,15,10,0.78)', borderWidth: 1, borderColor: 'rgba(244,247,244,0.18)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { color: '#F4F7F4', fontSize: 10.5, fontWeight: '800' },
  cityPicker: { marginTop: 7, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(240,245,241,0.20)', backgroundColor: 'rgba(7,15,10,0.92)', paddingVertical: 8, paddingHorizontal: 9 },
  cityPickerLabel: { color: '#C9D3CD', fontSize: 9, fontWeight: '800', marginBottom: 6 },
  cityPickerRow: { gap: 6, paddingRight: 4 },
  cityOption: { minHeight: 34, borderRadius: 999, borderWidth: 1, borderColor: '#4A5850', backgroundColor: 'rgba(18,28,22,0.96)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  cityOptionActive: { backgroundColor: '#79D26A', borderColor: '#79D26A' },
  cityOptionText: { color: '#F4F7F4', fontSize: 10, fontWeight: '900' },
  cityOptionTextActive: { color: '#0C140D' },
  weatherPanel: { marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(240,245,241,0.18)', backgroundColor: 'rgba(8,18,12,0.76)', paddingHorizontal: 11, paddingVertical: 8 },
  weatherMainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weatherTemperature: { color: '#FFFDF6', fontSize: 28, lineHeight: 31, fontWeight: '900' },
  weatherConditionCopy: { flex: 1 },
  weatherCondition: { color: '#FFFDF6', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  weatherDetails: { color: '#D5DDD7', fontSize: 9, lineHeight: 13, marginTop: 1 },
  weatherFootRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  weatherSignal: { borderRadius: 999, backgroundColor: 'rgba(89,72,16,0.78)', paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherSignalText: { color: '#FFF3C6', fontSize: 7.5, fontWeight: '900' },
  weatherCalmText: { color: '#B7C1BB', fontSize: 7.5, fontWeight: '800' },
  weatherUpdated: { color: '#9BA79F', fontSize: 7, fontWeight: '700' },
  weatherLoadingRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherLoadingText: { color: '#E5E9E6', fontSize: 10, fontWeight: '800' },
  body: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 12, backgroundColor: '#08100C' },
  guideShelf: { marginHorizontal: -2, borderRadius: 20, backgroundColor: '#EAE1C8', paddingHorizontal: 13, paddingTop: 13, paddingBottom: 10, borderWidth: 1, borderColor: '#B9A66F' },
  quickGuidesHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  guideShelfTitle: { color: '#17211C', fontSize: 21, lineHeight: 24, fontWeight: '900' },
  guideShelfSubtitle: { color: '#59635D', fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  seeGuidesButton: { minHeight: 34, borderRadius: 999, borderWidth: 1, borderColor: '#9D8A51', backgroundColor: '#F5EEDB', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeGuidesText: { color: '#5D4D21', fontSize: 9, fontWeight: '900' },
  quickGuidesRow: { gap: 10, paddingRight: 2 },
  quickGuideCard: { width: 158, height: 142, borderRadius: 17, overflow: 'hidden', borderWidth: 2, backgroundColor: '#17251B', padding: 11, justifyContent: 'flex-end' },
  quickGuideFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#203126' },
  quickGuideShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.22)' },
  quickGuideTopicPill: { position: 'absolute', top: 9, left: 9, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(6,12,8,0.78)', paddingHorizontal: 7, paddingVertical: 4 },
  quickGuideTopic: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  quickGuideTitle: { color: '#FFFDF6', fontSize: 14.5, lineHeight: 17, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  moreGuidesCard: { width: 142, height: 142, borderRadius: 17, borderWidth: 1, borderColor: '#A69158', backgroundColor: '#F5EEDB', padding: 12, justifyContent: 'center', gap: 5 },
  moreGuidesTitle: { color: '#17211C', fontSize: 13, fontWeight: '900' },
  moreGuidesBody: { color: '#626A64', fontSize: 9, lineHeight: 12 },
  swipeHint: { color: '#6D746F', fontSize: 7.5, fontWeight: '800', textAlign: 'right', marginTop: 7 },
  categoryRow: { gap: 8, paddingTop: 16, paddingBottom: 5, paddingRight: 4 },
  categoryChip: { minHeight: 44, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#344139', backgroundColor: '#111A15', paddingHorizontal: 16 },
  categoryChipActive: { backgroundColor: '#79D26A', borderColor: '#79D26A' },
  categoryText: { color: '#F2F5F2', fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#0C140D' },
  featuredSection: { marginTop: 15 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 9 },
  cityMicroLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  featuredCard: { height: 218, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#59654E', backgroundColor: '#111A15' },
  featuredShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.25)' },
  featuredTopRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredLabel: { borderRadius: 999, backgroundColor: '#EAE1C8', paddingHorizontal: 9, paddingVertical: 5 },
  featuredLabelText: { color: '#17211C', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  featuredCopy: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: 'rgba(5,10,7,0.72)' },
  featuredName: { color: '#FFFDF6', fontSize: 20, lineHeight: 23, fontWeight: '900' },
  featuredSummary: { color: '#D9E0DB', fontSize: 10, lineHeight: 14, marginTop: 4 },
  featuredMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  featuredMeta: { color: '#8EE17E', fontSize: 9, fontWeight: '900' },
  featuredDistance: { color: '#D9E0DB', fontSize: 9, fontWeight: '800' },
  sectionHeader: { marginTop: 22, marginBottom: 10 },
  exploreSectionHeader: { marginTop: 25, marginBottom: 12 },
  sectionTitle: { color: '#FFFDF6', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  sectionSubtitle: { color: '#8D9992', fontSize: 10, lineHeight: 15, marginTop: 3 },
  recommendedRow: { gap: 10, paddingRight: 4 },
  recommendationLoading: { minHeight: 76, borderRadius: 16, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  recommendationLoadingText: { color: '#AEB9B2', fontSize: 10, fontWeight: '800' },
  recommendedCard: { width: 188, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#36433A', backgroundColor: '#111A15' },
  recommendedImage: { height: 128, justifyContent: 'flex-end', padding: 9, overflow: 'hidden' },
  cardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,9,6,0.16)' },
  signalBadge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#26352D', paddingHorizontal: 8, paddingVertical: 4 },
  signalGood: { backgroundColor: '#1E5A2A' },
  signalCaution: { backgroundColor: '#856A0A' },
  signalBadgeText: { color: '#FFFDF6', fontSize: 8, fontWeight: '900' },
  recommendedCopy: { minHeight: 72, padding: 10 },
  recommendedName: { color: '#FFFDF6', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  recommendedMetaRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  recommendedMeta: { flex: 1, color: '#78D36B', fontSize: 9, fontWeight: '800' },
  recommendedDistance: { color: '#9CA8A1', fontSize: 9, fontWeight: '800' },
  exploreTitleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 7 },
  dynamicCount: { color: '#79D26A', fontSize: 12, fontWeight: '900' },
  exploreGrid: { gap: 9 },
  exploreCard: { minHeight: 132, borderRadius: 17, overflow: 'hidden', backgroundColor: '#111A15', borderWidth: 1, borderColor: '#334139', flexDirection: 'row', alignItems: 'center', paddingRight: 9 },
  exploreImage: { width: 112, alignSelf: 'stretch', minHeight: 132, backgroundColor: '#17201B' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#132119' },
  photoFallbackMark: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3020', borderWidth: 1, borderColor: '#2D4D34' },
  exploreCopy: { flex: 1, paddingVertical: 10, paddingHorizontal: 11 },
  exploreName: { color: '#FFFDF6', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  exploreMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  exploreType: { flex: 1, color: '#79D26A', fontSize: 10, fontWeight: '800' },
  exploreDistance: { color: '#8F9B94', fontSize: 10, fontWeight: '800' },
  activityRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  activityChip: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, borderWidth: 1, borderColor: '#2E4136', backgroundColor: '#18241D', paddingHorizontal: 6, paddingVertical: 2 },
  activityGlyph: { fontSize: 9, lineHeight: 12 },
  activityText: { color: '#D0D8D3', fontSize: 8, lineHeight: 11, fontWeight: '800' },
  smallSignal: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#243029', paddingHorizontal: 7, paddingVertical: 3, marginTop: 6 },
  smallSignalGood: { backgroundColor: '#1D4925' },
  smallSignalCaution: { backgroundColor: '#6C590B' },
  smallSignalText: { color: '#F3F6F3', fontSize: 8, fontWeight: '900' },
  seeAllButton: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#79D26A', marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  seeAllText: { color: '#79D26A', fontSize: 13, fontWeight: '900' },
  emptyState: { borderRadius: 16, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#101814', padding: 20, alignItems: 'center' },
  emptyTitle: { color: '#FFFDF6', fontSize: 15, fontWeight: '900' },
  emptyText: { color: '#8D9992', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  chipPressed: { opacity: 0.76 },
});
