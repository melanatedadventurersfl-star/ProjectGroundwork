import { supabase } from '../lib/supabase';

export type AdventureEventPerson = {
  profile_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_connected: boolean;
};

export async function getAdventureEventPeople(adventureId: string): Promise<AdventureEventPerson[]> {
  const { data, error } = await supabase.rpc('get_adventure_event_people', {
    target_adventure_id: adventureId,
  });
  if (error) throw error;
  return (data ?? []) as AdventureEventPerson[];
}
