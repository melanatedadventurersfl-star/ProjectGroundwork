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

export type MemoryPhoto = {
  id: string;
  profile_id: string;
  adventure_id: string;
  image_url: string;
  caption: string | null;
  visibility: 'private' | 'group';
  moderation_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

const PHOTO_BUCKET = 'adventure-photos';
const memoryPhotoSelect = 'id, profile_id, adventure_id, image_url, caption, visibility, moderation_status, created_at';

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function withSignedPhotoUrls(rows: MemoryPhoto[]): Promise<MemoryPhoto[]> {
  return Promise.all(rows.map(async (photo) => {
    if (!photo.image_url || isRemoteUrl(photo.image_url)) return photo;

    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(photo.image_url, 60 * 60);

    if (error || !data?.signedUrl) return photo;
    return { ...photo, image_url: data.signedUrl };
  }));
}

function extensionFor(mimeType?: string | null, uri?: string) {
  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  const mimeExtension = mimeType ? byMime[mimeType] : undefined;
  if (mimeExtension) return mimeExtension;
  const cleanUri = uri?.split('?').at(0) ?? '';
  const guessed = cleanUri.split('.').pop()?.toLowerCase();
  return guessed && /^[a-z0-9]{2,5}$/.test(guessed) ? guessed : 'jpg';
}

export async function getJourney(): Promise<JourneyItem[]> {
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
    .eq('moderation_status', 'approved')
    .eq('visibility', 'group')
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

export async function getAllMemoryPhotos(): Promise<MemoryPhoto[]> {
  const { data, error } = await supabase
    .from('adventure_memory_photos')
    .select(memoryPhotoSelect)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return withSignedPhotoUrls((data ?? []) as MemoryPhoto[]);
}

export async function getMemoryPhotos(adventureId: string): Promise<MemoryPhoto[]> {
  const { data, error } = await supabase
    .from('adventure_memory_photos')
    .select(memoryPhotoSelect)
    .eq('adventure_id', adventureId)
    .eq('moderation_status', 'approved')
    .eq('visibility', 'group')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return withSignedPhotoUrls((data ?? []) as MemoryPhoto[]);
}

export async function addMemoryPhoto(input: {
  adventureId: string;
  imageUrl: string;
  caption?: string;
  visibility: 'private' | 'group';
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');

  const { data, error } = await supabase.from('adventure_memory_photos').insert({
    profile_id: userData.user.id,
    adventure_id: input.adventureId,
    image_url: input.imageUrl.trim(),
    caption: input.caption?.trim() || null,
    visibility: input.visibility,
    moderation_status: 'pending',
  }).select('id').single();
  if (error) throw error;

  const { error: moderationError } = await supabase.functions.invoke('moderate-adventure-photo', {
    body: { photoId: data.id },
  });

  if (moderationError) {
    console.warn('Photo uploaded but automated moderation could not run.', moderationError);
  }

  return data;
}

export async function uploadMemoryPhoto(input: {
  adventureId: string;
  localUri: string;
  mimeType?: string | null;
  caption?: string;
  visibility: 'private' | 'group';
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');

  const response = await fetch(input.localUri);
  if (!response.ok) throw new Error('Unable to read the selected photo.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Photos must be 10 MB or smaller.');

  const extension = extensionFor(input.mimeType, input.localUri);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const path = `${userData.user.id}/${input.adventureId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, {
      contentType: input.mimeType || 'image/jpeg',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  try {
    return await addMemoryPhoto({
      adventureId: input.adventureId,
      imageUrl: path,
      caption: input.caption,
      visibility: input.visibility,
    });
  } catch (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw error;
  }
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
