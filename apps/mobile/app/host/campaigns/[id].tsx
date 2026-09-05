import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  decideCampaignDecision,
  getCampaignDaysUntil,
  getCampaignReadiness,
  getCurrentCampaignProfileId,
  getHostCampaign,
  listCampaignTeam,
  updateCampaignMilestone,
  type CampaignTask,
  type CampaignTeamMember,
  type HostCampaign,
} from '../../../src/hosting/campaigns';
import { listCampaignMarketingItems } from '../../../src/hosting/campaignMarketing';

type WorkspaceTab = 'overview' | 'work' | 'marketing' | 'guests' | 'operations';
type WorkTab = 'tasks' | 'milestones' | 'decisions' | 'team';
type WorkFilter = 'all' | 'mine' | 'unassigned' | 'overdue' | 'blocked';
type GuestTab = 'attendees' | 'communications' | 'checkin';
type Tone = 'good' | 'warning' | 'danger' | 'muted';

type PulseAction = {
  key: string;
  title: string;
  detail: string;
  tone: 'danger' | 'warning';
  onPress: () => void;
};

export default function HostCampaignDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
  const [marketingItemCount, setMarketingItemCount] = useState(0);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [workTab, setWorkTab] = useState<WorkTab>('tasks');
  const [workFilter, setWorkFilter] = useState<WorkFilter>('all');
  const [guestTab, setGuestTab] = useState<GuestTab>('attendees');
  const [referenceNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextCampaign = await getHostCampaign(String(params.id));
      setCampaign(nextCampaign);
      if (!nextCampaign) {
        setTeam([]);
        setMarketingItemCount(0);
        setCurrentProfileId(null);
        return;
      }
      const [nextTeam, profileId, marketingItems] = await Promise.all([
        listCampaignTeam(nextCampaign),
        getCurrentCampaignProfileId(),
        listCampaignMarketingItems(nextCampaign.id).catch(() => []),
      ]);
      setTeam(nextTeam);
      setCurrentProfileId(profileId);
      setMarketingItemCount(marketingItems.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load event workspace.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggleMilestone(milestoneId: string, complete: boolean) {
    setSavingId(milestoneId);
    try {
      await updateCampaignMilestone(milestoneId, complete);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update milestone.');
    } finally {
      setSavingId(null);
    }
  }

  async function saveDecision(decisionId: string) {
    setSavingId(decisionId);
    try {
      await decideCampaignDecision(decisionId, decisionDrafts[decisionId] ?? '');
      setDecisionDrafts((current) => ({ ...current, [decisionId]: '' }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save decision.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading && !campaign) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading event workspace…</Text></View></SafeAreaView>;
  }

  if (!campaign) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.pageTitle}>Event unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View></SafeAreaView>;
  }

  const currentCampaign = campaign;
  const readiness = getCampaignReadiness(currentCampaign);
  const days = getCampaignDaysUntil(currentCampaign);
  const activeTasks = currentCampaign.tasks.filter((task) => task.status !== 'complete');
  const openDecisions = currentCampaign.decisions.filter((decision) => decision.status === 'open');
  const mine = activeTasks.filter((task) => Boolean(currentProfileId) && task.assigneeProfileId === currentProfileId);
  const unassigned = activeTasks.filter((task) => !task.assigneeProfileId);
  const overdue = activeTasks.filter((task) => Boolean(task.dueAt) && new Date(task.dueAt as string).getTime() < referenceNow);
  const blocked = activeTasks.filter((task) => task.status === 'blocked');
  const filteredTasks = workFilter === 'mine' ? mine : workFilter === 'unassigned' ? unassigned : workFilter === 'overdue' ? overdue : workFilter === 'blocked' ? blocked : activeTasks;
  const incompleteMilestones = currentCampaign.milestones.filter((milestone) => !milestone.complete);
  const completedMilestones = currentCampaign.milestones.length - incompleteMilestones.length;
  const foodTasks = activeTasks.filter((task) => /food|meal|hospitality/i.test(`${task.category} ${task.title}`));
  const gearTasks = activeTasks.filter((task) => /gear|equipment|packing|power|decor|production/i.test(`${task.category} ${task.title}`));
  const vendorTasks = activeTasks.filter((task) => /vendor|hayride|partner/i.test(`${task.category} ${task.title}`));
  const runOfShowTasks = currentCampaign.tasks.filter((task) => /run of show|timeline|event schedule|show flow/i.test(`${task.category} ${task.title}`));
  const guestSyncPending = /pending/i.test(currentCampaign.metrics.capacityLabel);
  const marketingNotConfigured = marketingItemCount === 0;
  const runOfShowMissing = runOfShowTasks.length === 0;
  const operationsTasks = [...foodTasks, ...gearTasks, ...vendorTasks];
  const operationsBlocked = operationsTasks.filter((task) => task.status === 'blocked').length;

  function openTask(task: CampaignTask) {
    router.push(`/host/campaigns/${currentCampaign.slug}/tasks/${task.id}` as never);
  }

  function setTab(tab: WorkspaceTab) {
    if (tab === 'marketing') {
      router.push(`/host/campaigns/${currentCampaign.slug}/marketing` as never);
      return;
    }
    setWorkspaceTab(tab);
  }

  function openWork(filter: WorkFilter = 'all') {
    setWorkspaceTab('work');
    setWorkTab('tasks');
    setWorkFilter(filter);
  }

  function openReadiness() {
    setWorkspaceTab('work');
    setWorkTab('milestones');
  }

  function openEdit() {
    setMenuOpen(false);
    router.push(`/host/campaigns/${currentCampaign.slug}/edit` as never);
  }

  function openPublicPage() {
    setMenuOpen(false);
    router.push({ pathname: '/adventures/[id]', params: { id: currentCampaign.adventureId } } as never);
  }

  async function shareEvent() {
    setMenuOpen(false);
    await Share.share({ message: `${currentCampaign.shortTitle}\n${formatEventRange(currentCampaign.startsAt, currentCampaign.endsAt)}\n${currentCampaign.location}` });
  }

  const pulseActions: PulseAction[] = [];
  if (overdue.length) pulseActions.push({ key: 'overdue', title: `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`, detail: 'Past due and still open', tone: 'danger', onPress: () => openWork('overdue') });
  if (blocked.length) pulseActions.push({ key: 'blocked', title: `${blocked.length} blocked task${blocked.length === 1 ? '' : 's'}`, detail: 'Resolve dependencies before other work stalls', tone: 'danger', onPress: () => openWork('blocked') });
  if (unassigned.length) pulseActions.push({ key: 'unassigned', title: `${unassigned.length} task${unassigned.length === 1 ? '' : 's'} need an owner`, detail: 'Assign responsibility before work gets lost', tone: 'warning', onPress: () => openWork('unassigned') });
  if (guestSyncPending) pulseActions.push({ key: 'guest-sync', title: 'Guest ticket sync is not configured', detail: 'Connect ticket data before relying on guest counts', tone: 'warning', onPress: () => setWorkspaceTab('guests') });
  if (marketingNotConfigured) pulseActions.push({ key: 'marketing', title: 'Marketing is not configured', detail: 'Add campaign items before marketing health can be measured', tone: 'warning', onPress: () => setTab('marketing') });
  if (runOfShowMissing) pulseActions.push({ key: 'run-show', title: 'Run of Show is not started', detail: 'Create the event-day timeline before final prep', tone: 'warning', onPress: () => setWorkspaceTab('operations') });
  if (incompleteMilestones.length) pulseActions.push({ key: 'milestones', title: `${incompleteMilestones.length} readiness milestone${incompleteMilestones.length === 1 ? '' : 's'} incomplete`, detail: 'These gates directly affect Event Readiness', tone: 'warning', onPress: openReadiness });
  if (openDecisions.length) pulseActions.push({ key: 'decisions', title: `${openDecisions.length} decision${openDecisions.length === 1 ? '' : 's'} waiting`, detail: 'Open decisions can hold up dependent work', tone: 'warning', onPress: () => { setWorkspaceTab('work'); setWorkTab('decisions'); } });

  const prioritizedTasks = [...activeTasks].sort((a, b) => priorityScore(b, referenceNow) - priorityScore(a, referenceNow)).slice(0, 3);
  const workStatus = overdue.length || blocked.length ? 'Needs attention' : activeTasks.length ? 'In progress' : 'On track';
  const marketingStatus = marketingNotConfigured ? 'Not configured' : currentCampaign.metrics.marketingNeedsAttention ? 'Needs attention' : 'In progress';
  const guestStatus = guestSyncPending ? 'Not configured' : 'Guest data active';
  const operationsStatus = runOfShowMissing ? 'Needs setup' : operationsBlocked ? 'Needs attention' : operationsTasks.length ? 'In progress' : 'Needs setup';

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
        <View style={styles.headerActions}>
          <Text style={styles.phasePill}>{capitalize(currentCampaign.status)}</Text>
          {currentCampaign.canManage ? <Pressable accessibilityLabel="Event actions" style={styles.menuButton} onPress={() => setMenuOpen(true)}><Text style={styles.menuButtonText}>•••</Text></Pressable> : null}
        </View>
      </View>
      <Pressable style={styles.eventIdentity} onPress={currentCampaign.canManage ? openEdit : undefined}>
        {currentCampaign.heroImageUrl ? <Image source={{ uri: currentCampaign.heroImageUrl }} style={styles.coverImage} resizeMode="cover" /> : <View style={styles.coverFallback}><Text style={styles.coverFallbackText}>GM</Text></View>}
        <View style={styles.eventIdentityText}><Text style={styles.pageTitle} numberOfLines={3}>{currentCampaign.shortTitle}</Text><Text style={styles.meta}>{formatEventRange(currentCampaign.startsAt, currentCampaign.endsAt)} · {currentCampaign.location}</Text><Text style={styles.countdown}>{formatCountdown(days)}</Text>{currentCampaign.canManage ? <Text style={styles.editHint}>Tap event details to edit</Text> : null}</View>
      </Pressable>
    </View>

    <ScrollView style={styles.workspaceTabScroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workspaceTabs}>
      {(['overview', 'work', 'marketing', 'guests', 'operations'] as WorkspaceTab[]).map((tab) => <Pressable key={tab} style={[styles.workspaceTab, workspaceTab === tab && styles.workspaceTabActive]} onPress={() => setTab(tab)}><Text style={[styles.workspaceTabText, workspaceTab === tab && styles.workspaceTabTextActive]}>{capitalize(tab)}</Text></Pressable>)}
    </ScrollView>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {workspaceTab === 'overview' ? <>
        <View style={styles.quickActions}><Pressable style={styles.aiButton} onPress={() => router.push(`/host/assistant/${currentCampaign.adventureId}` as never)}><Text style={styles.aiButtonText}>✦ Ask AI</Text><Text style={styles.quickChevron}>›</Text></Pressable><Pressable style={styles.addButton} onPress={() => router.push('/host/work' as never)}><Text style={styles.addButtonText}>＋ Add task</Text><Text style={styles.addButtonText}>›</Text></Pressable></View>

        <View style={styles.pulseCard}>
          <View style={styles.pulseHeader}><View><Text style={styles.pulseTitle}>Event Pulse</Text><Text style={styles.pulseStatus}>{pulseActions.length ? `${pulseActions.length} items need attention.` : 'On track. No urgent issues detected.'}</Text></View><Text style={styles.pulseUpdated}>Live event data</Text></View>
          <View style={styles.pulseMetrics}><Pressable style={styles.readinessMetric} onPress={openReadiness}><View style={styles.readinessRing}><Text style={styles.readinessValue}>{readiness}%</Text></View><Text style={styles.metricLabel}>Event readiness</Text><Text style={styles.metricMeta}>{completedMilestones} of {currentCampaign.milestones.length} milestones</Text></Pressable><View style={styles.metricStack}><PulseMetric value={formatCountdown(days)} label={formatEventRange(currentCampaign.startsAt, currentCampaign.endsAt)} /><PulseMetric value={guestSyncPending ? '—' : String(currentCampaign.metrics.attendees)} label={guestSyncPending ? 'Guest sync pending' : 'Registered guests'} /><PulseMetric value={String(activeTasks.length)} label={`${overdue.length} overdue · ${unassigned.length} unassigned`} danger={overdue.length > 0} /></View></View>
          <View style={styles.nextBlock}><View style={styles.nextHeader}><Text style={styles.nextTitle}>Do these next</Text><Pressable onPress={() => openWork()}><Text style={styles.sectionTrailing}>View all</Text></Pressable></View>{prioritizedTasks.length ? prioritizedTasks.map((task, index) => <Pressable key={task.id} style={[styles.nextRow, index > 0 && styles.divider]} onPress={() => openTask(task)}><View style={styles.nextNumber}><Text style={styles.nextNumberText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{task.title}</Text><Text style={styles.rowMeta}>{priorityLabel(task, referenceNow)}</Text></View><Text style={styles.quickChevron}>›</Text></Pressable>) : <Text style={styles.empty}>No urgent work is queued.</Text>}</View>
        </View>

        <SectionHeader title="Needs attention" trailing={`${pulseActions.length} items`} />
        <View style={[styles.listCard, pulseActions.length > 0 && styles.attentionCard]}>{pulseActions.length ? pulseActions.slice(0, 6).map((item, index) => <Pressable key={item.key} style={[styles.attentionRow, index > 0 && styles.divider]} onPress={item.onPress}><View style={[styles.alertBadge, item.tone === 'danger' && styles.alertBadgeDanger]}><Text style={styles.alertBadgeText}>!</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.detail}</Text></View><Text style={styles.alertChevron}>›</Text></Pressable>) : <Text style={styles.empty}>Nothing needs immediate attention.</Text>}</View>

        <View style={styles.briefCard}><Text style={styles.briefKicker}>✦ AI DAILY BRIEF</Text><Text style={styles.briefTitle}>{buildBriefTitle(overdue.length, blocked.length, unassigned.length, guestSyncPending, marketingNotConfigured)}</Text><Text style={styles.briefBody}>{buildBriefBody(overdue.length, blocked.length, unassigned.length, openDecisions.length, incompleteMilestones.length, guestSyncPending, marketingNotConfigured, runOfShowMissing)}</Text><Pressable style={styles.briefButton} onPress={() => router.push(`/host/assistant/${currentCampaign.adventureId}` as never)}><Text style={styles.briefButtonText}>View full brief ›</Text></Pressable></View>

        <View style={styles.moduleGrid}><ModuleCard title="Work" value={`${activeTasks.length} open · ${overdue.length} overdue`} status={workStatus} tone={workStatus === 'Needs attention' ? 'danger' : workStatus === 'On track' ? 'good' : 'warning'} onPress={() => openWork()} /><ModuleCard title="Marketing" value={marketingNotConfigured ? 'No campaign items' : `${currentCampaign.metrics.marketingNeedsAttention} need attention`} status={marketingStatus} tone={marketingNotConfigured ? 'muted' : currentCampaign.metrics.marketingNeedsAttention ? 'warning' : 'good'} onPress={() => setTab('marketing')} /><ModuleCard title="Guests" value={guestSyncPending ? 'Ticket sync pending' : `${currentCampaign.metrics.attendees} registered`} status={guestStatus} tone={guestSyncPending ? 'warning' : 'good'} onPress={() => setWorkspaceTab('guests')} /><ModuleCard title="Operations" value={`${vendorTasks.length} vendor open · ${gearTasks.length ? `${gearTasks.length} gear open` : 'Gear not started'}`} status={operationsStatus} tone={operationsStatus === 'Needs attention' ? 'danger' : operationsStatus === 'In progress' ? 'warning' : 'muted'} onPress={() => setWorkspaceTab('operations')} /></View>
      </> : null}

      {workspaceTab === 'work' ? <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>{(['tasks', 'milestones', 'decisions', 'team'] as WorkTab[]).map((tab) => <Pressable key={tab} style={[styles.subTab, workTab === tab && styles.subTabActive]} onPress={() => setWorkTab(tab)}><Text style={[styles.subTabText, workTab === tab && styles.subTabTextActive]}>{capitalize(tab)}</Text></Pressable>)}</ScrollView>
        {workTab === 'tasks' ? <><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}><FilterChip label="All" count={activeTasks.length} active={workFilter === 'all'} onPress={() => setWorkFilter('all')} /><FilterChip label="Mine" count={mine.length} active={workFilter === 'mine'} onPress={() => setWorkFilter('mine')} /><FilterChip label="Unassigned" count={unassigned.length} active={workFilter === 'unassigned'} onPress={() => setWorkFilter('unassigned')} /><FilterChip label="Overdue" count={overdue.length} active={workFilter === 'overdue'} onPress={() => setWorkFilter('overdue')} /><FilterChip label="Blocked" count={blocked.length} active={workFilter === 'blocked'} onPress={() => setWorkFilter('blocked')} /></ScrollView>{filteredTasks.length ? filteredTasks.map((task) => <TaskCard key={task.id} task={task} team={team} onPress={() => openTask(task)} />) : <Text style={styles.empty}>No work matches this view.</Text>}</> : null}
        {workTab === 'milestones' ? currentCampaign.milestones.map((milestone) => <Pressable key={milestone.id} disabled={!currentCampaign.canManage || savingId === milestone.id} style={styles.milestoneCard} onPress={() => void toggleMilestone(milestone.id, !milestone.complete)}><View style={[styles.check, milestone.complete && styles.checkDone]}>{savingId === milestone.id ? <ActivityIndicator size="small" color="#172017" /> : <Text style={styles.checkText}>{milestone.complete ? '✓' : ''}</Text>}</View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{milestone.title}</Text><Text style={styles.rowMeta}>{milestone.complete ? 'Complete' : 'Not complete'}</Text></View></Pressable>) : null}
        {workTab === 'decisions' ? (openDecisions.length ? openDecisions.map((decision) => <View key={decision.id} style={styles.decisionCard}><Text style={styles.decisionKicker}>DECISION NEEDED · {decision.dueLabel.toUpperCase()}</Text><Text style={styles.cardTitle}>{decision.title}</Text><Text style={styles.rowMeta}>Owner: {decision.owner}</Text>{currentCampaign.canManage ? <><TextInput style={styles.decisionInput} value={decisionDrafts[decision.id] ?? ''} onChangeText={(value) => setDecisionDrafts((current) => ({ ...current, [decision.id]: value }))} placeholder="Record the final decision…" placeholderTextColor="#6F7972" multiline /><Pressable disabled={savingId === decision.id} style={styles.decisionButton} onPress={() => void saveDecision(decision.id)}><Text style={styles.decisionButtonText}>Mark decided</Text></Pressable></> : null}</View>) : <Text style={styles.empty}>No open decisions.</Text>) : null}
        {workTab === 'team' ? (team.length ? team.map((member) => <View key={member.profileId} style={styles.teamCard}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{member.displayName}</Text><Text style={styles.rowMeta}>{member.isOwner ? 'Event owner' : member.role}</Text></View><Text style={styles.teamMetric}>{activeTasks.filter((task) => task.assigneeProfileId === member.profileId).length} open</Text></View>) : <Text style={styles.empty}>No event team members are attached yet.</Text>) : null}
      </> : null}

      {workspaceTab === 'guests' ? <><View style={styles.guestMetrics}><GuestMetric label="Registered" value={guestSyncPending ? '—' : String(currentCampaign.metrics.attendees)} /><GuestMetric label="Segments" value="—" /><GuestMetric label="Checked In" value="—" /></View>{guestSyncPending ? <View style={styles.syncBanner}><Text style={styles.syncTitle}>Ticket sync pending</Text><Text style={styles.syncText}>Connect a ticket source before guest counts, segments, and check-in status are treated as live data.</Text></View> : null}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>{(['attendees', 'communications', 'checkin'] as GuestTab[]).map((tab) => <Pressable key={tab} style={[styles.subTab, guestTab === tab && styles.subTabActive]} onPress={() => setGuestTab(tab)}><Text style={[styles.subTabText, guestTab === tab && styles.subTabTextActive]}>{tab === 'checkin' ? 'Check-In' : capitalize(tab)}</Text></Pressable>)}</ScrollView><GuestEmpty title={guestTab === 'attendees' ? 'Attendee list' : guestTab === 'communications' ? 'Guest communications' : 'Check-In'} body={guestSyncPending ? 'This area will populate after ticket sync is configured.' : 'Live guest data is available for this event.'} /></> : null}

      {workspaceTab === 'operations' ? <><View style={styles.operationsIntro}><Text style={styles.sectionTitle}>Operations</Text><Text style={styles.placeholderTitle}>Event-day command center</Text><Text style={styles.placeholderBody}>Use this area for the run of show, food, gear, vendors, budget, and event-day issues.</Text></View><OperationRow title="Run of Show" status={runOfShowMissing ? 'Not started' : `${runOfShowTasks.filter((task) => task.status !== 'complete').length} open items`} /><OperationRow title="Food" status={foodTasks.length ? `${foodTasks.length} open items` : 'Not started'} /><OperationRow title="Gear & Packing" status={gearTasks.length ? `${gearTasks.length} open items` : 'Not started'} /><OperationRow title="Vendors" status={vendorTasks.length ? `${vendorTasks.length} open items` : 'No open vendor items'} /><OperationRow title="Budget" status="Setup needed" /><OperationRow title="Incidents" status="0 open" /></> : null}
    </ScrollView>

    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}><Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}><View style={styles.menuSheet} onStartShouldSetResponder={() => true}><Text style={styles.menuTitle}>Event actions</Text><MenuAction label="Edit event" onPress={openEdit} /><MenuAction label="View public page" onPress={openPublicPage} /><MenuAction label="Share event" onPress={() => void shareEvent()} /><MenuAction label="Duplicate event" onPress={openEdit} /><MenuAction label="Archive workspace" onPress={openEdit} danger /><MenuAction label="Cancel event" onPress={openEdit} danger /></View></Pressable></Modal>
  </SafeAreaView>;
}

