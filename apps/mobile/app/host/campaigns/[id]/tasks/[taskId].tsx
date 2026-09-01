import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const statusOptions: { value: CampaignTaskStatus; label: string; help: string }[] = [
  { value: 'not_started', label: 'Not Started', help: 'Ready to work on.' },
  { value: 'in_progress', label: 'In Progress', help: 'Someone is actively working on it.' },
  { value: 'waiting', label: 'Waiting', help: 'Waiting on another person or outside response.' },
  { value: 'blocked', label: 'Blocked', help: 'Cannot proceed until another item is resolved.' },
  { value: 'review', label: 'Ready for Review', help: 'Work is done and needs approval.' },
  { value: 'complete', label: 'Complete', help: 'Finished.' },
];

export default function CampaignTaskDetailScreen() {
  const params = useLocalSearchParams<{ id: string; taskId: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<'status' | 'assignee' | null>(null);

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
    setPicker(null);
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
    setPicker(null);
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
  const statusLabel = statusOptions.find((option) => option.value === task.status)?.label ?? task.status;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ {campaign.shortTitle}</Text></Pressable><Text style={styles.headerLabel}>TASK</Text></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.status, blocked && styles.blocked]}>{statusLabel.toUpperCase()}</Text>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.meta}>{task.category}</Text>
        <Text style={styles.meta}>Plan owner: {task.owner}</Text>

        <View style={styles.infoRow}>
          <Info label="Due" value={task.dueLabel || 'No due date'} />
          <Info label="Assigned" value={assignee?.displayName ?? 'Unassigned'} />
        </View>

        {task.blockedBy ? <View style={styles.blockerCard}><Text style={styles.sectionLabel}>DEPENDENCY</Text><Text style={styles.blockerText}>Blocked by {task.blockedBy}</Text></View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <Text style={styles.body}>Status, assignment, due date, ownership and dependency information are stored with this event task.</Text>
        </View>

        {campaign.canManage ? <View style={styles.controls}>
          <Pressable style={styles.controlRow} onPress={() => setPicker('status')} disabled={saving}>
            <View><Text style={styles.controlLabel}>STATUS</Text><Text style={styles.controlValue}>{statusLabel}</Text></View><Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={styles.controlRow} onPress={() => setPicker('assignee')} disabled={saving}>
            <View><Text style={styles.controlLabel}>ASSIGNED TO</Text><Text style={styles.controlValue}>{assignee?.displayName ?? 'Unassigned'}</Text></View><Text style={styles.chevron}>›</Text>
          </Pressable>
          {saving ? <ActivityIndicator style={styles.saving} color="#D7B45A" /> : null}
        </View> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{picker === 'status' ? 'Change status' : 'Assign task'}</Text>
            {picker === 'status' ? statusOptions.map((option) => (
              <Pressable key={option.value} style={styles.optionRow} onPress={() => void changeStatus(option.value)}>
                <View style={{ flex: 1 }}><Text style={styles.optionTitle}>{option.label}</Text><Text style={styles.optionHelp}>{option.help}</Text></View>
                {task.status === option.value ? <Text style={styles.selected}>✓</Text> : null}
              </Pressable>
            )) : <>
              <Pressable style={styles.optionRow} onPress={() => void assign(null)}><Text style={styles.optionTitle}>Unassigned</Text>{!task.assigneeProfileId ? <Text style={styles.selected}>✓</Text> : null}</Pressable>
              {team.map((member) => <Pressable key={member.profileId} style={styles.optionRow} onPress={() => void assign(member.profileId)}><View style={{ flex: 1 }}><Text style={styles.optionTitle}>{member.displayName}</Text><Text style={styles.optionHelp}>{member.isOwner ? 'Event owner' : member.role}</Text></View>{task.assigneeProfileId === member.profileId ? <Text style={styles.selected}>✓</Text> : null}</Pressable>)}
            </>}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

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
  controls: { marginTop: 24, borderRadius: 16, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', overflow: 'hidden' },
  controlRow: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' },
  controlLabel: { color: '#77827B', fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  controlValue: { color: '#F4F1E8', fontSize: 14, fontWeight: '800', marginTop: 4 },
  chevron: { color: '#D7B45A', fontSize: 24 },
  saving: { marginVertical: 12 },
  error: { color: '#FF8A80', fontSize: 12, marginTop: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.58)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '78%', backgroundColor: '#121814', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, borderWidth: 1, borderColor: '#2F3933' },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#47514B', marginBottom: 13 },
  sheetTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  optionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' },
  optionTitle: { color: '#F4F1E8', fontSize: 14, fontWeight: '800' },
  optionHelp: { color: '#849087', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  selected: { color: '#A8CF55', fontSize: 18, fontWeight: '900' },
});