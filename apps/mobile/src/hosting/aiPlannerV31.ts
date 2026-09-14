import type { AiPlanState } from './aiPlanner';
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
import { PLANNER_SECTION_LABELS, type AiPlannerSection, type AiPlannerTenantContext } from './aiPlannerTenant';
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

type ContextualPlan = V3PlanState & {
  components: string[];
  requirements: string[];
  safetyNotes: string[];
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

const KNOWN_CATEGORY_TERMS = /\b(networking|networker|mixer|workshop|class|seminar|conference|summit|convention|fundraiser|fundraising|charity|gala|awards?|vendor market|vendor fair|marketplace|pop[- ]?up|employee|team|staff|private party|birthday|anniversary|celebration|hybrid|virtual|online|zoom|outdoor|camp|hike|kayak|paddle|beach|bike ride|nature walk)\b/i;
const VENUE_REFINEMENTS = new Set(['search again', 'more affordable', 'downtown', 'parking important', 'more upscale', 'near airport', 'private room', 'larger space', 'accessibility important']);
const CONTEXT_CONTROLS = new Set(['keep planning', 'review plan', 'not decided', 'not sure yet', 'leave open', 'skip for now', 'recommend for me']);
const CONTEXT_SECTIONS = new Set<AiPlannerSection>(['guests', 'staffing', 'vendors', 'communications', 'marketing', 'finance', 'safety', 'documents']);

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

function inferFreeformIdentity(message: string, plan: V3PlanState, tenant: AiPlannerTenantContext) {
  if (plan.title || plan.category || KNOWN_CATEGORY_TERMS.test(message)) return plan;
  const match = message.match(/\b(?:i(?:'m| am)?\s+(?:planning|hosting|doing)|i\s+want\s+to\s+(?:plan|host|do)|we(?:'re| are)?\s+(?:planning|hosting|doing)|plan|host)\s+(?:a|an)?\s*([^,.!?]+?)(?=\s+(?:for|with|on|in|around|near)\b|[,.!?]|$)/i);
  if (!match?.[1]) return plan;
  const raw = match[1].trim();
  if (!raw || raw.length > 60) return plan;
  const title = titleCase(raw);
  const generic = tenant.eventCategories.find((item) => item.toLowerCase() === 'other')
    ?? tenant.eventCategories.find((item) => item.toLowerCase() === 'private event')
    ?? 'Other';
  return {
    ...plan,
    title,
    category: generic,
    fieldStates: {
      ...(plan.fieldStates ?? {}),
      title: { status: 'confirmed', value: title, updatedAt: new Date().toISOString() },
      category: { status: 'suggested', value: generic, updatedAt: new Date().toISOString() },
    },
  };
}

function isSimpleAreaAnswer(message: string) {
  const text = message.trim();
  if (!text || text.length > 50 || /[?,]/.test(text) || /\d/.test(text)) return false;
  if (/\b(hotel|restaurant|lounge|club|center|centre|room|hall|venue|park|arena|theater|theatre|bar|brewery|cafe|gallery|rooftop|resort|museum|church|school|library|studio|office|cowork)\b/i.test(text)) return false;
  return /^[A-Za-z .'-]{2,50}$/.test(text);
}

function formatDate(value?: string) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: date.getMinutes() ? '2-digit' : undefined });
}

function replacePersistenceClaims(turn: AiPlannerV3Turn) {
  return {
    ...turn,
    message: turn.message
      .replace(/ is saved as a planning draft\./i, ' is taking shape.')
      .replace(/The planning draft is saved, but the Event Workspace still needs/i, 'The Event Workspace still needs'),
  };
}

function humanizeConfirmation(turn: AiPlannerV3Turn) {
  const changed = new Set(turn.changedFields.map((item) => item.toLowerCase()));
  const dateText = formatDate(turn.plan.plannerDate || turn.plan.startsAt);
  const startText = formatTime(turn.plan.startsAt);
  const endText = formatTime(turn.plan.endsAt);

  if (changed.has('date') && !turn.plan.startsAt && dateText) {
    return { ...turn, message: `Got it, ${dateText}. What start and end time are you thinking?` };
  }
  if (changed.has('start time') && changed.has('end time') && startText && endText) {
    return { ...turn, message: `Got it, ${startText} to ${endText}. ${turn.message.replace(/^I updated[^.]*\.\s*/i, '')}`.trim() };
  }
  return turn;
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
    message: plan.city ? `${plan.city}, ${normalized} is set as the event area. Do you already have a venue, or should I find options there?` : `Got it, ${normalized}. What city or area should I plan around?`,
    activeSection: 'venue',
    changedFields: ['location'],
    systemMessages: ['Updated: location'],
  };
}

