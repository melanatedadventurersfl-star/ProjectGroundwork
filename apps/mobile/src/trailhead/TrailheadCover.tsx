import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import { getWeatherByCoordinates, type WeatherForecast } from '../weather/api';

type WeatherTheme = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy';
type Phase = 'dawn' | 'day' | 'dusk' | 'night';
type RankTheme = { accent: string; soft: string; skyTop: string; skyBottom: string; far: string; near: string; ground: string };

const rankThemes: Record<RankName, RankTheme> = {
  Explorer: { accent: '#9EDBFF', soft: '#E8F4FA', skyTop: '#203C56', skyBottom: '#7198B5', far: '#69859A', near: '#274455', ground: '#102B35' },
  Pathfinder: { accent: '#FF5A46', soft: '#FFC0B7', skyTop: '#351014', skyBottom: '#9E3C32', far: '#773329', near: '#3B1718', ground: '#1D1010' },
  Trailblazer: { accent: '#D8894A', soft: '#F1C08C', skyTop: '#3A2015', skyBottom: '#B56631', far: '#835033', near: '#432719', ground: '#21170F' },
  Wayfinder: { accent: '#98D83E', soft: '#D8F2A4', skyTop: '#12351E', skyBottom: '#5E8A49', far: '#477044', near: '#1D4229', ground: '#102619' },
  Summiteer: { accent: '#F0C84A', soft: '#FFE59A', skyTop: '#5E4013', skyBottom: '#E1A43C', far: '#9B6F29', near: '#4E3516', ground: '#261D0E' },
  'Legacy Pathfinder': { accent: '#B96CFF', soft: '#E7C9FF', skyTop: '#180D35', skyBottom: '#573089', far: '#4A2D72', near: '#25143F', ground: '#150B27' },
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

function label(theme: WeatherTheme) { return theme.replace('-', ' ').toUpperCase(); }

function Scene({ rank, weather, phase }: { rank: RankName; weather: WeatherTheme; phase: Phase }) {
  const t = rankThemes[rank];
  const night = phase === 'night';
  const wet = weather === 'rain' || weather === 'storm';
  const cloudy = wet || weather === 'cloudy' || weather === 'partly-cloudy' || weather === 'fog';

  return (
    <Svg width="100%" height="100%" viewBox="0 0 1000 360" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night ? '#090D24' : t.skyTop} />
          <Stop offset="1" stopColor={night ? '#1D3155' : t.skyBottom} />
        </LinearGradient>
        <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.near} />
          <Stop offset="1" stopColor={t.ground} />
        </LinearGradient>
      </Defs>
      <Rect width="1000" height="360" fill="url(#sky)" />
      {night ? (
        <>
          <Circle cx="790" cy="82" r="38" fill="#F5EEDB" opacity="0.92" />
          <Circle cx="802" cy="73" r="36" fill="#111936" opacity="0.7" />
          <Circle cx="625" cy="48" r="2.2" fill="#FFF" opacity="0.85" />
          <Circle cx="680" cy="82" r="2.8" fill="#FFF" opacity="0.72" />
          <Circle cx="744" cy="38" r="2" fill="#FFF" opacity="0.9" />
          <Circle cx="860" cy="48" r="2.5" fill="#FFF" opacity="0.82" />
          <Circle cx="912" cy="95" r="2" fill="#FFF" opacity="0.7" />
        </>
      ) : <Circle cx="775" cy="102" r="46" fill={t.soft} opacity={wet ? 0.2 : 0.8} />}
      {cloudy ? (
        <>
          <Path d="M30 112 C88 62 151 72 179 108 C220 82 274 92 300 130 L30 130 Z" fill="#E9EEEF" opacity={weather === 'fog' ? 0.34 : 0.18} />
          <Path d="M620 78 C676 39 735 54 763 91 C804 61 867 71 893 114 L620 114 Z" fill="#E9EEEF" opacity={wet ? 0.14 : 0.18} />
        </>
      ) : null}
      <Path d="M0 262 L126 183 L226 222 L350 101 L465 224 L580 149 L686 218 L812 108 L1000 245 L1000 360 L0 360 Z" fill={t.far} opacity="0.88" />
      <Path d="M282 180 L350 101 L415 183 L379 161 L351 127 L326 166 Z" fill="#F4F2E8" opacity="0.7" />
      <Path d="M740 180 L812 108 L872 185 L839 168 L813 137 L786 170 Z" fill="#F4F2E8" opacity="0.62" />
      <Path d="M0 296 L174 214 L286 270 L432 175 L568 279 L714 192 L850 278 L1000 207 L1000 360 L0 360 Z" fill="url(#ground)" />
      <Path d="M463 360 C480 318 509 288 560 267 C528 302 516 330 513 360 Z" fill={t.soft} opacity="0.64" />
      <Path d="M30 312 l27 -80 27 80z M73 312 l20 -59 20 59z M866 312 l32 -95 32 95z M825 312 l23 -69 23 69z M148 312 l18 -51 18 51z" fill={t.ground} />
      {wet ? <Path d="M80 45 l-18 36 M160 25 l-19 38 M250 58 l-17 34 M340 31 l-19 39 M430 52 l-18 36 M525 26 l-18 35 M620 58 l-17 34 M710 31 l-20 39 M825 51 l-18 36 M920 26 l-20 40" stroke="#D8E8F0" strokeWidth="5" opacity="0.4" /> : null}
      {weather === 'snow' ? <><Circle cx="120" cy="70" r="5" fill="#FFF" /><Circle cx="260" cy="115" r="4" fill="#FFF" /><Circle cx="430" cy="70" r="5" fill="#FFF" /><Circle cx="620" cy="112" r="4" fill="#FFF" /><Circle cx="820" cy="75" r="5" fill="#FFF" /></> : null}
      {weather === 'fog' ? <Rect y="145" width="1000" height="165" fill="#E8EEE9" opacity="0.24" /> : null}
      {night ? <Rect width="1000" height="360" fill="rgba(5,8,24,0.18)" /> : null}
      {phase === 'dusk' ? <Rect width="1000" height="360" fill="rgba(255,124,71,0.10)" /> : null}
    </Svg>
  );
}

