import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type CampaignTaskPriority, type HostCampaign } from './campaigns';
import { supabase } from '../lib/supabase';
import { AppIcon, type AppIconName } from '../ui/AppIcon';

type WorkTask = HostCampaign['tasks'][number] & { campaign: HostCampaign };
type TaskPackItem = { key: string; title: string; category: string; priority?: CampaignTaskPriority };
type TaskPack = { key: string; title: string; subtitle: string; icon: AppIconName; accent: string; items: TaskPackItem[] };

const taskPacks: TaskPack[] = [
  {
    key: 'campaign', title: 'Build Campaign', subtitle: 'Launch, content, email, video and final push work.', icon: 'megaphone', accent: '#A990ED',
    items: [
      { key: 'campaign-goal', title: 'Define campaign goal', category: 'Marketing', priority: 'high' },
      { key: 'campaign-audience', title: 'Confirm target audience', category: 'Marketing' },
      { key: 'campaign-dates', title: 'Confirm campaign dates', category: 'Marketing', priority: 'high' },
      { key: 'campaign-theme', title: 'Create campaign theme', category: 'Marketing' },
      { key: 'campaign-launch-post', title: 'Create launch post', category: 'Marketing', priority: 'high' },
      { key: 'campaign-social-calendar', title: 'Create social media schedule', category: 'Marketing' },
      { key: 'campaign-email', title: 'Create email campaign', category: 'Marketing' },
      { key: 'campaign-graphics', title: 'Create event graphics', category: 'Marketing' },
      { key: 'campaign-video', title: 'Create short-form video', category: 'Marketing' },
      { key: 'campaign-paid', title: 'Create paid advertising plan', category: 'Marketing' },
      { key: 'campaign-outreach', title: 'Create partner or influencer outreach list', category: 'Marketing' },
      { key: 'campaign-final-week', title: 'Schedule final-week reminder', category: 'Marketing', priority: 'high' },
      { key: 'campaign-conversion', title: 'Track ticket conversion', category: 'Marketing' },
      { key: 'campaign-recap', title: 'Create post-event recap', category: 'Marketing' },
    ],
  },
  {
    key: 'food', title: 'Build Food Plan', subtitle: 'Meals, quantities, prep, storage, service and cleanup.', icon: 'food', accent: '#E7A05C',
    items: [
      { key: 'food-headcount', title: 'Confirm meal headcount', category: 'Food', priority: 'high' },
      { key: 'food-menu', title: 'Finalize menu', category: 'Food', priority: 'high' },
      { key: 'food-dietary', title: 'Review dietary restrictions', category: 'Food' },
      { key: 'food-quantities', title: 'Calculate ingredient quantities', category: 'Food' },
      { key: 'food-shopping', title: 'Create shopping list', category: 'Food' },
      { key: 'food-prep', title: 'Assign meal prep responsibilities', category: 'Food' },
      { key: 'food-equipment', title: 'Confirm cooking equipment', category: 'Food' },
      { key: 'food-storage', title: 'Confirm food storage and cold holding', category: 'Food', priority: 'high' },
      { key: 'food-serving', title: 'Confirm serving supplies', category: 'Food' },
      { key: 'food-cleanup', title: 'Confirm cleanup supplies', category: 'Food' },
      { key: 'food-purchase', title: 'Schedule grocery purchase', category: 'Food' },
      { key: 'food-service', title: 'Assign meal service roles', category: 'Food' },
    ],
  },
  {
    key: 'venue', title: 'Find Venue', subtitle: 'Search, compare, contact and lock down a location.', icon: 'map-pin', accent: '#77B9A6',
    items: [
      { key: 'venue-requirements', title: 'Confirm venue requirements', category: 'Venue', priority: 'high' },
      { key: 'venue-search', title: 'Find possible venues', category: 'Venue', priority: 'critical' },
      { key: 'venue-shortlist', title: 'Create venue shortlist', category: 'Venue' },
      { key: 'venue-contact', title: 'Contact shortlisted venues', category: 'Venue', priority: 'high' },
      { key: 'venue-compare', title: 'Compare venue pricing and restrictions', category: 'Venue' },
      { key: 'venue-availability', title: 'Confirm venue availability', category: 'Venue', priority: 'critical' },
      { key: 'venue-contract', title: 'Review venue contract and deposit', category: 'Venue', priority: 'high' },
    ],
  },
  {
    key: 'vendors', title: 'Book Vendors', subtitle: 'Source, contact, compare, confirm and coordinate vendors.', icon: 'briefcase', accent: '#75AEE8',
    items: [
      { key: 'vendor-needs', title: 'Confirm vendor needs', category: 'Vendors', priority: 'high' },
      { key: 'vendor-search', title: 'Find possible vendors', category: 'Vendors' },
      { key: 'vendor-shortlist', title: 'Create vendor shortlist', category: 'Vendors' },
      { key: 'vendor-outreach', title: 'Contact shortlisted vendors', category: 'Vendors', priority: 'high' },
      { key: 'vendor-quotes', title: 'Collect and compare vendor quotes', category: 'Vendors' },
      { key: 'vendor-contracts', title: 'Confirm vendor contracts and deposits', category: 'Vendors', priority: 'high' },
      { key: 'vendor-arrival', title: 'Confirm vendor arrival and setup details', category: 'Vendors' },
      { key: 'vendor-final', title: 'Send final event instructions to vendors', category: 'Vendors' },
    ],
  },
  {
    key: 'event-week', title: 'Event Week', subtitle: 'Final checks, guests, staff, vendors and event-day readiness.', icon: 'calendar', accent: '#D7B45A',
    items: [
      { key: 'week-roster', title: 'Confirm final attendee roster', category: 'Operations', priority: 'high' },
      { key: 'week-staff', title: 'Confirm staff assignments', category: 'Operations', priority: 'critical' },
      { key: 'week-vendors', title: 'Confirm every vendor', category: 'Vendors', priority: 'critical' },
      { key: 'week-weather', title: 'Check weather and contingency plan', category: 'Safety', priority: 'high' },
      { key: 'week-checkin', title: 'Prepare guest check-in materials', category: 'Operations', priority: 'high' },
      { key: 'week-communications', title: 'Send final attendee information', category: 'Communications', priority: 'high' },
      { key: 'week-inventory', title: 'Complete equipment and supply check', category: 'Inventory', priority: 'high' },
      { key: 'week-emergency', title: 'Confirm emergency contacts and procedures', category: 'Safety', priority: 'high' },
      { key: 'week-load', title: 'Finalize load-in and setup plan', category: 'Operations' },
      { key: 'week-breakdown', title: 'Finalize breakdown and cleanup assignments', category: 'Operations' },
    ],
  },
];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task';
}

