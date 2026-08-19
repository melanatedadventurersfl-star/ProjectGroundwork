import { prepareLocalImage } from '../lib/imageUpload';
import { supabase } from '../lib/supabase';

export type CommunityPostType = 'update' | 'photo' | 'ask' | 'meetup' | 'buddy' | 'recommendation';
export type CommunityAudience = 'everyone' | 'connections' | 'circle' | 'group';

export type CommunityPost = {
  id: string;
  group_id: string | null;
  circle_id: string | null;
  audience: CommunityAudience;
  post_type: CommunityPostType;
  metadata: Record<string, unknown>;
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

export type CreateCommunityPostInput = {
  body: string;
  postType?: CommunityPostType;
  audience?: CommunityAudience;
  adventureId?: string | null;
  groupId?: string | null;
  circleId?: string | null;
  imagePath?: string | null;
  metadata?: Record<string, unknown>;
};

async function currentUserId() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in.');
  return userId;
}

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
  const userId = await currentUserId();

  const { data: existing, error: lookupError } = await supabase
    .from('community_group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('profile_id', userId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;

  const { error } = await supabase
    .from('community_group_members')
    .insert({ group_id: groupId, profile_id: userId, role: 'member' });
  if (error) throw error;
}

export async function leaveGroup(groupId: string) {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('community_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('profile_id', userId);
  if (error) throw error;
}

async function signCommunityMedia(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from('community-media').createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function getCommunityFeed(adventureId?: string, groupId?: string) {
  const { data, error } = await supabase.rpc('get_community_feed', {
    target_adventure_id: adventureId ?? null,
    target_group_id: groupId ?? null,
  });
  if (error) throw error;

  const rows = (data ?? []) as CommunityPost[];
  return Promise.all(rows.map(async (post) => ({ ...post, image_url: await signCommunityMedia(post.image_url) })));
}

export async function uploadCommunityPostImage(input: { uri: string; base64?: string | null; mimeType?: string | null }) {
  const userId = await currentUserId();
  const prepared = await prepareLocalImage({ uri: input.uri, base64: input.base64 });
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${prepared.extension}`;
  const { error } = await supabase.storage.from('community-media').upload(path, prepared.bytes, {
    contentType: prepared.contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeCommunityPostImage(path: string) {
  if (!path || /^https?:\/\//i.test(path)) return;
  const { error } = await supabase.storage.from('community-media').remove([path]);
  if (error) throw error;
}

export async function createPost(input: CreateCommunityPostInput): Promise<void>;
export async function createPost(body: string, adventureId?: string, groupId?: string): Promise<void>;
export async function createPost(inputOrBody: CreateCommunityPostInput | string, adventureId?: string, groupId?: string) {
  const userId = await currentUserId();
  const input: CreateCommunityPostInput = typeof inputOrBody === 'string'
    ? {
        body: inputOrBody,
        adventureId: adventureId ?? null,
        groupId: groupId ?? null,
        audience: groupId ? 'group' : 'everyone',
        postType: 'update',
      }
    : inputOrBody;

  const body = input.body.trim() || (input.imagePath ? 'Shared a photo.' : '');
  if (!body) throw new Error('Add something before posting.');

  const audience = input.audience ?? (input.groupId ? 'group' : 'everyone');
  if (audience === 'circle' && !input.circleId) throw new Error('Choose a Circle.');
  if (audience === 'group' && !input.groupId) throw new Error('Choose a Group.');

  const { error } = await supabase.from('community_posts').insert({
    author_id: userId,
    body,
    post_type: input.postType ?? 'update',
    audience,
    adventure_id: input.adventureId ?? null,
    group_id: audience === 'group' ? input.groupId ?? null : null,
    circle_id: audience === 'circle' ? input.circleId ?? null : null,
    image_url: input.imagePath ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export async function updatePost(postId: string, body: string) {
  const userId = await currentUserId();
  const nextBody = body.trim();
  if (!nextBody) throw new Error('Post text cannot be empty.');

  const { data, error } = await supabase
    .from('community_posts')
    .update({ body: nextBody })
    .eq('id', postId)
    .eq('author_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('You can only edit posts you created.');
}

export async function setReaction(postId: string, reaction: 'like' | 'love' | 'celebrate' | 'support' | null) {
  const userId = await currentUserId();
  if (!reaction) {
    const { error } = await supabase.from('community_reactions').delete().eq('post_id', postId).eq('profile_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('community_reactions').upsert({ post_id: postId, profile_id: userId, reaction });
  if (error) throw error;
}

export async function reportPost(postId: string, reason: string, details?: string) {
  const userId = await currentUserId();
  const { error } = await supabase.from('community_reports').insert({ reporter_id: userId, post_id: postId, reason, details: details ?? null });
  if (error) throw error;
}
