import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCommunityFeed, removeCommunityPostMedia, uploadCommunityPostImage, type CommunityPost } from '../../src/community/api';
import { PostEngagementBar } from '../../src/community/PostEngagementBar';
import {
  COMMUNITY_REPORT_REASONS,
  blockCommunityMember,
  hideCommunityContent,
  reportCommunityContent,
  type ReportSubmission,
  type ReportTarget,
} from '../../src/community/reporting';
import { supabase } from '../../src/lib/supabase';

type PickedPhoto = { uri: string; base64?: string | null; mimeType?: string | null };
type Comment = {
  id: string;
  body: string;
  image_paths: string[];
  image_urls: string[];
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; first_name: string | null; avatar_url: string | null } | null;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function videoDuration(post: CommunityPost) {
  const value = post.metadata?.media_duration_ms;
  if (typeof value !== 'number') return null;
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function signedReplyImages(paths: string[]) {
  if (!paths.length) return [];
  const signed = await Promise.all(paths.map(async (path) => {
    if (/^https?:\/\//i.test(path)) return path;
    const { data, error } = await supabase.storage.from('community-media').createSignedUrl(path, 60 * 60);
    return error ? null : data.signedUrl;
  }));
  return signed.filter((value): value is string => Boolean(value));
}

export default function CampfireConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportResult, setReportResult] = useState<ReportSubmission | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [safetyAction, setSafetyAction] = useState<'hide' | 'block' | null>(null);

  const replyCount = comments.length;
  const authorName = post?.author_name || 'Member';
  const composerLabel = useMemo(() => `Reply to ${authorName}`, [authorName]);
  const canSend = Boolean(draft.trim() || photos.length) && !submitting;

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [feed, commentResult, hiddenResult, blockResult] = await Promise.all([
        getCommunityFeed(),
        supabase.from('community_comments')
          .select('id,body,image_paths,created_at,author_id,profiles!community_comments_author_id_fkey(display_name,first_name,avatar_url)')
          .eq('post_id', id).eq('status', 'published').order('created_at'),
        supabase.from('community_hidden_content').select('comment_id'),
        supabase.from('community_blocks').select('blocked_id'),
      ]);
      const selectedPost = feed.find((item) => item.id === id) ?? null;
      setPost(selectedPost);
      if (commentResult.error) throw commentResult.error;
      if (hiddenResult.error) throw hiddenResult.error;
      if (blockResult.error) throw blockResult.error;

      const hiddenCommentIds = new Set((hiddenResult.data ?? []).map((row) => row.comment_id).filter(Boolean));
      const blockedIds = new Set((blockResult.data ?? []).map((row) => row.blocked_id).filter(Boolean));
      const visibleRaw = ((commentResult.data ?? []) as unknown as Array<Omit<Comment, 'image_urls'>>)
        .filter((comment) => !hiddenCommentIds.has(comment.id) && !blockedIds.has(comment.author_id));
      const visibleComments = await Promise.all(visibleRaw.map(async (comment) => ({
        ...comment,
        image_paths: comment.image_paths ?? [],
        image_urls: await signedReplyImages(comment.image_paths ?? []),
      })));
      setComments(visibleComments);
      if (!selectedPost) setError('This Campfire post is no longer available.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this Campfire thread.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function requestLibraryPhoto() {
    setMediaPickerOpen(false);
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to attach a photo.');
      return;
    }
    const remaining = 4 - photos.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.88,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled) return;
    const next = (result.assets ?? []).slice(0, remaining).map((asset) => ({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType }));
    setPhotos((current) => [...current, ...next].slice(0, 4));
  }

  async function requestCameraPhoto() {
    setMediaPickerOpen(false);
    setError(null);
    if (photos.length >= 4) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.88 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotos((current) => [...current, { uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType }].slice(0, 4));
  }

  async function submit() {
    const body = draft.trim();
    if (!id || (!body && !photos.length) || submitting) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    const uploadedPaths: string[] = [];
    try {
      for (const photo of photos) {
        uploadedPaths.push(await uploadCommunityPostImage(photo));
      }
      const { error: insertError } = await supabase.from('community_comments').insert({
        post_id: id,
        author_id: userId,
        body,
        image_paths: uploadedPaths,
      });
      if (insertError) throw insertError;
      setDraft('');
      setPhotos([]);
      await load();
    } catch (caught) {
      if (uploadedPaths.length) await Promise.allSettled(uploadedPaths.map((path) => removeCommunityPostMedia(path)));
      setError(caught instanceof Error ? caught.message : 'Unable to post your reply.');
    } finally {
      setSubmitting(false);
    }
  }

  function openProfile(authorId: string) {
    router.push({ pathname: '/community-profile/[id]', params: { id: authorId } });
  }

  function openReport(target: ReportTarget) {
    setReportTarget(target);
    setReportReason(null);
    setReportDetails('');
    setReportSuccess(false);
    setReportResult(null);
    setReportError(null);
    setSafetyAction(null);
  }

  function closeReport() {
    if (reporting || safetyAction) return;
    setReportTarget(null);
    setReportReason(null);
    setReportDetails('');
    setReportSuccess(false);
    setReportResult(null);
    setReportError(null);
  }

  async function submitReport() {
    if (!reportTarget || !reportReason || reporting) return;
    setReporting(true);
    setReportError(null);
    try {
      const result = await reportCommunityContent(reportTarget, reportReason, reportDetails);
      setReportResult(result);
      setReportSuccess(true);
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : 'We could not submit your report. Please try again.');
    } finally {
      setReporting(false);
    }
  }

  async function hideReportedContent() {
    if (!reportTarget || safetyAction) return;
    setSafetyAction('hide');
    setReportError(null);
    try {
      await hideCommunityContent(reportTarget);
      if (reportTarget.kind === 'comment') {
        setComments((current) => current.filter((comment) => comment.id !== reportTarget.id));
        closeReportAfterAction();
      } else {
        closeReportAfterAction();
        router.back();
      }
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : 'Unable to hide this content.');
      setSafetyAction(null);
    }
  }

  async function blockReportedMember() {
    if (!reportTarget?.authorId || safetyAction) return;
    setSafetyAction('block');
    setReportError(null);
    try {
      await blockCommunityMember(reportTarget.authorId);
      if (reportTarget.kind === 'post' || post?.author_id === reportTarget.authorId) {
        closeReportAfterAction();
        router.back();
      } else {
        setComments((current) => current.filter((comment) => comment.author_id !== reportTarget.authorId));
        closeReportAfterAction();
      }
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : 'Unable to block this member.');
      setSafetyAction(null);
    }
  }

  function closeReportAfterAction() {
    setSafetyAction(null);
    setReportTarget(null);
    setReportReason(null);
    setReportDetails('');
    setReportSuccess(false);
    setReportResult(null);
    setReportError(null);
  }

  if (loading) return <SafeAreaView style={styles.center} edges={['top']}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={(
            <View style={styles.headerStack}>
              <View><Text style={styles.eyebrow}>CAMPFIRE THREAD</Text><Text style={styles.title}>Conversation</Text></View>
              {post ? (
                <View style={styles.originalPost}>
                  <View style={styles.authorLine}>
                    <Pressable style={styles.avatar} onPress={() => openProfile(post.author_id)}>
                      {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarFallback}>{initials(post.author_name)}</Text>}
                    </Pressable>
                    <Pressable style={styles.authorCopy} onPress={() => openProfile(post.author_id)}>
                      <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
                      <Text style={styles.postTime}>{relativeTime(post.created_at)}</Text>
                    </Pressable>
                    <Pressable style={styles.moreButton} onPress={() => openReport({ kind: 'post', id: post.id, authorId: post.author_id })} accessibilityLabel="Report post">
                      <Ionicons name="ellipsis-horizontal" size={19} color="#AEB8B2" />
                    </Pressable>
                  </View>
                  <Text style={styles.postBody}>{post.body}</Text>
                  {post.media_type === 'video' && post.media_url ? (
                    <Pressable style={styles.postVideo} onPress={() => void Linking.openURL(post.media_url!)} accessibilityRole="button" accessibilityLabel="Play video">
                      <View style={styles.postVideoPlay}><Ionicons name="play" size={30} color="#101510" /></View>
                      <Text style={styles.postVideoTitle}>Play video</Text>
                      <Text style={styles.postVideoMeta}>{videoDuration(post) ? `${videoDuration(post)} · ` : ''}Opens in your device player</Text>
                    </Pressable>
                  ) : post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" /> : null}
                  <PostEngagementBar postId={post.id} initialReactionCount={post.reaction_count || 0} commentCount={replyCount} />
                </View>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {post ? <View style={styles.conversationHeading}><Text style={styles.conversationTitle}>Conversation</Text><Text style={styles.replyCount}>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</Text></View> : null}
            </View>
          )}
          ListEmptyComponent={post ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>No replies yet</Text><Text style={styles.emptyText}>Start the conversation.</Text></View> : null}
          renderItem={({ item }) => {
            const name = item.profiles?.display_name ?? item.profiles?.first_name ?? 'Member';
            return (
              <View style={styles.comment}>
                <Pressable style={styles.commentAvatar} onPress={() => openProfile(item.author_id)}>
                  {item.profiles?.avatar_url ? <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.commentAvatarFallback}>{initials(name)}</Text>}
                </Pressable>
                <View style={styles.commentBody}>
                  <View style={styles.commentMeta}>
                    <Pressable onPress={() => openProfile(item.author_id)}><Text style={styles.commentAuthor}>{name}</Text></Pressable>
                    <Text style={styles.commentTime}>{relativeTime(item.created_at)}</Text>
                    <Pressable style={styles.commentMore} onPress={() => openReport({ kind: 'comment', id: item.id, authorId: item.author_id })} accessibilityLabel="Report reply">
                      <Ionicons name="ellipsis-horizontal" size={17} color="#7F8B83" />
                    </Pressable>
                  </View>
                  {item.body ? <Text style={styles.commentText}>{item.body}</Text> : null}
                  {item.image_urls.length ? <View style={styles.commentPhotoGrid}>
                    {item.image_urls.map((url) => <Pressable key={url} style={item.image_urls.length === 1 ? styles.commentPhotoSingle : styles.commentPhotoTile} onPress={() => setViewerUrl(url)}>
                      <Image source={{ uri: url }} style={styles.commentPhoto} resizeMode="cover" />
                    </Pressable>)}
                  </View> : null}
                </View>
              </View>
            );
          }}
        />

        {post ? <View style={styles.composerShell}>
          <Text style={styles.composerLabel}>{composerLabel}</Text>
          {photos.length ? <View style={styles.previewRow}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.previewTile}>
            <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="cover" />
            <Pressable style={styles.previewRemove} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} accessibilityLabel="Remove photo">
              <Ionicons name="close" size={16} color="#FFF8E8" />
            </Pressable>
          </View>)}</View> : null}
          <View style={styles.composerRow}>
            <Pressable style={[styles.photoButton, photos.length >= 4 && styles.photoButtonDisabled]} onPress={() => setMediaPickerOpen(true)} disabled={photos.length >= 4 || submitting} accessibilityLabel="Add photos">
              <Ionicons name="image-outline" size={21} color="#D7B45A" />
              {photos.length ? <View style={styles.photoCount}><Text style={styles.photoCountText}>{photos.length}</Text></View> : null}
            </Pressable>
            <TextInput value={draft} onChangeText={setDraft} multiline maxLength={2000} placeholder="Write a reply..." placeholderTextColor="#77827B" style={styles.input} accessibilityLabel={composerLabel} />
            <Pressable style={[styles.sendButton, !canSend && styles.sendButtonDisabled]} onPress={() => void submit()} disabled={!canSend}>
              <Text style={styles.sendButtonText}>{submitting ? 'Sending' : 'Send'}</Text>
            </Pressable>
          </View>
        </View> : null}
      </KeyboardAvoidingView>

      <Modal transparent visible={mediaPickerOpen} animationType="fade" onRequestClose={() => setMediaPickerOpen(false)}>
        <Pressable style={styles.mediaBackdrop} onPress={() => setMediaPickerOpen(false)}>
          <Pressable style={styles.mediaSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.mediaTitle}>Add photos</Text>
            <Text style={styles.mediaCopy}>Attach up to four photos to this reply.</Text>
            <Pressable style={styles.mediaAction} onPress={() => void requestLibraryPhoto()}><Ionicons name="images-outline" size={20} color="#D7B45A" /><Text style={styles.mediaActionText}>Choose from library</Text></Pressable>
            <Pressable style={styles.mediaAction} onPress={() => void requestCameraPhoto()}><Ionicons name="camera-outline" size={20} color="#D7B45A" /><Text style={styles.mediaActionText}>Take a photo</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(viewerUrl)} animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <View style={styles.viewerBackdrop}>
          <Pressable style={styles.viewerClose} onPress={() => setViewerUrl(null)} accessibilityLabel="Close photo"><Ionicons name="close" size={24} color="#FFF8E8" /></Pressable>
          {viewerUrl ? <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </View>
      </Modal>

      <Modal transparent visible={Boolean(reportTarget)} animationType="fade" onRequestClose={closeReport}>
        <Pressable style={styles.reportBackdrop} onPress={closeReport}>
          <Pressable style={styles.reportSheet} onPress={(event) => event.stopPropagation()}>
            {reportSuccess ? <View style={styles.reportSuccess}>
              <View style={styles.reportSuccessIcon}><Ionicons name="checkmark" size={22} color="#101510" /></View>
              <Text style={styles.reportTitle}>{reportResult?.created ? 'Report submitted' : 'Already reported'}</Text>
              <Text style={styles.reportCopy}>{reportResult?.created ? 'Thanks for helping keep the community safe. This is now pending moderation review.' : 'You already have an active report for this content. It is still in the moderation queue.'}</Text>
              {reportError ? <Text style={styles.reportError}>{reportError}</Text> : null}
              <View style={styles.reportActionStack}>
                <Pressable style={styles.reportSecondary} disabled={Boolean(safetyAction)} onPress={() => void hideReportedContent()}><Ionicons name="eye-off-outline" size={17} color="#FFF8E8" /><Text style={styles.reportSecondaryText}>{safetyAction === 'hide' ? 'Hiding…' : `Hide this ${reportTarget?.kind === 'comment' ? 'reply' : 'post'}`}</Text></Pressable>
                {reportTarget?.authorId ? <Pressable style={styles.reportDanger} disabled={Boolean(safetyAction)} onPress={() => void blockReportedMember()}><Ionicons name="ban-outline" size={17} color="#FFB4A9" /><Text style={styles.reportDangerText}>{safetyAction === 'block' ? 'Blocking…' : 'Block this member'}</Text></Pressable> : null}
              </View>
              <Pressable style={styles.reportPrimary} onPress={closeReport} disabled={Boolean(safetyAction)}><Text style={styles.reportPrimaryText}>Done</Text></Pressable>
            </View> : <>
              <View style={styles.reportHeader}><View style={styles.flex}><Text style={styles.reportEyebrow}>REPORT</Text><Text style={styles.reportTitle}>{reportTarget?.kind === 'comment' ? 'Report this reply' : 'Report this post'}</Text></View><Pressable style={styles.reportClose} onPress={closeReport}><Ionicons name="close" size={20} color="#FFF8E8" /></Pressable></View>
              <Text style={styles.reportCopy}>Choose the reason that best describes the problem.</Text>
              <View style={styles.reportReasons}>{COMMUNITY_REPORT_REASONS.map((reason) => <Pressable key={reason} style={[styles.reportReason, reportReason === reason && styles.reportReasonSelected]} onPress={() => { setReportReason(reason); setReportError(null); }}><Text style={[styles.reportReasonText, reportReason === reason && styles.reportReasonTextSelected]}>{reason}</Text>{reportReason === reason ? <Ionicons name="checkmark-circle" size={18} color="#D7B45A" /> : null}</Pressable>)}</View>
              <TextInput value={reportDetails} onChangeText={setReportDetails} multiline maxLength={500} placeholder="Tell us more (optional)" placeholderTextColor="#77827B" style={styles.reportInput} />
              {reportError ? <View style={styles.reportErrorBox}><Ionicons name="alert-circle-outline" size={18} color="#FFB4A9" /><Text style={styles.reportError}>{reportError}</Text></View> : null}
              <Pressable style={[styles.reportPrimary, (!reportReason || reporting) && styles.reportPrimaryDisabled]} disabled={!reportReason || reporting} onPress={() => void submitReport()}><Text style={styles.reportPrimaryText}>{reporting ? 'Submitting…' : reportError ? 'Try again' : 'Submit report'}</Text></Pressable>
            </>}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' }, keyboardView: { flex: 1 }, flex: { flex: 1 },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28 }, headerStack: { gap: 16 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', fontSize: 11, letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 4 },
  originalPost: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#34483D', borderRadius: 22, padding: 16, gap: 13 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' }, avatarFallback: { color: '#F0D083', fontWeight: '900' }, authorCopy: { flex: 1 }, authorName: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, postTime: { color: '#8D9B92', fontSize: 12, marginTop: 2 },
  moreButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, postBody: { color: '#E4E9E5', fontSize: 17, lineHeight: 25 }, postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: '#223229' },
  postVideo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: '#0D1511', borderWidth: 1, borderColor: '#39473F', alignItems: 'center', justifyContent: 'center', gap: 8 },
  postVideoPlay: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 }, postVideoTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, postVideoMeta: { color: '#AEB8B2', fontSize: 10.5 },
  conversationHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 }, conversationTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, replyCount: { color: '#89978F', fontSize: 12, fontWeight: '700' }, error: { color: '#FFB4A9', lineHeight: 19 },
  emptyState: { paddingVertical: 34, alignItems: 'center', gap: 5 }, emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, emptyText: { color: '#9DA9A2', fontSize: 14 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#25342C' }, commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' }, commentAvatarFallback: { color: '#F0D083', fontSize: 11, fontWeight: '900' }, commentBody: { flex: 1, gap: 7 }, commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 }, commentAuthor: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 }, commentTime: { color: '#849188', fontSize: 11 }, commentMore: { marginLeft: 'auto', width: 30, height: 26, alignItems: 'center', justifyContent: 'center' }, commentText: { color: '#D9E0DB', fontSize: 15, lineHeight: 22 },
  commentPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, commentPhotoSingle: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden', backgroundColor: '#223229' }, commentPhotoTile: { width: '48.5%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#223229' }, commentPhoto: { width: '100%', height: '100%' },
  composerShell: { borderTopWidth: 1, borderTopColor: '#314238', backgroundColor: '#121C17', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, gap: 7 }, composerLabel: { color: '#99A69E', fontSize: 11, fontWeight: '800' }, composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, input: { flex: 1, maxHeight: 112, minHeight: 44, borderRadius: 15, backgroundColor: '#1A2821', borderWidth: 1, borderColor: '#34483D', color: '#FFF8E8', paddingHorizontal: 13, paddingVertical: 11, textAlignVertical: 'top', fontSize: 14 },
  photoButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#3B4C42', backgroundColor: '#1A2821', alignItems: 'center', justifyContent: 'center' }, photoButtonDisabled: { opacity: 0.4 }, photoCount: { position: 'absolute', right: -4, top: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, photoCountText: { color: '#101510', fontSize: 10, fontWeight: '900' },
  previewRow: { flexDirection: 'row', gap: 7 }, previewTile: { width: 58, height: 58, borderRadius: 11, overflow: 'visible' }, previewImage: { width: '100%', height: '100%', borderRadius: 11, backgroundColor: '#223229' }, previewRemove: { position: 'absolute', right: -5, top: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: '#25342C', borderWidth: 1, borderColor: '#65746B', alignItems: 'center', justifyContent: 'center' },
  sendButton: { minWidth: 70, height: 44, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 }, sendButtonDisabled: { opacity: 0.42 }, sendButtonText: { color: '#111712', fontWeight: '900', fontSize: 13 },
  mediaBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' }, mediaSheet: { backgroundColor: '#17211C', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#34483D', padding: 18, paddingBottom: 30, gap: 10 }, mediaTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, mediaCopy: { color: '#9EAAA2', fontSize: 13, marginBottom: 4 }, mediaAction: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#34483D', backgroundColor: '#1A2821', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }, mediaActionText: { color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }, viewerImage: { width: '100%', height: '82%' }, viewerClose: { position: 'absolute', top: 54, right: 18, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(25,35,30,0.85)', alignItems: 'center', justifyContent: 'center' },
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' }, reportSheet: { backgroundColor: '#17211C', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#34483D', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28, gap: 14 }, reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, reportEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, reportTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 2 }, reportCopy: { color: '#AEB8B2', fontSize: 13, lineHeight: 19, textAlign: 'center' }, reportClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#223028', alignItems: 'center', justifyContent: 'center' },
  reportReasons: { gap: 7 }, reportReason: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#334139', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, reportReasonSelected: { borderColor: '#7A6A3D', backgroundColor: '#24281F' }, reportReasonText: { color: '#D5DDD7', fontSize: 13, fontWeight: '700', flex: 1 }, reportReasonTextSelected: { color: '#FFF8E8' }, reportInput: { minHeight: 74, maxHeight: 120, borderRadius: 13, borderWidth: 1, borderColor: '#34483D', backgroundColor: '#121C17', color: '#FFF8E8', paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top', fontSize: 13 }, reportPrimary: { minHeight: 46, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, reportPrimaryDisabled: { opacity: 0.42 }, reportPrimaryText: { color: '#101510', fontSize: 13, fontWeight: '900' }, reportSuccess: { alignItems: 'center', gap: 10, paddingVertical: 8 }, reportSuccessIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  reportErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817', paddingHorizontal: 11, paddingVertical: 10 }, reportError: { flex: 1, color: '#FFB4A9', fontSize: 12, lineHeight: 17 }, reportActionStack: { width: '100%', gap: 8, marginTop: 4 }, reportSecondary: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#46584E', backgroundColor: '#1C2822', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, reportSecondaryText: { color: '#FFF8E8', fontSize: 13, fontWeight: '800' }, reportDanger: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, reportDangerText: { color: '#FFB4A9', fontSize: 13, fontWeight: '800' },
});