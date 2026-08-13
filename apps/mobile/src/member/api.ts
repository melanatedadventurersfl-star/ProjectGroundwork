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

async function profileId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Sign in required.');
  return data.user.id;
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
  return { profile: profile.data, settings: settings.data, households: household.data ?? [], tickets: tickets.data ?? [], support: support.data ?? [] };
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
