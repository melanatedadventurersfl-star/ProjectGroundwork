import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  COMMUNITY_VIDEO_MAX_BYTES,
  COMMUNITY_VIDEO_MAX_DURATION_MS,
  createPost,
  getCommunityFeed,
  getGroups,
  joinGroup,
  removeCommunityPostMedia,
  uploadCommunityPostImage,
  uploadCommunityPostVideo,
  type CommunityGroup,
  type CommunityPost,
  type CommunityPostType,
} from './api';
import { PostEngagementBar } from './PostEngagementBar';
import { PostOptionsButton } from './PostOptionsButton';
import { distanceMiles, pointForCity } from '../explore/location';
import { supabase } from '../lib/supabase';
import { getMemberBasecamp } from '../member/api';
import { listLocalEvents, setLocalEventRsvp, type LocalEvent } from '../local-events/api';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const BORDER = '#28362E';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const NEAR_RADIUS_MILES = 50;

type OutpostTab = 'for-you' | 'groups' | 'campfires';
type BasecampFilter = 'for-you' | 'latest' | 'trailmates' | 'communities' | 'nearby';
type CampfireFilter = 'nearby' | 'today' | 'week';
type CommunityFilter = 'all' | 'official' | 'joined' | 'nearby';
type PickedPhoto = { uri: string; mimeType?: string | null };
type PickedVideo = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;
};
type AuthorLocation = { city: string | null; state: string | null };

const tabs: { value: OutpostTab; label: string }[] = [
  { value: 'for-you', label: 'Campfires' },
  { value: 'groups', label: 'Communities' },
  { value: 'campfires', label: 'Outings' },
];

const basecampFilters: { value: BasecampFilter; label: string }[] = [
  { value: 'for-you', label: 'For You' },
  { value: 'latest', label: 'Latest' },
  { value: 'trailmates', label: 'Trailmates' },
  { value: 'communities', label: 'Communities' },
  { value: 'nearby', label: 'Nearby' },
];

const campfireFilters: { value: CampfireFilter; label: string }[] = [
  { value: 'nearby', label: 'Nearby' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
];

const communityFilters: { value: CommunityFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'apps-outline' },
  { value: 'official', label: 'Official', icon: 'checkmark-circle-outline' },
  { value: 'joined', label: 'Joined', icon: 'people-outline' },
  { value: 'nearby', label: 'Near me', icon: 'location-outline' },
];

const postTypes: { value: CommunityPostType; label: string; icon: string }[] = [
  { value: 'update', label: 'Update', icon: 'create-outline' },
  { value: 'ask', label: 'Ask', icon: 'help-circle-outline' },
  { value: 'buddy', label: 'Adventure Buddy', icon: 'people-outline' },
  { value: 'recommendation', label: 'Recommend', icon: 'location-outline' },
  { value: 'meetup', label: 'Outing', icon: 'calendar-outline' },
];

function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
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

