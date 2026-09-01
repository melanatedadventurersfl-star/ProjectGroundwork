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

export default function HostCampaignDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [workTab, setWorkTab] = useState<WorkTab>('tasks');
  const [workFilter, setWorkFilter] = useState<WorkFilter>('all');
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
  const attention = activeTasks.filter((task) => task.status === 'waiting' || task.status === 'blocked' || task.priority === 'critical');
  const openDecisions = campaign.decisions.filter((decision) => decision.status === 'open');
  const mine = activeTasks.filter((task) => Boolean(currentProfileId) && task.assigneeProfileId === currentProfileId);
  const unassigned = activeTasks.filter((task) => !task.assigneeProfileId);
  const overdue = activeTasks.filter((task) => Boolean(task.dueAt) && new Date(task.dueAt as string).getTime() < referenceNow);
  const blocked = activeTasks.filter((task) => task.status === 'blocked');
  const filteredTasks = workFilter === 'mine' ? mine : workFilter === 'unassigned' ? unassigned : workFilter === 'overdue' ? overdue : workFilter === 'blocked' ? blocked : activeTasks;
  const nextUp = activeTasks.filter((task) => task.status !== 'blocked').slice(0, 3);

  function openTask(task: CampaignTask) {
    router.push(`/host/campaigns/${campaign.slug}/tasks/${task.id}` as never);
  }

  function setTab(tab: WorkspaceTab) {
    if (tab === 'marketing') {
      router.push(`/host/campaigns/${campaign.slug}/marketing` as never);
      return;
    }
    setWorkspaceTab(tab);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
        <Text style={styles.title}>{campaign.shortTitle}</Text>
        <Text style={styles.meta}>{formatDateRange(campaign.startsAt, campaign.endsAt)} · {campaign.location}</Text>
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
          <View style={styles.readinessCard}>
            <View style={styles.readinessRing}><Text style={styles.readinessValue}>{readiness}%</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Readiness</Text><Text style={styles.accentText}>{days} days to go</Text></View>
          </View>

          <SectionHeader title="Needs attention" trailing={`${attention.length} item${attention.length === 1 ? '' : 's'}`} />
          <View style={styles.listCard}>
            {attention.length === 0 ? <Text style={styles.empty}>Nothing needs immediate attention.</Text> : attention.slice(0, 3).map((task, index) => <CompactTask key={task.id} task={task} onPress={() => openTask(task)} divider={index > 0} />)}
          </View>

          <SectionHeader title="Next up" trailing={activeTasks.length > 3 ? 'View all' : undefined} onPress={() => setWorkspaceTab('work')} />
          <View style={styles.listCard}>
            {nextUp.map((task, index) => <CompactTask key={task.id} task={task} onPress={() => openTask(task)} divider={index > 0} />)}
            {openDecisions.slice(0, 1).map((decision, index) => <Pressable key={decision.id} style={[styles.compactRow, (nextUp.length > 0 || index > 0) && styles.divider]} onPress={() => { setWorkspaceTab('work'); setWorkTab('decisions'); }}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{decision.title}</Text><Text style={styles.rowMeta}>Decision needed · {decision.owner}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
          </View>

          <View style={styles.moduleGrid}>
            <ModuleCard title="Work" value={`${activeTasks.length} open tasks`} onPress={() => setWorkspaceTab('work')} />
            <ModuleCard title="Marketing" value={`${campaign.metrics.marketingNeedsAttention} need attention`} onPress={() => setTab('marketing')} />
            <ModuleCard title="Guests" value={campaign.metrics.capacityLabel} onPress={() => setWorkspaceTab('guests')} />
            <ModuleCard title="Budget" value="Setup needed" onPress={() => setWorkspaceTab('operations')} />
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
            {filteredTasks.map((task) => <TaskCard key={task.id} task={task} team={team} onPress={() => openTask(task)} />)}
          </> : null}

          {workTab === 'milestones' ? campaign.milestones.map((milestone) => <Pressable key={milestone.id} disabled={!campaign.canManage || savingId === milestone.id} style={styles.milestoneCard} onPress={() => void toggleMilestone(milestone.id, !milestone.complete)}><View style={[styles.check, milestone.complete && styles.checkDone]}><Text style={styles.checkText}>{milestone.complete ? '✓' : ''}</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{milestone.title}</Text><Text style={styles.rowMeta}>{milestone.complete ? 'Complete' : 'Not complete'}{campaign.canManage ? ' · Tap to update' : ''}</Text></View></Pressable>) : null}

          {workTab === 'decisions' ? <>
            <SectionHeader title="Open decisions" />
            {openDecisions.map((decision) => <View key={decision.id} style={styles.decisionCard}><Text style={styles.decisionKicker}>DECISION NEEDED · {decision.dueLabel.toUpperCase()}</Text><Text style={styles.cardTitle}>{decision.title}</Text><Text style={styles.rowMeta}>Owner: {decision.owner}</Text>{campaign.canManage ? <><TextInput style={styles.decisionInput} value={decisionDrafts[decision.id] ?? ''} onChangeText={(value) => setDecisionDrafts((current) => ({ ...current, [decision.id]: value }))} placeholder="Record the final decision…" placeholderTextColor="#6F7972" multiline /><Pressable disabled={savingId === decision.id} style={styles.decisionButton} onPress={() => void saveDecision(decision.id)}><Text style={styles.decisionButtonText}>Mark decided</Text></Pressable></> : null}</View>)}
          </> : null}

          {workTab === 'team' ? team.map((member) => { const openCount = activeTasks.filter((task) => task.assigneeProfileId === member.profileId).length; const memberBlocked = blocked.filter((task) => task.assigneeProfileId === member.profileId).length; return <View key={member.profileId} style={styles.teamCard}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{member.displayName}</Text><Text style={styles.rowMeta}>{member.isOwner ? 'Event owner' : member.role}</Text></View><View><Text style={styles.teamMetric}>{openCount} open</Text><Text style={styles.teamMeta}>{memberBlocked} blocked</Text></View></View>; }) : null}
        </> : null}

        {workspaceTab === 'guests' ? <Placeholder title="Guests" body={campaign.metrics.capacityLabel} secondary="Ticket sync, attendee segments, communications and check-in will live here." /> : null}
        {workspaceTab === 'operations' ? <Placeholder title="Operations" body="Event-day command center" secondary="Run of show, food, equipment, vendors, incidents and budget will live here." /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CompactTask({ task, onPress, divider }: { task: CampaignTask; onPress: () => void; divider?: boolean }) {
  return <Pressable style={[styles.compactRow, divider && styles.divider]} onPress={onPress}><View style={[styles.statusDot, task.status === 'blocked' ? styles.dotBlocked : styles.dotWaiting]} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.status === 'blocked' ? 'Blocked' : task.status === 'waiting' ? 'Waiting' : task.dueLabel}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

function TaskCard({ task, team, onPress }: { task: CampaignTask; team: CampaignTeamMember[]; onPress: () => void }) {
  const assignee = team.find((member) => member.profileId === task.assigneeProfileId);
  return <Pressable style={styles.taskCard} onPress={onPress}><View style={styles.taskTop}><Text style={[styles.taskStatus, task.status === 'blocked' && styles.blockedText]}>{task.status.replace('_', ' ').toUpperCase()}</Text><Text style={styles.rowMeta}>{task.dueLabel}</Text></View><Text style={styles.cardTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.category} · Plan owner: {task.owner}</Text><View style={styles.taskMetaRow}><Text style={styles.rowMeta}>Assigned: {assignee?.displayName ?? 'Unassigned'}</Text><Text style={styles.chevron}>›</Text></View></Pressable>;
}

function ModuleCard({ title, value, onPress }: { title: string; value: string; onPress: () => void }) {
  return <Pressable style={styles.moduleCard} onPress={onPress}><Text style={styles.moduleTitle}>{title}</Text><Text style={styles.moduleValue}>{value}</Text></Pressable>;
}

function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label} {count}</Text></Pressable>;
}

