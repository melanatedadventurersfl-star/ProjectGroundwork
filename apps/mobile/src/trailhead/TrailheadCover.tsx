import { router } from 'expo-router';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import type { WeatherCondition } from '../weather/api';
import type { WeatherVisualPhase } from '../weather/weatherVisuals';

type WeatherTheme = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy';

type RankTheme = {
  accent: string;
  accentSoft: string;
  skyTop: string;
  skyBottom: string;
  mountainFar: string;
  mountainNear: string;
  ground: string;
};

const rankThemes: Record<RankName, RankTheme> = {
  Explorer: { accent: '#9EDBFF', accentSoft: '#DCEAF3', skyTop: '#24485E', skyBottom: '#8CB6C8', mountainFar: '#6D8998', mountainNear: '#294957', ground: '#15333A' },
  Pathfinder: { accent: '#FF5A46', accentSoft: '#FFC0B7', skyTop: '#351014', skyBottom: '#9E3C32', mountainFar: '#773329', mountainNear: '#3B1718', ground: '#1D1010' },
  Trailblazer: { accent: '#D8894A', accentSoft: '#F1C08C', skyTop: '#3A2015', skyBottom: '#B56631', mountainFar: '#835033', mountainNear: '#432719', ground: '#21170F' },
  Wayfinder: { accent: '#98D83E', accentSoft: '#D8F2A4', skyTop: '#12351E', skyBottom: '#5E8A49', mountainFar: '#477044', mountainNear: '#1D4229', ground: '#102619' },
  Summiteer: { accent: '#F0C84A', accentSoft: '#FFE59A', skyTop: '#5E4013', skyBottom: '#E1A43C', mountainFar: '#9B6F29', mountainNear: '#4E3516', ground: '#261D0E' },
  'Legacy Pathfinder': { accent: '#B96CFF', accentSoft: '#E7C9FF', skyTop: '#180D35', skyBottom: '#573089', mountainFar: '#4A2D72', mountainNear: '#25143F', ground: '#150B27' },
};

function normalizeWeather(condition?: WeatherCondition | null): WeatherTheme {
  const text = condition?.text?.toLowerCase() ?? '';
  if (/thunder|storm|lightning/.test(text)) return 'storm';
  if (/snow|sleet|blizzard|ice/.test(text)) return 'snow';
  if (/rain|drizzle|shower/.test(text)) return 'rain';
  if (/fog|mist|haze/.test(text)) return 'fog';
  if (/wind/.test(text)) return 'windy';
  if (/overcast/.test(text)) return 'cloudy';
  if (/cloud/.test(text)) return 'partly-cloudy';
  return 'clear';
}

function phaseShade(phase: WeatherVisualPhase) {
  if (phase === 'night') return 'rgba(5,8,24,0.42)';
  if (phase === 'dawn') return 'rgba(255,181,112,0.09)';
  if (phase === 'dusk') return 'rgba(255,124,71,0.12)';
  return 'rgba(0,0,0,0)';
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

function weatherLabel(theme: WeatherTheme) {
  return theme.replace('-', ' ').toUpperCase();
}

function weatherGlyph(theme: WeatherTheme) {
  switch (theme) {
    case 'storm': return '⚡';
    case 'rain': return '🌧';
    case 'snow': return '❄';
    case 'fog': return '≋';
    case 'windy': return '〰';
    case 'cloudy': return '☁';
    case 'partly-cloudy': return '⛅';
    default: return '☀';
  }
}

function DynamicScenery({ rank, weather, phase }: { rank: RankName; weather: WeatherTheme; phase: WeatherVisualPhase }) {
  const theme = rankThemes[rank];
  const night = phase === 'night';
  const stormy = weather === 'storm' || weather === 'rain';
  const cloudy = weather === 'cloudy' || weather === 'partly-cloudy' || stormy || weather === 'fog';

  return (
    <Svg width="100%" height="100%" viewBox="0 0 1000 360" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night ? '#0B1027' : theme.skyTop} />
          <Stop offset="1" stopColor={night ? theme.skyTop : theme.skyBottom} />
        </LinearGradient>
        <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.mountainNear} />
          <Stop offset="1" stopColor={theme.ground} />
        </LinearGradient>
      </Defs>
      <Rect width="1000" height="360" fill="url(#sky)" />
      {night ? (
        <>
          <Circle cx="780" cy="92" r="34" fill="#F2E9D5" opacity="0.92" />
          <Circle cx="650" cy="54" r="3" fill="#FFFFFF" opacity="0.8" />
          <Circle cx="710" cy="38" r="2" fill="#FFFFFF" opacity="0.75" />
          <Circle cx="840" cy="55" r="2.5" fill="#FFFFFF" opacity="0.85" />
        </>
      ) : <Circle cx="770" cy="105" r="46" fill={theme.accentSoft} opacity={stormy ? 0.25 : 0.82} />}
      {cloudy ? (
        <>
          <Path d="M40 104 C85 60 145 67 171 104 C205 80 260 88 277 124 L40 124 Z" fill="#E7E9E6" opacity={weather === 'fog' ? 0.34 : 0.2} />
          <Path d="M625 72 C673 39 728 51 750 86 C790 59 850 67 873 108 L625 108 Z" fill="#E7E9E6" opacity={stormy ? 0.16 : 0.2} />
        </>
      ) : null}
      <Path d="M0 267 L135 182 L245 225 L355 105 L463 223 L585 155 L684 220 L805 112 L1000 246 L1000 360 L0 360 Z" fill={theme.mountainFar} opacity="0.92" />
      <Path d="M286 181 L355 105 L412 178 L381 162 L356 130 L333 164 Z" fill="#F1EFE4" opacity="0.72" />
      <Path d="M736 180 L805 112 L865 184 L833 168 L806 138 L782 169 Z" fill="#F1EFE4" opacity="0.64" />
      <Path d="M0 294 L175 215 L286 269 L431 177 L566 278 L711 193 L846 278 L1000 209 L1000 360 L0 360 Z" fill="url(#ground)" />
      <Path d="M469 360 C485 317 512 290 557 273 C525 302 514 331 512 360 Z" fill={theme.accentSoft} opacity="0.72" />
      <Path d="M35 307 l26 -75 26 75z M77 307 l19 -55 19 55z M870 307 l31 -90 31 90z M829 307 l22 -65 22 65z M150 307 l17 -48 17 48z" fill={theme.ground} />
      {weather === 'rain' || weather === 'storm' ? (
        <Path d="M80 50 l-16 32 M160 28 l-17 34 M250 62 l-15 30 M340 35 l-18 36 M430 55 l-17 34 M525 29 l-17 33 M620 60 l-16 31 M710 36 l-18 35 M825 55 l-17 34 M920 31 l-18 36" stroke="#D8E8F0" strokeWidth="5" opacity="0.42" />
      ) : null}
      {weather === 'snow' ? (
        <>
          <Circle cx="120" cy="70" r="5" fill="#FFF" opacity="0.8" /><Circle cx="215" cy="115" r="4" fill="#FFF" opacity="0.7" /><Circle cx="331" cy="72" r="5" fill="#FFF" opacity="0.75" /><Circle cx="460" cy="112" r="4" fill="#FFF" opacity="0.8" /><Circle cx="601" cy="74" r="5" fill="#FFF" opacity="0.8" /><Circle cx="723" cy="128" r="4" fill="#FFF" opacity="0.75" /><Circle cx="890" cy="83" r="5" fill="#FFF" opacity="0.8" />
        </>
      ) : null}
      {weather === 'fog' ? <Rect y="150" width="1000" height="160" fill="#E5EBE6" opacity="0.2" /> : null}
      <Rect width="1000" height="360" fill={phaseShade(phase)} />
    </Svg>
  );
}

