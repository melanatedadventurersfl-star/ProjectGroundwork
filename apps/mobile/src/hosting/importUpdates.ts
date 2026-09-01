import { supabase } from '../lib/supabase';
import type { EventDraft } from './creation';
import { contentFromDraft, loadEventContent, saveEventContentSections, type EventContent, type EventContentSectionType } from './eventContent';

export type ExistingEventSnapshot = {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  difficulty: EventDraft['difficulty'];
  startsAt: string;
  endsAt: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  capacity: number | null;
  spotsRemaining: number | null;
  meetingInstructions: string;
  heroImageUrl: string;
  campaignSlug: string | null;
  content: EventContent;
};

export type EventCoreUpdateField =
  | 'title'
  | 'summary'
  | 'description'
  | 'category'
  | 'difficulty'
  | 'startsAt'
  | 'endsAt'
  | 'venueName'
  | 'address'
  | 'city'
  | 'state'
  | 'capacity'
  | 'meetingInstructions'
  | 'heroImageUrl';

export type EventSectionUpdateField = 'schedule' | 'meals' | 'policies' | 'operations' | 'gear' | 'guestInfo' | 'marketing';
export type EventUpdateField = EventCoreUpdateField | EventSectionUpdateField;

export type EventUpdateChange = {
  field: EventUpdateField;
  label: string;
  current: string;
  imported: string;
  section: 'event' | 'content';
};

const coreFieldLabels: Record<EventCoreUpdateField, string> = {
  title: 'Title',
  summary: 'Summary',
  description: 'Description',
  category: 'Category',
  difficulty: 'Difficulty',
  startsAt: 'Starts',
  endsAt: 'Ends',
  venueName: 'Venue',
  address: 'Address',
  city: 'City',
  state: 'State',
  capacity: 'Capacity',
  meetingInstructions: 'Meeting instructions',
  heroImageUrl: 'Cover image',
};

const sectionFieldLabels: Record<EventSectionUpdateField, string> = {
  schedule: 'Schedule',
  meals: 'Meals',
  policies: 'Policies',
  operations: 'Operations tasks',
  gear: 'Gear list',
  guestInfo: 'Guest information',
  marketing: 'Marketing plan',
};

const sectionTypeForField: Record<EventSectionUpdateField, EventContentSectionType> = {
  schedule: 'schedule',
  meals: 'meals',
  policies: 'policies',
  operations: 'operations',
  gear: 'gear',
  guestInfo: 'guest_info',
  marketing: 'marketing',
};

function text(value: unknown) {
  return value == null ? '' : String(value).trim();
}

function comparableDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 16);
}

function displayDate(value: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function compactItems(items: unknown[]) {
  if (!items.length) return 'Not set';
  const values = items.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'title' in item) {
      const record = item as { time?: string; title?: string };
      return [record.time, record.title].filter(Boolean).join(' · ');
    }
    return JSON.stringify(item);
  });
  return values.slice(0, 6).join('\n') + (values.length > 6 ? `\n+${values.length - 6} more` : '');
}

function sameArray(a: unknown[], b: unknown[]) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

export async function loadExistingEventForImport(adventureId: string): Promise<ExistingEventSnapshot> {
  const { data, error } = await supabase
    .from('adventures')
    .select('id,title,summary,description,category,difficulty,starts_at,ends_at,venue_name,address,city,state,capacity,spots_remaining,meeting_instructions,hero_image_url')
    .eq('id', adventureId)
    .single();
  if (error) throw error;

  const [{ data: campaign }, content] = await Promise.all([
    supabase.from('host_campaigns').select('slug').eq('adventure_id', adventureId).maybeSingle(),
    loadEventContent(adventureId),
  ]);

  return {
    id: data.id,
    title: data.title ?? '',
    summary: data.summary ?? '',
    description: data.description ?? '',
    category: data.category ?? 'Other',
    difficulty: (data.difficulty ?? 'easy') as EventDraft['difficulty'],
    startsAt: data.starts_at ?? '',
    endsAt: data.ends_at ?? '',
    venueName: data.venue_name ?? '',
    address: data.address ?? '',
    city: data.city ?? '',
    state: data.state ?? '',
    capacity: data.capacity ?? null,
    spotsRemaining: data.spots_remaining ?? null,
    meetingInstructions: data.meeting_instructions ?? '',
    heroImageUrl: data.hero_image_url ?? '',
    campaignSlug: campaign?.slug ?? null,
    content,
  };
}

export function diffImportedEvent(current: ExistingEventSnapshot, draft: EventDraft): EventUpdateChange[] {
  const coreFields: EventCoreUpdateField[] = [
    'title', 'summary', 'description', 'category', 'difficulty', 'startsAt', 'endsAt',
    'venueName', 'address', 'city', 'state', 'capacity', 'meetingInstructions', 'heroImageUrl',
  ];

  const coreChanges = coreFields.flatMap((field) => {
    const currentValue = field === 'capacity' ? current.capacity : current[field];
    const importedValue = field === 'capacity' ? draft.capacity : draft[field];
    const currentComparable = field === 'startsAt' || field === 'endsAt' ? comparableDate(text(currentValue)) : text(currentValue);
    const importedComparable = field === 'startsAt' || field === 'endsAt' ? comparableDate(text(importedValue)) : text(importedValue);
    if (!importedComparable || currentComparable === importedComparable) return [];
    return [{
      field,
      label: coreFieldLabels[field],
      current: field === 'startsAt' || field === 'endsAt' ? displayDate(text(currentValue)) : text(currentValue) || 'Not set',
      imported: field === 'startsAt' || field === 'endsAt' ? displayDate(text(importedValue)) : text(importedValue) || 'Not set',
      section: 'event' as const,
    }];
  });

  const importedContent = contentFromDraft(draft);
  const sectionFields: EventSectionUpdateField[] = ['schedule', 'meals', 'policies', 'operations', 'gear', 'guestInfo', 'marketing'];
  const sectionChanges = sectionFields.flatMap((field) => {
    const currentItems = current.content[field] ?? [];
    const importedItems = importedContent[field] ?? [];
    if (!importedItems.length || sameArray(currentItems, importedItems)) return [];
    return [{
      field,
      label: sectionFieldLabels[field],
      current: compactItems(currentItems),
      imported: compactItems(importedItems),
      section: 'content' as const,
    }];
  });

  return [...coreChanges, ...sectionChanges];
}

