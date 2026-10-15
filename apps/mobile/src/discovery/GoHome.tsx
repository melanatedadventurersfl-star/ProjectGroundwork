import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, ImageBackground, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useAuth } from '../auth/AuthProvider';
import { getCommunityFeed, getGroups, type CommunityPost, type CommunityGroup } from '../community/api';
import { getMemberTrips, type MemberTrip } from '../member/api';
import { supabase } from '../lib/supabase';
import { getJourney, type JourneyItem } from '../passport/api';
import { AppIcon } from '../ui/AppIcon';
import { loadDiscoveryItems, saveDiscoveryAdventure, type DiscoveryItem } from './catalog';
import { useGoMode } from './useGoMode';

const GREEN = '#A8ED8F';
const PURPLE = '#C891F5';
const INK = '#0E1716';
const MUTED = '#65706D';
const DEFAULT_NATURE = require('../../assets/trailhead-banners/explorer-clear-morning.jpg');
const DEFAULT_NIGHT = require('../../assets/trailhead-banners/adventurer-evening.jpg');

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
  const local = email.split('@')[0].toLowerCase();
  const candidates = [profileName, metadataName, username];
  const name = candidates.find(value => value.trim() && !value.includes('@') && value.toLowerCase() !== local);
  return name ? name.trim().split(/\s+/)[0] : '';
}
function daysUntil(value: string) {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}
function upcomingTrip(trips: MemberTrip[]) {
  const now = Date.now();
  return trips.filter(trip => trip.adventures
    && ['paid', 'held', 'payment_pending'].includes(trip.status)
    && trip.adventures.status !== 'cancelled'
    && Number.isFinite(Date.parse(trip.adventures.starts_at))
    && Date.parse(trip.adventures.starts_at) >= now)
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
  const [profile, setProfile] = useState({ name: '', username: '', city: '', interests: [] as string[] });
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
    [next[index], next[target]] = [next[target], next[index]];
    setHomeSections(next);
  }
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setNow(Date.now());
    const userId = session?.user.id;
    const [results, history, bookings, details, activity, memberships] = await Promise.allSettled([
      loadDiscoveryItems(),
      userId ? getJourney() : Promise.resolve([] as JourneyItem[]),
      userId ? getMemberTrips() : Promise.resolve([] as MemberTrip[]),
      userId ? supabase.from('profiles').select('display_name,username,home_city,interests').eq('id', userId).maybeSingle() : Promise.resolve({ data: null }),
      userId ? getCommunityFeed() : Promise.resolve([] as CommunityPost[]),
      userId ? getGroups() : Promise.resolve([] as CommunityGroup[]),
    ]);
    if (results.status === 'fulfilled') {
      setItems(results.value);
      setError(null);
    } else setError('Experiences could not load. Pull down to try again.');
    if (history.status === 'fulfilled') setJourney(history.value);
    if (memberships.status === 'fulfilled') setGroups(memberships.value.filter(group => group.is_member));
    if (activity.status === 'fulfilled' && memberships.status === 'fulfilled') {
      const myGroups = new Set(memberships.value.filter(group => group.is_member).map(group => group.id));
      setPosts(activity.value.filter(post => myGroups.has(post.group_id || '') || (post.audience === 'everyone' && !post.group_id)).slice(0, 2));
    }
    if (bookings.status === 'fulfilled') setTrips(bookings.value);
    if (details.status === 'fulfilled' && details.value.data) {
      const data = details.value.data;
      setProfile({
        name: String(data.display_name ?? ''), username: String(data.username ?? ''),
        city: String(data.home_city ?? ''),
        interests: Array.isArray(data.interests) ? data.interests.filter((item): item is string => typeof item === 'string') : [],
      });
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
  const myItems = useMemo(() => items.filter(item => item.mode === mode), [items, mode]);
  const futureTrips = useMemo(() => upcomingTrip(trips), [trips]);
  const liveTrip = trips.find(trip => trip.status === 'paid' && trip.adventures?.status !== 'cancelled'
    && trip.adventures && Date.parse(trip.adventures.starts_at) <= now
    && Date.parse(trip.adventures.ends_at) >= now) ?? null;
  const primaryTrip = liveTrip ?? futureTrips;
  const actionTrip = primaryTrip?.adventures ?? null;
  const isLive = Boolean(liveTrip);
  const isPending = primaryTrip?.status === 'held' || primaryTrip?.status === 'payment_pending';
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
        <Text style={styles.sectionTitle}>Your circle</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/communities')}>
          <Text style={styles.seeAll}>Communities →</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" style={[styles.circleCard, { backgroundColor: primary }]} onPress={() => router.push('/communities')}>
        <View style={styles.circleHeading}>
          <View style={[styles.circleIcon, { backgroundColor: mode === 'nature' ? '#29553E' : '#483269' }]}>
            <AppIcon name="community" size={24} color={accent}/>
          </View>
          <View style={styles.flex}>
            <Text style={styles.lightEyebrow}>PEOPLE MAKE THE EXPERIENCE</Text>
            <Text style={styles.circleTitle}>{mode === 'nature' ? 'Find your people outside.' : 'Find your people after dark.'}</Text>
          </View>
        </View>
        <Text style={styles.circleBody}>{groups.length ? 'You belong to ' + groups.length + (groups.length === 1 ? ' community.' : ' communities.') + ' Catch up with your people.' : 'Find a community, meet your people, and see the stories they share.'}</Text>
        <Text style={[styles.circleAction, { color: accent }]}>See your communities  →</Text>
      </Pressable>
      {posts.map(post => <Pressable key={post.id} accessibilityRole="button" style={styles.pulseCard}
        onPress={() => post.group_id ? router.push({ pathname: '/groups/[id]', params: { id: post.group_id } }) : router.push('/communities')}>
        <View style={styles.pulseIcon}><AppIcon name={post.post_type === 'photo' ? 'photos' : 'message'} color={primary} size={19}/></View>
        <View style={styles.flex}><Text style={styles.pulseAuthor}>{post.author_name || 'Community member'}</Text>
          <Text style={styles.pulseBody} numberOfLines={2}>{post.body || (post.post_type === 'photo' ? 'Shared a photo with the community.' : 'Shared an update.')}</Text></View>
        <AppIcon name="chevron-forward" color={MUTED} size={17}/>
      </Pressable>)}
    </View>;
    if (section === 'trail') return <View key="trail" style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{mode === 'nature' ? 'Your story so far' : 'Your plans & memories'}</Text>
      <View style={styles.duo}>
        <Pressable accessibilityRole="button" style={[styles.miniTile, styles.trailTile]} onPress={() => router.push('/member/journey')}>
          <AppIcon name="trail" color="#285F40" size={25}/>
          <Text style={styles.miniNumber}>{session ? journey.length : '—'}</Text>
          <Text style={styles.miniHeading}>Your Trail</Text>
          <Text style={styles.miniBody}>{session && journey.length ? 'Adventures in your story' : 'Your next chapter starts here'}</Text>
          <Text style={styles.miniAction}>Remember your moments →</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={[styles.miniTile, styles.planTile]} onPress={() => router.push('/member/trips')}>
          <AppIcon name="calendar" color="#614A79" size={25}/>
          <Text style={styles.miniNumber}>{session ? trips.filter(trip => trip.adventures && Date.parse(trip.adventures.starts_at) >= now && !['cancelled', 'refunded', 'expired'].includes(trip.status) && trip.adventures.status !== 'cancelled').length : '—'}</Text>
          <Text style={styles.miniHeading}>Your plans</Text>
          <Text style={styles.miniBody}>Upcoming reservations and experiences</Text>
          <Text style={styles.miniAction}>See your plans →</Text>
        </Pressable>
      </View>
      {needsReflection && recentJourney && <Pressable accessibilityRole="button" style={styles.reflection} onPress={() => router.push({ pathname: '/passport/memories/[adventureId]', params: { adventureId: recentJourney.adventure_id } })}>
        <AppIcon name="camera" color="#634C2C" size={24}/>
        <View style={styles.flex}><Text style={styles.reflectionTitle}>Keep this moment</Text>
          <Text style={styles.reflectionCopy} numberOfLines={2}>Add memories from {recentJourney.title}.</Text></View>
        <AppIcon name="chevron-forward" color="#634C2C" size={17}/>
      </Pressable>}
    </View>;
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
    <View style={styles.greetingRow}>
      <View style={styles.flex}>
        <Text style={styles.eyebrow}>GO MELANATED  /  YOUR TRAILHEAD</Text>
        <Text style={styles.greeting}>{greetingFor(new Date(now).getHours()) + (memberName ? ', ' + memberName : '') + '.'}</Text>
        <Text style={styles.greetingSub}>{actionTrip ? 'Something to look forward to.' : 'Where will your next story begin?'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push('/member/profile')} style={styles.profileButton}>
        <AppIcon name="profile" color={INK} size={22}/>
      </Pressable>
    </View>
    <View style={styles.switcher}>{(['nature', 'night'] as const).map(value =>
      <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }}
        onPress={() => switchMode(value)}
        style={[styles.modeButton, mode === value && { backgroundColor: value === 'nature' ? '#D6F0CC' : '#EAD8F7' }]}>
        <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value === 'nature' ? '🌿  Nature' : '🌙  Night'}</Text>
      </Pressable>)}</View>
    <View style={[styles.hero, { backgroundColor: primary }]}>
      <ImageBackground source={actionTrip?.hero_image_url ? { uri: actionTrip.hero_image_url } : mode === 'nature' ? DEFAULT_NATURE : DEFAULT_NIGHT}
        style={styles.heroImage} imageStyle={styles.heroCorners}>
        <View style={[styles.heroShade, { backgroundColor: mode === 'nature' ? 'rgba(6,25,16,0.77)' : 'rgba(24,12,47,0.79)' }]}>
          <Text style={[styles.heroLabel, { color: accent }]}>{isLive ? 'YOUR ADVENTURE IS LIVE' : hasBooking ? isPending ? 'ACTION NEEDED · YOUR RESERVATION' : 'YOUR NEXT ADVENTURE' : mode === 'nature' ? 'LET’S GO OUTSIDE' : 'LET’S GO OUT'}</Text>
          <Text style={styles.heroTitle}>{heroHeading}</Text>
          <Text style={styles.heroBody}>{heroDescription}</Text>
          {hasBooking && <Text style={[styles.heroStatus, { color: accent }]}>{isLive ? 'Your experience is underway' : isPending ? 'Complete your reservation' : days === 0 ? 'Coming up today' : days === 1 ? 'Tomorrow' : days + ' days to go'}</Text>}
          <Pressable accessibilityRole="button" onPress={() => hasBooking ? router.push({ pathname: '/adventures/[id]', params: { id: actionTrip!.id } }) : goDiscover(mode)}
            style={[styles.heroButton, { backgroundColor: accent }]}>
            <Text style={styles.heroButtonText}>{isLive ? 'Open your adventure' : hasBooking ? isPending ? 'Review reservation' : 'View your adventure' : 'Find your next experience'}  →</Text>
          </Pressable>
        </View>
      </ImageBackground>
    </View>
    {hasBooking && <Pressable accessibilityRole="button" style={styles.actionStrip} onPress={() => isLive ? router.push({ pathname: '/adventures/[id]', params: { id: actionTrip!.id } }) : router.push('/member/trips')}>
      <AppIcon name={isPending ? 'warning' : isLive ? 'map' : 'check'} color={isPending ? '#875C28' : '#1F6842'} size={20}/>
      <View style={styles.flex}><Text style={styles.actionTitle}>{isLive ? 'Adventure mode is ready' : isPending ? 'Your reservation needs attention' : 'Your adventure is on your calendar'}</Text>
        <Text style={styles.actionCopy}>{isLive ? 'Open the adventure for schedules, arrival details, and check-in.' : isPending ? 'Check your booking status and any required steps.' : 'Find booking details and prepare for the day.'}</Text></View>
      <AppIcon name="chevron-forward" color="#52665B" size={18}/>
    </Pressable>}
    {loading && <ActivityIndicator color={primary} style={styles.loading}/>}
    {error && <Text style={styles.error}>{error}</Text>}
    <View style={styles.personalizeRow}><Text style={styles.homeLabel}>YOUR WORLD</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Done editing home' : 'Customize home'}
        onPress={() => setEditing(current => !current)} style={styles.editButton}>
        <AppIcon name={editing ? 'check' : 'settings'} color={primary} size={15}/>
        <Text style={styles.editText}>{editing ? 'Done' : 'Customize'}</Text>
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
        <Text style={styles.crossKicker}>THERE'S MORE TO YOUR WORLD</Text>
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
  content: { paddingHorizontal: 18, paddingTop: 19, paddingBottom: 32, width: '100%', maxWidth: 970, alignSelf: 'center' },
  flex: { flex: 1 }, greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 10 },
  eyebrow: { fontWeight: '900', fontSize: 10, color: '#427B59', letterSpacing: 1.4 },
  greeting: { color: INK, fontWeight: '900', fontSize: 26, marginTop: 5, letterSpacing: -0.6 },
  greetingSub: { color: MUTED, fontSize: 12, marginTop: 5 },
  profileButton: { backgroundColor: '#E9EDE8', borderRadius: 24, padding: 13 },
  switcher: { flexDirection: 'row', padding: 5, gap: 5, borderRadius: 20, backgroundColor: '#E6E7E4', marginBottom: 15 },
  modeButton: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  modeText: { color: '#6B7371', fontSize: 14, fontWeight: '700' }, modeTextActive: { color: INK, fontWeight: '900' },
  hero: { borderRadius: 25, overflow: 'hidden', marginBottom: 8 },
  heroImage: { minHeight: 297, justifyContent: 'flex-end' }, heroCorners: { borderRadius: 25 },
  heroShade: { paddingHorizontal: 22, paddingVertical: 24, paddingTop: 86, minHeight: 297, justifyContent: 'flex-end' },
  heroLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginBottom: 8 },
  heroTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 29, lineHeight: 34, maxWidth: 530 },
  heroBody: { color: '#F4F5EC', fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 480 },
  heroStatus: { marginTop: 9, fontSize: 14, fontWeight: '900' },
  heroButton: { alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 19, paddingVertical: 14, borderRadius: 24, minHeight: 46, justifyContent: 'center' },
  heroButtonText: { color: INK, fontSize: 13, fontWeight: '900' },
  actionStrip: { backgroundColor: '#F8EED7', borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15, marginTop: 11 },
  actionTitle: { color: INK, fontSize: 13, fontWeight: '900' }, actionCopy: { color: '#5F6357', fontSize: 11, marginTop: 3, lineHeight: 17 },
  loading: { marginVertical: 12 }, error: { color: '#A33C3C', fontSize: 12, fontWeight: '800', paddingVertical: 10 },
  personalizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 19 },
  homeLabel: { color: '#74817A', fontWeight: '900', fontSize: 10, letterSpacing: 1.4 },
  editButton: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 9 },
  editText: { color: '#315A46', fontSize: 12, fontWeight: '800' },
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
  pulseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 13, borderRadius: 14, gap: 10 },
  pulseIcon: { borderRadius: 12, padding: 10, backgroundColor: '#E6F1E9' },
  pulseAuthor: { color: INK, fontWeight: '900', fontSize: 12 },
  pulseBody: { color: MUTED, marginTop: 3, lineHeight: 17, fontSize: 12 },
  circleAction: { fontWeight: '900', fontSize: 12, marginTop: 11 },
  duo: { flexDirection: 'row', gap: 10 },
  miniTile: { flex: 1, borderRadius: 20, padding: 16, minHeight: 185, justifyContent: 'space-between' },
  trailTile: { backgroundColor: '#E4F1E2' }, planTile: { backgroundColor: '#EDE5F5' },
  miniNumber: { color: INK, fontSize: 27, fontWeight: '900', marginTop: 10 },
  miniHeading: { color: INK, fontSize: 16, fontWeight: '900', marginTop: 4 },
  miniBody: { color: '#4A5854', fontSize: 11, lineHeight: 16, marginTop: 5 },
  miniAction: { color: '#2F6A4E', fontSize: 10, fontWeight: '900', marginTop: 11 },
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
