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
import { getEventAnalyticsSummary, type EventAnalyticsSummary } from '../../../src/hosting/eventAnalytics';

type WorkspaceTab = 'overview' | 'work' | 'marketing' | 'guests' | 'operations';
type WorkTab = 'tasks' | 'milestones' | 'decisions' | 'team';
type WorkFilter = 'all' | 'mine' | 'unassigned' | 'overdue' | 'blocked';
type GuestTab = 'attendees' | 'communications' | 'checkin';
type Tone = 'good' | 'warning' | 'danger' | 'muted';

type PriorityAction = {
  key: string;
  title: string;
  detail: string;
  tone: 'danger' | 'warning';
  onPress: () => void;
};

const emptyAnalytics: EventAnalyticsSummary = {
  impressions: 0,
  reach: 0,
  views: 0,
  clicks: 0,
  pageViews: 0,
  checkoutStarts: 0,
  orders: 0,
  tickets: 0,
  refunds: 0,
  checkIns: 0,
  grossRevenueCents: 0,
  refundedCents: 0,
  capacity: 0,
  sold: 0,
  bySource: [],
};

export default function HostCampaignDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
  const [analytics, setAnalytics] = useState<EventAnalyticsSummary>(emptyAnalytics);
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
        setAnalytics(emptyAnalytics);
        setMarketingItemCount(0);
        setCurrentProfileId(null);
        return;
      }
      const [nextTeam, profileId, marketingItems, nextAnalytics] = await Promise.all([
        listCampaignTeam(nextCampaign),
        getCurrentCampaignProfileId(),
        listCampaignMarketingItems(nextCampaign.id).catch(() => []),
        getEventAnalyticsSummary(nextCampaign.id).catch(() => emptyAnalytics),
      ]);
      setTeam(nextTeam);
      setCurrentProfileId(profileId);
      setMarketingItemCount(marketingItems.length);
      setAnalytics(nextAnalytics);
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
  const completedTasks = currentCampaign.tasks.filter((task) => task.status === 'complete');
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
  const guestSyncPending = /pending/i.test(currentCampaign.metrics.capacityLabel) && analytics.sold === 0;
  const marketingNotConfigured = marketingItemCount === 0 && analytics.impressions === 0 && analytics.clicks === 0 && analytics.pageViews === 0;
  const runOfShowMissing = runOfShowTasks.length === 0;
  const operationsTasks = [...foodTasks, ...gearTasks, ...vendorTasks];
  const operationsBlocked = operationsTasks.filter((task) => task.status === 'blocked').length;
  const registeredGuests = analytics.sold > 0 ? analytics.sold : currentCampaign.metrics.attendees;

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

  function openAnalytics() {
    router.push(`/host/analytics/${currentCampaign.adventureId}` as never);
  }

  async function shareEvent() {
    setMenuOpen(false);
    await Share.share({ message: `${currentCampaign.shortTitle}\n${formatEventRange(currentCampaign.startsAt, currentCampaign.endsAt)}\n${currentCampaign.location}` });
  }

  const priorityActions: PriorityAction[] = [];
  const topTasks = [...activeTasks].sort((a, b) => priorityScore(b, referenceNow) - priorityScore(a, referenceNow)).slice(0, 3);
  for (const task of topTasks) priorityActions.push({ key: `task-${task.id}`, title: task.title, detail: priorityLabel(task, referenceNow), tone: task.status === 'blocked' || (task.dueAt ? new Date(task.dueAt).getTime() < referenceNow : false) ? 'danger' : 'warning', onPress: () => openTask(task) });
  if (marketingNotConfigured) priorityActions.push({ key: 'marketing', title: 'Set up event marketing', detail: 'No campaign activity is being tracked yet', tone: 'warning', onPress: () => setTab('marketing') });
  if (guestSyncPending) priorityActions.push({ key: 'guest-sync', title: 'Connect ticket or RSVP data', detail: 'Guest activity is not connected to this event', tone: 'warning', onPress: () => setWorkspaceTab('guests') });
  if (runOfShowMissing) priorityActions.push({ key: 'run-show', title: 'Start the Run of Show', detail: 'Build the event-day timeline before final prep', tone: 'warning', onPress: () => setWorkspaceTab('operations') });
  if (incompleteMilestones.length) priorityActions.push({ key: 'milestones', title: `Complete ${incompleteMilestones.length} readiness milestone${incompleteMilestones.length === 1 ? '' : 's'}`, detail: 'These directly affect event readiness', tone: 'warning', onPress: openReadiness });

  const visiblePriorityActions = priorityActions.slice(0, 5);
  const workStatus = overdue.length || blocked.length ? 'Needs attention' : activeTasks.length ? 'In progress' : 'On track';
  const marketingStatus = marketingNotConfigured ? 'Not configured' : currentCampaign.metrics.marketingNeedsAttention ? 'Needs attention' : analytics.clicks || analytics.pageViews ? 'Activity flowing' : 'In progress';
  const guestStatus = guestSyncPending ? 'Not configured' : analytics.checkIns > 0 ? 'Check-in active' : registeredGuests > 0 ? 'Registration active' : 'Guest data active';
  const operationsStatus = runOfShowMissing ? 'Needs setup' : operationsBlocked ? 'Needs attention' : operationsTasks.length ? 'In progress' : 'Needs setup';
  const aiRecommendation = buildRecommendation({ overdue: overdue.length, blocked: blocked.length, unassigned: unassigned.length, marketingNotConfigured, guestSyncPending, runOfShowMissing, clicks: analytics.clicks, orders: analytics.orders, pageViews: analytics.pageViews, checkoutStarts: analytics.checkoutStarts });

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
          <View style={styles.pulseHeader}><View><Text style={styles.pulseTitle}>Event Pulse</Text><Text style={styles.pulseStatus}>{visiblePriorityActions.length ? `${visiblePriorityActions.length} priorities need action` : 'Event is on track'}</Text></View><Pressable onPress={openAnalytics}><Text style={styles.analyticsLink}>View analytics ›</Text></Pressable></View>
          <View style={styles.pulseSummaryRow}>
            <Pressable style={styles.readinessSummary} onPress={openReadiness}><Text style={styles.summaryValue}>{readiness}%</Text><Text style={styles.summaryLabel}>Ready</Text></Pressable>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryMetric}><Text style={styles.summaryValue}>{formatCountdown(days)}</Text><Text style={styles.summaryLabel}>{formatEventRange(currentCampaign.startsAt, currentCampaign.endsAt)}</Text></View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryMetric}><Text style={styles.summaryValue}>{guestSyncPending ? '—' : registeredGuests}</Text><Text style={styles.summaryLabel}>Registered</Text></View>
          </View>
          <Text style={styles.activityKicker}>EVENT ACTIVITY</Text>
          <View style={styles.activityStrip}>
            <ActivityMetric value={analytics.pageViews} label="Page views" />
            <ActivityMetric value={analytics.clicks} label="Clicks" />
            <ActivityMetric value={analytics.checkoutStarts} label="Checkout" />
            <ActivityMetric value={analytics.tickets} label="Tickets" />
          </View>
          {analytics.impressions > 0 || analytics.reach > 0 ? <Text style={styles.activityMeta}>{analytics.impressions.toLocaleString()} impressions · {analytics.reach.toLocaleString()} reach</Text> : <Text style={styles.activityMeta}>Activity appears as Go Melanated and connected sources record it.</Text>}
        </View>

        <SectionHeader title="Priority actions" trailing={`${priorityActions.length} total`} />
        <View style={styles.priorityCard}>{visiblePriorityActions.length ? visiblePriorityActions.map((item, index) => <Pressable key={item.key} style={[styles.priorityRow, index > 0 && styles.divider]} onPress={item.onPress}><View style={[styles.priorityIcon, item.tone === 'danger' && styles.priorityIconDanger]}><Text style={styles.priorityIconText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.detail}</Text></View><Text style={styles.priorityChevron}>›</Text></Pressable>) : <Text style={styles.empty}>No urgent work is queued.</Text>}</View>

        <View style={styles.aiInsightCard}><Text style={styles.aiInsightKicker}>✦ AI RECOMMENDATION</Text><Text style={styles.aiInsightTitle}>{aiRecommendation.title}</Text><Text style={styles.aiInsightBody}>{aiRecommendation.body}</Text><Pressable style={styles.aiInsightAction} onPress={() => router.push(`/host/assistant/${currentCampaign.adventureId}` as never)}><Text style={styles.aiInsightActionText}>Ask AI what to do next ›</Text></Pressable></View>

        <SectionHeader title="Event areas" trailing="Live status" />
        <View style={styles.moduleGrid}>
          <DashboardCard title="Work" status={workStatus} tone={workStatus === 'Needs attention' ? 'danger' : workStatus === 'On track' ? 'good' : 'warning'} metrics={[{ value: activeTasks.length, label: 'Open' }, { value: overdue.length, label: 'Overdue' }, { value: blocked.length, label: 'Blocked' }]} footer={`${completedTasks.length} completed total`} onPress={() => openWork()} />
          <DashboardCard title="Marketing" status={marketingStatus} tone={marketingNotConfigured ? 'muted' : currentCampaign.metrics.marketingNeedsAttention ? 'warning' : 'good'} metrics={[{ value: analytics.pageViews, label: 'Views' }, { value: analytics.clicks, label: 'Clicks' }, { value: analytics.orders, label: 'Orders' }]} footer={marketingNotConfigured ? 'Connect or create campaign activity' : `${analytics.impressions.toLocaleString()} impressions tracked`} onPress={() => setTab('marketing')} />
          <DashboardCard title="Guests" status={guestStatus} tone={guestSyncPending ? 'warning' : 'good'} metrics={[{ value: guestSyncPending ? '—' : registeredGuests, label: 'Registered' }, { value: analytics.checkIns, label: 'Checked in' }, { value: analytics.refunds, label: 'Refunds' }]} footer={guestSyncPending ? 'Ticket or RSVP connection needed' : `${analytics.orders} tracked orders`} onPress={() => setWorkspaceTab('guests')} />
          <DashboardCard title="Operations" status={operationsStatus} tone={operationsStatus === 'Needs attention' ? 'danger' : operationsStatus === 'In progress' ? 'warning' : 'muted'} metrics={[{ value: vendorTasks.length, label: 'Vendors' }, { value: gearTasks.length, label: 'Gear' }, { value: runOfShowMissing ? '—' : runOfShowTasks.filter((task) => task.status !== 'complete').length, label: 'Run show' }]} footer={runOfShowMissing ? 'Run of Show not started' : `${operationsBlocked} blocked operations items`} onPress={() => setWorkspaceTab('operations')} />
        </View>
      </> : null}

      {workspaceTab === 'work' ? <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>{(['tasks', 'milestones', 'decisions', 'team'] as WorkTab[]).map((tab) => <Pressable key={tab} style={[styles.subTab, workTab === tab && styles.subTabActive]} onPress={() => setWorkTab(tab)}><Text style={[styles.subTabText, workTab === tab && styles.subTabTextActive]}>{capitalize(tab)}</Text></Pressable>)}</ScrollView>
        {workTab === 'tasks' ? <><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}><FilterChip label="All" count={activeTasks.length} active={workFilter === 'all'} onPress={() => setWorkFilter('all')} /><FilterChip label="Mine" count={mine.length} active={workFilter === 'mine'} onPress={() => setWorkFilter('mine')} /><FilterChip label="Unassigned" count={unassigned.length} active={workFilter === 'unassigned'} onPress={() => setWorkFilter('unassigned')} /><FilterChip label="Overdue" count={overdue.length} active={workFilter === 'overdue'} onPress={() => setWorkFilter('overdue')} /><FilterChip label="Blocked" count={blocked.length} active={workFilter === 'blocked'} onPress={() => setWorkFilter('blocked')} /></ScrollView>{filteredTasks.length ? filteredTasks.map((task) => <TaskCard key={task.id} task={task} team={team} onPress={() => openTask(task)} />) : <Text style={styles.empty}>No work matches this view.</Text>}</> : null}
        {workTab === 'milestones' ? currentCampaign.milestones.map((milestone) => <Pressable key={milestone.id} disabled={!currentCampaign.canManage || savingId === milestone.id} style={styles.milestoneCard} onPress={() => void toggleMilestone(milestone.id, !milestone.complete)}><View style={[styles.check, milestone.complete && styles.checkDone]}>{savingId === milestone.id ? <ActivityIndicator size="small" color="#172017" /> : <Text style={styles.checkText}>{milestone.complete ? '✓' : ''}</Text>}</View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{milestone.title}</Text><Text style={styles.rowMeta}>{milestone.complete ? 'Complete' : 'Not complete'}</Text></View></Pressable>) : null}
        {workTab === 'decisions' ? (openDecisions.length ? openDecisions.map((decision) => <View key={decision.id} style={styles.decisionCard}><Text style={styles.decisionKicker}>DECISION NEEDED · {decision.dueLabel.toUpperCase()}</Text><Text style={styles.cardTitle}>{decision.title}</Text><Text style={styles.rowMeta}>Owner: {decision.owner}</Text>{currentCampaign.canManage ? <><TextInput style={styles.decisionInput} value={decisionDrafts[decision.id] ?? ''} onChangeText={(value) => setDecisionDrafts((current) => ({ ...current, [decision.id]: value }))} placeholder="Record the final decision…" placeholderTextColor="#6F7972" multiline /><Pressable disabled={savingId === decision.id} style={styles.decisionButton} onPress={() => void saveDecision(decision.id)}><Text style={styles.decisionButtonText}>Mark decided</Text></Pressable></> : null}</View>) : <Text style={styles.empty}>No open decisions.</Text>) : null}
        {workTab === 'team' ? (team.length ? team.map((member) => <View key={member.profileId} style={styles.teamCard}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{member.displayName}</Text><Text style={styles.rowMeta}>{member.isOwner ? 'Event owner' : member.role}</Text></View><Text style={styles.teamMetric}>{activeTasks.filter((task) => task.assigneeProfileId === member.profileId).length} open</Text></View>) : <Text style={styles.empty}>No event team members are attached yet.</Text>) : null}
      </> : null}

      {workspaceTab === 'guests' ? <><View style={styles.guestMetrics}><GuestMetric label="Registered" value={guestSyncPending ? '—' : String(registeredGuests)} /><GuestMetric label="Orders" value={String(analytics.orders)} /><GuestMetric label="Checked In" value={String(analytics.checkIns)} /></View>{guestSyncPending ? <View style={styles.syncBanner}><Text style={styles.syncTitle}>Ticket or RSVP sync pending</Text><Text style={styles.syncText}>Connect a ticket source before guest counts, segments, and check-in status are treated as live data.</Text></View> : null}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>{(['attendees', 'communications', 'checkin'] as GuestTab[]).map((tab) => <Pressable key={tab} style={[styles.subTab, guestTab === tab && styles.subTabActive]} onPress={() => setGuestTab(tab)}><Text style={[styles.subTabText, guestTab === tab && styles.subTabTextActive]}>{tab === 'checkin' ? 'Check-In' : capitalize(tab)}</Text></Pressable>)}</ScrollView><GuestEmpty title={guestTab === 'attendees' ? 'Attendee list' : guestTab === 'communications' ? 'Guest communications' : 'Check-In'} body={guestSyncPending ? 'This area will populate after ticket or RSVP sync is configured.' : 'Live guest data is available for this event.'} /></> : null}

      {workspaceTab === 'operations' ? <><View style={styles.operationsIntro}><Text style={styles.sectionTitle}>Operations</Text><Text style={styles.placeholderTitle}>Event-day command center</Text><Text style={styles.placeholderBody}>Use this area for the run of show, food, gear, vendors, budget, and event-day issues.</Text></View><OperationRow title="Run of Show" status={runOfShowMissing ? 'Not started' : `${runOfShowTasks.filter((task) => task.status !== 'complete').length} open items`} /><OperationRow title="Food" status={foodTasks.length ? `${foodTasks.length} open items` : 'Not started'} /><OperationRow title="Gear & Packing" status={gearTasks.length ? `${gearTasks.length} open items` : 'Not started'} /><OperationRow title="Vendors" status={vendorTasks.length ? `${vendorTasks.length} open items` : 'No open vendor items'} /><OperationRow title="Budget" status="Setup needed" /><OperationRow title="Incidents" status="0 open" /></> : null}
    </ScrollView>

    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}><Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}><View style={styles.menuSheet} onStartShouldSetResponder={() => true}><Text style={styles.menuTitle}>Event actions</Text><MenuAction label="Edit event" onPress={openEdit} /><MenuAction label="View public page" onPress={openPublicPage} /><MenuAction label="Share event" onPress={() => void shareEvent()} /><MenuAction label="Duplicate event" onPress={openEdit} /><MenuAction label="Archive workspace" onPress={openEdit} danger /><MenuAction label="Cancel event" onPress={openEdit} danger /></View></Pressable></Modal>
  </SafeAreaView>;
}

