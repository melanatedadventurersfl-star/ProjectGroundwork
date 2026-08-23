import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt';
import {
  getMemberBadges,
  getPassportStamps,
  type MemberBadge,
  type PassportStamp,
} from '../passport/api';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { isLegacyStampCode, StampArt } from '../passport/StampArt';
import { AppIcon } from '../ui/AppIcon';
import { getWeatherByCoordinates, type WeatherForecast } from '../weather/api';
import { getTrailheadFavorites } from './favorites';
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

function atmosphereColor(weather: WeatherTheme, phase: DayPhase) {
  if (phase === 'night') return 'rgba(4, 13, 28, 0.10)';
  if (weather === 'storm') return 'rgba(18, 24, 31, 0.16)';
  if (weather === 'rain') return 'rgba(16, 31, 39, 0.12)';
  if (weather === 'fog') return 'rgba(214, 225, 220, 0.08)';
  if (weather === 'cloudy' || weather === 'snow') return 'rgba(92, 108, 110, 0.08)';
  if (phase === 'morning') return 'rgba(255, 224, 168, 0.06)';
  if (phase === 'evening') return 'rgba(255, 150, 76, 0.06)';
  return 'transparent';
}

export function TrailheadOptimizedCover({
  displayName,
  rank,
  badges = [],
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
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const veryCompact = width < 370;
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [earnedBadges, setEarnedBadges] = useState<MemberBadge[]>(badges);
  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);
  const [favoriteBadgeTitles, setFavoriteBadgeTitles] = useState<string[]>([]);
  const [favoriteStampCodes, setFavoriteStampCodes] = useState<string[]>([]);
  const [clockNow, setClockNow] = useState(() => new Date());

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([
      getMemberBadges().catch(() => badges),
      getPassportStamps().catch(() => [] as PassportStamp[]),
      getTrailheadFavorites(session?.user.id),
    ]).then(([nextBadges, nextStamps, favorites]) => {
      if (!active) return;
      setEarnedBadges(nextBadges);
      setEarnedStamps(nextStamps);
      setFavoriteBadgeTitles(favorites.badges);
      setFavoriteStampCodes(favorites.stamps);
    });
    return () => { active = false; };
  }, [badges, session?.user.id]));

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
  const atmosphere = useMemo(() => atmosphereColor(weather, phase), [weather, phase]);
  const theme = rankThemes[rank];
  const greeting = greetingFor(phase);
  const temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : '--°';
  const condition = weatherData?.current.condition.text ? weather.replace('-', ' ') : 'Local weather';
  const location = locationLabel || 'Current location';
  const detail = weatherData ? weatherCopy(weather, phase) : 'Weather appears when location access is available.';

  const visibleBadgeTitles = useMemo(() => {
    if (favoriteBadgeTitles.length) return favoriteBadgeTitles.slice(0, 3);
    return earnedBadges.slice(0, 3).map((badge) => badge.title);
  }, [earnedBadges, favoriteBadgeTitles]);
  const visibleStamps = useMemo(() => {
    if (!favoriteStampCodes.length) return earnedStamps.slice(0, 3);
    const byCode = new Map(earnedStamps.filter((stamp) => stamp.code).map((stamp) => [stamp.code as string, stamp]));
    return favoriteStampCodes.map((code) => byCode.get(code)).filter((stamp): stamp is PassportStamp => Boolean(stamp)).slice(0, 3);
  }, [earnedStamps, favoriteStampCodes]);

  const openBadges = () => router.push('/member/badges');
  const openStamps = () => router.push('/member/stamps');
  const openRankJourney = () => router.push('/member/rank-progress');

  const heroHeight = veryCompact ? 286 : compact ? 300 : 318;
  const emblemSize = veryCompact ? 82 : compact ? 96 : 108;
  const achievementSize = veryCompact ? 40 : compact ? 46 : 52;

  return (
    <View style={[styles.cover, { height: heroHeight, shadowColor: '#000000' }]}>
      <Image source={background} resizeMode="cover" style={styles.background} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: atmosphere }]} />
      <View pointerEvents="none" style={styles.identityScrim} />
      <View pointerEvents="none" style={styles.lowerScrim} />
      <View pointerEvents="none" style={[styles.rankGlow, { backgroundColor: theme.glow }]} />

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
          <Text style={styles.rankGlyph}>✥</Text>
          <Text style={styles.rankText}>{rank.toUpperCase()}</Text>
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

      {(visibleBadgeTitles.length || visibleStamps.length) ? (
        <View style={[styles.achievementShelf, compact && styles.achievementShelfCompact, veryCompact && styles.achievementShelfVeryCompact]}>
          {visibleBadgeTitles.length ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Open badges and manage Trailhead favorites" onPress={openBadges} style={styles.achievementGroup}>
              <Text style={[styles.achievementLabel, { color: theme.soft }]}>BADGES</Text>
              <View style={styles.achievementRow}>
                {visibleBadgeTitles.map((title) => (
                  <View key={title} style={[styles.achievementSlot, { width: achievementSize, height: achievementSize }]}>
                    {hasBadgeArt(title) ? (
                      <BadgeArt title={title} size={achievementSize} />
                    ) : (
                      <View style={[styles.badgeFallback, { width: achievementSize, height: achievementSize, borderRadius: achievementSize / 2, borderColor: theme.accent }]}>
                        <AppIcon name="badge" color={theme.soft} size={Math.max(15, achievementSize * 0.46)} />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </Pressable>
          ) : null}

          {visibleStamps.length ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Open stamps and manage Trailhead favorites" onPress={openStamps} style={[styles.achievementGroup, visibleBadgeTitles.length ? styles.stampGroup : null]}>
              <Text style={[styles.achievementLabel, { color: theme.soft }]}>STAMPS</Text>
              <View style={styles.achievementRow}>
                {visibleStamps.map((stamp) => (
                  <View key={stamp.stamp_id} style={[styles.achievementSlot, { width: achievementSize, height: achievementSize }]}>
                    {stamp.code && isLegacyStampCode(stamp.code) ? (
                      <StampArt code={stamp.code} width={achievementSize} />
                    ) : (
                      <View style={[styles.genericStamp, { width: achievementSize, height: achievementSize, borderColor: theme.accent }]}>
                        <Text style={[styles.genericStampText, { color: theme.soft, fontSize: Math.max(9, achievementSize * 0.24) }]}>MA</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#07100D',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  background: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  identityScrim: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: '58%',
    backgroundColor: 'rgba(3, 8, 7, 0.10)',
  },
  lowerScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%',
    backgroundColor: 'rgba(3, 8, 7, 0.15)',
  },
  rankGlow: { position: 'absolute', left: -68, top: -36, width: 240, height: 240, borderRadius: 120, opacity: 0.22 },

  emblem: { position: 'absolute', left: 14, top: 44, width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  emblemCompact: { left: 10, top: 48, width: 100, height: 100 },
  emblemVeryCompact: { left: 8, top: 52, width: 86, height: 86 },

  titleBlock: { position: 'absolute', left: 130, right: 18, top: 52 },
  titleBlockCompact: { left: 112, right: 14, top: 53 },
  titleBlockVeryCompact: { left: 96, right: 10, top: 55 },
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
  rankInline: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(7, 25, 20, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 232, 0.22)',
  },
  rankGlyph: {
    color: '#F4D27A',
    fontSize: 15,
    fontWeight: '900',
  },
  rankText: {
    color: '#FFF4CE',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  weatherBlock: { position: 'absolute', left: 18, width: '43%', bottom: 20 },
  weatherBlockCompact: { left: 13, width: '44%', bottom: 15 },
  weatherBlockVeryCompact: { left: 10, width: '45%', bottom: 13 },
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

  achievementShelf: { position: 'absolute', right: 8, width: '43%', bottom: 18, zIndex: 5 },
  achievementShelfCompact: { right: 6, width: '44%', bottom: 15 },
  achievementShelfVeryCompact: { right: 4, width: '45%', bottom: 12 },
  achievementGroup: { minWidth: 0, paddingVertical: 2 },
  stampGroup: { marginTop: 7 },
  achievementLabel: {
    fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: 2.2, opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.96)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 },
  achievementSlot: { overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  badgeFallback: { borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.20)', alignItems: 'center', justifyContent: 'center' },
  genericStamp: { borderWidth: 1, borderRadius: 8, backgroundColor: 'rgba(5,10,9,0.34)', alignItems: 'center', justifyContent: 'center' },
  genericStampText: { fontWeight: '900', letterSpacing: 0.4 },
});