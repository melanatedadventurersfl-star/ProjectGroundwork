import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign, type CampaignTask, type HostCampaign } from '../../../../src/hosting/campaigns';

type Filter = 'open' | 'overdue' | 'blocked' | 'complete';

export default function CampaignTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCampaign(await getHostCampaign(String(id)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load event tasks.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const tasks = useMemo(() => {
    if (!campaign) return [];
    if (filter === 'complete') return campaign.tasks.filter((task) => task.status === 'complete');
    if (filter === 'blocked') return campaign.tasks.filter((task) => task.status === 'blocked');
    if (filter === 'overdue') return campaign.tasks.filter((task) => task.status !== 'complete' && task.dueAt && new Date(task.dueAt).getTime() < referenceNow);
    return campaign.tasks.filter((task) => task.status !== 'complete');
  }, [campaign, filter, referenceNow]);

  if (loading && !campaign) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /></View></SafeAreaView>;
  if (!campaign) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.error}>{error || 'Event unavailable.'}</Text></View></SafeAreaView>;

  const counts = {
    open: campaign.tasks.filter((task) => task.status !== 'complete').length,
    overdue: campaign.tasks.filter((task) => task.status !== 'complete' && task.dueAt && new Date(task.dueAt).getTime() < referenceNow).length,
    blocked: campaign.tasks.filter((task) => task.status === 'blocked').length,
    complete: campaign.tasks.filter((task) => task.status === 'complete').length,
  };

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace(`/host/campaigns/${campaign.slug}` as never)}><Text style={styles.back}>‹ Event overview</Text></Pressable>
      <Text style={styles.eyebrow}>TASKS</Text>
      <Text style={styles.title}>{campaign.shortTitle}</Text>
      <Text style={styles.subtitle}>Event-specific work only. Open a task to update ownership, status, or details.</Text>

      <View style={styles.filters}>
        {(['open', 'overdue', 'blocked', 'complete'] as Filter[]).map((item) => <Pressable key={item} style={[styles.filter, filter === item && styles.filterActive]} onPress={() => setFilter(item)}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{label(item)} {counts[item]}</Text></Pressable>)}
      </View>

      <View style={styles.list}>{tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} campaign={campaign} referenceNow={referenceNow} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing here</Text><Text style={styles.emptyCopy}>No tasks match this filter.</Text></View>}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

function TaskRow({ task, campaign, referenceNow }: { task: CampaignTask; campaign: HostCampaign; referenceNow: number }) {
  const overdue = task.status !== 'complete' && Boolean(task.dueAt) && new Date(task.dueAt as string).getTime() < referenceNow;
  return <Pressable style={[styles.task, overdue && styles.taskOverdue]} onPress={() => router.push(`/host/campaigns/${campaign.slug}/tasks/${task.id}` as never)}>
    <View style={[styles.taskDot, task.status === 'complete' && styles.taskDotDone]}><Text style={styles.taskDotText}>{task.status === 'complete' ? '✓' : ''}</Text></View>
    <View style={styles.flex}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.category} · {task.assigneeProfileId ? task.owner : 'Unassigned'}</Text><Text style={[styles.taskDue, overdue && styles.taskDueOverdue]}>{overdue ? 'Overdue' : task.dueLabel}</Text></View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

function label(value: Filter) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 80, maxWidth: 760, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  back: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900', marginBottom: 14 },
  eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 28, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#849188', fontSize: 10, lineHeight: 15, marginTop: 4 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 16 },
  filter: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: '#354139', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: '#312A16', borderColor: '#866C2E' },
  filterText: { color: '#8E9A92', fontSize: 8.5, fontWeight: '900' },
  filterTextActive: { color: '#E3C66F' },
  list: { gap: 7, marginTop: 14 },
  task: { minHeight: 72, borderRadius: 14, borderWidth: 1, borderColor: '#303C34', backgroundColor: '#121914', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskOverdue: { borderColor: '#69473F', backgroundColor: '#211613' },
  taskDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: '#536159', alignItems: 'center', justifyContent: 'center' },
  taskDotDone: { backgroundColor: '#1E3826', borderColor: '#5F8968' },
  taskDotText: { color: '#91C99C', fontSize: 11, fontWeight: '900' },
  taskTitle: { color: '#E9EEEB', fontSize: 10.5, fontWeight: '900' },
  taskMeta: { color: '#77847C', fontSize: 8.3, marginTop: 2 },
  taskDue: { color: '#9A977C', fontSize: 8.3, marginTop: 4 },
  taskDueOverdue: { color: '#F19B8E' },
  chevron: { color: '#748178', fontSize: 18 },
  empty: { borderRadius: 14, borderWidth: 1, borderColor: '#303C34', backgroundColor: '#121914', padding: 20, alignItems: 'center' },
  emptyTitle: { color: '#E9EEEB', fontSize: 11, fontWeight: '900' },
  emptyCopy: { color: '#78857D', fontSize: 9, marginTop: 4 },
  error: { color: '#FF9D93', fontSize: 10, marginTop: 12 },
});
