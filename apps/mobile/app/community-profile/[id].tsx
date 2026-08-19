import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfilePosts } from '../../src/member/ProfilePosts';
import { RankEmblem, rankFor } from '../../src/passport/RankEmblem';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';
import {
  getCommunityProfile,
  getConnectionStatus,
  removeConnection,
  requestConnection,
  respondToConnection,
  type CommunityProfile,
  type ConnectionStatus,
} from '../../src/social/api';

type ProfileTab = 'journey' | 'posts' | 'about';

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
  if (url) return <Image source={{ uri: url }} style={styles.avatar} />;
  return <View style={styles.avatar}><Text style={styles.avatarText}>{String(name ?? 'A').slice(0, 1).toUpperCase()}</Text></View>;
}

function Stat({ icon, value, label }: { icon: AppIconName; value: number; label: string }) {
  return <View style={styles.statCell}>
    <AppIcon name={icon} color="#F5C341" size={18} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>;
}

function CollectionCard({ icon, value, label }: { icon: AppIconName; value: number; label: string }) {
  return <View style={styles.collectionCard}>
    <View style={styles.collectionIcon}><AppIcon name={icon} color="#F5C341" size={24} /></View>
    <View>
      <Text style={styles.collectionValue}>{value}</Text>
      <Text style={styles.collectionLabel}>{label}</Text>
    </View>
  </View>;
}