export function TrailheadCover({
  coverUrl,
  displayName,
  rank,
  greeting,
  weatherCondition,
  temperatureF,
  location,
  phase = 'day',
  onRankPress,
}: {
  coverUrl?: string | null;
  displayName: string;
  rank: RankName;
  greeting: string;
  weatherCondition?: WeatherCondition | null;
  temperatureF?: number | null;
  location?: string | null;
  phase?: WeatherVisualPhase;
  onRankPress: () => void;
}) {
  const theme = rankThemes[rank];
  const weather = normalizeWeather(weatherCondition);
  const temperature = typeof temperatureF === 'number' ? `${Math.round(temperatureF)}°` : null;
  const content = (
    <>
      {!coverUrl ? <DynamicScenery rank={rank} weather={weather} phase={phase} /> : null}
      <View style={styles.scrim} />

      <View style={styles.headerRow}>
        <RankEmblem rank={rank} size={58} />
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
        <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{greeting}, {displayName}</Text>
        <View style={styles.statusRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${rank} rank progress`} onPress={onRankPress} style={[styles.rankChip, { borderColor: theme.accent }]}>
            <Text style={[styles.rankText, { color: theme.accentSoft }]}>{rank.toUpperCase()}</Text>
          </Pressable>
          {temperature ? <Text style={styles.dot}>•</Text> : null}
          {temperature ? <Text style={styles.statusText}>{temperature}</Text> : null}
          {weatherCondition ? <Text style={styles.dot}>•</Text> : null}
          {weatherCondition ? <Text style={styles.statusText}>{weatherGlyph(weather)} {weatherLabel(weather)}</Text> : null}
        </View>
        <View style={styles.detailRow}>
          {location ? <Text style={styles.location} numberOfLines={1}>⌖ {location}</Text> : null}
          {weatherCondition ? <Text style={[styles.weatherCopy, weather === 'storm' && styles.warningCopy]} numberOfLines={1}>{weatherCopy(weather)}</Text> : null}
        </View>
      </View>
    </>
  );

  if (coverUrl) {
    return (
      <ImageBackground source={{ uri: coverUrl }} style={[styles.cover, { borderColor: theme.accent }]} imageStyle={styles.imageRadius} resizeMode="cover">
        {content}
      </ImageBackground>
    );
  }

  return <View style={[styles.cover, { borderColor: theme.accent }]}>{content}</View>;
}

const styles = StyleSheet.create({
  cover: {
    height: 182,
    marginTop: -72,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#263B34',
    justifyContent: 'flex-end',
    borderWidth: 1,
  },
  imageRadius: { borderRadius: 18 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,8,7,0.28)' },
  headerRow: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(9,17,13,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,248,232,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  greeting: {
    color: '#FFF8E8',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '900',
    paddingRight: 12,
    textShadowColor: 'rgba(0,0,0,0.62)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  rankChip: {
    minHeight: 27,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(7,13,11,0.72)',
    borderWidth: 1,
  },
  rankText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  dot: { color: 'rgba(255,248,232,0.72)', fontSize: 12, fontWeight: '900' },
  statusText: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 18 },
  location: { color: 'rgba(255,248,232,0.76)', fontSize: 10, maxWidth: '38%' },
  weatherCopy: { color: '#DCEACF', fontSize: 10, fontWeight: '700', flexShrink: 1 },
  warningCopy: { color: '#FFD56A' },
});
