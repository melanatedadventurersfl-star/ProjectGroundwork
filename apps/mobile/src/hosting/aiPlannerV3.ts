import type { AiPlanState } from './aiPlanner';
import {
  getPlannerSectionStatuses,
  reviewPlannerState,
  runAiPlannerV2Turn,
  type AiPlannerV2Action,
  type V2PlanState,
} from './aiPlannerV2';
import {
  DEFAULT_PLANNER_SECTIONS,
  PLANNER_SECTION_LABELS,
  type AiPlannerSection,
  type AiPlannerSectionStatus,
  type AiPlannerTenantContext,
} from './aiPlannerTenant';
import type { PlannerFieldState, PlannerFieldStatus } from './planningDrafts';
import type { VenueCandidate } from './venueDiscovery';

type PlannerHistory = { role: 'user' | 'assistant'; text: string }[];

export type PlannerStyle = 'quick' | 'guided' | 'detailed';
export type PlannerV3Command = 'create_workspace' | 'review' | null;

export type V3PlanState = V2PlanState & {
  fieldStates?: Record<string, PlannerFieldState>;
  planningStyle?: PlannerStyle;
  virtualEvent?: boolean;
  hybridEvent?: boolean;
  visibility?: 'public' | 'private';
  delegatedSections?: AiPlannerSection[];
};

export type AiPlannerV3Turn = {
  message: string;
  plan: V3PlanState;
  readiness: number;
  stage: 'idea' | 'taking_shape' | 'coming_together' | 'ready_to_run';
  gaps: string[];
  options: string[];
  recommendation?: { label: string; reason: string; needsVerification?: boolean } | null;
  taskPacks: string[];
  activeSection: AiPlannerSection | null;
  command: PlannerV3Command;
  sectionStatuses: Record<AiPlannerSection, AiPlannerSectionStatus>;
  venueResults: VenueCandidate[];
  venueWarnings: string[];
  changedFields: string[];
  systemMessages: string[];
  conflictMessage?: string | null;
};

export type AiPlannerV3Input = {
  message: string;
  plan: AiPlanState;
  history: PlannerHistory;
  tenant: AiPlannerTenantContext;
  section?: AiPlannerSection | null;
  action?: AiPlannerV2Action;
  venueCandidate?: VenueCandidate | null;
};

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

