import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt';
import type { MemberBadge } from '../passport/api';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import type { WeatherForecast } from '../weather/api';
import { backgroundFor, dayPhaseFor, glyph, normalizeWeather, rankThemes } from './trailheadBannerConfig';

const FALLBACK_NATURE = require('../../assets/trailhead/explorer/explorer_clear_afternoon.png');
const FALLBACK_NIGHT = require('../../assets/trailhead/explorer/explorer_clear_night.png');

type Props = {
  displayName: string;
  greeting: string;
  rank: RankName;
  badges: MemberBadge[];
  weather: WeatherForecast | null;
  mode: 'nature' | 'night';
  homeCity: string;
  homeState: string;
  coverUrl?: string | null;
};

export function GoTrailheadScene({ displayName, greeting, rank, badges, weather, mode, homeCity, homeState, coverUrl }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const weatherTheme = weather ? normalizeWeather(weather.current.condition.text) : 'clear';
  const phase = mode === 'night' ? 'night' : dayPhaseFor(weather);
  const background = coverUrl ? { uri: coverUrl } : backgroundFor(rank, weatherTheme, phase);
  const fallback = mode === 'night' ? FALLBACK_NIGHT : FALLBACK_NATURE;
  const source: ImageSourcePropType = imageFailed ? fallback : background;
  const accent = mode === 'night' ? '#E0B7F9' : rankThemes[rank].soft;
  const homeLocation = [homeCity, homeState].filter(Boolean).join(', ');
  const location = weather ? [weather.location.name, weather.location.region].filter(Boolean).join(', ') : homeLocation;
  const temp = weather && Number.isFinite(weather.current.temp_f) ? Math.round(weather.current.temp_f) + '°' : null;
  const badgePreview = badges.slice(0, 3);

  useEffect(() => { setImageFailed(false); }, [coverUrl, rank, mode, weatherTheme, phase]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.cover}>
        <Image source={source} resizeMode="cover" style={styles.background} onError={() => setImageFailed(true)} accessibilityLabel="Rank and weather themed Trailhead landscape" />
        <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} width="100%" height="100%">
          <Defs>
            <LinearGradient id="goTrailheadShade" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#071610" stopOpacity="0.21" />
              <Stop offset="43%" stopColor="#071610" stopOpacity="0.38" />
              <Stop offset="100%" stopColor={mode === 'night' ? '#140C23' : '#0A2019'} stopOpacity="0.86" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#goTrailheadShade)" />
        </Svg>
        <View style={styles.sceneBody}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.push('/member/rank-progress')} accessibilityRole="button"
              accessibilityLabel={'Open ' + rank + ' rank progress'} style={styles.rankCluster}>
              <RankEmblem rank={rank} size={65} />
              <View style={styles.rankTextGroup}>
                <Text style={styles.smallLabel}>YOUR PASSPORT RANK</Text>
                <Text style={[styles.rankText, { color: accent }]} numberOfLines={2}>{rank}</Text>
                <Text style={styles.rankLink}>View progress →</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => router.push('/member/weather')} accessibilityRole="button"
              accessibilityLabel={temp ? 'Weather: ' + temp + ', ' + weather?.current.condition.text : 'View local weather'}
              style={styles.weatherPill}>
              <View style={styles.weatherTop}>
                {weather ? <Text style={styles.weatherGlyph}>{glyph(weatherTheme, phase)}</Text> : <AppIcon name="weather" color="#F9E4A5" size={19}/>}
                <Text style={styles.weatherTemp}>{temp || 'Weather'}</Text>
              </View>
              <Text style={styles.weatherCondition} numberOfLines={1}>{weather?.current.condition.text ?? (homeLocation ? 'Forecast unavailable' : 'Set your city')}</Text>
              <Text style={styles.weatherLocation} numberOfLines={1}>{location || 'Add home location'} <Text>›</Text></Text>
            </Pressable>
          </View>
          <View style={styles.bottom}>
            <Text style={[styles.welcomeLabel, { color: accent }]}>GO MELANATED · YOUR TRAILHEAD</Text>
            <Text style={styles.hello} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.76}>
              {greeting + (displayName ? ', ' + displayName : '') + '.'}
            </Text>
            <Text style={styles.description}>{mode === 'nature' ? 'Find your people. Make more memories.' : 'Your people. Your city. Your night.'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.badgesRibbon}>
        <View style={styles.badgeIntro}>
          <View style={styles.badgeTitleLine}>
            <AppIcon name="badge" color="#86643A" size={17} />
            <Text style={styles.badgesTitle}>Your badges</Text>
          </View>
          <Text style={styles.badgesCount}>{badges.length ? badges.length + ' earned' : 'Your first badge awaits'}</Text>
        </View>
        <View style={styles.badgeThumbs}>
          {badgePreview.length ? badgePreview.map(badge =>
            <Pressable key={badge.badge_id} accessibilityRole="button"
              accessibilityLabel={'View earned badge ' + badge.title}
              onPress={() => router.push('/member/badges')} style={styles.badgeThumb}>
              {hasBadgeArt(badge.title) ? <BadgeArt title={badge.title} size={43}/> : <AppIcon name="badge" size={27} color="#9E733F"/>}
            </Pressable>
          ) : <AppIcon name="stamp" size={28} color="#A4895C"/>}
        </View>
        <Pressable style={styles.seeBadges} accessibilityLabel="View all badges" onPress={() => router.push('/member/badges')}>
          <AppIcon name="chevron-forward" color="#59472D" size={18}/>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 21, overflow: 'hidden', backgroundColor: '#F1E9D7', marginBottom: 7 },
  cover: { minHeight: 239, overflow: 'hidden', backgroundColor: '#173C35' },
  background: { ...StyleSheet.absoluteFillObject, height: '100%', width: '100%' },
  sceneBody: { flex: 1, minHeight: 239, paddingHorizontal: 15, paddingTop: 15, paddingBottom: 16, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  rankCluster: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, minHeight: 72 },
  rankTextGroup: { flex: 1, minWidth: 0 },
  smallLabel: { color: '#F4EDDE', fontSize: 9, fontWeight: '900', letterSpacing: 0.75 },
  rankText: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  rankLink: { color: '#F9F4E9', fontSize: 10, marginTop: 4, fontWeight: '700' },
  weatherPill: { backgroundColor: 'rgba(7,19,16,0.67)', minWidth: 105, maxWidth: 133, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  weatherTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherGlyph: { fontSize: 17, color: '#F9E4A5' },
  weatherTemp: { fontSize: 21, fontWeight: '900', color: '#FFF8E8' },
  weatherCondition: { fontSize: 10, color: '#F1F2E7', textTransform: 'capitalize', marginTop: 2, fontWeight: '700' },
  weatherLocation: { fontSize: 10, color: '#D4E6DC', marginTop: 4 },
  bottom: { marginTop: 34 },
  welcomeLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.25 },
  hello: { color: '#FFFFFF', fontWeight: '900', fontSize: 24, lineHeight: 29, marginTop: 5, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4 },
  description: { color: '#F5F2E8', fontSize: 12, marginTop: 5 },
  badgesRibbon: { minHeight: 63, backgroundColor: '#F6F0E2', borderTopWidth: 1, borderTopColor: '#E2D7BE', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 6 },
  badgeIntro: { flex: 1, minWidth: 80 },
  badgeTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgesTitle: { fontWeight: '900', fontSize: 12, color: '#2C3326' },
  badgesCount: { color: '#716B58', fontWeight: '700', fontSize: 10, marginTop: 3 },
  badgeThumbs: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  badgeThumb: { width: 43, height: 48, justifyContent: 'center', alignItems: 'center' },
  seeBadges: { width: 31, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
