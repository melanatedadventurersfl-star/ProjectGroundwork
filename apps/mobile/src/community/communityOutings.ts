import { listAdventures } from '../adventures/api';
import type { AdventureSummary } from '../adventures/types';
import { supabase } from '../lib/supabase';

export async function listCommunityHostOutings(groupId: string): Promise<AdventureSummary[]> {
  const { data, error } = await supabase
    .from('community_outings')
    .select('adventure_id')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ids = new Set((data ?? []).map((row: any) => row.adventure_id as string));
  if (!ids.size) return [];

  const adventures = await listAdventures({});
  return adventures
    .filter((item) => ids.has(item.id))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}
