import { supabase } from '../lib/supabase';
import type { AdventureDetail, AdventureSummary } from './types';

export type AdventureFilters = {
  search?: string;
  category?: string;
  state?: string;
  difficulty?: string;
  savedOnly?: boolean;
};

export async function listAdventures(filters: AdventureFilters = {}): Promise<AdventureSummary[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const profileId = sessionData.session?.user.id;

  let query = supabase
    .from('adventure_discovery')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('starts_at', { ascending: true });

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_,]/g, '');
    query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%,city.ilike.%${term}%`);
  }
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.state) query = query.eq('state', filters.state);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);

  const { data, error } = await query;
  if (error) throw error;

  const adventures = (data ?? []) as AdventureSummary[];
  if (!profileId || adventures.length === 0) return adventures;

  const { data: saved, error: savedError } = await supabase
    .from('saved_adventures')
    .select('adventure_id')
    .eq('profile_id', profileId);
  if (savedError) throw savedError;

  const savedIds = new Set((saved ?? []).map((row) => row.adventure_id as string));
  const enriched = adventures.map((adventure) => ({ ...adventure, is_saved: savedIds.has(adventure.id) }));
  return filters.savedOnly ? enriched.filter((adventure) => adventure.is_saved) : enriched;
}

export async function getAdventure(id: string): Promise<AdventureDetail> {
  const { data, error } = await supabase
    .from('adventures')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as AdventureDetail;
}

export async function setAdventureSaved(adventureId: string, shouldSave: boolean): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const profileId = sessionData.session?.user.id;
  if (!profileId) throw new Error('You must be signed in to save an adventure.');

  const operation = shouldSave
    ? supabase.from('saved_adventures').upsert({ profile_id: profileId, adventure_id: adventureId })
    : supabase.from('saved_adventures').delete().eq('profile_id', profileId).eq('adventure_id', adventureId);

  const { error } = await operation;
  if (error) throw error;
}
