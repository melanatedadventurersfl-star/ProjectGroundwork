import { supabase } from '../lib/supabase';
import { transitionHostOuting } from './api';
import { createCampaignWorkspace } from './creation';
import type { HostCampaign } from './campaigns';

export async function duplicateCampaignEvent(campaign: HostCampaign) {
  if (!campaign.canManage) throw new Error('You do not have permission to duplicate this event.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = authData.user?.id;
  if (!profileId) throw new Error('Sign in to duplicate this event.');

  const { data: sourceAdventure, error: sourceError } = await supabase
    .from('adventures')
    .select('title,summary,description,category,difficulty,starts_at,ends_at,city,state,venue_name,capacity,meeting_instructions,hero_image_url,address')
    .eq('id', campaign.adventureId)
    .single();
  if (sourceError) throw sourceError;

  const copyTitle = `${sourceAdventure.title} Copy`;
  const slugBase = copyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'event-copy';
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const { data: copiedAdventure, error: adventureError } = await supabase
    .from('adventures')
    .insert({
      slug,
      title: copyTitle,
      summary: sourceAdventure.summary,
      description: sourceAdventure.description,
      category: sourceAdventure.category,
      difficulty: sourceAdventure.difficulty,
      status: 'draft',
      starts_at: sourceAdventure.starts_at,
      ends_at: sourceAdventure.ends_at,
      city: sourceAdventure.city,
      state: sourceAdventure.state,
      venue_name: sourceAdventure.venue_name,
      capacity: sourceAdventure.capacity,
      spots_remaining: sourceAdventure.capacity,
      meeting_instructions: sourceAdventure.meeting_instructions,
      starting_price_cents: 0,
      hero_image_url: sourceAdventure.hero_image_url,
      address: sourceAdventure.address,
      is_featured: false,
      created_by: profileId,
    })
    .select('id,title,starts_at,ends_at')
    .single();
  if (adventureError) throw adventureError;

  const target = await createCampaignWorkspace({
    adventureId: copiedAdventure.id,
    title: copyTitle,
    location: campaign.location,
    startsAt: copiedAdventure.starts_at,
    endsAt: copiedAdventure.ends_at,
  });

  const { error: campaignPatchError } = await supabase.from('host_campaigns').update({
    short_title: `${campaign.shortTitle} Copy`.slice(0, 80),
    accent: campaign.accent,
    updated_at: new Date().toISOString(),
  }).eq('id', target.id);
  if (campaignPatchError) throw campaignPatchError;

  const [tasksResult, milestonesResult, decisionsResult, dependenciesResult, marketingResult] = await Promise.all([
    supabase.from('host_campaign_tasks').select('id,task_key,title,category,owner_label,due_label,due_at,priority,sort_order').eq('campaign_id', campaign.id).order('sort_order'),
    supabase.from('host_campaign_milestones').select('milestone_key,title,weight,sort_order').eq('campaign_id', campaign.id).order('sort_order'),
    supabase.from('host_campaign_decisions').select('decision_key,title,owner_label,due_label,due_at,sort_order').eq('campaign_id', campaign.id).order('sort_order'),
    supabase.from('host_campaign_task_dependencies').select('task_id,depends_on_task_id').eq('campaign_id', campaign.id),
    supabase.from('host_campaign_marketing_items').select('item_key,title,content_type,platforms,planned_for,copy_text,asset_url,notes').eq('campaign_id', campaign.id).order('planned_for'),
  ]);
  if (tasksResult.error) throw tasksResult.error;
  if (milestonesResult.error) throw milestonesResult.error;
  if (decisionsResult.error) throw decisionsResult.error;
  if (dependenciesResult.error) throw dependenciesResult.error;
  if (marketingResult.error) throw marketingResult.error;

  await supabase.from('host_campaign_milestones').delete().eq('campaign_id', target.id);

  const sourceTasks = tasksResult.data ?? [];
  const taskRows = sourceTasks.map((task) => ({
    campaign_id: target.id,
    task_key: task.task_key,
    title: task.title,
    category: task.category,
    owner_label: task.owner_label,
    assignee_profile_id: null,
    due_label: task.due_label,
    due_at: task.due_at,
    status: 'not_started',
    priority: task.priority,
    sort_order: task.sort_order,
    created_by: profileId,
    updated_by: profileId,
  }));

  const newTaskIdByOld = new Map<string, string>();
  if (taskRows.length) {
    const { data: insertedTasks, error } = await supabase.from('host_campaign_tasks').insert(taskRows).select('id,task_key');
    if (error) throw error;
    const newIdByKey = new Map((insertedTasks ?? []).map((task) => [task.task_key, task.id]));
    sourceTasks.forEach((task) => {
      const newId = newIdByKey.get(task.task_key);
      if (newId) newTaskIdByOld.set(task.id, newId);
    });
  }

  const milestoneRows = (milestonesResult.data ?? []).map((milestone) => ({
    campaign_id: target.id,
    milestone_key: milestone.milestone_key,
    title: milestone.title,
    weight: milestone.weight,
    complete: false,
    sort_order: milestone.sort_order,
  }));
  if (milestoneRows.length) {
    const { error } = await supabase.from('host_campaign_milestones').insert(milestoneRows);
    if (error) throw error;
  }

  const decisionRows = (decisionsResult.data ?? []).map((decision) => ({
    campaign_id: target.id,
    decision_key: decision.decision_key,
    title: decision.title,
    owner_label: decision.owner_label,
    owner_profile_id: null,
    due_label: decision.due_label,
    due_at: decision.due_at,
    status: 'open',
    decision_text: null,
    decided_at: null,
    sort_order: decision.sort_order,
  }));
  if (decisionRows.length) {
    const { error } = await supabase.from('host_campaign_decisions').insert(decisionRows);
    if (error) throw error;
  }

  const dependencyRows = (dependenciesResult.data ?? []).flatMap((dependency) => {
    const taskId = newTaskIdByOld.get(dependency.task_id);
    const dependsOnTaskId = newTaskIdByOld.get(dependency.depends_on_task_id);
    return taskId && dependsOnTaskId ? [{ campaign_id: target.id, task_id: taskId, depends_on_task_id: dependsOnTaskId }] : [];
  });
  if (dependencyRows.length) {
    const { error } = await supabase.from('host_campaign_task_dependencies').insert(dependencyRows);
    if (error) throw error;
  }

  const marketingRows = (marketingResult.data ?? []).map((item) => ({
    campaign_id: target.id,
    item_key: item.item_key,
    title: item.title,
    content_type: item.content_type,
    platforms: item.platforms ?? [],
    planned_for: item.planned_for,
    scheduled_at: null,
    status: 'idea',
    copy_text: item.copy_text,
    asset_url: item.asset_url,
    notes: item.notes,
    owner_profile_id: null,
    source_task_id: null,
    published_at: null,
    created_by: profileId,
    updated_by: profileId,
  }));
  if (marketingRows.length) {
    const { error } = await supabase.from('host_campaign_marketing_items').insert(marketingRows);
    if (error) throw error;
  }

  return target;
}

export async function archiveCampaignWorkspace(campaign: HostCampaign) {
  if (!campaign.canManage) throw new Error('You do not have permission to archive this event.');
  const { error } = await supabase.from('host_campaigns').update({ status: 'complete', updated_at: new Date().toISOString() }).eq('id', campaign.id);
  if (error) throw error;
}

export async function cancelCampaignEvent(campaign: HostCampaign) {
  if (!campaign.canManage) throw new Error('You do not have permission to cancel this event.');
  await transitionHostOuting(campaign.adventureId, 'cancelled');
  const { error } = await supabase.from('host_campaigns').update({ status: 'complete', updated_at: new Date().toISOString() }).eq('id', campaign.id);
  if (error) throw error;
}
