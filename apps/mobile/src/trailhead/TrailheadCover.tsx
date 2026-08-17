import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import { getWeatherByCoordinates, type WeatherForecast } from '../weather/api';
import { weatherVisualFor, type WeatherVisualPhase } from '../weather/weatherVisuals';

type WeatherTheme = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy';
type RankTheme = { accent: string; soft: string; glow: string };

const rankThemes: Record<RankName, RankTheme> = {
  Explorer: { accent: '#4FC3FF', soft: '#D9F3FF', glow: 'rgba(79,195,255,0.26)' },
  Pathfinder: { accent: '#9BE33D', soft: '#E7FFC5', glow: 'rgba(155,227,61,0.22)' },
  Trailblazer: { accent: '#FF5347', soft: '#FFD1CD', glow: 'rgba(255,83,71,0.22)' },
  Wayfinder: { accent: '#D8894A', soft: '#FFE0B8', glow: 'rgba(216,137,74,0.22)' },
  Summiteer: { accent: '#F0C84A', soft: '#FFF0A6', glow: 'rgba(240,200,74,0.22)' },
  'Legacy Pathfinder': { accent: '#C36DFF', soft: '#F0D5FF', glow: 'rgba(195,109,255,0.24)' },
};

function normalizeWeather(text = ''): WeatherTheme {
  const value = text.toLowerCase();
  if (/thunder|storm|lightning/.test(value)) return 'storm';
  if (/snow|sleet|blizzard|ice|freezing/.test(value)) return 'snow';
  if (/rain|drizzle|shower/.test(value)) return 'rain';
  if (/fog|mist|haze/.test(value)) return 'fog';
  if (/wind/.test(value)) return 'windy';
  if (/overcast/.test(value)) return 'cloudy';
  if (/cloud/.test(value)) return 'partly-cloudy';
  return 'clear';
}

function localHour(weather: WeatherForecast | null) {
  const match = weather?.location.localtime?.match(/(?:T|\s)(\d{1,2}):/);
  return match ? Number(match[1]) : new Date().getHours();
}

function phaseFrom(weather: WeatherForecast | null): WeatherVisualPhase {
  const hour = localHour(weather);
  if (hour >= 20 || hour < 5) return 'night';
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'day';
}

function weatherCopy(theme: WeatherTheme, phase: WeatherVisualPhase) {
  switch (theme) {
    case 'storm': return 'Storms nearby · use caution outdoors.';
    case 'rain': return 'Rain nearby · pack a shell.';
    case 'snow': return 'Snowy conditions · tread carefully.';
    case 'fog': return 'Low visibility · stay aware.';
    case 'windy': return 'Windy on the trail · secure loose gear.';
    case 'cloudy': return 'Cloud cover makes for a cooler outing.';
    case 'partly-cloudy': return phase === 'night' ? 'Clouds drifting through tonight.' : 'Golden light between the clouds.';
    default:
      if (phase === 'night') return 'Clear skies over your trail tonight.';
      if (phase === 'dusk') return 'Perfect evening for a local hike.';
      if (phase === 'dawn') return 'Fresh air. New day. New trails.';
      return 'Perfect weather for a local adventure.';
  }
}

function glyph(theme: WeatherTheme, phase: WeatherVisualPhase) {
  if (theme === 'clear') return phase === 'night' ? '☾' : '☀';
  if (theme === 'partly-cloudy') return '🌤';
  return ({ storm: '⚡', rain: '🌧', snow: '❄', fog: '≋', windy: '〰', cloudy: '☁' } as const)[theme];
}

function weatherLabel(theme: WeatherTheme) {
  return theme.replace('-', ' ').toUpperCase();
}

