import { supabase } from '../lib/supabase';

export type CommunityPost = {
  id: string;
  group_id: string | null;
  adventure_id: string | null;
  author_id: string;
  author_name: string;
  avatar_url: string | null;
  body: string;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  reaction_count: number;
  comment_count: number;
};

export type CommunityGroup = {
  id: string;
  name: string;
  description: string | null;
  kind: 'adventure' | 'interest' | 'local';
  adventure_id: string | null;
  city: string | null;
  state: string | null;
  image_url: string | null;
  visibility: 'public' | 'members';
  is_member: boolean;
  member_count: number;
};

export async function getGroups(): Promise<CommunityGroup[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;

  const { data: groups, error } = await supabase
    .from('community_groups')
    .select('id, name, description, kind, adventure_id, city, state, image_url, visibility')
    .order('kind', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!groups?.length) return [];

  const groupIds = groups.map((group) => group.id as string);
  const [{ data: memberships, error: membershipError }, { data: allMembers, error: membersError }] = await Promise.all([
    userId
      ? supabase.from('community_group_members').select('group_id').eq('profile_id', userId).in('group_id', groupIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('community_group_members').select('group_id').in('group_id', groupIds),
  ]);
  if (membershipError) throw membershipError;
  if (membersError) throw membersError;

  const myGroups = new Set((memberships ?? []).map((row: any) => row.group_id as string));
  const counts = new Map<string, number>();
  for (const row of allMembers ?? []) {
    const id = (row as any).group_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return groups.map((group: any) => ({
    ...group,
    is_member: myGroups.has(group.id),
    member_count: counts.get(group.id) ?? 0,
  })) as CommunityGroup[];
}

export async function getGroup(groupId: string): Promise<CommunityGroup> {
  const groups = await getGroups();
  const group = groups.find((item) => item.id === groupId);
  if (!group) throw new Error('Group not found.');
  return group;
}

export async function joinGroup(groupId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to join a group.');
  const { error } = await supabase
    .from('community_group_members')
    .upsert({ group_id: groupId, profile_id: userId, role: 'member' }, { onConflict: 'group_id,profile_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function leaveGroup(groupId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to leave a group.');
  const { error } = await supabase
    .from('community_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('profile_id', userId);
  if (error) throw error;
}

export async function getCommunityFeed(adventureId?: string, groupId?: string) {
  let query = supabase
    .from('community_feed')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (adventureId) query = query.eq('adventure_id', adventureId);
  if (groupId) query = query.eq('group_id', groupId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

export async function createPost(body: string, adventureId?: string, groupId?: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to post.');
  const { error } = await supabase.from('community_posts').insert({
    author_id: userId,
    body: body.trim(),
    adventure_id: adventureId ?? null,
    group_id: groupId ?? null,
  });
  if (error) throw error;
}

export async function setReaction(postId: string, reaction: 'like' | 'love' | 'celebrate' | 'support' | null) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to react.');
  if (!reaction) {
    const { error } = await supabase.from('community_reactions').delete().eq('post_id', postId).eq('profile_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('community_reactions').upsert({ post_id: postId, profile_id: userId, reaction });
  if (error) throw error;
}

export async function reportPost(postId: string, reason: string, details?: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to report content.');
  const { error } = await supabase.from('community_reports').insert({ reporter_id: userId, post_id: postId, reason, details: details ?? null });
  if (error) throw error;
}
