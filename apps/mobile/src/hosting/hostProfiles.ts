import { prepareLocalImage } from '../lib/imageUpload';
import { supabase } from '../lib/supabase';

const HOST_MEDIA_BUCKET = 'adventure-photos';
const HOST_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;

export type EventVisibility = 'public' | 'unlisted' | 'private' | 'community';
export type OrganizationRole = 'owner' | 'admin' | 'host' | 'team';

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

export type HostOrganization = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  public_email: string | null;
  phone: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  specialties: string[];
  faq: Array<{ question: string; answer: string }>;
  policies: Array<{ title: string; body: string }>;
  is_public: boolean;
  created_by?: string;
  follower_count?: number;
  upcoming_count?: number;
  hosted_count?: number;
};

export type OrganizationTeamMember = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  homeCity: string | null;
  homeState: string | null;
  role: OrganizationRole;
  publicLabel: string | null;
};

export type HostFollower = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  homeCity: string | null;
  homeState: string | null;
};

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
  hero_image_url?: string | null;
  host_media: Array<{ id: string; image_url: string; caption: string | null }>;
};

const ORG_COLUMNS = 'id,name,slug,tagline,description,city,state,logo_url,cover_image_url,website_url,public_email,phone,instagram_url,facebook_url,specialties,faq,policies,is_public,created_by';

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('You must be signed in.');
  return id;
}

function normalizeOrganization(row: any): HostOrganization {
  return {
    ...row,
    specialties: Array.isArray(row.specialties) ? row.specialties : [],
    faq: Array.isArray(row.faq) ? row.faq : [],
    policies: Array.isArray(row.policies) ? row.policies : [],
  } as HostOrganization;
}

export async function ensureMyHostProfile() {
  const profileId = await currentProfileId();
  const columns = 'profile_id,public_title,bio,business_name,website_url,cover_image_url,is_public';
  const existing = await supabase.from('host_profiles').select(columns).eq('profile_id', profileId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const { data, error } = await supabase.from('host_profiles').insert({ profile_id: profileId }).select(columns).single();
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
  return { profileId, displayName: profileResult.data.display_name || 'Host', avatarUrl: profileResult.data.avatar_url, homeCity: profileResult.data.home_city, homeState: profileResult.data.home_state, publicTitle: hostResult.data.public_title, bio: hostResult.data.bio, businessName: hostResult.data.business_name, websiteUrl: hostResult.data.website_url, coverImageUrl: hostResult.data.cover_image_url, isPublic: hostResult.data.is_public, followerCount: followerResult.count ?? 0 };
}

export async function updateMyHostProfile(input: { publicTitle?: string; bio?: string; businessName?: string; websiteUrl?: string; coverImageUrl?: string; isPublic?: boolean }) {
  const profileId = await currentProfileId();
  const { data, error } = await supabase.from('host_profiles').upsert({ profile_id: profileId, public_title: input.publicTitle?.trim() || null, bio: input.bio?.trim() || null, business_name: input.businessName?.trim() || null, website_url: input.websiteUrl?.trim() || null, cover_image_url: input.coverImageUrl?.trim() || null, is_public: input.isPublic ?? true }, { onConflict: 'profile_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function listMyHostFollowers(): Promise<HostFollower[]> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase.from('host_follows').select('follower_profile_id,profiles!host_follows_follower_profile_id_fkey(display_name,avatar_url,home_city,home_state)').eq('host_profile_id', profileId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ profileId: row.follower_profile_id, displayName: row.profiles?.display_name || 'Member', avatarUrl: row.profiles?.avatar_url ?? null, homeCity: row.profiles?.home_city ?? null, homeState: row.profiles?.home_state ?? null }));
}

export async function listMyHostOrganizations(): Promise<HostOrganization[]> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase.from('host_organization_members').select(`role,host_organizations(${ORG_COLUMNS})`).eq('profile_id', profileId);
  if (error) throw error;
  const organizations = (data ?? []).flatMap((row: any) => row.host_organizations ? [normalizeOrganization(row.host_organizations)] : []);
  return Promise.all(organizations.map(async (org) => {
    const [followers, upcoming, hosted] = await Promise.all([
      supabase.from('host_follows').select('follower_profile_id', { count: 'exact', head: true }).eq('organization_id', org.id),
      supabase.from('adventures').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).gte('ends_at', new Date().toISOString()),
      supabase.from('adventures').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).lt('ends_at', new Date().toISOString()),
    ]);
    return { ...org, follower_count: followers.count ?? 0, upcoming_count: upcoming.count ?? 0, hosted_count: hosted.count ?? 0 };
  }));
}

