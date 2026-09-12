import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../../src/auth/AuthProvider';
import { getTrailGuidePlace } from '../../../src/trailGuide/catalog';
import { loadTrailGuideCommunity, type TrailGuideCommunityData, type TrailGuideReview } from '../../../src/trailGuide/community';
import { AppIcon } from '../../../src/ui/AppIcon';

type Filter = 'all' | 'tent' | 'rv' | 'cabin' | 'day_visit' | 'recent' | 'highest' | 'lowest';

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['tent', 'Tent'],
  ['rv', 'RV'],
  ['cabin', 'Cabin'],
  ['day_visit', 'Day Visit'],
  ['recent', 'Most Recent'],
  ['highest', 'Highest Rated'],
  ['lowest', 'Lowest Rated'],
];

const CATEGORY_LABELS: Record<string, string> = {
  cleanliness: 'Cleanliness',
  campsites: 'Campsites',
  bathrooms: 'Bathrooms',
  location: 'Location',
  family_friendly: 'Family Friendly',
};

function reviewMeta(review: TrailGuideReview) {
  const parts: string[] = [];
  if (review.campingType) parts.push(review.campingType.replace('_', ' '));
  if (review.campsiteLabel) parts.push(`Site ${review.campsiteLabel.replace(/^site\s*/i, '')}`);
  if (review.visitDate) {
    const date = new Date(`${review.visitDate}T12:00:00`);
    if (!Number.isNaN(date.getTime())) parts.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  }
  return parts.join(' · ');
}

