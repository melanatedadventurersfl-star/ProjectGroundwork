import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { MemberBadge } from '../passport/api';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { getWeatherByCoordinates, type WeatherForecast } from '../weather/api';
import { TrailheadHeader } from './TrailheadHeader';
import {
  backgroundFor,
  dayPhaseFor,
  glyph,
  greetingFor,
  normalizeWeather,
  rankThemes,
  trailheadDebugOverride,
  weatherCopy,
  type DayPhase,
  type WeatherTheme,
} from './trailheadBannerConfig';

const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const CLOCK_REFRESH_MS = 60 * 1000;
const HEADER_INSET = 78;

function atmosphereColor(weather: WeatherTheme, phase: DayPhase) {
  if (phase === 'night') return 'rgba(4, 13, 28, 0.06)';
  if (weather === 'storm') return 'rgba(18, 24, 31, 0.08)';
  if (weather === 'rain') return 'rgba(16, 31, 39, 0.06)';
  if (weather === 'fog') return 'rgba(214, 225, 220, 0.05)';
  if (weather === 'cloudy' || weather === 'snow') return 'rgba(92, 108, 110, 0.04)';
  if (phase === 'morning') return 'rgba(255, 224, 168, 0.04)';
  if (phase === 'evening') return 'rgba(255, 150, 76, 0.04)';
  return 'transparent';
}

function backgroundLiftColor(weather: WeatherTheme, phase: DayPhase) {
  if (phase === 'night') return 'rgba(255, 244, 222, 0.035)';
  if (weather === 'storm') return 'rgba(245, 248, 250, 0.12)';
  if (weather === 'rain') return 'rgba(245, 249, 250, 0.14)';
  if (weather === 'cloudy' || weather === 'partly-cloudy' || weather === 'fog' || weather === 'snow' || weather === 'windy') {
    return 'rgba(255, 252, 242, 0.18)';
  }
  if (phase === 'morning') return 'rgba(255, 246, 225, 0.06)';
  if (phase === 'evening') return 'rgba(255, 226, 196, 0.05)';
  return 'rgba(255, 255, 255, 0.025)';
}

