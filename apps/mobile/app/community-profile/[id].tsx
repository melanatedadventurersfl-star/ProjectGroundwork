import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../src/lib/supabase';
import { ProfilePosts } from '../../src/member/ProfilePosts';
import { BadgeArt, hasBadgeArt } from '../../src/passport/BadgeArt';
import { RankEmblem, rankFor, rankLadder } from '../../src/passport/RankEmblem';
import { STAMP_CATALOG } from '../../src/passport/StampCatalog';
import { AppIcon } from '../../src/ui/AppIcon';
import {
  getCommunityProfile,
  getConnectionStatus,
  getViewerInterests,
  requestConnection,
  respondToConnection,
  type CommunityFeaturedBadge,
  type CommunityFeaturedStamp,
  type CommunityProfile,
  type ConnectionStatus,
} from '../../src/social/api';

type ProfileTab = 'journey' | 'posts' | 'photos';

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
  if (url) return <Image source={{ uri: url }} style={styles.avatar} />;
  return <View style={styles.avatar}><Text style={styles.avatarText}>{String(name ?? 'A').slice(0, 1).toUpperCase()}</Text></View>;
}

function FeaturedBadge({ badge }: { badge: CommunityFeaturedBadge }) {
  return <View style={styles.badgeCard}>
    {hasBadgeArt(badge.title)
      ? <BadgeArt title={badge.title} size={72} />
      : <View style={styles.genericBadge}><AppIcon name="badge" color="#F5C341" size={30} /></View>}
    <Text style={styles.badgeTitle} numberOfLines={2}>{badge.title}</Text>
  </View>;
}

