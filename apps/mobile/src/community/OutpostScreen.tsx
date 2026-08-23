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
import { getConnections, searchCommunityMembers, type Connection } from './circles';
import { getCommunityManagementTypes, type CommunityManagementType } from './communityManagement';
import { getMemberBasecamp } from '../member/api';
import { listLocalEvents, type LocalEvent } from '../local-events/api';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const BORDER = '#28362E';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const OFFICIAL_STARTERS = new Set(['camping', 'hiking', 'water adventures', 'family adventures', 'beginner outdoors']);

type OutpostTab = 'for-you' | 'groups' | 'campfires';
type PickedPhoto = { uri: string; mimeType?: string | null };
type DiscoverFilter = 'recommended' | 'near' | 'regional' | 'state' | 'popular' | 'beginner';

const tabs: { value: OutpostTab; label: string }[] = [
  { value: 'for-you', label: 'Basecamp' },
  { value: 'groups', label: 'Communities' },
  { value: 'campfires', label: 'Campfires' },
];

const discoverFilters: { value: DiscoverFilter; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'near', label: 'Near Me' },
  { value: 'regional', label: 'Regional' },
  { value: 'state', label: 'In State' },
  { value: 'popular', label: 'Popular' },
  { value: 'beginner', label: 'Beginner' },
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
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CommunityTypeBadge({ type, compact = false }: { type: CommunityManagementType; compact?: boolean }) {
  const official = type === 'official';
  return (
    <View style={[styles.managementBadge, compact && styles.managementBadgeCompact]}>
      <Ionicons name={official ? 'shield-checkmark-outline' : 'people-outline'} size={compact ? 11 : 12} color={official ? GOLD : MUTED} />
      <Text style={[styles.managementText, official && styles.managementTextOfficial, compact && styles.managementTextCompact]}>
        {official ? 'Official' : 'Member-led'}
      </Text>
    </View>
  );
}

function PostCard({ post, reason }: { post: CommunityPost; reason?: string | null }) {
  const badge = post.post_type === 'ask'
    ? 'Ask'
    : post.post_type === 'buddy'
      ? 'Adventure Buddy'
      : post.post_type === 'recommendation'
        ? 'Place'
        : post.post_type === 'meetup'
          ? 'Campfire'
          : null;

  const isPopular = reason === 'Popular';
  const contextIcon = reason?.startsWith('Near') || reason?.startsWith('In ')
    ? 'location-outline'
    : reason?.includes('Community')
      ? 'people-outline'
      : isPopular
        ? 'flame-outline'
        : 'sparkles-outline';

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
            <View style={styles.authorLine}>
              <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
              {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.postMeta}>{relativeTime(post.created_at)}</Text>
              {reason ? <>
                <Text style={styles.metaDot}>·</Text>
                <View style={[styles.contextChip, isPopular && styles.contextChipPopular]}>
                  <Ionicons name={contextIcon as never} size={11} color={isPopular ? '#F2CE65' : GOLD} />
                  <Text style={[styles.contextText, isPopular && styles.contextTextPopular]} numberOfLines={1}>{reason}</Text>
                </View>
              </> : null}
            </View>
          </View>
        </Pressable>
        <PostOptionsButton postId={post.id} authorId={post.author_id} body={post.body} />
      </View>
      {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
      {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" /> : null}
      <View style={styles.engagementWrap}>
        <PostEngagementBar postId={post.id} initialReactionCount={post.reaction_count || 0} commentCount={post.comment_count || 0} />
      </View>
    </Pressable>
  );
}

function CommunityRow({ group, joining, onJoin, reason, managementType }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void; reason?: string | null; managementType: CommunityManagementType }) {
  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      <View style={styles.groupAvatar}>{group.image_url ? <Image source={{ uri: group.image_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(group.name)}</Text>}</View>
      <View style={styles.flex}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>{group.name}</Text>
          <CommunityTypeBadge type={managementType} compact />
        </View>
        <Text style={styles.rowMeta}>{joining ? 'Joining…' : `${group.member_count} member${group.member_count === 1 ? '' : 's'}`}</Text>
        {reason ? <Text style={styles.rowReason}>{reason}</Text> : null}
      </View>
      <Ionicons name={group.is_member ? 'chevron-forward' : 'add-circle-outline'} size={20} color={group.is_member ? MUTED : GOLD} />
    </Pressable>
  );
}