const REVIEW_MARKER = '__planner_review_';
const RECOMMENDED_MARKER = '__planner_recommended_';
const NA_MARKER = '__planner_na_';

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function titleCase(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function copyPlan(input: AiPlanState): V3PlanState {
  const source = input as V3PlanState;
  return {
    ...source,
    components: [...(source.components ?? [])],
    requirements: [...(source.requirements ?? [])],
    safetyNotes: [...(source.safetyNotes ?? [])],
    delegatedSections: [...(source.delegatedSections ?? [])],
    fieldStates: { ...(source.fieldStates ?? {}) },
    venueShortlist: source.venueShortlist?.map((item) => ({ ...item, types: [...item.types], fitSignals: [...item.fitSignals], unknowns: [...item.unknowns] })) ?? [],
    venueExcludedPlaceIds: [...(source.venueExcludedPlaceIds ?? [])],
    venueLastResultIds: [...(source.venueLastResultIds ?? [])],
  };
}

function setFieldState(plan: V3PlanState, key: string, status: PlannerFieldStatus, value?: unknown) {
  plan.fieldStates = {
    ...(plan.fieldStates ?? {}),
    [key]: { status, value, updatedAt: new Date().toISOString() },
  };
}

function inferredStatus(message: string): PlannerFieldStatus {
  return /\b(about|around|roughly|approximately|probably|maybe|thinking|likely|somewhere|sometime)\b/i.test(message) ? 'tentative' : 'confirmed';
}

function normalizeState(value: string) {
  const cleaned = value.trim().replace(/[.]/g, '');
  if (/^[A-Za-z]{2}$/.test(cleaned)) return cleaned.toUpperCase();
  return STATE_NAMES[cleaned.toLowerCase()] ?? '';
}

function parseDate(value: string) {
  const text = value.trim();
  let year = 0;
  let month = 0;
  let day = 0;
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}|\d{2}))?\b/);
  const monthMatch = text.toLowerCase().match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/);
  if (iso) {
    year = Number(iso[1] ?? 0);
    month = Number(iso[2] ?? 0);
    day = Number(iso[3] ?? 0);
  } else if (slash) {
    month = Number(slash[1] ?? 0);
    day = Number(slash[2] ?? 0);
    const rawYear = slash[3] ?? String(new Date().getFullYear());
    year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);
  } else if (monthMatch) {
    month = MONTHS[monthMatch[1] ?? ''] ?? 0;
    day = Number(monthMatch[2] ?? 0);
    year = monthMatch[3] ? Number(monthMatch[3]) : new Date().getFullYear();
  }
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseClock(rawHour?: string, rawMinute?: string, meridiem?: string) {
  if (!rawHour) return '';
  let hour = Number(rawHour);
  const minute = Number(rawMinute ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return '';
  if (meridiem) {
    if (hour < 1 || hour > 12) return '';
    if (meridiem.toLowerCase() === 'pm' && hour !== 12) hour += 12;
    if (meridiem.toLowerCase() === 'am' && hour === 12) hour = 0;
  } else if (hour > 23) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTimeRange(message: string) {
  const range = message.match(/\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until|through)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (range) {
    let startMeridiem = range[3];
    const endMeridiem = range[6];
    if (!startMeridiem && endMeridiem) startMeridiem = endMeridiem;
    return {
      start: parseClock(range[1], range[2], startMeridiem),
      end: parseClock(range[4], range[5], endMeridiem || startMeridiem),
    };
  }
  const single = message.match(/\b(?:at|around|about|starting|starts?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  return single ? { start: parseClock(single[1], single[2], single[3]), end: '' } : { start: '', end: '' };
}

function dateTime(date: string, time: string) {
  return date && time ? `${date}T${time}` : '';
}

function inferCategory(message: string, tenant: AiPlannerTenantContext) {
  const lower = normalize(message);
  const mappings: { match: RegExp; category: string; title: string }[] = [
    { match: /\b(networking|networker|mixer)\b/, category: 'Networking', title: 'Networking Event' },
    { match: /\b(workshop|class|seminar)\b/, category: 'Workshop', title: 'Workshop' },
    { match: /\b(conference|summit|convention)\b/, category: 'Conference', title: 'Conference' },
    { match: /\b(fundraiser|fundraising|charity)\b/, category: 'Fundraiser', title: 'Fundraiser' },
    { match: /\b(gala|awards? dinner|awards? ceremony)\b/, category: 'Gala / Awards', title: 'Gala / Awards Event' },
    { match: /\b(vendor market|vendor fair|marketplace|pop[- ]?up)\b/, category: 'Vendor Market / Pop-up', title: 'Vendor Market' },
    { match: /\b(employee|team|staff)\s+(training|event|retreat)\b/, category: 'Employee / Team Event', title: 'Team Event' },
    { match: /\b(private party|birthday|anniversary|celebration)\b/, category: 'Private Event', title: 'Private Event' },
    { match: /\bhybrid\b/, category: 'Hybrid Event', title: 'Hybrid Event' },
    { match: /\bvirtual|online|zoom\b/, category: 'Virtual Event', title: 'Virtual Event' },
    { match: /\b(outdoor|camp|hike|kayak|paddle|beach|bike ride|nature walk)\b/, category: 'Outdoor Event', title: 'Outdoor Event' },
  ];
  const found = mappings.find((item) => item.match.test(lower));
  if (!found) return null;
  const allowed = tenant.eventCategories.find((item) => normalize(item) === normalize(found.category));
  return { category: allowed || found.category, title: found.title };
}

function parseLocation(message: string) {
  const commaAnywhere = message.match(/\b([A-Za-z .'-]{2,60}),\s*([A-Za-z]{2}|[A-Za-z ]{4,30})\b/);
  if (commaAnywhere) {
    const state = normalizeState(commaAnywhere[2] ?? '');
    if (state) return { city: titleCase(commaAnywhere[1] ?? ''), state };
  }
  const introduced = message.match(/\b(?:in|around|near)\s+([A-Za-z .'-]+?)\s+(Florida|Georgia|Texas|California|New York|North Carolina|South Carolina|Virginia|Maryland|Alabama|Tennessee)\b/i);
  if (introduced) return { city: titleCase(introduced[1] ?? ''), state: normalizeState(introduced[2] ?? '') };
  return null;
}

function markReview(plan: V3PlanState, section: AiPlannerSection) {
  const marker = `${REVIEW_MARKER}${section}__`;
  const notApplicable = `${NA_MARKER}${section}__`;
  plan.requirements = unique([...(plan.requirements ?? []).filter((item) => item !== notApplicable), marker]);
}

function clearReview(plan: V3PlanState, section: AiPlannerSection) {
  const marker = `${REVIEW_MARKER}${section}__`;
  plan.requirements = (plan.requirements ?? []).filter((item) => item !== marker);
}

function markRecommended(plan: V3PlanState, section: AiPlannerSection) {
  const marker = `${RECOMMENDED_MARKER}${section}__`;
  plan.requirements = unique([...(plan.requirements ?? []), marker]);
  plan.delegatedSections = unique([...(plan.delegatedSections ?? []), section]);
}

function markNotApplicable(plan: V3PlanState, section: AiPlannerSection) {
  const marker = `${NA_MARKER}${section}__`;
  plan.requirements = unique([...(plan.requirements ?? []), marker]);
}

function addComponent(plan: V3PlanState, component: string) {
  plan.components = unique([...(plan.components ?? []), component]);
}

function extractFacts(message: string, source: AiPlanState, tenant: AiPlannerTenantContext) {
  const plan = copyPlan(source);
  const before = copyPlan(source);
  const changed = new Set<string>();
  const systemMessages: string[] = [];
  const status = inferredStatus(message);
  const lower = normalize(message);
  let conflictMessage: string | null = null;

  const category = inferCategory(message, tenant);
  if (category) {
    if (!plan.category || /\b(actually|instead|change|switch)\b/.test(lower)) {
      plan.category = category.category;
      changed.add('event type');
      setFieldState(plan, 'category', 'confirmed', plan.category);
    }
    if (!plan.title || /^\s*(networking event|workshop|conference|fundraiser|gala|vendor market|team event|private event|hybrid event|virtual event|outdoor event)\s*$/i.test(plan.title)) {
      plan.title = category.title;
      changed.add('title');
      setFieldState(plan, 'title', 'confirmed', plan.title);
    }
    if (category.category === 'Virtual Event') {
      plan.virtualEvent = true;
      plan.hybridEvent = false;
      markNotApplicable(plan, 'venue');
    }
    if (category.category === 'Hybrid Event') {
      plan.virtualEvent = false;
      plan.hybridEvent = true;
    }
  }

  const explicitTitle = message.match(/\b(?:call it|title it|event name is|name it)\s+["']?([^"'.!?]+)["']?/i);
  if (explicitTitle?.[1]) {
    plan.title = titleCase(explicitTitle[1]);
    changed.add('title');
    setFieldState(plan, 'title', 'confirmed', plan.title);
  }

  const attendance = message.match(/\b(?:about|around|roughly|approximately|expecting|for|with)?\s*(\d{1,5})\s*(?:people|attendees|guests|participants)\b/i);
  const capped = message.match(/\b(\d{1,4})\s+or\s+(?:fewer|less)\b/i);
  const attendanceMatch = attendance ?? capped;
  if (attendanceMatch?.[1]) {
    const next = Number(attendanceMatch[1]);
    const old = plan.capacity;
    if (Number.isFinite(next) && next > 0) {
      plan.capacity = next;
      plan.attendanceRange = capped ? `${next} or fewer` : /\b(about|around|roughly|approximately)\b/i.test(message) ? `About ${next}` : undefined;
      changed.add('attendance');
      setFieldState(plan, 'attendance', capped || /\b(about|around|roughly|approximately)\b/i.test(message) ? 'tentative' : 'confirmed', next);
      if (old && old !== next) {
        markReview(plan, 'venue');
        markReview(plan, 'staffing');
        systemMessages.push('Attendance changed, so Venue and Staffing need another look.');
      }
    }
  }

  const location = parseLocation(message);
  if (location?.city) {
    const changedLocation = Boolean(plan.city && normalize(plan.city) !== normalize(location.city));
    plan.city = location.city;
    if (location.state) plan.state = location.state;
    changed.add('location');
    setFieldState(plan, 'location', status, [plan.city, plan.state].filter(Boolean).join(', '));
    if (changedLocation) {
      markReview(plan, 'venue');
      markReview(plan, 'guests');
      systemMessages.push('Location changed, so Venue and Guest details need another look.');
    }
  }
  if (/\bdowntown\b/i.test(message)) {
    plan.venueAreaHint = 'Downtown';
    changed.add('venue preference');
    setFieldState(plan, 'venueAreaHint', status, 'Downtown');
  }

  const date = parseDate(message);
  const timeRange = parseTimeRange(message);
  if (date) {
    const weekdayText = message.match(/\b(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i)?.[1]?.toLowerCase();
    if (weekdayText) {
      const expected = WEEKDAYS[weekdayText];
      const parts = date.split('-').map(Number);
      const year = parts[0] ?? 0;
      const month = parts[1] ?? 0;
      const day = parts[2] ?? 0;
      if (expected !== undefined && year && month && day) {
        const actual = new Date(year, month - 1, day).getDay();
        if (expected !== actual) conflictMessage = `The weekday and date do not match. ${date} falls on a different day than ${weekdayText}. Which one should I use?`;
      }
    }
    plan.plannerDate = date;
    plan.datePreference = undefined;
    changed.add('date');
    setFieldState(plan, 'date', status, date);
  }
  const scheduleDate = date || plan.plannerDate || plan.startsAt?.slice(0, 10) || '';
  if (scheduleDate && timeRange.start) {
    plan.startsAt = dateTime(scheduleDate, timeRange.start);
    changed.add('start time');
    setFieldState(plan, 'startsAt', status, plan.startsAt);
  }
  if (scheduleDate && timeRange.end) {
    plan.endsAt = dateTime(scheduleDate, timeRange.end);
    if (plan.startsAt && new Date(plan.endsAt).getTime() <= new Date(plan.startsAt).getTime()) {
      plan.endsAt = undefined;
      conflictMessage = 'The end time needs to be after the start time. What end time should I use?';
    } else {
      changed.add('end time');
      setFieldState(plan, 'endsAt', status, plan.endsAt);
    }
  }

  if (/\bfree\b/.test(lower) && !/free[- ]?form/.test(lower)) {
    plan.paid = false;
    plan.priceCents = 0;
    changed.add('registration');
    setFieldState(plan, 'admission', 'confirmed', 'Free');
    clearReview(plan, 'registration');
  }
  const price = message.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (/\bpaid\b/.test(lower) || price) {
    plan.paid = true;
    if (price?.[1]) plan.priceCents = Math.round(Number(price[1]) * 100);
    changed.add('registration');
    setFieldState(plan, 'admission', price?.[1] ? 'confirmed' : status, price?.[1] ? `$${price[1]}` : 'Paid');
  }

  if (/\b(make it|set it|this is|event is)\s+private\b/.test(lower)) {
    plan.visibility = 'private';
    changed.add('visibility');
    setFieldState(plan, 'visibility', 'confirmed', 'Private');
  }
  if (/\b(make it|set it|this is|event is)\s+public\b/.test(lower)) {
    plan.visibility = 'public';
    changed.add('visibility');
    setFieldState(plan, 'visibility', 'confirmed', 'Public');
  }

  if (/\b(virtual|online|zoom)\b/.test(lower) && !/hybrid/.test(lower)) {
    plan.virtualEvent = true;
    plan.hybridEvent = false;
    markNotApplicable(plan, 'venue');
    changed.add('format');
    setFieldState(plan, 'format', 'confirmed', 'Virtual');
  }
  if (/\bhybrid\b/.test(lower)) {
    plan.hybridEvent = true;
    plan.virtualEvent = false;
    changed.add('format');
    setFieldState(plan, 'format', 'confirmed', 'Hybrid');
  }

  const venuePreferenceWords: [RegExp, string][] = [
    [/\bparking\b/, 'Parking important'],
    [/\b(upscale|luxury|elegant)\b/, 'More upscale'],
    [/\b(affordable|cheap|cheaper|budget)\b/, 'More affordable'],
    [/\b(private room|private space)\b/, 'Private room'],
    [/\b(airport|near the airport)\b/, 'Near airport'],
    [/\b(accessible|accessibility|wheelchair)\b/, 'Accessibility important'],
    [/\b(larger|large space|more space)\b/, 'Larger space'],
  ];
  const preferences = venuePreferenceWords.filter(([regex]) => regex.test(message)).map(([, label]) => label);
  if (preferences.length) {
    plan.venueSearchRefinement = unique([plan.venueSearchRefinement || '', ...preferences].filter(Boolean)).join(', ');
    changed.add('venue preference');
    setFieldState(plan, 'venuePreferences', status, plan.venueSearchRefinement);
  }

  if (/\b(remove|no)\s+(food|catering)\b/.test(lower)) {
    plan.components = (plan.components ?? []).filter((item) => item !== 'food');
    changed.add('food');
  } else if (/\b(food|catering|meal|light bites|refreshments)\b/.test(lower)) {
    addComponent(plan, 'food');
    changed.add('food');
  }
  if (/\b(vendor|vendors)\b/.test(lower)) addComponent(plan, 'vendors');
  if (/\b(staff|staffing|team members?|volunteers?)\b/.test(lower)) addComponent(plan, 'team');
  if (/\b(marketing|promotion|promote|social media)\b/.test(lower)) addComponent(plan, 'marketing');
  if (/\b(communication|reminder|email|text guests?)\b/.test(lower)) addComponent(plan, 'communications');
  if (/\b(budget|finance|costs?|expenses?|revenue|profit)\b/.test(lower)) addComponent(plan, 'finance');
  if (/\b(safety|security|emergency|waiver)\b/.test(lower)) addComponent(plan, 'safety');

  const delegated: { regex: RegExp; section: AiPlannerSection; component?: string }[] = [
    { regex: /\b(handle|build|do|plan)\s+(the\s+)?communications?\s+(plan\s+)?for me\b/, section: 'communications', component: 'communications' },
    { regex: /\b(handle|build|do|plan)\s+(the\s+)?staff(ing)?\s+(plan\s+)?for me\b/, section: 'staffing', component: 'team' },
    { regex: /\b(handle|build|do|plan)\s+(the\s+)?marketing\s+(plan\s+)?for me\b/, section: 'marketing', component: 'marketing' },
    { regex: /\b(handle|build|do|plan)\s+(the\s+)?safety\s+(plan\s+)?for me\b/, section: 'safety', component: 'safety' },
  ];
  for (const item of delegated) {
    if (!item.regex.test(lower)) continue;
    if (item.component) addComponent(plan, item.component);
    markRecommended(plan, item.section);
    changed.add(PLANNER_SECTION_LABELS[item.section]);
    systemMessages.push(`${PLANNER_SECTION_LABELS[item.section]} was added as an AI suggestion for review.`);
  }

  if (/\b(skip|leave)\s+(the\s+)?venue\b|\bskip for now\b/.test(lower)) {
    plan.venueDeferred = true;
    setFieldState(plan, 'venue', 'deferred');
    changed.add('venue');
  }

  if (before.category !== plan.category || before.title !== plan.title) {
    setFieldState(plan, 'eventIdentity', 'confirmed', `${plan.title || ''}|${plan.category || ''}`);
  }

  plan.plannerStep = undefined;
  return { plan, changedFields: [...changed], systemMessages, conflictMessage };
}

export function getWorkspaceProgress(planInput: AiPlanState) {
  const plan = planInput as V3PlanState;
  const fields = [
    Boolean(plan.title),
    Boolean(plan.category),
    Boolean(plan.startsAt),
    Boolean(plan.endsAt),
    Boolean(plan.virtualEvent || (plan.city && plan.state)),
  ];
  const complete = fields.filter(Boolean).length;
  return { complete, total: 5, ready: complete === 5 };
}

export function isPlanningDraftReady(plan: AiPlanState) {
  return Boolean(plan.title || plan.category);
}

function gapsFor(plan: V3PlanState) {
  const gaps: string[] = [];
  if (!plan.title) gaps.push('event title');
  if (!plan.category) gaps.push('event type');
  if (!plan.capacity && !plan.attendanceRange) gaps.push('attendance');
  if (!plan.startsAt) gaps.push(plan.plannerDate ? 'start time' : 'date and time');
  if (!plan.endsAt) gaps.push('end time');
  if (!plan.virtualEvent && (!plan.city || !plan.state)) gaps.push('location');
  if (plan.paid === undefined) gaps.push('admission');
  if (!plan.virtualEvent && !plan.venueName && !plan.venueDeferred) gaps.push('venue');
  return gaps;
}

function taskPacksFor(plan: V3PlanState) {
  const packs = ['communications', 'event_day'];
  const components = new Set(plan.components ?? []);
  if (components.has('food')) packs.push('food');
  if (components.has('vendors')) packs.push('vendors');
  if (components.has('equipment')) packs.push('equipment');
  if (components.has('marketing') || plan.paid) packs.push('marketing');
  if (components.has('safety')) packs.push('safety');
  if ((plan.requirements ?? []).some((item) => /waiver/i.test(item))) packs.push('waivers');
  return unique(packs);
}

function planningStage(plan: V3PlanState, readiness: number) {
  const workspace = getWorkspaceProgress(plan);
  if (workspace.ready && readiness >= 70) return 'ready_to_run' as const;
  if (workspace.ready || readiness >= 45) return 'coming_together' as const;
  if (isPlanningDraftReady(plan) || readiness >= 15) return 'taking_shape' as const;
  return 'idea' as const;
}

export function stageLabel(stage: AiPlannerV3Turn['stage']) {
  if (stage === 'ready_to_run') return 'Ready to run';
  if (stage === 'coming_together') return 'Coming together';
  if (stage === 'taking_shape') return 'Taking shape';
  return 'Idea';
}

function summarizeKnown(plan: V3PlanState, tenant: AiPlannerTenantContext) {
  return [
    plan.capacity ? `${plan.capacity} ${tenant.attendeeLabel}` : plan.attendanceRange || '',
    plan.city && plan.state ? `${plan.city}, ${plan.state}` : plan.virtualEvent ? 'Virtual' : '',
    plan.paid === false ? 'Free' : plan.paid && plan.priceCents ? `$${(plan.priceCents / 100).toFixed(plan.priceCents % 100 ? 2 : 0)}` : plan.paid ? 'Paid' : '',
  ].filter(Boolean).join(' · ');
}

function answerPlanningQuestion(message: string, plan: V3PlanState) {
  const lower = normalize(message);
  if (/\bdo i need (security|guards?)\b|\bsecurity\b.*\bneed\b/.test(lower)) {
    return 'Security needs depend on the venue, event size, alcohol, crowd profile and any venue or local requirements. I would keep Security as a safety review item until those details are known rather than assume it is required.';
  }
  if (/\bwhat should i charge\b|\bhow much should i charge\b/.test(lower)) {
    return 'Ticket price should come from the event costs, attendance target and revenue goal. If you give me a rough budget or target margin, I can help build a price instead of guessing.';
  }
  if (/\bhotel\b.*\bcowork|\bcowork.*\bhotel\b/.test(lower)) {
    const attendance = plan.capacity || 0;
    return `For ${attendance || 'this'} attendees, a hotel usually gives you stronger event infrastructure and service, while a coworking space can be simpler for a smaller professional mixer. I would rank both and compare parking, privacy, AV and the actual room setup.`;
  }
  return '';
}

function nextConversation(plan: V3PlanState, tenant: AiPlannerTenantContext, changedFields: string[], conflictMessage: string | null, questionAnswer: string) {
  if (conflictMessage) return { message: conflictMessage, options: [] as string[], activeSection: null as AiPlannerSection | null };
  if (questionAnswer) return { message: questionAnswer, options: ['Keep planning', 'Review plan'], activeSection: null as AiPlannerSection | null };

  const known = summarizeKnown(plan, tenant);
  const updatePrefix = changedFields.length >= 2 ? `I updated ${changedFields.slice(0, 4).join(', ')}${changedFields.length > 4 ? ' and more' : ''}. ` : changedFields.length === 1 ? `I updated ${changedFields[0]}. ` : '';

  if (!plan.category || !plan.title) {
    return { message: `${updatePrefix}What are you planning, and about how many people are you expecting?`, options: tenant.eventCategories.slice(0, 5), activeSection: 'basics' as const };
  }
  if (!plan.capacity && !plan.attendanceRange && !plan.startsAt && !plan.city) {
    return { message: `${updatePrefix}${plan.title} is saved as a planning draft. About how many people are you expecting, and do you have a date or area in mind yet?`, options: ['10 or fewer', '11–50', '51–100', '100+'], activeSection: 'basics' as const };
  }
  if (!plan.startsAt || !plan.endsAt) {
    if (plan.startsAt && !plan.endsAt) return { message: `${updatePrefix}I have the start time. About what time should it wrap up?`, options: ['Not sure yet'], activeSection: 'schedule' as const };
    if (plan.plannerDate && !plan.startsAt) return { message: `${updatePrefix}I have the date. What start and end time are you thinking?`, options: ['Not sure yet'], activeSection: 'schedule' as const };
    return { message: `${updatePrefix}${known ? `${known}. ` : ''}What date and time are you thinking? Include an end time if you know it.`, options: ['Not sure yet'], activeSection: 'schedule' as const };
  }
  if (!plan.virtualEvent && (!plan.city || !plan.state)) {
    return { message: `${updatePrefix}What city or area should I plan around? You can include a venue if you already have one.`, options: [], activeSection: 'venue' as const };
  }
  if (plan.paid === undefined) {
    return { message: `${updatePrefix}${known ? `${known}. ` : ''}Will this be free or paid? If paid, include the ticket price if you already know it.`, options: ['Free', 'Paid', 'Not decided'], activeSection: 'registration' as const };
  }

  if (getWorkspaceProgress(plan).ready) {
    return {
      message: `${updatePrefix}The core event setup is in place${known ? `: ${known}` : ''}. We can keep planning without filling every section right now.`,
      options: plan.virtualEvent ? ['Review plan', 'Communications', 'Guests'] : ['Find venues', 'Review plan', 'Communications', 'Guests'],
      activeSection: null,
    };
  }

  return {
    message: `${updatePrefix}${known ? `${known}. ` : ''}The plan is taking shape. We can work on the next useful piece whenever you are ready.`,
    options: ['Review plan', 'Venue', 'Registration', 'Communications'],
    activeSection: null,
  };
}

function sectionPrompt(section: AiPlannerSection, plan: V3PlanState) {
  switch (section) {
    case 'basics': return 'Tell me what you are planning and about how many people you expect. If you already know the audience or format, include that too.';
    case 'schedule': return plan.startsAt && !plan.endsAt ? 'I have the start. What time should the event wrap up?' : 'What date and time are you thinking? Include an end time if you know it.';
    case 'venue': return plan.virtualEvent ? 'This event is marked virtual, so a physical venue is not required.' : 'Do you already have a location in mind, or should I find real venue options around the area you want?';
    case 'registration': return 'Will this be free or paid? If paid, include the ticket price if you know it.';
    case 'guests': return 'What should guests know before they arrive, such as parking, check-in, dress code or what to bring?';
    case 'staffing': return 'Tell me what kind of help you expect to need, or say “handle the staffing plan for me” and I can suggest a starting structure.';
    case 'vendors': return 'Tell me which outside vendors or services you expect to use, or leave vendors open for now.';
    case 'communications': return 'Tell me how you want to communicate with attendees, or say “handle the communications plan for me” and I can suggest the schedule.';
    case 'marketing': return 'Tell me how you plan to promote the event, or ask me to build a starting marketing plan.';
    case 'finance': return 'Share any budget, cost or revenue target you already know. Rough numbers are fine.';
    case 'safety': return 'Tell me about any safety, security, waiver or emergency concerns. I will not assume requirements that depend on the venue or local rules.';
    case 'documents': return 'Tell me which documents, agreements, waivers or policies this event needs, if any.';
  }
}

function sectionOptions(section: AiPlannerSection, plan: V3PlanState) {
  if (section === 'venue') return plan.virtualEvent ? ['Mark not applicable'] : ['Recommend locations', 'I know the location', 'Leave open'];
  if (section === 'registration') return ['Free', 'Paid', 'Not decided'];
  if (section === 'communications') return ['Handle communications for me', 'Not decided'];
  if (section === 'staffing') return ['Handle staffing plan for me', 'Not decided'];
  return ['Not decided'];
}

function decorateFromV2(base: Awaited<ReturnType<typeof runAiPlannerV2Turn>>, original: V3PlanState, changedFields: string[] = []): AiPlannerV3Turn {
  const plan = copyPlan(base.plan);
  plan.fieldStates = { ...(original.fieldStates ?? {}), ...(plan.fieldStates ?? {}) };
  const stage = planningStage(plan, base.readiness);
  return {
    message: base.message,
    plan,
    readiness: base.readiness,
    stage,
    gaps: gapsFor(plan),
    options: base.options,
    recommendation: base.recommendation ?? null,
    taskPacks: base.taskPacks,
    activeSection: base.activeSection,
    command: base.command === 'create_draft' ? 'create_workspace' : base.command === 'review' ? 'review' : null,
    sectionStatuses: base.sectionStatuses,
    venueResults: base.venueResults,
    venueWarnings: base.venueWarnings,
    changedFields,
    systemMessages: changedFields.length ? [`Updated: ${changedFields.join(' · ')}`] : [],
    conflictMessage: null,
  };
}

export function reviewPlannerV3State(planInput: AiPlanState, tenant: AiPlannerTenantContext): AiPlannerV3Turn {
  const base = reviewPlannerState(planInput, tenant);
  return decorateFromV2(base, copyPlan(planInput));
}

function manualVenueTurn(planInput: V3PlanState, tenant: AiPlannerTenantContext, venueName: string): AiPlannerV3Turn {
  const plan = copyPlan(planInput);
  const changedVenue = Boolean(plan.venueName && normalize(plan.venueName) !== normalize(venueName));
  plan.venueName = venueName.trim();
  plan.venueSource = 'host_entered';
  plan.venueSourceLabel = 'Entered by host';
  plan.venueDeferred = false;
  addComponent(plan, 'venue');
  clearReview(plan, 'venue');
  setFieldState(plan, 'venue', 'confirmed', plan.venueName);
  if (changedVenue) {
    markReview(plan, 'guests');
    markReview(plan, 'staffing');
  }
  const statuses = getPlannerSectionStatuses(plan);
  const reviewed = reviewPlannerState(plan, tenant);
  return {
    message: `${plan.venueName} is set as the venue. ${changedVenue ? 'Guest and staffing details need another look because the venue changed.' : 'I kept venue-specific details separate so we can verify them before publishing.'}`,
    plan,
    readiness: reviewed.readiness,
    stage: planningStage(plan, reviewed.readiness),
    gaps: gapsFor(plan),
    options: ['Review plan', 'Keep planning'],
    recommendation: null,
    taskPacks: taskPacksFor(plan),
    activeSection: null,
    command: null,
    sectionStatuses: statuses,
    venueResults: [],
    venueWarnings: [],
    changedFields: ['venue'],
    systemMessages: ['Updated: venue'],
    conflictMessage: null,
  };
}

export async function runAiPlannerV3Turn(input: AiPlannerV3Input): Promise<AiPlannerV3Turn> {
  const message = input.message.trim();
  const original = copyPlan(input.plan);

  if (/^(review plan|review the plan|show me what is missing|what is missing)$/i.test(message) || input.action === 'review') {
    return reviewPlannerV3State(original, input.tenant);
  }
  if (/^(create|create it|create event|create workspace|create event workspace|ready to create|create draft)$/i.test(message) || input.action === 'create') {
    const reviewed = reviewPlannerV3State(original, input.tenant);
    const requiredGaps = reviewed.gaps.filter((gap) => ['event title','event type','date and time','start time','end time','location'].includes(gap));
    return {
      ...reviewed,
      message: getWorkspaceProgress(original).ready
        ? 'The core event record is ready. I can create the Event Workspace now.'
        : `The planning draft is saved, but the Event Workspace still needs ${requiredGaps.join(', ') || 'a few core details'}.`,
      command: getWorkspaceProgress(original).ready ? 'create_workspace' : null,
    };
  }

  if (/^i know the location$/i.test(message) && (input.section === 'venue' || !original.venueName)) {
    const reviewed = reviewPlannerState(original, input.tenant);
    return {
      ...decorateFromV2(reviewed, original),
      message: 'What venue, address or meeting place should I use?',
      options: ['Leave open'],
      activeSection: 'venue',
    };
  }

  if (input.action === 'venue_select' || input.action === 'venue_search_more' || (input.action === 'recommend' && input.section === 'venue') || /^(recommend locations|find venues|search again)$/i.test(message)) {
    const base = await runAiPlannerV2Turn({ ...input, plan: original, action: input.action ?? 'recommend', section: 'venue' });
    return decorateFromV2(base, original, input.action === 'venue_select' && input.venueCandidate ? ['venue'] : []);
  }

  if (input.action === 'section' && input.section) {
    const plan = copyPlan(original);
    const statuses = getPlannerSectionStatuses(plan);
    const reviewed = reviewPlannerState(plan, input.tenant);
    return {
      message: sectionPrompt(input.section, plan),
      plan,
      readiness: reviewed.readiness,
      stage: planningStage(plan, reviewed.readiness),
      gaps: gapsFor(plan),
      options: sectionOptions(input.section, plan),
      recommendation: null,
      taskPacks: taskPacksFor(plan),
      activeSection: input.section,
      command: null,
      sectionStatuses: statuses,
      venueResults: [],
      venueWarnings: [],
      changedFields: [],
      systemMessages: [],
      conflictMessage: null,
    };
  }

  if (/^not decided$|^not sure yet$|^leave open$|^skip for now$/i.test(message)) {
    const plan = copyPlan(original);
    const section = input.section ?? null;
    if (section === 'venue') {
      plan.venueDeferred = true;
      setFieldState(plan, 'venue', 'deferred');
    } else if (section) {
      setFieldState(plan, section, 'deferred');
    }
    const statuses = getPlannerSectionStatuses(plan);
    const reviewed = reviewPlannerState(plan, input.tenant);
    return {
      message: `${section ? PLANNER_SECTION_LABELS[section] : 'That decision'} can stay open for now. Your planning draft is still moving forward.`,
      plan,
      readiness: reviewed.readiness,
      stage: planningStage(plan, reviewed.readiness),
      gaps: gapsFor(plan),
      options: ['Keep planning', 'Review plan'],
      recommendation: null,
      taskPacks: taskPacksFor(plan),
      activeSection: null,
      command: null,
      sectionStatuses: statuses,
      venueResults: [],
      venueWarnings: [],
      changedFields: section ? [PLANNER_SECTION_LABELS[section]] : [],
      systemMessages: ['Decision left open'],
      conflictMessage: null,
    };
  }

  const locationOnly = parseLocation(message);
  const looksLikeVenueName = input.section === 'venue'
    && !locationOnly
    && message.length <= 120
    && !/[?]/.test(message)
    && !/\b(people|attendees|guests|free|paid|october|november|december|january|february|march|april|may|june|july|august|september)\b/i.test(message);
  if (looksLikeVenueName) return manualVenueTurn(original, input.tenant, message);

  const extracted = extractFacts(message, original, input.tenant);
  const plan = extracted.plan;

  if (/^(10 or fewer|11[–-]50|51[–-]100|100\+)$/i.test(message)) {
    if (/10 or fewer/i.test(message)) {
      plan.capacity = 10;
      plan.attendanceRange = '10 or fewer';
    } else if (/11[–-]50/.test(message)) {
      plan.capacity = undefined;
      plan.attendanceRange = '11–50';
    } else if (/51[–-]100/.test(message)) {
      plan.capacity = undefined;
      plan.attendanceRange = '51–100';
    } else {
      plan.capacity = undefined;
      plan.attendanceRange = '100+';
    }
    setFieldState(plan, 'attendance', 'tentative', plan.capacity ?? plan.attendanceRange);
    if (!extracted.changedFields.includes('attendance')) extracted.changedFields.push('attendance');
  }

  if (/^free$/i.test(message)) {
    plan.paid = false;
    plan.priceCents = 0;
    setFieldState(plan, 'admission', 'confirmed', 'Free');
    if (!extracted.changedFields.includes('registration')) extracted.changedFields.push('registration');
  }
  if (/^paid$/i.test(message)) {
    plan.paid = true;
    setFieldState(plan, 'admission', 'tentative', 'Paid');
    if (!extracted.changedFields.includes('registration')) extracted.changedFields.push('registration');
  }

  const questionAnswer = message.includes('?') ? answerPlanningQuestion(message, plan) : '';
  const statuses = getPlannerSectionStatuses(plan);
  const reviewed = reviewPlannerState(plan, input.tenant);
  const conversation = nextConversation(plan, input.tenant, extracted.changedFields, extracted.conflictMessage, questionAnswer);
  const systemMessages = [...extracted.systemMessages];
  if (extracted.changedFields.length) systemMessages.unshift(`Updated: ${extracted.changedFields.join(' · ')}`);

  return {
    message: conversation.message,
    plan,
    readiness: reviewed.readiness,
    stage: planningStage(plan, reviewed.readiness),
    gaps: gapsFor(plan),
    options: conversation.options,
    recommendation: null,
    taskPacks: taskPacksFor(plan),
    activeSection: conversation.activeSection,
    command: null,
    sectionStatuses: statuses,
    venueResults: [],
    venueWarnings: [],
    changedFields: extracted.changedFields,
    systemMessages,
    conflictMessage: extracted.conflictMessage,
  };
}

export function compactSectionOrder(statuses: Record<AiPlannerSection, AiPlannerSectionStatus>, tenant: AiPlannerTenantContext) {
  const priority: Record<AiPlannerSectionStatus, number> = { needs_review: 0, in_progress: 1, not_started: 2, complete: 3, not_applicable: 4 };
  const sections = tenant.sections.length ? tenant.sections : DEFAULT_PLANNER_SECTIONS;
  return [...sections].sort((a, b) => priority[statuses[a]] - priority[statuses[b]]);
}
