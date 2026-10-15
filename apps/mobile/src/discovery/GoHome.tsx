import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ImageBackground, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { useAuth } from '../auth/AuthProvider';
import { getCommunityFeed, getGroups, type CommunityPost, type CommunityGroup } from '../community/api';
import { getMemberTrips, type MemberTrip } from '../member/api';
import { supabase } from '../lib/supabase';
import { getJourney, getLatestTrailPreview, getMemberBadges, type JourneyItem, type MemberBadge } from '../passport/api';
import { getMyPassportRank } from '../passport/rankApi';
import { rankFor, type RankName } from '../passport/RankEmblem';
import { getWeather, type WeatherForecast } from '../weather/api';
import { GoTrailheadScene } from '../trailhead/GoTrailheadScene';
import { AppIcon } from '../ui/AppIcon';
import { loadDiscoveryItems, saveDiscoveryAdventure, type DiscoveryItem } from './catalog';
import { useGoMode } from './useGoMode';

const GREEN = '#A8ED8F';
const PURPLE = '#C891F5';
const INK = '#0E1716';
const MUTED = '#65706D';
const DEFAULT_NATURE = require('../../assets/trailhead-banners/explorer-clear-morning.jpg');
const DEFAULT_NIGHT = require('../../assets/trailhead-banners/adventurer-evening.jpg');

