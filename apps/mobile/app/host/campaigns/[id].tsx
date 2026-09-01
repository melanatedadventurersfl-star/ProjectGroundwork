import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  assignCampaignTask,
  decideCampaignDecision,
  getCampaignDaysUntil,
  getCampaignReadiness,
  getCurrentCampaignProfileId,
  getHostCampaign,
  listCampaignTeam,
  updateCampaignMilestone,
  updateCampaignTaskStatus,
  type CampaignTask,
  type CampaignTaskStatus,
  type CampaignTeamMember,
  type HostCampaign,
} from '../../../src/hosting/campaigns';

const statusLabels: Record<CampaignTaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  waiting: 'Waiting',
  blocked: 'Blocked',
  review: 'Ready for review',
  complete: 'Complete',
};

type WorkFilter = 'all' | 'mine' | 'unassigned' | 'overdue' | 'blocked';

export default function HostCampaignDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [workFilter, setWorkFilter] = useState<WorkFilter>('all');
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
      setError(caught instanceof Error ? caught.message : 'Unable to load campaign.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function changeTaskStatus(taskId: string, status: CampaignTaskStatus) {
    setSavingId(taskId);
    setError('');
    try {
      await updateCampaignTaskStatus(taskId, status);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update task.');
    } finally {
      setSavingId(null);
    }
  }

  async function changeTaskAssignee(taskId: string, profileId: string | null) {
    setSavingId(taskId);
    setError('');
    try {
      await assignCampaignTask(taskId, profileId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to assign task.');
    } finally {
      setSavingId(null);
    }
  }

  async function toggleMilestone(milestoneId: string, complete: boolean) {
    setSavingId(milestoneId);
    setError('');
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
    setError('');
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
    return <SafeAreaView style={styles.safe}><View style={styles.centerState}><ActivityIndicator color="#D7B45A" /><Text style={styles.stateText}>Loading campaign…</Text></View></SafeAreaView>;
  }

  if (!campaign) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <Text style={styles.title}>{error ? 'Campaign unavailable' : 'Campaign not found'}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryButtonText}>Try again</Text></Pressable>
          <Pressable onPress={() => router.replace('/host/campaigns' as never)}><Text style={styles.backLink}>Back to Campaigns</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const readiness = getCampaignReadiness(campaign);
  const days = getCampaignDaysUntil(campaign);
  const attention = campaign.tasks.filter((task) => task.priority === 'critical' || task.status === 'blocked' || task.status === 'waiting');
  const activeTasks = campaign.tasks.filter((task) => task.status !== 'complete');
  const completedTasks = campaign.tasks.filter((task) => task.status === 'complete');
  const openDecisions = campaign.decisions.filter((decision) => decision.status === 'open');
  const now = Date.now();
  const mine = activeTasks.filter((task) => Boolean(currentProfileId) && task.assigneeProfileId === currentProfileId);
  const unassigned = activeTasks.filter((task) => !task.assigneeProfileId);
  const overdue = activeTasks.filter((task) => Boolean(task.dueAt) && new Date(task.dueAt as string).getTime() < now);
  const blocked = activeTasks.filter((task) => task.status === 'blocked');
  const filteredTasks = workFilter === 'mine' ? mine
    : workFilter === 'unassigned' ? unassigned
      : workFilter === 'overdue' ? overdue
        : workFilter === 'blocked' ? blocked
          : activeTasks;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Campaigns</Text></Pressable>
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>HOST CAMPAIGN</Text>
            <Text style={styles.title}>{campaign.shortTitle}</Text>
          </View>
          <View style={[styles.accessPill, campaign.canManage ? styles.accessPillManage : styles.accessPillView]}><Text style={campaign.canManage ? styles.accessManageText : styles.accessViewText}>{campaign.canManage ? 'MANAGE' : 'VIEW'}</Text></View>
        </View>
        <Text style={styles.meta}>{campaign.location}</Text>
        <Text style={[styles.countdown, { color: campaign.accent }]}>{days} DAYS TO GO</Text>

        {error ? <View style={styles.inlineError}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.readinessCard}>
          <View style={styles.readinessTop}><Text style={styles.sectionLabel}>EVENT READINESS</Text><Text style={[styles.readinessValue, { color: campaign.accent }]}>{readiness}%</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${readiness}%`, backgroundColor: campaign.accent }]} /></View>
          <Text style={styles.readinessNote}>Weighted by critical milestones, not just task count.</Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickCard value={String(activeTasks.length)} label="Open work" />
          <QuickCard value={String(attention.length)} label="Needs attention" />
          <QuickCard value={String(openDecisions.length)} label="Open decisions" />
          <QuickCard value={String(completedTasks.length)} label="Complete" />
        </View>

        <Section title="Needs attention">
          {attention.length === 0 ? <Text style={styles.empty}>Nothing is blocked or waiting right now.</Text> : attention.map((task) => (
            <TaskRow key={task.id} task={task} accent={campaign.accent} canManage={campaign.canManage} saving={savingId === task.id} team={team} allowAssignment={false} onStatus={changeTaskStatus} onAssign={changeTaskAssignee} />
          ))}
        </Section>

        <Section title="Milestones">
          {campaign.milestones.map((milestone) => (
            <Pressable key={milestone.id} disabled={!campaign.canManage || savingId === milestone.id} style={styles.milestoneRow} onPress={() => void toggleMilestone(milestone.id, !milestone.complete)}>
              <View style={[styles.check, milestone.complete && { backgroundColor: campaign.accent, borderColor: campaign.accent }]}>{savingId === milestone.id ? <ActivityIndicator size="small" color="#0B100D" /> : <Text style={styles.checkText}>{milestone.complete ? '✓' : ''}</Text>}</View>
              <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{milestone.title}</Text><Text style={styles.rowMeta}>{milestone.weight}% of readiness{campaign.canManage ? ' · Tap to update' : ''}</Text></View>
            </Pressable>
          ))}
        </Section>

        <Section title="Work">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip label="All" count={activeTasks.length} active={workFilter === 'all'} onPress={() => setWorkFilter('all')} />
            <FilterChip label="Mine" count={mine.length} active={workFilter === 'mine'} onPress={() => setWorkFilter('mine')} />
            <FilterChip label="Unassigned" count={unassigned.length} active={workFilter === 'unassigned'} onPress={() => setWorkFilter('unassigned')} />
            <FilterChip label="Overdue" count={overdue.length} active={workFilter === 'overdue'} onPress={() => setWorkFilter('overdue')} />
            <FilterChip label="Blocked" count={blocked.length} active={workFilter === 'blocked'} onPress={() => setWorkFilter('blocked')} />
          </ScrollView>
          {filteredTasks.length === 0 ? <Text style={styles.empty}>No work matches this view.</Text> : filteredTasks.map((task) => (
            <TaskRow key={task.id} task={task} accent={campaign.accent} canManage={campaign.canManage} saving={savingId === task.id} team={team} allowAssignment onStatus={changeTaskStatus} onAssign={changeTaskAssignee} />
          ))}
        </Section>

        <Section title="Team">
          {team.length === 0 ? <Text style={styles.empty}>No campaign team members are attached yet.</Text> : team.map((member) => {
            const openCount = activeTasks.filter((task) => task.assigneeProfileId === member.profileId).length;
            return <View key={member.profileId} style={styles.teamRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{member.displayName}</Text><Text style={styles.rowMeta}>{member.role}</Text></View><Text style={styles.teamCount}>{openCount} open</Text></View>;
          })}
        </Section>

        <Section title="Open decisions">
          {openDecisions.length === 0 ? <Text style={styles.empty}>No open decisions.</Text> : openDecisions.map((decision) => (
            <View key={decision.id} style={styles.decisionCard}>
              <Text style={styles.decisionKicker}>DECISION NEEDED · {decision.dueLabel.toUpperCase()}</Text>
              <Text style={styles.rowTitle}>{decision.title}</Text>
              <Text style={styles.rowMeta}>Owner: {decision.owner}</Text>
              {campaign.canManage ? <>
                <TextInput
                  style={styles.decisionInput}
                  value={decisionDrafts[decision.id] ?? ''}
                  onChangeText={(value) => setDecisionDrafts((current) => ({ ...current, [decision.id]: value }))}
                  placeholder="Record the final decision…"
                  placeholderTextColor="#6F7972"
                  multiline
                />
                <Pressable disabled={savingId === decision.id} style={styles.decisionButton} onPress={() => void saveDecision(decision.id)}>
                  {savingId === decision.id ? <ActivityIndicator size="small" color="#172017" /> : <Text style={styles.decisionButtonText}>Mark decided</Text>}
                </Pressable>
              </> : null}
            </View>
          ))}
        </Section>

        <Section title="Campaign pulse">
          <View style={styles.pulseCard}><Text style={styles.pulseTitle}>Marketing</Text><Text style={styles.pulseValue}>{campaign.metrics.marketingNeedsAttention} marketing task{campaign.metrics.marketingNeedsAttention === 1 ? '' : 's'} need attention. Publishing calendar comes next.</Text></View>
          <View style={styles.pulseCard}><Text style={styles.pulseTitle}>Guests</Text><Text style={styles.pulseValue}>{campaign.metrics.capacityLabel}</Text></View>
          <View style={styles.pulseCard}><Text style={styles.pulseTitle}>Budget</Text><Text style={styles.pulseValue}>Budget setup is ready for the next release.</Text></View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function QuickCard({ value, label }: { value: string; label: string }) {
  return <View style={styles.quickCard}><Text style={styles.quickValue}>{value}</Text><Text style={styles.quickLabel}>{label}</Text></View>;
}

function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label} {count}</Text></Pressable>;
}

function TaskRow({ task, accent, canManage, saving, team, allowAssignment, onStatus, onAssign }: { task: CampaignTask; accent: string; canManage: boolean; saving: boolean; team: CampaignTeamMember[]; allowAssignment: boolean; onStatus: (taskId: string, status: CampaignTaskStatus) => Promise<void>; onAssign: (taskId: string, profileId: string | null) => Promise<void> }) {
  const danger = task.status === 'blocked' || task.priority === 'critical';
  const assignee = team.find((member) => member.profileId === task.assigneeProfileId) ?? null;
  return (
    <View style={styles.taskCard}>
      <View style={styles.taskTop}><Text style={[styles.taskStatus, { color: danger ? '#FF8A70' : accent }]}>{statusLabels[task.status].toUpperCase()}</Text><Text style={styles.taskDue}>{task.dueLabel}</Text></View>
      <Text style={styles.rowTitle}>{task.title}</Text>
      <Text style={styles.rowMeta}>{task.category} · Plan owner: {task.owner}</Text>
      <Text style={styles.assigneeText}>Assigned: {assignee?.displayName ?? 'Unassigned'}</Text>
      {task.blockedBy ? <Text style={styles.blockedBy}>Blocked by: {task.blockedBy}</Text> : null}
      {canManage ? (
        <View style={styles.taskActions}>
          {saving ? <ActivityIndicator size="small" color={accent} /> : <>
            {task.status !== 'blocked' && task.status !== 'in_progress' ? <StatusAction label="Start" onPress={() => void onStatus(task.id, 'in_progress')} /> : null}
            {task.status !== 'blocked' && task.status !== 'waiting' ? <StatusAction label="Waiting" onPress={() => void onStatus(task.id, 'waiting')} /> : null}
            {task.status !== 'blocked' && task.status !== 'complete' ? <StatusAction label="Complete" onPress={() => void onStatus(task.id, 'complete')} /> : null}
          </>}
        </View>
      ) : null}
      {canManage && allowAssignment ? (
        <View style={styles.assignmentBlock}>
          <Text style={styles.assignmentLabel}>ASSIGN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignmentRow}>
            <AssignmentChip label="Unassigned" active={!task.assigneeProfileId} onPress={() => void onAssign(task.id, null)} />
            {team.map((member) => <AssignmentChip key={member.profileId} label={member.displayName} active={task.assigneeProfileId === member.profileId} onPress={() => void onAssign(task.id, member.profileId)} />)}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function StatusAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.statusAction} onPress={onPress}><Text style={styles.statusActionText}>{label}</Text></Pressable>;
}

function AssignmentChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.assignmentChip, active && styles.assignmentChipActive]} onPress={onPress}><Text style={[styles.assignmentChipText, active && styles.assignmentChipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 70 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateText: { color: '#8E9891', fontSize: 12 },
  missing: { flex: 1, justifyContent: 'center', padding: 24 },
  back: { color: '#D7B45A', fontWeight: '900', marginBottom: 18 },
  backLink: { color: '#AAB4AD', textAlign: 'center', fontWeight: '800', marginTop: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 },
  meta: { color: '#8E9891', fontSize: 12, lineHeight: 18, marginTop: 6 },
  countdown: { fontSize: 12, fontWeight: '900', letterSpacing: 1.1, marginTop: 12 },
  accessPill: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6, marginTop: 2 },
  accessPillManage: { backgroundColor: '#28371E' },
  accessPillView: { backgroundColor: '#252C28' },
  accessManageText: { color: '#A8CF7A', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  accessViewText: { color: '#9AA49E', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  inlineError: { borderRadius: 12, backgroundColor: '#211715', borderWidth: 1, borderColor: '#684139', padding: 12, marginTop: 12 },
  errorText: { color: '#D7A398', fontSize: 11, lineHeight: 17, marginTop: 7 },
  readinessCard: { backgroundColor: '#151B17', borderRadius: 20, borderWidth: 1, borderColor: '#303A34', padding: 17, marginTop: 18 },
  readinessTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { color: '#AAB4AD', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  readinessValue: { fontSize: 28, fontWeight: '900' },
  readinessNote: { color: '#758079', fontSize: 10, marginTop: 8 },
  progressTrack: { height: 8, borderRadius: 6, backgroundColor: '#252E29', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 6 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  quickCard: { width: '48%', minHeight: 86, backgroundColor: '#121814', borderWidth: 1, borderColor: '#2A342E', borderRadius: 16, padding: 14 },
  quickValue: { color: '#FFF8E8', fontSize: 24, fontWeight: '900' },
  quickLabel: { color: '#87928B', fontSize: 11, fontWeight: '800', marginTop: 4 },
  section: { marginTop: 26 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 9 },
  empty: { color: '#758079', fontSize: 12, lineHeight: 18 },
  filterRow: { gap: 7, paddingBottom: 11 },
  filterChip: { borderRadius: 18, borderWidth: 1, borderColor: '#39433D', backgroundColor: '#111612', paddingHorizontal: 11, paddingVertical: 8 },
  filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#352D18' },
  filterChipText: { color: '#8D9891', fontSize: 10, fontWeight: '900' },
  filterChipTextActive: { color: '#E7C464' },
  taskCard: { borderRadius: 16, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#2B332E', padding: 15, marginBottom: 9 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  taskStatus: { fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  taskDue: { color: '#7D8881', fontSize: 9, fontWeight: '800' },
  rowTitle: { color: '#FFF8E8', fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 5 },
  rowMeta: { color: '#89948D', fontSize: 11, lineHeight: 16, marginTop: 4 },
  assigneeText: { color: '#B9C4BD', fontSize: 11, fontWeight: '800', marginTop: 5 },
  blockedBy: { color: '#C7907E', fontSize: 10.5, lineHeight: 15, marginTop: 7 },
  taskActions: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, minHeight: 31 },
  statusAction: { borderRadius: 10, borderWidth: 1, borderColor: '#3B453F', paddingHorizontal: 10, paddingVertical: 7 },
  statusActionText: { color: '#AAB4AD', fontSize: 9, fontWeight: '900' },
  assignmentBlock: { marginTop: 13, borderTopWidth: 1, borderTopColor: '#263029', paddingTop: 10 },
  assignmentLabel: { color: '#737F77', fontSize: 8, fontWeight: '900', letterSpacing: .8, marginBottom: 7 },
  assignmentRow: { gap: 7 },
  assignmentChip: { borderRadius: 16, borderWidth: 1, borderColor: '#3A443E', backgroundColor: '#101512', paddingHorizontal: 10, paddingVertical: 7 },
  assignmentChipActive: { borderColor: '#64834E', backgroundColor: '#25331E' },
  assignmentChipText: { color: '#8B968F', fontSize: 9, fontWeight: '800' },
  assignmentChipTextActive: { color: '#B8D99E' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#2B332E', padding: 14, marginBottom: 8 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: '#546159', alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#0B100D', fontWeight: '900' },
  teamRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#2B332E', padding: 14, marginBottom: 8 },
  teamCount: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  decisionCard: { borderRadius: 16, backgroundColor: '#1E1A12', borderWidth: 1, borderColor: '#574522', padding: 15, marginBottom: 9 },
  decisionKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  decisionInput: { color: '#FFF8E8', borderRadius: 12, borderWidth: 1, borderColor: '#4E452E', backgroundColor: '#16140F', paddingHorizontal: 12, paddingVertical: 10, minHeight: 72, textAlignVertical: 'top', marginTop: 12 },
  decisionButton: { alignSelf: 'flex-start', minWidth: 112, minHeight: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7B45A', borderRadius: 11, paddingHorizontal: 13, marginTop: 9 },
  decisionButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' },
  pulseCard: { borderRadius: 14, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#2B332E', padding: 14, marginBottom: 8 },
  pulseTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  pulseValue: { color: '#89948D', fontSize: 11, lineHeight: 17, marginTop: 4 },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryButtonText: { color: '#172017', fontWeight: '900' },
});