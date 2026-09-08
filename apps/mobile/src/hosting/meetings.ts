import { supabase } from '../lib/supabase';
import type { HostCampaign } from './campaigns';

export type MeetingStatus = 'scheduled' | 'complete' | 'cancelled';
export type MeetingResponse = 'invited' | 'going' | 'maybe' | 'declined';

export type HostMeeting = {
  id: string;
  campaignId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  meetingUrl: string | null;
  status: MeetingStatus;
  notes: string;
  recap: string | null;
  createdBy: string | null;
};

export type MeetingAttendee = {
  profileId: string;
  displayName: string;
  response: MeetingResponse;
  required: boolean;
};

export type MeetingAgendaItem = {
  id: string;
  title: string;
  status: 'open' | 'complete';
  sortOrder: number;
};

export type MeetingLinkedWork = {
  tasks: Array<{ id: string; title: string; owner: string; status: string }>;
  decisions: Array<{ id: string; title: string; owner: string; status: string; decisionText: string | null }>;
};

export type MeetingBrief = {
  overdueTasks: number;
  criticalTasks: number;
  unassignedTasks: number;
  openDecisions: number;
  completedSinceMeeting: number;
};

type MeetingRow = {
  id: string;
  campaign_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  status: MeetingStatus;
  notes: string;
  recap: string | null;
  created_by: string | null;
};

function mapMeeting(row: MeetingRow): HostMeeting {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    meetingUrl: row.meeting_url,
    status: row.status,
    notes: row.notes ?? '',
    recap: row.recap,
    createdBy: row.created_by,
  };
}

export async function listHostMeetings(campaignIds?: string[]): Promise<HostMeeting[]> {
  if (campaignIds && campaignIds.length === 0) return [];
  let query = supabase
    .from('host_campaign_meetings')
    .select('id,campaign_id,title,starts_at,ends_at,location,meeting_url,status,notes,recap,created_by')
    .order('starts_at', { ascending: true });
  if (campaignIds?.length) query = query.in('campaign_id', campaignIds);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as MeetingRow[]).map(mapMeeting);
}

export async function getHostMeeting(meetingId: string): Promise<HostMeeting | null> {
  const { data, error } = await supabase
    .from('host_campaign_meetings')
    .select('id,campaign_id,title,starts_at,ends_at,location,meeting_url,status,notes,recap,created_by')
    .eq('id', meetingId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMeeting(data as MeetingRow) : null;
}

export async function createHostMeeting(input: {
  campaignId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  meetingUrl?: string | null;
  attendeeProfileIds: string[];
}) {
  const title = input.title.trim();
  if (!title) throw new Error('Add a meeting title.');
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error('Enter valid meeting start and end times.');
  if (endsAt.getTime() <= startsAt.getTime()) throw new Error('Meeting end time must be after the start time.');

  const { data: authData } = await supabase.auth.getUser();
  const profileId = authData.user?.id ?? null;
  const { data, error } = await supabase.from('host_campaign_meetings').insert({
    campaign_id: input.campaignId,
    title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    location: input.location?.trim() || null,
    meeting_url: input.meetingUrl?.trim() || null,
    created_by: profileId,
    updated_by: profileId,
  }).select('id,campaign_id,title,starts_at,ends_at,location,meeting_url,status,notes,recap,created_by').single();
  if (error) throw error;

  const attendeeIds = Array.from(new Set(input.attendeeProfileIds.filter(Boolean)));
  if (attendeeIds.length) {
    const { error: attendeeError } = await supabase.from('host_campaign_meeting_attendees').insert(
      attendeeIds.map((attendeeProfileId) => ({ meeting_id: data.id, profile_id: attendeeProfileId, response: attendeeProfileId === profileId ? 'going' : 'invited' })),
    );
    if (attendeeError) throw attendeeError;
  }

  return mapMeeting(data as MeetingRow);
}

export async function listMeetingAttendees(meetingId: string): Promise<MeetingAttendee[]> {
  const { data, error } = await supabase
    .from('host_campaign_meeting_attendees')
    .select('profile_id,response,required')
    .eq('meeting_id', meetingId);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((row) => row.profile_id);
  if (!ids.length) return [];

  const { data: directory, error: directoryError } = await supabase
    .from('profile_directory')
    .select('id,display_name,username')
    .in('id', ids);
  if (directoryError) throw directoryError;
  const names = new Map((directory ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.username?.trim() || 'Team member']));

  return rows.map((row) => ({
    profileId: row.profile_id,
    displayName: names.get(row.profile_id) ?? 'Team member',
    response: row.response as MeetingResponse,
    required: row.required,
  }));
}

