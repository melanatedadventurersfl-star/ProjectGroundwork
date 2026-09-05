import type { CampaignTask, HostCampaign } from './campaigns';

export type WorkTask = CampaignTask & { campaign: HostCampaign };
export type WorkFilter = 'open' | 'blocked' | 'critical' | 'overdue' | 'no_date';

const DAY = 24 * 60 * 60 * 1000;

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

export function openTasksForCampaign(campaign: HostCampaign) {
  return dedupeCampaignTasks(campaign).filter((task) => task.status !== 'complete');
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

export function isTrustworthyDueDate(task: WorkTask) {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt).getTime();
  const start = new Date(task.campaign.startsAt).getTime();
  const end = new Date(task.campaign.endsAt || task.campaign.startsAt).getTime();
  if (!Number.isFinite(due) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  return due >= start - 365 * DAY && due <= end + 30 * DAY;
}

export function isOverdue(task: WorkTask) {
  return isTrustworthyDueDate(task) && Boolean(task.dueAt) && daysFromToday(task.dueAt as string) < 0;
}

export function isDueSoon(task: WorkTask) {
  if (!isTrustworthyDueDate(task) || !task.dueAt) return false;
  const days = daysFromToday(task.dueAt);
  return days >= 0 && days <= 7;
}

export function attentionScore(task: WorkTask) {
  let score = 0;
  if (task.status === 'blocked' && task.priority === 'critical') score += 100;
  else if (task.status === 'blocked') score += 70;
  if (task.priority === 'critical') score += 60;
  if (isOverdue(task)) score += task.priority === 'critical' ? 80 : 50;
  if (isDueSoon(task)) score += 20;
  return score;
}

export function needsAttention(task: WorkTask) {
  return task.status === 'blocked' || task.priority === 'critical' || isOverdue(task) || isDueSoon(task);
}

export function taskTiming(task: WorkTask) {
  if (!task.dueAt || !isTrustworthyDueDate(task)) return 'No date';
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
  if (filter === 'no_date') return tasks.filter((task) => !task.dueAt || !isTrustworthyDueDate(task));
  return tasks;
}

export function campaignProgress(campaign: HostCampaign) {
  const tasks = dedupeCampaignTasks(campaign);
  if (!tasks.length) return 0;
  const complete = tasks.filter((task) => task.status === 'complete').length;
  return Math.round((complete / tasks.length) * 100);
}
