import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { listAdventures } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import { getMemberTrips } from '../../src/member/api';
import { getJourney } from '../../src/passport/api';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';
import { useAuth } from '../../src/auth/AuthProvider';
import { useGoTheme } from '../../src/theme/useGoTheme';

type Item = { title: string; details: string; route: string; icon: AppIconName };
const links: Item[] = [
  { title: 'My tickets & plans', details: 'Upcoming experiences and booking history', route: '/member/trips', icon: 'calendar' },
  { title: 'Your Trail', details: 'Outdoor memories and adventure milestones', route: '/member/journey', icon: 'trail' },
  { title: 'My profile', details: 'Your identity and preferences', route: '/member/profile', icon: 'profile' },
  { title: 'Find communities', details: 'Explore people and groups to connect with', route: '/communities', icon: 'community' },
];
export default function MyGoScreen() {
  const { session } = useAuth();
  const { palette, mode } = useGoTheme(session?.user.id);
  const [saved, setSaved] = useState<AdventureSummary[]>([]);
  const [trips, setTrips] = useState<number | null>(null);
  const [memories, setMemories] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    const [adventures, myTrips, journey] = await Promise.allSettled([listAdventures(), getMemberTrips(), getJourney()]);
    if (adventures.status === 'fulfilled') setSaved(adventures.value.filter(item => item.is_saved));
    if (myTrips.status === 'fulfilled') setTrips(myTrips.value.length);
    if (journey.status === 'fulfilled') setMemories(journey.value.length);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A"/>}>
    <View style={[styles.hero, { backgroundColor: mode === 'nature' ? '#244B39' : '#39314E' }]}>
      <Text style={styles.eyebrow}>YOUR GO MELANATED</Text>
      <Text style={styles.heroTitle}>My GO</Text>
      <Text style={styles.heroBody}>Your plans, saved discoveries, and experiences in one place.</Text>
    </View>
    <View style={styles.stats}>
      <View style={[styles.stat, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={[styles.statNumber, { color: palette.text }]}>{trips ?? '–'}</Text><Text style={[styles.statLabel, { color: palette.muted }]}>Trips & orders</Text></View>
      <View style={[styles.stat, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={[styles.statNumber, { color: palette.text }]}>{saved.length}</Text><Text style={[styles.statLabel, { color: palette.muted }]}>Saved events</Text></View>
      <View style={[styles.stat, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={[styles.statNumber, { color: palette.text }]}>{memories ?? '–'}</Text><Text style={[styles.statLabel, { color: palette.muted }]}>Trail memories</Text></View>
    </View>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>Your experience hub</Text>
    {links.map(item => <Pressable key={item.route} style={[styles.linkCard, { backgroundColor: palette.surface }]} onPress={() => router.push(item.route as never)}>
      <View style={[styles.icon, { backgroundColor: palette.elevated }]}><AppIcon name={item.icon} color={palette.icon} size={22}/></View>
      <View style={styles.flex}><Text style={[styles.linkTitle, { color: palette.text }]}>{item.title}</Text><Text style={[styles.linkCopy, { color: palette.muted }]}>{item.details}</Text></View>
      <AppIcon name="chevron-forward" color={palette.icon} size={20}/>
    </Pressable>)}
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Saved experiences</Text>
      <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={[styles.seeAll, { color: palette.accent }]}>Discover →</Text></Pressable>
    </View>
    {loading && <ActivityIndicator color={palette.accent}/>}
    {!loading && !saved.length && <View style={[styles.empty, { backgroundColor: palette.surface }]}><Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing saved yet</Text>
      <Text style={[styles.linkCopy, { color: palette.muted }]}>Bookmark an adventure in Discover to find it here later.</Text></View>}
    {saved.map(item => <Pressable key={item.id} style={[styles.savedRow, { backgroundColor: palette.surface }]}
      onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}>
      {item.hero_image_url ? <Image source={{ uri: item.hero_image_url }} style={styles.thumb}/> : <View style={styles.thumbFallback}><AppIcon name="adventure" color="#6B8B6F" size={23}/></View>}
      <View style={styles.flex}><Text style={[styles.linkTitle, { color: palette.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.linkCopy, { color: palette.muted }]} numberOfLines={1}>{item.category} · {item.city}, {item.state}</Text></View>
      <AppIcon name="chevron-forward" color={palette.icon} size={20}/>
    </Pressable>)}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { backgroundColor: '#F6F7F4', flex: 1 },
  content: { maxWidth: 970, width: '100%', alignSelf: 'center', padding: 18, paddingBottom: 48 },
  hero: { backgroundColor: '#203D30', borderRadius: 19, paddingHorizontal: 21, paddingVertical: 30 },
  eyebrow: { color: '#ACEB92', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  heroTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '900', marginTop: 7 },
  heroBody: { color: '#E0EDE0', fontSize: 13, lineHeight: 19, marginTop: 7 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 15, marginBottom: 22 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E0E8DE' },
  statNumber: { color: '#213E31', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#5B6B62', fontSize: 10, marginTop: 3, fontWeight: '700' },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#16251C', marginBottom: 10 },
  linkCard: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 15, marginBottom: 9, flexDirection: 'row', gap: 12, alignItems: 'center' },
  icon: { backgroundColor: '#E3F1DD', borderRadius: 12, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 }, linkTitle: { color: '#16251C', fontSize: 14, fontWeight: '900' },
  linkCopy: { color: '#65736A', fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 17 },
  seeAll: { color: '#2374A1', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  empty: { padding: 20, backgroundColor: '#FFFFFF', borderRadius: 14 },
  emptyTitle: { color: '#182720', fontSize: 15, fontWeight: '900' },
  savedRow: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 9, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 11 },
  thumb: { width: 69, height: 67, borderRadius: 9 }, thumbFallback: { width: 69, height: 67, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5EDE4' },
});
