import { supabase } from '../lib/supabase';

export type CampaignTaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'blocked' | 'review' | 'complete';
export type CampaignTaskPriority = 'critical' | 'high' | 'normal';

export type CampaignTask = {
  id: string;
  taskKey: string;
  title: string;
  category: string;
  owner: string;
  assigneeProfileId: string | null;
  dueLabel: string;
  dueAt: string | null;
  status: CampaignTaskStatus;
  priority: CampaignTaskPriority;
  blockedBy?: string;
};

export type CampaignMilestone = {
  id: string;
  milestoneKey: string;
  title: string;
  weight: number;
  complete: boolean;
};

export type CampaignDecision = {
  id: string;
  decisionKey: string;
  title: string;
  owner: string;
  ownerProfileId: string | null;
  dueLabel: string;
  dueAt: string | null;
  status: 'open' | 'decided';
  decisionText: string | null;
};

export type CampaignTeamMember = {
  profileId: string;
  displayName: string;
  role: string;
  isOwner: boolean;
};

export type HostCampaign = {
  id: string;
  adventureId: string;
  slug: string;
  ownerProfileId: string;
  title: string;
  shortTitle: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: 'planning' | 'live' | 'complete';
  accent: string;
  heroImageUrl: string | null;
  canManage: boolean;
  tasks: CampaignTask[];
  milestones: CampaignMilestone[];
  decisions: CampaignDecision[];
  metrics: {
    attendees: number;
    capacityLabel: string;
    scheduledMarketing: number;
    marketingNeedsAttention: number;
    budgetCommitted: number;
    budgetRemaining: number;
  };
};

export type CampaignDetailsUpdate = {
  title: string;
  shortTitle: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: HostCampaign['status'];
  heroImageUrl: string | null;
};

type CampaignRow = {
  id: string;
  adventure_id: string;
  slug: string;
  owner_profile_id: string;
  title: string;
  short_title: string;
  location: string;
  starts_at: string;
  ends_at: string;
  status: HostCampaign['status'];
  accent: string;
};

type TaskRow = {
  id: string;
  task_key: string;
  title: string;
  category: string;
  owner_label: string;
  assignee_profile_id: string | null;
  due_label: string;
  due_at: string | null;
  status: CampaignTaskStatus;
  priority: CampaignTaskPriority;
  sort_order: number;
};

type MilestoneRow = {
  id: string;
  milestone_key: string;
  title: string;
  weight: number;
  complete: boolean;
  sort_order: number;
};

type DecisionRow = {
  id: string;
  decision_key: string;
  title: string;
  owner_label: string;
  owner_profile_id: string | null;
  due_label: string;
  due_at: string | null;
  status: 'open' | 'decided';
  decision_text: string | null;
  sort_order: number;
};

type DependencyRow = {
  task_id: string;
  depends_on_task_id: string;
};

type StaffRow = {
  profile_id: string;
  role: string;
};

type DirectoryRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

export async function listHostCampaigns(): Promise<HostCampaign[]> {
  const { data, error } = await supabase
    .from('host_campaigns')
    .select('id,adventure_id,slug,owner_profile_id,title,short_title,location,starts_at,ends_at,status,accent')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => hydrateCampaign(row as CampaignRow)));
}

export async function getHostCampaign(idOrSlug: string): Promise<HostCampaign | null> {
  let query = supabase
    .from('host_campaigns')
    .select('id,adventure_id,slug,owner_profile_id,title,short_title,location,starts_at,ends_at,status,accent');

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
  query = isUuid ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? hydrateCampaign(data as CampaignRow) : null;
}

