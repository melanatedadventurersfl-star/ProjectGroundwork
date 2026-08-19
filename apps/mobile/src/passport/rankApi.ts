import { supabase } from '../lib/supabase';
import type { RankName } from './RankEmblem';

export type PassportRankState = {
  completed_adventures: number;
  calculated_rank: RankName;
  rank_override: RankName | null;
  effective_rank: RankName;
};

export async function getMyPassportRank(): Promise<PassportRankState> {
  const { data, error } = await supabase.rpc('get_my_passport_rank');
  if (error) throw error;
  return data as PassportRankState;
}
