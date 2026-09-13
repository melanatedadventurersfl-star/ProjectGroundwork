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
  const { data, error } = await supabase.rpc('get_active_organization_primary_community');
  if (error) throw error;
  return typeof data === 'string' ? data : null;
}

export async function listManagedHostCommunityIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_active_organization_host_communities');
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => row.group_id)
    .filter((value: unknown): value is string => typeof value === 'string');
}
