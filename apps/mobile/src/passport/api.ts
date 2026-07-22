import { supabase } from '../lib/supabase';

export type JourneyItem = {
  adventure_id: string;
  title: string;
  category: string;
  city: string;
  state: string;
  starts_at: string;
  experienced_at: string;
  rating: number | null;
  highlight: string | null;
  reflection: string | null;
  stamp_count: number;
};

export type PassportStamp = {
  stamp_id: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  earned_at: string;
  adventure_id: string | null;
};

export async function getJourney(): Promise<JourneyItem[]> {
  const { data, error } = await supabase
    .from('member_journey')
    .select('*')
    .order('experienced_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JourneyItem[];
}

export async function getPassportStamps(): Promise<PassportStamp[]> {
  const { data, error } = await supabase
    .from('member_passport_stamps')
    .select('stamp_id, earned_at, adventure_id, passport_stamps(title, description, icon_name)')
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    stamp_id: row.stamp_id,
    earned_at: row.earned_at,
    adventure_id: row.adventure_id,
    title: row.passport_stamps?.title ?? 'Adventure stamp',
    description: row.passport_stamps?.description ?? null,
    icon_name: row.passport_stamps?.icon_name ?? null,
  }));
}

export async function saveReflection(input: {
  adventureId: string;
  rating: number;
  highlight: string;
  reflection: string;
  visibility: 'private' | 'community';
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');
  const { error } = await supabase.from('adventure_reflections').upsert({
    profile_id: userData.user.id,
    adventure_id: input.adventureId,
    rating: input.rating,
    highlight: input.highlight.trim() || null,
    reflection: input.reflection.trim() || null,
    visibility: input.visibility,
  }, { onConflict: 'profile_id,adventure_id' });
  if (error) throw error;
}
