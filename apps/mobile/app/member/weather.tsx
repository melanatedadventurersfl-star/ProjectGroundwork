import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listAdventures } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { getMemberBasecamp } from '../../src/member/api';
import { AdventureWeatherPanel } from '../../src/weather/AdventureWeatherPanel';
import { MiniWeatherBackdrop } from '../../src/weather/MiniWeatherBackdrop';
import { WeatherScene } from '../../src/weather/WeatherScene';
import {
  getWeather,
  getWeatherByCoordinates,
  getWeatherByQuery,
  searchWeatherLocations,
  type WeatherForecast,
  type WeatherHour,
  type WeatherLocationSuggestion,
} from '../../src/weather/api';

function hourLabel(value: string) {
  const time = value.split(' ')[1] ?? value;
  const [h = '0'] = time.split(':');
  const hour = Number(h);
  if (!Number.isFinite(hour)) return time;
  return `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function hourDate(value: string) {
  return value.split(' ')[0] ?? '';
}

function dayBreakLabel(value: string, currentDate: string) {
  const date = hourDate(value);
  if (!date || date === currentDate) return '';
  const current = new Date(`${currentDate}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);
  const dayDifference = Math.round((target.getTime() - current.getTime()) / 86_400_000);
  if (dayDifference === 1) return 'Tomorrow';
  return target.toLocaleDateString(undefined, { weekday: 'short' });
}

function adventureCondition(data: WeatherForecast) {
  const feels = data.current.feelslike_f;
  const wind = data.current.wind_mph;
  const rain = data.forecast.forecastday[0]?.day.daily_chance_of_rain ?? 0;
  const uv = data.current.uv ?? data.forecast.forecastday[0]?.day.uv ?? 0;
  if (feels >= 105) return { label: 'Use caution', note: 'Extreme heat. Favor early morning or evening plans.' };
  if (rain >= 70) return { label: 'Weather watch', note: 'High rain chance. Keep a flexible outdoor plan.' };
  if (wind >= 25) return { label: 'Weather watch', note: 'Wind may affect exposed trails, paddling, and camp setups.' };
  if (uv >= 8) return { label: 'Plan smart', note: 'Very high UV. Shade, hydration, and sun protection matter.' };
  if (feels >= 95 || rain >= 40) return { label: 'Fair', note: 'Outdoor time is workable, but conditions deserve attention.' };
  return { label: 'Good', note: 'Conditions look comfortable for many outdoor activities.' };
}

function nextHours(data: WeatherForecast): WeatherHour[] {
  const allHours = data.forecast.forecastday.flatMap((day) => day.hour ?? []);
  if (!allHours.length) return [];
  const [localDate = '', localTime = '00:00'] = data.location.localtime.split(' ');
  const [localHour = '00'] = localTime.split(':');
  const startKey = `${localDate} ${localHour.padStart(2, '0')}:00`;
  return allHours.filter((hour) => hour.time >= startKey).slice(0, 12);
}

