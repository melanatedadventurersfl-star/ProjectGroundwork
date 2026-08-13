import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Dimensions,
  FlatList,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listAdventures } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { getCommunityFeed, getGroups, type CommunityPost } from '../../src/community/api';
import { supabase } from '../../src/lib/supabase';
import { getJourney, getMemberBadges, getPassportStamps } from '../../src/passport/api';
import { getAdventureQueue } from '../../src/readiness/api';
import type { AdventureQueueItem } from '../../src/readiness/types';
import { getWeather, type WeatherForecast } from '../../src/weather/api';

const CARD_WIDTH = Dimensions.get('window').width - 36;

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function rankFor(count: number) {
  if (count >= 20) return 'Legacy Adventurer';
  if (count >= 10) return 'Summiteer';
  if (count >= 5) return 'Wayfinder';
  if (count >= 3) return 'Trailblazer';
  if (count >= 1) return 'Pathfinder';
  return 'Explorer';
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function weatherTheme(weather: WeatherForecast | null) {
  const text = weather?.current.condition.text.toLowerCase() ?? '';
  if (/thunder|storm/.test(text)) return { glyph: 'ϟ', background: '#26313A' };
  if (/rain|drizzle|shower/.test(text)) return { glyph: '☂', background: '#20343A' };
  if (/snow|sleet|ice/.test(text)) return { glyph: '✦', background: '#35464A' };
  if (/cloud|overcast|mist|fog/.test(text)) return { glyph: '☁', background: '#34413B' };
  if (/sun|clear/.test(text)) return { glyph: '☀', background: '#5A4622' };
  return { glyph: '◌', background: '#1A2821' };
}

export default function TrailheadScreen() {
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [firstName, setFirstName] = useState('Adventurer');
  const [location, setLocation] = useState('');
  const [groupCount, setGroupCount] = useState(0);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityIndex, setCommunityIndex] = useState(0);
  const [journey, setJourney] = useState<any[]>([]);
  const [stampCount, setStampCount] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState(1);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const listRef = useRef<FlatList<AdventureSummary>>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const featured = useMemo(() => adventures.filter((item) => item.status !== 'cancelled').slice(0, 5), [adventures]);
  const adventureById = useMemo(() => new Map(adventures.map((item) => [item.id, item])), [adventures]);
  const loop = useMemo<AdventureSummary[]>(() => {
    if (featured.length <= 1) return featured;
    const first = featured[0];
    const last = featured[featured.length - 1];
    if (!first || !last) return featured;
    return [last, ...featured, first];
  }, [featured]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const [nextQueue, groups, nextJourney, stamps, badges, nextAdventures, profileResult] = await Promise.all([
        getAdventureQueue(), getGroups(), getJourney(), getPassportStamps(), getMemberBadges(), listAdventures(),
        userId ? supabase.from('profiles').select('first_name,display_name,home_city,home_state').eq('id', userId).single() : Promise.resolve({ data: null, error: null }),
      ]);
      const myGroupIds = groups.filter((group) => group.is_member).map((group) => group.id);
      const feed = await getCommunityFeed();
      const myFeed = feed
        .filter((post) => !post.group_id || myGroupIds.includes(post.group_id))
        .sort((a, b) => (b.reaction_count + b.comment_count * 2) - (a.reaction_count + a.comment_count * 2))
        .slice(0, 6);

      setQueue(nextQueue);
      setGroupCount(myGroupIds.length);
      setCommunityPosts(myFeed);
      setCommunityIndex((current) => myFeed.length ? current % myFeed.length : 0);
      setJourney(nextJourney);
      setStampCount(stamps.length);
      setBadgeCount(badges.length);
      setAdventures(nextAdventures);
      const profile = profileResult.data as { first_name?: string | null; display_name?: string | null; home_city?: string | null; home_state?: string | null } | null;
      setFirstName(profile?.first_name || profile?.display_name?.split(' ')[0] || 'Adventurer');
      setLocation([profile?.home_city, profile?.home_state].filter(Boolean).join(', '));
      if (profile?.home_city && profile?.home_state) {
        try { setWeather(await getWeather(profile.home_city, profile.home_state)); } catch { setWeather(null); }
      } else setWeather(null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Trailhead.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);
  useEffect(() => {
    if (reduceMotion || paused || loop.length < 2) return;
    const timer = setInterval(() => {
      setActiveFeature((current) => {
        const next = current + 1;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [reduceMotion, paused, loop.length]);
  useEffect(() => {
    if (reduceMotion || communityPosts.length < 2) return;
    const timer = setInterval(() => setCommunityIndex((current) => (current + 1) % communityPosts.length), 7000);
    return () => clearInterval(timer);
  }, [communityPosts.length, reduceMotion]);

  function pauseCarousel() {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 4500);
  }

  function settleCarousel(index: number) {
    if (featured.length < 2) return;
    let next = index;
    if (index === 0) { next = featured.length; listRef.current?.scrollToIndex({ index: next, animated: false }); }
    else if (index === featured.length + 1) { next = 1; listRef.current?.scrollToIndex({ index: next, animated: false }); }
    setActiveFeature(next);
  }

  const statesVisited = new Set(journey.map((item: any) => item.state).filter(Boolean));
  const currentRank = rankFor(journey.length);
  const currentCommunityPost = communityPosts[communityIndex];
  const weatherLook = weatherTheme(weather);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}>
      <View style={styles.topRow}>
        <View style={styles.brandMark}><Text style={styles.brandMountain}>⌁</Text><Text style={styles.brandText}>MA</Text></View>
        <View style={styles.topActions}>
          <Pressable accessibilityLabel="Alerts" onPress={() => router.push('/notifications')} style={styles.iconButton}><Text style={styles.iconGlyph}>!</Text></Pressable>
          <Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.iconButton}><Text style={styles.profileGlyph}>●</Text></Pressable>
        </View>
      </View>
      <Text style={styles.greeting}>{greeting(new Date().getHours())}, {firstName}</Text><Text style={styles.title}>What’s next on your trail?</Text>
      {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}{error ? <Text style={styles.error}>{error}</Text> : null}

      {featured.length ? <View style={styles.section}><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Featured Adventures</Text><Text style={styles.count}>{featured.length > 1 ? `${Math.max(1, Math.min(featured.length, activeFeature))} of ${featured.length}` : '1 of 1'}</Text></View><FlatList ref={listRef} horizontal data={loop} keyExtractor={(item, index) => `${item.id}-${index}`} initialScrollIndex={featured.length > 1 ? 1 : 0} getItemLayout={(_, index) => ({ length: CARD_WIDTH, offset: CARD_WIDTH * index, index })} pagingEnabled showsHorizontalScrollIndicator={false} onTouchStart={pauseCarousel} onScrollBeginDrag={pauseCarousel} onMomentumScrollEnd={(event) => settleCarousel(Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH))} renderItem={({ item }) => <Pressable style={{ width: CARD_WIDTH }} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}><ImageBackground source={item.hero_image_url ? { uri: item.hero_image_url } : undefined} style={styles.hero} imageStyle={styles.heroRadius}><View style={styles.heroShade} /><View style={styles.heroBody}><Text style={styles.eyebrow}>{item.is_featured ? 'FEATURED ADVENTURE' : 'OFFICIAL MA ADVENTURE'}</Text><Text style={styles.heroTitle}>{item.title}</Text><Text style={styles.heroMeta}>{shortDate(item.starts_at)} · {item.city}, {item.state}</Text><Text style={styles.link}>View Adventure →</Text></View></ImageBackground></Pressable>} /></View> : null}

      <Pressable style={[styles.weatherCard, { backgroundColor: weatherLook.background }]} onPress={() => router.push('/member/weather' as never)}>
        <Text style={styles.weatherBackdrop}>{weatherLook.glyph}</Text>
        <View style={styles.weatherContent}><Text style={styles.eyebrow}>WEATHER</Text><Text style={styles.weatherTitle}>{weather ? `${weather.location.name}, ${weather.location.region} · ${Math.round(weather.current.temp_f)}°` : location || 'Set your location'}</Text><Text style={styles.weatherMuted}>{weather ? `${weather.current.condition.text} · Feels ${Math.round(weather.current.feelslike_f)}°` : 'Open Weather & Location'}</Text></View>
      </Pressable>

      <View style={styles.duo}>
        <Pressable style={[styles.halfCard, styles.communityCard]} onPress={() => router.push('/(tabs)/community')}>
          <Text style={styles.cardWatermark}>COMMUNITY</Text><Text style={styles.eyebrow}>COMMUNITY</Text>
          {currentCommunityPost ? <><Text style={styles.quote} numberOfLines={3}>“{currentCommunityPost.body}”</Text><Text style={styles.muted}>{currentCommunityPost.author_name} · {groupCount} group{groupCount === 1 ? '' : 's'}</Text></> : <><Text style={styles.cardTitle}>{groupCount ? `${groupCount} group${groupCount === 1 ? '' : 's'} joined` : 'Find your people'}</Text><Text style={styles.muted}>{groupCount ? 'Fresh group activity will rotate here.' : 'Join a group and its conversation will come alive here.'}</Text></>}
          <Text style={styles.link}>View Groups →</Text>
        </Pressable>
        <Pressable style={[styles.halfCard, styles.passportCard]} onPress={() => router.push('/(tabs)/passport')}>
          <Text style={styles.cardWatermark}>✦</Text><Text style={styles.eyebrow}>PASSPORT</Text><Text style={styles.cardTitle}>{currentRank}</Text>
          {stampCount || badgeCount ? <Text style={styles.muted}>{stampCount} stamp{stampCount === 1 ? '' : 's'} · {badgeCount} badge{badgeCount === 1 ? '' : 's'}</Text> : <Text style={styles.muted}>Your first stamp is waiting on the trail.</Text>}
          <Text style={styles.link}>View Passport →</Text>
        </Pressable>
      </View>

      <Pressable style={styles.journeyCard} onPress={() => router.push('/(tabs)/passport')}>
        <Text style={styles.journeyWatermark}>⌁⌁⌁</Text><Text style={styles.eyebrow}>MY JOURNEY</Text>
        {journey.length ? <View style={styles.journeyStats}><View><Text style={styles.stat}>{journey.length}</Text><Text style={styles.statLabel}>Adventures</Text></View><View><Text style={styles.stat}>{statesVisited.size}</Text><Text style={styles.statLabel}>States</Text></View><View><Text style={styles.stat}>{groupCount}</Text><Text style={styles.statLabel}>Communities</Text></View></View> : <><Text style={styles.journeyPrompt}>Your map starts with your first adventure.</Text><Text style={styles.muted}>Book, explore, and watch your trail take shape.</Text></>}
        <Text style={styles.link}>Open Journey in Passport →</Text>
      </Pressable>

      <View style={styles.section}><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Current Reservations</Text><Pressable onPress={() => router.push('/member/trips')}><Text style={styles.link}>Manage</Text></Pressable></View>{queue.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGap}>{queue.slice(0, 4).map((item) => { const adventure = adventureById.get(item.adventure_id); return <Pressable key={item.order_id} style={styles.reservationShell} onPress={() => router.push('/member/trips')}><ImageBackground source={adventure?.hero_image_url ? { uri: adventure.hero_image_url } : undefined} style={styles.reservationCard} imageStyle={styles.reservationImage}><View style={styles.reservationShade} /><View style={styles.reservationBody}><Text style={styles.eyebrow}>{item.order_status === 'held' || item.order_status === 'payment_pending' ? 'RESERVATION HELD' : 'CONFIRMED'}</Text><Text style={styles.reservationTitle}>{item.title}</Text><Text style={styles.reservationMeta}>{shortDate(item.starts_at)} · {item.city}, {item.state}</Text><Text style={styles.link}>View Reservation →</Text></View></ImageBackground></Pressable>; })}</ScrollView> : <View style={styles.emptyCard}><Text style={styles.cardTitle}>Nothing booked yet</Text><Text style={styles.muted}>Your next confirmed adventure will land here with its event artwork.</Text></View>}</View>

      <View style={styles.section}><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Upcoming Adventures</Text><Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.link}>Explore</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGap}>{adventures.slice(0, 5).map((item) => <Pressable key={item.id} style={styles.upcomingCard} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}><ImageBackground source={item.hero_image_url ? { uri: item.hero_image_url } : undefined} style={styles.thumbnail} imageStyle={styles.thumbnailRadius} /><Text style={styles.upcomingTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.muted}>{shortDate(item.starts_at)} · {item.city}</Text></Pressable>)}</ScrollView></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#0F1713'},content:{paddingHorizontal:18,paddingTop:52,paddingBottom:48,gap:15},topRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brandMark:{width:58,height:46,borderWidth:1,borderColor:'#D7B45A',borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#17211C',overflow:'hidden'},brandMountain:{position:'absolute',top:0,color:'#667A6E',fontSize:30,fontWeight:'900'},brandText:{color:'#F0D083',fontWeight:'900',letterSpacing:1.2,fontSize:17,marginTop:8},topActions:{flexDirection:'row',gap:10},iconButton:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'#405047',backgroundColor:'#17211C',alignItems:'center',justifyContent:'center'},iconGlyph:{color:'#F0D083',fontWeight:'900',fontSize:18},profileGlyph:{color:'#E9E0CA',fontSize:18},greeting:{color:'#D7B45A',fontWeight:'800',marginTop:8},title:{color:'#FFF8E8',fontSize:35,lineHeight:39,fontWeight:'900'},loader:{margin:18},error:{color:'#FFB4A9'},section:{gap:10},sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sectionTitle:{color:'#FFF8E8',fontSize:21,fontWeight:'900'},count:{color:'#7F8C84',fontSize:12},hero:{height:300,justifyContent:'flex-end',backgroundColor:'#26372D',borderRadius:24,overflow:'hidden'},heroRadius:{borderRadius:24},heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(7,12,9,0.48)'},heroBody:{padding:20,gap:6},eyebrow:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},heroTitle:{color:'#FFF8E8',fontSize:28,lineHeight:31,fontWeight:'900'},heroMeta:{color:'#E0E5E1'},link:{color:'#D7B45A',fontWeight:'900',marginTop:8},weatherCard:{minHeight:118,borderRadius:20,borderWidth:1,borderColor:'#526052',padding:16,justifyContent:'center',overflow:'hidden'},weatherBackdrop:{position:'absolute',right:12,top:-20,fontSize:116,color:'rgba(255,248,232,0.15)',fontWeight:'900'},weatherContent:{maxWidth:'82%'},weatherTitle:{color:'#FFF8E8',fontSize:18,fontWeight:'900',marginTop:6},weatherMuted:{color:'#DCE3DE',lineHeight:19,marginTop:3},duo:{flexDirection:'row',gap:10},halfCard:{flex:1,minHeight:205,borderRadius:20,borderWidth:1,padding:15,overflow:'hidden',justifyContent:'space-between'},communityCard:{backgroundColor:'#1D3028',borderColor:'#385548'},passportCard:{backgroundColor:'#342D20',borderColor:'#665A39'},cardWatermark:{position:'absolute',right:-10,bottom:-12,color:'rgba(255,255,255,0.05)',fontSize:52,fontWeight:'900'},quote:{color:'#FFF8E8',fontWeight:'800',fontSize:15,lineHeight:20,marginTop:8},muted:{color:'#A7B1AA',lineHeight:19,marginTop:3},cardTitle:{color:'#FFF8E8',fontSize:18,fontWeight:'900',marginTop:5},journeyCard:{minHeight:166,backgroundColor:'#1B2721',borderRadius:20,borderWidth:1,borderColor:'#3A493F',padding:17,overflow:'hidden'},journeyWatermark:{position:'absolute',right:-5,bottom:10,color:'rgba(215,180,90,0.08)',fontSize:54,fontWeight:'900'},journeyStats:{flexDirection:'row',justifyContent:'space-between',marginTop:13},journeyPrompt:{color:'#FFF8E8',fontSize:21,fontWeight:'900',lineHeight:26,marginTop:15,maxWidth:'80%'},stat:{color:'#FFF8E8',fontSize:26,fontWeight:'900'},statLabel:{color:'#8F9A93',fontSize:11,marginTop:2},horizontalGap:{gap:10},reservationShell:{width:278,height:170,borderRadius:18,overflow:'hidden'},reservationCard:{flex:1,justifyContent:'flex-end',backgroundColor:'#25342C'},reservationImage:{borderRadius:18},reservationShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(7,12,9,0.56)'},reservationBody:{padding:15},reservationTitle:{color:'#FFF8E8',fontSize:18,fontWeight:'900',marginTop:5},reservationMeta:{color:'#DDE5E0',marginTop:4},emptyCard:{backgroundColor:'#17211C',borderRadius:18,borderWidth:1,borderColor:'#29372F',padding:17},upcomingCard:{width:158},thumbnail:{height:105,backgroundColor:'#26372D',borderRadius:16},thumbnailRadius:{borderRadius:16},upcomingTitle:{color:'#FFF8E8',fontWeight:'900',marginTop:8,lineHeight:18},
});
