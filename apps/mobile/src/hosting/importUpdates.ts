import { supabase } from '../lib/supabase';
import type { EventDraft } from './creation';

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
};

export type EventUpdateField =
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

export type EventUpdateChange = {
  field: EventUpdateField;
  label: string;
  current: string;
  imported: string;
};

const fieldLabels: Record<EventUpdateField, string> = {
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

function text(value: unknown) {
  return value == null ? '' : String(value).trim();
}

function comparableDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 16);
}

export async function loadExistingEventForImport(adventureId: string): Promise<ExistingEventSnapshot> {
  const { data, error } = await supabase
    .from('adventures')
    .select('id,title,summary,description,category,difficulty,starts_at,ends_at,venue_name,address,city,state,capacity,spots_remaining,meeting_instructions,hero_image_url')
    .eq('id', adventureId)
    .single();
  if (error) throw error;

  const { data: campaign } = await supabase
    .from('host_campaigns')
    .select('slug')
    .eq('adventure_id', adventureId)
    .maybeSingle();

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
  };
}

export function diffImportedEvent(current: ExistingEventSnapshot, draft: EventDraft): EventUpdateChange[] {
  const fields: EventUpdateField[] = [
    'title', 'summary', 'description', 'category', 'difficulty', 'startsAt', 'endsAt',
    'venueName', 'address', 'city', 'state', 'capacity', 'meetingInstructions', 'heroImageUrl',
  ];

  return fields.flatMap((field) => {
    const currentValue = field === 'capacity' ? current.capacity : current[field];
    const importedValue = field === 'capacity' ? draft.capacity : draft[field];
    const currentComparable = field === 'startsAt' || field === 'endsAt' ? comparableDate(text(currentValue)) : text(currentValue);
    const importedComparable = field === 'startsAt' || field === 'endsAt' ? comparableDate(text(importedValue)) : text(importedValue);
    if (!importedComparable || currentComparable === importedComparable) return [];
    return [{ field, label: fieldLabels[field], current: text(currentValue) || 'Not set', imported: text(importedValue) || 'Not set' }];
  });
}

export async function applyReviewedImportUpdate(input: {
  existing: ExistingEventSnapshot;
  draft: EventDraft;
  importId: string;
  fields: EventUpdateField[];
}) {
  if (!input.fields.length) throw new Error('Select at least one imported change to apply.');

  const fieldSet = new Set(input.fields);
  const adventurePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const map: Record<EventUpdateField, string> = {
    title: 'title', summary: 'summary', description: 'description', category: 'category', difficulty: 'difficulty',
    startsAt: 'starts_at', endsAt: 'ends_at', venueName: 'venue_name', address: 'address', city: 'city', state: 'state',
    capacity: 'capacity', meetingInstructions: 'meeting_instructions', heroImageUrl: 'hero_image_url',
  };

  for (const field of input.fields) adventurePatch[map[field]] = input.draft[field];

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

  const approvedChanges = input.fields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field] = input.draft[field];
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
