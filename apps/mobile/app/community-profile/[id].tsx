import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfilePosts } from '../../src/member/ProfilePosts';
import { RankEmblem, rankFor, rankLadder } from '../../src/passport/RankEmblem';
import { AppIcon } from '../../src/ui/AppIcon';
import {
  getCommunityProfile,
  getConnectionStatus,
  requestConnection,
  respondToConnection,
  type CommunityProfile,
  type ConnectionStatus,
} from '../../src/social/api';

type ProfileTab = 'journey' | 'posts' | 'photos';

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
  if (url) return <Image source={{ uri: url }} style={styles.avatar} />;
  return <View style={styles.avatar}><Text style={styles.avatarText}>{String(name ?? 'A').slice(0, 1).toUpperCase()}</Text></View>;
}

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>('journey');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [nextProfile, connection] = await Promise.all([getCommunityProfile(id), getConnectionStatus(id)]);
      setProfile(nextProfile);
      setConnectionStatus(connection.status);
      setConnectionId(connection.connectionId);
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
      setError(caught instanceof Error ? caught.message : 'Unable to update this Trailmate connection.');
    } finally {
      setWorking(false);
    }
  }

  const rank = useMemo(() => rankFor(profile?.adventure_count ?? 0), [profile?.adventure_count]);
  const nextRank = useMemo(
    () => rankLadder.find(([, minimum]) => minimum > (profile?.adventure_count ?? 0)),
    [profile?.adventure_count],
  );
  const remaining = nextRank ? Math.max(0, nextRank[1] - (profile?.adventure_count ?? 0)) : 0;

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
      <Text style={styles.primaryButtonText}>{working ? 'Sending…' : 'Add Trailmate'}</Text>
    </Pressable> : null}
    {connectionStatus === 'pending_sent' ? <View style={styles.stateCard}>
      <AppIcon name="checkmark" color="#F5C341" size={19} />
      <View style={styles.stateCopy}><Text style={styles.stateTitle}>Request sent</Text><Text style={styles.stateBody}>Waiting for this member to accept.</Text></View>
    </View> : null}
    {connectionStatus === 'pending_received' ? <View style={styles.stateCardColumn}>
      <Text style={styles.stateTitle}>Trailmate request</Text>
      <Text style={styles.stateBody}>This member wants to connect with you.</Text>
      <View style={styles.buttonRow}>
        <Pressable disabled={working} style={styles.primarySmall} onPress={() => void act('accept')}><Text style={styles.primaryButtonText}>Accept</Text></Pressable>
        <Pressable disabled={working} style={styles.secondarySmall} onPress={() => void act('decline')}><Text style={styles.secondaryText}>Decline</Text></Pressable>
      </View>
    </View> : null}
  </View> : null;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <AppIcon name="chevron-forward" color="#F5C341" size={26} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        {isConnected ? <View style={styles.connectedPill}><AppIcon name="checkmark" color="#BFE2C9" size={16} /><Text style={styles.connectedPillText}>Trailmates</Text></View> : null}
      </View>

      <View style={styles.coverShell}>
        {profile.cover_url
          ? <Image source={{ uri: profile.cover_url }} style={styles.coverImage} />
          : <View style={styles.coverPlaceholder}><View style={styles.coverAccent} /><AppIcon name="adventure" color="#D7B45A" size={28} /></View>}
        <View style={styles.coverShade} />
      </View>

      <View style={styles.profileIdentity}>
        <View style={styles.avatarWrap}><Avatar url={profile.avatar_url} name={profile.display_name} /></View>
        <View style={styles.identityCopy}>
          <Text style={styles.name} numberOfLines={2}>{profile.display_name ?? 'Adventurer'}</Text>
          {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
          {location ? <View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={14} /><Text style={styles.location}>{location}</Text></View> : null}
          <View style={styles.rankLine}>
            <RankEmblem rank={rank} size={24} />
            <Text style={styles.rankLineText}>{rank.toUpperCase()}</Text>
            <Text style={styles.rankLineMeta}>{nextRank ? `· ${remaining} to ${nextRank[0]}` : '· Highest rank'}</Text>
          </View>
        </View>
      </View>

      {profile.can_see_full_profile ? <View style={styles.statLine}>
        <View style={styles.statLink}><Text style={styles.statValue}>{profile.adventure_count}</Text><Text style={styles.statLabel}>Adventures</Text></View>
        <Text style={styles.statDot}>•</Text>
        <View style={styles.statLink}><Text style={styles.statValue}>{profile.post_count}</Text><Text style={styles.statLabel}>Posts</Text></View>
      </View> : null}

      {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}
      {profile.interests?.length ? <View style={styles.headerChips}>{profile.interests.map(interest => <Text key={interest} style={styles.headerChip}>{interest}</Text>)}</View> : null}
      <Text style={styles.joinedText}>Joined {joined}</Text>
      {relationshipAction}

      {!profile.can_see_full_profile ? <View style={styles.privateCard}>
        <AppIcon name="privacy" color="#F5C341" size={24} />
        <View style={styles.stateCopy}><Text style={styles.privateTitle}>Private account</Text><Text style={styles.stateBody}>Additional profile details are shared with approved Trailmates.</Text></View>
      </View> : <>
        <View style={styles.tabs}>
          {(['journey', 'posts', 'photos'] as ProfileTab[]).map(value => <Pressable key={value} onPress={() => setTab(value)} style={styles.tab}>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text>
            {tab === value ? <View style={styles.tabUnderline} /> : null}
          </Pressable>)}
        </View>

        {tab === 'journey' ? <View style={styles.journeySection}>
          <View style={styles.journeyCard}>
            <View style={styles.journeyIcon}><RankEmblem rank={rank} size={42} /></View>
            <View style={styles.journeyCopy}>
              <Text style={styles.journeyEyebrow}>CURRENT RANK</Text>
              <Text style={styles.journeyTitle}>{rank}</Text>
              <Text style={styles.journeyBody}>{profile.adventure_count > 0 ? `${profile.adventure_count} adventure${profile.adventure_count === 1 ? '' : 's'} completed` : 'Their adventure journey is just getting started.'}</Text>
              {nextRank ? <Text style={styles.journeyProgress}>{remaining} more to {nextRank[0]}</Text> : <Text style={styles.journeyProgress}>Highest rank reached</Text>}
            </View>
          </View>
        </View> : null}

        {tab === 'posts' ? <ProfilePosts profileId={profile.id} /> : null}

        {tab === 'photos' ? <View style={styles.photosSection}>
          <View><Text style={styles.sectionTitle}>Photos</Text><Text style={styles.photosIntro}>Adventure moments this member has shared.</Text></View>
          {profile.photo_albums.map(album => <View key={album.adventure_id} style={styles.photoAlbumRow}>
            {album.cover_url && /^(https?:|data:)/i.test(album.cover_url)
              ? <Image source={{ uri: album.cover_url }} style={styles.albumThumb} />
              : <View style={styles.albumThumbPlaceholder}><AppIcon name="photos" color="#D7B45A" size={23} /></View>}
            <View style={styles.albumCopy}><Text style={styles.albumTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.albumMeta}>{album.photo_count} photo{album.photo_count === 1 ? '' : 's'}</Text></View>
          </View>)}
          {!profile.photo_albums.length ? <View style={styles.photoEmpty}><AppIcon name="photos" color="#D7B45A" size={28} /><Text style={styles.emptyTitle}>No shared adventure photos yet</Text><Text style={styles.muted}>Public and Trailmate-visible memories will collect here.</Text></View> : null}
        </View> : null}
      </>}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  center: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 108, gap: 11 },
  topBar: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  connectedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#395043', backgroundColor: '#17211C', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  connectedPillText: { color: '#BFE2C9', fontWeight: '900', fontSize: 12 },
  coverShell: { aspectRatio: 12 / 5, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#27332F', backgroundColor: '#111A17', position: 'relative' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,8,.08)' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102019', overflow: 'hidden' },
  coverAccent: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245,195,65,.06)', right: -50, top: -90 },
  profileIdentity: { flexDirection: 'row', alignItems: 'flex-end', gap: 11, marginTop: -38, paddingHorizontal: 10, zIndex: 2 },
  avatarWrap: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: '#09110F', backgroundColor: '#09110F' },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 29, fontWeight: '900', color: '#121A17' },
  identityCopy: { flex: 1, minWidth: 0, paddingBottom: 1 },
  name: { fontSize: 25, fontWeight: '900', lineHeight: 28, color: '#F7F8F3', letterSpacing: -.35 },
  handle: { color: '#F5C341', fontSize: 13, fontWeight: '800', marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  location: { color: '#AEB9B4', fontSize: 13 },
  rankLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rankLineText: { color: '#F7F8F3', fontSize: 11.5, fontWeight: '900', letterSpacing: .5 },
  rankLineMeta: { color: '#67CFC8', fontSize: 10.5, fontWeight: '800' },
  statLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 8, gap: 7, marginTop: 1 },
  statLink: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { color: '#F5C341', fontSize: 15, fontWeight: '900' },
  statLabel: { color: '#D6DDD8', fontSize: 11, fontWeight: '800' },
  statDot: { color: '#54625A', fontSize: 11 },
  bioText: { color: '#E2E7E3', fontSize: 14, lineHeight: 20, paddingHorizontal: 8 },
  headerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 8 },
  headerChip: { color: '#E6D083', backgroundColor: '#26372D', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, fontSize: 11, fontWeight: '800' },
  joinedText: { color: '#67CFC8', fontSize: 11, fontWeight: '800', paddingHorizontal: 8 },
  relationshipArea: { paddingHorizontal: 8 },
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
  privateCard: { backgroundColor: '#101714', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#29342E', flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  privateTitle: { color: '#F7F8F3', fontSize: 17, fontWeight: '900' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#26312C', marginTop: 2 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 11, paddingBottom: 10, position: 'relative' },
  tabText: { color: '#A7B1AB', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: '#F7F8F3' },
  tabUnderline: { position: 'absolute', bottom: -1, left: 22, right: 22, height: 3, borderRadius: 3, backgroundColor: '#F5C341' },
  journeySection: { paddingTop: 2 },
  journeyCard: { backgroundColor: '#101714', borderRadius: 18, borderWidth: 1, borderColor: '#24312A', padding: 17, flexDirection: 'row', alignItems: 'center', gap: 14 },
  journeyIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#18231E', alignItems: 'center', justifyContent: 'center' },
  journeyCopy: { flex: 1, minWidth: 0 },
  journeyEyebrow: { color: '#67CFC8', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  journeyTitle: { color: '#F7F8F3', fontSize: 19, fontWeight: '900', marginTop: 2 },
  journeyBody: { color: '#C7D0CB', fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  journeyProgress: { color: '#F5C341', fontSize: 11, fontWeight: '800', marginTop: 5 },
  sectionTitle: { color: '#F7F8F3', fontSize: 20, fontWeight: '900' },
  emptyTitle: { color: '#E7ECE9', fontWeight: '900', fontSize: 14 },
  muted: { color: '#96A39B', lineHeight: 19, fontSize: 12.5 },
  photosSection: { gap: 10 },
  photosIntro: { color: '#96A39B', marginTop: 2, fontSize: 12.5 },
  photoAlbumRow: { backgroundColor: '#101714', borderRadius: 15, borderWidth: 1, borderColor: '#24312A', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  albumThumb: { width: 62, height: 62, borderRadius: 11, resizeMode: 'cover' },
  albumThumbPlaceholder: { width: 62, height: 62, borderRadius: 11, backgroundColor: '#18231E', alignItems: 'center', justifyContent: 'center' },
  albumCopy: { flex: 1 },
  albumTitle: { color: '#F0F3F1', fontWeight: '900', fontSize: 13 },
  albumMeta: { color: '#67CFC8', marginTop: 3, fontSize: 11, fontWeight: '800' },
  photoEmpty: { backgroundColor: '#101714', borderRadius: 16, borderWidth: 1, borderColor: '#24312A', padding: 20, alignItems: 'center', gap: 6 },
  error: { color: '#F0A39A', textAlign: 'center', marginTop: 8 },
});
