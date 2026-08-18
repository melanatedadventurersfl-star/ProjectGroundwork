import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { AppIcon } from '../../src/ui/AppIcon';

type MemberInvite = {
  id: string;
  token: string;
  status: 'available' | 'redeemed' | string;
  redeemed_at: string | null;
  created_at: string;
};

export default function MemberInvitesScreen() {
  const { session } = useAuth();
  const [invites, setInvites] = useState<MemberInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadInvites = useCallback(async () => {
    if (!session?.user.id) return;
    setError('');
    const { data, error: inviteError } = await supabase
      .from('member_invites')
      .select('id, token, status, redeemed_at, created_at')
      .eq('sender_profile_id', session.user.id)
      .order('created_at', { ascending: true });

    if (inviteError) {
      setError('Unable to load your invites right now.');
      return;
    }
    setInvites((data ?? []) as MemberInvite[]);
  }, [session?.user.id]);

  useEffect(() => {
    void loadInvites().finally(() => setLoading(false));
  }, [loadInvites]);

  const availableCount = useMemo(() => invites.filter((invite) => invite.status === 'available').length, [invites]);

  async function refresh() {
    setRefreshing(true);
    await loadInvites();
    setRefreshing(false);
  }

  async function shareInvite(invite: MemberInvite) {
    if (invite.status !== 'available') return;
    await Share.share({
      title: 'Join me on Melanated Adventurers',
      message: `I’m inviting you to Melanated Adventurers. Your personal invite code is ${invite.token}. Use it when you create your account.`,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#D7B45A" />}
      >
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>YOUR TRAIL CREW</Text>
        <Text style={styles.title}>Invite Friends</Text>
        <Text style={styles.intro}>You have {availableCount} invite{availableCount === 1 ? '' : 's'} available. Each one is uniquely tied to you and can only be used once.</Text>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryNumber}>{availableCount}</Text>
            <Text style={styles.summaryLabel}>AVAILABLE</Text>
          </View>
          <View style={styles.summaryIcon}><AppIcon name="connections" color="#17211B" size={28} /></View>
        </View>

        {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error ? <View style={styles.list}>
          {invites.map((invite, index) => {
            const available = invite.status === 'available';
            return <View key={invite.id} style={[styles.inviteCard, !available && styles.inviteCardUsed]}>
              <View style={styles.inviteHeader}>
                <View>
                  <Text style={styles.inviteKicker}>INVITE {index + 1}</Text>
                  <Text style={styles.inviteCode}>{invite.token}</Text>
                </View>
                <View style={[styles.statusPill, !available && styles.statusPillUsed]}>
                  <Text style={[styles.statusText, !available && styles.statusTextUsed]}>{available ? 'Available' : 'Redeemed'}</Text>
                </View>
              </View>
              <Text style={styles.inviteHelp}>{available ? 'Share this unique code with one person.' : `Used${invite.redeemed_at ? ` · ${new Date(invite.redeemed_at).toLocaleDateString()}` : ''}`}</Text>
              <Pressable disabled={!available} onPress={() => void shareInvite(invite)} style={[styles.shareButton, !available && styles.shareButtonDisabled]}>
                <Text style={styles.shareButtonText}>{available ? 'Share Invite' : 'Invite Used'}</Text>
              </Pressable>
            </View>;
          })}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 48 },
  backButton: { alignSelf: 'flex-start', marginBottom: 18 },
  backText: { color: '#D7B45A', fontSize: 16, fontWeight: '800' },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 36, fontWeight: '900', marginTop: 4 },
  intro: { color: '#AEB8B1', fontSize: 15, lineHeight: 22, marginTop: 10 },
  summaryCard: { marginTop: 20, borderRadius: 18, backgroundColor: '#D7B45A', padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryNumber: { color: '#17211B', fontSize: 34, fontWeight: '900' },
  summaryLabel: { color: '#26332C', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  summaryIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F4E5B8', alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 32 },
  error: { color: '#FFB4A9', marginTop: 24, fontWeight: '700' },
  list: { gap: 12, marginTop: 20 },
  inviteCard: { borderRadius: 18, borderWidth: 1, borderColor: '#34443B', backgroundColor: '#17211C', padding: 16 },
  inviteCardUsed: { opacity: 0.66 },
  inviteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  inviteKicker: { color: '#7F8B83', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  inviteCode: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 4, letterSpacing: 1 },
  statusPill: { borderRadius: 999, backgroundColor: '#DDE9D8', paddingHorizontal: 10, paddingVertical: 6 },
  statusPillUsed: { backgroundColor: '#2A342F' },
  statusText: { color: '#24543B', fontSize: 11, fontWeight: '900' },
  statusTextUsed: { color: '#AEB8B1' },
  inviteHelp: { color: '#9DA8A1', fontSize: 13, marginTop: 12 },
  shareButton: { marginTop: 14, minHeight: 46, borderRadius: 12, backgroundColor: '#24543B', alignItems: 'center', justifyContent: 'center' },
  shareButtonDisabled: { backgroundColor: '#28332D' },
  shareButtonText: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
});
