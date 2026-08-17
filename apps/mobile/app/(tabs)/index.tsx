import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
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
import { useAuth } from '../../src/auth/AuthProvider';
import { getCommunityFeed, type CommunityPost } from '../../src/community/api';
import { getCircles } from '../../src/community/circles';
import { removeProfileCover, uploadProfileCover } from '../../src/member/api';
import { supabase } from '../../src/lib/supabase';
import { getJourney } from '../../src/passport/api';
import { rankFor } from '../../src/passport/RankEmblem';
import { getAdventureQueue } from '../../src/readiness/api';
import type { AdventureQueueItem } from '../../src/readiness/types';
import { TrailheadCover } from '../../src/trailhead/TrailheadCover';
import { AppIcon } from '../../src/ui/AppIcon';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COMPACT_CARD_WIDTH = 176;
const WIDE_CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 430);
type CampfireMode = 'general' | 'circle';

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function countdown(value: string) {
  const start = new Date(value);
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.ceil((startDay - today) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : shortDate(value);
}

function promptForAccount(destination: string) {
  Alert.alert(
    'Sign in to continue',
    `${destination} is part of your member experience. Sign in or create an account to continue.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Create account', onPress: () => router.push('/(auth)/sign-up' as never) },
      { text: 'Sign in', onPress: () => router.push('/(auth)/sign-in' as never) },
    ],
  );
}

export default function TrailheadScreen() {
  const { session } = useAuth();
  const [queue, setQueue] = useState<AdventureQueueItem[]>([]);
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [displayName, setDisplayName] = useState('Adventurer');
  const [completedCount, setCompletedCount] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [circleCount, setCircleCount] = useState(0);
  const [campfireMode, setCampfireMode] = useState<CampfireMode>('general');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAdventures = useMemo(() => adventures.filter((item) => item.status !== 'cancelled'), [adventures]);
  const featured = useMemo(() => activeAdventures.slice(0, 8), [activeAdventures]);
  const adventureById = useMemo(() => new Map(adventures.map((item) => [item.id, item])), [adventures]);
  const reservedAdventures = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return [...queue]
      .filter((item) => new Date(item.starts_at).getTime() >= startOfToday.getTime())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [queue]);
  const memberRank = useMemo(() => rankFor(completedCount), [completedCount]);
  const campfirePosts = useMemo(() => {
    const filtered = communityPosts.filter((post) => campfireMode === 'circle'
      ? post.audience === 'circle'
      : post.audience === 'everyone' || post.audience === 'connections');
    return filtered.slice(0, 3);
  }, [communityPosts, campfireMode]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const userId = session?.user.id;
      const [nextQueue, nextJourney, nextAdventures, profileResult, nextPosts, nextCircles] = await Promise.all([
        userId ? getAdventureQueue() : Promise.resolve([] as AdventureQueueItem[]),
        userId ? getJourney() : Promise.resolve([]),
        listAdventures(),
        userId ? supabase.from('profiles').select('*').eq('id', userId).single() : Promise.resolve({ data: null, error: null }),
        userId ? getCommunityFeed().catch(() => [] as CommunityPost[]) : Promise.resolve([] as CommunityPost[]),
        userId ? getCircles().catch(() => []) : Promise.resolve([]),
      ]);

      setQueue(nextQueue);
      setCompletedCount(nextJourney.length);
      setAdventures(nextAdventures);
      setCommunityPosts(nextPosts);
      setCircleCount(nextCircles.length);
      const profile = profileResult.data as {
        first_name?: string | null;
        display_name?: string | null;
        cover_url?: string | null;
      } | null;
      setDisplayName(profile?.display_name?.trim() || profile?.first_name?.trim() || 'Adventurer');
      setCoverUrl(profile?.cover_url ?? null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Trailhead.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function chooseCoverPhoto() {
    if (!session) { promptForAccount('Trailhead personalization'); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to choose a Trailhead cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 6], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    setCoverBusy(true);
    try {
      const asset = result.assets[0];
      const nextCoverUrl = await uploadProfileCover({ uri: asset.uri, mimeType: asset.mimeType });
      setCoverUrl(nextCoverUrl);
    } catch (caught) {
      Alert.alert('Cover photo', caught instanceof Error ? caught.message : 'Unable to update your Trailhead cover.');
    } finally { setCoverBusy(false); }
  }

  async function restoreDefaultCover() {
    if (!session) { promptForAccount('Trailhead personalization'); return; }
    setCoverBusy(true);
    try { await removeProfileCover(); setCoverUrl(null); }
    catch (caught) { Alert.alert('Cover photo', caught instanceof Error ? caught.message : 'Unable to restore the default cover.'); }
    finally { setCoverBusy(false); }
  }

  function coverMenu() {
    if (!session) { promptForAccount('Trailhead personalization'); return; }
    if (!coverUrl) { void chooseCoverPhoto(); return; }
    Alert.alert('Trailhead cover', 'Choose what you want to do.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change photo', onPress: () => void chooseCoverPhoto() },
      { text: 'Use default scenery', onPress: () => void restoreDefaultCover() },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}>
      <View style={styles.topRow}>
        <ImageBackground source={require('../../assets/ma-pathfinder-mark.png')} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel="Melanated Adventurers" />
        <View style={styles.topActions}>
          <Pressable accessibilityLabel="Notifications" onPress={() => session ? router.push('/notifications') : promptForAccount('Notifications')} style={styles.iconButton}><AppIcon name="notifications" color="#F6F4EE" size={22} /></Pressable>
          <Pressable accessibilityLabel="Profile" onPress={() => session ? router.push('/member/profile') : promptForAccount('Profile')} style={styles.iconButton}><AppIcon name="profile" color="#F6F4EE" size={22} /></Pressable>
        </View>
      </View>

      <TrailheadCover coverUrl={coverUrl} displayName={displayName} greeting={greeting(new Date().getHours())} rank={memberRank} busy={coverBusy} onEdit={coverMenu} onRankPress={() => session ? router.push('/member/profile') : promptForAccount('Profile')} />

      <Text style={styles.title}>What’s next on your trail?</Text>
      {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {featured.length ? (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Featured Adventures</Text>
            <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.linkBare}>See all</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactRow}>
            {featured.map((item) => (
              <Pressable key={item.id} style={styles.compactCard} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: item.id } })}>
                <ImageBackground source={item.hero_image_url ? { uri: item.hero_image_url } : undefined} style={styles.compactImage} imageStyle={styles.compactRadius}>
                  <View style={styles.compactShade} />
                  <View style={styles.compactBody}>
                    <Text style={styles.compactEyebrow}>{item.is_featured ? 'FEATURED' : 'ADVENTURE'}</Text>
                    <Text style={styles.compactTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.compactMeta} numberOfLines={1}>{shortDate(item.starts_at)} · {item.city}</Text>
                  </View>
                </ImageBackground>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your Next Adventures</Text>
          {reservedAdventures.length ? <Text style={styles.count}>{reservedAdventures.length} reserved</Text> : null}
        </View>
        {reservedAdventures.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={WIDE_CARD_WIDTH + 12} decelerationRate="fast" contentContainerStyle={styles.wideRow}>
            {reservedAdventures.map((item, index) => {
              const adventure = adventureById.get(item.adventure_id);
              return (
                <Pressable
                  key={`${item.order_id}-${item.adventure_id}`}
                  style={styles.wideCard}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title}`}
                  onPress={() => router.push({ pathname: '/readiness/[orderId]', params: { orderId: item.order_id } })}
                >
                  <ImageBackground source={adventure?.hero_image_url ? { uri: adventure.hero_image_url } : undefined} style={styles.wideImage} imageStyle={styles.wideRadius}>
                    <View style={styles.wideShade} />
                    <View style={styles.wideBody}>
                      <View style={styles.wideTopRow}>
                        <Text style={styles.wideLabel}>{index === 0 ? 'NEXT UP' : 'RESERVED'}</Text>
                        <Text style={styles.wideCountdown}>{countdown(item.starts_at)}</Text>
                      </View>
                      <Text style={styles.wideTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.wideMeta}>{shortDate(item.starts_at)} · {item.city}, {item.state}</Text>
                      <View style={styles.wideFooter}>
                        <Text style={styles.reservedPill}>RESERVED</Text>
                        <Text style={styles.wideLink}>View Adventure →</Text>
                      </View>
                    </View>
                  </ImageBackground>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Pressable style={styles.emptyAdventureCard} onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.utilityEyebrow}>YOUR NEXT ADVENTURES</Text>
            <Text style={styles.emptyAdventureTitle}>Your next trail is waiting.</Text>
            <Text style={styles.emptyAdventureText}>Reserve an adventure and it’ll show up here.</Text>
            <Text style={styles.link}>Explore Adventures →</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.campfireCard}>
        <View style={styles.campfireTopRow}><View style={styles.campfireHeading}><Text style={styles.utilityEyebrow}>CAMPFIRE</Text><Text style={styles.campfireTitle}>Around the Campfire</Text></View>{circleCount > 0 ? <View style={styles.campfireBadge}><Text style={styles.campfireBadgeText}>{circleCount} {circleCount === 1 ? 'crew' : 'crews'}</Text></View> : null}</View>
        {session ? <View style={styles.campfireSwitch} accessibilityRole="tablist"><Pressable accessibilityRole="tab" accessibilityState={{ selected: campfireMode === 'general' }} style={[styles.campfireSwitchButton, campfireMode === 'general' && styles.campfireSwitchActive]} onPress={() => setCampfireMode('general')}><Text style={[styles.campfireSwitchText, campfireMode === 'general' && styles.campfireSwitchTextActive]}>General</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: campfireMode === 'circle' }} style={[styles.campfireSwitchButton, campfireMode === 'circle' && styles.campfireSwitchActive]} onPress={() => setCampfireMode('circle')}><Text style={[styles.campfireSwitchText, campfireMode === 'circle' && styles.campfireSwitchTextActive]}>Crew</Text></Pressable></View> : null}
        <View style={styles.campfireFeed}>
          {session && campfirePosts.length ? campfirePosts.map((post) => (
            <Pressable key={post.id} style={({ pressed }) => [styles.campfirePost, pressed && styles.campfirePostPressed]} onPress={() => router.push(`/community/${post.id}`)} accessibilityRole="button" accessibilityLabel={`Open post from ${post.author_name}`}>
              <View style={styles.campfireAvatar}>{post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.campfireAvatarImage} /> : <Text style={styles.campfireAvatarText}>{initials(post.author_name)}</Text>}</View>
              <View style={styles.campfirePostBody}><View style={styles.campfireAuthorRow}><Text style={styles.campfireAuthor} numberOfLines={1}>{post.author_name}</Text><Text style={styles.campfireTime}>{relativeTime(post.created_at)}</Text></View><View style={styles.campfirePostContent}><View style={styles.campfirePostCopy}><Text style={styles.campfirePostText} numberOfLines={2}>{post.body}</Text><Text style={styles.campfireEngagement}>{post.reaction_count || 0} reactions · {post.comment_count || 0} comments</Text></View>{post.image_url ? <Image source={{ uri: post.image_url }} style={styles.campfireMediaThumb} /> : null}</View></View>
            </Pressable>
          )) : (
            <View style={styles.campfireEmpty}><Text style={styles.campfireEmptyTitle}>{session ? (campfireMode === 'circle' && circleCount === 0 ? 'Your Crew starts here.' : 'Quiet around the fire right now.') : 'Meet your outdoor community.'}</Text><Text style={styles.campfireEmptyText}>{session ? (campfireMode === 'circle' && circleCount === 0 ? 'Join or create a Crew to see your Crew posts here.' : campfireMode === 'circle' ? 'New posts from your Crews will show up here.' : 'Recent community posts will show up here.') : 'Sign in to join Campfire conversations, groups, and crews.'}</Text></View>
          )}
        </View>
        <View style={styles.campfireFooter}><Text style={styles.campfirePrompt}>{session ? (campfireMode === 'circle' ? 'Catch up with your people.' : 'What’s happening on the trail?') : 'Your people are around the fire.'}</Text><Pressable onPress={() => session ? router.push('/(tabs)/community') : promptForAccount('Campfire')} accessibilityRole="button"><Text style={styles.linkBare}>{session ? 'View Campfire →' : 'Sign in to join →'}</Text></Pressable></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1713' },
  content: { paddingHorizontal: 18, paddingTop: 52, paddingBottom: 48, gap: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topActions: { flexDirection: 'row', gap: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#405047', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF8E8', fontSize: 35, lineHeight: 39, fontWeight: '900' },
  loader: { margin: 18 },
  error: { color: '#FFB4A9' },
  section: { gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900', flexShrink: 1 },
  count: { color: '#95A39A', fontSize: 12, fontWeight: '700' },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 8 },
  linkBare: { color: '#D7B45A', fontWeight: '900' },
  compactRow: { gap: 10, paddingRight: 12 },
  compactCard: { width: COMPACT_CARD_WIDTH },
  compactImage: { height: 156, justifyContent: 'flex-end', borderRadius: 18, overflow: 'hidden', backgroundColor: '#26372D' },
  compactRadius: { borderRadius: 18 },
  compactShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,10,8,0.34)' },
  compactBody: { padding: 12, gap: 4 },
  compactEyebrow: { color: '#F0D083', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  compactTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 18, fontWeight: '900' },
  compactMeta: { color: '#D7DFDA', fontSize: 11, fontWeight: '700' },
  wideRow: { gap: 12, paddingRight: 18 },
  wideCard: { width: WIDE_CARD_WIDTH },
  wideImage: { height: 198, justifyContent: 'flex-end', borderRadius: 22, overflow: 'hidden', backgroundColor: '#26372D' },
  wideRadius: { borderRadius: 22 },
  wideShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,10,8,0.46)' },
  wideBody: { padding: 16, gap: 6 },
  wideTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  wideLabel: { color: '#142019', backgroundColor: '#9BD264', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  wideCountdown: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' },
  wideTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  wideMeta: { color: '#D8E0DB', fontSize: 12, fontWeight: '700' },
  wideFooter: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reservedPill: { color: '#B9E78B', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  wideLink: { color: '#F0D083', fontSize: 12, fontWeight: '900' },
  emptyAdventureCard: { minHeight: 150, borderRadius: 22, borderWidth: 1, borderColor: '#34463C', backgroundColor: '#17211C', padding: 18, justifyContent: 'center' },
  emptyAdventureTitle: { color: '#FFF8E8', fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 7 },
  emptyAdventureText: { color: '#AFC0B6', fontSize: 12, lineHeight: 17, marginTop: 5 },
  utilityEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  campfireCard: { borderRadius: 24, padding: 18, backgroundColor: '#1B2A22', borderWidth: 1, borderColor: '#3D5146', gap: 13 },
  campfireTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  campfireHeading: { flex: 1 },
  campfireTitle: { color: '#FFF8E8', fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 4 },
  campfireBadge: { borderRadius: 999, backgroundColor: '#263A30', paddingHorizontal: 10, paddingVertical: 6 },
  campfireBadgeText: { color: '#D8E2DC', fontSize: 11, fontWeight: '800' },
  campfireSwitch: { alignSelf: 'flex-start', flexDirection: 'row', backgroundColor: '#132019', borderRadius: 999, padding: 3, gap: 2, borderWidth: 1, borderColor: '#31443A' },
  campfireSwitchButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  campfireSwitchActive: { backgroundColor: '#D7B45A' },
  campfireSwitchText: { color: '#AFC0B6', fontSize: 12, fontWeight: '800' },
  campfireSwitchTextActive: { color: '#17211C' },
  campfireFeed: { gap: 2 },
  campfirePost: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#314238' },
  campfirePostPressed: { opacity: 0.72 },
  campfireAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' },
  campfireAvatarImage: { width: '100%', height: '100%' },
  campfireAvatarText: { color: '#F0D083', fontSize: 11, fontWeight: '900' },
  campfirePostBody: { flex: 1, gap: 3 },
  campfireAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  campfireAuthor: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', flexShrink: 1 },
  campfireTime: { color: '#87968D', fontSize: 10, fontWeight: '700' },
  campfirePostContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  campfirePostCopy: { flex: 1, gap: 2 },
  campfirePostText: { color: '#C8D1CC', fontSize: 12, lineHeight: 17 },
  campfireEngagement: { color: '#829087', fontSize: 10, marginTop: 2 },
  campfireMediaThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#26372D' },
  campfireEmpty: { borderTopWidth: 1, borderTopColor: '#314238', paddingVertical: 14, gap: 4 },
  campfireEmptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  campfireEmptyText: { color: '#9FAAA4', fontSize: 12, lineHeight: 17 },
  campfireFooter: { borderTopWidth: 1, borderTopColor: '#34463C', paddingTop: 12, gap: 6 },
  campfirePrompt: { color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
});
