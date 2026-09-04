import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from './campaigns';
import { TASK_PACKS, categoryMatchesPack } from './taskPacks';
import { supabase } from '../lib/supabase';
import { AppIcon } from '../ui/AppIcon';

type WorkTask = HostCampaign['tasks'][number] & { campaign: HostCampaign };
type WorkDecision = HostCampaign['decisions'][number] & { campaign: HostCampaign };
type Filter = 'open' | 'blocked' | 'critical' | 'unscheduled' | null;
type WorkMode = 'focus' | 'timeline';

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task'; }
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function daysBetween(a: Date, b: Date) { return Math.ceil((startOfDay(b).getTime() - startOfDay(a).getTime()) / (24 * 60 * 60 * 1000)); }
function formatDate(value: Date) { return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function taskTiming(task: WorkTask) {
  if (!task.dueAt) return 'No date';
  const days = daysBetween(new Date(), new Date(task.dueAt));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${formatDate(new Date(task.dueAt))}`;
}
function suggestedDate(campaign: HostCampaign, index: number) {
  const eventDate = new Date(campaign.startsAt);
  const date = new Date(eventDate);
  date.setDate(date.getDate() - Math.max(7, Math.min(30, 10 + index * 3)));
  return date;
}

export function HostWorkHubV2() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [mode, setMode] = useState<WorkMode>('focus');
  const [eventFilter, setEventFilter] = useState('all');
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

  const allTasks = useMemo<WorkTask[]>(() => campaigns.flatMap((campaign) => campaign.tasks.filter((task) => task.status !== 'complete').map((task) => ({ ...task, campaign }))), [campaigns]);
  const allDecisions = useMemo<WorkDecision[]>(() => campaigns.flatMap((campaign) => campaign.decisions.filter((decision) => decision.status !== 'decided').map((decision) => ({ ...decision, campaign }))), [campaigns]);
  const tasks = eventFilter === 'all' ? allTasks : allTasks.filter((task) => task.campaign.id === eventFilter);
  const decisions = eventFilter === 'all' ? allDecisions : allDecisions.filter((decision) => decision.campaign.id === eventFilter);
  const blocked = tasks.filter((task) => task.status === 'blocked');
  const critical = tasks.filter((task) => task.priority === 'critical');
  const unscheduledTasks = tasks.filter((task) => !task.dueAt);
  const unscheduledDecisions = decisions.filter((decision) => !decision.dueAt);
  const overdue = tasks.filter((task) => task.dueAt && daysBetween(new Date(), new Date(task.dueAt)) < 0);
  const dueSoon = tasks.filter((task) => task.dueAt && daysBetween(new Date(), new Date(task.dueAt)) >= 0 && daysBetween(new Date(), new Date(task.dueAt)) <= 7);
  const attention = tasks.filter((task) => task.status === 'blocked' || task.priority === 'critical' || (task.dueAt && daysBetween(new Date(), new Date(task.dueAt)) < 0)).sort((a, b) => {
    const aScore = (a.status === 'blocked' ? 3 : 0) + (a.priority === 'critical' ? 2 : 0) + (a.dueAt && daysBetween(new Date(), new Date(a.dueAt)) < 0 ? 4 : 0);
    const bScore = (b.status === 'blocked' ? 3 : 0) + (b.priority === 'critical' ? 2 : 0) + (b.dueAt && daysBetween(new Date(), new Date(b.dueAt)) < 0 ? 4 : 0);
    return bScore - aScore;
  });
  const nextTask = attention[0] ?? dueSoon[0] ?? tasks.find((task) => Boolean(task.dueAt)) ?? tasks[0];
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);
  const filtered = filter === 'blocked' ? blocked : filter === 'critical' ? critical : filter === 'unscheduled' ? unscheduledTasks : tasks;
  const timeline = tasks.filter((task) => task.dueAt).sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime());

  const addQuickTask = useCallback(async () => {
    const title = quickTitle.trim();
    if (!title || !selectedCampaignId) return;
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('host_campaign_tasks').insert({ campaign_id: selectedCampaignId, task_key: `manual-${slugify(title)}-${Date.now().toString(36)}`, title, category: 'General', owner_label: 'Unassigned', due_label: 'No due date', status: 'not_started', priority: 'normal', sort_order: 900, created_by: authData.user?.id ?? null, updated_by: authData.user?.id ?? null });
      if (insertError) throw insertError;
      setQuickTitle(''); setQuickFocused(false); setFilter('unscheduled');
      await load();
    } catch (caught) { Alert.alert('Task not added', caught instanceof Error ? caught.message : 'Try again.'); }
    finally { setSaving(false); }
  }, [load, quickTitle, selectedCampaignId]);

  const completeTask = useCallback(async (task: WorkTask) => {
    const { error: updateError } = await supabase.from('host_campaign_tasks').update({ status: 'complete' }).eq('id', task.id);
    if (updateError) { Alert.alert('Task not updated', updateError.message); return; }
    await load();
  }, [load]);

  const scheduleTask = useCallback((task: WorkTask, date: Date) => {
    Alert.alert('Schedule task', `Set “${task.title}” for ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Schedule', onPress: () => { void (async () => {
        const dueAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0, 0).toISOString();
        const { error: updateError } = await supabase.from('host_campaign_tasks').update({ due_at: dueAt, due_label: `Due ${formatDate(date)}` }).eq('id', task.id);
        if (updateError) { Alert.alert('Task not scheduled', updateError.message); return; }
        await load();
      })(); } },
    ]);
  }, [load]);

  return <SafeAreaView style={styles.safe}><View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}><Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable><Pressable style={styles.more} onPress={() => Alert.alert('My Work', 'Import task list\nCompleted tasks\nArchived tasks\nManage templates')}><AppIcon name="more" color="#AAB4AE" size={20} /></Pressable></View>

      <View style={styles.header}><View style={styles.headerMark}><AppIcon name="tasks" color="#A990ED" size={22} /></View><View style={styles.flex}><Text style={styles.eyebrow}>MY WORK</Text><Text style={styles.title}>Run the work behind every event</Text><Text style={styles.subtitle}>Priorities, deadlines, blocked work and scheduling now live here.</Text></View></View>

      <View style={styles.statusRow}>
        <StatusPill label="Open" value={tasks.length} active={filter === 'open'} onPress={() => setFilter(filter === 'open' ? null : 'open')} />
        <StatusPill label="Blocked" value={blocked.length} active={filter === 'blocked'} onPress={() => setFilter(filter === 'blocked' ? null : 'blocked')} />
        <StatusPill label="Overdue" value={overdue.length} active={false} danger onPress={() => setMode('timeline')} />
        <StatusPill label="No date" value={unscheduledTasks.length + unscheduledDecisions.length} active={filter === 'unscheduled'} onPress={() => setFilter(filter === 'unscheduled' ? null : 'unscheduled')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}><Pressable style={[styles.eventChip, eventFilter === 'all' && styles.eventChipActive]} onPress={() => setEventFilter('all')}><Text style={[styles.eventChipText, eventFilter === 'all' && styles.eventChipTextActive]}>All events</Text></Pressable>{campaigns.map((campaign) => <Pressable key={campaign.id} style={[styles.eventChip, eventFilter === campaign.id && styles.eventChipActive]} onPress={() => setEventFilter(campaign.id)}><Text style={[styles.eventChipText, eventFilter === campaign.id && styles.eventChipTextActive]} numberOfLines={1}>{campaign.shortTitle}</Text></Pressable>)}</ScrollView>

      <View style={styles.modeRow}><Pressable style={[styles.modeButton, mode === 'focus' && styles.modeButtonActive]} onPress={() => setMode('focus')}><Text style={[styles.modeText, mode === 'focus' && styles.modeTextActive]}>Focus</Text></Pressable><Pressable style={[styles.modeButton, mode === 'timeline' && styles.modeButtonActive]} onPress={() => setMode('timeline')}><Text style={[styles.modeText, mode === 'timeline' && styles.modeTextActive]}>Timeline</Text></Pressable></View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

      {!loading && !error ? filter ? <><SectionTitle kicker="FILTERED VIEW" title={filter === 'critical' ? 'Critical Tasks' : filter === 'blocked' ? 'Blocked Tasks' : filter === 'unscheduled' ? 'Needs Scheduling' : 'Open Tasks'} action="Clear" onAction={() => setFilter(null)} /><View style={styles.list}>{filtered.length ? filtered.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} onComplete={() => void completeTask(task)} />) : <Empty text="Nothing in this view." />}</View>{filter === 'unscheduled' && unscheduledDecisions.length ? <View style={styles.list}>{unscheduledDecisions.map((decision, index) => <DecisionRow key={decision.id} decision={decision} first={index === 0} />)}</View> : null}</> : mode === 'timeline' ? <>
        <SectionTitle kicker="OPERATIONS TIMELINE" title="When the work happens" />
        <View style={styles.list}>{timeline.length ? timeline.map((task, index) => <TimelineRow key={task.id} task={task} first={index === 0} onComplete={() => void completeTask(task)} />) : <Empty text="No dated work yet. Use Needs Scheduling below to build the timeline." />}</View>
        <SectionTitle kicker="NEXT 7 DAYS" title={`${dueSoon.length} task${dueSoon.length === 1 ? '' : 's'} coming up`} />
        <View style={styles.list}>{dueSoon.length ? dueSoon.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} onComplete={() => void completeTask(task)} />) : <Empty text="No work due in the next 7 days." />}</View>
      </> : <>
        <View style={styles.aiCard}><View style={styles.aiMark}><Text style={styles.aiMarkText}>✦</Text></View><View style={styles.flex}><Text style={styles.aiKicker}>WHAT SHOULD I WORK ON NEXT?</Text>{nextTask ? <><Text style={styles.aiTitle}>{nextTask.title}</Text><Text style={styles.aiMeta}>{nextTask.campaign.shortTitle} · {taskTiming(nextTask)}</Text></> : <Text style={styles.aiTitle}>No open work right now.</Text>}</View>{nextTask ? <Pressable onPress={() => router.push(`/host/campaigns/${nextTask.campaign.slug}/tasks/${nextTask.id}` as never)}><Text style={styles.aiAction}>Open ›</Text></Pressable> : null}</View>

        <SectionTitle kicker="PLANNING ENGINE" title="Needs Scheduling" />
        <View style={styles.list}>{unscheduledTasks.length || unscheduledDecisions.length ? <>{unscheduledTasks.slice(0, 6).map((task, index) => { const suggestion = suggestedDate(task.campaign, index); return <View key={task.id} style={[styles.scheduleRow, index > 0 && styles.divider]}><View style={styles.aiMini}><Text style={styles.aiMiniText}>✦</Text></View><Pressable style={styles.flex} onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle}</Text><Text style={styles.suggestion}>Suggested {formatDate(suggestion)} · before {formatDate(new Date(task.campaign.startsAt))}</Text></Pressable><Pressable onPress={() => scheduleTask(task, suggestion)}><Text style={styles.scheduleAction}>Schedule</Text></Pressable></View>; })}{unscheduledDecisions.slice(0, 3).map((decision) => <DecisionRow key={decision.id} decision={decision} first={false} />)}</> : <Empty text="Everything open has a date." />}</View>

        <SectionTitle kicker="AT RISK" title="Needs Attention" />
        <View style={styles.list}>{attention.length ? attention.slice(0, 6).map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} onComplete={() => void completeTask(task)} />) : <Empty text="Nothing is blocked, critical or overdue." />}</View>

        <SectionTitle kicker="WORK AREAS" title="Task Packs" />
        <View style={styles.areaGrid}>{TASK_PACKS.map((pack) => { const count = tasks.filter((task) => categoryMatchesPack(task.category, pack)).length; return <Pressable key={pack.key} style={[styles.areaCard, { borderTopColor: pack.accent }]} onPress={() => router.push(`/host/work-pack/${pack.key}` as never)}><View style={styles.areaTop}><Text style={styles.areaIcon}>{pack.icon}</Text><Text style={[styles.areaCount, { color: pack.accent }]}>{count}</Text></View><Text style={styles.areaTitle}>{pack.shortTitle}</Text><Text style={styles.areaMeta}>{count === 1 ? '1 open task' : `${count} open tasks`}</Text></Pressable>; })}</View>

        <SectionTitle kicker="EVENTS" title="By Event" action="Event Calendar" onAction={() => router.push('/host/calendar' as never)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>{campaigns.map((campaign) => { const open = campaign.tasks.filter((task) => task.status !== 'complete'); const complete = campaign.tasks.length - open.length; const progress = campaign.tasks.length ? Math.round((complete / campaign.tasks.length) * 100) : 0; return <Pressable key={campaign.id} style={styles.eventCard} onPress={() => setEventFilter(campaign.id)}><Text style={styles.eventDate}>{new Date(campaign.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text><Text style={styles.eventTitle} numberOfLines={2}>{campaign.shortTitle}</Text><Text style={styles.eventCount}>{open.length} remaining</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View><Text style={styles.eventProgress}>{progress}% complete</Text></Pressable>; })}</ScrollView>
      </> : null}
    </ScrollView>

    <View style={styles.quickDock}>{quickFocused && campaigns.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCampaigns}>{campaigns.map((campaign) => <Pressable key={campaign.id} style={[styles.quickChip, selectedCampaignId === campaign.id && styles.quickChipActive]} onPress={() => setSelectedCampaignId(campaign.id)}><Text style={[styles.quickChipText, selectedCampaignId === campaign.id && styles.quickChipTextActive]}>{campaign.shortTitle}</Text></Pressable>)}</ScrollView> : null}<View style={styles.quickBox}><Text style={styles.quickPlus}>＋</Text><TextInput value={quickTitle} onChangeText={setQuickTitle} onFocus={() => setQuickFocused(true)} placeholder={selectedCampaign ? `Quick task for ${selectedCampaign.shortTitle}…` : 'Add a quick task…'} placeholderTextColor="#7A867E" style={styles.quickInput} returnKeyType="send" onSubmitEditing={() => void addQuickTask()} /><Pressable disabled={saving || !quickTitle.trim() || !selectedCampaignId} onPress={() => void addQuickTask()} style={[styles.send, (saving || !quickTitle.trim() || !selectedCampaignId) && styles.sendDisabled]}><Text style={styles.sendText}>{saving ? '…' : '↑'}</Text></Pressable></View></View>
  </View></SafeAreaView>;
}

