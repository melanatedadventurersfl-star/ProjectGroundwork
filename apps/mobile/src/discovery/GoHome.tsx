import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ImageBackground, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getJourney } from '../passport/api';
import { AppIcon, type AppIconName } from '../ui/AppIcon';
import { loadDiscoveryItems, saveDiscoveryAdventure, type DiscoveryItem } from './catalog';
import { useGoMode } from './useGoMode';

const GREEN = '#A8ED8F';
const PURPLE = '#C891F5';
const INK = '#0E1716';
const BG = '#F7F7F4';
const DARK = '#17251F';
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
const categories: Record<'nature' | 'night', { label: string; icon: AppIconName; query: string; route?: string }[]> = {
  nature: [
    { label: 'Hiking', icon: 'trail', query: 'hiking' },
    { label: 'Camping', icon: 'adventure', query: 'camping' },
    { label: 'Paddling', icon: 'weather', query: 'kayaking' },
    { label: 'Trail Guide', icon: 'guide', query: '', route: '/trail-guide' },
  ],
  night: [
    { label: 'Food', icon: 'food', query: 'food' },
    { label: 'Music', icon: 'message', query: 'music' },
    { label: 'Arts', icon: 'photos', query: 'art' },
    { label: 'Events', icon: 'calendar', query: '' },
  ],
};

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

