import type { CampaignTask, HostCampaign } from './campaigns';

export type WorkTask = CampaignTask & { campaign: HostCampaign };
export type WorkFilter = 'open' | 'blocked' | 'critical' | 'overdue' | 'no_date';
export type WorkDueState = 'scheduled' | 'dependency' | 'unscheduled' | 'review';

const DAY = 24 * 60 * 60 * 1000;
const PLANNING_DAYS_BEFORE = 180;
const PLANNING_DAYS_AFTER = 14;

export function normalizeTaskText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function dedupeCampaignTasks(campaign: HostCampaign) {
  const seen = new Set<string>();
  return campaign.tasks.filter((task) => {
    const key = `${campaign.id}|${task.taskKey || `${normalizeTaskText(task.title)}|${normalizeTaskText(task.category)}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function allTasksForCampaign(campaign: HostCampaign) {
  return dedupeCampaignTasks(campaign);
}

export function openTasksForCampaign(campaign: HostCampaign) {
  return allTasksForCampaign(campaign).filter((task) => task.status !== 'complete');
}

export function flattenAllTasks(campaigns: HostCampaign[]): WorkTask[] {
  return campaigns.flatMap((campaign) => allTasksForCampaign(campaign).map((task) => ({ ...task, campaign })));
}

export function flattenOpenTasks(campaigns: HostCampaign[]): WorkTask[] {
  return campaigns.flatMap((campaign) => openTasksForCampaign(campaign).map((task) => ({ ...task, campaign })));
}

export function daysFromToday(iso: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const date = new Date(iso);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((target - today) / DAY);
}

export function hasDependencyTiming(task: Pick<CampaignTask, 'dueAt' | 'dueLabel'>) {
  if (task.dueAt) return false;
  const label = normalizeTaskText(task.dueLabel || '');
  if (!label || label === 'no due date' || label === 'date not set') return false;
  return /\b(after|before|when|once|upon|awaiting|pending)\b/.test(label);
}

export function isTrustworthyDueDate(task: WorkTask) {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt).getTime();
  const start = new Date(task.campaign.startsAt).getTime();
  const end = new Date(task.campaign.endsAt || task.campaign.startsAt).getTime();
  if (!Number.isFinite(due) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  return due >= start - PLANNING_DAYS_BEFORE * DAY && due <= end + PLANNING_DAYS_AFTER * DAY;
}

export function dueState(task: WorkTask): WorkDueState {
  if (task.dueAt) return isTrustworthyDueDate(task) ? 'scheduled' : 'review';
  if (hasDependencyTiming(task)) return 'dependency';
  return 'unscheduled';
}

export function needsScheduling(task: WorkTask) {
  const state = dueState(task);
  return state === 'unscheduled' || state === 'review';
}

export function isOverdue(task: WorkTask) {
  return dueState(task) === 'scheduled' && Boolean(task.dueAt) && daysFromToday(task.dueAt as string) < 0;
}

export function isDueSoon(task: WorkTask) {
  if (dueState(task) !== 'scheduled' || !task.dueAt) return false;
  const days = daysFromToday(task.dueAt);
  return days >= 0 && days <= 7;
}

export function attentionScore(task: WorkTask) {
  let score = 0;
  if (task.status === 'blocked' && task.priority === 'critical') score += 120;
  else if (task.status === 'blocked') score += 80;
  if (task.priority === 'critical') score += 70;
  if (isOverdue(task)) score += task.priority === 'critical' ? 90 : 55;
  if (isDueSoon(task)) score += 20;
  return score;
}

export function needsAttention(task: WorkTask) {
  return task.status === 'blocked' || task.priority === 'critical' || isOverdue(task) || isDueSoon(task);
}

export function taskTiming(task: WorkTask) {
  const state = dueState(task);
  if (state === 'dependency') return task.dueLabel || 'Dependency timing';
  if (state === 'review') return 'Review date';
  if (state === 'unscheduled') return 'Needs scheduling';
  if (!task.dueAt) return 'Needs scheduling';
  const days = daysFromToday(task.dueAt);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${new Date(task.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function filterTasks(tasks: WorkTask[], filter: WorkFilter) {
  if (filter === 'blocked') return tasks.filter((task) => task.status === 'blocked');
  if (filter === 'critical') return tasks.filter((task) => task.priority === 'critical');
  if (filter === 'overdue') return tasks.filter(isOverdue);
  if (filter === 'no_date') return tasks.filter(needsScheduling);
  return tasks;
}

export function campaignProgress(campaign: HostCampaign) {
  const tasks = allTasksForCampaign(campaign);
  if (!tasks.length) return 0;
  const complete = tasks.filter((task) => task.status === 'complete').length;
  return Math.round((complete / tasks.length) * 100);
}
