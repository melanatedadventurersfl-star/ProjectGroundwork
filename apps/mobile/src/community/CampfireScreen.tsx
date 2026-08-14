import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createPost,
  getCommunityFeed,
  getGroups,
  joinGroup,
  removeCommunityPostImage,
  uploadCommunityPostImage,
  type CommunityAudience,
  type CommunityGroup,
  type CommunityPost,
  type CommunityPostType,
} from './api';
import { getCircles, searchCommunityMembers, type CommunityCircle, type CommunityPerson } from './circles';
import {
  EMPTY_PLACE_RECOMMENDATION,
  PlaceRecommendationFields,
  PlaceRecommendationSummary,
  placeRecommendationMetadata,
  type PlaceRecommendationValue,
} from './placeRecommendation';
import { EMPTY_POST_TAGGING, metadataHashtags, postTaggingMetadata, type PostTaggingValue } from './postTagging';
import { getMemberBasecamp } from '../member/api';

type CommunityTab = 'campfire' | 'nearby' | 'crew' | 'groups';
type PickedPhoto = { uri: string; mimeType?: string | null };
type Trigger = '@' | '&' | '#';
type ActiveToken = { trigger: Trigger; query: string; start: number; end: number } | null;

const GOLD = '#D7B45A';
const GOLD_MUTED = '#B79B58';
const BG = '#0F1713';
const CARD = '#17211C';
const CARD_ALT = '#1B2A22';
const BORDER = '#28362E';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';

const postTypes: { value: CommunityPostType; label: string; icon: string }[] = [
  { value: 'update', label: 'Update', icon: 'create-outline' },
  { value: 'ask', label: 'Ask', icon: 'help-circle-outline' },
  { value: 'meetup', label: 'Meetup', icon: 'calendar-outline' },
  { value: 'buddy', label: 'Adventure Buddy', icon: 'people-outline' },
  { value: 'recommendation', label: 'Recommend a Place', icon: 'location-outline' },
];

