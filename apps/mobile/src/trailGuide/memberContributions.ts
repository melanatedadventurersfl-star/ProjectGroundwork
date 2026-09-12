import { supabase } from '../lib/supabase';

const PHOTO_BUCKET = 'trail-guide-photos';

export type EditableTrailGuideReview = {
  id: string;
  placeId: string;
  rating: number;
  reviewText: string;
  campingType: 'tent' | 'rv' | 'cabin' | 'day_visit' | 'other';
  campsiteLabel: string;
  visitDate: string | null;
  categoryRatings: Record<string, number>;
};

export type MyTrailGuidePhoto = {
  id: string;
  signedUrl: string;
  category: string;
  campsiteLabel: string | null;
  caption: string | null;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationReason: string | null;
  createdAt: string;
};

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function loadMyTrailGuideReview(placeId: string): Promise<EditableTrailGuideReview | null> {
  const profileId = await currentUserId();
  if (!profileId) return null;
  const { data, error } = await supabase
    .from('trail_guide_reviews')
    .select('id,place_id,rating,review_text,camping_type,campsite_label,visit_date,category_ratings')
    .eq('place_id', placeId)
    .eq('profile_id', profileId)
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    placeId: String(data.place_id),
    rating: Number(data.rating) || 1,
    reviewText: String(data.review_text ?? ''),
    campingType: (data.camping_type ?? 'tent') as EditableTrailGuideReview['campingType'],
    campsiteLabel: String(data.campsite_label ?? ''),
    visitDate: data.visit_date ? String(data.visit_date) : null,
    categoryRatings: (data.category_ratings ?? {}) as Record<string, number>,
  };
}

export async function loadTrailGuideReviewForEdit(reviewId: string): Promise<EditableTrailGuideReview | null> {
  const profileId = await currentUserId();
  if (!profileId) throw new Error('Sign in to edit your Trail Guide review.');
  const { data, error } = await supabase
    .from('trail_guide_reviews')
    .select('id,place_id,rating,review_text,camping_type,campsite_label,visit_date,category_ratings')
    .eq('id', reviewId)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Unable to load your review.');
  if (!data) return null;
  return {
    id: String(data.id),
    placeId: String(data.place_id),
    rating: Number(data.rating) || 1,
    reviewText: String(data.review_text ?? ''),
    campingType: (data.camping_type ?? 'tent') as EditableTrailGuideReview['campingType'],
    campsiteLabel: String(data.campsite_label ?? ''),
    visitDate: data.visit_date ? String(data.visit_date) : null,
    categoryRatings: (data.category_ratings ?? {}) as Record<string, number>,
  };
}

export async function updateTrailGuideReview(input: {
  reviewId: string;
  rating: number;
  reviewText?: string;
  campingType?: EditableTrailGuideReview['campingType'];
  campsiteLabel?: string;
  visitDate?: string | null;
  categoryRatings?: Record<string, number>;
}) {
  const profileId = await currentUserId();
  if (!profileId) throw new Error('Sign in to edit your Trail Guide review.');
  const { data, error } = await supabase
    .from('trail_guide_reviews')
    .update({
      rating: Math.max(1, Math.min(5, Math.round(input.rating))),
      review_text: input.reviewText?.trim() || null,
      camping_type: input.campingType ?? null,
      campsite_label: input.campsiteLabel?.trim() || null,
      visit_date: input.visitDate || null,
      category_ratings: input.categoryRatings ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.reviewId)
    .eq('profile_id', profileId)
    .select('id')
    .single();
  if (error) throw new Error(error.message || 'Unable to update review.');
  return String(data.id);
}

export async function loadMyTrailGuidePhotos(placeId: string): Promise<MyTrailGuidePhoto[]> {
  const profileId = await currentUserId();
  if (!profileId) return [];
  const { data, error } = await supabase
    .from('trail_guide_photos')
    .select('id,storage_path,category,campsite_label,caption,moderation_status,moderation_reason,created_at')
    .eq('place_id', placeId)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return [];

  const photos: MyTrailGuidePhoto[] = [];
  for (const row of data ?? []) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(String(row.storage_path), 60 * 60);
    if (!signed?.signedUrl) continue;
    photos.push({
      id: String(row.id),
      signedUrl: signed.signedUrl,
      category: String(row.category ?? 'other'),
      campsiteLabel: row.campsite_label ? String(row.campsite_label) : null,
      caption: row.caption ? String(row.caption) : null,
      moderationStatus: row.moderation_status as MyTrailGuidePhoto['moderationStatus'],
      moderationReason: row.moderation_reason ? String(row.moderation_reason) : null,
      createdAt: String(row.created_at),
    });
  }
  return photos;
}
