import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from './campaigns';
import { TASK_PACKS, categoryMatchesPack } from './taskPacks';
import { supabase } from '../lib/supabase';
import { AppIcon } from '../ui/AppIcon';

type WorkTask = HostCampaign['tasks'][number] & { campaign: HostCampaign };
type Filter = 'open' | 'blocked' | 'critical' | null;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task';
}

export function HostWorkHubV2() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickFocused, setQuickFocused] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = (await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete');
      setCampaigns(next);
      setSelectedCampaignId((current) => current || next[0]?.id || '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load My Work.');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const tasks = useMemo<WorkTask[]>(() => campaigns.flatMap((campaign) => campaign.tasks.filter((task) => task.status !== 'complete').map((task) => ({ ...task, campaign }))), [campaigns]);
  const blocked = tasks.filter((task) => task.status === 'blocked');
  const critical = tasks.filter((task) => task.priority === 'critical');
  const attention = tasks.filter((task) => task.status === 'blocked' || task.priority === 'critical').slice(0, 4);
  const upNext = tasks.filter((task) => !attention.some((item) => item.id === task.id)).slice(0, 8);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);
  const filtered = filter === 'blocked' ? blocked : filter === 'critical' ? critical : tasks;

  const addQuickTask = useCallback(async () => {
    const title = quickTitle.trim();
    if (!title || !selectedCampaignId) return;
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('host_campaign_tasks').insert({
        campaign_id: selectedCampaignId,
        task_key: `manual-${slugify(title)}-${Date.now().toString(36)}`,
        title,
        category: 'General',
        owner_label: 'Unassigned',
        due_label: 'No due date',
        status: 'not_started',
        priority: 'normal',
        sort_order: 900,
        created_by: authData.user?.id ?? null,
        updated_by: authData.user?.id ?? null,
      });
      if (insertError) throw insertError;
      setQuickTitle('');
      setQuickFocused(false);
      setFilter('open');
      await load();
    } catch (caught) {
      Alert.alert('Task not added', caught instanceof Error ? caught.message : 'Try again.');
    } finally { setSaving(false); }
  }, [load, quickTitle, selectedCampaignId]);

  return <SafeAreaView style={styles.safe}><View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
        <Pressable style={styles.more} onPress={() => Alert.alert('My Work', 'Import task list\nCompleted tasks\nArchived tasks\nManage templates')}><AppIcon name="more" color="#AAB4AE" size={20} /></Pressable>
      </View>

      <View style={styles.header}>
        <View style={styles.headerMark}><AppIcon name="tasks" color="#A990ED" size={22} /></View>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>MY WORK</Text><Text style={styles.title}>Keep the work moving</Text><Text style={styles.subtitle}>{attention.length ? `${attention.length} task${attention.length === 1 ? '' : 's'} need attention.` : 'No critical work needs attention right now.'}</Text></View>
      </View>

      <View style={styles.statusRow}>
        <StatusPill label="Open" value={tasks.length} active={filter === 'open'} onPress={() => setFilter(filter === 'open' ? null : 'open')} />
        <StatusPill label="Blocked" value={blocked.length} active={filter === 'blocked'} onPress={() => setFilter(filter === 'blocked' ? null : 'blocked')} />
        <StatusPill label="Critical" value={critical.length} active={filter === 'critical'} onPress={() => setFilter(filter === 'critical' ? null : 'critical')} />
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

      {!loading && !error ? filter ? <>
        <SectionTitle kicker="FILTERED VIEW" title={`${filter === 'critical' ? 'Critical' : filter === 'blocked' ? 'Blocked' : 'Open'} Tasks`} action="Clear" onAction={() => setFilter(null)} />
        <View style={styles.list}>{filtered.length ? filtered.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} />) : <Empty text={`No ${filter} tasks.`} />}</View>
      </> : <>
        <SectionTitle kicker="EVENTS" title="By Event" action="See all" onAction={() => router.push('/host/events' as never)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>{campaigns.map((campaign) => {
          const open = campaign.tasks.filter((task) => task.status !== 'complete');
          const criticalCount = open.filter((task) => task.priority === 'critical').length;
          const complete = campaign.tasks.length - open.length;
          const progress = campaign.tasks.length ? Math.round((complete / campaign.tasks.length) * 100) : 0;
          return <Pressable key={campaign.id} style={styles.eventCard} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}>
            <View style={styles.eventTop}><Text style={styles.eventDate}>{new Date(campaign.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>{criticalCount ? <Text style={styles.criticalTag}>{criticalCount} critical</Text> : null}</View>
            <Text style={styles.eventTitle} numberOfLines={2}>{campaign.shortTitle}</Text><Text style={styles.eventCount}>{open.length} remaining</Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View><Text style={styles.eventProgress}>{progress}% complete</Text>
          </Pressable>;
        })}</ScrollView>

        <SectionTitle kicker="WORK AREAS" title="Across Every Event" />
        <View style={styles.areaGrid}>{TASK_PACKS.map((pack) => {
          const count = tasks.filter((task) => categoryMatchesPack(task.category, pack)).length;
          return <Pressable key={pack.key} style={[styles.areaCard, { borderTopColor: pack.accent }]} onPress={() => router.push(`/host/work-pack/${pack.key}` as never)}>
            <View style={styles.areaTop}><Text style={styles.areaIcon}>{pack.icon}</Text><Text style={[styles.areaCount, { color: pack.accent }]}>{count}</Text></View>
            <Text style={styles.areaTitle}>{pack.shortTitle}</Text><Text style={styles.areaMeta}>{count === 1 ? '1 open task' : `${count} open tasks`}</Text>
          </Pressable>;
        })}</View>

        <SectionTitle kicker="FOCUS" title="Needs Attention" />
        <View style={styles.list}>{attention.length ? attention.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} />) : <Empty text="Nothing critical right now." />}</View>
        <SectionTitle kicker="NEXT" title="Up Next" />
        <View style={styles.list}>{upNext.length ? upNext.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} />) : <Empty text="No open event work." />}</View>
      </> : null}
    </ScrollView>

    <View style={styles.quickDock}>
      {quickFocused && campaigns.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCampaigns}>{campaigns.map((campaign) => <Pressable key={campaign.id} style={[styles.quickChip, selectedCampaignId === campaign.id && styles.quickChipActive]} onPress={() => setSelectedCampaignId(campaign.id)}><Text style={[styles.quickChipText, selectedCampaignId === campaign.id && styles.quickChipTextActive]}>{campaign.shortTitle}</Text></Pressable>)}</ScrollView> : null}
      <View style={styles.quickBox}><Text style={styles.quickPlus}>＋</Text><TextInput value={quickTitle} onChangeText={setQuickTitle} onFocus={() => setQuickFocused(true)} placeholder={selectedCampaign ? `Quick task for ${selectedCampaign.shortTitle}…` : 'Add a quick task…'} placeholderTextColor="#7A867E" style={styles.quickInput} returnKeyType="send" onSubmitEditing={() => void addQuickTask()} /><Pressable disabled={saving || !quickTitle.trim() || !selectedCampaignId} onPress={() => void addQuickTask()} style={[styles.send, (saving || !quickTitle.trim() || !selectedCampaignId) && styles.sendDisabled]}><Text style={styles.sendText}>{saving ? '…' : '↑'}</Text></Pressable></View>
    </View>
  </View></SafeAreaView>;
}

