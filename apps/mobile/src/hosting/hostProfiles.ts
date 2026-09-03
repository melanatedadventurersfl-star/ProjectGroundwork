import { prepareLocalImage } from '../lib/imageUpload';
import { supabase } from '../lib/supabase';

const HOST_MEDIA_BUCKET = 'adventure-photos';
const SIGNED_MEDIA_TTL_SECONDS = 60 * 60;

export type EventVisibility = 'public' | 'unlisted' | 'private' | 'community';

export type HostProfileView = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  homeCity: string | null;
  homeState: string | null;
  publicTitle: string | null;
  bio: string | null;
  businessName: string | null;
  websiteUrl: string | null;
  coverImageUrl: string | null;
  isPublic: boolean;
  followerCount: number;
};

export type HostFollower = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  homeCity: string | null;
  homeState: string | null;
  followedAt: string;
};

export type HostOrganization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  is_public: boolean;
};

export type HostMediaItem = { id: string; image_url: string; caption: string | null };
export type HostHistoryItem = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  city: string;
  state: string;
  status: string;
  visibility: EventVisibility;
  organization_id: string | null;
  host_media: HostMediaItem[];
};

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('You must be signed in.');
  return id;
}

function isRemoteUrl(value: string) {
  return /^(https?:|data:|file:)/i.test(value);
}

async function hydrateMedia(item: HostMediaItem): Promise<HostMediaItem> {
  if (!item.image_url || isRemoteUrl(item.image_url)) return item;
  const { data, error } = await supabase.storage.from(HOST_MEDIA_BUCKET).createSignedUrl(item.image_url, SIGNED_MEDIA_TTL_SECONDS);
  if (error) return item;
  return { ...item, image_url: data.signedUrl };
}

export async function ensureMyHostProfile() {
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('host_profiles')
    .upsert({ profile_id: profileId }, { onConflict: 'profile_id', ignoreDuplicates: true })
    .select('profile_id,public_title,bio,business_name,website_url,cover_image_url,is_public')
    .single();
  if (error) throw error;
  return data;
}

export async function getMyHostProfile(): Promise<HostProfileView> {
  const profileId = await currentProfileId();
  await ensureMyHostProfile();
  const [profileResult, hostResult, followerResult] = await Promise.all([
    supabase.from('profiles').select('id,display_name,avatar_url,home_city,home_state').eq('id', profileId).single(),
    supabase.from('host_profiles').select('profile_id,public_title,bio,business_name,website_url,cover_image_url,is_public').eq('profile_id', profileId).single(),
    supabase.from('host_follows').select('follower_profile_id', { count: 'exact', head: true }).eq('host_profile_id', profileId),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (hostResult.error) throw hostResult.error;
  if (followerResult.error) throw followerResult.error;
  return {
    profileId,
    displayName: profileResult.data.display_name || 'Host',
    avatarUrl: profileResult.data.avatar_url,
    homeCity: profileResult.data.home_city,
    homeState: profileResult.data.home_state,
    publicTitle: hostResult.data.public_title,
    bio: hostResult.data.bio,
    businessName: hostResult.data.business_name,
    websiteUrl: hostResult.data.website_url,
    coverImageUrl: hostResult.data.cover_image_url,
    isPublic: hostResult.data.is_public,
    followerCount: followerResult.count ?? 0,
  };
}

export async function listMyHostFollowers(): Promise<HostFollower[]> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('host_follows')
    .select('follower_profile_id,created_at,profiles!host_follows_follower_profile_id_fkey(id,display_name,avatar_url,home_city,home_state)')
    .eq('host_profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((row: any) => {
    const follower = row.profiles;
    if (!follower) return [];
    return [{ profileId: follower.id, displayName: follower.display_name || 'Member', avatarUrl: follower.avatar_url, homeCity: follower.home_city, homeState: follower.home_state, followedAt: row.created_at }];
  });
}

