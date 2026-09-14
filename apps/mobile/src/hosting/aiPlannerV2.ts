import { supabase } from '../lib/supabase';
import { generateHostCopilotPlan } from './copilot';
import {
  DEFAULT_PLANNER_SECTIONS,
  PLANNER_SECTION_LABELS,
  getAiPlannerTenantContext,
  type AiPlannerSection,
  type AiPlannerSectionStatus,
  type AiPlannerTenantContext,
} from './aiPlannerTenant';
import {
  getAiPrivacyPreferences,
  type AiPlanState,
  type AiPlannerTurn,
  type AiPrivacyPreferences,
} from './aiPlanner';

type PlannerHistory = { role: 'user' | 'assistant'; text: string }[];

export type AiPlannerV2Action = 'continue' | 'section' | 'recommend' | 'review' | 'create';
export type AiPlannerV2Command = 'create_draft' | 'review' | null;

export type AiPlannerV2Turn = AiPlannerTurn & {
  activeSection: AiPlannerSection | null;
  command: AiPlannerV2Command;
  sectionStatuses: Record<AiPlannerSection, AiPlannerSectionStatus>;
};

export type AiPlannerV2Input = {
  message: string;
  plan: AiPlanState;
  history: PlannerHistory;
  tenant?: AiPlannerTenantContext;
  section?: AiPlannerSection | null;
  action?: AiPlannerV2Action;
};

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

