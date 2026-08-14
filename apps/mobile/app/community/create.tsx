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

const commonTypes: PostType[] = ['update', 'photo', 'ask', 'meetup'];
const moreTypes: PostType[] = ['buddy', 'recommendation'];

function placeholderFor(type: PostType) {
  if (type === 'photo') return 'Tell your community about this moment…';
  if (type === 'ask') return 'What do you want to ask the community?';
  if (type === 'buddy') return 'What do you want to do, where, and when?';
  if (type === 'recommendation') return 'What place are you recommending and why?';
  return 'What’s happening outside?';
}

export default function CreateCommunityPostScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = postTypes.some((item) => item.value === params.type) ? params.type as PostType : 'update';
  const [type, setType] = useState<PostType>(initialType);
  const [audience, setAudience] = useState<Audience>('everyone');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(moreTypes.includes(initialType));
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
  const selectedCircle = useMemo(() => circles.find((circle) => circle.id === circleId) ?? null, [circles, circleId]);

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

  function selectType(next: PostType) {
    setType(next);
    setMoreOpen(moreTypes.includes(next) || moreOpen);
    setError(null);
  }

  const needsTarget = (audience === 'circle' && !circleId) || (audience === 'group' && !groupId);
  const needsPhoto = type === 'photo' && !photo;
  const needsBody = type !== 'photo' && type !== 'meetup' && !body.trim();
  const cannotSubmit = submitting || needsTarget || needsPhoto || needsBody;

  async function submit() {
    if (type === 'meetup') {
      router.replace({ pathname: '/local-events/create', params: { audience, circleId: circleId ?? undefined, groupId: groupId ?? undefined } });
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

  const audienceName = audience === 'circle' && selectedCircle ? selectedCircle.name : audience === 'group' && selectedGroup ? selectedGroup.name : selectedAudience.label;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}><Ionicons name="close" size={23} color={TEXT} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>COMMUNITY</Text>
            <Text style={styles.title}>Create Post</Text>
          </View>
          <Pressable disabled={cannotSubmit} style={[styles.postButton, cannotSubmit && styles.disabled]} onPress={() => void submit()}>
            {submitting ? <ActivityIndicator color="#101510" size="small" /> : <Text style={styles.postButtonText}>{type === 'meetup' ? 'Continue' : 'Post'}</Text>}
          </Pressable>
        </View>

        <Pressable style={styles.audiencePill} onPress={() => setAudienceOpen((value) => !value)}>
          <Ionicons name={selectedAudience.icon as never} size={17} color={GOLD} />
          <Text style={styles.audiencePillLabel}>Share with</Text>
          <Text style={styles.audiencePillValue} numberOfLines={1}>{audienceName}</Text>
          <Ionicons name={audienceOpen ? 'chevron-up' : 'chevron-down'} size={17} color={MUTED} />
        </Pressable>

        {audienceOpen ? (
          <View style={styles.audienceMenu}>
            {audiences.map((item) => (
              <Pressable key={item.value} onPress={() => changeAudience(item.value)} style={[styles.audienceOption, audience === item.value && styles.audienceOptionActive]}>
                <View style={styles.audienceOptionIcon}><Ionicons name={item.icon as never} size={18} color={audience === item.value ? GOLD : MUTED} /></View>
                <View style={styles.flex}><Text style={styles.optionTitle}>{item.label}</Text><Text style={styles.optionHelper}>{item.helper}</Text></View>
                {audience === item.value ? <Ionicons name="checkmark-circle" size={20} color={GOLD} /> : null}
              </Pressable>
            ))}

            {loadingTargets && (audience === 'circle' || audience === 'group') ? <ActivityIndicator color={GOLD} size="small" /> : null}
            {audience === 'circle' && !loadingTargets ? (
              <View style={styles.targetArea}>
                <Text style={styles.targetLabel}>Choose a Circle</Text>
                {circles.map((circle) => (
                  <Pressable key={circle.id} onPress={() => setCircleId(circle.id)} style={[styles.targetChip, circleId === circle.id && styles.targetChipActive]}>
                    <Text style={[styles.targetChipText, circleId === circle.id && styles.targetChipTextActive]}>{circle.name}</Text>
                  </Pressable>
                ))}
                {!circles.length ? <Text style={styles.emptyTarget}>Create a Circle first from Circles & Connections.</Text> : null}
              </View>
            ) : null}
            {audience === 'group' && !loadingTargets ? (
              <View style={styles.targetArea}>
                <Text style={styles.targetLabel}>Choose a Group</Text>
                {memberGroups.map((group) => (
                  <Pressable key={group.id} onPress={() => setGroupId(group.id)} style={[styles.targetChip, groupId === group.id && styles.targetChipActive]}>
                    <Text style={[styles.targetChipText, groupId === group.id && styles.targetChipTextActive]}>{group.name}</Text>
                  </Pressable>
                ))}
                {!memberGroups.length ? <Text style={styles.emptyTarget}>Join a Group first, then you can post directly to it.</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.typeSection}>
          <Text style={styles.sectionTitle}>What do you want to share?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {commonTypes.map((value) => {
              const item = postTypes.find((entry) => entry.value === value)!;
              return (
                <Pressable key={value} onPress={() => selectType(value)} style={[styles.typeChip, type === value && styles.typeChipActive]}>
                  <Ionicons name={item.icon as never} size={17} color={type === value ? '#101510' : '#D6DDD8'} />
                  <Text style={[styles.typeChipText, type === value && styles.typeChipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setMoreOpen((value) => !value)} style={[styles.typeChip, moreTypes.includes(type) && styles.typeChipActive]}>
              <Ionicons name="ellipsis-horizontal" size={17} color={moreTypes.includes(type) ? '#101510' : '#D6DDD8'} />
              <Text style={[styles.typeChipText, moreTypes.includes(type) && styles.typeChipTextActive]}>More</Text>
            </Pressable>
          </ScrollView>
          {moreOpen ? (
            <View style={styles.moreRow}>
              {moreTypes.map((value) => {
                const item = postTypes.find((entry) => entry.value === value)!;
                return (
                  <Pressable key={value} onPress={() => selectType(value)} style={[styles.moreOption, type === value && styles.moreOptionActive]}>
                    <Ionicons name={item.icon as never} size={20} color={type === value ? GOLD : '#C5CEC8'} />
                    <View style={styles.flex}><Text style={[styles.moreTitle, type === value && styles.moreTitleActive]}>{item.label}</Text><Text style={styles.moreHelper}>{item.helper}</Text></View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.composerCard}>
          <View style={styles.composerTop}>
            <View style={styles.activeType}><Ionicons name={selected.icon as never} size={16} color={GOLD} /><Text style={styles.activeTypeText}>{selected.label}</Text></View>
            {type !== 'meetup' ? <Text style={styles.counter}>{body.length}/4000</Text> : null}
          </View>

          {type === 'meetup' ? (
            <View style={styles.meetupPrompt}>
              <Ionicons name="calendar-outline" size={30} color={GOLD} />
              <Text style={styles.meetupTitle}>Plan a meetup</Text>
              <Text style={styles.guidance}>Continue to add the date, location, capacity, and meetup details.</Text>
              <Pressable style={styles.continueButton} onPress={() => void submit()}><Text style={styles.continueButtonText}>Continue to Meetup</Text></Pressable>
            </View>
          ) : (
            <>
              {type === 'photo' || photo ? (
                photo ? (
                  <View style={styles.photoWrap}>
                    <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                    <View style={styles.photoActions}>
                      <Pressable onPress={() => void choosePhoto()}><Text style={styles.photoAction}>Change</Text></Pressable>
                      <Pressable onPress={() => setPhoto(null)}><Text style={styles.removePhoto}>Remove</Text></Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={styles.addPhoto} onPress={() => void choosePhoto()}>
                    <Ionicons name="images-outline" size={28} color={GOLD} />
                    <Text style={styles.addPhotoTitle}>Add photos</Text>
                    <Text style={styles.addPhotoHelper}>Choose a photo from your library</Text>
                  </Pressable>
                )
              ) : null}

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

              {type !== 'photo' && !photo ? (
                <Pressable style={styles.attachPhoto} onPress={() => void choosePhoto()}>
                  <Ionicons name="image-outline" size={18} color={GOLD} />
                  <Text style={styles.attachPhotoText}>Add photo</Text>
                </Pressable>
              ) : null}
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
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: '#AA9461', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: TEXT, fontSize: 28, fontWeight: '900', marginTop: 1 },
  postButton: { minWidth: 70, minHeight: 40, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  postButtonText: { color: '#101510', fontWeight: '900' },
  disabled: { opacity: 0.42 },
  audiencePill: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#18231D', borderWidth: 1, borderColor: '#344139', borderRadius: 99, paddingHorizontal: 12 },
  audiencePillLabel: { color: MUTED, fontSize: 12, fontWeight: '700' },
  audiencePillValue: { color: TEXT, fontSize: 12.5, fontWeight: '900', maxWidth: 180 },
  audienceMenu: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 15, padding: 8, gap: 4 },
  audienceOption: { minHeight: 52, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8 },
  audienceOptionActive: { backgroundColor: '#1D2A23' },
  audienceOptionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#202D26', alignItems: 'center', justifyContent: 'center' },
  optionTitle: { color: TEXT, fontWeight: '800', fontSize: 13.5 },
  optionHelper: { color: MUTED, fontSize: 10.5, marginTop: 1 },
  targetArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#344139' },
  targetLabel: { width: '100%', color: '#B6A06B', fontWeight: '900', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8 },
  targetChip: { borderWidth: 1, borderColor: '#3B493F', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  targetChipActive: { borderColor: GOLD, backgroundColor: '#2A2B22' },
  targetChipText: { color: '#CFD7D2', fontSize: 11.5, fontWeight: '700' },
  targetChipTextActive: { color: GOLD },
  emptyTarget: { width: '100%', color: MUTED, fontSize: 11.5, lineHeight: 17 },
  typeSection: { gap: 8, marginTop: 2 },
  sectionTitle: { color: TEXT, fontSize: 17, fontWeight: '900' },
  typeRow: { gap: 7, paddingRight: 18 },
  typeChip: { minHeight: 38, borderWidth: 1, borderColor: '#344139', borderRadius: 99, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARD },
  typeChipActive: { backgroundColor: GOLD, borderColor: GOLD },
  typeChipText: { color: '#D6DDD8', fontWeight: '800', fontSize: 12 },
  typeChipTextActive: { color: '#101510' },
  moreRow: { gap: 7 },
  moreOption: { minHeight: 58, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  moreOptionActive: { borderColor: '#8A764A', backgroundColor: '#1B2721' },
  moreTitle: { color: TEXT, fontWeight: '900', fontSize: 13.5 },
  moreTitleActive: { color: GOLD },
  moreHelper: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  composerCard: { minHeight: 220, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 14, gap: 11 },
  composerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeType: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeTypeText: { color: '#E4D3A2', fontWeight: '900', fontSize: 12 },
  counter: { color: '#738078', fontSize: 10.5 },
  input: { minHeight: 120, color: TEXT, fontSize: 17, lineHeight: 24, textAlignVertical: 'top' },
  addPhoto: { minHeight: 130, borderWidth: 1, borderStyle: 'dashed', borderColor: '#5B654E', borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 5 },
  addPhotoTitle: { color: '#E5D6AB', fontSize: 15, fontWeight: '900' },
  addPhotoHelper: { color: MUTED, fontSize: 11.5 },
  attachPhoto: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, backgroundColor: '#1D2A23', paddingHorizontal: 10, paddingVertical: 7 },
  attachPhotoText: { color: '#E1D2A8', fontWeight: '800', fontSize: 11.5 },
  photoWrap: { gap: 7 },
  photoPreview: { width: '100%', height: 235, borderRadius: 13, backgroundColor: '#0C1411' },
  photoActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  photoAction: { color: GOLD, fontWeight: '800' },
  removePhoto: { color: '#FFB4A9', fontWeight: '800' },
  meetupPrompt: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  meetupTitle: { color: TEXT, fontSize: 19, fontWeight: '900' },
  guidance: { color: MUTED, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  continueButton: { marginTop: 6, backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  continueButtonText: { color: '#101510', fontWeight: '900' },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 11, borderRadius: 12, lineHeight: 18 },
});