function StatusPill({ label, value, active, danger = false, onPress }: { label: string; value: number; active: boolean; danger?: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.statusPill, active && styles.statusPillActive]}><Text style={[styles.statusValue, danger && styles.dangerText, active && styles.statusTextActive]}>{value}</Text><Text style={[styles.statusLabel, active && styles.statusTextActive]}>{label}</Text></Pressable>; }
function SectionTitle({ kicker, title, action, onAction }: { kicker: string; title: string; action?: string; onAction?: () => void }) { return <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>{kicker}</Text><Text style={styles.sectionTitle}>{title}</Text></View>{action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>; }
function TaskRow({ task, first, onComplete }: { task: WorkTask; first: boolean; onComplete: () => void }) { return <View style={[styles.taskRow, !first && styles.divider]}><Pressable style={styles.flexRow} onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)}><View style={[styles.dot, { backgroundColor: task.priority === 'critical' ? '#EA806E' : task.status === 'blocked' ? '#E7A05C' : '#D7B45A' }]} /><View style={styles.flex}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {taskTiming(task)}{task.blockedBy ? ` · blocked by ${task.blockedBy}` : ''}</Text></View></Pressable><Pressable style={styles.doneButton} onPress={onComplete}><Text style={styles.doneText}>Done</Text></Pressable></View>; }
function TimelineRow({ task, first, onComplete }: { task: WorkTask; first: boolean; onComplete: () => void }) { const date = new Date(task.dueAt ?? Date.now()); return <View style={[styles.timelineRow, !first && styles.divider]}><View style={styles.dateBlock}><Text style={styles.dateMonth}>{date.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateDay}>{date.getDate()}</Text></View><Pressable style={styles.flex} onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {task.owner}</Text></Pressable><Pressable style={styles.doneButton} onPress={onComplete}><Text style={styles.doneText}>Done</Text></Pressable></View>; }
function DecisionRow({ decision, first }: { decision: WorkDecision; first: boolean }) { return <Pressable style={[styles.taskRow, !first && styles.divider]} onPress={() => router.push(`/host/campaigns/${decision.campaign.slug}` as never)}><View style={styles.decisionDot} /><View style={styles.flex}><Text style={styles.taskTitle}>{decision.title}</Text><Text style={styles.taskMeta}>{decision.campaign.shortTitle} · decision · {decision.dueLabel}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, screen: { flex: 1 }, content: { padding: 18, paddingBottom: 132 }, flex: { flex: 1 }, flexRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }, topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, back: { color: '#D7B45A', fontWeight: '900' }, more: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#141B16', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 }, headerMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#A990ED18', alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: '#A990ED', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' }, subtitle: { color: '#849087', fontSize: 9, lineHeight: 13, marginTop: 3 },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 10 }, statusPill: { flex: 1, minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#2E3932', backgroundColor: '#121914', alignItems: 'center', justifyContent: 'center' }, statusPillActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, statusValue: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, statusLabel: { color: '#8C9890', fontSize: 7, fontWeight: '800', marginTop: 2 }, statusTextActive: { color: '#172017' }, dangerText: { color: '#EA806E' },
  filterRow: { gap: 7, paddingTop: 10, paddingRight: 18 }, eventChip: { maxWidth: 160, borderRadius: 12, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121914', paddingHorizontal: 11, paddingVertical: 8 }, eventChipActive: { backgroundColor: '#25342B', borderColor: '#D7B45A' }, eventChipText: { color: '#859188', fontSize: 8, fontWeight: '800' }, eventChipTextActive: { color: '#FFF8E8' },
  modeRow: { flexDirection: 'row', borderRadius: 13, padding: 4, marginTop: 10, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121914' }, modeButton: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, modeButtonActive: { backgroundColor: '#2A2537' }, modeText: { color: '#7F8B83', fontSize: 9, fontWeight: '800' }, modeTextActive: { color: '#FFF8E8' },
  loading: { padding: 30, alignItems: 'center' }, errorCard: { marginTop: 14, borderRadius: 14, padding: 14, backgroundColor: '#2A1715' }, error: { color: '#F3A59A', fontSize: 11 }, sectionHeader: { marginTop: 20, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, sectionKicker: { color: '#707C74', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, sectionTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 2 }, sectionAction: { color: '#D7B45A', fontSize: 9, fontWeight: '900' },
  aiCard: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: '#4A4260', backgroundColor: '#17151E', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, aiMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#2A2537', alignItems: 'center', justifyContent: 'center' }, aiMarkText: { color: '#D7B45A', fontSize: 18 }, aiKicker: { color: '#A990ED', fontSize: 7, fontWeight: '900', letterSpacing: .7 }, aiTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', marginTop: 3 }, aiMeta: { color: '#89958D', fontSize: 8, marginTop: 3 }, aiAction: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  list: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16' }, taskRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 8 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, dot: { width: 8, height: 8, borderRadius: 4 }, decisionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#75AEE8' }, taskTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '800' }, taskMeta: { color: '#7F8B83', fontSize: 7, lineHeight: 11, marginTop: 3 }, doneButton: { borderRadius: 9, borderWidth: 1, borderColor: '#385143', paddingHorizontal: 9, paddingVertical: 6 }, doneText: { color: '#84C992', fontSize: 7, fontWeight: '900' }, chevron: { color: '#69766E', fontSize: 20 },
  scheduleRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9 }, aiMini: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#2C2819', alignItems: 'center', justifyContent: 'center' }, aiMiniText: { color: '#D7B45A', fontSize: 15 }, suggestion: { color: '#75AEE8', fontSize: 7, marginTop: 4 }, scheduleAction: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  timelineRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingVertical: 8 }, dateBlock: { width: 40, height: 44, borderRadius: 10, backgroundColor: '#1D2A23', alignItems: 'center', justifyContent: 'center' }, dateMonth: { color: '#A990ED', fontSize: 7, fontWeight: '900' }, dateDay: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, areaCard: { width: '48.7%', minHeight: 104, borderRadius: 15, borderWidth: 1, borderColor: '#2D3932', borderTopWidth: 3, backgroundColor: '#141B16', padding: 12 }, areaTop: { flexDirection: 'row', justifyContent: 'space-between' }, areaIcon: { fontSize: 18 }, areaCount: { fontSize: 15, fontWeight: '900' }, areaTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', marginTop: 9 }, areaMeta: { color: '#7D8981', fontSize: 8, marginTop: 3 },
  eventRow: { gap: 9, paddingRight: 18 }, eventCard: { width: 176, minHeight: 132, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 13 }, eventDate: { color: '#A3AEA7', fontSize: 8, fontWeight: '900' }, eventTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', marginTop: 10, minHeight: 30 }, eventCount: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginTop: 4 }, progressTrack: { height: 4, backgroundColor: '#28322C', borderRadius: 2, overflow: 'hidden', marginTop: 9 }, progressFill: { height: 4, backgroundColor: '#D7B45A' }, eventProgress: { color: '#748078', fontSize: 7, marginTop: 5 },
  empty: { padding: 18, alignItems: 'center' }, emptyText: { color: '#78847C', fontSize: 9, lineHeight: 14, textAlign: 'center' },
  quickDock: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: 16, backgroundColor: '#0A0F0CEE', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#28322C' }, quickCampaigns: { gap: 6, paddingBottom: 7 }, quickChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#19211C' }, quickChipActive: { backgroundColor: '#D7B45A' }, quickChipText: { color: '#849087', fontSize: 7, fontWeight: '800' }, quickChipTextActive: { color: '#172017' }, quickBox: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: '#354239', backgroundColor: '#151D18', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }, quickPlus: { color: '#D7B45A', fontSize: 20, marginRight: 7 }, quickInput: { flex: 1, color: '#FFF8E8', fontSize: 10, paddingVertical: 10 }, send: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, sendDisabled: { opacity: .35 }, sendText: { color: '#172017', fontSize: 16, fontWeight: '900' },
});
