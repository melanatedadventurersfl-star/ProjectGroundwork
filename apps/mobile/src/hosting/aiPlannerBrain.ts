import { supabase } from '../lib/supabase';
import { getAiPrivacyPreferences, type AiPrivacyPreferences } from './aiPlanner';
import type { AiPlannerSection, AiPlannerTenantContext } from './aiPlannerTenant';
import type { PlannerFieldStatus } from './planningDrafts';
import type { V3PlanState } from './aiPlannerV3';

export type PlannerBrainAction = 'continue' | 'venue_search' | 'venue_refine' | 'review' | 'create_workspace';
export type PlannerBrainEngine = 'ai' | 'fallback';

export type PlannerBrainPatchField =
  | 'title'
  | 'summary'
  | 'description'
  | 'category'
  | 'difficulty'
  | 'plannerDate'
  | 'startsAt'
  | 'endsAt'
  | 'venueName'
  | 'city'
  | 'state'
  | 'capacity'
  | 'attendanceRange'
  | 'meetingInstructions'
  | 'paid'
  | 'priceCents'
  | 'backupPlan'
  | 'virtualEvent'
  | 'hybridEvent'
  | 'visibility'
  | 'venueSearchRefinement';

export type PlannerBrainPatch = {
  field: PlannerBrainPatchField;
  operation: 'set' | 'clear';
  value: string;
  status: Exclude<PlannerFieldStatus, 'not_applicable'>;
  reason: string;
};

export type PlannerBrainSectionUpdate = {
  section: AiPlannerSection;
  note: string;
};

export type PlannerBrainResponse = {
  engine: PlannerBrainEngine;
  model: string;
  message: string;
  patches: PlannerBrainPatch[];
  options: string[];
  recommendation?: { label: string; reason: string; needsVerification?: boolean } | null;
  action: PlannerBrainAction;
  activeSection: AiPlannerSection | null;
  venueRefinement: string;
  componentsToAdd: string[];
  componentsToRemove: string[];
  requirementsToAdd: string[];
  requirementsToRemove: string[];
  safetyNotesToAdd: string[];
  safetyNotesToRemove: string[];
  sectionUpdates: PlannerBrainSectionUpdate[];
  affectedSections: AiPlannerSection[];
  latencyMs?: number;
};

export type PlannerRuntimeContext = {
  nowIso: string;
  localDate: string;
  localTime: string;
  timeZone: string;
  locale: string;
};

export type PlannerBrainInput = {
  message: string;
  plan: V3PlanState;
  history: { role: 'user' | 'assistant'; text: string }[];
  tenant: AiPlannerTenantContext;
  section?: AiPlannerSection | null;
  action?: string | null;
};

export type AppliedPlannerBrain = {
  plan: V3PlanState & { sectionNotes?: Partial<Record<AiPlannerSection, string[]>> };
  changedFields: string[];
};

const OFF_PREFS: AiPrivacyPreferences = {
  personal_memory_enabled: false,
  event_history_learning_enabled: false,
  organization_memory_enabled: false,
  save_conversations_enabled: false,
  product_analytics_enabled: false,
  recommendation_history_enabled: false,
};

const SECTIONS = new Set<AiPlannerSection>([
  'basics',
  'schedule',
  'venue',
  'registration',
  'guests',
  'staffing',
  'vendors',
  'communications',
  'marketing',
  'finance',
  'safety',
  'documents',
]);

const PATCH_FIELDS = new Set<PlannerBrainPatchField>([
  'title',
  'summary',
  'description',
  'category',
  'difficulty',
  'plannerDate',
  'startsAt',
  'endsAt',
  'venueName',
  'city',
  'state',
  'capacity',
  'attendanceRange',
  'meetingInstructions',
  'paid',
  'priceCents',
  'backupPlan',
  'virtualEvent',
  'hybridEvent',
  'visibility',
  'venueSearchRefinement',
]);

