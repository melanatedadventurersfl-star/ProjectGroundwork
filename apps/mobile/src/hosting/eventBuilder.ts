import { supabase } from '../lib/supabase';
import { integrityOperationsSummary } from './workIntegrity';

export type EventComponentKey =
  | 'tickets'
  | 'food'
  | 'vendors'
  | 'marketing'
  | 'communications'
  | 'team'
  | 'volunteers'
  | 'finance'
  | 'venue'
  | 'schedule'
  | 'activities'
  | 'lodging'
  | 'equipment'
  | 'safety'
  | 'sponsors'
  | 'transportation'
  | 'pages';

export type EventComponentDefinition = {
  key: EventComponentKey;
  title: string;
  description: string;
  icon: string;
  taskSeeds: Array<{ title: string; category: string; daysBefore?: number; priority?: 'critical' | 'high' | 'normal' }>;
};

export const EVENT_COMPONENTS: EventComponentDefinition[] = [
  { key: 'tickets', title: 'Tickets & Registration', description: 'Sell tickets, track registrations and revenue.', icon: '🎟️', taskSeeds: [
    { title: 'Finalize ticket types and pricing', category: 'Ticketing', daysBefore: 60, priority: 'high' },
    { title: 'Confirm ticket capacity', category: 'Ticketing', daysBefore: 60 },
    { title: 'Review refund and transfer policy', category: 'Ticketing', daysBefore: 45, priority: 'high' },
  ] },
  { key: 'food', title: 'Food & Meals', description: 'Plan meals, recipes, catering and food costs.', icon: '🍴', taskSeeds: [
    { title: 'Decide meal format', category: 'Food', daysBefore: 45, priority: 'high' },
    { title: 'Finalize event menu', category: 'Food', daysBefore: 21, priority: 'high' },
    { title: 'Calculate food quantities', category: 'Food', daysBefore: 14 },
    { title: 'Confirm cooking and serving equipment', category: 'Food', daysBefore: 10 },
  ] },
  { key: 'vendors', title: 'Vendors', description: 'Manage vendors, applications, documents and payments.', icon: '🏪', taskSeeds: [
    { title: 'Open vendor registration', category: 'Vendors', daysBefore: 60 },
    { title: 'Confirm vendor requirements', category: 'Vendors', daysBefore: 45 },
    { title: 'Review vendor insurance and permits', category: 'Vendors', daysBefore: 14, priority: 'high' },
  ] },
  { key: 'marketing', title: 'Marketing', description: 'Plan campaigns, content and ticket promotion.', icon: '📣', taskSeeds: [
    { title: 'Create event marketing plan', category: 'Marketing', daysBefore: 60, priority: 'high' },
    { title: 'Prepare launch assets', category: 'Marketing', daysBefore: 45 },
    { title: 'Schedule final ticket push', category: 'Marketing', daysBefore: 7 },
  ] },
  { key: 'communications', title: 'Communications', description: 'Email, notifications and automated messaging.', icon: '✉️', taskSeeds: [
    { title: 'Review attendee communication schedule', category: 'Communications', daysBefore: 30 },
    { title: 'Finalize day-before details', category: 'Communications', daysBefore: 3, priority: 'high' },
  ] },
  { key: 'team', title: 'Team', description: 'Add team members, roles and assignments.', icon: '👥', taskSeeds: [
    { title: 'Assign event leads', category: 'Team', daysBefore: 45, priority: 'high' },
    { title: 'Confirm team responsibilities', category: 'Team', daysBefore: 21 },
  ] },
  { key: 'volunteers', title: 'Volunteers', description: 'Recruit, schedule and manage volunteers.', icon: '🤝', taskSeeds: [
    { title: 'Define volunteer roles', category: 'Volunteers', daysBefore: 45 },
    { title: 'Fill volunteer shifts', category: 'Volunteers', daysBefore: 14, priority: 'high' },
  ] },
  { key: 'finance', title: 'Budget & Finance', description: 'Track income, expenses, budget and profit.', icon: '💵', taskSeeds: [
    { title: 'Create event budget', category: 'Finance', daysBefore: 60, priority: 'high' },
    { title: 'Review committed expenses', category: 'Finance', daysBefore: 14 },
  ] },
  { key: 'venue', title: 'Venue', description: 'Track location details, contracts and logistics.', icon: '📍', taskSeeds: [
    { title: 'Confirm venue contract and deposit', category: 'Venue', daysBefore: 60, priority: 'critical' },
    { title: 'Confirm parking, power and access', category: 'Venue', daysBefore: 14 },
  ] },
  { key: 'schedule', title: 'Schedule', description: 'Build the public schedule and run of show.', icon: '🗓️', taskSeeds: [
    { title: 'Draft event schedule', category: 'Schedule', daysBefore: 30 },
    { title: 'Finalize run of show', category: 'Schedule', daysBefore: 7, priority: 'high' },
  ] },
  { key: 'activities', title: 'Activities', description: 'Plan activities, supplies and experiences.', icon: '⭐', taskSeeds: [
    { title: 'Finalize event activities', category: 'Activities', daysBefore: 30 },
    { title: 'Confirm activity supplies and leads', category: 'Activities', daysBefore: 14 },
  ] },
  { key: 'lodging', title: 'Lodging / Camping', description: 'Manage campsites, rooms and assignments.', icon: '⛺', taskSeeds: [
    { title: 'Confirm lodging inventory', category: 'Lodging', daysBefore: 45 },
    { title: 'Finalize guest lodging assignments', category: 'Lodging', daysBefore: 7 },
  ] },
  { key: 'equipment', title: 'Equipment & Supplies', description: 'Track inventory, rentals and supplies.', icon: '📦', taskSeeds: [
    { title: 'Build equipment list', category: 'Equipment', daysBefore: 30 },
    { title: 'Resolve equipment shortages', category: 'Equipment', daysBefore: 14, priority: 'high' },
  ] },
  { key: 'safety', title: 'Safety & Compliance', description: 'Waivers, insurance, permits and safety planning.', icon: '🛡️', taskSeeds: [
    { title: 'Confirm permits and insurance', category: 'Safety', daysBefore: 30, priority: 'critical' },
    { title: 'Finalize emergency plan', category: 'Safety', daysBefore: 7, priority: 'high' },
  ] },
  { key: 'sponsors', title: 'Sponsors', description: 'Manage sponsor packages, payments and deliverables.', icon: '★', taskSeeds: [
    { title: 'Confirm sponsor packages', category: 'Sponsors', daysBefore: 60 },
    { title: 'Verify sponsor deliverables', category: 'Sponsors', daysBefore: 7 },
  ] },
  { key: 'transportation', title: 'Transportation', description: 'Parking, shuttles and transport logistics.', icon: '🚌', taskSeeds: [
    { title: 'Confirm parking and transportation plan', category: 'Transportation', daysBefore: 14 },
  ] },
  { key: 'pages', title: 'Event Pages', description: 'Public, team, vendor and volunteer information pages.', icon: '📄', taskSeeds: [
    { title: 'Review public event information', category: 'Event Pages', daysBefore: 30 },
    { title: 'Publish final event FAQ', category: 'Event Pages', daysBefore: 7 },
  ] },
];

