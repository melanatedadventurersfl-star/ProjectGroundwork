import { supabase } from '../lib/supabase';
import { buildClientPlannerFallback } from './aiPlannerFallback';

export type AiPrivacyPreferences = {
  personal_memory_enabled: boolean;
  event_history_learning_enabled: boolean;
  organization_memory_enabled: boolean;
  save_conversations_enabled: boolean;
  product_analytics_enabled: boolean;
  recommendation_history_enabled: boolean;
};

export type AiPlanState = {
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  difficulty?: 'easy' | 'moderate' | 'challenging';
  startsAt?: string;
  endsAt?: string;
  venueName?: string;
  city?: string;
  state?: string;
  capacity?: number;
  meetingInstructions?: string;
  paid?: boolean;
  priceCents?: number;
  components?: string[];
  requirements?: string[];
  safetyNotes?: string[];
  backupPlan?: string;
};

export type AiPlannerTurn = {
  message: string;
  plan: AiPlanState;
  readiness: number;
  stage: 'possibility' | 'momentum' | 'confidence' | 'ready';
  gaps: string[];
  options: string[];
  recommendation?: { label: string; reason: string; needsVerification?: boolean } | null;
  taskPacks: string[];
};

const DEFAULT_PREFS: AiPrivacyPreferences = {
  personal_memory_enabled: false,
  event_history_learning_enabled: false,
  organization_memory_enabled: false,
  save_conversations_enabled: false,
  product_analytics_enabled: false,
  recommendation_history_enabled: false,
};

export async function getAiPrivacyPreferences(): Promise<AiPrivacyPreferences> {
  const { data: auth } = await supabase.auth.getUser();
  const profileId = auth.user?.id;
  if (!profileId) return DEFAULT_PREFS;
  const { data, error } = await supabase.from('host_ai_preferences').select('*').eq('profile_id', profileId).maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFS;
  return {
    personal_memory_enabled: Boolean(data.personal_memory_enabled),
    event_history_learning_enabled: Boolean(data.event_history_learning_enabled),
    organization_memory_enabled: Boolean(data.organization_memory_enabled),
    save_conversations_enabled: Boolean(data.save_conversations_enabled),
    product_analytics_enabled: Boolean(data.product_analytics_enabled),
    recommendation_history_enabled: Boolean(data.recommendation_history_enabled),
  };
}

export async function runAiPlannerTurn(input: { message: string; plan: AiPlanState; history: { role: 'user' | 'assistant'; text: string }[] }): Promise<AiPlannerTurn> {
  let preferences = DEFAULT_PREFS;
  try {
    preferences = await getAiPrivacyPreferences();
  } catch {
    preferences = DEFAULT_PREFS;
  }

  try {
    const { data, error } = await supabase.functions.invoke('host-ai-planner', { body: { ...input, preferences } });
    if (error || data?.error || !data?.plan || typeof data?.message !== 'string') {
      return buildClientPlannerFallback(input.message, input.plan);
    }
    return data as AiPlannerTurn;
  } catch {
    return buildClientPlannerFallback(input.message, input.plan);
  }
}

