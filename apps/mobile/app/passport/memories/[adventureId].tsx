import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getJourney, getOwnedMemoryPhotos, type JourneyItem, type MemoryPhoto } from '../../../src/passport/api';

export default function MemoryAlbumScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [adventure, setAdventure] = useState<JourneyItem | null>(null);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adventureId) return;
    try {
      setLoading(true);
      const [journey, nextPhotos] = await Promise.all([getJourney(), getOwnedMemoryPhotos(adventureId)]);
      setAdventure(journey.find((item) => item.adventure_id === adventureId) ?? null);
      setPhotos(nextPhotos);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this memory album.');
    } finally {
      setLoading(false);
    }
  }, [adventureId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Memories</Text></Pressable>

        <View style={styles.hero}>
          {photos[0]?.image_url ? <Image source={{ uri: photos[0].image_url }} style={styles.heroImage} /> : null}
          <View style={styles.heroShade} />
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>ADVENTURE MEMORY ALBUM</Text>
            <Text style={styles.title}>{adventure?.title ?? 'Adventure Memories'}</Text>
            <Text style={styles.meta}>{adventure ? `${new Date(adventure.experienced_at || adventure.starts_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · ${adventure.city}, ${adventure.state}` : ''}</Text>
            <Text style={styles.count}>{photos.length} memor{photos.length === 1 ? 'y' : 'ies'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId } })}>
            <Text style={styles.primaryText}>+ Add Memory</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => adventureId && router.push(`/adventures/${adventureId}`)}>
            <Text style={styles.secondaryText}>View Adventure</Text>
          </Pressable>
        </View>

        {(adventure?.highlight || adventure?.reflection) ? (
          <View style={styles.reflectionCard}>
            <Text style={styles.reflectionEyebrow}>WHAT I’LL REMEMBER MOST</Text>
            {adventure.highlight ? <Text style={styles.highlight}>{adventure.highlight}</Text> : null}
            {adventure.reflection ? <Text style={styles.reflection}>{adventure.reflection}</Text> : null}
            <Pressable onPress={() => adventureId && router.push(`/passport/reflection/${adventureId}`)}><Text style={styles.link}>Edit reflection</Text></Pressable>
          </View>
        ) : (
          <Pressable style={styles.reflectionPrompt} onPress={() => adventureId && router.push(`/passport/reflection/${adventureId}`)}>
            <Text style={styles.reflectionEyebrow}>WHAT I’LL REMEMBER MOST</Text>
            <Text style={styles.promptTitle}>Add a reflection to this chapter.</Text>
            <Text style={styles.promptBody}>Keep the words private or share them with the community later.</Text>
          </Pressable>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {photos.length ? (
          <View style={styles.grid}>
            {photos.map((photo) => (
              <Pressable key={photo.id} style={styles.photoCard} onPress={() => router.push(`/passport/memories/photo/${photo.id}`)}>
                <Image source={{ uri: photo.image_url }} style={styles.photo} />
                <View style={styles.photoFooter}>
                  <Text style={styles.photoCaption} numberOfLines={2}>{photo.caption || 'Adventure memory'}</Text>
                  <Text style={styles.visibility}>{photo.visibility === 'private' ? 'Only me' : photo.visibility === 'group' ? 'MA Members' : 'Public'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.promptTitle}>This album is waiting for its first memory.</Text>
            <Text style={styles.promptBody}>Add a personal photo or save one from the event gallery.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15 },
  hero: { minHeight: 260, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#34483C', backgroundColor: '#1A2821' },
  heroImage: { ...absoluteFill, width: '100%', height: '100%' },
  heroShade: { ...absoluteFill, backgroundColor: 'rgba(8,13,10,0.58)' },
  heroCopy: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  eyebrow: { color: '#E1C16A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 33, fontWeight: '900', marginTop: 5 },
  meta: { color: '#D0D8D2', marginTop: 5, fontSize: 12 },
  count: { color: '#F0D083', fontWeight: '900', marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, backgroundColor: '#D7B45A', borderRadius: 14, padding: 14, alignItems: 'center' },
  primaryText: { color: '#142019', fontWeight: '900' },
  secondary: { flex: 1, borderWidth: 1, borderColor: '#54645A', borderRadius: 14, padding: 14, alignItems: 'center' },
  secondaryText: { color: '#FFF8E8', fontWeight: '900' },
  reflectionCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#2B3931', gap: 7 },
  reflectionPrompt: { backgroundColor: '#17211C', borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#2B3931', gap: 6 },
  reflectionEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  highlight: { color: '#FFF8E8', fontSize: 18, lineHeight: 24, fontWeight: '900' },
  reflection: { color: '#B8C1BB', lineHeight: 20 },
  promptTitle: { color: '#FFF8E8', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  promptBody: { color: '#97A39B', lineHeight: 19 },
  link: { color: '#D7B45A', fontWeight: '900', marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48.5%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2A3931' },
  photo: { width: '100%', aspectRatio: 0.92, backgroundColor: '#223128' },
  photoFooter: { padding: 10, gap: 5 },
  photoCaption: { color: '#FFF8E8', fontWeight: '800', fontSize: 12, lineHeight: 16 },
  visibility: { color: '#7F8D84', fontSize: 10, fontWeight: '800' },
  empty: { backgroundColor: '#17211C', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#2B3931', gap: 7 },
  error: { color: '#FFB4A9' },
});
