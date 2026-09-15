import type { EventComponentKey } from './eventBuilder';

export type EventActionTarget = {
  component?: EventComponentKey | null;
  entityType?: string | null;
  entityId?: string | null;
  focus?: string | null;
  taskId?: string | null;
  actionType?: string | null;
};

export type EventActionContext = EventActionTarget & {
  adventureId: string;
  campaignId?: string | null;
  campaignSlug?: string | null;
};

function params(values: Record<string, string | null | undefined>) {
  const query = Object.entries(values)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `?${query}` : '';
}

export function eventActionRoute(input: EventActionContext) {
  const focus = input.focus || input.component || null;
  const query = params({ focus, taskId: input.taskId, entityId: input.entityId, action: input.actionType });

  switch (input.component) {
    case 'venue':
      return `/host/venue/${input.adventureId}${query}`;
    case 'tickets':
      return `/host/inventory/${input.adventureId}${query}`;
    case 'communications':
      return `/host/event-communications/${input.adventureId}${query}`;
    case 'marketing':
      return input.campaignSlug
        ? `/host/campaigns/${input.campaignSlug}/marketing${query}`
        : `/host/build/${input.adventureId}?focus=marketing${input.taskId ? `&taskId=${encodeURIComponent(input.taskId)}` : ''}`;
    case 'pages':
      return `/host/build/${input.adventureId}?focus=pages${input.taskId ? `&taskId=${encodeURIComponent(input.taskId)}` : ''}`;
    case 'team':
    case 'finance':
    case 'schedule':
    case 'food':
    case 'vendors':
    case 'volunteers':
    case 'activities':
    case 'lodging':
    case 'equipment':
    case 'safety':
    case 'sponsors':
    case 'transportation':
      return `/host/build/${input.adventureId}?focus=${encodeURIComponent(input.component)}${input.focus ? `&subfocus=${encodeURIComponent(input.focus)}` : ''}${input.taskId ? `&taskId=${encodeURIComponent(input.taskId)}` : ''}`;
    default:
      if (input.campaignSlug && input.taskId) return `/host/campaigns/${input.campaignSlug}/tasks/${input.taskId}`;
      return `/host/review/${input.adventureId}`;
  }
}
