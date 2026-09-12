import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentCampaignProfileId, getHostCampaign, listCampaignTeam, type CampaignTeamMember, type HostCampaign } from './campaigns';
import {
  addMeetingAgendaItem,
  addMeetingDecision,
  addMeetingTask,
  completeMeeting,
  getHostMeeting,
  getMeetingBrief,
  getMeetingLinkedWork,
  listHostMeetings,
  listMeetingAgenda,
  listMeetingAttendees,
  prepareMeetingAgenda,
  saveMeetingNotes,
  updateMeetingAgendaStatus,
  updateMeetingRsvp,
  type HostMeeting,
  type MeetingAgendaItem,
  type MeetingAttendee,
  type MeetingLinkedWork,
  type MeetingResponse,
} from './meetings';
import { AppIcon } from '../ui/AppIcon';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function HostMeetingDetail({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<HostMeeting | null>(null);
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [agenda, setAgenda] = useState<MeetingAgendaItem[]>([]);
  const [linkedWork, setLinkedWork] = useState<MeetingLinkedWork>({ tasks: [], decisions: [] });
  const [team, setTeam] = useState<CampaignTeamMember[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [previousMeeting, setPreviousMeeting] = useState<HostMeeting | null>(null);
  const [notes, setNotes] = useState('');
  const [agendaInput, setAgendaInput] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [taskAssignee, setTaskAssignee] = useState<string | null>(null);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionText, setDecisionText] = useState('');
  const [decisionOwner, setDecisionOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextMeeting = await getHostMeeting(meetingId);
      if (!nextMeeting) throw new Error('Meeting not found.');
      const nextCampaign = await getHostCampaign(nextMeeting.campaignId);
      if (!nextCampaign) throw new Error('Event workspace not found.');
      const [nextAttendees, nextAgenda, nextLinked, nextTeam, profileId, allMeetings] = await Promise.all([
        listMeetingAttendees(meetingId),
        listMeetingAgenda(meetingId),
        getMeetingLinkedWork(meetingId),
        listCampaignTeam(nextCampaign),
        getCurrentCampaignProfileId(),
        listHostMeetings([nextCampaign.id]),
      ]);
      const beforeCurrent = allMeetings
        .filter((item) => item.id !== meetingId && item.status === 'complete' && new Date(item.endsAt).getTime() <= new Date(nextMeeting.startsAt).getTime())
        .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime())[0] ?? null;
      setMeeting(nextMeeting);
      setCampaign(nextCampaign);
      setAttendees(nextAttendees);
      setAgenda(nextAgenda);
      setLinkedWork(nextLinked);
      setTeam(nextTeam);
      setCurrentProfileId(profileId);
      setPreviousMeeting(beforeCurrent);
      setNotes(nextMeeting.notes ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this meeting.');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const brief = useMemo(() => campaign ? getMeetingBrief(campaign, previousMeeting) : null, [campaign, previousMeeting]);
  const currentAttendee = attendees.find((attendee) => attendee.profileId === currentProfileId) ?? null;
  const completedAgenda = agenda.filter((item) => item.status === 'complete').length;
  const taskOwner = team.find((member) => member.profileId === taskAssignee) ?? null;
  const decisionOwnerMember = team.find((member) => member.profileId === decisionOwner) ?? null;

  const run = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError('');
    try {
      await action();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this update.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !meeting) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading meeting…</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace('/host/teams' as never)}><Text style={styles.back}>‹ Teams</Text></Pressable>
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

      {meeting && campaign ? <>
        <View style={styles.hero}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><AppIcon name="calendar" color="#77B9A6" size={24} /></View><View style={[styles.statusPill, meeting.status === 'complete' && styles.completePill]}><Text style={styles.statusText}>{meeting.status.toUpperCase()}</Text></View></View>
          <Text style={styles.eyebrow}>{campaign.shortTitle.toUpperCase()}</Text>
          <Text style={styles.title}>{meeting.title}</Text>
          <Text style={styles.subtitle}>{formatDate(meeting.startsAt)}</Text>
          {meeting.location ? <Text style={styles.meta}>Location: {meeting.location}</Text> : null}
          {meeting.meetingUrl ? <Pressable style={styles.joinButton} onPress={() => void Linking.openURL(meeting.meetingUrl!)}><Text style={styles.joinText}>Open meeting link</Text></Pressable> : null}
          {meeting.recap ? <View style={styles.recapBox}><Text style={styles.recapLabel}>MEETING RECAP</Text><Text style={styles.recapText}>{meeting.recap}</Text></View> : null}
        </View>

        {currentAttendee && meeting.status === 'scheduled' ? <View style={styles.panel}>
          <Text style={styles.sectionKicker}>YOUR RSVP</Text>
          <View style={styles.rsvpRow}>{(['going','maybe','declined'] as MeetingResponse[]).map((response) => <Pressable key={response} style={[styles.rsvpButton, currentAttendee.response === response && styles.rsvpActive]} onPress={() => void run(() => updateMeetingRsvp(meeting.id, response))}><Text style={[styles.rsvpText, currentAttendee.response === response && styles.rsvpTextActive]}>{response === 'declined' ? 'Can’t attend' : response.charAt(0).toUpperCase() + response.slice(1)}</Text></Pressable>)}</View>
        </View> : null}

        {brief ? <View style={styles.panel}>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>TEAM BRIEF</Text><Text style={styles.sectionTitle}>{previousMeeting ? 'Since the last meeting' : 'Event status now'}</Text></View></View>
          <View style={styles.metrics}>
            <Metric value={String(brief.overdueTasks)} label="Overdue" tone={brief.overdueTasks ? 'danger' : 'normal'} />
            <Metric value={String(brief.criticalTasks)} label="Critical" tone={brief.criticalTasks ? 'warning' : 'normal'} />
            <Metric value={String(brief.openDecisions)} label="Decisions" />
            <Metric value={String(brief.unassignedTasks)} label="Unassigned" />
          </View>
          {previousMeeting ? <Text style={styles.helper}>{brief.completedSinceMeeting} completed task{brief.completedSinceMeeting === 1 ? '' : 's'} are recorded since the previous meeting window.</Text> : null}
        </View> : null}

        <View style={styles.panel}>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>AGENDA</Text><Text style={styles.sectionTitle}>{completedAgenda}/{agenda.length} complete</Text></View>{campaign.canManage && meeting.status === 'scheduled' ? <Pressable style={styles.inlineAction} disabled={saving} onPress={() => void run(() => prepareMeetingAgenda(meeting.id, campaign))}><Text style={styles.inlineActionText}>Prepare agenda</Text></Pressable> : null}</View>
          {agenda.length ? <View style={styles.list}>{agenda.map((item, index) => <Pressable key={item.id} onPress={() => void run(() => updateMeetingAgendaStatus(item.id, item.status !== 'complete'))} style={[styles.row, index > 0 && styles.divider]}><View style={[styles.check, item.status === 'complete' && styles.checkComplete]}><Text style={styles.checkText}>{item.status === 'complete' ? '✓' : ''}</Text></View><Text style={[styles.rowTitle, item.status === 'complete' && styles.rowDone]}>{item.title}</Text></Pressable>)}</View> : <Text style={styles.emptyText}>No agenda items yet.</Text>}
          {meeting.status === 'scheduled' ? <View style={styles.addRow}><TextInput value={agendaInput} onChangeText={setAgendaInput} style={styles.input} placeholder="Add agenda item" placeholderTextColor="#667269" /><Pressable style={styles.addButton} disabled={saving} onPress={() => void run(async () => { await addMeetingAgendaItem(meeting.id, agendaInput); setAgendaInput(''); })}><Text style={styles.addButtonText}>Add</Text></Pressable></View> : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>ATTENDEES</Text>
          <Text style={styles.sectionTitle}>{attendees.filter((item) => item.response === 'going').length} going · {attendees.length} invited</Text>
          <View style={styles.people}>{attendees.map((attendee) => <View key={attendee.profileId} style={styles.person}><View style={{ flex: 1 }}><Text style={styles.personName}>{attendee.displayName}</Text><Text style={styles.personMeta}>{team.find((member) => member.profileId === attendee.profileId)?.role ?? 'Team member'}</Text></View><Text style={styles.response}>{attendee.response === 'declined' ? 'CAN’T ATTEND' : attendee.response.toUpperCase()}</Text></View>)}</View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>NOTES</Text>
          <Text style={styles.sectionTitle}>Shared meeting notes</Text>
          <TextInput value={notes} onChangeText={setNotes} multiline style={[styles.input, styles.notes]} placeholder="Capture discussion, context and follow-up here." placeholderTextColor="#667269" />
          {campaign.canManage ? <Pressable style={styles.secondaryButton} disabled={saving} onPress={() => void run(() => saveMeetingNotes(meeting.id, notes))}><Text style={styles.secondaryText}>Save notes</Text></Pressable> : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>DECISIONS</Text>
          <Text style={styles.sectionTitle}>What changed because of this meeting</Text>
          {linkedWork.decisions.length ? <View style={styles.list}>{linkedWork.decisions.map((decision, index) => <View key={decision.id} style={[styles.workRow, index > 0 && styles.divider]}><Text style={styles.workLabel}>DECIDED</Text><Text style={styles.rowTitle}>{decision.title}</Text><Text style={styles.workText}>{decision.decisionText}</Text><Text style={styles.rowMeta}>Owner: {decision.owner}</Text></View>)}</View> : <Text style={styles.emptyText}>No decisions recorded from this meeting.</Text>}
          {campaign.canManage && meeting.status === 'scheduled' ? <View style={styles.formBlock}>
            <TextInput value={decisionTitle} onChangeText={setDecisionTitle} style={styles.input} placeholder="Decision topic" placeholderTextColor="#667269" />
            <TextInput value={decisionText} onChangeText={setDecisionText} style={[styles.input, styles.decisionInput]} placeholder="What was decided?" placeholderTextColor="#667269" multiline />
            <Text style={styles.fieldLabel}>Owner</Text>
            <View style={styles.chips}>{team.map((member) => <Pressable key={member.profileId} onPress={() => setDecisionOwner(decisionOwner === member.profileId ? null : member.profileId)} style={[styles.chip, decisionOwner === member.profileId && styles.chipActive]}><Text style={[styles.chipText, decisionOwner === member.profileId && styles.chipTextActive]}>{member.displayName}</Text></Pressable>)}</View>
            <Pressable style={styles.secondaryButton} disabled={saving} onPress={() => void run(async () => { await addMeetingDecision({ meetingId: meeting.id, campaignId: campaign.id, title: decisionTitle, decisionText, ownerLabel: decisionOwnerMember?.displayName, ownerProfileId: decisionOwner }); setDecisionTitle(''); setDecisionText(''); setDecisionOwner(null); })}><Text style={styles.secondaryText}>Record decision</Text></Pressable>
          </View> : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>FOLLOW-UP</Text>
          <Text style={styles.sectionTitle}>Tasks created from this meeting</Text>
          {linkedWork.tasks.length ? <View style={styles.list}>{linkedWork.tasks.map((task, index) => <Pressable key={task.id} style={[styles.workRow, index > 0 && styles.divider]} onPress={() => router.push(`/host/campaigns/${campaign.slug}/tasks/${task.id}` as never)}><Text style={styles.workLabel}>{task.status.replaceAll('_', ' ').toUpperCase()}</Text><Text style={styles.rowTitle}>{task.title}</Text><Text style={styles.rowMeta}>{task.owner}</Text></Pressable>)}</View> : <Text style={styles.emptyText}>No follow-up tasks created yet.</Text>}
          {campaign.canManage && meeting.status === 'scheduled' ? <View style={styles.formBlock}>
            <TextInput value={taskInput} onChangeText={setTaskInput} style={styles.input} placeholder="Add follow-up task" placeholderTextColor="#667269" />
            <Text style={styles.fieldLabel}>Assign to</Text>
            <View style={styles.chips}>{team.map((member) => <Pressable key={member.profileId} onPress={() => setTaskAssignee(taskAssignee === member.profileId ? null : member.profileId)} style={[styles.chip, taskAssignee === member.profileId && styles.chipActive]}><Text style={[styles.chipText, taskAssignee === member.profileId && styles.chipTextActive]}>{member.displayName}</Text></Pressable>)}</View>
            <Pressable style={styles.secondaryButton} disabled={saving} onPress={() => void run(async () => { await addMeetingTask({ meetingId: meeting.id, campaignId: campaign.id, title: taskInput, assigneeProfileId: taskAssignee, ownerLabel: taskOwner?.displayName }); setTaskInput(''); setTaskAssignee(null); })}><Text style={styles.secondaryText}>Create task</Text></Pressable>
          </View> : null}
        </View>

        {campaign.canManage && meeting.status === 'scheduled' ? <Pressable style={styles.completeButton} disabled={saving} onPress={() => void run(() => completeMeeting(meeting.id))}><Text style={styles.completeText}>{saving ? 'Saving…' : 'Complete Meeting + Create Recap'}</Text></Pressable> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ value, label, tone = 'normal' }: { value: string; label: string; tone?: 'normal' | 'warning' | 'danger' }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, tone === 'warning' && styles.warning, tone === 'danger' && styles.danger]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  content: { padding: 18, paddingBottom: 72 },
  back: { color: '#D7B45A', fontWeight: '900', marginBottom: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9 },
  muted: { color: '#849087', fontSize: 10 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#6F3D37', backgroundColor: '#281817', padding: 12, marginBottom: 12 },
  error: { color: '#F0A599', fontSize: 10, lineHeight: 15 },
  hero: { borderRadius: 22, borderWidth: 1, borderColor: '#2E3A33', backgroundColor: '#141D17', padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#77B9A622', alignItems: 'center', justifyContent: 'center' },
  statusPill: { borderRadius: 999, backgroundColor: '#D7B45A22', paddingHorizontal: 9, paddingVertical: 6 },
  completePill: { backgroundColor: '#77B9A622' },
  statusText: { color: '#D7D4C4', fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  eyebrow: { color: '#77B9A6', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 13 },
  title: { color: '#FFF8E8', fontSize: 26, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#A3AEA6', fontSize: 10, lineHeight: 15, marginTop: 6 },
  meta: { color: '#7F8B83', fontSize: 9, marginTop: 4 },
  joinButton: { minHeight: 42, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  joinText: { color: '#172017', fontSize: 10, fontWeight: '900' },
  recapBox: { borderRadius: 12, borderWidth: 1, borderColor: '#77B9A644', backgroundColor: '#77B9A611', padding: 11, marginTop: 12 },
  recapLabel: { color: '#77B9A6', fontSize: 7, fontWeight: '900', letterSpacing: .8 },
  recapText: { color: '#DCE8E0', fontSize: 9, lineHeight: 14, marginTop: 4 },
  panel: { borderRadius: 17, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111914', padding: 14, marginTop: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionKicker: { color: '#77B9A6', fontSize: 8, fontWeight: '900', letterSpacing: .9 },
  sectionTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', marginTop: 2 },
  helper: { color: '#79857D', fontSize: 8, lineHeight: 12, marginTop: 9 },
  metrics: { flexDirection: 'row', gap: 6, marginTop: 11 },
  metric: { flex: 1, minHeight: 60, borderRadius: 11, backgroundColor: '#0D140F', alignItems: 'center', justifyContent: 'center', padding: 6 },
  metricValue: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  metricLabel: { color: '#6F7C73', fontSize: 7, marginTop: 2 },
  warning: { color: '#E8C36A' },
  danger: { color: '#EA806E' },
  inlineAction: { borderRadius: 9, borderWidth: 1, borderColor: '#77B9A655', paddingHorizontal: 9, paddingVertical: 7 },
  inlineActionText: { color: '#90CCBA', fontSize: 8, fontWeight: '900' },
  list: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2A352F', marginTop: 10 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A352F' },
  check: { width: 19, height: 19, borderRadius: 6, borderWidth: 1, borderColor: '#445149', alignItems: 'center', justifyContent: 'center' },
  checkComplete: { backgroundColor: '#77B9A6', borderColor: '#77B9A6' },
  checkText: { color: '#0A0F0C', fontSize: 10, fontWeight: '900' },
  rowTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '800', flex: 1 },
  rowDone: { color: '#78837C', textDecorationLine: 'line-through' },
  addRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  input: { minHeight: 43, flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#334139', backgroundColor: '#0D140F', color: '#FFF8E8', paddingHorizontal: 10, fontSize: 10 },
  addButton: { minWidth: 58, borderRadius: 10, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#172017', fontSize: 9, fontWeight: '900' },
  people: { marginTop: 9, gap: 6 },
  person: { minHeight: 48, borderRadius: 10, backgroundColor: '#0D140F', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  personName: { color: '#E9F0EA', fontSize: 9, fontWeight: '900' },
  personMeta: { color: '#718077', fontSize: 7, marginTop: 2, textTransform: 'capitalize' },
  response: { color: '#87A696', fontSize: 7, fontWeight: '900' },
  rsvpRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  rsvpButton: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#35423A', alignItems: 'center', justifyContent: 'center' },
  rsvpActive: { borderColor: '#77B9A6', backgroundColor: '#77B9A622' },
  rsvpText: { color: '#819087', fontSize: 8, fontWeight: '900' },
  rsvpTextActive: { color: '#A6DBC9' },
  notes: { minHeight: 130, marginTop: 10, textAlignVertical: 'top', paddingTop: 10 },
  secondaryButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#77B9A655', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: '#98CDBB', fontSize: 9, fontWeight: '900' },
  workRow: { minHeight: 64, padding: 10 },
  workLabel: { color: '#77B9A6', fontSize: 7, fontWeight: '900', letterSpacing: .6, marginBottom: 3 },
  workText: { color: '#B7C3BB', fontSize: 9, lineHeight: 13, marginTop: 4 },
  rowMeta: { color: '#6F7C73', fontSize: 8, marginTop: 3 },
  emptyText: { color: '#718077', fontSize: 9, lineHeight: 13, marginTop: 9 },
  formBlock: { marginTop: 12, gap: 8 },
  decisionInput: { minHeight: 78, textAlignVertical: 'top', paddingTop: 10 },
  fieldLabel: { color: '#87938B', fontSize: 8, fontWeight: '800', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#35423A', paddingHorizontal: 9, paddingVertical: 7 },
  chipActive: { borderColor: '#D7B45A', backgroundColor: '#D7B45A22' },
  chipText: { color: '#809087', fontSize: 8, fontWeight: '800' },
  chipTextActive: { color: '#F0D47F' },
  completeButton: { minHeight: 48, borderRadius: 13, backgroundColor: '#77B9A6', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  completeText: { color: '#0B1510', fontSize: 10, fontWeight: '900' },
});