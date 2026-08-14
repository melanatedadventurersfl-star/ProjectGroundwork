import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { WeatherForecast } from './api';

type SceneKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow' | 'default';
type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

type WeatherSceneProps = {
  weather: WeatherForecast | null;
  fallbackLocation?: string;
  reduceMotion?: boolean;
};

function getLocalHour(localtime?: string) {
  if (!localtime) return new Date().getHours();
  const match = localtime.match(/\b(\d{1,2}):(\d{2})\b/);
  const hour = Number(match?.[1]);
  return Number.isFinite(hour) ? hour : new Date().getHours();
}

function getDayPhase(localtime?: string): DayPhase {
  const hour = getLocalHour(localtime);
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 18) return 'day';
  if (hour >= 18 && hour < 20) return 'dusk';
  return 'night';
}

function getSceneKind(condition?: string): SceneKind {
  const text = condition?.toLowerCase() ?? '';
  if (/thunder|storm/.test(text)) return 'storm';
  if (/rain|drizzle|shower/.test(text)) return 'rain';
  if (/snow|sleet|ice/.test(text)) return 'snow';
  if (/mist|fog|haze/.test(text)) return 'fog';
  if (/cloud|overcast/.test(text)) return 'cloudy';
  if (/sun|clear/.test(text)) return 'clear';
  return 'default';
}

function getPalette(kind: SceneKind, phase: DayPhase) {
  if (kind === 'storm') return { background: '#171D2A', accent: '#B7C4E2', border: '#424A61' };
  if (kind === 'rain') return phase === 'night'
    ? { background: '#172836', accent: '#85A9B8', border: '#385263' }
    : { background: '#2D4A55', accent: '#B8D0D6', border: '#58717A' };
  if (kind === 'fog') return phase === 'night'
    ? { background: '#293430', accent: '#AAB6AF', border: '#4B5A53' }
    : { background: '#58665E', accent: '#D5DDD8', border: '#738078' };
  if (kind === 'snow') return phase === 'night'
    ? { background: '#273543', accent: '#DCE9F1', border: '#536574' }
    : { background: '#607886', accent: '#F0F6F7', border: '#8297A1' };
  if (kind === 'cloudy') return phase === 'night'
    ? { background: '#202C35', accent: '#9FAEB5', border: '#41515A' }
    : { background: '#465C62', accent: '#D5DFE1', border: '#65777C' };
  if (phase === 'dawn') return { background: '#694B45', accent: '#F1C58E', border: '#87665D' };
  if (phase === 'dusk') return { background: '#4A3344', accent: '#E9AF7D', border: '#6B4B5C' };
  if (phase === 'night') return { background: '#14243A', accent: '#D7E1EE', border: '#344B67' };
  return { background: '#6C582D', accent: '#F2D483', border: '#8C7647' };
}

const STAR_POSITIONS = [
  { left: '58%' as const, top: 18, size: 3 },
  { left: '68%' as const, top: 38, size: 2 },
  { left: '78%' as const, top: 16, size: 4 },
  { left: '88%' as const, top: 48, size: 2 },
  { left: '72%' as const, top: 76, size: 3 },
  { left: '92%' as const, top: 88, size: 3 },
];

const RAIN_DROPS = [18, 42, 68, 94, 122, 150, 178, 204];

function Cloud({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.cloud, style]}>
      <View style={[styles.cloudBubble, styles.cloudBubbleOne]} />
      <View style={[styles.cloudBubble, styles.cloudBubbleTwo]} />
      <View style={[styles.cloudBubble, styles.cloudBubbleThree]} />
    </View>
  );
}

