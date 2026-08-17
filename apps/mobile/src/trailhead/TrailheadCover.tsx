import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import { getWeatherByCoordinates, type WeatherForecast } from '../weather/api';
import { weatherVisualFor, type WeatherVisualPhase } from '../weather/weatherVisuals';

type WeatherTheme = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy';
type DayPhase = 'morning' | 'afternoon' | 'evening' | 'night';
type DisplayRank = 'Explorer' | 'Pathfinder' | 'Trailblazer' | 'Adventurer' | 'Summit Seeker' | 'Ascendant';
type RankTheme = { accent: string; soft: string; glow: string };

const displayRankByRank: Record<RankName, DisplayRank> = {
  Explorer: 'Explorer',
  Pathfinder: 'Pathfinder',
  Trailblazer: 'Trailblazer',
  Wayfinder: 'Adventurer',
  Summiteer: 'Summit Seeker',
  'Legacy Pathfinder': 'Ascendant',
};

const rankThemes: Record<DisplayRank, RankTheme> = {
  Explorer: { accent: '#37AFFF', soft: '#D9F3FF', glow: 'rgba(55,175,255,0.26)' },
  Pathfinder: { accent: '#9BE33D', soft: '#E7FFC5', glow: 'rgba(155,227,61,0.24)' },
  Trailblazer: { accent: '#FF453A', soft: '#FFD1CD', glow: 'rgba(255,69,58,0.24)' },
  Adventurer: { accent: '#D88A34', soft: '#FFE0B8', glow: 'rgba(216,138,52,0.24)' },
  'Summit Seeker': { accent: '#F2C34B', soft: '#FFF0A6', glow: 'rgba(242,195,75,0.24)' },
  Ascendant: { accent: '#B65CFF', soft: '#F0D5FF', glow: 'rgba(182,92,255,0.26)' },
};

function normalizeWeather(text = ''): WeatherTheme {
  const value = text.toLowerCase();
  if (/thunder|storm|lightning|torrential/.test(value)) return 'storm';
  if (/snow|sleet|blizzard|ice|freezing/.test(value)) return 'snow';
  if (/rain|drizzle|shower/.test(value)) return 'rain';
  if (/fog|mist|haze|smoke|dust|sand/.test(value)) return 'fog';
  if (/wind/.test(value)) return 'windy';
  if (/overcast/.test(value)) return 'cloudy';
  if (/partly|partially|cloud/.test(value)) return 'partly-cloudy';
  return 'clear';
}

function localHour(weather: WeatherForecast | null) {
  const match = weather?.location.localtime?.match(/(?:T|\s)(\d{1,2}):/);
  return match ? Number(match[1]) : new Date().getHours();
}

