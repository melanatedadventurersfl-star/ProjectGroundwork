import { supabase } from '../lib/supabase';

export type CommunityPost = {
  id: string;
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

export async function getCommunityFeed(adventureId?: string) {
  let query = supabase.from('community_feed').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
  if (adventureId) query = query.eq('adventure_id', adventureId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

export async function createPost(body: string, adventureId?: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to post.');
  const { error } = await supabase.from('community_posts').insert({ author_id: userId, body: body.trim(), adventure_id: adventureId ?? null });
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