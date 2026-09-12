import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadTrailGuideCommunity, type TrailGuideCommunityData, type TrailGuideReview } from './community';

function reviewMeta(review: TrailGuideReview) {
  const parts: string[] = [];
  if (review.campingType) parts.push(review.campingType.replace('_', ' '));
  if (review.campsiteLabel) parts.push(review.campsiteLabel);
  if (review.visitDate) {
    const parsed = new Date(`${review.visitDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) parts.push(parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }));
  }
  return parts.join(' · ');
}

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.ratingLine}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%` }]} /></View>
      <Text style={styles.ratingValue}>{value.toFixed(1)}</Text>
    </View>
  );
}

export function TrailGuideCommunitySection({ placeId }: { placeId: string }) {
  const [data, setData] = useState<TrailGuideCommunityData | null>(null);

  useEffect(() => {
    let active = true;
    void loadTrailGuideCommunity(placeId)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setData({ reviews: [], photos: [], averageRating: null, reviewCount: 0, categoryAverages: {} }); });
    return () => { active = false; };
  }, [placeId]);

  const topReview = data?.reviews[0] ?? null;
  const ratingRows = useMemo(() => {
    if (!data) return [];
    const labels: Record<string, string> = {
      cleanliness: 'Cleanliness',
      campsites: 'Campsites',
      bathrooms: 'Bathrooms',
      location: 'Location',
      family_friendly: 'Family friendly',
    };
    return Object.entries(data.categoryAverages)
      .filter(([key]) => labels[key])
      .map(([key, value]) => ({ key, label: labels[key], value }))
      .slice(0, 5);
  }, [data]);

  const openReview = () => router.push({ pathname: '/trail-guide/contribute', params: { placeId, mode: 'review' } });
  const openPhotos = () => router.push({ pathname: '/trail-guide/contribute', params: { placeId, mode: 'photos' } });

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Camper reviews</Text>
            <Text style={styles.hint}>What Go Melanated members experienced here</Text>
          </View>
          <Pressable onPress={openReview} hitSlop={8}><Text style={styles.link}>Write one</Text></Pressable>
        </View>

        {data?.reviewCount ? (
          <>
            <View style={styles.ratingSummary}>
              <View style={styles.bigRatingWrap}>
                <Text style={styles.star}>★</Text>
                <Text style={styles.bigRating}>{data.averageRating?.toFixed(1)}</Text>
                <Text style={styles.count}>{data.reviewCount} {data.reviewCount === 1 ? 'review' : 'reviews'}</Text>
              </View>
              {ratingRows.length ? <View style={styles.ratingBars}>{ratingRows.map((row) => <RatingBar key={row.key} label={row.label} value={row.value} />)}</View> : null}
            </View>

            {topReview ? (
              <View style={styles.reviewCard}>
                <View style={styles.reviewerRow}>
                  {topReview.avatarUrl ? <Image source={{ uri: topReview.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{topReview.displayName.slice(0, 1).toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewerName}>{topReview.displayName}</Text>
                    <Text style={styles.reviewMeta}>{reviewMeta(topReview)}</Text>
                  </View>
                  <Text style={styles.reviewStars}>{'★'.repeat(topReview.rating)}</Text>
                </View>
                {topReview.reviewText ? <Text numberOfLines={4} style={styles.reviewText}>{topReview.reviewText}</Text> : null}
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>Be the first to review this place.</Text>
            <Text style={styles.emptyBody}>A short note about the site, bathrooms, shade, noise, or setup can save the next camper a surprise.</Text>
            <Pressable onPress={openReview} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Write a review</Text></Pressable>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Camper photos</Text>
            <Text style={styles.hint}>Real campsites, facilities, trails, and conditions</Text>
          </View>
          <Pressable onPress={openPhotos} hitSlop={8}><Text style={styles.link}>Add photos</Text></Pressable>
        </View>

        {data?.photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {data.photos.slice(0, 10).map((photo) => (
              <View key={photo.id} style={styles.photoCard}>
                <Image source={{ uri: photo.signedUrl }} style={styles.photo} />
                <View style={styles.photoShade} />
                <View style={styles.photoMetaWrap}>
                  <Text numberOfLines={1} style={styles.photoMeta}>{photo.campsiteLabel || photo.category.replace('_', ' ')}</Text>
                </View>
              </View>
            ))}
            <Pressable onPress={openPhotos} style={styles.addPhotoCard}><Text style={styles.plus}>＋</Text><Text style={styles.addPhotoText}>Add photos</Text></Pressable>
          </ScrollView>
        ) : (
          <Pressable onPress={openPhotos} style={styles.photoEmpty}>
            <View style={styles.cameraCircle}><Text style={styles.camera}>＋</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>No camper photos yet</Text>
              <Text style={styles.emptyBody}>Show what the place looks like beyond the official gallery.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 14 },
  card: { backgroundColor: '#101914', borderWidth: 1, borderColor: '#243128', borderRadius: 17, padding: 13 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  hint: { color: '#748178', fontSize: 10, marginTop: 3, lineHeight: 14, maxWidth: 235 },
  link: { color: '#D7B45A', fontSize: 11, fontWeight: '900', paddingTop: 2 },
  ratingSummary: { flexDirection: 'row', gap: 14, marginTop: 13, alignItems: 'center' },
  bigRatingWrap: { width: 84, alignItems: 'center' },
  star: { color: '#E1B94F', fontSize: 26, lineHeight: 28 },
  bigRating: { color: '#FFF8E8', fontSize: 30, lineHeight: 34, fontWeight: '900' },
  count: { color: '#7D8981', fontSize: 9, marginTop: 1 },
  ratingBars: { flex: 1, gap: 5 },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ratingLabel: { width: 70, color: '#AAB4AE', fontSize: 8.5 },
  barTrack: { flex: 1, height: 5, backgroundColor: '#243129', borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#D7B45A', borderRadius: 99 },
  ratingValue: { width: 22, color: '#D7DFDA', fontSize: 9, fontWeight: '800', textAlign: 'right' },
  reviewCard: { marginTop: 13, borderTopWidth: 1, borderTopColor: '#223028', paddingTop: 12 },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1E2922' },
  avatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#26342B', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#E7C766', fontWeight: '900' },
  reviewerName: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },
  reviewMeta: { color: '#7B8880', fontSize: 9, textTransform: 'capitalize', marginTop: 2 },
  reviewStars: { color: '#E1B94F', fontSize: 11, letterSpacing: 1 },
  reviewText: { color: '#C0C8C3', fontSize: 11, lineHeight: 17, marginTop: 9 },
  emptyBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#223028' },
  emptyTitle: { color: '#E8EEE9', fontSize: 12, fontWeight: '900' },
  emptyBody: { color: '#829087', fontSize: 10, lineHeight: 15, marginTop: 4 },
  secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6C5C2D', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  secondaryButtonText: { color: '#E4C665', fontSize: 10, fontWeight: '900' },
  photoRow: { gap: 8, paddingTop: 12, paddingRight: 4 },
  photoCard: { width: 112, height: 98, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A241E' },
  photo: { ...StyleSheet.absoluteFillObject },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,10,7,0.12)' },
  photoMetaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,7,0.68)', paddingHorizontal: 8, paddingVertical: 5 },
  photoMeta: { color: '#F5F2E8', fontSize: 8.5, fontWeight: '800', textTransform: 'capitalize' },
  addPhotoCard: { width: 86, height: 98, borderRadius: 12, borderWidth: 1, borderColor: '#39493F', backgroundColor: '#151E18', alignItems: 'center', justifyContent: 'center' },
  plus: { color: '#D7B45A', fontSize: 28, lineHeight: 30 },
  addPhotoText: { color: '#D0D8D3', fontSize: 9, fontWeight: '800', marginTop: 3 },
  photoEmpty: { marginTop: 12, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#223028', paddingTop: 12 },
  cameraCircle: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#243129', alignItems: 'center', justifyContent: 'center' },
  camera: { color: '#D7B45A', fontSize: 24, lineHeight: 26 },
  chevron: { color: '#D7B45A', fontSize: 28 },
});