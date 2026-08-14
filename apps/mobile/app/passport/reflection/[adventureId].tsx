import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getJourney,
  getMemoryPhotos,
  getPassportStamps,
  type JourneyItem,
  type MemoryPhoto,
  type PassportStamp,
} from '../../../src/passport/api';
import { isLegacyStampCode, StampArt } from '../../../src/passport/StampArt';

export default function StampDetailScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [journeyItem, setJourneyItem] = useState<JourneyItem | null>(null);
  const [stamp, setStamp] = useState<PassportStamp | null>(null);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adventureId) return;

    try {
      const [journey, stamps, memoryPhotos] = await Promise.all([
        getJourney(),
        getPassportStamps(),
        getMemoryPhotos(adventureId),
      ]);

      setJourneyItem(journey.find((item) => item.adventure_id === adventureId) ?? null);
      setStamp(stamps.find((item) => item.adventure_id === adventureId) ?? null);
      setPhotos(memoryPhotos);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open this stamp.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adventureId]);

  useEffect(() => { void load(); }, [load]);

  const eventDate = useMemo(() => {
    const raw = journeyItem?.experienced_at || journeyItem?.starts_at || stamp?.earned_at;
    if (!raw) return null;
    return new Date(raw).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [journeyItem, stamp]);

  const earnedDate = useMemo(() => {
    if (!stamp?.earned_at) return null;
    return new Date(stamp.earned_at).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    });
  }, [stamp]);

  const title = journeyItem?.title || stamp?.title || 'Adventure Stamp';
  const location = journeyItem?.city && journeyItem?.state
    ? `${journeyItem.city}, ${journeyItem.state}`
    : null;
  const hasReflection = Boolean(journeyItem?.highlight || journeyItem?.reflection || journeyItem?.rating);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#D7B45A" />
        <Text style={styles.loadingText}>Opening your stamp…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor="#D7B45A"
          />
        )}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>STAMP DETAILS</Text>
          <View style={styles.topSpacer} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.hero}>
          <View style={styles.stampWrap}>
            {stamp?.code && isLegacyStampCode(stamp.code) ? (
              <StampArt code={stamp.code} width={210} />
            ) : (
              <View style={styles.fallbackStamp}>
                <Text style={styles.fallbackMark}>MA</Text>
                <Text style={styles.fallbackLabel}>ADVENTURE</Text>
              </View>
            )}
          </View>

          <View style={styles.heroCopy}>
            <View style={styles.officialPill}>
              <Text style={styles.officialText}>✓ OFFICIAL ADVENTURE</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {journeyItem?.category ? <Text style={styles.category}>{journeyItem.category}</Text> : null}
            {eventDate ? <Text style={styles.meta}>◷  {eventDate}</Text> : null}
            {location ? <Text style={styles.meta}>⌖  {location}</Text> : null}
          </View>
        </View>

        <View style={styles.earnedCard}>
          <View style={styles.earnedIcon}><Text style={styles.earnedCheck}>✓</Text></View>
          <View style={styles.earnedCopy}>
            <Text style={styles.earnedTitle}>STAMP EARNED</Text>
            <Text style={styles.earnedBody}>You were there. You earned this.</Text>
          </View>
          {earnedDate ? <Text style={styles.earnedDate}>{earnedDate}</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.eyebrow}>THE SHARED MEMORY</Text>
              <Text style={styles.sectionTitle}>Event Gallery</Text>
            </View>
            {photos.length ? <Text style={styles.count}>{photos.length} photo{photos.length === 1 ? '' : 's'}</Text> : null}
          </View>
          <Text style={styles.sectionIntro}>Photos connected to this adventure appear here, including community-shared event memories available to you.</Text>

          {photos.length ? (
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoTile}>
                  <Image source={{ uri: photo.image_url }} style={styles.photo} />
                  {photo.caption ? <Text style={styles.caption} numberOfLines={2}>{photo.caption}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>The gallery is still developing.</Text>
              <Text style={styles.emptyBody}>When photos are added to this adventure, they’ll collect here as part of the event’s shared memory.</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.eyebrow}>YOUR MEMORY</Text>
              <Text style={styles.sectionTitle}>Reflection</Text>
            </View>
            {journeyItem?.rating ? <Text style={styles.rating}>{journeyItem.rating}/5</Text> : null}
          </View>

          {hasReflection ? (
            <View style={styles.reflectionCard}>
              {journeyItem?.highlight ? (
                <>
                  <Text style={styles.reflectionLabel}>ONE MOMENT TO REMEMBER</Text>
                  <Text style={styles.highlight}>“{journeyItem.highlight}”</Text>
                </>
              ) : null}
              {journeyItem?.reflection ? (
                <Text style={styles.reflectionBody}>{journeyItem.reflection}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No reflection yet.</Text>
              <Text style={styles.emptyBody}>The stamp already belongs to you. Add a reflection whenever you want to remember what the experience felt like.</Text>
            </View>
          )}

          <Pressable
            style={styles.primaryButton}
            onPress={() => adventureId && router.push(`/passport/reflection/edit/${adventureId}`)}
          >
            <Text style={styles.primaryButtonText}>{hasReflection ? 'Edit Reflection' : 'Reflect on this Adventure'}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>ABOUT THIS ADVENTURE</Text>
          <View style={styles.aboutCard}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Adventure</Text>
              <Text style={styles.aboutValue}>{title}</Text>
            </View>
            {journeyItem?.category ? (
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Type</Text>
                <Text style={styles.aboutValue}>{journeyItem.category}</Text>
              </View>
            ) : null}
            {location ? (
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Location</Text>
                <Text style={styles.aboutValue}>{location}</Text>
              </View>
            ) : null}
            {eventDate ? (
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Date</Text>
                <Text style={styles.aboutValue}>{eventDate}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#A6B0AA', fontWeight: '700' },
  content: { padding: 18, paddingBottom: 56, gap: 22 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#FFF8E8', fontSize: 38, lineHeight: 40, fontWeight: '300' },
  topTitle: { color: '#D7B45A', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  topSpacer: { width: 42 },
  error: { color: '#FFB4A9', backgroundColor: '#2A1715', borderRadius: 12, padding: 12 },
  hero: { backgroundColor: '#16231C', borderWidth: 1, borderColor: '#314238', borderRadius: 24, padding: 18, gap: 20, alignItems: 'center' },
  stampWrap: { minHeight: 220, width: '100%', alignItems: 'center', justifyContent: 'center' },
  fallbackStamp: { width: 210, height: 210, borderWidth: 2, borderColor: '#D7B45A', borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2B23' },
  fallbackMark: { color: '#D7B45A', fontSize: 64, fontWeight: '900' },
  fallbackLabel: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heroCopy: { width: '100%', gap: 8 },
  officialPill: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#45584C', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  officialText: { color: '#D9E0DC', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  title: { color: '#FFF8E8', fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 4 },
  category: { color: '#D7B45A', fontSize: 15, fontWeight: '900' },
  meta: { color: '#BAC4BE', fontSize: 14, lineHeight: 21 },
  earnedCard: { backgroundColor: '#141E19', borderRadius: 18, borderWidth: 1, borderColor: '#2D3A33', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  earnedIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  earnedCheck: { color: '#D7B45A', fontSize: 20, fontWeight: '900' },
  earnedCopy: { flex: 1 },
  earnedTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
  earnedBody: { color: '#A6B0AA', fontSize: 12, marginTop: 3 },
  earnedDate: { color: '#D7B45A', fontSize: 11, fontWeight: '800' },
  section: { gap: 13 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: '#FFF8E8', fontSize: 23, fontWeight: '900', marginTop: 3 },
  count: { color: '#9DA8A1', fontSize: 12, fontWeight: '700' },
  sectionIntro: { color: '#8F9B94', lineHeight: 20, fontSize: 13 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile: { width: '48.6%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2B3931' },
  photo: { width: '100%', aspectRatio: 1.18, backgroundColor: '#1D2822' },
  caption: { color: '#D9E0DC', fontSize: 11, lineHeight: 15, padding: 9 },
  emptyCard: { backgroundColor: '#151F1A', borderRadius: 16, borderWidth: 1, borderColor: '#29372F', padding: 16 },
  emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  emptyBody: { color: '#929E97', fontSize: 13, lineHeight: 19, marginTop: 5 },
  divider: { height: 1, backgroundColor: '#27352D' },
  rating: { color: '#D7B45A', fontWeight: '900', fontSize: 16 },
  reflectionCard: { backgroundColor: '#151F1A', borderRadius: 18, borderWidth: 1, borderColor: '#2D3B33', padding: 17, gap: 10 },
  reflectionLabel: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  highlight: { color: '#FFF8E8', fontSize: 18, lineHeight: 25, fontWeight: '800' },
  reflectionBody: { color: '#CAD2CD', fontSize: 15, lineHeight: 23 },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#17211C', fontWeight: '900', fontSize: 15 },
  aboutCard: { backgroundColor: '#151F1A', borderRadius: 18, borderWidth: 1, borderColor: '#2D3B33', overflow: 'hidden' },
  aboutRow: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#334139', gap: 4 },
  aboutLabel: { color: '#8D9992', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  aboutValue: { color: '#FFF8E8', fontSize: 14, fontWeight: '700' },
});
