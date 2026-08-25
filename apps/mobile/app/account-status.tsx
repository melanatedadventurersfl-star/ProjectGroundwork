import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../src/lib/supabase';

type Tab = 'standing' | 'decisions' | 'appeals';
type Decision = { id: string; case_ref: string; action_type: string; reason: string; message: string | null; starts_at: string; expires_at: string | null; active: boolean; status: 'active' | 'completed' | 'reversed'; target_type: string | null; content_summary: string | null; content_removed: boolean; appeal_status: 'pending' | 'upheld' | 'reversed' | null; appeal_id: string | null };
type Appeal = { id: string; case_ref: string; enforcement_id: string; action_type: string; reason: string; appeal_reason: string; status: 'pending' | 'upheld' | 'reversed'; submitted_at: string; decided_at: string | null; decision_summary: string | null };
type Primary = { id: string; case_ref: string; action_type: 'posting_restriction' | 'suspension' | 'ban'; reason: string; message: string; starts_at: string; expires_at: string | null };
type Standing = { profile_status: string; active_warning_count: number; warning_threshold: number; twelve_month_violation_count: number; reporting_allowed: boolean; primary_enforcement: Primary | null; decisions: Decision[]; appeals: Appeal[]; next_escalation: string };

function labelAction(action: string) {
  if (action === 'posting_restriction') return 'Posting Restricted';
  if (action === 'reporting_restriction') return 'Reporting Restricted';
  if (action === 'suspension') return 'Account Suspended';
  if (action === 'ban') return 'Account Banned';
  return 'Formal Warning';
}
function date(value: string | null) { return value ? new Date(value).toLocaleString() : 'No expiration'; }

