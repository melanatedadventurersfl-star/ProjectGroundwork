import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { WeatherCondition } from './api';
import { weatherVisualFor, type WeatherVisualPhase } from './weatherVisuals';

type Props = {
  condition: WeatherCondition;
  isDay?: boolean;
  phase?: WeatherVisualPhase;
};

type MotionKind = 'clear' | 'cloud' | 'rain' | 'storm' | 'fog' | 'other';

function motionKind(condition: WeatherCondition): MotionKind {
  const text = condition.text.toLowerCase();
  if (/thunder|storm|torrential|heavy rain/.test(text)) return 'storm';
  if (/rain|drizzle|shower/.test(text)) return 'rain';
  if (/mist|fog|haze|smoke|dust|sand/.test(text)) return 'fog';
  if (/cloud|overcast|partly|partially/.test(text)) return 'cloud';
  if (/sunny|clear/.test(text)) return 'clear';
  return 'other';
}

export function MiniWeatherBackdrop({ condition, isDay = true, phase }: Props) {
  const kind = motionKind(condition);
  const visual = weatherVisualFor(condition.text, isDay, phase);
  const [drift] = useState(() => new Animated.Value(0));
  const [rain] = useState(() => new Animated.Value(0));
  const [breathe] = useState(() => new Animated.Value(0));

  useEffect(() => {
    drift.stopAnimation();
    rain.stopAnimation();
    breathe.stopAnimation();
    drift.setValue(0);
    rain.setValue(0);
    breathe.setValue(0);

    const animations: Animated.CompositeAnimation[] = [];

    if (kind === 'cloud' || kind === 'fog' || kind === 'rain' || kind === 'storm') {
      animations.push(Animated.loop(Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])));
    } else {
      animations.push(Animated.loop(Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])));
    }

    if (kind === 'rain' || kind === 'storm') {
      animations.push(Animated.loop(Animated.timing(rain, {
        toValue: 1,
        duration: kind === 'storm' ? 900 : 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })));
    }

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [breathe, drift, kind, rain]);

  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] });
  const rainY = rain.interpolate({ inputRange: [0, 1], outputRange: [-24, 86] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1.1] });
  const imageOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] });
  const overlayOpacity = !isDay ? 0.44 : kind === 'storm' ? 0.45 : kind === 'rain' ? 0.36 : 0.3;

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Animated.Image
      source={{ uri: visual }}
      resizeMode="cover"
      style={[
        styles.image,
        {
          opacity: kind === 'clear' || kind === 'other' ? imageOpacity : 1,
          transform: [
            { translateX: kind === 'clear' || kind === 'other' ? 0 : driftX },
            { scale: kind === 'clear' || kind === 'other' ? scale : 1.09 },
          ],
        },
      ]}
    />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(7, 14, 12, ${overlayOpacity})` }]} />
    {kind === 'rain' || kind === 'storm' ? <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: rainY }] }]}>
      <View style={[styles.rainLine, { left: '61%' }]} />
      <View style={[styles.rainLine, { left: '72%', opacity: 0.36 }]} />
      <View style={[styles.rainLine, { left: '84%', opacity: 0.28 }]} />
      <View style={[styles.rainLine, { left: '94%', opacity: 0.22 }]} />
    </Animated.View> : null}
  </View>;
}

const styles = StyleSheet.create({
  image: {
    position: 'absolute',
    width: '112%',
    height: '112%',
    left: '-6%',
    top: '-6%',
  },
  rainLine: {
    position: 'absolute',
    top: -34,
    width: 1,
    height: 48,
    backgroundColor: 'rgba(226, 238, 241, 0.44)',
    transform: [{ rotate: '13deg' }],
  },
});
