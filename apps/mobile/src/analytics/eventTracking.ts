import { supabase } from '../lib/supabase';

export type GoMelanatedEventName =
  | 'event_discovered'
  | 'event_page_view'
  | 'event_shared'
  | 'invite_sent'
  | 'invite_opened'
  | 'calendar_added'
  | 'host_followed'
  | 'search_impression'
  | 'search_selected'
  | 'checkout_started'
  | 'review_submitted'
  | 'photo_uploaded'
  | 'notification_opened'
  | 'message_opened'
  | 'message_clicked';

export type EventTrackingContext = {
  surface?: string;
  attributionCode?: string | null;
};

export type RecordEventOptions = EventTrackingContext & {
  quantity?: number;
  valueCents?: number;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
  dedupeWindowMinutes?: number;
  orderId?: string | null;
  ticketTypeId?: string | null;
};

const analyticsSessionKey = `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const adventureContexts = new Map<string, EventTrackingContext>();

export function getAnalyticsSessionKey() {
  return analyticsSessionKey;
}

export function setEventTrackingContext(adventureId: string, context: EventTrackingContext) {
  const current = adventureContexts.get(adventureId) ?? {};
  adventureContexts.set(adventureId, {
    surface: context.surface ?? current.surface,
    attributionCode: context.attributionCode ?? current.attributionCode,
  });
}

export function getEventTrackingContext(adventureId: string): EventTrackingContext & { sessionKey: string } {
  return {
    sessionKey: analyticsSessionKey,
    ...(adventureContexts.get(adventureId) ?? {}),
  };
}

function buildWindowDedupeKey(adventureId: string, eventName: GoMelanatedEventName, minutes: number) {
  const windowMs = Math.max(1, minutes) * 60_000;
  const bucket = Math.floor(Date.now() / windowMs);
  return `${eventName}:${adventureId}:${analyticsSessionKey}:${bucket}`;
}

export async function recordGoMelanatedEvent(
  adventureId: string,
  eventName: GoMelanatedEventName,
  options: RecordEventOptions = {},
): Promise<void> {
  if (!adventureId) return;

  const context = getEventTrackingContext(adventureId);
  const dedupeKey = options.dedupeKey === undefined && options.dedupeWindowMinutes
    ? buildWindowDedupeKey(adventureId, eventName, options.dedupeWindowMinutes)
    : options.dedupeKey ?? null;

  const { error } = await supabase.rpc('record_go_melanated_event', {
    p_adventure_id: adventureId,
    p_event_name: eventName,
    p_session_key: analyticsSessionKey,
    p_surface: options.surface ?? context.surface ?? 'unknown',
    p_attribution_code: options.attributionCode ?? context.attributionCode ?? null,
    p_dedupe_key: dedupeKey,
    p_quantity: options.quantity ?? 1,
    p_value_cents: options.valueCents ?? 0,
    p_metadata: options.metadata ?? {},
    p_order_id: options.orderId ?? null,
    p_ticket_type_id: options.ticketTypeId ?? null,
  });

  // Analytics must never block event discovery, RSVP, checkout, or ticket access.
  if (error && !/record_go_melanated_event/i.test(error.message)) {
    console.warn('Event analytics write failed', error.message);
  }
}

export function recordEventPageView(adventureId: string, surface = 'event_detail') {
  setEventTrackingContext(adventureId, { surface });
  return recordGoMelanatedEvent(adventureId, 'event_page_view', {
    surface,
    dedupeWindowMinutes: 15,
  });
}

export function recordCheckoutStart(adventureId: string) {
  return recordGoMelanatedEvent(adventureId, 'checkout_started', {
    surface: 'checkout',
    dedupeWindowMinutes: 30,
  });
}
