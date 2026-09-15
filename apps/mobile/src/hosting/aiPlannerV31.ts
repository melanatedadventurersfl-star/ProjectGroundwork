import { supabase } from '../lib/supabase';
import { getAiPrivacyPreferences, type AiPlanState, type AiPrivacyPreferences } from './aiPlanner';
import type { AiPlannerV2Action } from './aiPlannerV2';
import {
  compactSectionOrder,
  getWorkspaceProgress,
  isPlanningDraftReady,
  reviewPlannerV3State,
  runAiPlannerV3Turn,
  stageLabel,
  type AiPlannerV3Turn,
  type V3PlanState,
} from './aiPlannerV3';
import { type AiPlannerSection, type AiPlannerTenantContext } from './aiPlannerTenant';
import type { VenueCandidate } from './venueDiscovery';

export { compactSectionOrder, getWorkspaceProgress, isPlanningDraftReady, reviewPlannerV3State, stageLabel };
export type { AiPlannerV3Turn, V3PlanState };

type PlannerHistory = { role: 'user' | 'assistant'; text: string }[];

type V31Input = {
  message: string;
  plan: AiPlanState;
  history: PlannerHistory;
  tenant: AiPlannerTenantContext;
  section?: AiPlannerSection | null;
  action?: AiPlannerV2Action;
  venueCandidate?: VenueCandidate | null;
};

type PlannerServerAction = 'continue' | 'venue_search' | 'venue_refine' | 'review' | 'create_workspace';

type PlannerSectionUpdate = {
  section: AiPlannerSection;
  note: string;
};

type PlannerServerTurn = {
  message: string;
  plan: Partial<AiPlanState>;
  options?: string[];
  recommendation?: { label: string; reason: string; needsVerification?: boolean } | null;
  action?: PlannerServerAction;
  activeSection?: AiPlannerSection | null;
  venueRefinement?: string;
  changedFields?: string[];
  sectionUpdates?: PlannerSectionUpdate[];
};

