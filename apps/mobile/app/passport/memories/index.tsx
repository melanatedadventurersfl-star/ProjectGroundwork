import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAllMemoryPhotos, getJourney, getMemoryAlbums, type JourneyItem, type MemoryAlbum, type MemoryPhoto } from '../../../src/passport/api';

type MemoryView = 'all' | 'adventures';

export default function MemoriesScreen() {
  const [view, setView] = useState<MemoryView>('all');
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextPhotos, nextAlbums, nextJourney] = await Promise.all([
        getAllMemoryPhotos(),
        getMemoryAlbums(),
        getJourney(),
      ]);
      setPhotos(nextPhotos);
      setAlbums(nextAlbums);
      setJourney(nextJourney);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Memories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const adventureById = useMemo(() => new Map(journey.map((item) => [item.adventure_id, item])), [journey]);

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Passport</Text></Pressable>
          <Pressable style={styles.addButton} onPress={() => router.push('/passport/memories/add')}>
            <Text style={styles.addButtonText}>+ Add Memory</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>YOUR PERSONAL ARCHIVE</Text>
        <Text style={styles.title}>Memories</Text>
        <Text style={styles.subtitle}>Your moments from the adventures you’ve lived.</Text>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, view === 'all' && styles.tabActive]} onPress={() => setView('all')}>
            <Text style={[styles.tabText, view === 'all' && styles.tabTextActive]}>All Memories</Text>
            <Text style={[styles.tabCount, view === 'all' && styles.tabTextActive]}>{photos.length}</Text>
          </Pressable>
          <Pressable style={[styles.tab, view === 'adventures' && styles.tabActive]} onPress={() => setView('adventures')}>
            <Text style={[styles.tabText, view === 'adventures' && styles.tabTextActive]}>By Adventure</Text>
            <Text style={[styles.tabCount, view === 'adventures' && styles.tabTextActive]}>{albums.length}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {view === 'all' && photos.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.map((photo) => {
              const adventure = adventureById.get(photo.adventure_id);
              return (
                <Pressable key={photo.id} style={styles.photoCard} onPress={() => router.push(`/passport/memories/photo/${photo.id}`)}>
                  <Image source={{ uri: photo.image_url }} style={styles.photo} />
                  <View style={styles.photoMeta}>
                    <Text style={styles.photoTitle} numberOfLines={1}>{photo.caption || 'Adventure memory'}</Text>
                    <Text style={styles.photoAdventure} numberOfLines={1}>{adventure?.title ?? 'Completed adventure'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {view === 'adventures' && albums.length > 0 ? (
          <View style={styles.albumStack}>
            {albums.map((album) => (
              <Pressable key={album.adventure_id} style={styles.albumCard} onPress={() => router.push(`/passport/memories/${album.adventure_id}`)}>
                {album.cover_url ? <Image source={{ uri: album.cover_url }} style={styles.albumCover} /> : <View style={styles.albumCoverPlaceholder} />}
                <View style={styles.albumShade} />
                <View style={styles.albumCopy}>
                  <Text style={styles.albumDate}>{new Date(album.experienced_at || album.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  <Text style={styles.albumTitle}>{album.title}</Text>
                  <Text style={styles.albumLocation}>{album.city}, {album.state}</Text>
                  <Text style={styles.albumCount}>{album.memories.length} memor{album.memories.length === 1 ? 'y' : 'ies'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {((view === 'all' && !photos.length) || (view === 'adventures' && !albums.length)) ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEyebrow}>START BUILDING YOUR MEMORIES</Text>
            <Text style={styles.emptyTitle}>{journey.length ? 'Your adventures already have stories.' : 'Your memories begin with your first adventure.'}</Text>
            <Text style={styles.emptyBody}>{journey.length ? 'Add a personal photo or save an event photo to turn completed adventures into your private scrapbook.' : 'Complete an official MA experience and this space will begin to grow.'}</Text>
            {journey.length ? (
              <Pressable style={styles.primaryButton} onPress={() => router.push('/passport/memories/add')}>
                <Text style={styles.primaryButtonText}>Add your first memory</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/explore')}>
                <Text style={styles.primaryButtonText}>Explore Adventures</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15 },
  addButton: { borderWidth: 1, borderColor: '#D7B45A', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999 },
  addButtonText: { color: '#F0D083', fontWeight: '900', fontSize: 12 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 8 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  subtitle: { color: '#98A49C', fontSize: 14, lineHeight: 20 },
  tabs: { flexDirection: 'row', backgroundColor: '#151F1A', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#2B3931', marginTop: 8 },
  tab: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  tabActive: { backgroundColor: '#243329' },
  tabText: { color: '#91A098', fontWeight: '800' },
  tabTextActive: { color: '#FFF8E8' },
  tabCount: { color: '#66736C', fontWeight: '900', fontSize: 11 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  photoCard: { width: '48.5%', backgroundColor: '#17211C', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A3931' },
  photo: { width: '100%', aspectRatio: 0.9, backgroundColor: '#213028' },
  photoMeta: { padding: 10, gap: 3 },
  photoTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 13 },
  photoAdventure: { color: '#87948B', fontSize: 10 },
  albumStack: { gap: 13, marginTop: 4 },
  albumCard: { minHeight: 210, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#34483C', backgroundColor: '#17211C' },
  albumCover: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  albumCoverPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#223128' },
  albumShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,13,10,0.54)' },
  albumCopy: { flex: 1, justifyContent: 'flex-end', padding: 17 },
  albumDate: { color: '#E4C66E', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  albumTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 4 },
  albumLocation: { color: '#D1D8D3', fontSize: 12, marginTop: 3 },
  albumCount: { color: '#F0D083', fontWeight: '900', fontSize: 12, marginTop: 10 },
  empty: { backgroundColor: '#17211C', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2B3931', gap: 10, marginTop: 8 },
  emptyEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  emptyTitle: { color: '#FFF8E8', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  emptyBody: { color: '#98A49C', lineHeight: 20 },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 4 },
  primaryButtonText: { color: '#142019', fontWeight: '900' },
  error: { color: '#FFB4A9', marginTop: 4 },
});
