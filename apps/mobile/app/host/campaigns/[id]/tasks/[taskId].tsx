import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  assignCampaignTask,
  getHostCampaign,
  listCampaignTeam,
  updateCampaignTaskStatus,
  type CampaignTaskStatus,
  type CampaignTeamMember,
  type HostCampaign,
} from '../../../../../src/hosting/campaigns';

export default function CampaignTaskDetailScreen() {
  const params = useLocalSearchParams<{ id: string; taskId: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await getHostCampaign(String(params.id));
      setCampaign(next);
      setTeam(next ? await listCampaignTeam(next) : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load task.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const task = campaign?.tasks.find((item) => item.id === String(params.taskId));
  const assignee = team.find((member) => member.profileId === task?.assigneeProfileId) ?? null;

  async function changeStatus(status: CampaignTaskStatus) {
    if (!task) return;
    setSaving(true);
    setError('');
    try {
      await updateCampaignTaskStatus(task.id, status);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update task.');
    } finally {
      setSaving(false);
    }
  }

  async function assign(profileId: string | null) {
    if (!task) return;
    setSaving(true);
    setError('');
    try {
      await assignCampaignTask(task.id, profileId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to assign task.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !task) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading task…</Text></View></SafeAreaView>;
  if (!campaign || !task) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Task unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable></View></SafeAreaView>;

  const blocked = task.status === 'blocked';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ {campaign.shortTitle}</Text></Pressable><Text style={styles.headerLabel}>TASK</Text></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.status, blocked && styles.blocked]}>{task.status.replace('_', ' ').toUpperCase()}</Text>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.meta}>{task.category}</Text>
        <Text style={styles.meta}>Plan owner: {task.owner}</Text>

        <View style={styles.infoRow}>
          <Info label="Due" value={task.dueLabel || 'No due date'} />
          <Info label="Assigned" value={assignee?.displayName ?? 'Unassigned'} />
        </View>

        {task.blockedBy ? <View style={styles.blockerCard}><Text style={styles.sectionLabel}>DEPENDENCY</Text><Text style={styles.blockerText}>Blocked by {task.blockedBy}</Text></View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <Text style={styles.body}>Use this task page for execution details, notes, dependencies and assignment. The campaign record currently stores the task title, category, owner, due date, status and dependency relationship.</Text>
        </View>

        {campaign.canManage ? <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ASSIGN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Unassigned" active={!task.assigneeProfileId} onPress={() => void assign(null)} />
              {team.map((member) => <Chip key={member.profileId} label={member.displayName} active={task.assigneeProfileId === member.profileId} onPress={() => void assign(member.profileId)} />)}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>STATUS</Text>
            {saving ? <ActivityIndicator color="#D7B45A" /> : <View style={styles.actions}>
              {!blocked && task.status !== 'in_progress' ? <Action label="Start" onPress={() => void changeStatus('in_progress')} /> : null}
              {!blocked && task.status !== 'waiting' ? <Action label="Waiting" onPress={() => void changeStatus('waiting')} /> : null}
              {!blocked && task.status !== 'complete' ? <Action label="Complete" primary onPress={() => void changeStatus('complete')} /> : null}
            </View>}
          </View>
        </> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function Action({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.action, primary && styles.actionPrimary]}><Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  header: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222C26' },
  back: { color: '#CBD4CE', fontSize: 12, fontWeight: '800' },
  headerLabel: { color: '#737F77', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  content: { padding: 18, paddingBottom: 70 },
  status: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  blocked: { color: '#FF6974' },
  title: { color: '#FFF8E8', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 6 },
  meta: { color: '#9AA59E', fontSize: 12, marginTop: 5 },
  muted: { color: '#8E9891', fontSize: 12 },
  infoRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  info: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 13 },
  infoLabel: { color: '#77827B', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: '#F4F1E8', fontSize: 12, fontWeight: '800', marginTop: 5 },
  blockerCard: { borderRadius: 14, borderWidth: 1, borderColor: '#633B43', backgroundColor: '#211417', padding: 14, marginTop: 16 },
  blockerText: { color: '#FF9CA5', fontSize: 12, fontWeight: '800', marginTop: 6 },
  section: { marginTop: 24 },
  sectionLabel: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  body: { color: '#B1BAB4', fontSize: 13, lineHeight: 20, marginTop: 8 },
  chips: { gap: 7, paddingTop: 10 },
  chip: { borderRadius: 17, borderWidth: 1, borderColor: '#39433D', paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { borderColor: '#5E8B57', backgroundColor: '#213321' },
  chipText: { color: '#8D9891', fontSize: 10, fontWeight: '900' },
  chipTextActive: { color: '#B8D99E' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  action: { borderRadius: 11, borderWidth: 1, borderColor: '#465149', paddingHorizontal: 13, paddingVertical: 10 },
  actionPrimary: { backgroundColor: '#A8CF55', borderColor: '#A8CF55' },
  actionText: { color: '#C7D0CA', fontSize: 10, fontWeight: '900' },
  actionTextPrimary: { color: '#172017' },
  error: { color: '#FF8A80', fontSize: 12, marginTop: 16 },
});