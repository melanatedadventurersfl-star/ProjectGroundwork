import { supabase } from '../lib/supabase';

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export type CommunityPerson = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
  connection_id: string | null;
  connection_status: ConnectionStatus | null;
  connection_direction: 'incoming' | 'outgoing' | null;
};

export type Connection = {
  connection_id: string;
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
  status: ConnectionStatus;
  direction: 'incoming' | 'outgoing';
  created_at: string;
};

export type CommunityCircle = {
  id: string;
  name: string;
  member_count: number;
  member_names: string[];
};

export type CircleMember = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
  added_at: string;
};

async function requireUserId() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You must be signed in.');
  return userId;
}

export async function searchCommunityMembers(query: string): Promise<CommunityPerson[]> {
  const { data, error } = await supabase.rpc('search_community_members', { search_text: query.trim() });
  if (error) throw error;
  return (data ?? []) as CommunityPerson[];
}

export async function getConnections(): Promise<Connection[]> {
  const { data, error } = await supabase.rpc('get_my_connections');
  if (error) throw error;
  return (data ?? []) as Connection[];
}

export async function sendConnectionRequest(profileId: string) {
  const userId = await requireUserId();
  const { data: existing, error: lookupError } = await supabase
    .from('member_connections')
    .select('id, status')
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${userId})`)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.status === 'pending' || existing?.status === 'accepted') return;
  if (existing?.id) {
    const { error: deleteError } = await supabase.from('member_connections').delete().eq('id', existing.id);
    if (deleteError) throw deleteError;
  }

  const { error } = await supabase.from('member_connections').insert({ requester_id: userId, addressee_id: profileId });
  if (error) throw error;
}

export async function respondToConnectionRequest(connectionId: string, response: 'accepted' | 'declined') {
  const { error } = await supabase.rpc('respond_to_connection_request', { connection_id: connectionId, response });
  if (error) throw error;
}

export async function removeConnection(connectionId: string) {
  const { error } = await supabase.from('member_connections').delete().eq('id', connectionId);
  if (error) throw error;
}

export async function getCircles(): Promise<CommunityCircle[]> {
  const { data, error } = await supabase.rpc('get_my_circles');
  if (error) throw error;
  return (data ?? []) as CommunityCircle[];
}

export async function createCircle(name: string) {
  const ownerId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give your crew a name.');
  const { data, error } = await supabase
    .from('community_circles')
    .insert({ owner_id: ownerId, name: trimmed })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function renameCircle(circleId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Crew name cannot be empty.');
  const { error } = await supabase.from('community_circles').update({ name: trimmed }).eq('id', circleId);
  if (error) throw error;
}

export async function deleteCircle(circleId: string) {
  const { error } = await supabase.from('community_circles').delete().eq('id', circleId);
  if (error) throw error;
}

export async function getCircleMembers(circleId: string): Promise<CircleMember[]> {
  const { data, error } = await supabase.rpc('get_circle_members', { target_circle_id: circleId });
  if (error) throw error;
  return (data ?? []) as CircleMember[];
}

export async function addCircleMember(circleId: string, profileId: string) {
  const { error } = await supabase.from('community_circle_members').insert({ circle_id: circleId, profile_id: profileId });
  if (error && error.code !== '23505') throw error;
}

export async function removeCircleMember(circleId: string, profileId: string) {
  const { error } = await supabase
    .from('community_circle_members')
    .delete()
    .eq('circle_id', circleId)
    .eq('profile_id', profileId);
  if (error) throw error;
}

export async function getMyCircle() {
  const circles = await getCircles();
  return circles.find((circle) => {
    const name = circle.name.trim().toLowerCase();
    return name === 'my crew' || name === 'my circle';
  }) ?? null;
}

export async function ensureMyCircle() {
  const existing = await getMyCircle();
  if (existing) return existing.id;
  return createCircle('My Crew');
}

export async function getMyCircleMembership(profileId: string) {
  const circle = await getMyCircle();
  if (!circle) return { circleId: null, inCircle: false };
  const members = await getCircleMembers(circle.id);
  return { circleId: circle.id, inCircle: members.some((member) => member.profile_id === profileId) };
}

export async function addTrailmateToMyCircle(profileId: string) {
  const circleId = await ensureMyCircle();
  await addCircleMember(circleId, profileId);
  return circleId;
}

export async function removeTrailmateFromMyCircle(profileId: string) {
  const circle = await getMyCircle();
  if (!circle) return;
  await removeCircleMember(circle.id, profileId);
}