export default function WeatherScreen() {
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [upcomingAdventures, setUpcomingAdventures] = useState<AdventureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<WeatherLocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locationSource, setLocationSource] = useState<'current' | 'home' | 'search'>('current');

  async function loadHomeFallback() {
    const basecamp = await getMemberBasecamp();
    const city = basecamp.profile?.home_city;
    const state = basecamp.profile?.home_state;
    if (!city || !state) throw new Error('Location permission is needed, or set a home city and state in Edit Profile.');
    setData(await getWeather(city, state));
    setLocationSource('home');
  }

  async function loadCurrent() {
    setLoading(true);
    setError('');
    setSuggestions([]);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        await loadHomeFallback();
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setData(await getWeatherByCoordinates(location.coords.latitude, location.coords.longitude));
      setLocationSource('current');
      setSearchText('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to use current location.');
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(query = searchText) {
    const value = query.trim();
    if (!value) return;
    setLoading(true);
    setError('');
    setSuggestions([]);
    try {
      setData(await getWeatherByQuery(value));
      setLocationSource('search');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to find that location.');
    } finally {
      setLoading(false);
    }
  }

  async function chooseSuggestion(item: WeatherLocationSuggestion) {
    setSearchText([item.name, item.region].filter(Boolean).join(', '));
    setSuggestions([]);
    setLoading(true);
    setError('');
    try {
      setData(await getWeatherByCoordinates(item.lat, item.lon));
      setLocationSource('search');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load that location.');
    } finally {
      setLoading(false);
    }
  }

  async function updateSearch(value: string) {
    setSearchText(value);
    const term = value.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      setSuggestions((await searchWeatherLocations(term)).slice(0, 5));
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    void loadCurrent();
    void listAdventures({ savedOnly: true })
      .then((items) => setUpcomingAdventures(items.filter((item) => new Date(item.ends_at).getTime() >= Date.now())))
      .catch(() => setUpcomingAdventures([]));
  }, []);

  const hours = useMemo(() => data ? nextHours(data) : [], [data]);
  const conditions = useMemo(() => data ? adventureCondition(data) : null, [data]);
  const days = data?.forecast?.forecastday ?? [];
  const today = days[0];
  const currentDate = data?.location.localtime.split(' ')[0] ?? '';
  const activeLocation = data ? [data.location.name, data.location.region].filter(Boolean).join(', ') : '';
  const sourceLabel = locationSource === 'current' ? 'Current Location' : locationSource === 'home' ? 'Home Location' : 'Searched Location';

  return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
      <Text style={s.eyebrow}>WEATHER & LOCATION</Text>
      <Text style={s.title}>Trail weather</Text>
      <Text style={s.intro}>Check the weather where you are, search anywhere, and see what conditions look like for upcoming events.</Text>

      <View style={s.searchBox}>
        <TextInput
          value={searchText}
          onChangeText={(value) => void updateSearch(value)}
          onSubmitEditing={() => void runSearch()}
          placeholder="Search city, state, or ZIP code"
          placeholderTextColor="#6F7C74"
          style={s.input}
          returnKeyType="search"
        />
        {searching ? <ActivityIndicator size="small" color="#D7B45A" style={s.searchSpinner} /> : null}
      </View>
      {suggestions.length ? <View style={s.suggestions}>
        {suggestions.map((item) => <Pressable key={`${item.id}-${item.lat}-${item.lon}`} style={s.suggestion} onPress={() => void chooseSuggestion(item)}>
          <Text style={s.suggestionName}>{item.name}{item.region ? `, ${item.region}` : ''}</Text>
          <Text style={s.suggestionCountry}>{item.country}</Text>
        </Pressable>)}
      </View> : null}

      {data && !loading ? <Pressable style={s.locationRow} onPress={() => void loadCurrent()}>
        <View style={s.locationPin}><Text style={s.locationPinText}>⌖</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.locationSource}>{sourceLabel}</Text>
          <Text style={s.locationName}>{activeLocation}</Text>
        </View>
        {locationSource !== 'current' ? <Text style={s.locationAction}>Use current</Text> : null}
      </Pressable> : null}

      {loading ? <ActivityIndicator color="#D7B45A" style={{ margin: 24 }} /> : null}
      {error ? <View style={s.card}>
        <Text style={s.error}>{error}</Text>
        <Pressable onPress={() => router.push('/member/profile')}><Text style={s.link}>Edit Profile →</Text></Pressable>
      </View> : null}

      {data && !loading ? <>
        <WeatherScene weather={data} />

        {hours.length ? <>
          <Text style={s.section}>Next 12 hours</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hourlyRow}>
            {hours.map((hour, index) => {
              const previousDate = index > 0 ? hourDate(hours[index - 1].time) : hourDate(hour.time);
              const dateChanged = index > 0 && hourDate(hour.time) !== previousDate;
              const breakLabel = dateChanged ? dayBreakLabel(hour.time, currentDate) : '';
              return <Fragment key={hour.time}>
                {breakLabel ? <View style={s.dayBreak}>
                  <View style={s.dayBreakLine} />
                  <Text style={s.dayBreakText}>{breakLabel}</Text>
                  <View style={s.dayBreakLine} />
                </View> : null}
                <View style={s.hourCard}>
                  <MiniWeatherBackdrop condition={hour.condition} isDay={hour.is_day !== 0} />
                  <View style={s.cardContent}>
                    <Text style={s.hourTime}>{hourLabel(hour.time)}</Text>
                    <Text style={s.hourTemp}>{Math.round(hour.temp_f)}°</Text>
                    <Text style={s.hourCondition} numberOfLines={2}>{hour.condition.text}</Text>
                    <Text style={s.hourRain}>{Math.round(hour.chance_of_rain ?? 0)}% rain</Text>
                  </View>
                </View>
              </Fragment>;
            })}
          </ScrollView>
        </> : null}

        {conditions ? <View style={s.adventureCard}>
          <View style={s.sectionRow}>
            <Text style={s.adventureEyebrow}>ADVENTURE CONDITIONS</Text>
            <Text style={s.conditionBadge}>{conditions.label}</Text>
          </View>
          <Text style={s.adventureNote}>{conditions.note}</Text>
          <View style={s.metricRow}>
            <View style={s.metric}><Text style={s.metricValue}>{Math.round(data.current.feelslike_f)}°</Text><Text style={s.metricLabel}>Feels</Text></View>
            <View style={s.metric}><Text style={s.metricValue}>{today?.day.daily_chance_of_rain ?? 0}%</Text><Text style={s.metricLabel}>Rain</Text></View>
            <View style={s.metric}><Text style={s.metricValue}>{Math.round(data.current.wind_mph)}</Text><Text style={s.metricLabel}>Wind mph</Text></View>
            <View style={s.metric}><Text style={s.metricValue}>{Math.round(data.current.uv ?? today?.day.uv ?? 0)}</Text><Text style={s.metricLabel}>UV</Text></View>
          </View>
          {today?.astro?.sunrise || today?.astro?.sunset ? <Text style={s.sunLine}>Sunrise {today.astro?.sunrise ?? '—'} · Sunset {today.astro?.sunset ?? '—'}</Text> : null}
        </View> : null}

        <Text style={s.section}>3-day outlook</Text>
        {days.map((day) => <View key={day.date} style={s.day}>
          <MiniWeatherBackdrop condition={day.day.condition} isDay />
          <View style={[s.cardContent, s.dayContent]}>
            <View style={{ flex: 1 }}>
              <Text style={s.dayTitle}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
              <Text style={s.condition}>{day.day.condition.text}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.range}>{Math.round(day.day.maxtemp_f)}° / {Math.round(day.day.mintemp_f)}°</Text>
              <Text style={s.rain}>{day.day.daily_chance_of_rain}% rain</Text>
            </View>
          </View>
        </View>)}
      </> : null}

      <View style={s.eventsSection}>
        <View style={s.sectionRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.section}>Upcoming Events</Text>
            <Text style={s.savedIntro}>Destination weather for adventures you&apos;ve saved.</Text>
          </View>
          <Text style={s.sectionMeta}>{upcomingAdventures.length}</Text>
        </View>
        {upcomingAdventures.length ? upcomingAdventures.map((adventure) => <Pressable key={adventure.id} onPress={() => router.push(`/adventures/${adventure.id}`)} style={s.savedWrap}>
          <View style={s.savedHeader}>
            <Text style={s.savedTitle}>{adventure.title}</Text>
            <Text style={s.savedDate}>{new Date(adventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </View>
          <AdventureWeatherPanel adventure={adventure} />
        </Pressable>) : <View style={s.emptyCard}>
          <Text style={s.emptyTitle}>No upcoming events yet</Text>
          <Text style={s.emptyBody}>Save an adventure and its destination weather will appear here automatically.</Text>
        </View>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0F1713'},
  content:{padding:20,paddingBottom:60,gap:12},
  back:{color:'#D7B45A',fontWeight:'900'},
  eyebrow:{color:'#D7B45A',fontSize:11,fontWeight:'900',letterSpacing:1.1,marginTop:8},
  title:{color:'#FFF8E8',fontSize:34,fontWeight:'900'},
  intro:{color:'#9DA8A1',lineHeight:21},
  searchBox:{position:'relative'},
  input:{backgroundColor:'#17211C',borderWidth:1,borderColor:'#2D3B33',borderRadius:14,paddingHorizontal:13,paddingVertical:12,paddingRight:42,color:'#FFF8E8'},
  searchSpinner:{position:'absolute',right:13,top:13},
  suggestions:{backgroundColor:'#17211C',borderRadius:14,borderWidth:1,borderColor:'#2D3B33',overflow:'hidden'},
  suggestion:{paddingHorizontal:14,paddingVertical:11,borderBottomWidth:1,borderBottomColor:'#26342C'},
  suggestionName:{color:'#FFF8E8',fontWeight:'800'},
  suggestionCountry:{color:'#859189',fontSize:11,marginTop:2},
  locationRow:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#151F1A',borderRadius:14,borderWidth:1,borderColor:'#2D3B33',paddingHorizontal:12,paddingVertical:10},
  locationPin:{width:30,height:30,borderRadius:15,backgroundColor:'#213129',alignItems:'center',justifyContent:'center'},
  locationPinText:{color:'#D7B45A',fontSize:17,fontWeight:'900'},
  locationSource:{color:'#D7B45A',fontSize:10,fontWeight:'900',textTransform:'uppercase',letterSpacing:0.7},
  locationName:{color:'#FFF8E8',fontSize:14,fontWeight:'800',marginTop:1},
  locationAction:{color:'#AAB4AE',fontSize:11,fontWeight:'800'},
  card:{backgroundColor:'#17211C',borderRadius:16,padding:16},
  error:{color:'#FFB4A9',lineHeight:20},
  link:{color:'#D7B45A',fontWeight:'900',marginTop:8},
  sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},
  section:{color:'#FFF8E8',fontSize:21,fontWeight:'900',marginTop:7},
  sectionMeta:{color:'#7E8B83',fontSize:11,fontWeight:'700'},
  hourlyRow:{gap:9,paddingRight:6,alignItems:'stretch'},
  dayBreak:{width:54,minHeight:132,alignItems:'center',justifyContent:'center',gap:7},
  dayBreakLine:{width:1,flex:1,backgroundColor:'#35473D'},
  dayBreakText:{color:'#D7B45A',fontSize:10,fontWeight:'900',textTransform:'uppercase',letterSpacing:0.7,textAlign:'center'},
  hourCard:{width:108,minHeight:132,borderRadius:16,borderWidth:1,borderColor:'#35473D',overflow:'hidden'},
  cardContent:{position:'relative',zIndex:2,padding:12},
  hourTime:{color:'#D9E0DB',fontSize:11,fontWeight:'800'},
  hourTemp:{color:'#FFF8E8',fontSize:28,fontWeight:'900',marginTop:5},
  hourCondition:{color:'#EEF1EF',fontSize:12,lineHeight:16,marginTop:3},
  hourRain:{color:'#F0D083',fontSize:11,marginTop:6},
  adventureCard:{backgroundColor:'#1A2A22',borderRadius:18,borderWidth:1,borderColor:'#385044',padding:16,gap:11},
  adventureEyebrow:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},
  conditionBadge:{color:'#17211C',backgroundColor:'#D7B45A',borderRadius:999,paddingHorizontal:10,paddingVertical:5,fontSize:11,fontWeight:'900'},
  adventureNote:{color:'#E1E7E3',fontSize:15,lineHeight:21,fontWeight:'700'},
  metricRow:{flexDirection:'row',justifyContent:'space-between',gap:6},
  metric:{flex:1},
  metricValue:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},
  metricLabel:{color:'#87938B',fontSize:10,marginTop:2},
  sunLine:{color:'#98A69D',fontSize:12},
  condition:{color:'#EEF1EF',fontSize:16,marginTop:2},
  day:{minHeight:92,borderRadius:16,borderWidth:1,borderColor:'#35473D',overflow:'hidden'},
  dayContent:{flex:1,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,padding:15},
  dayTitle:{color:'#FFF8E8',fontWeight:'900'},
  range:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},
  rain:{color:'#F0D083',fontSize:12,marginTop:3},
  eventsSection:{gap:10,marginTop:10,paddingTop:4},
  savedIntro:{color:'#87938B',fontSize:12,marginTop:3,maxWidth:290},
  savedWrap:{gap:7},
  savedHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',gap:12,paddingHorizontal:2},
  savedTitle:{color:'#FFF8E8',fontWeight:'900',fontSize:15,flex:1},
  savedDate:{color:'#A7B1AA',fontSize:12,fontWeight:'800'},
  emptyCard:{backgroundColor:'#17211C',borderRadius:16,borderWidth:1,borderColor:'#2D3B33',padding:18,gap:5},
  emptyTitle:{color:'#FFF8E8',fontWeight:'900',fontSize:16},
  emptyBody:{color:'#87938B',lineHeight:19},
});