/** Keep actual photography visible at the top, with legible copy below. */
function PhotoShade({ id, night = false, gentle = false }: { id: string; night?: boolean; gentle?: boolean }) {
  const color = night ? '#170D2F' : '#071B16';
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} width="100%" height="100%" preserveAspectRatio="none">
    <Defs><LinearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
      <Stop offset="0%" stopColor={color} stopOpacity={0.02}/>
      <Stop offset="38%" stopColor={color} stopOpacity={gentle ? 0.08 : 0.23}/>
      <Stop offset="100%" stopColor={color} stopOpacity={gentle ? 0.75 : 0.94}/>
    </LinearGradient></Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`}/>
  </Svg>;
}
function ContourLines({ light = false }: { light?: boolean }) {
  const stroke = light ? '#E8C57D' : '#78A88A';
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} viewBox="0 0 180 170">
    <Path d="M61 -26 C147 -15 155 9 124 34 C87 63 177 66 161 117 C152 143 111 130 101 191" fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.28"/>
    <Path d="M82 -32 C184 -15 180 14 143 47 C120 76 200 87 179 130 C165 156 136 153 128 193" fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.24"/>
    <Path d="M34 -26 C110 -4 120 3 94 42 C66 88 147 86 132 121 C122 145 77 155 82 198" fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.22"/>
  </Svg>;
}
function relativeDate(value: string) {
  const age = Date.now() - Date.parse(value);
  if (!Number.isFinite(age) || age < 0) return dateLabel(value);
  if (age < 86400000) return 'Today';
  if (age < 172800000) return 'Yesterday';
  if (age < 7 * 86400000) return Math.floor(age / 86400000) + 'd ago';
  return dateLabel(value);
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function eventRoute(item: DiscoveryItem) {
  if (item.source === 'adventure') router.push({ pathname: '/adventures/[id]', params: { id: item.id } });
  else router.push({ pathname: '/local-events/[id]', params: { id: item.id } });
}
function goDiscover(mode: string, query?: string) {
  router.push({ pathname: '/(tabs)/explore', params: { mode, ...(query ? { q: query } : {}) } });
}
export function ExperienceCard({ item, width = 238, onSavedChange }: {
  item: DiscoveryItem;
  width?: number;
  onSavedChange?: (id: string, saved: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const { session } = useAuth();
  const accent = item.mode === 'nature' ? '#39835B' : '#8149BC';
  async function toggle() {
    if (!session) {
      Alert.alert('Sign in to save', 'Sign in to save experiences to your account.');
      return;
    }
    setSaving(true);
    try {
      await saveDiscoveryAdventure(item, !item.saved);
      onSavedChange?.(item.id, !item.saved);
    } catch (err) {
      Alert.alert('Unable to save', err instanceof Error ? err.message : 'Please try again.');
    } finally { setSaving(false); }
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}
    onPress={() => eventRoute(item)} style={[styles.eventCard, { width }]}>
    <ImageBackground source={item.image ? { uri: item.image } : item.mode === 'nature' ? DEFAULT_NATURE : DEFAULT_NIGHT}
      style={styles.eventImage} imageStyle={styles.eventImageRadius}>
      <View style={styles.eventTag}><Text style={[styles.tagText, { color: accent }]}>{item.mode.toUpperCase()}</Text></View>
      {item.source === 'adventure' ? <Pressable disabled={saving} onPress={(e) => { e.stopPropagation(); void toggle(); }}
        accessibilityRole="button" accessibilityLabel={item.saved ? 'Remove saved adventure' : 'Save adventure'}
        style={styles.saveBadge}><AppIcon name={item.saved ? 'bookmark' : 'bookmark'} color={item.saved ? '#D7B45A' : '#FFFFFF'} size={18}/></Pressable> : null}
    </ImageBackground>
    <View style={styles.eventCopy}>
      <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.eventMeta} numberOfLines={1}>{item.city}{item.state ? `, ${item.state}` : ''} · {dateLabel(item.startsAt)}</Text>
      <View style={styles.eventBottom}>
        <Text style={styles.eventCategory} numberOfLines={1}>{item.category}</Text>
        <Text style={styles.eventPrice}>{item.priceLabel}</Text>
      </View>
    </View>
  </Pressable>;
}


type HomeSection = 'circle' | 'trail' | 'picks';
type AdventureMood = 'recharge' | 'people' | 'move' | 'curious';
const HOME_SECTIONS: HomeSection[] = ['circle', 'trail', 'picks'];
const MOODS: { id: AdventureMood; label: string; icon: string; search: string }[] = [
  { id: 'recharge', label: 'Unwind', icon: '🌿', search: 'park' },
  { id: 'people', label: 'Meet people', icon: '🤝', search: 'social' },
  { id: 'move', label: 'Get moving', icon: '🥾', search: 'hiking' },
  { id: 'curious', label: 'Try something new', icon: '✨', search: '' },
];
const MOOD_TERMS: Record<AdventureMood, RegExp> = {
  recharge: /park|spring|garden|beach|wellness|relax|picnic|nature|scenic|water/i,
  people: /group|social|meet|community|music|festival|gather|camp|brunch/i,
  move: /hike|trail|bike|run|paddl|kayak|climb|dance|walk|cycle/i,
  curious: /class|learn|workshop|first|intro|beginner|new|tour|art|museum/i,
};
function greetingFor(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
function preferredName(profileName: string, username: string, metadataName: string, email: string) {
  const local = (email.split('@')[0] ?? '').toLowerCase();
  const candidates = [profileName, metadataName, username];
  const name = candidates.find(value => value.trim() && !value.includes('@') && value.toLowerCase() !== local);
  return name ? (name.trim().split(/\s+/)[0] ?? '') : '';
}
function daysUntil(value: string) {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}
function activeBooking(trip: MemberTrip, now: number) {
  if (!trip.adventures || trip.adventures.status === 'cancelled') return false;
  const start = Date.parse(trip.adventures.starts_at);
  if (!Number.isFinite(start) || start < now) return false;
  if (trip.status === 'paid') return true;
  if (trip.status !== 'held' && trip.status !== 'payment_pending') return false;
  const expiry = trip.hold_expires_at ? Date.parse(trip.hold_expires_at) : NaN;
  // A held booking only counts while its hold is known to be valid.
  // An unexpired payment_pending record may not have a hold deadline.
  if (trip.status === 'held') return Number.isFinite(expiry) && expiry > now;
  return !trip.hold_expires_at || (Number.isFinite(expiry) && expiry > now);
}
function upcomingTrip(trips: MemberTrip[], now: number) {
  return trips.filter(trip => activeBooking(trip, now))
    .sort((a, b) => Date.parse(a.adventures!.starts_at) - Date.parse(b.adventures!.starts_at))[0] ?? null;
}
function sectionKey(userId: string, mode: string) {
  return 'go-home-sections:v1:' + userId + ':' + mode;
}
function validSections(value: unknown): HomeSection[] {
  if (!Array.isArray(value)) return HOME_SECTIONS;
  const filtered = value.filter((entry): entry is HomeSection => HOME_SECTIONS.includes(entry as HomeSection));
  return [...new Set(filtered)];
}

export default function GoHome() {
  const { session } = useAuth();
  const { mode, chooseMode } = useGoMode(session?.user.id);
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [trips, setTrips] = useState<MemberTrip[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [memberBadges, setMemberBadges] = useState<MemberBadge[]>([]);
  const [passportRank, setPassportRank] = useState<RankName | null>(null);
  const [localWeather, setLocalWeather] = useState<WeatherForecast | null>(null);
  const [trailPreview, setTrailPreview] = useState<{ uri: string; adventureId: string } | null>(null);
  const [profile, setProfile] = useState({ name: '', username: '', city: '', state: '', coverUrl: null as string | null, interests: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<AdventureMood | null>(null);
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<HomeSection[]>(HOME_SECTIONS);
  const [now, setNow] = useState(() => Date.now());
  const accent = mode === 'nature' ? GREEN : PURPLE;
  const primary = mode === 'nature' ? '#12392C' : '#271A41';
  const cardWidth = Math.min(width * 0.66, 270);

  useEffect(() => {
    let active = true;
    setEditing(false);
    setMood(null);
    setSections(HOME_SECTIONS);
    if (!session?.user.id) return () => { active = false; };
    void Storage.getItem(sectionKey(session.user.id, mode)).then(value => {
      if (active && value) {
        try { setSections(validSections(JSON.parse(value))); } catch { setSections(HOME_SECTIONS); }
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [session?.user.id, mode]);

  function setHomeSections(next: HomeSection[]) {
    setSections(next);
    if (session?.user.id) void Storage.setItem(sectionKey(session.user.id, mode), JSON.stringify(next)).catch(() => {});
  }
  function toggleSection(value: HomeSection) {
    setHomeSections(sections.includes(value) ? sections.filter(s => s !== value) : [...sections, value]);
  }
  function moveSection(value: HomeSection, direction: number) {
    const index = sections.indexOf(value);
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const current = next[index];
    const neighbor = next[target];
    if (!current || !neighbor) return;
    next[index] = neighbor;
    next[target] = current;
    setHomeSections(next);
  }
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setNow(Date.now());
    const userId = session?.user.id;
    const [results, history, bookings, details, activity, memberships, memoryImage, badgesResult, rankResult] = await Promise.allSettled([
      loadDiscoveryItems(),
      userId ? getJourney() : Promise.resolve([] as JourneyItem[]),
      userId ? getMemberTrips() : Promise.resolve([] as MemberTrip[]),
      userId ? supabase.from('profiles').select('display_name,username,home_city,home_state,cover_url,interests').eq('id', userId).maybeSingle() : Promise.resolve({ data: null }),
      userId ? getCommunityFeed() : Promise.resolve([] as CommunityPost[]),
      userId ? getGroups() : Promise.resolve([] as CommunityGroup[]),
      userId ? getLatestTrailPreview() : Promise.resolve(null),
      userId ? getMemberBadges() : Promise.resolve([] as MemberBadge[]),
      userId ? getMyPassportRank() : Promise.resolve(null),
    ]);
    if (results.status === 'fulfilled') {
      setItems(results.value);
      setError(null);
    } else setError('Experiences could not load. Pull down to try again.');
    if (history.status === 'fulfilled') setJourney(history.value);
    if (badgesResult.status === 'fulfilled') setMemberBadges(badgesResult.value);
    if (rankResult.status === 'fulfilled' && rankResult.value) setPassportRank(rankResult.value.effective_rank);
    else setPassportRank(null);
    if (memberships.status === 'fulfilled') setGroups(memberships.value.filter(group => group.is_member));
    if (activity.status === 'fulfilled' && memberships.status === 'fulfilled') {
      const myGroups = new Set(memberships.value.filter(group => group.is_member).map(group => group.id));
      setPosts(activity.value.filter(post => myGroups.has(post.group_id || '') || (post.audience === 'everyone' && !post.group_id)).slice(0, 3));
    }
    if (bookings.status === 'fulfilled') setTrips(bookings.value);
    if (memoryImage.status === 'fulfilled') setTrailPreview(memoryImage.value);
    if (details.status === 'fulfilled' && details.value.data) {
      const data = details.value.data;
      const city = String(data.home_city ?? '').trim();
      const state = String(data.home_state ?? '').trim();
      setProfile({
        name: String(data.display_name ?? ''), username: String(data.username ?? ''),
        city, state, coverUrl: typeof data.cover_url === 'string' ? data.cover_url : null,
        interests: Array.isArray(data.interests) ? data.interests.filter((item): item is string => typeof item === 'string') : [],
      });
      if (city && state) {
        try { setLocalWeather(await getWeather(city, state)); }
        catch { setLocalWeather(null); }
      } else setLocalWeather(null);
    } else {
      setLocalWeather(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const memberName = preferredName(
    profile.name, profile.username,
    String(session?.user.user_metadata?.first_name || session?.user.user_metadata?.display_name || ''),
    session?.user.email || '',
  );
  const effectiveRank = passportRank ?? rankFor(journey.length);
  const myItems = useMemo(() => items.filter(item => item.mode === mode), [items, mode]);
  const futureTrips = useMemo(() => upcomingTrip(trips, now), [trips, now]);
  const liveTrip = trips.find(trip => trip.status === 'paid' && trip.adventures?.status !== 'cancelled'
    && trip.adventures && Date.parse(trip.adventures.starts_at) <= now
    && Date.parse(trip.adventures.ends_at) >= now) ?? null;
  const primaryTrip = liveTrip ?? futureTrips;
  const actionTrip = primaryTrip?.adventures ?? null;
  const isLive = Boolean(liveTrip);
  const isPending = primaryTrip?.status === 'held' || primaryTrip?.status === 'payment_pending';
  const circlePhoto = groups.find(group => group.cover_image_url)?.cover_image_url
    ?? posts.find(post => post.image_url)?.image_url ?? null;
  const groupById = new Map(groups.map(group => [group.id, group.name]));
  const latestTrail = trailPreview && journey.some(item => item.adventure_id === trailPreview.adventureId) ? trailPreview : null;
  const nextMilestone = [1, 5, 10, 25, 50].find(value => value > journey.length) ?? null;
  const recentJourney = journey[0] ?? null;
  const recentAt = recentJourney ? Date.parse(recentJourney.experienced_at) : NaN;
  const needsReflection = Number.isFinite(recentAt) && now - recentAt < 14 * 86400000
    && now - recentAt >= 0 && recentJourney?.photo_count === 0;
  const savedCategories = useMemo(() => new Set(items.filter(item => item.saved).map(item => item.category.toLowerCase())), [items]);
  const suggestions = useMemo(() => {
    const related = myItems.filter(item => {
      if (!mood) return true;
      return MOOD_TERMS[mood].test(item.title + ' ' + item.category + ' ' + item.description + ' ' + item.tags.join(' '));
    });
    return [...related].sort((a, b) =>
      Number(savedCategories.has(b.category.toLowerCase())) - Number(savedCategories.has(a.category.toLowerCase()))
      || Number(b.featured) - Number(a.featured)
      || Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 4);
  }, [myItems, mood, savedCategories]);

  const updateSaved = (id: string, saved: boolean) =>
    setItems(current => current.map(item => item.id === id && item.source === 'adventure' ? { ...item, saved } : item));

  function switchMode(next: 'nature' | 'night') {
    if (mode === next) return;
    chooseMode(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }
  function sectionContent(section: HomeSection) {
    if (section === 'circle') return <View key="circle" style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLabelStack}>
          <Text style={styles.overlineGold}>COMMUNITY PULSE</Text>
          <Text style={styles.sectionTitle}>From your circle</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="See all community activity" onPress={() => router.push('/communities')}>
          <Text style={styles.seeAll}>See all →</Text>
        </Pressable>
      </View>
      {posts.length ? posts.map(post => <Pressable key={post.id} accessibilityRole="button" style={styles.pulseCard}
        accessibilityLabel={`Community update from ${post.author_name || 'a member'}`}
        onPress={() => post.group_id ? router.push({ pathname: '/groups/[id]', params: { id: post.group_id } }) : router.push('/communities')}>
        {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.pulsePhoto}
          resizeMode="cover" accessibilityLabel="Community photo"/> : null}
        <View style={styles.pulseText}>
          <View style={styles.pulseByline}>
            {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.pulseAvatar}/> :
              <View style={styles.pulseInitial}><Text style={styles.pulseInitialText}>{(post.author_name || 'M').slice(0, 1).toUpperCase()}</Text></View>}
            <View style={styles.flex}>
              <Text style={styles.pulseAuthor} numberOfLines={1}>{post.author_name || 'Community member'}</Text>
              <Text style={styles.pulseMeta} numberOfLines={1}>
                {(post.group_id ? groupById.get(post.group_id) : null) || 'GO Melanated'} · {relativeDate(post.created_at)}
              </Text>
            </View>
          </View>
          <Text style={styles.pulseBody} numberOfLines={post.image_url ? 3 : 2}>
            {post.body || (post.post_type === 'photo' ? 'Shared a moment with the community.' : 'Shared an update.')}
          </Text>
          {post.image_url && <Text style={styles.pulseExplore}>View story →</Text>}
        </View>
        {!post.image_url && <AppIcon name="chevron-forward" color={MUTED} size={17}/>}
      </Pressable>) : <Pressable accessibilityRole="button" style={styles.pulseEmpty} onPress={() => router.push('/communities')}>
        <View style={styles.pulseIcon}><AppIcon name="photos" color={primary} size={24}/></View>
        <View style={styles.flex}><Text style={styles.pulseAuthor}>Your people, your stories</Text>
          <Text style={styles.pulseBody}>Explore shared moments from the communities you&apos;ve joined.</Text></View>
        <AppIcon name="chevron-forward" color={MUTED} size={18}/>
      </Pressable>}
    </View>;
    if (section === 'trail') {
      const story = journey.find(item => item.adventure_id === latestTrail?.adventureId) ?? recentJourney;
      const nextLabel = nextMilestone ? `${nextMilestone - journey.length} more to your next chapter` : 'Your story keeps growing';
      return <View key="trail" style={styles.sectionBlock}>
        <View style={styles.sectionLabelStack}>
          <Text style={styles.overlineGold}>YOUR OUTDOOR LIFE, REMEMBERED</Text>
          <Text style={styles.sectionTitle}>{mode === 'nature' ? 'A story worth keeping' : 'The moments you made'}</Text>
        </View>
        <Pressable style={styles.journeySpotlight} accessibilityRole="button" accessibilityLabel="Open Your Trail"
          onPress={() => router.push('/member/journey')}>
          {latestTrail ? <Image source={{ uri: latestTrail.uri }} resizeMode="cover" style={styles.storyPhoto}/> : <ContourLines light/>}
          {latestTrail && <PhotoShade id="goHomeStory" night gentle/>}
          <View style={styles.storyContent}>
            <View style={styles.storyRibbon}><AppIcon name="stamp" color="#F5D38A" size={20}/>
              <Text style={styles.storyEyebrow}>{journey.length ? journey.length + ' ADVENTURES IN YOUR STORY' : 'YOUR FIRST CHAPTER AWAITS'}</Text>
            </View>
            <View>
              <Text style={styles.storyTitle} numberOfLines={2}>{story?.title || 'There is a story waiting for you.'}</Text>
              <Text style={styles.storyPlace}>{story ? [story.city, story.state].filter(Boolean).join(', ') + ' · ' + dateLabel(story.experienced_at) : 'Find an experience and start Your Trail.'}</Text>
              <View style={styles.storyFooter}>
                <Text style={styles.storyProgress}>{journey.length ? nextLabel : 'Make the first memory'}</Text>
                <Text style={styles.storyLink}>Your Trail →</Text>
              </View>
            </View>
          </View>
        </Pressable>
        {needsReflection && recentJourney && <Pressable accessibilityRole="button" style={styles.reflection} onPress={() => router.push({ pathname: '/passport/memories/[adventureId]', params: { adventureId: recentJourney.adventure_id } })}>
          <AppIcon name="camera" color="#634C2C" size={24}/>
          <View style={styles.flex}><Text style={styles.reflectionTitle}>Keep this moment</Text>
            <Text style={styles.reflectionCopy} numberOfLines={2}>Add memories from {recentJourney.title}.</Text></View>
          <AppIcon name="chevron-forward" color="#634C2C" size={17}/>
        </Pressable>}
      </View>;
    }
    return <View key="picks" style={styles.sectionBlock}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>A little inspiration</Text>
        <Pressable accessibilityRole="button" onPress={() => goDiscover(mode)}><Text style={styles.seeAll}>Discover →</Text></Pressable>
      </View>
      <Text style={styles.sectionIntro}>{savedCategories.size
        ? 'Upcoming experiences, with your saved interests first.'
        : 'A few upcoming possibilities to make your own.'}</Text>
      <View style={styles.moodPanel}>
        <View style={styles.moodHead}><AppIcon name="sparkles" color={primary} size={20}/>
          <Text style={styles.moodTitle}>What sounds good today?</Text></View>
        <View style={styles.moodRow}>{MOODS.map(option =>
          <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: mood === option.id }}
            onPress={() => setMood(current => current === option.id ? null : option.id)}
            style={[styles.moodChip, mood === option.id && { borderColor: primary, backgroundColor: mode === 'nature' ? '#D8EEDB' : '#EDE0F6' }]}>
            <Text style={styles.moodChipText}>{option.icon + ' ' + option.label}</Text>
          </Pressable>)}</View>
      </View>
      {!!suggestions.length && <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {suggestions.map(item => <ExperienceCard key={item.source + ':' + item.id} item={item} width={cardWidth} onSavedChange={updateSaved}/>)}
      </ScrollView>}
      {!suggestions.length && <Pressable style={styles.empty} onPress={() => goDiscover(mode, mood ? MOODS.find(value => value.id === mood)?.search : undefined)}>
        <Text style={styles.emptyTitle}>Nothing matching that mood is listed yet.</Text>
        <Text style={styles.muted}>Browse more experiences in Discover →</Text>
      </Pressable>}
      <Pressable style={styles.editorial} accessibilityRole="button" onPress={() => router.push(mode === 'nature' ? '/trail-guide' : '/communities')}>
        <ImageBackground source={mode === 'nature' ? DEFAULT_NATURE : DEFAULT_NIGHT} imageStyle={styles.editorialImage} style={styles.editorialBackground}>
          <View style={styles.editorialShade}>
            <Text style={[styles.lightEyebrow, { color: accent }]}>{mode === 'nature' ? 'BEYOND THE USUAL TRAIL' : 'YOUR CITY HAS STORIES'}</Text>
            <Text style={styles.editorialTitle}>{mode === 'nature' ? 'Find the places worth the trip.' : 'See your city in a new light.'}</Text>
            <Text style={styles.editorialAction}>{mode === 'nature' ? 'Open the Trail Guide' : 'Explore communities'}  →</Text>
          </View>
        </ImageBackground>
      </Pressable>
    </View>;
  }

  const hasBooking = Boolean(actionTrip);
  const days = actionTrip ? daysUntil(actionTrip.starts_at) : 0;
  const heroHeading = actionTrip?.title || (mode === 'nature' ? 'Your next chapter starts outside.' : 'The city is yours to explore.');
  const heroDescription = actionTrip
    ? (isLive ? 'Happening now · ' : dateLabel(actionTrip.starts_at) + ' · ') + actionTrip.city + ', ' + actionTrip.state
    : mode === 'nature' ? 'New places. Familiar faces. Experiences you will remember.' : 'Music, culture, food, and good company. Find your next story.';
  return <ScrollView ref={scrollRef} style={[styles.screen, mode === 'night' && styles.nightScreen]}
    contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={primary}/>}>
    <View style={styles.brandBar}>
      <Text style={styles.eyebrow}>GO MELANATED · YOUR TRAILHEAD</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push('/member/profile')} style={styles.profileButton}>
        <AppIcon name="profile" color={INK} size={21}/>
      </Pressable>
    </View>
    <View style={styles.switcher}>{(['nature', 'night'] as const).map(value =>
      <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }}
        onPress={() => switchMode(value)}
        style={[styles.modeButton, mode === value && { backgroundColor: value === 'nature' ? '#D6F0CC' : '#EAD8F7' }]}>
        <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value === 'nature' ? '🌿  Nature' : '🌙  Night'}</Text>
      </Pressable>)}</View>
    <GoTrailheadScene displayName={memberName} greeting={greetingFor(new Date(now).getHours())}
      rank={effectiveRank} badges={memberBadges} weather={localWeather}
      homeCity={profile.city} homeState={profile.state} coverUrl={profile.coverUrl} mode={mode}/>
    <Pressable accessibilityRole="button" style={styles.nextAdventure}
      onPress={() => hasBooking ? router.push({ pathname: '/adventures/[id]', params: { id: actionTrip!.id } }) : goDiscover(mode)}>
      <View style={styles.nextIcon}><AppIcon name={isLive ? 'map' : hasBooking ? 'calendar' : 'explore'} color={primary} size={21}/></View>
      <View style={styles.flex}>
        <Text style={styles.nextEyebrow}>{isLive ? 'HAPPENING NOW' : hasBooking ? isPending ? 'YOUR RESERVATION' : 'NEXT UP' : 'YOUR NEXT ADVENTURE'}</Text>
        <Text style={styles.nextTitle} numberOfLines={1}>{hasBooking ? heroHeading : 'Find somewhere new to go'}</Text>
        <Text style={styles.nextMeta} numberOfLines={1}>{hasBooking ? heroDescription : 'Discover nature, culture, and new experiences.'}</Text>
      </View>
      <AppIcon name="chevron-forward" size={21} color={primary}/>
    </Pressable>
    {loading && <ActivityIndicator color={primary} style={styles.loading}/>}
    {error && <Text style={styles.error}>{error}</Text>}
    <View style={styles.personalizeRow}><Text style={styles.homeLabel}>YOUR WORLD</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Done editing home' : 'Customize home'}
        onPress={() => setEditing(current => !current)} style={styles.editButton}>
        <AppIcon name={editing ? 'check' : 'settings'} color={primary} size={15}/>
        <Text style={styles.editText}>{editing ? 'Done' : 'Customize'}</Text>
      </Pressable>
    </View>
    <View style={styles.quickTiles}>
      <Pressable accessibilityRole="button" accessibilityLabel="Your Circle. Open your communities"
        style={[styles.quickTile, styles.quickCircle]} onPress={() => router.push('/communities')}>
        {circlePhoto ? <Image source={{ uri: circlePhoto }} resizeMode="cover" style={styles.quickTilePhoto}/> : <ContourLines light/>}
        {circlePhoto && <PhotoShade id="goHomeCircle" gentle/>}
        <View style={styles.quickTileInner}>
          <View style={styles.quickTop}>
            <AppIcon name="community" color="#BEF4A4" size={23}/>
            <Text style={styles.quickOverline}>YOUR PEOPLE</Text>
          </View>
          <View>
            <Text style={styles.quickTileTitle}>Your Circle</Text>
            <Text style={styles.quickTileCopy}>{groups.length ? groups.length + (groups.length === 1 ? ' community joined' : ' communities joined') : 'Find your community'}</Text>
          </View>
          <View style={styles.quickBottom}>
            <View style={styles.faceRow}>
              {posts.filter((post, index, all) => all.findIndex(p => p.author_id === post.author_id) === index).slice(0, 3).map(post =>
                <View key={post.author_id} style={styles.face}>
                  {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.facePhoto}/> :
                    <Text style={styles.faceInitial}>{(post.author_name || 'M').slice(0, 1).toUpperCase()}</Text>}
                </View>)}
            </View>
            <Text style={styles.quickTileLink}>Connect →</Text>
          </View>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Your Trail. Open your adventure memories"
        style={[styles.quickTile, styles.quickTrail]} onPress={() => router.push('/member/journey')}>
        {latestTrail ? <Image source={{ uri: latestTrail.uri }} resizeMode="cover" style={styles.quickTilePhoto}/> : <ContourLines/>}
        {latestTrail && <PhotoShade id="goHomeTrail" gentle/>}
        <View style={styles.quickTileInner}>
          <View style={styles.quickTop}>
            <AppIcon name="stamp" color={latestTrail ? '#F3DFAD' : '#4E6F50'} size={23}/>
            <Text style={[styles.quickOverline, !latestTrail && styles.quickTrailOverline]}>YOUR STORY</Text>
          </View>
          <View>
            <Text style={[styles.quickTileTitle, !latestTrail && styles.quickTrailTitle]}>Your Trail</Text>
            <Text style={[styles.quickTileCopy, !latestTrail && styles.quickTrailCopy]}>
              {session && journey.length ? journey.length + (journey.length === 1 ? ' adventure remembered' : ' adventures remembered') : 'Your first chapter awaits'}
            </Text>
          </View>
          <View style={styles.quickBottom}>
            <Text style={[styles.quickMilestone, !latestTrail && styles.quickTrailMilestone]}>
              {nextMilestone && journey.length ? nextMilestone - journey.length + ' to your next milestone' : 'Your outdoor life, remembered'}
            </Text>
            <AppIcon name="chevron-forward" color={latestTrail ? '#FFF4E0' : '#405C45'} size={16}/>
          </View>
        </View>
      </Pressable>
    </View>
    {editing && <View style={styles.editor}>
      <Text style={styles.editorTitle}>Make this space yours</Text>
      <Text style={styles.editorHint}>Show, hide, or move sections. Your choice is saved on this device for this mode.</Text>
      {HOME_SECTIONS.map(value => <View key={value} style={styles.editorRow}>
        <Pressable accessibilityRole="button" accessibilityState={{ checked: sections.includes(value) }}
          style={styles.editorCheck} onPress={() => toggleSection(value)}>
          <AppIcon name={sections.includes(value) ? 'check' : 'add'} color={primary} size={21}/>
          <Text style={styles.editorName}>{value === 'circle' ? 'Your circle' : value === 'trail' ? 'Your story' : 'Inspiration'}</Text>
        </Pressable>
        {sections.includes(value) && <View style={styles.editorArrows}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Move ' + value + ' up'} disabled={sections.indexOf(value) === 0} onPress={() => moveSection(value, -1)} style={styles.arrowTap}><AppIcon name="arrow-up" color={sections.indexOf(value) === 0 ? '#9BA6A0' : primary} size={20}/></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={'Move ' + value + ' down'} disabled={sections.indexOf(value) === sections.length - 1} onPress={() => moveSection(value, 1)} style={styles.arrowTap}><AppIcon name="chevron-forward" color={sections.indexOf(value) === sections.length - 1 ? '#9BA6A0' : primary} size={20}/></Pressable>
        </View>}
      </View>)}
      <Pressable accessibilityRole="button" onPress={() => setHomeSections(HOME_SECTIONS)}>
        <Text style={styles.reset}>Reset home layout</Text>
      </Pressable>
    </View>}
    {sections.map(sectionContent)}
    <Pressable style={styles.crossCard} accessibilityRole="button" onPress={() => switchMode(mode === 'nature' ? 'night' : 'nature')}>
      <View style={styles.flex}>
        <Text style={styles.crossKicker}>THERE&apos;S MORE TO YOUR WORLD</Text>
        <Text style={styles.crossTitle}>{mode === 'nature' ? 'A little city adventure?' : 'Take the scenic route.'}</Text>
        <Text style={styles.muted}>{mode === 'nature' ? 'Discover the culture and experiences happening after dark.' : 'See what is waiting beyond the pavement.'}</Text>
        <Text style={styles.crossAction}>Switch to {mode === 'nature' ? 'Night' : 'Nature'}  →</Text>
      </View>
    </Pressable>
    <View style={styles.bottomSpace}/>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F4' },
  nightScreen: { backgroundColor: '#F6F3F9' },
  content: { paddingHorizontal: 16, paddingTop: 11, paddingBottom: 32, width: '100%', maxWidth: 970, alignSelf: 'center' },
  flex: { flex: 1 },
  brandBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, minHeight: 40 },
  nextAdventure: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2', borderRadius: 17, marginTop: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  nextIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E6F1E2', alignItems: 'center', justifyContent: 'center' },
  nextEyebrow: { fontSize: 9, color: '#68836E', letterSpacing: 1, fontWeight: '900' },
  nextTitle: { fontSize: 14, fontWeight: '900', color: INK, marginTop: 2 },
  nextMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  eyebrow: { fontWeight: '900', fontSize: 10, color: '#427B59', letterSpacing: 1.4 },
  greeting: { color: INK, fontWeight: '900', fontSize: 22, marginTop: 3, letterSpacing: -0.5 },
  greetingSub: { color: MUTED, fontSize: 11, marginTop: 4 },
  profileButton: { backgroundColor: '#E9EDE8', borderRadius: 24, padding: 11 },
  switcher: { flexDirection: 'row', padding: 3, gap: 4, borderRadius: 17, backgroundColor: '#E6E7E4', marginBottom: 11 },
  modeButton: { flex: 1, paddingVertical: 7, borderRadius: 14, alignItems: 'center', minHeight: 41, justifyContent: 'center' },
  modeText: { color: '#6B7371', fontSize: 14, fontWeight: '700' }, modeTextActive: { color: INK, fontWeight: '900' },
  hero: { borderRadius: 21, overflow: 'hidden', marginBottom: 0 },
  heroImage: { minHeight: 199, justifyContent: 'flex-end' }, heroCorners: { borderRadius: 21 },
  heroShade: { paddingHorizontal: 18, paddingVertical: 16, paddingTop: 27, minHeight: 199, justifyContent: 'flex-end' },
  heroLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginBottom: 4 },
  heroTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 23, lineHeight: 27, maxWidth: 530 },
  heroBody: { color: '#F4F5EC', fontSize: 12, lineHeight: 17, marginTop: 5, maxWidth: 480 },
  heroStatus: { marginTop: 5, fontSize: 12, fontWeight: '900' },
  heroButton: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, minHeight: 42, justifyContent: 'center' },
  heroButtonText: { color: INK, fontSize: 12, fontWeight: '900' },
  actionStrip: { backgroundColor: '#F8EED7', borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15, marginTop: 11 },
  actionTitle: { color: INK, fontSize: 13, fontWeight: '900' }, actionCopy: { color: '#5F6357', fontSize: 11, marginTop: 3, lineHeight: 17 },
  loading: { marginVertical: 12 }, error: { color: '#A33C3C', fontSize: 12, fontWeight: '800', paddingVertical: 10 },
  personalizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  homeLabel: { color: '#74817A', fontWeight: '900', fontSize: 10, letterSpacing: 1.4 },
  editButton: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 9 },
  editText: { color: '#315A46', fontSize: 12, fontWeight: '800' },
  quickTiles: { flexDirection: 'row', gap: 10, marginTop: 3, alignItems: 'stretch' },
  quickTile: { flex: 1, minWidth: 0, minHeight: 164, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  quickCircle: { backgroundColor: '#163F2B' },
  quickTrail: { backgroundColor: '#EEE8D6' },
  quickTilePhoto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  quickTileInner: { flex: 1, justifyContent: 'space-between', padding: 14, zIndex: 1, minHeight: 164 },
  quickTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickOverline: { color: '#C9E4CB', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  quickTileTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 18, marginTop: 3 },
  quickTileCopy: { color: '#E4EFE6', fontSize: 11, lineHeight: 16, marginTop: 4 },
  quickTileLink: { fontSize: 11, color: '#B8F29F', fontWeight: '900' },
  quickBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 25, gap: 4 },
  faceRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 3 },
  face: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#D7AC64', borderWidth: 2, borderColor: '#164333', marginLeft: -3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  facePhoto: { width: '100%', height: '100%' },
  faceInitial: { fontSize: 10, fontWeight: '900', color: '#173F2D' },
  quickTrailOverline: { color: '#5B725B' },
  quickTrailTitle: { color: '#243C2D' },
  quickTrailCopy: { color: '#4F6655' },
  quickMilestone: { fontSize: 9, fontWeight: '800', color: '#FFF0CD', flex: 1 },
  quickTrailMilestone: { color: '#4B684D' },
  editor: { backgroundColor: '#FFF', borderColor: '#DBE2DB', borderWidth: 1, padding: 16, borderRadius: 18, marginTop: 7, gap: 9 },
  editorTitle: { fontSize: 16, fontWeight: '900', color: INK },
  editorHint: { color: MUTED, fontSize: 12, lineHeight: 18 },
  editorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E7EDE7', paddingTop: 10 },
  editorCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minHeight: 43 },
  editorName: { color: INK, fontWeight: '800', fontSize: 13 },
  editorArrows: { flexDirection: 'row', gap: 6 },
  arrowTap: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  reset: { color: '#2D6C49', fontSize: 12, fontWeight: '800', marginTop: 4, padding: 6 },
  sectionBlock: { marginTop: 19, gap: 11 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 7 },
  sectionTitle: { color: INK, fontSize: 21, fontWeight: '900', letterSpacing: -0.3, flexShrink: 1 },
  seeAll: { color: '#286B91', fontSize: 12, fontWeight: '800' },
  circleCard: { borderRadius: 22, padding: 20, minHeight: 156, justifyContent: 'space-between' },
  circleHeading: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  circleIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  lightEyebrow: { color: '#A9C7B6', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  circleTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 4 },
  circleBody: { color: '#DDE7DF', fontSize: 12, lineHeight: 19, marginTop: 14 },
  overlineGold: { color: '#8B7448', fontSize: 9, letterSpacing: 1.4, fontWeight: '900', marginBottom: 4 },
  sectionLabelStack: { gap: 1, flex: 1 },
  pulseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 17, overflow: 'hidden', minHeight: 83, borderWidth: 1, borderColor: '#E8E9E3', gap: 0 },
  pulseEmpty: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 13, borderRadius: 16, gap: 10, minHeight: 86 },
  pulsePhoto: { width: 118, alignSelf: 'stretch', minHeight: 112 },
  pulseText: { flex: 1, padding: 12, gap: 8 },
  pulseByline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseAvatar: { height: 29, width: 29, borderRadius: 15 },
  pulseInitial: { height: 29, width: 29, borderRadius: 15, backgroundColor: '#E8EFE7', alignItems: 'center', justifyContent: 'center' },
  pulseInitialText: { color: '#255B42', fontWeight: '900', fontSize: 13 },
  pulseIcon: { borderRadius: 13, padding: 10, backgroundColor: '#E6F1E9' },
  pulseAuthor: { color: INK, fontWeight: '900', fontSize: 13 },
  pulseMeta: { color: '#7C867F', fontSize: 10, marginTop: 2 },
  pulseBody: { color: '#3D4943', lineHeight: 18, fontSize: 13 },
  pulseExplore: { color: '#2C6C50', fontSize: 11, fontWeight: '900' },
  journeySpotlight: { backgroundColor: '#213F34', borderRadius: 20, minHeight: 209, overflow: 'hidden' },
  storyPhoto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  storyContent: { flex: 1, minHeight: 209, padding: 19, justifyContent: 'space-between' },
  storyRibbon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storyEyebrow: { color: '#F3D998', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  storyTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 26 },
  storyPlace: { color: '#E8ECE6', fontSize: 12, marginTop: 5 },
  storyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 17, gap: 12 },
  storyProgress: { color: '#F5E1A8', fontSize: 11, fontWeight: '800', flexShrink: 1 },
  storyLink: { color: '#BBF0A4', fontSize: 11, fontWeight: '900' },
  reflection: { backgroundColor: '#F6EBCD', borderRadius: 17, padding: 14, gap: 12, alignItems: 'center', flexDirection: 'row' },
  reflectionTitle: { color: '#463A22', fontWeight: '900', fontSize: 14 },
  reflectionCopy: { color: '#685D49', fontSize: 12, marginTop: 4 },
  sectionIntro: { color: MUTED, fontSize: 12, lineHeight: 18, marginTop: -3 },
  moodPanel: { backgroundColor: '#FFF', borderRadius: 19, padding: 15, gap: 12, borderWidth: 1, borderColor: '#E3EAE1' },
  moodHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  moodTitle: { color: INK, fontWeight: '900', fontSize: 14 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: { borderWidth: 1, borderColor: '#DDE5DF', backgroundColor: '#FAFBF9', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 10, minHeight: 40 },
  moodChipText: { color: INK, fontSize: 12, fontWeight: '800' },
  cards: { gap: 12, paddingBottom: 6 },
  empty: { backgroundColor: '#FFF', borderRadius: 16, padding: 19 },
  emptyTitle: { color: INK, fontSize: 14, fontWeight: '900' },
  muted: { color: MUTED, fontSize: 12, lineHeight: 18, marginTop: 5 },
  editorial: { overflow: 'hidden', borderRadius: 21, marginTop: 4 },
  editorialBackground: { minHeight: 155, justifyContent: 'flex-end' },
  editorialImage: { borderRadius: 21 },
  editorialShade: { backgroundColor: 'rgba(14,27,24,0.68)', padding: 18, paddingTop: 28 },
  editorialTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', maxWidth: 330, marginTop: 6 },
  editorialAction: { color: '#FFF', fontSize: 12, fontWeight: '900', marginTop: 11 },
  crossCard: { backgroundColor: '#FFF', borderRadius: 21, padding: 21, marginTop: 24, borderWidth: 1, borderColor: '#E0E6DF' },
  crossKicker: { color: '#547A63', letterSpacing: 1.5, fontWeight: '900', fontSize: 10 },
  crossTitle: { color: INK, fontSize: 18, fontWeight: '900', marginTop: 7 },
  crossAction: { color: '#37654C', fontWeight: '900', fontSize: 12, marginTop: 13 },
  bottomSpace: { height: 12 },
  eventCard: { backgroundColor: '#FFFFFF', borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#E4E7E4' },
  eventImage: { height: 130, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 9 },
  eventImageRadius: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  eventTag: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, backgroundColor: '#FFFFFFE9' },
  tagText: { fontSize: 9, fontWeight: '900' },
  saveBadge: { backgroundColor: '#15221EC9', padding: 7, borderRadius: 20 },
  eventCopy: { padding: 12, gap: 5 },
  eventTitle: { color: INK, fontSize: 14, fontWeight: '800', minHeight: 35 },
  eventMeta: { color: MUTED, fontSize: 11 },
  eventBottom: { marginTop: 4, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'space-between' },
  eventCategory: { color: MUTED, flex: 1, fontSize: 10 },
  eventPrice: { color: INK, fontWeight: '900', fontSize: 11 },
});