export async function createHostOrganization(input: { name: string; description?: string; city?: string; state?: string }) {
  const profileId = await currentProfileId();
  const name = input.name.trim();
  if (!name) throw new Error('Add a host profile name.');
  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'host';
  const { data, error } = await supabase.from('host_organizations').insert({ name, slug: `${slugBase}-${Date.now().toString(36)}`, description: input.description?.trim() || null, city: input.city?.trim() || null, state: input.state?.trim().toUpperCase() || null, created_by: profileId }).select(ORG_COLUMNS).single();
  if (error) throw error;
  const memberResult = await supabase.from('host_organization_members').insert({ organization_id: data.id, profile_id: profileId, role: 'owner' });
  if (memberResult.error) throw memberResult.error;
  return normalizeOrganization(data);
}

export async function getHostOrganization(idOrSlug: string): Promise<HostOrganization> {
  const byId = await supabase.from('host_organizations').select(ORG_COLUMNS).eq('id', idOrSlug).maybeSingle();
  if (byId.error && byId.error.code !== '22P02') throw byId.error;
  if (byId.data) return normalizeOrganization(byId.data);
  const bySlug = await supabase.from('host_organizations').select(ORG_COLUMNS).eq('slug', idOrSlug).single();
  if (bySlug.error) throw bySlug.error;
  return normalizeOrganization(bySlug.data);
}

export async function updateHostOrganization(id: string, input: Partial<Pick<HostOrganization, 'name' | 'tagline' | 'description' | 'city' | 'state' | 'website_url' | 'public_email' | 'phone' | 'instagram_url' | 'facebook_url' | 'specialties' | 'faq' | 'policies' | 'is_public'>>) {
  const payload: Record<string, unknown> = { ...input };
  for (const key of ['name','tagline','description','city','state','website_url','public_email','phone','instagram_url','facebook_url']) {
    if (key in payload && typeof payload[key] === 'string') payload[key] = String(payload[key]).trim() || null;
  }
  if (typeof payload.state === 'string') payload.state = payload.state.toUpperCase();
  const { data, error } = await supabase.from('host_organizations').update(payload).eq('id', id).select(ORG_COLUMNS).single();
  if (error) throw error;
  return normalizeOrganization(data);
}

export async function listOrganizationTeam(organizationId: string): Promise<OrganizationTeamMember[]> {
  const { data, error } = await supabase.rpc('get_host_organization_team', { p_organization_id: organizationId });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ profileId: row.profile_id, displayName: row.display_name || 'Member', avatarUrl: row.avatar_url ?? null, homeCity: row.home_city ?? null, homeState: row.home_state ?? null, role: row.role as OrganizationRole, publicLabel: row.public_label ?? null }));
}

export async function listOrganizationFollowers(organizationId: string): Promise<HostFollower[]> {
  const { data, error } = await supabase.rpc('get_host_organization_followers', { p_organization_id: organizationId });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ profileId: row.profile_id, displayName: row.display_name || 'Member', avatarUrl: row.avatar_url ?? null, homeCity: row.home_city ?? null, homeState: row.home_state ?? null }));
}

export async function addOrganizationTeamMember(organizationId: string, username: string, role: Exclude<OrganizationRole, 'owner'>) {
  const clean = username.trim().replace(/^@/, '');
  if (!clean) throw new Error('Enter a member username.');
  const { data, error } = await supabase.rpc('add_host_organization_member', { p_organization_id: organizationId, p_username: clean, p_role: role });
  if (error) throw error;
  return data as string;
}

export async function removeOrganizationTeamMember(organizationId: string, profileId: string) {
  const { error } = await supabase.rpc('remove_host_organization_member', { p_organization_id: organizationId, p_profile_id: profileId });
  if (error) throw error;
}

async function signHostMediaPath(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from(HOST_MEDIA_BUCKET).createSignedUrl(path, HOST_MEDIA_SIGNED_URL_TTL_SECONDS);
  return error ? path : data.signedUrl;
}

export async function listMyHostHistory(): Promise<HostHistoryItem[]> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase.from('adventures').select('id,title,starts_at,ends_at,city,state,status,visibility,organization_id,hero_image_url,host_media(id,image_url,caption)').eq('created_by', profileId).order('starts_at', { ascending: false });
  if (error) throw error;
  return Promise.all(((data ?? []) as HostHistoryItem[]).map(async (item) => ({ ...item, host_media: await Promise.all((item.host_media ?? []).map(async (photo) => ({ ...photo, image_url: await signHostMediaPath(photo.image_url) }))) })));
}

