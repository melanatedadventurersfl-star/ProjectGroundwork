import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from '../../../src/hosting/campaigns';
import { assessTaskPack, categoryMatchesPack, taskPackByKey, type AssessedTaskPackItem } from '../../../src/hosting/taskPacks';
import { supabase } from '../../../src/lib/supabase';

type WorkTask = HostCampaign['tasks'][number] & { campaign: HostCampaign };

type EventFilter = 'all' | string;

export default function HostWorkPackScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const pack = taskPackByKey(params.key);
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [assessment, setAssessment] = useState<AssessedTaskPackItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!pack) return;
    setLoading(true); setError('');
    try {
      const next = (await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete');
      setCampaigns(next);
      const nextSelected = selectedCampaignId || next[0]?.id || '';
      setSelectedCampaignId(nextSelected);
      const campaign = next.find((item) => item.id === nextSelected);
      if (campaign) {
        const nextAssessment = await assessTaskPack(campaign, pack);
        setAssessment(nextAssessment);
        setSelectedKeys(nextAssessment.filter((item) => item.state === 'missing').map((item) => item.key));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this work area.');
    } finally { setLoading(false); }
  }, [pack?.key, selectedCampaignId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const chooseCampaign = useCallback(async (campaignId: string) => {
    if (!pack) return;
    setSelectedCampaignId(campaignId);
    setLoading(true);
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (campaign) {
      try {
        const nextAssessment = await assessTaskPack(campaign, pack);
        setAssessment(nextAssessment);
        setSelectedKeys(nextAssessment.filter((item) => item.state === 'missing').map((item) => item.key));
      } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to check existing work.'); }
    }
    setLoading(false);
  }, [campaigns, pack]);

  const allTasks = useMemo<WorkTask[]>(() => {
    if (!pack) return [];
    return campaigns.flatMap((campaign) => campaign.tasks.filter((task) => task.status !== 'complete' && categoryMatchesPack(task.category, pack)).map((task) => ({ ...task, campaign })));
  }, [campaigns, pack]);

  const visibleTasks = eventFilter === 'all' ? allTasks : allTasks.filter((task) => task.campaign.id === eventFilter);
  const completeCount = assessment.filter((item) => item.state === 'complete').length;
  const openCount = assessment.filter((item) => item.state === 'open').length;
  const missingCount = assessment.filter((item) => item.state === 'missing').length;
  const selectedCampaign = campaigns.find((item) => item.id === selectedCampaignId);

  const addMissing = useCallback(async () => {
    if (!pack || !selectedCampaignId) return;
    const selected = assessment.filter((item) => item.state === 'missing' && selectedKeys.includes(item.key));
    if (!selected.length) return;
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const rows = selected.map((item, index) => ({
        campaign_id: selectedCampaignId,
        task_key: `pack-${pack.key}-${item.key}`,
        title: item.title,
        category: item.category,
        owner_label: 'Unassigned',
        due_label: 'No due date',
        status: 'not_started',
        priority: item.priority ?? 'normal',
        sort_order: 900 + index,
        created_by: authData.user?.id ?? null,
        updated_by: authData.user?.id ?? null,
      }));
      const { error: insertError } = await supabase.from('host_campaign_tasks').upsert(rows, { onConflict: 'campaign_id,task_key', ignoreDuplicates: true });
      if (insertError) throw insertError;
      Alert.alert('Tasks added', `${selected.length} missing task${selected.length === 1 ? '' : 's'} added to ${selectedCampaign?.shortTitle ?? 'the event'}.`);
      await load();
    } catch (caught) { Alert.alert('Tasks not added', caught instanceof Error ? caught.message : 'Try again.'); }
    finally { setSaving(false); }
  }, [assessment, load, pack, selectedCampaign?.shortTitle, selectedCampaignId, selectedKeys]);

  if (!pack) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.error}>This task pack is not available.</Text><Pressable onPress={() => router.replace('/host/work' as never)}><Text style={styles.back}>Back to My Work</Text></Pressable></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ My Work</Text></Pressable>
    <View style={[styles.header, { borderTopColor: pack.accent }]}><Text style={styles.icon}>{pack.icon}</Text><View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: pack.accent }]}>{pack.shortTitle.toUpperCase()}</Text><Text style={styles.title}>{pack.title}</Text><Text style={styles.subtitle}>{pack.description}</Text></View></View>

    {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Checking existing work…</Text></View> : null}
    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

    {!loading && !error ? <>
      <Text style={styles.label}>APPLY TASKS TO</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{campaigns.map((campaign) => <Pressable key={campaign.id} style={[styles.chip, selectedCampaignId === campaign.id && styles.chipActive]} onPress={() => void chooseCampaign(campaign.id)}><Text style={[styles.chipText, selectedCampaignId === campaign.id && styles.chipTextActive]}>{campaign.shortTitle}</Text></Pressable>)}</ScrollView>

      <View style={styles.summary}><Summary value={completeCount} label="Complete" /><Summary value={openCount} label="Already open" /><Summary value={missingCount} label="Missing" /></View>

      <View style={styles.sectionHead}><View><Text style={styles.label}>RECOMMENDED PLAN</Text><Text style={styles.sectionTitle}>{selectedKeys.length} missing task{selectedKeys.length === 1 ? '' : 's'} selected</Text></View><View style={styles.selectLinks}><Pressable onPress={() => setSelectedKeys(assessment.filter((item) => item.state === 'missing').map((item) => item.key))}><Text style={styles.link}>All</Text></Pressable><Pressable onPress={() => setSelectedKeys([])}><Text style={styles.link}>Clear</Text></Pressable></View></View>

      <View style={styles.list}>{assessment.map((item, index) => {
        const selectable = item.state === 'missing';
        const selected = selectedKeys.includes(item.key);
        return <Pressable key={item.key} disabled={!selectable} onPress={() => setSelectedKeys((current) => selected ? current.filter((key) => key !== item.key) : [...current, item.key])} style={[styles.planRow, index > 0 && styles.divider, !selectable && styles.planRowMuted]}>
          <View style={[styles.check, item.state === 'complete' && styles.checkComplete, item.state === 'open' && styles.checkOpen, selectable && selected && styles.checkSelected]}><Text style={styles.checkText}>{item.state === 'complete' ? '✓' : item.state === 'open' ? '•' : selected ? '✓' : ''}</Text></View>
          <View style={{ flex: 1 }}><Text style={[styles.taskTitle, !selectable && styles.taskTitleMuted]}>{item.title}</Text><Text style={[styles.stateText, item.state === 'complete' ? styles.completeText : item.state === 'open' ? styles.openText : null]}>{item.state === 'complete' ? item.reason ?? 'Completed' : item.state === 'open' ? 'Already in My Work' : 'Missing'}</Text></View>
        </Pressable>;
      })}</View>

      <Pressable disabled={saving || selectedKeys.length === 0} style={[styles.primary, (saving || selectedKeys.length === 0) && styles.disabled]} onPress={() => void addMissing()}><Text style={styles.primaryText}>{saving ? 'Adding…' : `Add ${selectedKeys.length} Missing Task${selectedKeys.length === 1 ? '' : 's'}`}</Text></Pressable>

      <View style={styles.sectionHead}><View><Text style={styles.label}>CURRENT WORK</Text><Text style={styles.sectionTitle}>Open {pack.shortTitle} tasks</Text></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Pressable style={[styles.chip, eventFilter === 'all' && styles.chipActive]} onPress={() => setEventFilter('all')}><Text style={[styles.chipText, eventFilter === 'all' && styles.chipTextActive]}>All Events</Text></Pressable>{campaigns.map((campaign) => <Pressable key={campaign.id} style={[styles.chip, eventFilter === campaign.id && styles.chipActive]} onPress={() => setEventFilter(campaign.id)}><Text style={[styles.chipText, eventFilter === campaign.id && styles.chipTextActive]}>{campaign.shortTitle}</Text></Pressable>)}</ScrollView>
      <View style={styles.list}>{visibleTasks.length ? visibleTasks.map((task, index) => <Pressable key={task.id} onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)} style={[styles.currentRow, index > 0 && styles.divider]}><View style={[styles.dot, { backgroundColor: task.priority === 'critical' ? '#EA806E' : '#D7B45A' }]} /><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.meta}>{task.campaign.shortTitle} · {task.dueLabel}</Text></View><Text style={styles.chevron}>›</Text></Pressable>) : <View style={styles.empty}><Text style={styles.muted}>No open {pack.shortTitle.toLowerCase()} tasks in this view.</Text></View>}</View>
    </> : null}
  </ScrollView></SafeAreaView>;
}

