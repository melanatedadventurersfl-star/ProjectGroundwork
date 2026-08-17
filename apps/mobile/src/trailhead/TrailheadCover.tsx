import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import { getWeather, type WeatherForecast } from '../weather/api';

type WeatherTheme = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy';
type Phase = 'dawn' | 'day' | 'dusk' | 'night';
type RankTheme = { accent: string; soft: string; skyTop: string; skyBottom: string; far: string; near: string; ground: string };

const rankThemes: Record<RankName, RankTheme> = {
  Explorer: { accent: '#9EDBFF', soft: '#DCEAF3', skyTop: '#24485E', skyBottom: '#8CB6C8', far: '#6D8998', near: '#294957', ground: '#15333A' },
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

function phaseFrom(weather: WeatherForecast | null): Phase {
  const match = weather?.location.localtime?.match(/\s(\d{1,2}):/);
  const hour = match ? Number(match[1]) : new Date().getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 17 && hour < 20) return 'dusk';
  if ((weather?.current.is_day ?? (hour >= 7 && hour < 19 ? 1 : 0)) === 0) return 'night';
  return 'day';
}

function weatherCopy(theme: WeatherTheme) {
  switch (theme) {
    case 'storm': return 'Storms nearby · use caution outdoors';
    case 'rain': return 'Rain nearby · pack a shell';
    case 'snow': return 'Snowy conditions · tread carefully';
    case 'fog': return 'Low visibility · stay aware';
    case 'windy': return 'Windy on the trail · secure loose gear';
    case 'cloudy': return 'Cloud cover makes for a cooler outing';
    case 'partly-cloudy': return 'Good trail weather with some cloud cover';
    default: return 'Perfect weather for a local adventure';
  }
}

