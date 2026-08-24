import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../src/lib/supabase';

type ModerationStatus = {
  profile_status: 'pending' | 'active' | 'restricted' | 'suspended';
  active_warning_count: number;
  enforcement: null | {
    id: string;
    action_type: 'posting_restriction' | 'suspension' | 'ban';
    reason: string;
    message: string;
    starts_at: string;
    expires_at: string | null;
    appeal_status: 'pending' | 'upheld' | 'reversed' | null;
  };
};

function actionTitle(action: ModerationStatus['enforcement'] extends infer T ? T extends { action_type: infer A } ? A : never : never) {
  if (action === 'posting_restriction') return 'Posting temporarily restricted';
  if (action === 'suspension') return 'Account temporarily suspended';
  return 'Account permanently suspended';
}

export default function AccountStatusScreen() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ModerationStatus | null>(null);
  const [error, setError] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: statusError } = await supabase.rpc('get_my_moderation_status');
    if (statusError) setError(statusError.message);
    else setStatus(data as ModerationStatus);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const enforcement = status?.enforcement ?? null;
  const canAppeal = Boolean(enforcement && !enforcement.appeal_status);
  const expiration = useMemo(() => enforcement?.expires_at ? new Date(enforcement.expires_at) : null, [enforcement?.expires_at]);

  async function submitAppeal() {
    if (!enforcement || submitting) return;
    if (!appealReason.trim()) {
      Alert.alert('Add your appeal', 'Tell us why you believe this moderation decision should be reviewed.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: appealError } = await supabase.rpc('submit_moderation_appeal', {
      p_enforcement_id: enforcement.id,
      p_reason: appealReason.trim(),
    });
    if (appealError) {
      setError(appealError.message);
      setSubmitting(false);
      return;
    }
    setAppealReason('');
    await load();
    setSubmitting(false);
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Checking account status…</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}><Text style={styles.brandMark}>GO</Text><Text style={styles.brandName}>MELANATED</Text></View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

        {!enforcement ? <View style={styles.clearCard}>
          <Text style={styles.eyebrow}>ACCOUNT STATUS</Text>
          <Text style={styles.title}>You’re all clear</Text>
          <Text style={styles.copy}>There is no active restriction or suspension on your account.</Text>
          {status?.active_warning_count ? <Text style={styles.warningCount}>{status.active_warning_count} active formal warning{status.active_warning_count === 1 ? '' : 's'}.</Text> : null}
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.primaryText}>Return to Go Melanated</Text></Pressable>
        </View> : <>
          <View style={[styles.statusCard, enforcement.action_type === 'ban' && styles.banCard]}>
            <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
            <Text style={styles.title}>{actionTitle(enforcement.action_type)}</Text>
            <Text style={styles.copy}>{enforcement.message}</Text>

            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>REASON</Text>
              <Text style={styles.detailValue}>{enforcement.reason}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>EFFECTIVE</Text>
              <Text style={styles.detailValue}>{new Date(enforcement.starts_at).toLocaleString()}</Text>
            </View>
            {expiration ? <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>ENDS</Text>
              <Text style={styles.detailValue}>{expiration.toLocaleString()}</Text>
            </View> : <View style={styles.detailBlock}><Text style={styles.detailLabel}>DURATION</Text><Text style={styles.detailValue}>Permanent</Text></View>}
            {status?.active_warning_count ? <View style={styles.detailBlock}><Text style={styles.detailLabel}>ACTIVE WARNINGS</Text><Text style={styles.detailValue}>{status.active_warning_count}</Text></View> : null}
          </View>

          <Pressable style={styles.guidelinesButton} onPress={() => router.push('/community-guidelines' as never)}><Text style={styles.guidelinesText}>View Community Guidelines</Text></Pressable>

          <View style={styles.appealCard}>
            <Text style={styles.appealTitle}>Appeal this decision</Text>
            {enforcement.appeal_status === 'pending' ? <Text style={styles.copy}>Your appeal has been submitted and is waiting for review. The current enforcement stays in effect while the appeal is pending.</Text> : null}
            {enforcement.appeal_status === 'upheld' ? <Text style={styles.copy}>Your appeal was reviewed and the original decision was upheld.</Text> : null}
            {enforcement.appeal_status === 'reversed' ? <Text style={styles.copy}>This enforcement was reversed. Refresh your account status to continue.</Text> : null}
            {canAppeal ? <>
              <Text style={styles.appealHint}>Explain why you believe the decision should be reconsidered. Reporter identities and private moderation notes are not part of the appeal process.</Text>
              <TextInput
                value={appealReason}
                onChangeText={setAppealReason}
                placeholder="Write your appeal…"
                placeholderTextColor="#68766E"
                multiline
                style={styles.appealInput}
              />
              <Pressable disabled={submitting} style={styles.primaryButton} onPress={() => void submitAppeal()}><Text style={styles.primaryText}>{submitting ? 'Submitting…' : 'Submit appeal'}</Text></Pressable>
            </> : null}
          </View>

          <Pressable style={styles.refreshButton} onPress={() => void load()}><Text style={styles.refreshText}>Refresh account status</Text></Pressable>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 22, paddingTop: 34, paddingBottom: 50, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: '#8D9A92', fontSize: 13 },
  brand: { alignItems: 'center', marginBottom: 12 }, brandMark: { color: '#D7B45A', fontSize: 34, fontWeight: '900', letterSpacing: 1 }, brandName: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  statusCard: { borderRadius: 22, borderWidth: 1, borderColor: '#795E2D', backgroundColor: '#211E14', padding: 20, gap: 12 },
  banCard: { borderColor: '#80473F', backgroundColor: '#251918' },
  clearCard: { borderRadius: 22, borderWidth: 1, borderColor: '#395044', backgroundColor: '#17211C', padding: 20, gap: 12 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  copy: { color: '#B5BEB8', fontSize: 13, lineHeight: 20 },
  warningCount: { color: '#F2D17E', fontSize: 12, fontWeight: '800' },
  detailBlock: { borderTopWidth: 1, borderTopColor: '#3A3B2B', paddingTop: 10, gap: 3 }, detailLabel: { color: '#9E916D', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, detailValue: { color: '#FFF8E8', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  guidelinesButton: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#59695F', alignItems: 'center', justifyContent: 'center' }, guidelinesText: { color: '#E7ECE8', fontSize: 12, fontWeight: '900' },
  appealCard: { borderRadius: 18, borderWidth: 1, borderColor: '#314138', backgroundColor: '#17211C', padding: 16, gap: 10 }, appealTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, appealHint: { color: '#8F9A93', fontSize: 11, lineHeight: 17 }, appealInput: { minHeight: 110, borderRadius: 14, borderWidth: 1, borderColor: '#405047', backgroundColor: '#0F1713', color: '#FFF8E8', padding: 12, textAlignVertical: 'top', fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, primaryText: { color: '#15140F', fontSize: 13, fontWeight: '900' },
  refreshButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, refreshText: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
  errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817' }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
});
