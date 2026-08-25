import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

type Decision = 'upheld' | 'reversed';
type EnforcementAction = 'advisory' | 'warning' | 'posting_restriction' | 'suspension' | 'ban';
type MediaType = 'image' | 'video' | null;

type AppealRow = {
  id: string;
  enforcement_id: string;
  member_id: string;
  appeal_reason: string;
  created_at: string;
  action_type: EnforcementAction;
  enforcement_reason: string;
  public_message: string | null;
  internal_note: string | null;
  issued_by: string | null;
  starts_at: string;
  expires_at: string | null;
  report_id: string | null;
  report_reason: string | null;
  report_details: string | null;
  content_snapshot: string | null;
  report_action_taken: string | null;
  report_created_at: string | null;
  target_type: 'Post' | 'Reply' | null;
  media_url: string | null;
  media_type: MediaType;
  active_warning_number: number | null;
  prior_actions: {
    id: string;
    action_type: EnforcementAction;
    reason: string;
    starts_at: string;
    expires_at: string | null;
    active: boolean;
  }[];
};

type RawAppeal = { id: string; enforcement_id: string; member_id: string; reason: string; created_at: string };
type RawEnforcement = {
  id: string;
  report_id: string | null;
  member_id: string;
  action_type: EnforcementAction;
  reason: string;
  public_message: string | null;
  internal_note: string | null;
  issued_by: string | null;
  starts_at: string;
  expires_at: string | null;
  active: boolean;
};
type RawReport = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  details: string | null;
  content_snapshot: string | null;
  action_taken: string | null;
  created_at: string;
};
type RawPost = { id: string; body: string; image_url: string | null; metadata: Record<string, unknown> | null };

