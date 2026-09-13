import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createPost,
  getGroups,
  removeCommunityPostMedia,
  uploadCommunityPostImage,
  type CommunityGroup,
  type CommunityPostType,
} from '../../src/community/api';
import { setCommunityPostInterests } from '../../src/community/communityInterests';
import { DEFAULT_OUTDOOR_INTERESTS, isPeopleCommunity } from '../../src/community/communityModel';

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
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GM';
}

export default function CreateInCommunityScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [mode, setMode] = useState<PostMode>('update');
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinedGroups = useMemo(() => groups.filter((group) => group.is_member && isPeopleCommunity(group)), [groups]);
  const selectedGroup = useMemo(
    () => joinedGroups.find((group) => group.id === selectedGroupId) ?? null,
    [joinedGroups, selectedGroupId],
  );
  const filteredGroups = useMemo(() => {
    const needle = groupSearch.trim().toLowerCase();
    if (!needle) return joinedGroups;
    return joinedGroups.filter((group) => `${group.name} ${group.city ?? ''} ${group.state ?? ''}`.toLowerCase().includes(needle));
  }, [joinedGroups, groupSearch]);

  useEffect(() => {
    let active = true;

    void getGroups()
      .then((nextGroups) => {
        if (!active) return;
        const joined = nextGroups.filter((group) => group.is_member && isPeopleCommunity(group));
        setGroups(nextGroups);

        const requested = params.groupId ? joined.find((group) => group.id === params.groupId) : null;
        if (requested) setSelectedGroupId(requested.id);
        else if (joined.length === 1 && joined[0]) setSelectedGroupId(joined[0].id);
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

  function toggleInterest(label: string) {
    setInterestTags((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label]);
  }

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

      const postId = await createPost({
        body,
        postType: mode,
        audience: 'group',
        circleId: null,
        groupId: selectedGroup.id,
        adventureId: selectedGroup.adventure_id ?? null,
        imagePath: uploadedPath,
        metadata: { ...(photo ? { media_type: 'image' } : {}), interest_labels: interestTags },
      });
      if (interestTags.length) await setCommunityPostInterests(postId, interestTags);

      router.back();
    } catch (caught) {
      if (uploadedPath) await removeCommunityPostMedia(uploadedPath).catch(() => undefined);
      setError(caught instanceof Error ? caught.message : 'Unable to publish this post.');
    } finally {
      setSubmitting(false);
    }
  }

  function chooseGroup(group: CommunityGroup) {
    setSelectedGroupId(group.id);
    setSelectorOpen(false);
    setGroupSearch('');
    setError(null);
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
          <Text style={styles.emptyBody}>Community posts go to groups with members and an ongoing purpose. Activity topics such as camping and hiking are interests instead.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/communities' as never)}>
            <Text style={styles.primaryButtonText}>Find Communities</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View>
            <Text style={styles.sectionLabel}>COMMUNITY</Text>
            <Text style={styles.sectionHelper}>Who do you want to share this with?</Text>
          </View>

          <Pressable style={styles.selector} onPress={() => setSelectorOpen(true)}>
            {selectedGroup ? (
              <>
                <View style={styles.groupAvatar}>
                  {selectedGroup.image_url || selectedGroup.cover_image_url ? <Image source={{ uri: selectedGroup.image_url || selectedGroup.cover_image_url || '' }} style={styles.groupAvatarImage} /> : <Text style={styles.groupInitials}>{initials(selectedGroup.name)}</Text>}
                </View>
                <View style={styles.flex}><Text style={styles.selectorName} numberOfLines={1}>{selectedGroup.name}</Text><Text style={styles.selectorMeta}>{selectedGroup.member_count} member{selectedGroup.member_count === 1 ? '' : 's'}</Text></View>
              </>
            ) : <Text style={styles.selectorPlaceholder}>Choose a community</Text>}
            <Ionicons name="chevron-down" size={18} color={GOLD} />
          </Pressable>

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

          <View>
            <Text style={styles.sectionLabel}>TOPICS</Text>
            <Text style={styles.sectionHelper}>Optional. Choose everything this post is about.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 9, paddingRight: 12 }}>
              {DEFAULT_OUTDOOR_INTERESTS.map((label) => {
                const selected = interestTags.includes(label);
                return <Pressable key={label} onPress={() => toggleInterest(label)} style={[styles.modeChip, selected && styles.modeChipSelected]}><Text style={[styles.modeText, selected && styles.modeTextSelected]}>{label}</Text></Pressable>;
              })}
            </ScrollView>
          </View>

          <View style={styles.composerCard}>
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

      <Modal visible={selectorOpen} transparent animationType="slide" onRequestClose={() => setSelectorOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectorOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>POST TO</Text><Text style={styles.sheetTitle}>Choose a community</Text></View><Pressable onPress={() => setSelectorOpen(false)} style={styles.sheetClose}><Ionicons name="close" size={20} color={TEXT} /></Pressable></View>
            {joinedGroups.length > 6 ? <View style={styles.searchWrap}><Ionicons name="search" size={17} color={MUTED} /><TextInput value={groupSearch} onChangeText={setGroupSearch} placeholder="Search your communities" placeholderTextColor="#728078" style={styles.searchInput} /></View> : null}
            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              {filteredGroups.map((group) => {
                const image = group.image_url || group.cover_image_url;
                const selected = group.id === selectedGroupId;
                return <Pressable key={group.id} style={[styles.sheetRow, selected && styles.sheetRowSelected]} onPress={() => chooseGroup(group)}>
                  <View style={styles.groupAvatar}>{image ? <Image source={{ uri: image }} style={styles.groupAvatarImage} /> : <Text style={styles.groupInitials}>{initials(group.name)}</Text>}</View>
                  <View style={styles.flex}><Text style={styles.groupName}>{group.name}</Text><Text style={styles.groupMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text></View>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={GOLD} /> : null}
                </Pressable>;
              })}
              {!filteredGroups.length ? <Text style={styles.noResults}>No communities match that search.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  selector: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  selectorPlaceholder: { flex: 1, color: MUTED, fontSize: 14, fontWeight: '800' },
  selectorName: { color: TEXT, fontSize: 14, fontWeight: '900' },
  selectorMeta: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  groupAvatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B372F' },
  groupAvatarImage: { width: '100%', height: '100%' },
  groupInitials: { color: GOLD, fontSize: 12, fontWeight: '900' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  modeChipSelected: { backgroundColor: GOLD, borderColor: GOLD },
  modeText: { color: TEXT, fontSize: 13, fontWeight: '800' },
  modeTextSelected: { color: GREEN },
  composerCard: { borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 14 },
  input: { minHeight: 160, color: TEXT, fontSize: 16, lineHeight: 23, textAlignVertical: 'top', padding: 0 },
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
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)' },
  sheet: { maxHeight: '72%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#111A15', borderWidth: 1, borderColor: BORDER, paddingHorizontal: 16, paddingTop: 9, paddingBottom: 26 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#4A574F', marginBottom: 13 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 13 },
  sheetEyebrow: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  sheetTitle: { color: TEXT, fontSize: 21, fontWeight: '900', marginTop: 2 },
  sheetClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, color: TEXT, fontSize: 13.5, paddingVertical: 0 },
  sheetList: { maxHeight: 430 },
  sheetRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 14, marginBottom: 7, backgroundColor: SURFACE },
  sheetRowSelected: { borderWidth: 1, borderColor: GOLD, backgroundColor: '#20291F' },
  groupName: { color: TEXT, fontSize: 14, fontWeight: '900' },
  groupMeta: { color: MUTED, fontSize: 10.5, marginTop: 3 },
  noResults: { color: MUTED, fontSize: 13, paddingVertical: 20, textAlign: 'center' },
});
