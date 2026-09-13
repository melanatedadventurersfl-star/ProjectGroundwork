import { supabase } from '../lib/supabase';

export type ActiveHostOrganizationContext = {
  id: string;
  name: string;
  primaryCommunityId: string | null;
};

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

export async function getActiveHostOrganizationContext(): Promise<ActiveHostOrganizationContext | null> {
  const { data, error } = await supabase.rpc('get_active_host_organization_context');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row.host_organization_id !== 'string') return null;
  return {
    id: row.host_organization_id,
    name: typeof row.host_name === 'string' ? row.host_name : 'Host',
    primaryCommunityId: typeof row.primary_community_id === 'string' ? row.primary_community_id : null,
  };
}

export async function setPrimaryHostCommunity(hostOrganizationId: string, groupId: string) {
  const { error } = await supabase.rpc('set_host_organization_primary_community', {
    p_host_organization_id: hostOrganizationId,
    p_group_id: groupId,
  });
  if (error) throw error;
}

export async function getPrimaryHostCommunityId(hostOrganizationId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_host_organization_primary_community', {
    p_host_organization_id: hostOrganizationId,
  });
  if (error) throw error;
  return typeof data === 'string' ? data : null;
}

export async function listManagedHostCommunityIds(hostOrganizationId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_host_organization_communities', {
    p_host_organization_id: hostOrganizationId,
  });
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => row.group_id)
    .filter((value: unknown): value is string => typeof value === 'string');
}