function suggestionFor(task: WorkTask) {
  const text = `${task.title} ${task.category}`.toLowerCase();
  if (text.includes('venue') || text.includes('location')) return { label: 'Help find a venue', route: '/host/directories' };
  if (text.includes('vendor') || text.includes('cater') || text.includes('dj') || text.includes('photograph')) return { label: 'Find or contact vendors', route: '/host/vendors' };
  if (text.includes('campaign') || text.includes('marketing') || text.includes('social')) return { label: 'Build campaign tasks', pack: 'campaign' };
  if (text.includes('food') || text.includes('meal') || text.includes('menu')) return { label: 'Build food tasks', pack: 'food' };
  return null;
}

export function HostWorkHub() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [savingQuick, setSavingQuick] = useState(false);
  const [openPack, setOpenPack] = useState<TaskPack | null>(null);
  const [selectedPackItems, setSelectedPackItems] = useState<string[]>([]);
  const [savingPack, setSavingPack] = useState(false);

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
  const attention = tasks.filter((task) => task.status === 'blocked' || task.priority === 'critical').slice(0, 6);
  const upNext = tasks.filter((task) => !attention.some((item) => item.id === task.id)).slice(0, 16);

  const addTask = useCallback(async (campaignId: string, title: string, category = 'General', priority: CampaignTaskPriority = 'normal', taskKey?: string) => {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Add a task name first.');
    const { data: authData } = await supabase.auth.getUser();
    const stamp = Date.now().toString(36);
    const { error: insertError } = await supabase.from('host_campaign_tasks').insert({
      campaign_id: campaignId,
      task_key: taskKey ?? `manual-${slugify(trimmed)}-${stamp}`,
      title: trimmed,
      category,
      owner_label: 'Unassigned',
      due_label: 'No due date',
      status: 'not_started',
      priority,
      sort_order: 900,
      created_by: authData.user?.id ?? null,
      updated_by: authData.user?.id ?? null,
    });
    if (insertError) throw insertError;
  }, []);

  const saveQuickTask = useCallback(async () => {
    if (!selectedCampaignId) { Alert.alert('Choose an event', 'Select the event this task belongs to.'); return; }
    setSavingQuick(true);
    try {
      await addTask(selectedCampaignId, quickTitle);
      setQuickTitle('');
      setQuickAddOpen(false);
      await load();
    } catch (caught) { Alert.alert('Task not added', caught instanceof Error ? caught.message : 'Try again.'); }
    finally { setSavingQuick(false); }
  }, [addTask, load, quickTitle, selectedCampaignId]);

  const openTaskPack = useCallback((pack: TaskPack) => {
    setOpenPack(pack);
    setSelectedPackItems(pack.items.map((item) => item.key));
  }, []);

  const addSelectedPack = useCallback(async () => {
    if (!openPack || !selectedCampaignId || selectedPackItems.length === 0) return;
    setSavingPack(true);
    try {
      const campaign = campaigns.find((item) => item.id === selectedCampaignId);
      const existingKeys = new Set(campaign?.tasks.map((task) => task.taskKey) ?? []);
      const selected = openPack.items.filter((item) => selectedPackItems.includes(item.key) && !existingKeys.has(`pack-${openPack.key}-${item.key}`));
      for (const item of selected) {
        await addTask(selectedCampaignId, item.title, item.category, item.priority ?? 'normal', `pack-${openPack.key}-${item.key}`);
      }
      setOpenPack(null);
      setSelectedPackItems([]);
      await load();
      Alert.alert('Tasks added', `${selected.length} task${selected.length === 1 ? '' : 's'} added to ${campaign?.shortTitle ?? 'the event'}.`);
    } catch (caught) { Alert.alert('Tasks not added', caught instanceof Error ? caught.message : 'Try again.'); }
    finally { setSavingPack(false); }
  }, [addTask, campaigns, load, openPack, selectedCampaignId, selectedPackItems]);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>

        <View style={styles.hero}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><AppIcon name="tasks" color="#A990ED" size={26} /></View><View style={{ flex: 1 }}><Text style={styles.eyebrow}>MY WORK</Text><Text style={styles.title}>What needs to happen next?</Text></View></View>
          <Text style={styles.subtitle}>Add work fast, build task packs, and act on the items that need attention across your events.</Text>
          <View style={styles.metrics}><Metric value={String(tasks.length)} label="Open" /><Metric value={String(blocked.length)} label="Blocked" /><Metric value={String(critical.length)} label="Critical" /></View>
        </View>

        {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading work…</Text></View> : null}
        {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

        {!loading && !error ? <>
          <View style={styles.actionsRow}>
            <Pressable style={styles.primaryAction} onPress={() => setQuickAddOpen((value) => !value)}><Text style={styles.primaryActionText}>＋ Quick Add</Text></Pressable>
            <Pressable style={styles.secondaryAction} onPress={() => Alert.alert('Import task list', 'Task-list file review is being connected to My Work. Quick Add and Task Packs are live now.')}><AppIcon name="upload" color="#D7B45A" size={17} /><Text style={styles.secondaryActionText}>Import</Text></Pressable>
          </View>

          {quickAddOpen ? <View style={styles.quickCard}>
            <Text style={styles.sectionKicker}>QUICK ADD</Text>
            <TextInput value={quickTitle} onChangeText={setQuickTitle} placeholder="What needs to get done?" placeholderTextColor="#6F7B74" style={styles.input} autoFocus />
            <Text style={styles.fieldLabel}>EVENT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {campaigns.map((campaign) => <Pressable key={campaign.id} onPress={() => setSelectedCampaignId(campaign.id)} style={[styles.chip, selectedCampaignId === campaign.id && styles.chipSelected]}><Text style={[styles.chipText, selectedCampaignId === campaign.id && styles.chipTextSelected]}>{campaign.shortTitle}</Text></Pressable>)}
            </ScrollView>
            <View style={styles.quickButtons}><Pressable style={styles.cancel} onPress={() => setQuickAddOpen(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={savingQuick || !quickTitle.trim()} style={[styles.save, (savingQuick || !quickTitle.trim()) && styles.disabled]} onPress={() => void saveQuickTask()}><Text style={styles.saveText}>{savingQuick ? 'Adding…' : 'Add Task'}</Text></Pressable></View>
          </View> : null}

          <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>BUILD FROM TEMPLATE</Text><Text style={styles.sectionTitle}>Task Packs</Text></View><Text style={styles.sectionHint}>Choose only what you need.</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packRow}>
            {taskPacks.map((pack) => <Pressable key={pack.key} style={styles.packCard} onPress={() => openTaskPack(pack)}>
              <View style={[styles.packIcon, { backgroundColor: `${pack.accent}20` }]}><AppIcon name={pack.icon} color={pack.accent} size={22} /></View>
              <Text style={styles.packTitle}>{pack.title}</Text><Text style={styles.packSubtitle}>{pack.subtitle}</Text><Text style={[styles.packCount, { color: pack.accent }]}>{pack.items.length} suggested tasks</Text><Text style={styles.packLink}>Review tasks ›</Text>
            </Pressable>)}
          </ScrollView>

          {openPack ? <View style={styles.packReview}>
            <View style={styles.reviewTop}><View style={[styles.packIcon, { backgroundColor: `${openPack.accent}20` }]}><AppIcon name={openPack.icon} color={openPack.accent} size={22} /></View><View style={{ flex: 1 }}><Text style={styles.sectionKicker}>REVIEW TASKS</Text><Text style={styles.reviewTitle}>{openPack.title}</Text></View><Pressable onPress={() => setOpenPack(null)}><Text style={styles.close}>×</Text></Pressable></View>
            <Text style={styles.reviewMeta}>{selectedPackItems.length} of {openPack.items.length} selected · {selectedCampaign?.shortTitle ?? 'Choose an event'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {campaigns.map((campaign) => <Pressable key={campaign.id} onPress={() => setSelectedCampaignId(campaign.id)} style={[styles.chip, selectedCampaignId === campaign.id && styles.chipSelected]}><Text style={[styles.chipText, selectedCampaignId === campaign.id && styles.chipTextSelected]}>{campaign.shortTitle}</Text></Pressable>)}
            </ScrollView>
            <View style={styles.selectActions}><Pressable onPress={() => setSelectedPackItems(openPack.items.map((item) => item.key))}><Text style={styles.textAction}>Select all</Text></Pressable><Pressable onPress={() => setSelectedPackItems([])}><Text style={styles.textAction}>Clear all</Text></Pressable></View>
            <View style={styles.reviewList}>{openPack.items.map((item, index) => { const selected = selectedPackItems.includes(item.key); return <Pressable key={item.key} onPress={() => setSelectedPackItems((current) => selected ? current.filter((key) => key !== item.key) : [...current, item.key])} style={[styles.reviewRow, index > 0 && styles.divider]}><View style={[styles.checkbox, selected && styles.checkboxSelected]}><Text style={styles.checkboxMark}>{selected ? '✓' : ''}</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.category}{item.priority && item.priority !== 'normal' ? ` · ${item.priority}` : ''}</Text></View></Pressable>; })}</View>
            <Pressable disabled={savingPack || !selectedCampaignId || selectedPackItems.length === 0} style={[styles.savePack, (savingPack || !selectedCampaignId || selectedPackItems.length === 0) && styles.disabled]} onPress={() => void addSelectedPack()}><Text style={styles.saveText}>{savingPack ? 'Adding…' : `Add ${selectedPackItems.length} Selected Task${selectedPackItems.length === 1 ? '' : 's'}`}</Text></Pressable>
          </View> : null}

          <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>FOCUS</Text><Text style={styles.sectionTitle}>Needs Attention</Text></View></View>
          <View style={styles.list}>{attention.length ? attention.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} onPack={(key) => { const pack = taskPacks.find((item) => item.key === key); if (pack) openTaskPack(pack); }} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing critical right now.</Text><Text style={styles.emptyText}>High-risk and blocked work will appear here.</Text></View>}</View>

          <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>NEXT</Text><Text style={styles.sectionTitle}>Up Next</Text></View></View>
          <View style={styles.list}>{upNext.length ? upNext.map((task, index) => <TaskRow key={task.id} task={task} first={index === 0} onPack={(key) => { const pack = taskPacks.find((item) => item.key === key); if (pack) openTaskPack(pack); }} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>No open event work.</Text></View>}</View>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskRow({ task, first, onPack }: { task: WorkTask; first: boolean; onPack: (key: string) => void }) {
  const suggestion = suggestionFor(task);
  return <View style={[styles.taskWrap, !first && styles.divider]}><Pressable style={styles.taskMain} onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)}><View style={[styles.dot, { backgroundColor: task.priority === 'critical' ? '#EA806E' : task.status === 'blocked' ? '#E7A05C' : '#D7B45A' }]} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.campaign.shortTitle} · {task.owner} · {task.dueLabel}</Text>{task.status === 'blocked' && task.blockedBy ? <Text style={styles.blocked}>Blocked by {task.blockedBy}</Text> : null}</View><Text style={styles.chevron}>›</Text></Pressable>{suggestion ? <Pressable style={styles.assist} onPress={() => suggestion.pack ? onPack(suggestion.pack) : router.push(suggestion.route as never)}><AppIcon name="sparkles" color="#A990ED" size={14} /><Text style={styles.assistText}>{suggestion.label}</Text></Pressable> : null}</View>;
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 72 }, back: { color: '#D7B45A', fontWeight: '900', marginBottom: 14 },
  hero: { borderRadius: 22, borderWidth: 1, borderColor: '#2E3A33', backgroundColor: '#141D17', padding: 18 }, heroTop: { flexDirection: 'row', gap: 12, alignItems: 'center' }, heroIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A990ED20' }, eyebrow: { color: '#A990ED', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 25, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#9AA69E', fontSize: 11, lineHeight: 17, marginTop: 12, maxWidth: 600 }, metrics: { flexDirection: 'row', gap: 8, marginTop: 15 }, metric: { flex: 1, minHeight: 68, borderRadius: 14, backgroundColor: '#101712', borderWidth: 1, borderColor: '#2D3932', padding: 11 }, metricValue: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, metricLabel: { color: '#7F8B83', fontSize: 8, marginTop: 3 },
  loading: { padding: 30, alignItems: 'center', gap: 9 }, muted: { color: '#849087', fontSize: 10 }, errorCard: { marginTop: 14, borderRadius: 14, padding: 14, backgroundColor: '#2A1715' }, error: { color: '#F3A59A', fontSize: 11 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 14 }, primaryAction: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, primaryActionText: { color: '#172017', fontWeight: '900', fontSize: 11 }, secondaryAction: { minWidth: 108, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#3A463F', backgroundColor: '#141B16', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, secondaryActionText: { color: '#FFF8E8', fontWeight: '900', fontSize: 10 },
  quickCard: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: '#3A463F', backgroundColor: '#141B16', padding: 14 }, input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#0F1511', color: '#FFF8E8', paddingHorizontal: 13, fontSize: 16, marginTop: 8 }, fieldLabel: { color: '#748078', fontSize: 8, fontWeight: '900', letterSpacing: .8, marginTop: 12 }, chips: { gap: 7, paddingVertical: 9 }, chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: '#39463E', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, chipSelected: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, chipText: { color: '#AAB4AE', fontSize: 9, fontWeight: '800' }, chipTextSelected: { color: '#172017' }, quickButtons: { flexDirection: 'row', gap: 8, marginTop: 6 }, cancel: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#39463E', alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#AAB4AE', fontWeight: '800' }, save: { flex: 2, minHeight: 44, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#172017', fontWeight: '900', fontSize: 10 }, disabled: { opacity: .45 },
  sectionHeader: { marginTop: 22, marginBottom: 9, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }, sectionKicker: { color: '#77837B', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 2 }, sectionHint: { color: '#6F7B74', fontSize: 8 },
  packRow: { gap: 9, paddingRight: 16 }, packCard: { width: 210, minHeight: 188, borderRadius: 17, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 14 }, packIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, packTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', marginTop: 11 }, packSubtitle: { color: '#859188', fontSize: 9, lineHeight: 14, marginTop: 5 }, packCount: { fontSize: 9, fontWeight: '900', marginTop: 12 }, packLink: { color: '#D7B45A', fontSize: 9, fontWeight: '900', marginTop: 7 },
  packReview: { marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: '#3A463F', backgroundColor: '#141B16', padding: 14 }, reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, reviewTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, close: { color: '#AAB4AE', fontSize: 26, padding: 6 }, reviewMeta: { color: '#839087', fontSize: 9, marginTop: 10 }, selectActions: { flexDirection: 'row', gap: 18, marginBottom: 8 }, textAction: { color: '#D7B45A', fontSize: 9, fontWeight: '900' }, reviewList: { borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#101612' }, reviewRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11 }, checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: '#526058', alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, checkboxMark: { color: '#172017', fontWeight: '900', fontSize: 12 }, savePack: { minHeight: 46, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  list: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16' }, taskWrap: { paddingVertical: 2 }, taskMain: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, dot: { width: 8, height: 8, borderRadius: 4 }, rowTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, rowMeta: { color: '#89958D', fontSize: 8, lineHeight: 13, marginTop: 3 }, blocked: { color: '#E7A05C', fontSize: 8, marginTop: 3 }, chevron: { color: '#6C7870', fontSize: 18 }, assist: { marginHorizontal: 12, marginBottom: 8, minHeight: 34, borderRadius: 10, backgroundColor: '#A990ED14', borderWidth: 1, borderColor: '#A990ED33', flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10 }, assistText: { color: '#C9BBF5', fontSize: 8, fontWeight: '900' }, empty: { padding: 20 }, emptyTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, emptyText: { color: '#7E8A82', fontSize: 9, marginTop: 4 },
});
