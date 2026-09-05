import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { attentionScore, filterTasks, flattenAllTasks, flattenOpenTasks, needsAttention, taskTiming, type WorkFilter, type WorkTask } from '../../src/hosting/workModel';

export default function HostWorkListScreen() {
  const params = useLocalSearchParams<{ filter?: string; event?: string }>();
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setCampaigns((await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete')); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load tasks.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const tasks = useMemo(() => {
    let next: WorkTask[] = params.filter === 'completed'
      ? flattenAllTasks(campaigns).filter((task) => task.status === 'complete')
      : flattenOpenTasks(campaigns);
    if (params.event) next = next.filter((task) => task.campaign.slug === params.event || task.campaign.id === params.event);
    if (params.filter === 'attention') next = next.filter(needsAttention).sort((a, b) => attentionScore(b) - attentionScore(a));
    else if (params.filter && ['open','blocked','critical','overdue','no_date'].includes(params.filter)) next = filterTasks(next, params.filter as WorkFilter);
    const normalized = query.trim().toLowerCase();
    if (normalized) next = next.filter((task) => `${task.title} ${task.category} ${task.campaign.shortTitle} ${task.owner}`.toLowerCase().includes(normalized));
    return next;
  }, [campaigns, params.event, params.filter, query]);

  const title = params.filter === 'completed'
    ? 'Completed Tasks'
    : params.filter === 'attention'
      ? 'Needs Attention'
      : params.filter === 'no_date'
        ? 'Needs Scheduling'
        : params.event
          ? 'Event Tasks'
          : 'All Open Tasks';

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ My Work</Text></Pressable>
    <Text style={styles.kicker}>TASKS</Text><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{tasks.length} task{tasks.length === 1 ? '' : 's'} in this view</Text>
    <TextInput value={query} onChangeText={setQuery} placeholder="Search tasks" placeholderTextColor="#707B74" style={styles.search} />
    {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !error ? <View style={styles.list}>{tasks.length ? tasks.map((task, index) => <TaskRow task={task} first={index === 0} key={`${task.campaign.id}-${task.taskKey}-${task.id}`} completed={params.filter === 'completed'} />) : <View style={styles.empty}><Text style={styles.emptyText}>No tasks match this view.</Text></View>}</View> : null}
  </ScrollView></SafeAreaView>;
}

function TaskRow({ task, first, completed }: { task: WorkTask; first: boolean; completed?: boolean }) { return <Pressable onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)} style={[styles.row, !first && styles.divider]}><View style={[styles.dot, { backgroundColor: completed ? '#77B991' : task.status === 'blocked' ? '#E7A05C' : task.priority === 'critical' ? '#EA806E' : '#D7B45A' }]} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.campaign.shortTitle} · {task.category} · {completed ? 'Complete' : taskTiming(task)}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 72 }, back: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginBottom: 16 }, kicker: { color: '#8D7AC4', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 23, fontWeight: '900', marginTop: 3 }, meta: { color: '#7E8A82', fontSize: 8, marginTop: 4 }, search: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#334038', backgroundColor: '#121914', color: '#FFF8E8', paddingHorizontal: 12, marginTop: 14 }, loading: { padding: 30 }, error: { color: '#F3A59A', fontSize: 10, marginTop: 12 }, list: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', overflow: 'hidden' }, row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, dot: { width: 8, height: 8, borderRadius: 4 }, rowTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, rowMeta: { color: '#7E8A82', fontSize: 7.5, marginTop: 3 }, chevron: { color: '#68736C', fontSize: 18 }, empty: { padding: 18 }, emptyText: { color: '#7E8A82', fontSize: 8.5 } });
