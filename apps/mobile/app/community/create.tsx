import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createPost,
  getGroups,
  removeCommunityPostImage,
  uploadCommunityPostImage,
  type CommunityAudience,
  type CommunityGroup,
  type CommunityPostType,
} from '../../src/community/api';
import { getCircles, type CommunityCircle } from '../../src/community/circles';

type PostType = CommunityPostType;
type Audience = CommunityAudience;

type PickedPhoto = { uri: string; mimeType?: string | null };

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const BORDER = '#2A3930';
const TEXT = '#FFF8E8';
const MUTED = '#9EAAA2';

const postTypes: Array<{ value: PostType; label: string; helper: string; icon: string }> = [
  { value: 'update', label: 'Update', helper: 'Share a thought, trip note, or outdoor moment.', icon: 'create-outline' },
  { value: 'photo', label: 'Photo', helper: 'Share a photo and add an optional caption.', icon: 'images-outline' },
  { value: 'ask', label: 'Ask', helper: 'Ask the community for advice or recommendations.', icon: 'help-circle-outline' },
  { value: 'meetup', label: 'Meetup', helper: 'Plan something people can join.', icon: 'calendar-outline' },
  { value: 'buddy', label: 'Adventure Buddy', helper: 'Find people for a hike, paddle, camp, or trip.', icon: 'people-outline' },
  { value: 'recommendation', label: 'Recommend a Place', helper: 'Share a trail, park, campsite, or hidden gem.', icon: 'trail-sign-outline' },
];

const audiences: Array<{ value: Audience; label: string; helper: string; icon: string }> = [
  { value: 'everyone', label: 'Everyone', helper: 'Visible across Community.', icon: 'globe-outline' },
  { value: 'connections', label: 'My Connections', helper: 'Only people you have connected with.', icon: 'people-outline' },
  { value: 'circle', label: 'A Circle', helper: 'Share with one of your private Circles.', icon: 'people-circle-outline' },
  { value: 'group', label: 'A Group', helper: 'Post inside one of your communities.', icon: 'albums-outline' },
];

function placeholderFor(type: PostType) {
  if (type === 'photo') return 'Add a caption…';
  if (type === 'ask') return 'What do you want to ask the community?';
  if (type === 'buddy') return 'What are you hoping to do, where, and when?';
  if (type === 'recommendation') return 'What place are you recommending and why?';
  return 'What’s happening outside?';
}