export async function updateMyHostProfile(input: {
  publicTitle?: string;
  bio?: string;
  businessName?: string;
  websiteUrl?: string;
  coverImageUrl?: string;
  isPublic?: boolean;
}) {
  const profileId = await currentProfileId();
  const { data, error } = await supabase.from('host_profiles').upsert({
    profile_id: profileId,
    public_title: input.publicTitle?.trim() || null,
    bio: input.bio?.trim() || null,
    business_name: input.businessName?.trim() || null,
    website_url: input.websiteUrl?.trim() || null,
    cover_image_url: input.coverImageUrl?.trim() || null,
    is_public: input.isPublic ?? true,
  }, { onConflict: 'profile_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function listMyHostOrganizations(): Promise<HostOrganization[]> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('host_organization_members')
    .select('host_organizations(id,name,slug,description,city,state,logo_url,cover_image_url,website_url,is_public)')
    .eq('profile_id', profileId);
  if (error) throw error;
  return (data ?? []).flatMap((row: any) => row.host_organizations ? [row.host_organizations as HostOrganization] : []);
}

export async function createHostOrganization(input: { name: string; description?: string; city?: string; state?: string }) {
  const profileId = await currentProfileId();
  const name = input.name.trim();
  if (!name) throw new Error('Add an organization or business name.');
  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'organization';
  const { data, error } = await supabase.from('host_organizations').insert({
    name,
    slug: `${slugBase}-${Date.now().toString(36)}`,
    description: input.description?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim().toUpperCase() || null,
    created_by: profileId,
  }).select().single();
  if (error) throw error;
  const memberResult = await supabase.from('host_organization_members').insert({ organization_id: data.id, profile_id: profileId, role: 'owner' });
  if (memberResult.error) throw memberResult.error;
  return data as HostOrganization;
}

export async function listMyHostHistory(): Promise<HostHistoryItem[]> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('adventures')
    .select('id,title,starts_at,ends_at,city,state,status,visibility,organization_id,host_media(id,image_url,caption)')
    .eq('created_by', profileId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as HostHistoryItem[];
  return Promise.all(rows.map(async (row) => ({ ...row, host_media: await Promise.all((row.host_media ?? []).map(hydrateMedia)) })));
}

export async function addHostHistoryPhoto(adventureId: string, imageUrl: string, caption?: string) {
  const profileId = await currentProfileId();
  const url = imageUrl.trim();
  if (!url) throw new Error('Add a photo URL.');
  const { data, error } = await supabase.from('host_media').insert({ owner_profile_id: profileId, adventure_id: adventureId, image_url: url, caption: caption?.trim() || null }).select().single();
  if (error) throw error;
  return data;
}

export async function uploadHostHistoryPhoto(input: { adventureId: string; localUri: string; caption?: string }) {
  const profileId = await currentProfileId();
  const prepared = await prepareLocalImage({ uri: input.localUri });
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${prepared.extension}`;
  const path = `${profileId}/${input.adventureId}/host-${fileName}`;
  const { error: uploadError } = await supabase.storage.from(HOST_MEDIA_BUCKET).upload(path, prepared.bytes, { contentType: prepared.contentType, cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;
  try {
    return await addHostHistoryPhoto(input.adventureId, path, input.caption);
  } catch (error) {
    await supabase.storage.from(HOST_MEDIA_BUCKET).remove([path]);
    throw error;
  }
}

export async function setOutingVisibility(adventureId: string, visibility: EventVisibility, groupIds: string[] = []) {
  const profileId = await currentProfileId();
  const { error } = await supabase.from('adventures').update({ visibility, presented_by_profile_id: profileId }).eq('id', adventureId).eq('created_by', profileId);
  if (error) throw error;
  const deleteResult = await supabase.from('adventure_community_access').delete().eq('adventure_id', adventureId);
  if (deleteResult.error) throw deleteResult.error;
  if (visibility === 'community' && groupIds.length) {
    const insertResult = await supabase.from('adventure_community_access').insert(groupIds.map((groupId) => ({ adventure_id: adventureId, group_id: groupId })));
    if (insertResult.error) throw insertResult.error;
  }
}

export async function grantPrivateEventAccess(adventureId: string, profileId: string) {
  const grantedBy = await currentProfileId();
  const { error } = await supabase.from('adventure_private_access').upsert({ adventure_id: adventureId, profile_id: profileId, granted_by: grantedBy }, { onConflict: 'adventure_id,profile_id' });
  if (error) throw error;
}

export async function setOutingOrganization(adventureId: string, organizationId: string | null) {
  const profileId = await currentProfileId();
  const { error } = await supabase.from('adventures').update({ organization_id: organizationId, presented_by_profile_id: organizationId ? null : profileId }).eq('id', adventureId).eq('created_by', profileId);
  if (error) throw error;
}