async function signCommunityMedia(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from('community-media').createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

function actionLabel(action: EnforcementAction) {
  if (action === 'posting_restriction') return 'POSTING RESTRICTION';
  if (action === 'suspension') return 'TEMPORARY SUSPENSION';
  if (action === 'ban') return 'PERMANENT BAN';
  if (action === 'advisory') return 'ADVISORY';
  return 'FORMAL WARNING';
}

export default function ModerationAppealsScreen() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');

    const [adminResult, sessionResult] = await Promise.all([
      supabase.rpc('is_platform_admin'),
      supabase.auth.getSession(),
    ]);
    if (adminResult.error || adminResult.data !== true) {
      setAuthorized(false);
      setLoading(false);
      if (adminResult.error) setError(adminResult.error.message);
      return;
    }

    setAuthorized(true);
    setCurrentAdminId(sessionResult.data.session?.user.id ?? null);

    const { data: appealData, error: appealError } = await supabase
      .from('community_moderation_appeals')
      .select('id,enforcement_id,member_id,reason,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (appealError) {
      setError(appealError.message);
      setLoading(false);
      return;
    }

    const rawAppeals = (appealData ?? []) as RawAppeal[];
    if (!rawAppeals.length) {
      setAppeals([]);
      setLoading(false);
      return;
    }

    const enforcementIds = rawAppeals.map((item) => item.enforcement_id);
    const { data: enforcementData, error: enforcementError } = await supabase
      .from('community_member_enforcements')
      .select('id,report_id,member_id,action_type,reason,public_message,internal_note,issued_by,starts_at,expires_at,active')
      .in('id', enforcementIds);
    if (enforcementError) {
      setError(enforcementError.message);
      setLoading(false);
      return;
    }

    const enforcements = (enforcementData ?? []) as RawEnforcement[];
    const enforcementById = new Map(enforcements.map((item) => [item.id, item]));
    const reportIds = enforcements.map((item) => item.report_id).filter((id): id is string => Boolean(id));
    const memberIds = [...new Set(enforcements.map((item) => item.member_id))];

    const [reportResult, historyResult] = await Promise.all([
      reportIds.length
        ? supabase.from('community_reports').select('id,post_id,comment_id,reason,details,content_snapshot,action_taken,created_at').in('id', reportIds)
        : Promise.resolve({ data: [] as RawReport[], error: null }),
      memberIds.length
        ? supabase.from('community_member_enforcements').select('id,member_id,action_type,reason,starts_at,expires_at,active').in('member_id', memberIds).order('starts_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (reportResult.error || historyResult.error) {
      setError(reportResult.error?.message ?? historyResult.error?.message ?? 'Unable to load appeal history.');
      setLoading(false);
      return;
    }

    const reports = (reportResult.data ?? []) as RawReport[];
    const reportById = new Map(reports.map((item) => [item.id, item]));
    const postIds = reports.map((item) => item.post_id).filter((id): id is string => Boolean(id));

    let postById = new Map<string, RawPost>();
    if (postIds.length) {
      const { data: postData, error: postError } = await supabase
        .from('community_posts')
        .select('id,body,image_url,metadata')
        .in('id', postIds);
      if (postError) {
        setError(postError.message);
        setLoading(false);
        return;
      }
      postById = new Map(((postData ?? []) as RawPost[]).map((item) => [item.id, item]));
    }

    const histories = (historyResult.data ?? []) as (RawEnforcement & { member_id: string })[];
    const hydrated = await Promise.all(rawAppeals.map(async (appeal) => {
      const enforcement = enforcementById.get(appeal.enforcement_id);
      if (!enforcement) return null;
      const report = enforcement.report_id ? reportById.get(enforcement.report_id) ?? null : null;
      const post = report?.post_id ? postById.get(report.post_id) ?? null : null;
      const mediaType: MediaType = post?.image_url ? (post.metadata?.media_type === 'video' ? 'video' : 'image') : null;
      const mediaUrl = post?.image_url ? await signCommunityMedia(post.image_url) : null;
      const memberHistory = histories.filter((item) => item.member_id === appeal.member_id);
      const warnings = memberHistory
        .filter((item) => item.action_type === 'warning' && new Date(item.starts_at).getTime() <= new Date(enforcement.starts_at).getTime())
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      const warningIndex = enforcement.action_type === 'warning' ? warnings.findIndex((item) => item.id === enforcement.id) : -1;

      return {
        id: appeal.id,
        enforcement_id: appeal.enforcement_id,
        member_id: appeal.member_id,
        appeal_reason: appeal.reason,
        created_at: appeal.created_at,
        action_type: enforcement.action_type,
        enforcement_reason: enforcement.reason,
        public_message: enforcement.public_message,
        internal_note: enforcement.internal_note,
        issued_by: enforcement.issued_by,
        starts_at: enforcement.starts_at,
        expires_at: enforcement.expires_at,
        report_id: enforcement.report_id,
        report_reason: report?.reason ?? null,
        report_details: report?.details ?? null,
        content_snapshot: report?.content_snapshot ?? post?.body ?? null,
        report_action_taken: report?.action_taken ?? null,
        report_created_at: report?.created_at ?? null,
        target_type: report ? (report.comment_id ? 'Reply' : 'Post') : null,
        media_url: mediaUrl,
        media_type: mediaType,
        active_warning_number: warningIndex >= 0 ? warningIndex + 1 : null,
        prior_actions: memberHistory
          .filter((item) => item.id !== enforcement.id)
          .slice(0, 5)
          .map((item) => ({
            id: item.id,
            action_type: item.action_type,
            reason: item.reason,
            starts_at: item.starts_at,
            expires_at: item.expires_at,
            active: item.active,
          })),
      } satisfies AppealRow;
    }));

    setAppeals(hydrated.filter((item): item is AppealRow => Boolean(item)));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function decide(appeal: AppealRow, decision: Decision) {
    if (busyId) return;
    const note = decisionNotes[appeal.id]?.trim() ?? '';
    if (!note) {
      Alert.alert('Decision note required', 'Add a short explanation for why you are upholding or reversing this appeal.');
      return;
    }

    setBusyId(appeal.id);
    setError('');
    const { error: decisionError } = await supabase.rpc('decide_moderation_appeal', {
      p_appeal_id: appeal.id,
      p_decision: decision,
      p_note: note,
    });
    if (decisionError) setError(decisionError.message);
    else {
      setDecisionNotes((current) => {
        const next = { ...current };
        delete next[appeal.id];
        return next;
      });
      await load();
    }
    setBusyId(null);
  }

  function confirmDecision(appeal: AppealRow, decision: Decision) {
    const note = decisionNotes[appeal.id]?.trim() ?? '';
    if (!note) {
      Alert.alert('Decision note required', 'Document the reason for this appeal decision before continuing.');
      return;
    }
    Alert.alert(
      decision === 'reversed' ? 'Reverse this enforcement?' : 'Uphold this enforcement?',
      decision === 'reversed'
        ? 'The enforcement will be deactivated. If no other active restriction, suspension, or ban remains, the member’s access will be restored.'
        : 'The original enforcement will remain in effect and the member will be notified that the appeal was reviewed.',
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
          <Text style={styles.title}>Moderation Appeals</Text>
          <Text style={styles.subtitle}>Review the original evidence, enforcement history, and member statement before making a decision.</Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {appeals.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No appeals waiting</Text><Text style={styles.muted}>Pending moderation appeals will appear here.</Text></View> : null}

        {appeals.map((appeal) => {
          const busy = busyId === appeal.id;
          const sameModerator = Boolean(currentAdminId && appeal.issued_by && currentAdminId === appeal.issued_by);
          return <View key={appeal.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.pendingBadge}><Text style={styles.pendingText}>PENDING APPEAL</Text></View>
              <Text style={styles.date}>{new Date(appeal.created_at).toLocaleString()}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ORIGINAL CASE</Text>
              <Text style={styles.action}>{actionLabel(appeal.action_type)}</Text>
              <Text style={styles.reason}>{appeal.enforcement_reason}</Text>
              {appeal.active_warning_number ? <Text style={styles.warningNumber}>Formal warning {appeal.active_warning_number} of 3</Text> : null}
              <View style={styles.metaGrid}>
                <Text style={styles.meta}>Issued {new Date(appeal.starts_at).toLocaleString()}</Text>
                {appeal.expires_at ? <Text style={styles.meta}>Ends {new Date(appeal.expires_at).toLocaleString()}</Text> : <Text style={styles.meta}>No expiration</Text>}
              </View>
              {sameModerator ? <View style={styles.sameModerator}><Text style={styles.sameModeratorText}>You issued the original enforcement. When another admin is available, a different reviewer is preferred for appeals.</Text></View> : null}
            </View>

            <View style={styles.evidenceBox}>
              <Text style={styles.sectionLabel}>REPORTED EVIDENCE</Text>
              {appeal.target_type ? <Text style={styles.evidenceType}>{appeal.target_type} report · {appeal.report_reason ?? appeal.enforcement_reason}</Text> : null}
              {appeal.media_url && appeal.media_type === 'image' ? <Image source={{ uri: appeal.media_url }} resizeMode="cover" style={styles.evidenceImage} /> : null}
              {appeal.media_url && appeal.media_type === 'video' ? <Pressable style={styles.videoEvidence} onPress={() => { void Linking.openURL(appeal.media_url!); }}><Text style={styles.videoPlay}>▶</Text><View style={styles.videoTextWrap}><Text style={styles.videoTitle}>Reported video</Text><Text style={styles.videoHint}>Tap to play the original video evidence</Text></View></Pressable> : null}
              {appeal.content_snapshot ? <View style={styles.snapshot}><Text style={styles.snapshotLabel}>CONTENT SNAPSHOT</Text><Text style={styles.snapshotText}>{appeal.content_snapshot}</Text></View> : null}
              {appeal.report_details ? <Text style={styles.reporterNote}>Reporter note: {appeal.report_details}</Text> : null}
              {appeal.report_action_taken ? <Text style={styles.meta}>Original report action: {appeal.report_action_taken.replace(/_/g, ' ')}</Text> : null}
            </View>

            {appeal.internal_note ? <View style={styles.internalBox}><Text style={styles.sectionLabel}>ORIGINAL MODERATOR NOTE</Text><Text style={styles.internalText}>{appeal.internal_note}</Text></View> : null}

            <View style={styles.appealBox}>
              <Text style={styles.sectionLabel}>MEMBER APPEAL</Text>
              <Text style={styles.appealText}>{appeal.appeal_reason}</Text>
            </View>

            <View style={styles.historyBox}>
              <Text style={styles.sectionLabel}>RECENT MODERATION HISTORY</Text>
              {appeal.prior_actions.length === 0 ? <Text style={styles.meta}>No other enforcement actions on record.</Text> : appeal.prior_actions.map((item) => <View key={item.id} style={styles.historyRow}><View style={styles.historyText}><Text style={styles.historyAction}>{actionLabel(item.action_type)}</Text><Text style={styles.historyReason}>{item.reason}</Text><Text style={styles.meta}>{new Date(item.starts_at).toLocaleDateString()} · {item.active ? 'Active' : 'Historical'}</Text></View></View>)}
            </View>

            <View style={styles.decisionBox}>
              <Text style={styles.sectionLabel}>APPEAL DECISION</Text>
              <Text style={styles.decisionHint}>Required. This note becomes part of the internal appeal audit trail.</Text>
              <TextInput
                value={decisionNotes[appeal.id] ?? ''}
                onChangeText={(value) => setDecisionNotes((current) => ({ ...current, [appeal.id]: value }))}
                placeholder="Explain why the original decision should stand or be reversed…"
                placeholderTextColor="#68766E"
                multiline
                style={styles.noteInput}
              />
              <View style={styles.actions}>
                <Pressable disabled={busy} style={styles.upholdButton} onPress={() => confirmDecision(appeal, 'upheld')}><Text style={styles.upholdText}>{busy ? 'Working…' : 'Uphold decision'}</Text></Pressable>
                <Pressable disabled={busy} style={styles.reverseButton} onPress={() => confirmDecision(appeal, 'reversed')}><Text style={styles.reverseText}>{busy ? 'Working…' : 'Reverse enforcement'}</Text></Pressable>
              </View>
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
  card: { borderRadius: 20, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#17211C', padding: 15, gap: 12 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, pendingBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#7A6530', backgroundColor: '#2A2617', paddingHorizontal: 8, paddingVertical: 4 }, pendingText: { color: '#F0D083', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, date: { color: '#7F8B83', fontSize: 10 },
  section: { gap: 6 }, sectionLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, action: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 }, reason: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, warningNumber: { color: '#F2D17E', fontSize: 12, fontWeight: '900' }, metaGrid: { gap: 2 }, meta: { color: '#8D9A92', fontSize: 11, lineHeight: 16 },
  sameModerator: { borderRadius: 11, borderWidth: 1, borderColor: '#6C582C', backgroundColor: '#262112', padding: 10 }, sameModeratorText: { color: '#E8CE8A', fontSize: 11, lineHeight: 16 },
  evidenceBox: { borderRadius: 15, borderWidth: 1, borderColor: '#3B4C42', backgroundColor: '#101914', padding: 12, gap: 9 }, evidenceType: { color: '#E5EAE7', fontSize: 12, fontWeight: '800' }, evidenceImage: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#0B110E' }, videoEvidence: { minHeight: 104, borderRadius: 12, borderWidth: 1, borderColor: '#59695F', backgroundColor: '#18241E', flexDirection: 'row', alignItems: 'center', padding: 14, gap: 13 }, videoPlay: { width: 44, height: 44, borderRadius: 22, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#D7B45A', color: '#15140F', fontSize: 18, fontWeight: '900' }, videoTextWrap: { flex: 1, gap: 2 }, videoTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, videoHint: { color: '#9EAAA2', fontSize: 11, lineHeight: 16 }, snapshot: { borderRadius: 11, backgroundColor: '#18211C', padding: 10, gap: 4 }, snapshotLabel: { color: '#9EAAA2', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, snapshotText: { color: '#FFF8E8', fontSize: 13, lineHeight: 19 }, reporterNote: { color: '#C9D1CC', fontSize: 11, lineHeight: 17 },
  internalBox: { borderRadius: 14, borderWidth: 1, borderColor: '#4B422D', backgroundColor: '#211E14', padding: 12, gap: 6 }, internalText: { color: '#E9E0C9', fontSize: 12, lineHeight: 18 },
  appealBox: { borderRadius: 14, borderWidth: 1, borderColor: '#536C5D', backgroundColor: '#14221A', padding: 12, gap: 6 }, appealText: { color: '#FFF8E8', fontSize: 14, lineHeight: 21 },
  historyBox: { borderRadius: 14, borderWidth: 1, borderColor: '#2E3E35', backgroundColor: '#111A15', padding: 12, gap: 9 }, historyRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#314138', paddingTop: 8 }, historyText: { gap: 2 }, historyAction: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, historyReason: { color: '#E5EAE7', fontSize: 12, fontWeight: '800' },
  decisionBox: { borderRadius: 15, borderWidth: 1, borderColor: '#5D5130', backgroundColor: '#1F1C13', padding: 12, gap: 9 }, decisionHint: { color: '#A99E79', fontSize: 10, lineHeight: 15 }, noteInput: { minHeight: 96, borderRadius: 12, borderWidth: 1, borderColor: '#4B5146', backgroundColor: '#0F1713', color: '#FFF8E8', padding: 11, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' },
  actions: { gap: 8, marginTop: 2 }, upholdButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#59695F', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2822' }, upholdText: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, reverseButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#7A433C', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1D1B' }, reverseText: { color: '#FFB4A9', fontSize: 12, fontWeight: '900' },
});
