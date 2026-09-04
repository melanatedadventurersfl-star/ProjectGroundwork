import { supabase } from '../lib/supabase';

export type HostSocialKind = 'facebook_group' | 'facebook_page' | 'instagram' | 'custom';
export type HostSocialConnectionMode = 'manual' | 'meta';

export type HostSocialProfile = {
  id: string;
  organization_id: string;
  kind: HostSocialKind;
  display_name: string;
  handle: string | null;
  url: string;
  description: string | null;
  image_url: string | null;
  audience_count: number | null;
  audience_label: string | null;
  is_primary: boolean;
  is_public: boolean;
  connection_mode: HostSocialConnectionMode;
  provider_account_id: string | null;
  imported_data: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

const SOCIAL_COLUMNS = 'id,organization_id,kind,display_name,handle,url,description,image_url,audience_count,audience_label,is_primary,is_public,connection_mode,provider_account_id,imported_data,last_synced_at,created_at,updated_at';

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('You must be signed in.');
  return id;
}

function normalize(row: any): HostSocialProfile {
  return {
    ...row,
    audience_count: row.audience_count == null ? null : Number(row.audience_count),
    imported_data: row.imported_data && typeof row.imported_data === 'object' ? row.imported_data : {},
  } as HostSocialProfile;
}

export async function listOrganizationSocialProfiles(organizationId: string, publicOnly = false): Promise<HostSocialProfile[]> {
  let query = supabase.from('host_social_profiles').select(SOCIAL_COLUMNS).eq('organization_id', organizationId);
  if (publicOnly) query = query.eq('is_public', true);
  const { data, error } = await query.order('is_primary', { ascending: false }).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function getOrganizationSocialProfile(id: string): Promise<HostSocialProfile> {
  const { data, error } = await supabase.from('host_social_profiles').select(SOCIAL_COLUMNS).eq('id', id).single();
  if (error) throw error;
  return normalize(data);
}

export async function saveOrganizationSocialProfile(input: {
  id?: string;
  organizationId: string;
  kind: HostSocialKind;
  displayName: string;
  handle?: string;
  url: string;
  description?: string;
  imageUrl?: string;
  audienceCount?: number | null;
  audienceLabel?: string;
  isPublic?: boolean;
  isPrimary?: boolean;
}) {
  const profileId = await currentProfileId();
  const displayName = input.displayName.trim();
  const url = input.url.trim();
  if (!displayName) throw new Error('Add a social profile name.');
  if (!url) throw new Error('Add the social profile URL.');

  const payload = {
    organization_id: input.organizationId,
    kind: input.kind,
    display_name: displayName,
    handle: input.handle?.trim() || null,
    url,
    description: input.description?.trim() || null,
    image_url: input.imageUrl?.trim() || null,
    audience_count: Number.isFinite(input.audienceCount) ? input.audienceCount : null,
    audience_label: input.audienceLabel?.trim() || (input.kind === 'facebook_group' ? 'members' : 'followers'),
    is_public: input.isPublic ?? true,
    connection_mode: 'manual' as const,
    created_by: profileId,
    updated_at: new Date().toISOString(),
  };

  const result = input.id
    ? await supabase.from('host_social_profiles').update(payload).eq('id', input.id).select(SOCIAL_COLUMNS).single()
    : await supabase.from('host_social_profiles').insert(payload).select(SOCIAL_COLUMNS).single();
  if (result.error) throw result.error;

  if (input.isPrimary) await setPrimaryOrganizationSocialProfile(result.data.id);
  return getOrganizationSocialProfile(result.data.id);
}

export async function deleteOrganizationSocialProfile(id: string) {
  const { error } = await supabase.from('host_social_profiles').delete().eq('id', id);
  if (error) throw error;
}

export async function setPrimaryOrganizationSocialProfile(id: string) {
  const { error } = await supabase.rpc('set_host_social_primary', { p_social_id: id });
  if (error) throw error;
}

export async function setOrganizationSocialProfileVisibility(id: string, isPublic: boolean) {
  const { error } = await supabase.from('host_social_profiles').update({ is_public: isPublic, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export function socialKindLabel(kind: HostSocialKind) {
  if (kind === 'facebook_group') return 'Facebook Group';
  if (kind === 'facebook_page') return 'Facebook Page';
  if (kind === 'instagram') return 'Instagram';
  return 'Other';
}
