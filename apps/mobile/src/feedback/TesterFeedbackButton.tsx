import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FeedbackCategory, submitTesterFeedback } from './api';

const options: Array<{ key: FeedbackCategory; label: string; icon: string }> = [
  { key: 'problem', label: 'Report a problem', icon: 'bug-outline' },
  { key: 'idea', label: 'Share an idea', icon: 'bulb-outline' },
  { key: 'confusing', label: 'Something is confusing', icon: 'help-circle-outline' },
  { key: 'design', label: 'Design / UI feedback', icon: 'color-palette-outline' },
  { key: 'other', label: 'Other', icon: 'chatbubble-ellipses-outline' },
];

export function TesterFeedbackButton({ screenPath, hidden = false }: { screenPath: string; hidden?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('problem');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);

  const selectedLabel = useMemo(() => options.find((option) => option.key === category)?.label ?? 'Feedback', [category]);

  if (hidden) return null;

  function close() {
    if (submitting) return;
    setVisible(false);
    setError(null);
    setConfirmationId(null);
    setMessage('');
    setCategory('problem');
  }

  async function submit() {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitTesterFeedback({ category, message, screenPath });
      setConfirmationId(result.id);
      setMessage('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send feedback right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Send tester feedback" style={styles.fab} onPress={() => setVisible(true)}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#102018" />
        <Text style={styles.fabLabel}>Feedback</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>PILOT FEEDBACK</Text>
                <Text style={styles.title}>What did you notice?</Text>
                <Text style={styles.subtitle}>We automatically attach this screen and app build to your report.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close feedback" onPress={close} hitSlop={10}>
                <Ionicons name="close" size={26} color="#F8F1DF" />
              </Pressable>
            </View>

            {confirmationId ? (
              <View style={styles.successCard}>
                <Ionicons name="checkmark-circle" size={36} color="#D7B45A" />
                <Text style={styles.successTitle}>Feedback sent</Text>
                <Text style={styles.successBody}>Thanks for helping us improve Go Melanated.</Text>
                <Text style={styles.ticket}>GM-{confirmationId.slice(0, 8).toUpperCase()}</Text>
                <Pressable style={styles.primaryButton} onPress={close}><Text style={styles.primaryButtonText}>Done</Text></Pressable>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                  {options.map((option) => {
                    const selected = option.key === category;
                    return (
                      <Pressable key={option.key} style={[styles.option, selected && styles.optionSelected]} onPress={() => setCategory(option.key)}>
                        <Ionicons name={option.icon as never} size={17} color={selected ? '#102018' : '#D9D4C6'} />
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={styles.fieldLabel}>{selectedLabel}</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Describe what happened, what felt off, or what you think would make this better…"
                  placeholderTextColor="#6F7B73"
                  multiline
                  maxLength={4000}
                  textAlignVertical="top"
                  style={styles.input}
                />
                <View style={styles.metaCard}>
                  <Ionicons name="navigate-circle-outline" size={18} color="#D7B45A" />
                  <Text style={styles.metaText} numberOfLines={2}>Screen: {screenPath || '/'}</Text>
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable style={[styles.primaryButton, (!message.trim() || submitting) && styles.primaryButtonDisabled]} disabled={!message.trim() || submitting} onPress={submit}>
                  {submitting ? <ActivityIndicator color="#102018" /> : <Text style={styles.primaryButtonText}>Send feedback</Text>}
                </Pressable>
                <Text style={styles.privacyNote}>Never include passwords, payment details, or other sensitive information in feedback.</Text>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 14,
    bottom: 86,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: '#D7B45A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabLabel: { color: '#102018', fontWeight: '900', fontSize: 13 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4, 10, 7, 0.58)' },
  sheet: { maxHeight: '86%', backgroundColor: '#142119', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingBottom: 22, borderWidth: 1, borderColor: '#263B2D' },
  handle: { width: 46, height: 5, borderRadius: 4, backgroundColor: '#425449', alignSelf: 'center', marginTop: 9, marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 10, letterSpacing: 1.4, fontWeight: '900' },
  title: { color: '#FFF8E8', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A7B0AA', fontSize: 13, lineHeight: 19, marginTop: 5 },
  formContent: { paddingTop: 18, paddingBottom: 10 },
  optionRow: { gap: 8, paddingBottom: 18 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#34483A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#1B2A20' },
  optionSelected: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  optionLabel: { color: '#D9D4C6', fontSize: 12, fontWeight: '800' },
  optionLabelSelected: { color: '#102018' },
  fieldLabel: { color: '#EDE5D3', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: { minHeight: 150, borderRadius: 18, borderWidth: 1, borderColor: '#34483A', backgroundColor: '#0F1813', color: '#FFF8E8', padding: 14, fontSize: 15, lineHeight: 21 },
  metaCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: '#1A291F' },
  metaText: { flex: 1, color: '#AAB5AE', fontSize: 12 },
  error: { color: '#FF9A91', fontSize: 13, marginTop: 10 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#D7B45A', marginTop: 16, paddingHorizontal: 18 },
  primaryButtonDisabled: { opacity: 0.48 },
  primaryButtonText: { color: '#102018', fontSize: 15, fontWeight: '900' },
  privacyNote: { color: '#76827B', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
  successCard: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12 },
  successTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 10 },
  successBody: { color: '#A7B0AA', fontSize: 14, textAlign: 'center', marginTop: 5 },
  ticket: { color: '#D7B45A', fontWeight: '900', letterSpacing: 0.8, marginTop: 12 },
});
