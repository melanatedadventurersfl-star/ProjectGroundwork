import { supabase } from '../lib/supabase';

export type AdventureEventPerson = {
  profile_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_connected: boolean;
};

export type AdventureEventReflection = {
  rating: number | null;
  highlight: string | null;
  reflection: string | null;
  visibility: 'private' | 'community';
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Sign in required.');
  return data.user.id;
}

export async function getAdventureEventPeople(adventureId: string): Promise<AdventureEventPerson[]> {
  const { data, error } = await supabase.rpc('get_adventure_event_people', {
    target_adventure_id: adventureId,
  });
  if (error) throw error;
  return (data ?? []) as AdventureEventPerson[];
}

export async function getAdventureEventReflection(adventureId: string): Promise<AdventureEventReflection | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('adventure_reflections')
    .select('rating,highlight,reflection,visibility')
    .eq('profile_id', userId)
    .eq('adventure_id', adventureId)
    .maybeSingle();
  if (error) throw error;
  return data as AdventureEventReflection | null;
}

export async function saveAdventureEventReflection(input: {
  adventureId: string;
  rating: number | null;
  highlight: string;
  reflection: string;
  visibility: 'private' | 'community';
}) {
  const userId = await requireUserId();
  const { error } = await supabase.from('adventure_reflections').upsert({
    profile_id: userId,
    adventure_id: input.adventureId,
    rating: input.rating,
    highlight: input.highlight.trim() || null,
    reflection: input.reflection.trim() || null,
    visibility: input.visibility,
  }, { onConflict: 'profile_id,adventure_id' });
  if (error) throw error;
}

export async function requestAdventureConnection(profileId: string) {
  const userId = await requireUserId();
  if (userId === profileId) return;

  const { data: existing, error: lookupError } = await supabase
    .from('member_connections')
    .select('id,status')
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${userId})`)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.status === 'pending' || existing?.status === 'accepted') return;

  if (existing?.id) {
    const { error: deleteError } = await supabase.from('member_connections').delete().eq('id', existing.id);
    if (deleteError) throw deleteError;
  }

  const { error } = await supabase.from('member_connections').insert({
    requester_id: userId,
    addressee_id: profileId,
    status: 'pending',
  });
  if (error) throw error;
}
