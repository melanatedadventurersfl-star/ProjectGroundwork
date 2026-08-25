import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { uploadMemoryPhoto } from '../../../../src/passport/api';

type SelectedPhoto = {
  uri: string;
  mimeType?: string | null;
};

type Visibility = 'private' | 'group';

function uploadErrorMessage(caught: unknown) {
  if (caught instanceof Error && caught.message.trim()) return caught.message;
  if (caught && typeof caught === 'object' && 'message' in caught) {
    const message = (caught as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Please try again.';
}

export default function AddAdventurePhotoScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [uploading, setUploading] = useState(false);

  async function chooseFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose an adventure memory.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
      exif: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, mimeType: asset.mimeType });
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to take an adventure photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
      exif: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, mimeType: asset.mimeType });
    }
  }

  function addPhotoMenu() {
    Alert.alert('Add a photo', 'Choose where your memory should come from.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Photo Library', onPress: () => void chooseFromLibrary() },
      { text: 'Take Photo', onPress: () => void takePhoto() },
    ]);
  }

  async function upload() {
    if (!adventureId || !photo) return;
    setUploading(true);

    try {
      await uploadMemoryPhoto({
        adventureId,
        localUri: photo.uri,
        mimeType: photo.mimeType,
        caption,
        visibility,
      });

      Alert.alert(
        'Memory saved',
        visibility === 'group'
          ? 'Your photo was saved and submitted for the Event Gallery. It will appear there after moderation.'
          : 'Your photo was saved privately to this adventure.',
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (caught) {
      Alert.alert('Unable to save memory', uploadErrorMessage(caught));
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>ADD PHOTOS</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>ADVENTURE GALLERY</Text>
          <Text style={styles.title}>Add another moment.</Text>
          <Text style={styles.body}>Choose a photo, add a caption if you want, and decide whether it stays private or is submitted to the Event Gallery.</Text>
        </View>

        {photo ? (
          <View style={styles.previewCard}>
            <Image source={{ uri: photo.uri }} style={styles.preview} />
            <View style={styles.previewActions}>
              <Text style={styles.previewReady}>Photo ready</Text>
              <Pressable onPress={addPhotoMenu} hitSlop={8}>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addPhotoButton} onPress={addPhotoMenu}>
            <View style={styles.addPhotoIcon}><Text style={styles.addPhotoIconText}>＋</Text></View>
            <View style={styles.addPhotoCopy}>
              <Text style={styles.addPhotoTitle}>Choose Photo</Text>
              <Text style={styles.addPhotoBody}>Photo library or camera</Text>
            </View>
            <Text style={styles.addPhotoChevron}>›</Text>
          </Pressable>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Caption <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            maxLength={240}
            placeholder="What was happening in this moment?"
            placeholderTextColor="#738078"
            style={styles.input}
            multiline
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Visibility</Text>
          <View style={styles.visibilityToggle}>
            <Pressable
              style={[styles.visibilityOption, visibility === 'private' && styles.visibilitySelected]}
              onPress={() => setVisibility('private')}
            >
              <Text style={[styles.visibilityTitle, visibility === 'private' && styles.visibilityTitleSelected]}>Only me</Text>
              <Text style={[styles.visibilityHint, visibility === 'private' && styles.visibilityHintSelected]}>Private memory</Text>
            </Pressable>
            <Pressable
              style={[styles.visibilityOption, visibility === 'group' && styles.visibilitySelected]}
              onPress={() => setVisibility('group')}
            >
              <Text style={[styles.visibilityTitle, visibility === 'group' && styles.visibilityTitleSelected]}>Event Gallery</Text>
              <Text style={[styles.visibilityHint, visibility === 'group' && styles.visibilityHintSelected]}>After moderation</Text>
            </Pressable>
          </View>
          <Text style={styles.visibilityNote}>{visibility === 'private' ? 'Only you can see this memory.' : 'Attendees can see it in the adventure gallery after approval.'}</Text>
        </View>

        <Pressable
          style={[styles.uploadButton, (!photo || uploading) && styles.disabled]}
          disabled={!photo || uploading}
          onPress={() => void upload()}
        >
          <Text style={styles.uploadText}>{uploading ? 'Saving…' : 'Save Photo'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 18, paddingBottom: 48, gap: 18 },
  topBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, color: '#FFF8E8', fontSize: 38, lineHeight: 40, fontWeight: '300' },
  topTitle: { color: '#D7B45A', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  spacer: { width: 42 },
  intro: { gap: 6 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  body: { color: '#96A199', lineHeight: 19, fontSize: 13 },
  addPhotoButton: { minHeight: 82, borderWidth: 1, borderColor: '#35463C', backgroundColor: '#151F1A', borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  addPhotoIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7B45A' },
  addPhotoIconText: { color: '#17211C', fontSize: 27, lineHeight: 30, fontWeight: '700' },
  addPhotoCopy: { flex: 1 },
  addPhotoTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 16 },
  addPhotoBody: { color: '#89968E', fontSize: 12, marginTop: 3 },
  addPhotoChevron: { color: '#D7B45A', fontSize: 30, lineHeight: 32 },
  previewCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#2D3B33' },
  preview: { width: '100%', aspectRatio: 1.35, backgroundColor: '#1D2822' },
  previewActions: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewReady: { color: '#AAB6AF', fontSize: 12, fontWeight: '700' },
  changeText: { color: '#D7B45A', fontWeight: '900' },
  fieldGroup: { gap: 9 },
  label: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  optional: { color: '#7F8A83', fontWeight: '600' },
  input: { minHeight: 86, backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#2D3B33', borderRadius: 14, color: '#FFF8E8', padding: 14, textAlignVertical: 'top', fontSize: 15 },
  visibilityToggle: { flexDirection: 'row', gap: 8 },
  visibilityOption: { flex: 1, minHeight: 62, borderWidth: 1, borderColor: '#35463C', backgroundColor: '#151F1A', borderRadius: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  visibilitySelected: { borderColor: '#D7B45A', backgroundColor: '#253127' },
  visibilityTitle: { color: '#D8DFDB', fontWeight: '900', fontSize: 13 },
  visibilityTitleSelected: { color: '#F5C341' },
  visibilityHint: { color: '#748078', fontSize: 10.5, marginTop: 2 },
  visibilityHintSelected: { color: '#B8C1BB' },
  visibilityNote: { color: '#829087', fontSize: 11.5, lineHeight: 16 },
  uploadButton: { backgroundColor: '#D7B45A', borderRadius: 15, padding: 16, alignItems: 'center' },
  uploadText: { color: '#17211C', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.45 },
});
