import { supabase } from '../lib/supabase';
import type { AiPlanState } from './aiPlanner';
import type { AiPlannerSection, AiPlannerSectionStatus } from './aiPlannerTenant';

export type PlannerFieldStatus = 'confirmed' | 'tentative' | 'suggested' | 'unknown' | 'deferred' | 'not_applicable';

export type PlannerFieldState = {
  status: PlannerFieldStatus;
  value?: unknown;
  updatedAt: string;
};

export type PlanningDraftChange = {
  at: string;
  label: string;
  fields: string[];
};

export type PlanningDraftRecord = {
  id: string;
  organizationId: string;
  plan: AiPlanState;
  sectionStatuses: Partial<Record<AiPlannerSection, AiPlannerSectionStatus>>;
  readiness: number;
  stage: string;
  fieldStates: Record<string, PlannerFieldState>;
  changeHistory: PlanningDraftChange[];
  updatedAt: string;
};

type PlanningPayload = {
  preview?: Record<string, unknown>;
  aiPlanner?: {
    plan?: AiPlanState;
    sectionStatuses?: Partial<Record<AiPlannerSection, AiPlannerSectionStatus>>;
    readiness?: number;
    stage?: string;
    fieldStates?: Record<string, PlannerFieldState>;
    changeHistory?: PlanningDraftChange[];
  };
};

function previewFromPlan(plan: AiPlanState) {
  return {
    title: plan.title || plan.category || 'Untitled event',
    summary: plan.summary || plan.description || plan.title || plan.category || '',
    description: plan.description || plan.summary || plan.title || plan.category || '',
    category: plan.category || 'Other',
    difficulty: plan.difficulty || 'easy',
    startsAt: plan.startsAt || '',
    endsAt: plan.endsAt || '',
    venueName: plan.venueName || '',
    address: (plan as AiPlanState & { venueAddress?: string }).venueAddress || '',
    city: plan.city || '',
    state: plan.state || '',
    capacity: plan.capacity ?? null,
    meetingInstructions: plan.meetingInstructions || '',
    heroImageUrl: '',
    tickets: [],
    schedule: [],
    meals: [],
    policies: [],
    operations: [],
    gear: [],
    guestInfo: [],
    marketing: [],
    photos: [],
    confidenceNotes: [],
  };
}

function parsePayload(value: unknown): PlanningPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as PlanningPayload;
}

function asRecord(row: any): PlanningDraftRecord {
  const payload = parsePayload(row.extracted_payload);
  const aiPlanner = payload.aiPlanner ?? {};
  return {
    id: String(row.id),
    organizationId: String(row.organization_id || ''),
    plan: aiPlanner.plan ?? {},
    sectionStatuses: aiPlanner.sectionStatuses ?? {},
    readiness: Number(aiPlanner.readiness || 0),
    stage: String(aiPlanner.stage || 'idea'),
    fieldStates: aiPlanner.fieldStates ?? {},
    changeHistory: Array.isArray(aiPlanner.changeHistory) ? aiPlanner.changeHistory.slice(-30) : [],
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

export async function savePlanningDraft(input: {
  draftId: string | null;
  organizationId: string;
  plan: AiPlanState;
  sectionStatuses: Partial<Record<AiPlannerSection, AiPlannerSectionStatus>>;
  readiness: number;
  stage: string;
  fieldStates: Record<string, PlannerFieldState>;
  changeHistory: PlanningDraftChange[];
}): Promise<PlanningDraftRecord> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const profileId = auth.user?.id;
  if (!profileId) throw new Error('Sign in to save this planning draft.');
  if (!input.organizationId) throw new Error('Choose an organization before saving this planning draft.');

  const now = new Date().toISOString();
  const title = input.plan.title || input.plan.category || 'Event';
  const extractedPayload: PlanningPayload = {
    preview: previewFromPlan(input.plan),
    aiPlanner: {
      plan: input.plan,
      sectionStatuses: input.sectionStatuses,
      readiness: input.readiness,
      stage: input.stage,
      fieldStates: input.fieldStates,
      changeHistory: input.changeHistory.slice(-30),
    },
  };
  const payload = {
    owner_profile_id: profileId,
    organization_id: input.organizationId,
    source_type: 'ai_planner',
    source_label: `${title} planning draft`,
    extracted_payload: extractedPayload,
    status: 'preview',
    updated_at: now,
  };

  if (input.draftId) {
    const { data, error } = await supabase
      .from('host_event_imports')
      .update(payload)
      .eq('id', input.draftId)
      .eq('source_type', 'ai_planner')
      .select('id,organization_id,extracted_payload,created_at,updated_at')
      .single();
    if (error) throw error;
    return asRecord(data);
  }

  const { data, error } = await supabase
    .from('host_event_imports')
    .insert(payload)
    .select('id,organization_id,extracted_payload,created_at,updated_at')
    .single();
  if (error) throw error;
  return asRecord(data);
}

export async function loadPlanningDraft(draftId: string): Promise<PlanningDraftRecord | null> {
  const { data, error } = await supabase
    .from('host_event_imports')
    .select('id,organization_id,source_type,extracted_payload,created_at,updated_at')
    .eq('id', draftId)
    .eq('source_type', 'ai_planner')
    .maybeSingle();
  if (error) throw error;
  return data ? asRecord(data) : null;
}

export async function loadLatestPlanningDraft(organizationId: string): Promise<PlanningDraftRecord | null> {
  if (!organizationId) return null;
  const { data, error } = await supabase
    .from('host_event_imports')
    .select('id,organization_id,source_type,extracted_payload,created_at,updated_at')
    .eq('organization_id', organizationId)
    .eq('source_type', 'ai_planner')
    .eq('status', 'preview')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? asRecord(data) : null;
}

export async function isAiPlanningDraft(draftId: string) {
  const { data, error } = await supabase
    .from('host_event_imports')
    .select('id')
    .eq('id', draftId)
    .eq('source_type', 'ai_planner')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

export async function markPlanningDraftPromoted(draftId: string | null, adventureId: string) {
  if (!draftId) return;
  const { error } = await supabase
    .from('host_event_imports')
    .update({ adventure_id: adventureId, status: 'created', updated_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('source_type', 'ai_planner');
  if (error) throw error;
}
