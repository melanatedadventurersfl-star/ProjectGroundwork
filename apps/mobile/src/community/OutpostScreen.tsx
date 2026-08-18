import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createPost,
  getCommunityFeed,
  getGroups,
  joinGroup,
  removeCommunityPostImage,
  uploadCommunityPostImage,
  type CommunityGroup,
  type CommunityPost,
  type CommunityPostType,
} from './api';
import { PostEngagementBar } from './PostEngagementBar';
import { PostOptionsButton } from './PostOptionsButton';
import { getCircles, searchCommunityMembers, type CommunityCircle, type CommunityPerson } from './circles';
import { getMemberBasecamp } from '../member/api';
import { listLocalEvents, type LocalEvent } from '../local-events/api';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const BORDER = '#28362E';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';

type OutpostTab = 'for-you' | 'crew' | 'nearby' | 'groups' | 'campfires';
type PickedPhoto = { uri: string; mimeType?: string | null };

const tabs: { value: OutpostTab; label: string }[] = [
  { value: 'for-you', label: 'For You' },
  { value: 'crew', label: 'Crew' },
  { value: 'nearby', label: 'Nearby' },
  { value: 'groups', label: 'Groups' },
  { value: 'campfires', label: 'Campfires' },
];

const postTypes: { value: CommunityPostType; label: string; icon: string }[] = [
  { value: 'update', label: 'Update', icon: 'create-outline' },
  { value: 'ask', label: 'Ask', icon: 'help-circle-outline' },
  { value: 'buddy', label: 'Adventure Buddy', icon: 'people-outline' },
  { value: 'recommendation', label: 'Recommend', icon: 'location-outline' },
  { value: 'meetup', label: 'Campfire', icon: 'bonfire-outline' },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PostCard({ post }: { post: CommunityPost }) {
  const badge = post.post_type === 'ask'
    ? 'ASK'
    : post.post_type === 'buddy'
      ? 'ADVENTURE BUDDY'
      : post.post_type === 'recommendation'
        ? 'PLACE'
        : post.post_type === 'meetup'
          ? 'CAMPFIRE'
          : null;

  return (
    <Pressable style={({ pressed }) => [styles.postCard, pressed && styles.pressed]} onPress={() => router.push(`/community/${post.id}`)}>
      <View style={styles.postHeader}>
        <Pressable
          style={styles.authorTarget}
          onPress={(event) => {
            event.stopPropagation();
            router.push({ pathname: '/community-profile/[id]', params: { id: post.author_id } });
          }}
        >
          <View style={styles.avatar}>
            {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(post.author_name)}</Text>}
          </View>
          <View style={styles.flex}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <Text style={styles.postMeta}>{relativeTime(post.created_at)}</Text>
          </View>
        </Pressable>
        <View style={styles.postHeaderActions}>
          {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
          <PostOptionsButton postId={post.id} />
        </View>
      </View>
      {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" /> : null}
      {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
      <PostEngagementBar
        postId={post.id}
        initialReactionCount={post.reaction_count || 0}
        commentCount={post.comment_count || 0}
      />
    </Pressable>
  );
}

function GroupRow({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      <View style={styles.groupAvatar}>{group.image_url ? <Image source={{ uri: group.image_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(group.name)}</Text>}</View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{group.name}</Text>
        <Text style={styles.rowMeta}>{group.is_member ? `${group.member_count} member${group.member_count === 1 ? '' : 's'}` : joining ? 'Joining…' : `${group.member_count} members · Tap to join`}</Text>
      </View>
      <Ionicons name={group.is_member ? 'chevron-forward' : 'add-circle-outline'} size={20} color={group.is_member ? MUTED : GOLD} />
    </Pressable>
  );
}

function CrewRow({ crew }: { crew: CommunityCircle }) {
  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/circles/[id]', params: { id: crew.id } })}>
      <View style={styles.crewAvatar}><Ionicons name="people" size={19} color={GOLD} /></View>
      <View style={styles.flex}><Text style={styles.rowTitle}>{crew.name}</Text><Text style={styles.rowMeta}>{crew.member_count} {crew.member_count === 1 ? 'Trailmate' : 'Trailmates'}</Text></View>
      <Ionicons name="chevron-forward" size={20} color={MUTED} />
    </Pressable>
  );
}

function PersonChip({ person }: { person: CommunityPerson }) {
  return (
    <Pressable style={({ pressed }) => [styles.personChip, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.id } })}>
      <View style={styles.personAvatar}>{person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(person.display_name)}</Text>}</View>
      <Text style={styles.personName} numberOfLines={1}>{person.display_name.split(' ')[0]}</Text>
    </Pressable>
  );
}