export function TrailheadOptimizedCover({
  displayName,
  rank,
}: {
  coverUrl?: string | null;
  displayName: string;
  rank: RankName;
  badges?: MemberBadge[];
  greeting: string;
  busy?: boolean;
  onEdit?: () => void;
  onRankPress?: () => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const veryCompact = width < 370;
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [clockNow, setClockNow] = useState(() => new Date());
  const [backgroundFailed, setBackgroundFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let weatherTimer: ReturnType<typeof setInterval> | null = null;

    const refreshWeather = async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status === 'undetermined') permission = await Location.requestForegroundPermissionsAsync();
        if (!active || permission.status !== 'granted') return;

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const next = await getWeatherByCoordinates(position.coords.latitude, position.coords.longitude);
        if (!active) return;
        setWeatherData(next);
        setLocationLabel([next.location.name, next.location.region].filter(Boolean).join(', '));
        setClockNow(new Date());
      } catch {
        // Keep the last good weather snapshot if a refresh fails.
      }
    };

    void refreshWeather();
    weatherTimer = setInterval(() => { void refreshWeather(); }, WEATHER_REFRESH_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setClockNow(new Date());
        void refreshWeather();
      }
    });

    return () => {
      active = false;
      if (weatherTimer) clearInterval(weatherTimer);
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const clockTimer = setInterval(() => setClockNow(new Date()), CLOCK_REFRESH_MS);
    return () => clearInterval(clockTimer);
  }, []);

  const liveWeather = useMemo(() => {
    const normalized = normalizeWeather(weatherData?.current.condition.text);
    if (normalized === 'rain' && weatherData?.current.precip_in === 0) return 'cloudy';
    return normalized;
  }, [weatherData]);
  const livePhase = useMemo(() => dayPhaseFor(weatherData, clockNow), [weatherData, clockNow]);
  const weather = trailheadDebugOverride.enabled && trailheadDebugOverride.weather ? trailheadDebugOverride.weather : liveWeather;
  const phase = trailheadDebugOverride.enabled && trailheadDebugOverride.phase ? trailheadDebugOverride.phase : livePhase;
  const background = useMemo(() => backgroundFor(rank, weather, phase), [rank, weather, phase]);
  const fallbackBackground = useMemo(() => backgroundFor(rank, 'clear', phase), [rank, phase]);
  const displayedBackground = backgroundFailed ? fallbackBackground : background;
  const atmosphere = useMemo(() => atmosphereColor(weather, phase), [weather, phase]);
  const backgroundLift = useMemo(() => backgroundLiftColor(weather, phase), [weather, phase]);
  const theme = rankThemes[rank];
  const greeting = greetingFor(phase);
  const temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : '--°';
  const condition = weatherData?.current.condition.text ? weather.replace('-', ' ') : 'Local weather';
  const location = locationLabel || 'Current location';
  const detail = weatherData ? weatherCopy(weather, phase) : 'Weather appears when location access is available.';

  useEffect(() => {
    setBackgroundFailed(false);
  }, [background]);

  const openRankJourney = () => router.push('/member/rank-progress');

  const baseHeroHeight = veryCompact ? 286 : compact ? 300 : 318;
  const heroHeight = baseHeroHeight + HEADER_INSET;
  const emblemSize = veryCompact ? 82 : compact ? 96 : 108;

  return (
    <View style={[styles.cover, { height: heroHeight, shadowColor: '#000000' }]}>
      <Image source={displayedBackground} resizeMode="cover" style={styles.background} onError={() => setBackgroundFailed(true)} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: backgroundLift }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: atmosphere }]} />
      <View pointerEvents="none" style={styles.identityScrim} />
      <View pointerEvents="none" style={styles.lowerScrim} />
      <View pointerEvents="none" style={[styles.rankGlow, { backgroundColor: theme.glow }]} />
      <TrailheadHeader />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${rank} rank progress`}
        onPress={openRankJourney}
        style={[styles.emblem, compact && styles.emblemCompact, veryCompact && styles.emblemVeryCompact]}
      >
        <RankEmblem rank={rank} size={emblemSize} />
      </Pressable>

      <View style={[styles.titleBlock, compact && styles.titleBlockCompact, veryCompact && styles.titleBlockVeryCompact]}>
        <Text style={[styles.greeting, compact && styles.greetingCompact]}>{greeting},</Text>
        <Text
          style={[styles.name, compact && styles.nameCompact, veryCompact && styles.nameVeryCompact]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {displayName}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${rank} rank progress`} onPress={openRankJourney} style={styles.rankInline}>
          <Text style={[styles.rankGlyph, { color: theme.accent }]}>✥</Text>
          <Text style={[styles.rankText, { color: theme.accent }]}>{rank.toUpperCase()}</Text>
        </Pressable>
      </View>

      <View style={[styles.weatherBlock, compact && styles.weatherBlockCompact, veryCompact && styles.weatherBlockVeryCompact]}>
        <View style={styles.weatherMainRow}>
          <Text style={styles.weatherIcon}>{glyph(weather, phase)}</Text>
          <Text style={[styles.temperature, compact && styles.temperatureCompact]}>{temp}</Text>
          <Text style={[styles.condition, compact && styles.conditionCompact]}>{condition}</Text>
        </View>
        <View style={styles.locationRow}>
          <Text style={styles.locationPin}>⌖</Text>
          <Text style={styles.location} numberOfLines={1}>{location}</Text>
        </View>
        <Text style={[styles.weatherCopy, { color: theme.soft }]} numberOfLines={2}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    marginTop: -HEADER_INSET,
    zIndex: 8,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#07100D',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  background: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  identityScrim: {
    position: 'absolute', left: 0, top: HEADER_INSET, bottom: 0, width: '58%',
    backgroundColor: 'rgba(3, 8, 7, 0.06)',
  },
  lowerScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%',
    backgroundColor: 'rgba(3, 8, 7, 0.10)',
  },
  rankGlow: { position: 'absolute', left: -68, top: HEADER_INSET - 36, width: 240, height: 240, borderRadius: 120, opacity: 0.22 },

  emblem: { position: 'absolute', left: 14, top: HEADER_INSET + 44, width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  emblemCompact: { left: 10, top: HEADER_INSET + 48, width: 100, height: 100 },
  emblemVeryCompact: { left: 8, top: HEADER_INSET + 52, width: 86, height: 86 },

  titleBlock: { position: 'absolute', left: 130, right: 18, top: HEADER_INSET + 52 },
  titleBlockCompact: { left: 112, right: 14, top: HEADER_INSET + 53 },
  titleBlockVeryCompact: { left: 96, right: 10, top: HEADER_INSET + 55 },
  greeting: {
    color: '#FFF8E8', fontSize: 17, lineHeight: 21, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.96)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 },
  },
  greetingCompact: { fontSize: 15, lineHeight: 19 },
  name: {
    color: '#FFFDF5', fontSize: 36, lineHeight: 40, fontWeight: '900', marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.98)', textShadowRadius: 9, textShadowOffset: { width: 0, height: 2 },
  },
  nameCompact: { fontSize: 31, lineHeight: 35 },
  nameVeryCompact: { fontSize: 27, lineHeight: 31 },
  rankInline: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, paddingVertical: 2 },
  rankGlyph: { fontSize: 14, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  rankText: {
    fontSize: 13, fontWeight: '900', letterSpacing: 0.65,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 },
  },

  weatherBlock: { position: 'absolute', left: 18, width: '52%', bottom: 20 },
  weatherBlockCompact: { left: 13, width: '55%', bottom: 15 },
  weatherBlockVeryCompact: { left: 10, width: '58%', bottom: 13 },
  weatherMainRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  weatherIcon: {
    color: '#FFF8E8', fontSize: 21,
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 },
  },
  temperature: {
    color: '#FFFDF5', fontSize: 24, lineHeight: 28, fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 },
  },
  temperatureCompact: { fontSize: 21, lineHeight: 25 },
  condition: {
    color: '#FFF8E8', fontSize: 13, fontWeight: '800', textTransform: 'capitalize', flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 },
  },
  conditionCompact: { fontSize: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9, minWidth: 0 },
  locationPin: {
    color: '#FFF8E8', fontSize: 15, fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 },
  },
  location: {
    color: '#FFF8E8', fontSize: 12, lineHeight: 15, fontWeight: '800', flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 },
  },
  weatherCopy: {
    fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 9,
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 },
  },
});