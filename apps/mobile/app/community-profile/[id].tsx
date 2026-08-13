import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCommunityProfile,
  getConnectionStatus,
  removeConnection,
  requestConnection,
  respondToConnection,
  type CommunityProfile,
  type ConnectionStatus,
} from '../../src/social/api';

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
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
      setError(caught instanceof Error ? caught.message : 'Unable to update this connection.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  if (!profile) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Profile not found.'}</Text></SafeAreaView>;

  const location = [profile.home_city, profile.home_state].filter(Boolean).join(', ');
  const canSeeFullProfile = !profile.profile_is_private || connectionStatus === 'accepted' || connectionStatus === 'self';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <View style={styles.identityRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{String(profile.display_name ?? 'A').slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{profile.display_name ?? 'Adventurer'}</Text>
            {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
            {location ? <Text style={styles.location}>{location}</Text> : null}
          </View>
        </View>

        <View style={styles.roleRow}>
          {profile.event_host_level !== 'member' ? <Text style={styles.rolePill}>{profile.event_host_level.replace('_', ' ').toUpperCase()}</Text> : null}
          {profile.platform_role !== 'member' ? <Text style={styles.rolePill}>{profile.platform_role.replace('_', ' ').toUpperCase()}</Text> : null}
        </View>

        {connectionStatus === 'none' || connectionStatus === 'declined' ? <Pressable disabled={working} style={styles.primaryButton} onPress={() => void act('request')}><Text style={styles.primaryButtonText}>{working ? 'Sending…' : 'Connect'}</Text></Pressable> : null}
        {connectionStatus === 'pending_sent' ? <View style={styles.stateCard}><Text style={styles.stateTitle}>Connection request sent</Text><Text style={styles.stateBody}>You’ll be connected when they accept.</Text></View> : null}
        {connectionStatus === 'pending_received' ? <View style={styles.requestCard}><Text style={styles.stateTitle}>Connection request</Text><Text style={styles.stateBody}>This member would like to stay connected.</Text><View style={styles.buttonRow}><Pressable disabled={working} style={styles.primarySmall} onPress={() => void act('accept')}><Text style={styles.primaryButtonText}>Accept</Text></Pressable><Pressable disabled={working} style={styles.secondarySmall} onPress={() => void act('decline')}><Text style={styles.secondaryText}>Decline</Text></Pressable></View></View> : null}
        {connectionStatus === 'accepted' ? <View style={styles.connectedRow}><Text style={styles.connectedText}>Connected</Text><Pressable disabled={working} onPress={() => void act('remove')}><Text style={styles.removeText}>Remove connection</Text></Pressable></View> : null}

        {profile.profile_is_private && !canSeeFullProfile ? (
          <View style={styles.privateCard}>
            <Text style={styles.privateTitle}>Private account</Text>
            <Text style={styles.privateBody}>This member shares additional profile details with approved connections.</Text>
          </View>
        ) : (
          <>
            {profile.interests?.length ? <View style={styles.card}><Text style={styles.cardTitle}>Interests</Text><View style={styles.chips}>{profile.interests.map((interest) => <Text key={interest} style={styles.chip}>{interest}</Text>)}</View></View> : null}
            <View style={styles.card}><Text style={styles.cardTitle}>Member since</Text><Text style={styles.body}>{new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text></View>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' }, center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 24 }, content: { padding: 20, paddingBottom: 50, gap: 14 }, back: { color: '#D7B45A', fontWeight: '800', fontSize: 16 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 }, avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#17211C', fontSize: 30, fontWeight: '900' }, identityText: { flex: 1 }, name: { color: '#FFF8E8', fontSize: 29, fontWeight: '900' }, username: { color: '#D7B45A', fontWeight: '800', marginTop: 2 }, location: { color: '#B6C0BA', marginTop: 5 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, rolePill: { color: '#BFE2C9', backgroundColor: '#25372D', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 13, paddingVertical: 13, alignItems: 'center' }, primaryButtonText: { color: '#17211C', fontWeight: '900' }, stateCard: { backgroundColor: '#17211C', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E3D34' }, requestCard: { backgroundColor: '#1D2B24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#3B5144', gap: 7 }, stateTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 17 }, stateBody: { color: '#AEB8B2', lineHeight: 20 }, buttonRow: { flexDirection: 'row', gap: 9, marginTop: 6 }, primarySmall: { flex: 1, backgroundColor: '#D7B45A', borderRadius: 11, paddingVertical: 11, alignItems: 'center' }, secondarySmall: { flex: 1, borderWidth: 1, borderColor: '#536159', borderRadius: 11, paddingVertical: 11, alignItems: 'center' }, secondaryText: { color: '#FFF8E8', fontWeight: '800' }, connectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1C2B23', borderRadius: 14, padding: 14 }, connectedText: { color: '#BFE2C9', fontWeight: '900' }, removeText: { color: '#D7B45A', fontWeight: '700', fontSize: 12 },
  privateCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 19, borderWidth: 1, borderColor: '#2D3B33' }, privateTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, privateBody: { color: '#AEB8B2', lineHeight: 21, marginTop: 6 }, card: { backgroundColor: '#17211C', borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#28362E' }, cardTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, body: { color: '#AEB8B2', marginTop: 6 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }, chip: { color: '#F0D083', backgroundColor: '#26372D', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '700' }, error: { color: '#FFB4A9' },
});
