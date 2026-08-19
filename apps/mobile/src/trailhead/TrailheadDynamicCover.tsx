import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Animated, AppState, Easing, Image, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt';
import { getMemberBadges, type MemberBadge } from '../passport/api';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
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
import { styles } from './trailheadBannerStyles';

const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const CLOCK_REFRESH_MS = 60 * 1000;
const RAIN_DROPS = Array.from({ length: 12 }, (_, index) => index);
const RAIN_BANDS = [-224, 0, 224] as const;
const NIGHT_STARS = [12, 22, 34, 48, 62, 74, 86] as const;

function atmosphereColor(weather: WeatherTheme, phase: DayPhase) {
  if (phase === 'night') return 'rgba(4, 13, 28, 0.42)';
  if (weather === 'storm') return 'rgba(18, 24, 31, 0.26)';
  if (weather === 'rain') return 'rgba(16, 31, 39, 0.20)';
  if (weather === 'fog') return 'rgba(214, 225, 220, 0.14)';
  if (weather === 'cloudy' || weather === 'snow') return 'rgba(92, 108, 110, 0.16)';
  if (phase === 'morning') return 'rgba(255, 224, 168, 0.10)';
  if (phase === 'evening') return 'rgba(255, 150, 76, 0.08)';
  return 'transparent';
}

