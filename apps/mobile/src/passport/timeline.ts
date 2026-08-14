import { supabase } from '../lib/supabase';

export type PassportTimelineItemType = 'join' | 'stamp' | 'badge';

export type PassportTimelineItem = {
  profile_id: string;
  item_type: PassportTimelineItemType;
  item_id: string;
  title: string;
  occurred_at: string;
  adventure_id: string | null;
  code: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Sign in required.');
  return data.user.id;
}

export async function getPassportTimeline(): Promise<PassportTimelineItem[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('member_passport_timeline')
    .select('profile_id,item_type,item_id,title,occurred_at,adventure_id,code,category,city,state')
    .eq('profile_id', userId)
    .order('occurred_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PassportTimelineItem[];
}