export async function listOrganizationHistory(organizationId: string): Promise<HostHistoryItem[]> {
  const { data, error } = await supabase.from('adventures').select('id,title,starts_at,ends_at,city,state,status,visibility,organization_id,hero_image_url,host_media(id,image_url,caption)').eq('organization_id', organizationId).order('starts_at', { ascending: false });
  if (error) throw error;
  return Promise.all(((data ?? []) as HostHistoryItem[]).map(async (item) => ({ ...item, host_media: await Promise.all((item.host_media ?? []).map(async (photo) => ({ ...photo, image_url: await signHostMediaPath(photo.image_url) }))) })));
}

async function uploadMediaFile(input: { organizationId: string; localUri: string; kind: 'logo' | 'cover' }) {
  const profileId = await currentProfileId();
  const prepared = await prepareLocalImage({ uri: input.localUri });
  const fileName = `${input.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${prepared.extension}`;
  const path = `${profileId}/organizations/${input.organizationId}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from(HOST_MEDIA_BUCKET).upload(path, prepared.bytes, { contentType: prepared.contentType, cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;
  const { data: signed, error: signedError } = await supabase.storage.from(HOST_MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signedError) throw signedError;
  const column = input.kind === 'logo' ? 'logo_url' : 'cover_image_url';
  const { error } = await supabase.from('host_organizations').update({ [column]: signed.signedUrl }).eq('id', input.organizationId);
  if (error) throw error;
  return signed.signedUrl;
}

export function uploadOrganizationLogo(organizationId: string, localUri: string) {
  return uploadMediaFile({ organizationId, localUri, kind: 'logo' });
}

export function uploadOrganizationCover(organizationId: string, localUri: string) {
  return uploadMediaFile({ organizationId, localUri, kind: 'cover' });
}

export async function uploadHostHistoryPhoto(input: { adventureId: string; localUri: string; caption?: string; organizationId?: string }) {
  const profileId = await currentProfileId();
  const prepared = await prepareLocalImage({ uri: input.localUri });
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${prepared.extension}`;
  const path = `${profileId}/host-history/${input.adventureId}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from(HOST_MEDIA_BUCKET).upload(path, prepared.bytes, { contentType: prepared.contentType, cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.from('host_media').insert({ owner_profile_id: profileId, organization_id: input.organizationId ?? null, adventure_id: input.adventureId, image_url: path, caption: input.caption?.trim() || null }).select().single();
  if (error) {
    await supabase.storage.from(HOST_MEDIA_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function followOrganization(organizationId: string) {
  const profileId = await currentProfileId();
  const { error } = await supabase.from('host_follows').insert({ follower_profile_id: profileId, organization_id: organizationId });
  if (error && error.code !== '23505') throw error;
}

export async function unfollowOrganization(organizationId: string) {
  const profileId = await currentProfileId();
  const { error } = await supabase.from('host_follows').delete().eq('follower_profile_id', profileId).eq('organization_id', organizationId);
  if (error) throw error;
}

export async function isFollowingOrganization(organizationId: string) {
  const profileId = await currentProfileId();
  const { data, error } = await supabase.from('host_follows').select('organization_id').eq('follower_profile_id', profileId).eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function setOutingVisibility(adventureId: string, visibility: EventVisibility, groupIds: string[] = []) {
  const profileId = await currentProfileId();
  if (visibility === 'community' && groupIds.length === 0) throw new Error('Choose at least one community for a community-only event.');
  const { error } = await supabase.from('adventures').update({ visibility, presented_by_profile_id: profileId }).eq('id', adventureId).eq('created_by', profileId);
  if (error) throw error;
  const deleteResult = await supabase.from('adventure_community_access').delete().eq('adventure_id', adventureId);
  if (deleteResult.error) throw deleteResult.error;
  if (visibility === 'community') {
    const insertResult = await supabase.from('adventure_community_access').insert(groupIds.map((groupId) => ({ adventure_id: adventureId, group_id: groupId })));
    if (insertResult.error) throw insertResult.error;
  }
}

export async function setOutingOrganization(adventureId: string, organizationId: string | null) {
  const profileId = await currentProfileId();
  const { error } = await supabase.from('adventures').update({ organization_id: organizationId, presented_by_profile_id: organizationId ? null : profileId }).eq('id', adventureId).eq('created_by', profileId);
  if (error) throw error;
}
