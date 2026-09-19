import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, ImageBackground, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type CampaignTaskPriority, type HostCampaign } from './campaigns';
import { TASK_PACKS, categoryMatchesPack } from './taskPacks';
import { attentionScore, campaignProgress, canonicalCampaigns, daysFromToday, dueState, filterTasks, flattenAllTasks, flattenOpenTasks, isOverdue, needsAttention, needsScheduling, openTasksForCampaign, taskTiming, type WorkFilter, type WorkTask } from './workModel';
import { supabase } from '../lib/supabase';
import { AppIcon } from '../ui/AppIcon';

const DAY_MS = 86_400_000;
const WORK_AREA_OPTIONS = [
  { label: 'General', value: 'General' },
  { label: 'Marketing', value: 'Marketing' },
  { label: 'Food', value: 'Food' },
  { label: 'Vendors', value: 'Vendors' },
  { label: 'Venue', value: 'Venue' },
  { label: 'Operations', value: 'Operations' },
  { label: 'Guest Communications', value: 'Communications' },
  { label: 'Safety', value: 'Safety' },
  { label: 'Inventory', value: 'Inventory' },
] as const;
const PRIORITY_OPTIONS: { label: string; value: CampaignTaskPriority }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

type QuickPicker = 'event' | 'due' | 'priority' | 'category' | null;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task';
}

