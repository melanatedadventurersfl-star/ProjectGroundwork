import { prepareLocalImage } from '../lib/imageUpload';
import { supabase } from '../lib/supabase';

export type MemberTrip = {
  id: string;
  status: string;
  total_cents: number;
  hold_expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  adventures: { id: string; title: string; starts_at: string; city: string; state: string; hero_image_url: string | null; status: string } | null;
};

type ProfileAvatarListener = (avatarUrl: string | null) => void;
const profileAvatarListeners = new Set<ProfileAvatarListener>();

function emitProfileAvatar(avatarUrl: string | null) {
  for (const listener of profileAvatarListeners) listener(avatarUrl);
}

export function subscribeProfileAvatar(listener: ProfileAvatarListener) {
  profileAvatarListeners.add(listener);
  return () => profileAvatarListeners.delete(listener);
}

async function profileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Sign in required.');
  return data.user.id;
}

export async function getProfileAvatarUrl() {
  const id = await profileId();
  const { data, error } = await supabase.from('profiles').select('avatar_url').eq('id', id).single();
  if (error) throw error;
  return (data?.avatar_url as string | null | undefined) ?? null;
}

function normalizeProfileDisplayName<T extends Record<string, any> | null>(profile: T): T {
  if (!profile) return profile;
  const displayName = String(profile.display_name ?? '').trim();
  const username = String(profile.username ?? '').trim().replace(/^@/, '');
  const email = String(profile.email ?? '').trim();
  const emailLocal = email.split('@')[0] ?? '';
  const looksEmailDerived = Boolean(displayName) && (displayName.toLowerCase() === email.toLowerCase() || displayName.toLowerCase() === emailLocal.toLowerCase());

  if (username && (!displayName || looksEmailDerived)) {
    return { ...profile, display_name: username } as T;
  }
  return profile;
}

function profileMediaPathFromUrl(url?: string | null) {
  if (!url) return null;
  const marker = '/profile-avatars/';
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const path = url.slice(index + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

async function uploadProfileMedia(input: { uri: string; base64?: string | null; mimeType?: string | null; kind: 'avatar' | 'cover' }) {
  const id = await profileId();
  const column = input.kind === 'avatar' ? 'avatar_url' : 'cover_url';
  const { data: current, error: currentError } = await supabase.from('profiles').select(column).eq('id', id).single();
  if (currentError) throw currentError;

  const prepared = await prepareLocalImage({ uri: input.uri, base64: input.base64 });
  const path = `${id}/${input.kind}-${Date.now()}.${prepared.extension}`;

  const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, prepared.bytes, {
    contentType: prepared.contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from('profile-avatars').getPublicUrl(path);
  const publicUrl = `${publicData.publicUrl}?v=${Date.now()}`;
  const { error: profileError } = await supabase.from('profiles').update({ [column]: publicUrl, updated_at: new Date().toISOString() }).eq('id', id);
  if (profileError) {
    await supabase.storage.from('profile-avatars').remove([path]);
    throw profileError;
  }

  const oldUrl = (current as Record<string, string | null> | null)?.[column] ?? null;
  const oldPath = profileMediaPathFromUrl(oldUrl);
  if (oldPath && oldPath !== path) await supabase.storage.from('profile-avatars').remove([oldPath]);
  if (input.kind === 'avatar') emitProfileAvatar(publicUrl);
  return publicUrl;
}

async function removeProfileMedia(kind: 'avatar' | 'cover') {
  const id = await profileId();
  const column = kind === 'avatar' ? 'avatar_url' : 'cover_url';
  const { data: current, error: currentError } = await supabase.from('profiles').select(column).eq('id', id).single();
  if (currentError) throw currentError;
  const { error } = await supabase.from('profiles').update({ [column]: null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  const oldUrl = (current as Record<string, string | null> | null)?.[column] ?? null;
  const oldPath = profileMediaPathFromUrl(oldUrl);
  if (oldPath) await supabase.storage.from('profile-avatars').remove([oldPath]);
  if (kind === 'avatar') emitProfileAvatar(null);
}

export async function getMemberBasecamp() {
  const id = await profileId();
  const [profile, settings, household, tickets, support] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('member_settings').select('*').eq('profile_id', id).maybeSingle(),
    supabase.from('household_members').select('role, trail_family_role, can_manage_bookings, can_manage_readiness, joined_at, households(id,name,invite_code)').eq('profile_id', id),
    supabase.from('member_ticket_wallet').select('*').order('starts_at', { ascending: true }),
    supabase.from('support_requests').select('*').order('created_at', { ascending: false }),
  ]);
  for (const result of [profile, settings, household, tickets, support]) if (result.error) throw result.error;
  return { profile: normalizeProfileDisplayName(profile.data), settings: settings.data, households: household.data ?? [], tickets: tickets.data ?? [], support: support.data ?? [] };
}

export async function getMemberTrips(): Promise<MemberTrip[]> {
  const { data, error } = await supabase.from('orders').select('id,status,total_cents,hold_expires_at,paid_at,created_at,adventures(id,title,starts_at,city,state,hero_image_url,status)').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MemberTrip[];
}

export async function saveProfileDetails(values: { display_name: string; username: string | null; bio: string | null; home_city: string | null; home_state: string | null; interests?: string[]; discovery_radius_miles?: number }) {
  const id = await profileId();
  const { error } = await supabase.from('profiles').update({ ...values, display_name: values.display_name.trim(), username: values.username?.trim().replace(/^@/, '') || null, bio: values.bio?.trim() || null, home_city: values.home_city?.trim() || null, home_state: values.home_state?.trim().toUpperCase() || null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    if (error.code === '23505') throw new Error('That username is already taken.');
    throw error;
  }
}

export function uploadProfilePhoto(input: { uri: string; base64?: string | null; mimeType?: string | null }) {
  return uploadProfileMedia({ ...input, kind: 'avatar' });
}

export function removeProfilePhoto() {
  return removeProfileMedia('avatar');
}

export function uploadProfileCover(input: { uri: string; base64?: string | null; mimeType?: string | null }) {
  return uploadProfileMedia({ ...input, kind: 'cover' });
}

export function removeProfileCover() {
  return removeProfileMedia('cover');
}

export async function saveProfilePrivacy(values: Record<string, boolean>) {
  const id = await profileId();
  const { error } = await supabase.from('profiles').update(values).eq('id', id);
  if (error) throw error;
}

export async function saveMemberSettings(values: Record<string, boolean | string>) {
  const id = await profileId();
  const { error } = await supabase.from('member_settings').upsert({ profile_id: id, ...values });
  if (error) throw error;
}

export async function createSupportRequest(input: { category: string; subject: string; message: string; adventureId?: string; orderId?: string }) {
  const id = await profileId();
  const { error } = await supabase.from('support_requests').insert({ profile_id: id, category: input.category, subject: input.subject.trim(), message: input.message.trim(), adventure_id: input.adventureId ?? null, order_id: input.orderId ?? null });
  if (error) throw error;
}