function formatDuration(duration?: number | null) {
  if (duration == null) return null;
  const totalSeconds = Math.max(0, Math.round(duration / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(fileSize?: number | null) {
  if (fileSize == null) return null;
  const megabytes = fileSize / (1024 * 1024);
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'number' ? value : null;
}

function formatCampfireTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const prefix = sameDay(date, today) ? 'Today' : sameDay(date, tomorrow) ? 'Tomorrow' : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${prefix} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function isWithinWeek(value: string) {
  const time = new Date(value).getTime();
  const now = Date.now();
  return time >= now && time <= now + (7 * 24 * 60 * 60 * 1000);
}

function isOfficialCommunity(group: CommunityGroup) {
  return group.kind === 'interest';
}

function communityCover(group: CommunityGroup) {
  return group.cover_image_url || group.image_url;
}

function memberLabel(group: CommunityGroup) {
  return `${group.member_count} member${group.member_count === 1 ? '' : 's'}`;
}

function SectionHeading({ title, detail, action, onAction }: { title: string; detail?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.communitySectionHeading}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {detail ? <Text style={styles.communitySectionDetail}>{detail}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable style={styles.sectionAction} onPress={onAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={GOLD} />
        </Pressable>
      ) : null}
    </View>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  const badge = post.post_type === 'ask' ? 'Ask' : post.post_type === 'buddy' ? 'Adventure Buddy' : post.post_type === 'recommendation' ? 'Place' : post.post_type === 'meetup' ? 'Outing' : null;
  const videoDuration = formatDuration(metadataNumber(post.metadata, 'media_duration_ms'));
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
            <Text style={styles.postMeta}>{relativeTime(post.created_at)}</Text>
          </View>
        </Pressable>
        <PostOptionsButton postId={post.id} authorId={post.author_id} body={post.body} />
      </View>
      {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
      {post.media_type === 'video' && post.media_url ? (
        <Pressable
          style={styles.postVideo}
          accessibilityRole="button"
          accessibilityLabel="Play video"
          onPress={(event) => {
            event.stopPropagation();
            void Linking.openURL(post.media_url!);
          }}
        >
          <View style={styles.postVideoPlay}><Ionicons name="play" size={30} color="#101510" /></View>
          <Text style={styles.postVideoTitle}>Play video</Text>
          <Text style={styles.postVideoMeta}>{videoDuration ? `${videoDuration} · ` : ''}Opens in your device player</Text>
        </Pressable>
      ) : post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" /> : null}
      <View style={styles.engagementWrap}>
        <PostEngagementBar postId={post.id} initialReactionCount={post.reaction_count || 0} commentCount={post.comment_count || 0} />
      </View>
    </Pressable>
  );
}

function CommunityCard({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const coverUrl = communityCover(group);
  return (
    <Pressable style={({ pressed }) => [styles.communityCard, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      <View style={styles.communityImageWrap}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.communityImage} /> : <View style={styles.communityFallback}><Text style={styles.communityInitials}>{initials(group.name)}</Text></View>}
      </View>
      <View style={styles.communityInfo}>
        <View style={styles.communityNameLine}>
          <Text style={styles.communityName} numberOfLines={1}>{group.name}</Text>
          {isOfficialCommunity(group) ? <Ionicons name="checkmark-circle" size={14} color={GOLD} /> : null}
        </View>
        <Text style={styles.communityMeta}>{memberLabel(group)}{group.city || group.state ? ` · ${[group.city, group.state].filter(Boolean).join(', ')}` : ''}</Text>
      </View>
      {group.is_member ? <Ionicons name="chevron-forward" size={18} color={MUTED} /> : <Pressable disabled={joining} style={styles.joinPill} onPress={(event) => { event.stopPropagation(); onJoin(group); }}><Text style={styles.joinPillText}>{joining ? 'Joining…' : 'Join'}</Text></Pressable>}
    </Pressable>
  );
}

function OfficialCommunityCard({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const coverUrl = communityCover(group);
  return (
    <Pressable
      style={({ pressed }) => [styles.officialCard, pressed && styles.pressed]}
      onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, official community`}
    >
      {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.officialCardImage} /> : <View style={styles.officialCardFallback}><Text style={styles.officialCardInitials}>{initials(group.name)}</Text></View>}
      <View style={styles.officialCardShade} />
      <View style={styles.officialBadge}><Ionicons name="checkmark" size={11} color="#101510" /><Text style={styles.officialBadgeText}>Official</Text></View>
      {group.is_member ? <View style={styles.joinedBadge}><Ionicons name="checkmark" size={11} color={TEXT} /><Text style={styles.joinedBadgeText}>Joined</Text></View> : null}
      <View style={styles.officialCardContent}>
        <Text style={styles.officialCardTitle} numberOfLines={2}>{group.name}</Text>
        {group.description ? <Text style={styles.officialCardDescription} numberOfLines={2}>{group.description}</Text> : null}
        <View style={styles.officialCardFooter}>
          <Ionicons name="people-outline" size={13} color="#E9EFEA" />
          <Text style={styles.officialCardMeta}>{memberLabel(group)}</Text>
          {!group.is_member ? <Text style={styles.officialJoinText}>{joining ? 'Joining…' : 'Join'}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function YourCommunityRow({ group, latestPost }: { group: CommunityGroup; latestPost?: CommunityPost }) {
  const coverUrl = communityCover(group);
  const activity = latestPost ? `${latestPost.author_name} posted · ${relativeTime(latestPost.created_at)}` : `${memberLabel(group)} · You're joined`;
  return (
    <Pressable style={({ pressed }) => [styles.yourCommunityRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}>
      <View style={styles.yourCommunityImageWrap}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.communityImage} /> : <View style={styles.communityFallback}><Text style={styles.communityInitials}>{initials(group.name)}</Text></View>}
      </View>
      <View style={styles.flex}>
        <Text style={styles.yourCommunityName} numberOfLines={1}>{group.name}</Text>
        <Text style={[styles.yourCommunityActivity, latestPost && styles.yourCommunityActivityLive]} numberOfLines={1}>{activity}</Text>
      </View>
      {latestPost ? <View style={styles.activityDot} /> : null}
      <Ionicons name="chevron-forward" size={18} color={GOLD} />
    </Pressable>
  );
}

function CommunityActivityCard({ post, group }: { post: CommunityPost; group: CommunityGroup }) {
  const coverUrl = communityCover(group);
  return (
    <Pressable style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]} onPress={() => router.push(`/community/${post.id}`)}>
      <View style={styles.activityCardTop}>
        <View style={styles.activityGroupIcon}>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.communityImage} /> : <Text style={styles.activityGroupInitials}>{initials(group.name)}</Text>}
        </View>
        <View style={styles.flex}>
          <Text style={styles.activityGroupName} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.activityMeta}>{post.author_name} · {relativeTime(post.created_at)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={MUTED} />
      </View>
      <Text style={styles.activityBody} numberOfLines={2}>{post.body || (post.media_type === 'video' ? 'Shared a video' : post.image_url ? 'Shared a photo' : 'New community activity')}</Text>
    </Pressable>
  );
}

function DiscoveryCommunityCard({ group, reason, joining, onJoin }: { group: CommunityGroup; reason: string; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  const coverUrl = communityCover(group);
  return (
    <Pressable style={({ pressed }) => [styles.discoveryCard, pressed && styles.pressed]} onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}>
      <View style={styles.discoveryImageWrap}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.discoveryImage} /> : <View style={styles.discoveryFallback}><Text style={styles.discoveryInitials}>{initials(group.name)}</Text></View>}
        {group.is_member ? <View style={styles.discoveryJoined}><Ionicons name="checkmark" size={11} color={TEXT} /><Text style={styles.discoveryJoinedText}>Joined</Text></View> : null}
      </View>
      <View style={styles.discoveryContent}>
        <Text style={styles.discoveryTitle} numberOfLines={1}>{group.name}</Text>
        <Text style={styles.discoveryReason} numberOfLines={1}>{reason}</Text>
        <View style={styles.discoveryFooter}>
          <Text style={styles.discoveryMeta}>{memberLabel(group)}</Text>
          {!group.is_member ? <Text style={styles.discoveryJoin}>{joining ? 'Joining…' : 'Join'}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function CampfireCard({
  event,
  distance,
  onRsvp,
  updating,
}: {
  event: LocalEvent;
  distance: number | null;
  onRsvp: (event: LocalEvent, status: 'going' | 'interested') => void;
  updating: boolean;
}) {
  const locationText = [event.venue_name, event.city].filter(Boolean).join(' · ');
  const distanceText = distance != null ? `${Math.max(1, Math.round(distance))} mi away` : event.state;
  return (
    <Pressable style={({ pressed }) => [styles.campfireCard, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/local-events/[id]', params: { id: event.id } })}>
      <View style={styles.campfireTopRow}>
        <View style={styles.hostAvatar}>
          {event.host_avatar_url ? <Image source={{ uri: event.host_avatar_url }} style={styles.avatarImage} /> : <Text style={styles.hostInitials}>{initials(event.host_name)}</Text>}
        </View>
        <View style={styles.flex}>
          <View style={styles.hostLine}><Text style={styles.hostName}>{event.host_name}</Text><Text style={styles.hostVerb}> planned an outing</Text></View>
          <Text style={styles.campfireTime}>{formatCampfireTime(event.starts_at)}</Text>
        </View>
        <Ionicons name="calendar-outline" size={19} color={GOLD} />
      </View>

      {event.image_url ? <Image source={{ uri: event.image_url }} style={styles.campfireImage} resizeMode="cover" /> : null}
      <Text style={styles.campfireTitle}>{event.title}</Text>
      {event.description ? <Text style={styles.campfireDescription} numberOfLines={3}>{event.description}</Text> : null}

      <View style={styles.campfireLocationRow}>
        <Ionicons name="location-outline" size={15} color={GOLD} />
        <Text style={styles.campfireLocation} numberOfLines={1}>{locationText || `${event.city}, ${event.state}`}</Text>
        <Text style={styles.distanceText}>· {distanceText}</Text>
      </View>

      <View style={styles.campfireFooter}>
        <View style={styles.socialProof}>
          <View style={styles.miniAvatar}><Ionicons name="person" size={11} color={TEXT} /></View>
          <Text style={styles.socialProofText}>{event.rsvp_count ? `${event.rsvp_count} joining` : 'Be the first to join'}</Text>
        </View>
        <View style={styles.rsvpActions}>
          <Pressable
            disabled={updating}
            style={[styles.rsvpButton, event.my_rsvp === 'interested' && styles.rsvpButtonActive]}
            onPress={(pressEvent) => { pressEvent.stopPropagation(); onRsvp(event, 'interested'); }}
          >
            <Text style={[styles.rsvpButtonText, event.my_rsvp === 'interested' && styles.rsvpButtonTextActive]}>Interested</Text>
          </Pressable>
          <Pressable
            disabled={updating}
            style={[styles.rsvpButton, styles.rsvpPrimary, event.my_rsvp === 'going' && styles.rsvpPrimaryActive]}
            onPress={(pressEvent) => { pressEvent.stopPropagation(); onRsvp(event, 'going'); }}
          >
            <Text style={styles.rsvpPrimaryText}>{event.my_rsvp === 'going' ? 'Going ✓' : "I'm in"}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function OutpostScreen() {
  const [tab, setTab] = useState<OutpostTab>('for-you');
  const [basecampFilter, setBasecampFilter] = useState<BasecampFilter>('for-you');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [campfires, setCampfires] = useState<LocalEvent[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [trailmateIds, setTrailmateIds] = useState<string[]>([]);
  const [authorLocations, setAuthorLocations] = useState<Record<string, AuthorLocation>>({});
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('You');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [updatingRsvpId, setUpdatingRsvpId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerBody, setComposerBody] = useState('');
  const [composerType, setComposerType] = useState<CommunityPostType>('update');
  const [composerPhoto, setComposerPhoto] = useState<PickedPhoto | null>(null);
  const [composerVideo, setComposerVideo] = useState<PickedVideo | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [communityQuery, setCommunityQuery] = useState('');
  const [communityFilter, setCommunityFilter] = useState<CommunityFilter>('all');
  const [communitySearchFocused, setCommunitySearchFocused] = useState(false);
  const [campfireFilter, setCampfireFilter] = useState<CampfireFilter>('nearby');

  const load = useCallback(async () => {
    try {
      const [nextPosts, nextGroups, nextCampfires, basecamp] = await Promise.all([
        getCommunityFeed(),
        getGroups(),
        listLocalEvents().catch(() => []),
        getMemberBasecamp(),
      ]);

      setPosts(nextPosts);
      setGroups(nextGroups);
      setCampfires(nextCampfires);
      setHomeCity(basecamp.profile?.home_city ?? null);
      setHomeState(basecamp.profile?.home_state ?? null);
      setProfileAvatarUrl(basecamp.profile?.avatar_url ?? null);
      setProfileName(basecamp.profile?.display_name || basecamp.profile?.username || 'You');

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;

      let nextTrailmateIds: string[] = [];
      if (userId) {
        const { data: connections } = await supabase
          .from('member_connections')
          .select('requester_id,addressee_id')
          .eq('status', 'accepted')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
        nextTrailmateIds = (connections ?? []).map((row) => row.requester_id === userId ? row.addressee_id : row.requester_id);
      }
      setTrailmateIds(nextTrailmateIds);

      const authorIds = [...new Set(nextPosts.map((post) => post.author_id))];
      if (authorIds.length) {
        const { data: profiles } = await supabase
          .from('community_profile_directory')
          .select('id,home_city,home_state')
          .in('id', authorIds);
        const locations: Record<string, AuthorLocation> = {};
        for (const profile of profiles ?? []) {
          locations[profile.id] = { city: profile.home_city ?? null, state: profile.home_state ?? null };
        }
        setAuthorLocations(locations);
      } else {
        setAuthorLocations({});
      }

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
  const selectedType = postTypes.find((item) => item.value === composerType) ?? postTypes[0]!;
  const selectedBasecampFilter = basecampFilters.find((item) => item.value === basecampFilter) ?? basecampFilters[0]!;
  const myGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const discoverGroups = useMemo(() => groups.filter((group) => !group.is_member), [groups]);
  const officialGroups = useMemo(() => groups.filter(isOfficialCommunity), [groups]);
  const homePoint = useMemo(() => homeCity && homeState ? pointForCity(homeCity, homeState) : null, [homeCity, homeState]);
  const trailmateIdSet = useMemo(() => new Set(trailmateIds), [trailmateIds]);
  const myGroupIdSet = useMemo(() => new Set(myGroups.map((group) => group.id)), [myGroups]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);

  const isPostNearby = useCallback((post: CommunityPost) => {
    const location = authorLocations[post.author_id];
    if (!location) return false;
    if (homeCity && homeState && location.city === homeCity && location.state === homeState) return true;
    const authorPoint = location.city && location.state ? pointForCity(location.city, location.state) : null;
    if (homePoint && authorPoint) return distanceMiles(homePoint, authorPoint) <= NEAR_RADIUS_MILES;
    return Boolean(homeState && location.state === homeState && (!homeCity || location.city === homeCity));
  }, [authorLocations, homeCity, homePoint, homeState]);

  const distanceForGroup = useCallback((group: CommunityGroup) => {
    if (!homePoint || !group.city || !group.state) return null;
    const groupPoint = pointForCity(group.city, group.state);
    return groupPoint ? distanceMiles(homePoint, groupPoint) : null;
  }, [homePoint]);

  const isGroupNearby = useCallback((group: CommunityGroup) => {
    if (!group.city && !group.state) return false;
    if (homeCity && homeState && group.city === homeCity && group.state === homeState) return true;
    const distance = distanceForGroup(group);
    if (distance != null) return distance <= NEAR_RADIUS_MILES;
    return Boolean(homeState && group.state === homeState && (!homeCity || group.city === homeCity));
  }, [distanceForGroup, homeCity, homeState]);

  const visiblePosts = useMemo(() => {
    let next = [...posts];

    if (basecampFilter === 'trailmates') next = next.filter((post) => trailmateIdSet.has(post.author_id));
    if (basecampFilter === 'communities') next = next.filter((post) => Boolean(post.group_id && myGroupIdSet.has(post.group_id)));
    if (basecampFilter === 'nearby') next = next.filter(isPostNearby);

    return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [basecampFilter, isPostNearby, myGroupIdSet, posts, trailmateIdSet]);

  const distanceForCampfire = useCallback((event: LocalEvent) => {
    if (!homePoint) return null;
    const eventPoint = pointForCity(event.city, event.state);
    return eventPoint ? distanceMiles(homePoint, eventPoint) : null;
  }, [homePoint]);

  const visibleCampfires = useMemo(() => {
    let next = [...campfires];
    if (campfireFilter === 'today') next = next.filter((event) => isToday(event.starts_at));
    if (campfireFilter === 'week') next = next.filter((event) => isWithinWeek(event.starts_at));
    if (campfireFilter === 'nearby') {
      next = next.filter((event) => {
        const distance = distanceForCampfire(event);
        if (distance != null) return distance <= NEAR_RADIUS_MILES;
        return Boolean(homeState && event.state === homeState && (!homeCity || event.city === homeCity));
      });
    }
    return next.sort((a, b) => {
      const aDistance = distanceForCampfire(a) ?? Number.MAX_SAFE_INTEGER;
      const bDistance = distanceForCampfire(b) ?? Number.MAX_SAFE_INTEGER;
      if (campfireFilter === 'nearby' && aDistance !== bDistance) return aDistance - bDistance;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  }, [campfireFilter, campfires, distanceForCampfire, homeCity, homeState]);

  const aroundState = useMemo(() => {
    if (!homeState || campfireFilter !== 'nearby') return [];
    const visibleIds = new Set(visibleCampfires.map((event) => event.id));
    return campfires
      .filter((event) => event.state === homeState && !visibleIds.has(event.id))
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [campfireFilter, campfires, homeState, visibleCampfires]);

  const latestPostByGroup = useMemo(() => {
    const map = new Map<string, CommunityPost>();
    const orderedPosts = [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (const post of orderedPosts) {
      if (post.group_id && !map.has(post.group_id)) map.set(post.group_id, post);
    }
    return map;
  }, [posts]);

  const communityActivity = useMemo(() => posts
    .filter((post) => Boolean(post.group_id && myGroupIdSet.has(post.group_id) && groupById.has(post.group_id)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3), [groupById, myGroupIdSet, posts]);

  const recommendedGroups = useMemo(() => discoverGroups
    .filter((group) => !isOfficialCommunity(group))
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 8), [discoverGroups]);

  const nearbyGroups = useMemo(() => groups
    .filter(isGroupNearby)
    .sort((a, b) => (distanceForGroup(a) ?? Number.MAX_SAFE_INTEGER) - (distanceForGroup(b) ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 8), [distanceForGroup, groups, isGroupNearby]);

  const filteredCommunityResults = useMemo(() => {
    const query = communityQuery.trim().toLowerCase();
    return groups.filter((group) => {
      const searchable = `${group.name} ${group.description ?? ''} ${group.city ?? ''} ${group.state ?? ''}`.toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (communityFilter === 'official' && !isOfficialCommunity(group)) return false;
      if (communityFilter === 'joined' && !group.is_member) return false;
      if (communityFilter === 'nearby' && !isGroupNearby(group)) return false;
      return true;
    });
  }, [communityFilter, communityQuery, groups, isGroupNearby]);

  const searchMode = Boolean(communityQuery.trim()) || communityFilter !== 'all';
  const showCommunityFilters = communitySearchFocused || searchMode;

  const recommendationReason = useCallback((group: CommunityGroup) => {
    if (isGroupNearby(group)) return homeCity ? `Near ${homeCity}` : 'Near your basecamp';
    if (group.kind === 'adventure') return 'Built around an adventure';
    if (group.city || group.state) return [group.city, group.state].filter(Boolean).join(', ');
    return group.member_count > 0 ? 'Growing in the community' : 'A new space to explore';
  }, [homeCity, isGroupNearby]);

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library access is needed to upload a photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.88 });
    if (!result.canceled && result.assets?.[0]) {
      setComposerVideo(null);
      setComposerPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
    }
  }

  async function chooseVideo() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library access is needed to upload a video.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.duration != null && asset.duration > COMMUNITY_VIDEO_MAX_DURATION_MS) {
      setError('Videos can be up to 60 seconds long.');
      return;
    }
    if (asset.fileSize != null && asset.fileSize > COMMUNITY_VIDEO_MAX_BYTES) {
      setError('Videos can be up to 100 MB.');
      return;
    }
    setComposerPhoto(null);
    setComposerVideo({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      duration: asset.duration,
    });
  }

  async function submitPost() {
    if (composerType === 'meetup') { router.push('/local-events/create'); return; }
    if ((!composerBody.trim() && !composerPhoto && !composerVideo) || submitting) return;
    setSubmitting(true);
    setError(null);
    let uploadedPath: string | null = null;
    try {
      if (composerPhoto) uploadedPath = await uploadCommunityPostImage(composerPhoto);
      if (composerVideo) uploadedPath = await uploadCommunityPostVideo(composerVideo);
      await createPost({
        body: composerBody,
        postType: composerType,
        audience: 'everyone',
        circleId: null,
        groupId: null,
        adventureId: null,
        imagePath: uploadedPath,
        metadata: composerVideo ? {
          media_type: 'video',
          media_mime_type: composerVideo.mimeType ?? null,
          media_file_name: composerVideo.fileName ?? null,
          media_file_size: composerVideo.fileSize ?? null,
          media_duration_ms: composerVideo.duration ?? null,
        } : composerPhoto ? { media_type: 'image' } : {},
      });
      setComposerBody('');
      setComposerPhoto(null);
      setComposerVideo(null);
      setComposerType('update');
      setTypeOpen(false);
      await load();
    } catch (caught) {
      if (uploadedPath) await removeCommunityPostMedia(uploadedPath).catch(() => undefined);
      setError(caught instanceof Error ? caught.message : 'Unable to publish this post.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(group: CommunityGroup) {
    setJoiningId(group.id);
    try { await joinGroup(group.id); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to join this community.'); } finally { setJoiningId(null); }
  }

  async function handleRsvp(event: LocalEvent, status: 'going' | 'interested') {
    setUpdatingRsvpId(event.id);
    try {
      await setLocalEventRsvp(event.id, status);
      setCampfires((current) => current.map((item) => {
        if (item.id !== event.id) return item;
        const wasGoing = item.my_rsvp === 'going';
        const willGo = status === 'going';
        const rsvpDelta = wasGoing === willGo ? 0 : willGo ? 1 : -1;
        return { ...item, my_rsvp: status, rsvp_count: Math.max(0, item.rsvp_count + rsvpDelta) };
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update your Outing RSVP.');
    } finally {
      setUpdatingRsvpId(null);
    }
  }

  const composerVideoDuration = formatDuration(composerVideo?.duration);
  const composerVideoSize = formatFileSize(composerVideo?.fileSize);
  const composerHasMedia = Boolean(composerPhoto || composerVideo);

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
          <View style={styles.tabIntro}><Text style={styles.tabIntroTitle}>Around the Campfire</Text><Text style={styles.tabIntroCopy}>Your people, communities, and nearby conversation in one place.</Text></View>
          <View style={styles.composer}>
            {composerPhoto ? <View style={styles.photoWrap}><Image source={{ uri: composerPhoto.uri }} style={styles.composerPhoto} /><Pressable style={styles.removePhoto} onPress={() => setComposerPhoto(null)}><Ionicons name="close" size={18} color={TEXT} /></Pressable></View> : null}
            {composerVideo ? (
              <View style={styles.composerVideoCard}>
                <View style={styles.composerVideoIcon}><Ionicons name="play" size={19} color="#101510" /></View>
                <View style={styles.flex}>
                  <Text style={styles.composerVideoTitle} numberOfLines={1}>{composerVideo.fileName || 'Selected video'}</Text>
                  <Text style={styles.composerVideoMeta}>{[composerVideoDuration, composerVideoSize].filter(Boolean).join(' · ') || 'Ready to upload'}</Text>
                </View>
                <Pressable onPress={() => setComposerVideo(null)} accessibilityLabel="Remove video"><Ionicons name="close-circle" size={22} color="#FFB4A9" /></Pressable>
              </View>
            ) : null}
            <View style={styles.composerPromptRow}>
              <View style={styles.composerAvatar}>{profileAvatarUrl ? <Image source={{ uri: profileAvatarUrl }} style={styles.avatarImage} /> : <Text style={styles.composerAvatarText}>{initials(profileName)}</Text>}</View>
              <TextInput value={composerBody} onChangeText={setComposerBody} placeholder={composerType === 'ask' ? 'Ask around the Campfire…' : composerType === 'buddy' ? 'Find an adventure buddy…' : composerVideo ? 'Say something about this video…' : 'What’s happening outside?'} placeholderTextColor="#7F8B83" multiline maxLength={4000} style={styles.composerInput} />
            </View>
            <View style={styles.composerActions}>
              <Pressable style={styles.actionButton} onPress={() => void choosePhoto()}><Ionicons name="image-outline" size={16} color={GOLD} /><Text style={styles.actionText}>Photo</Text></Pressable>
              <Pressable style={styles.actionButton} onPress={() => void chooseVideo()}><Ionicons name="videocam-outline" size={16} color={GOLD} /><Text style={styles.actionText}>Video</Text></Pressable>
              <Pressable style={styles.actionButton} onPress={() => setTypeOpen((value) => !value)}><Ionicons name={selectedType.icon as never} size={16} color={GOLD} /><Text style={styles.actionText}>{selectedType.label}</Text><Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={12} color={MUTED} /></Pressable>
              <Pressable disabled={submitting || (composerType !== 'meetup' && !composerBody.trim() && !composerHasMedia)} style={[styles.postButton, (submitting || (composerType !== 'meetup' && !composerBody.trim() && !composerHasMedia)) && styles.disabled]} onPress={() => void submitPost()}><Text style={styles.postButtonText}>{composerType === 'meetup' ? 'Set up' : submitting ? 'Posting…' : 'Post'}</Text></Pressable>
            </View>
            {typeOpen ? <View style={styles.typeMenu}>{postTypes.map((item) => <Pressable key={item.value} style={styles.typeRow} onPress={() => { setComposerType(item.value); setTypeOpen(false); }}><Ionicons name={item.icon as never} size={18} color={item.value === composerType ? GOLD : MUTED} /><Text style={[styles.typeText, item.value === composerType && styles.typeTextActive]}>{item.label}</Text></Pressable>)}</View> : null}
          </View>
          <View style={styles.basecampHeading}><Text style={styles.sectionTitle}>Your Campfire</Text><Text style={styles.basecampMode}>{selectedBasecampFilter.label}</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            {basecampFilters.map((filter) => <Pressable key={filter.value} style={[styles.filterChip, basecampFilter === filter.value && styles.filterChipActive]} onPress={() => setBasecampFilter(filter.value)}><Text style={[styles.filterText, basecampFilter === filter.value && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}
          </ScrollView>
          {visiblePosts.map((post) => <PostCard key={post.id} post={post} />)}
          {!visiblePosts.length && !loading ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{basecampFilter === 'trailmates' ? 'No Trailmate posts yet' : basecampFilter === 'communities' ? 'No community posts yet' : basecampFilter === 'nearby' ? 'Nothing nearby yet' : 'Start the conversation'}</Text><Text style={styles.emptyText}>{basecampFilter === 'latest' || basecampFilter === 'for-you' ? 'Share what you’re doing outside.' : 'Try another filter or add something to the Outpost.'}</Text></View> : null}
        </> : null}

        {tab === 'groups' ? <View style={styles.communitiesExperience}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color={MUTED} />
            <TextInput
              value={communityQuery}
              onChangeText={setCommunityQuery}
              onFocus={() => setCommunitySearchFocused(true)}
              onBlur={() => setCommunitySearchFocused(false)}
              placeholder="Search communities, interests, or locations"
              placeholderTextColor="#77847C"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {communityQuery ? <Pressable onPress={() => setCommunityQuery('')} accessibilityLabel="Clear community search"><Ionicons name="close-circle" size={18} color="#78847D" /></Pressable> : null}
          </View>

          {showCommunityFilters ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityFilterRail} keyboardShouldPersistTaps="handled">
            {communityFilters.map((filter) => <Pressable key={filter.value} style={[styles.communityFilterChip, communityFilter === filter.value && styles.communityFilterChipActive]} onPress={() => setCommunityFilter(filter.value)}>
              <Ionicons name={filter.icon as never} size={14} color={communityFilter === filter.value ? '#101510' : MUTED} />
              <Text style={[styles.communityFilterText, communityFilter === filter.value && styles.communityFilterTextActive]}>{filter.label}</Text>
            </Pressable>)}
          </ScrollView> : null}

          {searchMode ? <>
            <SectionHeading title="Community results" detail={`${filteredCommunityResults.length} match${filteredCommunityResults.length === 1 ? '' : 'es'}`} />
            <View style={styles.cardList}>
              {filteredCommunityResults.map((group) => <CommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
              {!filteredCommunityResults.length ? <View style={styles.emptyCard}><Ionicons name="search-outline" size={26} color={GOLD} /><Text style={styles.emptyTitle}>No communities found</Text><Text style={styles.emptyText}>Try another search or filter.</Text></View> : null}
            </View>
          </> : <>
            <SectionHeading title="Official Communities" detail="Curated by Go Melanated" action="See all" onAction={() => setCommunityFilter('official')} />
            {officialGroups.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.officialRail}>
              {officialGroups.map((group) => <OfficialCommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
            </ScrollView> : <Text style={styles.emptyListText}>Official communities are being prepared.</Text>}

            <SectionHeading title="Your Communities" detail={`${myGroups.length} joined`} action="See all" onAction={() => setCommunityFilter('joined')} />
            <View style={styles.yourCommunityList}>
              {myGroups.slice(0, 5).map((group) => <YourCommunityRow key={group.id} group={group} latestPost={latestPostByGroup.get(group.id)} />)}
              {!myGroups.length ? <View style={styles.emptyCommunityCallout}><Ionicons name="people-outline" size={22} color={GOLD} /><View style={styles.flex}><Text style={styles.emptyCommunityCalloutTitle}>Find your people</Text><Text style={styles.emptyCommunityCalloutText}>Join an official or recommended community to make this space yours.</Text></View></View> : null}
            </View>

            {communityActivity.length ? <>
              <SectionHeading title="Happening in Your Communities" detail="What changed since you checked in" />
              <View style={styles.activityList}>
                {communityActivity.map((post) => {
                  const group = post.group_id ? groupById.get(post.group_id) : undefined;
                  return group ? <CommunityActivityCard key={post.id} post={post} group={group} /> : null;
                })}
              </View>
            </> : null}

            {recommendedGroups.length ? <>
              <SectionHeading title="Recommended for You" detail="More spaces worth exploring" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryRail}>
                {recommendedGroups.map((group) => <DiscoveryCommunityCard key={group.id} group={group} reason={recommendationReason(group)} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
              </ScrollView>
            </> : null}

            {nearbyGroups.length ? <>
              <SectionHeading title={`Near ${homeCity || 'Your Basecamp'}`} detail="Communities connected to your area" action="See all" onAction={() => setCommunityFilter('nearby')} />
              <View style={styles.cardList}>
                {nearbyGroups.slice(0, 4).map((group) => <CommunityCard key={group.id} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
              </View>
            </> : null}

            <Pressable style={({ pressed }) => [styles.exploreAllButton, pressed && styles.pressed]} onPress={() => { setCommunityFilter('all'); setCommunitySearchFocused(true); }}>
              <View style={styles.exploreAllIcon}><Ionicons name="compass-outline" size={18} color={GOLD} /></View>
              <View style={styles.flex}><Text style={styles.exploreAllTitle}>Explore all communities</Text><Text style={styles.exploreAllCopy}>Search by interest, location, or what you want to do next.</Text></View>
              <Ionicons name="chevron-forward" size={18} color={GOLD} />
            </Pressable>
          </>}
        </View> : null}

        {tab === 'campfires' ? <>
          <View style={styles.campfireHeader}>
            <View style={styles.flex}>
              <Text style={styles.campfirePageTitle}>Outings</Text>
              <Text style={styles.campfirePageCopy}>Casual plans to go do something with people in your community.</Text>
            </View>
            <Pressable style={styles.startCampfireCompact} onPress={() => router.push('/local-events/create')}>
              <Ionicons name="add" size={18} color="#101510" />
              <Text style={styles.startCampfireCompactText}>Plan</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            {campfireFilters.map((filter) => <Pressable key={filter.value} style={[styles.filterChip, campfireFilter === filter.value && styles.filterChipActive]} onPress={() => setCampfireFilter(filter.value)}><Text style={[styles.filterText, campfireFilter === filter.value && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}
          </ScrollView>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{campfireFilter === 'nearby' ? 'Happening nearby' : campfireFilter === 'today' ? 'Today' : 'This week'}</Text>
          </View>

          {visibleCampfires.map((event) => <CampfireCard key={event.id} event={event} distance={distanceForCampfire(event)} onRsvp={(nextEvent, status) => void handleRsvp(nextEvent, status)} updating={updatingRsvpId === event.id} />)}

          {!visibleCampfires.length && !loading ? <View style={styles.emptyCard}><Ionicons name="calendar-outline" size={28} color={GOLD} /><Text style={styles.emptyTitle}>No outings here yet</Text><Text style={styles.emptyText}>{campfireFilter === 'nearby' ? 'Plan a casual outing and see who wants to come along.' : 'Try another time filter or plan an Outing.'}</Text><Pressable style={styles.emptyAction} onPress={() => router.push('/local-events/create')}><Text style={styles.emptyActionText}>Plan an Outing</Text></Pressable></View> : null}

          {aroundState.length ? <>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Around {homeState}</Text><Text style={styles.sectionCopy}>A little farther out, still within your state.</Text></View>
            {aroundState.map((event) => <CampfireCard key={event.id} event={event} distance={distanceForCampfire(event)} onRsvp={(nextEvent, status) => void handleRsvp(nextEvent, status)} updating={updatingRsvpId === event.id} />)}
          </> : null}
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
  sectionHeading: { gap: 2, paddingTop: 3 },
  basecampHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 3 },
  basecampMode: { color: GOLD, fontSize: 10.5, fontWeight: '900' },
  sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '900' },
  sectionCopy: { color: '#8F9B93', fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  composer: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 9, gap: 7 },
  composerPromptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#202C25', borderWidth: 1, borderColor: '#34443A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  composerAvatarText: { color: GOLD, fontSize: 10, fontWeight: '900' },
  composerInput: { flex: 1, minHeight: 36, maxHeight: 120, color: TEXT, fontSize: 14.5, lineHeight: 20, paddingHorizontal: 0, paddingVertical: 6, textAlignVertical: 'top' },
  photoWrap: { position: 'relative' },
  composerPhoto: { width: '100%', height: 180, borderRadius: 13, backgroundColor: '#101813' },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(15,23,19,0.88)', alignItems: 'center', justifyContent: 'center' },
  composerVideoCard: { minHeight: 64, borderRadius: 13, borderWidth: 1, borderColor: '#4A4938', backgroundColor: '#1D251F', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9 },
  composerVideoIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  composerVideoTitle: { color: TEXT, fontSize: 12.5, fontWeight: '900' },
  composerVideoMeta: { color: MUTED, fontSize: 10.5, marginTop: 3 },
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#334139', paddingTop: 6 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 31, paddingHorizontal: 6, borderRadius: 9 },
  actionText: { color: '#D8DED9', fontSize: 10.5, fontWeight: '800' },
  postButton: { marginLeft: 'auto', minHeight: 31, paddingHorizontal: 12, borderRadius: 9, backgroundColor: GOLD, justifyContent: 'center' },
  postButtonText: { color: '#101510', fontWeight: '900', fontSize: 11.5 },
  disabled: { opacity: 0.42 },
  typeMenu: { borderWidth: 1, borderColor: '#38473E', borderRadius: 12, overflow: 'hidden', backgroundColor: '#121C17' },
  typeRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344239' },
  typeText: { color: '#CED6D0', fontSize: 12.5, fontWeight: '700' },
  typeTextActive: { color: GOLD },
  postCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 13, gap: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorTarget: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#526158', backgroundColor: '#202B25', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: TEXT, fontWeight: '900', fontSize: 11 },
  authorName: { color: TEXT, fontSize: 15, fontWeight: '900', flexShrink: 1 },
  postMeta: { color: '#8F9B93', fontSize: 11, marginTop: 3 },
  badge: { backgroundColor: '#202B24', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: '#D7C792', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.2 },
  postBody: { color: '#E5E9E6', fontSize: 14, lineHeight: 21 },
  postImage: { width: '100%', height: 230, borderRadius: 13, backgroundColor: '#101813' },
  postVideo: { width: '100%', height: 230, borderRadius: 13, backgroundColor: '#0D1511', borderWidth: 1, borderColor: '#39473F', alignItems: 'center', justifyContent: 'center', gap: 8 },
  postVideoPlay: { width: 58, height: 58, borderRadius: 29, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  postVideoTitle: { color: TEXT, fontSize: 14, fontWeight: '900' },
  postVideoMeta: { color: MUTED, fontSize: 10.5 },
  engagementWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#344139', paddingTop: 5 },

  communitiesExperience: { gap: 12 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#334139', backgroundColor: '#121B16', borderRadius: 15, paddingHorizontal: 13 },
  searchInput: { flex: 1, color: TEXT, fontSize: 13.5, paddingVertical: 10 },
  communityFilterRail: { gap: 7, paddingRight: 8, paddingVertical: 1 },
  communityFilterChip: { minHeight: 34, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1, borderColor: '#37443C', backgroundColor: '#121A16', flexDirection: 'row', alignItems: 'center', gap: 5 },
  communityFilterChipActive: { backgroundColor: GOLD, borderColor: GOLD },
  communityFilterText: { color: MUTED, fontSize: 11, fontWeight: '800' },
  communityFilterTextActive: { color: '#101510' },
  communitySectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingTop: 4 },
  communitySectionDetail: { color: '#86928A', fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 4, paddingLeft: 8 },
  sectionActionText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  officialRail: { gap: 10, paddingRight: 8 },
  officialCard: { width: 172, height: 214, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#4A4938', backgroundColor: '#18221D' },
  officialCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  officialCardFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: '#223129', alignItems: 'center', justifyContent: 'center' },
  officialCardInitials: { color: GOLD, fontSize: 28, fontWeight: '900' },
  officialCardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,7,0.42)' },
  officialBadge: { position: 'absolute', top: 10, left: 10, height: 24, paddingHorizontal: 8, borderRadius: 99, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', gap: 3 },
  officialBadgeText: { color: '#101510', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.35 },
  joinedBadge: { position: 'absolute', top: 10, right: 10, height: 24, paddingHorizontal: 7, borderRadius: 99, backgroundColor: 'rgba(15,23,19,0.86)', flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  joinedBadgeText: { color: TEXT, fontSize: 8.5, fontWeight: '900' },
  officialCardContent: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  officialCardTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 21, fontWeight: '900' },
  officialCardDescription: { color: '#E5ECE7', fontSize: 10.5, lineHeight: 14, marginTop: 5 },
  officialCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 9 },
  officialCardMeta: { color: '#EEF3EF', fontSize: 9.5, fontWeight: '700', flex: 1 },
  officialJoinText: { color: '#F5D66C', fontSize: 10, fontWeight: '900' },
  yourCommunityList: { gap: 8 },
  yourCommunityRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#2D3B33', borderRadius: 16, padding: 8 },
  yourCommunityImageWrap: { width: 50, height: 50, borderRadius: 13, overflow: 'hidden', backgroundColor: '#213229' },
  yourCommunityName: { color: TEXT, fontSize: 14, fontWeight: '900' },
  yourCommunityActivity: { color: '#8D9991', fontSize: 10.5, marginTop: 4 },
  yourCommunityActivityLive: { color: '#C7D0CA' },
  activityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD },
  emptyCommunityCallout: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#3B4235', backgroundColor: '#192019', padding: 13 },
  emptyCommunityCalloutTitle: { color: TEXT, fontSize: 13, fontWeight: '900' },
  emptyCommunityCalloutText: { color: MUTED, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  activityList: { gap: 8 },
  activityCard: { backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#2E3B34', borderRadius: 16, padding: 11, gap: 8 },
  activityCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityGroupIcon: { width: 34, height: 34, borderRadius: 9, overflow: 'hidden', backgroundColor: '#25332B', alignItems: 'center', justifyContent: 'center' },
  activityGroupInitials: { color: GOLD, fontSize: 9, fontWeight: '900' },
  activityGroupName: { color: TEXT, fontSize: 12.5, fontWeight: '900' },
  activityMeta: { color: '#8F9B93', fontSize: 9.5, marginTop: 2 },
  activityBody: { color: '#D9E0DB', fontSize: 12, lineHeight: 17 },
  discoveryRail: { gap: 10, paddingRight: 8 },
  discoveryCard: { width: 186, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#304037', backgroundColor: '#151F1A' },
  discoveryImageWrap: { height: 94, backgroundColor: '#213129' },
  discoveryImage: { width: '100%', height: '100%' },
  discoveryFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24342C' },
  discoveryInitials: { color: GOLD, fontWeight: '900', fontSize: 24 },
  discoveryJoined: { position: 'absolute', top: 8, right: 8, minHeight: 22, paddingHorizontal: 7, borderRadius: 99, backgroundColor: 'rgba(15,23,19,0.88)', flexDirection: 'row', alignItems: 'center', gap: 3 },
  discoveryJoinedText: { color: TEXT, fontSize: 8.5, fontWeight: '900' },
  discoveryContent: { padding: 10 },
  discoveryTitle: { color: TEXT, fontSize: 13.5, fontWeight: '900' },
  discoveryReason: { color: '#A9B5AD', fontSize: 9.5, marginTop: 3 },
  discoveryFooter: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  discoveryMeta: { color: '#849088', fontSize: 9, flex: 1 },
  discoveryJoin: { color: GOLD, fontSize: 10, fontWeight: '900' },
  exploreAllButton: { minHeight: 74, borderRadius: 17, borderWidth: 1, borderColor: '#4A4938', backgroundColor: '#1B211A', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exploreAllIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#262B1B', borderWidth: 1, borderColor: '#47442A', alignItems: 'center', justifyContent: 'center' },
  exploreAllTitle: { color: TEXT, fontSize: 13, fontWeight: '900' },
  exploreAllCopy: { color: MUTED, fontSize: 10, lineHeight: 14, marginTop: 3 },

  cardList: { gap: 9 },
  communityCard: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 15, padding: 9 },
  communityImageWrap: { width: 50, height: 50, borderRadius: 13, overflow: 'hidden', backgroundColor: '#213229' },
  communityImage: { width: '100%', height: '100%' },
  communityFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  communityInitials: { color: GOLD, fontWeight: '900', fontSize: 12 },
  communityInfo: { flex: 1, minWidth: 0 },
  communityNameLine: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  communityName: { color: TEXT, fontSize: 14, fontWeight: '900', flexShrink: 1 },
  communityMeta: { color: MUTED, fontSize: 10.5, marginTop: 4 },
  joinPill: { minWidth: 50, minHeight: 32, paddingHorizontal: 10, borderRadius: 99, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  joinPillText: { color: GOLD, fontSize: 10.5, fontWeight: '900' },
  campfireHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 2 },
  campfirePageTitle: { color: TEXT, fontSize: 24, lineHeight: 28, fontWeight: '900' },
  campfirePageCopy: { color: '#8F9B93', fontSize: 12, lineHeight: 17, marginTop: 2 },
  startCampfireCompact: { minHeight: 38, paddingHorizontal: 13, borderRadius: 12, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  startCampfireCompactText: { color: '#101510', fontSize: 12, fontWeight: '900' },
  filterRail: { gap: 7, paddingRight: 8, paddingVertical: 1 },
  filterChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 99, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#121A16' },
  filterChipActive: { borderColor: '#8D8638', backgroundColor: '#2D2C1A' },
  filterText: { color: '#ABB5AE', fontSize: 11.5, fontWeight: '800' },
  filterTextActive: { color: '#F1D879' },
  campfireCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 13, gap: 10 },
  campfireTopRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  campfireImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: '#101813' },
  hostAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#263229', borderWidth: 1, borderColor: '#425148', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hostInitials: { color: GOLD, fontSize: 10, fontWeight: '900' },
  hostLine: { flexDirection: 'row', alignItems: 'baseline', minWidth: 0 },
  hostName: { color: TEXT, fontSize: 12.5, fontWeight: '900', flexShrink: 1 },
  hostVerb: { color: MUTED, fontSize: 11 },
  campfireTime: { color: GOLD, fontSize: 10.5, fontWeight: '800', marginTop: 2 },
  campfireTitle: { color: TEXT, fontSize: 17, lineHeight: 21, fontWeight: '900' },
  campfireDescription: { color: '#D3DAD5', fontSize: 12.5, lineHeight: 18 },
  campfireLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  campfireLocation: { color: '#C8D1CB', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  distanceText: { color: '#98A39C', fontSize: 10.5, flexShrink: 0 },
  campfireFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#344139', paddingTop: 10, gap: 9 },
  socialProof: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#28362E', alignItems: 'center', justifyContent: 'center' },
  socialProofText: { color: MUTED, fontSize: 10.5, fontWeight: '700' },
  rsvpActions: { flexDirection: 'row', gap: 7 },
  rsvpButton: { flex: 1, minHeight: 36, borderRadius: 11, borderWidth: 1, borderColor: '#3B4A41', alignItems: 'center', justifyContent: 'center' },
  rsvpButtonActive: { borderColor: GOLD, backgroundColor: '#292817' },
  rsvpButtonText: { color: '#C7D0CA', fontSize: 11.5, fontWeight: '900' },
  rsvpButtonTextActive: { color: GOLD },
  rsvpPrimary: { borderColor: '#586B5E', backgroundColor: '#233029' },
  rsvpPrimaryActive: { borderColor: GOLD, backgroundColor: '#302E18' },
  rsvpPrimaryText: { color: TEXT, fontSize: 11.5, fontWeight: '900' },
  emptyCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 22, alignItems: 'center', gap: 7 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '900' },
  emptyText: { color: MUTED, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  emptyAction: { marginTop: 5, minHeight: 38, paddingHorizontal: 14, borderRadius: 11, backgroundColor: GOLD, justifyContent: 'center' },
  emptyActionText: { color: '#101510', fontSize: 11.5, fontWeight: '900' },
  emptyListText: { color: MUTED, fontSize: 12, lineHeight: 17, textAlign: 'center', padding: 16 },
  pressed: { opacity: 0.72 },
});