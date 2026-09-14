import { DEFAULT_OUTDOOR_INTERESTS } from '../community/communityModel';
import type { OrganizationWorkspace } from '../platform/organizations';

export type EventBuilderDifficulty = 'easy' | 'moderate' | 'challenging';

export type EventBuilderLabels = {
  organizer: string;
  tags: string;
  memberAccess: string;
  capacity: string;
  meetingInstructions: string;
};

export type EventBuilderConfig = {
  eventTypes: string[];
  tags: string[];
  difficultyEventTypes: string[];
  showCommunityVisibility: boolean;
  defaultEventType: string;
  defaultState: string;
  defaultCapacity: number | null;
  labels: EventBuilderLabels;
};

const GENERIC_CONFIG: EventBuilderConfig = {
  eventTypes: [
    'Social',
    'Meeting',
    'Workshop',
    'Class',
    'Conference',
    'Fundraiser',
    'Community Event',
    'Volunteer Event',
    'Competition',
    'Performance',
    'Other',
  ],
  tags: [
    'Networking',
    'Education',
    'Professional Development',
    'Family Friendly',
    'Food',
    'Music',
    'Arts',
    'Wellness',
    'Community',
    'Volunteer',
    'Business',
    'Entertainment',
  ],
  difficultyEventTypes: [],
  showCommunityVisibility: false,
  defaultEventType: 'Social',
  defaultState: '',
  defaultCapacity: null,
  labels: {
    organizer: 'Organizer',
    tags: 'Tags',
    memberAccess: 'Members only',
    capacity: 'Capacity',
    meetingInstructions: 'Arrival or meeting instructions',
  },
};

const GO_MELANATED_CONFIG: EventBuilderConfig = {
  eventTypes: ['Hiking', 'Camping', 'Paddling', 'Beach', 'Cycling', 'Social', 'Workshop', 'Volunteer', 'Other'],
  tags: [...DEFAULT_OUTDOOR_INTERESTS],
  difficultyEventTypes: ['Hiking', 'Camping', 'Paddling', 'Beach', 'Cycling'],
  showCommunityVisibility: true,
  defaultEventType: 'Social',
  defaultState: 'FL',
  defaultCapacity: 20,
  labels: {
    organizer: 'Organizer',
    tags: 'Interests',
    memberAccess: 'Community',
    capacity: 'Expected attendance',
    meetingInstructions: 'Meeting instructions',
  },
};

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  return items.length ? [...new Set(items)] : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return undefined;
  return Math.round(value);
}

export function resolveEventBuilderConfig(organization: OrganizationWorkspace | null): EventBuilderConfig {
  const base = organization?.slug === 'go-melanated' ? GO_MELANATED_CONFIG : GENERIC_CONFIG;
  const raw = organization?.eventBuilderSettings;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

  const settings = raw as Record<string, unknown>;
  const rawLabels = settings.labels && typeof settings.labels === 'object' && !Array.isArray(settings.labels)
    ? settings.labels as Record<string, unknown>
    : {};
  const eventTypes = stringList(settings.event_types) ?? base.eventTypes;
  const configuredDefault = stringValue(settings.default_event_type);
  const defaultEventType = configuredDefault && eventTypes.includes(configuredDefault)
    ? configuredDefault
    : eventTypes[0] ?? base.defaultEventType;
  const defaultCapacity = numberValue(settings.default_capacity);

  return {
    eventTypes,
    tags: stringList(settings.tags) ?? base.tags,
    difficultyEventTypes: stringList(settings.difficulty_event_types) ?? base.difficultyEventTypes,
    showCommunityVisibility: typeof settings.show_community_visibility === 'boolean'
      ? settings.show_community_visibility
      : base.showCommunityVisibility,
    defaultEventType,
    defaultState: stringValue(settings.default_state) ?? base.defaultState,
    defaultCapacity: defaultCapacity === undefined ? base.defaultCapacity : defaultCapacity,
    labels: {
      organizer: stringValue(rawLabels.organizer) ?? base.labels.organizer,
      tags: stringValue(rawLabels.tags) ?? base.labels.tags,
      memberAccess: stringValue(rawLabels.member_access) ?? base.labels.memberAccess,
      capacity: stringValue(rawLabels.capacity) ?? base.labels.capacity,
      meetingInstructions: stringValue(rawLabels.meeting_instructions) ?? base.labels.meetingInstructions,
    },
  };
}

export function eventBuilderConfigToSettings(config: EventBuilderConfig): Record<string, unknown> {
  return {
    event_types: config.eventTypes,
    tags: config.tags,
    difficulty_event_types: config.difficultyEventTypes,
    show_community_visibility: config.showCommunityVisibility,
    default_event_type: config.defaultEventType,
    default_state: config.defaultState,
    default_capacity: config.defaultCapacity,
    labels: {
      organizer: config.labels.organizer,
      tags: config.labels.tags,
      member_access: config.labels.memberAccess,
      capacity: config.labels.capacity,
      meeting_instructions: config.labels.meetingInstructions,
    },
  };
}
