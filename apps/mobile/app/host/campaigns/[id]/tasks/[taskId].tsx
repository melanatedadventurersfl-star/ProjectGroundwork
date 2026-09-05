import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { assignCampaignTask, getHostCampaign, listCampaignTeam, updateCampaignTaskStatus, type CampaignTaskPriority, type CampaignTaskStatus, type CampaignTeamMember, type HostCampaign } from '../../../../../src/hosting/campaigns';
import { supabase } from '../../../../../src/lib/supabase';

const statusOptions: { value: CampaignTaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' }, { value: 'in_progress', label: 'In Progress' }, { value: 'waiting', label: 'Waiting' }, { value: 'blocked', label: 'Blocked' }, { value: 'review', label: 'Ready for Review' }, { value: 'complete', label: 'Complete' },
];
const priorityOptions: { value: CampaignTaskPriority; label: string }[] = [
  { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'normal', label: 'Normal' },
];

export default function CampaignTaskDetailScreen() {
  const params = useLocalSearchParams<{ id: string; taskId: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<'status' | 'assignee' | 'priority' | 'due' | null>(null);
  const [dueInput, setDueInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const next = await getHostCampaign(String(params.id)); setCampaign(next); setTeam(next ? await listCampaignTeam(next) : []); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load task.'); }
    finally { setLoading(false); }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const task = campaign?.tasks.find((item) => item.id === String(params.taskId));
  const assignee = team.find((member) => member.profileId === task?.assigneeProfileId) ?? null;

  async function changeStatus(status: CampaignTaskStatus) { if (!task) return; setPicker(null); setSaving(true); try { await updateCampaignTaskStatus(task.id, status); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update task.'); } finally { setSaving(false); } }
  async function assign(profileId: string | null) { if (!task) return; setPicker(null); setSaving(true); try { await assignCampaignTask(task.id, profileId); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to assign task.'); } finally { setSaving(false); } }
  async function changePriority(priority: CampaignTaskPriority) { if (!task) return; setPicker(null); setSaving(true); const { error: updateError } = await supabase.from('host_campaign_tasks').update({ priority }).eq('id', task.id); if (updateError) setError(updateError.message); else await load(); setSaving(false); }
  async function saveDueDate() { if (!task) return; const value = dueInput.trim(); const parsed = value ? new Date(`${value}T17:00:00`) : null; if (value && (!parsed || Number.isNaN(parsed.getTime()))) { setError('Use YYYY-MM-DD for the due date.'); return; } setSaving(true); const { error: updateError } = await supabase.from('host_campaign_tasks').update({ due_at: parsed?.toISOString() ?? null, due_label: parsed ? `Due ${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No due date' }).eq('id', task.id); if (updateError) setError(updateError.message); else { setPicker(null); await load(); } setSaving(false); }

  if (loading && !task) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /></View></SafeAreaView>;
  if (!campaign || !task) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Task unavailable</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable></View></SafeAreaView>;

  const statusLabel = statusOptions.find((option) => option.value === task.status)?.label ?? task.status;

  return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ {campaign.shortTitle}</Text></Pressable><Text style={styles.headerLabel}>TASK</Text></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={[styles.status, task.status === 'blocked' && styles.blocked]}>{statusLabel.toUpperCase()}</Text><Text style={styles.title}>{task.title}</Text><Text style={styles.event}>{campaign.shortTitle}</Text>
    <View style={styles.infoGrid}><Info label="Work Area" value={task.category} /><Info label="Priority" value={task.priority} /><Info label="Due" value={task.dueLabel || 'No due date'} /><Info label="Assigned" value={assignee?.displayName ?? 'Unassigned'} /></View>
    <View style={styles.ownerCard}><Text style={styles.label}>PLAN OWNER</Text><Text style={styles.value}>{task.owner}</Text></View>
    {task.blockedBy ? <View style={styles.blocker}><Text style={styles.label}>DEPENDENCY</Text><Text style={styles.blockerText}>Blocked by {task.blockedBy}</Text></View> : null}
    {campaign.canManage ? <View style={styles.controls}><Control label="Status" value={statusLabel} onPress={() => setPicker('status')} /><Control label="Assigned To" value={assignee?.displayName ?? 'Unassigned'} onPress={() => setPicker('assignee')} /><Control label="Priority" value={task.priority} onPress={() => setPicker('priority')} /><Control label="Due Date" value={task.dueLabel || 'No due date'} onPress={() => { setDueInput(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ''); setPicker('due'); }} /></View> : null}
    {saving ? <ActivityIndicator style={{ marginTop: 18 }} color="#D7B45A" /> : null}{error ? <Text style={styles.error}>{error}</Text> : null}
  </ScrollView>

  <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}><Pressable style={styles.backdrop} onPress={() => setPicker(null)}><Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}><View style={styles.handle} /><Text style={styles.sheetTitle}>{picker === 'status' ? 'Change status' : picker === 'assignee' ? 'Assign task' : picker === 'priority' ? 'Change priority' : 'Set due date'}</Text>
    {picker === 'status' ? statusOptions.map((option) => <Pressable key={option.value} style={styles.option} onPress={() => void changeStatus(option.value)}><Text style={styles.optionText}>{option.label}</Text>{task.status === option.value ? <Text style={styles.selected}>✓</Text> : null}</Pressable>) : null}
    {picker === 'assignee' ? <><Pressable style={styles.option} onPress={() => void assign(null)}><Text style={styles.optionText}>Unassigned</Text>{!task.assigneeProfileId ? <Text style={styles.selected}>✓</Text> : null}</Pressable>{team.map((member) => <Pressable key={member.profileId} style={styles.option} onPress={() => void assign(member.profileId)}><Text style={styles.optionText}>{member.displayName}</Text>{task.assigneeProfileId === member.profileId ? <Text style={styles.selected}>✓</Text> : null}</Pressable>)}</> : null}
    {picker === 'priority' ? priorityOptions.map((option) => <Pressable key={option.value} style={styles.option} onPress={() => void changePriority(option.value)}><Text style={styles.optionText}>{option.label}</Text>{task.priority === option.value ? <Text style={styles.selected}>✓</Text> : null}</Pressable>) : null}
    {picker === 'due' ? <><TextInput value={dueInput} onChangeText={setDueInput} placeholder="YYYY-MM-DD" placeholderTextColor="#6F7B74" style={styles.input} /><View style={styles.dueActions}><Pressable style={styles.secondary} onPress={() => { setDueInput(''); void saveDueDate(); }}><Text style={styles.secondaryText}>Clear date</Text></Pressable><Pressable style={styles.primary} onPress={() => void saveDueDate()}><Text style={styles.primaryText}>Save date</Text></Pressable></View></> : null}
  </Pressable></Pressable></Modal>
  </SafeAreaView>;
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
function Control({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <Pressable style={styles.control} onPress={onPress}><View><Text style={styles.label}>{label}</Text><Text style={styles.controlValue}>{value}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, header: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222C26' }, back: { color: '#D7B45A', fontSize: 10, fontWeight: '900' }, headerLabel: { color: '#737F77', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 8 }, content: { padding: 18, paddingBottom: 70 }, status: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 }, blocked: { color: '#FF6974' }, title: { color: '#FFF8E8', fontSize: 27, lineHeight: 32, fontWeight: '900', marginTop: 6 }, event: { color: '#A990ED', fontSize: 10, fontWeight: '800', marginTop: 7 }, infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }, info: { width: '48.5%', borderRadius: 13, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 11 }, label: { color: '#77827B', fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase' }, value: { color: '#F4F1E8', fontSize: 11, fontWeight: '800', marginTop: 4, textTransform: 'capitalize' }, ownerCard: { marginTop: 8, borderRadius: 13, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', padding: 11 }, blocker: { marginTop: 8, borderRadius: 13, borderWidth: 1, borderColor: '#633B43', backgroundColor: '#211417', padding: 12 }, blockerText: { color: '#FF9CA5', fontSize: 10, fontWeight: '800', marginTop: 5 }, controls: { marginTop: 18, borderRadius: 15, borderWidth: 1, borderColor: '#2B352F', backgroundColor: '#131A16', overflow: 'hidden' }, control: { minHeight: 58, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' }, controlValue: { color: '#F4F1E8', fontSize: 12, fontWeight: '800', marginTop: 3, textTransform: 'capitalize' }, chevron: { color: '#D7B45A', fontSize: 20 }, error: { color: '#FF8A80', fontSize: 10, marginTop: 14 }, backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.58)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#121814', borderTopLeftRadius: 23, borderTopRightRadius: 23, padding: 18, paddingBottom: 28, borderWidth: 1, borderColor: '#2F3933' }, handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#47514B', marginBottom: 12 }, sheetTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginBottom: 8 }, option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' }, optionText: { color: '#F4F1E8', fontSize: 12, fontWeight: '800' }, selected: { color: '#A8CF55', fontSize: 16, fontWeight: '900' }, input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#0F1511', color: '#FFF8E8', paddingHorizontal: 12, marginTop: 5 }, dueActions: { flexDirection: 'row', gap: 8, marginTop: 10 }, secondary: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#39463E', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#AAB4AE', fontSize: 9, fontWeight: '900' }, primary: { flex: 1.5, minHeight: 42, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#172017', fontSize: 9, fontWeight: '900' } });
