import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt';
import type { MemberBadge } from '../passport/api';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import type { WeatherForecast } from '../weather/api';
import { backgroundFor, dayPhaseFor, glyph, normalizeWeather, rankThemes, type DayPhase, type WeatherTheme } from './trailheadBannerConfig';

const FALLBACK_NATURE = require('../../assets/trailhead/explorer/explorer_clear_afternoon.png');
const FALLBACK_CITY = require('../../assets/onboarding/onboarding-people.jpg');

const STARS = [8, 23, 39, 55, 69, 81, 94] as const;
const RAIN = Array.from({ length: 16 }, (_, index) => index);

function TrailheadAtmosphere({ weather, phase, mode }: { weather: WeatherTheme; phase: DayPhase; mode: 'nature' | 'night' }) {
  const [haze] = useState(() => new Animated.Value(0));
  const [light] = useState(() => new Animated.Value(0));
  const [rainfall] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  const storm = weather === 'storm';
  const rainy = weather === 'rain' || storm;
  const afterDark = phase === 'night';
  const atmosphereTint = mode === 'night' ? '#755091' : afterDark ? '#374F7A' : '#E5C383';

  useEffect(() => {
    let alive = true;
    if (typeof AccessibilityInfo.isReduceMotionEnabled === 'function') {
      void AccessibilityInfo.isReduceMotionEnabled().then(value => {
        if (alive) setReduceMotion(value);
      }).catch(() => { /* Keep the ambient effects subtle when a browser does not expose this setting. */ });
    }
    const subscription = typeof AccessibilityInfo.addEventListener === 'function'
      ? AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
      : null;
    return () => { alive = false; subscription?.remove(); };
  }, []);

  useEffect(() => {
    haze.setValue(0);
    light.setValue(0);
    rainfall.setValue(0);
    flash.setValue(0);
    if (reduceMotion) return;
    const animations: Animated.CompositeAnimation[] = [
      Animated.loop(Animated.sequence([
        Animated.timing(haze, { toValue: 1, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(haze, { toValue: 0, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(light, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(light, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
    ];
    if (rainy) animations.push(Animated.loop(Animated.timing(rainfall, {
      toValue: 1, duration: storm ? 850 : 1400, easing: Easing.linear, useNativeDriver: true,
    })));
    if (storm) animations.push(Animated.loop(Animated.sequence([
      Animated.delay(5500),
      Animated.timing(flash, { toValue: 0.20, duration: 90, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.delay(600),
    ])));
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [reduceMotion, rainy, storm, haze, light, rainfall, flash]);

  return <View pointerEvents="none" style={styles.atmosphereLayer}>
    <Animated.View style={[styles.haze, {
      backgroundColor: mode === 'night' ? '#9B7AC3' : '#B0BEAB',
      opacity: reduceMotion ? 0.035 : haze.interpolate({ inputRange: [0, 1], outputRange: [0.025, 0.075] }),
      transform: [{ translateX: reduceMotion ? 0 : haze.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] }) }],
    }]} />
    <Animated.View style={[styles.ambientLight, {
      backgroundColor: atmosphereTint,
      opacity: reduceMotion ? 0.055 : light.interpolate({ inputRange: [0, 1], outputRange: [0.025, 0.10] }),
    }]} />
    {afterDark && STARS.map((left, index) => <Animated.View key={'star-' + index}
      style={[styles.star, { left: left + '%', top: 8 + (index % 3) * 11,
        opacity: reduceMotion ? 0.35 : light.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.50] }),
      }]} />)}
    {rainy && RAIN.map(index => <Animated.View key={'rain-' + index}
      style={[styles.raindrop, {
        left: ((index * 17.7) % 96) + '%',
        top: ((index * 31) % 145) - 34,
        height: 11 + index % 12,
        opacity: storm ? 0.39 : 0.25,
        transform: [{ rotate: '-15deg' }, {
          translateY: reduceMotion ? 0 : rainfall.interpolate({ inputRange: [0, 1], outputRange: [0, 230] }),
        }],
      }]} />)}
    {storm && <Animated.View style={[styles.lightning, { opacity: reduceMotion ? 0 : flash }]} />}
  </View>;
}

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
  nightImage?: string | null;
};

export function GoTrailheadScene({ displayName, greeting, rank, badges, weather, mode, homeCity, homeState, coverUrl, nightImage }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const [sceneTime, setSceneTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setSceneTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const weatherTheme = weather ? normalizeWeather(weather.current.condition.text) : 'clear';
  // Nights includes city experiences throughout the day, not just evening events.
  const phase = dayPhaseFor(weather, sceneTime);
  const background: ImageSourcePropType = mode === 'night'
    ? nightImage ? { uri: nightImage } : coverUrl ? { uri: coverUrl } : FALLBACK_CITY
    : coverUrl ? { uri: coverUrl } : backgroundFor(rank, weatherTheme, phase);
  const fallback = mode === 'night' ? FALLBACK_CITY : FALLBACK_NATURE;
  const source: ImageSourcePropType = imageFailed ? fallback : background;
  const accent = mode === 'night' ? '#E0B7F9' : rankThemes[rank].soft;
  const homeLocation = [homeCity, homeState].filter(Boolean).join(', ');
  const location = weather ? [weather.location.name, weather.location.region].filter(Boolean).join(', ') : homeLocation;
  const temp = weather && Number.isFinite(weather.current.temp_f) ? Math.round(weather.current.temp_f) + '°' : null;
  const badgePreview = badges.slice(0, 3);

  useEffect(() => { setImageFailed(false); }, [coverUrl, nightImage, rank, mode, weatherTheme, phase]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.cover}>
        <Image source={source} resizeMode="cover" style={styles.background} onError={() => setImageFailed(true)} accessibilityLabel="Rank and weather themed Trailhead landscape" />
        <TrailheadAtmosphere weather={weatherTheme} phase={phase} mode={mode} />
        <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} width="100%" height="100%">
          <Defs>
            <LinearGradient id="goTrailheadShade" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={mode === 'night' ? '#130B27' : '#071610'} stopOpacity="0.52" />
              <Stop offset="43%" stopColor={mode === 'night' ? '#130B27' : '#071610'} stopOpacity="0.37" />
              <Stop offset="100%" stopColor={mode === 'night' ? '#140C23' : '#0A2019'} stopOpacity="0.84" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#goTrailheadShade)" />
        </Svg>
        <View style={styles.sceneBody}>
          <View style={styles.topRow}>
            {mode === 'nature' ? <Pressable onPress={() => router.push('/member/rank-progress')} accessibilityRole="button"
              accessibilityLabel={'Open ' + rank + ' rank progress'} style={styles.rankCluster}>
              <RankEmblem rank={rank} size={65} />
              <View style={styles.rankTextGroup}>
                <Text style={styles.smallLabel}>YOUR PASSPORT RANK</Text>
                <Text style={[styles.rankText, { color: accent }]} numberOfLines={2}>{rank}</Text>
                <Text style={styles.rankLink}>View progress →</Text>
              </View>
            </Pressable> :
            <Pressable onPress={() => router.push({ pathname: '/(tabs)/explore', params: { mode: 'night' } })} accessibilityRole="button"
              accessibilityLabel="Explore Night experiences" style={styles.rankCluster}>
              <View style={styles.cityModeIcon}><AppIcon name="explore" color="#E6BCFA" size={28}/></View>
              <View style={styles.rankTextGroup}>
                <Text style={styles.smallLabel}>YOUR CITY WORLD</Text>
                <Text style={[styles.rankText, { color: '#EDCCFA' }]}>GO Nights</Text>
                <Text style={styles.rankLink}>Explore the city →</Text>
              </View>
            </Pressable>}
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
            <Text style={[styles.welcomeLabel, { color: accent }]}>{mode === 'nature' ? 'GO MELANATED · NATURE TRAILHEAD' : 'GO MELANATED · NIGHTS TRAILHEAD'}</Text>
            <Text style={styles.hello} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.76}>
              {greeting + (displayName ? ', ' + displayName : '') + '.'}
            </Text>
            <Text style={styles.description}>{mode === 'nature' ? 'Find your people. Make more memories.' : 'Your people. Your city. Your next experience.'}</Text>
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
  atmosphereLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  haze: { position: 'absolute', left: -40, top: 25, width: '120%', height: 110, borderRadius: 75 },
  ambientLight: { position: 'absolute', right: -95, top: -125, width: 330, height: 330, borderRadius: 165 },
  star: { position: 'absolute', width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF' },
  raindrop: { position: 'absolute', width: 1.4, borderRadius: 2, backgroundColor: '#DBEFF7' },
  lightning: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FCFF' },
  sceneBody: { flex: 1, minHeight: 239, paddingHorizontal: 15, paddingTop: 15, paddingBottom: 16, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  rankCluster: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, minHeight: 72 },
  cityModeIcon: { width: 62, height: 62, borderRadius: 18, backgroundColor: 'rgba(52,25,78,0.70)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(236,196,255,0.4)' },
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