export default function CreateCommunityPostScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = postTypes.some((item) => item.value === params.type) ? params.type as PostType : 'update';
  const [type, setType] = useState<PostType>(initialType);
  const [audience, setAudience] = useState<Audience>('everyone');
  const [circleId, setCircleId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [circles, setCircles] = useState<CommunityCircle[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => postTypes.find((item) => item.value === type)!, [type]);
  const selectedAudience = useMemo(() => audiences.find((item) => item.value === audience)!, [audience]);
  const memberGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const selectedGroup = useMemo(() => memberGroups.find((group) => group.id === groupId) ?? null, [memberGroups, groupId]);

  useEffect(() => {
    void Promise.all([getCircles(), getGroups()])
      .then(([nextCircles, nextGroups]) => {
        setCircles(nextCircles);
        setGroups(nextGroups);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load sharing options.'))
      .finally(() => setLoadingTargets(false));
  }, []);

  async function choosePhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to share a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.88 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, mimeType: asset.mimeType });
  }

  function changeAudience(next: Audience) {
    setAudience(next);
    setCircleId(null);
    setGroupId(null);
    setError(null);
  }

  const needsTarget = (audience === 'circle' && !circleId) || (audience === 'group' && !groupId);
  const needsPhoto = type === 'photo' && !photo;
  const needsBody = type !== 'photo' && type !== 'meetup' && !body.trim();
  const cannotSubmit = submitting || needsTarget || needsPhoto || needsBody;

  async function submit() {
    if (type === 'meetup') {
      router.replace({
        pathname: '/local-events/create',
        params: {
          audience,
          circleId: circleId ?? undefined,
          groupId: groupId ?? undefined,
        },
      });
      return;
    }
    if (cannotSubmit) return;

    setSubmitting(true);
    setError(null);
    let uploadedPath: string | null = null;
    try {
      if (photo) uploadedPath = await uploadCommunityPostImage(photo);
      await createPost({
        body,
        postType: type,
        audience,
        circleId,
        groupId,
        adventureId: selectedGroup?.adventure_id ?? null,
        imagePath: uploadedPath,
      });
      router.back();
    } catch (caught) {
      if (uploadedPath) await removeCommunityPostImage(uploadedPath).catch(() => undefined);
      setError(caught instanceof Error ? caught.message : 'Unable to publish this post.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}><Ionicons name="close" size={23} color={TEXT} /></Pressable>
          <View style={styles.flex}><Text style={styles.eyebrow}>COMMUNITY</Text><Text style={styles.title}>Create Post</Text></View>
          <Pressable disabled={cannotSubmit} style={[styles.postButton, cannotSubmit && styles.disabled]} onPress={() => void submit()}>
            {submitting ? <ActivityIndicator color="#101510" size="small" /> : <Text style={styles.postButtonText}>{type === 'meetup' ? 'Continue' : 'Post'}</Text>}
          </Pressable>
        </View>

        <View style={styles.audienceCard}>
          <Text style={styles.label}>SHARE WITH</Text>
          <View style={styles.audienceRow}>
            <View style={styles.audienceIcon}><Ionicons name={selectedAudience.icon as never} size={19} color={GOLD} /></View>
            <View style={styles.flex}><Text style={styles.audienceTitle}>{selectedAudience.label}</Text><Text style={styles.audienceHelper}>{selectedAudience.helper}</Text></View>
          </View>
          <View style={styles.audienceOptions}>
            {audiences.map((item) => (
              <Pressable key={item.value} onPress={() => changeAudience(item.value)} style={[styles.audienceOption, audience === item.value && styles.audienceOptionActive]}>
                <View style={[styles.radio, audience === item.value && styles.radioActive]}>{audience === item.value ? <View style={styles.radioDot} /> : null}</View>
                <View style={styles.flex}><Text style={styles.optionTitle}>{item.label}</Text><Text style={styles.optionHelper}>{item.helper}</Text></View>
              </Pressable>
            ))}
          </View>

          {loadingTargets ? <ActivityIndicator color={GOLD} size="small" /> : null}
          {audience === 'circle' && !loadingTargets ? (
            <View style={styles.targetArea}>
              <Text style={styles.targetLabel}>CHOOSE A CIRCLE</Text>
              {circles.map((circle) => (
                <Pressable key={circle.id} onPress={() => setCircleId(circle.id)} style={[styles.targetRow, circleId === circle.id && styles.targetRowActive]}>
                  <Ionicons name="people-circle-outline" size={20} color={circleId === circle.id ? GOLD : MUTED} />
                  <View style={styles.flex}><Text style={styles.targetTitle}>{circle.name}</Text><Text style={styles.targetMeta}>{circle.member_count} {circle.member_count === 1 ? 'person' : 'people'}</Text></View>
                  {circleId === circle.id ? <Ionicons name="checkmark-circle" size={21} color={GOLD} /> : null}
                </Pressable>
              ))}
              {!circles.length ? <Text style={styles.emptyTarget}>You don’t have any Circles yet. Create one from Community → Circles & Connections.</Text> : null}
            </View>
          ) : null}

          {audience === 'group' && !loadingTargets ? (
            <View style={styles.targetArea}>
              <Text style={styles.targetLabel}>CHOOSE A GROUP</Text>
              {memberGroups.map((group) => (
                <Pressable key={group.id} onPress={() => setGroupId(group.id)} style={[styles.targetRow, groupId === group.id && styles.targetRowActive]}>
                  <Ionicons name="albums-outline" size={19} color={groupId === group.id ? GOLD : MUTED} />
                  <View style={styles.flex}><Text style={styles.targetTitle}>{group.name}</Text><Text style={styles.targetMeta}>{[group.city, group.state].filter(Boolean).join(', ') || 'Community group'}</Text></View>
                  {groupId === group.id ? <Ionicons name="checkmark-circle" size={21} color={GOLD} /> : null}
                </Pressable>
              ))}
              {!memberGroups.length ? <Text style={styles.emptyTarget}>Join a Group first, then you can post directly to it from here.</Text> : null}
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>What are you posting?</Text>
        <View style={styles.typeGrid}>
          {postTypes.map((item) => (
            <Pressable key={item.value} onPress={() => { setType(item.value); setError(null); }} style={[styles.typeCard, type === item.value && styles.typeCardActive]}>
              <Ionicons name={item.icon as never} size={22} color={type === item.value ? GOLD : '#C5CEC8'} />
              <Text style={[styles.typeLabel, type === item.value && styles.typeLabelActive]}>{item.label}</Text>
              <Text style={styles.typeHelper}>{item.helper}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.composerCard}>
          <View style={styles.composerHeading}><View style={styles.typeBadge}><Ionicons name={selected.icon as never} size={16} color={GOLD} /><Text style={styles.typeBadgeText}>{selected.label}</Text></View><Text style={styles.counter}>{body.length}/4000</Text></View>
          {type === 'meetup' ? <Text style={styles.guidance}>Continue to add the meetup date, location, capacity, and details. Your selected audience will travel with you into the meetup flow.</Text> : (
            <>
              {photo ? (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  <View style={styles.photoActions}>
                    <Pressable onPress={() => void choosePhoto()}><Text style={styles.photoAction}>Change</Text></Pressable>
                    <Pressable onPress={() => setPhoto(null)}><Text style={styles.removePhoto}>Remove</Text></Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={styles.addPhoto} onPress={() => void choosePhoto()}>
                  <Ionicons name="image-outline" size={21} color={GOLD} />
                  <Text style={styles.addPhotoText}>{type === 'photo' ? 'Choose photo' : 'Add a photo'}</Text>
                </Pressable>
              )}
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={placeholderFor(type)}
                placeholderTextColor="#738078"
                multiline
                maxLength={4000}
                autoFocus={type !== 'photo'}
                style={styles.input}
              />
            </>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: '#AA9461', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: TEXT, fontSize: 28, fontWeight: '900', marginTop: 1 },
  postButton: { minWidth: 70, minHeight: 40, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  postButtonText: { color: '#101510', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  audienceCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 13, gap: 10 },
  label: { color: '#BBA56E', fontSize: 10.5, fontWeight: '900', letterSpacing: 1 },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  audienceIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1E2C25', alignItems: 'center', justifyContent: 'center' },
  audienceTitle: { color: TEXT, fontWeight: '900', fontSize: 15 },
  audienceHelper: { color: MUTED, fontSize: 11.5, marginTop: 2 },
  audienceOptions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#38463D' },
  audienceOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#324038' },
  audienceOptionActive: { backgroundColor: '#1A251F' },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: '#6B776F', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: GOLD },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: GOLD },
  optionTitle: { color: TEXT, fontWeight: '800', fontSize: 13.5 },
  optionHelper: { color: MUTED, fontSize: 11, lineHeight: 15, marginTop: 2 },
  targetArea: { gap: 7, paddingTop: 2 },
  targetLabel: { color: '#9F8B5B', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  targetRow: { minHeight: 54, borderWidth: 1, borderColor: '#34433A', borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  targetRowActive: { borderColor: '#8A764A', backgroundColor: '#1B2721' },
  targetTitle: { color: TEXT, fontWeight: '800', fontSize: 13 },
  targetMeta: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  emptyTarget: { color: MUTED, fontSize: 12, lineHeight: 18, paddingVertical: 7 },
  sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  typeCard: { width: '48.5%', minHeight: 112, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 15, padding: 11, gap: 5 },
  typeCardActive: { borderColor: '#8A764A', backgroundColor: '#1B2721' },
  typeLabel: { color: '#E0E6E2', fontWeight: '900', fontSize: 13 },
  typeLabelActive: { color: GOLD },
  typeHelper: { color: '#87948C', fontSize: 10.5, lineHeight: 14 },
  composerCard: { minHeight: 190, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 13, gap: 10 },
  composerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#1D2B24', borderRadius: 99 },
  typeBadgeText: { color: '#E4D3A2', fontWeight: '800', fontSize: 11.5 },
  counter: { color: '#738078', fontSize: 10.5 },
  input: { minHeight: 120, color: TEXT, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  guidance: { color: '#C5CEC8', fontSize: 14, lineHeight: 21, paddingVertical: 22 },
  addPhoto: { minHeight: 52, borderWidth: 1, borderStyle: 'dashed', borderColor: '#5B654E', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addPhotoText: { color: '#E5D6AB', fontWeight: '800' },
  photoWrap: { gap: 7 },
  photoPreview: { width: '100%', height: 220, borderRadius: 13, backgroundColor: '#0C1411' },
  photoActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  photoAction: { color: GOLD, fontWeight: '800' },
  removePhoto: { color: '#FFB4A9', fontWeight: '800' },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 11, borderRadius: 12, lineHeight: 18 },
});
