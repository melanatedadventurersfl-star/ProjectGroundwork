import type { CampaignTask, HostCampaign } from './campaigns';
import {
  assessEventDates,
  daysFromToday as integrityDaysFromToday,
  dedupeIntegrityTasks,
  eventIdentityKey,
  integrityTaskProgress,
  isDependencyTimingLabel,
  isIntegrityOverdue,
  isRelativeEventTimingLabel,
  isTrustworthyCalendarDate,
  needsIntegrityScheduling,
  normalizeWorkText,
  timingKind,
  type TimingKind,
} from './workIntegrity';

export type WorkTask = CampaignTask & { campaign: HostCampaign };
export type WorkFilter = 'open' | 'blocked' | 'critical' | 'overdue' | 'no_date';
export type WorkDueState = TimingKind;

export function normalizeTaskText(value: string) {
  return normalizeWorkText(value);
}

export function dedupeCampaignTasks(campaign: HostCampaign) {
  return dedupeIntegrityTasks(campaign.tasks);
}

export function canonicalCampaigns(campaigns: HostCampaign[]): HostCampaign[] {
  const groups = new Map<string, HostCampaign[]>();
  for (const campaign of campaigns) {
    const key = eventIdentityKey(campaign);
    const group = groups.get(key) ?? [];
    group.push(campaign);
    groups.set(key, group);
  }

  return Array.from(groups.values()).flatMap((group) => {
    const sorted = [...group].sort((a, b) => {
      const manage = Number(b.canManage) - Number(a.canManage);
      if (manage) return manage;
      return b.tasks.length - a.tasks.length;
    });
    const selected = sorted[0];
    return selected ? [selected] : [];
  });
}

export function duplicateCampaignCount(campaign: HostCampaign, campaigns: HostCampaign[]) {
  const key = eventIdentityKey(campaign);
  return Math.max(0, campaigns.filter((item) => eventIdentityKey(item) === key).length - 1);
}

export function campaignDateAssessment(campaign: HostCampaign) {
  return assessEventDates(campaign);
}

export function allTasksForCampaign(campaign: HostCampaign) {
  return dedupeCampaignTasks(campaign);
}

export function openTasksForCampaign(campaign: HostCampaign) {
  return allTasksForCampaign(campaign).filter((task) => task.status !== 'complete');
}

export function flattenAllTasks(campaigns: HostCampaign[]): WorkTask[] {
  return canonicalCampaigns(campaigns).flatMap((campaign) => allTasksForCampaign(campaign).map((task) => ({ ...task, campaign })));
}

export function flattenOpenTasks(campaigns: HostCampaign[]): WorkTask[] {
  return canonicalCampaigns(campaigns).flatMap((campaign) => openTasksForCampaign(campaign).map((task) => ({ ...task, campaign })));
}

export function daysFromToday(iso: string) {
  return integrityDaysFromToday(iso);
}

export function hasRelativeTiming(task: Pick<CampaignTask, 'dueAt' | 'dueLabel'>) {
  return isRelativeEventTimingLabel(task.dueLabel);
}

export function hasDependencyTiming(task: Pick<CampaignTask, 'dueAt' | 'dueLabel'>) {
  return isDependencyTimingLabel(task.dueLabel);
}

export function isTrustworthyDueDate(task: WorkTask) {
  return isTrustworthyCalendarDate(task, task.campaign);
}

export function dueState(task: WorkTask): WorkDueState {
  return timingKind(task, task.campaign);
}

export function needsScheduling(task: WorkTask) {
  return needsIntegrityScheduling(task, task.campaign);
}

export function isOverdue(task: WorkTask) {
  return isIntegrityOverdue(task, task.campaign);
}

export function isDueSoon(task: WorkTask) {
  const state = dueState(task);
  if ((state !== 'calendar' && state !== 'relative') || !task.dueAt) return false;
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
  const date = new Date(task.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (state === 'relative') {
    const label = task.dueLabel || 'Relative schedule';
    if (days < 0) return `${label} · ${Math.abs(days)}d overdue`;
    if (days === 0) return `${label} · today`;
    return `${label} · ${date}`;
  }
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${date}`;
}

export function filterTasks(tasks: WorkTask[], filter: WorkFilter) {
  if (filter === 'blocked') return tasks.filter((task) => task.status === 'blocked');
  if (filter === 'critical') return tasks.filter((task) => task.priority === 'critical');
  if (filter === 'overdue') return tasks.filter(isOverdue);
  if (filter === 'no_date') return tasks.filter(needsScheduling);
  return tasks;
}

export function campaignProgress(campaign: HostCampaign) {
  return integrityTaskProgress(campaign.tasks);
}
