import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadTrailGuideCommunity, type TrailGuideCommunityData, type TrailGuideReview } from './community';
import { loadMyTrailGuidePhotos, loadMyTrailGuideReview, type EditableTrailGuideReview, type MyTrailGuidePhoto } from './memberContributions';

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
  const [myReview, setMyReview] = useState<EditableTrailGuideReview | null>(null);
  const [myPhotos, setMyPhotos] = useState<MyTrailGuidePhoto[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadTrailGuideCommunity(placeId),
      loadMyTrailGuideReview(placeId),
      loadMyTrailGuidePhotos(placeId),
    ]).then(([community, review, photos]) => {
      if (!active) return;
      setData(community);
      setMyReview(review);
      setMyPhotos(photos);
    }).catch(() => {
      if (!active) return;
      setData({ reviews: [], photos: [], averageRating: null, reviewCount: 0, categoryAverages: {} });
      setMyReview(null);
      setMyPhotos([]);
    });
    return () => { active = false; };
  }, [placeId]);

  const topReview = data?.reviews.find((review) => review.id !== myReview?.id) ?? null;
  const pendingPhotos = myPhotos.filter((photo) => photo.moderationStatus === 'pending');
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

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>From campers</Text>
          <Text style={styles.hint}>Go Melanated reviews and real member photos</Text>
        </View>

        {myReview ? (
          <View style={styles.myReviewRow}>
            <View style={styles.myReviewCopy}>
              <Text style={styles.myReviewLabel}>YOUR REVIEW</Text>
              <Text style={styles.myReviewStars}>{'★'.repeat(myReview.rating)}<Text style={styles.myReviewEmpty}>{'★'.repeat(Math.max(0, 5 - myReview.rating))}</Text></Text>
            </View>
            <Text style={styles.myReviewStatus}>Published</Text>
          </View>
        ) : null}

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
          <View style={styles.compactEmpty}>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No camper reviews yet</Text>
              <Text style={styles.emptyBody}>Community reviews will appear here.</Text>
            </View>
          </View>
        )}

        {pendingPhotos.length ? (
          <>
            <View style={styles.divider} />
            <View style={styles.photoHeader}>
              <Text style={styles.photoHeading}>Your photos</Text>
              <Text style={styles.pendingCount}>{pendingPhotos.length} pending review</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {pendingPhotos.map((photo) => (
                <View key={photo.id} style={styles.photoCard}>
                  <Image source={{ uri: photo.signedUrl }} style={styles.photo} />
                  <View style={styles.photoShade} />
                  <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Pending</Text></View>
                  <View style={styles.photoMetaWrap}><Text numberOfLines={1} style={styles.photoMeta}>{photo.campsiteLabel || photo.category.replace('_', ' ')}</Text></View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

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
          </ScrollView>
        ) : (
          <View style={styles.photoEmpty}>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No approved camper photos yet</Text>
              <Text style={styles.emptyBody}>Pending uploads stay visible to their uploader while they are reviewed.</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 10 },
  card: { backgroundColor: '#101914', borderWidth: 1, borderColor: '#243128', borderRadius: 16, padding: 11 },
  headerCopy: { flex: 1 },
  title: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  hint: { color: '#748178', fontSize: 9, marginTop: 2, lineHeight: 12 },
  myReviewRow: { minHeight: 45, marginTop: 9, borderTopWidth: 1, borderTopColor: '#223028', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  myReviewCopy: { gap: 2 },
  myReviewLabel: { color: '#7F8C84', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  myReviewStars: { color: '#E1B94F', fontSize: 13, letterSpacing: 1 },
  myReviewEmpty: { color: '#39443D' },
  myReviewStatus: { color: '#8FA098', fontSize: 8.5, fontWeight: '800' },
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
  compactEmpty: { minHeight: 48, justifyContent: 'center', marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#223028' },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: '#E8EEE9', fontSize: 10.5, fontWeight: '900' },
  emptyBody: { color: '#829087', fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#223028', marginTop: 10, marginBottom: 9 },
  photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoHeading: { color: '#E8EEE9', fontSize: 11, fontWeight: '900' },
  photoCount: { color: '#748178', fontSize: 8 },
  pendingCount: { color: '#D7B45A', fontSize: 8, fontWeight: '800' },
  photoRow: { gap: 7, paddingTop: 8, paddingRight: 4 },
  photoCard: { width: 92, height: 78, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A241E' },
  photo: { ...StyleSheet.absoluteFillObject },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,10,7,0.12)' },
  pendingBadge: { position: 'absolute', top: 5, left: 5, borderRadius: 999, backgroundColor: 'rgba(11,16,13,0.84)', borderWidth: 1, borderColor: '#8A7133', paddingHorizontal: 6, paddingVertical: 3 },
  pendingBadgeText: { color: '#F0CC65', fontSize: 6.5, fontWeight: '900' },
  photoMetaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,7,0.68)', paddingHorizontal: 6, paddingVertical: 4 },
  photoMeta: { color: '#F5F2E8', fontSize: 7.5, fontWeight: '800', textTransform: 'capitalize' },
  photoEmpty: { minHeight: 48, justifyContent: 'center', paddingTop: 7 },
});