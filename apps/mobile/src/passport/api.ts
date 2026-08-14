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
  photo_count: number;
};

export type PassportStamp = {
  stamp_id: string;
  code: string | null;
  title: string;
  description: string | null;
  icon_name: string | null;
  earned_at: string;
  adventure_id: string | null;
};

export type MemberBadge = {
  badge_id: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  category: string;
  earned_at: string;
};

export type MemoryVisibility = 'private' | 'group' | 'public';
export type MemorySource = 'personal' | 'event_gallery';

export type MemoryPhoto = {
  id: string;
  adventure_id: string;
  image_url: string;
  caption: string | null;
  reflection: string | null;
  visibility: MemoryVisibility;
  featured: boolean;
  source_kind: MemorySource;
  source_photo_id: string | null;
  media_type: 'photo' | 'video';
  created_at: string;
};

export type MemoryAlbum = JourneyItem & {
  memories: MemoryPhoto[];
  cover_url: string | null;
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Sign in required.');
  return data.user.id;
}

export async function getJourney(): Promise<JourneyItem[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('member_journey')
    .select('*')
    .order('experienced_at', { ascending: false });
  if (error) throw error;

  const journey = (data ?? []) as Omit<JourneyItem, 'photo_count'>[];
  if (!journey.length) return [];

  const { data: photos, error: photoError } = await supabase
    .from('adventure_memory_photos')
    .select('adventure_id')
    .eq('profile_id', userId)
    .in('adventure_id', journey.map((item) => item.adventure_id));
  if (photoError) throw photoError;

  const counts = new Map<string, number>();
  for (const row of photos ?? []) {
    const adventureId = row.adventure_id as string;
    counts.set(adventureId, (counts.get(adventureId) ?? 0) + 1);
  }

  return journey.map((item) => ({ ...item, photo_count: counts.get(item.adventure_id) ?? 0 }));
}

export async function getPassportStamps(): Promise<PassportStamp[]> {
  const { data, error } = await supabase
    .from('member_passport_stamps')
    .select('stamp_id, earned_at, adventure_id, passport_stamps(code, title, description, icon_name)')
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    stamp_id: row.stamp_id,
    earned_at: row.earned_at,
    adventure_id: row.adventure_id,
    code: row.passport_stamps?.code ?? null,
    title: row.passport_stamps?.title ?? 'Adventure stamp',
    description: row.passport_stamps?.description ?? null,
    icon_name: row.passport_stamps?.icon_name ?? null,
  }));
}

export async function getMemberBadges(): Promise<MemberBadge[]> {
  const { data, error } = await supabase
    .from('member_badges')
    .select('badge_id, earned_at, badges(title, description, icon_name, category)')
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    badge_id: row.badge_id,
    earned_at: row.earned_at,
    title: row.badges?.title ?? 'Member badge',
    description: row.badges?.description ?? null,
    icon_name: row.badges?.icon_name ?? null,
    category: row.badges?.category ?? 'milestone',
  }));
}

const memoryFields = 'id, adventure_id, image_url, caption, reflection, visibility, featured, source_kind, source_photo_id, media_type, created_at';

export async function getAllMemoryPhotos(): Promise<MemoryPhoto[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('adventure_memory_photos')
    .select(memoryFields)
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MemoryPhoto[];
}

export async function getMemoryPhotos(adventureId: string): Promise<MemoryPhoto[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('adventure_memory_photos')
    .select(memoryFields)
    .eq('profile_id', userId)
    .eq('adventure_id', adventureId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MemoryPhoto[];
}

export async function getMemoryPhoto(memoryId: string): Promise<MemoryPhoto> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('adventure_memory_photos')
    .select(memoryFields)
    .eq('profile_id', userId)
    .eq('id', memoryId)
    .single();
  if (error) throw error;
  return data as MemoryPhoto;
}

export async function getMemoryAlbums(): Promise<MemoryAlbum[]> {
  const [journey, memories] = await Promise.all([getJourney(), getAllMemoryPhotos()]);
  const byAdventure = new Map<string, MemoryPhoto[]>();
  for (const memory of memories) {
    const current = byAdventure.get(memory.adventure_id) ?? [];
    current.push(memory);
    byAdventure.set(memory.adventure_id, current);
  }
  return journey
    .map((item) => {
      const albumMemories = byAdventure.get(item.adventure_id) ?? [];
      return { ...item, memories: albumMemories, cover_url: albumMemories[0]?.image_url ?? null };
    })
    .filter((album) => album.memories.length > 0);
}

export async function addMemoryPhoto(input: {
  adventureId: string;
  imageUrl: string;
  caption?: string;
  reflection?: string;
  visibility?: MemoryVisibility;
  sourceKind?: MemorySource;
  sourcePhotoId?: string;
  mediaType?: 'photo' | 'video';
}) {
  const userId = await requireUserId();
  const { data, error } = await supabase.from('adventure_memory_photos').insert({
    profile_id: userId,
    adventure_id: input.adventureId,
    image_url: input.imageUrl.trim(),
    caption: input.caption?.trim() || null,
    reflection: input.reflection?.trim() || null,
    visibility: input.visibility ?? 'private',
    source_kind: input.sourceKind ?? 'personal',
    source_photo_id: input.sourcePhotoId?.trim() || null,
    media_type: input.mediaType ?? 'photo',
  }).select(memoryFields).single();
  if (error) throw error;
  return data as MemoryPhoto;
}

export async function saveEventGalleryPhoto(input: {
  adventureId: string;
  imageUrl: string;
  sourcePhotoId?: string;
  caption?: string;
}) {
  return addMemoryPhoto({
    adventureId: input.adventureId,
    imageUrl: input.imageUrl,
    sourcePhotoId: input.sourcePhotoId,
    caption: input.caption,
    sourceKind: 'event_gallery',
    visibility: 'private',
  });
}

export async function updateMemoryPhoto(memoryId: string, input: {
  caption?: string;
  reflection?: string;
  visibility?: MemoryVisibility;
  featured?: boolean;
}) {
  const userId = await requireUserId();
  const patch: Record<string, unknown> = {};
  if (input.caption !== undefined) patch.caption = input.caption.trim() || null;
  if (input.reflection !== undefined) patch.reflection = input.reflection.trim() || null;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.featured !== undefined) patch.featured = input.featured;

  const { data, error } = await supabase
    .from('adventure_memory_photos')
    .update(patch)
    .eq('profile_id', userId)
    .eq('id', memoryId)
    .select(memoryFields)
    .single();
  if (error) throw error;
  return data as MemoryPhoto;
}

export async function removeMemoryPhoto(memoryId: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('adventure_memory_photos')
    .delete()
    .eq('profile_id', userId)
    .eq('id', memoryId);
  if (error) throw error;
}

export async function saveReflection(input: {
  adventureId: string;
  rating: number;
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
