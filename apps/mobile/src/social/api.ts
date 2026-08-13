import { supabase } from '../lib/supabase';

export type CommunityProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
  profile_is_private: boolean;
  platform_role: string;
  event_host_level: string;
  interests: string[] | null;
  pronouns: string | null;
  created_at: string;
};

export type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined' | 'blocked' | 'self';

export async function getCommunityProfile(profileId: string): Promise<CommunityProfile> {
  const { data, error } = await supabase
    .from('community_profile_directory')
    .select('*')
    .eq('id', profileId)
    .single();
  if (error) throw error;
  return data as CommunityProfile;
}

export async function getConnectionStatus(profileId: string): Promise<{ status: ConnectionStatus; connectionId: string | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');
  if (userData.user.id === profileId) return { status: 'self', connectionId: null };

  const { data, error } = await supabase
    .from('member_connections')
    .select('id,requester_id,addressee_id,status')
    .or(`and(requester_id.eq.${userData.user.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${userData.user.id})`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: 'none', connectionId: null };
  if (data.status === 'accepted') return { status: 'accepted', connectionId: data.id };
  if (data.status === 'blocked') return { status: 'blocked', connectionId: data.id };
  if (data.status === 'declined') return { status: 'declined', connectionId: data.id };
  return {
    status: data.requester_id === userData.user.id ? 'pending_sent' : 'pending_received',
    connectionId: data.id,
  };
}

export async function requestConnection(profileId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');
  const { error } = await supabase.from('member_connections').insert({ requester_id: userData.user.id, addressee_id: profileId, status: 'pending' });
  if (error) throw error;
}

export async function respondToConnection(connectionId: string, status: 'accepted' | 'declined') {
  const { error } = await supabase.from('member_connections').update({ status }).eq('id', connectionId);
  if (error) throw error;
}

export async function removeConnection(connectionId: string) {
  const { error } = await supabase.from('member_connections').delete().eq('id', connectionId);
  if (error) throw error;
}
