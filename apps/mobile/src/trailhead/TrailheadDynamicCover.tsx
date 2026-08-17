import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt';
import type { MemberBadge } from '../passport/api';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import { getWeatherByCoordinates, type WeatherForecast } from '../weather/api';
import { backgroundFor, dayPhaseFor, displayRankByRank, glyph, greetingFor, normalizeWeather, rankThemes, trailheadDebugOverride, weatherCopy } from './trailheadBannerConfig';
import { styles } from './trailheadBannerStyles';

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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let p = await Location.getForegroundPermissionsAsync();
        if (p.status === 'undetermined') p = await Location.requestForegroundPermissionsAsync();
        if (!active || p.status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const next = await getWeatherByCoordinates(pos.coords.latitude, pos.coords.longitude);
        if (!active) return;
        setWeatherData(next);
        setLocationLabel([next.location.name, next.location.region].filter(Boolean).join(', '));
      } catch {
        if (active) {
          setWeatherData(null);
          setLocationLabel('');
        }
      }
    })();
    return () => { active = false; };
  }, []);

  const displayRank = displayRankByRank[rank];
  const theme = rankThemes[displayRank];
  const liveWeather = useMemo(() => normalizeWeather(weatherData?.current.condition.text), [weatherData?.current.condition.text]);
  const livePhase = useMemo(() => dayPhaseFor(weatherData), [weatherData]);
  const weather = trailheadDebugOverride.enabled && trailheadDebugOverride.weather ? trailheadDebugOverride.weather : liveWeather;
  const phase = trailheadDebugOverride.enabled && trailheadDebugOverride.phase ? trailheadDebugOverride.phase : livePhase;
  const background = useMemo(() => backgroundFor(rank, weather, phase), [rank, weather, phase]);
  const greeting = greetingFor(phase);
  const temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : '--°';
  const condition = weatherData?.current.condition.text ? weather.replace('-', ' ') : 'Local weather';
  const location = locationLabel || 'Current location';
  const detail = weatherData ? weatherCopy(weather, phase) : 'Weather appears when location access is available.';
  const openRankJourney = () => router.push('/member/rank-progress');
  const visibleBadges = badges.slice(0, compact ? 2 : 3);
  const overflowBadges = Math.max(0, badges.length - visibleBadges.length);

  return (
    <ImageBackground
      source={background}
      resizeMode="cover"
      imageStyle={styles.imageRadius}
      style={[styles.cover, compact && styles.coverCompact, { borderColor: theme.accent, shadowColor: theme.accent }]}
    >
      <View style={styles.baseScrim} />
      <View style={[styles.rankGlow, { backgroundColor: theme.glow }]} />
      <View style={[styles.leftScrim, compact && styles.leftScrimCompact]} />
      <View style={styles.bottomScrim} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${displayRank} rank progress`}
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
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${displayRank} rank progress`} onPress={openRankJourney} style={styles.rankInline}>
          <Text style={[styles.rankGlyph, { color: theme.accent }]}>✥</Text>
          <Text style={[styles.rankText, { color: theme.accent }]}>{displayRank.toUpperCase()}</Text>
        </Pressable>
      </View>

      {visibleBadges.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${badges.length} earned achievement badge${badges.length === 1 ? '' : 's'}. Open Passport.`}
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
    </ImageBackground>
  );
}