type FluidPlan = V3PlanState & {
  sectionNotes?: Partial<Record<AiPlannerSection, string[]>>;
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

const VENUE_REFINEMENTS = new Set([
  'search again',
  'more affordable',
  'downtown',
  'parking important',
  'more upscale',
  'near airport',
  'private room',
  'larger space',
  'accessibility important',
]);

const AI_SECTIONS = new Set<AiPlannerSection>([
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

const CONTROL_MESSAGES = /^(review plan|review the plan|show me what is missing|what is missing|create|create it|create event|create workspace|create event workspace|ready to create|create draft|not decided|not sure yet|leave open|skip for now|free|paid|10 or fewer|11[–-]50|51[–-]100|100\+)$/i;

const OFF_PREFS: AiPrivacyPreferences = {
  personal_memory_enabled: false,
  event_history_learning_enabled: false,
  organization_memory_enabled: false,
  save_conversations_enabled: false,
  product_analytics_enabled: false,
  recommendation_history_enabled: false,
};

function titleCase(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeState(value: string) {
  const cleaned = value.trim().replace(/[.]/g, '');
  if (/^[A-Za-z]{2}$/.test(cleaned)) return cleaned.toUpperCase();
  return STATE_NAMES[cleaned.toLowerCase()] ?? '';
}

function normalizeAttendanceWords(message: string) {
  return message.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+(people|attendees|guests|participants)\b/gi,
    (_match, rawNumber: string, noun: string) => `${NUMBER_WORDS[rawNumber.toLowerCase()] ?? rawNumber} ${noun}`);
}

function inferFreeformIdentity(message: string, source: V3PlanState, tenant: AiPlannerTenantContext) {
  if (source.title) return source;
  const match = message.match(/\b(?:i(?:'m| am)?\s+(?:planning|hosting|doing)|i\s+want\s+to\s+(?:plan|host|do)|we(?:'re| are)?\s+(?:planning|hosting|doing)|plan|host)\s+(?:a|an)?\s*([^,.!?]+?)(?=\s+(?:for|with|on|in|around|near)\b|[,.!?]|$)/i);
  if (!match?.[1]) return source;
  const raw = match[1].trim();
  if (!raw || raw.length > 80) return source;
  const title = titleCase(raw);
  const category = source.category
    || tenant.eventCategories.find((item) => item.toLowerCase() === 'other')
    || tenant.eventCategories.find((item) => item.toLowerCase() === 'private event')
    || 'Other';
  return {
    ...source,
    title,
    category,
    fieldStates: {
      ...(source.fieldStates ?? {}),
      title: { status: 'confirmed', value: title, updatedAt: new Date().toISOString() },
      category: { status: 'suggested', value: category, updatedAt: new Date().toISOString() },
    },
  } satisfies V3PlanState;
}

function isSimpleAreaAnswer(message: string) {
  const text = message.trim();
  if (!text || text.length > 50 || /[?,]/.test(text) || /\d/.test(text)) return false;
  if (/\b(hotel|restaurant|lounge|club|center|centre|room|hall|venue|park|arena|theater|theatre|bar|brewery|cafe|gallery|rooftop|resort|museum|church|school|library|studio|office|cowork)\b/i.test(text)) return false;
  return /^[A-Za-z .'-]{2,50}$/.test(text);
}

function cityOnlyTurn(planInput: V3PlanState, city: string, tenant: AiPlannerTenantContext): AiPlannerV3Turn {
  const cityName = titleCase(city);
  const plan: V3PlanState = {
    ...planInput,
    city: cityName,
    venueName: planInput.venueName && planInput.venueName.toLowerCase() === cityName.toLowerCase() ? undefined : planInput.venueName,
    fieldStates: {
      ...(planInput.fieldStates ?? {}),
      location: { status: 'confirmed', value: cityName, updatedAt: new Date().toISOString() },
    },
  };
  const reviewed = reviewPlannerV3State(plan, tenant);
  return {
    ...reviewed,
    plan,
    message: `${cityName}, which state?`,
    activeSection: 'venue',
    changedFields: ['location'],
    systemMessages: ['Updated: location'],
  };
}

function stateOnlyTurn(planInput: V3PlanState, state: string, tenant: AiPlannerTenantContext): AiPlannerV3Turn {
  const normalized = normalizeState(state);
  const plan: V3PlanState = {
    ...planInput,
    state: normalized,
    fieldStates: {
      ...(planInput.fieldStates ?? {}),
      location: { status: 'confirmed', value: [planInput.city, normalized].filter(Boolean).join(', '), updatedAt: new Date().toISOString() },
    },
  };
  const reviewed = reviewPlannerV3State(plan, tenant);
  return {
    ...reviewed,
    plan,
    message: plan.city
      ? `${plan.city}, ${normalized} is set as the event area. Do you already have a venue, or should I find options there?`
      : `Got it, ${normalized}. What city or area should I plan around?`,
    activeSection: 'venue',
    changedFields: ['location'],
    systemMessages: ['Updated: location'],
  };
}

function cleanArray(value: unknown, max = 30) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, max)
    : [];
}

function validDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : value.trim();
}

function mergeSectionUpdates(source: FluidPlan, updates: PlannerSectionUpdate[] | undefined) {
  if (!Array.isArray(updates) || !updates.length) return source;
  const notes = { ...(source.sectionNotes ?? {}) };
  for (const update of updates) {
    if (!AI_SECTIONS.has(update.section) || !update.note?.trim()) continue;
    notes[update.section] = [...(notes[update.section] ?? []), update.note.trim()].slice(-12);
  }
  return { ...source, sectionNotes: notes };
}

function mergeAiPlan(baseInput: V3PlanState, serverPlan: Partial<AiPlanState> | undefined, message: string) {
  if (!serverPlan || typeof serverPlan !== 'object') return baseInput;
  const next: FluidPlan = {
    ...baseInput,
    components: [...(baseInput.components ?? [])],
    requirements: [...(baseInput.requirements ?? [])],
    safetyNotes: [...(baseInput.safetyNotes ?? [])],
    fieldStates: { ...(baseInput.fieldStates ?? {}) },
  };

  const textFields: (keyof AiPlanState)[] = ['title', 'summary', 'description', 'category', 'venueName', 'city', 'state', 'meetingInstructions', 'backupPlan'];
  for (const key of textFields) {
    const value = serverPlan[key];
    if (typeof value === 'string' && value.trim()) (next as any)[key] = value.trim();
  }

  if (serverPlan.difficulty && ['easy', 'moderate', 'challenging'].includes(serverPlan.difficulty)) next.difficulty = serverPlan.difficulty;
  if (Number.isInteger(serverPlan.capacity) && Number(serverPlan.capacity) > 0) next.capacity = Number(serverPlan.capacity);
  if (typeof (serverPlan as any).attendanceRange === 'string' && (serverPlan as any).attendanceRange.trim()) next.attendanceRange = (serverPlan as any).attendanceRange.trim();

  const startsAt = validDateTime(serverPlan.startsAt);
  const endsAt = validDateTime(serverPlan.endsAt);
  if (startsAt) next.startsAt = startsAt;
  if (endsAt && (!next.startsAt || new Date(endsAt).getTime() > new Date(next.startsAt).getTime())) next.endsAt = endsAt;

  const admissionMentioned = /\b(free|paid|ticket|admission|price|cost|charge)\b/i.test(message);
  if (typeof serverPlan.paid === 'boolean' && (admissionMentioned || baseInput.paid !== undefined)) next.paid = serverPlan.paid;
  if (Number.isInteger(serverPlan.priceCents) && Number(serverPlan.priceCents) >= 0 && (admissionMentioned || baseInput.priceCents !== undefined)) next.priceCents = Number(serverPlan.priceCents);

  const serverComponents = cleanArray(serverPlan.components, 20);
  if (serverComponents.length) next.components = [...new Set([...(next.components ?? []), ...serverComponents])];

  const serverRequirements = cleanArray(serverPlan.requirements, 30);
  if (serverRequirements.length) next.requirements = [...new Set([...(next.requirements ?? []), ...serverRequirements])].slice(-30);

  const serverSafety = cleanArray(serverPlan.safetyNotes, 30);
  if (serverSafety.length) next.safetyNotes = [...new Set([...(next.safetyNotes ?? []), ...serverSafety])].slice(-30);

  return next;
}

function diffFields(before: V3PlanState, after: V3PlanState) {
  const labels: [string, unknown, unknown][] = [
    ['title', before.title, after.title],
    ['event type', before.category, after.category],
    ['attendance', before.capacity ?? before.attendanceRange, after.capacity ?? after.attendanceRange],
    ['date & time', `${before.startsAt ?? ''}|${before.endsAt ?? ''}`, `${after.startsAt ?? ''}|${after.endsAt ?? ''}`],
    ['location', `${before.city ?? ''}|${before.state ?? ''}`, `${after.city ?? ''}|${after.state ?? ''}`],
    ['venue', before.venueName, after.venueName],
    ['registration', `${before.paid ?? ''}|${before.priceCents ?? ''}`, `${after.paid ?? ''}|${after.priceCents ?? ''}`],
    ['guest details', before.meetingInstructions, after.meetingInstructions],
    ['planning areas', (before.components ?? []).join('|'), (after.components ?? []).join('|')],
  ];
  return labels.filter(([, oldValue, newValue]) => JSON.stringify(oldValue) !== JSON.stringify(newValue)).map(([label]) => label);
}

function activeSection(value: unknown, fallback: AiPlannerSection | null) {
  return typeof value === 'string' && AI_SECTIONS.has(value as AiPlannerSection) ? value as AiPlannerSection : fallback;
}

async function requestPlannerIntelligence(input: V31Input, plan: V3PlanState): Promise<PlannerServerTurn | null> {
  let preferences = OFF_PREFS;
  try {
    preferences = await getAiPrivacyPreferences();
  } catch {
    preferences = OFF_PREFS;
  }

  try {
    const { data, error } = await supabase.functions.invoke('host-ai-planner', {
      body: {
        message: input.message,
        plan,
        history: input.history.slice(-16),
        preferences,
        tenant: input.tenant,
        section: input.section ?? null,
        action: input.action ?? 'continue',
        mode: 'fluid',
      },
    });
    if (error || data?.error || typeof data?.message !== 'string' || !data?.plan) return null;
    return data as PlannerServerTurn;
  } catch {
    return null;
  }
}

function isExplicitControl(message: string, action?: AiPlannerV2Action) {
  if (action === 'review' || action === 'create' || action === 'section' || action === 'venue_select' || action === 'venue_search_more') return true;
  return CONTROL_MESSAGES.test(message.trim());
}

export async function runAiPlannerV31Turn(input: V31Input): Promise<AiPlannerV3Turn> {
  const normalizedMessage = normalizeAttendanceWords(input.message);
  const seededPlan = inferFreeformIdentity(normalizedMessage, input.plan as V3PlanState, input.tenant);
  const normalized = normalizedMessage.trim().toLowerCase();

  if (input.section === 'venue' && VENUE_REFINEMENTS.has(normalized)) {
    return runAiPlannerV3Turn({ ...input, message: normalizedMessage, plan: seededPlan, section: 'venue', action: 'venue_search_more' });
  }

  if (input.section === 'venue' && !seededPlan.state) {
    const state = normalizeState(normalizedMessage);
    if (seededPlan.city && state) return stateOnlyTurn(seededPlan, normalizedMessage, input.tenant);
    if (!state && isSimpleAreaAnswer(normalizedMessage)) return cityOnlyTurn(seededPlan, normalizedMessage, input.tenant);
  }

  if (isExplicitControl(normalizedMessage, input.action)) {
    return runAiPlannerV3Turn({ ...input, message: normalizedMessage, plan: seededPlan });
  }

  const deterministicSection = input.section === 'venue' ? null : input.section;
  const deterministic = await runAiPlannerV3Turn({
    ...input,
    message: normalizedMessage,
    plan: seededPlan,
    section: deterministicSection,
    action: undefined,
  });

  const intelligence = await requestPlannerIntelligence({ ...input, message: normalizedMessage }, deterministic.plan);
  if (!intelligence) return deterministic;

  let merged = mergeAiPlan(deterministic.plan, intelligence.plan, normalizedMessage);
  merged = mergeSectionUpdates(merged, intelligence.sectionUpdates);

  const serverChanged = Array.isArray(intelligence.changedFields)
    ? intelligence.changedFields.map(String).filter(Boolean)
    : [];
  const changedFields = [...new Set([...deterministic.changedFields, ...serverChanged, ...diffFields(input.plan as V3PlanState, merged)])];

  if (intelligence.action === 'venue_search' || intelligence.action === 'venue_refine') {
    const refinement = intelligence.venueRefinement?.trim() || normalizedMessage;
    return runAiPlannerV3Turn({
      ...input,
      message: refinement,
      plan: merged,
      section: 'venue',
      action: intelligence.action === 'venue_refine' ? 'venue_search_more' : 'recommend',
    });
  }

  if (intelligence.action === 'review') {
    const reviewed = reviewPlannerV3State(merged, input.tenant);
    return {
      ...reviewed,
      message: intelligence.message || reviewed.message,
      changedFields,
      systemMessages: changedFields.length ? [`Updated: ${changedFields.join(' · ')}`] : [],
    };
  }

  if (intelligence.action === 'create_workspace') {
    return runAiPlannerV3Turn({
      ...input,
      message: 'create event workspace',
      plan: merged,
      action: 'create',
    });
  }

  const reviewed = reviewPlannerV3State(merged, input.tenant);
  const options = Array.isArray(intelligence.options) ? intelligence.options.map(String).filter(Boolean).slice(0, 6) : [];
  const nextSection = activeSection(intelligence.activeSection, input.section ?? reviewed.activeSection ?? null);

  return {
    ...reviewed,
    plan: merged,
    message: intelligence.message || deterministic.message,
    options,
    recommendation: intelligence.recommendation ?? reviewed.recommendation ?? null,
    activeSection: nextSection,
    changedFields,
    systemMessages: changedFields.length ? [`Updated: ${changedFields.join(' · ')}`] : [],
    conflictMessage: deterministic.conflictMessage ?? null,
  };
}
