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
  return <View style={styles.statItem}>
    <AppIcon name={icon} color="#F5C341" size={16} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>;
}

function CollectionCard({ icon, value, label }: { icon: AppIconName; value: number; label: string }) {
  return <View style={styles.collectionCard}>
    <View style={styles.collectionIcon}><AppIcon name={icon} color="#F5C341" size={24} /></View>
    <Text style={styles.collectionValue}>{value}</Text>
    <Text style={styles.collectionLabel}>{label}</Text>
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

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>;
  if (!profile) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Profile not found.'}</Text></SafeAreaView>;

  const location = [profile.home_city, profile.home_state].filter(Boolean).join(', ');
  const isSelf = connectionStatus === 'self';
  const isConnected = connectionStatus === 'accepted';
  const platformRole = humanizeRole(profile.platform_role);
  const hostRole = humanizeRole(profile.event_host_level);
  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const relationshipAction = !isSelf && !isConnected ? <View style={styles.relationshipArea}>
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
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={10}>
          <AppIcon name="chevron-forward" color="#F5C341" size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        {isSelf ? <Pressable style={styles.topAction} onPress={() => router.push('/member/profile?edit=1')}><AppIcon name="edit" color="#F5C341" size={15} /><Text style={styles.topActionText}>Edit profile</Text></Pressable> : null}
        {isConnected ? <View style={styles.connectedPill}>
          <AppIcon name="checkmark" color="#BFE2C9" size={16} />
          <Text style={styles.connectedPillText}>Trailmates</Text>
        </View> : null}
      </View>

      <View style={styles.coverShell}>
        {profile.cover_url ? <Image source={{ uri: profile.cover_url }} style={styles.coverImage} /> : <View style={styles.coverPlaceholder}>
          <AppIcon name="adventure" color="#D7B45A" size={34} />
          <Text style={styles.coverPlaceholderText}>Adventure lives here</Text>
        </View>}
        <View style={styles.coverShade} />
      </View>

      <View style={styles.profileIdentity}>
        <View style={styles.avatarWrap}><Avatar url={profile.avatar_url} name={profile.display_name} /></View>
        <View style={styles.identityCopy}>
          <Text style={styles.name} numberOfLines={2}>{profile.display_name ?? 'Adventurer'}</Text>
          {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
          {location ? <View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={14} /><Text style={styles.location}>{location}</Text></View> : null}
          <View style={styles.rankLine}><RankEmblem rank={rank} size={24} /><Text style={styles.rankLineText}>{rank.toUpperCase()}</Text></View>
        </View>
      </View>

      {(platformRole || hostRole) ? <View style={styles.roleRow}>
        {platformRole ? <Text style={styles.rolePill}>{platformRole}</Text> : null}
        {hostRole ? <Text style={styles.rolePill}>{hostRole}</Text> : null}
      </View> : null}

      {profile.can_see_full_profile ? <View style={styles.statLine}>
        <Stat icon="stamp" value={profile.stamp_count} label="Stamps" />
        <Text style={styles.statDot}>•</Text>
        <Stat icon="badge" value={profile.badge_count} label="Badges" />
        <Text style={styles.statDot}>•</Text>
        <Stat icon="adventure" value={profile.adventure_count} label="Adventures" />
        <Text style={styles.statDot}>•</Text>
        <Stat icon="photos" value={profile.post_count} label="Posts" />
      </View> : null}

      {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}
      {profile.interests?.length ? <View style={styles.headerChips}>{profile.interests.map(interest => <Text key={interest} style={styles.headerChip}>{interest}</Text>)}</View> : null}
      <Text style={styles.joinedText}>Joined {memberSince}</Text>
      {relationshipAction}

      {!profile.can_see_full_profile ? <View style={styles.privateCard}>
        <AppIcon name="privacy" color="#F5C341" size={24} />
        <View style={styles.privateCopy}><Text style={styles.privateTitle}>Private account</Text><Text style={styles.stateBody}>Additional profile details are shared with approved Trailmates.</Text></View>
      </View> : <>
        <View style={styles.tabs}>
          {(['journey', 'posts', 'about'] as ProfileTab[]).map(value => <Pressable key={value} style={styles.tab} onPress={() => setTab(value)}>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text>
            {tab === value ? <View style={styles.tabUnderline} /> : null}
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
          {profile.interests?.length ? <><Text style={styles.sectionLabel}>INTERESTS</Text><View style={styles.headerChips}>{profile.interests.map(interest => <Text key={interest} style={styles.headerChip}>{interest}</Text>)}</View></> : null}
          <Text style={styles.sectionLabel}>MEMBER SINCE</Text>
          <Text style={styles.muted}>{memberSince}</Text>
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
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  topAction: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#4B4A34', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  topActionText: { color: '#F5C341', fontWeight: '800', fontSize: 12 },
  connectedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#395043', backgroundColor: '#17211C', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  connectedPillText: { color: '#BFE2C9', fontWeight: '900', fontSize: 12 },
  coverShell: { aspectRatio: 12 / 5, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#27332F', backgroundColor: '#111A17', position: 'relative' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,8,.08)' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#122019' },
  coverPlaceholderText: { color: '#D7B45A', fontWeight: '800' },
  profileIdentity: { flexDirection: 'row', alignItems: 'flex-end', gap: 11, marginTop: -38, paddingHorizontal: 10, zIndex: 2 },
  avatarWrap: { width: 76, height: 76, position: 'relative', borderRadius: 38, borderWidth: 3, borderColor: '#09110F', backgroundColor: '#09110F' },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 29, fontWeight: '900', color: '#121A17' },
  identityCopy: { flex: 1, minWidth: 0, paddingBottom: 1 },
  name: { fontSize: 25, fontWeight: '900', lineHeight: 28, color: '#F7F8F3', letterSpacing: -0.35 },
  handle: { color: '#F5C341', fontSize: 13, fontWeight: '800', marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  location: { color: '#AEB9B4', fontSize: 13 },
  rankLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rankLineText: { color: '#F7F8F3', fontSize: 11.5, fontWeight: '900', letterSpacing: 0.5 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 10 },
  rolePill: { color: '#DCE8DF', backgroundColor: '#294132', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  statLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 5, flexWrap: 'wrap' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { color: '#F7F8F3', fontWeight: '900', fontSize: 13 },
  statLabel: { color: '#A7B1AB', fontSize: 11, fontWeight: '700' },
  statDot: { color: '#526058', marginHorizontal: 7 },
  bioText: { color: '#D4DBD7', fontSize: 14, lineHeight: 20, paddingHorizontal: 2 },
  headerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  headerChip: { color: '#F0D083', backgroundColor: '#26372D', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '700' },
  joinedText: { color: '#7F8D85', fontSize: 11, fontWeight: '700' },
  relationshipArea: { gap: 9 },
  primaryButton: { backgroundColor: '#F5C341', borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  primaryButtonText: { color: '#17211C', fontWeight: '900', fontSize: 14 },
  stateCard: { backgroundColor: '#17211C', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#2E3D34', flexDirection: 'row', alignItems: 'center', gap: 10 },
  stateCardColumn: { backgroundColor: '#17211C', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2E3D34', gap: 5 },
  stateCopy: { flex: 1 },
  stateTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  stateBody: { color: '#AEB8B2', lineHeight: 18, fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 9, marginTop: 8 },
  primarySmall: { flex: 1, backgroundColor: '#F5C341', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  secondarySmall: { flex: 1, borderWidth: 1, borderColor: '#536159', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  secondaryText: { color: '#FFF8E8', fontWeight: '800' },
  privateCard: { backgroundColor: '#101714', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#29342E', flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  privateCopy: { flex: 1, gap: 4 },
  privateTitle: { color: '#F7F8F3', fontSize: 18, fontWeight: '900' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#22302A', marginTop: 3 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 10, position: 'relative' },
  tabText: { color: '#8F9C95', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: '#F7F8F3' },
  tabUnderline: { position: 'absolute', left: 16, right: 16, bottom: -1, height: 3, borderRadius: 3, backgroundColor: '#F5C341' },
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
  collectionGrid: { flexDirection: 'row', gap: 10 },
  collectionCard: { flex: 1, minHeight: 105, backgroundColor: '#141D19', borderRadius: 14, padding: 12, gap: 7, justifyContent: 'space-between' },
  collectionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#26372D', alignItems: 'center', justifyContent: 'center' },
  collectionValue: { color: '#F7F8F3', fontWeight: '900', fontSize: 20 },
  collectionLabel: { color: '#8F9C95', fontSize: 10, fontWeight: '700' },
  aboutBio: { color: '#D4DBD7', lineHeight: 21 },
  sectionLabel: { color: '#7F8D85', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 6 },
  error: { color: '#F0A39A', textAlign: 'center', marginTop: 8 },
});