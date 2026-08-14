import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addMemoryPhoto,
  getJourney,
  uploadMemoryImage,
  type JourneyItem,
  type MemoryVisibility,
} from '../../../src/passport/api';

const visibilityOptions: { value: MemoryVisibility; label: string }[] = [
  { value: 'private', label: 'Only me' },
  { value: 'group', label: 'MA Members' },
  { value: 'public', label: 'Public' },
];

type SelectedImage = {
  id: string;
  uri: string;
  base64: string;
  mimeType: string | null;
  fileName: string | null;
};

function toSelectedImage(asset: ImagePicker.ImagePickerAsset): SelectedImage | null {
  if (!asset.base64) return null;
  return {
    id: `${asset.assetId ?? asset.fileName ?? asset.uri}-${Math.random().toString(36).slice(2, 8)}`,
    uri: asset.uri,
    base64: asset.base64,
    mimeType: asset.mimeType ?? null,
    fileName: asset.fileName ?? null,
  };
}

export default function AddMemoryScreen() {
  const params = useLocalSearchParams<{ adventureId?: string; imageUrl?: string; sourcePhotoId?: string }>();
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [adventureId, setAdventureId] = useState(params.adventureId ?? '');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [caption, setCaption] = useState('');
  const [reflection, setReflection] = useState('');
  const [visibility, setVisibility] = useState<MemoryVisibility>('private');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getJourney().then(setJourney).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load completed adventures.'));
  }, []);

  const selected = useMemo(() => journey.find((item) => item.adventure_id === adventureId) ?? null, [adventureId, journey]);
  const fromEventGallery = Boolean(params.imageUrl);

  async function choosePhotos() {
    try {
      setPicking(true);
      setError(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library access is needed to add pictures to your Memories.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        base64: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const next = result.assets.map(toSelectedImage).filter((item): item is SelectedImage => Boolean(item));
      if (!next.length) {
        setError('Those photos could not be prepared for upload. Try selecting them again.');
        return;
      }
      setSelectedImages((current) => [...current, ...next].slice(0, 10));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open your photo library.');
    } finally {
      setPicking(false);
    }
  }

  async function takePhoto() {
    try {
      setPicking(true);
      setError(null);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera access is needed to take a photo for your Memories.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const image = result.assets[0] ? toSelectedImage(result.assets[0]) : null;
      if (!image) {
        setError('That photo could not be prepared for upload. Try taking it again.');
        return;
      }
      setSelectedImages((current) => [...current, image].slice(0, 10));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open the camera.');
    } finally {
      setPicking(false);
    }
  }

  function removeSelectedImage(id: string) {
    setSelectedImages((current) => current.filter((item) => item.id !== id));
  }

  async function save() {
    if (!adventureId) {
      setError('Choose a completed adventure first.');
      return;
    }
    if (!fromEventGallery && !selectedImages.length) {
      setError('Choose at least one photo to save this memory.');
      return;
    }
    try {
      setSaving(true);
      setError(null);

      if (fromEventGallery && params.imageUrl) {
        const memory = await addMemoryPhoto({
          adventureId,
          imageUrl: params.imageUrl,
          caption,
          reflection,
          visibility,
          sourceKind: 'event_gallery',
          sourcePhotoId: params.sourcePhotoId,
        });
        router.replace(`/passport/memories/photo/${memory.id}`);
        return;
      }

      const createdIds: string[] = [];
      for (const image of selectedImages) {
        const storagePath = await uploadMemoryImage({
          adventureId,
          base64: image.base64,
          mimeType: image.mimeType,
          fileName: image.fileName,
        });
        const memory = await addMemoryPhoto({
          adventureId,
          imageUrl: storagePath,
          caption,
          reflection,
          visibility,
          sourceKind: 'personal',
        });
        createdIds.push(memory.id);
      }

      if (createdIds.length === 1) {
        router.replace(`/passport/memories/photo/${createdIds[0]}`);
      } else {
        router.replace(`/passport/memories/${adventureId}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save memory.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Memories</Text></Pressable>
        <Text style={styles.eyebrow}>{fromEventGallery ? 'SAVE FROM EVENT GALLERY' : 'ADD TO YOUR PASSPORT'}</Text>
        <Text style={styles.title}>Add Memory</Text>
        <Text style={styles.subtitle}>Choose a completed adventure, add your photos, then decide whether the moment stays private or becomes part of your shared Passport.</Text>

        <Text style={styles.label}>1. Choose a completed adventure</Text>
        <View style={styles.adventureStack}>
          {journey.map((item) => {
            const active = item.adventure_id === adventureId;
            return (
              <Pressable key={item.adventure_id} style={[styles.adventureCard, active && styles.adventureCardActive]} onPress={() => setAdventureId(item.adventure_id)}>
                <Text style={[styles.adventureTitle, active && styles.adventureTitleActive]}>{item.title}</Text>
                <Text style={styles.adventureMeta}>{new Date(item.experienced_at || item.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {item.city}, {item.state}</Text>
              </Pressable>
            );
          })}
        </View>

        {!journey.length ? <Text style={styles.emptyText}>Completed official adventures will appear here automatically.</Text> : null}

        <Text style={styles.label}>2. Add photos</Text>
        {fromEventGallery && params.imageUrl ? (
          <View style={styles.lockedSource}>
            <Image source={{ uri: params.imageUrl }} style={styles.galleryPreview} />
            <View style={styles.lockedCopy}>
              <Text style={styles.lockedTitle}>Event photo selected</Text>
              <Text style={styles.lockedBody}>This saves it to your Memories. Removing it later will not delete the original event photo.</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.photoActions}>
              <Pressable style={styles.photoAction} disabled={picking || saving} onPress={() => void choosePhotos()}>
                <Text style={styles.photoActionTitle}>{picking ? 'Opening…' : 'Choose Photos'}</Text>
                <Text style={styles.photoActionMeta}>Up to 10 from your library</Text>
              </Pressable>
              <Pressable style={styles.photoAction} disabled={picking || saving} onPress={() => void takePhoto()}>
                <Text style={styles.photoActionTitle}>Take Photo</Text>
                <Text style={styles.photoActionMeta}>Use your camera</Text>
              </Pressable>
            </View>

            {selectedImages.length ? (
              <View style={styles.previewGrid}>
                {selectedImages.map((image) => (
                  <View key={image.id} style={styles.previewTile}>
                    <Image source={{ uri: image.uri }} style={styles.previewImage} />
                    <Pressable style={styles.removePhoto} onPress={() => removeSelectedImage(image.id)}>
                      <Text style={styles.removePhotoText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.helper}>Photos are uploaded privately to your MA Passport storage. They are not added to the event gallery automatically.</Text>
            )}
            {selectedImages.length ? <Text style={styles.helper}>{selectedImages.length} photo{selectedImages.length === 1 ? '' : 's'} selected.</Text> : null}
          </>
        )}

        <Text style={styles.label}>3. Add context (optional)</Text>
        <TextInput value={caption} onChangeText={setCaption} maxLength={240} placeholder="Caption" placeholderTextColor="#748078" style={styles.input} />
        <TextInput value={reflection} onChangeText={setReflection} multiline maxLength={2000} placeholder="What do you want to remember about this moment?" placeholderTextColor="#748078" style={[styles.input, styles.reflectionInput]} />
        {selectedImages.length > 1 ? <Text style={styles.helper}>This caption and reflection will be added to each selected photo. You can edit each memory afterward.</Text> : null}

        <Text style={styles.label}>4. Privacy</Text>
        <View style={styles.visibilityStack}>
          {visibilityOptions.map((option) => {
            const active = visibility === option.value;
            return (
              <Pressable key={option.value} style={[styles.visibility, active && styles.visibilityActive]} onPress={() => setVisibility(option.value)}>
                <Text style={[styles.visibilityText, active && styles.visibilityTextActive]}>{option.label}</Text>
                {option.value === 'private' ? <Text style={styles.defaultBadge}>DEFAULT</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {selected ? <Text style={styles.selectedNote}>Saving to: {selected.title}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.primary, (saving || picking) && styles.disabled]} disabled={saving || picking} onPress={() => void save()}>
          <Text style={styles.primaryText}>{saving ? `Saving ${selectedImages.length > 1 ? 'Memories' : 'Memory'}…` : `Save ${selectedImages.length > 1 ? `${selectedImages.length} Memories` : 'Memory'}`}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 6 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 39, fontWeight: '900' },
  subtitle: { color: '#98A49C', lineHeight: 20 },
  label: { color: '#FFF8E8', fontWeight: '900', marginTop: 7 },
  adventureStack: { gap: 8 },
  adventureCard: { borderWidth: 1, borderColor: '#3B4B41', borderRadius: 14, padding: 13, backgroundColor: '#151F1A' },
  adventureCardActive: { borderColor: '#D7B45A', backgroundColor: '#1B2922' },
  adventureTitle: { color: '#B8C1BB', fontWeight: '900' },
  adventureTitleActive: { color: '#FFF8E8' },
  adventureMeta: { color: '#7F8D84', fontSize: 11, marginTop: 4 },
  photoActions: { flexDirection: 'row', gap: 9 },
  photoAction: { flex: 1, minHeight: 84, borderRadius: 15, borderWidth: 1, borderColor: '#D7B45A', backgroundColor: '#17211C', padding: 13, justifyContent: 'center' },
  photoActionTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  photoActionMeta: { color: '#839087', fontSize: 10, marginTop: 4 },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewTile: { width: '31.5%', aspectRatio: 1, borderRadius: 13, overflow: 'hidden', backgroundColor: '#17211C' },
  previewImage: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', right: 5, top: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(15,23,19,0.86)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFF8E8' },
  removePhotoText: { color: '#FFF8E8', fontSize: 19, fontWeight: '700', lineHeight: 20 },
  galleryPreview: { width: 92, height: 92, borderRadius: 12 },
  lockedSource: { backgroundColor: '#17211C', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#395043', flexDirection: 'row', gap: 12, alignItems: 'center' },
  lockedCopy: { flex: 1 },
  lockedTitle: { color: '#FFF8E8', fontWeight: '900' },
  lockedBody: { color: '#8F9C94', lineHeight: 18, marginTop: 4 },
  input: { backgroundColor: '#17211C', borderRadius: 14, borderWidth: 1, borderColor: '#2B3931', padding: 14, color: '#FFF8E8', fontSize: 15 },
  reflectionInput: { minHeight: 120, textAlignVertical: 'top' },
  helper: { color: '#748078', fontSize: 11, lineHeight: 16 },
  visibilityStack: { gap: 8 },
  visibility: { borderWidth: 1, borderColor: '#46564C', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between' },
  visibilityActive: { borderColor: '#D7B45A', backgroundColor: '#17211C' },
  visibilityText: { color: '#AAB4AD', fontWeight: '800' },
  visibilityTextActive: { color: '#FFF8E8' },
  defaultBadge: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  selectedNote: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
  primary: { backgroundColor: '#D7B45A', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#142019', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#FFB4A9' },
  emptyText: { color: '#8F9C94', lineHeight: 18 },
});