export function TrailheadCover({ displayName, rank, greeting, onRankPress }: {
  coverUrl?: string | null;
  displayName: string;
  rank: RankName;
  greeting: string;
  busy?: boolean;
  onEdit?: () => void;
  onRankPress: () => void;
}) {
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

  const theme = rankThemes[rank];
  const weather = useMemo(() => normalizeWeather(weatherData?.current.condition.text), [weatherData?.current.condition.text]);
  const phase = useMemo(() => phaseFrom(weatherData), [weatherData]);
  const background = useMemo(
    () => weatherVisualFor(weatherData?.current.condition.text ?? 'clear', phase !== 'night', phase),
    [phase, weatherData?.current.condition.text],
  );
  const temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : '--°';
  const condition = weatherData?.current.condition.text ? weatherLabel(weather) : 'LOCAL WEATHER';
  const location = locationLabel || 'Current location';
  const detail = weatherData ? weatherCopy(weather, phase) : 'Weather will appear when location access is available.';

  return (
    <ImageBackground
      source={{ uri: background }}
      resizeMode="cover"
      imageStyle={styles.imageRadius}
      style={[styles.cover, { borderColor: theme.accent, shadowColor: theme.accent }]}
    >
      <View style={styles.baseScrim} />
      <View style={[styles.rankGlow, { backgroundColor: theme.glow }]} />
      <View style={styles.leftScrim} />
      <View style={styles.bottomScrim} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${rank} rank progress`}
        onPress={onRankPress}
        style={styles.primaryEmblem}
      >
        <RankEmblem rank={rank} size={108} />
      </Pressable>

      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}>
          <AppIcon name="notifications" color="#FFF8E8" size={18} />
        </Pressable>
        <Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.headerButton}>
          <AppIcon name="profile" color="#FFF8E8" size={18} />
        </Pressable>
      </View>

      <View style={styles.copyBlock}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{displayName}</Text>

        <View style={styles.statusRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${rank} rank progress`}
            onPress={onRankPress}
            style={styles.rankInline}
          >
            <Text style={[styles.rankGlyph, { color: theme.accent }]}>✥</Text>
            <Text style={[styles.rankText, { color: theme.accent }]}>{rank.toUpperCase()}</Text>
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
          <Text style={[styles.weatherCopy, { color: theme.soft }]} numberOfLines={1}>{detail}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${rank} rank progress`}
        onPress={onRankPress}
        style={styles.secondaryRank}
      >
        <RankEmblem rank={rank} size={72} />
        <View style={[styles.rankPill, { borderColor: theme.accent }]}>
          <Text style={[styles.rankPillText, { color: theme.soft }]} numberOfLines={1}>{rank.toUpperCase()}</Text>
        </View>
      </Pressable>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 212,
    marginTop: -72,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#07100D',
    borderWidth: 1.4,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  imageRadius: { borderRadius: 22 },
  baseScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,7,6,0.18)' },
  rankGlow: { position: 'absolute', left: -64, top: -42, width: 260, height: 260, borderRadius: 130 },
  leftScrim: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '69%', backgroundColor: 'rgba(3,8,6,0.48)' },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 86, backgroundColor: 'rgba(2,6,5,0.38)' },
  primaryEmblem: { position: 'absolute', left: 10, top: 20, width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  headerActions: { position: 'absolute', right: 12, top: 11, flexDirection: 'row', gap: 8, zIndex: 5 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(5,10,9,0.72)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.28)', alignItems: 'center', justifyContent: 'center' },
  copyBlock: { position: 'absolute', left: 126, right: 98, top: 24, bottom: 17, justifyContent: 'center' },
  greeting: { color: '#FFF8E8', fontSize: 15, lineHeight: 19, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.82)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  name: { color: '#FFFDF5', fontSize: 27, lineHeight: 32, fontWeight: '900', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.88)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, flexWrap: 'wrap' },
  rankInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rankGlyph: { fontSize: 13, fontWeight: '900' },
  rankText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.45 },
  dot: { color: 'rgba(255,248,232,0.7)', fontSize: 11, fontWeight: '900' },
  statusIcon: { color: '#FFF8E8', fontSize: 12 },
  statusText: { color: '#FFF8E8', fontSize: 11.5, fontWeight: '850' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 9 },
  location: { color: 'rgba(255,248,232,0.78)', fontSize: 10.5, fontWeight: '700', maxWidth: '43%' },
  weatherCopy: { fontSize: 10.5, fontWeight: '800', flexShrink: 1 },
  secondaryRank: { position: 'absolute', right: 12, bottom: 12, width: 82, alignItems: 'center', gap: 4 },
  rankPill: { minWidth: 74, maxWidth: 86, minHeight: 22, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(4,9,7,0.74)', alignItems: 'center', justifyContent: 'center' },
  rankPillText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.35 },
});
