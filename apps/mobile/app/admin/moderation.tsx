import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

type ReportRow = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'normal' | 'high';
  content_snapshot: string | null;
  created_at: string;
  action_taken: string | null;
};

export default function ModerationQueueScreen() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
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
    const { data, error: reportError } = await supabase
      .from('community_reports')
      .select('id,post_id,comment_id,reason,details,status,priority,content_snapshot,created_at,action_taken')
      .in('status', ['open', 'reviewing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (reportError) setError(reportError.message);
    else setReports((data ?? []) as ReportRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function moderate(reportId: string, status: 'reviewing' | 'resolved' | 'dismissed', action: 'none' | 'warning' | 'remove_content') {
    if (busyId) return;
    setBusyId(reportId);
    setError('');
    const { error: actionError } = await supabase.rpc('moderate_community_report', {
      p_report_id: reportId,
      p_status: status,
      p_action: action,
      p_note: null,
    });
    if (actionError) {
      setError(actionError.message);
      setBusyId(null);
      return;
    }
    await load();
    setBusyId(null);
  }

  function confirmWarning(report: ReportRow) {
    if (busyId) return;
    Alert.alert(
      'Warn this member?',
      'This confirms a Community Guidelines violation. The member will receive a high-priority in-app warning, the warning will be saved to their moderation history, and this report will be resolved. The content will stay up.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send warning', style: 'destructive', onPress: () => { void moderate(report.id, 'resolved', 'warning'); } },
      ],
    );
  }

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
          <Text style={styles.subtitle}>Reports stay here until reviewed. Warnings notify the member and become part of their moderation history. Removing content preserves the report snapshot for the moderation record.</Text>
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
              <Pressable disabled={busy} style={styles.warningButton} onPress={() => confirmWarning(report)}><Text style={styles.warningText}>{busy ? 'Working…' : 'Warn & resolve'}</Text></Pressable>
              <Pressable disabled={busy} style={styles.removeButton} onPress={() => void moderate(report.id, 'resolved', 'remove_content')}><Text style={styles.removeText}>{busy ? 'Working…' : 'Remove content'}</Text></Pressable>
              <Pressable disabled={busy} style={styles.dismissButton} onPress={() => void moderate(report.id, 'dismissed', 'none')}><Text style={styles.dismissText}>No violation</Text></Pressable>
            </View>
          </View>;
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 54, gap: 14 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  back: { color: '#D7B45A', fontSize: 16, fontWeight: '800', paddingVertical: 6 }, header: { gap: 5, marginBottom: 4 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 32, lineHeight: 37, fontWeight: '900' }, subtitle: { color: '#A9B4AD', fontSize: 13, lineHeight: 19 }, muted: { color: '#8D9A92', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  denied: { marginTop: 28, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#523B35', backgroundColor: '#211817', gap: 8 }, errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817' }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
  empty: { marginTop: 18, alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1, borderColor: '#2D3B33', backgroundColor: '#17211C', padding: 24 }, emptyTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#17211C', padding: 15, gap: 10 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, priorityBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#53665A', backgroundColor: '#213028', paddingHorizontal: 8, paddingVertical: 4 }, highPriority: { borderColor: '#7A433C', backgroundColor: '#2A1D1B' }, priorityText: { color: '#B8C5BD', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, highPriorityText: { color: '#FFB4A9' }, date: { color: '#7F8B83', fontSize: 10 }, target: { color: '#8D9A92', fontSize: 11, fontWeight: '800' }, reason: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, snapshot: { borderRadius: 12, backgroundColor: '#101914', borderWidth: 1, borderColor: '#2A3A31', padding: 12, gap: 5 }, snapshotLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, snapshotText: { color: '#E2E8E4', fontSize: 14, lineHeight: 20 }, details: { color: '#A9B4AD', fontSize: 12, lineHeight: 18 }, actions: { gap: 8, marginTop: 2 },
  secondaryButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#45584D', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2822' }, secondaryText: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, warningButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#806B39', alignItems: 'center', justifyContent: 'center', backgroundColor: '#292617' }, warningText: { color: '#F0D083', fontSize: 12, fontWeight: '900' }, removeButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#7A433C', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1D1B' }, removeText: { color: '#FFB4A9', fontSize: 12, fontWeight: '900' }, dismissButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' }, dismissText: { color: '#8D9A92', fontSize: 12, fontWeight: '800' },
});