export function WeatherScene({ weather, fallbackLocation = '', reduceMotion = false }: WeatherSceneProps) {
  const condition = weather?.current.condition.text;
  const phase = getDayPhase(weather?.location.localtime);
  const kind = getSceneKind(condition);
  const palette = getPalette(kind, phase);

  const [drift] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [rain] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(0));

  useEffect(() => {
    drift.stopAnimation();
    pulse.stopAnimation();
    rain.stopAnimation();
    flash.stopAnimation();
    drift.setValue(0);
    pulse.setValue(0);
    rain.setValue(0);
    flash.setValue(0);

    if (reduceMotion) return;

    const animations: Animated.CompositeAnimation[] = [];

    if (kind === 'cloudy' || kind === 'rain' || kind === 'storm' || kind === 'fog') {
      animations.push(Animated.loop(Animated.timing(drift, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })));
    }

    if (kind === 'clear' || phase === 'night') {
      animations.push(Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])));
    }

    if (kind === 'rain' || kind === 'storm') {
      animations.push(Animated.loop(Animated.timing(rain, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      })));
    }

    if (kind === 'storm') {
      animations.push(Animated.loop(Animated.sequence([
        Animated.delay(4800),
        Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.delay(2600),
      ])));
    }

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [drift, flash, kind, phase, pulse, rain, reduceMotion]);

  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 18] });
  const fogX = drift.interpolate({ inputRange: [0, 1], outputRange: [-20, 22] });
  const rainY = rain.interpolate({ inputRange: [0, 1], outputRange: [-28, 70] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.75] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.05] });

  const timeLabel = useMemo(() => {
    const localtime = weather?.location.localtime;
    const time = localtime?.split(' ')[1];
    if (!time) return null;
    const [hoursText, minutes = '00'] = time.split(':');
    const hours = Number(hoursText);
    if (!Number.isFinite(hours)) return null;
    return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
  }, [weather?.location.localtime]);

  const locationLabel = weather
    ? `${weather.location.name}, ${weather.location.region}`
    : fallbackLocation || 'Set your location';
  const detailLabel = weather
    ? `${weather.current.condition.text} · Feels ${Math.round(weather.current.feelslike_f)}°`
    : 'Open Weather & Location';

  const isNight = phase === 'night';
  const showSun = kind === 'clear' && !isNight;
  const showMoon = (kind === 'clear' || kind === 'cloudy') && isNight;
  const showClouds = kind === 'cloudy' || kind === 'rain' || kind === 'storm';

  return (
    <View style={[styles.scene, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.sky} pointerEvents="none">
        {isNight ? STAR_POSITIONS.map((star, index) => (
          <Animated.View
            key={`${star.left}-${star.top}`}
            style={[
              styles.star,
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                opacity: index % 2 ? 0.42 : glowOpacity,
              },
            ]}
          />
        )) : null}

        {showSun ? (
          <Animated.View style={[styles.sunGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
            <View style={[styles.sun, { backgroundColor: palette.accent }]} />
          </Animated.View>
        ) : null}

        {showMoon ? (
          <Animated.View style={[styles.moonGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
            <View style={styles.moon} />
            <View style={[styles.moonCutout, { backgroundColor: palette.background }]} />
          </Animated.View>
        ) : null}

        {showClouds ? (
          <Animated.View style={[styles.cloudLayer, { transform: [{ translateX: driftX }] }]}>
            <Cloud style={styles.cloudOne} />
            <Cloud style={styles.cloudTwo} />
          </Animated.View>
        ) : null}

        {kind === 'fog' ? (
          <Animated.View style={[styles.fogLayer, { transform: [{ translateX: fogX }] }]}>
            <View style={styles.fogBand} />
            <View style={[styles.fogBand, styles.fogBandTwo]} />
            <View style={[styles.fogBand, styles.fogBandThree]} />
          </Animated.View>
        ) : null}

        {kind === 'rain' || kind === 'storm' ? (
          <Animated.View style={[styles.rainLayer, { transform: [{ translateY: rainY }] }]}>
            {RAIN_DROPS.map((left, index) => (
              <View key={left} style={[styles.rainDrop, { left, top: (index % 3) * 24 }]} />
            ))}
          </Animated.View>
        ) : null}

        {kind === 'snow' ? (
          <View style={styles.snowLayer}>
            {STAR_POSITIONS.map((flake, index) => (
              <View key={`snow-${flake.left}`} style={[styles.snowFlake, { left: flake.left, top: 16 + index * 15 }]} />
            ))}
          </View>
        ) : null}

        {kind === 'storm' ? <Animated.View style={[styles.fill, styles.flash, { opacity: flash }]} /> : null}
      </View>

      <View style={styles.content}>
        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrow}>WEATHER</Text>
          {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
        </View>
        <Text style={styles.title}>
          {weather ? `${locationLabel} · ${Math.round(weather.current.temp_f)}°` : locationLabel}
        </Text>
        <Text style={styles.muted}>{detailLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill,
  scene: {
    minHeight: 128,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  sky: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    padding: 16,
    maxWidth: '84%',
    zIndex: 4,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  time: { color: 'rgba(255,248,232,0.64)', fontSize: 10, fontWeight: '800' },
  title: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 7 },
  muted: { color: '#DCE3DE', lineHeight: 19, marginTop: 3 },
  sunGlow: {
    position: 'absolute', width: 106, height: 106, right: 9, top: -11, borderRadius: 53,
    backgroundColor: 'rgba(244,207,111,0.13)', alignItems: 'center', justifyContent: 'center',
  },
  sun: { width: 54, height: 54, borderRadius: 27 },
  moonGlow: {
    position: 'absolute', width: 104, height: 104, right: 4, top: -7, borderRadius: 52,
    backgroundColor: 'rgba(210,225,240,0.09)', alignItems: 'center', justifyContent: 'center',
  },
  moon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E8E4CF' },
  moonCutout: { position: 'absolute', width: 48, height: 48, borderRadius: 24, right: 17, top: 18 },
  star: { position: 'absolute', borderRadius: 999, backgroundColor: '#F4F0DC' },
  cloudLayer: { ...StyleSheet.absoluteFill },
  cloud: {
    position: 'absolute', width: 104, height: 46, borderRadius: 24,
    backgroundColor: 'rgba(225,234,237,0.17)',
  },
  cloudOne: { right: 8, top: 13 },
  cloudTwo: { right: -22, top: 67, transform: [{ scale: 0.78 }] },
  cloudBubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(225,234,237,0.17)' },
  cloudBubbleOne: { width: 42, height: 42, left: 14, top: -16 },
  cloudBubbleTwo: { width: 50, height: 50, left: 42, top: -21 },
  cloudBubbleThree: { width: 35, height: 35, right: 2, top: -7 },
  rainLayer: { ...StyleSheet.absoluteFill, right: 0, left: undefined, width: 228 },
  rainDrop: {
    position: 'absolute', width: 2, height: 22, borderRadius: 1,
    backgroundColor: 'rgba(181,213,224,0.34)', transform: [{ rotate: '14deg' }],
  },
  fogLayer: { ...StyleSheet.absoluteFill },
  fogBand: {
    position: 'absolute', right: -22, top: 25, width: 240, height: 18, borderRadius: 12,
    backgroundColor: 'rgba(230,235,232,0.11)',
  },
  fogBandTwo: { top: 58, right: -55, width: 270 },
  fogBandThree: { top: 92, right: -8, width: 210 },
  snowLayer: { ...StyleSheet.absoluteFill },
  snowFlake: {
    position: 'absolute', width: 5, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(244,249,251,0.74)',
  },
  flash: { backgroundColor: 'rgba(232,238,255,0.22)' },
});
