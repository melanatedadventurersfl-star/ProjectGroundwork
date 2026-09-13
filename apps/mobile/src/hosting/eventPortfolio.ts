import { supabase } from '../lib/supabase';
import type { HostCampaign } from './campaigns';
import type { EventDraft, ImportPreviewResult } from './creation';
import { isOverdue } from './workModel';

export type EventLifecycle = 'Draft' | 'Planning' | 'Selling' | 'Ready' | 'Live' | 'Wrap-up' | 'Completed' | 'Cancelled';
export type EventHealth = 'on_track' | 'attention' | 'at_risk';
export type GateState = 'ready' | 'in_progress' | 'attention' | 'not_set' | 'not_required';
export type GateKey = 'venue' | 'tickets' | 'team' | 'marketing' | 'operations' | 'finance';

export type EventGate = {
  key: GateKey;
  label: string;
  state: GateState;
};

export type EventPortfolioSignals = {
  adventureStatus: string;
  visibility: string | null;
  lifecycle: EventLifecycle;
  health: EventHealth;
  healthReason: string;
  attentionRoute: string;
  readiness: number;
  gates: EventGate[];
  attendees: number;
  capacity: number | null;
  trackedRevenueCents: number;
  financeConfigured: boolean;
  marketingPublished: number;
  marketingScheduled: number;
  marketingDrafts: number;
  teamCount: number;
  vendorCount: number;
};

export type EventDraftPreview = {
  id: string;
  sourceLabel: string;
  sourceType: string;
  sourceKind: string;
  title: string;
  updatedAt: string;
  completeness: number;
  missing: string[];
  resumeRoute: string;
};

type OperationsLike = {
  progress: number;
  overdueTaskCount: number;
  profitCents: number;
  dateAssessment?: { state?: string; reason?: string };
  confirmedVendors?: number;
  pendingVendors?: number;
};

type ComponentRow = { component_key: string; status: string };
type MarketingRow = { status: string; published_at: string | null; scheduled_at: string | null };
type FinanceRow = { payment_status: string | null; due_at: string | null };
type PaidOrderRow = { id: string; total_cents: number | null };
type TicketTypeRow = { id: string; capacity: number | null; is_active: boolean };
type StaffRow = { id: string; role: string };
type AdventureRow = {
  status: string;
  visibility: string | null;
  capacity: number | null;
  spots_remaining: number | null;
  venue_name: string | null;
  address: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
};

type ImportRow = {
  id: string;
  adventure_id: string | null;
  source_type: string;
  source_label: string | null;
  source_url: string | null;
  extracted_payload: unknown;
  status: string;
  created_at: string;
  updated_at: string;
};

const GATE_LABELS: Record<GateKey, string> = {
  venue: 'Venue',
  tickets: 'Tickets',
  team: 'Team',
  marketing: 'Marketing',
  operations: 'Operations',
  finance: 'Finance',
};

const OPERATIONS_COMPONENTS = new Set(['schedule', 'activities', 'food', 'equipment', 'safety', 'transportation', 'lodging']);
const OPERATIONS_CATEGORIES = ['operations', 'schedule', 'activities', 'food', 'equipment', 'safety', 'transportation', 'lodging'];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function taskState(campaign: HostCampaign, categories: string[]): GateState | null {
  const categorySet = new Set(categories.map(normalize));
  const tasks = campaign.tasks.filter((task) => categorySet.has(normalize(task.category)));
  if (!tasks.length) return null;
  if (tasks.every((task) => task.status === 'complete')) return 'ready';
  const urgent = tasks.some((task) => task.status === 'blocked' || (task.status !== 'complete' && isOverdue({ ...task, campaign })));
  return urgent ? 'attention' : 'in_progress';
}

function componentStatus(components: Map<string, string>, key: string) {
  return components.get(key) ?? 'missing';
}

function gate(key: GateKey, state: GateState): EventGate {
  return { key, label: GATE_LABELS[key], state };
}

