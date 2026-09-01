import { supabase } from '../lib/supabase';
import { createDraftOuting } from './api';
import { addGeneralAdmissionTicket } from './tickets';
import type { HostLibraryItem } from './library';

export type EventDraft = {
  title: string;
  summary: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'moderate' | 'challenging';
  startsAt: string;
  endsAt: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  capacity: number | null;
  meetingInstructions: string;
  heroImageUrl: string;
  tickets: { label: string; priceText: string }[];
  schedule: { time: string; title: string }[];
  meals: string[];
  policies: string[];
  photos: string[];
  confidenceNotes: string[];
};

export type ImportPreviewResult = {
  importId: string;
  preview: EventDraft;
  sourceLabel: string;
  sourceUrl: string | null;
  extractionSource: 'ai' | 'source' | 'fallback';
  duplicate?: {
    importId: string;
    adventureId: string | null;
    sourceLabel: string;
    status: string;
  } | null;
};

export async function previewHostImport(input: { mode: 'event_site' | 'file_url' | 'pasted_text'; sourceUrl?: string; sourceText?: string }): Promise<ImportPreviewResult> {
  const { data, error } = await supabase.functions.invoke('host-import-preview', { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as ImportPreviewResult;
}

function dueDate(startsAt: string, daysBefore: number) {
  const date = new Date(startsAt);
  date.setDate(date.getDate() - daysBefore);
  return date.toISOString();
}

function keyify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item';
}

export async function createCampaignWorkspace(input: {
  adventureId: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  template?: HostLibraryItem | null;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const ownerProfileId = authData.user?.id;
  if (!ownerProfileId) throw new Error('Sign in to create an event workspace.');

  const slug = `${keyify(input.title)}-${input.adventureId.slice(0, 8)}`;
  const { data: campaign, error: campaignError } = await supabase.from('host_campaigns').insert({
    adventure_id: input.adventureId,
    slug,
    title: input.title,
    short_title: input.title.slice(0, 80),
    location: input.location,
    starts_at: new Date(input.startsAt).toISOString(),
    ends_at: new Date(input.endsAt).toISOString(),
    status: 'planning',
    accent: '#D7B45A',
    owner_profile_id: ownerProfileId,
  }).select('id,slug').single();
  if (campaignError) throw campaignError;

  const content = input.template?.content ?? {};
  const milestoneTitles = Array.isArray(content.default_milestones) ? content.default_milestones.map(String) : ['Venue locked', 'Ticketing ready', 'Experience locked', 'Event ready'];
  const weight = Math.max(1, Math.floor(100 / Math.max(1, milestoneTitles.length)));
  const milestoneRows = milestoneTitles.map((title, index) => ({
    campaign_id: campaign.id,
    milestone_key: `${keyify(title)}-${index + 1}`,
    title,
    weight: index === milestoneTitles.length - 1 ? 100 - weight * (milestoneTitles.length - 1) : weight,
    complete: false,
    sort_order: index + 1,
  }));
  if (milestoneRows.length) {
    const { error } = await supabase.from('host_campaign_milestones').insert(milestoneRows);
    if (error) throw error;
  }

  const rawTasks = Array.isArray(content.tasks) ? content.tasks : [];
  const taskRows = rawTasks.map((value: any, index) => ({
    campaign_id: campaign.id,
    task_key: `${keyify(String(value?.title ?? 'Task'))}-${index + 1}`,
    title: String(value?.title ?? 'Event task'),
    category: String(value?.category ?? 'Planning'),
    owner_label: String(value?.owner ?? 'Event owner'),
    assignee_profile_id: null,
    due_label: Number.isFinite(Number(value?.days_before)) ? `${Number(value.days_before)} days before event` : 'Date not set',
    due_at: Number.isFinite(Number(value?.days_before)) ? dueDate(input.startsAt, Number(value.days_before)) : null,
    status: 'not_started',
    priority: ['critical', 'high', 'normal'].includes(String(value?.priority)) ? String(value.priority) : 'normal',
    sort_order: index + 1,
    created_by: ownerProfileId,
    updated_by: ownerProfileId,
  }));
  if (taskRows.length) {
    const { error } = await supabase.from('host_campaign_tasks').insert(taskRows);
    if (error) throw error;
  }
  return campaign;
}

export async function createEventFromDraft(draft: EventDraft, options?: { importId?: string; template?: HostLibraryItem | null }) {
  if (!draft.title.trim()) throw new Error('Add an event title.');
  if (!draft.startsAt || !draft.endsAt) throw new Error('Add the event start and end time before creating the draft.');
  if (!draft.city.trim() || !draft.state.trim()) throw new Error('Add the event city and state.');

  const outing = await createDraftOuting({
    title: draft.title,
    summary: draft.summary || draft.title,
    description: draft.description || draft.summary || draft.title,
    category: draft.category || 'Other',
    difficulty: draft.difficulty,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    city: draft.city,
    state: draft.state,
    venueName: draft.venueName,
    capacity: draft.capacity,
    meetingInstructions: draft.meetingInstructions,
  });
  await addGeneralAdmissionTicket(outing.id, draft.capacity, 0);

  if (draft.heroImageUrl) {
    await supabase.from('adventures').update({ hero_image_url: draft.heroImageUrl, address: draft.address || null }).eq('id', outing.id);
  } else if (draft.address) {
    await supabase.from('adventures').update({ address: draft.address }).eq('id', outing.id);
  }

  const campaign = await createCampaignWorkspace({
    adventureId: outing.id,
    title: draft.title,
    location: [draft.venueName, draft.city, draft.state].filter(Boolean).join(', '),
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    template: options?.template ?? null,
  });

  if (options?.importId) {
    const { error } = await supabase.from('host_event_imports').update({
      adventure_id: outing.id,
      approved_payload: draft,
      status: 'created',
      updated_at: new Date().toISOString(),
    }).eq('id', options.importId);
    if (error) throw error;
  } else if (options?.template) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const ownerProfileId = authData.user?.id;
    if (!ownerProfileId) throw new Error('Sign in to record template provenance.');
    const { error } = await supabase.from('host_event_imports').insert({
      owner_profile_id: ownerProfileId,
      adventure_id: outing.id,
      source_type: 'template',
      source_label: options.template.title,
      source_library_item_id: options.template.id,
      extracted_payload: { templateItemKey: options.template.itemKey, templateContent: options.template.content },
      approved_payload: draft,
      status: 'created',
    });
    if (error) throw error;
  }

  return { outing, campaign };
}

export function draftFromTemplate(template: HostLibraryItem): EventDraft {
  return {
    title: '', summary: template.summary, description: template.summary, category: 'Camping', difficulty: 'easy', startsAt: '', endsAt: '', venueName: '', address: '', city: '', state: 'FL', capacity: 20, meetingInstructions: '', heroImageUrl: '', tickets: [], schedule: [], meals: [], policies: [], photos: [], confidenceNotes: [`Starting from ${template.title}. Review dates, location, capacity, pricing, and guest-facing details before publishing.`],
  };
}
