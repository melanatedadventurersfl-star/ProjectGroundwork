import { supabase } from '../lib/supabase';
import { TASK_PACKS } from './aiPlanner';

export type AiWorkTask = {
  id: string;
  pack: string;
  title: string;
  category: string;
  daysBefore: number;
  priority: 'critical' | 'high' | 'normal';
};

function keyify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task';
}

function dueDate(startsAt: string, daysBefore: number) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - daysBefore);
  return date.toISOString();
}

export function buildAiWorkTasks(packs: string[]): AiWorkTask[] {
  return [...new Set(packs)].flatMap((pack) => (TASK_PACKS[pack] ?? []).map((task, index) => ({
    id: `${pack}:${index}:${keyify(task.title)}`,
    pack,
    title: task.title,
    category: task.category,
    daysBefore: task.daysBefore,
    priority: task.priority ?? 'normal',
  })));
}

export async function addSelectedAiWorkTasks(campaignId: string, startsAt: string, tasks: AiWorkTask[]) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = auth.user?.id;
  if (!profileId) throw new Error('Sign in to add the event work plan.');

  const rows = tasks.map((task, index) => ({
    campaign_id: campaignId,
    task_key: `ai-${task.pack}-${keyify(task.title)}`,
    title: task.title,
    category: task.category,
    owner_label: 'Event owner',
    assignee_profile_id: null,
    due_label: task.daysBefore > 0 ? `${task.daysBefore} days before event` : task.daysBefore === 0 ? 'Event day' : `${Math.abs(task.daysBefore)} day after event`,
    due_at: dueDate(startsAt, task.daysBefore),
    status: 'not_started',
    priority: task.priority,
    sort_order: 700 + index,
    created_by: profileId,
    updated_by: profileId,
  }));
  if (!rows.length) return;
  const { error } = await supabase.from('host_campaign_tasks').upsert(rows, { onConflict: 'campaign_id,task_key', ignoreDuplicates: true });
  if (error) throw error;
}
