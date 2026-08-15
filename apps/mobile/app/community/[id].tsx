import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCommunityFeed, setReaction, type CommunityPost } from '../../src/community/api';
import { supabase } from '../../src/lib/supabase';

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: {
    display_name: string | null;
    first_name: string | null;
    avatar_url: string | null;
  } | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'MA';
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function CampfireConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replyCount = comments.length;
  const authorName = post?.author_name || 'Member';
  const composerLabel = useMemo(() => `Reply to ${authorName}`, [authorName]);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const [feed, commentResult] = await Promise.all([
        getCommunityFeed(),
        supabase
          .from('community_comments')
          .select('id,body,created_at,author_id,profiles!community_comments_author_id_fkey(display_name,first_name,avatar_url)')
          .eq('post_id', id)
          .eq('status', 'published')
          .order('created_at'),
      ]);

      const selectedPost = feed.find((item) => item.id === id) ?? null;
      setPost(selectedPost);

      if (commentResult.error) throw commentResult.error;
      setComments((commentResult.data ?? []) as unknown as Comment[]);

      if (!selectedPost) {
        setError('This Campfire post is no longer available.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this Campfire thread.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function submit() {
    const body = draft.trim();
    if (!id || !body || submitting) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;

    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from('community_comments')
        .insert({ post_id: id, author_id: userId, body });
      if (insertError) throw insertError;
      setDraft('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to post your reply.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike() {
    if (!post || reacting) return;
    setReacting(true);
    setError(null);
    const nextLiked = !liked;
    const previousCount = post.reaction_count || 0;
    setLiked(nextLiked);
    setPost({
      ...post,
      reaction_count: Math.max(0, previousCount + (nextLiked ? 1 : -1)),
    });

    try {
      await setReaction(post.id, nextLiked ? 'like' : null);
    } catch (caught) {
      setLiked(!nextLiked);
      setPost({ ...post, reaction_count: previousCount });
      setError(caught instanceof Error ? caught.message : 'Unable to update reaction.');
    } finally {
      setReacting(false);
    }
  }

  function openProfile(authorId: string) {
    router.push({ pathname: '/community-profile/[id]', params: { id: authorId } });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color="#D7B45A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={(
            <View style={styles.headerStack}>
              <View>
                <Text style={styles.eyebrow}>CAMPFIRE THREAD</Text>
                <Text style={styles.title}>Conversation</Text>
              </View>

              {post ? (
                <View style={styles.originalPost}>
                  <View style={styles.authorLine}>
                    <Pressable
                      style={styles.avatar}
                      onPress={() => openProfile(post.author_id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${post.author_name}'s profile`}
                    >
                      {post.avatar_url ? (
                        <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarFallback}>{initials(post.author_name)}</Text>
                      )}
                    </Pressable>
                    <Pressable style={styles.authorCopy} onPress={() => openProfile(post.author_id)}>
                      <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
                      <Text style={styles.postTime}>{relativeTime(post.created_at)}</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.postBody}>{post.body}</Text>

                  {post.image_url ? (
                    <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
                  ) : null}

                  <View style={styles.engagementRow}>
                    <Text style={styles.engagementText}>{post.reaction_count || 0} reactions</Text>
                    <Text style={styles.engagementDot}>•</Text>
                    <Text style={styles.engagementText}>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</Text>
                  </View>

                  <View style={styles.postActions}>
                    <Pressable
                      style={[styles.actionButton, liked && styles.actionButtonActive]}
                      onPress={() => void toggleLike()}
                      disabled={reacting}
                      accessibilityRole="button"
                      accessibilityState={{ selected: liked, disabled: reacting }}
                    >
                      <Text style={[styles.actionText, liked && styles.actionTextActive]}>{liked ? 'Liked' : 'React'}</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={() => undefined} accessibilityRole="button">
                      <Text style={styles.actionText}>Reply</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {post ? (
                <View style={styles.conversationHeading}>
                  <Text style={styles.conversationTitle}>Conversation</Text>
                  <Text style={styles.replyCount}>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</Text>
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={post ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No replies yet</Text>
              <Text style={styles.emptyText}>Start the conversation.</Text>
            </View>
          ) : null}
          renderItem={({ item }) => {
            const name = item.profiles?.display_name ?? item.profiles?.first_name ?? 'Member';
            return (
              <View style={styles.comment}>
                <Pressable style={styles.commentAvatar} onPress={() => openProfile(item.author_id)}>
                  {item.profiles?.avatar_url ? (
                    <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.commentAvatarFallback}>{initials(name)}</Text>
                  )}
                </Pressable>
                <View style={styles.commentBody}>
                  <View style={styles.commentMeta}>
                    <Pressable onPress={() => openProfile(item.author_id)}>
                      <Text style={styles.commentAuthor}>{name}</Text>
                    </Pressable>
                    <Text style={styles.commentTime}>{relativeTime(item.created_at)}</Text>
                  </View>
                  <Text style={styles.commentText}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />

        {post ? (
          <View style={styles.composerShell}>
            <Text style={styles.composerLabel}>{composerLabel}</Text>
            <View style={styles.composerRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={2000}
                placeholder="Write a reply..."
                placeholderTextColor="#77827B"
                style={styles.input}
                accessibilityLabel={composerLabel}
              />
              <Pressable
                style={[styles.sendButton, (!draft.trim() || submitting) && styles.sendButtonDisabled]}
                onPress={() => void submit()}
                disabled={!draft.trim() || submitting}
                accessibilityRole="button"
              >
                <Text style={styles.sendButtonText}>{submitting ? 'Sending' : 'Send'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  keyboardView: { flex: 1 },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28 },
  headerStack: { gap: 16 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', fontSize: 11, letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 4 },
  originalPost: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#34483D', borderRadius: 22, padding: 16, gap: 14 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { color: '#F0D083', fontWeight: '900' },
  authorCopy: { flex: 1 },
  authorName: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  postTime: { color: '#8D9B92', fontSize: 12, marginTop: 2 },
  postBody: { color: '#E4E9E5', fontSize: 17, lineHeight: 25 },
  postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: '#223229' },
  engagementRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  engagementText: { color: '#98A59D', fontSize: 12, fontWeight: '700' },
  engagementDot: { color: '#53625A', fontSize: 12 },
  postActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2B3B32', paddingTop: 10, gap: 8 },
  actionButton: { flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: '#1F2D25', alignItems: 'center', justifyContent: 'center' },
  actionButtonActive: { backgroundColor: '#D7B45A' },
  actionText: { color: '#C5D0C9', fontWeight: '900', fontSize: 13 },
  actionTextActive: { color: '#17211C' },
  conversationHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 },
  conversationTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  replyCount: { color: '#89978F', fontSize: 12, fontWeight: '700' },
  error: { color: '#FFB4A9', lineHeight: 19 },
  emptyState: { paddingVertical: 34, alignItems: 'center', gap: 5 },
  emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#9DA9A2', fontSize: 14 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#25342C' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#31483B', alignItems: 'center', justifyContent: 'center' },
  commentAvatarFallback: { color: '#F0D083', fontSize: 11, fontWeight: '900' },
  commentBody: { flex: 1, gap: 5 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  commentAuthor: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  commentTime: { color: '#849188', fontSize: 11 },
  commentText: { color: '#D9E0DB', fontSize: 15, lineHeight: 22 },
  composerShell: { borderTopWidth: 1, borderTopColor: '#314238', backgroundColor: '#121C17', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, gap: 7 },
  composerLabel: { color: '#99A69E', fontSize: 11, fontWeight: '800' },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  input: { flex: 1, maxHeight: 112, minHeight: 44, borderRadius: 15, backgroundColor: '#1A2821', borderWidth: 1, borderColor: '#34483D', color: '#FFF8E8', paddingHorizontal: 13, paddingVertical: 11, textAlignVertical: 'top', fontSize: 14 },
  sendButton: { minWidth: 70, height: 44, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: { color: '#17211C', fontWeight: '900', fontSize: 13 },
});