import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addTrailmateToMyCircle, getMyCircleMembership, removeTrailmateFromMyCircle } from '../../src/community/circles';
import { ProfilePosts } from '../../src/member/ProfilePosts';
import { RankEmblem, rankFor } from '../../src/passport/RankEmblem';
import { AppIcon } from '../../src/ui/AppIcon';
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

function Stat({ icon, value, label }: { icon: 'adventure' | 'stamp' | 'badge'; value: number; label: string }) {
  return <View style={styles.statCell}><AppIcon name={icon} color="#F5C341" size={18} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [inCircle, setInCircle] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('journey');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [circleWorking, setCircleWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [nextProfile, connection] = await Promise.all([getCommunityProfile(id), getConnectionStatus(id)]);
      setProfile(nextProfile);
      setConnectionStatus(connection.status);
      setConnectionId(connection.connectionId);
      if (connection.status === 'accepted') {
        const membership = await getMyCircleMembership(id);
        setInCircle(membership.inCircle);
      } else setInCircle(false);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this member profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

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
    } finally { setWorking(false); }
  }

  async function toggleCircle() {
    if (!id || connectionStatus !== 'accepted') return;
    setCircleWorking(true);
    try {
      if (inCircle) await removeTrailmateFromMyCircle(id);
      else await addTrailmateToMyCircle(id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update your Circle.');
    } finally { setCircleWorking(false); }
  }

  const rank = useMemo(() => rankFor(profile?.adventure_count ?? 0), [profile?.adventure_count]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>;
  if (!profile) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Profile not found.'}</Text></SafeAreaView>;

  const location = [profile.home_city, profile.home_state].filter(Boolean).join(', ');
  const isSelf = connectionStatus === 'self';

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}><AppIcon name="chevron-forward" color="#F5C341" size={26} style={{ transform: [{ rotate: '180deg' }] }} /></Pressable>
        {isSelf ? <Pressable style={styles.editPill} onPress={() => router.push('/member/profile?edit=1')}><AppIcon name="edit" color="#F5C341" size={15} /><Text style={styles.editPillText}>Edit</Text></Pressable> : null}
      </View>

      <View style={styles.profileHeaderCard}>
        <View style={styles.identityRankRow}>
          <View style={styles.identityCluster}>
            <Avatar url={profile.avatar_url} name={profile.display_name} />
            <View style={styles.heroCopy}>
              <Text style={styles.name}>{profile.display_name ?? 'Adventurer'}</Text>
              {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
              {location ? <View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={14} /><Text style={styles.location}>{location}</Text></View> : null}
            </View>
          </View>
          <View style={styles.rankIdentity}><RankEmblem rank={rank} size={44} /><Text style={styles.rankCompact}>{rank.toUpperCase()}</Text></View>
        </View>

        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        {profile.can_see_full_profile ? <View style={styles.statsCard}>
          <Stat icon="adventure" value={profile.adventure_count} label="Adventures" />
          <Stat icon="stamp" value={profile.stamp_count} label="Stamps" />
          <Stat icon="badge" value={profile.badge_count} label="Badges" />
        </View> : null}
      </View>

      {!isSelf ? <View style={styles.relationshipWrap}>
        {(connectionStatus === 'none' || connectionStatus === 'declined') ? <Pressable disabled={working} style={styles.primaryButton} onPress={() => void act('request')}><Text style={styles.primaryButtonText}>{working ? 'Sending…' : 'Add Trailmate'}</Text></Pressable> : null}
        {connectionStatus === 'pending_sent' ? <View style={styles.stateCard}><Text style={styles.stateTitle}>Trailmate request sent</Text><Text style={styles.stateBody}>You’ll become Trailmates when they accept.</Text><Text style={styles.requestedLabel}>REQUESTED</Text></View> : null}
        {connectionStatus === 'pending_received' ? <View style={styles.stateCard}><Text style={styles.stateTitle}>Trailmate request</Text><Text style={styles.stateBody}>This member wants to become a Trailmate.</Text><View style={styles.buttonRow}><Pressable disabled={working} style={styles.primarySmall} onPress={() => void act('accept')}><Text style={styles.primaryButtonText}>Accept</Text></Pressable><Pressable disabled={working} style={styles.secondarySmall} onPress={() => void act('decline')}><Text style={styles.secondaryText}>Decline</Text></Pressable></View></View> : null}
        {connectionStatus === 'accepted' ? <View style={styles.relationshipCard}><View style={styles.relationshipTop}><View><Text style={styles.connectedText}>Trailmates ✓</Text><Text style={styles.stateBody}>Connected across the community.</Text></View><Pressable disabled={working} onPress={() => void act('remove')}><Text style={styles.removeText}>Remove</Text></Pressable></View><Pressable disabled={circleWorking} style={[styles.circleButton, inCircle && styles.circleButtonActive]} onPress={() => void toggleCircle()}><Text style={[styles.circleButtonText, inCircle && styles.circleButtonTextActive]}>{circleWorking ? 'Updating…' : inCircle ? '★ In Your Circle' : '☆ Add to Circle'}</Text></Pressable></View> : null}
      </View> : null}

      {!profile.can_see_full_profile ? <View style={styles.privateCard}><AppIcon name="privacy" color="#F5C341" size={22} /><Text style={styles.privateTitle}>Private account</Text><Text style={styles.stateBody}>Additional profile details are shared with approved Trailmates.</Text></View> : <>
        <View style={styles.tabs}>
          {(['journey','posts','about'] as ProfileTab[]).map(value => <Pressable key={value} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}
        </View>

        {tab === 'journey' ? <View style={styles.card}><Text style={styles.cardTitle}>Adventure Journey</Text><Text style={styles.muted}>{profile.adventure_count ? `${profile.adventure_count} completed adventure${profile.adventure_count === 1 ? '' : 's'} · ${profile.stamp_count} stamp${profile.stamp_count === 1 ? '' : 's'} · ${profile.badge_count} badge${profile.badge_count === 1 ? '' : 's'}` : 'Their adventure journey is just getting started.'}</Text></View> : null}
        {tab === 'posts' ? <ProfilePosts profileId={profile.id} /> : null}
        {tab === 'about' ? <View style={styles.card}><Text style={styles.cardTitle}>About</Text>{profile.interests?.length ? <><Text style={styles.sectionLabel}>INTERESTS</Text><View style={styles.chips}>{profile.interests.map(interest => <Text key={interest} style={styles.chip}>{interest}</Text>)}</View></> : null}<Text style={styles.sectionLabel}>MEMBER SINCE</Text><Text style={styles.muted}>{new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text></View> : null}
      </>}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0F1713'},center:{flex:1,backgroundColor:'#0F1713',alignItems:'center',justifyContent:'center',padding:24},content:{padding:18,paddingBottom:90,gap:14},topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},editPill:{flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:'#4B4A34',borderRadius:999,paddingHorizontal:12,paddingVertical:7},editPillText:{color:'#F5C341',fontWeight:'800'},profileHeaderCard:{backgroundColor:'#111A17',borderRadius:22,borderWidth:1,borderColor:'#28362E',padding:17,gap:14},identityRankRow:{flexDirection:'row',justifyContent:'space-between',gap:14},identityCluster:{flex:1,flexDirection:'row',alignItems:'center',gap:13},avatar:{width:68,height:68,borderRadius:34,backgroundColor:'#F5C341',alignItems:'center',justifyContent:'center'},avatarText:{fontSize:28,fontWeight:'900',color:'#121A17'},heroCopy:{flex:1},name:{color:'#F7F8F3',fontSize:25,fontWeight:'900'},handle:{color:'#F5C341',fontWeight:'800',marginTop:2},locationRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:5},location:{color:'#AEB9B4'},rankIdentity:{alignItems:'center',minWidth:62},rankCompact:{color:'#F5C341',fontSize:9,fontWeight:'900',marginTop:3},bio:{color:'#D4DBD7',fontSize:14.5,lineHeight:21},statsCard:{flexDirection:'row',borderTopWidth:1,borderTopColor:'#26332C',paddingTop:13},statCell:{flex:1,alignItems:'center',gap:2},statValue:{color:'#F7F8F3',fontWeight:'900',fontSize:18},statLabel:{color:'#8F9C95',fontSize:10,fontWeight:'700'},relationshipWrap:{gap:10},primaryButton:{backgroundColor:'#F5C341',borderRadius:14,paddingVertical:14,alignItems:'center'},primaryButtonText:{color:'#17211C',fontWeight:'900'},stateCard:{backgroundColor:'#17211C',borderRadius:16,padding:16,borderWidth:1,borderColor:'#2E3D34',gap:5},stateTitle:{color:'#FFF8E8',fontWeight:'900',fontSize:17},stateBody:{color:'#AEB8B2',lineHeight:20},requestedLabel:{color:'#F5C341',fontSize:10,fontWeight:'900',marginTop:5,letterSpacing:.8},buttonRow:{flexDirection:'row',gap:9,marginTop:7},primarySmall:{flex:1,backgroundColor:'#F5C341',borderRadius:11,paddingVertical:11,alignItems:'center'},secondarySmall:{flex:1,borderWidth:1,borderColor:'#536159',borderRadius:11,paddingVertical:11,alignItems:'center'},secondaryText:{color:'#FFF8E8',fontWeight:'800'},relationshipCard:{backgroundColor:'#17211C',borderRadius:16,padding:15,borderWidth:1,borderColor:'#395043',gap:11},relationshipTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},connectedText:{color:'#BFE2C9',fontWeight:'900',fontSize:16},removeText:{color:'#C8B986',fontWeight:'700',fontSize:12},circleButton:{borderWidth:1,borderColor:'#F5C341',borderRadius:12,paddingVertical:11,alignItems:'center'},circleButtonActive:{backgroundColor:'#F5C341'},circleButtonText:{color:'#F5C341',fontWeight:'900'},circleButtonTextActive:{color:'#17211C'},privateCard:{backgroundColor:'#111A17',borderRadius:18,padding:18,borderWidth:1,borderColor:'#28362E',gap:7},privateTitle:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},tabs:{flexDirection:'row',backgroundColor:'#111A17',borderRadius:14,padding:4,borderWidth:1,borderColor:'#28362E'},tab:{flex:1,alignItems:'center',paddingVertical:9,borderRadius:10},tabActive:{backgroundColor:'#26372D'},tabText:{color:'#8F9C95',fontWeight:'800',fontSize:12},tabTextActive:{color:'#F5C341'},card:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16,gap:10},cardTitle:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},muted:{color:'#96A39B',lineHeight:20},sectionLabel:{color:'#7F8D85',fontSize:10,fontWeight:'900',letterSpacing:1,marginTop:6},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{color:'#F0D083',backgroundColor:'#26372D',borderRadius:999,paddingHorizontal:10,paddingVertical:6,fontSize:12,fontWeight:'700'},error:{color:'#FFB4A9'}
});
