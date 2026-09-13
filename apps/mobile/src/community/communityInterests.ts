import { supabase } from '../lib/supabase';

export function interestSlug(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function setCommunityPostInterests(postId: string, labels: string[]) {
  const slugs = Array.from(new Set(labels.map(interestSlug).filter(Boolean)));
  const { error } = await supabase.rpc('set_community_post_interests', {
    p_post_id: postId,
    p_interest_slugs: slugs,
  });
  if (error) throw error;
}