function dayPhaseFor(weather: WeatherForecast | null): DayPhase {
  const hour = localHour(weather);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function visualPhaseFor(phase: DayPhase): WeatherVisualPhase {
  if (phase === 'morning') return 'dawn';
  if (phase === 'evening') return 'dusk';
  if (phase === 'night') return 'night';
  return 'day';
}

function greetingFor(phase: DayPhase) {
  if (phase === 'morning') return 'Good morning';
  if (phase === 'afternoon') return 'Good afternoon';
  if (phase === 'evening') return 'Good evening';
  return 'Good night';
}

function weatherCopy(theme: WeatherTheme, phase: DayPhase) {
  switch (theme) {
    case 'storm': return 'Storms nearby · use caution outdoors.';
    case 'rain': return 'Rain nearby · pack a shell.';
    case 'snow': return 'Snowy conditions · tread carefully.';
    case 'fog': return 'Low visibility · stay aware.';
    case 'windy': return 'Windy on the trail · secure loose gear.';
    case 'cloudy': return 'Cloud cover makes for a cooler outing.';
    case 'partly-cloudy': return phase === 'evening' ? 'Golden hour on the trail.' : 'Clouds drifting across the trail.';
    default:
      if (phase === 'night') return 'The mountain calls.';
      if (phase === 'evening') return 'Perfect evening for a local hike.';
      if (phase === 'morning') return 'Fresh air. New day. New trails.';
      return 'Perfect weather for a local adventure.';
  }
}

function glyph(theme: WeatherTheme, phase: DayPhase) {
  if (theme === 'clear') return phase === 'night' ? '☾' : '☀';
  if (theme === 'partly-cloudy') return '🌤';
  return ({ storm: '⚡', rain: '🌧', snow: '❄', fog: '≋', windy: '〰', cloudy: '☁' } as const)[theme];
}

function weatherLabel(theme: WeatherTheme) {
  return theme.replace('-', ' ').toUpperCase();
}

function sceneConditionFor(displayRank: DisplayRank, weather: WeatherTheme) {
  if (weather === 'storm') return 'thunderstorm';
  if (weather === 'rain') return displayRank === 'Trailblazer' ? 'heavy rain' : 'rain';
  if (weather === 'fog') return 'fog';
  if (weather === 'snow') return 'snow';
  if (weather === 'cloudy') return 'overcast';
  if (weather === 'partly-cloudy') return 'partly cloudy';
  if (displayRank === 'Adventurer') return 'partly cloudy';
  return 'clear';
}

function getTrailheadBannerBackground(rank: RankName, weather: WeatherTheme, phase: DayPhase) {
  const displayRank = displayRankByRank[rank];
  const visualPhase = visualPhaseFor(phase);
  const condition = sceneConditionFor(displayRank, weather);
  return weatherVisualFor(condition, visualPhase !== 'night', visualPhase);
}

export function TrailheadCover({ displayName, rank, onRankPress }: {
  coverUrl?: string | null;
  displayName: string;
  rank: RankName;
  greeting: string;
  busy?: boolean;
  onEdit?: () => void;
  onRankPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const veryCompact = width < 370;
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [locationLabel, setLocationLabel] = useState('');

  useEffect(() => {
    let active = true;

    async function loadWeather() {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status === 'undetermined') permission = await Location.requestForegroundPermissionsAsync();
        if (!active || permission.status !== 'granted') return;

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const next = await getWeatherByCoordinates(position.coords.latitude, position.coords.longitude);
        if (!active) return;
        setWeatherData(next);
        setLocationLabel([next.location.name, next.location.region].filter(Boolean).join(', '));
      } catch {
        if (active) {
          setWeatherData(null);
          setLocationLabel('');
        }
      }
    }

    void loadWeather();
    return () => { active = false; };
  }, []);

  const displayRank = displayRankByRank[rank];
  const theme = rankThemes[displayRank];
  const weather = useMemo(() => normalizeWeather(weatherData?.current.condition.text), [weatherData?.current.condition.text]);
  const phase = useMemo(() => dayPhaseFor(weatherData), [weatherData]);
  const greeting = greetingFor(phase);
  const background = useMemo(() => getTrailheadBannerBackground(rank, weather, phase), [phase, rank, weather]);
  const temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : '--°';
  const condition = weatherData?.current.condition.text ? weatherLabel(weather) : 'LOCAL WEATHER';
  const location = locationLabel || 'Current location';
  const detail = weatherData ? weatherCopy(weather, phase) : 'Weather appears when location access is available.';

  return (
    <ImageBackground
      source={{ uri: background }}
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
        onPress={onRankPress}
        style={[styles.primaryEmblem, compact && styles.primaryEmblemCompact]}
      >
        <RankEmblem rank={rank} size={compact ? 80 : 108} />
      </Pressable>

      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}>
          <AppIcon name="notifications" color="#FFF8E8" size={18} />
        </Pressable>
        <Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.headerButton}>
          <AppIcon name="profile" color="#FFF8E8" size={18} />
        </Pressable>
      </View>

      <View style={[styles.titleBlock, compact && styles.titleBlockCompact, veryCompact && styles.titleBlockVeryCompact]}>
        <Text style={[styles.greeting, compact && styles.greetingCompact]}>{greeting},</Text>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {displayName}
        </Text>
      </View>

      <View style={[styles.metaBlock, compact && styles.metaBlockCompact]}>
        <View style={styles.statusRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${displayRank} rank progress`} onPress={onRankPress} style={styles.rankInline}>
            <Text style={[styles.rankGlyph, { color: theme.accent }]}>✥</Text>
            <Text style={[styles.rankText, { color: theme.accent }]} numberOfLines={1}>{displayRank.toUpperCase()}</Text>
          </Pressable>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.statusIcon}>{glyph('clear', phase)}</Text>
          <Text style={styles.statusText}>{temp}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.statusIcon}>{glyph(weather, phase)}</Text>
          <Text style={styles.statusText}>{condition}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.location} numberOfLines={1}>⌖ {location}</Text>
          {!veryCompact ? <Text style={[styles.weatherCopy, { color: theme.soft }]} numberOfLines={1}>{detail}</Text> : null}
        </View>
        {veryCompact ? <Text style={[styles.weatherCopyCompact, { color: theme.soft }]} numberOfLines={1}>{detail}</Text> : null}
      </View>

      {!compact ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${displayRank} rank progress`} onPress={onRankPress} style={styles.secondaryRank}>
          <RankEmblem rank={rank} size={72} />
          <View style={[styles.rankPill, { borderColor: theme.accent }]}>
            <Text style={[styles.rankPillText, { color: theme.soft }]} numberOfLines={1}>{displayRank.toUpperCase()}</Text>
          </View>
        </Pressable>
      ) : null}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  cover: { height: 212, marginTop: -72, borderRadius: 22, overflow: 'hidden', backgroundColor: '#07100D', borderWidth: 1.4, shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  coverCompact: { height: 198 },
  imageRadius: { borderRadius: 22 },
  baseScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,7,6,0.10)' },
  rankGlow: { position: 'absolute', left: -64, top: -42, width: 260, height: 260, borderRadius: 130 },
  leftScrim: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '62%', backgroundColor: 'rgba(3,8,6,0.48)' },
  leftScrimCompact: { width: '78%' },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 76, backgroundColor: 'rgba(2,6,5,0.44)' },
  primaryEmblem: { position: 'absolute', left: 10, top: 20, width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  primaryEmblemCompact: { left: 8, top: 22, width: 84, height: 84 },
  headerActions: { position: 'absolute', right: 12, top: 11, flexDirection: 'row', gap: 8, zIndex: 5 },
  headerButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(5,10,9,0.72)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.28)', alignItems: 'center', justifyContent: 'center' },
  titleBlock: { position: 'absolute', left: 126, right: 98, top: 27 },
  titleBlockCompact: { left: 98, right: 12, top: 28 },
  titleBlockVeryCompact: { left: 94, right: 10 },
  greeting: { color: '#FFF8E8', fontSize: 15, lineHeight: 19, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.82)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  greetingCompact: { fontSize: 14, lineHeight: 17 },
  name: { color: '#FFFDF5', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.88)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  nameCompact: { fontSize: 25, lineHeight: 30 },
  metaBlock: { position: 'absolute', left: 126, right: 98, bottom: 17 },
  metaBlockCompact: { left: 12, right: 12, bottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'nowrap' },
  rankInline: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  rankGlyph: { fontSize: 13, fontWeight: '900' },
  rankText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.35, flexShrink: 1 },
  dot: { color: 'rgba(255,248,232,0.7)', fontSize: 11, fontWeight: '900' },
  statusIcon: { color: '#FFF8E8', fontSize: 12 },
  statusText: { color: '#FFF8E8', fontSize: 11.5, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  location: { color: 'rgba(255,248,232,0.82)', fontSize: 10.5, fontWeight: '700', maxWidth: '42%' },
  weatherCopy: { fontSize: 10.5, fontWeight: '800', flexShrink: 1 },
  weatherCopyCompact: { fontSize: 10, fontWeight: '800', marginTop: 5 },
  secondaryRank: { position: 'absolute', right: 12, bottom: 12, width: 82, alignItems: 'center', gap: 4 },
  rankPill: { minWidth: 74, maxWidth: 96, minHeight: 22, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(4,9,7,0.74)', alignItems: 'center', justifyContent: 'center' },
  rankPillText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.3 },
});
