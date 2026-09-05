import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign, type HostCampaign } from '../../../src/hosting/campaigns';
import { TASK_PACKS, categoryMatchesPack } from '../../../src/hosting/taskPacks';
import { attentionScore, campaignProgress, needsAttention, openTasksForCampaign, taskTiming, type WorkTask } from '../../../src/hosting/workModel';

export default function EventWorkScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setCampaign(await getHostCampaign(String(params.slug ?? ''))); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load event work.'); }
    finally { setLoading(false); }
  }, [params.slug]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const tasks = useMemo<WorkTask[]>(() => campaign ? openTasksForCampaign(campaign).map((task) => ({ ...task, campaign })) : [], [campaign]);
  const attention = useMemo(() => tasks.filter(needsAttention).sort((a, b) => attentionScore(b) - attentionScore(a)), [tasks]);
  const upNext = useMemo(() => tasks.filter((task) => !attention.some((item) => item.id === task.id)).sort((a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER) - (b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER)), [attention, tasks]);

  if (loading && !campaign) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /></View></SafeAreaView>;
  if (!campaign) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Event work unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable onPress={() => router.replace('/host/work' as never)}><Text style={styles.back}>Back to My Work</Text></Pressable></View></SafeAreaView>;

  const blocked = tasks.filter((task) => task.status === 'blocked').length;
  const critical = tasks.filter((task) => task.priority === 'critical').length;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ My Work</Text></Pressable>
    <View style={styles.header}><View style={[styles.accent, { backgroundColor: campaign.accent || '#D7B45A' }]} /><Text style={styles.kicker}>EVENT WORK</Text><Text style={styles.title}>{campaign.shortTitle}</Text><Text style={styles.date}>{new Date(campaign.startsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text><View style={styles.metrics}><Metric value={tasks.length} label="Open" /><Metric value={critical} label="Critical" /><Metric value={blocked} label="Blocked" /><Metric value={campaignProgress(campaign)} label="Complete %" /></View></View>

    <Section title="Work Areas" meta="This event only" />
    <View style={styles.grid}>{TASK_PACKS.map((pack) => { const count = tasks.filter((task) => categoryMatchesPack(task.category, pack)).length; return <Pressable key={pack.key} style={[styles.area, { borderTopColor: pack.accent }]} onPress={() => router.push(`/host/work-area/${pack.key}?event=${campaign.slug}` as never)}><View style={styles.areaTop}><Text style={styles.icon}>{pack.icon}</Text><Text style={[styles.count, { color: pack.accent }]}>{count}</Text></View><Text style={styles.areaTitle}>{pack.shortTitle}</Text></Pressable>; })}</View>

    <Section title="Needs Attention" meta={attention.length ? `${attention.length} flagged` : 'Nothing urgent'} />
    <View style={styles.list}>{attention.length ? attention.slice(0, 5).map((task, index) => <TaskRow task={task} first={index === 0} key={`${task.taskKey}-${task.id}`} />) : <Empty text="Nothing is blocked, critical, overdue, or due this week." />}</View>

    <Section title="Up Next" meta="Next open work" />
    <View style={styles.list}>{upNext.length ? upNext.slice(0, 6).map((task, index) => <TaskRow task={task} first={index === 0} key={`${task.taskKey}-${task.id}`} />) : <Empty text="No additional open work." />}</View>

    <Pressable style={styles.allButton} onPress={() => router.push(`/host/work-list?event=${campaign.slug}` as never)}><Text style={styles.allText}>View all {tasks.length} event tasks ›</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

function Metric({ value, label }: { value: number; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Section({ title, meta }: { title: string; meta: string }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionMeta}>{meta}</Text></View>; }
function TaskRow({ task, first }: { task: WorkTask; first: boolean }) { return <Pressable onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)} style={[styles.row, !first && styles.divider]}><View style={[styles.dot, { backgroundColor: task.status === 'blocked' ? '#E7A05C' : task.priority === 'critical' ? '#EA806E' : '#D7B45A' }]} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.category} · {taskTiming(task)}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 72 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }, back: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginBottom: 14 }, error: { color: '#F3A59A', fontSize: 10 },
  header: { borderRadius: 18, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 15, overflow: 'hidden' }, accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 }, kicker: { color: '#8C9890', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 4 }, date: { color: '#849087', fontSize: 8, marginTop: 4 }, metrics: { flexDirection: 'row', gap: 6, marginTop: 14 }, metric: { flex: 1, minHeight: 50, borderRadius: 11, backgroundColor: '#101612', padding: 8 }, metricValue: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' }, metricLabel: { color: '#78847C', fontSize: 6.5, marginTop: 2 },
  section: { marginTop: 20, marginBottom: 8 }, sectionTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, sectionMeta: { color: '#737F77', fontSize: 7.5, marginTop: 2 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, area: { width: '48.5%', minHeight: 76, borderRadius: 13, borderWidth: 1, borderColor: '#2D3932', borderTopWidth: 3, backgroundColor: '#141B16', padding: 10 }, areaTop: { flexDirection: 'row', justifyContent: 'space-between' }, icon: { fontSize: 17 }, count: { fontSize: 14, fontWeight: '900' }, areaTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900', marginTop: 8 }, list: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', overflow: 'hidden' }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, dot: { width: 8, height: 8, borderRadius: 4 }, rowTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, rowMeta: { color: '#7E8A82', fontSize: 7.5, marginTop: 3 }, chevron: { color: '#68736C', fontSize: 18 }, empty: { padding: 16 }, emptyText: { color: '#7E8A82', fontSize: 8.5 }, allButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, allText: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
});
