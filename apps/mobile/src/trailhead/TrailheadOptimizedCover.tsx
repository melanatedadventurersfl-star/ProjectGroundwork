import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
  if (phase === 'night') return 'rgba(4, 13, 28, 0.42)';
  if (weather === 'storm') return 'rgba(18, 24, 31, 0.28)';
  if (weather === 'rain') return 'rgba(16, 31, 39, 0.22)';
  if (weather === 'fog') return 'rgba(214, 225, 220, 0.12)';
  if (weather === 'cloudy' || weather === 'snow') return 'rgba(92, 108, 110, 0.14)';
  if (phase === 'morning') return 'rgba(255, 224, 168, 0.08)';
  if (phase === 'evening') return 'rgba(255, 150, 76, 0.08)';
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
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const veryCompact = width < 370;
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [earnedBadges, setEarnedBadges] = useState<MemberBadge[]>(badges);
  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    void Promise.all([
      getMemberBadges().catch(() => badges),
      getPassportStamps().catch(() => [] as PassportStamp[]),
    ]).then(([nextBadges, nextStamps]) => {
      if (!active) return;
      setEarnedBadges(nextBadges);
      setEarnedStamps(nextStamps);
    });
    return () => { active = false; };
  }, [badges]);

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

  const badgeLimit = veryCompact ? 2 : 3;
  const stampLimit = veryCompact ? 3 : 4;
  const visibleBadges = earnedBadges.slice(0, badgeLimit);
  const visibleStamps = earnedStamps.slice(0, stampLimit);
  const overflowBadges = Math.max(0, earnedBadges.length - visibleBadges.length);
  const overflowStamps = Math.max(0, earnedStamps.length - visibleStamps.length);
  const openPassport = () => router.push('/(tabs)/passport');
  const openRankJourney = () => router.push('/member/rank-progress');

  const heroHeight = veryCompact ? 286 : compact ? 300 : 318;
  const emblemSize = veryCompact ? 82 : compact ? 96 : 108;
  const badgeSize = veryCompact ? 34 : compact ? 38 : 44;
  const stampWidth = veryCompact ? 21 : compact ? 23 : 26;

  return (
    <View style={[styles.cover, { height: heroHeight, borderColor: theme.accent, shadowColor: theme.accent }]}>
      <Image source={background} resizeMode="cover" style={styles.background} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: atmosphere }]} />
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

      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}>
          <AppIcon name="notifications" color="#FFF8E8" size={19} />
        </Pressable>
        <Pressable accessibilityLabel="Menu" onPress={() => router.push('/menu')} style={styles.headerButton}>
          <AppIcon name="menu" color="#FFF8E8" size={21} />
        </Pressable>
      </View>

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
        <Text style={[styles.weatherCopy, { color: theme.soft }]} numberOfLines={veryCompact ? 2 : 2}>{detail}</Text>
      </View>

      {(visibleBadges.length || visibleStamps.length) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${earnedBadges.length} badges and ${earnedStamps.length} stamps. Open Passport.`}
          onPress={openPassport}
          style={[styles.achievementShelf, compact && styles.achievementShelfCompact, veryCompact && styles.achievementShelfVeryCompact]}
        >
          {visibleBadges.length ? (
            <View style={styles.achievementGroup}>
              <Text style={[styles.achievementLabel, { color: theme.soft }]}>BADGES</Text>
              <View style={styles.achievementRow}>
                {visibleBadges.map((badge) => (
                  <View key={badge.badge_id} style={[styles.badgeSlot, { width: badgeSize, height: badgeSize }]}>
                    {hasBadgeArt(badge.title) ? (
                      <BadgeArt title={badge.title} size={badgeSize} />
                    ) : (
                      <View style={[styles.badgeFallback, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2, borderColor: theme.accent }]}>
                        <AppIcon name="badge" color={theme.soft} size={Math.max(15, badgeSize * 0.46)} />
                      </View>
                    )}
                  </View>
                ))}
                {overflowBadges > 0 ? <Text style={[styles.overflow, { color: theme.soft }]}>+{overflowBadges}</Text> : null}
              </View>
            </View>
          ) : null}

          {visibleStamps.length ? (
            <View style={[styles.achievementGroup, visibleBadges.length ? styles.stampGroup : null]}>
              <Text style={[styles.achievementLabel, { color: theme.soft }]}>STAMPS</Text>
              <View style={styles.achievementRow}>
                {visibleStamps.map((stamp) => (
                  <View key={stamp.stamp_id} style={[styles.stampSlot, { width: stampWidth + 6, height: stampWidth * 1.28 + 4 }]}>
                    {stamp.code && isLegacyStampCode(stamp.code) ? (
                      <StampArt code={stamp.code} width={stampWidth} />
                    ) : (
                      <View style={[styles.genericStamp, { width: stampWidth + 2, height: stampWidth + 7, borderColor: theme.accent }]}>
                        <Text style={[styles.genericStampText, { color: theme.soft }]}>MA</Text>
                      </View>
                    )}
                  </View>
                ))}
                {overflowStamps > 0 ? <Text style={[styles.overflow, { color: theme.soft }]}>+{overflowStamps}</Text> : null}
              </View>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    marginTop: -72,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#07100D',
    borderWidth: 1.4,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  background: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  identityScrim: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: '62%',
    backgroundColor: 'rgba(3, 8, 7, 0.16)',
  },
  lowerScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%',
    backgroundColor: 'rgba(3, 8, 7, 0.24)',
  },
  rankGlow: { position: 'absolute', left: -68, top: -36, width: 240, height: 240, borderRadius: 120, opacity: 0.26 },

  emblem: { position: 'absolute', left: 14, top: 44, width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  emblemCompact: { left: 10, top: 48, width: 100, height: 100 },
  emblemVeryCompact: { left: 8, top: 52, width: 86, height: 86 },

  headerActions: { position: 'absolute', right: 12, top: 11, flexDirection: 'row', gap: 8, zIndex: 8 },
  headerButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(5,10,9,0.52)', borderWidth: 1,
    borderColor: 'rgba(255,248,232,0.20)', alignItems: 'center', justifyContent: 'center',
  },

  titleBlock: { position: 'absolute', left: 130, right: 92, top: 52 },
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
  rankInline: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, paddingVertical: 2 },
  rankGlyph: { fontSize: 14, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  rankText: {
    fontSize: 13, fontWeight: '900', letterSpacing: 0.65,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 },
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

  achievementShelf: { position: 'absolute', right: 16, width: '43%', bottom: 18, zIndex: 5 },
  achievementShelfCompact: { right: 12, width: '44%', bottom: 15 },
  achievementShelfVeryCompact: { right: 9, width: '45%', bottom: 12 },
  achievementGroup: { minWidth: 0 },
  stampGroup: { marginTop: 7 },
  achievementLabel: {
    fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: 2.2, opacity: 0.82,
    textShadowColor: 'rgba(0,0,0,0.96)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, minWidth: 0 },
  badgeSlot: { overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  badgeFallback: { borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  stampSlot: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  genericStamp: { borderWidth: 1, borderRadius: 6, backgroundColor: 'rgba(5,10,9,0.44)', alignItems: 'center', justifyContent: 'center' },
  genericStampText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  overflow: {
    marginLeft: 1, fontSize: 11, fontWeight: '900', opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.96)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
});
