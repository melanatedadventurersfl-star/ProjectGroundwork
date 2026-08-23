import { supabase } from '../lib/supabase';

export type CommunityManagementType = 'official' | 'member_led';

export async function getCommunityManagementTypes() {
  const { data, error } = await supabase
    .from('community_groups')
    .select('id, management_type');
  if (error) throw error;

  return new Map<string, CommunityManagementType>(
    (data ?? []).map((row: any) => [row.id as string, (row.management_type ?? 'member_led') as CommunityManagementType]),
  );
}
