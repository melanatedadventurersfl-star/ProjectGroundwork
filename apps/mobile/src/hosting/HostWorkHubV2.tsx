import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from './campaigns';
import { TASK_PACKS, categoryMatchesPack } from './taskPacks';
import { attentionScore, campaignProgress, filterTasks, flattenAllTasks, flattenOpenTasks, isOverdue, needsAttention, needsScheduling, openTasksForCampaign, taskTiming, type WorkFilter, type WorkTask } from './workModel';
import { supabase } from '../lib/supabase';
import { AppIcon } from '../ui/AppIcon';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task';
}

function eventDate(campaign: HostCampaign) {
  return new Date(campaign.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function HostWorkHubV2() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<WorkFilter | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickFocused, setQuickFocused] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = (await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete');
      setCampaigns(next);
      setSelectedCampaignId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load My Work.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const tasks = useMemo(() => flattenOpenTasks(campaigns), [campaigns]);
  const allTasks = useMemo(() => flattenAllTasks(campaigns), [campaigns]);
  const blocked = useMemo(() => tasks.filter((task) => task.status === 'blocked'), [tasks]);
  const critical = useMemo(() => tasks.filter((task) => task.priority === 'critical'), [tasks]);
  const overdue = useMemo(() => tasks.filter(isOverdue), [tasks]);
  const scheduling = useMemo(() => tasks.filter(needsScheduling), [tasks]);
  const attention = useMemo(() => tasks.filter(needsAttention).sort((a, b) => attentionScore(b) - attentionScore(a)), [tasks]);
  const upNext = useMemo(() => tasks.filter((task) => !attention.some((item) => item.id === task.id)).sort((a, b) => {
    const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  }), [attention, tasks]);
  const filteredTasks = filter ? filterTasks(tasks, filter) : [];
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);

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
      await load();
      Alert.alert('Task added', `Added to ${selectedCampaign?.shortTitle ?? 'the event'}.`);
    } catch (caught) {
      Alert.alert('Task not added', caught instanceof Error ? caught.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }, [load, quickTitle, selectedCampaign?.shortTitle, selectedCampaignId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
            <Pressable style={styles.more} onPress={() => setMenuOpen(true)}><AppIcon name="more" color="#AAB4AE" size={19} /></Pressable>
          </View>

          <View style={styles.headerRow}>
            <View style={styles.headerMark}><AppIcon name="tasks" color="#A990ED" size={21} /></View>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>MY WORK</Text>
              <Text style={styles.title}>Work that needs you</Text>
              <Text style={styles.summaryLine}>{tasks.length} open · {blocked.length} blocked · {critical.length} critical</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
            <StatusChip label="Open" value={tasks.length} active={filter === 'open'} onPress={() => setFilter(filter === 'open' ? null : 'open')} />
            <StatusChip label="Blocked" value={blocked.length} active={filter === 'blocked'} tone="warning" onPress={() => setFilter(filter === 'blocked' ? null : 'blocked')} />
            <StatusChip label="Critical" value={critical.length} active={filter === 'critical'} tone="critical" onPress={() => setFilter(filter === 'critical' ? null : 'critical')} />
            <StatusChip label="Overdue" value={overdue.length} active={filter === 'overdue'} tone="danger" onPress={() => setFilter(filter === 'overdue' ? null : 'overdue')} />
            <StatusChip label="Needs Scheduling" value={scheduling.length} active={filter === 'no_date'} onPress={() => setFilter(filter === 'no_date' ? null : 'no_date')} wide />
          </ScrollView>

          {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /></View> : null}
          {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

          {!loading && !error ? filter ? (
            <>
              <SectionHeader title={`${labelForFilter(filter)} Tasks`} meta={`${filteredTasks.length} found`} action="Clear" onAction={() => setFilter(null)} />
              <View style={styles.list}>{filteredTasks.length ? filteredTasks.slice(0, 12).map((task, index) => <TaskRow key={`${task.campaign.id}-${task.taskKey}-${task.id}`} task={task} first={index === 0} />) : <Empty text="Nothing in this view." />}</View>
              {filteredTasks.length > 12 ? <Pressable style={styles.viewAllButton} onPress={() => router.push(`/host/work-list?filter=${filter}` as never)}><Text style={styles.viewAllText}>View all {filteredTasks.length} tasks ›</Text></Pressable> : null}
            </>
          ) : (
            <>
              <SectionHeader title="Events" meta="Remaining work by event" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>
                {campaigns.map((campaign) => {
                  const eventTasks = openTasksForCampaign(campaign);
                  const eventCritical = eventTasks.filter((task) => task.priority === 'critical').length;
                  return <Pressable key={campaign.id} style={styles.eventCard} onPress={() => router.push(`/host/event-work/${campaign.slug}` as never)}>
                    <View style={[styles.eventAccent, { backgroundColor: campaign.accent || '#D7B45A' }]} />
                    <Text style={styles.eventName} numberOfLines={3}>{campaign.shortTitle}</Text>
                    <Text style={styles.eventDate}>{eventDate(campaign)}</Text>
                    <Text style={styles.eventRemaining}>{eventTasks.length} remaining</Text>
                    <Text style={styles.eventMeta}>{eventCritical} critical</Text>
                    <Text style={styles.progressLabel}>{campaignProgress(campaign)}% task completion</Text>
                  </Pressable>;
                })}
              </ScrollView>

              <SectionHeader title="Work Areas" meta="Across all active events" />
              <View style={styles.areaGrid}>
                {TASK_PACKS.map((pack) => {
                  const openCount = tasks.filter((task) => categoryMatchesPack(task.category, pack)).length;
                  const matching = allTasks.filter((task) => categoryMatchesPack(task.category, pack));
                  const state = openCount > 0 ? `${openCount} open` : matching.length > 0 ? 'Complete' : 'No tasks yet';
                  return <Pressable key={pack.key} style={[styles.areaCard, { borderTopColor: pack.accent }]} onPress={() => router.push(`/host/work-area/${pack.key}` as never)}>
                    <View style={styles.areaTop}><Text style={styles.areaIcon}>{pack.icon}</Text><Text style={[styles.areaCount, { color: pack.accent }]}>{openCount > 0 ? openCount : matching.length > 0 ? '✓' : '—'}</Text></View>
                    <Text style={styles.areaTitle}>{pack.shortTitle}</Text>
                    <Text style={styles.areaMeta}>{state}</Text>
                  </Pressable>;
                })}
              </View>

              <SectionHeader title="Needs Attention" meta={attention.length ? `${attention.length} need review` : 'Nothing urgent'} action={attention.length > 5 ? 'View all' : undefined} onAction={attention.length > 5 ? () => router.push('/host/work-list?filter=attention' as never) : undefined} />
              <View style={styles.list}>{attention.length ? attention.slice(0, 5).map((task, index) => <TaskRow key={`${task.campaign.id}-${task.taskKey}-${task.id}`} task={task} first={index === 0} />) : <Empty text="Nothing is blocked, critical, overdue, or due this week." />}</View>

              <SectionHeader title="Up Next" meta="Next open work" action={tasks.length > 5 ? 'View all tasks' : undefined} onAction={tasks.length > 5 ? () => router.push('/host/work-list' as never) : undefined} />
              <View style={styles.list}>{upNext.length ? upNext.slice(0, 5).map((task, index) => <TaskRow key={`${task.campaign.id}-${task.taskKey}-${task.id}`} task={task} first={index === 0} />) : <Empty text="No additional open work." />}</View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.quickDock}>
          {selectedCampaign ? <Pressable onPress={() => setQuickFocused(true)} style={styles.quickContext}><Text style={styles.quickContextLabel}>Add to</Text><Text style={styles.quickContextEvent} numberOfLines={1}>{selectedCampaign.shortTitle}</Text><Text style={styles.quickContextDate}>{eventDate(selectedCampaign)}</Text></Pressable> : null}
          {quickFocused ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickEvents}>
            {campaigns.map((campaign) => <Pressable key={campaign.id} onPress={() => setSelectedCampaignId(campaign.id)} style={[styles.quickEvent, selectedCampaignId === campaign.id && styles.quickEventActive]}><Text style={[styles.quickEventText, selectedCampaignId === campaign.id && styles.quickEventTextActive]} numberOfLines={2}>{campaign.shortTitle}</Text><Text style={[styles.quickEventDate, selectedCampaignId === campaign.id && styles.quickEventTextActive]}>{eventDate(campaign)}</Text></Pressable>)}
          </ScrollView> : null}
          <View style={styles.quickBar}>
            <Text style={styles.plus}>＋</Text>
            <TextInput value={quickTitle} onChangeText={setQuickTitle} onFocus={() => setQuickFocused(true)} placeholder="Add a quick task..." placeholderTextColor="#737E77" style={styles.quickInput} returnKeyType="send" onSubmitEditing={() => void addQuickTask()} />
            <Pressable disabled={saving || !quickTitle.trim() || !selectedCampaignId} onPress={() => void addQuickTask()} style={[styles.send, (saving || !quickTitle.trim() || !selectedCampaignId) && styles.sendDisabled]}><Text style={styles.sendText}>{saving ? '…' : '↑'}</Text></Pressable>
          </View>
        </View>

        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
            <Pressable style={styles.menu} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.menuTitle}>My Work</Text>
              <MenuItem label="View all open tasks" onPress={() => { setMenuOpen(false); router.push('/host/work-list' as never); }} />
              <MenuItem label="View completed tasks" onPress={() => { setMenuOpen(false); router.push('/host/work-list?filter=completed' as never); }} />
              <MenuItem label="Import task list" meta="Not connected yet" onPress={() => Alert.alert('Import task list', 'Task-list import review is not connected yet.')} />
              <MenuItem label="Manage templates" meta="Not connected yet" onPress={() => Alert.alert('Manage templates', 'Custom template management is not connected yet.')} />
              <MenuItem label="Task settings" meta="Not connected yet" onPress={() => Alert.alert('Task settings', 'Task settings are not connected yet.')} last />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function labelForFilter(filter: WorkFilter) {
  if (filter === 'no_date') return 'Needs Scheduling';
  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

function StatusChip({ label, value, active, tone = 'normal', wide, onPress }: { label: string; value: number; active: boolean; tone?: 'normal' | 'warning' | 'critical' | 'danger'; wide?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.statusChip, wide && styles.statusChipWide, active && styles.statusChipActive, !active && tone === 'warning' && styles.statusChipWarning, !active && tone === 'critical' && styles.statusChipCritical, !active && tone === 'danger' && styles.statusChipDanger]}><Text style={[styles.statusValue, active && styles.statusValueActive, !active && tone === 'warning' && styles.warningText, !active && (tone === 'critical' || tone === 'danger') && styles.dangerText]}>{value}</Text><Text style={[styles.statusLabel, active && styles.statusLabelActive]}>{label}</Text></Pressable>;
}

function SectionHeader({ title, meta, action, onAction }: { title: string; meta?: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{title}</Text>{meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}</View>{action && onAction ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function TaskRow({ task, first }: { task: WorkTask; first: boolean }) {
  return <Pressable onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)} style={[styles.taskRow, !first && styles.divider]}>
    <View style={[styles.dot, { backgroundColor: task.status === 'blocked' ? '#E7A05C' : task.priority === 'critical' ? '#EA806E' : '#D7B45A' }]} />
    <View style={styles.flex}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {taskTiming(task)}</Text>{task.status === 'blocked' ? <Text style={styles.blockedText}>{task.blockedBy ? `Blocked by ${task.blockedBy}` : 'Blocked reason not recorded'}</Text> : null}</View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

function MenuItem({ label, meta, last, onPress }: { label: string; meta?: string; last?: boolean; onPress: () => void }) {
  return <Pressable style={[styles.menuItem, last && styles.menuItemLast]} onPress={onPress}><View style={styles.flex}><Text style={styles.menuItemText}>{label}</Text>{meta ? <Text style={styles.menuItemMeta}>{meta}</Text> : null}</View><Text style={styles.chevron}>›</Text></Pressable>;
}

function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, screen: { flex: 1 }, content: { padding: 18, paddingBottom: 154 }, flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { color: '#D7B45A', fontWeight: '900', fontSize: 11 }, more: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#2D3932', alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14 }, headerMark: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A990ED18', borderWidth: 1, borderColor: '#A990ED2E' }, eyebrow: { color: '#A990ED', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 2 }, summaryLine: { color: '#8C9890', fontSize: 9, marginTop: 4 },
  statusRow: { gap: 7, paddingVertical: 14, paddingRight: 16 }, statusChip: { minWidth: 76, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121914', paddingHorizontal: 11, justifyContent: 'center' }, statusChipWide: { minWidth: 118 }, statusChipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, statusChipWarning: { borderColor: '#70552E', backgroundColor: '#1E1910' }, statusChipCritical: { borderColor: '#6E3938', backgroundColor: '#221413' }, statusChipDanger: { borderColor: '#5C3735' }, statusValue: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, statusValueActive: { color: '#172017' }, statusLabel: { color: '#839087', fontSize: 7, fontWeight: '800', marginTop: 2 }, statusLabelActive: { color: '#34412E' }, warningText: { color: '#E7A05C' }, dangerText: { color: '#EA806E' },
  loading: { padding: 30, alignItems: 'center' }, errorCard: { borderRadius: 13, backgroundColor: '#2A1715', padding: 12 }, error: { color: '#F3A59A', fontSize: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 }, sectionTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, sectionMeta: { color: '#7E8A82', fontSize: 7.5, marginTop: 2 }, sectionAction: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  eventRow: { gap: 9, paddingRight: 18 }, eventCard: { width: 176, minHeight: 144, borderRadius: 15, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12, overflow: 'hidden' }, eventAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 }, eventName: { color: '#FFF8E8', fontSize: 12, lineHeight: 15, fontWeight: '900' }, eventDate: { color: '#A990ED', fontSize: 8, fontWeight: '800', marginTop: 5 }, eventRemaining: { color: '#D7B45A', fontSize: 12, fontWeight: '900', marginTop: 10 }, eventMeta: { color: '#8B978F', fontSize: 7.5, marginTop: 3 }, progressLabel: { color: '#748078', fontSize: 7, marginTop: 3 },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, areaCard: { width: '48.7%', minHeight: 91, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', borderTopWidth: 3, backgroundColor: '#141B16', padding: 11 }, areaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, areaIcon: { fontSize: 18 }, areaCount: { fontSize: 16, fontWeight: '900' }, areaTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900', marginTop: 7 }, areaMeta: { color: '#7E8A82', fontSize: 7, marginTop: 2 },
  list: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16' }, taskRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, dot: { width: 8, height: 8, borderRadius: 4 }, taskTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, taskMeta: { color: '#7E8A82', fontSize: 7.5, marginTop: 3 }, blockedText: { color: '#E7A05C', fontSize: 7, marginTop: 2 }, chevron: { color: '#68736C', fontSize: 18 }, empty: { padding: 17 }, emptyText: { color: '#7E8A82', fontSize: 8.5 }, viewAllButton: { minHeight: 39, alignItems: 'center', justifyContent: 'center' }, viewAllText: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  quickDock: { position: 'absolute', left: 12, right: 12, bottom: 8 }, quickContext: { alignSelf: 'flex-start', maxWidth: '92%', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, backgroundColor: '#19211C', borderWidth: 1, borderColor: '#334038', paddingHorizontal: 9, paddingVertical: 5, marginLeft: 6, marginBottom: 5 }, quickContextLabel: { color: '#7E8A82', fontSize: 6.5, fontWeight: '800' }, quickContextEvent: { flexShrink: 1, color: '#FFF8E8', fontSize: 7.5, fontWeight: '900' }, quickContextDate: { color: '#A990ED', fontSize: 7, fontWeight: '800' }, quickEvents: { gap: 7, paddingHorizontal: 5, paddingBottom: 6 }, quickEvent: { width: 176, minHeight: 51, borderRadius: 13, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#111713', paddingHorizontal: 10, paddingVertical: 7, justifyContent: 'center' }, quickEventActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, quickEventText: { color: '#AAB4AE', fontSize: 7.5, fontWeight: '900' }, quickEventTextActive: { color: '#172017' }, quickEventDate: { color: '#7E8A82', fontSize: 6.5, marginTop: 2 }, quickBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#4B594F', backgroundColor: '#171F1A', paddingHorizontal: 10, shadowColor: '#000', shadowOpacity: .3, shadowRadius: 12, elevation: 8 }, plus: { color: '#D7B45A', fontSize: 17, fontWeight: '900' }, quickInput: { flex: 1, color: '#FFF8E8', fontSize: 11, paddingHorizontal: 7 }, send: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, sendDisabled: { opacity: .35 }, sendText: { color: '#172017', fontSize: 16, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.58)', justifyContent: 'flex-end', padding: 12 }, menu: { borderRadius: 20, backgroundColor: '#121814', borderWidth: 1, borderColor: '#2F3933', overflow: 'hidden', paddingTop: 14, paddingHorizontal: 14, paddingBottom: 8 }, menuTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginBottom: 7 }, menuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' }, menuItemLast: { borderBottomWidth: 0 }, menuItemText: { color: '#F4F1E8', fontSize: 11, fontWeight: '800' }, menuItemMeta: { color: '#727E76', fontSize: 7, marginTop: 2 },
});
