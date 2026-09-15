import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostOutingById, type HostOuting } from '../../../src/hosting/api';
import { EventCoverPositioner } from '../../../src/hosting/EventCoverPositioner';

export default function CoverPositionEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const desktopModal = Platform.OS === 'web' && width >= 720;
  const [event, setEvent] = useState<HostOuting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) return;
      try {
        const found = await getHostOutingById(id);
        if (active) setEvent(found);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load the event cover.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  function close() {
    router.back();
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, desktopModal && styles.safeDesktop]}>
      <View style={[styles.shell, desktopModal && styles.shellDesktop]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>EVENT COVER</Text>
            <Text style={styles.title}>Reposition cover</Text>
            <Text style={styles.subtitle}>{event?.title ?? 'Event'} · Drag the image, adjust zoom, then save the position.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close cover editor" style={styles.closeButton} onPress={close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && !event?.hero_image_url ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No cover photo yet</Text>
              <Text style={styles.emptyCopy}>Add a cover photo first, then come back here to position it.</Text>
              <Pressable style={styles.primaryButton} onPress={() => router.replace(`/host/edit/${id}?focus=cover` as never)}><Text style={styles.primaryButtonText}>Add cover photo</Text></Pressable>
            </View>
          ) : null}
          {event?.hero_image_url ? (
            <EventCoverPositioner
              adventureId={event.id}
              imageUrl={event.hero_image_url}
              disabled={event.status === 'cancelled' || event.status === 'completed'}
              standalone
              onSaved={close}
            />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.cancelButton} onPress={close}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          <Text style={styles.footerHint}>Saving keeps the original image and stores only its focal point and zoom.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  safeDesktop: { backgroundColor: 'rgba(3,7,5,.92)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shell: { flex: 1, backgroundColor: '#0B100D' },
  shellDesktop: { width: '92%', maxWidth: 980, maxHeight: 820, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#344039', backgroundColor: '#111713' },
  header: { minHeight: 92, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#29332D', flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#8C9890', fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  closeButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#3A463F', backgroundColor: '#171F1A', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#D8DEDA', fontSize: 22, lineHeight: 24 },
  content: { padding: 18, paddingBottom: 24 },
  error: { color: '#FF9D93', fontSize: 10, lineHeight: 15 },
  empty: { minHeight: 280, borderRadius: 18, borderWidth: 1, borderColor: '#344039', backgroundColor: '#121914', padding: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  emptyCopy: { color: '#839087', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 6, maxWidth: 360 },
  primaryButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#D7B45A', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  primaryButtonText: { color: '#172017', fontSize: 9.5, fontWeight: '900' },
  footer: { minHeight: 66, borderTopWidth: 1, borderTopColor: '#29332D', paddingHorizontal: 18, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancelButton: { minWidth: 94, minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: '#3A463F', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#C1C9C4', fontSize: 9, fontWeight: '900' },
  footerHint: { flex: 1, color: '#718078', fontSize: 8, lineHeight: 12 },
});