function ActivityMetric({ value, label }: { value: number; label: string }) { return <View style={styles.activityMetric}><Text style={styles.activityValue}>{value.toLocaleString()}</Text><Text style={styles.activityLabel}>{label}</Text></View>; }
function DashboardCard({ title, status, tone, metrics, footer, onPress }: { title: string; status: string; tone: Tone; metrics: { value: string | number; label: string }[]; footer: string; onPress: () => void }) { return <Pressable style={styles.dashboardCard} onPress={onPress}><View style={styles.dashboardTop}><Text style={styles.dashboardTitle}>{title}</Text><Text style={styles.chevronSmall}>›</Text></View><View style={styles.dashboardMetrics}>{metrics.map((metric) => <View key={metric.label} style={styles.dashboardMetric}><Text style={styles.dashboardMetricValue}>{metric.value}</Text><Text style={styles.dashboardMetricLabel}>{metric.label}</Text></View>)}</View><Text style={styles.dashboardFooter}>{footer}</Text><View style={styles.moduleStatusRow}><View style={[styles.moduleStatusDot, tone === 'good' && styles.statusGood, tone === 'warning' && styles.statusWarning, tone === 'danger' && styles.statusDanger]} /><Text style={styles.moduleStatusText}>{status}</Text></View></Pressable>; }
function TaskCard({ task, team, onPress }: { task: CampaignTask; team: CampaignTeamMember[]; onPress: () => void }) { const assignee = team.find((member) => member.profileId === task.assigneeProfileId); return <Pressable style={styles.taskCard} onPress={onPress}><View style={styles.taskTop}><Text style={[styles.taskStatus, task.status === 'blocked' && styles.blockedText]}>{task.status.replace('_', ' ').toUpperCase()}</Text><Text style={styles.rowMeta}>{task.dueLabel}</Text></View><Text style={styles.cardTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.category} · Assigned: {assignee?.displayName ?? 'Unassigned'}</Text></Pressable>; }
function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label} {count}</Text></Pressable>; }
function SectionHeader({ title, trailing }: { title: string; trailing?: string }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}</View>; }
function GuestMetric({ label, value }: { label: string; value: string }) { return <View style={styles.guestMetric}><Text style={styles.guestValue}>{value}</Text><Text style={styles.guestLabel}>{label}</Text></View>; }
function GuestEmpty({ title, body }: { title: string; body: string }) { return <View style={styles.guestEmpty}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.placeholderBody}>{body}</Text></View>; }
function OperationRow({ title, status }: { title: string; status: string }) { return <View style={styles.operationRow}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.rowMeta}>{status}</Text></View><Text style={styles.chevronMuted}>›</Text></View>; }
function MenuAction({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) { return <Pressable style={styles.menuAction} onPress={onPress}><Text style={[styles.menuActionText, danger && styles.menuActionDanger]}>{label}</Text><Text style={[styles.menuActionChevron, danger && styles.menuActionDanger]}>›</Text></Pressable>; }

function priorityScore(task: CampaignTask, now: number) { let score = 0; if (task.status === 'blocked') score += 100; if (task.priority === 'critical') score += 80; if (task.priority === 'high') score += 50; if (!task.assigneeProfileId) score += 20; if (task.blockedBy) score += 35; if (task.dueAt) { const hours = (new Date(task.dueAt).getTime() - now) / 3_600_000; if (hours < 0) score += 120; else if (hours < 72) score += 45; else if (hours < 168) score += 20; } return score; }
function priorityLabel(task: CampaignTask, now: number) { if (task.status === 'blocked') return task.blockedBy ? `Blocked by ${task.blockedBy}` : 'Blocked'; if (task.dueAt && new Date(task.dueAt).getTime() < now) return `Overdue · ${task.dueLabel}`; if (task.priority === 'critical') return `Critical · ${task.dueLabel}`; if (!task.assigneeProfileId) return `Unassigned · ${task.dueLabel}`; return task.dueLabel; }
function buildRecommendation(input: { overdue: number; blocked: number; unassigned: number; marketingNotConfigured: boolean; guestSyncPending: boolean; runOfShowMissing: boolean; clicks: number; orders: number; pageViews: number; checkoutStarts: number }) { if (input.blocked) return { title: 'Clear blocked work before adding more tasks.', body: `${input.blocked} blocked item${input.blocked === 1 ? '' : 's'} can hold up dependent work. Start there, then re-rank the remaining priorities.` }; if (input.overdue && input.unassigned) return { title: 'Assign owners to overdue work first.', body: 'The fastest way to improve execution is to give overdue items a clear owner before creating more work.' }; if (input.clicks > 0 && input.orders === 0) return { title: 'People are clicking, but they are not converting yet.', body: input.checkoutStarts > 0 ? 'Review the checkout path and ticket offer. Tracked visitors are reaching checkout without producing an order.' : 'Review the event page, ticket offer, and call to action. Click activity is not reaching checkout.' }; if (input.pageViews > 0 && input.clicks === 0) return { title: 'Event interest is reaching the page, but the next action is weak.', body: 'Strengthen the ticket or RSVP call to action and make the next step easier to find.' }; if (input.marketingNotConfigured) return { title: 'Connect marketing activity before judging performance.', body: 'Once campaign activity is tracked, this overview can show page views, clicks, checkout starts, orders, and tickets in one funnel.' }; if (input.guestSyncPending) return { title: 'Connect guest data before relying on attendance numbers.', body: 'Ticket or RSVP sync will make registration and check-in status useful across the Host Center.' }; if (input.runOfShowMissing) return { title: 'Start the Run of Show next.', body: 'The event-day timeline should become the operating plan for food, vendors, gear, staffing, and guest flow.' }; return { title: 'No major blocker is dominating the event right now.', body: 'Keep working the highest-priority task and watch the activity funnel for changes.' }; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' '); }
function formatEventRange(start: string, end: string) { const starts = new Date(start); const ends = new Date(end); const first = starts.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); const second = ends.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); return first === second ? first : `${first} – ${second}`; }
function formatCountdown(days: number) { if (days === 0) return 'Event day'; if (days < 0) return 'Event complete'; return `${days} day${days === 1 ? '' : 's'} to go`; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }, muted: { color: '#8E9891', fontSize: 12 }, error: { color: '#FF8A80', fontSize: 12, marginBottom: 12 },
  header: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222C26' }, headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, back: { color: '#CBD4CE', fontSize: 12, fontWeight: '800' }, phasePill: { color: '#B8E868', fontSize: 9, fontWeight: '900', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: '#638B2D', backgroundColor: '#173019' }, menuButton: { width: 34, height: 30, borderRadius: 10, borderWidth: 1, borderColor: '#35433A', backgroundColor: '#121A16', alignItems: 'center', justifyContent: 'center' }, menuButtonText: { color: '#F4F1E8', fontSize: 13, fontWeight: '900' },
  eventIdentity: { flexDirection: 'row', gap: 12, alignItems: 'center' }, coverImage: { width: 92, height: 112, borderRadius: 14, backgroundColor: '#172019' }, coverFallback: { width: 92, height: 112, borderRadius: 14, backgroundColor: '#1B241E', borderWidth: 1, borderColor: '#344139', alignItems: 'center', justifyContent: 'center' }, coverFallbackText: { color: '#D7B45A', fontSize: 22, fontWeight: '900' }, eventIdentityText: { flex: 1, minWidth: 0 }, pageTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 27, fontWeight: '900' }, meta: { color: '#909B94', fontSize: 11, lineHeight: 16, marginTop: 5 }, countdown: { color: '#F4F1E8', fontSize: 11, fontWeight: '900', marginTop: 5 }, editHint: { color: '#D7B45A', fontSize: 9, fontWeight: '800', marginTop: 6 },
  workspaceTabScroller: { flexGrow: 0, flexShrink: 0, height: 47, backgroundColor: '#0B100D', borderBottomWidth: 1, borderBottomColor: '#222C26' }, workspaceTabs: { paddingHorizontal: 14, alignItems: 'stretch' }, workspaceTab: { height: 47, justifyContent: 'center', paddingHorizontal: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' }, workspaceTabActive: { borderBottomColor: '#A8CF55' }, workspaceTabText: { color: '#8F9993', fontSize: 12, fontWeight: '800' }, workspaceTabTextActive: { color: '#C9E678' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 }, quickActions: { flexDirection: 'row', gap: 8, marginBottom: 12 }, aiButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#34453A', backgroundColor: '#101814', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, aiButtonText: { color: '#F4F1E8', fontSize: 13, fontWeight: '900' }, addButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#E1BC4D', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, addButtonText: { color: '#151B16', fontSize: 13, fontWeight: '900' }, quickChevron: { color: '#B6E65D', fontSize: 22, fontWeight: '900' },
  pulseCard: { borderRadius: 18, borderWidth: 1, borderColor: '#334139', backgroundColor: '#101814', padding: 14 }, pulseHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, pulseTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' }, pulseStatus: { color: '#C7E869', fontSize: 10.5, fontWeight: '800', marginTop: 2 }, analyticsLink: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900', marginTop: 4 }, pulseSummaryRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#2C3931', backgroundColor: '#121B16', paddingVertical: 11 }, readinessSummary: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, summaryMetric: { flex: 1.25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, summaryDivider: { width: 1, backgroundColor: '#2C3931' }, summaryValue: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', textAlign: 'center' }, summaryLabel: { color: '#7F8B83', fontSize: 8.5, lineHeight: 12, textAlign: 'center', marginTop: 3 }, activityKicker: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: .8, marginTop: 14, marginBottom: 7 }, activityStrip: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, borderColor: '#2C3931', overflow: 'hidden' }, activityMetric: { flex: 1, minHeight: 66, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#2C3931', paddingHorizontal: 4 }, activityValue: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' }, activityLabel: { color: '#7F8B83', fontSize: 8, marginTop: 3, textAlign: 'center' }, activityMeta: { color: '#718078', fontSize: 8.5, lineHeight: 13, marginTop: 7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }, sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' }, sectionTrailing: { color: '#AAB4AD', fontSize: 10, fontWeight: '800' }, priorityCard: { borderRadius: 16, borderWidth: 1, borderColor: '#3B463F', backgroundColor: '#121814', overflow: 'hidden' }, priorityRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 }, priorityIcon: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9A6B24' }, priorityIconDanger: { backgroundColor: '#C8473F' }, priorityIconText: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, priorityChevron: { color: '#D7B45A', fontSize: 22, fontWeight: '900' }, divider: { borderTopWidth: 1, borderTopColor: '#2D382F' },
  aiInsightCard: { marginTop: 14, borderRadius: 17, borderWidth: 1, borderColor: '#3A463F', backgroundColor: '#111A16', padding: 14 }, aiInsightKicker: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: .8 }, aiInsightTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 21, fontWeight: '900', marginTop: 6 }, aiInsightBody: { color: '#8D9891', fontSize: 10.5, lineHeight: 16, marginTop: 5 }, aiInsightAction: { marginTop: 11, minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: '#4C5C52', alignItems: 'center', justifyContent: 'center' }, aiInsightActionText: { color: '#E6C458', fontSize: 10.5, fontWeight: '900' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, dashboardCard: { width: '48%', minHeight: 156, borderRadius: 15, borderWidth: 1, borderColor: '#334139', backgroundColor: '#131A16', padding: 12 }, dashboardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dashboardTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, dashboardMetrics: { flexDirection: 'row', gap: 6, marginTop: 13 }, dashboardMetric: { flex: 1 }, dashboardMetricValue: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, dashboardMetricLabel: { color: '#7F8B83', fontSize: 7.5, marginTop: 2 }, dashboardFooter: { color: '#8D9891', fontSize: 8.5, lineHeight: 12, marginTop: 12 }, moduleStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 'auto', paddingTop: 8 }, moduleStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6C7770' }, moduleStatusText: { color: '#AAB4AD', fontSize: 9, fontWeight: '800' }, statusGood: { backgroundColor: '#A8CF55' }, statusWarning: { backgroundColor: '#E1BC4D' }, statusDanger: { backgroundColor: '#FF6B63' }, chevronSmall: { color: '#D7B45A', fontSize: 19, fontWeight: '900' },
  subTabs: { gap: 5, paddingBottom: 12 }, subTab: { borderRadius: 18, backgroundColor: '#151C18', borderWidth: 1, borderColor: '#2D3731', paddingHorizontal: 13, paddingVertical: 8 }, subTabActive: { backgroundColor: '#38401C', borderColor: '#7C8E38' }, subTabText: { color: '#909B94', fontSize: 10, fontWeight: '900' }, subTabTextActive: { color: '#DDEB79' }, filters: { gap: 6, paddingBottom: 12 }, filterChip: { borderRadius: 18, borderWidth: 1, borderColor: '#39433D', paddingHorizontal: 10, paddingVertical: 7 }, filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#352D18' }, filterChipText: { color: '#8D9891', fontSize: 9.5, fontWeight: '900' }, filterChipTextActive: { color: '#E7C464' },
  taskCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 13, marginBottom: 8 }, taskTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, taskStatus: { color: '#D7B45A', fontSize: 9, fontWeight: '900' }, blockedText: { color: '#FF6974' }, milestoneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 14, marginBottom: 8 }, check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#597063', alignItems: 'center', justifyContent: 'center' }, checkDone: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, checkText: { color: '#172017', fontWeight: '900' }, decisionCard: { borderRadius: 15, borderWidth: 1, borderColor: '#655525', backgroundColor: '#1B1810', padding: 14, marginBottom: 9 }, decisionKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', marginBottom: 5 }, decisionInput: { borderRadius: 12, borderWidth: 1, borderColor: '#4E452E', backgroundColor: '#11130F', color: '#FFF8E8', minHeight: 68, padding: 11, marginTop: 10, textAlignVertical: 'top' }, decisionButton: { alignSelf: 'flex-start', backgroundColor: '#E6C943', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 9 }, decisionButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' }, teamCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 14, marginBottom: 8 }, teamMetric: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  rowTitle: { color: '#F4F1E8', fontSize: 12.5, lineHeight: 18, fontWeight: '800' }, rowMeta: { color: '#8D9891', fontSize: 10, lineHeight: 14, marginTop: 2 }, cardTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 21, fontWeight: '900' }, guestMetrics: { flexDirection: 'row', gap: 8, marginBottom: 12 }, guestMetric: { flex: 1, minHeight: 70, borderRadius: 13, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 11 }, guestValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, guestLabel: { color: '#849087', fontSize: 9, fontWeight: '800', marginTop: 4 }, syncBanner: { borderRadius: 13, borderWidth: 1, borderColor: '#4B3F20', backgroundColor: '#1C1910', padding: 12, marginBottom: 13 }, syncTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' }, syncText: { color: '#9F967F', fontSize: 10.5, lineHeight: 16, marginTop: 4 }, guestEmpty: { borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 15 },
  operationsIntro: { borderRadius: 17, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 16, marginBottom: 11 }, placeholderTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 9 }, placeholderBody: { color: '#8D9891', fontSize: 11.5, lineHeight: 17, marginTop: 6 }, operationRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 13, marginBottom: 7 }, chevronMuted: { color: '#657169', fontSize: 23 }, empty: { color: '#7F8A83', fontSize: 11, padding: 13 }, primaryButton: { backgroundColor: '#D7B45A', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }, primaryButtonText: { color: '#172017', fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' }, menuSheet: { backgroundColor: '#111814', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: '#2F3A33', padding: 16, paddingBottom: 32 }, menuTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginBottom: 8 }, menuAction: { minHeight: 48, borderTopWidth: 1, borderTopColor: '#27312B', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, menuActionText: { color: '#E8ECE9', fontSize: 12, fontWeight: '800' }, menuActionChevron: { color: '#D7B45A', fontSize: 20 }, menuActionDanger: { color: '#FF8178' },
});