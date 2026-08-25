import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCommunityFeed, type CommunityPost } from '../../src/community/api';
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

type Comment = {
  id: string;
  body: string;
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


export default function CampfireConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
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

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [feed, commentResult, hiddenResult, blockResult] = await Promise.all([
        getCommunityFeed(),
        supabase.from('community_comments')
          .select('id,body,created_at,author_id,profiles!community_comments_author_id_fkey(display_name,first_name,avatar_url)')
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
      const visibleComments = ((commentResult.data ?? []) as unknown as Comment[])
        .filter((comment) => !hiddenCommentIds.has(comment.id) && !blockedIds.has(comment.author_id));
      setComments(visibleComments);
      if (!selectedPost) setError('This Campfire post is no longer available.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this Campfire thread.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function submit() {
    const body = draft.trim();
    if (!id || !body || submitting) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('community_comments').insert({ post_id: id, author_id: userId, body });
      if (insertError) throw insertError;
      setDraft('');
      await load();
    } catch (caught) {
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
                    <CommunityVideoPlayer uri={post.media_url} aspectRatio={4 / 3} />
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
                  <Text style={styles.commentText}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />

        {post ? <View style={styles.composerShell}>
          <Text style={styles.composerLabel}>{composerLabel}</Text>
          <View style={styles.composerRow}>
            <TextInput value={draft} onChangeText={setDraft} multiline maxLength={2000} placeholder="Write a reply..." placeholderTextColor="#77827B" style={styles.input} accessibilityLabel={composerLabel} />
            <Pressable style={[styles.sendButton, (!draft.trim() || submitting) && styles.sendButtonDisabled]} onPress={() => void submit()} disabled={!draft.trim() || submitting}>
              <Text style={styles.sendButtonText}>{submitting ? 'Sending' : 'Send'}</Text>
            </Pressable>
          </View>
        </View> : null}
      </KeyboardAvoidingView>

      <Modal transparent visible={Boolean(reportTarget)} animationType="fade" onRequestClose={closeReport}>
        <Pressable style={styles.reportBackdrop} onPress={closeReport}>
          <Pressable style={styles.reportSheet} onPress={(event) => event.stopPropagation()}>
            {reportSuccess ? <View style={styles.reportSuccess}>
              <View style={styles.reportSuccessIcon}><Ionicons name="checkmark" size={22} color="#101510" /></View>
              <Text style={styles.reportTitle}>{reportResult?.created ? 'Report submitted' : 'Already reported'}</Text>
              <Text style={styles.reportCopy}>
                {reportResult?.created
                  ? 'Thanks for helping keep the community safe. This is now pending moderation review.'
                  : 'You already have an active report for this content. It is still in the moderation queue.'}
              </Text>
              {reportError ? <Text style={styles.reportError}>{reportError}</Text> : null}
              <View style={styles.reportActionStack}>
                <Pressable style={styles.reportSecondary} disabled={Boolean(safetyAction)} onPress={() => void hideReportedContent()}>
                  <Ionicons name="eye-off-outline" size={17} color="#FFF8E8" />
                  <Text style={styles.reportSecondaryText}>{safetyAction === 'hide' ? 'Hiding…' : `Hide this ${reportTarget?.kind === 'comment' ? 'reply' : 'post'}`}</Text>
                </Pressable>
                {reportTarget?.authorId ? <Pressable style={styles.reportDanger} disabled={Boolean(safetyAction)} onPress={() => void blockReportedMember()}>
                  <Ionicons name="ban-outline" size={17} color="#FFB4A9" />
                  <Text style={styles.reportDangerText}>{safetyAction === 'block' ? 'Blocking…' : 'Block this member'}</Text>
                </Pressable> : null}
              </View>
              <Pressable style={styles.reportPrimary} onPress={closeReport} disabled={Boolean(safetyAction)}><Text style={styles.reportPrimaryText}>Done</Text></Pressable>
            </View> : <>
              <View style={styles.reportHeader}>
                <View style={styles.flex}><Text style={styles.reportEyebrow}>REPORT</Text><Text style={styles.reportTitle}>{reportTarget?.kind === 'comment' ? 'Report this reply' : 'Report this post'}</Text></View>
                <Pressable style={styles.reportClose} onPress={closeReport}><Ionicons name="close" size={20} color="#FFF8E8" /></Pressable>
              </View>
              <Text style={styles.reportCopy}>Choose the reason that best describes the problem.</Text>
              <View style={styles.reportReasons}>{COMMUNITY_REPORT_REASONS.map((reason) => <Pressable key={reason} style={[styles.reportReason, reportReason === reason && styles.reportReasonSelected]} onPress={() => { setReportReason(reason); setReportError(null); }}>
                <Text style={[styles.reportReasonText, reportReason === reason && styles.reportReasonTextSelected]}>{reason}</Text>
                {reportReason === reason ? <Ionicons name="checkmark-circle" size={18} color="#D7B45A" /> : null}
              </Pressable>)}</View>
              <TextInput value={reportDetails} onChangeText={setReportDetails} multiline maxLength={500} placeholder="Tell us more (optional)" placeholderTextColor="#77827B" style={styles.reportInput} />
              {reportError ? <View style={styles.reportErrorBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#FFB4A9" />
                <Text style={styles.reportError}>{reportError}</Text>
              </View> : null}
              <Pressable style={[styles.reportPrimary, (!reportReason || reporting) && styles.reportPrimaryDisabled]} disabled={!reportReason || reporting} onPress={() => void submitReport()}>
                <Text style={styles.reportPrimaryText}>{reporting ? 'Submitting…' : reportError ? 'Try again' : 'Submit report'}</Text>
              </Pressable>
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
  postVideoPlay: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  postVideoTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' }, postVideoMeta: { color: '#AEB8B2', fontSize: 10.5 },
  conversationHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 }, conversationTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' }, replyCount: { color: '#89978F', fontSize: 12, fontWeight: '700' }, error: { color: '#FFB4A9', lineHeight: 19 },
  emptyState: { paddingVertical: 34, alignItems: 'center', gap: 5 }, emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, emptyText: { color: '#9DA9A2', fontSize: 14 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#25342C' }, commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' }, commentAvatarFallback: { color: '#F0D083', fontSize: 11, fontWeight: '900' }, commentBody: { flex: 1, gap: 5 }, commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 }, commentAuthor: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 }, commentTime: { color: '#849188', fontSize: 11 }, commentMore: { marginLeft: 'auto', width: 30, height: 26, alignItems: 'center', justifyContent: 'center' }, commentText: { color: '#D9E0DB', fontSize: 15, lineHeight: 22 },
  composerShell: { borderTopWidth: 1, borderTopColor: '#314238', backgroundColor: '#121C17', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, gap: 7 }, composerLabel: { color: '#99A69E', fontSize: 11, fontWeight: '800' }, composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 }, input: { flex: 1, maxHeight: 112, minHeight: 44, borderRadius: 15, backgroundColor: '#1A2821', borderWidth: 1, borderColor: '#34483D', color: '#FFF8E8', paddingHorizontal: 13, paddingVertical: 11, textAlignVertical: 'top', fontSize: 14 }, sendButton: { minWidth: 70, height: 44, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 }, sendButtonDisabled: { opacity: 0.42 }, sendButtonText: { color: '#111712', fontWeight: '900', fontSize: 13 },
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' }, reportSheet: { backgroundColor: '#17211C', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#34483D', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28, gap: 14 }, reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, reportEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, reportTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 2 }, reportCopy: { color: '#AEB8B2', fontSize: 13, lineHeight: 19, textAlign: 'center' }, reportClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#223028', alignItems: 'center', justifyContent: 'center' },
  reportReasons: { gap: 7 }, reportReason: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#334139', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, reportReasonSelected: { borderColor: '#7A6A3D', backgroundColor: '#24281F' }, reportReasonText: { color: '#D5DDD7', fontSize: 13, fontWeight: '700', flex: 1 }, reportReasonTextSelected: { color: '#FFF8E8' }, reportInput: { minHeight: 74, maxHeight: 120, borderRadius: 13, borderWidth: 1, borderColor: '#34483D', backgroundColor: '#121C17', color: '#FFF8E8', paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top', fontSize: 13 }, reportPrimary: { minHeight: 46, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, reportPrimaryDisabled: { opacity: 0.42 }, reportPrimaryText: { color: '#101510', fontSize: 13, fontWeight: '900' }, reportSuccess: { alignItems: 'center', gap: 10, paddingVertical: 8 }, reportSuccessIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  reportErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817', paddingHorizontal: 11, paddingVertical: 10 }, reportError: { flex: 1, color: '#FFB4A9', fontSize: 12, lineHeight: 17 }, reportActionStack: { width: '100%', gap: 8, marginTop: 4 }, reportSecondary: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#46584E', backgroundColor: '#1C2822', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, reportSecondaryText: { color: '#FFF8E8', fontSize: 13, fontWeight: '800' }, reportDanger: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#5C3A36', backgroundColor: '#241817', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, reportDangerText: { color: '#FFB4A9', fontSize: 13, fontWeight: '800' },
});