export default function AccountStatusScreen() {
  const [loading, setLoading] = useState(true);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [tab, setTab] = useState<Tab>('standing');
  const [selected, setSelected] = useState<Decision | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    const { data, error: standingError } = await supabase.rpc('get_my_account_standing');
    if (standingError) setError(standingError.message); else setStanding(data as Standing);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const activeDecision = useMemo(() => standing?.decisions.find((item) => item.active) ?? null, [standing]);
  const appealTarget = selected ?? activeDecision;
  const canAppeal = Boolean(appealTarget && !appealTarget.appeal_status && ['warning','posting_restriction','suspension','ban'].includes(appealTarget.action_type));

  async function submitAppeal() {
    if (!appealTarget || submitting) return;
    if (!appealReason.trim()) { Alert.alert('Add your appeal', 'Tell us why you believe this decision should be reviewed.'); return; }
    setSubmitting(true); setError('');
    const { error: appealError } = await supabase.rpc('submit_moderation_appeal', { p_enforcement_id: appealTarget.id, p_reason: appealReason.trim() });
    if (appealError) setError(appealError.message); else { setAppealReason(''); setSelected(null); setTab('appeals'); await load(); }
    setSubmitting(false);
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading Account Standing…</Text></View></SafeAreaView>;
  const primary = standing?.primary_enforcement;
  const good = !primary && (standing?.active_warning_count ?? 0) === 0;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Account</Text></Pressable><Text style={styles.eyebrow}>COMMUNITY SAFETY</Text><Text style={styles.title}>Account Standing</Text><Text style={styles.subtitle}>Your current standing, moderation decisions, and appeal status in one place.</Text></View>
    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={[styles.hero, primary?.action_type === 'ban' && styles.heroDanger, good && styles.heroGood]}>
      <Text style={styles.heroEyebrow}>{good ? 'GOOD STANDING' : primary ? 'CURRENT STATUS' : 'ACTIVE WARNING'}</Text>
      <Text style={styles.heroTitle}>{good ? 'Good Standing' : primary ? labelAction(primary.action_type) : `${standing?.active_warning_count ?? 0} Active Warning${standing?.active_warning_count === 1 ? '' : 's'}`}</Text>
      <Text style={styles.heroCopy}>{good ? 'You have no active warnings, restrictions, suspensions, or bans.' : primary?.message ?? standing?.next_escalation}</Text>
      {primary?.expires_at ? <Text style={styles.heroMeta}>Access changes {date(primary.expires_at)}</Text> : null}
      {primary?.case_ref ? <Text style={styles.caseRef}>{primary.case_ref}</Text> : null}
    </View>

    <View style={styles.tabs}>{(['standing','decisions','appeals'] as Tab[]).map((item) => <Pressable key={item} onPress={() => { setTab(item); setSelected(null); }} style={[styles.tab, tab === item && styles.tabSelected]}><Text style={[styles.tabText, tab === item && styles.tabTextSelected]}>{item === 'standing' ? 'Standing' : item === 'decisions' ? 'Decisions' : 'Appeals'}</Text></Pressable>)}</View>

    {tab === 'standing' ? <>
      <View style={styles.stats}><Stat value={`${standing?.active_warning_count ?? 0}`} label="ACTIVE WARNINGS" /><Stat value={`${standing?.twelve_month_violation_count ?? 0}`} label="12-MONTH HISTORY" /><Stat value={`${standing?.appeals.filter((a) => a.status === 'pending').length ?? 0}`} label="PENDING APPEALS" /></View>
      <View style={styles.card}><Text style={styles.sectionLabel}>WHAT YOU CAN DO</Text><Privilege ok label="Browse Community" /><Privilege ok label="View your account and appeals" /><Privilege ok={standing?.reporting_allowed ?? true} label="Submit community reports" /><Privilege ok={!primary || primary.action_type === 'ban' ? !primary : false} label="Create or edit Community content" /></View>
      <View style={styles.card}><Text style={styles.sectionLabel}>WHAT HAPPENS NEXT</Text><Text style={styles.body}>{standing?.next_escalation}</Text><Text style={styles.hint}>Active warnings expire after their stated period. Previous confirmed violations can still be considered when reviewing repeated behavior.</Text></View>
      {activeDecision ? <DecisionCard item={activeDecision} onPress={() => { setSelected(activeDecision); setTab('decisions'); }} /> : null}
    </> : null}

    {tab === 'decisions' ? <>
      <Text style={styles.sectionLabel}>DECISION HISTORY</Text>
      {(standing?.decisions.length ?? 0) === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No moderation decisions</Text><Text style={styles.muted}>There is nothing in your decision history.</Text></View> : standing?.decisions.map((item) => <DecisionCard key={item.id} item={item} selected={selected?.id === item.id} onPress={() => setSelected(selected?.id === item.id ? null : item)} />)}
      {selected ? <View style={styles.detailCard}><Text style={styles.caseRef}>{selected.case_ref}</Text><Text style={styles.detailTitle}>{labelAction(selected.action_type)}</Text><Detail label="STATUS" value={selected.status.toUpperCase()} /><Detail label="GUIDELINE" value={selected.reason} /><Detail label="ISSUED" value={date(selected.starts_at)} /><Detail label="ENDS" value={date(selected.expires_at)} />{selected.content_removed ? <Detail label="CONTENT" value="Removed from the Community. The original evidence is retained privately for review." /> : selected.content_summary ? <Detail label="CONTENT SUMMARY" value={selected.content_summary} /> : null}{selected.appeal_status ? <Detail label="APPEAL" value={selected.appeal_status.toUpperCase()} /> : null}{canAppeal ? <View style={styles.appealBox}><Text style={styles.sectionLabel}>APPEAL THIS DECISION</Text><Text style={styles.hint}>Reporter identities and private moderator notes are never shown here.</Text><TextInput value={appealReason} onChangeText={setAppealReason} placeholder="Explain why this decision should be reconsidered…" placeholderTextColor="#68766E" multiline style={styles.input} /><Pressable disabled={submitting} onPress={() => void submitAppeal()} style={styles.primary}><Text style={styles.primaryText}>{submitting ? 'Submitting…' : 'Submit appeal'}</Text></Pressable></View> : null}</View> : null}
    </> : null}

    {tab === 'appeals' ? <>
      <Text style={styles.sectionLabel}>APPEAL TRACKING</Text>
      {(standing?.appeals.length ?? 0) === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No appeals</Text><Text style={styles.muted}>Appeals you submit will be tracked here.</Text></View> : standing?.appeals.map((appeal) => <View key={appeal.id} style={styles.appealCard}><View style={styles.row}><Text style={styles.caseRef}>{appeal.case_ref}</Text><Text style={styles.statusBadge}>{appeal.status.toUpperCase()}</Text></View><Text style={styles.detailTitle}>{labelAction(appeal.action_type)}</Text><Text style={styles.body}>{appeal.reason}</Text><View style={styles.tracker}><Tracker active label="Submitted" /><Tracker active label="Under Review" muted={appeal.status !== 'pending'} /><Tracker active={appeal.status !== 'pending'} label={appeal.status === 'pending' ? 'Decision' : appeal.status === 'reversed' ? 'Reversed' : 'Upheld'} /></View><Text style={styles.hint}>Submitted {date(appeal.submitted_at)}</Text>{appeal.decision_summary ? <View style={styles.decisionResult}><Text style={styles.body}>{appeal.decision_summary}</Text>{appeal.decided_at ? <Text style={styles.hint}>Decision {date(appeal.decided_at)}</Text> : null}</View> : <Text style={styles.hint}>The original account action remains in effect while the appeal is reviewed.</Text>}</View>)}
    </> : null}

    <Pressable style={styles.guidelines} onPress={() => router.push('/community-guidelines' as never)}><Text style={styles.guidelinesText}>View Community Guidelines</Text></Pressable>
    <Pressable style={styles.refresh} onPress={() => void load()}><Text style={styles.refreshText}>Refresh Account Standing</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Privilege({ ok, label }: { ok: boolean; label: string }) { return <View style={styles.privilege}><Text style={[styles.privilegeIcon, !ok && styles.no]}>●</Text><Text style={styles.body}>{ok ? label : `${label} unavailable`}</Text></View>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>; }
function Tracker({ active, label, muted }: { active?: boolean; label: string; muted?: boolean }) { return <View style={styles.trackItem}><View style={[styles.trackDot, active && styles.trackDotActive, muted && styles.trackDotMuted]} /><Text style={[styles.trackText, !active && styles.trackTextMuted]}>{label}</Text></View>; }
function DecisionCard({ item, onPress, selected }: { item: Decision; onPress: () => void; selected?: boolean }) { return <Pressable onPress={onPress} style={[styles.decisionCard, selected && styles.selected]}><View style={styles.row}><Text style={styles.action}>{labelAction(item.action_type)}</Text><Text style={styles.caseRef}>{item.case_ref}</Text></View><Text style={styles.decisionReason}>{item.reason}</Text><Text style={styles.hint}>{date(item.starts_at)} · {item.status.toUpperCase()}{item.appeal_status ? ` · APPEAL ${item.appeal_status.toUpperCase()}` : ''}</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 54, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, header: { gap: 4 }, back: { color: '#D7B45A', fontSize: 16, fontWeight: '800', paddingVertical: 6 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 39, fontWeight: '900' }, subtitle: { color: '#A9B4AD', fontSize: 13, lineHeight: 19 }, muted: { color: '#8D9A92', fontSize: 12, lineHeight: 18 },
  hero: { borderRadius: 22, borderWidth: 1, borderColor: '#7A6530', backgroundColor: '#211E14', padding: 19, gap: 7 }, heroDanger: { borderColor: '#78443D', backgroundColor: '#251918' }, heroGood: { borderColor: '#3E5A49', backgroundColor: '#17251D' }, heroEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, heroTitle: { color: '#FFF8E8', fontSize: 27, lineHeight: 32, fontWeight: '900' }, heroCopy: { color: '#C2CBC5', fontSize: 13, lineHeight: 19 }, heroMeta: { color: '#F2D17E', fontSize: 11, fontWeight: '800' }, caseRef: { color: '#8D9A92', fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  tabs: { flexDirection: 'row', backgroundColor: '#121C17', borderRadius: 14, padding: 4, gap: 4 }, tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, tabSelected: { backgroundColor: '#D7B45A' }, tabText: { color: '#8D9A92', fontSize: 11, fontWeight: '900' }, tabTextSelected: { color: '#15140F' }, stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 1, borderColor: '#2E3E35', backgroundColor: '#17211C', padding: 11, alignItems: 'center', gap: 2 }, statValue: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' }, statLabel: { color: '#7F8B83', fontSize: 7.5, fontWeight: '900', textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#314138', backgroundColor: '#17211C', padding: 14, gap: 8 }, sectionLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .9 }, body: { color: '#E3E9E5', fontSize: 12, lineHeight: 18 }, hint: { color: '#87938C', fontSize: 10.5, lineHeight: 16 }, privilege: { flexDirection: 'row', gap: 8, alignItems: 'center' }, privilegeIcon: { color: '#8CCB5E', fontSize: 11 }, no: { color: '#D88767' },
  decisionCard: { borderRadius: 15, borderWidth: 1, borderColor: '#314138', backgroundColor: '#17211C', padding: 13, gap: 5 }, selected: { borderColor: '#D7B45A', backgroundColor: '#211E14' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, action: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .6 }, decisionReason: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, detailCard: { borderRadius: 17, borderWidth: 1, borderColor: '#5C5030', backgroundColor: '#1D1B13', padding: 15, gap: 10 }, detailTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, detail: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#474331', paddingTop: 9, gap: 3 }, detailLabel: { color: '#A99E79', fontSize: 8, fontWeight: '900', letterSpacing: .8 }, detailValue: { color: '#FFF8E8', fontSize: 12, lineHeight: 18 },
  appealBox: { borderTopWidth: 1, borderTopColor: '#4A422C', paddingTop: 12, gap: 8 }, input: { minHeight: 104, borderRadius: 13, borderWidth: 1, borderColor: '#405047', backgroundColor: '#0F1713', color: '#FFF8E8', padding: 11, textAlignVertical: 'top', fontSize: 12, lineHeight: 18 }, primary: { minHeight: 46, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#15140F', fontSize: 12, fontWeight: '900' }, appealCard: { borderRadius: 17, borderWidth: 1, borderColor: '#405449', backgroundColor: '#17211C', padding: 14, gap: 8 }, statusBadge: { color: '#F2D17E', fontSize: 9, fontWeight: '900' }, tracker: { gap: 8, paddingVertical: 4 }, trackItem: { flexDirection: 'row', alignItems: 'center', gap: 8 }, trackDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#58655D' }, trackDotActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, trackDotMuted: { backgroundColor: '#627068', borderColor: '#627068' }, trackText: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' }, trackTextMuted: { color: '#738078' }, decisionResult: { borderRadius: 12, backgroundColor: '#111A15', padding: 10, gap: 3 }, empty: { alignItems: 'center', padding: 22, borderRadius: 16, borderWidth: 1, borderColor: '#2E3E35', backgroundColor: '#17211C', gap: 5 }, emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, guidelines: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#59695F', alignItems: 'center', justifyContent: 'center' }, guidelinesText: { color: '#E7ECE8', fontSize: 12, fontWeight: '900' }, refresh: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, refreshText: { color: '#D7B45A', fontSize: 12, fontWeight: '800' }, errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817' }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
});