export default function GoHome() {
  const { session } = useAuth();
  const { mode, chooseMode } = useGoMode(session?.user.id);
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [journeyCount, setJourneyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = mode === 'nature' ? "Let's GO Outside." : "Let's GO Out.";
  const accent = mode === 'nature' ? GREEN : PURPLE;
  const primary = mode === 'nature' ? '#102F26' : '#2A173F';
  const myItems = useMemo(() => items.filter(item => item.mode === mode), [items, mode]);
  const otherItems = useMemo(() => items.filter(item => item.mode !== mode), [items, mode]);
  const featured = myItems.find(item => item.featured && item.image) ?? myItems.find(item => item.image);
  const displayName = String(session?.user.user_metadata?.first_name ||
    session?.user.user_metadata?.display_name || '').trim().split(' ')[0];
  const cardWidth = Math.min(width * 0.62, 258);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    const [results, journey] = await Promise.allSettled([
      loadDiscoveryItems(),
      session ? getJourney() : Promise.resolve([]),
    ]);
    if (results.status === 'fulfilled') {
      setItems(results.value);
      setError(null);
    } else setError('Experiences could not load. Pull down to try again.');
    if (journey.status === 'fulfilled') setJourneyCount(journey.value.length);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const updateSaved = (id: string, saved: boolean) =>
    setItems(current => current.map(item => item.id === id && item.source === 'adventure' ? { ...item, saved } : item));

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={primary}/>}>
    <View style={styles.greetingRow}>
      <View style={styles.flex}>
        <Text style={styles.eyebrow}>GO MELANATED</Text>
        <Text style={styles.greeting}>{displayName ? `Welcome back, ${displayName}` : 'Explore your world'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push('/member/profile')} style={styles.profileButton}>
        <AppIcon name="profile" color={INK} size={22}/>
      </Pressable>
    </View>
    <View style={styles.switcher}>
      {(['nature', 'night'] as const).map(value => {
        const selected = mode === value;
        return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }}
          onPress={() => chooseMode(value)}
          style={[styles.modeButton, selected && { backgroundColor: value === 'nature' ? '#D5F6C8' : '#E8D5F7' }]}>
          <Text style={[styles.modeText, selected && styles.modeTextActive]}>{value === 'nature' ? '🌿 Nature' : '🌙 Night'}</Text>
        </Pressable>;
      })}
    </View>

    <View style={[styles.hero, { backgroundColor: primary }]}>
      <ImageBackground
        source={featured?.image ? { uri: featured.image } : mode === 'nature' ? DEFAULT_NATURE : DEFAULT_NIGHT}
        style={styles.heroImage} imageStyle={styles.heroCorners}>
        <View style={styles.heroShade}>
          <Text style={[styles.heroLabel, { color: accent }]}>{featured ? 'FEATURED EXPERIENCE' : mode === 'nature' ? 'DISCOVER THE OUTDOORS' : 'DISCOVER YOUR CITY'}</Text>
          <Text style={styles.heroTitle}>{featured?.title || title}</Text>
          <Text style={styles.heroBody} numberOfLines={3}>{featured ? `${featured.city} · ${dateLabel(featured.startsAt)}` : mode === 'nature'
            ? 'Explore trails, waterways, and adventures worth remembering.'
            : 'Find music, food, culture, and local experiences.'}</Text>
          <Pressable onPress={() => featured ? eventRoute(featured) : goDiscover(mode)}
            style={[styles.heroButton, { backgroundColor: accent }]}>
            <Text style={styles.heroButtonText}>{featured ? 'View experience' : 'Start exploring'}  →</Text>
          </Pressable>
        </View>
      </ImageBackground>
    </View>

    <Text style={styles.sectionTitle}>{mode === 'nature' ? 'What would you like to do?' : "What's your scene?"}</Text>
    <View style={styles.categoryRow}>
      {categories[mode].map(category => <Pressable key={category.label} style={styles.category}
        onPress={() => category.route ? router.push(category.route as never) : goDiscover(mode, category.query)}>
        <View style={[styles.categoryIcon, { backgroundColor: mode === 'nature' ? '#E3F2DD' : '#F0E4F8' }]}>
          <AppIcon name={category.icon} color={mode === 'nature' ? '#285D3F' : '#713B9C'} size={22}/>
        </View>
        <Text style={styles.categoryLabel}>{category.label}</Text>
      </Pressable>)}
    </View>

    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{mode === 'nature' ? 'Explore the outdoors' : 'Happening around you'}</Text>
      <Pressable onPress={() => goDiscover(mode)}><Text style={styles.seeAll}>See all →</Text></Pressable>
    </View>
    {loading ? <ActivityIndicator color={primary} style={styles.loading}/> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !myItems.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing coming up here yet.</Text>
      <Text style={styles.muted}>Browse Discover for other experiences or check back later.</Text></View> : null}
    {!!myItems.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
      {myItems.slice(0, 8).map(item => <ExperienceCard key={`${item.source}:${item.id}`} item={item} width={cardWidth} onSavedChange={updateSaved}/>)}
    </ScrollView>}

    <Pressable style={[styles.highlight, { backgroundColor: mode === 'nature' ? '#E6F0E3' : '#F0E7F6' }]}
      onPress={() => router.push(mode === 'nature' ? '/trail-guide' : '/communities')}>
      <AppIcon name={mode === 'nature' ? 'guide' : 'map'} color={primary} size={28}/>
      <View style={styles.flex}>
        <Text style={styles.highlightTitle}>{mode === 'nature' ? 'Explore the Trail Guide' : 'Find your local scene'}</Text>
        <Text style={styles.highlightSubtitle}>{mode === 'nature' ? 'Real places, local guides, and outdoor details.' : 'Explore communities, organizers, and shared interests.'}</Text>
      </View>
      <AppIcon name="chevron-forward" color={INK} size={18}/>
    </Pressable>

    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{mode === 'nature' ? 'Outdoor community' : 'Community & connection'}</Text>
      <Pressable onPress={() => router.push('/communities')}><Text style={styles.seeAll}>Explore →</Text></Pressable>
    </View>
    <Pressable style={styles.communityCard} onPress={() => router.push('/communities')}>
      <View style={[styles.communityIcon, { backgroundColor: primary }]}><AppIcon name="community" color={accent} size={26}/></View>
      <View style={styles.flex}>
        <Text style={styles.communityTitle}>{mode === 'nature' ? 'Melanated Adventurers' : 'JaxBlack'}</Text>
        <Text style={styles.muted}>{mode === 'nature' ? 'Connect through outdoor experiences.' : 'Explore a community for Jacksonville culture and connections.'}</Text>
        <Text style={styles.smallLink}>Find community →</Text>
      </View>
    </Pressable>

    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{mode === 'nature' ? 'Your Trail' : 'Your plans'}</Text></View>
    <Pressable style={styles.memoryCard} onPress={() => router.push(mode === 'nature' ? '/member/journey' : '/member/trips')}>
      <AppIcon name={mode === 'nature' ? 'trail' : 'calendar'} color={primary} size={25}/>
      <View style={styles.flex}>
        <Text style={styles.highlightTitle}>{mode === 'nature' ? 'Your outdoor life, remembered' : 'Your next city experience'}</Text>
        <Text style={styles.muted}>{mode === 'nature'
          ? journeyCount ? `${journeyCount} adventures in your story.` : 'Your first adventure becomes chapter one.'
          : 'Find your tickets, reservations, and upcoming trips.'}</Text>
      </View>
      <AppIcon name="chevron-forward" color={INK} size={18}/>
    </Pressable>

    <Text style={styles.crossLabel}>ALSO WORTH EXPLORING</Text>
    <View style={styles.crossCard}>
      <View style={styles.flex}>
        <Text style={styles.crossTitle}>{mode === 'nature' ? 'A little city adventure?' : 'Take the scenic route.'}</Text>
        <Text style={styles.muted}>{otherItems.length
          ? `There ${otherItems.length === 1 ? 'is' : 'are'} ${otherItems.length} upcoming ${mode === 'nature' ? 'city' : 'outdoor'} experiences to explore.`
          : mode === 'nature' ? "See what else is happening nearby." : "Discover nature beyond the city."}</Text>
      </View>
      <Pressable onPress={() => chooseMode(mode === 'nature' ? 'night' : 'nature')} style={styles.crossButton}>
        <Text style={styles.crossButtonText}>Explore {mode === 'nature' ? 'Night' : 'Nature'} →</Text>
      </Pressable>
    </View>
    <View style={styles.bottomSpace}/>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 26, width: '100%', maxWidth: 970, alignSelf: 'center' },
  flex: { flex: 1 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  eyebrow: { fontWeight: '900', fontSize: 10, color: '#3C7456', letterSpacing: 1.8 },
  greeting: { color: INK, fontWeight: '800', fontSize: 23, marginTop: 3 },
  profileButton: { backgroundColor: '#E8EBE7', borderRadius: 22, padding: 10 },
  switcher: { flexDirection: 'row', padding: 5, gap: 5, borderRadius: 20, backgroundColor: '#E6E9E5', marginBottom: 14 },
  modeButton: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  modeText: { color: '#66716F', fontSize: 14, fontWeight: '700' },
  modeTextActive: { color: INK, fontWeight: '900' },
  hero: { borderRadius: 22, overflow: 'hidden', marginBottom: 22 },
  heroImage: { height: 282, justifyContent: 'flex-end' }, heroCorners: { borderRadius: 22 },
  heroShade: { paddingHorizontal: 22, paddingVertical: 22, paddingTop: 72, backgroundColor: '#06130C90' },
  heroLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 6 },
  heroTitle: { color: 'white', fontWeight: '900', fontSize: 29, lineHeight: 33, maxWidth: 480 },
  heroBody: { color: '#F4F5EC', fontSize: 13, lineHeight: 19, marginTop: 6 },
  heroButton: { alignSelf: 'flex-start', marginTop: 15, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22 },
  heroButtonText: { color: INK, fontSize: 13, fontWeight: '900' },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: INK, marginBottom: 11 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  seeAll: { fontSize: 12, color: '#2274AE', fontWeight: '800', marginBottom: 11 },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  category: { flex: 1, alignItems: 'center', gap: 7 },
  categoryIcon: { width: '100%', minHeight: 62, justifyContent: 'center', alignItems: 'center', borderRadius: 13 },
  categoryLabel: { fontWeight: '700', color: INK, fontSize: 11, textAlign: 'center' },
  loading: { paddingVertical: 24 },
  cards: { gap: 12, paddingBottom: 6 },
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
  highlight: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginTop: 23 },
  highlightTitle: { fontSize: 15, fontWeight: '900', color: INK },
  highlightSubtitle: { color: '#55615B', fontSize: 12, marginTop: 4 },
  communityCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 12, alignItems: 'center' },
  communityIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  communityTitle: { color: INK, fontWeight: '900', fontSize: 16 },
  muted: { color: MUTED, fontSize: 12, lineHeight: 18, marginTop: 4 },
  smallLink: { fontWeight: '800', color: '#2373A5', fontSize: 11, marginTop: 8 },
  memoryCard: { backgroundColor: '#E8EFEA', padding: 17, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  crossLabel: { fontSize: 10, color: MUTED, fontWeight: '900', letterSpacing: 1.4, marginTop: 30, marginBottom: 9 },
  crossCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 17, borderWidth: 1, borderColor: '#E2E5E0', gap: 12 },
  crossTitle: { color: INK, fontWeight: '900', fontSize: 17 },
  crossButton: { alignSelf: 'flex-start', backgroundColor: DARK, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11 },
  crossButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 17 },
  emptyTitle: { fontWeight: '800', color: INK, fontSize: 15 },
  error: { color: '#9A3636', fontWeight: '700', fontSize: 12, paddingVertical: 6 },
  bottomSpace: { height: 12 },
});
