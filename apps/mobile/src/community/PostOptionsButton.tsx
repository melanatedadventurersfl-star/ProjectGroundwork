import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { updatePost } from './api';
import { COMMUNITY_REPORT_REASONS, reportCommunityContent } from './reporting';
import { supabase } from '../lib/supabase';

const GOLD = '#D7B45A';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const PANEL = '#17211C';
const BORDER = '#334139';
const DANGER = '#FF8F87';

type Props = {
  postId: string;
  authorId?: string;
  body?: string;
  onUpdated?: () => void | Promise<void>;
};

export function PostOptionsButton({ postId, authorId, body, onUpdated }: Props) {
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resolvedAuthorId, setResolvedAuthorId] = useState(authorId ?? null);
  const [resolvedBody, setResolvedBody] = useState(body ?? '');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState(body ?? '');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      supabase.auth.getSession(),
      authorId && body !== undefined
        ? Promise.resolve({ data: { author_id: authorId, body }, error: null })
        : supabase.from('community_posts').select('author_id,body').eq('id', postId).maybeSingle(),
    ]).then(([sessionResult, postResult]) => {
      if (cancelled) return;
      setCurrentUserId(sessionResult.data.session?.user.id ?? null);
      if (postResult.data) {
        setResolvedAuthorId(postResult.data.author_id ?? null);
        setResolvedBody(postResult.data.body ?? '');
        setEditBody(postResult.data.body ?? '');
      }
    });
    return () => { cancelled = true; };
  }, [postId, authorId, body]);

  useEffect(() => {
    if (!editOpen) setEditBody(resolvedBody);
  }, [resolvedBody, editOpen]);

  const isOwner = Boolean(resolvedAuthorId && currentUserId && resolvedAuthorId === currentUserId);

  async function saveEdit() {
    if (!editBody.trim() || savingEdit) return;
    setSavingEdit(true);
    setEditStatus(null);
    try {
      await updatePost(postId, editBody);
      setResolvedBody(editBody.trim());
      if (onUpdated) await onUpdated();
      setEditOpen(false);
    } catch (caught) {
      setEditStatus(caught instanceof Error ? caught.message : 'Unable to update this post.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function sharePost() {
    setOptionsOpen(false);
    const url = `melanatedadventurers://community/${postId}`;
    await Share.share({ message: resolvedBody ? `${resolvedBody}\n\n${url}` : url, url }).catch(() => undefined);
  }

  function confirmDelete() {
    setOptionsOpen(false);
    Alert.alert('Delete post?', 'This permanently removes the post and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (!currentUserId) return;
            const { data, error } = await supabase
              .from('community_posts')
              .delete()
              .eq('id', postId)
              .eq('author_id', currentUserId)
              .select('id')
              .maybeSingle();
            if (error) {
              Alert.alert('Could not delete post', error.message);
              return;
            }
            if (!data) {
              Alert.alert('Could not delete post', 'You can only delete posts you created.');
              return;
            }
            if (onUpdated) await onUpdated();
          })();
        },
      },
    ]);
  }

  async function submitReport() {
    if (!reportReason || reporting) return;
    setReporting(true);
    setReportStatus(null);
    try {
      await reportCommunityContent({ kind: 'post', id: postId }, reportReason, reportDetails);
      setReportStatus('Report submitted. Thank you for helping keep the Outpost safe.');
      setReportReason(null);
      setReportDetails('');
    } catch (caught) {
      setReportStatus(caught instanceof Error ? caught.message : 'Unable to submit this report.');
    } finally {
      setReporting(false);
    }
  }

  function openOptions() {
    setReportStatus(null);
    setEditStatus(null);
    if (isOwner) setOptionsOpen(true);
    else setReportOpen(true);
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
        onPress={(event) => { event.stopPropagation(); openOptions(); }}
        accessibilityRole="button"
        accessibilityLabel="Post options"
        hitSlop={8}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={MUTED} />
      </Pressable>

      <Modal transparent visible={optionsOpen} animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOptionsOpen(false)}>
          <Pressable style={[styles.optionsSheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetTopRow}>
              <Text style={styles.sheetTitle}>Post options</Text>
              <Pressable style={styles.closeButton} onPress={() => setOptionsOpen(false)} accessibilityLabel="Close post options">
                <Ionicons name="close" size={19} color={MUTED} />
              </Pressable>
            </View>
            <View style={styles.optionList}>
              <Pressable style={styles.optionRow} onPress={() => { setOptionsOpen(false); setEditBody(resolvedBody); setEditStatus(null); setEditOpen(true); }}>
                <Ionicons name="create-outline" size={20} color={GOLD} />
                <Text style={styles.optionTitle}>Edit post</Text>
              </Pressable>
              <Pressable style={styles.optionRow} onPress={() => void sharePost()}>
                <Ionicons name="share-outline" size={20} color={TEXT} />
                <Text style={styles.optionTitle}>Share post</Text>
              </Pressable>
              <Pressable style={styles.optionRow} onPress={confirmDelete}>
                <Ionicons name="trash-outline" size={20} color={DANGER} />
                <Text style={styles.dangerText}>Delete post</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={editOpen} animationType="slide" onRequestClose={() => !savingEdit && setEditOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => !savingEdit && setEditOpen(false)}>
          <Pressable style={[styles.editSheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetTopRow}>
              <Text style={styles.sheetTitle}>Edit post</Text>
              <Pressable style={styles.closeButton} disabled={savingEdit} onPress={() => setEditOpen(false)}><Ionicons name="close" size={19} color={MUTED} /></Pressable>
            </View>
            <TextInput value={editBody} onChangeText={setEditBody} multiline maxLength={2000} autoFocus placeholder="Write your post..." placeholderTextColor="#75847B" style={styles.editInput} />
            {editStatus ? <Text style={styles.status}>{editStatus}</Text> : null}
            <Pressable style={[styles.saveButton, (!editBody.trim() || savingEdit) && styles.disabled]} disabled={!editBody.trim() || savingEdit} onPress={() => void saveEdit()}>
              <Text style={styles.saveButtonText}>{savingEdit ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={reportOpen} animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setReportOpen(false)}>
          <Pressable style={[styles.reportSheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetTopRow}><Text style={styles.sheetTitle}>Report post</Text><Pressable style={styles.closeButton} onPress={() => setReportOpen(false)}><Ionicons name="close" size={19} color={MUTED} /></Pressable></View>
            <Text style={styles.reportCopy}>Choose the reason that best describes the issue.</Text>
            <View style={styles.reasonList}>
              {COMMUNITY_REPORT_REASONS.map((reason) => (
                <Pressable key={reason} style={[styles.reasonRow, reportReason === reason && styles.reasonRowActive]} onPress={() => setReportReason(reason)}>
                  <Text style={[styles.reasonText, reportReason === reason && styles.reasonTextActive]}>{reason}</Text>
                  {reportReason === reason ? <Ionicons name="checkmark-circle" size={18} color={GOLD} /> : null}
                </Pressable>
              ))}
            </View>
            <TextInput value={reportDetails} onChangeText={setReportDetails} placeholder="Add details (optional)" placeholderTextColor="#75847B" multiline maxLength={600} style={styles.reportInput} />
            {reportStatus ? <Text style={styles.status}>{reportStatus}</Text> : null}
            <Pressable style={[styles.saveButton, (!reportReason || reporting) && styles.disabled]} disabled={!reportReason || reporting} onPress={() => void submitReport()}>
              <Text style={styles.saveButtonText}>{reporting ? 'Submitting…' : 'Submit report'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  moreButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  pressed: { opacity: 0.58 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' },
  optionsSheet: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  editSheet: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  reportSheet: { maxHeight: '88%', backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  sheetTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: TEXT, fontSize: 18, fontWeight: '900' },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#202B25' },
  optionList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  optionRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, paddingHorizontal: 2 },
  optionTitle: { color: TEXT, fontSize: 15, fontWeight: '800' },
  dangerText: { color: DANGER, fontSize: 15, fontWeight: '800' },
  editInput: { minHeight: 126, maxHeight: 250, borderWidth: 1, borderColor: BORDER, borderRadius: 14, backgroundColor: '#121C17', color: TEXT, paddingHorizontal: 12, paddingVertical: 12, textAlignVertical: 'top', fontSize: 15, lineHeight: 22 },
  reportCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18 },
  reasonList: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, overflow: 'hidden' },
  reasonRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  reasonRowActive: { backgroundColor: '#203027' },
  reasonText: { color: '#D7DED9', fontSize: 12.5, fontWeight: '700' },
  reasonTextActive: { color: TEXT },
  reportInput: { minHeight: 72, maxHeight: 120, borderWidth: 1, borderColor: BORDER, borderRadius: 13, backgroundColor: '#121C17', color: TEXT, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top', fontSize: 13 },
  status: { color: '#D8C686', fontSize: 12, lineHeight: 17 },
  saveButton: { minHeight: 44, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#111711', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