function readinessFromGates(gates: EventGate[]) {
  const applicable = gates.filter((item) => item.state !== 'not_required');
  if (!applicable.length) return 0;
  const points = applicable.reduce((sum, item) => {
    if (item.state === 'ready') return sum + 1;
    if (item.state === 'in_progress') return sum + 0.5;
    if (item.state === 'attention') return sum + 0.25;
    return sum;
  }, 0);
  return Math.round((points / applicable.length) * 100);
}

function deriveLifecycle(input: {
  campaign: HostCampaign;
  adventureStatus: string;
  readiness: number;
  paidOrderCount: number;
  now: number;
}): EventLifecycle {
  const { campaign, adventureStatus, readiness, paidOrderCount, now } = input;
  if (adventureStatus === 'cancelled') return 'Cancelled';
  if (campaign.status === 'complete' || adventureStatus === 'completed') return 'Completed';

  const start = new Date(campaign.startsAt).getTime();
  const end = new Date(campaign.endsAt).getTime();
  if (Number.isFinite(end) && end < now) return 'Wrap-up';
  if (Number.isFinite(start) && Number.isFinite(end) && start <= now && end >= now) return 'Live';
  if (adventureStatus === 'draft') return 'Draft';
  if (readiness >= 85) return 'Ready';
  if (adventureStatus === 'published' || adventureStatus === 'sold_out' || campaign.status === 'live' || paidOrderCount > 0) return 'Selling';
  return 'Planning';
}

function deriveHealth(input: {
  campaign: HostCampaign;
  lifecycle: EventLifecycle;
  operations: OperationsLike;
  financeOverdue: boolean;
  duplicateCount: number;
}): { health: EventHealth; reason: string; route: string } {
  const { campaign, lifecycle, operations, financeOverdue, duplicateCount } = input;
  const workspace = `/host/event-work/${campaign.slug}`;
  const edit = `/host/campaigns/${campaign.slug}/edit`;

  if (lifecycle === 'Completed' || lifecycle === 'Cancelled') return { health: 'on_track', reason: '', route: workspace };
  if (lifecycle === 'Wrap-up') return { health: 'at_risk', reason: 'The event date has passed, but closeout is not finished.', route: workspace };

  const criticalBlocked = campaign.tasks.find((task) => task.priority === 'critical' && task.status === 'blocked');
  if (criticalBlocked) return { health: 'at_risk', reason: `Critical work is blocked: ${criticalBlocked.title}.`, route: workspace };

  const criticalOverdue = campaign.tasks.find((task) => task.priority === 'critical' && task.status !== 'complete' && isOverdue({ ...task, campaign }));
  if (criticalOverdue) return { health: 'at_risk', reason: `Critical work is overdue: ${criticalOverdue.title}.`, route: workspace };

  if (operations.dateAssessment?.state === 'review') {
    return { health: 'attention', reason: operations.dateAssessment.reason || 'Event dates need review.', route: edit };
  }
  if (operations.overdueTaskCount > 0) {
    return { health: 'attention', reason: `${operations.overdueTaskCount} overdue work item${operations.overdueTaskCount === 1 ? '' : 's'} need attention.`, route: workspace };
  }
  if (financeOverdue) return { health: 'attention', reason: 'An event payment is past due.', route: '/host/finances' };
  if (duplicateCount > 0) return { health: 'attention', reason: `${duplicateCount + 1} records may represent the same event.`, route: edit };
  return { health: 'on_track', reason: '', route: workspace };
}

