import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import { getWeatherByCoordinates, type WeatherForecast } from '../weather/api';

type WeatherTheme = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy';
type Phase = 'dawn' | 'day' | 'dusk' | 'night';
type RankTheme = { accent: string; soft: string; background: string; panel: string };

const rankThemes: Record<RankName, RankTheme> = {
  Explorer: { accent: '#9EDBFF', soft: '#E8F4FA', background: '#132B3B', panel: '#1D4054' },
  Pathfinder: { accent: '#FF5A46', soft: '#FFC0B7', background: '#2A1112', panel: '#4A1B1A' },
  Trailblazer: { accent: '#D8894A', soft: '#F1C08C', background: '#2D1A10', panel: '#4B2B18' },
  Wayfinder: { accent: '#98D83E', soft: '#D8F2A4', background: '#10281A', panel: '#1C4528' },
  Summiteer: { accent: '#F0C84A', soft: '#FFE59A', background: '#2B210E', panel: '#493817' },
  'Legacy Pathfinder': { accent: '#B96CFF', soft: '#E7C9FF', background: '#1B0F34', panel: '#321A56' },
};

function normalizeWeather(text = ''): WeatherTheme {
  const value = text.toLowerCase();
  if (/thunder|storm|lightning/.test(value)) return 'storm';
  if (/snow|sleet|blizzard|ice/.test(value)) return 'snow';
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

function phaseFrom(weather: WeatherForecast | null): Phase {
  const hour = localHour(weather);
  if (hour >= 20 || hour < 5) return 'night';
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'day';
}

function weatherCopy(theme: WeatherTheme, phase: Phase) {
  switch (theme) {
    case 'storm': return 'Storms nearby · use caution outdoors';
    case 'rain': return 'Rain nearby · pack a shell';
    case 'snow': return 'Snowy conditions · tread carefully';
    case 'fog': return 'Low visibility · stay aware';
    case 'windy': return 'Windy on the trail · secure loose gear';
    case 'cloudy': return 'Cloud cover makes for a cooler outing';
    case 'partly-cloudy': return phase === 'night' ? 'Clouds drifting through tonight' : 'Good trail weather with some cloud cover';
    default: return phase === 'night' ? 'Clear skies over your trail tonight' : 'Perfect weather for a local adventure';
  }
}

function glyph(theme: WeatherTheme, phase: Phase) {
  if (theme === 'clear') return phase === 'night' ? '☾' : '☀';
  if (theme === 'partly-cloudy') return phase === 'night' ? '☁' : '⛅';
  return ({ storm: '⚡', rain: '🌧', snow: '❄', fog: '≋', windy: '〰', cloudy: '☁' } as const)[theme];
}

function label(theme: WeatherTheme) {
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
  const temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : null;
  const condition = weatherData?.current.condition.text ? label(weather) : null;

  return (
    <View style={[styles.cover, { backgroundColor: theme.background, borderColor: theme.accent }]}>
      <View style={[styles.rankGlow, { backgroundColor: theme.panel }]} pointerEvents="none" />
      <View style={styles.watermark} pointerEvents="none">
        <RankEmblem rank={rank} size={210} muted />
      </View>

      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${rank} rank progress`}
          onPress={onRankPress}
          style={styles.rankArtwork}
        >
          <RankEmblem rank={rank} size={112} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}>
            <AppIcon name="notifications" color="#FFF8E8" size={18} />
          </Pressable>
          <Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.headerButton}>
            <AppIcon name="profile" color="#FFF8E8" size={18} />
          </Pressable>
        </View>
      </View>

      <View style={styles.identity}>
        <Text style={[styles.rankTitle, { color: theme.soft }]} numberOfLines={1}>{rank.toUpperCase()}</Text>
        <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{greeting}, {displayName}</Text>

        <View style={styles.statusRow}>
          {temp ? <Text style={styles.statusText}>{temp}</Text> : null}
          {temp && condition ? <Text style={styles.dot}>•</Text> : null}
          {condition ? <Text style={styles.statusText}>{glyph(weather, phase)} {condition}</Text> : null}
          {(temp || condition) && locationLabel ? <Text style={styles.dot}>•</Text> : null}
          {locationLabel ? <Text style={styles.location} numberOfLines={1}>⌖ {locationLabel}</Text> : null}
        </View>

        {weatherData ? (
          <Text style={[styles.weatherCopy, weather === 'storm' && styles.warningCopy]} numberOfLines={1}>
            {weatherCopy(weather, phase)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 218,
    marginTop: -72,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    justifyContent: 'flex-end',
  },
  rankGlow: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    left: -100,
    top: -105,
    opacity: 0.78,
  },
  watermark: {
    position: 'absolute',
    right: -62,
    bottom: -66,
    opacity: 0.42,
    transform: [{ rotate: '-9deg' }],
  },
  headerRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  rankArtwork: {
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(7,13,18,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,248,232,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { paddingHorizontal: 15, paddingBottom: 14, gap: 4 },
  rankTitle: {
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: 1.9,
    paddingRight: 90,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 1 },
  },
  greeting: {
    color: '#FFF8E8',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    paddingRight: 70,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingRight: 12,
  },
  dot: { color: 'rgba(255,248,232,0.68)', fontSize: 11, fontWeight: '900' },
  statusText: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' },
  location: { color: 'rgba(255,248,232,0.82)', fontSize: 10.5, fontWeight: '700', flexShrink: 1 },
  weatherCopy: { color: '#E0EDD6', fontSize: 10.5, fontWeight: '700', paddingRight: 80 },
  warningCopy: { color: '#FFD56A' },
});
