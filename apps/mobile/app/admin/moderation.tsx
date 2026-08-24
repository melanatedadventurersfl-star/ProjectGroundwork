import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

type ReportRow = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reported_author_id: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'normal' | 'high';
  content_snapshot: string | null;
  created_at: string;
  action_taken: string | null;
};

type EnforcementAction = 'advisory' | 'warning' | 'posting_restriction' | 'suspension' | 'ban';

const ACTIONS: { value: EnforcementAction; label: string; detail: string; defaultHours?: number }[] = [
  { value: 'advisory', label: 'Advisory', detail: 'Private guideline reminder. Does not count as an active warning.' },
  { value: 'warning', label: 'Formal warning', detail: 'Confirmed violation. Counts as an active warning for 90 days.' },
  { value: 'posting_restriction', label: 'Posting restriction', detail: 'Member can browse but cannot create or edit posts/comments.', defaultHours: 24 },
  { value: 'suspension', label: 'Temporary suspension', detail: 'Member is locked to Account Status until the suspension expires.', defaultHours: 168 },
  { value: 'ban', label: 'Permanent ban', detail: 'Permanently suspends the member. Requires an internal moderator note.' },
];

const DURATIONS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
];

export default function ModerationQueueScreen() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [selectedAction, setSelectedAction] = useState<EnforcementAction>('warning');
  const [durationHours, setDurationHours] = useState(168);
  const [removeContent, setRemoveContent] = useState(true);
  const [note, setNote] = useState('');

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
    const { data, error: reportError } = await supabase
      .from('community_reports')
      .select('id,post_id,comment_id,reported_author_id,reason,details,status,priority,content_snapshot,created_at,action_taken')
      .in('status', ['open', 'reviewing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (reportError) setError(reportError.message);
    else setReports((data ?? []) as ReportRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function moderate(reportId: string, status: 'reviewing' | 'resolved' | 'dismissed', action: 'none' | 'remove_content') {
    if (busyId) return;
    setBusyId(reportId);
    setError('');
    const { error: actionError } = await supabase.rpc('moderate_community_report', {
      p_report_id: reportId,
      p_status: status,
      p_action: action,
      p_note: null,
    });
    if (actionError) setError(actionError.message);
    else await load();
    setBusyId(null);
  }

  function openEnforcement(report: ReportRow) {
    setSelectedReport(report);
    setSelectedAction('warning');
    setDurationHours(168);
    setRemoveContent(true);
    setNote('');
  }

  function chooseAction(action: EnforcementAction) {
    setSelectedAction(action);
    const configured = ACTIONS.find((item) => item.value === action);
    if (configured?.defaultHours) setDurationHours(configured.defaultHours);
    if (action === 'advisory') setRemoveContent(false);
  }

  async function confirmEnforcement() {
    if (!selectedReport || busyId) return;
    if (selectedAction === 'ban' && !note.trim()) {
      Alert.alert('Internal note required', 'Permanent bans require an internal moderator note explaining the decision.');
      return;
    }
    setBusyId(selectedReport.id);
    setError('');
    const timed = selectedAction === 'posting_restriction' || selectedAction === 'suspension';
    const { error: actionError } = await supabase.rpc('enforce_community_report', {
      p_report_id: selectedReport.id,
      p_action: selectedAction,
      p_duration_hours: timed ? durationHours : null,
      p_remove_content: removeContent,
      p_note: note.trim() || null,
    });
    if (actionError) {
      setError(actionError.message);
      setBusyId(null);
      return;
    }
    setSelectedReport(null);
    await load();
    setBusyId(null);
  }

  const selectedDefinition = useMemo(() => ACTIONS.find((item) => item.value === selectedAction), [selectedAction]);
  const needsDuration = selectedAction === 'posting_restriction' || selectedAction === 'suspension';

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading moderation queue…</Text></View></SafeAreaView>;
  }

  if (!authorized) {
    return <SafeAreaView style={styles.safe}><View style={styles.content}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><View style={styles.denied}><Text style={styles.eyebrow}>PROTECTED AREA</Text><Text style={styles.title}>Admin access required</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
          <Text style={styles.title}>Moderation Queue</Text>
          <Text style={styles.subtitle}>Use progressive enforcement for ordinary violations. Serious safety issues can move directly to suspension or permanent removal. Every formal action becomes part of the member's moderation history.</Text>
        </View>

        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Enforcement ladder</Text>
          <Text style={styles.policyCopy}>Advisory → Warning → Posting restriction → Suspension → Permanent ban</Text>
          <Text style={styles.policyHint}>Warnings remain active for 90 days. Permanent bans require an internal note.</Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {reports.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Queue clear</Text><Text style={styles.muted}>There are no open community reports waiting for review.</Text></View> : null}

        {reports.map((report) => {
          const busy = busyId === report.id;
          const targetLabel = report.comment_id ? 'Reply' : 'Post';
          return <View key={report.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.priorityBadge, report.priority === 'high' && styles.highPriority]}><Text style={[styles.priorityText, report.priority === 'high' && styles.highPriorityText]}>{report.priority === 'high' ? 'HIGH PRIORITY' : report.status.toUpperCase()}</Text></View>
              <Text style={styles.date}>{new Date(report.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.target}>{targetLabel} report</Text>
            <Text style={styles.reason}>{report.reason}</Text>
            {report.content_snapshot ? <View style={styles.snapshot}><Text style={styles.snapshotLabel}>REPORTED CONTENT</Text><Text style={styles.snapshotText}>{report.content_snapshot}</Text></View> : null}
            {report.details ? <Text style={styles.details}>Reporter note: {report.details}</Text> : null}

            <View style={styles.actions}>
              {report.status === 'open' ? <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => void moderate(report.id, 'reviewing', 'none')}><Text style={styles.secondaryText}>Start review</Text></Pressable> : null}
              <Pressable disabled={busy} style={styles.enforceButton} onPress={() => openEnforcement(report)}><Text style={styles.enforceText}>{busy ? 'Working…' : 'Take action'}</Text></Pressable>
              <Pressable disabled={busy} style={styles.removeButton} onPress={() => void moderate(report.id, 'resolved', 'remove_content')}><Text style={styles.removeText}>{busy ? 'Working…' : 'Remove content only'}</Text></Pressable>
              <Pressable disabled={busy} style={styles.dismissButton} onPress={() => void moderate(report.id, 'dismissed', 'none')}><Text style={styles.dismissText}>No violation</Text></Pressable>
            </View>
          </View>;
        })}
      </ScrollView>

      <Modal visible={Boolean(selectedReport)} transparent animationType="slide" onRequestClose={() => setSelectedReport(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHeader}>
                <View style={styles.flex}><Text style={styles.eyebrow}>ENFORCEMENT</Text><Text style={styles.sheetTitle}>Choose an action</Text></View>
                <Pressable onPress={() => setSelectedReport(null)}><Text style={styles.close}>Close</Text></Pressable>
              </View>

              <Text style={styles.sheetReason}>Report reason: {selectedReport?.reason}</Text>

              <View style={styles.optionList}>
                {ACTIONS.map((action) => <Pressable key={action.value} onPress={() => chooseAction(action.value)} style={[styles.option, selectedAction === action.value && styles.optionSelected]}>
                  <View style={[styles.radio, selectedAction === action.value && styles.radioSelected]} />
                  <View style={styles.flex}><Text style={styles.optionTitle}>{action.label}</Text><Text style={styles.optionDetail}>{action.detail}</Text></View>
                </Pressable>)}
              </View>

              {needsDuration ? <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>DURATION</Text><View style={styles.durationRow}>{DURATIONS.map((item) => <Pressable key={item.hours} onPress={() => setDurationHours(item.hours)} style={[styles.durationChip, durationHours === item.hours && styles.durationChipSelected]}><Text style={[styles.durationText, durationHours === item.hours && styles.durationTextSelected]}>{item.label}</Text></Pressable>)}</View></View> : null}

              <View style={styles.toggleRow}><View style={styles.flex}><Text style={styles.fieldLabel}>REMOVE REPORTED CONTENT</Text><Text style={styles.toggleHint}>The report snapshot remains in moderation history.</Text></View><Switch value={removeContent} onValueChange={setRemoveContent} trackColor={{ false: '#39483F', true: '#8C7133' }} thumbColor={removeContent ? '#F2D17E' : '#C7CEC9'} /></View>

              <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>INTERNAL MODERATOR NOTE{selectedAction === 'ban' ? ' · REQUIRED' : ''}</Text><TextInput value={note} onChangeText={setNote} placeholder="Why are you taking this action? Add context for future moderators." placeholderTextColor="#68766E" multiline style={styles.noteInput} /></View>

              <View style={styles.selectionSummary}><Text style={styles.summaryTitle}>{selectedDefinition?.label}</Text><Text style={styles.summaryCopy}>{selectedDefinition?.detail}</Text>{needsDuration ? <Text style={styles.summaryMeta}>Ends after {DURATIONS.find((item) => item.hours === durationHours)?.label ?? `${durationHours} hours`}</Text> : null}</View>

              <Pressable disabled={Boolean(busyId)} style={[styles.confirmButton, selectedAction === 'ban' && styles.banButton]} onPress={() => void confirmEnforcement()}><Text style={styles.confirmText}>{busyId ? 'Applying action…' : selectedAction === 'ban' ? 'Confirm permanent ban' : 'Confirm enforcement'}</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 54, gap: 14 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, flex: { flex: 1 },
  back: { color: '#D7B45A', fontSize: 16, fontWeight: '800', paddingVertical: 6 }, header: { gap: 5, marginBottom: 4 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 32, lineHeight: 37, fontWeight: '900' }, subtitle: { color: '#A9B4AD', fontSize: 13, lineHeight: 19 }, muted: { color: '#8D9A92', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  policyCard: { borderRadius: 16, borderWidth: 1, borderColor: '#5B4E2B', backgroundColor: '#211E14', padding: 14, gap: 4 }, policyTitle: { color: '#F2D17E', fontSize: 14, fontWeight: '900' }, policyCopy: { color: '#FFF8E8', fontSize: 12, lineHeight: 18, fontWeight: '800' }, policyHint: { color: '#A99E79', fontSize: 11, lineHeight: 16 },
  denied: { marginTop: 28, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#523B35', backgroundColor: '#211817', gap: 8 }, errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817' }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
  empty: { marginTop: 18, alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1, borderColor: '#2D3B33', backgroundColor: '#17211C', padding: 24 }, emptyTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#17211C', padding: 15, gap: 10 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, priorityBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#53665A', backgroundColor: '#213028', paddingHorizontal: 8, paddingVertical: 4 }, highPriority: { borderColor: '#7A433C', backgroundColor: '#2A1D1B' }, priorityText: { color: '#B8C5BD', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, highPriorityText: { color: '#FFB4A9' }, date: { color: '#7F8B83', fontSize: 10 }, target: { color: '#8D9A92', fontSize: 11, fontWeight: '800' }, reason: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, snapshot: { borderRadius: 12, backgroundColor: '#101914', borderWidth: 1, borderColor: '#2A3A31', padding: 12, gap: 5 }, snapshotLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, snapshotText: { color: '#E2E8E4', fontSize: 14, lineHeight: 20 }, details: { color: '#A9B4AD', fontSize: 12, lineHeight: 18 }, actions: { gap: 8, marginTop: 2 },
  secondaryButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#45584D', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2822' }, secondaryText: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, enforceButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#9A7B34', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7B45A' }, enforceText: { color: '#17150E', fontSize: 13, fontWeight: '900' }, removeButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#7A433C', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1D1B' }, removeText: { color: '#FFB4A9', fontSize: 12, fontWeight: '900' }, dismissButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' }, dismissText: { color: '#8D9A92', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3,8,5,0.72)', justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', backgroundColor: '#121C17', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#33443A' }, sheetContent: { padding: 20, paddingBottom: 40, gap: 16 }, sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, sheetTitle: { color: '#FFF8E8', fontSize: 25, fontWeight: '900', marginTop: 3 }, close: { color: '#D7B45A', fontSize: 13, fontWeight: '900', paddingVertical: 6 }, sheetReason: { color: '#A9B4AD', fontSize: 12, lineHeight: 18 },
  optionList: { gap: 8 }, option: { flexDirection: 'row', gap: 11, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#314138', backgroundColor: '#17211C' }, optionSelected: { borderColor: '#9A7B34', backgroundColor: '#211E14' }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#617067', marginTop: 2 }, radioSelected: { borderColor: '#D7B45A', backgroundColor: '#D7B45A' }, optionTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, optionDetail: { color: '#94A199', fontSize: 11, lineHeight: 16, marginTop: 2 },
  fieldGroup: { gap: 8 }, fieldLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, durationChip: { borderRadius: 999, borderWidth: 1, borderColor: '#425249', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#17211C' }, durationChipSelected: { borderColor: '#D7B45A', backgroundColor: '#D7B45A' }, durationText: { color: '#D7DED9', fontSize: 11, fontWeight: '800' }, durationTextSelected: { color: '#17150E' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#314138', backgroundColor: '#17211C' }, toggleHint: { color: '#7F8B83', fontSize: 10, lineHeight: 15, marginTop: 3 }, noteInput: { minHeight: 94, borderRadius: 14, borderWidth: 1, borderColor: '#405047', backgroundColor: '#0F1713', color: '#FFF8E8', padding: 12, textAlignVertical: 'top', fontSize: 13, lineHeight: 18 },
  selectionSummary: { borderRadius: 14, borderWidth: 1, borderColor: '#4A4025', backgroundColor: '#211E14', padding: 13, gap: 4 }, summaryTitle: { color: '#F2D17E', fontSize: 15, fontWeight: '900' }, summaryCopy: { color: '#D9D4C5', fontSize: 11, lineHeight: 17 }, summaryMeta: { color: '#A99E79', fontSize: 10, fontWeight: '800', marginTop: 2 }, confirmButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7B45A' }, banButton: { backgroundColor: '#D55C4D' }, confirmText: { color: '#15140F', fontSize: 13, fontWeight: '900' },
});