export const TASK_PACKS: Record<string, { title: string; category: string; daysBefore: number; priority?: 'critical' | 'high' | 'normal' }[]> = {
  food: [
    { title: 'Confirm meal format and menu', category: 'Food', daysBefore: 21 },
    { title: 'Confirm dietary needs', category: 'Food', daysBefore: 14 },
    { title: 'Set final meal headcount', category: 'Food', daysBefore: 4, priority: 'high' },
    { title: 'Purchase or order food', category: 'Food', daysBefore: 2, priority: 'high' },
    { title: 'Confirm serving and storage supplies', category: 'Food', daysBefore: 2 },
    { title: 'Assign food lead and cleanup plan', category: 'Food', daysBefore: 3 },
  ],
  waivers: [
    { title: 'Confirm waiver requirements', category: 'Waivers', daysBefore: 21, priority: 'high' },
    { title: 'Create or select waiver', category: 'Waivers', daysBefore: 18 },
    { title: 'Add waiver to registration flow', category: 'Waivers', daysBefore: 16, priority: 'high' },
    { title: 'Send incomplete waiver reminder', category: 'Waivers', daysBefore: 7 },
    { title: 'Send final waiver reminder', category: 'Waivers', daysBefore: 1, priority: 'high' },
    { title: 'Verify waiver completion', category: 'Waivers', daysBefore: 0, priority: 'critical' },
  ],
  safety: [
    { title: 'Confirm event safety plan', category: 'Safety', daysBefore: 14, priority: 'high' },
    { title: 'Assign safety lead', category: 'Safety', daysBefore: 10, priority: 'high' },
    { title: 'Confirm emergency contact process', category: 'Safety', daysBefore: 7 },
    { title: 'Review weather or condition cancellation rule', category: 'Safety', daysBefore: 3, priority: 'high' },
    { title: 'Complete final safety check', category: 'Safety', daysBefore: 0, priority: 'critical' },
  ],
  vendors: [
    { title: 'Confirm vendor selection', category: 'Vendors', daysBefore: 30, priority: 'high' },
    { title: 'Send vendor agreement and requirements', category: 'Vendors', daysBefore: 25 },
    { title: 'Collect insurance and required documents', category: 'Vendors', daysBefore: 18, priority: 'high' },
    { title: 'Confirm vendor arrival and setup needs', category: 'Vendors', daysBefore: 7 },
    { title: 'Send vendor event-day instructions', category: 'Vendors', daysBefore: 2 },
  ],
  equipment: [
    { title: 'Build equipment list', category: 'Equipment', daysBefore: 14 },
    { title: 'Check inventory and identify gaps', category: 'Equipment', daysBefore: 10, priority: 'high' },
    { title: 'Purchase or rent missing equipment', category: 'Equipment', daysBefore: 7 },
    { title: 'Pack and stage equipment', category: 'Equipment', daysBefore: 1, priority: 'high' },
    { title: 'Return and inspect equipment', category: 'Equipment', daysBefore: -1 },
  ],
  communications: [
    { title: 'Prepare booking confirmation', category: 'Communications', daysBefore: 30 },
    { title: 'Prepare 7-day attendee reminder', category: 'Communications', daysBefore: 8 },
    { title: 'Prepare day-before attendee message', category: 'Communications', daysBefore: 2 },
    { title: 'Prepare morning-of update', category: 'Communications', daysBefore: 1 },
    { title: 'Prepare post-event thank-you', category: 'Communications', daysBefore: -1 },
  ],
  marketing: [
    { title: 'Create event launch promotion', category: 'Marketing', daysBefore: 28 },
    { title: 'Schedule awareness content', category: 'Marketing', daysBefore: 21 },
    { title: 'Review ticket pace and adjust promotion', category: 'Marketing', daysBefore: 14, priority: 'high' },
    { title: 'Publish final availability message if needed', category: 'Marketing', daysBefore: 3 },
  ],
  event_day: [
    { title: 'Finalize event-day run of show', category: 'Event Day', daysBefore: 3, priority: 'high' },
    { title: 'Confirm team assignments', category: 'Event Day', daysBefore: 2 },
    { title: 'Complete event-day readiness check', category: 'Event Day', daysBefore: 1, priority: 'critical' },
  ],
};

function dueDate(startsAt: string, daysBefore: number) {
  const date = new Date(startsAt);
  date.setDate(date.getDate() - daysBefore);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function keyify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task';
}

export async function addAiTaskPacks(campaignId: string, startsAt: string, packs: string[]) {
  const { data: auth } = await supabase.auth.getUser();
  const profileId = auth.user?.id;
  if (!profileId) throw new Error('Sign in to add the event work plan.');
  const rows = [...new Set(packs)].flatMap((pack, packIndex) => (TASK_PACKS[pack] ?? []).map((task, index) => ({
    campaign_id: campaignId,
    task_key: `ai-${pack}-${keyify(task.title)}-${index + 1}`,
    title: task.title,
    category: task.category,
    owner_label: 'Event owner',
    assignee_profile_id: null,
    due_label: task.daysBefore >= 0 ? `${task.daysBefore} days before event` : `${Math.abs(task.daysBefore)} day after event`,
    due_at: dueDate(startsAt, task.daysBefore),
    status: 'not_started',
    priority: task.priority ?? 'normal',
    sort_order: 700 + packIndex * 20 + index,
    created_by: profileId,
    updated_by: profileId,
  })));
  if (!rows.length) return;
  const { error } = await supabase.from('host_campaign_tasks').upsert(rows, { onConflict: 'campaign_id,task_key', ignoreDuplicates: true });
  if (error) throw error;
}
