import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { uploadVerifiedAppImage } from '../src/lib/appMedia';
import { publishAppMedia } from '../src/lib/appMediaManifest';
import { prepareLocalImage } from '../src/lib/imageUpload';

const PATHFINDER_MEDIA_KEY = 'trailhead.pathfinder.clear.afternoon';

export default function AdminMediaScreen() {
  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [status, setStatus] = useState('Choose the Pathfinder background you want to publish.');

  async function chooseAndPublish() {
    if (busy) return;
    setBusy(true);
    setStatus('Opening image library…');

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Photo library access is required to upload an app image.');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        base64: true,
        quality: 0.88,
      });

      if (result.canceled || !result.assets[0]) {
        setStatus('No image selected.');
        return;
      }

      const asset = result.assets[0];
      setPreviewUri(asset.uri);
      setStatus('Preparing image safely…');

      const prepared = await prepareLocalImage({ uri: asset.uri, base64: asset.base64 });
      const bytes = new Uint8Array(prepared.bytes);
      const objectPath = `trailhead/pathfinder-clear-afternoon-${Date.now()}.${prepared.extension}`;

      setStatus(`Uploading and verifying ${prepared.byteLength.toLocaleString()} bytes…`);
      await uploadVerifiedAppImage({ path: objectPath, bytes, contentType: prepared.contentType });

      setStatus('Publishing verified image…');
      const publicUrl = await publishAppMedia({
        mediaKey: PATHFINDER_MEDIA_KEY,
        objectPath,
        contentType: prepared.contentType,
        byteSize: prepared.byteLength,
      });

      setStatus('Published. The Trailhead will pick it up automatically.');
      Alert.alert('Background published', publicUrl ? 'The verified image is now live in app-media.' : 'The image was uploaded, but the public URL could not be resolved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to publish image.';
      setStatus(message);
      Alert.alert('Upload failed', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.eyebrow}>APP MEDIA</Text>
          <Text style={styles.title}>Trailhead Background</Text>
          <Text style={styles.copy}>Uploads are normalized by the picker, validated from their actual bytes, uploaded to Supabase Storage, downloaded again, and must match byte-for-byte before becoming live.</Text>
        </View>

        <View style={styles.preview}>
          {previewUri ? <Image source={{ uri: previewUri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : <Text style={styles.previewText}>Pathfinder background preview</Text>}
        </View>

        <View style={styles.statusCard}>
          {busy ? <ActivityIndicator color="#9BE33D" /> : null}
          <Text style={styles.status}>{status}</Text>
        </View>

        <Pressable disabled={busy} onPress={chooseAndPublish} style={[styles.publishButton, busy && styles.publishButtonDisabled]}>
          <Text style={styles.publishText}>{busy ? 'VERIFYING…' : 'CHOOSE & PUBLISH IMAGE'}</Text>
        </Pressable>

        <Text style={styles.note}>Storage permissions enforce admin access. If a non-admin account opens this screen, the upload is rejected by Supabase.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 48, gap: 18 },
  header: { gap: 6 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 },
  backText: { color: '#D7B45A', fontSize: 16, fontWeight: '800' },
  eyebrow: { color: '#9BE33D', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  copy: { color: '#A9B4AD', fontSize: 14, lineHeight: 20 },
  preview: { height: 210, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#35513F', backgroundColor: '#16211B', alignItems: 'center', justifyContent: 'center' },
  previewText: { color: '#718078', fontSize: 14, fontWeight: '700' },
  statusCard: { minHeight: 72, flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 16, padding: 16, backgroundColor: '#16211B', borderWidth: 1, borderColor: '#26372E' },
  status: { flex: 1, color: '#DDE5E0', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  publishButton: { borderRadius: 16, minHeight: 54, backgroundColor: '#9BE33D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  publishButtonDisabled: { opacity: 0.55 },
  publishText: { color: '#10180F', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  note: { color: '#718078', fontSize: 12, lineHeight: 18 },
});
