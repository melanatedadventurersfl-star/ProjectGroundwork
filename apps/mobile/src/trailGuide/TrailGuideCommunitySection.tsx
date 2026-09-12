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
      .filter(([key]) => Boolean(labels[key]))
      .map(([key, value]) => ({ key, label: labels[key] ?? key, value }))
      .slice(0, 4);
  }, [data]);

  const openReview = () => router.push({ pathname: '/trail-guide/contribute', params: { placeId, mode: 'review' } });
  const openPhotos = () => router.push({ pathname: '/trail-guide/contribute', params: { placeId, mode: 'photos' } });

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>From campers</Text>
            <Text style={styles.hint}>Go Melanated reviews and real member photos</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={openReview} hitSlop={8}><Text style={styles.link}>Review</Text></Pressable>
            <Pressable onPress={openPhotos} hitSlop={8}><Text style={styles.link}>Add photos</Text></Pressable>
          </View>
        </View>

        {data?.reviewCount ? (
          <View style={styles.reviewArea}>
            <View style={styles.ratingSummary}>
              <View style={styles.bigRatingWrap}>
                <View style={styles.ratingTopLine}><Text style={styles.star}>★</Text><Text style={styles.bigRating}>{data.averageRating?.toFixed(1)}</Text></View>
                <Text style={styles.count}>{data.reviewCount} {data.reviewCount === 1 ? 'review' : 'reviews'}</Text>
              </View>
              {ratingRows.length ? <View style={styles.ratingBars}>{ratingRows.map((row) => <RatingBar key={row.key} label={row.label} value={row.value} />)}</View> : null}
            </View>

            {topReview ? (
              <View style={styles.reviewCard}>
                <View style={styles.reviewerRow}>
                  {topReview.avatarUrl ? <Image source={{ uri: topReview.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{topReview.displayName.slice(0, 1).toUpperCase()}</Text></View>}
                  <View style={styles.reviewerCopy}>
                    <Text style={styles.reviewerName}>{topReview.displayName}</Text>
                    <Text style={styles.reviewMeta}>{reviewMeta(topReview)}</Text>
                  </View>
                  <Text style={styles.reviewStars}>{'★'.repeat(topReview.rating)}</Text>
                </View>
                {topReview.reviewText ? <Text numberOfLines={3} style={styles.reviewText}>{topReview.reviewText}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : (
          <Pressable onPress={openReview} style={styles.compactEmpty}>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No camper reviews yet</Text>
              <Text style={styles.emptyBody}>Share what future campers should know.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        <View style={styles.photoHeader}>
          <Text style={styles.photoHeading}>Camper photos</Text>
          {data?.photos.length ? <Text style={styles.photoCount}>{data.photos.length} shown</Text> : null}
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
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No camper photos yet</Text>
              <Text style={styles.emptyBody}>Show the campsites and facilities as they look in real life.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 10 },
  card: { backgroundColor: '#101914', borderWidth: 1, borderColor: '#243128', borderRadius: 16, padding: 11 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headerCopy: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 11, paddingTop: 2 },
  title: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  hint: { color: '#748178', fontSize: 9, marginTop: 2, lineHeight: 12 },
  link: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900' },
  reviewArea: { marginTop: 10 },
  ratingSummary: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  bigRatingWrap: { width: 68, alignItems: 'center' },
  ratingTopLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { color: '#E1B94F', fontSize: 17, lineHeight: 20 },
  bigRating: { color: '#FFF8E8', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  count: { color: '#7D8981', fontSize: 8, marginTop: 1 },
  ratingBars: { flex: 1, gap: 4 },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingLabel: { width: 64, color: '#AAB4AE', fontSize: 7.5 },
  barTrack: { flex: 1, height: 4, backgroundColor: '#243129', borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#D7B45A', borderRadius: 99 },
  ratingValue: { width: 20, color: '#D7DFDA', fontSize: 8, fontWeight: '800', textAlign: 'right' },
  reviewCard: { marginTop: 9, borderTopWidth: 1, borderTopColor: '#223028', paddingTop: 9 },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1E2922' },
  avatarFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#26342B', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#E7C766', fontSize: 10, fontWeight: '900' },
  reviewerCopy: { flex: 1 },
  reviewerName: { color: '#FFF8E8', fontSize: 10.5, fontWeight: '900' },
  reviewMeta: { color: '#7B8880', fontSize: 8, textTransform: 'capitalize', marginTop: 1 },
  reviewStars: { color: '#E1B94F', fontSize: 9, letterSpacing: 0.5 },
  reviewText: { color: '#C0C8C3', fontSize: 10, lineHeight: 14, marginTop: 7 },
  compactEmpty: { minHeight: 48, flexDirection: 'row', alignItems: 'center', marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#223028' },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: '#E8EEE9', fontSize: 10.5, fontWeight: '900' },
  emptyBody: { color: '#829087', fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#223028', marginTop: 10, marginBottom: 9 },
  photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoHeading: { color: '#E8EEE9', fontSize: 11, fontWeight: '900' },
  photoCount: { color: '#748178', fontSize: 8 },
  photoRow: { gap: 7, paddingTop: 8, paddingRight: 4 },
  photoCard: { width: 92, height: 78, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A241E' },
  photo: { ...StyleSheet.absoluteFillObject },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,10,7,0.12)' },
  photoMetaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,7,0.68)', paddingHorizontal: 6, paddingVertical: 4 },
  photoMeta: { color: '#F5F2E8', fontSize: 7.5, fontWeight: '800', textTransform: 'capitalize' },
  addPhotoCard: { width: 76, height: 78, borderRadius: 10, borderWidth: 1, borderColor: '#39493F', backgroundColor: '#151E18', alignItems: 'center', justifyContent: 'center' },
  plus: { color: '#D7B45A', fontSize: 23, lineHeight: 25 },
  addPhotoText: { color: '#D0D8D3', fontSize: 8, fontWeight: '800', marginTop: 2 },
  photoEmpty: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 7 },
  cameraCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#243129', alignItems: 'center', justifyContent: 'center' },
  camera: { color: '#D7B45A', fontSize: 20, lineHeight: 22 },
  chevron: { color: '#D7B45A', fontSize: 24 },
});