import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroups, joinGroup, type CommunityGroup } from '../../src/community/api';
import { communityOwnershipLabel, isPeopleCommunity } from '../../src/community/communityModel';
import { getMemberBasecamp } from '../../src/member/api';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const SURFACE = '#16201B';
const BORDER = '#2A382F';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const GREEN = '#7F9D68';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GM';
}

function normalize(value?: string | null) {
  return value?.trim().toLowerCase().replace(/florida/g, 'fl').replace(/[^a-z0-9]+/g, '-') ?? '';
}

function nearby(group: CommunityGroup, city: string | null, state: string | null) {
  if (!city || !group.city) return false;
  const leftState = normalize(group.state);
  const rightState = normalize(state);
  return normalize(group.city) === normalize(city) && (!leftState || !rightState || leftState === rightState);
}

function CommunityCard({ group, joining, reason, onJoin }: { group: CommunityGroup; joining: boolean; reason?: string; onJoin: (group: CommunityGroup) => void }) {
  const image = group.cover_image_url || group.image_url;
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      <View style={styles.imageWrap}>{image ? <Image source={{ uri: image }} style={styles.image} /> : <Text style={styles.initials}>{initials(group.name)}</Text>}</View>
      <View style={styles.cardCopy}>
        <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
        <Text style={styles.owner} numberOfLines={1}>{communityOwnershipLabel(group)}</Text>
        {reason ? <Text style={styles.reason} numberOfLines={1}>{reason}</Text> : <Text style={styles.meta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>}
      </View>
      {group.is_member ? <Ionicons name="chevron-forward" size={18} color={GOLD} /> : <View style={styles.joinButton}><Text style={styles.joinText}>{joining ? 'Joining…' : 'Join'}</Text></View>}
    </Pressable>
  );
}

export default function CommunitiesScreen() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [query, setQuery] = useState('');
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [groupsResult, profileResult] = await Promise.allSettled([getGroups(), getMemberBasecamp()]);
    if (groupsResult.status === 'fulfilled') setGroups(groupsResult.value.filter(isPeopleCommunity));
    if (profileResult.status === 'fulfilled') {
      setHomeCity((profileResult.value.profile?.home_city as string | null | undefined) ?? null);
      setHomeState((profileResult.value.profile?.home_state as string | null | undefined) ?? null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const joined = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const discover = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .filter((group) => !group.is_member)
      .filter((group) => !needle || `${group.name} ${group.description ?? ''} ${group.city ?? ''} ${group.state ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(nearby(b, homeCity, homeState)) - Number(nearby(a, homeCity, homeState)) || b.member_count - a.member_count);
  }, [groups, query, homeCity, homeState]);

  const recommended = useMemo(() => discover.slice(0, 4), [discover]);

  const handleJoin = useCallback(async (group: CommunityGroup) => {
    if (joiningId) return;
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      setGroups((current) => current.map((item) => item.id === group.id ? { ...item, is_member: true, member_count: item.member_count + 1 } : item));
    } finally {
      setJoiningId(null);
    }
  }, [joiningId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={TEXT} /></Pressable>
        <View style={styles.flex}><Text style={styles.eyebrow}>OUTPOST</Text><Text style={styles.title}>Communities</Text></View>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={GOLD} /></View> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchWrap}><Ionicons name="search" size={18} color={MUTED} /><TextInput value={query} onChangeText={setQuery} placeholder="Search communities" placeholderTextColor="#758078" style={styles.searchInput} /></View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your Communities</Text><Text style={styles.sectionCopy}>The groups you belong to and can participate in.</Text></View>
        {joined.length ? <View style={styles.list}>{joined.map((group) => <CommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />)}</View> : <View style={styles.empty}><Ionicons name="people-outline" size={23} color={GREEN} /><Text style={styles.emptyTitle}>You haven’t joined a community yet.</Text><Text style={styles.emptyCopy}>Communities are groups with people, ownership, and an ongoing purpose. Activity topics such as camping and hiking are handled as interests.</Text></View>}

        {!query.trim() ? <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recommended for You</Text><Text style={styles.sectionCopy}>Nearby groups and active communities appear first.</Text></View><View style={styles.list}>{recommended.length ? recommended.map((group) => <CommunityCard key={group.id} group={group} joining={joiningId === group.id} reason={nearby(group, homeCity, homeState) && homeCity ? `Near ${homeCity}` : `${group.member_count} members`} onJoin={handleJoin} />) : <Text style={styles.muted}>No additional communities are available right now.</Text>}</View></> : null}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{query.trim() ? 'Search Results' : 'Browse Communities'}</Text><Text style={styles.sectionCopy}>Join the people you want to keep hearing from.</Text></View>
        <View style={styles.list}>{discover.length ? discover.map((group) => <CommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={handleJoin} />) : <Text style={styles.muted}>No communities match that search.</Text>}</View>
      </ScrollView>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE },
  eyebrow: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: TEXT, fontSize: 22, fontWeight: '900', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  searchWrap: { minHeight: 48, borderRadius: 15, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  searchInput: { flex: 1, color: TEXT, fontSize: 14, paddingVertical: 0 },
  sectionHeader: { marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: TEXT, fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  sectionCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  list: { gap: 8 },
  card: { minHeight: 80, borderRadius: 16, backgroundColor: SURFACE, borderWidth: 1, borderColor: '#243229', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  imageWrap: { width: 54, height: 54, borderRadius: 14, overflow: 'hidden', backgroundColor: '#27342C', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  initials: { color: GOLD, fontSize: 14, fontWeight: '900' },
  cardCopy: { flex: 1, minWidth: 0 },
  name: { color: TEXT, fontSize: 14.5, fontWeight: '900' },
  owner: { color: '#C8D0CB', fontSize: 10.5, marginTop: 2 },
  reason: { color: '#A9C79A', fontSize: 10.5, fontWeight: '800', marginTop: 4 },
  meta: { color: MUTED, fontSize: 10.5, marginTop: 4 },
  joinButton: { borderRadius: 999, backgroundColor: GOLD, paddingHorizontal: 10, paddingVertical: 7 },
  joinText: { color: '#152019', fontSize: 10.5, fontWeight: '900' },
  empty: { borderRadius: 17, backgroundColor: '#141E19', padding: 17 },
  emptyTitle: { color: TEXT, fontSize: 15.5, fontWeight: '900', marginTop: 9 },
  emptyCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  muted: { color: MUTED, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.72 },
});
