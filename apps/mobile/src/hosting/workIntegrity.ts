export type IntegrityTaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'blocked' | 'review' | 'complete';

export type IntegrityCampaign = {
  id: string;
  title?: string;
  shortTitle?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
};

export type IntegrityTask = {
  id: string;
  taskKey?: string;
  title: string;
  category: string;
  dueLabel?: string | null;
  dueAt?: string | null;
  status: IntegrityTaskStatus;
  priority?: 'critical' | 'high' | 'normal';
};

export type TimingKind = 'calendar' | 'relative' | 'dependency' | 'unscheduled' | 'review';
export type EventDateState = 'valid' | 'review';

const DAY = 24 * 60 * 60 * 1000;
export const PLANNING_DAYS_BEFORE = 180;
export const PLANNING_DAYS_AFTER = 14;
export const MAX_NORMAL_EVENT_SPAN_DAYS = 31;

export function normalizeWorkText(value: string | null | undefined) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dayStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function eventIdentityKey(campaign: IntegrityCampaign) {
  return [
    normalizeWorkText(campaign.shortTitle || campaign.title),
    normalizeWorkText(campaign.location),
    dayStamp(campaign.startsAt),
    dayStamp(campaign.endsAt),
  ].join('|');
}

export function assessEventDates(campaign: IntegrityCampaign) {
  const start = new Date(campaign.startsAt).getTime();
  const rawEnd = new Date(campaign.endsAt || campaign.startsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(rawEnd)) {
    return { state: 'review' as EventDateState, spanDays: null as number | null, effectiveStart: start, effectiveEnd: start, reason: 'Event dates are invalid.' };
  }
  const spanDays = Math.max(0, Math.round((rawEnd - start) / DAY));
  if (rawEnd < start) {
    return { state: 'review' as EventDateState, spanDays, effectiveStart: start, effectiveEnd: start, reason: 'Event end date is before the start date.' };
  }
  if (spanDays > MAX_NORMAL_EVENT_SPAN_DAYS) {
    return { state: 'review' as EventDateState, spanDays, effectiveStart: start, effectiveEnd: start, reason: `Event spans ${spanDays} days. Review the start and end dates.` };
  }
  return { state: 'valid' as EventDateState, spanDays, effectiveStart: start, effectiveEnd: rawEnd, reason: null as string | null };
}

export function isRelativeEventTimingLabel(labelValue: string | null | undefined) {
  const label = normalizeWorkText(labelValue);
  if (!label) return false;
  return /\b\d+\s+days?\s+(before|after)\s+(the\s+)?event\b/.test(label)
    || /\b(day|week|weeks)\s+(before|after)\s+(the\s+)?event\b/.test(label)
    || /\bevent\s+(day|week)\b/.test(label);
}

export function isDependencyTimingLabel(labelValue: string | null | undefined) {
  const label = normalizeWorkText(labelValue);
  if (!label || label === 'no due date' || label === 'date not set') return false;
  if (isRelativeEventTimingLabel(label)) return false;
  return /\b(after|before|when|once|upon|awaiting|pending)\b/.test(label);
}

export function isTrustworthyCalendarDate(task: IntegrityTask, campaign: IntegrityCampaign) {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt).getTime();
  const dates = assessEventDates(campaign);
  if (!Number.isFinite(due) || !Number.isFinite(dates.effectiveStart) || !Number.isFinite(dates.effectiveEnd)) return false;
  return due >= dates.effectiveStart - PLANNING_DAYS_BEFORE * DAY && due <= dates.effectiveEnd + PLANNING_DAYS_AFTER * DAY;
}

export function timingKind(task: IntegrityTask, campaign: IntegrityCampaign): TimingKind {
  if (isRelativeEventTimingLabel(task.dueLabel)) {
    return task.dueAt && isTrustworthyCalendarDate(task, campaign) ? 'relative' : 'review';
  }
  if (isDependencyTimingLabel(task.dueLabel)) return 'dependency';
  if (task.dueAt) return isTrustworthyCalendarDate(task, campaign) ? 'calendar' : 'review';
  return 'unscheduled';
}

export function daysFromToday(iso: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const date = new Date(iso);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((target - today) / DAY);
}

export function isIntegrityOverdue(task: IntegrityTask, campaign: IntegrityCampaign, now = new Date()) {
  const kind = timingKind(task, campaign);
  if ((kind !== 'calendar' && kind !== 'relative') || !task.dueAt) return false;
  return daysFromToday(task.dueAt, now) < 0;
}

export function needsIntegrityScheduling(task: IntegrityTask, campaign: IntegrityCampaign) {
  const kind = timingKind(task, campaign);
  return kind === 'unscheduled' || kind === 'review';
}

function canonicalTaskRank(task: IntegrityTask) {
  if (task.status === 'complete') return 1000;
  let score = 0;
  if (task.status === 'blocked') score += 500;
  if (task.priority === 'critical') score += 250;
  else if (task.priority === 'high') score += 100;
  if (task.status === 'in_progress') score += 80;
  if (task.status === 'review') score += 60;
  if (task.status === 'waiting') score += 40;
  if (task.dueAt) score += 10;
  return score;
}

export function dedupeIntegrityTasks<T extends IntegrityTask>(tasks: T[]) {
  const byTaskKey = new Set<string>();
  const semantic = new Map<string, T>();

  for (const task of tasks) {
    const taskKey = normalizeWorkText(task.taskKey);
    if (taskKey && byTaskKey.has(taskKey)) continue;
    if (taskKey) byTaskKey.add(taskKey);

    const semanticKey = `${normalizeWorkText(task.title)}|${normalizeWorkText(task.category)}`;
    const current = semantic.get(semanticKey);
    if (!current || canonicalTaskRank(task) > canonicalTaskRank(current)) semantic.set(semanticKey, task);
  }

  return Array.from(semantic.values());
}

export function integrityTaskProgress(tasks: IntegrityTask[]) {
  const canonical = dedupeIntegrityTasks(tasks);
  if (!canonical.length) return 0;
  const complete = canonical.filter((task) => task.status === 'complete').length;
  return Math.round((complete / canonical.length) * 100);
}

export function integrityOperationsSummary(campaign: IntegrityCampaign, tasks: IntegrityTask[], now = new Date()) {
  const canonical = dedupeIntegrityTasks(tasks);
  const complete = canonical.filter((task) => task.status === 'complete').length;
  const open = canonical.filter((task) => task.status !== 'complete');
  return {
    taskCount: canonical.length,
    completeTaskCount: complete,
    openTaskCount: open.length,
    overdueTaskCount: open.filter((task) => isIntegrityOverdue(task, campaign, now)).length,
    needsSchedulingCount: open.filter((task) => needsIntegrityScheduling(task, campaign)).length,
    progress: canonical.length ? Math.round((complete / canonical.length) * 100) : 0,
    dateAssessment: assessEventDates(campaign),
  };
}
