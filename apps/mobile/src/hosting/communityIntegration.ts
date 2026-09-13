import { supabase } from '../lib/supabase';

export function interestSlug(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function setHostOutingInterests(adventureId: string, labels: string[]) {
  const slugs = Array.from(new Set(labels.map(interestSlug).filter(Boolean)));
  const { error } = await supabase.rpc('set_adventure_interests', {
    p_adventure_id: adventureId,
    p_interest_slugs: slugs,
  });
  if (error) throw error;
}

export async function setPrimaryHostCommunity(groupId: string) {
  const { error } = await supabase.rpc('set_primary_host_community', { p_group_id: groupId });
  if (error) throw error;
}

export async function getPrimaryHostCommunityId(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const profileId = sessionData.session?.user.id;
  if (!profileId) return null;

  const { data, error } = await supabase
    .from('host_profiles')
    .select('primary_community_id')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return (data?.primary_community_id as string | null | undefined) ?? null;
}
