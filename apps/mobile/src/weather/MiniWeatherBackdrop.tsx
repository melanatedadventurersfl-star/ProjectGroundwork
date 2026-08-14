import { StyleSheet, View } from 'react-native';

import type { WeatherCondition } from './api';

type Props = {
  condition: WeatherCondition;
  isDay?: boolean;
};

type Kind = 'clear' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow' | 'ice' | 'default';

function kindFor(condition: WeatherCondition): Kind {
  const text = condition.text.toLowerCase();
  if (/thunder|storm/.test(text)) return 'storm';
  if (/sleet|freezing|ice pellet|ice/.test(text)) return 'ice';
  if (/snow|blizzard/.test(text)) return 'snow';
  if (/rain|drizzle|shower/.test(text)) return 'rain';
  if (/mist|fog|haze|smoke|dust|sand/.test(text)) return 'fog';
  if (/partly|partially|sunny intervals/.test(text)) return 'partly';
  if (/cloud|overcast/.test(text)) return 'cloudy';
  if (/sunny|clear/.test(text)) return 'clear';
  return 'default';
}

export function MiniWeatherBackdrop({ condition, isDay = true }: Props) {
  const kind = kindFor(condition);
  const night = !isDay;
  const backgroundColor = night ? '#162534' : kind === 'storm' ? '#26303B' : kind === 'rain' ? '#29444C' : kind === 'cloudy' ? '#40545A' : kind === 'fog' ? '#59655F' : kind === 'snow' || kind === 'ice' ? '#526B79' : '#5F5333';

  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor }]}>
    {kind === 'clear' && isDay ? <View style={styles.sun} /> : null}
    {kind === 'clear' && night ? <><View style={styles.moon} /><View style={styles.starOne} /><View style={styles.starTwo} /></> : null}
    {kind === 'partly' && isDay ? <View style={styles.sunSmall} /> : null}
    {kind === 'partly' && night ? <View style={styles.moonSmall} /> : null}
    {kind === 'partly' || kind === 'cloudy' || kind === 'rain' || kind === 'storm' ? <>
      <View style={[styles.cloud, styles.cloudOne]} />
      <View style={[styles.cloud, styles.cloudTwo]} />
    </> : null}
    {kind === 'rain' || kind === 'storm' ? <>
      <View style={[styles.rain, { left: '66%' }]} />
      <View style={[styles.rain, { left: '77%' }]} />
      <View style={[styles.rain, { left: '88%' }]} />
    </> : null}
    {kind === 'fog' ? <><View style={styles.haze} /><View style={[styles.haze, { top: 52, opacity: 0.11 }]} /></> : null}
    {kind === 'snow' || kind === 'ice' ? <>
      <View style={[styles.flake, { right: 18, top: 18 }]} />
      <View style={[styles.flake, { right: 42, top: 38 }]} />
      <View style={[styles.flake, { right: 28, top: 66 }]} />
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  sun: { position: 'absolute', width: 62, height: 62, borderRadius: 31, right: -6, top: -10, backgroundColor: 'rgba(246,209,104,0.30)' },
  sunSmall: { position: 'absolute', width: 46, height: 46, borderRadius: 23, right: 8, top: 8, backgroundColor: 'rgba(246,209,104,0.24)' },
  moon: { position: 'absolute', width: 44, height: 44, borderRadius: 22, right: 10, top: 8, backgroundColor: 'rgba(231,237,226,0.36)' },
  moonSmall: { position: 'absolute', width: 34, height: 34, borderRadius: 17, right: 12, top: 10, backgroundColor: 'rgba(231,237,226,0.28)' },
  starOne: { position: 'absolute', width: 3, height: 3, borderRadius: 2, right: 58, top: 18, backgroundColor: 'rgba(255,255,255,0.62)' },
  starTwo: { position: 'absolute', width: 2, height: 2, borderRadius: 2, right: 26, top: 62, backgroundColor: 'rgba(255,255,255,0.48)' },
  cloud: { position: 'absolute', width: 86, height: 26, borderRadius: 16, backgroundColor: 'rgba(232,240,241,0.15)' },
  cloudOne: { right: -4, top: 18 },
  cloudTwo: { right: 26, top: 48, transform: [{ scale: 0.72 }] },
  rain: { position: 'absolute', top: 52, width: 2, height: 34, borderRadius: 1, backgroundColor: 'rgba(191,220,230,0.28)', transform: [{ rotate: '14deg' }] },
  haze: { position: 'absolute', right: -8, top: 28, width: 135, height: 14, borderRadius: 9, backgroundColor: 'rgba(235,240,236,0.13)' },
  flake: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(247,251,252,0.62)' },
});
