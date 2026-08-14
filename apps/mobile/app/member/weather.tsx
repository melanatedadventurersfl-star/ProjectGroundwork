import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
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
  const today = data.forecast.forecastday[0];
  if (!today?.hour?.length) return [];
  const localHour = Number((data.location.localtime.split(' ')[1] ?? '').split(':')[0]);
  const start = Number.isFinite(localHour) ? localHour : 0;
  return today.hour.slice(start, start + 8);
}

export default function WeatherScreen() {
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [home, setHome] = useState<{ city: string; state: string } | null>(null);
  const [upcomingAdventures, setUpcomingAdventures] = useState<AdventureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'home' | 'current' | 'search'>('home');
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<WeatherLocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  async function loadHome() {
    setLoading(true); setError(''); setSuggestions([]);
    try {
      const basecamp = await getMemberBasecamp();
      const city = basecamp.profile?.home_city;
      const state = basecamp.profile?.home_state;
      if (!city || !state) throw new Error('Set a city and state in Edit Profile first.');
      setHome({ city, state });
      setData(await getWeather(city, state));
      setMode('home');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load weather.');
    } finally { setLoading(false); }
  }

  async function loadCurrent() {
    setLoading(true); setError(''); setSuggestions([]);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location permission is needed to use Current Location.');
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setData(await getWeatherByCoordinates(location.coords.latitude, location.coords.longitude));
      setMode('current');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to use current location.');
    } finally { setLoading(false); }
  }

  async function runSearch(query = searchText) {
    const value = query.trim();
    if (!value) return;
    setLoading(true); setError(''); setSuggestions([]);
    try {
      setData(await getWeatherByQuery(value));
      setMode('search');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to find that location.');
    } finally { setLoading(false); }
  }

  async function chooseSuggestion(item: WeatherLocationSuggestion) {
    setSearchText([item.name, item.region].filter(Boolean).join(', '));
    setSuggestions([]); setLoading(true); setError('');
    try {
      setData(await getWeatherByCoordinates(item.lat, item.lon));
      setMode('search');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load that location.');
    } finally { setLoading(false); }
  }

  async function updateSearch(value: string) {
    setSearchText(value);
    const term = value.trim();
    if (term.length < 2) { setSuggestions([]); return; }
    setSearching(true);
    try { setSuggestions((await searchWeatherLocations(term)).slice(0, 5)); }
    catch { setSuggestions([]); }
    finally { setSearching(false); }
  }

  useEffect(() => {
    void loadHome();
    void listAdventures({ savedOnly: true })
      .then((items) => setUpcomingAdventures(items.filter((item) => new Date(item.ends_at).getTime() >= Date.now())))
      .catch(() => setUpcomingAdventures([]));
  }, []);

  const hours = useMemo(() => data ? nextHours(data) : [], [data]);
  const conditions = useMemo(() => data ? adventureCondition(data) : null, [data]);
  const days = data?.forecast?.forecastday ?? [];
  const today = days[0];

  return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
      <Text style={s.eyebrow}>WEATHER & LOCATION</Text>
      <Text style={s.title}>Trail weather</Text>
      <Text style={s.intro}>Check Home, where you are now, or another city or ZIP code without changing your profile.</Text>

      <View style={s.toggle}>
        <Pressable style={[s.toggleBtn, mode === 'home' && s.active]} onPress={() => void loadHome()}><Text style={[s.toggleText, mode === 'home' && s.activeText]}>Home</Text></Pressable>
        <Pressable style={[s.toggleBtn, mode === 'current' && s.active]} onPress={() => void loadCurrent()}><Text style={[s.toggleText, mode === 'current' && s.activeText]}>Current</Text></Pressable>
        <Pressable style={[s.toggleBtn, mode === 'search' && s.active]} onPress={() => { if (searchText.trim()) void runSearch(); }}><Text style={[s.toggleText, mode === 'search' && s.activeText]}>Search</Text></Pressable>
      </View>

      <View style={s.searchBox}>
        <TextInput value={searchText} onChangeText={(value) => void updateSearch(value)} onSubmitEditing={() => void runSearch()} placeholder="City, state, or ZIP code" placeholderTextColor="#6F7C74" style={s.input} returnKeyType="search" />
        <Pressable style={s.searchButton} onPress={() => void runSearch()}><Text style={s.searchButtonText}>Search</Text></Pressable>
      </View>
      {searching ? <ActivityIndicator size="small" color="#D7B45A" /> : null}
      {suggestions.length ? <View style={s.suggestions}>{suggestions.map((item) => <Pressable key={`${item.id}-${item.lat}-${item.lon}`} style={s.suggestion} onPress={() => void chooseSuggestion(item)}><Text style={s.suggestionName}>{item.name}{item.region ? `, ${item.region}` : ''}</Text><Text style={s.suggestionCountry}>{item.country}</Text></Pressable>)}</View> : null}

      {loading ? <ActivityIndicator color="#D7B45A" style={{ margin: 24 }} /> : null}
      {error ? <View style={s.card}><Text style={s.error}>{error}</Text>{!home ? <Pressable onPress={() => router.push('/member/profile')}><Text style={s.link}>Edit Profile →</Text></Pressable> : null}</View> : null}

      {data && !loading ? <>
        <WeatherScene weather={data} />

        {hours.length ? <>
          <View style={s.sectionRow}><Text style={s.section}>Today by hour</Text><Text style={s.sectionMeta}>Next {hours.length} hours</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hourlyRow}>
            {hours.map((hour) => <View key={hour.time} style={s.hourCard}>
              <MiniWeatherBackdrop condition={hour.condition} isDay={hour.is_day !== 0} />
              <View style={s.cardContent}><Text style={s.hourTime}>{hourLabel(hour.time)}</Text><Text style={s.hourTemp}>{Math.round(hour.temp_f)}°</Text><Text style={s.hourCondition} numberOfLines={2}>{hour.condition.text}</Text><Text style={s.hourRain}>{Math.round(hour.chance_of_rain ?? 0)}% rain</Text></View>
            </View>)}
          </ScrollView>
        </> : null}

        {conditions ? <View style={s.adventureCard}><View style={s.sectionRow}><Text style={s.adventureEyebrow}>ADVENTURE CONDITIONS</Text><Text style={s.conditionBadge}>{conditions.label}</Text></View><Text style={s.adventureNote}>{conditions.note}</Text><View style={s.metricRow}><View style={s.metric}><Text style={s.metricValue}>{Math.round(data.current.feelslike_f)}°</Text><Text style={s.metricLabel}>Feels</Text></View><View style={s.metric}><Text style={s.metricValue}>{today?.day.daily_chance_of_rain ?? 0}%</Text><Text style={s.metricLabel}>Rain</Text></View><View style={s.metric}><Text style={s.metricValue}>{Math.round(data.current.wind_mph)}</Text><Text style={s.metricLabel}>Wind mph</Text></View><View style={s.metric}><Text style={s.metricValue}>{Math.round(data.current.uv ?? today?.day.uv ?? 0)}</Text><Text style={s.metricLabel}>UV</Text></View></View>{today?.astro?.sunrise || today?.astro?.sunset ? <Text style={s.sunLine}>Sunrise {today.astro?.sunrise ?? '—'} · Sunset {today.astro?.sunset ?? '—'}</Text> : null}</View> : null}

        {upcomingAdventures.length ? <View style={s.savedSection}><View style={s.sectionRow}><View><Text style={s.section}>Upcoming events</Text><Text style={s.savedIntro}>Weather follows each saved adventure’s destination automatically.</Text></View><Text style={s.sectionMeta}>{upcomingAdventures.length}</Text></View>{upcomingAdventures.map((adventure) => <Pressable key={adventure.id} onPress={() => router.push(`/adventures/${adventure.id}`)} style={s.savedWrap}><View style={s.savedHeader}><Text style={s.savedTitle}>{adventure.title}</Text><Text style={s.savedDate}>{new Date(adventure.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View><AdventureWeatherPanel adventure={adventure} /></Pressable>)}</View> : null}

        <Text style={s.section}>3-day outlook</Text>
        {days.map((day) => <View key={day.date} style={s.day}><MiniWeatherBackdrop condition={day.day.condition} isDay /><View style={[s.cardContent, s.dayContent]}><View style={{ flex: 1 }}><Text style={s.dayTitle}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text><Text style={s.condition}>{day.day.condition.text}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={s.range}>{Math.round(day.day.maxtemp_f)}° / {Math.round(day.day.mintemp_f)}°</Text><Text style={s.rain}>{day.day.daily_chance_of_rain}% rain</Text></View></View></View>)}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:60,gap:12},back:{color:'#D7B45A',fontWeight:'900'},eyebrow:{color:'#D7B45A',fontSize:11,fontWeight:'900',letterSpacing:1.1,marginTop:8},title:{color:'#FFF8E8',fontSize:34,fontWeight:'900'},intro:{color:'#9DA8A1',lineHeight:21},toggle:{flexDirection:'row',backgroundColor:'#151F1A',borderRadius:14,padding:4,gap:4},toggleBtn:{flex:1,paddingVertical:10,paddingHorizontal:7,borderRadius:11,alignItems:'center'},active:{backgroundColor:'#D7B45A'},toggleText:{color:'#AAB4AE',fontWeight:'800',fontSize:12,textAlign:'center'},activeText:{color:'#17211C'},searchBox:{flexDirection:'row',gap:8},input:{flex:1,backgroundColor:'#17211C',borderWidth:1,borderColor:'#2D3B33',borderRadius:14,paddingHorizontal:13,paddingVertical:11,color:'#FFF8E8'},searchButton:{backgroundColor:'#D7B45A',borderRadius:14,paddingHorizontal:14,justifyContent:'center'},searchButtonText:{color:'#17211C',fontWeight:'900'},suggestions:{backgroundColor:'#17211C',borderRadius:14,borderWidth:1,borderColor:'#2D3B33',overflow:'hidden'},suggestion:{paddingHorizontal:14,paddingVertical:11,borderBottomWidth:1,borderBottomColor:'#26342C'},suggestionName:{color:'#FFF8E8',fontWeight:'800'},suggestionCountry:{color:'#859189',fontSize:11,marginTop:2},card:{backgroundColor:'#17211C',borderRadius:16,padding:16},error:{color:'#FFB4A9',lineHeight:20},link:{color:'#D7B45A',fontWeight:'900',marginTop:8},sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},section:{color:'#FFF8E8',fontSize:21,fontWeight:'900',marginTop:7},sectionMeta:{color:'#7E8B83',fontSize:11,fontWeight:'700'},hourlyRow:{gap:9,paddingRight:6},hourCard:{width:108,minHeight:132,borderRadius:16,borderWidth:1,borderColor:'#35473D',overflow:'hidden'},cardContent:{position:'relative',zIndex:2,padding:12},hourTime:{color:'#D9E0DB',fontSize:11,fontWeight:'800'},hourTemp:{color:'#FFF8E8',fontSize:28,fontWeight:'900',marginTop:5},hourCondition:{color:'#EEF1EF',fontSize:12,lineHeight:16,marginTop:3},hourRain:{color:'#F0D083',fontSize:11,marginTop:6},adventureCard:{backgroundColor:'#1A2A22',borderRadius:18,borderWidth:1,borderColor:'#385044',padding:16,gap:11},adventureEyebrow:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},conditionBadge:{color:'#17211C',backgroundColor:'#D7B45A',borderRadius:999,paddingHorizontal:10,paddingVertical:5,fontSize:11,fontWeight:'900'},adventureNote:{color:'#E1E7E3',fontSize:15,lineHeight:21,fontWeight:'700'},metricRow:{flexDirection:'row',justifyContent:'space-between',gap:6},metric:{flex:1},metricValue:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},metricLabel:{color:'#87938B',fontSize:10,marginTop:2},sunLine:{color:'#98A69D',fontSize:12},condition:{color:'#EEF1EF',fontSize:16,marginTop:2},day:{minHeight:92,borderRadius:16,borderWidth:1,borderColor:'#35473D',overflow:'hidden'},dayContent:{flex:1,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,padding:15},dayTitle:{color:'#FFF8E8',fontWeight:'900'},range:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},rain:{color:'#F0D083',fontSize:12,marginTop:3},savedSection:{gap:10,marginTop:5},savedIntro:{color:'#87938B',fontSize:12,marginTop:3,maxWidth:290},savedWrap:{gap:7},savedHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',gap:12,paddingHorizontal:2},savedTitle:{color:'#FFF8E8',fontWeight:'900',fontSize:15,flex:1},savedDate:{color:'#A7B1AA',fontSize:12,fontWeight:'800'},
});