function StatusPill({ label, value, active, onPress }: { label: string; value: number; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.statusPill, active && styles.statusPillActive]}><Text style={[styles.statusValue, active && styles.statusTextActive]}>{value}</Text><Text style={[styles.statusLabel, active && styles.statusTextActive]}>{label}</Text></Pressable>; }
function SectionTitle({ kicker, title, action, onAction }: { kicker: string; title: string; action?: string; onAction?: () => void }) { return <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>{kicker}</Text><Text style={styles.sectionTitle}>{title}</Text></View>{action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>; }
function TaskRow({ task, first }: { task: WorkTask; first: boolean }) { return <Pressable style={[styles.taskRow, !first && styles.divider]} onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)}><View style={[styles.dot, { backgroundColor: task.priority === 'critical' ? '#EA806E' : task.status === 'blocked' ? '#E7A05C' : '#D7B45A' }]} /><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {task.dueLabel}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, screen: { flex: 1 }, content: { padding: 18, paddingBottom: 128 }, topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, back: { color: '#D7B45A', fontWeight: '900' }, more: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#141B16', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 }, headerMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#A990ED18', alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: '#A990ED', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 24, fontWeight: '900' }, subtitle: { color: '#849087', fontSize: 10, marginTop: 3 },
  statusRow: { flexDirection: 'row', gap: 7, marginTop: 10 }, statusPill: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#2E3932', backgroundColor: '#121914', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, statusPillActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, statusValue: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, statusLabel: { color: '#8C9890', fontSize: 9, fontWeight: '800' }, statusTextActive: { color: '#172017' },
  loading: { padding: 30, alignItems: 'center' }, errorCard: { marginTop: 14, borderRadius: 14, padding: 14, backgroundColor: '#2A1715' }, error: { color: '#F3A59A', fontSize: 11 }, sectionHeader: { marginTop: 22, marginBottom: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, sectionKicker: { color: '#707C74', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, sectionTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 2 }, sectionAction: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  eventRow: { gap: 9, paddingRight: 18 }, eventCard: { width: 184, minHeight: 142, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 13 }, eventTop: { flexDirection: 'row', justifyContent: 'space-between' }, eventDate: { color: '#A3AEA7', fontSize: 8, fontWeight: '900' }, criticalTag: { color: '#F1A094', fontSize: 7, fontWeight: '900' }, eventTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', marginTop: 12, minHeight: 32 }, eventCount: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginTop: 5 }, progressTrack: { height: 4, backgroundColor: '#28322C', borderRadius: 2, overflow: 'hidden', marginTop: 10 }, progressFill: { height: 4, backgroundColor: '#D7B45A' }, eventProgress: { color: '#748078', fontSize: 7, marginTop: 5 },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, areaCard: { width: '48.7%', minHeight: 104, borderRadius: 15, borderWidth: 1, borderColor: '#2D3932', borderTopWidth: 3, backgroundColor: '#141B16', padding: 12 }, areaTop: { flexDirection: 'row', justifyContent: 'space-between' }, areaIcon: { fontSize: 18 }, areaCount: { fontSize: 15, fontWeight: '900' }, areaTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', marginTop: 9 }, areaMeta: { color: '#7E8A82', fontSize: 8, marginTop: 3 },
  list: { borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16' }, taskRow: { minHeight: 60, flexDirection: 'row', gap: 9, alignItems: 'center', paddingHorizontal: 12 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, dot: { width: 8, height: 8, borderRadius: 4 }, taskTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, taskMeta: { color: '#859188', fontSize: 8, marginTop: 3 }, chevron: { color: '#6C7870', fontSize: 18 }, empty: { padding: 18 }, emptyText: { color: '#7E8A82', fontSize: 9 },
  quickDock: { position: 'absolute', left: 12, right: 12, bottom: 10, borderRadius: 18, borderWidth: 1, borderColor: '#38453D', backgroundColor: '#101612EE', padding: 8 }, quickCampaigns: { gap: 6, paddingBottom: 7 }, quickChip: { minHeight: 28, borderRadius: 14, borderWidth: 1, borderColor: '#3A463F', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' }, quickChipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, quickChipText: { color: '#9DA8A1', fontSize: 8, fontWeight: '800' }, quickChipTextActive: { color: '#172017' }, quickBox: { minHeight: 48, borderRadius: 14, backgroundColor: '#18211B', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9 }, quickPlus: { color: '#D7B45A', fontSize: 18, fontWeight: '900' }, quickInput: { flex: 1, color: '#FFF8E8', fontSize: 13, paddingHorizontal: 8 }, send: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, sendDisabled: { opacity: .35 }, sendText: { color: '#172017', fontSize: 18, fontWeight: '900' },
});
