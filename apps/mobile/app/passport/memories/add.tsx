import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addMemoryPhoto,
  getJourney,
  removeUploadedMemoryImage,
  uploadMemoryImage,
  type JourneyItem,
  type MemoryVisibility,
} from '../../../src/passport/api';
import {
  createAdventureMemory,
  getAdventureEventPeople,
  type AdventureEventPerson,
} from '../../../src/passport/EventHubApi';
import { AppIcon } from '../../../src/ui/AppIcon';

type ComposerMode = 'memory' | 'event';

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

function displayName(person: AdventureEventPerson) {
  return person.display_name?.trim() || person.username?.trim() || 'Adventurer';
}

export default function AddMemoryScreen() {
  const params = useLocalSearchParams<{
    adventureId?: string;
    imageUrl?: string;
    sourcePhotoId?: string;
    mode?: ComposerMode;
  }>();
  const mode: ComposerMode = params.mode === 'event' ? 'event' : 'memory';
  const isEventUpload = mode === 'event';
  const fromEventGallery = !isEventUpload && Boolean(params.imageUrl);

  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [adventureId, setAdventureId] = useState(params.adventureId ?? '');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<MemoryVisibility>(isEventUpload ? 'public' : 'private');
  const [people, setPeople] = useState<AdventureEventPerson[]>([]);
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getJourney().then(setJourney).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load completed adventures.'));
  }, []);

  useEffect(() => {
    if (!adventureId || isEventUpload) {
      setPeople([]);
      setTaggedIds(new Set());
      return;
    }
    void getAdventureEventPeople(adventureId)
      .then((rows) => setPeople(rows.filter((person) => person.relationship_state === 'connected')))
      .catch(() => setPeople([]));
  }, [adventureId, isEventUpload]);

  const selectedAdventure = useMemo(
    () => journey.find((item) => item.adventure_id === adventureId) ?? null,
    [adventureId, journey],
  );

  async function choosePhotos() {
    try {
      setPicking(true);
      setError(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library access is needed to add pictures.');
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
        setError('Camera access is needed to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.85 });
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

  function toggleTag(profileId: string) {
    setTaggedIds((current) => {
      const next = new Set(current);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  async function save() {
    if (!adventureId) {
      setError('Choose a completed adventure first.');
      return;
    }
    if (isEventUpload && !selectedImages.length) {
      setError('Choose at least one photo to post to this event.');
      return;
    }
    if (!isEventUpload && !fromEventGallery && !selectedImages.length && !title.trim() && !body.trim() && rating === null) {
      setError('Add a note, rating, or photo to save this memory.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (fromEventGallery && params.imageUrl) {
        const memory = await createAdventureMemory({
          adventureId,
          title,
          body,
          rating,
          visibility: visibility === 'public' ? 'public' : 'private',
          taggedProfileIds: Array.from(taggedIds),
          allowEmpty: true,
        });
        await addMemoryPhoto({
          adventureId,
          memoryId: memory.id,
          imageUrl: params.imageUrl,
          caption: title,
          visibility: visibility === 'public' ? 'public' : 'private',
          sourceKind: 'event_gallery',
          sourcePhotoId: params.sourcePhotoId,
        });
        router.back();
        return;
      }

      if (isEventUpload) {
        for (const image of selectedImages) {
          let storagePath: string | null = null;
          try {
            storagePath = await uploadMemoryImage({
              adventureId,
              base64: image.base64,
              mimeType: image.mimeType,
              fileName: image.fileName,
            });
            await addMemoryPhoto({
              adventureId,
              imageUrl: storagePath,
              caption: title,
              reflection: body,
              visibility: visibility === 'public' ? 'public' : 'private',
              sourceKind: 'event_upload',
            });
          } catch (caught) {
            if (storagePath) await removeUploadedMemoryImage(storagePath);
            throw caught;
          }
        }
        router.back();
        return;
      }

      const memory = await createAdventureMemory({
        adventureId,
        title,
        body,
        rating,
        visibility: visibility === 'public' ? 'public' : 'private',
        taggedProfileIds: Array.from(taggedIds),
        allowEmpty: selectedImages.length > 0,
      });

      for (const image of selectedImages) {
        let storagePath: string | null = null;
        try {
          storagePath = await uploadMemoryImage({
            adventureId,
            base64: image.base64,
            mimeType: image.mimeType,
            fileName: image.fileName,
          });
          await addMemoryPhoto({
            adventureId,
            memoryId: memory.id,
            imageUrl: storagePath,
            caption: title,
            visibility: visibility === 'public' ? 'public' : 'private',
            sourceKind: 'personal',
          });
        } catch (caught) {
          if (storagePath) await removeUploadedMemoryImage(storagePath);
          throw caught;
        }
      }

      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to ${isEventUpload ? 'post photos' : 'save memory'}.`);
    } finally {
      setSaving(false);
    }
  }

  const publicSelected = visibility === 'public';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <AppIcon name="chevron-forward" color="#F5C341" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.back}>{isEventUpload ? 'Event' : 'Memories'}</Text>
        </Pressable>

        <Text style={styles.eyebrow}>{isEventUpload ? 'EVENT GALLERY' : 'YOUR ADVENTURE JOURNAL'}</Text>
        <Text style={styles.title}>{isEventUpload ? 'Add Event Photo' : 'Add Memory'}</Text>
        <Text style={styles.subtitle}>
          {isEventUpload
            ? 'Share photos from this adventure. Public photos join the event gallery after moderation; private photos stay with you.'
            : 'Save one moment at a time. Add a reflection, photos, a rating, and tag people you were connected with on this adventure.'}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Adventure</Text>
        {params.adventureId && selectedAdventure ? (
          <View style={[styles.adventureCard, styles.adventureCardActive]}>
            <Text style={styles.adventureTitleActive}>{selectedAdventure.title}</Text>
            <Text style={styles.adventureMeta}>{selectedAdventure.city}, {selectedAdventure.state}</Text>
          </View>
        ) : (
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
        )}

        {!isEventUpload ? (
          <>
            <Text style={styles.label}>Memory</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              placeholder="Give this moment a name"
              placeholderTextColor="#748078"
              style={styles.input}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
              placeholder="What do you want to remember?"
              placeholderTextColor="#748078"
              style={[styles.input, styles.bodyInput]}
            />

            <Text style={styles.smallLabel}>RATING (OPTIONAL)</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} onPress={() => setRating(rating === value ? null : value)} hitSlop={7}>
                  <Text style={[styles.star, rating !== null && value <= rating && styles.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Caption (optional)</Text>
            <TextInput value={title} onChangeText={setTitle} maxLength={240} placeholder="What is happening here?" placeholderTextColor="#748078" style={styles.input} />
          </>
        )}

        <Text style={styles.label}>{isEventUpload ? 'Photos' : 'Photos (optional)'}</Text>
        {fromEventGallery && params.imageUrl ? (
          <Image source={{ uri: params.imageUrl }} style={styles.galleryPreview} />
        ) : (
          <>
            <View style={styles.photoActions}>
              <Pressable style={styles.photoAction} disabled={picking || saving} onPress={() => void choosePhotos()}>
                <AppIcon name="photos" color="#67CFC8" size={22} />
                <Text style={styles.photoActionTitle}>{picking ? 'Opening…' : 'Choose Photos'}</Text>
                <Text style={styles.photoActionMeta}>Up to 10</Text>
              </Pressable>
              <Pressable style={styles.photoAction} disabled={picking || saving} onPress={() => void takePhoto()}>
                <AppIcon name="photo" color="#67CFC8" size={22} />
                <Text style={styles.photoActionTitle}>Take Photo</Text>
                <Text style={styles.photoActionMeta}>Use camera</Text>
              </Pressable>
            </View>
            {selectedImages.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                {selectedImages.map((image) => (
                  <View key={image.id} style={styles.previewTile}>
                    <Image source={{ uri: image.uri }} style={styles.previewImage} />
                    <Pressable style={styles.removePhoto} onPress={() => setSelectedImages((current) => current.filter((item) => item.id !== image.id))}>
                      <Text style={styles.removePhotoText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </>
        )}

        {!isEventUpload ? (
          <>
            <Text style={styles.label}>Tag people</Text>
            <Text style={styles.helper}>Only people you are already connected with from this adventure can be tagged.</Text>
            {people.length ? (
              <View style={styles.peopleStack}>
                {people.map((person) => {
                  const active = taggedIds.has(person.profile_id);
                  return (
                    <Pressable key={person.profile_id} style={[styles.personRow, active && styles.personRowActive]} onPress={() => toggleTag(person.profile_id)}>
                      {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{displayName(person).slice(0, 1).toUpperCase()}</Text></View>}
                      <View style={styles.personCopy}>
                        <Text style={styles.personName}>{displayName(person)}</Text>
                        {person.username ? <Text style={styles.personHandle}>@{person.username}</Text> : null}
                      </View>
                      <View style={[styles.checkCircle, active && styles.checkCircleActive]}>{active ? <Text style={styles.check}>✓</Text> : null}</View>
                    </Pressable>
                  );
                })}
              </View>
            ) : <Text style={styles.emptyText}>No connected attendees available to tag yet.</Text>}
          </>
        ) : null}

        <Text style={styles.label}>Visibility</Text>
        <View style={styles.visibilityStack}>
          <Pressable style={[styles.visibilityCard, !publicSelected && styles.visibilityCardActive]} onPress={() => setVisibility('private')}>
            <AppIcon name="privacy" color={!publicSelected ? '#F5C341' : '#8D9992'} size={20} />
            <View style={styles.visibilityCopy}>
              <Text style={[styles.visibilityTitle, !publicSelected && styles.visibilityTitleActive]}>Private</Text>
              <Text style={styles.visibilityBody}>{isEventUpload ? 'Only you can see this event photo.' : 'Only you can see this memory.'}</Text>
            </View>
          </Pressable>
          <Pressable style={[styles.visibilityCard, publicSelected && styles.visibilityCardActive]} onPress={() => setVisibility('public')}>
            <AppIcon name="community" color={publicSelected ? '#F5C341' : '#8D9992'} size={20} />
            <View style={styles.visibilityCopy}>
              <Text style={[styles.visibilityTitle, publicSelected && styles.visibilityTitleActive]}>Public</Text>
              <Text style={styles.visibilityBody}>{isEventUpload ? 'Automatically appears in the event gallery after approval.' : 'Automatically appears under Community Moments.'}</Text>
            </View>
          </Pressable>
        </View>

        <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.pressed]}>
          {saving ? <ActivityIndicator color="#17211C" size="small" /> : null}
          <Text style={styles.saveButtonText}>{saving ? 'SAVING…' : isEventUpload ? 'POST PHOTO' : 'SAVE MEMORY'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111814' },
  content: { padding: 18, paddingBottom: 52, gap: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, marginBottom: 4 },
  back: { color: '#F5C341', fontWeight: '800', fontSize: 16 },
  eyebrow: { color: '#67CFC8', fontSize: 12, fontWeight: '900', letterSpacing: 1.1, marginTop: 4 },
  title: { color: '#F5F2E8', fontSize: 30, lineHeight: 34, fontWeight: '900' },
  subtitle: { color: '#AAB5AF', fontSize: 15, lineHeight: 21, marginBottom: 6 },
  error: { color: '#FFB4A9', backgroundColor: '#341D19', borderRadius: 10, padding: 12, lineHeight: 18 },
  label: { color: '#E9E6DC', fontSize: 14, fontWeight: '900', marginTop: 12 },
  smallLabel: { color: '#93A29A', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  adventureStack: { gap: 8 },
  adventureCard: { borderWidth: 1, borderColor: '#354139', borderRadius: 12, padding: 13, backgroundColor: '#18211C' },
  adventureCardActive: { borderColor: '#D7B45A', backgroundColor: '#22271E' },
  adventureTitle: { color: '#D5DCD8', fontWeight: '800', fontSize: 15 },
  adventureTitleActive: { color: '#F5F2E8', fontWeight: '900', fontSize: 15 },
  adventureMeta: { color: '#89968F', marginTop: 4, fontSize: 12 },
  input: { color: '#F5F2E8', borderWidth: 1, borderColor: '#354139', backgroundColor: '#18211C', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15 },
  bodyInput: { minHeight: 118, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', gap: 10 },
  star: { color: '#59645E', fontSize: 30 },
  starActive: { color: '#F5C341' },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoAction: { flex: 1, minHeight: 92, borderWidth: 1, borderColor: '#354139', borderRadius: 13, backgroundColor: '#18211C', padding: 12, justifyContent: 'center', gap: 4 },
  photoActionTitle: { color: '#F5F2E8', fontWeight: '850', fontSize: 14 },
  photoActionMeta: { color: '#85928B', fontSize: 12 },
  previewRow: { gap: 9, paddingVertical: 3 },
  previewTile: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: '#202A24' },
  previewImage: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', right: 5, top: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(10,14,12,0.82)', alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: '#FFF', fontSize: 19, lineHeight: 21 },
  galleryPreview: { width: '100%', aspectRatio: 1.45, borderRadius: 14, backgroundColor: '#202A24' },
  helper: { color: '#87958D', fontSize: 12, lineHeight: 17, marginTop: -4 },
  peopleStack: { gap: 8 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderColor: '#354139', borderRadius: 13, backgroundColor: '#18211C' },
  personRowActive: { borderColor: '#D7B45A' },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2D3A32', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#F5C341', fontWeight: '900' },
  personCopy: { flex: 1 },
  personName: { color: '#F2F0E8', fontWeight: '850', fontSize: 14 },
  personHandle: { color: '#85928B', fontSize: 12, marginTop: 2 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#58645D', alignItems: 'center', justifyContent: 'center' },
  checkCircleActive: { borderColor: '#76C982', backgroundColor: '#76C982' },
  check: { color: '#152019', fontWeight: '900' },
  emptyText: { color: '#829087', fontSize: 13, lineHeight: 18 },
  visibilityStack: { gap: 9 },
  visibilityCard: { flexDirection: 'row', gap: 11, padding: 13, borderWidth: 1, borderColor: '#354139', borderRadius: 13, backgroundColor: '#18211C', alignItems: 'center' },
  visibilityCardActive: { borderColor: '#D7B45A' },
  visibilityCopy: { flex: 1 },
  visibilityTitle: { color: '#BEC7C2', fontWeight: '850', fontSize: 14 },
  visibilityTitleActive: { color: '#F5C341' },
  visibilityBody: { color: '#829087', fontSize: 12, lineHeight: 17, marginTop: 2 },
  saveButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#F5C341', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 },
  saveButtonText: { color: '#17211C', fontWeight: '950', letterSpacing: 0.7 },
  pressed: { opacity: 0.78 },
});