function Summary({ value, label }: { value: number; label: string }) { return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 72 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, back: { color: '#D7B45A', fontWeight: '900', marginBottom: 14 },
  header: { flexDirection: 'row', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: '#2D3932', borderTopWidth: 3, backgroundColor: '#141B16', padding: 15 }, icon: { fontSize: 28 }, eyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 2 }, subtitle: { color: '#849087', fontSize: 9, marginTop: 4 },
  loading: { padding: 28, alignItems: 'center', gap: 8 }, muted: { color: '#7E8A82', fontSize: 9 }, errorCard: { marginTop: 12, borderRadius: 13, padding: 12, backgroundColor: '#2A1715' }, error: { color: '#F3A59A', fontSize: 10 }, label: { color: '#707C74', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 18 }, chips: { gap: 7, paddingVertical: 9 }, chip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#39463E', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' }, chipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, chipText: { color: '#AAB4AE', fontSize: 8, fontWeight: '800' }, chipTextActive: { color: '#172017' },
  summary: { flexDirection: 'row', gap: 7 }, summaryItem: { flex: 1, minHeight: 62, borderRadius: 13, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121914', padding: 10 }, summaryValue: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, summaryLabel: { color: '#7E8A82', fontSize: 7, marginTop: 3 }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4, marginBottom: 8 }, sectionTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 2 }, selectLinks: { flexDirection: 'row', gap: 12 }, link: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  list: { borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16' }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, planRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11 }, planRowMuted: { backgroundColor: '#111713' }, check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: '#526058', alignItems: 'center', justifyContent: 'center' }, checkSelected: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, checkComplete: { backgroundColor: '#244B36', borderColor: '#3F7255' }, checkOpen: { backgroundColor: '#403721', borderColor: '#6A5A31' }, checkText: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, taskTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, taskTitleMuted: { color: '#8C9890' }, stateText: { color: '#7A867E', fontSize: 7, marginTop: 3 }, completeText: { color: '#77B991' }, openText: { color: '#D7B45A' },
  primary: { minHeight: 46, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 10 }, primaryText: { color: '#172017', fontSize: 10, fontWeight: '900' }, disabled: { opacity: .4 }, currentRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11 }, dot: { width: 8, height: 8, borderRadius: 4 }, meta: { color: '#7E8A82', fontSize: 7, marginTop: 3 }, chevron: { color: '#6C7870', fontSize: 18 }, empty: { padding: 16 },
});
