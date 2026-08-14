import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { AdventureSummary } from '../adventures/types';
import { getAdventureWeather, type WeatherForecast } from './api';
import { MiniWeatherBackdrop } from './MiniWeatherBackdrop';

type Props = { adventure: AdventureSummary };
const FORECAST_HORIZON_MS = 72 * 60 * 60 * 1000;

function formatAvailabilityDate(startsAt: string) {
  const availableAt = new Date(new Date(startsAt).getTime() - FORECAST_HORIZON_MS);
  return availableAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function eventDateKey(startsAt: string) {
  const date = new Date(startsAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AdventureWeatherPanel({ adventure }: Props) {
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mountedAt] = useState(() => Date.now());
  const startsAt = new Date(adventure.starts_at);
  const withinHorizon = startsAt.getTime() - mountedAt <= FORECAST_HORIZON_MS;

  useEffect(() => {
    let active = true;
    if (!withinHorizon) { setWeather(null); setError(''); return () => { active = false; }; }
    setLoading(true); setError('');
    void getAdventureWeather(adventure)
      .then((result) => { if (active) setWeather(result); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Destination weather is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adventure, withinHorizon]);

  const eventDay = useMemo(() => {
    if (!weather) return null;
    const key = eventDateKey(adventure.starts_at);
    return weather.forecast.forecastday.find((day) => day.date === key) ?? null;
  }, [adventure.starts_at, weather]);

  if (!withinHorizon) return <View style={styles.card}><Text style={styles.eyebrow}>DESTINATION WEATHER</Text><Text style={styles.title}>Forecast available {formatAvailabilityDate(adventure.starts_at)}</Text><Text style={styles.body}>We’ll use the adventure location automatically when the event enters the supported 3-day forecast window.</Text></View>;
  if (loading) return <View style={styles.card}><ActivityIndicator color="#D7B45A" /></View>;
  if (error) return <View style={styles.card}><Text style={styles.eyebrow}>DESTINATION WEATHER</Text><Text style={styles.body}>{error}</Text></View>;
  if (!weather || !eventDay) return <View style={styles.card}><Text style={styles.eyebrow}>DESTINATION WEATHER</Text><Text style={styles.title}>Forecast is almost in range</Text><Text style={styles.body}>The weather service does not have the event date yet. Check back as the adventure gets closer.</Text></View>;

  return <View style={[styles.card, styles.liveCard]}>
    <MiniWeatherBackdrop condition={eventDay.day.condition} isDay />
    <View style={styles.liveContent}>
      <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>DESTINATION WEATHER</Text><Text style={styles.location}>{weather.location.name}, {weather.location.region}</Text></View><Text style={styles.range}>{Math.round(eventDay.day.maxtemp_f)}° / {Math.round(eventDay.day.mintemp_f)}°</Text></View>
      <Text style={styles.condition}>{eventDay.day.condition.text}</Text>
      <Text style={styles.body}>{eventDay.day.daily_chance_of_rain}% chance of rain</Text>
      {eventDay.astro?.sunrise || eventDay.astro?.sunset ? <Text style={styles.sun}>Sunrise {eventDay.astro?.sunrise ?? '—'} · Sunset {eventDay.astro?.sunset ?? '—'}</Text> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card:{backgroundColor:'#1A2A22',borderRadius:18,padding:17,borderWidth:1,borderColor:'#385044',gap:7},liveCard:{padding:0,overflow:'hidden',minHeight:132},liveContent:{position:'relative',zIndex:2,padding:17,gap:7},header:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},eyebrow:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},title:{color:'#FFF8E8',fontSize:19,lineHeight:24,fontWeight:'900',marginTop:3},location:{color:'#FFF8E8',fontSize:17,fontWeight:'900',marginTop:4},range:{color:'#FFF8E8',fontSize:19,fontWeight:'900'},condition:{color:'#F1F4F2',fontSize:15,fontWeight:'800'},body:{color:'#D9E0DB',fontSize:13,lineHeight:19},sun:{color:'#C3CCC6',fontSize:12},
});