async function hydrateCampaign(row: CampaignRow): Promise<HostCampaign> {
  const [tasksResult, milestonesResult, decisionsResult, dependenciesResult, adventureResult, manageResult] = await Promise.all([
    supabase.from('host_campaign_tasks').select('id,task_key,title,category,owner_label,assignee_profile_id,due_label,due_at,status,priority,sort_order').eq('campaign_id', row.id).order('sort_order'),
    supabase.from('host_campaign_milestones').select('id,milestone_key,title,weight,complete,sort_order').eq('campaign_id', row.id).order('sort_order'),
    supabase.from('host_campaign_decisions').select('id,decision_key,title,owner_label,owner_profile_id,due_label,due_at,status,decision_text,sort_order').eq('campaign_id', row.id).order('sort_order'),
    supabase.from('host_campaign_task_dependencies').select('task_id,depends_on_task_id').eq('campaign_id', row.id),
    supabase.from('adventures').select('capacity,spots_remaining,hero_image_url').eq('id', row.adventure_id).maybeSingle(),
    resolveCanManage(row),
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (milestonesResult.error) throw milestonesResult.error;
  if (decisionsResult.error) throw decisionsResult.error;
  if (dependenciesResult.error) throw dependenciesResult.error;
  if (adventureResult.error) throw adventureResult.error;

  const rawTasks = (tasksResult.data ?? []) as TaskRow[];
  const taskTitleById = new Map(rawTasks.map((task) => [task.id, task.title]));
  const blockedByByTask = new Map<string, string>();
  for (const dependency of (dependenciesResult.data ?? []) as DependencyRow[]) {
    const blocker = taskTitleById.get(dependency.depends_on_task_id);
    if (blocker) blockedByByTask.set(dependency.task_id, blocker);
  }

  const capacity = adventureResult.data?.capacity ?? null;
  const spotsRemaining = adventureResult.data?.spots_remaining ?? null;
  const attendees = capacity !== null && spotsRemaining !== null ? Math.max(0, capacity - spotsRemaining) : 0;
  const capacityLabel = capacity !== null && spotsRemaining !== null
    ? `${attendees} registered · ${spotsRemaining} spots remaining`
    : 'Ticket capacity sync pending';

  return {
    id: row.id,
    adventureId: row.adventure_id,
    slug: row.slug,
    ownerProfileId: row.owner_profile_id,
    title: row.title,
    shortTitle: row.short_title,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    accent: row.accent,
    heroImageUrl: adventureResult.data?.hero_image_url ?? null,
    canManage: manageResult,
    tasks: rawTasks.map((task) => ({
      id: task.id,
      taskKey: task.task_key,
      title: task.title,
      category: task.category,
      owner: task.owner_label,
      assigneeProfileId: task.assignee_profile_id,
      dueLabel: task.due_label,
      dueAt: task.due_at,
      status: task.status,
      priority: task.priority,
      blockedBy: blockedByByTask.get(task.id),
    })),
    milestones: ((milestonesResult.data ?? []) as MilestoneRow[]).map((milestone) => ({
      id: milestone.id,
      milestoneKey: milestone.milestone_key,
      title: milestone.title,
      weight: milestone.weight,
      complete: milestone.complete,
    })),
    decisions: ((decisionsResult.data ?? []) as DecisionRow[]).map((decision) => ({
      id: decision.id,
      decisionKey: decision.decision_key,
      title: decision.title,
      owner: decision.owner_label,
      ownerProfileId: decision.owner_profile_id,
      dueLabel: decision.due_label,
      dueAt: decision.due_at,
      status: decision.status,
      decisionText: decision.decision_text,
    })),
    metrics: {
      attendees,
      capacityLabel,
      scheduledMarketing: 0,
      marketingNeedsAttention: rawTasks.filter((task) => task.category === 'Marketing' && task.status !== 'complete').length,
      budgetCommitted: 0,
      budgetRemaining: 0,
    },
  };
}

async function resolveCanManage(row: CampaignRow) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return false;
  if (userId === row.owner_profile_id) return true;

  const [adminResult, leadResult] = await Promise.all([
    supabase.rpc('is_platform_admin'),
    supabase.from('adventure_staff_assignments').select('id').eq('adventure_id', row.adventure_id).eq('profile_id', userId).eq('role', 'lead').limit(1),
  ]);
  return adminResult.data === true || (!leadResult.error && (leadResult.data?.length ?? 0) > 0);
}

export async function updateCampaignDetails(campaign: HostCampaign, input: CampaignDetailsUpdate) {
  if (!campaign.canManage) throw new Error('You do not have permission to edit this event.');
  const title = input.title.trim();
  const shortTitle = input.shortTitle.trim();
  const location = input.location.trim();
  if (!title || !shortTitle || !location) throw new Error('Title, short title, and location are required.');
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error('Enter valid start and end dates.');
  if (endsAt.getTime() < startsAt.getTime()) throw new Error('End date must be after the start date.');

  const { error: campaignError } = await supabase.from('host_campaigns').update({
    title,
    short_title: shortTitle,
    location,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: input.status,
    updated_at: new Date().toISOString(),
  }).eq('id', campaign.id);
  if (campaignError) throw campaignError;

  const { error: adventureError } = await supabase.from('adventures').update({
    title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    hero_image_url: input.heroImageUrl?.trim() || null,
  }).eq('id', campaign.adventureId);
  if (adventureError) throw adventureError;
}

export async function getCurrentCampaignProfileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function listCampaignTeam(campaign: HostCampaign): Promise<CampaignTeamMember[]> {
  const staffResult = await supabase
    .from('adventure_staff_assignments')
    .select('profile_id,role')
    .eq('adventure_id', campaign.adventureId);
  if (staffResult.error) throw staffResult.error;

  const staff = (staffResult.data ?? []) as StaffRow[];
  const ids = Array.from(new Set([campaign.ownerProfileId, ...staff.map((member) => member.profile_id)]));
  if (ids.length === 0) return [];

  const directoryResult = await supabase
    .from('profile_directory')
    .select('id,display_name,username')
    .in('id', ids);
  if (directoryResult.error) throw directoryResult.error;

  const directory = new Map(((directoryResult.data ?? []) as DirectoryRow[]).map((profile) => [profile.id, profile]));
  const staffRole = new Map(staff.map((member) => [member.profile_id, member.role]));

  return ids.map((profileId) => {
    const profile = directory.get(profileId);
    const isOwner = profileId === campaign.ownerProfileId;
    return {
      profileId,
      displayName: profile?.display_name?.trim() || profile?.username?.trim() || (isOwner ? 'Campaign owner' : 'Team member'),
      role: isOwner ? 'Campaign owner' : (staffRole.get(profileId) ?? 'staff').replaceAll('_', ' '),
      isOwner,
    };
  });
}

export async function assignCampaignTask(taskId: string, assigneeProfileId: string | null) {
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('host_campaign_tasks')
    .update({ assignee_profile_id: assigneeProfileId, updated_by: authData.user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

export async function updateCampaignTaskStatus(taskId: string, status: CampaignTaskStatus) {
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('host_campaign_tasks')
    .update({ status, updated_by: authData.user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

export async function updateCampaignMilestone(milestoneId: string, complete: boolean) {
  const { error } = await supabase
    .from('host_campaign_milestones')
    .update({ complete, updated_at: new Date().toISOString() })
    .eq('id', milestoneId);
  if (error) throw error;
}

export async function decideCampaignDecision(decisionId: string, decisionText: string) {
  const trimmed = decisionText.trim();
  if (!trimmed) throw new Error('Add the decision before marking it decided.');
  const { error } = await supabase
    .from('host_campaign_decisions')
    .update({ status: 'decided', decision_text: trimmed, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', decisionId);
  if (error) throw error;
}

export function getCampaignReadiness(campaign: HostCampaign) {
  const totalWeight = campaign.milestones.reduce((sum, milestone) => sum + milestone.weight, 0);
  if (!totalWeight) return 0;
  const completedWeight = campaign.milestones.filter((milestone) => milestone.complete).reduce((sum, milestone) => sum + milestone.weight, 0);
  return Math.round((completedWeight / totalWeight) * 100);
}

export function getCampaignDaysUntil(campaign: HostCampaign, now = new Date()) {
  const event = new Date(campaign.startsAt);
  const diff = event.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
