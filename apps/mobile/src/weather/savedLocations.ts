import { supabase } from '../lib/supabase';

export type SavedWeatherLocation = {
  id: string;
  profile_id: string;
  name: string;
  region: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
};

async function currentProfileId() {
  const { data } = await supabase.auth.getSession();
  const profileId = data.session?.user.id;
  if (!profileId) throw new Error('You must be signed in to manage saved locations.');
  return profileId;
}

export async function listSavedWeatherLocations(): Promise<SavedWeatherLocation[]> {
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('weather_saved_locations')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedWeatherLocation[];
}

export async function saveWeatherLocation(location: {
  name: string;
  region?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
}) {
  const profileId = await currentProfileId();
  const { error } = await supabase.from('weather_saved_locations').upsert(
    {
      profile_id: profileId,
      name: location.name,
      region: location.region ?? null,
      country: location.country ?? null,
      latitude: location.latitude,
      longitude: location.longitude,
    },
    { onConflict: 'profile_id,latitude,longitude' },
  );
  if (error) throw error;
}

export async function deleteSavedWeatherLocation(id: string) {
  const profileId = await currentProfileId();
  const { error } = await supabase
    .from('weather_saved_locations')
    .delete()
    .eq('profile_id', profileId)
    .eq('id', id);
  if (error) throw error;
}
