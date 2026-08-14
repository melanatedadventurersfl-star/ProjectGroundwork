import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
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
  TextInput,
  View,
} from 'react-native';
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
} from '../../src/community/api';
import { getCircles, type CommunityCircle } from '../../src/community/circles';
import {
  EMPTY_PLACE_RECOMMENDATION,
  PlaceRecommendationFields,
  PlaceRecommendationSummary,
  placeRecommendationMetadata,
  type PlaceRecommendationValue,
} from '../../src/community/placeRecommendation';
import {
  EMPTY_POST_TAGGING,
  PostTaggingFields,
  PostTagSummary,
  postTaggingMetadata,
  type PostTaggingValue,
} from '../../src/community/postTagging';
import { getMemberBasecamp } from '../../src/member/api';

type CommunityTab = 'campfire' | 'nearby' | 'crew' | 'groups';
type PickedPhoto = { uri: string; mimeType?: string | null };

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

function relativeTime(value: string) {
  const created = new Date(value);
  const diff = Math.max(0, Date.now() - created.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const now = new Date();
  return created.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(created.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function postTypeLabel(post: CommunityPost) {
  if (post.post_type === 'ask') return 'ASK';
  if (post.post_type === 'buddy') return 'ADVENTURE BUDDY';
  if (post.post_type === 'recommendation') return 'PLACE RECOMMENDATION';
  if (post.post_type === 'meetup') return 'MEETUP';
  return null;
}

function audienceIcon(post: CommunityPost) {
  if (post.audience === 'connections') return 'people-outline';
  if (post.audience === 'circle') return 'people-circle-outline';
  if (post.audience === 'group') return 'albums-outline';
  return 'globe-outline';
}

function placeholderFor(type: CommunityPostType) {
  if (type === 'ask') return 'What do you want to ask around the Campfire?';
  if (type === 'buddy') return 'What do you want to do, where, and when?';
  if (type === 'recommendation') return 'Why do you recommend this place?';
  if (type === 'meetup') return 'What are you planning?';
  return 'What’s happening outside?';
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

function CircleGateway({ compact = false }: { compact?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.circleGateway, compact && styles.circleGatewayCompact, pressed && styles.pressed]} onPress={() => router.push('/circles')}>
      <View style={styles.circleGatewayIcon}><Ionicons name="people-circle-outline" size={27} color={GOLD} /></View>
      <View style={styles.groupCopy}>
        <Text style={styles.circleGatewayTitle}>Crew & Trailmates</Text>
        <Text style={styles.circleGatewayCopy} numberOfLines={compact ? 1 : 2}>Organize your Trailmates into private crews for invites, sharing, and adventures.</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={MUTED} />
    </Pressable>
  );
}

function CrewRow({ crew }: { crew: CommunityCircle }) {
  return (
    <Pressable style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/circles/[id]', params: { id: crew.id } })}>
      <View style={styles.crewAvatar}><Ionicons name="people" size={19} color={GOLD} /></View>
      <View style={styles.groupCopy}>
        <Text style={styles.groupName} numberOfLines={1}>{crew.name}</Text>
        <Text style={styles.groupMeta}>{crew.member_count} {crew.member_count === 1 ? 'Trailmate' : 'Trailmates'}</Text>
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
        <View style={styles.feedAvatar}>
          {post.avatar_url ? (
            <Image source={{ uri: post.avatar_url }} style={styles.feedAvatarImage} resizeMode="cover" />
          ) : (
            <Text style={styles.feedAvatarText}>{post.author_name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.feedHeaderCopy}>
          <View style={styles.authorLine}>
            <Text style={styles.feedName} numberOfLines={1}>{post.author_name}</Text>
            <Ionicons name={audienceIcon(post) as never} size={13} color={MUTED} />
          </View>
          <Text style={styles.feedMeta}>{relativeTime(post.created_at)}</Text>
        </View>
        {badge ? <View style={styles.postTypeBadge}><Text style={styles.postTypeBadgeText}>{badge}</Text></View> : null}
      </View>
      {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" /> : null}
      {post.post_type === 'recommendation' ? <PlaceRecommendationSummary metadata={post.metadata} /> : null}
      {post.body ? <Text style={styles.feedBody}>{post.body}</Text> : null}
      <PostTagSummary metadata={post.metadata} />
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
      <Pressable style={styles.fullButton} onPress={() => router.push('/local-events/create')}>
        <Text style={styles.primaryButtonText}>Plan a meetup</Text>
      </Pressable>
    </View>
  );
}

export default function CommunityScreen() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [circles, setCircles] = useState<CommunityCircle[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CommunityTab>('campfire');

  const [composerBody, setComposerBody] = useState('');
  const [composerType, setComposerType] = useState<CommunityPostType>('update');
  const [composerAudience, setComposerAudience] = useState<CommunityAudience>('everyone');
  const [composerCircleId, setComposerCircleId] = useState<string | null>(null);
  const [composerGroupId, setComposerGroupId] = useState<string | null>(null);
  const [composerPhoto, setComposerPhoto] = useState<PickedPhoto | null>(null);
  const [placeRecommendation, setPlaceRecommendation] = useState<PlaceRecommendationValue>(EMPTY_PLACE_RECOMMENDATION);
  const [postTagging, setPostTagging] = useState<PostTaggingValue>(EMPTY_POST_TAGGING);
  const [typeOpen, setTypeOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextGroups, nextCircles, nextPosts, basecamp] = await Promise.all([getGroups(), getCircles(), getCommunityFeed(), getMemberBasecamp()]);
      setGroups(nextGroups);
      setCircles(nextCircles);
      setPosts(nextPosts);
      setHomeCity(basecamp.profile?.home_city ?? null);
      setHomeState(basecamp.profile?.home_state ?? null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Campfire.');
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
  const selectedType = postTypes.find((item) => item.value === composerType) ?? postTypes[0]!;
  const selectedAudience = audiences.find((item) => item.value === composerAudience) ?? audiences[0]!;
  const selectedCircle = circles.find((circle) => circle.id === composerCircleId) ?? null;
  const selectedGroup = yourGroups.find((group) => group.id === composerGroupId) ?? null;
  const targetMissing = (composerAudience === 'circle' && !composerCircleId) || (composerAudience === 'group' && !composerGroupId);
  const recommendationMissing = composerType === 'recommendation' && (!placeRecommendation.name.trim() || !placeRecommendation.location.trim());
  const bodyMissing = composerType !== 'meetup' && !composerBody.trim() && !composerPhoto;
  const cannotPost = submitting || targetMissing || recommendationMissing || bodyMissing;

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

  async function choosePhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to upload a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.88 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setComposerPhoto({ uri: asset.uri, mimeType: asset.mimeType });
  }

  function changeAudience(next: CommunityAudience) {
    setComposerAudience(next);
    setComposerCircleId(null);
    setComposerGroupId(null);
    setAudienceOpen(false);
    setTargetOpen(next === 'circle' || next === 'group');
  }

  async function submitPost() {
    if (composerType === 'meetup') {
      if (targetMissing) return;
      router.push({
        pathname: '/local-events/create',
        params: {
          audience: composerAudience,
          circleId: composerCircleId ?? undefined,
          groupId: composerGroupId ?? undefined,
        },
      });
      return;
    }
    if (cannotPost) return;

    setSubmitting(true);
    setError(null);
    let uploadedPath: string | null = null;
    try {
      if (composerPhoto) uploadedPath = await uploadCommunityPostImage(composerPhoto);
      await createPost({
        body: composerBody,
        postType: composerType,
        audience: composerAudience,
        circleId: composerCircleId,
        groupId: composerGroupId,
        adventureId: selectedGroup?.adventure_id ?? null,
        imagePath: uploadedPath,
        metadata: {
          ...(composerType === 'recommendation' ? placeRecommendationMetadata(placeRecommendation) : {}),
          ...postTaggingMetadata(postTagging),
        },
      });
      setComposerBody('');
      setComposerPhoto(null);
      setPlaceRecommendation(EMPTY_PLACE_RECOMMENDATION);
      setPostTagging(EMPTY_POST_TAGGING);
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

  const visibleGroupList = tab === 'nearby' ? nearbyGroups : groups;

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
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Campfire</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={MUTED} />
              <Text style={styles.subtitle}>{locationLabel} · {yourGroups.length} groups{nearbyCount ? ` · ${nearbyCount} adventurer${nearbyCount === 1 ? '' : 's'} nearby` : ''}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/notifications')}><Ionicons name="notifications-outline" size={23} color={TEXT} /></Pressable>
            <Pressable style={styles.profileButton} onPress={() => router.push('/member/profile')}><Ionicons name="person" size={17} color={TEXT} /></Pressable>
          </View>
        </View>

        <View style={styles.tabs}>
          {([['campfire', 'Campfire'], ['nearby', 'Nearby'], ['crew', 'Crew'], ['groups', 'Groups']] as const).map(([value, label]) => (
            <Pressable key={value} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}>
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? <ActivityIndicator color={GOLD} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'campfire' ? (
          <>
            <View style={styles.composer}>
              {composerPhoto ? (
                <View style={styles.composerPhotoWrap}>
                  <Image source={{ uri: composerPhoto.uri }} style={styles.composerPhoto} resizeMode="cover" />
                  <Pressable style={styles.removePhotoButton} onPress={() => setComposerPhoto(null)}>
                    <Ionicons name="close" size={18} color={TEXT} />
                  </Pressable>
                </View>
              ) : null}

              <TextInput
                value={composerBody}
                onChangeText={setComposerBody}
                placeholder={placeholderFor(composerType)}
                placeholderTextColor="#7F8B83"
                multiline
                blurOnSubmit={false}
                maxLength={4000}
                style={styles.composerInput}
              />

              {composerType === 'recommendation' ? (
                <PlaceRecommendationFields value={placeRecommendation} onChange={setPlaceRecommendation} />
              ) : null}

              <PostTaggingFields groups={groups} value={postTagging} onChange={setPostTagging} />

              <View style={styles.composerControls}>
                <Pressable style={styles.compactControl} onPress={() => void choosePhoto()}>
                  <Ionicons name="image-outline" size={18} color={GOLD_MUTED} />
                  <Text style={styles.compactControlText}>{composerPhoto ? 'Change photo' : 'Upload photo'}</Text>
                </Pressable>

                <Pressable style={styles.compactControl} onPress={() => { setTypeOpen((value) => !value); setAudienceOpen(false); setTargetOpen(false); }}>
                  <Ionicons name={selectedType.icon as never} size={18} color={GOLD_MUTED} />
                  <Text style={styles.compactControlText}>{selectedType.label}</Text>
                  <Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={15} color={MUTED} />
                </Pressable>
              </View>

              {typeOpen ? (
                <View style={styles.dropdown}>
                  {postTypes.map((item) => (
                    <Pressable key={item.value} style={styles.dropdownRow} onPress={() => { setComposerType(item.value); setTypeOpen(false); }}>
                      <Ionicons name={item.icon as never} size={18} color={item.value === composerType ? GOLD : MUTED} />
                      <Text style={[styles.dropdownText, item.value === composerType && styles.dropdownTextActive]}>{item.label}</Text>
                      {item.value === composerType ? <Ionicons name="checkmark" size={17} color={GOLD} /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={styles.composerFooter}>
                <Pressable style={styles.shareControl} onPress={() => { setAudienceOpen((value) => !value); setTypeOpen(false); setTargetOpen(false); }}>
                  <Ionicons name={selectedAudience.icon as never} size={16} color={GOLD} />
                  <Text style={styles.shareText}>Share with {selectedAudience.label}</Text>
                  <Ionicons name={audienceOpen ? 'chevron-up' : 'chevron-down'} size={14} color={MUTED} />
                </Pressable>

                <Pressable disabled={cannotPost} style={[styles.postButton, cannotPost && styles.postButtonDisabled]} onPress={() => void submitPost()}>
                  {submitting ? <ActivityIndicator size="small" color="#101510" /> : <Text style={styles.postButtonText}>{composerType === 'meetup' ? 'Set up meetup' : 'Post'}</Text>}
                </Pressable>
              </View>

              {audienceOpen ? (
                <View style={styles.dropdown}>
                  {audiences.map((item) => (
                    <Pressable key={item.value} style={styles.dropdownRow} onPress={() => changeAudience(item.value)}>
                      <Ionicons name={item.icon as never} size={18} color={item.value === composerAudience ? GOLD : MUTED} />
                      <Text style={[styles.dropdownText, item.value === composerAudience && styles.dropdownTextActive]}>{item.label}</Text>
                      {item.value === composerAudience ? <Ionicons name="checkmark" size={17} color={GOLD} /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {(composerAudience === 'circle' || composerAudience === 'group') ? (
                <View>
                  <Pressable style={styles.targetControl} onPress={() => setTargetOpen((value) => !value)}>
                    <Text style={styles.targetControlText}>
                      {composerAudience === 'circle' ? selectedCircle?.name ?? 'Choose a Crew' : selectedGroup?.name ?? 'Choose a Group'}
                    </Text>
                    <Ionicons name={targetOpen ? 'chevron-up' : 'chevron-down'} size={15} color={MUTED} />
                  </Pressable>
                  {targetOpen ? (
                    <View style={styles.targetList}>
                      {(composerAudience === 'circle' ? circles : yourGroups).map((target) => (
                        <Pressable
                          key={target.id}
                          style={styles.dropdownRow}
                          onPress={() => {
                            if (composerAudience === 'circle') setComposerCircleId(target.id);
                            else setComposerGroupId(target.id);
                            setTargetOpen(false);
                          }}
                        >
                          <Text style={styles.dropdownText}>{target.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {composerType === 'meetup' ? (
                <Text style={styles.meetupHint}>Meetups continue into the event setup for date, time, location, and capacity.</Text>
              ) : null}
            </View>

            <View style={styles.feedSectionHeader}>
              <Text style={styles.feedSectionLabel}>Around the Campfire</Text>
              <Text style={styles.feedSectionHint}>Posts you can see from the Campfire, Trailmates, Crews, and Groups</Text>
            </View>

            {posts.map((post) => <CommunityPostCard key={post.id} post={post} />)}
            {!posts.length && !loading ? (
              <View style={styles.emptyFeed}>
                <Ionicons name="create-outline" size={24} color={GOLD} />
                <Text style={styles.emptyFeedTitle}>Start the conversation</Text>
                <Text style={styles.emptyFeedText}>Write something above, add a photo if you want, and post it without leaving the Campfire.</Text>
              </View>
            ) : null}

            <NearbyEventCard location={locationLabel} />
            <CircleGateway />

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>Your Groups</Text>
                <Pressable onPress={() => setTab('groups')}><Text style={styles.link}>Manage</Text></Pressable>
              </View>
              <View style={styles.groupList}>
                {yourGroups.slice(0, 3).map((group) => <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
                {!yourGroups.length && !loading ? <Text style={styles.emptyText}>Join a few groups and they’ll live here.</Text> : null}
              </View>
            </View>
          </>
        ) : tab === 'crew' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.flexHeading}>
                <Text style={styles.sectionHeading}>Your Crew</Text>
                <Text style={styles.sectionSubheading}>Your Trailmates, organized your way.</Text>
              </View>
              <Ionicons name="people-circle-outline" size={22} color={GOLD_MUTED} />
            </View>
            <CircleGateway compact />
            <View style={styles.groupList}>
              {circles.map((crew) => <CrewRow key={crew.id} crew={crew} />)}
              {!circles.length && !loading ? <Text style={styles.emptyText}>Create a crew to organize the Trailmates you adventure with most.</Text> : null}
            </View>
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.flexHeading}>
                <Text style={styles.sectionHeading}>{tab === 'nearby' ? 'Near You' : 'Groups'}</Text>
                <Text style={styles.sectionSubheading}>{tab === 'nearby' ? `People, groups, and adventures around ${locationLabel}.` : 'Adventure communities you belong to or can discover.'}</Text>
              </View>
              {tab === 'nearby' ? <Ionicons name="navigate-outline" size={22} color={GOLD_MUTED} /> : <Ionicons name="people-outline" size={22} color={GOLD_MUTED} />}
            </View>
            <View style={styles.groupList}>
              {visibleGroupList.map((group) => <GroupRow key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
              {!visibleGroupList.length && !loading ? <Text style={styles.emptyText}>Nothing here yet. Pull to refresh or check back as the Campfire grows.</Text> : null}
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
  tabText: { color: '#A4ADA7', fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: GOLD },
  loader: { marginVertical: 3 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 10, borderRadius: 12 },

  composer: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 11, gap: 9 },
  composerInput: { minHeight: 64, maxHeight: 150, color: TEXT, fontSize: 15, lineHeight: 21, paddingHorizontal: 3, paddingVertical: 5, textAlignVertical: 'top' },
  composerPhotoWrap: { position: 'relative' },
  composerPhoto: { width: '100%', height: 180, borderRadius: 13, backgroundColor: '#101813' },
  removePhotoButton: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(15,23,19,0.88)', alignItems: 'center', justifyContent: 'center' },
  composerControls: { flexDirection: 'row', gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#37443C' },
  compactControl: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#34423A', borderRadius: 11, backgroundColor: '#18231D', paddingHorizontal: 8 },
  compactControlText: { color: '#D8DED9', fontSize: 11.5, fontWeight: '800' },
  dropdown: { borderWidth: 1, borderColor: '#38473E', borderRadius: 12, backgroundColor: '#121C17', overflow: 'hidden' },
  dropdownRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344239' },
  dropdownText: { flex: 1, color: '#CED6D0', fontSize: 12.5, fontWeight: '700' },
  dropdownTextActive: { color: GOLD },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  shareControl: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  shareText: { flex: 1, color: '#B9C2BC', fontSize: 11.5, fontWeight: '700' },
  postButton: { minWidth: 74, minHeight: 38, borderRadius: 11, paddingHorizontal: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  postButtonDisabled: { opacity: 0.38 },
  postButtonText: { color: '#101510', fontWeight: '900', fontSize: 12 },
  targetControl: { minHeight: 40, borderWidth: 1, borderColor: '#34423A', borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetControlText: { flex: 1, color: '#D8DED9', fontSize: 12, fontWeight: '800' },
  targetList: { marginTop: 6, borderWidth: 1, borderColor: '#38473E', borderRadius: 11, overflow: 'hidden' },
  meetupHint: { color: '#8F9B93', fontSize: 11, lineHeight: 15, paddingHorizontal: 2 },

  feedSectionHeader: { paddingHorizontal: 2, paddingTop: 2, gap: 1 },
  feedSectionLabel: { color: TEXT, fontSize: 15, fontWeight: '900' },
  feedSectionHint: { color: '#7F8B83', fontSize: 11.5, lineHeight: 16 },
  feedCard: { backgroundColor: 'transparent', paddingHorizontal: 2, paddingVertical: 9, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26332C' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  feedAvatar: { width: 41, height: 41, borderRadius: 21, borderWidth: 1, borderColor: '#738078', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  feedAvatarImage: { width: '100%', height: '100%' },
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
  flexHeading: { flex: 1 },
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
  crewAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#6C6041', backgroundColor: '#1D3026', alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { color: TEXT, fontWeight: '900', fontSize: 11.5 },
  groupCopy: { flex: 1 },
  groupName: { color: TEXT, fontWeight: '800', fontSize: 13.5 },
  groupMeta: { color: '#8F9B93', fontSize: 11, marginTop: 2 },
  emptyText: { color: '#8F9B93', padding: 14, lineHeight: 19 },
  pressed: { opacity: 0.72 },
});