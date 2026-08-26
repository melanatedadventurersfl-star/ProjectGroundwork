import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';

type MemberInvite = {
  id: string;
  token: string;
  status: 'available' | 'redeemed' | string;
  redeemed_at: string | null;
  created_at: string;
};

function compactCode(token: string) {
  return token.slice(0, 8).toUpperCase();
}

function inviteShareMessage(token: string) {
  const androidDownloadUrl = process.env.EXPO_PUBLIC_ANDROID_DOWNLOAD_URL?.trim();
  const inviteBaseUrl = process.env.EXPO_PUBLIC_INVITE_BASE_URL?.trim().replace(/\/$/, '');
  const inviteUrl = inviteBaseUrl ? `${inviteBaseUrl}/invite/${token}` : null;

  return [
    'I’m inviting you to Melanated Adventurers.',
    androidDownloadUrl ? `Download the Android app: ${androidDownloadUrl}` : null,
    inviteUrl ? `Open your invite after installing: ${inviteUrl}` : null,
    `Your backup invite code is ${token}.`,
    'Once you join, your account will be connected to the member who invited you.',
  ].filter(Boolean).join('\n\n');
}

export default function MemberInvitesScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [invites, setInvites] = useState<MemberInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    if (!userId) return;
    setError('');
    const { data, error: inviteError } = await supabase
      .from('member_invites')
      .select('id, token, status, redeemed_at, created_at')
      .eq('sender_profile_id', userId)
      .order('created_at', { ascending: true });

    if (inviteError) {
      setError('Unable to load your invites right now.');
      return;
    }
    setInvites((data ?? []) as MemberInvite[]);
  }, [userId]);

  useEffect(() => {
    void loadInvites().finally(() => setLoading(false));
  }, [loadInvites]);

  const availableCount = useMemo(() => invites.filter((invite) => invite.status === 'available').length, [invites]);
  const joinedCount = useMemo(() => invites.filter((invite) => invite.status === 'redeemed').length, [invites]);

  async function refresh() {
    setRefreshing(true);
    await loadInvites();
    setRefreshing(false);
  }

  async function shareInvite(invite: MemberInvite) {
    if (invite.status !== 'available') return;
    await Share.share({
      title: 'Join me on Melanated Adventurers',
      message: inviteShareMessage(invite.token),
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

        <Text style={styles.eyebrow}>GROW YOUR TRAIL CREW</Text>
        <Text style={styles.title}>Invite Friends</Text>
        <Text style={styles.intro}>Each invite belongs to you. When someone joins through it, we connect their profile to yours and count it toward your referral progress.</Text>

        <View style={styles.impactCard}>
          <Text style={styles.impactEyebrow}>YOUR IMPACT</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metric}><Text style={styles.metricNumber}>{availableCount}</Text><Text style={styles.metricLabel}>Invites left</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.metricNumber}>{joinedCount}</Text><Text style={styles.metricLabel}>People joined</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.metricNumber}>{joinedCount}</Text><Text style={styles.metricLabel}>Referral credits</Text></View>
          </View>
          <Text style={styles.impactHelp}>Successful joins earn referral credit for future community badges.</Text>
        </View>

        {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error ? <View style={styles.list}>
          {invites.map((invite, index) => {
            const available = invite.status === 'available';
            const expanded = expandedCodeId === invite.id;
            return <View key={invite.id} style={[styles.inviteCard, !available && styles.inviteCardUsed]}>
              <View style={styles.inviteHeader}>
                <View style={styles.inviteHeading}>
                  <Text style={styles.inviteKicker}>INVITE {index + 1}</Text>
                  <Text style={styles.inviteTitle}>{available ? 'Ready to share' : 'Friend joined'}</Text>
                </View>
                <View style={[styles.statusPill, !available && styles.statusPillUsed]}>
                  <Text style={[styles.statusText, !available && styles.statusTextUsed]}>{available ? 'Available' : 'Joined'}</Text>
                </View>
              </View>

              <Text style={styles.inviteHelp}>{available ? 'Send this invite to one person. We’ll track the successful signup back to you.' : `Referral credited${invite.redeemed_at ? ` · ${new Date(invite.redeemed_at).toLocaleDateString()}` : ''}`}</Text>

              <View style={styles.codeRow}>
                <View>
                  <Text style={styles.codeLabel}>BACKUP CODE</Text>
                  <Text style={styles.compactCode}>{compactCode(invite.token)}</Text>
                </View>
                <Pressable hitSlop={8} onPress={() => setExpandedCodeId(expanded ? null : invite.id)}>
                  <Text style={styles.codeToggle}>{expanded ? 'Hide' : 'Show full code'}</Text>
                </Pressable>
              </View>
              {expanded ? <Text selectable style={styles.fullCode}>{invite.token}</Text> : null}

              <Pressable disabled={!available} onPress={() => void shareInvite(invite)} style={[styles.shareButton, !available && styles.shareButtonDisabled]}>
                <Text style={styles.shareButtonText}>{available ? 'Share Invite' : 'Referral Credited'}</Text>
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
  impactCard: { marginTop: 20, borderRadius: 20, backgroundColor: '#D7B45A', padding: 18 },
  impactEyebrow: { color: '#314138', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  metricsRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 12 },
  metric: { flex: 1 },
  metricDivider: { width: 1, backgroundColor: 'rgba(23,33,27,0.2)', marginHorizontal: 10 },
  metricNumber: { color: '#17211B', fontSize: 28, fontWeight: '900' },
  metricLabel: { color: '#314138', fontSize: 11, fontWeight: '800', marginTop: 2 },
  impactHelp: { color: '#314138', fontSize: 12, lineHeight: 17, marginTop: 14 },
  loader: { marginTop: 32 },
  error: { color: '#FFB4A9', marginTop: 24, fontWeight: '700' },
  list: { gap: 12, marginTop: 20 },
  inviteCard: { borderRadius: 18, borderWidth: 1, borderColor: '#34443B', backgroundColor: '#17211C', padding: 16 },
  inviteCardUsed: { borderColor: '#526158' },
  inviteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  inviteHeading: { flex: 1 },
  inviteKicker: { color: '#7F8B83', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  inviteTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 3 },
  statusPill: { borderRadius: 999, backgroundColor: '#DDE9D8', paddingHorizontal: 10, paddingVertical: 6 },
  statusPillUsed: { backgroundColor: '#31483A' },
  statusText: { color: '#24543B', fontSize: 11, fontWeight: '900' },
  statusTextUsed: { color: '#C7E1CF' },
  inviteHelp: { color: '#AEB8B1', fontSize: 13, lineHeight: 19, marginTop: 12 },
  codeRow: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#29372F', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  codeLabel: { color: '#6F7D75', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  compactCode: { color: '#D7B45A', fontSize: 15, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  codeToggle: { color: '#9FB8A6', fontSize: 12, fontWeight: '800' },
  fullCode: { color: '#AEB8B1', fontSize: 12, lineHeight: 18, marginTop: 9 },
  shareButton: { marginTop: 14, minHeight: 48, borderRadius: 12, backgroundColor: '#24543B', alignItems: 'center', justifyContent: 'center' },
  shareButtonDisabled: { backgroundColor: '#2D3A33' },
  shareButtonText: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
});
