import { supabase } from '../lib/supabase';

export type EventBuilderServerDraft<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  organizationId: string;
  profileId: string;
  creationKey: string;
  payload: TPayload;
  eventId: string | null;
  updatedAt: string;
};

function normalize<TPayload extends Record<string, unknown>>(row: any): EventBuilderServerDraft<TPayload> {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    profileId: String(row.profile_id),
    creationKey: String(row.creation_key),
    payload: (row.payload && typeof row.payload === 'object' ? row.payload : {}) as TPayload,
    eventId: row.event_id ? String(row.event_id) : null,
    updatedAt: String(row.updated_at ?? new Date(0).toISOString()),
  };
}

async function currentProfileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('You must be signed in.');
  return data.user.id;
}

export async function loadEventBuilderServerDraft<TPayload extends Record<string, unknown>>(organizationId: string): Promise<EventBuilderServerDraft<TPayload> | null> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('event_builder_drafts')
    .select('id,organization_id,profile_id,creation_key,payload,event_id,updated_at')
    .eq('organization_id', organizationId)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize<TPayload>(data) : null;
}

export async function saveEventBuilderServerDraft<TPayload extends Record<string, unknown>>(input: {
  organizationId: string;
  creationKey: string;
  payload: TPayload;
  eventId?: string | null;
}): Promise<EventBuilderServerDraft<TPayload>> {
  const profileId = await currentProfileId();
  const row = {
    organization_id: input.organizationId,
    profile_id: profileId,
    creation_key: input.creationKey,
    payload: input.payload,
    event_id: input.eventId ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('event_builder_drafts')
    .upsert(row, { onConflict: 'organization_id,profile_id' })
    .select('id,organization_id,profile_id,creation_key,payload,event_id,updated_at')
    .single();
  if (error) throw error;
  return normalize<TPayload>(data);
}

export async function linkEventBuilderDraftToEvent(organizationId: string, eventId: string) {
  const profileId = await currentProfileId();
  const { error } = await supabase
    .from('event_builder_drafts')
    .update({ event_id: eventId, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('profile_id', profileId);
  if (error) throw error;
}

export async function removeEventBuilderServerDraft(organizationId: string) {
  const profileId = await currentProfileId();
  const { error } = await supabase
    .from('event_builder_drafts')
    .delete()
    .eq('organization_id', organizationId)
    .eq('profile_id', profileId);
  if (error) throw error;
}