const SECTION_MARKER = '__planner_na_';
const RECOMMENDED_MARKER = '__planner_recommended_';

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function titleCase(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function copyPlan(current: AiPlanState): AiPlanState {
  return {
    ...current,
    components: Array.isArray(current.components) ? [...current.components] : [],
    requirements: Array.isArray(current.requirements) ? [...current.requirements] : [],
    safetyNotes: Array.isArray(current.safetyNotes) ? [...current.safetyNotes] : [],
  };
}

function normalizeState(value: string) {
  const cleaned = value.trim().replace(/[.]/g, '');
  if (/^[A-Za-z]{2}$/.test(cleaned)) return cleaned.toUpperCase();
  return STATE_NAMES[cleaned.toLowerCase()] ?? '';
}

function parseCityState(value: string) {
  const cleaned = value.trim().replace(/^in\s+/i, '');
  const commaMatch = cleaned.match(/^(.+?),\s*(.+)$/);
  if (commaMatch) {
    const state = normalizeState(commaMatch[2] ?? '');
    return { city: titleCase(commaMatch[1] ?? ''), state };
  }
  return { city: titleCase(cleaned), state: '' };
}

function parseInlineLocation(message: string) {
  const match = message.match(/\bin\s+([a-z .'-]+?)(?:,\s*([a-z]{2}|[a-z ]+))?(?:\s+(?:for|with|on|at|next|this|and)\b|[,.!?]|$)/i);
  if (!match) return null;
  const city = titleCase(match[1] ?? '');
  const state = normalizeState(match[2] ?? '');
  return city ? { city, state } : null;
}

function parseExactDate(value: string) {
  const text = value.trim();
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else {
    const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}|\d{2}))?\b/);
    if (slash) {
      month = Number(slash[1]); day = Number(slash[2]);
      year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : new Date().getFullYear();
    } else {
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const monthMatch = text.toLowerCase().match(new RegExp(`\\b(${months.join('|')})\\s+(\\d{1,2})(?:,?\\s+(20\\d{2}))?\\b`));
      if (monthMatch) {
        month = months.indexOf(monthMatch[1] ?? '') + 1;
        day = Number(monthMatch[2]);
        year = monthMatch[3] ? Number(monthMatch[3]) : new Date().getFullYear();
      }
    }
  }
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function parseTime(value: string) {
  const text = value.trim().toLowerCase();
  const ampm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return '';
    if (ampm[3] === 'pm' && hour !== 12) hour += 12;
    if (ampm[3] === 'am' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return twentyFour ? `${Number(twentyFour[1]).toString().padStart(2, '0')}:${twentyFour[2]}` : '';
}

function dateTime(date: string, time: string) {
  return date && time ? `${date}T${time}` : '';
}

function marker(section: AiPlannerSection) {
  return `${SECTION_MARKER}${section}__`;
}

function recommendationMarker(section: AiPlannerSection) {
  return `${RECOMMENDED_MARKER}${section}__`;
}

function isNotApplicable(plan: AiPlanState, section: AiPlannerSection) {
  return (plan.requirements ?? []).includes(marker(section));
}

function markNotApplicable(plan: AiPlanState, section: AiPlannerSection) {
  plan.requirements = unique([...(plan.requirements ?? []).filter((item) => item !== recommendationMarker(section)), marker(section)]);
}

function markRecommended(plan: AiPlanState, section: AiPlannerSection) {
  plan.requirements = unique([...(plan.requirements ?? []).filter((item) => item !== marker(section)), recommendationMarker(section)]);
}

function addComponent(plan: AiPlanState, component: string) {
  plan.components = unique([...(plan.components ?? []), component]);
}

function removeComponent(plan: AiPlanState, component: string) {
  plan.components = (plan.components ?? []).filter((item) => item !== component);
}

function hasComponent(plan: AiPlanState, component: string) {
  return (plan.components ?? []).includes(component);
}

function inferEventIdea(message: string, plan: AiPlanState, tenant: AiPlannerTenantContext) {
  const lower = normalize(message);
  const types: { match: RegExp; category: string; title: string }[] = [
    { match: /\b(networking|networker|mixer)\b/, category: 'Networking', title: 'Networking Event' },
    { match: /\b(workshop|class|seminar)\b/, category: 'Workshop', title: 'Workshop' },
    { match: /\b(conference|summit|convention)\b/, category: 'Conference', title: 'Conference' },
    { match: /\b(fundraiser|fundraising|charity event)\b/, category: 'Fundraiser', title: 'Fundraiser' },
    { match: /\b(gala|awards? dinner|awards? ceremony)\b/, category: 'Gala / Awards', title: 'Gala / Awards Event' },
    { match: /\b(vendor market|marketplace|pop[- ]?up|vendor fair)\b/, category: 'Vendor Market / Pop-up', title: 'Vendor Market' },
    { match: /\b(employee training|team training|staff training|team event|company retreat)\b/, category: 'Employee / Team Event', title: 'Team Event' },
    { match: /\b(private party|birthday|anniversary|celebration)\b/, category: 'Private Event', title: 'Private Event' },
    { match: /\b(virtual event|webinar|online event)\b/, category: 'Virtual Event', title: 'Virtual Event' },
    { match: /\b(nature walk|hike|hiking|kayak|paddle|canoe|camping|campout|outdoor event)\b/, category: 'Outdoor Event', title: 'Outdoor Event' },
  ];

  if (!plan.category || !plan.title) {
    const inferred = types.find((item) => item.match.test(lower));
    if (inferred) {
      if (!plan.category) plan.category = tenant.eventCategories.includes(inferred.category) ? inferred.category : inferred.category;
      if (!plan.title) plan.title = inferred.title;
      if (!plan.summary) plan.summary = `A ${inferred.category.toLowerCase()} event.`;
      if (!plan.description) plan.description = plan.summary;
    }
  }

  if (!plan.category) {
    const exact = tenant.eventCategories.find((category) => normalize(category) === lower);
    if (exact) {
      plan.category = exact;
      plan.title = plan.title || (exact === 'Other' ? 'New Event' : `${exact.replace(/\s*\/.*$/, '')} Event`);
      plan.summary = plan.summary || `A ${exact.toLowerCase()} event.`;
      plan.description = plan.description || plan.summary;
    }
  }

  const location = parseInlineLocation(message);
  if (location) {
    if (!plan.city) plan.city = location.city;
    if (!plan.state && location.state) plan.state = location.state;
  }
}

function applyContradictions(message: string, plan: AiPlanState) {
  const lower = normalize(message);
  const explicitAttendance = lower.match(/\b(\d{1,4})\s*(people|guests|attendees|persons)\b/);
  if (explicitAttendance) {
    plan.capacity = Number(explicitAttendance[1]);
    plan.attendanceRange = undefined;
  }

  const changeCapacity = message.match(/(?:change|set|make|update).{0,18}(?:capacity|attendance|guest count).{0,12}(\d{1,4})/i);
  if (changeCapacity) {
    plan.capacity = Number(changeCapacity[1]);
    plan.attendanceRange = undefined;
  }

  const changeCity = message.match(/(?:change|move|set|make).{0,16}(?:city|location).{0,10}(?:to\s+)?(.+)/i);
  if (changeCity) {
    const parsed = parseCityState(changeCity[1] ?? '');
    if (parsed.city) plan.city = parsed.city;
    plan.state = parsed.state || undefined;
    plan.venueName = undefined;
    plan.meetingInstructions = undefined;
    plan.venueDeferred = false;
    plan.arrivalDeferred = false;
  }

  if (/\b(make it|switch to|this is)\s+free\b/.test(lower)) {
    plan.paid = false;
    plan.priceCents = 0;
  }
  if (/\b(make it|switch to|this is)\s+paid\b/.test(lower)) {
    plan.paid = true;
    plan.priceCents = undefined;
  }
  if (/\bremove\s+(catering|food)\b/.test(lower)) removeComponent(plan, 'food');
  if (/\b(add|include)\s+(a\s+)?vendor/.test(lower)) addComponent(plan, 'vendors');
  if (/\b(add|include)\s+communications?\b/.test(lower)) addComponent(plan, 'communications');
  if (/\b(make it|set it|event is)\s+private\b/.test(lower)) {
    plan.requirements = unique([...(plan.requirements ?? []).filter((item) => !item.startsWith('Visibility:')), 'Visibility: private']);
  }
}

function applyPlannerStep(message: string, plan: AiPlanState) {
  const lower = normalize(message);
  let error = '';
  if (plan.plannerStep === 'city') {
    const parsed = parseCityState(message);
    if (parsed.city) plan.city = parsed.city;
    if (parsed.state) plan.state = parsed.state;
    plan.plannerStep = plan.state ? undefined : 'state';
  } else if (plan.plannerStep === 'state') {
    const state = normalizeState(message);
    if (state) {
      plan.state = state;
      plan.plannerStep = undefined;
    } else error = 'Enter a state name or two-letter abbreviation, such as Florida or FL.';
  } else if (plan.plannerStep === 'date') {
    const parsedDate = parseExactDate(message);
    if (parsedDate) {
      plan.plannerDate = parsedDate;
      const time = parseTime(message);
      if (time) {
        plan.startsAt = dateTime(parsedDate, time);
        plan.plannerStep = 'end_time';
      } else plan.plannerStep = 'start_time';
    } else if (lower === 'not sure yet') {
      plan.datePreference = 'Open';
      plan.plannerStep = undefined;
    } else error = 'Give me the exact date, for example October 17, 2026 or 10/17/2026.';
  } else if (plan.plannerStep === 'start_time') {
    const time = parseTime(message);
    if (time && plan.plannerDate) {
      plan.startsAt = dateTime(plan.plannerDate, time);
      plan.plannerStep = 'end_time';
    } else error = 'What start time should I use? Include AM or PM, for example 10 AM.';
  } else if (plan.plannerStep === 'end_time') {
    const time = parseTime(message);
    if (time && plan.plannerDate) {
      const candidate = dateTime(plan.plannerDate, time);
      if (!plan.startsAt || new Date(candidate).getTime() > new Date(plan.startsAt).getTime()) {
        plan.endsAt = candidate;
        plan.plannerStep = undefined;
      } else error = 'The end time needs to be after the start time.';
    } else error = 'What end time should I use? Include AM or PM.';
  } else if (plan.plannerStep === 'venue' || plan.plannerStep === 'venue_choice') {
    if (!['i know the location', 'recommend locations', 'skip for now'].includes(lower)) {
      plan.venueName = message.trim();
      plan.venueDeferred = false;
      plan.plannerStep = undefined;
    }
  } else if (plan.plannerStep === 'arrival') {
    if (!['recommend for me', 'skip for now'].includes(lower)) {
      plan.meetingInstructions = message.trim();
      plan.arrivalDeferred = false;
      plan.plannerStep = undefined;
    }
  } else if (plan.plannerStep === 'price') {
    const price = message.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
    if (price) {
      plan.priceCents = Math.round(Number(price[1]) * 100);
      plan.plannerStep = undefined;
    } else error = 'What should one general-admission ticket cost?';
  } else if (plan.plannerStep === 'backup') {
    if (!['recommend a backup', 'skip for now'].includes(lower)) {
      plan.backupPlan = message.trim();
      plan.backupDeferred = false;
      plan.plannerStep = undefined;
    }
  }
  return error;
}

function statusFromProgress(started: boolean, complete: boolean): AiPlannerSectionStatus {
  if (complete) return 'complete';
  return started ? 'in_progress' : 'not_started';
}

export function getPlannerSectionStatuses(plan: AiPlanState): Record<AiPlannerSection, AiPlannerSectionStatus> {
  const components = new Set(plan.components ?? []);
  const requirements = new Set(plan.requirements ?? []);
  const result = {} as Record<AiPlannerSection, AiPlannerSectionStatus>;

  for (const section of DEFAULT_PLANNER_SECTIONS) {
    if (requirements.has(marker(section))) {
      result[section] = 'not_applicable';
      continue;
    }
    switch (section) {
      case 'basics':
        result[section] = statusFromProgress(Boolean(plan.title || plan.category), Boolean(plan.title && plan.category && (plan.capacity || plan.attendanceRange)));
        break;
      case 'schedule':
        result[section] = statusFromProgress(Boolean(plan.startsAt || plan.datePreference || plan.plannerDate), Boolean(plan.startsAt && plan.endsAt));
        break;
      case 'venue':
        result[section] = statusFromProgress(Boolean(plan.city || plan.state || plan.venueDeferred), Boolean(plan.city && plan.state && (plan.venueName || plan.venueDeferred)));
        break;
      case 'registration':
        result[section] = statusFromProgress(plan.paid !== undefined, plan.paid === false || (plan.paid === true && Number(plan.priceCents || 0) > 0));
        break;
      case 'guests':
        result[section] = statusFromProgress(Boolean(plan.capacity || plan.attendanceRange || plan.meetingInstructions), Boolean((plan.capacity || plan.attendanceRange) && (plan.meetingInstructions || plan.arrivalDeferred)));
        break;
      case 'staffing':
        result[section] = components.has('team') ? (requirements.has(recommendationMarker(section)) ? 'complete' : 'in_progress') : 'not_started';
        break;
      case 'vendors':
        result[section] = components.has('vendors') ? (requirements.has(recommendationMarker(section)) ? 'complete' : 'in_progress') : 'not_started';
        break;
      case 'communications':
        result[section] = components.has('communications') ? (requirements.has(recommendationMarker(section)) ? 'complete' : 'in_progress') : 'not_started';
        break;
      case 'marketing':
        result[section] = components.has('marketing') ? (requirements.has(recommendationMarker(section)) ? 'complete' : 'in_progress') : 'not_started';
        break;
      case 'finance':
        result[section] = components.has('finance') ? (requirements.has(recommendationMarker(section)) ? 'complete' : 'in_progress') : 'not_started';
        break;
      case 'safety':
        result[section] = statusFromProgress(Boolean(plan.safetyNotes?.length || plan.backupPlan), Boolean(plan.safetyNotes?.length && (plan.backupPlan || plan.backupDeferred)));
        break;
      case 'documents':
        result[section] = requirements.has(recommendationMarker(section)) ? 'complete' : 'not_started';
        break;
    }
  }
  return result;
}

function readinessFromSections(statuses: Record<AiPlannerSection, AiPlannerSectionStatus>, tenant: AiPlannerTenantContext) {
  const applicable = tenant.sections.filter((section) => statuses[section] !== 'not_applicable');
  if (!applicable.length) return 0;
  const points = applicable.reduce((total, section) => {
    const state = statuses[section];
    if (state === 'complete') return total + 1;
    if (state === 'in_progress') return total + 0.5;
    if (state === 'needs_review') return total + 0.25;
    return total;
  }, 0);
  return Math.round((points / applicable.length) * 100);
}

function gapsFor(plan: AiPlanState, tenant: AiPlannerTenantContext, statuses: Record<AiPlannerSection, AiPlannerSectionStatus>) {
  const gaps: string[] = [];
  if (!plan.title) gaps.push('Event title');
  if (!plan.category) gaps.push('Event type');
  if (!plan.capacity && !plan.attendanceRange) gaps.push('Expected attendance');
  if (!plan.startsAt) gaps.push('Date and start time');
  if (!plan.endsAt) gaps.push('End time');
  if (!plan.city) gaps.push('City');
  if (!plan.state) gaps.push('State');
  if (!plan.venueName && !plan.venueDeferred) gaps.push('Venue');
  if (plan.paid === undefined && statuses.registration !== 'not_applicable') gaps.push('Admission model');
  return unique(gaps).slice(0, 20);
}

function taskPacksFor(plan: AiPlanState) {
  const packs = ['communications', 'event_day'];
  const category = normalize(plan.category || '');
  if (hasComponent(plan, 'food')) packs.push('food');
  if (hasComponent(plan, 'vendors')) packs.push('vendors');
  if (hasComponent(plan, 'equipment')) packs.push('equipment');
  if (hasComponent(plan, 'marketing') || plan.paid) packs.push('marketing');
  if (hasComponent(plan, 'safety') || /outdoor|hiking|paddling|camping|kayak|canoe/.test(category)) packs.push('safety');
  if ((plan.requirements ?? []).some((item) => /waiver/i.test(item))) packs.push('waivers');
  return unique(packs);
}

function canCreateEventRecord(plan: AiPlanState) {
  return Boolean(plan.title && plan.city && plan.state && plan.startsAt && plan.endsAt);
}

function draftMissing(plan: AiPlanState) {
  return [
    !plan.title ? 'title' : '',
    !plan.city ? 'city' : '',
    !plan.state ? 'state' : '',
    !plan.startsAt ? 'date and start time' : '',
    !plan.endsAt ? 'end time' : '',
  ].filter(Boolean);
}

function defaultSafetyNotes(plan: AiPlanState) {
  const category = normalize(plan.category || '');
  const notes = ['Confirm venue emergency procedures and a host contact before the event.', 'Define check-in and incident escalation for the event team.'];
  if (/outdoor|hiking|paddling|camping|kayak|canoe/.test(category)) notes.push('Confirm current weather, access and activity conditions before attendee communications are sent.');
  return notes;
}

function backupSuggestion(plan: AiPlanState) {
  const category = normalize(plan.category || '');
  if (/virtual/.test(category)) return 'Keep a backup meeting link and a host contact ready in case the primary platform has an issue.';
  if (/outdoor|hiking|paddling|camping|kayak|canoe/.test(category)) return 'Choose an alternate location, adjusted activity or reschedule rule if weather, access or conditions change. Confirm the final option before notifying attendees.';
  return 'Keep an alternate room or venue option, a delay or reschedule rule, and one person responsible for notifying attendees if the primary plan changes.';
}

function reviewMessage(plan: AiPlanState, tenant: AiPlannerTenantContext, statuses: Record<AiPlannerSection, AiPlannerSectionStatus>) {
  const location = [plan.venueName, plan.city, plan.state].filter(Boolean).join(', ') || 'location open';
  const attendance = plan.capacity ? `${plan.capacity} ${tenant.attendeeLabel}` : plan.attendanceRange || 'attendance open';
  const open = tenant.sections.filter((section) => statuses[section] === 'not_started' || statuses[section] === 'in_progress' || statuses[section] === 'needs_review');
  const openLabels = open.slice(0, 5).map((section) => PLANNER_SECTION_LABELS[section]).join(', ');
  return `Plan check: ${plan.title || 'Untitled event'} · ${plan.category || 'type open'} · ${location} · ${attendance}. ${open.length ? `Still open: ${openLabels}${open.length > 5 ? ' and more' : ''}.` : 'All selected planning sections are complete.'}`;
}

function makeTurn(input: {
  message: string;
  plan: AiPlanState;
  tenant: AiPlannerTenantContext;
  activeSection?: AiPlannerSection | null;
  options?: string[];
  recommendation?: AiPlannerTurn['recommendation'];
  command?: AiPlannerV2Command;
}): AiPlannerV2Turn {
  const statuses = getPlannerSectionStatuses(input.plan);
  const readiness = readinessFromSections(statuses, input.tenant);
  return {
    message: input.message,
    plan: input.plan,
    readiness,
    stage: readiness >= 85 ? 'ready' : readiness >= 65 ? 'confidence' : readiness >= 30 ? 'momentum' : 'possibility',
    gaps: gapsFor(input.plan, input.tenant, statuses),
    options: input.options ?? [],
    recommendation: input.recommendation ?? null,
    taskPacks: taskPacksFor(input.plan),
    activeSection: input.activeSection ?? null,
    command: input.command ?? null,
    sectionStatuses: statuses,
  };
}

function sectionTurn(section: AiPlannerSection, plan: AiPlanState, tenant: AiPlannerTenantContext): AiPlannerV2Turn {
  if (isNotApplicable(plan, section)) {
    return makeTurn({ message: `${PLANNER_SECTION_LABELS[section]} is marked not required. You can add it back at any time.`, plan, tenant, activeSection: section, options: ['Add it back', 'Review plan'] });
  }

  if (section === 'basics') {
    if (!plan.category) return makeTurn({ message: 'What kind of event are you planning?', plan, tenant, activeSection: section, options: tenant.eventCategories.slice(0, 6) });
    if (!plan.title) return makeTurn({ message: 'What should this event be called?', plan, tenant, activeSection: section });
    if (!plan.capacity && !plan.attendanceRange) return makeTurn({ message: `About how many ${tenant.attendeeLabel} are you planning for?`, plan, tenant, activeSection: section, options: ['10 or fewer', '10–25', '25–50', '50+', 'Not sure yet'] });
    return makeTurn({ message: `Basics are set for ${plan.title}. You can change the title, event type or attendance at any time.`, plan, tenant, activeSection: section, options: ['Review plan', 'Date & schedule', 'Venue'] });
  }

  if (section === 'schedule') {
    if (!plan.startsAt) {
      plan.plannerStep = 'date';
      return makeTurn({ message: 'What exact date should I use?', plan, tenant, activeSection: section, options: ['Not sure yet'] });
    }
    if (!plan.endsAt) {
      plan.plannerStep = 'end_time';
      return makeTurn({ message: 'What time should the event end?', plan, tenant, activeSection: section });
    }
    return makeTurn({ message: 'The date and time are set. Tell me a new date or time if you want to change them.', plan, tenant, activeSection: section, options: ['Change date', 'Review plan'] });
  }

  if (section === 'venue') {
    if (!plan.city) {
      plan.plannerStep = 'city';
      return makeTurn({ message: 'What city should I plan around?', plan, tenant, activeSection: section });
    }
    if (!plan.state) {
      plan.plannerStep = 'state';
      return makeTurn({ message: `What state is ${plan.city} in?`, plan, tenant, activeSection: section });
    }
    if (!plan.venueName && !plan.venueDeferred) return makeTurn({ message: `Do you have a venue in ${plan.city}, ${plan.state}, or should I recommend options?`, plan, tenant, activeSection: section, options: ['Recommend locations', 'I know the location', 'Skip for now'] });
    return makeTurn({ message: plan.venueName ? `Venue set to ${plan.venueName}.` : 'Venue is open for now.', plan, tenant, activeSection: section, options: ['Recommend locations', 'Change location', 'Review plan'] });
  }

  if (section === 'registration') {
    if (plan.paid === undefined) return makeTurn({ message: 'Will this event be free or paid?', plan, tenant, activeSection: section, options: ['Free', 'Paid', 'Not required'] });
    if (plan.paid && !plan.priceCents) {
      plan.plannerStep = 'price';
      return makeTurn({ message: 'What should one general-admission ticket cost?', plan, tenant, activeSection: section });
    }
    return makeTurn({ message: plan.paid ? `Paid registration is set at $${((plan.priceCents ?? 0) / 100).toFixed(2)}.` : 'This event is set as free.', plan, tenant, activeSection: section, options: ['Free', 'Paid', 'Review plan'] });
  }

  if (section === 'guests') {
    if (!plan.capacity && !plan.attendanceRange) return makeTurn({ message: `About how many ${tenant.attendeeLabel} are you planning for?`, plan, tenant, activeSection: section, options: ['10 or fewer', '10–25', '25–50', '50+', 'Not sure yet'] });
    if (!plan.meetingInstructions && !plan.arrivalDeferred) {
      plan.plannerStep = 'arrival';
      return makeTurn({ message: `What should ${tenant.attendeeLabel} know about arrival, parking, access or check-in?`, plan, tenant, activeSection: section, options: ['Recommend for me', 'Skip for now'] });
    }
    return makeTurn({ message: 'Guest planning is set for now.', plan, tenant, activeSection: section, options: ['Review plan', 'Communications'] });
  }

  if (section === 'staffing') return makeTurn({ message: 'Do you want assigned staff or team roles for this event?', plan, tenant, activeSection: section, options: ['Add staffing', 'Recommend for me', 'Not required'] });
  if (section === 'vendors') return makeTurn({ message: 'Will this event use outside vendors or service providers?', plan, tenant, activeSection: section, options: ['Add vendors', 'Recommend for me', 'Not required'] });
  if (section === 'communications') return makeTurn({ message: `I can set a basic communication plan for ${tenant.attendeeLabel}: confirmation, one-week reminder, day-before update, event-day update and post-event follow-up.`, plan, tenant, activeSection: section, options: ['Use communication plan', 'Customize', 'Not required'] });
  if (section === 'marketing') return makeTurn({ message: 'Does this event need promotion or a campaign plan?', plan, tenant, activeSection: section, options: ['Add marketing', 'Recommend for me', 'Not required'] });
  if (section === 'finance') return makeTurn({ message: 'Do you want to track the event budget, revenue, expenses and payments?', plan, tenant, activeSection: section, options: ['Track event finances', 'Not required'] });
  if (section === 'safety') return makeTurn({ message: 'I can add a practical event safety checklist and a change-of-plan backup. The details should match the venue and event type.', plan, tenant, activeSection: section, options: ['Use safety checklist', 'Recommend a backup', 'Not required'] });
  return makeTurn({ message: 'Will this event need waivers, agreements, permits or other attendee documents?', plan, tenant, activeSection: section, options: ['Add documents', 'Not required'] });
}

function nextUsefulTurn(plan: AiPlanState, tenant: AiPlannerTenantContext): AiPlannerV2Turn {
  if (!plan.category || !plan.title || (!plan.capacity && !plan.attendanceRange)) return sectionTurn('basics', plan, tenant);
  if (!plan.city || !plan.state || (!plan.venueName && !plan.venueDeferred)) return sectionTurn('venue', plan, tenant);
  if (!plan.startsAt || !plan.endsAt) return sectionTurn('schedule', plan, tenant);
  if (plan.paid === undefined && !isNotApplicable(plan, 'registration')) return sectionTurn('registration', plan, tenant);
  if (!plan.meetingInstructions && !plan.arrivalDeferred) return sectionTurn('guests', plan, tenant);

  if (canCreateEventRecord(plan)) {
    const statuses = getPlannerSectionStatuses(plan);
    const open = tenant.sections.filter((section) => statuses[section] === 'not_started' || statuses[section] === 'in_progress');
    return makeTurn({
      message: `You have enough information to create the event draft. ${open.length} planning section${open.length === 1 ? ' remains' : 's remain'} open and can be finished later.`,
      plan,
      tenant,
      options: ['Create draft', 'Review plan', ...(open[0] ? [PLANNER_SECTION_LABELS[open[0]]] : [])],
    });
  }
  return sectionTurn('basics', plan, tenant);
}

function applyChoice(message: string, plan: AiPlanState, tenant: AiPlannerTenantContext, section: AiPlannerSection | null) {
  const lower = normalize(message);
  const exactCategory = tenant.eventCategories.find((category) => normalize(category) === lower);
  if (exactCategory) {
    plan.category = exactCategory;
    if (!plan.title || plan.title === 'New Event') plan.title = exactCategory === 'Other' ? 'New Event' : `${exactCategory.replace(/\s*\/.*$/, '')} Event`;
  }

  if (lower === '10 or fewer') { plan.attendanceRange = '10 or fewer'; plan.capacity = undefined; }
  if (lower === '10–25' || lower === '10-25') { plan.attendanceRange = '10–25'; plan.capacity = undefined; }
  if (lower === '25–50' || lower === '25-50') { plan.attendanceRange = '25–50'; plan.capacity = undefined; }
  if (lower === '50+') { plan.attendanceRange = '50+'; plan.capacity = undefined; }

  if (lower === 'free') { plan.paid = false; plan.priceCents = 0; addComponent(plan, 'tickets'); }
  if (lower === 'paid') { plan.paid = true; addComponent(plan, 'tickets'); plan.plannerStep = 'price'; }
  if (lower === 'i know the location') plan.plannerStep = 'venue';
  if (lower === 'skip for now') {
    if (section === 'venue' || plan.plannerStep === 'venue' || plan.plannerStep === 'venue_choice') plan.venueDeferred = true;
    else if (section === 'guests' || plan.plannerStep === 'arrival') plan.arrivalDeferred = true;
    else if (section === 'safety' || plan.plannerStep === 'backup') plan.backupDeferred = true;
    plan.plannerStep = undefined;
  }
  if (lower === 'not sure yet' && section === 'basics') plan.attendanceRange = 'Open';
  if (lower === 'not sure yet' && (section === 'schedule' || plan.plannerStep === 'date')) { plan.datePreference = 'Open'; plan.plannerStep = undefined; }

  if (lower === 'add staffing') { addComponent(plan, 'team'); markRecommended(plan, 'staffing'); }
  if (lower === 'add vendors') { addComponent(plan, 'vendors'); markRecommended(plan, 'vendors'); }
  if (lower === 'use communication plan') { addComponent(plan, 'communications'); markRecommended(plan, 'communications'); }
  if (lower === 'add marketing') { addComponent(plan, 'marketing'); markRecommended(plan, 'marketing'); }
  if (lower === 'track event finances') { addComponent(plan, 'finance'); markRecommended(plan, 'finance'); }
  if (lower === 'use safety checklist') { addComponent(plan, 'safety'); plan.safetyNotes = defaultSafetyNotes(plan); markRecommended(plan, 'safety'); }
  if (lower === 'add documents') { plan.requirements = unique([...(plan.requirements ?? []), 'Review required waivers, agreements, permits and attendee documents.']); markRecommended(plan, 'documents'); }
  if (lower === 'add it back' && section) plan.requirements = (plan.requirements ?? []).filter((item) => item !== marker(section));
  if (lower === 'not required' && section) markNotApplicable(plan, section);
}

function recommendationForSection(section: AiPlannerSection | null, plan: AiPlanState, tenant: AiPlannerTenantContext): AiPlannerV2Turn {
  if (section === 'communications') {
    addComponent(plan, 'communications'); markRecommended(plan, 'communications');
    return makeTurn({ message: 'Added a basic attendee communication plan. You can adjust each message later in Communications.', plan, tenant, activeSection: section, recommendation: { label: 'Five-touch communication plan', reason: 'Confirmation, one-week, day-before, event-day and follow-up messages cover the main attendee touchpoints.', needsVerification: false }, options: ['Review plan', 'Marketing'] });
  }
  if (section === 'staffing') {
    addComponent(plan, 'team'); markRecommended(plan, 'staffing');
    return makeTurn({ message: 'Added staffing as a planning area. Set exact roles after the venue, attendance and run of show are clearer.', plan, tenant, activeSection: section, recommendation: { label: 'Start with an event lead and check-in owner', reason: 'Those roles apply across many event types without guessing a final staffing count.', needsVerification: false }, options: ['Review plan', 'Vendors'] });
  }
  if (section === 'vendors') {
    addComponent(plan, 'vendors'); markRecommended(plan, 'vendors');
    return makeTurn({ message: 'Added vendor planning. The event workspace can hold specific vendor needs and assignments.', plan, tenant, activeSection: section, recommendation: { label: 'Define services before choosing vendors', reason: 'Venue, food, AV, entertainment and production needs determine which vendor categories are relevant.', needsVerification: false }, options: ['Review plan', 'Finance'] });
  }
  if (section === 'marketing') {
    addComponent(plan, 'marketing'); markRecommended(plan, 'marketing');
    return makeTurn({ message: 'Added marketing as a planning area.', plan, tenant, activeSection: section, recommendation: { label: 'Launch, reminder and final-push campaign', reason: 'This gives the event a simple promotion cadence without assuming a specific platform.', needsVerification: false }, options: ['Review plan', 'Communications'] });
  }
  if (section === 'safety') {
    addComponent(plan, 'safety'); plan.safetyNotes = defaultSafetyNotes(plan); markRecommended(plan, 'safety');
    return makeTurn({ message: 'Added a baseline safety checklist. Venue-specific and activity-specific requirements still need confirmation.', plan, tenant, activeSection: section, recommendation: { label: 'Baseline event safety checklist', reason: 'Emergency contacts, check-in and escalation are useful across event types.', needsVerification: true }, options: ['Recommend a backup', 'Review plan'] });
  }
  if (section === 'guests' || plan.plannerStep === 'arrival') {
    plan.meetingInstructions = `Arrive 15 minutes before the event start and follow the final check-in instructions sent by the host. Confirm the exact entrance, parking or access details before publishing.`;
    plan.arrivalDeferred = false;
    plan.plannerStep = undefined;
    return makeTurn({ message: 'Added a neutral arrival draft that can be updated once the venue details are confirmed.', plan, tenant, activeSection: section ?? 'guests', recommendation: { label: '15-minute early arrival', reason: 'It leaves time for check-in without inventing venue-specific parking or access details.', needsVerification: true }, options: ['Review plan', 'Communications'] });
  }
  return nextUsefulTurn(plan, tenant);
}

async function recommendLocations(plan: AiPlanState, tenant: AiPlannerTenantContext): Promise<AiPlannerV2Turn> {
  if (!plan.city) return sectionTurn('venue', plan, tenant);
  if (!plan.state) return sectionTurn('venue', plan, tenant);
  try {
    const response = await generateHostCopilotPlan({
      prompt: `Recommend verified venue or meeting-place options for a ${plan.category || 'general'} event in ${plan.city}, ${plan.state}. Relevant venue types include ${tenant.venueTypes.slice(0, 8).join(', ')}. Do not invent availability, rules, permits, prices or access details.`,
      city: plan.city,
      state: plan.state,
    });
    const stops = response.plan.communityStops ?? [];
    const names = unique(stops.map((stop) => stop.name).filter(Boolean)).slice(0, 4);
    if (!names.length) return makeTurn({ message: `I do not have a verified venue match for ${plan.city} right now. Enter a venue yourself or leave it open.`, plan, tenant, activeSection: 'venue', options: ['I know the location', 'Skip for now'] });
    plan.plannerStep = 'venue_choice';
    const first = stops.find((stop) => stop.name === names[0]);
    return makeTurn({ message: `I found ${names.length} verified option${names.length === 1 ? '' : 's'} in ${plan.city}. Choose one or enter your own venue. Confirm current availability and event rules before publishing.`, plan, tenant, activeSection: 'venue', options: [...names, 'I know the location', 'Skip for now'], recommendation: first ? { label: first.name, reason: first.reason || 'Verified place match for the event area.', needsVerification: true } : null });
  } catch {
    return makeTurn({ message: 'I could not retrieve verified venue options right now. Your plan is intact. Enter a venue yourself or leave it open.', plan, tenant, activeSection: 'venue', options: ['I know the location', 'Skip for now'] });
  }
}

export function reviewPlannerState(plan: AiPlanState, tenant: AiPlannerTenantContext): AiPlannerV2Turn {
  const copy = copyPlan(plan);
  const statuses = getPlannerSectionStatuses(copy);
  return makeTurn({ message: reviewMessage(copy, tenant, statuses), plan: copy, tenant, options: canCreateEventRecord(copy) ? ['Create draft', 'Date & schedule', 'Venue', 'Registration'] : ['Date & schedule', 'Venue', 'Basics'] });
}

export function isPlannerCreateCommand(message: string) {
  return /^(ready to create|create it|create draft|create the draft|save draft|save the draft|build it)$/i.test(message.trim());
}

export function isPlannerUndoCommand(message: string) {
  return /^(undo|undo that|go back)$/i.test(message.trim());
}

export async function runAiPlannerV2Turn(input: AiPlannerV2Input): Promise<AiPlannerV2Turn> {
  const tenant = input.tenant ?? await getAiPlannerTenantContext();
  const plan = copyPlan(input.plan);
  const message = input.message.trim();
  const lower = normalize(message);
  let section = input.section ?? null;

  if (input.action === 'section' && section) return sectionTurn(section, plan, tenant);
  if (isPlannerCreateCommand(message) || input.action === 'create') {
    const missing = draftMissing(plan);
    if (!missing.length) return makeTurn({ message: 'Creating the event draft now. Any optional sections can be finished in the event workspace.', plan, tenant, command: 'create_draft', options: [] });
    const firstSection: AiPlannerSection = !plan.title ? 'basics' : (!plan.city || !plan.state) ? 'venue' : 'schedule';
    const turn = sectionTurn(firstSection, plan, tenant);
    return { ...turn, message: `Before I can create the event record, I still need ${missing.join(', ')}. ${turn.message}` };
  }
  if (/^(review plan|review the plan|show me what is missing|what is missing|show missing items)$/i.test(message) || input.action === 'review') return reviewPlannerState(plan, tenant);

  if (/^(change date|change the date|set date|set the date)$/i.test(message)) section = 'schedule';
  if (/^(change location|change the location|location)$/i.test(message)) section = 'venue';
  if (/^(communications?|tickets?|registration|safety|marketing|vendors?|staffing|finance|documents?)$/i.test(message)) {
    const map: Record<string, AiPlannerSection> = { communication: 'communications', communications: 'communications', ticket: 'registration', tickets: 'registration', registration: 'registration', safety: 'safety', marketing: 'marketing', vendor: 'vendors', vendors: 'vendors', staffing: 'staffing', finance: 'finance', document: 'documents', documents: 'documents' };
    section = map[lower] ?? section;
  }
  if (section && (input.action === 'section' || /^change |^set |^(communications?|tickets?|registration|safety|marketing|vendors?|staffing|finance|documents?|location)$/.test(lower))) return sectionTurn(section, plan, tenant);

  inferEventIdea(message, plan, tenant);
  applyContradictions(message, plan);
  const stepError = applyPlannerStep(message, plan);
  applyChoice(message, plan, tenant, section);

  if (stepError) return makeTurn({ message: stepError, plan, tenant, activeSection: section, options: plan.plannerStep === 'date' ? ['Not sure yet'] : [] });
  if (lower === 'recommend locations') return recommendLocations(plan, tenant);
  if (lower === 'recommend for me' || input.action === 'recommend') return recommendationForSection(section, plan, tenant);
  if (lower === 'recommend a backup') {
    plan.backupPlan = backupSuggestion(plan);
    plan.backupDeferred = false;
    return makeTurn({ message: 'Added a backup-plan draft. Confirm the final operational details before sending it to attendees.', plan, tenant, activeSection: section ?? 'safety', recommendation: { label: 'Change-of-plan backup', reason: plan.backupPlan, needsVerification: true }, options: ['Review plan', 'Communications'] });
  }

  if (lower === 'free' || lower === 'paid') return sectionTurn('registration', plan, tenant);
  if (['add staffing','add vendors','use communication plan','add marketing','track event finances','use safety checklist','add documents','not required','add it back'].includes(lower) && section) return sectionTurn(section, plan, tenant);

  const deterministic = Boolean(plan.plannerStep || tenant.eventCategories.some((category) => normalize(category) === lower) || /\b(networking|workshop|conference|fundraiser|gala|awards?|vendor market|pop[- ]?up|employee training|team event|private party|birthday|virtual event|webinar|nature walk|hike|kayak|paddle|canoe|camping)\b/.test(lower));
  if (deterministic) return nextUsefulTurn(plan, tenant);

  let preferences: AiPrivacyPreferences;
  try { preferences = await getAiPrivacyPreferences(); } catch { preferences = { personal_memory_enabled: false, event_history_learning_enabled: false, organization_memory_enabled: false, save_conversations_enabled: false, product_analytics_enabled: false, recommendation_history_enabled: false }; }

  try {
    const { data, error } = await supabase.functions.invoke('host-ai-planner', { body: { message, plan, history: input.history.slice(-16), preferences, tenant, section, action: input.action ?? 'continue' } });
    if (!error && !data?.error && data?.plan && typeof data?.message === 'string') {
      const serverPlan = copyPlan(data.plan as AiPlanState);
      if (input.plan.paid === undefined && !/\b(free|paid|ticket|admission|price|cost)\b/.test(lower)) serverPlan.paid = plan.paid;
      if (!serverPlan.city && plan.city) serverPlan.city = plan.city;
      if (!serverPlan.state && plan.state) serverPlan.state = plan.state;
      const serverTurn = makeTurn({ message: data.message, plan: serverPlan, tenant, activeSection: section, options: Array.isArray(data.options) ? data.options : [], recommendation: data.recommendation ?? null });
      const changed = JSON.stringify(serverTurn.plan) !== JSON.stringify(input.plan);
      const repeated = serverTurn.message === input.history.at(-1)?.text;
      if (changed || !repeated) return serverTurn;
    }
  } catch {
    // Structured local planning remains available when AI is unavailable.
  }

  return nextUsefulTurn(plan, tenant);
}
