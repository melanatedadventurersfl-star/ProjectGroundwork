import { supabase } from '../lib/supabase';

export type RelationshipState = 'none' | 'outgoing_pending' | 'incoming_pending' | 'connected';

export type AdventureEventPerson = {
  profile_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_connected: boolean;
  relationship_state: RelationshipState;
};

export type AdventureEventReflection = {
  rating: number | null;
  highlight: string | null;
  reflection: string | null;
  visibility: 'private' | 'community';
};

export type AdventureMemoryTag = {
  profile_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type AdventureMemory = {
  id: string;
  profile_id: string;
  adventure_id: string;
  title: string | null;
  body: string | null;
  rating: number | null;
  visibility: 'private' | 'public';
  created_at: string;
  updated_at: string;
  tags: AdventureMemoryTag[];
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
  return (data ?? []).map((row: any) => ({
    ...row,
    relationship_state: (row.relationship_state ?? (row.is_connected ? 'connected' : 'none')) as RelationshipState,
  })) as AdventureEventPerson[];
}

export async function actOnAdventureConnection(profileId: string): Promise<RelationshipState> {
  const { data, error } = await supabase.rpc('connect_or_accept_member', {
    target_profile_id: profileId,
  });
  if (error) throw error;
  return (data ?? 'none') as RelationshipState;
}

/** @deprecated Use actOnAdventureConnection so incoming requests are accepted correctly. */
export async function requestAdventureConnection(profileId: string) {
  return actOnAdventureConnection(profileId);
}

async function hydrateMemoryTags(memoryIds: string[]): Promise<Map<string, AdventureMemoryTag[]>> {
  const result = new Map<string, AdventureMemoryTag[]>();
  if (!memoryIds.length) return result;

  const { data: tags, error } = await supabase
    .from('adventure_memory_tags')
    .select('memory_id, tagged_profile_id, profile_directory!adventure_memory_tags_tagged_profile_id_fkey(display_name, username, avatar_url)')
    .in('memory_id', memoryIds);

  if (error) {
    // Some Supabase schemas cannot resolve a view through a FK. Fall back to profiles.
    const { data: plainTags, error: plainError } = await supabase
      .from('adventure_memory_tags')
      .select('memory_id, tagged_profile_id')
      .in('memory_id', memoryIds);
    if (plainError) throw plainError;
    const profileIds = Array.from(new Set((plainTags ?? []).map((row: any) => row.tagged_profile_id as string)));
    const { data: profiles, error: profileError } = profileIds.length
      ? await supabase.from('profile_directory').select('id,display_name,username,avatar_url').in('id', profileIds)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
    for (const row of plainTags ?? []) {
      const profile: any = profileMap.get(row.tagged_profile_id);
      const current = result.get(row.memory_id) ?? [];
      current.push({
        profile_id: row.tagged_profile_id,
        display_name: profile?.display_name ?? null,
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
      });
      result.set(row.memory_id, current);
    }
    return result;
  }

  for (const row of tags ?? []) {
    const profile: any = Array.isArray(row.profile_directory) ? row.profile_directory[0] : row.profile_directory;
    const current = result.get(row.memory_id) ?? [];
    current.push({
      profile_id: row.tagged_profile_id,
      display_name: profile?.display_name ?? null,
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
    });
    result.set(row.memory_id, current);
  }
  return result;
}

export async function getAdventureMemories(adventureId: string): Promise<AdventureMemory[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('adventure_memories')
    .select('id,profile_id,adventure_id,title,body,rating,visibility,created_at,updated_at')
    .eq('profile_id', userId)
    .eq('adventure_id', adventureId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const tags = await hydrateMemoryTags(rows.map((row: any) => row.id));
  return rows.map((row: any) => ({ ...row, tags: tags.get(row.id) ?? [] })) as AdventureMemory[];
}

export async function getCommunityAdventureMemories(adventureId: string): Promise<AdventureMemory[]> {
  const { data, error } = await supabase
    .from('adventure_memories')
    .select('id,profile_id,adventure_id,title,body,rating,visibility,created_at,updated_at')
    .eq('adventure_id', adventureId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const tags = await hydrateMemoryTags(rows.map((row: any) => row.id));
  return rows.map((row: any) => ({ ...row, tags: tags.get(row.id) ?? [] })) as AdventureMemory[];
}

export async function createAdventureMemory(input: {
  adventureId: string;
  title?: string;
  body?: string;
  rating?: number | null;
  visibility?: 'private' | 'public';
  taggedProfileIds?: string[];
}) {
  const userId = await requireUserId();
  const title = input.title?.trim() || null;
  const body = input.body?.trim() || null;
  const rating = input.rating ?? null;
  if (!title && !body && rating === null) throw new Error('Add a title, reflection, or rating to save this memory.');

  const { data, error } = await supabase
    .from('adventure_memories')
    .insert({
      profile_id: userId,
      adventure_id: input.adventureId,
      title,
      body,
      rating,
      visibility: input.visibility ?? 'private',
    })
    .select('id,profile_id,adventure_id,title,body,rating,visibility,created_at,updated_at')
    .single();
  if (error) throw error;

  const taggedProfileIds = Array.from(new Set(input.taggedProfileIds ?? [])).filter(Boolean);
  if (taggedProfileIds.length) {
    const { error: tagError } = await supabase.from('adventure_memory_tags').insert(
      taggedProfileIds.map((profileId) => ({ memory_id: data.id, tagged_profile_id: profileId })),
    );
    if (tagError) {
      await supabase.from('adventure_memories').delete().eq('id', data.id).eq('profile_id', userId);
      throw tagError;
    }
  }

  return data as Omit<AdventureMemory, 'tags'>;
}

export async function updateAdventureMemoryVisibility(memoryId: string, visibility: 'private' | 'public') {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('adventure_memories')
    .update({ visibility })
    .eq('id', memoryId)
    .eq('profile_id', userId);
  if (error) throw error;

  // Keep attached media visibility aligned with the memory so changing privacy
  // immediately removes/adds media from any public memory surface.
  const { error: photoError } = await supabase
    .from('adventure_memory_photos')
    .update({ visibility })
    .eq('memory_id', memoryId)
    .eq('profile_id', userId);
  if (photoError) throw photoError;
}

// Legacy reflection access remains for older routes while the stamp screen moves to journals.
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
