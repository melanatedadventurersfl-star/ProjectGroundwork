import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getJourney, getOwnedMemoryPhotos, type MemoryPhoto } from '../../../src/passport/api';
import { AppIcon } from '../../../src/ui/AppIcon';

export default function AdventurePhotoGalleryScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [title, setTitle] = useState('Adventure Photos');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adventureId) return;
    try {
      const [ownedPhotos, journey] = await Promise.all([
        getOwnedMemoryPhotos(adventureId),
        getJourney(),
      ]);
      setPhotos(ownedPhotos.filter((photo) => photo.source_kind !== 'event_upload'));
      setTitle(journey.find((item) => item.adventure_id === adventureId)?.title ?? 'Adventure Photos');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load these photos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adventureId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const selectedIndex = useMemo(
    () => photos.findIndex((photo) => photo.id === selectedId),
    [photos, selectedId],
  );
  const selectedPhoto = selectedIndex >= 0 ? photos[selectedIndex] : null;

  function move(direction: -1 | 1) {
    if (!photos.length || selectedIndex < 0) return;
    const next = (selectedIndex + direction + photos.length) % photos.length;
    setSelectedId(photos[next].id);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#F5C341" />
        <Text style={styles.loadingText}>Opening gallery…</Text>
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
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
            <AppIcon name="chevron-forward" color="#FFF8E8" size={23} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <Text style={styles.topTitle}>PHOTO GALLERY</Text>
          <Pressable
            onPress={() => adventureId && router.push(`/passport/photos/add/${adventureId}`)}
            hitSlop={8}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
          >
            <Text style={styles.addPlus}>＋</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR ADVENTURE</Text>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.count}>{photos.length} photo{photos.length === 1 ? '' : 's'}</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => adventureId && router.push(`/passport/photos/add/${adventureId}`)}
            >
              <AppIcon name="camera" color="#17211C" size={15} />
              <Text style={styles.addButtonText}>Add Photos</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {photos.length ? (
          <View style={styles.grid}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                onPress={() => setSelectedId(photo.id)}
                accessibilityRole="imagebutton"
                accessibilityLabel={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
              >
                <Image source={{ uri: photo.image_url }} style={styles.tileImage} />
                <View style={styles.tileShade} />
                {photo.caption ? <Text style={styles.tileCaption} numberOfLines={2}>{photo.caption}</Text> : null}
                {photo.visibility === 'private' ? (
                  <View style={styles.privatePill}><Text style={styles.privateText}>PRIVATE</Text></View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><AppIcon name="photos" color="#D7B45A" size={30} /></View>
            <Text style={styles.emptyTitle}>No photos in this adventure yet</Text>
            <Text style={styles.emptyBody}>Add a few moments and this becomes your visual scrapbook from the trip.</Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => adventureId && router.push(`/passport/photos/add/${adventureId}`)}
            >
              <Text style={styles.emptyButtonText}>Add Your First Photo</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedId(null)}>
        <View style={styles.viewer}>
          <SafeAreaView style={styles.viewerSafe}>
            <View style={styles.viewerTopBar}>
              <Pressable onPress={() => setSelectedId(null)} style={styles.viewerClose} hitSlop={10}>
                <Text style={styles.viewerCloseText}>×</Text>
              </Pressable>
              <Text style={styles.viewerCount}>{selectedIndex + 1} / {photos.length}</Text>
              <View style={styles.viewerSpacer} />
            </View>

            {selectedPhoto ? (
              <View style={styles.viewerBody}>
                <Image source={{ uri: selectedPhoto.image_url }} style={styles.viewerImage} resizeMode="contain" />

                {photos.length > 1 ? (
                  <>
                    <Pressable style={[styles.navButton, styles.navLeft]} onPress={() => move(-1)}>
                      <Text style={styles.navText}>‹</Text>
                    </Pressable>
                    <Pressable style={[styles.navButton, styles.navRight]} onPress={() => move(1)}>
                      <Text style={styles.navText}>›</Text>
                    </Pressable>
                  </>
                ) : null}

                <View style={styles.viewerInfo}>
                  {selectedPhoto.caption ? <Text style={styles.viewerCaption}>{selectedPhoto.caption}</Text> : null}
                  <Text style={styles.viewerMeta}>{selectedPhoto.visibility === 'private' ? 'Only you can see this photo' : 'Shared with the adventure'}</Text>
                </View>
              </View>
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  center: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#A7B1AB', fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 90, gap: 18 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  addPlus: { color: '#F5C341', fontSize: 29, lineHeight: 32, fontWeight: '500' },
  header: { gap: 5 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 25, lineHeight: 30, fontWeight: '900' },
  headerMeta: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  count: { color: '#8F9C95', fontSize: 12.5, fontWeight: '800' },
  addButton: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, backgroundColor: '#F5C341', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addButtonText: { color: '#17211C', fontSize: 12, fontWeight: '900' },
  error: { color: '#F3A6A6', backgroundColor: '#2C1818', borderRadius: 12, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.7%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#17211C', position: 'relative', borderWidth: 1, borderColor: '#26342D' },
  tileImage: { width: '100%', height: '100%' },
  tileShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,8,.08)' },
  tileCaption: { position: 'absolute', left: 9, right: 9, bottom: 9, color: '#FFF8E8', fontSize: 11, lineHeight: 14, fontWeight: '800', textShadowColor: 'rgba(0,0,0,.8)', textShadowRadius: 5 },
  privatePill: { position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(9,17,15,.78)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  privateText: { color: '#F0D37A', fontSize: 8.5, fontWeight: '900', letterSpacing: .6 },
  pressed: { opacity: .7 },
  emptyCard: { borderWidth: 1, borderColor: '#2A3831', backgroundColor: '#111A17', borderRadius: 20, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 34, gap: 8 },
  emptyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#1A2821', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: '#8F9C95', fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  emptyButton: { marginTop: 8, backgroundColor: '#D7B45A', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12 },
  emptyButtonText: { color: '#17211C', fontWeight: '900', fontSize: 12.5 },
  viewer: { flex: 1, backgroundColor: 'rgba(4,8,7,.98)' },
  viewerSafe: { flex: 1 },
  viewerTopBar: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerClose: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  viewerCloseText: { color: '#FFF8E8', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  viewerCount: { color: '#D8DFDB', fontWeight: '900', fontSize: 12 },
  viewerSpacer: { width: 42 },
  viewerBody: { flex: 1, position: 'relative', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '76%' },
  navButton: { position: 'absolute', top: '43%', width: 42, height: 54, borderRadius: 21, backgroundColor: 'rgba(9,17,15,.72)', alignItems: 'center', justifyContent: 'center' },
  navLeft: { left: 10 },
  navRight: { right: 10 },
  navText: { color: '#FFF8E8', fontSize: 36, lineHeight: 40, fontWeight: '300' },
  viewerInfo: { minHeight: 90, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, gap: 5 },
  viewerCaption: { color: '#FFF8E8', fontSize: 15, lineHeight: 21, fontWeight: '800' },
  viewerMeta: { color: '#84918A', fontSize: 11.5 },
});