export const DEFAULT_COMMUNICATIONS = [
  { key: 'registration-confirmation', name: 'Registration Confirmation', audience: 'registered_attendees', trigger: 'immediate', daysOffset: null },
  { key: 'event-14-day', name: '14-Day Event Reminder', audience: 'registered_attendees', trigger: 'relative', daysOffset: -14 },
  { key: 'event-7-day', name: '7-Day Preparation Reminder', audience: 'registered_attendees', trigger: 'relative', daysOffset: -7 },
  { key: 'event-day-before', name: 'Day-Before Details', audience: 'registered_attendees', trigger: 'relative', daysOffset: -1 },
  { key: 'event-day-of', name: 'Event Morning', audience: 'registered_attendees', trigger: 'relative', daysOffset: 0 },
  { key: 'event-thank-you', name: 'Post-Event Thank You', audience: 'registered_attendees', trigger: 'relative', daysOffset: 1 },
] as const;

function dueDate(startsAt: string, daysBefore?: number) {
  if (daysBefore == null) return null;
  const date = new Date(startsAt);
  date.setDate(date.getDate() - daysBefore);
  return date.toISOString();
}

function keyify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
}

async function currentProfileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('You must be signed in.');
  return data.user.id;
}

export async function getCampaignForAdventure(adventureId: string) {
  const { data, error } = await supabase.from('host_campaigns').select('id,adventure_id,title,short_title,location,starts_at,ends_at,status').eq('adventure_id', adventureId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listEventComponents(campaignId: string) {
  const { data, error } = await supabase.from('host_event_components').select('id,component_key,status,settings,created_at,updated_at').eq('campaign_id', campaignId).order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function addEventComponent(campaignId: string, componentKey: EventComponentKey, startsAt: string) {
  const profileId = await currentProfileId();
  const definition = EVENT_COMPONENTS.find((item) => item.key === componentKey);
  if (!definition) throw new Error('Unknown event component.');

  const { error: componentError } = await supabase.from('host_event_components').upsert({
    campaign_id: campaignId,
    component_key: componentKey,
    status: 'added',
    added_by: profileId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'campaign_id,component_key' });
  if (componentError) throw componentError;

  const rows = definition.taskSeeds.map((task, index) => ({
    campaign_id: campaignId,
    task_key: `component-${componentKey}-${keyify(task.title)}`,
    title: task.title,
    category: task.category,
    owner_label: 'Event owner',
    assignee_profile_id: null,
    due_label: task.daysBefore == null ? 'Date not set' : `${task.daysBefore} days before event`,
    due_at: dueDate(startsAt, task.daysBefore),
    status: 'not_started',
    priority: task.priority ?? 'normal',
    sort_order: 1000 + index,
    created_by: profileId,
    updated_by: profileId,
  }));
  if (rows.length) {
    const { error } = await supabase.from('host_campaign_tasks').upsert(rows, { onConflict: 'campaign_id,task_key', ignoreDuplicates: true });
    if (error) throw error;
  }

  if (componentKey === 'communications') await addDefaultCommunicationSchedule(campaignId);
  return true;
}

export async function removeEventComponent(campaignId: string, componentKey: EventComponentKey) {
  const { error } = await supabase.from('host_event_components').update({ status: 'disabled', updated_at: new Date().toISOString() }).eq('campaign_id', campaignId).eq('component_key', componentKey);
  if (error) throw error;
}

export async function addDefaultCommunicationSchedule(campaignId: string) {
  const profileId = await currentProfileId();
  const rows = DEFAULT_COMMUNICATIONS.map((item) => ({
    campaign_id: campaignId,
    communication_key: item.key,
    name: item.name,
    audience_type: item.audience,
    channel: 'email',
    trigger_type: item.trigger,
    days_offset: item.daysOffset,
    status: 'draft',
    created_by: profileId,
  }));
  const { error } = await supabase.from('host_event_communications').upsert(rows, { onConflict: 'campaign_id,communication_key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function getEventOperationsSummary(campaignId: string) {
  const [campaignResult, tasksResult, financeResult, vendorsResult, commsResult] = await Promise.all([
    supabase.from('host_campaigns').select('id,title,short_title,location,starts_at,ends_at').eq('id', campaignId).maybeSingle(),
    supabase.from('host_campaign_tasks').select('id,task_key,title,category,status,due_label,due_at,priority').eq('campaign_id', campaignId),
    supabase.from('host_event_finance_entries').select('entry_type,estimated_cents,actual_cents,paid_cents').eq('campaign_id', campaignId),
    supabase.from('host_event_vendors').select('id,status,document_status').eq('campaign_id', campaignId),
    supabase.from('host_event_communications').select('id,status').eq('campaign_id', campaignId),
  ]);
  if (campaignResult.error) throw campaignResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (financeResult.error) throw financeResult.error;
  if (vendorsResult.error) throw vendorsResult.error;
  if (commsResult.error) throw commsResult.error;

  const campaignRow = campaignResult.data;
  const taskSummary = campaignRow ? integrityOperationsSummary({
    id: campaignRow.id,
    title: campaignRow.title,
    shortTitle: campaignRow.short_title,
    location: campaignRow.location,
    startsAt: campaignRow.starts_at,
    endsAt: campaignRow.ends_at,
  }, (tasksResult.data ?? []).map((task) => ({
    id: task.id,
    taskKey: task.task_key,
    title: task.title,
    category: task.category,
    status: task.status,
    dueLabel: task.due_label,
    dueAt: task.due_at,
    priority: task.priority,
  }))) : {
    progress: 0,
    taskCount: 0,
    completeTaskCount: 0,
    openTaskCount: 0,
    overdueTaskCount: 0,
    needsSchedulingCount: 0,
    dateAssessment: { state: 'review' as const, spanDays: null, effectiveStart: Number.NaN, effectiveEnd: Number.NaN, reason: 'Event dates are unavailable.' },
  };

  const finance = financeResult.data ?? [];
  const revenueCents = finance.filter((row) => row.entry_type === 'revenue').reduce((sum, row) => sum + (row.actual_cents || row.estimated_cents || 0), 0);
  const expenseCents = finance.filter((row) => row.entry_type === 'expense').reduce((sum, row) => sum + (row.actual_cents || row.estimated_cents || 0), 0);

  return {
    ...taskSummary,
    revenueCents,
    expenseCents,
    profitCents: revenueCents - expenseCents,
    confirmedVendors: (vendorsResult.data ?? []).filter((vendor) => vendor.status === 'confirmed').length,
    pendingVendors: (vendorsResult.data ?? []).filter((vendor) => ['invited','applied','pending'].includes(vendor.status)).length,
    scheduledCommunications: (commsResult.data ?? []).filter((item) => item.status === 'scheduled').length,
    draftCommunications: (commsResult.data ?? []).filter((item) => item.status === 'draft').length,
  };
}
