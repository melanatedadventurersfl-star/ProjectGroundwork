import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

type WorkspaceTab = 'overview' | 'work' | 'marketing' | 'guests' | 'operations';
type WorkTab = 'tasks' | 'milestones' | 'decisions' | 'team';
type WorkFilter = 'all' | 'mine' | 'unassigned' | 'overdue' | 'blocked';
type GuestTab = 'attendees' | 'communications' | 'checkin';

type PulseAction = {
  key: string;
  title: string;
  detail: string;
  tone?: 'danger' | 'warning';
  onPress: () => void;
};

export default function HostCampaignDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextCampaign = await getHostCampaign(String(params.id));
      setCampaign(nextCampaign);
      if (!nextCampaign) {
        setTeam([]);
        setCurrentProfileId(null);
        return;
      }
      const [nextTeam, profileId] = await Promise.all([
        listCampaignTeam(nextCampaign),
        getCurrentCampaignProfileId(),
      ]);
      setTeam(nextTeam);
      setCurrentProfileId(profileId);
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
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Event unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View></SafeAreaView>;
  }

  const readiness = getCampaignReadiness(campaign);
  const days = getCampaignDaysUntil(campaign);
  const activeTasks = campaign.tasks.filter((task) => task.status !== 'complete');
  const openDecisions = campaign.decisions.filter((decision) => decision.status === 'open');
  const mine = activeTasks.filter((task) => Boolean(currentProfileId) && task.assigneeProfileId === currentProfileId);
  const unassigned = activeTasks.filter((task) => !task.assigneeProfileId);
  const overdue = activeTasks.filter((task) => Boolean(task.dueAt) && new Date(task.dueAt as string).getTime() < referenceNow);
  const blocked = activeTasks.filter((task) => task.status === 'blocked');
  const critical = activeTasks.filter((task) => task.priority === 'critical' && task.status !== 'complete');
  const filteredTasks = workFilter === 'mine' ? mine : workFilter === 'unassigned' ? unassigned : workFilter === 'overdue' ? overdue : workFilter === 'blocked' ? blocked : activeTasks;
  const campaignSlug = campaign.slug;
  const completedMilestones = campaign.milestones.filter((milestone) => milestone.complete).length;
  const totalMilestones = campaign.milestones.length;

  function openTask(task: CampaignTask) {
    router.push(`/host/campaigns/${campaignSlug}/tasks/${task.id}` as never);
  }

  function setTab(tab: WorkspaceTab) {
    if (tab === 'marketing') {
      router.push(`/host/campaigns/${campaignSlug}/marketing` as never);
      return;
    }
    setWorkspaceTab(tab);
  }

  function openReadiness() {
    setWorkspaceTab('work');
    setWorkTab('milestones');
  }

  function openWork(filter: WorkFilter = 'all') {
    setWorkspaceTab('work');
    setWorkTab('tasks');
    setWorkFilter(filter);
  }

  const pulseActions: PulseAction[] = [];
  if (overdue.length > 0) pulseActions.push({ key: 'overdue', title: `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`, detail: 'Past due and still open', tone: 'danger', onPress: () => openWork('overdue') });
  if (unassigned.length > 0) pulseActions.push({ key: 'unassigned', title: `${unassigned.length} task${unassigned.length === 1 ? '' : 's'} need an owner`, detail: 'Assign responsibility before work gets lost', tone: 'warning', onPress: () => openWork('unassigned') });
  if (blocked.length > 0) pulseActions.push({ key: 'blocked', title: `${blocked.length} blocked task${blocked.length === 1 ? '' : 's'}`, detail: 'Resolve dependencies to keep work moving', tone: 'danger', onPress: () => openWork('blocked') });
  if (critical.length > 0) pulseActions.push({ key: 'critical', title: `${critical.length} critical task${critical.length === 1 ? '' : 's'} open`, detail: 'High-impact work still needs completion', tone: 'warning', onPress: () => openWork('all') });
  if (openDecisions.length > 0) pulseActions.push({ key: 'decisions', title: `${openDecisions.length} decision${openDecisions.length === 1 ? '' : 's'} waiting`, detail: 'Open decisions can hold up dependent work', tone: 'warning', onPress: () => { setWorkspaceTab('work'); setWorkTab('decisions'); } });

  const prioritizedTasks = [...overdue, ...critical, ...blocked, ...activeTasks].filter((task, index, list) => list.findIndex((candidate) => candidate.id === task.id) === index).slice(0, 3);
  const pulseStatus = pulseActions.length === 0 ? 'On track. No urgent issues detected.' : `${pulseActions.length} item${pulseActions.length === 1 ? '' : 's'} need attention.`;
  const foodTasks = activeTasks.filter((task) => /food|meal|hospitality/i.test(`${task.category} ${task.title}`));
  const gearTasks = activeTasks.filter((task) => /gear|equipment|packing|power|decor|production/i.test(`${task.category} ${task.title}`));
  const vendorTasks = activeTasks.filter((task) => /vendor|hayride|partner/i.test(`${task.category} ${task.title}`));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
          <Text style={styles.phasePill}>{capitalize(campaign.status || 'planning')}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{campaign.shortTitle}</Text>
        <Text style={styles.meta}>{formatEventDate(campaign.startsAt)} · {campaign.location}</Text>
        <Text style={styles.countdown}>{formatCountdown(days)}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workspaceTabs}>
        {(['overview', 'work', 'marketing', 'guests', 'operations'] as WorkspaceTab[]).map((tab) => (
          <Pressable key={tab} style={[styles.workspaceTab, workspaceTab === tab && styles.workspaceTabActive]} onPress={() => setTab(tab)}>
            <Text style={[styles.workspaceTabText, workspaceTab === tab && styles.workspaceTabTextActive]}>{capitalize(tab)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {workspaceTab === 'overview' ? <>
          <View style={styles.quickActions}>
            <Pressable style={styles.aiButton} onPress={() => router.push(`/host/assistant/${campaignSlug}` as never)}><Text style={styles.aiButtonText}>✦ Ask AI</Text><Text style={styles.quickChevron}>›</Text></Pressable>
            <Pressable style={styles.addButton} onPress={() => router.push('/host/work' as never)}><Text style={styles.addButtonText}>＋ Add task</Text><Text style={styles.addButtonText}>›</Text></Pressable>
          </View>

          <View style={styles.pulseCard}>
            <View style={styles.pulseHeader}>
              <View><Text style={styles.pulseTitle}>Event Pulse</Text><Text style={[styles.pulseStatus, pulseActions.length > 0 && styles.pulseStatusWarning]}>{pulseStatus}</Text></View>
              <Text style={styles.pulseUpdated}>Live event data</Text>
            </View>

            <View style={styles.pulseMetrics}>
              <Pressable style={styles.readinessMetric} onPress={openReadiness}>
                <View style={styles.readinessRing}><Text style={styles.readinessValue}>{readiness}%</Text></View>
                <Text style={styles.metricLabel}>Event readiness</Text>
                <Text style={styles.metricMeta}>{completedMilestones} of {totalMilestones} milestones</Text>
              </Pressable>
              <View style={styles.metricStack}>
                <PulseMetric value={formatCountdown(days)} label={formatEventDate(campaign.startsAt)} />
                <PulseMetric value={campaign.metrics.attendees > 0 ? String(campaign.metrics.attendees) : '—'} label={campaign.metrics.attendees > 0 ? 'Registered guests' : 'Guest sync pending'} />
                <PulseMetric value={String(activeTasks.length)} label={`${overdue.length} overdue · ${unassigned.length} unassigned`} danger={overdue.length > 0} />
              </View>
            </View>

            <View style={styles.nextBlock}>
              <View style={styles.nextHeader}><Text style={styles.nextTitle}>Do these next</Text><Pressable onPress={() => openWork('all')}><Text style={styles.sectionTrailing}>View all</Text></Pressable></View>
              {prioritizedTasks.length === 0 ? <Text style={styles.emptyInline}>No urgent work is queued.</Text> : prioritizedTasks.map((task, index) => <Pressable key={task.id} style={[styles.nextRow, index > 0 && styles.nextDivider]} onPress={() => openTask(task)}><View style={styles.nextNumber}><Text style={styles.nextNumberText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.nextRowTitle}>{task.title}</Text><Text style={styles.nextRowMeta}>{task.dueLabel}</Text></View><Text style={styles.quickChevron}>›</Text></Pressable>)}
            </View>
          </View>

          <SectionHeader title="Needs attention" trailing={`${pulseActions.length} item${pulseActions.length === 1 ? '' : 's'}`} />
          <View style={[styles.listCard, pulseActions.length > 0 && styles.attentionCard]}>
            {pulseActions.length === 0 ? <Text style={styles.empty}>Nothing needs immediate attention.</Text> : pulseActions.slice(0, 5).map((item, index) => <Pressable key={item.key} style={[styles.attentionRow, index > 0 && styles.attentionDivider]} onPress={item.onPress}><View style={[styles.alertBadge, item.tone === 'danger' && styles.alertBadgeDanger]}><Text style={styles.alertBadgeText}>!</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.detail}</Text></View><Text style={styles.alertChevron}>›</Text></Pressable>)}
          </View>

          <View style={styles.briefCard}>
            <View style={{ flex: 1 }}><Text style={styles.briefKicker}>✦ AI DAILY BRIEF</Text><Text style={styles.briefTitle}>{pulseActions.length === 0 ? 'Your event is clear of urgent blockers.' : `Focus on ${Math.min(3, pulseActions.length)} priority area${Math.min(3, pulseActions.length) === 1 ? '' : 's'} today.`}</Text><Text style={styles.briefBody}>{buildBrief(overdue.length, unassigned.length, blocked.length, openDecisions.length)}</Text></View>
            <Pressable style={styles.briefButton} onPress={() => router.push(`/host/assistant/${campaignSlug}` as never)}><Text style={styles.briefButtonText}>View full brief ›</Text></Pressable>
          </View>

          <View style={styles.moduleGrid}>
            <ModuleCard title="Work" value={`${activeTasks.length} open · ${overdue.length} overdue`} status={overdue.length > 0 ? 'Needs attention' : 'On track'} tone={overdue.length > 0 ? 'danger' : 'good'} onPress={() => openWork('all')} />
            <ModuleCard title="Marketing" value={`${campaign.metrics.marketingNeedsAttention} need attention`} status={campaign.metrics.marketingNeedsAttention > 0 ? 'Needs work' : 'No alerts'} tone={campaign.metrics.marketingNeedsAttention > 0 ? 'warning' : 'muted'} onPress={() => setTab('marketing')} />
            <ModuleCard title="Guests" value={campaign.metrics.attendees > 0 ? `${campaign.metrics.attendees} registered` : 'Ticket sync pending'} status={campaign.metrics.attendees > 0 ? 'Guest data active' : 'Needs setup'} tone={campaign.metrics.attendees > 0 ? 'good' : 'warning'} onPress={() => setWorkspaceTab('guests')} />
            <ModuleCard title="Operations" value={`${vendorTasks.length} vendor · ${gearTasks.length} gear items`} status={vendorTasks.length + gearTasks.length > 0 ? 'In progress' : 'Needs setup'} tone={vendorTasks.length + gearTasks.length > 0 ? 'warning' : 'muted'} onPress={() => setWorkspaceTab('operations')} />
          </View>
        </> : null}

        {workspaceTab === 'work' ? <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>
            {(['tasks', 'milestones', 'decisions', 'team'] as WorkTab[]).map((tab) => <Pressable key={tab} style={[styles.subTab, workTab === tab && styles.subTabActive]} onPress={() => setWorkTab(tab)}><Text style={[styles.subTabText, workTab === tab && styles.subTabTextActive]}>{capitalize(tab)}</Text></Pressable>)}
          </ScrollView>

          {workTab === 'tasks' ? <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <FilterChip label="All" count={activeTasks.length} active={workFilter === 'all'} onPress={() => setWorkFilter('all')} />
              <FilterChip label="Mine" count={mine.length} active={workFilter === 'mine'} onPress={() => setWorkFilter('mine')} />
              <FilterChip label="Unassigned" count={unassigned.length} active={workFilter === 'unassigned'} onPress={() => setWorkFilter('unassigned')} />
              <FilterChip label="Overdue" count={overdue.length} active={workFilter === 'overdue'} onPress={() => setWorkFilter('overdue')} />
              <FilterChip label="Blocked" count={blocked.length} active={workFilter === 'blocked'} onPress={() => setWorkFilter('blocked')} />
            </ScrollView>
            {filteredTasks.length === 0 ? <Text style={styles.empty}>No work matches this view.</Text> : filteredTasks.map((task) => <TaskCard key={task.id} task={task} team={team} onPress={() => openTask(task)} />)}
          </> : null}

          {workTab === 'milestones' ? <>
            <Text style={styles.explainer}>Readiness is weighted by these event gates. Completing low-impact tasks cannot hide an unfinished critical milestone.</Text>
            {campaign.milestones.map((milestone) => <Pressable key={milestone.id} disabled={!campaign.canManage || savingId === milestone.id} style={styles.milestoneCard} onPress={() => void toggleMilestone(milestone.id, !milestone.complete)}><View style={[styles.check, milestone.complete && styles.checkDone]}>{savingId === milestone.id ? <ActivityIndicator size="small" color="#172017" /> : <Text style={styles.checkText}>{milestone.complete ? '✓' : ''}</Text>}</View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{milestone.title}</Text><Text style={styles.rowMeta}>{milestone.complete ? 'Complete' : 'Not complete'}{campaign.canManage ? ' · Tap to update' : ''}</Text></View></Pressable>)}
          </> : null}

          {workTab === 'decisions' ? <>
            <SectionHeader title="Open decisions" />
            {openDecisions.length === 0 ? <Text style={styles.empty}>No open decisions.</Text> : openDecisions.map((decision) => <View key={decision.id} style={styles.decisionCard}><Text style={styles.decisionKicker}>DECISION NEEDED · {decision.dueLabel.toUpperCase()}</Text><Text style={styles.cardTitle}>{decision.title}</Text><Text style={styles.rowMeta}>Owner: {decision.owner}</Text>{campaign.canManage ? <><TextInput style={styles.decisionInput} value={decisionDrafts[decision.id] ?? ''} onChangeText={(value) => setDecisionDrafts((current) => ({ ...current, [decision.id]: value }))} placeholder="Record the final decision…" placeholderTextColor="#6F7972" multiline /><Pressable disabled={savingId === decision.id} style={styles.decisionButton} onPress={() => void saveDecision(decision.id)}>{savingId === decision.id ? <ActivityIndicator size="small" color="#172017" /> : <Text style={styles.decisionButtonText}>Mark decided</Text>}</Pressable></> : null}</View>)}
          </> : null}

          {workTab === 'team' ? team.length === 0 ? <Text style={styles.empty}>No event team members are attached yet.</Text> : team.map((member) => { const openCount = activeTasks.filter((task) => task.assigneeProfileId === member.profileId).length; const memberBlocked = blocked.filter((task) => task.assigneeProfileId === member.profileId).length; return <View key={member.profileId} style={styles.teamCard}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{member.displayName}</Text><Text style={styles.rowMeta}>{member.isOwner ? 'Event owner' : member.role}</Text></View><View><Text style={styles.teamMetric}>{openCount} open</Text><Text style={styles.teamMeta}>{memberBlocked} blocked</Text></View></View>; }) : null}
        </> : null}

        {workspaceTab === 'guests' ? <>
          <View style={styles.guestMetrics}>
            <GuestMetric label="Registered" value={campaign.metrics.attendees > 0 ? String(campaign.metrics.attendees) : '—'} />
            <GuestMetric label="Campers" value="—" />
            <GuestMetric label="Saturday Only" value="—" />
            <GuestMetric label="Checked In" value="—" />
          </View>
          <View style={styles.syncBanner}><Text style={styles.syncTitle}>Ticket sync pending</Text><Text style={styles.syncText}>Guest breakdowns will populate here once the ticket source is connected. No counts are being invented.</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>
            {(['attendees', 'communications', 'checkin'] as GuestTab[]).map((tab) => <Pressable key={tab} style={[styles.subTab, guestTab === tab && styles.subTabActive]} onPress={() => setGuestTab(tab)}><Text style={[styles.subTabText, guestTab === tab && styles.subTabTextActive]}>{tab === 'checkin' ? 'Check-In' : capitalize(tab)}</Text></Pressable>)}
          </ScrollView>
          {guestTab === 'attendees' ? <GuestEmpty title="Attendee list" body="Weekend campers, Saturday-only guests, age groups, meal add-ons, waivers and notes will be filterable here after ticket sync." /> : null}
          {guestTab === 'communications' ? <GuestEmpty title="Guest communications" body="Messages to all attendees or selected guest segments will live here and be recorded in event history." /> : null}
          {guestTab === 'checkin' ? <GuestEmpty title="Check-In" body="Arrival status, credentials and onsite check-in controls will appear here once attendee data is connected." /> : null}
        </> : null}

        {workspaceTab === 'operations' ? <>
          <View style={styles.operationsIntro}><Text style={styles.sectionTitle}>Operations</Text><Text style={styles.placeholderTitle}>Event-day command center</Text><Text style={styles.placeholderBody}>Planning stays compact here. During event dates, this area can promote Now, Next, responsible staff, issues and guest announcements.</Text></View>
          <OperationRow title="Run of Show" status="Setup needed" />
          <OperationRow title="Food" status={foodTasks.length ? `${foodTasks.length} open item${foodTasks.length === 1 ? '' : 's'}` : 'No tracked items yet'} />
          <OperationRow title="Gear & Packing" status={gearTasks.length ? `${gearTasks.length} open item${gearTasks.length === 1 ? '' : 's'}` : 'Checklist not started'} />
          <OperationRow title="Vendors" status={vendorTasks.length ? `${vendorTasks.length} open item${vendorTasks.length === 1 ? '' : 's'}` : 'No tracked items yet'} />
          <OperationRow title="Budget" status="Setup needed" />
          <OperationRow title="Incidents" status="0 open" />
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PulseMetric({ value, label, danger }: { value: string; label: string; danger?: boolean }) {
  return <View style={styles.pulseMetric}><Text style={[styles.pulseMetricValue, danger && styles.pulseMetricDanger]}>{value}</Text><Text style={styles.metricMeta}>{label}</Text></View>;
}

function TaskCard({ task, team, onPress }: { task: CampaignTask; team: CampaignTeamMember[]; onPress: () => void }) {
  const assignee = team.find((member) => member.profileId === task.assigneeProfileId);
  return <Pressable style={styles.taskCard} onPress={onPress}><View style={styles.taskTop}><Text style={[styles.taskStatus, task.status === 'blocked' && styles.blockedText]}>{task.status.replace('_', ' ').toUpperCase()}</Text><Text style={styles.rowMeta}>{task.dueLabel}</Text></View><Text style={styles.cardTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.category} · Plan owner: {task.owner}</Text><View style={styles.taskMetaRow}><Text style={styles.rowMeta}>Assigned: {assignee?.displayName ?? 'Unassigned'}</Text><Text style={styles.chevron}>›</Text></View></Pressable>;
}

function ModuleCard({ title, value, status, tone, onPress }: { title: string; value: string; status: string; tone: 'good' | 'warning' | 'danger' | 'muted'; onPress: () => void }) {
  return <Pressable style={styles.moduleCard} onPress={onPress}><View style={styles.moduleTop}><Text style={styles.moduleTitle}>{title}</Text><Text style={styles.chevronSmall}>›</Text></View><Text style={styles.moduleValue}>{value}</Text><View style={styles.moduleStatusRow}><View style={[styles.moduleStatusDot, tone === 'good' && styles.statusGood, tone === 'warning' && styles.statusWarning, tone === 'danger' && styles.statusDanger]} /><Text style={[styles.moduleStatusText, tone === 'good' && styles.statusGoodText, tone === 'warning' && styles.statusWarningText, tone === 'danger' && styles.statusDangerText]}>{status}</Text></View></Pressable>;
}

function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label} {count}</Text></Pressable>; }
function SectionHeader({ title, trailing, onPress }: { title: string; trailing?: string; onPress?: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{trailing ? <Pressable onPress={onPress}><Text style={styles.sectionTrailing}>{trailing}</Text></Pressable> : null}</View>; }
function GuestMetric({ label, value }: { label: string; value: string }) { return <View style={styles.guestMetric}><Text style={styles.guestValue}>{value}</Text><Text style={styles.guestLabel}>{label}</Text></View>; }
function GuestEmpty({ title, body }: { title: string; body: string }) { return <View style={styles.guestEmpty}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.placeholderBody}>{body}</Text></View>; }
function OperationRow({ title, status }: { title: string; status: string }) { return <View style={styles.operationRow}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.rowMeta}>{status}</Text></View><Text style={styles.chevronMuted}>›</Text></View>; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' '); }
function formatEventDate(start: string) { return new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatCountdown(days: number) { if (days === 0) return 'Event day'; if (days < 0) return 'Event complete'; return `${days} day${days === 1 ? '' : 's'} to go`; }
function buildBrief(overdue: number, unassigned: number, blocked: number, decisions: number) {
  const parts: string[] = [];
  if (overdue) parts.push(`${overdue} overdue`);
  if (unassigned) parts.push(`${unassigned} unassigned`);
  if (blocked) parts.push(`${blocked} blocked`);
  if (decisions) parts.push(`${decisions} decision${decisions === 1 ? '' : 's'} waiting`);
  return parts.length ? `${parts.slice(0, 3).join(' · ')}. Start with the items that unblock other work.` : 'No urgent exceptions are showing in the current event record.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  header: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222C26' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  back: { color: '#CBD4CE', fontSize: 12, fontWeight: '800' },
  phasePill: { color: '#B8E868', fontSize: 9, fontWeight: '900', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: '#638B2D', backgroundColor: '#173019', overflow: 'hidden' },
  title: { color: '#FFF8E8', fontSize: 25, lineHeight: 30, fontWeight: '900' },
  meta: { color: '#909B94', fontSize: 11, lineHeight: 16, marginTop: 4 },
  countdown: { color: '#F4F1E8', fontSize: 11, fontWeight: '900', marginTop: 5 },
  workspaceTabs: { paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#222C26' },
  workspaceTab: { paddingHorizontal: 13, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  workspaceTabActive: { borderBottomColor: '#A8CF55' },
  workspaceTabText: { color: '#8F9993', fontSize: 12, fontWeight: '800' },
  workspaceTabTextActive: { color: '#C9E678' },
  content: { padding: 16, paddingBottom: 80 },
  muted: { color: '#8E9891', fontSize: 12 },
  error: { color: '#FF8A80', fontSize: 12, marginBottom: 12 },
  quickActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  aiButton: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#34453A', backgroundColor: '#101814', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiButtonText: { color: '#F4F1E8', fontSize: 13, fontWeight: '900' },
  addButton: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: '#E1BC4D', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButtonText: { color: '#151B16', fontSize: 13, fontWeight: '900' },
  quickChevron: { color: '#B6E65D', fontSize: 24, fontWeight: '900' },
  pulseCard: { borderRadius: 18, borderWidth: 1, borderColor: '#334139', backgroundColor: '#101814', padding: 13 },
  pulseHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  pulseTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  pulseStatus: { color: '#9FCE54', fontSize: 10.5, fontWeight: '800', marginTop: 2 },
  pulseStatusWarning: { color: '#C7E869' },
  pulseUpdated: { color: '#748079', fontSize: 8.5, marginTop: 3 },
  pulseMetrics: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#28342D' },
  readinessMetric: { width: '40%', minHeight: 168, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#121B16' },
  readinessRing: { width: 82, height: 82, borderRadius: 41, borderWidth: 9, borderColor: '#A8CF55', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  readinessValue: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#F4F1E8', fontSize: 10.5, fontWeight: '900', textAlign: 'center' },
  metricMeta: { color: '#87928B', fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  metricStack: { flex: 1 },
  pulseMetric: { minHeight: 56, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#28342D' },
  pulseMetricValue: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  pulseMetricDanger: { color: '#FF746B' },
  nextBlock: { marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#355022', backgroundColor: '#142313', overflow: 'hidden' },
  nextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  nextTitle: { color: '#B9E869', fontSize: 12, fontWeight: '900' },
  nextRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  nextDivider: { borderTopWidth: 1, borderTopColor: '#2D4422' },
  nextNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B6E65D' },
  nextNumberText: { color: '#13200F', fontSize: 13, fontWeight: '900' },
  nextRowTitle: { color: '#F4F1E8', fontSize: 11.5, fontWeight: '900' },
  nextRowMeta: { color: '#93A08F', fontSize: 9.5, marginTop: 2 },
  emptyInline: { color: '#87928B', fontSize: 10, padding: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase' },
  sectionTrailing: { color: '#AAB4AD', fontSize: 10, fontWeight: '800' },
  listCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#121814', overflow: 'hidden' },
  attentionCard: { borderColor: '#6C302B', backgroundColor: '#1A1110' },
  attentionRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  attentionDivider: { borderTopWidth: 1, borderTopColor: '#4A2522' },
  alertBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9A6B24' },
  alertBadgeDanger: { backgroundColor: '#C8473F' },
  alertBadgeText: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },
  alertChevron: { color: '#FF746B', fontSize: 23, fontWeight: '900' },
  briefCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#314039', backgroundColor: '#111A16', padding: 14 },
  briefKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  briefTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 5 },
  briefBody: { color: '#8D9891', fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  briefButton: { marginTop: 12, minHeight: 40, borderRadius: 10, backgroundColor: '#E1BC4D', alignItems: 'center', justifyContent: 'center' },
  briefButtonText: { color: '#171D17', fontSize: 11, fontWeight: '900' },
  rowTitle: { color: '#F4F1E8', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  rowMeta: { color: '#8D9891', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  cardTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  chevron: { color: '#D7B45A', fontSize: 24, fontWeight: '800' },
  chevronMuted: { color: '#657169', fontSize: 24 },
  chevronSmall: { color: '#D7B45A', fontSize: 18, fontWeight: '900' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  moduleCard: { width: '48%', minHeight: 106, borderRadius: 14, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 12 },
  moduleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moduleTitle: { color: '#F4F1E8', fontSize: 12, fontWeight: '900' },
  moduleValue: { color: '#A2ADA5', fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  moduleStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' },
  moduleStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6C7770' },
  moduleStatusText: { color: '#7F8A83', fontSize: 9, fontWeight: '800' },
  statusGood: { backgroundColor: '#A8CF55' },
  statusWarning: { backgroundColor: '#E1BC4D' },
  statusDanger: { backgroundColor: '#FF6B63' },
  statusGoodText: { color: '#A8CF55' },
  statusWarningText: { color: '#E1BC4D' },
  statusDangerText: { color: '#FF7F77' },
  subTabs: { gap: 5, paddingBottom: 12 },
  subTab: { borderRadius: 18, backgroundColor: '#151C18', borderWidth: 1, borderColor: '#2D3731', paddingHorizontal: 13, paddingVertical: 8 },
  subTabActive: { backgroundColor: '#38401C', borderColor: '#7C8E38' },
  subTabText: { color: '#909B94', fontSize: 10, fontWeight: '900' },
  subTabTextActive: { color: '#DDEB79' },
  filters: { gap: 6, paddingBottom: 12 },
  filterChip: { borderRadius: 18, borderWidth: 1, borderColor: '#39433D', paddingHorizontal: 10, paddingVertical: 7 },
  filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#352D18' },
  filterChipText: { color: '#8D9891', fontSize: 9.5, fontWeight: '900' },
  filterChipTextActive: { color: '#E7C464' },
  taskCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 14, marginBottom: 9 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  taskStatus: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .6 },
  blockedText: { color: '#FF6974' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  explainer: { color: '#8D9891', fontSize: 11, lineHeight: 17, marginBottom: 12 },
  milestoneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 15, marginBottom: 9 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#597063', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  checkText: { color: '#172017', fontWeight: '900' },
  decisionCard: { borderRadius: 16, borderWidth: 1, borderColor: '#655525', backgroundColor: '#1B1810', padding: 14, marginBottom: 10 },
  decisionKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .6, marginBottom: 5 },
  decisionInput: { borderRadius: 12, borderWidth: 1, borderColor: '#4E452E', backgroundColor: '#11130F', color: '#FFF8E8', minHeight: 70, padding: 11, marginTop: 11, textAlignVertical: 'top' },
  decisionButton: { alignSelf: 'flex-start', backgroundColor: '#E6C943', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 9 },
  decisionButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' },
  teamCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 15, marginBottom: 9 },
  teamMetric: { color: '#D7B45A', fontSize: 11, fontWeight: '900', textAlign: 'right' },
  teamMeta: { color: '#8D9891', fontSize: 9.5, marginTop: 3, textAlign: 'right' },
  guestMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  guestMetric: { width: '48%', minHeight: 74, borderRadius: 14, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 12 },
  guestValue: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  guestLabel: { color: '#849087', fontSize: 9.5, fontWeight: '800', marginTop: 4 },
  syncBanner: { borderRadius: 14, borderWidth: 1, borderColor: '#4B3F20', backgroundColor: '#1C1910', padding: 13, marginBottom: 14 },
  syncTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  syncText: { color: '#9F967F', fontSize: 10.5, lineHeight: 16, marginTop: 4 },
  guestEmpty: { borderRadius: 16, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 16 },
  operationsIntro: { borderRadius: 18, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 18, marginBottom: 12 },
  placeholderTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 10 },
  placeholderBody: { color: '#8D9891', fontSize: 12, lineHeight: 18, marginTop: 7 },
  operationRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 14, marginBottom: 8 },
  empty: { color: '#7F8A83', fontSize: 11, padding: 14 },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  primaryButtonText: { color: '#172017', fontWeight: '900' },
});
