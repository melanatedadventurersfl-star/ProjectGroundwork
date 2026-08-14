import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { WeatherForecast } from './api';
import { weatherVisualFor, type WeatherVisualPhase } from './weatherVisuals';

type WeatherSceneProps = {
  weather: WeatherForecast | null;
  fallbackLocation?: string;
  reduceMotion?: boolean;
};

type MotionKind = 'clear' | 'cloud' | 'rain' | 'storm' | 'fog' | 'other';

function clockMinutes(value?: string) {
  if (!value) return null;
  const match = value.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function getLocalMinutes(localtime?: string) {
  const time = localtime?.split(' ')[1];
  return clockMinutes(time) ?? new Date().getHours() * 60 + new Date().getMinutes();
}

function getDayPhase(weather?: WeatherForecast | null): WeatherVisualPhase {
  const now = getLocalMinutes(weather?.location.localtime);
  const astro = weather?.forecast?.forecastday?.[0]?.astro;
  const sunrise = clockMinutes(astro?.sunrise);
  const sunset = clockMinutes(astro?.sunset);

  if (sunrise != null && sunset != null) {
    if (now >= sunrise - 45 && now < sunrise + 45) return 'dawn';
    if (now >= sunrise + 45 && now < sunset - 45) return 'day';
    if (now >= sunset - 45 && now < sunset + 45) return 'dusk';
    return 'night';
  }

  const hour = Math.floor(now / 60);
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 18) return 'day';
  if (hour >= 18 && hour < 20) return 'dusk';
  return 'night';
}

function motionKind(condition?: string): MotionKind {
  const text = condition?.toLowerCase() ?? '';
  if (/thunder|storm|torrential|heavy rain/.test(text)) return 'storm';
  if (/rain|drizzle|shower/.test(text)) return 'rain';
  if (/mist|fog|haze|smoke|dust|sand/.test(text)) return 'fog';
  if (/cloud|overcast|partly|partially/.test(text)) return 'cloud';
  if (/sunny|clear/.test(text)) return 'clear';
  return 'other';
}

export function WeatherScene({ weather, fallbackLocation = '', reduceMotion = false }: WeatherSceneProps) {
  const condition = weather?.current.condition.text ?? '';
  const phase = getDayPhase(weather);
  const kind = motionKind(condition);
  const visual = weatherVisualFor(condition, phase !== 'night', phase);

  const [drift] = useState(() => new Animated.Value(0));
  const [breathe] = useState(() => new Animated.Value(0));
  const [rain] = useState(() => new Animated.Value(0));

  useEffect(() => {
    drift.stopAnimation();
    breathe.stopAnimation();
    rain.stopAnimation();
    drift.setValue(0);
    breathe.setValue(0);
    rain.setValue(0);

    if (reduceMotion) return;
    const animations: Animated.CompositeAnimation[] = [];

    animations.push(Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 11000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 11000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])));

    animations.push(Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])));

    if (kind === 'rain' || kind === 'storm') {
      animations.push(Animated.loop(Animated.timing(rain, {
        toValue: 1,
        duration: kind === 'storm' ? 900 : 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })));
    }

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [breathe, drift, kind, rain, reduceMotion]);

  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-7, 7] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.13] });
  const imageOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const rainY = rain.interpolate({ inputRange: [0, 1], outputRange: [-42, 126] });

  const timeLabel = useMemo(() => {
    const time = weather?.location.localtime?.split(' ')[1];
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

  const scrimOpacity = phase === 'night' ? 0.48 : kind === 'storm' ? 0.48 : kind === 'rain' ? 0.4 : 0.34;

  return <View style={styles.scene}>
    <Animated.Image
      source={{ uri: visual }}
      resizeMode="cover"
      style={[
        styles.image,
        {
          opacity: imageOpacity,
          transform: [{ translateX: driftX }, { translateY: driftY }, { scale }],
        },
      ]}
    />
    <View pointerEvents="none" style={[styles.scrim, { backgroundColor: `rgba(6, 13, 11, ${scrimOpacity})` }]} />
    <View pointerEvents="none" style={styles.edgeShade} />

    {kind === 'rain' || kind === 'storm' ? <Animated.View pointerEvents="none" style={[styles.rainLayer, { transform: [{ translateY: rainY }] }]}>
      {[12, 38, 67, 96, 128, 160, 194, 226, 260, 294].map((left, index) => <View
        key={left}
        style={[styles.rainLine, { left, top: (index % 4) * 26, opacity: 0.18 + (index % 3) * 0.05 }]}
      />)}
    </Animated.View> : null}

    <View style={styles.content}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>WEATHER</Text>
        {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
      </View>
      <Text style={styles.title}>{weather ? `${locationLabel} · ${Math.round(weather.current.temp_f)}°` : locationLabel}</Text>
      <Text style={styles.muted}>{detailLabel}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  scene: {
    minHeight: 138,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A474B',
    backgroundColor: '#0B1112',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
    width: '112%',
    height: '112%',
    left: '-6%',
    top: '-6%',
  },
  scrim: StyleSheet.absoluteFillObject,
  edgeShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 10, 9, 0.08)',
  },
  rainLayer: StyleSheet.absoluteFillObject,
  rainLine: {
    position: 'absolute',
    width: 1,
    height: 58,
    backgroundColor: '#E6E9EC',
    transform: [{ rotate: '13deg' }],
  },
  content: {
    padding: 16,
    maxWidth: '86%',
    zIndex: 3,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#D4A54A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  time: { color: 'rgba(230,233,236,0.72)', fontSize: 10, fontWeight: '800' },
  title: { color: '#F6F2E9', fontSize: 18, fontWeight: '900', marginTop: 7 },
  muted: { color: '#D4DBD7', lineHeight: 19, marginTop: 3 },
});