function CampfireCard({ event }: { event: LocalEvent }) {
  const start = new Date(event.starts_at);
  return (
    <Pressable style={({ pressed }) => [styles.campfireCard, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      <View style={styles.campfireIcon}><Ionicons name="bonfire-outline" size={21} color={GOLD} /></View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{event.title}</Text>
        <Text style={styles.rowMeta}>{start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={styles.rowMeta}>{event.venue_name ? `${event.venue_name} · ` : ''}{event.city}, {event.state}</Text>
        <Text style={styles.campfireHost}>Hosted by {event.host_name}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={MUTED} />
    </Pressable>
  );
}

export default function OutpostScreen() {
  const [tab, setTab] = useState<OutpostTab>('for-you');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [crews, setCrews] = useState<CommunityCircle[]>([]);
  const [members, setMembers] = useState<CommunityPerson[]>([]);
  const [campfires, setCampfires] = useState<LocalEvent[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerBody, setComposerBody] = useState('');
  const [composerType, setComposerType] = useState<CommunityPostType>('update');
  const [composerPhoto, setComposerPhoto] = useState<PickedPhoto | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextPosts, nextGroups, nextCrews, nextMembers, nextCampfires, basecamp] = await Promise.all([
        getCommunityFeed(),
        getGroups(),
        getCircles(),
        searchCommunityMembers('').catch(() => []),
        listLocalEvents().catch(() => []),
        getMemberBasecamp(),
      ]);
      setPosts(nextPosts);
      setGroups(nextGroups);
      setCrews(nextCrews);
      setMembers(nextMembers);
      setCampfires(nextCampfires);
      setHomeCity(basecamp.profile?.home_city ?? null);
      setHomeState(basecamp.profile?.home_state ?? null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Outpost.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const locationLabel = homeCity && homeState ? `${homeCity}, ${homeState}` : homeCity || homeState || 'Your area';
  const nearbyPeople = useMemo(() => members.filter((person) => homeState && person.home_state === homeState && (!homeCity || !person.home_city || person.home_city === homeCity)), [members, homeCity, homeState]);
  const nearbyIds = useMemo(() => new Set(nearbyPeople.map((person) => person.id)), [nearbyPeople]);
  const nearbyPosts = useMemo(() => posts.filter((post) => nearbyIds.has(post.author_id)).slice(0, 8), [posts, nearbyIds]);
  const nearbyGroups = useMemo(() => groups.filter((group) => homeState && group.state === homeState && (!homeCity || !group.city || group.city === homeCity)), [groups, homeCity, homeState]);
  const nearbyCampfires = useMemo(() => campfires.filter((event) => homeState && event.state === homeState && (!homeCity || event.city === homeCity)).slice(0, 4), [campfires, homeCity, homeState]);
  const selectedType = postTypes.find((item) => item.value === composerType) ?? postTypes[0]!;

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library access is needed to upload a photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.88 });
    if (!result.canceled && result.assets?.[0]) setComposerPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
  }

  async function submitPost() {
    if (composerType === 'meetup') { router.push('/local-events/create'); return; }
    if ((!composerBody.trim() && !composerPhoto) || submitting) return;
    setSubmitting(true);
    setError(null);
    let uploadedPath: string | null = null;
    try {
      if (composerPhoto) uploadedPath = await uploadCommunityPostImage(composerPhoto);
      await createPost({ body: composerBody, postType: composerType, audience: 'everyone', circleId: null, groupId: null, adventureId: null, imagePath: uploadedPath, metadata: {} });
      setComposerBody('');
      setComposerPhoto(null);
      setComposerType('update');
      setTypeOpen(false);
      await load();
    } catch (caught) {
      if (uploadedPath) await removeCommunityPostImage(uploadedPath).catch(() => undefined);
      setError(caught instanceof Error ? caught.message : 'Unable to publish this post.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(group: CommunityGroup) {
    setJoiningId(group.id);
    try { await joinGroup(group.id); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to join this group.'); } finally { setJoiningId(null); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={GOLD} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.title}>Outpost</Text>
            <View style={styles.locationRow}><Ionicons name="location-outline" size={14} color={MUTED} /><Text style={styles.subtitle}>{locationLabel}</Text></View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/notifications')}><Ionicons name="notifications-outline" size={23} color={TEXT} /></Pressable>
            <Pressable style={styles.profileButton} onPress={() => router.push('/member/profile')}><Ionicons name="person" size={17} color={TEXT} /></Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((item) => <Pressable key={item.value} style={[styles.tab, tab === item.value && styles.tabActive]} onPress={() => setTab(item.value)}><Text style={[styles.tabText, tab === item.value && styles.tabTextActive]}>{item.label}</Text></Pressable>)}
        </ScrollView>

        {loading ? <ActivityIndicator color={GOLD} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'for-you' ? <>
          <View style={styles.composer}>
            {composerPhoto ? <View style={styles.photoWrap}><Image source={{ uri: composerPhoto.uri }} style={styles.composerPhoto} /><Pressable style={styles.removePhoto} onPress={() => setComposerPhoto(null)}><Ionicons name="close" size={18} color={TEXT} /></Pressable></View> : null}
            <TextInput value={composerBody} onChangeText={setComposerBody} placeholder={composerType === 'ask' ? 'What do you want to ask everyone?' : composerType === 'buddy' ? 'What do you want to do, where, and when?' : 'What’s happening outside?'} placeholderTextColor="#7F8B83" multiline maxLength={4000} style={styles.composerInput} />
            <View style={styles.composerActions}>
              <Pressable style={styles.actionButton} onPress={() => void choosePhoto()}><Ionicons name="image-outline" size={18} color={GOLD} /><Text style={styles.actionText}>Photo</Text></Pressable>
              <Pressable style={styles.actionButton} onPress={() => setTypeOpen((value) => !value)}><Ionicons name={selectedType.icon as never} size={18} color={GOLD} /><Text style={styles.actionText}>{selectedType.label}</Text><Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={14} color={MUTED} /></Pressable>
              <Pressable disabled={submitting || (composerType !== 'meetup' && !composerBody.trim() && !composerPhoto)} style={[styles.postButton, submitting && styles.disabled]} onPress={() => void submitPost()}><Text style={styles.postButtonText}>{composerType === 'meetup' ? 'Set up' : submitting ? 'Posting…' : 'Post'}</Text></Pressable>
            </View>
            {typeOpen ? <View style={styles.typeMenu}>{postTypes.map((item) => <Pressable key={item.value} style={styles.typeRow} onPress={() => { setComposerType(item.value); setTypeOpen(false); }}><Ionicons name={item.icon as never} size={18} color={item.value === composerType ? GOLD : MUTED} /><Text style={[styles.typeText, item.value === composerType && styles.typeTextActive]}>{item.label}</Text></Pressable>)}</View> : null}
          </View>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>For You</Text><Text style={styles.sectionCopy}>Posts, questions, people, and ideas from across the Outpost.</Text></View>
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
          {!posts.length && !loading ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Start the conversation</Text><Text style={styles.emptyText}>Share what you’re doing outside.</Text></View> : null}
        </> : null}

        {tab === 'crew' ? <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}><View style={styles.flex}><Text style={styles.sectionTitle}>Your Crew</Text><Text style={styles.sectionCopy}>The Trailmates you adventure with most.</Text></View><Pressable onPress={() => router.push('/circles')}><Text style={styles.link}>Manage</Text></Pressable></View>
          <View style={styles.list}>{crews.map((crew) => <CrewRow key={crew.id} crew={crew} />)}{!crews.length ? <Text style={styles.emptyText}>Create a Crew to organize your Trailmates.</Text> : null}</View>
        </View> : null}

        {tab === 'nearby' ? <>
          <View style={styles.nearbyHero}><View style={styles.nearbyIcon}><Ionicons name="navigate" size={22} color="#101510" /></View><View style={styles.flex}><Text style={styles.eyebrow}>AROUND YOU</Text><Text style={styles.nearbyTitle}>Near {locationLabel}</Text><Text style={styles.sectionCopy}>{nearbyPeople.length} adventurer{nearbyPeople.length === 1 ? '' : 's'} · {nearbyGroups.length} group{nearbyGroups.length === 1 ? '' : 's'} · {nearbyCampfires.length} Campfire{nearbyCampfires.length === 1 ? '' : 's'}</Text></View></View>
          {nearbyPeople.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>{nearbyPeople.slice(0, 12).map((person) => <PersonChip key={person.id} person={person} />)}</ScrollView> : null}
          {nearbyCampfires.length ? <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Campfires Nearby</Text>{nearbyCampfires.map((event) => <CampfireCard key={event.id} event={event} />)}</View> : null}
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Local Posts</Text><Text style={styles.sectionCopy}>What adventurers around you are sharing.</Text></View>
          {nearbyPosts.map((post) => <PostCard key={post.id} post={post} />)}
          {!nearbyPosts.length && !loading ? <Text style={styles.emptyText}>Local activity will show here as the Outpost grows.</Text> : null}
        </> : null}

        {tab === 'groups' ? <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Groups</Text><Text style={styles.sectionCopy}>Ongoing communities built around shared interests and adventures.</Text><View style={styles.list}>{groups.map((group) => <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}{!groups.length ? <Text style={styles.emptyText}>No groups yet.</Text> : null}</View></View> : null}

        {tab === 'campfires' ? <>
          <View style={styles.campfireHero}><View style={styles.campfireHeroIcon}><Ionicons name="bonfire-outline" size={26} color={GOLD} /></View><View style={styles.flex}><Text style={styles.sectionTitle}>Campfires</Text><Text style={styles.sectionCopy}>Casual member-led meetups. Hikes, paddles, park hangs, brewery stops, trail walks, and whatever else gets people together.</Text></View></View>
          <Pressable style={styles.startCampfireButton} onPress={() => router.push('/local-events/create')}><Ionicons name="add-circle-outline" size={19} color="#101510" /><Text style={styles.startCampfireText}>Start a Campfire</Text></Pressable>
          {campfires.map((event) => <CampfireCard key={event.id} event={event} />)}
          {!campfires.length && !loading ? <View style={styles.emptyCard}><Ionicons name="bonfire-outline" size={28} color={GOLD} /><Text style={styles.emptyTitle}>No Campfires yet</Text><Text style={styles.emptyText}>Start one and give people a reason to get outside.</Text></View> : null}
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 52, gap: 12 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  title: { color: TEXT, fontSize: 32, lineHeight: 36, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  subtitle: { color: MUTED, fontSize: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  profileButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  tabs: { gap: 7, paddingVertical: 2 },
  tab: { minHeight: 38, minWidth: 72, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#18211D' },
  tabActive: { backgroundColor: '#2A2D28', borderWidth: 1, borderColor: '#4A493C' },
  tabText: { color: '#A4ADA7', fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: GOLD },
  loader: { marginVertical: 4 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 12 },
  composer: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 11, gap: 9 },
  composerInput: { minHeight: 74, maxHeight: 170, color: TEXT, fontSize: 15, lineHeight: 21, paddingHorizontal: 3, paddingVertical: 5, textAlignVertical: 'top' },
  photoWrap: { position: 'relative' },
  composerPhoto: { width: '100%', height: 180, borderRadius: 13, backgroundColor: '#101813' },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(15,23,19,0.88)', alignItems: 'center', justifyContent: 'center' },
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#37443C', paddingTop: 9 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 9, borderWidth: 1, borderColor: '#34423A', borderRadius: 11 },
  actionText: { color: '#D8DED9', fontSize: 11.5, fontWeight: '800' },
  postButton: { marginLeft: 'auto', minHeight: 38, paddingHorizontal: 15, borderRadius: 11, backgroundColor: GOLD, justifyContent: 'center' },
  postButtonText: { color: '#101510', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.45 },
  typeMenu: { borderWidth: 1, borderColor: '#38473E', borderRadius: 12, overflow: 'hidden', backgroundColor: '#121C17' },
  typeRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344239' },
  typeText: { color: '#CED6D0', fontSize: 12.5, fontWeight: '700' },
  typeTextActive: { color: GOLD },
  sectionHeading: { gap: 2, paddingTop: 3 },
  sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '900' },
  sectionCopy: { color: '#8F9B93', fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  sectionCard: { backgroundColor: CARD, borderRadius: 17, padding: 12, gap: 11 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { color: GOLD, fontSize: 12, fontWeight: '900' },
  postCard: { paddingHorizontal: 2, paddingVertical: 11, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26332C' },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  postHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorTarget: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 41, height: 41, borderRadius: 21, borderWidth: 1, borderColor: '#738078', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: TEXT, fontWeight: '900', fontSize: 11 },
  authorName: { color: TEXT, fontSize: 15.5, fontWeight: '900' },
  postMeta: { color: '#8F9B93', fontSize: 11.5, marginTop: 2 },
  badge: { backgroundColor: '#1D2B24', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: '#D6C28D', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  postImage: { width: '100%', height: 230, borderRadius: 14, backgroundColor: '#101813' },
  postBody: { color: '#E0E5E1', fontSize: 13.5, lineHeight: 20 },
  list: { borderWidth: 1, borderColor: '#334139', borderRadius: 14, overflow: 'hidden' },
  listRow: { minHeight: 62, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#37443D' },
  groupAvatar: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#213229', borderWidth: 1, borderColor: '#47554C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  crewAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#213229', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: TEXT, fontSize: 14, fontWeight: '900' },
  rowMeta: { color: MUTED, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  personChip: { width: 66, alignItems: 'center', gap: 5 },
  personAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#213229', borderWidth: 1, borderColor: '#536158', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  personName: { color: '#DDE4DF', fontSize: 11, fontWeight: '800', maxWidth: 64 },
  peopleRow: { gap: 10, paddingVertical: 2 },
  nearbyHero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#17251E', borderWidth: 1, borderColor: '#304239', borderRadius: 17, padding: 14 },
  nearbyIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: GOLD, fontSize: 9.5, letterSpacing: 1.1, fontWeight: '900' },
  nearbyTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 1 },
  campfireHero: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#171F1B', borderWidth: 1, borderColor: '#3B423B', borderRadius: 17, padding: 14 },
  campfireHeroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#25281F', alignItems: 'center', justifyContent: 'center' },
  startCampfireButton: { minHeight: 46, borderRadius: 14, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  startCampfireText: { color: '#101510', fontSize: 13, fontWeight: '900' },
  campfireCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 15, padding: 12 },
  campfireIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#25281F', alignItems: 'center', justifyContent: 'center' },
  campfireHost: { color: GOLD, fontSize: 10.5, fontWeight: '700', marginTop: 4 },
  emptyCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 22, alignItems: 'center', gap: 6 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '900' },
  emptyText: { color: MUTED, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});