function humanizeRole(value?: string | null) {
  if (!value || value === 'member') return null;
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
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

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function act(action: 'request' | 'accept' | 'decline' | 'remove') {
    if (!id) return;
    setWorking(true);
    try {
      if (action === 'request') await requestConnection(id);
      if (action === 'accept' && connectionId) await respondToConnection(connectionId, 'accepted');
      if (action === 'decline' && connectionId) await respondToConnection(connectionId, 'declined');
      if (action === 'remove' && connectionId) await removeConnection(connectionId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this Trailmate connection.');
    } finally {
      setWorking(false);
    }
  }

  const rank = useMemo(() => rankFor(profile?.adventure_count ?? 0), [profile?.adventure_count]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>;
  if (!profile) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Profile not found.'}</Text></SafeAreaView>;

  const location = [profile.home_city, profile.home_state].filter(Boolean).join(', ');
  const isSelf = connectionStatus === 'self';
  const platformRole = humanizeRole(profile.platform_role);
  const hostRole = humanizeRole(profile.event_host_level);
  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  const relationshipAction = !isSelf ? <View style={styles.relationshipWrap}>
    {(connectionStatus === 'none' || connectionStatus === 'declined') ? <Pressable disabled={working} style={styles.primaryButton} onPress={() => void act('request')}>
      <AppIcon name="connections" color="#17211C" size={19} />
      <Text style={styles.primaryButtonText}>{working ? 'Sending…' : 'Add Trailmate'}</Text>
    </Pressable> : null}
    {connectionStatus === 'pending_sent' ? <View style={styles.stateCard}>
      <View style={styles.stateIcon}><AppIcon name="checkmark" color="#F5C341" size={22} /></View>
      <View style={styles.stateCopy}><Text style={styles.stateTitle}>Request sent</Text><Text style={styles.stateBody}>You’ll become Trailmates when they accept.</Text></View>
    </View> : null}
    {connectionStatus === 'pending_received' ? <View style={styles.stateCardColumn}>
      <Text style={styles.stateTitle}>Trailmate request</Text>
      <Text style={styles.stateBody}>This member wants to become a Trailmate.</Text>
      <View style={styles.buttonRow}>
        <Pressable disabled={working} style={styles.primarySmall} onPress={() => void act('accept')}><Text style={styles.primaryButtonText}>Accept</Text></Pressable>
        <Pressable disabled={working} style={styles.secondarySmall} onPress={() => void act('decline')}><Text style={styles.secondaryText}>Decline</Text></Pressable>
      </View>
    </View> : null}
    {connectionStatus === 'accepted' ? <View style={styles.connectedCard}>
      <View style={styles.connectedLeft}><AppIcon name="checkmark" color="#BFE2C9" size={20} /><View><Text style={styles.connectedText}>Trailmates</Text><Text style={styles.stateBody}>Connected across Campfire and your Crew.</Text></View></View>
      <Pressable disabled={working} onPress={() => void act('remove')}><Text style={styles.removeText}>Remove</Text></Pressable>
    </View> : null}
  </View> : null;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={10}>
          <AppIcon name="chevron-forward" color="#F5C341" size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        {isSelf ? <Pressable style={styles.editPill} onPress={() => router.push('/member/profile?edit=1')}><AppIcon name="edit" color="#F5C341" size={15} /><Text style={styles.editPillText}>Edit profile</Text></Pressable> : null}
      </View>

      <View style={styles.profileHeaderCard}>
        <View style={styles.identityRankRow}>
          <View style={styles.identityCluster}>
            <Avatar url={profile.avatar_url} name={profile.display_name} />
            <View style={styles.heroCopy}>
              <Text style={styles.name} numberOfLines={2}>{profile.display_name ?? 'Adventurer'}</Text>
              {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
              {location ? <View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={15} /><Text style={styles.location}>{location}</Text></View> : null}
              <View style={styles.metaRow}>
                {platformRole ? <Text style={styles.rolePill}>{platformRole}</Text> : null}
                {hostRole ? <Text style={styles.rolePill}>{hostRole}</Text> : null}
                <Text style={styles.memberSince}>Member since {memberSince}</Text>
              </View>
            </View>
          </View>
          <View style={styles.rankIdentity}>
            <RankEmblem rank={rank} size={50} />
            <Text style={styles.rankCompact}>{rank.toUpperCase()}</Text>
          </View>
        </View>

        {profile.bio ? <Text style={styles.bio} numberOfLines={3}>{profile.bio}</Text> : null}

        {profile.can_see_full_profile ? <View style={styles.statsCard}>
          <Stat icon="adventure" value={profile.adventure_count} label="Adventures" />
          <Stat icon="stamp" value={profile.stamp_count} label="Stamps" />
          <Stat icon="badge" value={profile.badge_count} label="Badges" />
          <Stat icon="photos" value={profile.post_count} label="Posts" />
        </View> : null}

        {relationshipAction}
      </View>

      {!profile.can_see_full_profile ? <View style={styles.privateCard}>
        <AppIcon name="privacy" color="#F5C341" size={24} />
        <View style={styles.privateCopy}><Text style={styles.privateTitle}>Private account</Text><Text style={styles.stateBody}>Additional profile details are shared with approved Trailmates.</Text></View>
      </View> : <>
        <View style={styles.tabs}>
          {(['journey', 'posts', 'about'] as ProfileTab[]).map(value => <Pressable key={value} style={styles.tab} onPress={() => setTab(value)}>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text>
            {tab === value ? <View style={styles.tabIndicator} /> : null}
          </Pressable>)}
        </View>

        {tab === 'journey' ? <View style={styles.journeyStack}>
          <View style={styles.journeyHero}>
            <View style={styles.journeyIcon}><AppIcon name="adventure" color="#F5C341" size={28} /></View>
            <View style={styles.journeyCopy}>
              <Text style={styles.cardTitle}>Adventure Journey</Text>
              <Text style={styles.journeyMeta}>{rank} • {profile.stamp_count} stamp{profile.stamp_count === 1 ? '' : 's'}</Text>
              <Text style={styles.muted}>{profile.adventure_count ? `${profile.adventure_count} completed adventure${profile.adventure_count === 1 ? '' : 's'} and counting.` : 'Their trail story is just getting started.'}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Adventure highlights</Text>{profile.adventure_count > 0 ? <Text style={styles.sectionAction}>{profile.adventure_count} completed</Text> : null}</View>
            {profile.adventure_count > 0 ? <View style={styles.highlightRow}>
              <View style={styles.highlightIcon}><AppIcon name="trips" color="#F5C341" size={24} /></View>
              <View style={styles.highlightCopy}><Text style={styles.highlightTitle}>Trail history unlocked</Text><Text style={styles.muted}>Completed adventures will continue building this member’s journey.</Text></View>
            </View> : <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><AppIcon name="adventure" color="#7F8D85" size={25} /></View>
              <Text style={styles.emptyTitle}>The trail starts here</Text>
              <Text style={styles.emptyBody}>When they log an adventure, their milestones will begin appearing here.</Text>
            </View>}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Collections</Text></View>
            <View style={styles.collectionGrid}>
              <CollectionCard icon="stamp" value={profile.stamp_count} label="Stamps earned" />
              <CollectionCard icon="badge" value={profile.badge_count} label="Badges earned" />
            </View>
          </View>

          {profile.post_count > 0 ? <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Campfire activity</Text><Pressable onPress={() => setTab('posts')}><Text style={styles.sectionAction}>View posts</Text></Pressable></View>
            <View style={styles.highlightRow}><View style={styles.highlightIcon}><AppIcon name="community" color="#F5C341" size={24} /></View><View style={styles.highlightCopy}><Text style={styles.highlightTitle}>{profile.post_count} published post{profile.post_count === 1 ? '' : 's'}</Text><Text style={styles.muted}>See what they’ve shared with the community.</Text></View></View>
          </View> : null}
        </View> : null}

        {tab === 'posts' ? <ProfilePosts profileId={profile.id} /> : null}

        {tab === 'about' ? <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>About</Text>
          {profile.bio ? <Text style={styles.aboutBio}>{profile.bio}</Text> : <Text style={styles.muted}>They haven’t added an about section yet.</Text>}
          {profile.pronouns ? <><Text style={styles.sectionLabel}>PRONOUNS</Text><Text style={styles.muted}>{profile.pronouns}</Text></> : null}
          {profile.interests?.length ? <><Text style={styles.sectionLabel}>INTERESTS</Text><View style={styles.chips}>{profile.interests.map(interest => <Text key={interest} style={styles.chip}>{interest}</Text>)}</View></> : null}
          <Text style={styles.sectionLabel}>MEMBER SINCE</Text>
          <Text style={styles.muted}>{new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        </View> : null}
      </>}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B110E' },
  center: { flex: 1, backgroundColor: '#0B110E', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 96, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#2A352F', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111815' },
  editPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#4B4A34', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  editPillText: { color: '#F5C341', fontWeight: '800', fontSize: 12 },
  profileHeaderCard: { backgroundColor: '#101714', borderRadius: 24, borderWidth: 1, borderColor: '#29342E', padding: 16, gap: 14 },
  identityRankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  identityCluster: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: '#F5C341', backgroundColor: '#26372D', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '900', color: '#F7F8F3' },
  heroCopy: { flex: 1, minWidth: 0 },
  name: { color: '#F7F8F3', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  handle: { color: '#F5C341', fontWeight: '800', marginTop: 2, fontSize: 14 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  location: { color: '#C4CCC7', fontSize: 13 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  rolePill: { color: '#DCE8DF', backgroundColor: '#294132', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  memberSince: { color: '#7F8D85', fontSize: 10, fontWeight: '700' },
  rankIdentity: { alignItems: 'center', minWidth: 68, paddingTop: 2 },
  rankCompact: { color: '#F5C341', fontSize: 9, fontWeight: '900', marginTop: 4, maxWidth: 72, textAlign: 'center' },
  bio: { color: '#D4DBD7', fontSize: 14, lineHeight: 20 },
  statsCard: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#29342E', paddingTop: 14 },
  statCell: { flex: 1, alignItems: 'center', gap: 2, borderRightWidth: 1, borderRightColor: '#252F2A' },
  statValue: { color: '#F7F8F3', fontWeight: '900', fontSize: 18 },
  statLabel: { color: '#8F9C95', fontSize: 9, fontWeight: '700' },
  relationshipWrap: { gap: 10 },
  primaryButton: { backgroundColor: '#F5C341', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  primaryButtonText: { color: '#17211C', fontWeight: '900', fontSize: 14 },
  stateCard: { backgroundColor: '#17211C', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#2E3D34', flexDirection: 'row', alignItems: 'center', gap: 10 },
  stateCardColumn: { backgroundColor: '#17211C', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2E3D34', gap: 5 },
  stateIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#27352E', alignItems: 'center', justifyContent: 'center' },
  stateCopy: { flex: 1 },
  stateTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  stateBody: { color: '#AEB8B2', lineHeight: 18, fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 9, marginTop: 8 },
  primarySmall: { flex: 1, backgroundColor: '#F5C341', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  secondarySmall: { flex: 1, borderWidth: 1, borderColor: '#536159', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  secondaryText: { color: '#FFF8E8', fontWeight: '800' },
  connectedCard: { backgroundColor: '#17211C', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#395043', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  connectedLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  connectedText: { color: '#BFE2C9', fontWeight: '900', fontSize: 14 },
  removeText: { color: '#C8B986', fontWeight: '700', fontSize: 11 },
  privateCard: { backgroundColor: '#101714', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#29342E', flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  privateCopy: { flex: 1, gap: 4 },
  privateTitle: { color: '#F7F8F3', fontSize: 18, fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: '#101714', borderRadius: 16, borderWidth: 1, borderColor: '#29342E', overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 13, paddingBottom: 11, position: 'relative' },
  tabText: { color: '#8F9C95', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: '#F7F8F3' },
  tabIndicator: { position: 'absolute', left: 18, right: 18, bottom: 0, height: 3, borderRadius: 3, backgroundColor: '#F5C341' },
  journeyStack: { gap: 12 },
  journeyHero: { backgroundColor: '#101714', borderRadius: 20, borderWidth: 1, borderColor: '#29342E', padding: 16, flexDirection: 'row', gap: 12 },
  journeyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#26372D', alignItems: 'center', justifyContent: 'center' },
  journeyCopy: { flex: 1, gap: 4 },
  journeyMeta: { color: '#F5C341', fontWeight: '800', fontSize: 12 },
  sectionCard: { backgroundColor: '#101714', borderRadius: 18, borderWidth: 1, borderColor: '#29342E', padding: 15, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: '#F7F8F3', fontSize: 16, fontWeight: '900' },
  sectionAction: { color: '#F5C341', fontSize: 11, fontWeight: '800' },
  cardTitle: { color: '#F7F8F3', fontSize: 20, fontWeight: '900' },
  muted: { color: '#96A39B', lineHeight: 19, fontSize: 13 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#141D19', borderRadius: 14, padding: 12 },
  highlightIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#26372D', alignItems: 'center', justifyContent: 'center' },
  highlightCopy: { flex: 1, gap: 2 },
  highlightTitle: { color: '#E6EBE8', fontWeight: '900', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, gap: 6 },
  emptyIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#18211D', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { color: '#E8ECE9', fontWeight: '900', fontSize: 15 },
  emptyBody: { color: '#87948D', lineHeight: 18, fontSize: 12, textAlign: 'center' },
  collectionGrid: { flexDirection: 'row', gap: 10 },
  collectionCard: { flex: 1, minHeight: 92, backgroundColor: '#141D19', borderRadius: 14, padding: 12, gap: 8, justifyContent: 'space-between' },
  collectionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#26372D', alignItems: 'center', justifyContent: 'center' },
  collectionValue: { color: '#F7F8F3', fontWeight: '900', fontSize: 20 },
  collectionLabel: { color: '#8F9C95', fontSize: 10, fontWeight: '700' },
  aboutBio: { color: '#D4DBD7', lineHeight: 21 },
  sectionLabel: { color: '#7F8D85', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { color: '#F0D083', backgroundColor: '#26372D', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '700' },
  error: { color: '#F0A39A', textAlign: 'center', marginTop: 8 },
});
