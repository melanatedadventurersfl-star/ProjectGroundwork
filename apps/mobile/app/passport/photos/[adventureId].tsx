import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { uploadMemoryPhoto } from '../../../src/passport/api';

type SelectedPhoto = {
  uri: string;
  mimeType?: string | null;
};

export default function AddAdventurePhotoScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'group'>('private');
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
        'Photo added to memory',
        visibility === 'group'
          ? 'Your photo was uploaded and sent through moderation. Approved photos can appear in the Event Gallery.'
          : 'Your photo was saved as a private Passport memory.',
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (caught) {
      Alert.alert('Unable to upload photo', caught instanceof Error ? caught.message : 'Please try again.');
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
          <Text style={styles.topTitle}>ADD TO MEMORY</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>PHOTOS FROM THIS ADVENTURE</Text>
          <Text style={styles.title}>Save a moment you want to keep.</Text>
          <Text style={styles.body}>Choose a photo from your library or take one now. Photos stay private unless you explicitly share them with the Event Gallery.</Text>
        </View>

        {photo ? (
          <View style={styles.previewCard}>
            <Image source={{ uri: photo.uri }} style={styles.preview} />
            <Pressable style={styles.changeButton} onPress={() => setPhoto(null)}>
              <Text style={styles.changeText}>Choose a different photo</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.pickerCard}>
            <Pressable style={styles.primaryButton} onPress={() => void chooseFromLibrary()}>
              <Text style={styles.primaryText}>Choose from Photo Library</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void takePhoto()}>
              <Text style={styles.secondaryText}>Take a Photo</Text>
            </Pressable>
          </View>
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
          <Text style={styles.label}>Who can see it?</Text>
          <Pressable
            style={[styles.visibilityCard, visibility === 'private' && styles.visibilitySelected]}
            onPress={() => setVisibility('private')}
          >
            <View style={styles.radio}>{visibility === 'private' ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.visibilityCopy}>
              <Text style={styles.visibilityTitle}>Only Me</Text>
              <Text style={styles.visibilityBody}>Keep this photo as a private part of your Passport memory.</Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.visibilityCard, visibility === 'group' && styles.visibilitySelected]}
            onPress={() => setVisibility('group')}
          >
            <View style={styles.radio}>{visibility === 'group' ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.visibilityCopy}>
              <Text style={styles.visibilityTitle}>Share with Event Gallery</Text>
              <Text style={styles.visibilityBody}>After moderation, attendees can see this photo with the adventure memories.</Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          style={[styles.uploadButton, (!photo || uploading) && styles.disabled]}
          disabled={!photo || uploading}
          onPress={() => void upload()}
        >
          <Text style={styles.uploadText}>{uploading ? 'Saving…' : 'Save Photo to Memory'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 18, paddingBottom: 48, gap: 22 },
  topBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, color: '#FFF8E8', fontSize: 38, lineHeight: 40, fontWeight: '300' },
  topTitle: { color: '#D7B45A', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  spacer: { width: 42 },
  intro: { gap: 7 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 29, lineHeight: 34, fontWeight: '900' },
  body: { color: '#96A199', lineHeight: 20, fontSize: 13 },
  pickerCard: { backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#2D3B33', borderRadius: 20, padding: 16, gap: 10 },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { color: '#17211C', fontWeight: '900', fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderColor: '#56665C', borderRadius: 14, padding: 15, alignItems: 'center' },
  secondaryText: { color: '#FFF8E8', fontWeight: '800', fontSize: 15 },
  previewCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#2D3B33' },
  preview: { width: '100%', aspectRatio: 1.15, backgroundColor: '#1D2822' },
  changeButton: { padding: 13, alignItems: 'center' },
  changeText: { color: '#D7B45A', fontWeight: '800' },
  fieldGroup: { gap: 10 },
  label: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  optional: { color: '#7F8A83', fontWeight: '600' },
  input: { minHeight: 96, backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#2D3B33', borderRadius: 14, color: '#FFF8E8', padding: 14, textAlignVertical: 'top', fontSize: 15 },
  visibilityCard: { borderWidth: 1, borderColor: '#3B4A41', backgroundColor: '#151F1A', borderRadius: 15, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  visibilitySelected: { borderColor: '#D7B45A', backgroundColor: '#18241E' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D7B45A' },
  visibilityCopy: { flex: 1, gap: 3 },
  visibilityTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  visibilityBody: { color: '#8F9B94', fontSize: 12, lineHeight: 17 },
  uploadButton: { backgroundColor: '#D7B45A', borderRadius: 15, padding: 17, alignItems: 'center' },
  uploadText: { color: '#17211C', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.45 },
});
