import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import { getWeatherByCoordinates, type WeatherForecast } from '../weather/api';
import { backgroundFor, dayPhaseFor, displayRankByRank, glyph, greetingFor, normalizeWeather, rankThemes, weatherCopy } from './trailheadBannerConfig';
import { styles } from './trailheadBannerStyles';

export function TrailheadCover({ displayName, rank, onRankPress }: { coverUrl?: string | null; displayName: string; rank: RankName; greeting: string; busy?: boolean; onEdit?: () => void; onRankPress: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 420, veryCompact = width < 370;
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [locationLabel, setLocationLabel] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let p = await Location.getForegroundPermissionsAsync();
        if (p.status === 'undetermined') p = await Location.requestForegroundPermissionsAsync();
        if (!active || p.status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const next = await getWeatherByCoordinates(pos.coords.latitude, pos.coords.longitude);
        if (!active) return;
        setWeatherData(next); setLocationLabel([next.location.name, next.location.region].filter(Boolean).join(', '));
      } catch { if (active) { setWeatherData(null); setLocationLabel(''); } }
    })();
    return () => { active = false; };
  }, []);

  const displayRank = displayRankByRank[rank], theme = rankThemes[displayRank];
  const weather = useMemo(() => normalizeWeather(weatherData?.current.condition.text), [weatherData?.current.condition.text]);
  const phase = useMemo(() => dayPhaseFor(weatherData), [weatherData]);
  const background = useMemo(() => backgroundFor(rank, weather, phase), [rank, weather, phase]);
  const greeting = greetingFor(phase), temp = weatherData ? `${Math.round(weatherData.current.temp_f)}°` : '--°';
  const condition = weatherData?.current.condition.text ? weather.replace('-', ' ').toUpperCase() : 'LOCAL WEATHER';
  const location = locationLabel || 'Current location';
  const detail = weatherData ? weatherCopy(weather, phase) : 'Weather appears when location access is available.';

  return <ImageBackground source={background} resizeMode="cover" imageStyle={styles.imageRadius} style={[styles.cover, compact && styles.coverCompact, { borderColor: theme.accent, shadowColor: theme.accent }]}>
    <View style={styles.baseScrim} /><View style={[styles.rankGlow, { backgroundColor: theme.glow }]} /><View style={[styles.leftScrim, compact && styles.leftScrimCompact]} /><View style={styles.bottomScrim} />
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${displayRank} rank progress`} onPress={onRankPress} style={[styles.primaryEmblem, compact && styles.primaryEmblemCompact]}><RankEmblem rank={rank} size={compact ? 80 : 108} /></Pressable>
    <View style={styles.headerActions}><Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}><AppIcon name="notifications" color="#FFF8E8" size={18} /></Pressable><Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.headerButton}><AppIcon name="profile" color="#FFF8E8" size={18} /></Pressable></View>
    <View style={[styles.titleBlock, compact && styles.titleBlockCompact, veryCompact && styles.titleBlockVeryCompact]}><Text style={[styles.greeting, compact && styles.greetingCompact]}>{greeting},</Text><Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{displayName}</Text></View>
    <View style={[styles.metaBlock, compact && styles.metaBlockCompact]}>
      <View style={styles.statusRow}><Pressable accessibilityRole="button" accessibilityLabel={`View ${displayRank} rank progress`} onPress={onRankPress} style={styles.rankInline}><Text style={[styles.rankGlyph, { color: theme.accent }]}>✥</Text><Text style={[styles.rankText, { color: theme.accent }]} numberOfLines={1}>{displayRank.toUpperCase()}</Text></Pressable><Text style={styles.dot}>•</Text><Text style={styles.statusIcon}>{glyph('clear', phase)}</Text><Text style={styles.statusText}>{temp}</Text><Text style={styles.dot}>•</Text><Text style={styles.statusIcon}>{glyph(weather, phase)}</Text><Text style={styles.statusText}>{condition}</Text></View>
      <View style={styles.detailRow}><Text style={styles.location} numberOfLines={1}>⌖ {location}</Text>{!veryCompact ? <Text style={[styles.weatherCopy, { color: theme.soft }]} numberOfLines={1}>{detail}</Text> : null}</View>{veryCompact ? <Text style={[styles.weatherCopyCompact, { color: theme.soft }]} numberOfLines={1}>{detail}</Text> : null}
    </View>
    {!compact ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${displayRank} rank progress`} onPress={onRankPress} style={styles.secondaryRank}><RankEmblem rank={rank} size={72} /><View style={[styles.rankPill, { borderColor: theme.accent }]}><Text style={[styles.rankPillText, { color: theme.soft }]} numberOfLines={1}>{displayRank.toUpperCase()}</Text></View></Pressable> : null}
  </ImageBackground>;
}
