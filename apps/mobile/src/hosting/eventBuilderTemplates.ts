import type { EventLocationType } from './api';
import type { EventComponentKey } from './eventBuilder';

export type EventBuilderTemplate = {
  key: string;
  label: string;
  description: string;
  components: EventComponentKey[];
  setupPrompts: string[];
};

const BASE_COMPONENTS: EventComponentKey[] = ['tickets', 'team', 'finance', 'communications', 'pages'];

const templates: Array<{ match: RegExp; template: EventBuilderTemplate }> = [
  {
    match: /camp|outdoor|hike|kayak|paddle|beach|cycling/i,
    template: {
      key: 'outdoor',
      label: 'Outdoor event setup',
      description: 'Adds venue, safety, equipment, activities, and lodging support where relevant.',
      components: ['venue', 'safety', 'equipment', 'activities', 'lodging'],
      setupPrompts: ['Confirm permits and emergency plan', 'Review equipment and supplies', 'Confirm arrival and parking details'],
    },
  },
  {
    match: /dinner|food|brunch|meal|banquet/i,
    template: {
      key: 'food',
      label: 'Food event setup',
      description: 'Adds food planning, venue logistics, and vendor support.',
      components: ['food', 'venue', 'vendors'],
      setupPrompts: ['Confirm menu and dietary needs', 'Confirm serving setup', 'Review vendor or catering details'],
    },
  },
  {
    match: /conference|summit|workshop|class|seminar|training|meeting/i,
    template: {
      key: 'program',
      label: 'Program event setup',
      description: 'Adds venue, schedule, activities, equipment, and communications support.',
      components: ['venue', 'schedule', 'activities', 'equipment'],
      setupPrompts: ['Build the run of show', 'Confirm room and equipment needs', 'Review attendee communications'],
    },
  },
  {
    match: /fundraiser|gala|benefit|award/i,
    template: {
      key: 'fundraiser',
      label: 'Fundraiser setup',
      description: 'Adds venue, sponsors, marketing, vendors, and schedule support.',
      components: ['venue', 'sponsors', 'marketing', 'vendors', 'schedule'],
      setupPrompts: ['Confirm sponsor deliverables', 'Review ticket and revenue goals', 'Build the event schedule'],
    },
  },
  {
    match: /vendor|market|expo|pop.?up/i,
    template: {
      key: 'market',
      label: 'Vendor event setup',
      description: 'Adds vendor, venue, marketing, safety, and schedule support.',
      components: ['vendors', 'venue', 'marketing', 'safety', 'schedule'],
      setupPrompts: ['Open vendor registration', 'Confirm load-in and layout', 'Review permits and insurance'],
    },
  },
];

const fallback: EventBuilderTemplate = {
  key: 'general',
  label: 'General event setup',
  description: 'Adds the core tools most hosts need after the event basics are saved.',
  components: ['venue', 'schedule'],
  setupPrompts: ['Review the public event page', 'Confirm schedule and location', 'Set attendee communications'],
};

export function resolveEventBuilderTemplate(eventType: string): EventBuilderTemplate {
  return templates.find((item) => item.match.test(eventType))?.template ?? fallback;
}

export function recommendedEventComponents(eventType: string, locationType: EventLocationType, paid: boolean): EventComponentKey[] {
  const template = resolveEventBuilderTemplate(eventType);
  const components = new Set<EventComponentKey>(BASE_COMPONENTS);
  template.components.forEach((component) => components.add(component));
  if (locationType === 'physical' || locationType === 'hybrid') components.add('venue');
  if (paid) components.add('marketing');
  return [...components];
}
