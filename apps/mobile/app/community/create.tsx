import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  COMMUNITY_VIDEO_MAX_BYTES,
  COMMUNITY_VIDEO_MAX_DURATION_MS,
  createPost,
  getGroups,
  removeCommunityPostMedia,
  uploadCommunityPostImage,
  uploadCommunityPostVideo,
  type CommunityAudience,
  type CommunityGroup,
  type CommunityPostType,
} from '../../src/community/api';
import { getCircles, type CommunityCircle } from '../../src/community/circles';

type PostType = CommunityPostType;
type Audience = CommunityAudience;
type PickedPhoto = { uri: string; base64: string; mimeType?: string | null };
type PickedVideo = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;
};

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
  { value: 'recommendation', label: 'Place', helper: 'Share a trail, park, campsite, or hidden gem.', icon: 'location-outline' },
];

const audiences: Array<{ value: Audience; label: string; helper: string; icon: string }> = [
  { value: 'everyone', label: 'Everyone', helper: 'Visible across Community.', icon: 'globe-outline' },
  { value: 'connections', label: 'My Connections', helper: 'Only people you have connected with.', icon: 'people-outline' },
  { value: 'circle', label: 'A Circle', helper: 'Share with one of your private Circles.', icon: 'people-circle-outline' },
  { value: 'group', label: 'A Group', helper: 'Post inside one of your communities.', icon: 'albums-outline' },
];

function placeholderFor(type: PostType, hasVideo: boolean) {
  if (hasVideo) return 'Say something about this video…';
  if (type === 'photo') return 'Say something about this moment…';
  if (type === 'ask') return 'What do you want to ask the community?';
  if (type === 'buddy') return 'What do you want to do, where, and when?';
  if (type === 'recommendation') return 'What place are you recommending and why?';
  if (type === 'meetup') return 'What are you planning?';
  return 'What’s happening outside?';
}