function SectionHeader({ title, trailing, onPress }: { title: string; trailing?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{trailing ? <Pressable onPress={onPress}><Text style={styles.sectionTrailing}>{trailing}</Text></Pressable> : null}</View>;
}

function Placeholder({ title, body, secondary }: { title: string; body: string; secondary: string }) {
  return <View style={styles.placeholder}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.placeholderTitle}>{body}</Text><Text style={styles.placeholderBody}>{secondary}</Text></View>;
}

function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatDateRange(start: string, end: string) { const a = new Date(start); const b = new Date(end); return `${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#222C26' },
  back: { color: '#CBD4CE', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  title: { color: '#FFF8E8', fontSize: 26, lineHeight: 32, fontWeight: '900' },
  meta: { color: '#909B94', fontSize: 12, lineHeight: 17, marginTop: 4 },
  workspaceTabs: { paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#222C26' },
  workspaceTab: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  workspaceTabActive: { borderBottomColor: '#A8CF55' },
  workspaceTabText: { color: '#8F9993', fontSize: 12, fontWeight: '800' },
  workspaceTabTextActive: { color: '#C9E678' },
  content: { padding: 16, paddingBottom: 70 },
  muted: { color: '#8E9891', fontSize: 12 },
  error: { color: '#FF8A80', fontSize: 12, marginBottom: 12 },
  readinessCard: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 18, borderWidth: 1, borderColor: '#334139', backgroundColor: '#131A16', padding: 16 },
  readinessRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 7, borderColor: '#A8CF55', alignItems: 'center', justifyContent: 'center' },
  readinessValue: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  cardTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  accentText: { color: '#A8CF55', fontSize: 12, fontWeight: '900', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase' },
  sectionTrailing: { color: '#AAB4AD', fontSize: 10, fontWeight: '800' },
  listCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#121814', overflow: 'hidden' },
  compactRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: '#2B352F' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotWaiting: { backgroundColor: '#E2C64D' },
  dotBlocked: { backgroundColor: '#FF6974' },
  rowTitle: { color: '#F4F1E8', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  rowMeta: { color: '#8D9891', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  chevron: { color: '#D7B45A', fontSize: 24, fontWeight: '800' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 20 },
  moduleCard: { width: '48%', minHeight: 84, borderRadius: 14, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 12 },
  moduleTitle: { color: '#F4F1E8', fontSize: 12, fontWeight: '900' },
  moduleValue: { color: '#909B94', fontSize: 10.5, lineHeight: 15, marginTop: 5 },
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
  placeholder: { borderRadius: 18, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 18, marginTop: 8 },
  placeholderTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 10 },
  placeholderBody: { color: '#8D9891', fontSize: 12, lineHeight: 18, marginTop: 7 },
  empty: { color: '#7F8A83', fontSize: 11, padding: 14 },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  primaryButtonText: { color: '#172017', fontWeight: '900' },
});