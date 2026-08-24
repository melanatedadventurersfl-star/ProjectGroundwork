import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../src/lib/supabase';

type AppealStatus = 'pending' | 'upheld' | 'reversed' | null;
type ActiveEnforcementAction = 'posting_restriction' | 'suspension' | 'ban';

type ActiveEnforcement = {
  id: string;
  action_type: ActiveEnforcementAction;
  reason: string;
  message: string;
  starts_at: string;
  expires_at: string | null;
  appeal_status: AppealStatus;
};

type WarningDetail = {
  id: string;
  reason: string;
  message: string;
  starts_at: string;
  expires_at: string | null;
  status: 'active' | 'expired';
  warning_number: number;
  target_type: 'Post' | 'Reply';
  content_snapshot: string | null;
  content_removed: boolean;
  appeal_status: AppealStatus;
};

type ModerationStatus = {
  profile_status: 'pending' | 'active' | 'restricted' | 'suspended';
  active_warning_count: number;
  warning_threshold: number;
  latest_warning: WarningDetail | null;
  enforcement: ActiveEnforcement | null;
};

function actionTitle(action: ActiveEnforcementAction) {
  if (action === 'posting_restriction') return 'Posting temporarily restricted';
  if (action === 'suspension') return 'Account temporarily suspended';
  return 'Account permanently suspended';
}