export async function updateMeetingRsvp(meetingId: string, response: MeetingResponse) {
  const { data: authData } = await supabase.auth.getUser();
  const profileId = authData.user?.id;
  if (!profileId) throw new Error('Sign in to respond to this meeting.');
  const { error } = await supabase.from('host_campaign_meeting_attendees').update({
    response,
    responded_at: new Date().toISOString(),
  }).eq('meeting_id', meetingId).eq('profile_id', profileId);
  if (error) throw error;
}

export async function listMeetingAgenda(meetingId: string): Promise<MeetingAgendaItem[]> {
  const { data, error } = await supabase
    .from('host_campaign_meeting_agenda_items')
    .select('id,title,status,sort_order')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, status: row.status, sortOrder: row.sort_order }));
}

export async function addMeetingAgendaItem(meetingId: string, title: string, sortOrder?: number) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Add an agenda item first.');
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase.from('host_campaign_meeting_agenda_items').insert({
    meeting_id: meetingId,
    title: trimmed,
    sort_order: sortOrder ?? Date.now(),
    created_by: authData.user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateMeetingAgendaStatus(itemId: string, complete: boolean) {
  const { error } = await supabase.from('host_campaign_meeting_agenda_items').update({
    status: complete ? 'complete' : 'open',
    updated_at: new Date().toISOString(),
  }).eq('id', itemId);
  if (error) throw error;
}

export async function prepareMeetingAgenda(meetingId: string, campaign: HostCampaign) {
  const now = Date.now();
  const suggestions: string[] = [];
  for (const decision of campaign.decisions.filter((item) => item.status === 'open').slice(0, 3)) {
    suggestions.push(`Decision needed: ${decision.title}`);
  }
  const priorityTasks = campaign.tasks
    .filter((task) => task.status !== 'complete')
    .filter((task) => task.priority === 'critical' || task.priority === 'high' || (task.dueAt ? new Date(task.dueAt).getTime() < now : false))
    .slice(0, 5);
  for (const task of priorityTasks) suggestions.push(`Work check: ${task.title}`);
  if (!suggestions.length) suggestions.push('Team updates and blockers', 'Upcoming deadlines', 'Open questions');

  const existing = await listMeetingAgenda(meetingId);
  const existingTitles = new Set(existing.map((item) => item.title.toLowerCase()));
  const newItems = suggestions.filter((title) => !existingTitles.has(title.toLowerCase()));
  if (!newItems.length) return 0;

  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase.from('host_campaign_meeting_agenda_items').insert(
    newItems.map((title, index) => ({
      meeting_id: meetingId,
      title,
      sort_order: (existing.length + index + 1) * 10,
      created_by: authData.user?.id ?? null,
    })),
  );
  if (error) throw error;
  return newItems.length;
}

export async function saveMeetingNotes(meetingId: string, notes: string) {
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase.from('host_campaign_meetings').update({
    notes,
    updated_by: authData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', meetingId);
  if (error) throw error;
}

export async function addMeetingTask(input: {
  meetingId: string;
  campaignId: string;
  title: string;
  assigneeProfileId?: string | null;
  ownerLabel?: string;
}) {
  const title = input.title.trim();
  if (!title) throw new Error('Add a task first.');
  const { data: authData } = await supabase.auth.getUser();
  const profileId = authData.user?.id ?? null;
  const stamp = Date.now().toString(36);
  const { error } = await supabase.from('host_campaign_tasks').insert({
    campaign_id: input.campaignId,
    task_key: `meeting-${stamp}`,
    title,
    category: 'Meeting Follow-up',
    owner_label: input.ownerLabel?.trim() || 'Unassigned',
    assignee_profile_id: input.assigneeProfileId ?? null,
    due_label: 'Meeting follow-up',
    status: 'not_started',
    priority: 'normal',
    sort_order: Date.now(),
    source_meeting_id: input.meetingId,
    created_by: profileId,
    updated_by: profileId,
  });
  if (error) throw error;
}

export async function addMeetingDecision(input: {
  meetingId: string;
  campaignId: string;
  title: string;
  decisionText: string;
  ownerLabel?: string;
  ownerProfileId?: string | null;
}) {
  const title = input.title.trim();
  const decisionText = input.decisionText.trim();
  if (!title || !decisionText) throw new Error('Add both the decision topic and the final decision.');
  const stamp = Date.now().toString(36);
  const { error } = await supabase.from('host_campaign_decisions').insert({
    campaign_id: input.campaignId,
    decision_key: `meeting-${stamp}`,
    title,
    owner_label: input.ownerLabel?.trim() || 'Team',
    owner_profile_id: input.ownerProfileId ?? null,
    due_label: 'Decided in meeting',
    status: 'decided',
    decision_text: decisionText,
    decided_at: new Date().toISOString(),
    sort_order: Date.now(),
    source_meeting_id: input.meetingId,
  });
  if (error) throw error;
}

export async function getMeetingLinkedWork(meetingId: string): Promise<MeetingLinkedWork> {
  const [tasksResult, decisionsResult] = await Promise.all([
    supabase.from('host_campaign_tasks').select('id,title,owner_label,status').eq('source_meeting_id', meetingId),
    supabase.from('host_campaign_decisions').select('id,title,owner_label,status,decision_text').eq('source_meeting_id', meetingId),
  ]);
  if (tasksResult.error) throw tasksResult.error;
  if (decisionsResult.error) throw decisionsResult.error;
  return {
    tasks: (tasksResult.data ?? []).map((row) => ({ id: row.id, title: row.title, owner: row.owner_label, status: row.status })),
    decisions: (decisionsResult.data ?? []).map((row) => ({ id: row.id, title: row.title, owner: row.owner_label, status: row.status, decisionText: row.decision_text })),
  };
}

export function getMeetingBrief(campaign: HostCampaign, previousMeeting?: HostMeeting | null): MeetingBrief {
  const now = Date.now();
  const previousEnd = previousMeeting ? new Date(previousMeeting.endsAt).getTime() : 0;
  return {
    overdueTasks: campaign.tasks.filter((task) => task.status !== 'complete' && task.dueAt && new Date(task.dueAt).getTime() < now).length,
    criticalTasks: campaign.tasks.filter((task) => task.status !== 'complete' && task.priority === 'critical').length,
    unassignedTasks: campaign.tasks.filter((task) => task.status !== 'complete' && !task.assigneeProfileId).length,
    openDecisions: campaign.decisions.filter((decision) => decision.status === 'open').length,
    completedSinceMeeting: previousEnd > 0
      ? campaign.tasks.filter((task) => task.status === 'complete' && task.dueAt && new Date(task.dueAt).getTime() >= previousEnd).length
      : campaign.tasks.filter((task) => task.status === 'complete').length,
  };
}

export async function completeMeeting(meetingId: string) {
  const [agenda, linked] = await Promise.all([listMeetingAgenda(meetingId), getMeetingLinkedWork(meetingId)]);
  const completedAgenda = agenda.filter((item) => item.status === 'complete').length;
  const recap = `${linked.decisions.length} decision${linked.decisions.length === 1 ? '' : 's'} · ${linked.tasks.length} follow-up task${linked.tasks.length === 1 ? '' : 's'} · ${completedAgenda}/${agenda.length} agenda items complete`;
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase.from('host_campaign_meetings').update({
    status: 'complete',
    recap,
    updated_by: authData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', meetingId);
  if (error) throw error;
  return recap;
}
