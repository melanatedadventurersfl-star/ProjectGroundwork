import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { COMMUNITY_REPORT_REASONS, reportCommunityContent } from './reporting';

const GOLD = '#D7B45A';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const PANEL = '#17211C';
const BORDER = '#334139';

export function PostOptionsButton({ postId }: { postId: string }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

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
      <Pressable
        style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
        onPress={(event) => {
          event.stopPropagation();
          setReportStatus(null);
          setReportOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Post options"
        hitSlop={8}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={MUTED} />
      </Pressable>

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
  moreButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  pressed: { opacity: 0.58 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end', padding: 18 },
  reportSheet: { maxHeight: '84%', backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22, gap: 10 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#607067', marginBottom: 14 },
  sheetTitle: { color: TEXT, fontSize: 20, fontWeight: '900', marginBottom: 6 },
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