export default function TrailGuideReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const place = getTrailGuidePlace(id);
  const [data, setData] = useState<TrailGuideCommunityData | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!place) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void loadTrailGuideCommunity(place.id)
      .then((next) => { if (active) setData(next); })
      .catch(() => { if (active) setData({ reviews: [], photos: [], averageRating: null, reviewCount: 0, categoryAverages: {} }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [place]);

  const reviews = useMemo(() => {
    const source = [...(data?.reviews ?? [])];
    if (filter === 'tent' || filter === 'rv' || filter === 'cabin' || filter === 'day_visit') {
      return source.filter((review) => review.campingType === filter);
    }
    if (filter === 'highest') return source.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
    if (filter === 'lowest') return source.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
    return source.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data?.reviews, filter]);

  if (!place) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Place unavailable</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>Go back</Text></Pressable></View></SafeAreaView>;
  }

  const addReview = () => router.push({ pathname: '/trail-guide/contribute', params: { placeId: place.id, mode: 'review' } } as never);
  const editReview = (reviewId: string) => router.push({ pathname: '/trail-guide/contribute', params: { placeId: place.id, mode: 'review', reviewId } } as never);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></Pressable>
          <Text style={styles.topTitle}>GO MELANATED REVIEWS</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>{place.area}</Text>
          <Text style={styles.title}>{place.name}</Text>
          <View style={styles.summaryRow}>
            <View>
              <View style={styles.scoreRow}><Text style={styles.star}>★</Text><Text style={styles.score}>{data?.averageRating?.toFixed(1) ?? '—'}</Text></View>
              <Text style={styles.count}>{data?.reviewCount ?? 0} Go Melanated {data?.reviewCount === 1 ? 'Review' : 'Reviews'}</Text>
            </View>
            <Pressable onPress={addReview} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><AppIcon name="add" color="#17211C" size={16} /><Text style={styles.addButtonText}>Add Review</Text></Pressable>
          </View>
        </View>

        {Object.keys(data?.categoryAverages ?? {}).length ? (
          <View style={styles.categoryCard}>
            {Object.entries(data?.categoryAverages ?? {}).filter(([key]) => CATEGORY_LABELS[key]).map(([key, value]) => (
              <View key={key} style={styles.categoryRow}>
                <Text style={styles.categoryLabel}>{CATEGORY_LABELS[key]}</Text>
                <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, (value / 5) * 100))}%` }]} /></View>
                <Text style={styles.categoryValue}>{value.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([value, label]) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text></Pressable>)}
        </ScrollView>

        {loading ? <Text style={styles.empty}>Loading reviews…</Text> : reviews.length ? reviews.map((review) => {
          const own = review.profileId === session?.user.id;
          const attached = data?.photos.filter((photo) => photo.reviewId === review.id) ?? [];
          return (
            <View key={review.id} style={[styles.reviewCard, own && styles.ownReviewCard]}>
              <View style={styles.reviewHeader}>
                {review.avatarUrl ? <Image source={{ uri: review.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{review.displayName.slice(0, 1).toUpperCase()}</Text></View>}
                <View style={styles.reviewerCopy}>
                  <View style={styles.nameRow}><Text style={styles.reviewer}>{own ? 'Your Review' : review.displayName}</Text>{own ? <View style={styles.youBadge}><Text style={styles.youBadgeText}>YOU</Text></View> : null}</View>
                  <Text style={styles.meta}>{reviewMeta(review)}</Text>
                </View>
                <Text style={styles.reviewStars}>{'★'.repeat(review.rating)}<Text style={styles.emptyStars}>{'★'.repeat(5 - review.rating)}</Text></Text>
              </View>
              {review.reviewText ? <Text style={styles.reviewText}>{review.reviewText}</Text> : null}
              {attached.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>{attached.map((photo) => <Image key={photo.id} source={{ uri: photo.signedUrl }} style={styles.reviewPhoto} />)}</ScrollView> : null}
              {own ? <Pressable onPress={() => editReview(review.id)} style={styles.editButton}><AppIcon name="edit" color="#D7B45A" size={14} /><Text style={styles.editText}>Edit Review</Text></Pressable> : null}
            </View>
          );
        }) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No reviews match this filter</Text><Text style={styles.empty}>Try another filter or add the first review for this visit type.</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 18, paddingBottom: 50 },
  topBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 42 }, back: { color: '#FFF8E8', fontSize: 38, lineHeight: 40 }, spacer: { width: 42 },
  topTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  header: { marginTop: 8 }, eyebrow: { color: '#87938C', fontSize: 11, fontWeight: '800' },
  title: { color: '#FFF8E8', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 3 },
  summaryRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, star: { color: '#E1B94F', fontSize: 24 }, score: { color: '#FFF8E8', fontSize: 28, fontWeight: '900' },
  count: { color: '#A3AEA7', fontSize: 11, marginTop: 2 },
  addButton: { minHeight: 40, borderRadius: 20, backgroundColor: '#D7B45A', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 }, addButtonText: { color: '#17211C', fontSize: 11, fontWeight: '900' },
  categoryCard: { marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#111A15', padding: 12, gap: 8 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, categoryLabel: { width: 82, color: '#B9C2BC', fontSize: 9 }, bar: { flex: 1, height: 5, borderRadius: 99, backgroundColor: '#253229', overflow: 'hidden' }, barFill: { height: '100%', borderRadius: 99, backgroundColor: '#D7B45A' }, categoryValue: { width: 24, color: '#E8EEE9', textAlign: 'right', fontSize: 9, fontWeight: '800' },
  filters: { gap: 7, paddingVertical: 16, paddingRight: 10 }, filter: { minHeight: 34, borderRadius: 18, borderWidth: 1, borderColor: '#344139', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, filterActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, filterText: { color: '#C7D0CA', fontSize: 10, fontWeight: '800' }, filterTextActive: { color: '#17211C' },
  reviewCard: { marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: '#29372F', backgroundColor: '#101914', padding: 13 }, ownReviewCard: { borderColor: '#665528' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, avatar: { width: 36, height: 36, borderRadius: 18 }, avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#25342A', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#D7B45A', fontWeight: '900' }, reviewerCopy: { flex: 1 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, reviewer: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, youBadge: { borderRadius: 8, backgroundColor: '#27331D', paddingHorizontal: 5, paddingVertical: 2 }, youBadgeText: { color: '#CEE96D', fontSize: 7, fontWeight: '900' }, meta: { color: '#7E8B83', fontSize: 9, marginTop: 2, textTransform: 'capitalize' }, reviewStars: { color: '#E1B94F', fontSize: 10, letterSpacing: 0.5 }, emptyStars: { color: '#3B463F' }, reviewText: { color: '#C8D0CB', fontSize: 12, lineHeight: 18, marginTop: 10 },
  photoRow: { gap: 7, paddingTop: 10 }, reviewPhoto: { width: 112, height: 82, borderRadius: 10, backgroundColor: '#1C261F' },
  editButton: { alignSelf: 'flex-start', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, borderRadius: 17, borderWidth: 1, borderColor: '#564923', paddingHorizontal: 10 }, editText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  emptyCard: { borderRadius: 16, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#101914', padding: 18 }, emptyTitle: { color: '#E8EEE9', fontSize: 13, fontWeight: '900' }, empty: { color: '#849087', fontSize: 11, lineHeight: 16, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, link: { color: '#D7B45A', marginTop: 12 },
  pressed: { opacity: 0.78 },
});
