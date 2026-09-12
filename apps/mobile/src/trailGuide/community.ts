import { prepareLocalImage } from '../lib/imageUpload';
import { supabase } from '../lib/supabase';

const PHOTO_BUCKET = 'trail-guide-photos';

export type TrailGuideReview = {
  id: string;
  placeId: string;
  profileId: string;
  rating: number;
  reviewText: string | null;
  campingType: string | null;
  campsiteLabel: string | null;
  visitDate: string | null;
  categoryRatings: Record<string, number>;
  createdAt: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

export type TrailGuideCamperPhoto = {
  id: string;
  placeId: string;
  profileId: string;
  reviewId: string | null;
  category: string;
  campsiteLabel: string | null;
  caption: string | null;
  visitDate: string | null;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  createdAt: string;
  displayName: string;
  avatarUrl: string | null;
  signedUrl: string;
};

export type TrailGuideCommunityData = {
  reviews: TrailGuideReview[];
  photos: TrailGuideCamperPhoto[];
  averageRating: number | null;
  reviewCount: number;
  categoryAverages: Record<string, number>;
};

type ReviewRow = {
  id: string;
  place_id: string;
  profile_id: string;
  rating: number;
  review_text: string | null;
  camping_type: string | null;
  campsite_label: string | null;
  visit_date: string | null;
  category_ratings: Record<string, number> | null;
  created_at: string;
};

type PhotoRow = {
  id: string;
  place_id: string;
  profile_id: string;
  review_id: string | null;
  storage_path: string;
  category: string;
  campsite_label: string | null;
  caption: string | null;
  visit_date: string | null;
  moderation_status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function isMissingSchema(error: { code?: string | null } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in to contribute to Trail Guide.');
  return data.user.id;
}

async function profileMap(profileIds: string[]) {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))];
  if (!uniqueIds.length) return new Map<string, ProfileRow>();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,username,avatar_url')
    .in('id', uniqueIds);
  if (error) return new Map<string, ProfileRow>();
  return new Map(((data ?? []) as ProfileRow[]).map((row) => [row.id, row]));
}

function displayName(profile: ProfileRow | undefined) {
  return profile?.display_name?.trim() || profile?.username?.trim() || 'Trail Guide member';
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function loadTrailGuideCommunity(placeId: string): Promise<TrailGuideCommunityData> {
  const [reviewsResult, photosResult] = await Promise.all([
    supabase
      .from('trail_guide_reviews')
      .select('id,place_id,profile_id,rating,review_text,camping_type,campsite_label,visit_date,category_ratings,created_at')
      .eq('place_id', placeId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('trail_guide_photos')
      .select('id,place_id,profile_id,review_id,storage_path,category,campsite_label,caption,visit_date,moderation_status,featured,created_at')
      .eq('place_id', placeId)
      .eq('moderation_status', 'approved')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(24),
  ]);

  if (isMissingSchema(reviewsResult.error) || isMissingSchema(photosResult.error)) {
    return { reviews: [], photos: [], averageRating: null, reviewCount: 0, categoryAverages: {} };
  }
  if (reviewsResult.error) throw reviewsResult.error;
  if (photosResult.error) throw photosResult.error;

  const reviewRows = (reviewsResult.data ?? []) as ReviewRow[];
  const photoRows = (photosResult.data ?? []) as PhotoRow[];
  const profiles = await profileMap([
    ...reviewRows.map((row) => row.profile_id),
    ...photoRows.map((row) => row.profile_id),
  ]);

  const reviews: TrailGuideReview[] = reviewRows.map((row) => {
    const profile = profiles.get(row.profile_id);
    return {
      id: row.id,
      placeId: row.place_id,
      profileId: row.profile_id,
      rating: row.rating,
      reviewText: row.review_text,
      campingType: row.camping_type,
      campsiteLabel: row.campsite_label,
      visitDate: row.visit_date,
      categoryRatings: row.category_ratings ?? {},
      createdAt: row.created_at,
      displayName: displayName(profile),
      username: profile?.username ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });

  const photos: TrailGuideCamperPhoto[] = [];
  for (const row of photoRows) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path, 60 * 60);
    if (!signed?.signedUrl) continue;
    const profile = profiles.get(row.profile_id);
    photos.push({
      id: row.id,
      placeId: row.place_id,
      profileId: row.profile_id,
      reviewId: row.review_id,
      category: row.category,
      campsiteLabel: row.campsite_label,
      caption: row.caption,
      visitDate: row.visit_date,
      moderationStatus: row.moderation_status,
      featured: row.featured,
      createdAt: row.created_at,
      displayName: displayName(profile),
      avatarUrl: profile?.avatar_url ?? null,
      signedUrl: signed.signedUrl,
    });
  }

  const categoryValues = new Map<string, number[]>();
  for (const review of reviews) {
    for (const [key, value] of Object.entries(review.categoryRatings)) {
      if (!Number.isFinite(value) || value < 1 || value > 5) continue;
      const list = categoryValues.get(key) ?? [];
      list.push(value);
      categoryValues.set(key, list);
    }
  }
  const categoryAverages: Record<string, number> = {};
  for (const [key, values] of categoryValues.entries()) {
    const value = average(values);
    if (value != null) categoryAverages[key] = value;
  }

  return {
    reviews,
    photos,
    averageRating: average(reviews.map((review) => review.rating)),
    reviewCount: reviews.length,
    categoryAverages,
  };
}

export async function submitTrailGuideReview(input: {
  placeId: string;
  rating: number;
  reviewText?: string;
  campingType?: 'tent' | 'rv' | 'cabin' | 'day_visit' | 'other';
  campsiteLabel?: string;
  visitDate?: string | null;
  categoryRatings?: Record<string, number>;
}) {
  const profileId = await currentUserId();
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const { data, error } = await supabase.from('trail_guide_reviews').insert({
    place_id: input.placeId,
    profile_id: profileId,
    rating,
    review_text: input.reviewText?.trim() || null,
    camping_type: input.campingType ?? null,
    campsite_label: input.campsiteLabel?.trim() || null,
    visit_date: input.visitDate || null,
    category_ratings: input.categoryRatings ?? {},
    status: 'published',
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function uploadTrailGuidePhoto(input: {
  placeId: string;
  localUri: string;
  category: string;
  campsiteLabel?: string;
  caption?: string;
  visitDate?: string | null;
  reviewId?: string | null;
}) {
  const profileId = await currentUserId();
  const prepared = await prepareLocalImage({ uri: input.localUri, maxBytes: 10 * 1024 * 1024 });
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${prepared.extension}`;
  const storagePath = `${profileId}/${input.placeId}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, prepared.bytes, {
    contentType: prepared.contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  try {
    const { data, error } = await supabase.from('trail_guide_photos').insert({
      place_id: input.placeId,
      profile_id: profileId,
      review_id: input.reviewId ?? null,
      storage_path: storagePath,
      category: input.category,
      campsite_label: input.campsiteLabel?.trim() || null,
      caption: input.caption?.trim() || null,
      visit_date: input.visitDate || null,
      moderation_status: 'pending',
    }).select('id').single();
    if (error) throw error;
    void supabase.functions.invoke('moderate-trail-guide-photo', { body: { photoId: data.id } });
    return data.id as string;
  } catch (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
    throw error;
  }
}