function formatDate(value: string | null) {
  if (!value) return 'Permanent';
  return new Date(value).toLocaleString();
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
  const warning = status?.latest_warning ?? null;
  const appealTarget = enforcement ?? warning;
  const canAppeal = Boolean(appealTarget && !appealTarget.appeal_status);

  async function submitAppeal() {
    if (!appealTarget || submitting) return;
    if (!appealReason.trim()) {
      Alert.alert('Add your appeal', 'Tell us why you believe this moderation decision should be reviewed.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: appealError } = await supabase.rpc('submit_moderation_appeal', {
      p_enforcement_id: appealTarget.id,
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

        {enforcement ? (
          <View style={[styles.statusCard, enforcement.action_type === 'ban' && styles.banCard]}>
            <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
            <Text style={styles.title}>{actionTitle(enforcement.action_type)}</Text>
            <Text style={styles.copy}>{enforcement.message}</Text>
            <Detail label="STATUS" value="Active" />
            <Detail label="REASON" value={enforcement.reason} />
            <Detail label="EFFECTIVE" value={formatDate(enforcement.starts_at)} />
            <Detail label={enforcement.expires_at ? 'ENDS' : 'DURATION'} value={enforcement.expires_at ? formatDate(enforcement.expires_at) : 'Permanent'} />
            {status?.active_warning_count ? <Detail label="ACTIVE WARNINGS" value={`${status.active_warning_count} of ${status.warning_threshold}`} /> : null}
          </View>
        ) : warning ? (
          <View style={styles.warningCard}>
            <View style={styles.warningHeaderRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
                <Text style={styles.title}>Formal warning</Text>
              </View>
              <View style={styles.warningBadge}><Text style={styles.warningBadgeText}>WARNING {warning.warning_number} OF {status?.warning_threshold ?? 3}</Text></View>
            </View>
            <Text style={styles.copy}>A Community Guidelines violation was confirmed. This page shows the specific violation and the action taken.</Text>
            <Detail label="STATUS" value={warning.status === 'active' ? 'Active warning' : 'Expired warning'} />
            <Detail label="VIOLATION" value={warning.reason} />
            <Detail label="CONTENT TYPE" value={warning.target_type} />
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>REPORTED CONTENT</Text>
              <View style={styles.snapshotBox}>
                <Text style={styles.snapshotText}>{warning.content_snapshot?.trim() || 'The reported content is no longer available.'}</Text>
              </View>
            </View>
            <Detail label="ACTION TAKEN" value={warning.content_removed ? 'Formal warning issued and reported content removed' : 'Formal warning issued; reported content was not removed'} />
            <Detail label="ISSUED" value={formatDate(warning.starts_at)} />
            <Detail label="WARNING EXPIRES" value={formatDate(warning.expires_at)} />
          </View>
        ) : (
          <View style={styles.clearCard}>
            <Text style={styles.eyebrow}>ACCOUNT STATUS</Text>
            <Text style={styles.title}>You’re all clear</Text>
            <Text style={styles.copy}>There is no active warning, restriction, suspension, or ban on your account.</Text>
          </View>
        )}

        {enforcement && warning ? (
          <View style={styles.warningSummaryCard}>
            <Text style={styles.warningSummaryEyebrow}>LATEST FORMAL WARNING</Text>
            <Text style={styles.warningSummaryTitle}>Warning {warning.warning_number} of {status?.warning_threshold ?? 3}</Text>
            <Text style={styles.warningSummaryReason}>{warning.reason}</Text>
            {warning.content_snapshot ? <Text style={styles.warningSummaryContent} numberOfLines={3}>{warning.target_type}: “{warning.content_snapshot}”</Text> : null}
          </View>
        ) : null}

        {(enforcement || warning) ? <Pressable style={styles.guidelinesButton} onPress={() => router.push('/community-guidelines' as never)}><Text style={styles.guidelinesText}>View Community Guidelines</Text></Pressable> : null}

        {appealTarget ? (
          <View style={styles.appealCard}>
            <Text style={styles.appealTitle}>Appeal this decision</Text>
            {appealTarget.appeal_status === 'pending' ? <Text style={styles.copy}>Your appeal has been submitted and is waiting for review. The current moderation status remains in effect while the appeal is pending.</Text> : null}
            {appealTarget.appeal_status === 'upheld' ? <Text style={styles.copy}>Your appeal was reviewed and the original decision was upheld.</Text> : null}
            {appealTarget.appeal_status === 'reversed' ? <Text style={styles.copy}>This moderation action was reversed.</Text> : null}
            {canAppeal ? <>
              <Text style={styles.appealHint}>Explain why you believe the decision should be reconsidered. Reporter identities and private moderator notes are never shown here.</Text>
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
        ) : null}

        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.primaryText}>Return to Go Melanated</Text></Pressable>
        <Pressable style={styles.refreshButton} onPress={() => void load()}><Text style={styles.refreshText}>Refresh account status</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailBlock}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 22, paddingTop: 34, paddingBottom: 50, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  flex: { flex: 1 },
  muted: { color: '#8D9A92', fontSize: 13 },
  brand: { alignItems: 'center', marginBottom: 12 },
  brandMark: { color: '#D7B45A', fontSize: 34, fontWeight: '900', letterSpacing: 1 },
  brandName: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  statusCard: { borderRadius: 22, borderWidth: 1, borderColor: '#795E2D', backgroundColor: '#211E14', padding: 20, gap: 12 },
  banCard: { borderColor: '#80473F', backgroundColor: '#251918' },
  warningCard: { borderRadius: 22, borderWidth: 1.5, borderColor: '#A88235', backgroundColor: '#211E14', padding: 20, gap: 12 },
  warningHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  warningBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#D7B45A', backgroundColor: '#302817', paddingHorizontal: 9, paddingVertical: 6 },
  warningBadgeText: { color: '#F2D17E', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  clearCard: { borderRadius: 22, borderWidth: 1, borderColor: '#395044', backgroundColor: '#17211C', padding: 20, gap: 12 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  copy: { color: '#B5BEB8', fontSize: 13, lineHeight: 20 },
  detailBlock: { borderTopWidth: 1, borderTopColor: '#3A3B2B', paddingTop: 10, gap: 5 },
  detailLabel: { color: '#A99A6E', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  detailValue: { color: '#FFF8E8', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  snapshotBox: { borderRadius: 12, borderWidth: 1, borderColor: '#4D4935', backgroundColor: '#151710', padding: 12 },
  snapshotText: { color: '#FFF8E8', fontSize: 15, lineHeight: 21, fontWeight: '700' },
  warningSummaryCard: { borderRadius: 16, borderWidth: 1, borderColor: '#5B4E2B', backgroundColor: '#1A1C14', padding: 15, gap: 5 },
  warningSummaryEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  warningSummaryTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  warningSummaryReason: { color: '#F2D17E', fontSize: 12, fontWeight: '800' },
  warningSummaryContent: { color: '#B5BEB8', fontSize: 12, lineHeight: 18 },
  guidelinesButton: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#59695F', alignItems: 'center', justifyContent: 'center' },
  guidelinesText: { color: '#E7ECE8', fontSize: 12, fontWeight: '900' },
  appealCard: { borderRadius: 18, borderWidth: 1, borderColor: '#314138', backgroundColor: '#17211C', padding: 16, gap: 10 },
  appealTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  appealHint: { color: '#8F9A93', fontSize: 11, lineHeight: 17 },
  appealInput: { minHeight: 110, borderRadius: 14, borderWidth: 1, borderColor: '#405047', backgroundColor: '#0F1713', color: '#FFF8E8', padding: 12, textAlignVertical: 'top', fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: '#15140F', fontSize: 13, fontWeight: '900' },
  refreshButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
  errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817' },
  error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
});
