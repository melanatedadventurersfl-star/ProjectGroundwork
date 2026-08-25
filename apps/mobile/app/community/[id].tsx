import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCommunityFeed, removeCommunityPostMedia, uploadCommunityPostImage, type CommunityPost } from '../../src/community/api';
import { CommunityVideoPlayer } from '../../src/community/CommunityVideoPlayer';
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
type ProfileSummary = { display_name: string | null; first_name: string | null; avatar_url?: string | null };
type Comment = {
  id: string;
  body: string;
  image_paths: string[];
  image_urls: string[];
  created_at: string;
  author_id: string;
  parent_comment_id: string | null;
  reply_to_profile_id: string | null;
  profiles: ProfileSummary | null;
  reply_to_profile: ProfileSummary | null;
};
type ReplyTarget = { rootId: string; profileId: string; name: string };

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

function profileName(profile: ProfileSummary | null | undefined) {
  return profile?.display_name ?? profile?.first_name ?? 'Member';
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
  const inputRef = useRef<TextInput>(null);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
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
  const composerLabel = replyTarget ? `Replying to @${replyTarget.name}` : `Reply to ${authorName}`;
  const canSend = Boolean(draft.trim() || photos.length) && !submitting;

  const topLevelComments = useMemo(() => comments.filter((comment) => !comment.parent_comment_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of comments) {
      if (!comment.parent_comment_id) continue;
      const current = map.get(comment.parent_comment_id) ?? [];
      current.push(comment);
      map.set(comment.parent_comment_id, current);
    }
    return map;
  }, [comments]);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [feed, commentResult, hiddenResult, blockResult] = await Promise.all([
        getCommunityFeed(),
        supabase.from('community_comments')
          .select('id,body,image_paths,created_at,author_id,parent_comment_id,reply_to_profile_id,profiles!community_comments_author_id_fkey(display_name,first_name,avatar_url),reply_to_profile:profiles!community_comments_reply_to_profile_id_fkey(display_name,first_name)')
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

  function beginReply(comment: Comment) {
    setReplyTarget({
      rootId: comment.parent_comment_id ?? comment.id,
      profileId: comment.author_id,
      name: profileName(comment.profiles),
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelReply() {
    setReplyTarget(null);
  }

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
      for (const photo of photos) uploadedPaths.push(await uploadCommunityPostImage(photo));
      const { error: insertError } = await supabase.from('community_comments').insert({
        post_id: id,
        author_id: userId,
        body,
        image_paths: uploadedPaths,
        parent_comment_id: replyTarget?.rootId ?? null,
        reply_to_profile_id: replyTarget?.profileId ?? null,
      });
      if (insertError) throw insertError;
      setDraft('');
      setPhotos([]);
      setReplyTarget(null);
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

  function closeReportAfterAction() {
    setSafetyAction(null);
    setReportTarget(null);
    setReportReason(null);
    setReportDetails('');
    setReportSuccess(false);
    setReportResult(null);
    setReportError(null);
  }

  async function hideReportedContent() {
    if (!reportTarget || safetyAction) return;
    setSafetyAction('hide');
    setReportError(null);
    try {
      await hideCommunityContent(reportTarget);
      if (reportTarget.kind === 'comment') {
        const hiddenId = reportTarget.id;
        setComments((current) => current.filter((comment) => comment.id !== hiddenId && comment.parent_comment_id !== hiddenId));
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

  function renderPhotos(comment: Comment, nested: boolean) {
    if (!comment.image_urls.length) return null;
    return (
      <View style={styles.commentPhotoGrid}>
        {comment.image_urls.map((url) => (
          <Pressable
            key={url}
            style={comment.image_urls.length === 1 ? [styles.commentPhotoSingle, nested && styles.commentPhotoSingleNested] : styles.commentPhotoTile}
            onPress={() => setViewerUrl(url)}
          >
            <Image source={{ uri: url }} style={styles.commentPhoto} resizeMode="cover" />
          </Pressable>
        ))}
      </View>
    );
  }

  function renderComment(comment: Comment, nested = false) {
    const name = profileName(comment.profiles);
    const taggedName = profileName(comment.reply_to_profile);
    return (
      <View key={comment.id} style={[styles.comment, nested && styles.nestedComment]}>
        <Pressable style={[styles.commentAvatar, nested && styles.nestedAvatar]} onPress={() => openProfile(comment.author_id)}>
          {comment.profiles?.avatar_url ? <Image source={{ uri: comment.profiles.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.commentAvatarFallback}>{initials(name)}</Text>}
        </Pressable>
        <View style={styles.commentBody}>
          <View style={styles.commentMeta}>
            <Pressable onPress={() => openProfile(comment.author_id)}><Text style={styles.commentAuthor}>{name}</Text></Pressable>
            <Text style={styles.commentTime}>{relativeTime(comment.created_at)}</Text>
            <Pressable style={styles.commentMore} onPress={() => openReport({ kind: 'comment', id: comment.id, authorId: comment.author_id })} accessibilityLabel="Report reply">
              <Ionicons name="ellipsis-horizontal" size={17} color="#7F8B83" />
            </Pressable>
          </View>
          {nested && comment.reply_to_profile_id ? <Text style={styles.replyTag}>Replying to <Text style={styles.replyTagName}>@{taggedName}</Text></Text> : null}
          {comment.body ? <Text style={styles.commentText}>{comment.body}</Text> : null}
          {renderPhotos(comment, nested)}
          <Pressable style={styles.replyAction} onPress={() => beginReply(comment)} accessibilityLabel={`Reply to ${name}`}>
            <Ionicons name="return-down-forward-outline" size={15} color="#D7B45A" />
            <Text style={styles.replyActionText}>Reply</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) return <SafeAreaView style={styles.center} edges={['top']}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <FlatList
          data={topLevelComments}
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
                  {post.media_type === 'video' && post.media_url ? <CommunityVideoPlayer uri={post.media_url} aspectRatio={4 / 3} /> : post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" /> : null}
                  <PostEngagementBar postId={post.id} initialReactionCount={post.reaction_count || 0} commentCount={replyCount} />
                </View>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {post ? <View style={styles.conversationHeading}><Text style={styles.conversationTitle}>Conversation</Text><Text style={styles.replyCount}>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</Text></View> : null}
            </View>
          )}
          ListEmptyComponent={post ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>No replies yet</Text><Text style={styles.emptyText}>Start the conversation.</Text></View> : null}
          renderItem={({ item }) => (
            <View>
              {renderComment(item)}
              {(repliesByParent.get(item.id) ?? []).map((reply) => renderComment(reply, true))}
            </View>
          )}
        />

        {post ? <View style={styles.composerShell}>
          <View style={styles.composerHeading}>
            <Text style={[styles.composerLabel, replyTarget && styles.composerLabelActive]}>{composerLabel}</Text>
            {replyTarget ? <Pressable onPress={cancelReply} style={styles.cancelReply} accessibilityLabel="Cancel comment reply"><Ionicons name="close" size={15} color="#AEB8B2" /></Pressable> : null}
          </View>
          {photos.length ? <View style={styles.previewRow}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.previewTile}>
            <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="cover" />
            <Pressable style={styles.previewRemove} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} accessibilityLabel="Remove photo"><Ionicons name="close" size={16} color="#FFF8E8" /></Pressable>
          </View>)}</View> : null}
          <View style={styles.composerRow}>
            <Pressable style={[styles.photoButton, photos.length >= 4 && styles.photoButtonDisabled]} onPress={() => setMediaPickerOpen(true)} disabled={photos.length >= 4 || submitting} accessibilityLabel="Add photos">
              <Ionicons name="image-outline" size={21} color="#D7B45A" />
              {photos.length ? <View style={styles.photoCount}><Text style={styles.photoCountText}>{photos.length}</Text></View> : null}
            </Pressable>
            <TextInput ref={inputRef} value={draft} onChangeText={setDraft} multiline maxLength={2000} placeholder={replyTarget ? `Reply to @${replyTarget.name}...` : 'Write a reply...'} placeholderTextColor="#77827B" style={styles.input} accessibilityLabel={composerLabel} />
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
  conversationHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 }, conversationTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, replyCount: { color: '#89978F', fontSize: 12, fontWeight: '700' }, error: { color: '#FFB4A9', lineHeight: 19 },
  emptyState: { paddingVertical: 34, alignItems: 'center', gap: 5 }, emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, emptyText: { color: '#9DA9A2', fontSize: 14 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#25342C' },
  nestedComment: { marginLeft: 38, paddingTop: 10, paddingBottom: 11, borderBottomColor: '#1E2C25', borderLeftWidth: 2, borderLeftColor: '#2D4036', paddingLeft: 10 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' }, nestedAvatar: { width: 30, height: 30, borderRadius: 15 },
  commentAvatarFallback: { color: '#F0D083', fontSize: 11, fontWeight: '900' }, commentBody: { flex: 1, gap: 7 }, commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 }, commentAuthor: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 }, commentTime: { color: '#849188', fontSize: 11 }, commentMore: { marginLeft: 'auto', width: 30, height: 26, alignItems: 'center', justifyContent: 'center' }, commentText: { color: '#D9E0DB', fontSize: 15, lineHeight: 22 },
  replyTag: { color: '#839087', fontSize: 11, fontWeight: '700' }, replyTagName: { color: '#D7B45A', fontWeight: '900' },
  replyAction: { alignSelf: 'flex-start', minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 10 }, replyActionText: { color: '#CDB979', fontSize: 12, fontWeight: '800' },
  commentPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' },
  commentPhotoSingle: { width: 240, maxWidth: '78%', aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden', backgroundColor: '#223229' }, commentPhotoSingleNested: { width: 200, maxWidth: '86%' },
  commentPhotoTile: { width: 108, height: 108, borderRadius: 12, overflow: 'hidden', backgroundColor: '#223229' }, commentPhoto: { width: '100%', height: '100%' },
  composerShell: { borderTopWidth: 1, borderTopColor: '#314238', backgroundColor: '#121C17', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, gap: 7 },
  composerHeading: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 7 }, composerLabel: { color: '#99A69E', fontSize: 11, fontWeight: '800' }, composerLabelActive: { color: '#D7B45A' }, cancelReply: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2822' },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, input: { flex: 1, maxHeight: 112, minHeight: 44, borderRadius: 15, backgroundColor: '#1A2821', borderWidth: 1, borderColor: '#34483D', color: '#FFF8E8', paddingHorizontal: 13, paddingVertical: 11, textAlignVertical: 'top', fontSize: 14 },
  photoButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#3B4C42', backgroundColor: '#1A2821', alignItems: 'center', justifyContent: 'center' }, photoButtonDisabled: { opacity: 0.4 }, photoCount: { position: 'absolute', right: -4, top: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, photoCountText: { color: '#101510', fontSize: 10, fontWeight: '900' },
  previewRow: { flexDirection: 'row', gap: 7 }, previewTile: { width: 58, height: 58, borderRadius: 11, overflow: 'visible' }, previewImage: { width: '100%', height: '100%', borderRadius: 11, backgroundColor: '#223229' }, previewRemove: { position: 'absolute', right: -5, top: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: '#25342C', borderWidth: 1, borderColor: '#65746B', alignItems: 'center', justifyContent: 'center' },
  sendButton: { minWidth: 70, height: 44, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 }, sendButtonDisabled: { opacity: 0.42 }, sendButtonText: { color: '#111712', fontWeight: '900', fontSize: 13 },
  mediaBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' }, mediaSheet: { backgroundColor: '#17211C', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#34483D', padding: 18, paddingBottom: 30, gap: 10 }, mediaTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, mediaCopy: { color: '#9EAAA2', fontSize: 13, marginBottom: 4 }, mediaAction: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#34483D', backgroundColor: '#1A2821', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }, mediaActionText: { color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }, viewerImage: { width: '100%', height: '82%' }, viewerClose: { position: 'absolute', top: 54, right: 18, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(25,35,30,0.85)', alignItems: 'center', justifyContent: 'center' },
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' }, reportSheet: { backgroundColor: '#17211C', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#34483D', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28, gap: 14 }, reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, reportEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, reportTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 2 }, reportCopy: { color: '#AEB8B2', fontSize: 13, lineHeight: 19, textAlign: 'center' }, reportClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#223028', alignItems: 'center', justifyContent: 'center' },
  reportReasons: { gap: 7 }, reportReason: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#334139', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, reportReasonSelected: { borderColor: '#7A6A3D', backgroundColor: '#24281F' }, reportReasonText: { color: '#D5DDD7', fontSize: 13, fontWeight: '700', flex: 1 }, reportReasonTextSelected: { color: '#FFF8E8' }, reportInput: { minHeight: 74, maxHeight: 120, borderRadius: 13, borderWidth: 1, borderColor: '#34483D', backgroundColor: '#121C17', color: '#FFF8E8', paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top', fontSize: 13 }, reportPrimary: { minHeight: 46, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, reportPrimaryDisabled: { opacity: 0.42 }, reportPrimaryText: { color: '#101510', fontSize: 13, fontWeight: '900' }, reportSuccess: { alignItems: 'center', gap: 10, paddingVertical: 8 }, reportSuccessIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  reportErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817', paddingHorizontal: 11, paddingVertical: 10 }, reportError: { flex: 1, color: '#FFB4A9', fontSize: 12, lineHeight: 17 }, reportActionStack: { width: '100%', gap: 8, marginTop: 4 }, reportSecondary: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#46584E', backgroundColor: '#1C2822', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, reportSecondaryText: { color: '#FFF8E8', fontSize: 13, fontWeight: '800' }, reportDanger: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, reportDangerText: { color: '#FFB4A9', fontSize: 13, fontWeight: '800' },
});