function isExplicitGlobalInterrupt(message: string) {
  return /\b(actually|instead|change|switch|make it|move it|attendance|attendees|guests expected|event date|start time|end time|free|paid|ticket price|public|private|virtual|hybrid)\b/i.test(message)
    || /\$\s*\d/.test(message)
    || /\b\d{1,5}\s+(?:people|attendees|guests|participants)\b/i.test(message);
}

function contextualSectionTurn(section: AiPlannerSection, message: string, source: V3PlanState, tenant: AiPlannerTenantContext): AiPlannerV3Turn | null {
  const trimmed = message.trim();
  const normalized = trimmed.toLowerCase();
  if (!trimmed || !CONTEXT_SECTIONS.has(section) || CONTEXT_CONTROLS.has(normalized) || isExplicitGlobalInterrupt(trimmed)) return null;

  const plan: ContextualPlan = {
    ...source,
    components: [...(source.components ?? [])],
    requirements: [...(source.requirements ?? [])],
    safetyNotes: [...(source.safetyNotes ?? [])],
    fieldStates: { ...(source.fieldStates ?? {}) },
    sectionNotes: { ...((source as ContextualPlan).sectionNotes ?? {}) },
  };
  const currentNotes = [...(plan.sectionNotes?.[section] ?? [])];
  plan.sectionNotes = { ...(plan.sectionNotes ?? {}), [section]: [...currentNotes, trimmed].slice(-12) };
  plan.fieldStates = {
    ...(plan.fieldStates ?? {}),
    [section]: { status: 'confirmed', value: trimmed, updatedAt: new Date().toISOString() },
  };

  if (section === 'guests') plan.meetingInstructions = [plan.meetingInstructions, trimmed].filter(Boolean).join('\n');
  if (section === 'staffing' && !plan.components.includes('team')) plan.components.push('team');
  if (section === 'vendors' && !plan.components.includes('vendors')) plan.components.push('vendors');
  if (section === 'communications' && !plan.components.includes('communications')) plan.components.push('communications');
  if (section === 'marketing' && !plan.components.includes('marketing')) plan.components.push('marketing');
  if (section === 'finance' && !plan.components.includes('finance')) plan.components.push('finance');
  if (section === 'safety') {
    if (!plan.components.includes('safety')) plan.components.push('safety');
    plan.safetyNotes = [...plan.safetyNotes, trimmed].slice(-12);
  }
  if (section === 'documents') {
    const marker = '__planner_recommended_documents__';
    if (!plan.requirements.includes(marker)) plan.requirements.push(marker);
  }

  const reviewed = reviewPlannerV3State(plan, tenant);
  const label = PLANNER_SECTION_LABELS[section];
  let response = `${label} updated. I kept that detail with this section.`;
  if (section === 'marketing') {
    const channel = trimmed.replace(/^(through|via|on)\s+/i, '').trim();
    response = `${channel ? titleCase(channel) : 'That channel'} is added to the marketing plan. We can build the campaign around it or keep planning.`;
  } else if (section === 'communications') {
    response = 'That is added to the communications plan. We can turn it into a message schedule when you are ready.';
  } else if (section === 'staffing') {
    response = 'That is added to Staffing. I will keep it separate from the event attendance count.';
  } else if (section === 'guests') {
    response = 'Guest instructions updated. I will use that for arrival and attendee guidance.';
  }

  return {
    ...reviewed,
    plan,
    message: response,
    activeSection: section,
    options: ['Keep planning', 'Review plan'],
    changedFields: [label],
    systemMessages: [`Updated: ${label.toLowerCase()}`],
  };
}

export async function runAiPlannerV31Turn(input: V31Input): Promise<AiPlannerV3Turn> {
  const normalizedMessage = normalizeAttendanceWords(input.message);
  const plan = inferFreeformIdentity(normalizedMessage, input.plan as V3PlanState, input.tenant);
  const normalized = normalizedMessage.trim().toLowerCase();

  if (input.section === 'venue' && VENUE_REFINEMENTS.has(normalized)) {
    const turn = await runAiPlannerV3Turn({ ...input, message: normalizedMessage, plan, section: 'venue', action: 'venue_search_more' });
    return humanizeConfirmation(replacePersistenceClaims(turn));
  }

  if (input.section === 'venue' && !plan.state) {
    const state = normalizeState(normalizedMessage);
    if (plan.city && state) return stateOnlyTurn(plan, normalizedMessage, input.tenant);
    if (!state && isSimpleAreaAnswer(normalizedMessage)) return cityOnlyTurn(plan, normalizedMessage, input.tenant);
  }

  if (input.section && !input.action) {
    const contextual = contextualSectionTurn(input.section, normalizedMessage, plan, input.tenant);
    if (contextual) return contextual;
  }

  const turn = await runAiPlannerV3Turn({ ...input, message: normalizedMessage, plan });
  return humanizeConfirmation(replacePersistenceClaims(turn));
}