function MyCommunityTile({ group, managementType }: { group: CommunityGroup; managementType: CommunityManagementType }) {
  return (
    <Pressable style={({ pressed }) => [styles.communityTile, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}>
      <View style={styles.communityTileImageWrap}>
        {group.image_url ? <Image source={{ uri: group.image_url }} style={styles.communityTileImage} /> : <View style={styles.communityTileFallback}><Text style={styles.communityTileInitials}>{initials(group.name)}</Text></View>}
      </View>
      <Text style={styles.communityTileTitle} numberOfLines={2}>{group.name}</Text>
      <Text style={styles.communityTileMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
      <View style={styles.communityTileBadgeWrap}><CommunityTypeBadge type={managementType} compact /></View>
      {(group.city || group.state) ? <Text style={styles.communityTileLocation} numberOfLines={1}>{[group.city, group.state].filter(Boolean).join(', ')}</Text> : null}
    </Pressable>
  );
}

function CampfireCard({ event, reason }: { event: LocalEvent; reason?: string | null }) {
  const start = new Date(event.starts_at);
  return (
    <Pressable style={({ pressed }) => [styles.campfireCard, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      <View style={styles.campfireIcon}><Ionicons name="bonfire-outline" size={21} color={GOLD} /></View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{event.title}</Text>
        <Text style={styles.rowMeta}>{start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={styles.rowMeta}>{event.venue_name ? `${event.venue_name} · ` : ''}{event.city}, {event.state}</Text>
        <Text style={styles.campfireHost}>Hosted by {event.host_name}</Text>
        {reason ? <Text style={styles.rowReason}>{reason}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={MUTED} />
    </Pressable>
  );
}

export default function OutpostScreen() {
  const [tab, setTab] = useState<OutpostTab>('for-you');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [communityManagement, setCommunityManagement] = useState<Map<string, CommunityManagementType>>(new Map());
  const [connections, setConnections] = useState<Connection[]>([]);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof searchCommunityMembers>>>([]);
  const [campfires, setCampfires] = useState<LocalEvent[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('You');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerBody, setComposerBody] = useState('');
  const [composerType, setComposerType] = useState<CommunityPostType>('update');
  const [composerPhoto, setComposerPhoto] = useState<PickedPhoto | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myCommunityQuery, setMyCommunityQuery] = useState('');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>('recommended');

  const load = useCallback(async () => {
    try {
      const [nextPosts, nextGroups, nextManagement, nextConnections, nextMembers, nextCampfires, basecamp] = await Promise.all([
        getCommunityFeed(),
        getGroups(),
        getCommunityManagementTypes().catch(() => new Map<string, CommunityManagementType>()),
        getConnections().catch(() => []),
        searchCommunityMembers('').catch(() => []),
        listLocalEvents().catch(() => []),
        getMemberBasecamp(),
      ]);
      setPosts(nextPosts);
      setGroups(nextGroups);
      setCommunityManagement(nextManagement);
      setConnections(nextConnections);
      setMembers(nextMembers);
      setCampfires(nextCampfires);
      setHomeCity(basecamp.profile?.home_city ?? null);
      setHomeState(basecamp.profile?.home_state ?? null);
      setProfileAvatarUrl(basecamp.profile?.avatar_url ?? null);
      setProfileName(basecamp.profile?.display_name || basecamp.profile?.username || 'You');
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
  const acceptedConnectionIds = useMemo(() => new Set(connections.filter((connection) => connection.status === 'accepted').map((connection) => connection.profile_id)), [connections]);
  const localMemberIds = useMemo(() => new Set(members.filter((person) => homeState && person.home_state === homeState && (!homeCity || !person.home_city || person.home_city === homeCity)).map((person) => person.id)), [members, homeCity, homeState]);
  const regionalMemberIds = useMemo(() => new Set(members.filter((person) => homeState && person.home_state === homeState).map((person) => person.id)), [members, homeState]);
  const myGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const discoverGroups = useMemo(() => groups.filter((group) => !group.is_member), [groups]);
  const myGroupNames = useMemo(() => new Map(myGroups.map((group) => [group.id, group.name])), [myGroups]);
  const selectedType = postTypes.find((item) => item.value === composerType) ?? postTypes[0]!;

  const managementFor = useCallback((group: CommunityGroup): CommunityManagementType => {
    const explicit = communityManagement.get(group.id);
    if (explicit) return explicit;
    if (group.kind === 'adventure') return 'official';
    if (group.kind === 'interest' && OFFICIAL_STARTERS.has(group.name.trim().toLowerCase())) return 'official';
    return 'member_led';
  }, [communityManagement]);

  const isLocalGroup = useCallback((group: CommunityGroup) => Boolean(homeState && group.state === homeState && (!homeCity || !group.city || group.city === homeCity)), [homeCity, homeState]);
  const isRegionalGroup = useCallback((group: CommunityGroup) => Boolean(homeState && group.state === homeState), [homeState]);
  const isLocalCampfire = useCallback((event: LocalEvent) => Boolean(homeState && event.state === homeState && (!homeCity || event.city === homeCity)), [homeCity, homeState]);
  const isRegionalCampfire = useCallback((event: LocalEvent) => Boolean(homeState && event.state === homeState), [homeState]);

  const reasonForPost = useCallback((post: CommunityPost) => {
    if (post.group_id && myGroupNames.has(post.group_id)) return `Your Community · ${myGroupNames.get(post.group_id)}`;
    if (acceptedConnectionIds.has(post.author_id)) return 'Trailmate';
    if (localMemberIds.has(post.author_id)) return `Near ${locationLabel}`;
    if (regionalMemberIds.has(post.author_id) && homeState) return `In ${homeState}`;
    if ((post.reaction_count || 0) + (post.comment_count || 0) >= 3) return 'Popular';
    return 'Recommended';
  }, [acceptedConnectionIds, homeState, localMemberIds, locationLabel, myGroupNames, regionalMemberIds]);

  const basecampPosts = useMemo(() => [...posts].sort((a, b) => {
    const score = (post: CommunityPost) => {
      let value = (post.reaction_count || 0) + (post.comment_count || 0);
      if (post.group_id && myGroupNames.has(post.group_id)) value += 40;
      if (acceptedConnectionIds.has(post.author_id)) value += 30;
      if (localMemberIds.has(post.author_id)) value += 15;
      else if (regionalMemberIds.has(post.author_id)) value += 7;
      return value;
    };
    return score(b) - score(a);
  }), [acceptedConnectionIds, localMemberIds, myGroupNames, posts, regionalMemberIds]);

  const visibleMyGroups = useMemo(() => {
    const query = myCommunityQuery.trim().toLowerCase();
    if (!query) return myGroups;
    return myGroups.filter((group) => `${group.name} ${group.city ?? ''} ${group.state ?? ''}`.toLowerCase().includes(query));
  }, [myCommunityQuery, myGroups]);

  const visibleDiscoverGroups = useMemo(() => {
    const query = discoverQuery.trim().toLowerCase();
    let next = discoverGroups.filter((group) => !query || `${group.name} ${group.city ?? ''} ${group.state ?? ''}`.toLowerCase().includes(query));

    if (discoverFilter === 'near') next = next.filter(isLocalGroup);
    if (discoverFilter === 'regional') next = next.filter((group) => isRegionalGroup(group) && !isLocalGroup(group));
    if (discoverFilter === 'state') next = next.filter(isRegionalGroup);
    if (discoverFilter === 'beginner') next = next.filter((group) => group.name.toLowerCase().includes('beginner'));

    return [...next].sort((a, b) => {
      if (discoverFilter === 'popular') return b.member_count - a.member_count;
      const score = (group: CommunityGroup) => (isLocalGroup(group) ? 20 : isRegionalGroup(group) ? 10 : 0) + group.member_count;
      return score(b) - score(a);
    });
  }, [discoverFilter, discoverGroups, discoverQuery, isLocalGroup, isRegionalGroup]);

  const sortedCampfires = useMemo(() => [...campfires].sort((a, b) => {
    const locality = (event: LocalEvent) => isLocalCampfire(event) ? 2 : isRegionalCampfire(event) ? 1 : 0;
    const localityDiff = locality(b) - locality(a);
    if (localityDiff) return localityDiff;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  }), [campfires, isLocalCampfire, isRegionalCampfire]);

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
    try { await joinGroup(group.id); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to join this community.'); } finally { setJoiningId(null); }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
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
            <View style={styles.locationRow}><Ionicons name="location-outline" size={14} color={GOLD} /><Text style={styles.subtitle}>{locationLabel}</Text></View>
          </View>
        </View>

        <View style={styles.tabs}>
          {tabs.map((item) => <Pressable key={item.value} style={[styles.tab, tab === item.value && styles.tabActive]} onPress={() => setTab(item.value)}><Text style={[styles.tabText, tab === item.value && styles.tabTextActive]}>{item.label}</Text></Pressable>)}
        </View>

        {loading ? <ActivityIndicator color={GOLD} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'for-you' ? <>
          <View style={styles.tabIntro}><Text style={styles.tabIntroTitle}>What matters to you</Text><Text style={styles.tabIntroCopy}>Trailmates, your Communities, local activity, and community posts worth catching up on.</Text></View>
          <View style={styles.composer}>
            {composerPhoto ? <View style={styles.photoWrap}><Image source={{ uri: composerPhoto.uri }} style={styles.composerPhoto} /><Pressable style={styles.removePhoto} onPress={() => setComposerPhoto(null)}><Ionicons name="close" size={18} color={TEXT} /></Pressable></View> : null}
            <View style={styles.composerPromptRow}>
              <View style={styles.composerAvatar}>{profileAvatarUrl ? <Image source={{ uri: profileAvatarUrl }} style={styles.avatarImage} /> : <Text style={styles.composerAvatarText}>{initials(profileName)}</Text>}</View>
              <TextInput value={composerBody} onChangeText={setComposerBody} placeholder={composerType === 'ask' ? 'Ask the Outpost…' : composerType === 'buddy' ? 'Find an adventure buddy…' : 'What’s happening outside?'} placeholderTextColor="#7F8B83" multiline maxLength={4000} style={styles.composerInput} />
            </View>
            <View style={styles.composerActions}>
              <Pressable style={styles.actionButton} onPress={() => void choosePhoto()}><Ionicons name="image-outline" size={16} color={GOLD} /><Text style={styles.actionText}>Photo</Text></Pressable>
              <Pressable style={styles.actionButton} onPress={() => setTypeOpen((value) => !value)}><Ionicons name={selectedType.icon as never} size={16} color={GOLD} /><Text style={styles.actionText}>{selectedType.label}</Text><Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={12} color={MUTED} /></Pressable>
              <Pressable disabled={submitting || (composerType !== 'meetup' && !composerBody.trim() && !composerPhoto)} style={[styles.postButton, (submitting || (composerType !== 'meetup' && !composerBody.trim() && !composerPhoto)) && styles.disabled]} onPress={() => void submitPost()}><Text style={styles.postButtonText}>{composerType === 'meetup' ? 'Set up' : submitting ? 'Posting…' : 'Post'}</Text></Pressable>
            </View>
            {typeOpen ? <View style={styles.typeMenu}>{postTypes.map((item) => <Pressable key={item.value} style={styles.typeRow} onPress={() => { setComposerType(item.value); setTypeOpen(false); }}><Ionicons name={item.icon as never} size={18} color={item.value === composerType ? GOLD : MUTED} /><Text style={[styles.typeText, item.value === composerType && styles.typeTextActive]}>{item.label}</Text></Pressable>)}</View> : null}
          </View>
          <View style={styles.feedHeading}><Text style={styles.feedTitle}>Your Basecamp</Text><Text style={styles.feedHint}>Personalized</Text></View>
          {basecampPosts.map((post) => <PostCard key={post.id} post={post} reason={reasonForPost(post)} />)}
          {!posts.length && !loading ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Start the conversation</Text><Text style={styles.emptyText}>Share what you’re doing outside.</Text></View> : null}
        </> : null}

        {tab === 'groups' ? <>
          <View style={styles.communitySection}>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Your Communities</Text><Text style={styles.sectionCopy}>Communities you’ve joined.</Text></View>
            <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={MUTED} /><TextInput value={myCommunityQuery} onChangeText={setMyCommunityQuery} placeholder="Search your communities" placeholderTextColor="#77847C" style={styles.searchInput} /></View>
            {visibleMyGroups.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityRail}>{visibleMyGroups.map((group) => <MyCommunityTile key={group.id} group={group} managementType={managementFor(group)} />)}</ScrollView> : <View style={styles.emptyInline}><Text style={styles.emptyText}>{myGroups.length ? 'No joined communities match that search.' : 'You have not joined a community yet.'}</Text></View>}
          </View>

          <View style={styles.communitySection}>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Discover Communities</Text><Text style={styles.sectionCopy}>Find new communities based on interests, activity, and location.</Text></View>
            <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={MUTED} /><TextInput value={discoverQuery} onChangeText={setDiscoverQuery} placeholder="Search communities" placeholderTextColor="#77847C" style={styles.searchInput} /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>{discoverFilters.map((filter) => <Pressable key={filter.value} style={[styles.filterChip, discoverFilter === filter.value && styles.filterChipActive]} onPress={() => setDiscoverFilter(filter.value)}><Text style={[styles.filterText, discoverFilter === filter.value && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}</ScrollView>
            <View style={styles.list}>{visibleDiscoverGroups.map((group) => <CommunityRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} managementType={managementFor(group)} reason={isLocalGroup(group) ? 'Near you' : isRegionalGroup(group) ? `In ${homeState}` : 'Recommended'} />)}{!visibleDiscoverGroups.length ? <Text style={styles.emptyListText}>No discoverable communities match this search and filter.</Text> : null}</View>
          </View>
        </> : null}

        {tab === 'campfires' ? <>
          <View style={styles.campfireHero}><View style={styles.campfireHeroIcon}><Ionicons name="bonfire-outline" size={26} color={GOLD} /></View><View style={styles.flex}><Text style={styles.sectionTitle}>Come hang out</Text><Text style={styles.sectionCopy}>Casual, member-led meetups with less planning and lower commitment than an Adventure.</Text></View></View>
          <Pressable style={styles.startCampfireButton} onPress={() => router.push('/local-events/create')}><Ionicons name="add-circle-outline" size={19} color="#101510" /><Text style={styles.startCampfireText}>Start a Campfire</Text></Pressable>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Upcoming Campfires</Text><Text style={styles.sectionCopy}>Nearby gatherings rise to the top automatically.</Text></View>
          {sortedCampfires.map((event) => <CampfireCard key={event.id} event={event} reason={isLocalCampfire(event) ? 'Near you' : isRegionalCampfire(event) ? `In ${homeState}` : null} />)}
          {!campfires.length && !loading ? <View style={styles.emptyCard}><Ionicons name="bonfire-outline" size={28} color={GOLD} /><Text style={styles.emptyTitle}>No Campfires yet</Text><Text style={styles.emptyText}>Start one and give people a reason to get together.</Text></View> : null}
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 112, gap: 14 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  title: { color: TEXT, fontSize: 32, lineHeight: 36, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  subtitle: { color: MUTED, fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: '#252D27', borderWidth: 1, borderColor: '#4A493C' },
  tabText: { color: '#9DA8A1', fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: GOLD },
  loader: { marginVertical: 4 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 12 },
  tabIntro: { gap: 2, paddingHorizontal: 2, paddingTop: 2 },
  tabIntroTitle: { color: TEXT, fontSize: 18, fontWeight: '900' },
  tabIntroCopy: { color: '#8F9B93', fontSize: 11.5, lineHeight: 17 },
  composer: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 9, gap: 7 },
  composerPromptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#202C25', borderWidth: 1, borderColor: '#34443A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  composerAvatarText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  composerInput: { flex: 1, minHeight: 36, maxHeight: 120, color: TEXT, fontSize: 14.5, lineHeight: 20, paddingHorizontal: 0, paddingVertical: 6, textAlignVertical: 'top' },
  photoWrap: { position: 'relative' },
  composerPhoto: { width: '100%', height: 180, borderRadius: 13, backgroundColor: '#101813' },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(15,23,19,0.88)', alignItems: 'center', justifyContent: 'center' },
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#334139', paddingTop: 6 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 31, paddingHorizontal: 8, borderRadius: 9 },
  actionText: { color: '#D8DED9', fontSize: 11, fontWeight: '800' },
  postButton: { marginLeft: 'auto', minHeight: 31, paddingHorizontal: 14, borderRadius: 9, backgroundColor: GOLD, justifyContent: 'center' },
  postButtonText: { color: '#101510', fontWeight: '900', fontSize: 11.5 },
  disabled: { opacity: 0.42 },
  typeMenu: { borderWidth: 1, borderColor: '#38473E', borderRadius: 12, overflow: 'hidden', backgroundColor: '#121C17' },
  typeRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344239' },
  typeText: { color: '#CED6D0', fontSize: 12.5, fontWeight: '700' },
  typeTextActive: { color: GOLD },
  feedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  feedTitle: { color: TEXT, fontSize: 18, fontWeight: '900' },
  feedHint: { color: GOLD, fontSize: 10.5, fontWeight: '900' },
  sectionHeading: { gap: 2, paddingTop: 3 },
  sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '900' },
  sectionCopy: { color: '#8F9B93', fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  communitySection: { gap: 10 },
  searchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#334139', backgroundColor: '#121B16', borderRadius: 14, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: TEXT, fontSize: 13.5, paddingVertical: 9 },
  communityRail: { gap: 10, paddingRight: 8, paddingVertical: 2 },
  communityTile: { width: 150, minHeight: 214, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, overflow: 'hidden', paddingBottom: 11 },
  communityTileImageWrap: { width: '100%', height: 92, backgroundColor: '#101813' },
  communityTileImage: { width: '100%', height: '100%' },
  communityTileFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#213229' },
  communityTileInitials: { color: GOLD, fontSize: 18, fontWeight: '900' },
  communityTileTitle: { color: TEXT, fontSize: 13.5, lineHeight: 18, fontWeight: '900', marginTop: 9, paddingHorizontal: 10 },
  communityTileMeta: { color: MUTED, fontSize: 10.5, marginTop: 4, paddingHorizontal: 10 },
  communityTileBadgeWrap: { marginTop: 5, paddingHorizontal: 10, alignItems: 'flex-start' },
  communityTileLocation: { color: '#849087', fontSize: 9.5, fontWeight: '700', marginTop: 4, paddingHorizontal: 10 },
  managementBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  managementBadgeCompact: { gap: 3 },
  managementText: { color: MUTED, fontSize: 10.5, fontWeight: '800' },
  managementTextOfficial: { color: GOLD },
  managementTextCompact: { fontSize: 9.5 },
  filterRail: { gap: 7, paddingRight: 8, paddingVertical: 1 },
  filterChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#121A16' },
  filterChipActive: { borderColor: '#80952B', backgroundColor: '#263118' },
  filterText: { color: '#ABB5AE', fontSize: 11.5, fontWeight: '800' },
  filterTextActive: { color: '#DCEB91' },
  emptyInline: { minHeight: 76, borderWidth: 1, borderColor: BORDER, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 14 },
  postCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 13, gap: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorTarget: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#526158', backgroundColor: '#202B25', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: TEXT, fontWeight: '900', fontSize: 11 },
  authorName: { color: TEXT, fontSize: 15, fontWeight: '900', flexShrink: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, minWidth: 0 },
  postMeta: { color: '#8F9B93', fontSize: 11 },
  metaDot: { color: '#657168', fontSize: 11 },
  contextChip: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1, paddingHorizontal: 2, paddingVertical: 1 },
  contextChipPopular: { backgroundColor: '#342D17', borderWidth: 1, borderColor: '#5A4A21', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  contextText: { color: '#C6B77E', fontSize: 10.5, fontWeight: '800', flexShrink: 1 },
  contextTextPopular: { color: '#F2CE65' },
  badge: { backgroundColor: '#202B24', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: '#D7C792', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.2 },
  postBody: { color: '#E5E9E6', fontSize: 14, lineHeight: 21 },
  postImage: { width: '100%', height: 230, borderRadius: 13, backgroundColor: '#101813' },
  engagementWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#344139', paddingTop: 5 },
  list: { borderWidth: 1, borderColor: '#334139', borderRadius: 14, overflow: 'hidden' },
  listRow: { minHeight: 68, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#37443D' },
  groupAvatar: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#213229', borderWidth: 1, borderColor: '#47554C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  rowTitle: { color: TEXT, fontSize: 14, fontWeight: '900', flexShrink: 1 },
  rowMeta: { color: MUTED, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  rowReason: { color: GOLD, fontSize: 10.5, fontWeight: '800', marginTop: 4 },
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
  emptyListText: { color: MUTED, fontSize: 12, lineHeight: 17, textAlign: 'center', padding: 16 },
  pressed: { opacity: 0.72 },
});