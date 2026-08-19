import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  getOwnedMemoryPhotos,
  getPassportStamps,
  type JourneyItem,
  type MemoryPhoto,
  type PassportStamp,
} from '../../../src/passport/api';
import { STAMP_CATALOG } from '../../../src/passport/StampCatalog';
import { AppIcon } from '../../../src/ui/AppIcon';

export default function StampDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const stamp = useMemo(() => STAMP_CATALOG.find((item) => item.id === params.id), [params.id]);
  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);
  const [journeyItem, setJourneyItem] = useState<JourneyItem | null>(null);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!stamp) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const stamps = await getPassportStamps();
      setEarnedStamps(stamps);
      const matched = stamp.code ? stamps.find((item) => item.code === stamp.code) : undefined;

      if (matched?.adventure_id) {
        const [journey, memoryPhotos] = await Promise.all([
          getJourney(),
          getOwnedMemoryPhotos(matched.adventure_id),
        ]);
        setJourneyItem(journey.find((item) => item.adventure_id === matched.adventure_id) ?? null);
        setPhotos(memoryPhotos);
      } else {
        setJourneyItem(null);
        setPhotos([]);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open this memory.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stamp]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const earned = useMemo(
    () => stamp?.code ? earnedStamps.find((item) => item.code === stamp.code) : undefined,
    [earnedStamps, stamp],
  );
  const adventureId = earned?.adventure_id ?? null;
  const rating = journeyItem?.rating ?? 0;
  const hasNotes = Boolean(journeyItem?.highlight || journeyItem?.reflection);
  const hasMemory = Boolean(rating || hasNotes || photos.length);

  if (!stamp) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <AppIcon name="stamp" color="#F5C341" size={42} />
          <Text style={styles.missingTitle}>Stamp not found</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to Stamps</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#F5C341" />
        <Text style={styles.loadingText}>Opening your memory…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor="#F5C341"
          />
        )}
      >
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to stamps">
          <AppIcon name="chevron-forward" color="#F5C341" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>Stamps</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.heroCard}>
          <View style={[styles.artStage, stamp.year === 2026 && styles.artStageTall]}>
            <Image source={stamp.source} style={styles.stampImage} resizeMode="contain" />
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.collection}>{stamp.year} COLLECTION</Text>
            <View style={[styles.statusPill, earned ? styles.statusPillEarned : styles.statusPillPreview]}>
              {earned ? <AppIcon name="checkmark" color="#17211C" size={12} /> : null}
              <Text style={[styles.statusText, !earned && styles.statusTextPreview]}>{earned ? 'COLLECTED' : 'PREVIEW'}</Text>
            </View>
          </View>

          <Text style={styles.title}>{stamp.title}</Text>
          <View style={styles.metaWrap}>
            <View style={styles.metaItem}>
              <AppIcon name="adventure" color="#67CFC8" size={14} />
              <Text style={styles.meta}>{stamp.dateLabel}</Text>
            </View>
            <Text style={styles.metaDot}>•</Text>
            <View style={styles.metaItem}>
              <AppIcon name="location" color="#67CFC8" size={14} />
              <Text style={styles.meta}>{stamp.location}</Text>
            </View>
          </View>
        </View>

        {earned && adventureId ? (
          <>
            <View style={styles.memoryHeader}>
              <View>
                <Text style={styles.eyebrow}>YOUR MEMORY</Text>
                <Text style={styles.sectionTitle}>{hasMemory ? 'Your adventure, remembered.' : 'Make this stamp yours.'}</Text>
              </View>
              {hasMemory ? <Text style={styles.memoryState}>IN PROGRESS</Text> : null}
            </View>

            <Pressable
              onPress={() => router.push(`/passport/reflection/edit/${adventureId}`)}
              style={({ pressed }) => [styles.experienceCard, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Rate this adventure and edit your notes"
            >
              <View style={styles.cardHeadingRow}>
                <View>
                  <Text style={styles.cardEyebrow}>YOUR EXPERIENCE</Text>
                  <Text style={styles.cardTitle}>{rating ? 'Your rating' : 'Rate this adventure'}</Text>
                </View>
                <Text style={styles.editLabel}>{rating || hasNotes ? 'EDIT' : 'ADD'}</Text>
              </View>

              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Text key={value} style={[styles.star, value <= rating && styles.starFilled]}>★</Text>
                ))}
              </View>

              {journeyItem?.highlight ? (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteLabel}>ONE MOMENT TO REMEMBER</Text>
                  <Text style={styles.highlight}>“{journeyItem.highlight}”</Text>
                </View>
              ) : null}
              {journeyItem?.reflection ? <Text style={styles.reflection}>{journeyItem.reflection}</Text> : null}
              {!hasNotes ? <Text style={styles.emptyBody}>Add a private note, favorite moment, or community review whenever you want to remember the day.</Text> : null}
            </Pressable>

            <View style={styles.photoSection}>
              <View style={styles.cardHeadingRow}>
                <View>
                  <Text style={styles.cardEyebrow}>PHOTOS FROM THIS ADVENTURE</Text>
                  <Text style={styles.cardTitle}>{photos.length ? `${photos.length} saved ${photos.length === 1 ? 'memory' : 'memories'}` : 'Build your photo memory'}</Text>
                </View>
                <Pressable
                  onPress={() => router.push(`/passport/photos/${adventureId}`)}
                  style={({ pressed }) => [styles.addPhotoButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Add photos from this adventure"
                >
                  <AppIcon name="add" color="#17211C" size={15} />
                  <Text style={styles.addPhotoText}>ADD</Text>
                </Pressable>
              </View>

              {photos.length ? (
                <View style={styles.photoGrid}>
                  {photos.slice(0, 6).map((photo) => (
                    <View key={photo.id} style={styles.photoTile}>
                      <Image source={{ uri: photo.image_url }} style={styles.photo} />
                      {photo.visibility === 'private' ? (
                        <View style={styles.privateBadge}><Text style={styles.privateText}>PRIVATE</Text></View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.photoEmpty}>
                  <AppIcon name="photo" color="#67CFC8" size={24} />
                  <Text style={styles.emptyTitle}>No photos saved yet.</Text>
                  <Text style={styles.emptyBody}>Add photos from your library or camera. They stay private unless you choose to share them with the event gallery.</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.lockedCard}>
            <AppIcon name="stamp" color="#D7B45A" size={25} />
            <View style={styles.lockedCopy}>
              <Text style={styles.emptyTitle}>Memory tools unlock when this stamp is earned.</Text>
              <Text style={styles.emptyBody}>For now you can preview the artwork and event details. Ratings, notes, and personal photos attach to earned adventures.</Text>
            </View>
          </View>
        )}

        <View style={styles.factsCard}>
          <Text style={styles.cardEyebrow}>ADVENTURE</Text>
          <View style={styles.factRow}><Text style={styles.factLabel}>Collection</Text><Text style={styles.factValue}>{stamp.year}</Text></View>
          <View style={styles.factRow}><Text style={styles.factLabel}>Date</Text><Text style={styles.factValue}>{stamp.dateLabel}</Text></View>
          <View style={styles.factRow}><Text style={styles.factLabel}>Destination</Text><Text style={[styles.factValue, styles.factValueWide]}>{stamp.location}</Text></View>
        </View>

        <View style={styles.footerMark}>
          <AppIcon name="stamp" color="#D7B45A" size={15} />
          <Text style={styles.footerText}>PART OF THE {stamp.year} PASSPORT COLLECTION</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  loading: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#98A59E', fontWeight: '700' },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 72, gap: 14 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -5 },
  backText: { color: '#F5C341', fontWeight: '800' },
  error: { color: '#FFB4A9', backgroundColor: '#2A1715', borderRadius: 12, padding: 12 },
  heroCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 22, padding: 15, alignItems: 'center' },
  artStage: { width: '100%', height: 230, alignItems: 'center', justifyContent: 'center' },
  artStageTall: { height: 275 },
  stampImage: { width: '100%', height: '100%' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  collection: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillEarned: { backgroundColor: '#F5C341' },
  statusPillPreview: { borderWidth: 1, borderColor: '#45534C' },
  statusText: { color: '#17211C', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  statusTextPreview: { color: '#9AA69F' },
  title: { color: '#F7F8F3', fontSize: 23, lineHeight: 28, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  metaWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { color: '#B6C1BB', fontSize: 12, lineHeight: 17 },
  metaDot: { color: '#56635C', fontSize: 11 },
  memoryHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 3 },
  eyebrow: { color: '#67CFC8', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.05 },
  sectionTitle: { color: '#F7F8F3', fontSize: 21, lineHeight: 25, fontWeight: '900', marginTop: 3 },
  memoryState: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8, paddingBottom: 3 },
  experienceCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 18, padding: 15, gap: 11 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardEyebrow: { color: '#67CFC8', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#F7F8F3', fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  editLabel: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8, paddingTop: 2 },
  stars: { flexDirection: 'row', gap: 7 },
  star: { color: '#46524C', fontSize: 27, lineHeight: 31 },
  starFilled: { color: '#F5C341' },
  noteBlock: { borderTopWidth: 1, borderTopColor: '#25312C', paddingTop: 11, gap: 5 },
  noteLabel: { color: '#7E8C84', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  highlight: { color: '#F7F8F3', fontSize: 15, lineHeight: 21, fontWeight: '800' },
  reflection: { color: '#B8C3BD', fontSize: 13.5, lineHeight: 20 },
  photoSection: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 18, padding: 15, gap: 12 },
  addPhotoButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: '#F5C341', paddingHorizontal: 10, paddingVertical: 7 },
  addPhotoText: { color: '#17211C', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  photoTile: { width: '31.7%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A2520', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  privateBadge: { position: 'absolute', left: 5, bottom: 5, backgroundColor: 'rgba(9,17,15,0.82)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 },
  privateText: { color: '#D9E1DC', fontSize: 6.8, fontWeight: '900', letterSpacing: 0.5 },
  photoEmpty: { minHeight: 128, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#34423B', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 5 },
  emptyTitle: { color: '#F7F8F3', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  emptyBody: { color: '#929E97', fontSize: 12.5, lineHeight: 18 },
  lockedCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lockedCopy: { flex: 1, gap: 5 },
  factsCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 18, padding: 15 },
  factRow: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#25312C' },
  factLabel: { color: '#7E8C84', fontSize: 11.5, fontWeight: '800' },
  factValue: { color: '#F7F8F3', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  factValueWide: { flex: 1 },
  footerMark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 5 },
  footerText: { color: '#7C8982', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.75 },
  primaryButton: { minHeight: 50, borderRadius: 15, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#17211C', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  missingTitle: { color: '#F7F8F3', fontSize: 22, fontWeight: '900' },
});