function sourceKind(sourceType: string) {
  if (sourceType === 'uploaded_files') return 'FILE / FLYER';
  if (sourceType === 'file_url') return 'LINK';
  if (sourceType === 'event_site') return 'EVENT SITE';
  if (sourceType === 'template') return 'TEMPLATE';
  return 'IMPORT';
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeDraft(value: unknown): EventDraft {
  const row = asObject(value);
  const tickets = Array.isArray(row.tickets) ? row.tickets.map((item) => {
    const ticket = asObject(item);
    return { label: asString(ticket.label), priceText: asString(ticket.priceText) };
  }) : [];
  const schedule = Array.isArray(row.schedule) ? row.schedule.map((item) => {
    const entry = asObject(item);
    return { time: asString(entry.time), title: asString(entry.title) };
  }) : [];
  const difficulty = ['easy', 'moderate', 'challenging'].includes(asString(row.difficulty)) ? asString(row.difficulty) as EventDraft['difficulty'] : 'easy';
  const rawCapacity = row.capacity;
  const capacity = typeof rawCapacity === 'number' && Number.isFinite(rawCapacity) ? rawCapacity : null;

  return {
    title: asString(row.title),
    summary: asString(row.summary),
    description: asString(row.description),
    category: asString(row.category) || 'Other',
    difficulty,
    startsAt: asString(row.startsAt),
    endsAt: asString(row.endsAt),
    venueName: asString(row.venueName),
    address: asString(row.address),
    city: asString(row.city),
    state: asString(row.state),
    capacity,
    meetingInstructions: asString(row.meetingInstructions),
    heroImageUrl: asString(row.heroImageUrl),
    tickets,
    schedule,
    meals: asStringArray(row.meals),
    policies: asStringArray(row.policies),
    operations: asStringArray(row.operations),
    gear: asStringArray(row.gear),
    guestInfo: asStringArray(row.guestInfo),
    marketing: asStringArray(row.marketing),
    photos: asStringArray(row.photos),
    confidenceNotes: asStringArray(row.confidenceNotes),
  };
}

export async function loadEventPortfolioSignals(campaign: HostCampaign, operations: OperationsLike, duplicateCount = 0): Promise<EventPortfolioSignals> {
  const [adventureResult, componentsResult, marketingResult, financeResult, ordersResult, ticketTypesResult, staffResult] = await Promise.all([
    supabase.from('adventures').select('status,visibility,capacity,spots_remaining,venue_name,address,registration_opens_at,registration_closes_at').eq('id', campaign.adventureId).maybeSingle(),
    supabase.from('host_event_components').select('component_key,status').eq('campaign_id', campaign.id),
    supabase.from('host_campaign_marketing_items').select('status,published_at,scheduled_at').eq('campaign_id', campaign.id),
    supabase.from('host_event_finance_entries').select('payment_status,due_at').eq('campaign_id', campaign.id),
    supabase.from('orders').select('id,total_cents').eq('adventure_id', campaign.adventureId).eq('status', 'paid'),
    supabase.from('ticket_types').select('id,capacity,is_active').eq('adventure_id', campaign.adventureId).eq('is_active', true),
    supabase.from('adventure_staff_assignments').select('id,role').eq('adventure_id', campaign.adventureId),
  ]);

  const adventure = (adventureResult.data ?? null) as AdventureRow | null;
  const components = new Map(((componentsResult.data ?? []) as ComponentRow[]).map((item) => [item.component_key, item.status]));
  const marketing = (marketingResult.data ?? []) as MarketingRow[];
  const finance = (financeResult.data ?? []) as FinanceRow[];
  const paidOrders = (ordersResult.data ?? []) as PaidOrderRow[];
  const ticketTypes = (ticketTypesResult.data ?? []) as TicketTypeRow[];
  const staff = (staffResult.data ?? []) as StaffRow[];

  let paidAttendees = 0;
  const orderIds = paidOrders.map((order) => order.id);
  if (orderIds.length) {
    const { data } = await supabase.from('order_attendees').select('order_id').in('order_id', orderIds);
    paidAttendees = data?.length ?? 0;
  }

  const activeCapacities = ticketTypes.filter((ticket) => ticket.capacity !== null).map((ticket) => ticket.capacity as number);
  const capacity = activeCapacities.length ? activeCapacities.reduce((sum, value) => sum + value, 0) : adventure?.capacity ?? null;
  const attendees = paidAttendees || campaign.metrics.attendees;
  const trackedRevenueCents = paidOrders.reduce((sum, order) => sum + (order.total_cents || 0), 0);

  const venueTaskState = taskState(campaign, ['Venue']);
  const venueComponent = componentStatus(components, 'venue');
  const venueGate = venueComponent === 'disabled'
    ? gate('venue', 'not_required')
    : adventure?.venue_name?.trim()
      ? gate('venue', venueTaskState === 'attention' ? 'attention' : venueTaskState === 'in_progress' ? 'in_progress' : 'ready')
      : gate('venue', venueComponent === 'added' ? (venueTaskState ?? 'in_progress') : 'not_set');

  const ticketTaskState = taskState(campaign, ['Ticketing', 'Tickets']);
  const ticketComponent = componentStatus(components, 'tickets');
  const ticketGate = ticketComponent === 'disabled'
    ? gate('tickets', 'not_required')
    : ticketTaskState === 'attention'
      ? gate('tickets', 'attention')
      : attendees > 0
        ? gate('tickets', 'ready')
        : ticketTypes.length > 0
          ? gate('tickets', ticketTaskState === 'ready' ? 'ready' : 'in_progress')
          : gate('tickets', ticketComponent === 'added' ? (ticketTaskState ?? 'in_progress') : 'not_set');

  const teamTaskState = taskState(campaign, ['Team', 'Staffing', 'Volunteers']);
  const teamComponent = componentStatus(components, 'team');
  const teamGate = teamComponent === 'disabled'
    ? gate('team', 'not_required')
    : teamTaskState === 'attention'
      ? gate('team', 'attention')
      : staff.length > 0
        ? gate('team', teamTaskState === 'in_progress' ? 'in_progress' : 'ready')
        : gate('team', teamComponent === 'added' ? (teamTaskState ?? 'in_progress') : 'not_set');

  const marketingTaskState = taskState(campaign, ['Marketing']);
  const marketingComponent = componentStatus(components, 'marketing');
  const marketingPublished = marketing.filter((item) => item.status === 'published' || Boolean(item.published_at)).length;
  const marketingScheduled = marketing.filter((item) => item.status === 'scheduled' || Boolean(item.scheduled_at)).length;
  const marketingDrafts = marketing.filter((item) => ['idea', 'draft'].includes(item.status)).length;
  const marketingGate = marketingComponent === 'disabled'
    ? gate('marketing', 'not_required')
    : marketingTaskState === 'attention'
      ? gate('marketing', 'attention')
      : marketingPublished + marketingScheduled > 0
        ? gate('marketing', 'ready')
        : marketing.length > 0 || marketingComponent === 'added'
          ? gate('marketing', 'in_progress')
          : gate('marketing', 'not_set');

  const operationsTaskState = taskState(campaign, OPERATIONS_CATEGORIES);
  const operationsComponents = [...components.entries()].filter(([key]) => OPERATIONS_COMPONENTS.has(key));
  const operationsAdded = operationsComponents.some(([, status]) => status === 'added');
  const operationsAllDisabled = operationsComponents.length > 0 && operationsComponents.every(([, status]) => status === 'disabled');
  const operationsGate = operationsAllDisabled
    ? gate('operations', 'not_required')
    : operationsTaskState === 'attention'
      ? gate('operations', 'attention')
      : operationsTaskState === 'ready'
        ? gate('operations', 'ready')
        : operationsTaskState === 'in_progress' || operationsAdded
          ? gate('operations', 'in_progress')
          : gate('operations', 'not_set');

  const financeTaskState = taskState(campaign, ['Finance', 'Budget']);
  const financeComponent = componentStatus(components, 'finance');
  const now = Date.now();
  const financeOverdue = finance.some((entry) => {
    if (!entry.due_at || ['paid', 'complete', 'completed'].includes(normalize(entry.payment_status || ''))) return false;
    const due = new Date(entry.due_at).getTime();
    return Number.isFinite(due) && due < now;
  });
  const financeGate = financeComponent === 'disabled'
    ? gate('finance', 'not_required')
    : financeOverdue || financeTaskState === 'attention'
      ? gate('finance', 'attention')
      : finance.length > 0
        ? gate('finance', 'ready')
        : financeComponent === 'added'
          ? gate('finance', financeTaskState ?? 'in_progress')
          : gate('finance', 'not_set');

  const gates = [venueGate, ticketGate, teamGate, marketingGate, operationsGate, financeGate];
  const readiness = readinessFromGates(gates);
  const adventureStatus = adventure?.status || 'unknown';
  const lifecycle = deriveLifecycle({ campaign, adventureStatus, readiness, paidOrderCount: paidOrders.length, now });
  const health = deriveHealth({ campaign, lifecycle, operations, financeOverdue, duplicateCount });

  return {
    adventureStatus,
    visibility: adventure?.visibility ?? null,
    lifecycle,
    health: health.health,
    healthReason: health.reason,
    attentionRoute: health.route,
    readiness,
    gates,
    attendees,
    capacity,
    trackedRevenueCents,
    financeConfigured: finance.length > 0,
    marketingPublished,
    marketingScheduled,
    marketingDrafts,
    teamCount: staff.length,
    vendorCount: (operations.confirmedVendors ?? 0) + (operations.pendingVendors ?? 0),
  };
}

export async function listEventDraftPreviews(limit = 20): Promise<EventDraftPreview[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('host_event_imports')
    .select('id,adventure_id,source_type,source_label,source_url,extracted_payload,status,created_at,updated_at')
    .eq('owner_profile_id', userId)
    .eq('status', 'preview')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return ((data ?? []) as ImportRow[]).map((row) => {
    const draft = normalizeDraft(row.extracted_payload);
    const checks = [
      { ok: Boolean(draft.title.trim()), label: 'event title' },
      { ok: Boolean(draft.startsAt), label: 'start date/time' },
      { ok: Boolean(draft.endsAt), label: 'end date/time' },
      { ok: Boolean(draft.city.trim()), label: 'city' },
      { ok: Boolean(draft.state.trim()), label: 'state' },
    ];
    const completed = checks.filter((item) => item.ok).length;
    return {
      id: row.id,
      sourceLabel: row.source_label?.trim() || 'Event draft',
      sourceType: row.source_type,
      sourceKind: sourceKind(row.source_type),
      title: draft.title.trim() || row.source_label?.trim() || 'Untitled event draft',
      updatedAt: row.updated_at || row.created_at,
      completeness: Math.round((completed / checks.length) * 100),
      missing: checks.filter((item) => !item.ok).map((item) => item.label),
      resumeRoute: `/host/import-event?mode=files&resume=${row.id}`,
    };
  });
}

export async function loadEventDraftPreview(importId: string): Promise<ImportPreviewResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error('Sign in to continue this event draft.');

  const { data, error } = await supabase
    .from('host_event_imports')
    .select('id,adventure_id,source_type,source_label,source_url,extracted_payload,status,created_at,updated_at')
    .eq('id', importId)
    .eq('owner_profile_id', userId)
    .eq('status', 'preview')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This draft is no longer available.');

  const row = data as ImportRow;
  return {
    importId: row.id,
    preview: normalizeDraft(row.extracted_payload),
    sourceLabel: row.source_label?.trim() || 'Saved event draft',
    sourceUrl: row.source_url,
    extractionSource: 'source',
    duplicate: row.adventure_id ? {
      importId: row.id,
      adventureId: row.adventure_id,
      sourceLabel: row.source_label?.trim() || 'Existing event',
      status: row.status,
    } : null,
  };
}
