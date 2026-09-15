import type { HostOuting } from './api';
import type { EventOperationsSummary } from './eventBuilder';
import type { HostTicketType } from './tickets';

export type EventReadinessAction =
  | 'cover'
  | 'details'
  | 'location'
  | 'tickets'
  | 'operations'
  | 'communications'
  | 'team'
  | 'finance'
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

function ticketCapacityReady(event: HostOuting, tickets: HostTicketType[]) {
  if (!tickets.length) return false;
  if (event.capacity == null) return true;
  return tickets.every((ticket) => ticket.capacity == null || ticket.capacity <= event.capacity!);
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
  const capacityAligned = ticketCapacityReady(event, activeTickets);
  const communicationEnabled = activeComponents.has('communications');
  const scheduledCommunications = operations?.scheduledCommunications ?? 0;
  const draftCommunications = operations?.draftCommunications ?? 0;
  const messagesReady = !communicationEnabled || scheduledCommunications > 0;
  const operatingPlanReady = locationReady(event)
    && (event.location_type === 'online' || activeComponents.has('venue') || activeComponents.has('schedule'));

  const communicationItems: EventReadinessItem[] = communicationEnabled ? [{
    key: 'messages',
    label: 'Attendee communications',
    detail: messagesReady
      ? `${scheduledCommunications} message${scheduledCommunications === 1 ? '' : 's'} scheduled`
      : draftCommunications
        ? `${draftCommunications} draft message${draftCommunications === 1 ? '' : 's'} need scheduling`
        : 'Set up attendee confirmations or reminders',
    done: messagesReady,
    action: 'communications',
  }] : [];

  const rawAreas: EventReadinessArea[] = [
    {
      key: 'core',
      label: 'Event details',
      weight: 40,
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
      weight: 25,
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
      weight: 20,
      items: [
        {
          key: 'operating-plan',
          label: 'Operating plan',
          detail: operatingPlanReady ? 'Location and operating workspace are connected' : 'Connect the event location to venue or schedule planning',
          done: operatingPlanReady,
          action: 'operations',
        },
      ],
      complete: false,
      readyCount: 0,
    },
    {
      key: 'communications',
      label: 'Communications',
      weight: 15,
      items: communicationItems,
      complete: false,
      readyCount: 0,
    },
  ];

  const areas = rawAreas.map((area) => {
    const readyCount = area.items.filter((item) => item.done).length;
    return { ...area, readyCount, complete: area.items.length === 0 || readyCount === area.items.length };
  });

  const percent = Math.round(areas.reduce((sum, area) => {
    const ratio = area.items.length ? area.readyCount / area.items.length : 1;
    return sum + ratio * area.weight;
  }, 0));
  const incomplete = areas.flatMap((area) => area.items.filter((item) => !item.done));
  const coreArea = areas.find((area) => area.key === 'core')!;
  const registrationArea = areas.find((area) => area.key === 'registration')!;
  const operationsArea = areas.find((area) => area.key === 'operations')!;
  const communicationsArea = areas.find((area) => area.key === 'communications')!;
  const location = coreArea.items.find((item) => item.key === 'location')!;
  const experienceLocked = coreArea.items.filter((item) => item.key !== 'cover').every((item) => item.done) && operationsArea.complete;

  return {
    percent,
    status: percent === 100 ? 'ready' : percent >= 70 ? 'needs_attention' : 'setup',
    areas,
    incomplete,
    milestones: [
      { key: 'venue', label: 'Venue locked', done: location.done, detail: location.detail },
      { key: 'ticketing', label: 'Ticketing ready', done: registrationArea.complete, detail: registrationArea.complete ? 'Admission and capacity ready' : 'Finish admission and capacity' },
      { key: 'experience', label: 'Experience locked', done: experienceLocked, detail: experienceLocked ? 'Core event plan is ready' : 'Finish event details and the operating plan' },
      { key: 'communications', label: 'Communications ready', done: communicationsArea.complete, detail: communicationsArea.complete ? (communicationEnabled ? 'Attendee messaging is scheduled' : 'No attendee messaging required') : 'Schedule attendee communications' },
      { key: 'event', label: 'Event ready', done: incomplete.length === 0, detail: incomplete.length === 0 ? 'Ready to publish or operate' : `${incomplete.length} item${incomplete.length === 1 ? '' : 's'} still need attention` },
    ],
  };
}
