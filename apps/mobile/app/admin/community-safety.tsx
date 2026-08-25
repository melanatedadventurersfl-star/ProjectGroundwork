import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

type Dashboard = {
  open_reports: number;
  high_priority: number;
  pending_appeals: number;
  restricted: number;
  reporting_restricted: number;
  suspended: number;
  banned: number;
  escalation_required: number;
};

const EMPTY: Dashboard = { open_reports: 0, high_priority: 0, pending_appeals: 0, restricted: 0, reporting_restricted: 0, suspended: 0, banned: 0, escalation_required: 0 };

export default function CommunitySafetyDashboard() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard>(EMPTY);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: dashboardError } = await supabase.rpc('get_admin_community_safety_dashboard');
    if (dashboardError) {
      setAuthorized(false);
      setError(dashboardError.message);
    } else {
      setAuthorized(true);
      setDashboard((data ?? EMPTY) as Dashboard);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading Community Safety…</Text></View></SafeAreaView>;
  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.content}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Admin</Text></Pressable><Text style={styles.eyebrow}>PROTECTED AREA</Text><Text style={styles.title}>Admin access required</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Admin</Text></Pressable>
    <View style={styles.header}><Text style={styles.eyebrow}>TRUST & SAFETY</Text><Text style={styles.title}>Community Safety</Text><Text style={styles.subtitle}>Review what needs attention, understand member standing, and make enforcement decisions from one control room.</Text></View>

    <View style={styles.metrics}>
      <Metric value={dashboard.open_reports} label="OPEN" />
      <Metric value={dashboard.high_priority} label="HIGH" danger />
      <Metric value={dashboard.pending_appeals} label="APPEALS" />
      <Metric value={dashboard.escalation_required} label="ESCALATE" warn />
    </View>

    <Text style={styles.sectionLabel}>NEEDS ATTENTION</Text>
    <ActionCard title="Moderation Queue" detail={`${dashboard.open_reports} open report${dashboard.open_reports === 1 ? '' : 's'} · ${dashboard.high_priority} high priority`} badge={dashboard.high_priority ? 'PRIORITY' : undefined} onPress={() => router.push('/admin/moderation' as never)} />
    <ActionCard title="Escalation Required" detail={`${dashboard.escalation_required} member${dashboard.escalation_required === 1 ? '' : 's'} at the active-warning threshold`} badge={dashboard.escalation_required ? 'ACTION' : undefined} onPress={() => router.push('/admin/violations' as never)} />
    <ActionCard title="Appeals Waiting" detail={`${dashboard.pending_appeals} appeal${dashboard.pending_appeals === 1 ? '' : 's'} waiting for review`} onPress={() => router.push('/admin/moderation-appeals' as never)} />

    <Text style={styles.sectionLabel}>CURRENT ENFORCEMENT</Text>
    <View style={styles.enforcementGrid}>
      <MiniStat value={dashboard.restricted} label="Posting restricted" />
      <MiniStat value={dashboard.reporting_restricted} label="Reporting restricted" />
      <MiniStat value={dashboard.suspended} label="Suspended" />
      <MiniStat value={dashboard.banned} label="Banned" danger />
    </View>

    <ActionCard title="Members with Violations" detail="Search current standing, 90-day warnings, restrictions, suspensions, and historical enforcement." onPress={() => router.push('/admin/violations' as never)} />
    <Pressable style={styles.refresh} onPress={() => void load()}><Text style={styles.refreshText}>Refresh safety dashboard</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

function Metric({ value, label, danger, warn }: { value: number; label: string; danger?: boolean; warn?: boolean }) {
  return <View style={[styles.metric, danger && styles.metricDanger, warn && styles.metricWarn]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function MiniStat({ value, label, danger }: { value: number; label: string; danger?: boolean }) {
  return <View style={[styles.miniStat, danger && styles.miniDanger]}><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>;
}
function ActionCard({ title, detail, badge, onPress }: { title: string; detail: string; badge?: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.card}><View style={styles.cardCopy}>{badge ? <Text style={styles.badge}>{badge}</Text> : null}<Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDetail}>{detail}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 54, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, back: { color: '#D7B45A', fontSize: 16, fontWeight: '800', paddingVertical: 6 }, header: { gap: 5, marginBottom: 4 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 39, fontWeight: '900' }, subtitle: { color: '#A9B4AD', fontSize: 13, lineHeight: 19 }, muted: { color: '#8D9A92', fontSize: 13 }, error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
  metrics: { flexDirection: 'row', gap: 8, marginVertical: 6 }, metric: { flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 1, borderColor: '#33443A', backgroundColor: '#17211C', paddingVertical: 13, alignItems: 'center', gap: 2 }, metricDanger: { borderColor: '#75453D', backgroundColor: '#241918' }, metricWarn: { borderColor: '#7A6530', backgroundColor: '#242015' }, metricValue: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' }, metricLabel: { color: '#8F9A93', fontSize: 8, fontWeight: '900', letterSpacing: .7 }, sectionLabel: { color: '#7F8B83', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  card: { minHeight: 92, borderRadius: 17, borderWidth: 1, borderColor: '#314138', backgroundColor: '#17211C', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, cardCopy: { flex: 1, gap: 4 }, badge: { alignSelf: 'flex-start', color: '#F2D17E', fontSize: 8, fontWeight: '900', letterSpacing: .9 }, cardTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, cardDetail: { color: '#8F9A93', fontSize: 11, lineHeight: 17 }, chevron: { color: '#D7B45A', fontSize: 30 },
  enforcementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, miniStat: { width: '48%', borderRadius: 14, borderWidth: 1, borderColor: '#2E3F35', backgroundColor: '#121C17', padding: 13, gap: 3 }, miniDanger: { borderColor: '#69413B' }, miniValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, miniLabel: { color: '#97A39B', fontSize: 10, fontWeight: '800' }, refresh: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, refreshText: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
});
