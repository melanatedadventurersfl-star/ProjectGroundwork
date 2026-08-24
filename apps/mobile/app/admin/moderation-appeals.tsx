import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

type AppealRow = {
  id: string;
  enforcement_id: string;
  member_id: string;
  reason: string;
  status: 'pending' | 'upheld' | 'reversed';
  created_at: string;
  community_member_enforcements: null | {
    action_type: 'warning' | 'posting_restriction' | 'suspension' | 'ban';
    reason: string;
    starts_at: string;
    expires_at: string | null;
  };
};

export default function ModerationAppealsScreen() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const adminResult = await supabase.rpc('is_platform_admin');
    if (adminResult.error || adminResult.data !== true) {
      setAuthorized(false);
      setLoading(false);
      if (adminResult.error) setError(adminResult.error.message);
      return;
    }

    setAuthorized(true);
    const { data, error: appealError } = await supabase
      .from('community_moderation_appeals')
      .select('id,enforcement_id,member_id,reason,status,created_at,community_member_enforcements(action_type,reason,starts_at,expires_at)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (appealError) setError(appealError.message);
    else setAppeals((data ?? []) as unknown as AppealRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function decide(appeal: AppealRow, decision: 'upheld' | 'reversed') {
    if (busyId) return;
    setBusyId(appeal.id);
    setError('');
    const { error: decisionError } = await supabase.rpc('decide_moderation_appeal', {
      p_appeal_id: appeal.id,
      p_decision: decision,
      p_note: null,
    });
    if (decisionError) setError(decisionError.message);
    else await load();
    setBusyId(null);
  }

  function confirmDecision(appeal: AppealRow, decision: 'upheld' | 'reversed') {
    Alert.alert(
      decision === 'reversed' ? 'Reverse this enforcement?' : 'Uphold this enforcement?',
      decision === 'reversed'
        ? 'The enforcement will be deactivated. If no other active restriction, suspension, or ban remains, the member’s account status will be restored.'
        : 'The existing enforcement will remain in effect and the member will be notified that the appeal was reviewed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: decision === 'reversed' ? 'Reverse enforcement' : 'Uphold decision', style: decision === 'reversed' ? 'destructive' : 'default', onPress: () => { void decide(appeal, decision); } },
      ],
    );
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading appeals…</Text></View></SafeAreaView>;

  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.content}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><View style={styles.denied}><Text style={styles.eyebrow}>PROTECTED AREA</Text><Text style={styles.title}>Admin access required</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
          <Text style={styles.title}>Moderation Appeals</Text>
          <Text style={styles.subtitle}>Appeals do not automatically lift enforcement. Reverse only when the original decision should no longer stand.</Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {appeals.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No appeals waiting</Text><Text style={styles.muted}>Pending moderation appeals will appear here.</Text></View> : null}

        {appeals.map((appeal) => {
          const enforcement = appeal.community_member_enforcements;
          const busy = busyId === appeal.id;
          return <View key={appeal.id} style={styles.card}>
            <View style={styles.cardTop}><View style={styles.pendingBadge}><Text style={styles.pendingText}>PENDING APPEAL</Text></View><Text style={styles.date}>{new Date(appeal.created_at).toLocaleString()}</Text></View>
            <Text style={styles.action}>{enforcement?.action_type?.replace('_', ' ').toUpperCase() ?? 'ENFORCEMENT'}</Text>
            <Text style={styles.reason}>{enforcement?.reason ?? 'Moderation action'}</Text>
            <View style={styles.appealBox}><Text style={styles.appealLabel}>MEMBER APPEAL</Text><Text style={styles.appealText}>{appeal.reason}</Text></View>
            {enforcement?.expires_at ? <Text style={styles.meta}>Current enforcement ends {new Date(enforcement.expires_at).toLocaleString()}</Text> : null}
            <View style={styles.actions}>
              <Pressable disabled={busy} style={styles.upholdButton} onPress={() => confirmDecision(appeal, 'upheld')}><Text style={styles.upholdText}>{busy ? 'Working…' : 'Uphold decision'}</Text></Pressable>
              <Pressable disabled={busy} style={styles.reverseButton} onPress={() => confirmDecision(appeal, 'reversed')}><Text style={styles.reverseText}>{busy ? 'Working…' : 'Reverse enforcement'}</Text></Pressable>
            </View>
          </View>;
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 54, gap: 14 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  back: { color: '#D7B45A', fontSize: 16, fontWeight: '800', paddingVertical: 6 }, header: { gap: 5, marginBottom: 4 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 31, lineHeight: 37, fontWeight: '900' }, subtitle: { color: '#A9B4AD', fontSize: 13, lineHeight: 19 }, muted: { color: '#8D9A92', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  denied: { marginTop: 28, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#523B35', backgroundColor: '#211817', gap: 8 }, errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817' }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
  empty: { marginTop: 18, alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1, borderColor: '#2D3B33', backgroundColor: '#17211C', padding: 24 }, emptyTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#17211C', padding: 15, gap: 10 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, pendingBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#7A6530', backgroundColor: '#2A2617', paddingHorizontal: 8, paddingVertical: 4 }, pendingText: { color: '#F0D083', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, date: { color: '#7F8B83', fontSize: 10 }, action: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 }, reason: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, meta: { color: '#8D9A92', fontSize: 11, lineHeight: 16 },
  appealBox: { borderRadius: 13, borderWidth: 1, borderColor: '#32423A', backgroundColor: '#101914', padding: 12, gap: 5 }, appealLabel: { color: '#A9B4AD', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, appealText: { color: '#E5EAE7', fontSize: 13, lineHeight: 20 }, actions: { gap: 8, marginTop: 2 }, upholdButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#59695F', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2822' }, upholdText: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, reverseButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#7A433C', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1D1B' }, reverseText: { color: '#FFB4A9', fontSize: 12, fontWeight: '900' },
});