const FIELD_LABELS: Record<PlannerBrainPatchField, string> = {
  title: 'title',
  summary: 'summary',
  description: 'description',
  category: 'event type',
  difficulty: 'difficulty',
  plannerDate: 'date',
  startsAt: 'start time',
  endsAt: 'end time',
  venueName: 'venue',
  city: 'location',
  state: 'location',
  capacity: 'attendance',
  attendanceRange: 'attendance',
  meetingInstructions: 'guest details',
  paid: 'registration',
  priceCents: 'registration',
  backupPlan: 'backup plan',
  virtualEvent: 'format',
  hybridEvent: 'format',
  visibility: 'visibility',
  venueSearchRefinement: 'venue preference',
};

function unique(values: string[], max = 40) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, max);
}

function formatRuntimePart(date: Date, timeZone: string, type: 'date' | 'time') {
  try {
    if (type === 'date') {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${map.year}-${map.month}-${map.day}`;
    }
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return type === 'date' ? date.toISOString().slice(0, 10) : date.toISOString().slice(11, 19);
  }
}

export function getPlannerRuntimeContext(now = new Date()): PlannerRuntimeContext {
  let timeZone = 'UTC';
  let locale = 'en-US';
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    timeZone = resolved.timeZone || timeZone;
    locale = resolved.locale || locale;
  } catch {
    // UTC and en-US remain safe fallbacks.
  }
  return {
    nowIso: now.toISOString(),
    localDate: formatRuntimePart(now, timeZone, 'date'),
    localTime: formatRuntimePart(now, timeZone, 'time'),
    timeZone,
    locale,
  };
}

function cleanString(value: unknown, max = 2500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanList(value: unknown, max = 30) {
  return Array.isArray(value) ? unique(value.map((item) => String(item)), max) : [];
}

function validSection(value: unknown): AiPlannerSection | null {
  return typeof value === 'string' && SECTIONS.has(value as AiPlannerSection) ? value as AiPlannerSection : null;
}

function normalizeBrainResponse(value: unknown): PlannerBrainResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const engine = raw.engine === 'fallback' ? 'fallback' : raw.engine === 'ai' ? 'ai' : null;
  const message = cleanString(raw.message, 4000);
  if (!engine || !message) return null;

  const patches = Array.isArray(raw.patches)
    ? raw.patches.flatMap((item): PlannerBrainPatch[] => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const patch = item as Record<string, unknown>;
        const field = cleanString(patch.field, 80) as PlannerBrainPatchField;
        const operation = patch.operation === 'clear' ? 'clear' : patch.operation === 'set' ? 'set' : null;
        const status = cleanString(patch.status, 40) as PlannerBrainPatch['status'];
        if (!PATCH_FIELDS.has(field) || !operation || !['confirmed','tentative','suggested','unknown','deferred'].includes(status)) return [];
        return [{
          field,
          operation,
          value: cleanString(patch.value, 2500),
          status,
          reason: cleanString(patch.reason, 500),
        }];
      })
    : [];

  const sectionUpdates = Array.isArray(raw.sectionUpdates)
    ? raw.sectionUpdates.flatMap((item): PlannerBrainSectionUpdate[] => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const update = item as Record<string, unknown>;
        const section = validSection(update.section);
        const note = cleanString(update.note, 1000);
        return section && note ? [{ section, note }] : [];
      })
    : [];

  const recommendationRaw = raw.recommendation;
  const recommendation = recommendationRaw && typeof recommendationRaw === 'object' && !Array.isArray(recommendationRaw)
    ? {
        label: cleanString((recommendationRaw as Record<string, unknown>).label, 200),
        reason: cleanString((recommendationRaw as Record<string, unknown>).reason, 800),
        needsVerification: Boolean((recommendationRaw as Record<string, unknown>).needsVerification),
      }
    : null;

  const action = ['continue','venue_search','venue_refine','review','create_workspace'].includes(String(raw.action))
    ? String(raw.action) as PlannerBrainAction
    : 'continue';

  return {
    engine,
    model: cleanString(raw.model, 120) || 'unknown',
    message,
    patches,
    options: cleanList(raw.options, 6),
    recommendation: recommendation?.label ? recommendation : null,
    action,
    activeSection: validSection(raw.activeSection),
    venueRefinement: cleanString(raw.venueRefinement, 300),
    componentsToAdd: cleanList(raw.componentsToAdd, 20),
    componentsToRemove: cleanList(raw.componentsToRemove, 20),
    requirementsToAdd: cleanList(raw.requirementsToAdd, 30),
    requirementsToRemove: cleanList(raw.requirementsToRemove, 30),
    safetyNotesToAdd: cleanList(raw.safetyNotesToAdd, 30),
    safetyNotesToRemove: cleanList(raw.safetyNotesToRemove, 30),
    sectionUpdates,
    affectedSections: cleanList(raw.affectedSections, 12).map(validSection).filter((item): item is AiPlannerSection => Boolean(item)),
  };
}

export async function requestPlannerBrain(input: PlannerBrainInput): Promise<PlannerBrainResponse | null> {
  let preferences = OFF_PREFS;
  try {
    preferences = await getAiPrivacyPreferences();
  } catch {
    preferences = OFF_PREFS;
  }

  const runtime = getPlannerRuntimeContext();
  const started = Date.now();
  try {
    const { data, error } = await supabase.functions.invoke('host-ai-planner', {
      body: {
        message: input.message,
        plan: input.plan,
        history: input.history.slice(-20),
        preferences,
        tenant: input.tenant,
        section: input.section ?? null,
        action: input.action ?? 'continue',
        mode: 'chatbot',
        runtime,
      },
    });
    if (error || data?.error) return null;
    const normalized = normalizeBrainResponse(data);
    return normalized ? { ...normalized, latencyMs: Date.now() - started } : null;
  } catch {
    return null;
  }
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (['true','yes','1'].includes(normalized)) return true;
  if (['false','no','0'].includes(normalized)) return false;
  return null;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return value;
}

function validDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)) return '';
  return Number.isNaN(new Date(value).getTime()) ? '' : value;
}

function clearField(plan: V3PlanState, field: PlannerBrainPatchField) {
  delete (plan as unknown as Record<string, unknown>)[field];
}

function setField(plan: V3PlanState, patch: PlannerBrainPatch): unknown {
  const value = patch.value.trim();
  switch (patch.field) {
    case 'plannerDate': {
      const parsed = validDate(value);
      if (!parsed) return undefined;
      plan.plannerDate = parsed;
      return parsed;
    }
    case 'startsAt': {
      const parsed = validDateTime(value);
      if (!parsed) return undefined;
      plan.startsAt = parsed;
      plan.plannerDate = parsed.slice(0, 10);
      return parsed;
    }
    case 'endsAt': {
      const parsed = validDateTime(value);
      if (!parsed) return undefined;
      if (plan.startsAt && new Date(parsed).getTime() <= new Date(plan.startsAt).getTime()) return undefined;
      plan.endsAt = parsed;
      return parsed;
    }
    case 'capacity': {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1000000) return undefined;
      plan.capacity = parsed;
      plan.attendanceRange = undefined;
      return parsed;
    }
    case 'priceCents': {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) return undefined;
      plan.priceCents = parsed;
      return parsed;
    }
    case 'paid': {
      const parsed = parseBoolean(value);
      if (parsed === null) return undefined;
      plan.paid = parsed;
      if (!parsed) plan.priceCents = 0;
      return parsed;
    }
    case 'virtualEvent':
    case 'hybridEvent': {
      const parsed = parseBoolean(value);
      if (parsed === null) return undefined;
      plan[patch.field] = parsed;
      return parsed;
    }
    case 'visibility': {
      if (value !== 'public' && value !== 'private') return undefined;
      plan.visibility = value;
      return value;
    }
    case 'difficulty': {
      if (!['easy','moderate','challenging'].includes(value)) return undefined;
      plan.difficulty = value as V3PlanState['difficulty'];
      return value;
    }
    case 'state': {
      const normalized = value.length === 2 ? value.toUpperCase() : value;
      plan.state = normalized;
      return normalized;
    }
    default: {
      if (!value) return undefined;
      (plan as unknown as Record<string, unknown>)[patch.field] = value;
      return value;
    }
  }
}

export function applyPlannerBrainResponse(source: V3PlanState, response: PlannerBrainResponse): AppliedPlannerBrain {
  const plan = {
    ...source,
    components: [...(source.components ?? [])],
    requirements: [...(source.requirements ?? [])],
    safetyNotes: [...(source.safetyNotes ?? [])],
    fieldStates: { ...(source.fieldStates ?? {}) },
    delegatedSections: [...(source.delegatedSections ?? [])],
    venueShortlist: source.venueShortlist?.map((item) => ({ ...item })) ?? [],
    venueExcludedPlaceIds: [...(source.venueExcludedPlaceIds ?? [])],
    venueLastResultIds: [...(source.venueLastResultIds ?? [])],
  } as V3PlanState & { sectionNotes?: Partial<Record<AiPlannerSection, string[]>> };
  plan.sectionNotes = { ...((source as typeof plan).sectionNotes ?? {}) };

  const changed = new Set<string>();
  for (const patch of response.patches) {
    if (patch.operation === 'clear') {
      clearField(plan, patch.field);
      plan.fieldStates = {
        ...(plan.fieldStates ?? {}),
        [patch.field]: { status: 'unknown', updatedAt: new Date().toISOString() },
      };
      changed.add(FIELD_LABELS[patch.field]);
      continue;
    }
    const applied = setField(plan, patch);
    if (applied === undefined) continue;
    plan.fieldStates = {
      ...(plan.fieldStates ?? {}),
      [patch.field]: { status: patch.status, value: applied, updatedAt: new Date().toISOString() },
    };
    changed.add(FIELD_LABELS[patch.field]);
  }

  const componentsToRemove = new Set(response.componentsToRemove.map((value) => value.toLowerCase()));
  plan.components = unique([...(plan.components ?? []).filter((value) => !componentsToRemove.has(value.toLowerCase())), ...response.componentsToAdd], 20);
  if (response.componentsToAdd.length || response.componentsToRemove.length) changed.add('planning areas');

  const requirementsToRemove = new Set(response.requirementsToRemove.map((value) => value.toLowerCase()));
  plan.requirements = unique([...(plan.requirements ?? []).filter((value) => !requirementsToRemove.has(value.toLowerCase())), ...response.requirementsToAdd], 40);
  if (response.requirementsToAdd.length || response.requirementsToRemove.length) changed.add('requirements');

  const safetyToRemove = new Set(response.safetyNotesToRemove.map((value) => value.toLowerCase()));
  plan.safetyNotes = unique([...(plan.safetyNotes ?? []).filter((value) => !safetyToRemove.has(value.toLowerCase())), ...response.safetyNotesToAdd], 30);
  if (response.safetyNotesToAdd.length || response.safetyNotesToRemove.length) changed.add('safety');

  for (const update of response.sectionUpdates) {
    plan.sectionNotes = {
      ...(plan.sectionNotes ?? {}),
      [update.section]: unique([...(plan.sectionNotes?.[update.section] ?? []), update.note], 12),
    };
    changed.add(update.section);
  }

  for (const section of response.affectedSections) {
    const marker = `__planner_review_${section}__`;
    const notApplicable = `__planner_na_${section}__`;
    if (!(plan.requirements ?? []).includes(notApplicable)) plan.requirements = unique([...(plan.requirements ?? []), marker], 40);
  }

  return { plan, changedFields: [...changed] };
}