function FeaturedStamp({ stamp }: { stamp: CommunityFeaturedStamp }) {
  const art = STAMP_CATALOG.find(item => (stamp.code && item.code === stamp.code) || item.title.toLowerCase() === stamp.title.toLowerCase());
  return <View style={styles.stampCard}>
    {art
      ? <Image source={art.source} style={styles.stampImage} resizeMode="contain" />
      : <View style={styles.genericStamp}><AppIcon name="adventure" color="#F5C341" size={34} /></View>}
    <Text style={styles.stampTitle} numberOfLines={2}>{stamp.title}</Text>
  </View>;
}

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [viewerInterests, setViewerInterests] = useState<string[]>([]);
  const [canViewAsMember, setCanViewAsMember] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('journey');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [nextProfile, connection, interests, viewAsGate] = await Promise.all([
        getCommunityProfile(id),
        getConnectionStatus(id),
        getViewerInterests(),
        supabase.rpc('can_view_as_member'),
      ]);
      setProfile(nextProfile);
      setConnectionStatus(connection.status);
      setConnectionId(connection.connectionId);
      setViewerInterests(interests);
      setCanViewAsMember(!viewAsGate.error && viewAsGate.data === true);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this member profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function act(action: 'request' | 'accept' | 'decline') {
    if (!id) return;
    setWorking(true);
    try {
      if (action === 'request') await requestConnection(id);
      if (action === 'accept' && connectionId) await respondToConnection(connectionId, 'accepted');
      if (action === 'decline' && connectionId) await respondToConnection(connectionId, 'declined');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this friend connection.');
    } finally {
      setWorking(false);
    }
  }

  const adventureCount = profile?.adventure_count ?? 0;
  const rank = useMemo(() => rankFor(adventureCount), [adventureCount]);
  const currentRank = useMemo(() => rankLadder.find(([name]) => name === rank), [rank]);
  const nextRank = useMemo(() => rankLadder.find(([, minimum]) => minimum > adventureCount), [adventureCount]);
  const remaining = nextRank ? Math.max(0, nextRank[1] - adventureCount) : 0;
  const rankProgress = useMemo(() => {
    if (!nextRank) return 1;
    const floor = currentRank?.[1] ?? 0;
    const span = Math.max(1, nextRank[1] - floor);
    return Math.min(1, Math.max(0, (adventureCount - floor) / span));
  }, [adventureCount, currentRank, nextRank]);
  const viewerInterestSet = useMemo(
    () => new Set(viewerInterests.map(interest => interest.trim().toLowerCase())),
    [viewerInterests],
  );

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>;
  if (!profile) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Profile not found.'}</Text></SafeAreaView>;

  const location = [profile.home_city, profile.home_state].filter(Boolean).join(', ');
  const isSelf = connectionStatus === 'self';
  const isConnected = connectionStatus === 'accepted';
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (isSelf) {
    router.replace('/member/profile');
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>;
  }

  const relationshipAction = !isConnected ? <View style={styles.relationshipArea}>
    {(connectionStatus === 'none' || connectionStatus === 'declined') ? <Pressable disabled={working} style={styles.primaryButton} onPress={() => void act('request')}>
      <AppIcon name="connections" color="#17211C" size={18} />
      <Text style={styles.primaryButtonText}>{working ? 'Sending…' : 'Add Friend'}</Text>
    </Pressable> : null}
    {connectionStatus === 'pending_sent' ? <View style={styles.stateCard}>
      <AppIcon name="checkmark" color="#F5C341" size={19} />
      <View style={styles.stateCopy}><Text style={styles.stateTitle}>Friend request sent</Text><Text style={styles.stateBody}>Waiting for this member to accept.</Text></View>
    </View> : null}
    {connectionStatus === 'pending_received' ? <View style={styles.stateCardColumn}>
      <Text style={styles.stateTitle}>Friend request</Text>
      <Text style={styles.stateBody}>This member wants to connect with you.</Text>
      <View style={styles.buttonRow}>
        <Pressable disabled={working} style={styles.primarySmall} onPress={() => void act('accept')}><Text style={styles.primaryButtonText}>Accept</Text></Pressable>
        <Pressable disabled={working} style={styles.secondarySmall} onPress={() => void act('decline')}><Text style={styles.secondaryText}>Decline</Text></Pressable>
      </View>
    </View> : null}
  </View> : null;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.coverShell}>
        {profile.cover_url
          ? <Image source={{ uri: profile.cover_url }} style={styles.coverImage} />
          : <View style={styles.coverPlaceholder}><View style={styles.coverAccent} /><AppIcon name="adventure" color="#D7B45A" size={28} /></View>}
        <View style={styles.coverShade} />
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <AppIcon name="chevron-forward" color="#FFF8E8" size={25} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
      </View>

      <View style={styles.identityActionsRow}>
        <View style={styles.avatarWrap}><Avatar url={profile.avatar_url} name={profile.display_name} /></View>
        <View style={styles.profileActionStack}>
          {canViewAsMember ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View as ${profile.display_name ?? 'member'}`}
            style={styles.viewAsPill}
            onPress={() => router.push(`/member/view-as-profile/${profile.id}` as never)}
          >
            <AppIcon name="privacy" color="#17211C" size={16} />
            <Text style={styles.viewAsPillText}>View As</Text>
          </Pressable> : null}
          {isConnected ? <View style={styles.connectedPill}>
            <AppIcon name="connections" color="#F7F8F3" size={17} />
            <Text style={styles.connectedPillText}>Friends</Text>
          </View> : null}
        </View>
      </View>

      <View style={styles.identityCopy}>
        <Text style={styles.name} numberOfLines={2}>{profile.display_name ?? 'Adventurer'}</Text>
        {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
        {location ? <View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={16} /><Text style={styles.location}>{location}</Text></View> : null}
      </View>

      <View style={styles.rankBlock}>
        <View style={styles.rankHeader}>
          <RankEmblem rank={rank} size={34} />
          <View style={styles.rankCopy}>
            <Text style={styles.rankTitle}>{rank}</Text>
            <Text style={styles.rankMeta}>{nextRank ? `${remaining} adventure${remaining === 1 ? '' : 's'} to ${nextRank[0]}` : 'Highest rank reached'}</Text>
          </View>
        </View>
        <View style={styles.rankTrack}><View style={[styles.rankFill, { width: `${Math.max(8, rankProgress * 100)}%` }]} /></View>
      </View>

      {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

      {profile.interests?.length ? <View style={styles.headerChips}>
        {profile.interests.map(interest => {
          const shared = viewerInterestSet.has(interest.trim().toLowerCase());
          return <View key={interest} style={[styles.headerChip, shared && styles.headerChipShared]}>
            <Text style={[styles.headerChipText, shared && styles.headerChipTextShared]}>{interest}</Text>
          </View>;
        })}
      </View> : null}

      {profile.can_see_full_profile ? <View style={styles.statsGrid}>
        <View style={styles.statCell}><Text style={styles.statValue}>{profile.stamp_count}</Text><Text style={styles.statLabel}>Stamps</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}><Text style={styles.statValue}>{profile.badge_count}</Text><Text style={styles.statLabel}>Badges</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}><Text style={styles.statValue}>{profile.adventure_count}</Text><Text style={styles.statLabel}>Adventures</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}><Text style={styles.statValue}>{profile.post_count}</Text><Text style={styles.statLabel}>Posts</Text></View>
      </View> : null}

      <View style={styles.joinedRow}><AppIcon name="calendar" color="#8F9A94" size={15} /><Text style={styles.joinedText}>Joined {joined}</Text></View>
      {relationshipAction}

      {!profile.can_see_full_profile ? <View style={styles.privateCard}>
        <AppIcon name="privacy" color="#F5C341" size={24} />
        <View style={styles.stateCopy}><Text style={styles.privateTitle}>Private account</Text><Text style={styles.stateBody}>Additional profile details are shared with approved friends.</Text></View>
      </View> : <>
        <View style={styles.tabs}>
          {(['journey', 'posts', 'photos'] as ProfileTab[]).map(value => <Pressable key={value} onPress={() => setTab(value)} style={styles.tab}>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text>
            {tab === value ? <View style={styles.tabUnderline} /> : null}
          </Pressable>)}
        </View>

        {tab === 'journey' ? <>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Badge Showcase</Text><Text style={styles.sectionSub}>{profile.badge_count ? `${profile.badge_count} earned` : 'Milestones earned'}</Text></View>
            {profile.badge_count > 0 ? <Text style={styles.sectionAction}>See all</Text> : null}
          </View>
          {profile.featured_badges.length
            ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>{profile.featured_badges.map(badge => <FeaturedBadge key={badge.badge_id} badge={badge} />)}</ScrollView>
            : <View style={styles.empty}><Text style={styles.emptyTitle}>No badges earned yet</Text><Text style={styles.muted}>Milestones they earn will appear here.</Text></View>}

          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Featured Stamps</Text><Text style={styles.sectionSub}>{profile.stamp_count ? `${profile.stamp_count} earned` : 'Adventure stamps'}</Text></View>
          </View>
          {profile.featured_stamps.length
            ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stampsRow}>{profile.featured_stamps.map(stamp => <FeaturedStamp key={stamp.stamp_id} stamp={stamp} />)}</ScrollView>
            : <View style={styles.empty}><Text style={styles.emptyTitle}>No stamps earned yet</Text><Text style={styles.muted}>Official Adventure stamps will appear here after they earn them.</Text></View>}
        </> : null}

        {tab === 'posts' ? <ProfilePosts profileId={profile.id} /> : null}

        {tab === 'photos' ? <View style={styles.photosSection}>
          <View><Text style={styles.sectionTitle}>Photos</Text><Text style={styles.photosIntro}>Adventure moments this member has shared.</Text></View>
          {profile.photo_albums.map(album => <View key={album.adventure_id} style={styles.photoAlbumRow}>
            {album.cover_url && /^(https?:|data:)/i.test(album.cover_url)
              ? <Image source={{ uri: album.cover_url }} style={styles.albumThumb} />
              : <View style={styles.albumThumbPlaceholder}><AppIcon name="photos" color="#D7B45A" size={23} /></View>}
            <View style={styles.albumCopy}><Text style={styles.albumTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.albumMeta}>{album.photo_count} photo{album.photo_count === 1 ? '' : 's'}</Text></View>
          </View>)}
          {!profile.photo_albums.length ? <View style={styles.photoEmpty}><AppIcon name="photos" color="#D7B45A" size={28} /><Text style={styles.emptyTitle}>No shared adventure photos yet</Text><Text style={styles.muted}>Public and friend-visible memories will collect here.</Text></View> : null}
        </View> : null}
      </>}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  center: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { paddingBottom: 104, gap: 13 },
  coverShell: { height: 252, overflow: 'hidden', backgroundColor: '#111A17', position: 'relative' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,8,.10)' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102019', overflow: 'hidden' },
  coverAccent: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245,195,65,.06)', right: -50, top: -90 },
  backButton: { position: 'absolute', top: 14, left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,17,15,.72)' },
  identityActionsRow: { minHeight: 58, marginTop: -49, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 3 },
  avatarWrap: { width: 102, height: 102, borderRadius: 51, borderWidth: 4, borderColor: '#09110F', backgroundColor: '#09110F' },
  avatar: { width: 94, height: 94, borderRadius: 47, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '900', color: '#121A17' },
  profileActionStack: { alignItems: 'flex-end', gap: 7, marginBottom: 8 },
  viewAsPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#D7B45A', backgroundColor: '#F5C341', borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 },
  viewAsPillText: { color: '#17211C', fontWeight: '900', fontSize: 12.5 },
  connectedPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#62734E', backgroundColor: '#26372D', borderRadius: 999, paddingHorizontal: 17, paddingVertical: 10 },
  connectedPillText: { color: '#F7F8F3', fontWeight: '900', fontSize: 13 },
  identityCopy: { paddingHorizontal: 20, gap: 4 },
  name: { fontSize: 29, fontWeight: '900', lineHeight: 33, color: '#F7F8F3', letterSpacing: -.45 },
  handle: { color: '#D6B85D', fontSize: 13, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  location: { color: '#AEB9B4', fontSize: 14 },
  rankBlock: { marginHorizontal: 20, marginTop: 3, gap: 10 },
  rankHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankCopy: { flex: 1, gap: 1 },
  rankTitle: { color: '#F7F8F3', fontSize: 16, fontWeight: '900' },
  rankMeta: { color: '#AEB8B2', fontSize: 12.5, fontWeight: '700' },
  rankTrack: { width: '42%', minWidth: 180, height: 6, borderRadius: 999, backgroundColor: '#202A26', overflow: 'hidden' },
  rankFill: { height: '100%', borderRadius: 999, backgroundColor: '#F5C341' },
  bioText: { color: '#E2E7E3', fontSize: 14.5, lineHeight: 21, paddingHorizontal: 20, marginTop: 3 },
  headerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  headerChip: { backgroundColor: '#213129', borderWidth: 1, borderColor: '#33463A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  headerChipShared: { backgroundColor: '#5B4618', borderColor: '#C99A2C' },
  headerChipText: { color: '#C8D0CB', fontSize: 11.5, fontWeight: '800' },
  headerChipTextShared: { color: '#FFE7A1' },
  statsGrid: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'stretch', paddingVertical: 7, marginTop: 3 },
  statCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  statValue: { color: '#F5C341', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#AEB8B2', fontSize: 11.5, fontWeight: '700' },
  statDivider: { width: 1, backgroundColor: '#303A35', marginVertical: 3 },
  joinedRow: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 7 },
  joinedText: { color: '#8F9A94', fontSize: 12, fontWeight: '700' },
  relationshipArea: { paddingHorizontal: 20 },
  primaryButton: { backgroundColor: '#F5C341', borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#17211C', fontWeight: '900', fontSize: 13 },
  stateCard: { backgroundColor: '#17211C', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#2E3D34', flexDirection: 'row', alignItems: 'center', gap: 10 },
  stateCardColumn: { backgroundColor: '#17211C', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2E3D34', gap: 5 },
  stateCopy: { flex: 1 },
  stateTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  stateBody: { color: '#AEB8B2', lineHeight: 18, fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 9, marginTop: 8 },
  primarySmall: { flex: 1, backgroundColor: '#F5C341', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  secondarySmall: { flex: 1, borderWidth: 1, borderColor: '#536159', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  secondaryText: { color: '#FFF8E8', fontWeight: '800' },
  privateCard: { marginHorizontal: 20, backgroundColor: '#101714', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#29342E', flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  privateTitle: { color: '#F7F8F3', fontSize: 17, fontWeight: '900' },
  tabs: { marginTop: 5, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#26312C' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 13, paddingBottom: 12, position: 'relative' },
  tabText: { color: '#9CA7A1', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: '#F7F8F3' },
  tabUnderline: { position: 'absolute', bottom: -1, left: 24, right: 24, height: 3, borderRadius: 3, backgroundColor: '#F5C341' },
  sectionHeader: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  sectionTitle: { color: '#F7F8F3', fontSize: 20, fontWeight: '900' },
  sectionSub: { color: '#8F9A94', fontSize: 11, fontWeight: '700', marginTop: 2 },
  sectionAction: { color: '#F5C341', fontSize: 12.5, fontWeight: '900' },
  badgesRow: { gap: 10, paddingHorizontal: 20, paddingRight: 28 },
  badgeCard: { width: 116, minHeight: 118, backgroundColor: '#101714', borderRadius: 16, borderWidth: 1, borderColor: '#24312A', padding: 11, alignItems: 'center', justifyContent: 'center', gap: 7 },
  badgeTitle: { color: '#E5EAE7', fontSize: 10.5, fontWeight: '800', textAlign: 'center' },
  genericBadge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#26372D', alignItems: 'center', justifyContent: 'center' },
  stampsRow: { gap: 10, paddingHorizontal: 20, paddingRight: 28 },
  stampCard: { width: 116, minHeight: 122, backgroundColor: '#101714', borderRadius: 16, borderWidth: 1, borderColor: '#24312A', padding: 10, alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  stampImage: { width: 72, height: 72 },
  genericStamp: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#26372D', alignItems: 'center', justifyContent: 'center' },
  stampTitle: { color: '#E5EAE7', fontSize: 10, lineHeight: 13, fontWeight: '800', textAlign: 'center' },
  empty: { marginHorizontal: 20, backgroundColor: '#101714', borderRadius: 16, borderWidth: 1, borderColor: '#24312A', padding: 16, gap: 4 },
  emptyTitle: { color: '#E7ECE9', fontWeight: '900', fontSize: 14 },
  muted: { color: '#96A39B', lineHeight: 19, fontSize: 12.5 },
  photosSection: { gap: 10, paddingHorizontal: 20 },
  photosIntro: { color: '#96A39B', marginTop: 2, fontSize: 12.5 },
  photoAlbumRow: { backgroundColor: '#101714', borderRadius: 15, borderWidth: 1, borderColor: '#24312A', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  albumThumb: { width: 62, height: 62, borderRadius: 11, resizeMode: 'cover' },
  albumThumbPlaceholder: { width: 62, height: 62, borderRadius: 11, backgroundColor: '#18231E', alignItems: 'center', justifyContent: 'center' },
  albumCopy: { flex: 1 },
  albumTitle: { color: '#F0F3F1', fontWeight: '900', fontSize: 13 },
  albumMeta: { color: '#67CFC8', marginTop: 3, fontSize: 11, fontWeight: '800' },
  photoEmpty: { backgroundColor: '#101714', borderRadius: 16, borderWidth: 1, borderColor: '#24312A', padding: 20, alignItems: 'center', gap: 6 },
  error: { color: '#F0A39A', textAlign: 'center', marginHorizontal: 20, marginTop: 8 },
});