const audiences: { value: CommunityAudience; label: string; icon: string }[] = [
  { value: 'everyone', label: 'Everyone', icon: 'globe-outline' },
  { value: 'connections', label: 'My Trailmates', icon: 'people-outline' },
  { value: 'circle', label: 'A Crew', icon: 'people-circle-outline' },
  { value: 'group', label: 'A Group', icon: 'albums-outline' },
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

function placeholderFor(type: CommunityPostType) {
  if (type === 'ask') return 'What do you want to ask around the Campfire?';
  if (type === 'buddy') return 'What do you want to do, where, and when?';
  if (type === 'recommendation') return 'Why do you recommend this place?';
  if (type === 'meetup') return 'What are you planning?';
  return 'What’s happening outside?  @ people  & groups  # topics';
}

function getActiveToken(body: string, cursor: number): ActiveToken {
  const before = body.slice(0, cursor);
  const match = before.match(/(^|\s)([@&#])([^\s@&#]*)$/);
  if (!match?.[2]) return null;
  const query = match[3] ?? '';
  return { trigger: match[2] as Trigger, query, start: cursor - query.length - 1, end: cursor };
}

function metadataItems(metadata: Record<string, unknown>, key: 'tagged_people' | 'tagged_groups') {
  const value = metadata[key];
  return Array.isArray(value) ? value.filter((item): item is { id: string; name: string } => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return typeof row.id === 'string' && typeof row.name === 'string';
  }) : [];
}

function RichPostBody({ post }: { post: CommunityPost }) {
  const tokens = [
    ...metadataItems(post.metadata, 'tagged_people').map((item) => ({ text: `@${item.name}`, type: 'person' as const, id: item.id })),
    ...metadataItems(post.metadata, 'tagged_groups').map((item) => ({ text: `&${item.name}`, type: 'group' as const, id: item.id })),
    ...metadataHashtags(post.metadata).map((tag) => ({ text: `#${tag}`, type: 'hashtag' as const, id: tag })),
  ].sort((a, b) => b.text.length - a.text.length);

  if (!tokens.length) return <Text style={styles.feedBody}>{post.body}</Text>;

  const pieces: { text: string; token?: (typeof tokens)[number] }[] = [];
  let index = 0;
  while (index < post.body.length) {
    const next = tokens.map((token) => ({ token, at: post.body.indexOf(token.text, index) })).filter((item) => item.at >= 0).sort((a, b) => a.at - b.at || b.token.text.length - a.token.text.length)[0];
    if (!next) { pieces.push({ text: post.body.slice(index) }); break; }
    if (next.at > index) pieces.push({ text: post.body.slice(index, next.at) });
    pieces.push({ text: next.token.text, token: next.token });
    index = next.at + next.token.text.length;
  }

  return (
    <Text style={styles.feedBody}>
      {pieces.map((piece, i) => piece.token ? (
        <Text key={`${i}-${piece.text}`} style={styles.inlineToken} onPress={() => {
          if (piece.token?.type === 'person') router.push({ pathname: '/community-profile/[id]', params: { id: piece.token.id } });
          if (piece.token?.type === 'group') router.push({ pathname: '/groups/[id]', params: { id: piece.token.id } });
        }}>{piece.text}</Text>
      ) : <Text key={`${i}-${piece.text}`}>{piece.text}</Text>)}
    </Text>
  );
}

function GroupRow({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      <View style={styles.groupAvatar}>{group.image_url ? <Image source={{ uri: group.image_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={styles.groupAvatarText}>{initials(group.name)}</Text>}</View>
      <View style={styles.flex}><Text style={styles.groupName} numberOfLines={1}>{group.name}</Text><Text style={styles.groupMeta}>{group.is_member ? `${group.member_count} member${group.member_count === 1 ? '' : 's'}` : joining ? 'Joining…' : `${group.member_count} members · Tap to join`}</Text></View>
      <Ionicons name={group.is_member ? 'chevron-forward' : 'add-circle-outline'} size={21} color={group.is_member ? MUTED : GOLD} />
    </Pressable>
  );
}

function CrewRow({ crew }: { crew: CommunityCircle }) {
  return (
    <Pressable style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/circles/[id]', params: { id: crew.id } })}>
      <View style={styles.crewAvatar}><Ionicons name="people" size={19} color={GOLD} /></View>
      <View style={styles.flex}><Text style={styles.groupName}>{crew.name}</Text><Text style={styles.groupMeta}>{crew.member_count} {crew.member_count === 1 ? 'Trailmate' : 'Trailmates'}</Text></View>
      <Ionicons name="chevron-forward" size={20} color={MUTED} />
    </Pressable>
  );
}

function PersonChip({ person }: { person: CommunityPerson }) {
  return (
    <Pressable style={({ pressed }) => [styles.personChip, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.id } })}>
      <View style={styles.personAvatar}>{person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={styles.personAvatarText}>{initials(person.display_name)}</Text>}</View>
      <Text style={styles.personChipName} numberOfLines={1}>{person.display_name.split(' ')[0]}</Text>
    </Pressable>
  );
}

function CommunityPostCard({ post }: { post: CommunityPost }) {
  const badge = post.post_type === 'ask' ? 'ASK' : post.post_type === 'buddy' ? 'ADVENTURE BUDDY' : post.post_type === 'recommendation' ? 'PLACE' : post.post_type === 'meetup' ? 'MEETUP' : null;
  const icon = post.audience === 'connections' ? 'people-outline' : post.audience === 'circle' ? 'people-circle-outline' : post.audience === 'group' ? 'albums-outline' : 'globe-outline';
  return (
    <Pressable style={({ pressed }) => [styles.feedCard, pressed && styles.pressed]} onPress={() => router.push(`/community/${post.id}`)}>
      <View style={styles.feedHeader}>
        <View style={styles.feedAvatar}>{post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={styles.feedAvatarText}>{initials(post.author_name)}</Text>}</View>
        <View style={styles.flex}><View style={styles.authorLine}><Text style={styles.feedName} numberOfLines={1}>{post.author_name}</Text><Ionicons name={icon as never} size={13} color={MUTED} /></View><Text style={styles.feedMeta}>{relativeTime(post.created_at)}</Text></View>
        {badge ? <View style={styles.postTypeBadge}><Text style={styles.postTypeBadgeText}>{badge}</Text></View> : null}
      </View>
      {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" /> : null}
      {post.post_type === 'recommendation' ? <PlaceRecommendationSummary metadata={post.metadata} /> : null}
      {post.body ? <RichPostBody post={post} /> : null}
      <View style={styles.engagementRow}><View style={styles.engagementLeft}><Ionicons name="heart-outline" size={18} color={GOLD_MUTED} /><Text style={styles.engagementText}>{post.reaction_count || 0}</Text><Ionicons name="chatbubble-outline" size={17} color={MUTED} /><Text style={styles.engagementText}>{post.comment_count || 0}</Text></View><Ionicons name="chevron-forward" size={18} color={MUTED} /></View>
    </Pressable>
  );
}

export default function CampfireScreen() {
  const [tab, setTab] = useState<CommunityTab>('campfire');
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [crews, setCrews] = useState<CommunityCircle[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [members, setMembers] = useState<CommunityPerson[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [composerBody, setComposerBody] = useState('');
  const [cursor, setCursor] = useState(0);
  const [composerType, setComposerType] = useState<CommunityPostType>('update');
  const [composerAudience, setComposerAudience] = useState<CommunityAudience>('everyone');
  const [composerCircleId, setComposerCircleId] = useState<string | null>(null);
  const [composerGroupId, setComposerGroupId] = useState<string | null>(null);
  const [composerPhoto, setComposerPhoto] = useState<PickedPhoto | null>(null);
  const [placeRecommendation, setPlaceRecommendation] = useState<PlaceRecommendationValue>(EMPTY_PLACE_RECOMMENDATION);
  const [postTagging, setPostTagging] = useState<PostTaggingValue>(EMPTY_POST_TAGGING);
  const [mentionResults, setMentionResults] = useState<CommunityPerson[]>([]);
  const [mentionSearching, setMentionSearching] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextGroups, nextCrews, nextPosts, basecamp, nextMembers] = await Promise.all([getGroups(), getCircles(), getCommunityFeed(), getMemberBasecamp(), searchCommunityMembers('').catch(() => [])]);
      setGroups(nextGroups); setCrews(nextCrews); setPosts(nextPosts); setMembers(nextMembers);
      setHomeCity(basecamp.profile?.home_city ?? null); setHomeState(basecamp.profile?.home_state ?? null); setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Campfire.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeToken = useMemo(() => getActiveToken(composerBody, cursor), [composerBody, cursor]);
  const locationLabel = homeCity && homeState ? `${homeCity}, ${homeState}` : homeCity || homeState || 'Your area';
  const yourGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const nearbyGroups = useMemo(() => groups.filter((group) => homeState && group.state === homeState && (!homeCity || !group.city || group.city === homeCity)), [groups, homeCity, homeState]);
  const nearbyPeople = useMemo(() => members.filter((person) => homeState && person.home_state === homeState && (!homeCity || !person.home_city || person.home_city === homeCity)), [members, homeCity, homeState]);
  const nearbyIds = useMemo(() => new Set(nearbyPeople.map((person) => person.id)), [nearbyPeople]);
  const localPosts = useMemo(() => posts.filter((post) => nearbyIds.has(post.author_id)), [posts, nearbyIds]);
  const happeningNearby = useMemo(() => localPosts.filter((post) => post.post_type === 'meetup' || post.post_type === 'buddy').slice(0, 4), [localPosts]);
  const localRecommendations = useMemo(() => posts.filter((post) => post.post_type === 'recommendation' && (((typeof post.metadata.place_location === 'string' && homeCity && post.metadata.place_location.toLowerCase().includes(homeCity.toLowerCase()))) || nearbyIds.has(post.author_id))).slice(0, 4), [posts, homeCity, nearbyIds]);
  const popularHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => metadataHashtags(post.metadata).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag).slice(0, 8);
  }, [posts]);

  const selectedType = postTypes.find((item) => item.value === composerType) ?? postTypes[0]!;
  const selectedAudience = audiences.find((item) => item.value === composerAudience) ?? audiences[0]!;
  const selectedCrew = crews.find((crew) => crew.id === composerCircleId) ?? null;
  const selectedGroup = yourGroups.find((group) => group.id === composerGroupId) ?? null;
  const targetMissing = (composerAudience === 'circle' && !composerCircleId) || (composerAudience === 'group' && !composerGroupId);
  const recommendationMissing = composerType === 'recommendation' && (!placeRecommendation.name.trim() || !placeRecommendation.location.trim());
  const bodyMissing = composerType !== 'meetup' && !composerBody.trim() && !composerPhoto;
  const cannotPost = submitting || targetMissing || recommendationMissing || bodyMissing;

  const groupSuggestions = useMemo(() => activeToken?.trigger === '&' ? groups.filter((group) => !activeToken.query || group.name.toLowerCase().includes(activeToken.query.toLowerCase())).slice(0, 7) : [], [activeToken, groups]);
  const hashtagSuggestions = useMemo(() => {
    if (activeToken?.trigger !== '#') return [];
    const needle = activeToken.query.toLowerCase();
    const matches = popularHashtags.filter((tag) => !needle || tag.includes(needle));
    return needle && !matches.includes(needle) ? [needle, ...matches].slice(0, 8) : matches.slice(0, 8);
  }, [activeToken, popularHashtags]);

  useEffect(() => {
    if (activeToken?.trigger !== '@' || activeToken.query.trim().length < 2) { setMentionResults([]); setMentionSearching(false); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setMentionSearching(true);
      void searchCommunityMembers(activeToken.query).then((results) => { if (!cancelled) setMentionResults(results.slice(0, 8)); }).catch(() => { if (!cancelled) setMentionResults([]); }).finally(() => { if (!cancelled) setMentionSearching(false); });
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeToken?.trigger, activeToken?.query]);

  function replaceActiveToken(replacement: string) {
    if (!activeToken) return;
    const next = `${composerBody.slice(0, activeToken.start)}${replacement} ${composerBody.slice(activeToken.end)}`;
    setComposerBody(next); setCursor(activeToken.start + replacement.length + 1);
  }

  function choosePerson(person: CommunityPerson) {
    replaceActiveToken(`@${person.display_name}`);
    setPostTagging((current) => current.people.some((item) => item.id === person.id) ? current : ({ ...current, people: [...current.people, { id: person.id, display_name: person.display_name, avatar_url: person.avatar_url }] }));
  }

  function chooseGroup(group: CommunityGroup) {
    replaceActiveToken(`&${group.name}`);
    setPostTagging((current) => current.groups.some((item) => item.id === group.id) ? current : ({ ...current, groups: [...current.groups, { id: group.id, name: group.name }] }));
  }

  function chooseHashtag(tag: string) {
    const normalized = tag.replace(/^#/, '').toLowerCase();
    replaceActiveToken(`#${normalized}`);
    setPostTagging((current) => ({ ...current, hashtags: Array.from(new Set([...(current.hashtags ?? []), normalized])) }));
  }

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library access is needed to upload a photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.88 });
    if (!result.canceled && result.assets?.[0]) setComposerPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
  }

  async function handleJoin(group: CommunityGroup) {
    setJoiningId(group.id);
    try { await joinGroup(group.id); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to join this group.'); } finally { setJoiningId(null); }
  }

  function changeAudience(next: CommunityAudience) {
    setComposerAudience(next); setComposerCircleId(null); setComposerGroupId(null); setAudienceOpen(false); setTargetOpen(next === 'circle' || next === 'group');
  }

  async function submitPost() {
    if (composerType === 'meetup') {
      if (!targetMissing) router.push({ pathname: '/local-events/create', params: { audience: composerAudience, circleId: composerCircleId ?? undefined, groupId: composerGroupId ?? undefined } });
      return;
    }
    if (cannotPost) return;
    setSubmitting(true); setError(null);
    let uploadedPath: string | null = null;
    try {
      if (composerPhoto) uploadedPath = await uploadCommunityPostImage(composerPhoto);
      await createPost({ body: composerBody, postType: composerType, audience: composerAudience, circleId: composerCircleId, groupId: composerGroupId, adventureId: selectedGroup?.adventure_id ?? null, imagePath: uploadedPath, metadata: { ...(composerType === 'recommendation' ? placeRecommendationMetadata(placeRecommendation) : {}), ...postTaggingMetadata(postTagging) } });
      setComposerBody(''); setCursor(0); setComposerPhoto(null); setPlaceRecommendation(EMPTY_PLACE_RECOMMENDATION); setPostTagging(EMPTY_POST_TAGGING); setComposerType('update'); setTypeOpen(false); await load();
    } catch (caught) {
      if (uploadedPath) await removeCommunityPostImage(uploadedPath).catch(() => undefined);
      setError(caught instanceof Error ? caught.message : 'Unable to publish this post.');
    } finally { setSubmitting(false); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={GOLD} />} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>Campfire</Text><View style={styles.locationRow}><Ionicons name="location-outline" size={14} color={MUTED} /><Text style={styles.subtitle}>{locationLabel}</Text></View></View><View style={styles.headerActions}><Pressable onPress={() => router.push('/notifications')}><Ionicons name="notifications-outline" size={23} color={TEXT} /></Pressable><Pressable style={styles.profileButton} onPress={() => router.push('/member/profile')}><Ionicons name="person" size={17} color={TEXT} /></Pressable></View></View>

        <View style={styles.tabs}>{([['campfire', 'Campfire'], ['nearby', 'Nearby'], ['crew', 'Crew'], ['groups', 'Groups']] as const).map(([value, label]) => <Pressable key={value} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>

        {loading ? <ActivityIndicator color={GOLD} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'campfire' ? <>
          <View style={styles.composer}>
            {composerPhoto ? <View style={styles.composerPhotoWrap}><Image source={{ uri: composerPhoto.uri }} style={styles.composerPhoto} /><Pressable style={styles.removePhotoButton} onPress={() => setComposerPhoto(null)}><Ionicons name="close" size={18} color={TEXT} /></Pressable></View> : null}
            <TextInput value={composerBody} onChangeText={(text) => { setComposerBody(text); setCursor(text.length); }} onSelectionChange={(event) => setCursor(event.nativeEvent.selection.end)} placeholder={placeholderFor(composerType)} placeholderTextColor="#7F8B83" multiline blurOnSubmit={false} maxLength={4000} style={styles.composerInput} />

            {activeToken ? <View style={styles.suggestionPanel}>
              <View style={styles.suggestionHeading}><Text style={styles.suggestionTitle}>{activeToken.trigger === '@' ? 'People' : activeToken.trigger === '&' ? 'Groups' : 'Topics'}</Text><Text style={styles.suggestionHint}>{activeToken.trigger}{activeToken.query}</Text></View>
              {activeToken.trigger === '@' ? <>{activeToken.query.length < 2 ? <Text style={styles.suggestionEmpty}>Type 2 letters to search Trailmates.</Text> : null}{mentionSearching ? <ActivityIndicator color={GOLD} style={styles.suggestionLoader} /> : null}{mentionResults.map((person) => <Pressable key={person.id} style={styles.suggestionRow} onPress={() => choosePerson(person)}><View style={styles.suggestionAvatar}>{person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={styles.suggestionAvatarText}>{initials(person.display_name)}</Text>}</View><View style={styles.flex}><Text style={styles.suggestionName}>{person.display_name}</Text><Text style={styles.suggestionMeta}>{[person.home_city, person.home_state].filter(Boolean).join(', ') || 'Member'}</Text></View><Text style={styles.triggerBadge}>@</Text></Pressable>)}</> : activeToken.trigger === '&' ? <>{groupSuggestions.map((group) => <Pressable key={group.id} style={styles.suggestionRow} onPress={() => chooseGroup(group)}><View style={styles.suggestionAvatar}><Text style={styles.suggestionAvatarText}>{initials(group.name)}</Text></View><View style={styles.flex}><Text style={styles.suggestionName}>{group.name}</Text><Text style={styles.suggestionMeta}>{group.member_count} members</Text></View><Text style={styles.triggerBadge}>&</Text></Pressable>)}{!groupSuggestions.length ? <Text style={styles.suggestionEmpty}>No groups found.</Text> : null}</> : <>{hashtagSuggestions.map((tag) => <Pressable key={tag} style={styles.hashtagRow} onPress={() => chooseHashtag(tag)}><Text style={styles.hashtagText}>#{tag}</Text></Pressable>)}{!hashtagSuggestions.length && !activeToken.query ? <Text style={styles.suggestionEmpty}>Start typing a topic.</Text> : null}</>}
            </View> : null}

            {composerType === 'recommendation' ? <PlaceRecommendationFields value={placeRecommendation} onChange={setPlaceRecommendation} /> : null}
            <View style={styles.composerControls}><Pressable style={styles.compactControl} onPress={() => void choosePhoto()}><Ionicons name="image-outline" size={18} color={GOLD_MUTED} /><Text style={styles.compactControlText}>{composerPhoto ? 'Change photo' : 'Photo'}</Text></Pressable><Pressable style={styles.compactControl} onPress={() => { setTypeOpen((value) => !value); setAudienceOpen(false); setTargetOpen(false); }}><Ionicons name={selectedType.icon as never} size={18} color={GOLD_MUTED} /><Text style={styles.compactControlText}>{selectedType.label}</Text><Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={15} color={MUTED} /></Pressable></View>
            {typeOpen ? <View style={styles.dropdown}>{postTypes.map((item) => <Pressable key={item.value} style={styles.dropdownRow} onPress={() => { setComposerType(item.value); setTypeOpen(false); }}><Ionicons name={item.icon as never} size={18} color={item.value === composerType ? GOLD : MUTED} /><Text style={[styles.dropdownText, item.value === composerType && styles.dropdownTextActive]}>{item.label}</Text></Pressable>)}</View> : null}
            <View style={styles.composerFooter}><Pressable style={styles.shareControl} onPress={() => { setAudienceOpen((value) => !value); setTypeOpen(false); setTargetOpen(false); }}><Ionicons name={selectedAudience.icon as never} size={16} color={GOLD} /><Text style={styles.shareText}>Share with {selectedAudience.label}</Text><Ionicons name={audienceOpen ? 'chevron-up' : 'chevron-down'} size={14} color={MUTED} /></Pressable><Pressable disabled={cannotPost} style={[styles.postButton, cannotPost && styles.postButtonDisabled]} onPress={() => void submitPost()}>{submitting ? <ActivityIndicator size="small" color="#101510" /> : <Text style={styles.postButtonText}>{composerType === 'meetup' ? 'Set up' : 'Post'}</Text>}</Pressable></View>
            {audienceOpen ? <View style={styles.dropdown}>{audiences.map((item) => <Pressable key={item.value} style={styles.dropdownRow} onPress={() => changeAudience(item.value)}><Ionicons name={item.icon as never} size={18} color={item.value === composerAudience ? GOLD : MUTED} /><Text style={[styles.dropdownText, item.value === composerAudience && styles.dropdownTextActive]}>{item.label}</Text></Pressable>)}</View> : null}
            {(composerAudience === 'circle' || composerAudience === 'group') ? <View><Pressable style={styles.targetControl} onPress={() => setTargetOpen((value) => !value)}><Text style={styles.targetControlText}>{composerAudience === 'circle' ? selectedCrew?.name ?? 'Choose a Crew' : selectedGroup?.name ?? 'Choose a Group'}</Text><Ionicons name={targetOpen ? 'chevron-up' : 'chevron-down'} size={15} color={MUTED} /></Pressable>{targetOpen ? <View style={styles.targetList}>{(composerAudience === 'circle' ? crews : yourGroups).map((target) => <Pressable key={target.id} style={styles.dropdownRow} onPress={() => { if (composerAudience === 'circle') setComposerCircleId(target.id); else setComposerGroupId(target.id); setTargetOpen(false); }}><Text style={styles.dropdownText}>{target.name}</Text></Pressable>)}</View> : null}</View> : null}
          </View>
          <View style={styles.feedSectionHeader}><Text style={styles.feedSectionLabel}>Around the Campfire</Text><Text style={styles.feedSectionHint}>Talk, share, ask, and make plans with the community.</Text></View>
          {posts.map((post) => <CommunityPostCard key={post.id} post={post} />)}
          {!posts.length && !loading ? <View style={styles.emptyCard}><Ionicons name="bonfire-outline" size={28} color={GOLD} /><Text style={styles.emptyTitle}>Light the first spark</Text><Text style={styles.emptyText}>Start a conversation above.</Text></View> : null}
        </> : tab === 'nearby' ? <>
          <View style={styles.nearbyHero}><View style={styles.nearbyHeroIcon}><Ionicons name="navigate" size={22} color="#101510" /></View><View style={styles.flex}><Text style={styles.nearbyEyebrow}>YOUR LOCAL PULSE</Text><Text style={styles.nearbyTitle}>Near {locationLabel}</Text><Text style={styles.nearbyCopy}>{nearbyPeople.length} adventurer{nearbyPeople.length === 1 ? '' : 's'} · {nearbyGroups.length} group{nearbyGroups.length === 1 ? '' : 's'} nearby</Text></View></View>
          <Pressable style={styles.makePlanButton} onPress={() => router.push('/local-events/create')}><Ionicons name="add-circle-outline" size={19} color="#101510" /><Text style={styles.makePlanText}>Make a Plan</Text></Pressable>
          <SectionTitle title="Adventurers Around You" subtitle="People with the same local basecamp." icon="people-outline" />
          {nearbyPeople.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>{nearbyPeople.slice(0, 12).map((person) => <PersonChip key={person.id} person={person} />)}</ScrollView> : <Text style={styles.inlineEmpty}>No nearby members yet.</Text>}
          <SectionTitle title="Happening Nearby" subtitle="Meetups and adventure-buddy posts from local members." icon="calendar-outline" />
          {happeningNearby.length ? happeningNearby.map((post) => <CommunityPostCard key={`nearby-${post.id}`} post={post} />) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing planned yet</Text><Text style={styles.emptyText}>Be the one who gets something moving.</Text></View>}
          <SectionTitle title="Local Campfire" subtitle={`Recent posts from adventurers around ${locationLabel}.`} icon="bonfire-outline" />
          {localPosts.slice(0, 5).map((post) => <CommunityPostCard key={`local-${post.id}`} post={post} />)}{!localPosts.length ? <Text style={styles.inlineEmpty}>Local posts will show here as the Campfire grows.</Text> : null}
          <View style={styles.sectionCard}><SectionTitle title="Groups Near You" subtitle="Local communities you can jump into." icon="people-circle-outline" /><View style={styles.groupList}>{nearbyGroups.map((group) => <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}{!nearbyGroups.length ? <Text style={styles.emptyText}>No local groups yet.</Text> : null}</View></View>
          <SectionTitle title="Explore Nearby" subtitle="Places the community thinks are worth getting outside for." icon="map-outline" />
          {localRecommendations.map((post) => <CommunityPostCard key={`place-${post.id}`} post={post} />)}{!localRecommendations.length ? <Text style={styles.inlineEmpty}>Nearby recommendations will collect here.</Text> : null}
        </> : tab === 'crew' ? <View style={styles.sectionCard}><View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Your Crew</Text><Text style={styles.sectionSubheading}>Your Trailmates, organized your way.</Text></View><Pressable onPress={() => router.push('/circles')}><Text style={styles.link}>Manage</Text></Pressable></View><View style={styles.groupList}>{crews.map((crew) => <CrewRow key={crew.id} crew={crew} />)}{!crews.length ? <Text style={styles.emptyText}>Create a crew to organize the Trailmates you adventure with most.</Text> : null}</View></View> : <View style={styles.sectionCard}><SectionTitle title="Groups" subtitle="Adventure communities you belong to or can discover." icon="albums-outline" /><View style={styles.groupList}>{groups.map((group) => <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}{!groups.length ? <Text style={styles.emptyText}>No groups yet.</Text> : null}</View></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  return <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubheading}>{subtitle}</Text></View><Ionicons name={icon as never} size={20} color={GOLD_MUTED} /></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG }, content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 48, gap: 12 }, flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, title: { color: TEXT, fontSize: 32, lineHeight: 36, fontWeight: '900' }, locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }, subtitle: { color: MUTED, fontSize: 12 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 13 }, profileButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD, backgroundColor: CARD_ALT, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#18211D', borderRadius: 14, padding: 3 }, tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }, tabActive: { backgroundColor: '#2A2D28' }, tabText: { color: '#A4ADA7', fontWeight: '800', fontSize: 12 }, tabTextActive: { color: GOLD }, loader: { marginVertical: 3 }, error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 12 },
  composer: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 11, gap: 9 }, composerInput: { minHeight: 70, maxHeight: 170, color: TEXT, fontSize: 15, lineHeight: 21, paddingHorizontal: 3, paddingVertical: 5, textAlignVertical: 'top' }, composerPhotoWrap: { position: 'relative' }, composerPhoto: { width: '100%', height: 180, borderRadius: 13, backgroundColor: '#101813' }, removePhotoButton: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(15,23,19,0.88)', alignItems: 'center', justifyContent: 'center' },
  suggestionPanel: { borderWidth: 1, borderColor: '#455349', borderRadius: 13, overflow: 'hidden', backgroundColor: '#111A16' }, suggestionHeading: { minHeight: 35, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344239' }, suggestionTitle: { color: TEXT, fontSize: 11.5, fontWeight: '900' }, suggestionHint: { color: GOLD, fontSize: 11.5, fontWeight: '800' }, suggestionRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2E3A33' }, suggestionAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: '#263A2F', borderWidth: 1, borderColor: '#4A594F', alignItems: 'center', justifyContent: 'center' }, suggestionAvatarText: { color: TEXT, fontWeight: '900', fontSize: 10.5 }, suggestionName: { color: TEXT, fontSize: 12.5, fontWeight: '800' }, suggestionMeta: { color: MUTED, fontSize: 10.5, marginTop: 1 }, suggestionEmpty: { color: MUTED, padding: 11, fontSize: 11.5 }, suggestionLoader: { marginVertical: 10 }, triggerBadge: { color: GOLD, fontSize: 18, fontWeight: '900', width: 22, textAlign: 'center' }, hashtagRow: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2E3A33' }, hashtagText: { color: GOLD, fontWeight: '800', fontSize: 13 },
  composerControls: { flexDirection: 'row', gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#37443C' }, compactControl: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#34423A', borderRadius: 11, backgroundColor: '#18231D', paddingHorizontal: 8 }, compactControlText: { color: '#D8DED9', fontSize: 11.5, fontWeight: '800' }, composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, shareControl: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }, shareText: { flex: 1, color: '#B9C2BC', fontSize: 11.5, fontWeight: '700' }, postButton: { minWidth: 72, minHeight: 38, borderRadius: 11, paddingHorizontal: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }, postButtonDisabled: { opacity: 0.38 }, postButtonText: { color: '#101510', fontWeight: '900', fontSize: 12 },
  dropdown: { borderWidth: 1, borderColor: '#38473E', borderRadius: 12, backgroundColor: '#121C17', overflow: 'hidden' }, dropdownRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344239' }, dropdownText: { flex: 1, color: '#CED6D0', fontSize: 12.5, fontWeight: '700' }, dropdownTextActive: { color: GOLD }, targetControl: { minHeight: 40, borderWidth: 1, borderColor: '#34423A', borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, targetControlText: { flex: 1, color: '#D8DED9', fontSize: 12, fontWeight: '800' }, targetList: { marginTop: 6, borderWidth: 1, borderColor: '#38473E', borderRadius: 11, overflow: 'hidden' },
  feedSectionHeader: { paddingHorizontal: 2, paddingTop: 2, gap: 1 }, feedSectionLabel: { color: TEXT, fontSize: 15, fontWeight: '900' }, feedSectionHint: { color: '#7F8B83', fontSize: 11.5, lineHeight: 16 }, feedCard: { backgroundColor: 'transparent', paddingHorizontal: 2, paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26332C' }, feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 }, feedAvatar: { width: 41, height: 41, borderRadius: 21, borderWidth: 1, borderColor: '#738078', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, feedAvatarText: { color: TEXT, fontWeight: '900', fontSize: 11.5 }, authorLine: { flexDirection: 'row', alignItems: 'center', gap: 5 }, feedName: { color: TEXT, fontSize: 15.5, fontWeight: '900', maxWidth: '88%' }, feedMeta: { color: '#8F9B93', fontSize: 11.5, marginTop: 2 }, postTypeBadge: { backgroundColor: '#1D2B24', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 }, postTypeBadgeText: { color: '#D6C28D', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 }, postImage: { width: '100%', height: 230, borderRadius: 14, backgroundColor: '#101813' }, feedBody: { color: '#E0E5E1', fontSize: 13.5, lineHeight: 20 }, inlineToken: { color: GOLD, fontWeight: '800' }, engagementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, engagementLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 }, engagementText: { color: MUTED, fontSize: 12, marginRight: 5 },
  sectionCard: { backgroundColor: CARD, borderRadius: 17, padding: 12, gap: 11 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { color: TEXT, fontSize: 17.5, fontWeight: '900' }, sectionSubheading: { color: '#8F9B93', fontSize: 11.5, lineHeight: 16, marginTop: 2 }, link: { color: GOLD, fontSize: 12, fontWeight: '900' }, groupList: { borderWidth: 1, borderColor: '#334139', borderRadius: 14, overflow: 'hidden' }, groupRow: { minHeight: 62, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#37443D' }, groupAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', borderWidth: 1, borderColor: '#4A594F', backgroundColor: '#1D3026', alignItems: 'center', justifyContent: 'center' }, crewAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#6C6041', backgroundColor: '#1D3026', alignItems: 'center', justifyContent: 'center' }, groupAvatarText: { color: TEXT, fontWeight: '900', fontSize: 10 }, groupName: { color: TEXT, fontWeight: '800', fontSize: 13.5 }, groupMeta: { color: '#8F9B93', fontSize: 11, marginTop: 2 },
  nearbyHero: { backgroundColor: '#1C2A23', borderWidth: 1, borderColor: '#4A5A4F', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, nearbyHeroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }, nearbyEyebrow: { color: '#AE9964', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 }, nearbyTitle: { color: TEXT, fontSize: 20, fontWeight: '900', marginTop: 1 }, nearbyCopy: { color: MUTED, fontSize: 11.5, marginTop: 3 }, makePlanButton: { minHeight: 44, backgroundColor: GOLD, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, makePlanText: { color: '#101510', fontWeight: '900', fontSize: 13 }, peopleRow: { gap: 10, paddingVertical: 2, paddingRight: 10 }, personChip: { width: 67, alignItems: 'center', gap: 5 }, personAvatar: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', backgroundColor: '#294236', borderWidth: 1.5, borderColor: '#6D795F', alignItems: 'center', justifyContent: 'center' }, personAvatarText: { color: TEXT, fontWeight: '900', fontSize: 11 }, personChipName: { color: '#DDE2DF', fontWeight: '800', fontSize: 10.5, maxWidth: 64 }, inlineEmpty: { color: '#87938B', fontSize: 12, lineHeight: 18, paddingVertical: 5 },
  emptyCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 18, alignItems: 'center', gap: 6 }, emptyTitle: { color: TEXT, fontWeight: '900', fontSize: 15 }, emptyText: { color: MUTED, textAlign: 'center', lineHeight: 18, fontSize: 12 }, pressed: { opacity: 0.72 },
});