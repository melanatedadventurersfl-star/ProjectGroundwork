import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCommunityFeed, getGroups, joinGroup, type CommunityGroup, type CommunityPost } from '../../src/community/api';
import { getMemberBasecamp } from '../../src/member/api';

type CommunityTab = 'for-you' | 'nearby' | 'groups';

const GOLD = '#D7B45A';
const GOLD_MUTED = '#B79B58';
const BG = '#0F1713';
const CARD = '#17211C';
const CARD_ALT = '#1B2A22';
const BORDER = '#28362E';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function postTypeLabel(post: CommunityPost) {
  if (post.post_type === 'ask') return 'ASK';
  if (post.post_type === 'buddy') return 'ADVENTURE BUDDY';
  if (post.post_type === 'recommendation') return 'PLACE RECOMMENDATION';
  if (post.post_type === 'photo') return 'PHOTO';
  if (post.post_type === 'meetup') return 'MEETUP';
  return null;
}

function audienceIcon(post: CommunityPost) {
  if (post.audience === 'connections') return 'people-outline';
  if (post.audience === 'circle') return 'people-circle-outline';
  if (post.audience === 'group') return 'albums-outline';
  return 'globe-outline';
}

function GroupRow({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const isMember = group.is_member;
  return (
    <Pressable
      style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
      onPress={() => {
        if (isMember) router.push({ pathname: '/groups/[id]', params: { id: group.id } });
        else onJoin(group);
      }}
    >
      <View style={styles.groupAvatar}><Text style={styles.groupAvatarText}>{group.name.slice(0, 2).toUpperCase()}</Text></View>
      <View style={styles.groupCopy}>
        <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
        <Text style={styles.groupMeta} numberOfLines={1}>
          {isMember ? `${group.member_count} member${group.member_count === 1 ? '' : 's'}` : joining ? 'Joining…' : `${group.member_count} members · Tap to join`}
        </Text>
      </View>
      <Ionicons name={isMember ? 'chevron-forward' : 'add-circle-outline'} size={22} color={isMember ? MUTED : GOLD} />
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name={icon as never} size={18} color={GOLD_MUTED} />
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

function CircleGateway({ compact = false }: { compact?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.circleGateway, compact && styles.circleGatewayCompact, pressed && styles.pressed]} onPress={() => router.push('/circles')}>
      <View style={styles.circleGatewayIcon}><Ionicons name="people-circle-outline" size={27} color={GOLD} /></View>
      <View style={styles.groupCopy}>
        <Text style={styles.circleGatewayTitle}>Circles & Connections</Text>
        <Text style={styles.circleGatewayCopy} numberOfLines={compact ? 1 : 2}>Organize your people into private crews for invites, sharing, and adventures.</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={MUTED} />
    </Pressable>
  );
}

function CommunityPostCard({ post }: { post: CommunityPost }) {
  const badge = postTypeLabel(post);
  return (
    <Pressable style={({ pressed }) => [styles.feedCard, pressed && styles.pressed]} onPress={() => router.push(`/community/${post.id}`)}>
      <View style={styles.feedHeader}>
        <View style={styles.feedAvatar}><Text style={styles.feedAvatarText}>{post.author_name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.feedHeaderCopy}>
          <View style={styles.authorLine}>
            <Text style={styles.feedName} numberOfLines={1}>{post.author_name}</Text>
            <Ionicons name={audienceIcon(post) as never} size={13} color={MUTED} />
          </View>
          <Text style={styles.feedMeta}>{relativeTime(post.created_at)} ago</Text>
        </View>
        {badge ? <View style={styles.postTypeBadge}><Text style={styles.postTypeBadgeText}>{badge}</Text></View> : null}
      </View>
      {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" /> : null}
      <Text style={styles.feedBody}>{post.body}</Text>
      <View style={styles.engagementRow}>
        <View style={styles.engagementLeft}>
          <Ionicons name="heart-outline" size={18} color={GOLD_MUTED} />
          <Text style={styles.engagementText}>{post.reaction_count || 0}</Text>
          <Ionicons name="chatbubble-outline" size={17} color={MUTED} />
          <Text style={styles.engagementText}>{post.comment_count || 0}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={MUTED} />
      </View>
    </Pressable>
  );
}

function NearbyEventCard({ location }: { location: string }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Happening near you</Text>
        <Pressable><Text style={styles.link}>View all</Text></Pressable>
      </View>
      <View style={styles.eventRow}>
        <View style={styles.eventThumb}><Ionicons name="boat-outline" size={36} color={TEXT} /></View>
        <View style={styles.eventCopy}>
          <Text style={styles.eventTitle}>Sunrise Paddle on The St. Johns</Text>
          <View style={styles.metaLine}><Ionicons name="calendar-outline" size={15} color={MUTED} /><Text style={styles.metaLineText}>Sat, May 17 · 8:00 AM</Text></View>
          <View style={styles.metaLine}><Ionicons name="location-outline" size={15} color={MUTED} /><Text style={styles.metaLineText}>{location}</Text></View>
        </View>
      </View>
      <Pressable style={styles.fullButton} onPress={() => router.push({ pathname: '/community/create', params: { type: 'meetup' } })}>
        <Text style={styles.primaryButtonText}>Plan a meetup</Text>
      </Pressable>
    </View>
  );
}

export default function CommunityScreen() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CommunityTab>('for-you');

  const load = useCallback(async () => {
    try {
      const [nextGroups, nextPosts, basecamp] = await Promise.all([getGroups(), getCommunityFeed(), getMemberBasecamp()]);
      setGroups(nextGroups);
      setPosts(nextPosts);
      setHomeCity(basecamp.profile?.home_city ?? null);
      setHomeState(basecamp.profile?.home_state ?? null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Community.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const yourGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const nearbyGroups = useMemo(
    () => groups.filter((group) => group.state && group.state === homeState && (!homeCity || !group.city || group.city === homeCity)),
    [groups, homeCity, homeState],
  );
  const locationLabel = homeCity && homeState ? `${homeCity}, ${homeState}` : 'Your area';
  const nearbyCount = nearbyGroups.reduce((total, group) => total + group.member_count, 0);

  async function handleJoin(group: CommunityGroup) {
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to join this group.');
    } finally {
      setJoiningId(null);
    }
  }

  const visibleGroupList = tab === 'nearby' ? nearbyGroups : groups;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={GOLD} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Community</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={MUTED} />
              <Text style={styles.subtitle}>{locationLabel} · {yourGroups.length} groups{nearbyCount ? ` · ${nearbyCount} adventurers nearby` : ''}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/notifications')}><Ionicons name="notifications-outline" size={23} color={TEXT} /></Pressable>
            <Pressable style={styles.profileButton} onPress={() => router.push('/member/profile')}><Ionicons name="person" size={17} color={TEXT} /></Pressable>
          </View>
        </View>

        <View style={styles.tabs}>
          {([['for-you', 'For You'], ['nearby', 'Nearby'], ['groups', 'Groups']] as const).map(([value, label]) => (
            <Pressable key={value} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}>
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? <ActivityIndicator color={GOLD} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'for-you' ? (
          <>
            <View style={styles.composer}>
              <Pressable style={({ pressed }) => [styles.composerPromptRow, pressed && styles.pressed]} onPress={() => router.push('/community/create')}>
                <View style={styles.memberAvatar}><Ionicons name="person" size={18} color={TEXT} /></View>
                <Text style={styles.composerPrompt}>What’s happening outside?</Text>
                <Ionicons name="chevron-forward" size={18} color={MUTED} />
              </Pressable>
              <View style={styles.quickActionsRow}>
                <QuickAction icon="images-outline" label="Photo" onPress={() => router.push({ pathname: '/community/create', params: { type: 'photo' } })} />
                <QuickAction icon="calendar-outline" label="Meetup" onPress={() => router.push({ pathname: '/community/create', params: { type: 'meetup' } })} />
                <QuickAction icon="help-circle-outline" label="Ask" onPress={() => router.push({ pathname: '/community/create', params: { type: 'ask' } })} />
              </View>
            </View>

            <View style={styles.feedSectionHeader}>
              <Text style={styles.feedSectionLabel}>From your community</Text>
              <Text style={styles.feedSectionHint}>Posts you’re allowed to see from Community, Connections, Circles, and Groups</Text>
            </View>

            {posts.map((post) => <CommunityPostCard key={post.id} post={post} />)}
            {!posts.length && !loading ? (
              <Pressable style={styles.emptyFeed} onPress={() => router.push('/community/create')}>
                <Ionicons name="create-outline" size={24} color={GOLD} />
                <Text style={styles.emptyFeedTitle}>Start the conversation</Text>
                <Text style={styles.emptyFeedText}>Share an update, ask a question, post a photo, or find your next adventure buddy.</Text>
              </Pressable>
            ) : null}

            <NearbyEventCard location={locationLabel} />
            <CircleGateway />

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>Your Communities</Text>
                <Pressable onPress={() => setTab('groups')}><Text style={styles.link}>Manage</Text></Pressable>
              </View>
              <View style={styles.groupList}>
                {yourGroups.slice(0, 3).map((group) => <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
                {!yourGroups.length && !loading ? <Text style={styles.emptyText}>Join a few communities and they’ll live here.</Text> : null}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionHeading}>{tab === 'nearby' ? 'Near You' : 'People & Groups'}</Text>
                <Text style={styles.sectionSubheading}>{tab === 'nearby' ? `Communities around ${locationLabel}.` : 'Your private circles and shared adventure communities.'}</Text>
              </View>
              {tab === 'nearby' ? <Ionicons name="navigate-outline" size={22} color={GOLD_MUTED} /> : <Ionicons name="people-outline" size={22} color={GOLD_MUTED} />}
            </View>
            {tab === 'groups' ? <CircleGateway compact /> : null}
            <View style={styles.groupList}>
              {visibleGroupList.map((group) => <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
              {!visibleGroupList.length && !loading ? <Text style={styles.emptyText}>Nothing here yet. Pull to refresh or check back as the community grows.</Text> : null}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 42, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  headerCopy: { flex: 1 },
  title: { color: TEXT, fontSize: 32, lineHeight: 36, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  subtitle: { flex: 1, color: MUTED, fontSize: 12, lineHeight: 17 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  profileButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD, backgroundColor: CARD_ALT, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#18211D', borderRadius: 14, padding: 3 },
  tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: '#2A2D28' },
  tabText: { color: '#A4ADA7', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: GOLD },
  loader: { marginVertical: 3 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 12 },
  composer: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 10, gap: 8 },
  composerPromptRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 2 },
  memberAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#294236' },
  composerPrompt: { flex: 1, color: '#E4E8E5', fontSize: 15.5, fontWeight: '600' },
  quickActionsRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#37443C', paddingTop: 7 },
  quickAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, gap: 3 },
  quickActionText: { color: '#D8DED9', fontSize: 10.5, textAlign: 'center', fontWeight: '700' },
  feedSectionHeader: { paddingHorizontal: 2, paddingTop: 2, gap: 1 },
  feedSectionLabel: { color: TEXT, fontSize: 15, fontWeight: '900' },
  feedSectionHint: { color: '#7F8B83', fontSize: 11.5, lineHeight: 16 },
  feedCard: { backgroundColor: 'transparent', paddingHorizontal: 2, paddingVertical: 9, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26332C' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  feedAvatar: { width: 41, height: 41, borderRadius: 21, borderWidth: 1, borderColor: '#738078', alignItems: 'center', justifyContent: 'center' },
  feedAvatarText: { color: TEXT, fontWeight: '900', fontSize: 15 },
  feedHeaderCopy: { flex: 1 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  feedName: { color: TEXT, fontSize: 15.5, fontWeight: '900', maxWidth: '88%' },
  feedMeta: { color: '#8F9B93', fontSize: 11.5, marginTop: 2 },
  postTypeBadge: { backgroundColor: '#1D2B24', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 },
  postTypeBadgeText: { color: '#D6C28D', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  postImage: { width: '100%', height: 230, borderRadius: 14, backgroundColor: '#101813' },
  feedBody: { color: '#E0E5E1', fontSize: 13.5, lineHeight: 19 },
  engagementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  engagementLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  engagementText: { color: MUTED, fontSize: 12, marginRight: 5 },
  emptyFeed: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 18, alignItems: 'center', gap: 6 },
  emptyFeedTitle: { color: TEXT, fontWeight: '900', fontSize: 16 },
  emptyFeedText: { color: MUTED, textAlign: 'center', lineHeight: 18, fontSize: 12 },
  primaryButtonText: { color: '#101510', fontWeight: '900' },
  sectionCard: { backgroundColor: CARD, borderRadius: 17, padding: 12, gap: 11 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionHeading: { color: TEXT, fontSize: 17.5, fontWeight: '900' },
  sectionSubheading: { color: '#8F9B93', fontSize: 12, marginTop: 2 },
  link: { color: GOLD_MUTED, fontWeight: '800' },
  circleGateway: { minHeight: 78, backgroundColor: CARD, borderWidth: 1, borderColor: '#3A463E', borderRadius: 17, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  circleGatewayCompact: { minHeight: 66, borderRadius: 14, backgroundColor: '#1A251F' },
  circleGatewayIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#89764A', backgroundColor: '#1C2A23', alignItems: 'center', justifyContent: 'center' },
  circleGatewayTitle: { color: TEXT, fontSize: 14.5, fontWeight: '900' },
  circleGatewayCopy: { color: '#98A49C', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  eventRow: { flexDirection: 'row', gap: 11 },
  eventThumb: { width: 104, minHeight: 96, borderRadius: 14, backgroundColor: '#294A3A', alignItems: 'center', justifyContent: 'center' },
  eventCopy: { flex: 1, gap: 5 },
  eventTitle: { color: TEXT, fontWeight: '900', fontSize: 14.5 },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaLineText: { flex: 1, color: MUTED, fontSize: 11, lineHeight: 15 },
  fullButton: { backgroundColor: GOLD, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  groupList: { borderWidth: 1, borderColor: '#334139', borderRadius: 14, overflow: 'hidden' },
  groupRow: { minHeight: 62, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#37443D' },
  groupAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#4A594F', backgroundColor: '#1D3026', alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { color: TEXT, fontWeight: '900', fontSize: 11.5 },
  groupCopy: { flex: 1 },
  groupName: { color: TEXT, fontWeight: '800', fontSize: 13.5 },
  groupMeta: { color: '#8F9B93', fontSize: 11, marginTop: 2 },
  emptyText: { color: '#8F9B93', padding: 14, lineHeight: 19 },
  pressed: { opacity: 0.72 },
});