export function TrailheadCover({
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
  const [clockNow, setClockNow] = useState(() => new Date());

  const [haze] = useState(() => new Animated.Value(0));
  const [rainFall] = useState(() => new Animated.Value(0));
  const [lightning] = useState(() => new Animated.Value(0));
  const [stars] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    void getMemberBadges()
      .then((next) => { if (active) setEarnedBadges(next); })
      .catch(() => { if (active) setEarnedBadges(badges); });
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
        // Preserve the last successful weather snapshot if a refresh fails.
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

  const theme = rankThemes[rank];
  const liveWeather = useMemo(() => normalizeWeather(weatherData?.current.condition.text), [weatherData]);
  const livePhase = useMemo(() => dayPhaseFor(weatherData, clockNow), [weatherData, clockNow]);
  const weather = trailheadDebugOverride.enabled && trailheadDebugOverride.weather ? trailheadDebugOverride.weather : liveWeather;
  const phase = trailheadDebugOverride.enabled && trailheadDebugOverride.phase ? trailheadDebugOverride.phase : livePhase;
  const background = useMemo(() => backgroundFor(rank, weather, phase), [rank, weather, phase]);
  const atmosphere = useMemo(() => atmosphereColor(weather, phase), [weather, phase]);

  useEffect(() => {
    const hazeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(haze, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(haze, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const rainLoop = weather === 'rain' || weather === 'storm'
      ? Animated.loop(
          Animated.timing(rainFall, {
            toValue: 1,
            duration: weather === 'storm' ? 900 : 1200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        )
      : null;
    const starLoop = phase === 'night'
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(stars, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(stars, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        )
      : null;
    const lightningLoop = weather === 'storm'
      ? Animated.loop(
          Animated.sequence([
            Animated.delay(4200),
            Animated.timing(lightning, { toValue: 1, duration: 90, useNativeDriver: true }),
            Animated.timing(lightning, { toValue: 0, duration: 170, useNativeDriver: true }),
            Animated.delay(140),
            Animated.timing(lightning, { toValue: 0.55, duration: 70, useNativeDriver: true }),
            Animated.timing(lightning, { toValue: 0, duration: 220, useNativeDriver: true }),
            Animated.delay(2400),
          ]),
        )
      : null;

    haze.setValue(0);
    rainFall.setValue(0);
    lightning.setValue(0);
    stars.setValue(0);

    hazeLoop.start();
    rainLoop?.start();
    starLoop?.start();
    lightningLoop?.start();

    return () => {
      hazeLoop.stop();
      rainLoop?.stop();
      starLoop?.stop();
      lightningLoop?.stop();
    };
  }, [weather, phase, haze, rainFall, lightning, stars]);

  const greeting = greetingFor(phase);
  const temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : '--°';
  const condition = weatherData?.current.condition.text ? weather.replace('-', ' ') : 'Local weather';
  const location = locationLabel || 'Current location';
  const detail = weatherData ? weatherCopy(weather, phase) : 'Weather appears when location access is available.';
  const openRankJourney = () => router.push('/member/rank-progress');
  const visibleBadges = earnedBadges.slice(0, compact ? 2 : 3);
  const overflowBadges = Math.max(0, earnedBadges.length - visibleBadges.length);

  return (
    <View style={[styles.cover, compact && styles.coverCompact, { borderColor: theme.accent, shadowColor: theme.accent }]}>
      <Image source={background} resizeMode="cover" style={styles.animatedBackground} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.hazeOverlay,
          {
            opacity: haze.interpolate({ inputRange: [0, 1], outputRange: [0.01, 0.045] }),
            transform: [{ translateX: haze.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] }) }],
          },
        ]}
      />

      {(weather === 'rain' || weather === 'storm') ? (
        <View pointerEvents="none" style={styles.rainLayer}>
          {RAIN_BANDS.map((bandTop) => (
            <View key={bandTop} style={styles.rainBand}>
              {RAIN_DROPS.map((drop) => {
                const dropHeight = 14 + ((drop * 7) % 14);
                const dropOpacity = (weather === 'storm' ? 0.28 : 0.16) + (drop % 4) * 0.035;
                const dropTop = bandTop + ((drop * 41 + (drop % 3) * 17) % 224) - 26;
                const dropLeft = `${(drop * 8.3 + (drop % 4) * 3.7) % 100}%` as `${number}%`;

                return (
                  <Animated.View
                    key={`${bandTop}-${drop}`}
                    style={[
                      styles.raindrop,
                      {
                        top: dropTop,
                        left: dropLeft,
                        height: dropHeight,
                        opacity: dropOpacity,
                        transform: [
                          { translateY: rainFall.interpolate({ inputRange: [0, 1], outputRange: [0, 224] }) },
                          { rotate: '-18deg' },
                        ],
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ) : null}

      {weather === 'storm' ? <Animated.View pointerEvents="none" style={[styles.lightningFlash, { opacity: lightning }]} /> : null}

      {phase === 'night' ? (
        <View pointerEvents="none" style={styles.starLayer}>
          {NIGHT_STARS.map((left, index) => (
            <Animated.View
              key={left}
              style={[
                styles.star,
                {
                  left: `${left}%`,
                  top: 14 + (index % 3) * 10,
                  opacity: stars.interpolate({ inputRange: [0, 1], outputRange: [0.18 + (index % 2) * 0.08, 0.68] }),
                  transform: [{ scale: stars.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <View pointerEvents="none" style={[styles.atmosphereOverlay, { backgroundColor: atmosphere }]} />
      <View pointerEvents="none" style={styles.baseScrim} />
      <View pointerEvents="none" style={[styles.rankGlow, { backgroundColor: theme.glow }]} />
      <View pointerEvents="none" style={[styles.leftScrim, compact && styles.leftScrimCompact]} />
      <View pointerEvents="none" style={styles.bottomScrim} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${rank} rank progress`}
        onPress={openRankJourney}
        style={[styles.primaryEmblem, compact && styles.primaryEmblemCompact]}
      >
        <RankEmblem rank={rank} size={compact ? 74 : 92} />
      </Pressable>

      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}>
          <AppIcon name="notifications" color="#FFF8E8" size={17} />
        </Pressable>
        <Pressable accessibilityLabel="Menu" onPress={() => router.push('/menu')} style={styles.headerButton}>
          <AppIcon name="menu" color="#FFF8E8" size={19} />
        </Pressable>
      </View>

      <View style={[styles.titleBlock, compact && styles.titleBlockCompact, veryCompact && styles.titleBlockVeryCompact]}>
        <Text style={[styles.greeting, compact && styles.greetingCompact]}>{greeting},</Text>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{displayName}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${rank} rank progress`} onPress={openRankJourney} style={styles.rankInline}>
          <Text style={[styles.rankGlyph, { color: theme.accent }]}>✥</Text>
          <Text style={[styles.rankText, { color: theme.accent }]}>{rank.toUpperCase()}</Text>
        </Pressable>
      </View>

      {visibleBadges.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${earnedBadges.length} earned achievement badge${earnedBadges.length === 1 ? '' : 's'}. Open Passport.`}
          onPress={() => router.push('/(tabs)/passport')}
          style={[styles.badgeRail, { borderColor: theme.accent, shadowColor: theme.accent }]}
        >
          {visibleBadges.map((badge) => (
            <View key={badge.badge_id} style={styles.badgeSlot}>
              {hasBadgeArt(badge.title) ? (
                <BadgeArt title={badge.title} size={30} />
              ) : (
                <View style={[styles.badgeFallback, { borderColor: theme.accent }]}>
                  <AppIcon name="badge" color={theme.soft} size={17} />
                </View>
              )}
            </View>
          ))}
          {overflowBadges > 0 ? <Text style={[styles.badgeOverflow, { color: theme.soft }]}>+{overflowBadges}</Text> : null}
        </Pressable>
      ) : null}

      <View style={[styles.metaBlock, compact && styles.metaBlockCompact]}>
        <View style={styles.weatherRow}>
          <Text style={styles.weatherIcon}>{glyph(weather, phase)}</Text>
          <Text style={styles.weatherText}>{temp} · {condition}</Text>
          <Text style={styles.weatherDivider}>·</Text>
          <Text style={styles.location} numberOfLines={1}>⌖ {location}</Text>
        </View>
        <Text style={[styles.weatherCopy, { color: theme.soft }]} numberOfLines={veryCompact ? 1 : 2}>{detail}</Text>
      </View>
    </View>
  );
}