export function TrailheadCover({ coverUrl, displayName, rank, greeting, onRankPress }: {
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

  const content = <>
    {!coverUrl ? <Scene rank={rank} weather={weather} phase={phase} /> : null}
    <View style={styles.scrim} />
    <View style={styles.headerRow}>
      <RankEmblem rank={rank} size={76} />
      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}><AppIcon name="notifications" color="#FFF8E8" size={18} /></Pressable>
        <Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.headerButton}><AppIcon name="profile" color="#FFF8E8" size={18} /></Pressable>
      </View>
    </View>
    <View style={styles.identity}>
      <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{greeting}, {displayName}</Text>
      <View style={styles.statusRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${rank} rank progress`} onPress={onRankPress} style={[styles.rankChip, { borderColor: theme.accent }]}>
          <Text style={[styles.rankText, { color: theme.soft }]}>{rank.toUpperCase()}</Text>
        </Pressable>
        {temp ? <><Text style={styles.dot}>•</Text><Text style={styles.statusText}>{temp}</Text></> : null}
        {condition ? <><Text style={styles.dot}>•</Text><Text style={styles.statusText}>{glyph(weather, phase)} {condition}</Text></> : null}
      </View>
      <View style={styles.detailRow}>
        {locationLabel ? <Text style={styles.location} numberOfLines={1}>⌖ {locationLabel}</Text> : null}
        {weatherData ? <Text style={[styles.weatherCopy, weather === 'storm' && styles.warningCopy]} numberOfLines={1}>{weatherCopy(weather, phase)}</Text> : null}
      </View>
    </View>
  </>;

  return coverUrl
    ? <ImageBackground source={{ uri: coverUrl }} style={[styles.cover, { borderColor: theme.accent }]} imageStyle={styles.imageRadius} resizeMode="cover">{content}</ImageBackground>
    : <View style={[styles.cover, { borderColor: theme.accent }]}>{content}</View>;
}

const styles = StyleSheet.create({
  cover: { height: 194, marginTop: -72, borderRadius: 20, overflow: 'hidden', backgroundColor: '#162831', justifyContent: 'flex-end', borderWidth: 1.25 },
  imageRadius: { borderRadius: 20 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,8,7,0.24)' },
  headerRow: { position: 'absolute', top: 8, left: 9, right: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(7,13,18,0.62)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.28)', alignItems: 'center', justifyContent: 'center' },
  identity: { paddingHorizontal: 14, paddingBottom: 13, gap: 7 },
  greeting: { color: '#FFF8E8', fontSize: 21, lineHeight: 25, fontWeight: '900', paddingRight: 8, textShadowColor: 'rgba(0,0,0,0.72)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  rankChip: { minHeight: 29, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, backgroundColor: 'rgba(7,13,11,0.72)', borderWidth: 1 },
  rankText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.9 },
  dot: { color: 'rgba(255,248,232,0.74)', fontSize: 12, fontWeight: '900' },
  statusText: { color: '#FFF8E8', fontSize: 11.5, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 20 },
  location: { color: 'rgba(255,248,232,0.82)', fontSize: 10.5, fontWeight: '700', maxWidth: '40%' },
  weatherCopy: { color: '#E0EDD6', fontSize: 10.5, fontWeight: '700', flexShrink: 1 },
  warningCopy: { color: '#FFD56A' },
});
