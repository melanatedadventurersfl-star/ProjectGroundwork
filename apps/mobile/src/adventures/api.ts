import { Image } from 'react-native';

import { supabase } from '../lib/supabase';
import type { AdventureDetail, AdventureSummary } from './types';

const DEFAULT_ADVENTURE_IMAGE_URL = Image.resolveAssetSource(
  require('../../assets/explore/default-event.jpg'),
).uri;

export type AdventureFilters = {
  search?: string;
  category?: string;
  state?: string;
  difficulty?: string;
  savedOnly?: boolean;
};

export type AdventureRsvpStatus = 'interested' | 'going' | 'not_going';
export type AdventureAttendanceVisibility = 'community' | 'private';

export type AdventureRsvpSummary = {
  interested: number;
  going: number;
  myStatus: AdventureRsvpStatus | null;
  myVisibility: AdventureAttendanceVisibility;
};

export type AdventureTicketType = {
  id: string;
  adventure_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number | null;
  min_per_order: number;
  max_per_order: number;
  is_active: boolean;
  sort_order: number;
};

async function attachSavedState(adventures: AdventureSummary[], savedOnly = false): Promise<AdventureSummary[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const profileId = sessionData.session?.user.id;
  if (!profileId || adventures.length === 0) return savedOnly ? [] : adventures;

  const { data: saved, error: savedError } = await supabase
    .from('saved_adventures')
    .select('adventure_id')
    .eq('profile_id', profileId);
  if (savedError) throw savedError;

  const savedIds = new Set((saved ?? []).map((row) => row.adventure_id as string));
  const enriched = adventures.map((adventure) => ({ ...adventure, is_saved: savedIds.has(adventure.id) }));
  return savedOnly ? enriched.filter((adventure) => adventure.is_saved) : enriched;
}

export async function listAdventures(filters: AdventureFilters = {}): Promise<AdventureSummary[]> {
  let query = supabase
    .from('adventure_discovery')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('starts_at', { ascending: true });

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_,]/g, '');
    query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%,category.ilike.%${term}%`);
  }
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.state) query = query.eq('state', filters.state);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);

  const { data, error } = await query;
  if (error) throw error;

  const adventures = ((data ?? []) as AdventureSummary[]).map((adventure) => ({
    ...adventure,
    hero_image_url: adventure.hero_image_url || DEFAULT_ADVENTURE_IMAGE_URL,
  }));

  return attachSavedState(adventures, filters.savedOnly);
}

export async function listPastAdventures(): Promise<AdventureSummary[]> {
  const { data, error } = await supabase
    .from('past_adventure_discovery')
    .select('*')
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return attachSavedState((data ?? []) as AdventureSummary[]);
}

export async function getAdventure(id: string): Promise<AdventureDetail> {
  const [{ data, error }, { data: sessionData }] = await Promise.all([
    supabase.from('adventures').select('*').eq('id', id).single(),
    supabase.auth.getSession(),
  ]);
  if (error) throw error;

  const profileId = sessionData.session?.user.id;
  if (!profileId) return data as AdventureDetail;

  const { data: saved, error: savedError } = await supabase
    .from('saved_adventures')
    .select('adventure_id')
    .eq('profile_id', profileId)
    .eq('adventure_id', id)
    .maybeSingle();
  if (savedError) throw savedError;

  return { ...(data as AdventureDetail), is_saved: Boolean(saved) };
}

export async function listAdventureTicketTypes(adventureId: string): Promise<AdventureTicketType[]> {
  const { data, error } = await supabase
    .from('ticket_types')
    .select('id,adventure_id,name,description,price_cents,capacity,min_per_order,max_per_order,is_active,sort_order')
    .eq('adventure_id', adventureId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('price_cents', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdventureTicketType[];
}

export async function getAdventureRsvpSummary(adventureId: string): Promise<AdventureRsvpSummary> {
  const [{ data: sessionData }, { data, error }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('adventure_rsvps').select('profile_id,status,visibility').eq('adventure_id', adventureId),
  ]);
  if (error) throw error;

  const userId = sessionData.session?.user.id;
  let interested = 0;
  let going = 0;
  let myStatus: AdventureRsvpStatus | null = null;
  let myVisibility: AdventureAttendanceVisibility = 'private';

  for (const row of data ?? []) {
    if (row.status === 'interested') interested += 1;
    if (row.status === 'going') going += 1;
    if (row.profile_id === userId) {
      myStatus = row.status as AdventureRsvpStatus;
      myVisibility = (row.visibility ?? 'private') as AdventureAttendanceVisibility;
    }
  }

  return { interested, going, myStatus, myVisibility };
}

export async function setAdventureRsvp(
  adventureId: string,
  status: AdventureRsvpStatus,
  visibility: AdventureAttendanceVisibility = 'private',
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const profileId = sessionData.session?.user.id;
  if (!profileId) throw new Error('You must be signed in to RSVP.');

  const { error } = await supabase.from('adventure_rsvps').upsert(
    {
      adventure_id: adventureId,
      profile_id: profileId,
      status,
      visibility,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'adventure_id,profile_id' },
  );
  if (error) throw error;
}

export async function setAdventureSaved(adventureId: string, shouldSave: boolean): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const profileId = sessionData.session?.user.id;
  if (!profileId) throw new Error('You must be signed in to save an adventure.');

  if (!shouldSave) {
    const { error } = await supabase
      .from('saved_adventures')
      .delete()
      .eq('profile_id', profileId)
      .eq('adventure_id', adventureId);
    if (error) throw error;
    return;
  }

  const { data: existing, error: lookupError } = await supabase
    .from('saved_adventures')
    .select('adventure_id')
    .eq('profile_id', profileId)
    .eq('adventure_id', adventureId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;

  const { error } = await supabase
    .from('saved_adventures')
    .insert({ profile_id: profileId, adventure_id: adventureId });
  if (error) throw error;
}
