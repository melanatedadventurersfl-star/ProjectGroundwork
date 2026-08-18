import * as SQLite from 'expo-sqlite';

import { supabase } from '../lib/supabase';

const db = SQLite.openDatabaseSync('ma-local.db');
const PENDING_INVITE_KEY = 'pending_member_invite_token';

function ensureTable() {
  db.execSync('CREATE TABLE IF NOT EXISTS app_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
}

export function normalizeInviteToken(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function savePendingInviteToken(value: string) {
  const token = normalizeInviteToken(value);
  if (!token) return;
  ensureTable();
  db.runSync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', PENDING_INVITE_KEY, token);
}

export function getPendingInviteToken() {
  ensureTable();
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ? LIMIT 1', PENDING_INVITE_KEY);
  return normalizeInviteToken(row?.value);
}

export function clearPendingInviteToken() {
  ensureTable();
  db.runSync('DELETE FROM app_preferences WHERE key = ?', PENDING_INVITE_KEY);
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
