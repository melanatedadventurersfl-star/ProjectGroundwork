import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { setReaction } from './api';
import { COMMUNITY_REPORT_REASONS, reportCommunityContent } from './reporting';
import { supabase } from '../lib/supabase';

const GOLD = '#D7B45A';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const PANEL = '#17211C';
const BORDER = '#334139';

export type CommunityReaction = 'like' | 'love' | 'celebrate' | 'support';

type ReactionMeta = { value: CommunityReaction; emoji: string; label: string };
type ReactionSummary = { reaction: CommunityReaction; count: number };
type Reactor = { profile_id: string; reaction: CommunityReaction; name: string };

const DEFAULT_REACTION: ReactionMeta = { value: 'like', emoji: '👍🏾', label: 'Like' };
const reactions: ReactionMeta[] = [
  DEFAULT_REACTION,
  { value: 'love', emoji: '❤️', label: 'Love' },
  { value: 'celebrate', emoji: '🙌🏾', label: 'Celebrate' },
  { value: 'support', emoji: '🤎', label: 'Support' },
];

function reactionMeta(value: CommunityReaction | null): ReactionMeta {
  return reactions.find((item) => item.value === value) ?? DEFAULT_REACTION;
}

export function PostEngagementBar({
  postId,
  initialReactionCount,
  commentCount,
}: {
  postId: string;
  initialReactionCount: number;
  commentCount: number;
}) {
  const [reactionCount, setReactionCount] = useState(initialReactionCount);
  const [shareCount, setShareCount] = useState(0);
  const [myReaction, setMyReaction] = useState<CommunityReaction | null>(null);
  const [summary, setSummary] = useState<ReactionSummary[]>([]);
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reacting, setReacting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadEngagement() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const [reactionResult, shareResult] = await Promise.all([
        supabase
          .from('community_reactions')
          .select('profile_id,reaction,profiles!community_reactions_profile_id_fkey(display_name,first_name)')
          .eq('post_id', postId),
        supabase
          .from('community_post_shares')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId),
      ]);
      if (!active) return;

      const rows = (reactionResult.data ?? []) as any[];
      const counts = new Map<CommunityReaction, number>();
      const nextReactors: Reactor[] = rows.map((row) => {
        const reaction = row.reaction as CommunityReaction;
        counts.set(reaction, (counts.get(reaction) ?? 0) + 1);
        const profile = row.profiles;
        return {
          profile_id: row.profile_id,
          reaction,
          name: profile?.display_name || profile?.first_name || 'Member',
        };
      });
      const nextSummary = reactions
        .map((item) => ({ reaction: item.value, count: counts.get(item.value) ?? 0 }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);

      setReactors(nextReactors);
      setSummary(nextSummary);
      setReactionCount(rows.length || initialReactionCount);
      setMyReaction((rows.find((row) => row.profile_id === userId)?.reaction as CommunityReaction | undefined) ?? null);
      if (!shareResult.error) setShareCount(shareResult.count ?? 0);
    }
    void loadEngagement();
    return () => { active = false; };
  }, [postId, initialReactionCount]);

  const visibleSummary = useMemo(() => summary.slice(0, 3), [summary]);
  const selectedMeta = reactionMeta(myReaction);

  async function applyReaction(next: CommunityReaction | null) {
    if (reacting) return;
    const previous = myReaction;
    const previousCount = reactionCount;
    const resolved = previous === next ? null : next;
    setReacting(true);
    setPickerOpen(false);
    setMyReaction(resolved);
    setReactionCount(Math.max(0, previousCount + (previous ? 0 : resolved ? 1 : 0) - (previous && !resolved ? 1 : 0)));
    try {
      await setReaction(postId, resolved);
      const { data } = await supabase.from('community_reactions').select('profile_id,reaction,profiles!community_reactions_profile_id_fkey(display_name,first_name)').eq('post_id', postId);
      const rows = (data ?? []) as any[];
      const counts = new Map<CommunityReaction, number>();
      setReactors(rows.map((row) => {
        const reaction = row.reaction as CommunityReaction;
        counts.set(reaction, (counts.get(reaction) ?? 0) + 1);
        return { profile_id: row.profile_id, reaction, name: row.profiles?.display_name || row.profiles?.first_name || 'Member' };
      }));
      setSummary(reactions.map((item) => ({ reaction: item.value, count: counts.get(item.value) ?? 0 })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count));
      setReactionCount(rows.length);
    } catch {
      setMyReaction(previous);
      setReactionCount(previousCount);
    } finally {
      setReacting(false);
    }
  }

  async function sharePost() {
    try {
      const result = await Share.share({ message: 'Check out this post on Melanated.' });
      if (result.action === Share.sharedAction) {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (userId) {
          const { error } = await supabase.from('community_post_shares').insert({ post_id: postId, profile_id: userId });
          if (!error) setShareCount((count) => count + 1);
        }
      }
    } catch {
      // Native share dismissal/errors do not need to interrupt the feed.
    }
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

  return (
    <>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={(event) => { event.stopPropagation(); void applyReaction(myReaction ? null : 'like'); }}
          onLongPress={(event) => { event.stopPropagation(); setPickerOpen(true); }}
          delayLongPress={260}
          accessibilityRole="button"
          accessibilityLabel={myReaction ? `Remove ${selectedMeta.label} reaction` : 'Like post. Hold for more reactions.'}
        >
          <Text style={styles.reactionEmoji}>{myReaction ? selectedMeta.emoji : '♡'}</Text>
          <Text style={[styles.count, myReaction && styles.activeCount]}>{reactionCount}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={(event) => { event.stopPropagation(); router.push(`/community/${postId}`); }}
          accessibilityRole="button"
          accessibilityLabel={`${commentCount} comments`}
        >
          <Ionicons name="chatbubble-outline" size={17} color={MUTED} />
          <Text style={styles.count}>{commentCount}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={(event) => { event.stopPropagation(); void sharePost(); }}
          accessibilityRole="button"
          accessibilityLabel={`Share post. ${shareCount} shares`}
        >
          <Ionicons name="arrow-redo-outline" size={18} color={MUTED} />
          <Text style={styles.count}>{shareCount}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
          onPress={(event) => { event.stopPropagation(); if (reactionCount > 0) setDetailsOpen(true); }}
          disabled={reactionCount === 0}
          accessibilityRole="button"
          accessibilityLabel="See reactions"
        >
          {visibleSummary.map((item, index) => (
            <View key={item.reaction} style={[styles.summaryBubble, index > 0 && styles.summaryOverlap]}>
              <Text style={styles.summaryEmoji}>{reactionMeta(item.reaction).emoji}</Text>
            </View>
          ))}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
          onPress={(event) => { event.stopPropagation(); setReportStatus(null); setReportOpen(true); }}
          accessibilityRole="button"
          accessibilityLabel="Post options"
        >
          <Ionicons name="ellipsis-horizontal" size={17} color={MUTED} />
        </Pressable>
      </View>

      <Modal transparent visible={pickerOpen} animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.picker}>
            {reactions.map((item) => (
              <Pressable key={item.value} style={styles.reactionChoice} onPress={() => void applyReaction(item.value)}>
                <Text style={styles.choiceEmoji}>{item.emoji}</Text>
                <Text style={styles.choiceLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={detailsOpen} animationType="slide" onRequestClose={() => setDetailsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDetailsOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Reactions</Text>
            {reactors.map((reactor) => (
              <View key={reactor.profile_id} style={styles.reactorRow}>
                <Text style={styles.reactorName}>{reactor.name}</Text>
                <Text style={styles.choiceEmoji}>{reactionMeta(reactor.reaction).emoji}</Text>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={reportOpen} animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setReportOpen(false)}>
          <Pressable style={styles.reportSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Report post</Text>
            <Text style={styles.reportCopy}>Choose the reason that best describes the issue.</Text>
            <View style={styles.reasonList}>
              {COMMUNITY_REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  style={[styles.reasonRow, reportReason === reason && styles.reasonRowActive]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text style={[styles.reasonText, reportReason === reason && styles.reasonTextActive]}>{reason}</Text>
                  {reportReason === reason ? <Ionicons name="checkmark-circle" size={18} color={GOLD} /> : null}
                </Pressable>
              ))}
            </View>
            <TextInput
              value={reportDetails}
              onChangeText={setReportDetails}
              placeholder="Add details (optional)"
              placeholderTextColor="#75847B"
              multiline
              maxLength={600}
              style={styles.reportInput}
            />
            {reportStatus ? <Text style={styles.reportStatus}>{reportStatus}</Text> : null}
            <View style={styles.reportActions}>
              <Pressable style={styles.cancelButton} onPress={() => setReportOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.reportButton, (!reportReason || reporting) && styles.disabled]}
                disabled={!reportReason || reporting}
                onPress={() => void submitReport()}
              >
                <Text style={styles.reportButtonText}>{reporting ? 'Submitting…' : 'Submit report'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 34, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#344139', paddingTop: 4 },
  action: { minHeight: 32, minWidth: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 5, paddingHorizontal: 4 },
  reactionEmoji: { fontSize: 17, lineHeight: 21, color: GOLD },
  count: { color: MUTED, fontSize: 12.5, fontWeight: '700' },
  activeCount: { color: GOLD },
  summary: { marginLeft: 'auto', minWidth: 28, minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: 4 },
  summaryBubble: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#223028', borderWidth: 1.5, borderColor: PANEL, alignItems: 'center', justifyContent: 'center' },
  summaryOverlap: { marginLeft: -6 },
  summaryEmoji: { fontSize: 11 },
  moreButton: { width: 30, minHeight: 30, alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 5 },
  pressed: { opacity: 0.62 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end', padding: 18 },
  picker: { alignSelf: 'center', flexDirection: 'row', backgroundColor: '#213028', borderWidth: 1, borderColor: BORDER, borderRadius: 28, paddingHorizontal: 7, paddingVertical: 6, marginBottom: 90, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  reactionChoice: { width: 62, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2 },
  choiceEmoji: { fontSize: 27 },
  choiceLabel: { color: TEXT, fontSize: 10, fontWeight: '800' },
  sheet: { maxHeight: '65%', backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  reportSheet: { maxHeight: '84%', backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22, gap: 10 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#607067', marginBottom: 14 },
  sheetTitle: { color: TEXT, fontSize: 20, fontWeight: '900', marginBottom: 6 },
  reactorRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  reactorName: { color: TEXT, fontSize: 14, fontWeight: '700' },
  reportCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18 },
  reasonList: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, overflow: 'hidden' },
  reasonRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  reasonRowActive: { backgroundColor: '#203027' },
  reasonText: { color: '#D7DED9', fontSize: 12.5, fontWeight: '700' },
  reasonTextActive: { color: TEXT },
  reportInput: { minHeight: 72, maxHeight: 120, borderWidth: 1, borderColor: BORDER, borderRadius: 13, backgroundColor: '#121C17', color: TEXT, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top', fontSize: 13 },
  reportStatus: { color: '#D8C686', fontSize: 12, lineHeight: 17 },
  reportActions: { flexDirection: 'row', gap: 8 },
  cancelButton: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: MUTED, fontSize: 12.5, fontWeight: '800' },
  reportButton: { flex: 1.4, minHeight: 42, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  reportButtonText: { color: '#111711', fontSize: 12.5, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