function eventDate(campaign: HostCampaign) {
  return new Date(campaign.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function eventPlace(campaign: HostCampaign) {
  const parts = campaign.location.split(',').map((part) => part.trim()).filter(Boolean);
  return parts[0] || campaign.location || 'Location pending';
}

function quickDueLabel(value: string) {
  if (!value) return 'No due date';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'No due date';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function quickDueAt(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T17:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateInputValue(offsetDays: number) {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function isQuickDateTrusted(campaign: HostCampaign | undefined, dueAt: string | null) {
  if (!campaign || !dueAt) return true;
  const start = new Date(campaign.startsAt).getTime();
  const end = new Date(campaign.endsAt || campaign.startsAt).getTime();
  const due = new Date(dueAt).getTime();
  if (![start, end, due].every(Number.isFinite)) return false;
  return due >= start - 180 * DAY_MS && due <= end + 14 * DAY_MS;
}

function isMyDayTask(task: WorkTask) {
  if (task.status === 'blocked' || task.priority === 'critical') return true;
  const state = dueState(task);
  if ((state !== 'calendar' && state !== 'relative') || !task.dueAt) return false;
  const days = daysFromToday(task.dueAt);
  return days >= 0 && days <= 1;
}

function nextTaskScore(task: WorkTask) {
  let score = 0;
  const state = dueState(task);
  if ((state === 'calendar' || state === 'relative') && task.dueAt) {
    const days = daysFromToday(task.dueAt);
    if (days >= 0) score += Math.max(0, 120 - Math.min(days, 120));
  }
  if (task.priority === 'critical') score += 45;
  else if (task.priority === 'high') score += 20;
  const eventDays = Math.ceil((new Date(task.campaign.startsAt).getTime() - Date.now()) / DAY_MS);
  if (Number.isFinite(eventDays) && eventDays >= 0) score += Math.max(0, 45 - Math.min(eventDays, 45));
  return score;
}

export function HostWorkHubV2() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<WorkFilter | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [quickDueDate, setQuickDueDate] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [quickPriority, setQuickPriority] = useState<CampaignTaskPriority>('normal');
  const [quickCategory, setQuickCategory] = useState('General');
  const [quickPicker, setQuickPicker] = useState<QuickPicker>(null);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = (await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete');
      const next = canonicalCampaigns(raw);
      setCampaigns(next);
      setSelectedCampaignId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load My Work.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const collapseQuick = useCallback(() => {
    Keyboard.dismiss();
    setQuickPicker(null);
    setQuickExpanded(false);
  }, []);

  useEffect(() => {
    if (!quickExpanded || Platform.OS === 'web') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      collapseQuick();
      return true;
    });
    return () => subscription.remove();
  }, [collapseQuick, quickExpanded]);

  const tasks = useMemo(() => flattenOpenTasks(campaigns), [campaigns]);
  const allTasks = useMemo(() => flattenAllTasks(campaigns), [campaigns]);
  const blocked = useMemo(() => tasks.filter((task) => task.status === 'blocked'), [tasks]);
  const critical = useMemo(() => tasks.filter((task) => task.priority === 'critical'), [tasks]);
  const overdue = useMemo(() => tasks.filter(isOverdue), [tasks]);
  const scheduling = useMemo(() => tasks.filter(needsScheduling), [tasks]);
  const attention = useMemo(() => tasks.filter(needsAttention).sort((a, b) => attentionScore(b) - attentionScore(a)), [tasks]);
  const myDay = useMemo(() => tasks.filter(isMyDayTask).sort((a, b) => attentionScore(b) - attentionScore(a)).slice(0, 3), [tasks]);
  const excludedTaskIds = useMemo(() => new Set([...attention, ...myDay].map((task) => task.id)), [attention, myDay]);
  const upNext = useMemo(() => tasks.filter((task) => !excludedTaskIds.has(task.id)).sort((a, b) => nextTaskScore(b) - nextTaskScore(a) || a.title.localeCompare(b.title)), [excludedTaskIds, tasks]);
  const filteredTasks = filter ? filterTasks(tasks, filter) : [];
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);
  const areaRows = useMemo(() => TASK_PACKS.map((pack, index) => {
    const matchingOpen = tasks.filter((task) => categoryMatchesPack(task.category, pack));
    const matchingAll = allTasks.filter((task) => categoryMatchesPack(task.category, pack));
    const urgent = matchingOpen.filter((task) => task.status === 'blocked' || task.priority === 'critical').length;
    return { pack, index, openCount: matchingOpen.length, matchingCount: matchingAll.length, urgent };
  }).sort((a, b) => b.urgent - a.urgent || a.index - b.index), [allTasks, tasks]);

  const resetSubmittedQuickFields = useCallback(() => {
    setQuickTitle('');
    setQuickDueDate('');
    setDateDraft('');
    setQuickPriority('normal');
    setQuickCategory('General');
  }, []);

  const createQuickTask = useCallback(async () => {
    const title = quickTitle.trim();
    if (!title || !selectedCampaignId) return;
    setSaving(true);
    try {
      const dueAt = quickDueAt(quickDueDate);
      const { data: authData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('host_campaign_tasks').insert({
        campaign_id: selectedCampaignId,
        task_key: `manual-${slugify(title)}-${Date.now().toString(36)}`,
        title,
        category: quickCategory,
        owner_label: 'Unassigned',
        due_label: dueAt ? `Due ${new Date(dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No due date',
        due_at: dueAt,
        status: 'not_started',
        priority: quickPriority,
        sort_order: 900,
        created_by: authData.user?.id ?? null,
        updated_by: authData.user?.id ?? null,
      });
      if (insertError) throw insertError;
      resetSubmittedQuickFields();
      collapseQuick();
      await load();
      Alert.alert('Task added', `Added to ${selectedCampaign?.shortTitle ?? 'the event'}.`);
    } catch (caught) {
      Alert.alert('Task not added', caught instanceof Error ? caught.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }, [collapseQuick, load, quickCategory, quickDueDate, quickPriority, quickTitle, resetSubmittedQuickFields, selectedCampaign?.shortTitle, selectedCampaignId]);

  const addQuickTask = useCallback(() => {
    const dueAt = quickDueAt(quickDueDate);
    if (dueAt && !isQuickDateTrusted(selectedCampaign, dueAt)) {
      Alert.alert('Review due date', 'This date is outside the trusted planning window for the selected event. It will be treated as a date that needs review.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add anyway', onPress: () => { void createQuickTask(); } },
      ]);
      return;
    }
    void createQuickTask();
  }, [createQuickTask, quickDueDate, selectedCampaign]);

  const saveDateDraft = useCallback(() => {
    if (!dateDraft.trim()) {
      setQuickDueDate('');
      setQuickPicker(null);
      return;
    }
    const parsed = quickDueAt(dateDraft.trim());
    if (!parsed) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD.');
      return;
    }
    setQuickDueDate(dateDraft.trim());
    setQuickPicker(null);
  }, [dateDraft]);

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
              {myDay.length ? <><SectionHeader title="My Day" meta="What needs you now" /><View style={styles.list}>{myDay.map((task, index) => <TaskRow key={`day-${task.campaign.id}-${task.taskKey}-${task.id}`} task={task} first={index === 0} />)}</View></> : null}

              <SectionHeader title="Events" meta="Remaining work by event" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>
                {campaigns.map((campaign) => {
                  const eventTasks = openTasksForCampaign(campaign);
                  const eventCritical = eventTasks.filter((task) => task.priority === 'critical').length;
                  return <EventCard key={campaign.id} campaign={campaign} remaining={eventTasks.length} critical={eventCritical} progress={campaignProgress(campaign)} />;
                })}
              </ScrollView>

              <SectionHeader title="Work Areas" meta="Across all active events" />
              <View style={styles.areaGrid}>
                {areaRows.map(({ pack, openCount, matchingCount, urgent }) => {
                  const state = openCount > 0 ? `${openCount} open` : matchingCount > 0 ? 'Complete' : 'No tasks yet';
                  return <Pressable key={pack.key} style={[styles.areaCard, { borderTopColor: pack.accent }, urgent > 0 && styles.areaUrgent]} onPress={() => router.push(`/host/work-area/${pack.key}` as never)}>
                    <View style={styles.areaTop}><Text style={styles.areaIcon}>{pack.icon}</Text><Text style={[styles.areaCount, { color: pack.accent }]}>{openCount > 0 ? openCount : matchingCount > 0 ? '✓' : '—'}</Text></View>
                    <Text style={styles.areaTitle}>{pack.shortTitle}</Text>
                    <Text style={styles.areaMeta}>{urgent > 0 ? `${urgent} need attention` : state}</Text>
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

        {quickExpanded ? <Pressable accessibilityLabel="Collapse Quick Add" style={styles.quickDismissLayer} onPress={collapseQuick} /> : null}

        <View style={[styles.quickDock, quickExpanded && styles.quickDockExpanded]}>
          {quickExpanded ? <View style={styles.quickPanel}>
            <View style={styles.quickPanelTop}>
              <Pressable style={styles.quickEventControl} onPress={() => setQuickPicker('event')}>
                <Text style={styles.quickControlLabel}>ADD TO</Text>
                <Text style={styles.quickEventName} numberOfLines={1}>{selectedCampaign?.shortTitle ?? 'Choose event'}</Text>
                {selectedCampaign ? <Text style={styles.quickEventMeta}>{eventDate(selectedCampaign)} · {eventPlace(selectedCampaign)}</Text> : null}
              </Pressable>
              <Pressable accessibilityLabel="Collapse Quick Add" style={styles.collapseButton} onPress={collapseQuick}><Text style={styles.collapseText}>⌄</Text></Pressable>
            </View>

            <View style={styles.quickBar}>
              <Text style={styles.plus}>＋</Text>
              <TextInput value={quickTitle} onChangeText={setQuickTitle} autoFocus placeholder="Task name..." placeholderTextColor="#737E77" style={styles.quickInput} returnKeyType="send" onSubmitEditing={addQuickTask} />
              <Pressable disabled={saving || !quickTitle.trim() || !selectedCampaignId} onPress={addQuickTask} style={[styles.send, (saving || !quickTitle.trim() || !selectedCampaignId) && styles.sendDisabled]}><Text style={styles.sendText}>{saving ? '…' : '↑'}</Text></Pressable>
            </View>

            <View style={styles.quickTools}>
              <QuickTool icon="calendar" label={quickDueLabel(quickDueDate)} onPress={() => { setDateDraft(quickDueDate); setQuickPicker('due'); }} active={Boolean(quickDueDate)} />
              <QuickTool label={PRIORITY_OPTIONS.find((item) => item.value === quickPriority)?.label ?? 'Normal'} onPress={() => setQuickPicker('priority')} />
              <QuickTool label={WORK_AREA_OPTIONS.find((item) => item.value === quickCategory)?.label ?? 'General'} onPress={() => setQuickPicker('category')} />
            </View>
          </View> : <Pressable style={styles.quickCollapsed} onPress={() => setQuickExpanded(true)}><Text style={styles.plus}>＋</Text><Text style={styles.quickCollapsedText}>Add a quick task...</Text></Pressable>}
        </View>

        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}><Pressable style={styles.menu} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.menuTitle}>My Work</Text>
            <MenuItem label="View all open tasks" onPress={() => { setMenuOpen(false); router.push('/host/work-list' as never); }} />
            <MenuItem label="View completed tasks" onPress={() => { setMenuOpen(false); router.push('/host/work-list?filter=completed' as never); }} />
            <MenuItem label="Import task list" meta="Not connected yet" onPress={() => Alert.alert('Import task list', 'Task-list import review is not connected yet.')} />
            <MenuItem label="Manage templates" meta="Not connected yet" onPress={() => Alert.alert('Manage templates', 'Custom template management is not connected yet.')} />
            <MenuItem label="Task settings" meta="Not connected yet" onPress={() => Alert.alert('Task settings', 'Task settings are not connected yet.')} last />
          </Pressable></Pressable>
        </Modal>

        <Modal visible={quickPicker !== null} transparent animationType="slide" onRequestClose={() => setQuickPicker(null)}>
          <Pressable style={styles.backdrop} onPress={() => setQuickPicker(null)}><Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            {quickPicker === 'event' ? <><Text style={styles.sheetTitle}>Choose event</Text>{campaigns.map((campaign) => <Pressable key={campaign.id} style={styles.pickerRow} onPress={() => { setSelectedCampaignId(campaign.id); setQuickPicker(null); }}><View style={styles.flex}><Text style={styles.pickerTitle}>{campaign.shortTitle}</Text><Text style={styles.pickerMeta}>{eventDate(campaign)} · {eventPlace(campaign)}</Text></View>{campaign.id === selectedCampaignId ? <Text style={styles.pickerCheck}>✓</Text> : null}</Pressable>)}</> : null}
            {quickPicker === 'priority' ? <><Text style={styles.sheetTitle}>Priority</Text>{PRIORITY_OPTIONS.map((option) => <Pressable key={option.value} style={styles.pickerRow} onPress={() => { setQuickPriority(option.value); setQuickPicker(null); }}><Text style={styles.pickerTitle}>{option.label}</Text>{option.value === quickPriority ? <Text style={styles.pickerCheck}>✓</Text> : null}</Pressable>)}</> : null}
            {quickPicker === 'category' ? <><Text style={styles.sheetTitle}>Work area</Text>{WORK_AREA_OPTIONS.map((option) => <Pressable key={option.value} style={styles.pickerRow} onPress={() => { setQuickCategory(option.value); setQuickPicker(null); }}><Text style={styles.pickerTitle}>{option.label}</Text>{option.value === quickCategory ? <Text style={styles.pickerCheck}>✓</Text> : null}</Pressable>)}</> : null}
            {quickPicker === 'due' ? <><Text style={styles.sheetTitle}>Due date</Text><Text style={styles.sheetHelp}>Calendar dates stay separate from event-relative and dependency timing.</Text><View style={styles.datePresets}><Pressable style={styles.datePreset} onPress={() => setDateDraft(dateInputValue(0))}><Text style={styles.datePresetText}>Today</Text></Pressable><Pressable style={styles.datePreset} onPress={() => setDateDraft(dateInputValue(1))}><Text style={styles.datePresetText}>Tomorrow</Text></Pressable><Pressable style={styles.datePreset} onPress={() => setDateDraft(dateInputValue(7))}><Text style={styles.datePresetText}>In 7 days</Text></Pressable></View><TextInput value={dateDraft} onChangeText={setDateDraft} placeholder="YYYY-MM-DD" placeholderTextColor="#6F7B74" style={styles.dateInput} keyboardType="numbers-and-punctuation" /><View style={styles.dateActions}><Pressable style={styles.secondaryButton} onPress={() => { setQuickDueDate(''); setDateDraft(''); setQuickPicker(null); }}><Text style={styles.secondaryText}>Clear date</Text></Pressable><Pressable style={styles.primaryButton} onPress={saveDateDraft}><Text style={styles.primaryText}>Set date</Text></Pressable></View></> : null}
          </Pressable></Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function EventCard({ campaign, remaining, critical, progress }: { campaign: HostCampaign; remaining: number; critical: number; progress: number }) {
  const content = <View style={styles.eventOverlay}>
    <View style={[styles.eventAccent, { backgroundColor: campaign.accent || '#D7B45A' }]} />
    <View style={styles.eventTitleSlot}><Text style={styles.eventName} numberOfLines={2}>{campaign.shortTitle}</Text></View>
    <View style={styles.eventDateSlot}><Text style={styles.eventDate}>{eventDate(campaign)}</Text><Text style={styles.eventPlace} numberOfLines={1}>{eventPlace(campaign)}</Text></View>
    <View style={styles.eventSpacer} />
    <View style={styles.eventMetrics}><Text style={styles.eventRemaining}>{remaining} remaining</Text><Text style={styles.eventMeta}>{critical} critical</Text><Text style={styles.progressLabel}>{progress}% task completion</Text></View>
  </View>;
  return <Pressable style={styles.eventCard} onPress={() => router.push(`/host/event-work/${campaign.slug}` as never)}>{campaign.heroImageUrl ? <ImageBackground source={{ uri: campaign.heroImageUrl }} style={styles.eventImage} imageStyle={styles.eventImageRadius} resizeMode="cover">{content}</ImageBackground> : <View style={[styles.eventImage, { backgroundColor: campaign.accent ? `${campaign.accent}26` : '#141B16' }]}>{content}</View>}</Pressable>;
}

function QuickTool({ icon, label, active, onPress }: { icon?: 'calendar'; label: string; active?: boolean; onPress: () => void }) {
  return <Pressable style={[styles.quickTool, active && styles.quickToolActive]} onPress={onPress}>{icon ? <AppIcon name={icon} color={active ? '#D7B45A' : '#9AA69E'} size={14} /> : null}<Text style={[styles.quickToolText, active && styles.quickToolTextActive]} numberOfLines={1}>{label}</Text><Text style={styles.quickToolChevron}>⌄</Text></Pressable>;
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
  return <Pressable onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)} style={[styles.taskRow, !first && styles.divider]}><View style={[styles.dot, { backgroundColor: task.status === 'blocked' ? '#E7A05C' : task.priority === 'critical' ? '#EA806E' : '#D7B45A' }]} /><View style={styles.flex}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {taskTiming(task)}</Text>{task.status === 'blocked' ? <Text style={styles.blockedText}>{task.blockedBy ? `Blocked by ${task.blockedBy}` : 'Blocked reason not recorded'}</Text> : null}</View><Text style={styles.chevron}>›</Text></Pressable>;
}

function MenuItem({ label, meta, last, onPress }: { label: string; meta?: string; last?: boolean; onPress: () => void }) {
  return <Pressable style={[styles.menuItem, last && styles.menuItemLast]} onPress={onPress}><View style={styles.flex}><Text style={styles.menuItemText}>{label}</Text>{meta ? <Text style={styles.menuItemMeta}>{meta}</Text> : null}</View><Text style={styles.chevron}>›</Text></Pressable>;
}

function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, screen: { flex: 1 }, content: { padding: 18, paddingBottom: 132 }, flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { color: '#D7B45A', fontWeight: '900', fontSize: 11 }, more: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#2D3932', alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12 }, headerMark: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A990ED18', borderWidth: 1, borderColor: '#A990ED2E' }, eyebrow: { color: '#A990ED', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 21, fontWeight: '900', marginTop: 2 }, summaryLine: { color: '#8C9890', fontSize: 9, marginTop: 3 },
  statusRow: { gap: 6, paddingVertical: 12, paddingRight: 16 }, statusChip: { minWidth: 70, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121914', paddingHorizontal: 10, justifyContent: 'center' }, statusChipWide: { minWidth: 112 }, statusChipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, statusChipWarning: { borderColor: '#70552E', backgroundColor: '#1E1910' }, statusChipCritical: { borderColor: '#6E3938', backgroundColor: '#221413' }, statusChipDanger: { borderColor: '#5C3735' }, statusValue: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, statusValueActive: { color: '#172017' }, statusLabel: { color: '#839087', fontSize: 7, fontWeight: '800', marginTop: 1 }, statusLabelActive: { color: '#34412E' }, warningText: { color: '#E7A05C' }, dangerText: { color: '#EA806E' },
  loading: { padding: 30, alignItems: 'center' }, errorCard: { borderRadius: 13, backgroundColor: '#2A1715', padding: 12 }, error: { color: '#F3A59A', fontSize: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }, sectionTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, sectionMeta: { color: '#7E8A82', fontSize: 7.5, marginTop: 2 }, sectionAction: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  eventRow: { gap: 10, paddingRight: 18 }, eventCard: { width: 188, height: 178, borderRadius: 16, borderWidth: 1, borderColor: '#344239', backgroundColor: '#141B16', overflow: 'hidden' }, eventImage: { width: '100%', height: '100%' }, eventImageRadius: { borderRadius: 15 }, eventOverlay: { flex: 1, padding: 12, backgroundColor: 'rgba(7,12,9,.62)' }, eventAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 }, eventTitleSlot: { height: 42, justifyContent: 'flex-start' }, eventName: { color: '#FFF8E8', fontSize: 12, lineHeight: 16, fontWeight: '900' }, eventDateSlot: { minHeight: 30, marginTop: 4 }, eventDate: { color: '#B69AF4', fontSize: 8, fontWeight: '900' }, eventPlace: { color: '#A5B0A8', fontSize: 7, marginTop: 2 }, eventSpacer: { flex: 1 }, eventMetrics: { minHeight: 55, justifyContent: 'flex-end' }, eventRemaining: { color: '#E0BC57', fontSize: 12, fontWeight: '900' }, eventMeta: { color: '#C2CAC4', fontSize: 7.5, marginTop: 3 }, progressLabel: { color: '#9AA59E', fontSize: 7, marginTop: 3 },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, areaCard: { width: '48.7%', minHeight: 88, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', borderTopWidth: 3, backgroundColor: '#141B16', padding: 10 }, areaUrgent: { backgroundColor: '#171713', borderColor: '#4F4430' }, areaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, areaIcon: { fontSize: 17 }, areaCount: { fontSize: 15, fontWeight: '900' }, areaTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900', marginTop: 6 }, areaMeta: { color: '#7E8A82', fontSize: 7, marginTop: 2 },
  list: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16' }, taskRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, dot: { width: 8, height: 8, borderRadius: 4 }, taskTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, taskMeta: { color: '#7E8A82', fontSize: 7.5, marginTop: 3 }, blockedText: { color: '#E7A05C', fontSize: 7, marginTop: 2 }, chevron: { color: '#68736C', fontSize: 18 }, empty: { padding: 17 }, emptyText: { color: '#7E8A82', fontSize: 8.5 }, viewAllButton: { minHeight: 39, alignItems: 'center', justifyContent: 'center' }, viewAllText: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  quickDismissLayer: { ...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: 'rgba(0,0,0,.08)' }, quickDock: { position: 'absolute', left: 12, right: 12, bottom: 8, zIndex: 30 }, quickDockExpanded: { bottom: 10 }, quickCollapsed: { minHeight: 54, borderRadius: 17, borderWidth: 1, borderColor: '#4B594F', backgroundColor: '#171F1A', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: .3, shadowRadius: 12, elevation: 8 }, quickCollapsedText: { color: '#7E8982', fontSize: 16 }, quickPanel: { borderRadius: 18, borderWidth: 1, borderColor: '#4B594F', backgroundColor: '#121914', padding: 8, shadowColor: '#000', shadowOpacity: .38, shadowRadius: 16, elevation: 12 }, quickPanelTop: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 5, paddingBottom: 6 }, quickEventControl: { flex: 1, minWidth: 0 }, quickControlLabel: { color: '#718078', fontSize: 7, fontWeight: '900', letterSpacing: .8 }, quickEventName: { color: '#FFF8E8', fontSize: 10, fontWeight: '900', marginTop: 2 }, quickEventMeta: { color: '#A990ED', fontSize: 7, marginTop: 2 }, collapseButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#334038', alignItems: 'center', justifyContent: 'center' }, collapseText: { color: '#D7B45A', fontSize: 18, fontWeight: '900', marginTop: -4 }, quickBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#36443B', backgroundColor: '#171F1A', paddingHorizontal: 10 }, plus: { color: '#D7B45A', fontSize: 18, fontWeight: '900' }, quickInput: { flex: 1, color: '#FFF8E8', fontSize: 16, paddingHorizontal: 8, paddingVertical: 8 }, send: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, sendDisabled: { opacity: .35 }, sendText: { color: '#172017', fontSize: 16, fontWeight: '900' }, quickTools: { flexDirection: 'row', gap: 6, marginTop: 7 }, quickTool: { flex: 1, minWidth: 0, minHeight: 37, borderRadius: 11, borderWidth: 1, borderColor: '#303C34', backgroundColor: '#0F1511', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, quickToolActive: { borderColor: '#64562F', backgroundColor: '#1A180F' }, quickToolText: { color: '#9AA69E', fontSize: 8, fontWeight: '800', flexShrink: 1 }, quickToolTextActive: { color: '#D7B45A' }, quickToolChevron: { color: '#657169', fontSize: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.62)', justifyContent: 'flex-end', padding: 12 }, menu: { borderRadius: 20, backgroundColor: '#121814', borderWidth: 1, borderColor: '#2F3933', overflow: 'hidden', paddingTop: 14, paddingHorizontal: 14, paddingBottom: 8 }, menuTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginBottom: 7 }, menuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' }, menuItemLast: { borderBottomWidth: 0 }, menuItemText: { color: '#F4F1E8', fontSize: 11, fontWeight: '800' }, menuItemMeta: { color: '#727E76', fontSize: 7, marginTop: 2 },
  pickerSheet: { maxHeight: '80%', borderRadius: 22, backgroundColor: '#121814', borderWidth: 1, borderColor: '#2F3933', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22 }, sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#465149', alignSelf: 'center', marginBottom: 12 }, sheetTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginBottom: 8 }, sheetHelp: { color: '#829087', fontSize: 8, lineHeight: 12, marginBottom: 10 }, pickerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' }, pickerTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' }, pickerMeta: { color: '#829087', fontSize: 7.5, marginTop: 3 }, pickerCheck: { color: '#A8CF55', fontSize: 17, fontWeight: '900' }, datePresets: { flexDirection: 'row', gap: 6, marginBottom: 9 }, datePreset: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#39463E', alignItems: 'center', justifyContent: 'center' }, datePresetText: { color: '#D7B45A', fontSize: 8, fontWeight: '900' }, dateInput: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#0F1511', color: '#FFF8E8', fontSize: 16, paddingHorizontal: 12 }, dateActions: { flexDirection: 'row', gap: 8, marginTop: 10 }, secondaryButton: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#39463E', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#AAB4AE', fontSize: 9, fontWeight: '900' }, primaryButton: { flex: 1.4, minHeight: 42, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#172017', fontSize: 9, fontWeight: '900' },
});
