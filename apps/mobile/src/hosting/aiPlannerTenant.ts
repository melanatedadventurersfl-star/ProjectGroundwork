import { getActiveExperienceContext } from '../platform/experience';

export type AiPlannerSection =
  | 'basics'
  | 'schedule'
  | 'venue'
  | 'registration'
  | 'guests'
  | 'staffing'
  | 'vendors'
  | 'communications'
  | 'marketing'
  | 'finance'
  | 'safety'
  | 'documents';

export type AiPlannerSectionStatus = 'not_started' | 'in_progress' | 'complete' | 'needs_review' | 'not_applicable';

export type AiPlannerTenantContext = {
  organizationId: string | null;
  experienceId: string | null;
  organizationName: string;
  experienceName: string;
  organizationKind: string;
  eventCategories: string[];
  venueTypes: string[];
  sections: AiPlannerSection[];
  attendeeLabel: string;
  brandVoice: string;
  isPlatformDefault: boolean;
};

export const GENERIC_EVENT_CATEGORIES = [
  'Networking', 'Workshop', 'Conference', 'Fundraiser', 'Gala / Awards',
  'Vendor Market / Pop-up', 'Employee / Team Event', 'Private Event',
  'Virtual Event', 'Outdoor Event', 'Other',
];

export const GENERIC_VENUE_TYPES = [
  'Hotel meeting room', 'Coworking space', 'Conference room',
  'Restaurant private room', 'Event venue', 'Community center',
  'Banquet hall', 'Gallery', 'Rooftop', 'Convention space',
];

export const DEFAULT_PLANNER_SECTIONS: AiPlannerSection[] = [
  'basics', 'schedule', 'venue', 'registration', 'guests', 'staffing',
  'vendors', 'communications', 'marketing', 'finance', 'safety', 'documents',
];

export const PLANNER_SECTION_LABELS: Record<AiPlannerSection, string> = {
  basics: 'Basics',
  schedule: 'Date & schedule',
  venue: 'Venue',
  registration: 'Registration',
  guests: 'Guests',
  staffing: 'Staffing',
  vendors: 'Vendors',
  communications: 'Communications',
  marketing: 'Marketing',
  finance: 'Finance',
  safety: 'Safety',
  documents: 'Documents',
};

const GENERIC_CONTEXT: AiPlannerTenantContext = {
  organizationId: null,
  experienceId: null,
  organizationName: 'Organization',
  experienceName: 'Events',
  organizationKind: 'other',
  eventCategories: GENERIC_EVENT_CATEGORIES,
  venueTypes: GENERIC_VENUE_TYPES,
  sections: DEFAULT_PLANNER_SECTIONS,
  attendeeLabel: 'attendees',
  brandVoice: 'clear, practical and professional',
  isPlatformDefault: false,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function sectionArray(value: unknown): AiPlannerSection[] {
  const allowed = new Set(DEFAULT_PLANNER_SECTIONS);
  return stringArray(value).filter((item): item is AiPlannerSection => allowed.has(item as AiPlannerSection));
}

export async function getAiPlannerTenantContext(): Promise<AiPlannerTenantContext> {
  try {
    const context = await getActiveExperienceContext();
    if (!context) return GENERIC_CONTEXT;

    const publicSettings = asRecord(context.experience.publicSettings);
    const planner = asRecord(publicSettings.aiPlanner ?? publicSettings.ai_planner ?? publicSettings.planner);
    const categories = stringArray(planner.eventCategories ?? planner.event_categories ?? planner.categories);
    const venueTypes = stringArray(planner.venueTypes ?? planner.venue_types);
    const configuredSections = sectionArray(planner.sections);
    const attendeeLabel = typeof planner.attendeeLabel === 'string'
      ? planner.attendeeLabel.trim()
      : typeof planner.attendee_label === 'string' ? planner.attendee_label.trim() : '';
    const brandVoice = typeof planner.brandVoice === 'string'
      ? planner.brandVoice.trim()
      : typeof planner.brand_voice === 'string' ? planner.brand_voice.trim() : '';

    return {
      organizationId: context.organization.id,
      experienceId: context.experience.id,
      organizationName: context.organization.name,
      experienceName: context.experience.name,
      organizationKind: context.organization.kind,
      eventCategories: categories.length ? categories : GENERIC_EVENT_CATEGORIES,
      venueTypes: venueTypes.length ? venueTypes : GENERIC_VENUE_TYPES,
      sections: configuredSections.length ? configuredSections : DEFAULT_PLANNER_SECTIONS,
      attendeeLabel: attendeeLabel || 'attendees',
      brandVoice: brandVoice || 'clear, practical and professional',
      isPlatformDefault: context.organization.isPlatformDefault,
    };
  } catch {
    return GENERIC_CONTEXT;
  }
}