function formatDuration(duration?: number | null) {
  if (duration == null) return null;
  const totalSeconds = Math.max(0, Math.round(duration / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(fileSize?: number | null) {
  if (fileSize == null) return null;
  const megabytes = fileSize / (1024 * 1024);
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

export default function CreateCommunityPostScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = postTypes.some((item) => item.value === params.type) ? params.type as PostType : 'update';
  const [type, setType] = useState<PostType>(initialType);
  const [audience, setAudience] = useState<Audience>('everyone');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(initialType === 'buddy');
  const [circleId, setCircleId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [circles, setCircles] = useState<CommunityCircle[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.88 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError('That photo could not be prepared safely. Please choose it again.');
      return;
    }
    setVideo(null);
    setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType });
    setType('photo');
  }

  async function chooseVideo() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to share a video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.duration != null && asset.duration > COMMUNITY_VIDEO_MAX_DURATION_MS) {
      setError('Videos can be up to 60 seconds long.');
      return;
    }
    if (asset.fileSize != null && asset.fileSize > COMMUNITY_VIDEO_MAX_BYTES) {
      setError('Videos can be up to 100 MB.');
      return;
    }
    setPhoto(null);
    setVideo({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      duration: asset.duration,
    });
    if (type === 'photo') setType('update');
  }

  function changeAudience(next: Audience) {
    setAudience(next);
    setCircleId(null);
    setGroupId(null);
    setError(null);
  }

  function selectType(next: PostType) {
    if (type === next && next !== 'photo') {
      setType('update');
      setMoreOpen(false);
    } else {
      setType(next);
      if (next === 'buddy') setMoreOpen(true);
      if (next === 'photo' && video) setVideo(null);
    }
    setError(null);
  }

  const needsTarget = (audience === 'circle' && !circleId) || (audience === 'group' && !groupId);
  const needsPhoto = type === 'photo' && !photo;
  const needsBody = type !== 'photo' && type !== 'meetup' && !body.trim() && !video;
  const cannotSubmit = submitting || needsTarget || needsPhoto || needsBody;

  async function submit() {
    if (type === 'meetup') {
      if (needsTarget) return;
      router.replace({ pathname: '/local-events/create', params: { audience, circleId: circleId ?? undefined, groupId: groupId ?? undefined } });
      return;
    }
    if (cannotSubmit) return;

    setSubmitting(true);
    setError(null);
    let uploadedPath: string | null = null;
    try {
      if (photo) uploadedPath = await uploadCommunityPostImage(photo);
      if (video) uploadedPath = await uploadCommunityPostVideo(video);
      await createPost({
        body,
        postType: type,
        audience,
        circleId,
        groupId,
        adventureId: selectedGroup?.adventure_id ?? null,
        imagePath: uploadedPath,
        metadata: video ? {
          media_type: 'video',
          media_mime_type: video.mimeType ?? null,
          media_file_name: video.fileName ?? null,
          media_file_size: video.fileSize ?? null,
          media_duration_ms: video.duration ?? null,
        } : photo ? { media_type: 'image' } : {},
      });
      router.back();
    } catch (caught) {
      if (uploadedPath) await removeCommunityPostMedia(uploadedPath).catch(() => undefined);
      setError(caught instanceof Error ? caught.message : 'Unable to publish this post.');
    } finally {
      setSubmitting(false);
    }
  }

  const audienceName = audience === 'circle' && selectedCircle
    ? selectedCircle.name
    : audience === 'group' && selectedGroup
      ? selectedGroup.name
      : selectedAudience.label;

  const videoDuration = formatDuration(video?.duration);
  const videoSize = formatFileSize(video?.fileSize);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={23} color={TEXT} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>COMMUNITY</Text>
            <Text style={styles.title}>Create Post</Text>
          </View>
          <Pressable disabled={cannotSubmit} style={[styles.postButton, cannotSubmit && styles.disabled]} onPress={() => void submit()}>
            {submitting
              ? <ActivityIndicator color="#101510" size="small" />
              : <Text style={styles.postButtonText}>{type === 'meetup' ? 'Continue' : 'Post'}</Text>}
          </Pressable>
        </View>

        <View style={styles.composerCard}>
          {photo ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              <View style={styles.photoActions}>
                <Pressable onPress={() => void choosePhoto()}><Text style={styles.photoAction}>Change</Text></Pressable>
                <Pressable onPress={() => { setPhoto(null); if (type === 'photo') setType('update'); }}><Text style={styles.removePhoto}>Remove</Text></Pressable>
              </View>
            </View>
          ) : null}

          {video ? (
            <View style={styles.videoPreview}>
              <View style={styles.videoIcon}><Ionicons name="play" size={24} color="#101510" /></View>
              <View style={styles.flex}>
                <Text style={styles.videoTitle} numberOfLines={1}>{video.fileName || 'Selected video'}</Text>
                <Text style={styles.videoMeta}>{[videoDuration, videoSize].filter(Boolean).join(' · ') || 'Ready to upload'}</Text>
                <Text style={styles.videoLimit}>Up to 60 seconds · 100 MB</Text>
              </View>
              <Pressable onPress={() => setVideo(null)} accessibilityLabel="Remove video"><Ionicons name="close-circle" size={23} color="#FFB4A9" /></Pressable>
            </View>
          ) : null}

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={placeholderFor(type, Boolean(video))}
            placeholderTextColor="#738078"
            multiline
            maxLength={4000}
            autoFocus={type !== 'photo' && !video}
            style={styles.input}
          />
          <Text style={styles.counter}>{body.length}/4000</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
          <Pressable
            onPress={() => photo ? selectType('photo') : void choosePhoto()}
            style={[styles.actionChip, type === 'photo' && styles.actionChipActive]}
          >
            <Ionicons name="image-outline" size={18} color={type === 'photo' ? '#101510' : '#D6DDD8'} />
            <Text style={[styles.actionText, type === 'photo' && styles.actionTextActive]}>Photo</Text>
          </Pressable>

          <Pressable onPress={() => void chooseVideo()} style={[styles.actionChip, video && styles.actionChipActive]}>
            <Ionicons name="videocam-outline" size={18} color={video ? '#101510' : '#D6DDD8'} />
            <Text style={[styles.actionText, video && styles.actionTextActive]}>Video</Text>
          </Pressable>

          <Pressable onPress={() => selectType('recommendation')} style={[styles.actionChip, type === 'recommendation' && styles.actionChipActive]}>
            <Ionicons name="location-outline" size={18} color={type === 'recommendation' ? '#101510' : '#D6DDD8'} />
            <Text style={[styles.actionText, type === 'recommendation' && styles.actionTextActive]}>Place</Text>
          </Pressable>

          <Pressable onPress={() => selectType('meetup')} style={[styles.actionChip, type === 'meetup' && styles.actionChipActive]}>
            <Ionicons name="calendar-outline" size={18} color={type === 'meetup' ? '#101510' : '#D6DDD8'} />
            <Text style={[styles.actionText, type === 'meetup' && styles.actionTextActive]}>Meetup</Text>
          </Pressable>

          <Pressable onPress={() => selectType('ask')} style={[styles.actionChip, type === 'ask' && styles.actionChipActive]}>
            <Ionicons name="help-circle-outline" size={18} color={type === 'ask' ? '#101510' : '#D6DDD8'} />
            <Text style={[styles.actionText, type === 'ask' && styles.actionTextActive]}>Ask</Text>
          </Pressable>

          <Pressable onPress={() => setMoreOpen((value) => !value)} style={[styles.actionChip, type === 'buddy' && styles.actionChipActive]}>
            <Ionicons name="ellipsis-horizontal" size={18} color={type === 'buddy' ? '#101510' : '#D6DDD8'} />
            <Text style={[styles.actionText, type === 'buddy' && styles.actionTextActive]}>More</Text>
          </Pressable>
        </ScrollView>

        {moreOpen ? (
          <Pressable onPress={() => selectType('buddy')} style={[styles.moreOption, type === 'buddy' && styles.moreOptionActive]}>
            <View style={styles.moreIcon}>
              <Ionicons name="people-outline" size={20} color={type === 'buddy' ? GOLD : '#C5CEC8'} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.moreTitle, type === 'buddy' && styles.moreTitleActive]}>Adventure Buddy</Text>
              <Text style={styles.moreHelper}>Find people for a hike, paddle, camp, or trip.</Text>
            </View>
            {type === 'buddy' ? <Ionicons name="checkmark-circle" size={20} color={GOLD} /> : null}
          </Pressable>
        ) : null}

        {type === 'meetup' ? (
          <View style={styles.meetupNote}>
            <Ionicons name="calendar-outline" size={18} color={GOLD} />
            <Text style={styles.meetupNoteText}>Continue to add the date, location, capacity, and meetup details.</Text>
          </View>
        ) : null}

        <View style={styles.shareSection}>
          <Text style={styles.shareLabel}>WHO CAN SEE THIS?</Text>
          <Pressable style={styles.audiencePill} onPress={() => setAudienceOpen((value) => !value)}>
            <View style={styles.audienceIcon}>
              <Ionicons name={selectedAudience.icon as never} size={18} color={GOLD} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.audiencePillLabel}>Share with</Text>
              <Text style={styles.audiencePillValue} numberOfLines={1}>{audienceName}</Text>
            </View>
            <Ionicons name={audienceOpen ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
          </Pressable>
        </View>

        {audienceOpen ? (
          <View style={styles.audienceMenu}>
            {audiences.map((item) => (
              <Pressable key={item.value} onPress={() => changeAudience(item.value)} style={[styles.audienceOption, audience === item.value && styles.audienceOptionActive]}>
                <View style={styles.audienceOptionIcon}>
                  <Ionicons name={item.icon as never} size={18} color={audience === item.value ? GOLD : MUTED} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.optionTitle}>{item.label}</Text>
                  <Text style={styles.optionHelper}>{item.helper}</Text>
                </View>
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

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { padding: 18, paddingBottom: 52, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 4 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: '#AA9461', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: TEXT, fontSize: 28, fontWeight: '900', marginTop: 1 },
  postButton: { minWidth: 70, minHeight: 40, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  postButtonText: { color: '#101510', fontWeight: '900' },
  disabled: { opacity: 0.42 },

  composerCard: { minHeight: 250, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 15, gap: 10 },
  input: { flex: 1, minHeight: 170, color: TEXT, fontSize: 19, lineHeight: 27, textAlignVertical: 'top', padding: 0 },
  counter: { color: '#66736B', fontSize: 10.5, textAlign: 'right' },
  photoWrap: { gap: 7 },
  photoPreview: { width: '100%', height: 235, borderRadius: 13, backgroundColor: '#0C1411' },
  photoActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  photoAction: { color: GOLD, fontWeight: '800' },
  removePhoto: { color: '#FFB4A9', fontWeight: '800' },
  videoPreview: { minHeight: 82, borderWidth: 1, borderColor: '#4B4935', backgroundColor: '#20261F', borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  videoIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  videoTitle: { color: TEXT, fontWeight: '900', fontSize: 13.5 },
  videoMeta: { color: '#D0D7D2', fontSize: 11.5, marginTop: 3 },
  videoLimit: { color: '#8F9A93', fontSize: 10, marginTop: 3 },

  actionRow: { gap: 7, paddingRight: 18 },
  actionChip: { minHeight: 40, borderWidth: 1, borderColor: '#344139', borderRadius: 99, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARD },
  actionChipActive: { backgroundColor: GOLD, borderColor: GOLD },
  actionText: { color: '#D6DDD8', fontWeight: '800', fontSize: 12 },
  actionTextActive: { color: '#101510' },

  moreOption: { minHeight: 62, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  moreOptionActive: { borderColor: '#8A764A', backgroundColor: '#1B2721' },
  moreIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#202D26', alignItems: 'center', justifyContent: 'center' },
  moreTitle: { color: TEXT, fontWeight: '900', fontSize: 13.5 },
  moreTitleActive: { color: GOLD },
  moreHelper: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  meetupNote: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, backgroundColor: '#17231D', paddingHorizontal: 12, paddingVertical: 10 },
  meetupNoteText: { flex: 1, color: MUTED, fontSize: 11.5, lineHeight: 17 },

  shareSection: { marginTop: 4, gap: 7 },
  shareLabel: { color: '#83775A', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  audiencePill: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#18231D', borderWidth: 1, borderColor: '#344139', borderRadius: 14, paddingHorizontal: 11 },
  audienceIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#202D26', alignItems: 'center', justifyContent: 'center' },
  audiencePillLabel: { color: MUTED, fontSize: 10.5, fontWeight: '700' },
  audiencePillValue: { color: TEXT, fontSize: 13.5, fontWeight: '900', marginTop: 1 },
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
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 11, borderRadius: 12, lineHeight: 18 },
});