function glyph(theme: WeatherTheme) {
  return ({ storm: '⚡', rain: '🌧', snow: '❄', fog: '≋', windy: '〰', cloudy: '☁', 'partly-cloudy': '⛅', clear: '☀' } as const)[theme];
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
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={night ? '#0B1027' : t.skyTop} /><Stop offset="1" stopColor={night ? t.skyTop : t.skyBottom} /></LinearGradient>
        <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={t.near} /><Stop offset="1" stopColor={t.ground} /></LinearGradient>
      </Defs>
      <Rect width="1000" height="360" fill="url(#sky)" />
      {night ? <><Circle cx="785" cy="88" r="35" fill="#F3EBDD" opacity="0.92" /><Circle cx="670" cy="47" r="3" fill="#FFF" /><Circle cx="850" cy="53" r="2" fill="#FFF" /></> : <Circle cx="775" cy="102" r="46" fill={t.soft} opacity={wet ? 0.28 : 0.82} />}
      {cloudy ? <><Path d="M35 108 C90 62 150 70 175 105 C215 80 265 91 287 126 L35 126 Z" fill="#EDF0EC" opacity="0.22" /><Path d="M625 76 C680 38 735 53 760 89 C800 61 860 70 884 111 L625 111 Z" fill="#EDF0EC" opacity="0.18" /></> : null}
      <Path d="M0 266 L140 180 L245 226 L355 104 L467 224 L585 153 L689 221 L808 111 L1000 246 L1000 360 L0 360 Z" fill={t.far} opacity="0.94" />
      <Path d="M285 181 L355 104 L411 178 L379 162 L355 129 L333 164 Z" fill="#F4F1E5" opacity="0.72" />
      <Path d="M738 180 L808 111 L866 184 L834 168 L808 138 L782 169 Z" fill="#F4F1E5" opacity="0.65" />
      <Path d="M0 294 L175 214 L287 270 L433 176 L568 278 L713 192 L850 278 L1000 208 L1000 360 L0 360 Z" fill="url(#ground)" />
      <Path d="M470 360 C489 316 516 289 559 273 C528 302 516 332 514 360 Z" fill={t.soft} opacity="0.72" />
      <Path d="M35 307 l26 -75 26 75z M77 307 l19 -55 19 55z M870 307 l31 -90 31 90z M829 307 l22 -65 22 65z M150 307 l17 -48 17 48z" fill={t.ground} />
      {wet ? <Path d="M80 50 l-16 32 M160 28 l-17 34 M250 62 l-15 30 M340 35 l-18 36 M430 55 l-17 34 M525 29 l-17 33 M620 60 l-16 31 M710 36 l-18 35 M825 55 l-17 34 M920 31 l-18 36" stroke="#D8E8F0" strokeWidth="5" opacity="0.42" /> : null}
      {weather === 'snow' ? <><Circle cx="120" cy="70" r="5" fill="#FFF" /><Circle cx="260" cy="115" r="4" fill="#FFF" /><Circle cx="430" cy="70" r="5" fill="#FFF" /><Circle cx="620" cy="112" r="4" fill="#FFF" /><Circle cx="820" cy="75" r="5" fill="#FFF" /></> : null}
      {weather === 'fog' ? <Rect y="145" width="1000" height="165" fill="#E8EEE9" opacity="0.22" /> : null}
      {phase === 'night' ? <Rect width="1000" height="360" fill="rgba(5,8,24,0.35)" /> : null}
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
  const { session } = useAuth();
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [location, setLocation] = useState('');

  useEffect(() => {
    let active = true;
    async function loadWeather() {
      if (!session?.user.id) return;
      const { data } = await supabase.from('profiles').select('home_city,home_state').eq('id', session.user.id).single();
      const city = data?.home_city?.trim();
      const state = data?.home_state?.trim();
      if (!active || !city || !state) return;
      setLocation(`${city}, ${state}`);
      try {
        const next = await getWeather(city, state);
        if (active) setWeatherData(next);
      } catch {
        if (active) setWeatherData(null);
      }
    }
    void loadWeather();
    return () => { active = false; };
  }, [session?.user.id]);

  const theme = rankThemes[rank];
  const weather = useMemo(() => normalizeWeather(weatherData?.current.condition.text), [weatherData?.current.condition.text]);
  const phase = useMemo(() => phaseFrom(weatherData), [weatherData]);
  const temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : null;
  const condition = weatherData?.current.condition.text ? label(weather) : null;

  const content = <>
    {!coverUrl ? <Scene rank={rank} weather={weather} phase={phase} /> : null}
    <View style={styles.scrim} />
    <View style={styles.headerRow}>
      <RankEmblem rank={rank} size={58} />
      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}><AppIcon name="notifications" color="#FFF8E8" size={18} /></Pressable>
        <Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.headerButton}><AppIcon name="profile" color="#FFF8E8" size={18} /></Pressable>
      </View>
    </View>
    <View style={styles.identity}>
      <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{greeting}, {displayName}</Text>
      <View style={styles.statusRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${rank} rank progress`} onPress={onRankPress} style={[styles.rankChip, { borderColor: theme.accent }]}><Text style={[styles.rankText, { color: theme.soft }]}>{rank.toUpperCase()}</Text></Pressable>
        {temp ? <><Text style={styles.dot}>•</Text><Text style={styles.statusText}>{temp}</Text></> : null}
        {condition ? <><Text style={styles.dot}>•</Text><Text style={styles.statusText}>{glyph(weather)} {condition}</Text></> : null}
      </View>
      <View style={styles.detailRow}>
        {location ? <Text style={styles.location} numberOfLines={1}>⌖ {location}</Text> : null}
        {weatherData ? <Text style={[styles.weatherCopy, weather === 'storm' && styles.warningCopy]} numberOfLines={1}>{weatherCopy(weather)}</Text> : null}
      </View>
    </View>
  </>;

  return coverUrl ? <ImageBackground source={{ uri: coverUrl }} style={[styles.cover, { borderColor: theme.accent }]} imageStyle={styles.imageRadius} resizeMode="cover">{content}</ImageBackground> : <View style={[styles.cover, { borderColor: theme.accent }]}>{content}</View>;
}

const styles = StyleSheet.create({
  cover: { height: 182, marginTop: -72, borderRadius: 18, overflow: 'hidden', backgroundColor: '#263B34', justifyContent: 'flex-end', borderWidth: 1 },
  imageRadius: { borderRadius: 18 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,8,7,0.28)' },
  headerRow: { position: 'absolute', top: 8, left: 10, right: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(9,17,13,0.58)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.25)', alignItems: 'center', justifyContent: 'center' },
  identity: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  greeting: { color: '#FFF8E8', fontSize: 20, lineHeight: 23, fontWeight: '900', paddingRight: 12, textShadowColor: 'rgba(0,0,0,0.62)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  rankChip: { minHeight: 27, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(7,13,11,0.72)', borderWidth: 1 },
  rankText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  dot: { color: 'rgba(255,248,232,0.72)', fontSize: 12, fontWeight: '900' },
  statusText: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 18 },
  location: { color: 'rgba(255,248,232,0.76)', fontSize: 10, maxWidth: '38%' },
  weatherCopy: { color: '#DCEACF', fontSize: 10, fontWeight: '700', flexShrink: 1 },
  warningCopy: { color: '#FFD56A' },
});