async function addMissingOperationsTasks(adventureId: string, operations: string[], ownerProfileId: string) {
  if (!operations.length) return;
  const { data: campaign, error: campaignError } = await supabase.from('host_campaigns').select('id').eq('adventure_id', adventureId).maybeSingle();
  if (campaignError) throw campaignError;
  if (!campaign?.id) return;

  const { data: existingTasks, error: tasksError } = await supabase.from('host_campaign_tasks').select('title').eq('campaign_id', campaign.id);
  if (tasksError) throw tasksError;
  const existingTitles = new Set((existingTasks ?? []).map((row) => String(row.title).trim().toLowerCase()));
  const missing = operations.filter((title) => !existingTitles.has(title.trim().toLowerCase()));
  if (!missing.length) return;

  const rows = missing.map((title, index) => ({
    campaign_id: campaign.id,
    task_key: `imported-operations-${Date.now()}-${index + 1}`,
    title,
    category: 'Operations',
    owner_label: 'Event owner',
    assignee_profile_id: null,
    due_label: 'Imported from updated event materials',
    due_at: null,
    status: 'not_started',
    priority: 'normal',
    sort_order: 700 + index,
    created_by: ownerProfileId,
    updated_by: ownerProfileId,
  }));
  const { error } = await supabase.from('host_campaign_tasks').insert(rows);
  if (error) throw error;
}

export async function applyReviewedImportUpdate(input: {
  existing: ExistingEventSnapshot;
  draft: EventDraft;
  importId: string;
  fields: EventUpdateField[];
}) {
  if (!input.fields.length) throw new Error('Select at least one imported change to apply.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const ownerProfileId = authData.user?.id;
  if (!ownerProfileId) throw new Error('Sign in to update this event.');

  const fieldSet = new Set(input.fields);
  const coreFields = input.fields.filter((field): field is EventCoreUpdateField => field in coreFieldLabels);
  const sectionFields = input.fields.filter((field): field is EventSectionUpdateField => field in sectionFieldLabels);

  if (coreFields.length) {
    const adventurePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const map: Record<EventCoreUpdateField, string> = {
      title: 'title', summary: 'summary', description: 'description', category: 'category', difficulty: 'difficulty',
      startsAt: 'starts_at', endsAt: 'ends_at', venueName: 'venue_name', address: 'address', city: 'city', state: 'state',
      capacity: 'capacity', meetingInstructions: 'meeting_instructions', heroImageUrl: 'hero_image_url',
    };
    for (const field of coreFields) adventurePatch[map[field]] = input.draft[field];
    if (fieldSet.has('capacity') && input.draft.capacity != null && input.existing.capacity != null) {
      const delta = input.draft.capacity - input.existing.capacity;
      if (input.existing.spotsRemaining != null) adventurePatch.spots_remaining = Math.max(0, input.existing.spotsRemaining + delta);
    }
    const { error: adventureError } = await supabase.from('adventures').update(adventurePatch).eq('id', input.existing.id);
    if (adventureError) throw adventureError;

    const campaignPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (fieldSet.has('title')) {
      campaignPatch.title = input.draft.title;
      campaignPatch.short_title = input.draft.title.slice(0, 80);
    }
    if (fieldSet.has('startsAt')) campaignPatch.starts_at = new Date(input.draft.startsAt).toISOString();
    if (fieldSet.has('endsAt')) campaignPatch.ends_at = new Date(input.draft.endsAt).toISOString();
    if (fieldSet.has('venueName') || fieldSet.has('city') || fieldSet.has('state')) {
      campaignPatch.location = [input.draft.venueName, input.draft.city, input.draft.state].filter(Boolean).join(', ');
    }
    if (Object.keys(campaignPatch).length > 1) {
      const { error: campaignError } = await supabase.from('host_campaigns').update(campaignPatch).eq('adventure_id', input.existing.id);
      if (campaignError) throw campaignError;
    }
  }

  if (sectionFields.length) {
    await saveEventContentSections({
      adventureId: input.existing.id,
      ownerProfileId,
      importId: input.importId,
      content: contentFromDraft(input.draft),
      sections: sectionFields.map((field) => sectionTypeForField[field]),
    });
    if (fieldSet.has('operations')) await addMissingOperationsTasks(input.existing.id, input.draft.operations ?? [], ownerProfileId);
  }

  const approvedChanges = input.fields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field] = input.draft[field as keyof EventDraft];
    return acc;
  }, {});
  const { error: importError } = await supabase.from('host_event_imports').update({
    adventure_id: input.existing.id,
    approved_payload: { mode: 'update_existing', fields: approvedChanges },
    status: 'created',
    updated_at: new Date().toISOString(),
  }).eq('id', input.importId);
  if (importError) throw importError;

  return { adventureId: input.existing.id, campaignSlug: input.existing.campaignSlug };
}
