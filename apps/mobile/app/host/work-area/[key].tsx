import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from '../../../src/hosting/campaigns';
import { categoryMatchesPack, taskPackByKey } from '../../../src/hosting/taskPacks';
import { flattenOpenTasks, taskTiming, type WorkTask } from '../../../src/hosting/workModel';

export default function HostWorkAreaScreen() {
  const params = useLocalSearchParams<{ key?: string; event?: string }>();
  const pack = taskPackByKey(params.key);
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [eventFilter, setEventFilter] = useState(params.event || 'all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setCampaigns((await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete')); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load this work area.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const allTasks = useMemo(() => pack ? flattenOpenTasks(campaigns).filter((task) => categoryMatchesPack(task.category, pack)) : [], [campaigns, pack]);
  const visible = eventFilter === 'all' ? allTasks : allTasks.filter((task) => task.campaign.slug === eventFilter || task.campaign.id === eventFilter);
  const groups = campaigns.map((campaign) => ({ campaign, tasks: visible.filter((task) => task.campaign.id === campaign.id) })).filter((group) => group.tasks.length > 0);

  if (!pack) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Work area unavailable</Text><Pressable onPress={() => router.replace('/host/work' as never)}><Text style={styles.back}>Back to My Work</Text></Pressable></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ My Work</Text></Pressable>
    <View style={[styles.header, { borderTopColor: pack.accent }]}><Text style={styles.icon}>{pack.icon}</Text><View style={{ flex: 1 }}><Text style={[styles.kicker, { color: pack.accent }]}>{pack.shortTitle.toUpperCase()}</Text><Text style={styles.title}>{pack.shortTitle}</Text><Text style={styles.meta}>{allTasks.length} open task{allTasks.length === 1 ? '' : 's'} across {new Set(allTasks.map((task) => task.campaign.id)).size} event{new Set(allTasks.map((task) => task.campaign.id)).size === 1 ? '' : 's'}</Text></View></View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Pressable style={[styles.chip, eventFilter === 'all' && styles.chipActive]} onPress={() => setEventFilter('all')}><Text style={[styles.chipText, eventFilter === 'all' && styles.chipTextActive]}>All Events</Text></Pressable>{campaigns.map((campaign) => <Pressable key={campaign.id} style={[styles.chip, (eventFilter === campaign.slug || eventFilter === campaign.id) && styles.chipActive]} onPress={() => setEventFilter(campaign.slug)}><Text style={[styles.chipText, (eventFilter === campaign.slug || eventFilter === campaign.id) && styles.chipTextActive]} numberOfLines={1}>{campaign.shortTitle}</Text></Pressable>)}</ScrollView>

    <Pressable style={[styles.addButton, { borderColor: `${pack.accent}88` }]} onPress={() => router.push(`/host/work-pack/${pack.key}${eventFilter !== 'all' ? `?event=${eventFilter}` : ''}` as never)}><Text style={[styles.addText, { color: pack.accent }]}>＋ Add {pack.shortTitle} Tasks</Text><Text style={styles.addMeta}>Check this event first and add only missing work</Text></Pressable>

    {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !error ? groups.length ? groups.map(({ campaign, tasks }) => <View key={campaign.id} style={styles.group}><View style={styles.groupHead}><Text style={styles.groupTitle}>{campaign.shortTitle}</Text><Text style={styles.groupCount}>{tasks.length}</Text></View><View style={styles.list}>{tasks.map((task, index) => <TaskRow key={`${task.taskKey}-${task.id}`} task={task} first={index === 0} />)}</View></View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No open {pack.shortTitle.toLowerCase()} work.</Text><Text style={styles.emptyText}>Use Add {pack.shortTitle} Tasks to check the event for missing work.</Text></View> : null}
  </ScrollView></SafeAreaView>;
}

function TaskRow({ task, first }: { task: WorkTask; first: boolean }) { return <Pressable onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)} style={[styles.row, !first && styles.divider]}><View style={[styles.dot, { backgroundColor: task.status === 'blocked' ? '#E7A05C' : task.priority === 'critical' ? '#EA806E' : '#D7B45A' }]} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{task.title}</Text><Text style={styles.rowMeta}>{taskTiming(task)} · {task.owner}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 70 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, back: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginBottom: 14 },
  header: { flexDirection: 'row', gap: 11, borderRadius: 17, borderWidth: 1, borderColor: '#2D3932', borderTopWidth: 3, backgroundColor: '#141B16', padding: 14 }, icon: { fontSize: 25 }, kicker: { fontSize: 7, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 2 }, meta: { color: '#849087', fontSize: 8, marginTop: 4 },
  chips: { gap: 7, paddingVertical: 12, paddingRight: 18 }, chip: { maxWidth: 190, minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: '#39463E', paddingHorizontal: 11, justifyContent: 'center' }, chipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, chipText: { color: '#9AA69E', fontSize: 8, fontWeight: '800' }, chipTextActive: { color: '#172017' },
  addButton: { borderRadius: 14, borderWidth: 1, backgroundColor: '#121914', padding: 13 }, addText: { fontSize: 10, fontWeight: '900' }, addMeta: { color: '#7D8981', fontSize: 7.5, marginTop: 3 }, loading: { padding: 30 }, error: { color: '#F3A59A', fontSize: 10, marginTop: 12 }, group: { marginTop: 18 }, groupHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, groupTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, groupCount: { color: '#D7B45A', fontSize: 12, fontWeight: '900' }, list: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', overflow: 'hidden' }, row: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, dot: { width: 8, height: 8, borderRadius: 4 }, rowTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, rowMeta: { color: '#7E8A82', fontSize: 7.5, marginTop: 3 }, chevron: { color: '#68736C', fontSize: 18 }, empty: { marginTop: 18, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', padding: 18 }, emptyTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, emptyText: { color: '#7E8A82', fontSize: 8, marginTop: 4 },
});