function PulseMetric({ value, label, danger }: { value: string; label: string; danger?: boolean }) { return <View style={styles.pulseMetric}><Text style={[styles.pulseMetricValue, danger && styles.pulseMetricDanger]}>{value}</Text><Text style={styles.metricMeta}>{label}</Text></View>; }
function TaskCard({ task, team, onPress }: { task: CampaignTask; team: CampaignTeamMember[]; onPress: () => void }) { const assignee = team.find((member) => member.profileId === task.assigneeProfileId); return <Pressable style={styles.taskCard} onPress={onPress}><View style={styles.taskTop}><Text style={[styles.taskStatus, task.status === 'blocked' && styles.blockedText]}>{task.status.replace('_', ' ').toUpperCase()}</Text><Text style={styles.rowMeta}>{task.dueLabel}</Text></View><Text style={styles.cardTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.category} · Assigned: {assignee?.displayName ?? 'Unassigned'}</Text></Pressable>; }
function ModuleCard({ title, value, status, tone, onPress }: { title: string; value: string; status: string; tone: Tone; onPress: () => void }) { return <Pressable style={styles.moduleCard} onPress={onPress}><View style={styles.moduleTop}><Text style={styles.moduleTitle}>{title}</Text><Text style={styles.chevronSmall}>›</Text></View><Text style={styles.moduleValue}>{value}</Text><View style={styles.moduleStatusRow}><View style={[styles.moduleStatusDot, tone === 'good' && styles.statusGood, tone === 'warning' && styles.statusWarning, tone === 'danger' && styles.statusDanger]} /><Text style={styles.moduleStatusText}>{status}</Text></View></Pressable>; }
function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label} {count}</Text></Pressable>; }
function SectionHeader({ title, trailing }: { title: string; trailing?: string }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}</View>; }
function GuestMetric({ label, value }: { label: string; value: string }) { return <View style={styles.guestMetric}><Text style={styles.guestValue}>{value}</Text><Text style={styles.guestLabel}>{label}</Text></View>; }
function GuestEmpty({ title, body }: { title: string; body: string }) { return <View style={styles.guestEmpty}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.placeholderBody}>{body}</Text></View>; }
function OperationRow({ title, status }: { title: string; status: string }) { return <View style={styles.operationRow}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.rowMeta}>{status}</Text></View><Text style={styles.chevronMuted}>›</Text></View>; }
function MenuAction({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) { return <Pressable style={styles.menuAction} onPress={onPress}><Text style={[styles.menuActionText, danger && styles.menuActionDanger]}>{label}</Text><Text style={[styles.menuActionChevron, danger && styles.menuActionDanger]}>›</Text></Pressable>; }

function priorityScore(task: CampaignTask, now: number) { let score = 0; if (task.status === 'blocked') score += 100; if (task.priority === 'critical') score += 80; if (task.priority === 'high') score += 50; if (!task.assigneeProfileId) score += 20; if (task.blockedBy) score += 35; if (task.dueAt) { const hours = (new Date(task.dueAt).getTime() - now) / 3_600_000; if (hours < 0) score += 120; else if (hours < 72) score += 45; else if (hours < 168) score += 20; } return score; }
function priorityLabel(task: CampaignTask, now: number) { if (task.status === 'blocked') return task.blockedBy ? `Blocked by ${task.blockedBy}` : 'Blocked'; if (task.dueAt && new Date(task.dueAt).getTime() < now) return `Overdue · ${task.dueLabel}`; if (task.priority === 'critical') return `Critical · ${task.dueLabel}`; if (!task.assigneeProfileId) return `Unassigned · ${task.dueLabel}`; return task.dueLabel; }
function buildBriefTitle(overdue: number, blocked: number, unassigned: number, guestSync: boolean, marketingSetup: boolean) { if (blocked) return `Resolve ${blocked} blocked task${blocked === 1 ? '' : 's'} first.`; if (overdue) return `${overdue} overdue task${overdue === 1 ? '' : 's'} need action.`; if (guestSync || marketingSetup) return 'Finish the event setup gaps that hide live status.'; if (unassigned) return `Assign owners to ${unassigned} open task${unassigned === 1 ? '' : 's'}.`; return 'No urgent blockers are showing.'; }
function buildBriefBody(overdue: number, blocked: number, unassigned: number, decisions: number, milestones: number, guestSync: boolean, marketingSetup: boolean, runShow: boolean) { const parts: string[] = []; if (blocked) parts.push(`${blocked} blocked`); if (overdue) parts.push(`${overdue} overdue`); if (unassigned) parts.push(`${unassigned} unassigned`); if (decisions) parts.push(`${decisions} decisions waiting`); if (milestones) parts.push(`${milestones} readiness milestones incomplete`); if (guestSync) parts.push('ticket sync missing'); if (marketingSetup) parts.push('marketing not configured'); if (runShow) parts.push('run of show not started'); return parts.length ? `${parts.slice(0, 5).join(' · ')}. Work the items that unblock the next event decision first.` : 'The current event record has no urgent exceptions.'; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' '); }
function formatEventRange(start: string, end: string) { const starts = new Date(start); const ends = new Date(end); const first = starts.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); const second = ends.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); return first === second ? first : `${first} – ${second}`; }
function formatCountdown(days: number) { if (days === 0) return 'Event day'; if (days < 0) return 'Event complete'; return `${days} day${days === 1 ? '' : 's'} to go`; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }, muted: { color: '#8E9891', fontSize: 12 }, error: { color: '#FF8A80', fontSize: 12, marginBottom: 12 },
  header: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222C26' }, headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, back: { color: '#CBD4CE', fontSize: 12, fontWeight: '800' }, phasePill: { color: '#B8E868', fontSize: 9, fontWeight: '900', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: '#638B2D', backgroundColor: '#173019' }, menuButton: { width: 34, height: 30, borderRadius: 10, borderWidth: 1, borderColor: '#35433A', backgroundColor: '#121A16', alignItems: 'center', justifyContent: 'center' }, menuButtonText: { color: '#F4F1E8', fontSize: 13, fontWeight: '900' },
  eventIdentity: { flexDirection: 'row', gap: 12, alignItems: 'center' }, coverImage: { width: 92, height: 112, borderRadius: 14, backgroundColor: '#172019' }, coverFallback: { width: 92, height: 112, borderRadius: 14, backgroundColor: '#1B241E', borderWidth: 1, borderColor: '#344139', alignItems: 'center', justifyContent: 'center' }, coverFallbackText: { color: '#D7B45A', fontSize: 22, fontWeight: '900' }, eventIdentityText: { flex: 1, minWidth: 0 }, pageTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 27, fontWeight: '900' }, meta: { color: '#909B94', fontSize: 11, lineHeight: 16, marginTop: 5 }, countdown: { color: '#F4F1E8', fontSize: 11, fontWeight: '900', marginTop: 5 }, editHint: { color: '#D7B45A', fontSize: 9, fontWeight: '800', marginTop: 6 },
  workspaceTabScroller: { flexGrow: 0, flexShrink: 0, height: 47, backgroundColor: '#0B100D', borderBottomWidth: 1, borderBottomColor: '#222C26' }, workspaceTabs: { paddingHorizontal: 14, alignItems: 'stretch' }, workspaceTab: { height: 47, justifyContent: 'center', paddingHorizontal: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' }, workspaceTabActive: { borderBottomColor: '#A8CF55' }, workspaceTabText: { color: '#8F9993', fontSize: 12, fontWeight: '800' }, workspaceTabTextActive: { color: '#C9E678' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 }, quickActions: { flexDirection: 'row', gap: 8, marginBottom: 12 }, aiButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#34453A', backgroundColor: '#101814', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, aiButtonText: { color: '#F4F1E8', fontSize: 13, fontWeight: '900' }, addButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#E1BC4D', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, addButtonText: { color: '#151B16', fontSize: 13, fontWeight: '900' }, quickChevron: { color: '#B6E65D', fontSize: 22, fontWeight: '900' },
  pulseCard: { borderRadius: 18, borderWidth: 1, borderColor: '#334139', backgroundColor: '#101814', padding: 13 }, pulseHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }, pulseTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, pulseStatus: { color: '#C7E869', fontSize: 10.5, fontWeight: '800', marginTop: 2 }, pulseUpdated: { color: '#748079', fontSize: 8.5, marginTop: 3 }, pulseMetrics: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#28342D' }, readinessMetric: { width: '40%', minHeight: 160, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#121B16' }, readinessRing: { width: 78, height: 78, borderRadius: 39, borderWidth: 8, borderColor: '#A8CF55', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, readinessValue: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' }, metricLabel: { color: '#F4F1E8', fontSize: 10, fontWeight: '900', textAlign: 'center' }, metricMeta: { color: '#87928B', fontSize: 9.5, lineHeight: 13, marginTop: 2 }, metricStack: { flex: 1 }, pulseMetric: { minHeight: 53, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#28342D' }, pulseMetricValue: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, pulseMetricDanger: { color: '#FF746B' },
  nextBlock: { marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#355022', backgroundColor: '#142313', overflow: 'hidden' }, nextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 9 }, nextTitle: { color: '#B9E869', fontSize: 12, fontWeight: '900' }, nextRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 }, nextNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B6E65D' }, nextNumberText: { color: '#13200F', fontSize: 12, fontWeight: '900' }, divider: { borderTopWidth: 1, borderTopColor: '#2D382F' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }, sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' }, sectionTrailing: { color: '#AAB4AD', fontSize: 10, fontWeight: '800' }, listCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#121814', overflow: 'hidden' }, attentionCard: { borderColor: '#6C302B', backgroundColor: '#1A1110' }, attentionRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 }, alertBadge: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9A6B24' }, alertBadgeDanger: { backgroundColor: '#C8473F' }, alertBadgeText: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, alertChevron: { color: '#FF746B', fontSize: 22, fontWeight: '900' },
  briefCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#314039', backgroundColor: '#111A16', padding: 13 }, briefKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .7 }, briefTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 5 }, briefBody: { color: '#8D9891', fontSize: 10.5, lineHeight: 16, marginTop: 5 }, briefButton: { marginTop: 10, minHeight: 38, borderRadius: 10, backgroundColor: '#E1BC4D', alignItems: 'center', justifyContent: 'center' }, briefButtonText: { color: '#171D17', fontSize: 11, fontWeight: '900' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, moduleCard: { width: '48%', minHeight: 88, borderRadius: 13, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 10 }, moduleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, moduleTitle: { color: '#F4F1E8', fontSize: 11.5, fontWeight: '900' }, moduleValue: { color: '#A2ADA5', fontSize: 9.5, lineHeight: 14, marginTop: 6 }, moduleStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 'auto' }, moduleStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6C7770' }, moduleStatusText: { color: '#AAB4AD', fontSize: 8.5, fontWeight: '800' }, statusGood: { backgroundColor: '#A8CF55' }, statusWarning: { backgroundColor: '#E1BC4D' }, statusDanger: { backgroundColor: '#FF6B63' }, chevronSmall: { color: '#D7B45A', fontSize: 17, fontWeight: '900' },
  subTabs: { gap: 5, paddingBottom: 12 }, subTab: { borderRadius: 18, backgroundColor: '#151C18', borderWidth: 1, borderColor: '#2D3731', paddingHorizontal: 13, paddingVertical: 8 }, subTabActive: { backgroundColor: '#38401C', borderColor: '#7C8E38' }, subTabText: { color: '#909B94', fontSize: 10, fontWeight: '900' }, subTabTextActive: { color: '#DDEB79' }, filters: { gap: 6, paddingBottom: 12 }, filterChip: { borderRadius: 18, borderWidth: 1, borderColor: '#39433D', paddingHorizontal: 10, paddingVertical: 7 }, filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#352D18' }, filterChipText: { color: '#8D9891', fontSize: 9.5, fontWeight: '900' }, filterChipTextActive: { color: '#E7C464' },
  taskCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 13, marginBottom: 8 }, taskTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, taskStatus: { color: '#D7B45A', fontSize: 9, fontWeight: '900' }, blockedText: { color: '#FF6974' }, milestoneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 14, marginBottom: 8 }, check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#597063', alignItems: 'center', justifyContent: 'center' }, checkDone: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, checkText: { color: '#172017', fontWeight: '900' }, decisionCard: { borderRadius: 15, borderWidth: 1, borderColor: '#655525', backgroundColor: '#1B1810', padding: 14, marginBottom: 9 }, decisionKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', marginBottom: 5 }, decisionInput: { borderRadius: 12, borderWidth: 1, borderColor: '#4E452E', backgroundColor: '#11130F', color: '#FFF8E8', minHeight: 68, padding: 11, marginTop: 10, textAlignVertical: 'top' }, decisionButton: { alignSelf: 'flex-start', backgroundColor: '#E6C943', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 9 }, decisionButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' }, teamCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 14, marginBottom: 8 }, teamMetric: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  rowTitle: { color: '#F4F1E8', fontSize: 12.5, lineHeight: 18, fontWeight: '800' }, rowMeta: { color: '#8D9891', fontSize: 10, lineHeight: 14, marginTop: 2 }, cardTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 21, fontWeight: '900' }, guestMetrics: { flexDirection: 'row', gap: 8, marginBottom: 12 }, guestMetric: { flex: 1, minHeight: 70, borderRadius: 13, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 11 }, guestValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, guestLabel: { color: '#849087', fontSize: 9, fontWeight: '800', marginTop: 4 }, syncBanner: { borderRadius: 13, borderWidth: 1, borderColor: '#4B3F20', backgroundColor: '#1C1910', padding: 12, marginBottom: 13 }, syncTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' }, syncText: { color: '#9F967F', fontSize: 10.5, lineHeight: 16, marginTop: 4 }, guestEmpty: { borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 15 },
  operationsIntro: { borderRadius: 17, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 16, marginBottom: 11 }, placeholderTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 9 }, placeholderBody: { color: '#8D9891', fontSize: 11.5, lineHeight: 17, marginTop: 6 }, operationRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 13, marginBottom: 7 }, chevronMuted: { color: '#657169', fontSize: 23 }, empty: { color: '#7F8A83', fontSize: 11, padding: 13 }, primaryButton: { backgroundColor: '#D7B45A', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }, primaryButtonText: { color: '#172017', fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' }, menuSheet: { backgroundColor: '#111814', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: '#2F3A33', padding: 16, paddingBottom: 32 }, menuTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginBottom: 8 }, menuAction: { minHeight: 48, borderTopWidth: 1, borderTopColor: '#27312B', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, menuActionText: { color: '#E8ECE9', fontSize: 12, fontWeight: '800' }, menuActionChevron: { color: '#D7B45A', fontSize: 20 }, menuActionDanger: { color: '#FF8178' },
});
