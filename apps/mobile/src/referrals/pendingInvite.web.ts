import { supabase } from '../lib/supabase';

const PENDING_INVITE_KEY = 'pending_member_invite_token';

export function normalizeInviteToken(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function savePendingInviteToken(value: string) {
  const token = normalizeInviteToken(value);
  if (!token || typeof localStorage === 'undefined') return;
  localStorage.setItem(PENDING_INVITE_KEY, token);
}

export function getPendingInviteToken() {
  if (typeof localStorage === 'undefined') return '';
  return normalizeInviteToken(localStorage.getItem(PENDING_INVITE_KEY));
}

export function clearPendingInviteToken() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(PENDING_INVITE_KEY);
}

export async function redeemPendingInvite() {
  const token = getPendingInviteToken();
  if (!token) return { status: 'none' as const };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { status: 'waiting-for-auth' as const };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return { status: 'waiting-for-profile' as const };

  const { data: senderProfileId, error } = await supabase.rpc('redeem_member_invite', { p_token: token });
  if (error) {
    const message = error.message.toLowerCase();
    const terminal =
      message.includes('invalid or no longer available') ||
      message.includes('already been redeemed') ||
      message.includes('newly joined members') ||
      message.includes('cannot redeem your own');
    if (terminal) clearPendingInviteToken();
    throw error;
  }

  clearPendingInviteToken();
  return { status: 'redeemed' as const, senderProfileId: senderProfileId as string };
}
