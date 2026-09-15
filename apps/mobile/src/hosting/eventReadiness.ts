import type { HostOuting } from './api';
import type { EventOperationsSummary } from './eventBuilder';
import type { HostTicketType } from './tickets';

export type EventReadinessAction =
  | 'cover'
  | 'details'
  | 'location'
  | 'tickets'
  | 'team'
  | 'finance'
  | 'operations'
  | 'communications'
  | 'pages';

export type EventReadinessItem = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  action: EventReadinessAction;
};

export type EventReadinessArea = {
  key: 'core' | 'registration' | 'operations' | 'communications';
  label: string;
  weight: number;
  items: EventReadinessItem[];
  complete: boolean;
  readyCount: number;
};

export type EventReadinessResult = {
  percent: number;
  status: 'ready' | 'needs_attention' | 'setup';
  areas: EventReadinessArea[];
  incomplete: EventReadinessItem[];
  milestones: { key: string; label: string; done: boolean; detail: string }[];
};

export type EventReadinessComponent = {
  component_key: string;
  status: string;
};

function locationReady(event: HostOuting) {
  if (event.location_type === 'tbd') return true;
  if (event.location_type === 'online') return Boolean(event.online_url?.trim());
  if (event.location_type === 'hybrid') {
    return Boolean(event.venue_name?.trim() && event.city?.trim() && event.state?.trim() && event.online_url?.trim());
  }
  return Boolean(event.venue_name?.trim() && event.city?.trim() && event.state?.trim());
}

function validSchedule(event: HostOuting) {
  if (!event.starts_at || !event.ends_at) return false;
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

export function evaluateEventReadiness(input: {
  event: HostOuting;
  tickets: HostTicketType[];
  components: EventReadinessComponent[];
  operations?: EventOperationsSummary | null;
}): EventReadinessResult {
  const { event, tickets, components, operations } = input;
  const activeComponents = new Set(components.filter((item) => item.status !== 'disabled').map((item) => item.component_key));
  const activeTickets = tickets.filter((ticket) => ticket.is_active);
  const capacityAligned = activeTickets.length > 0 && (
    event.capacity == null || activeTickets.some((ticket) => ticket.capacity == null || ticket.capacity <= event.capacity!)
  );
  const hasCommunicationSchedule = activeComponents.has('communications')
    && ((operations?.scheduledCommunications ?? 0) + (operations?.draftCommunications ?? 0) > 0);
  const hasOperatingPlan = activeComponents.has('schedule') || activeComponents.has('venue') || event.location_type === 'online';

  const rawAreas: EventReadinessArea[] = [
    {
      key: 'core',
      label: 'Event details',
      weight: 35,
      items: [
        { key: 'cover', label: 'Event cover', detail: event.hero_image_url ? 'Cover added' : 'Add an event cover', done: Boolean(event.hero_image_url), action: 'cover' },
        { key: 'identity', label: 'Event details', detail: event.title && event.summary ? 'Name and description ready' : 'Add the event name and description', done: Boolean(event.title?.trim() && event.summary?.trim()), action: 'details' },
        { key: 'schedule', label: 'Date & time', detail: validSchedule(event) ? 'Schedule ready' : 'Add a valid start and end time', done: validSchedule(event), action: 'details' },
        { key: 'location', label: 'Location', detail: locationReady(event) ? 'Location ready' : 'Finish the event location', done: locationReady(event), action: 'location' },
        { key: 'access', label: 'Access', detail: event.visibility ? `${event.visibility.charAt(0).toUpperCase()}${event.visibility.slice(1)}` : 'Choose event access', done: Boolean(event.visibility), action: 'details' },
      ],
      complete: false,
      readyCount: 0,
    },
    {
      key: 'registration',
      label: 'Registration',
      weight: 20,
      items: [
        { key: 'admission', label: 'Admission', detail: activeTickets.length ? `${activeTickets.length} active option${activeTickets.length === 1 ? '' : 's'}` : 'Add an active admission option', done: activeTickets.length > 0, action: 'tickets' },
        { key: 'capacity', label: 'Capacity', detail: capacityAligned ? 'Capacity aligned' : 'Review event and ticket capacity', done: capacityAligned, action: 'tickets' },
      ],
      complete: false,
      readyCount: 0,
    },
    {
      key: 'operations',
      label: 'Operations',
      weight: 25,
      items: [
        { key: 'team', label: 'Team', detail: activeComponents.has('team') ? 'Team workspace connected' : 'Set up the event team', done: activeComponents.has('team'), action: 'team' },
        { key: 'finance', label: 'Money', detail: activeComponents.has('finance') ? 'Finance workspace connected' : 'Set up event finances', done: activeComponents.has('finance'), action: 'finance' },
        { key: 'operating-plan', label: 'Operating plan', detail: hasOperatingPlan ? 'Venue or schedule workspace connected' : 'Add venue or schedule planning', done: hasOperatingPlan, action: 'operations' },
      ],
      complete: false,
      readyCount: 0,
    },
    {
      key: 'communications',
      label: 'Communications',
      weight: 20,
      items: [
        { key: 'messages', label: 'Attendee messages', detail: hasCommunicationSchedule ? `${operations?.scheduledCommunications ?? 0} scheduled · ${operations?.draftCommunications ?? 0} draft` : 'Set up attendee messages', done: hasCommunicationSchedule, action: 'communications' },
        { key: 'pages', label: 'Event information', detail: activeComponents.has('pages') ? 'Event pages connected' : 'Add attendee-facing event information', done: activeComponents.has('pages'), action: 'pages' },
      ],
      complete: false,
      readyCount: 0,
    },
  ];

  const areas = rawAreas.map((area) => {
    const readyCount = area.items.filter((item) => item.done).length;
    return { ...area, readyCount, complete: readyCount === area.items.length };
  });

  const percent = Math.round(areas.reduce((sum, area) => {
    const ratio = area.items.length ? area.readyCount / area.items.length : 1;
    return sum + ratio * area.weight;
  }, 0));
  const incomplete = areas.flatMap((area) => area.items.filter((item) => !item.done));
  const registration = areas.find((area) => area.key === 'registration')!;
  const operationsArea = areas.find((area) => area.key === 'operations')!;
  const communicationsArea = areas.find((area) => area.key === 'communications')!;
  const location = areas.find((area) => area.key === 'core')!.items.find((item) => item.key === 'location')!;
  const coreWithoutCover = areas.find((area) => area.key === 'core')!.items.filter((item) => item.key !== 'cover');
  const experienceLocked = coreWithoutCover.every((item) => item.done) && operationsArea.complete;

  return {
    percent,
    status: percent === 100 ? 'ready' : percent >= 70 ? 'needs_attention' : 'setup',
    areas,
    incomplete,
    milestones: [
      { key: 'venue', label: 'Venue locked', done: location.done, detail: location.detail },
      { key: 'ticketing', label: 'Ticketing ready', done: registration.complete, detail: registration.complete ? 'Admission and capacity ready' : 'Finish admission and capacity' },
      { key: 'experience', label: 'Experience locked', done: experienceLocked, detail: experienceLocked ? 'Core operations are ready' : 'Finish core details and operations' },
      { key: 'communications', label: 'Communications ready', done: communicationsArea.complete, detail: communicationsArea.complete ? 'Attendee information is ready' : 'Finish messages and event information' },
      { key: 'event', label: 'Event ready', done: incomplete.length === 0, detail: incomplete.length === 0 ? 'Ready to publish or operate' : `${incomplete.length} item${incomplete.length === 1 ? '' : 's'} still need attention` },
    ],
  };
}
