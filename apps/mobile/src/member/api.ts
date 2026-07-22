import { supabase } from '../lib/supabase';

export async function getMemberBasecamp() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');
  const profileId = userData.user.id;
  const [profile, settings, household, tickets, support] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId).single(),
    supabase.from('member_settings').select('*').eq('profile_id', profileId).maybeSingle(),
    supabase.from('household_members').select('role, can_manage_bookings, can_manage_readiness, households(id,name)').eq('profile_id', profileId),
    supabase.from('member_ticket_wallet').select('*').order('starts_at', { ascending: true }),
    supabase.from('support_requests').select('*').order('created_at', { ascending: false }),
  ]);
  for (const result of [profile, settings, household, tickets, support]) if (result.error) throw result.error;
  return { profile: profile.data, settings: settings.data, households: household.data ?? [], tickets: tickets.data ?? [], support: support.data ?? [] };
}

export async function saveMemberSettings(values: Record<string, boolean | string>) {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw userError ?? new Error('Sign in required.');
  const { error } = await supabase.from('member_settings').upsert({ profile_id: data.user.id, ...values });
  if (error) throw error;
}

export async function createSupportRequest(input: { category: string; subject: string; message: string; adventureId?: string; orderId?: string }) {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw userError ?? new Error('Sign in required.');
  const { error } = await supabase.from('support_requests').insert({
    profile_id: data.user.id,
    category: input.category,
    subject: input.subject.trim(),
    message: input.message.trim(),
    adventure_id: input.adventureId ?? null,
    order_id: input.orderId ?? null,
  });
  if (error) throw error;
}
