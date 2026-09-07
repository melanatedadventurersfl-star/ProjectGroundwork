import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createPost,
  getGroups,
  removeCommunityPostMedia,
  uploadCommunityPostImage,
  type CommunityGroup,
  type CommunityPostType,
} from '../../src/community/api';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const SURFACE = '#17211C';
const BORDER = '#2A3930';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const GREEN = '#12372E';

type PickedPhoto = {
  uri: string;
  base64: string;
  mimeType?: string | null;
};

type PostMode = Extract<CommunityPostType, 'update' | 'ask'>;

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

export default function CreateInCommunityScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [mode, setMode] = useState<PostMode>('update');
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinedGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const selectedGroup = useMemo(
    () => joinedGroups.find((group) => group.id === selectedGroupId) ?? null,
    [joinedGroups, selectedGroupId],
  );

  useEffect(() => {
    let active = true;

    void getGroups()
      .then((nextGroups) => {
        if (!active) return;
        const joined = nextGroups.filter((group) => group.is_member);
        setGroups(nextGroups);

        const requested = params.groupId
          ? joined.find((group) => group.id === params.groupId)
          : null;

        if (requested) setSelectedGroupId(requested.id);
        else if (joined.length === 1) setSelectedGroupId(joined[0].id);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load your Communities.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [params.groupId]);

  async function choosePhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to attach a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.88,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError('That photo could not be prepared. Choose it again.');
      return;
    }

    setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType });
  }

  const cannotSubmit = submitting || !selectedGroup || (!body.trim() && !photo);

  async function submit() {
    if (cannotSubmit || !selectedGroup) return;

    const stillJoined = joinedGroups.some((group) => group.id === selectedGroup.id && group.is_member);
    if (!stillJoined) {
      setError('You need to be a member of this Community before posting.');
      return;
    }

    setSubmitting(true);
    setError(null);
    let uploadedPath: string | null = null;

    try {
      if (photo) uploadedPath = await uploadCommunityPostImage(photo);

      await createPost({
        body,
        postType: mode,
        audience: 'group',
        circleId: null,
        groupId: selectedGroup.id,
        adventureId: selectedGroup.adventure_id ?? null,
        imagePath: uploadedPath,
        metadata: photo ? { media_type: 'image' } : {},
      });

      router.back();
    } catch (caught) {
      if (uploadedPath) await removeCommunityPostMedia(uploadedPath).catch(() => undefined);
      setError(caught instanceof Error ? caught.message : 'Unable to publish this post.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={23} color={TEXT} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>OUTPOST</Text>
          <Text style={styles.title}>Post to a Community</Text>
        </View>
        <Pressable disabled={cannotSubmit} onPress={() => void submit()} style={[styles.postButton, cannotSubmit && styles.postButtonDisabled]}>
          {submitting ? <ActivityIndicator size="small" color={GREEN} /> : <Text style={styles.postButtonText}>Post</Text>}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
      ) : joinedGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Ionicons name="people-outline" size={31} color={GOLD} /></View>
          <Text style={styles.emptyTitle}>Join a Community first</Text>
          <Text style={styles.emptyBody}>Member posts from this button stay inside Communities you already belong to.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Browse Communities</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View>
            <Text style={styles.sectionLabel}>POST TO</Text>
            <Text style={styles.sectionHelper}>Choose one of your joined Communities.</Text>
          </View>

          <View style={styles.groupList}>
            {joinedGroups.map((group) => {
              const selected = group.id === selectedGroupId;
              const image = group.image_url || group.cover_image_url;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={group.id}
                  onPress={() => { setSelectedGroupId(group.id); setError(null); }}
                  style={[styles.groupRow, selected && styles.groupRowSelected]}
                >
                  <View style={styles.groupAvatar}>
                    {image ? <Image source={{ uri: image }} style={styles.groupAvatarImage} /> : <Text style={styles.groupInitials}>{initials(group.name)}</Text>}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                    <Text style={styles.groupMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <Ionicons name="checkmark" size={14} color={GREEN} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.modeRow}>
            <Pressable onPress={() => setMode('update')} style={[styles.modeChip, mode === 'update' && styles.modeChipSelected]}>
              <Ionicons name="create-outline" size={17} color={mode === 'update' ? GREEN : TEXT} />
              <Text style={[styles.modeText, mode === 'update' && styles.modeTextSelected]}>Update</Text>
            </Pressable>
            <Pressable onPress={() => setMode('ask')} style={[styles.modeChip, mode === 'ask' && styles.modeChipSelected]}>
              <Ionicons name="help-circle-outline" size={17} color={mode === 'ask' ? GREEN : TEXT} />
              <Text style={[styles.modeText, mode === 'ask' && styles.modeTextSelected]}>Ask</Text>
            </Pressable>
          </View>

          <View style={styles.composerCard}>
            {selectedGroup ? <Text style={styles.composerDestination}>Posting to {selectedGroup.name}</Text> : <Text style={styles.composerDestinationMuted}>Choose a Community above</Text>}
            {photo ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} style={styles.removePhoto}>
                  <Ionicons name="close" size={19} color={TEXT} />
                </Pressable>
              </View>
            ) : null}
            <TextInput
              value={body}
              onChangeText={setBody}
              maxLength={4000}
              multiline
              placeholder={mode === 'ask' ? 'What do you want to ask this Community?' : 'Share something with this Community…'}
              placeholderTextColor="#738078"
              style={styles.input}
            />
            <View style={styles.composerFooter}>
              <Pressable onPress={() => void choosePhoto()} style={styles.photoButton}>
                <Ionicons name="image-outline" size={20} color={GOLD} />
                <Text style={styles.photoButtonText}>{photo ? 'Change photo' : 'Add photo'}</Text>
              </Pressable>
              <Text style={styles.counter}>{body.length}/4000</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE },
  eyebrow: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: TEXT, fontSize: 19, fontWeight: '900', marginTop: 2 },
  postButton: { minWidth: 64, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD, paddingHorizontal: 14 },
  postButtonDisabled: { opacity: 0.4 },
  postButtonText: { color: GREEN, fontSize: 14, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 44, gap: 16 },
  sectionLabel: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  sectionHelper: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 4 },
  groupList: { gap: 8 },
  groupRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  groupRowSelected: { borderColor: GOLD, backgroundColor: '#20291F' },
  groupAvatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B372F' },
  groupAvatarImage: { width: '100%', height: '100%' },
  groupInitials: { color: GOLD, fontSize: 12, fontWeight: '900' },
  groupName: { color: TEXT, fontSize: 14, fontWeight: '900' },
  groupMeta: { color: MUTED, fontSize: 11, marginTop: 3 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#65736A', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: GOLD, backgroundColor: GOLD },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  modeChipSelected: { backgroundColor: GOLD, borderColor: GOLD },
  modeText: { color: TEXT, fontSize: 13, fontWeight: '800' },
  modeTextSelected: { color: GREEN },
  composerCard: { borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 14 },
  composerDestination: { color: GOLD, fontSize: 12, fontWeight: '900', marginBottom: 10 },
  composerDestinationMuted: { color: MUTED, fontSize: 12, fontWeight: '800', marginBottom: 10 },
  input: { minHeight: 138, color: TEXT, fontSize: 16, lineHeight: 23, textAlignVertical: 'top', padding: 0 },
  composerFooter: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  photoButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 20, backgroundColor: '#253128' },
  photoButtonText: { color: TEXT, fontSize: 12, fontWeight: '800' },
  counter: { color: MUTED, fontSize: 11 },
  photoWrap: { position: 'relative', overflow: 'hidden', borderRadius: 14, marginBottom: 12 },
  photoPreview: { width: '100%', height: 220, backgroundColor: '#253128' },
  removePhoto: { position: 'absolute', right: 8, top: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,19,0.84)' },
  error: { color: '#FFB4A9', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE, marginBottom: 16 },
  emptyTitle: { color: TEXT, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: MUTED, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, maxWidth: 340 },
  primaryButton: { marginTop: 20, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD, paddingHorizontal: 18 },
  primaryButtonText: { color: GREEN, fontSize: 14, fontWeight: '900' },
});
