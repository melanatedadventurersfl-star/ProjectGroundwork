import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';

type SupportRequest = {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  attachments: string[] | null;
  created_at: string;
  updated_at: string;
};

type Attachment = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

const categories = ['Account', 'Adventure / Event', 'Payment', 'Technical Issue', 'Safety / Report', 'Other'] as const;
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();

function statusLabel(status: string) {
  switch (status) {
    case 'waiting_on_member': return 'Waiting on you';
    case 'in_review': return 'In review';
    case 'resolved': return 'Resolved';
    case 'closed': return 'Closed';
    default: return 'Submitted';
  }
}

function ticketNumber(id: string) {
  return `MA-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SupportScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [category, setCategory] = useState<(typeof categories)[number]>('Account');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const diagnostics = useMemo(() => ({
    app_version: Constants.expoConfig?.version ?? 'unknown',
    app_env: process.env.EXPO_PUBLIC_APP_ENV ?? 'unknown',
    platform: Platform.OS,
    os_version: String(Platform.Version),
    runtime_version: Constants.expoConfig?.runtimeVersion ?? null,
  }), []);

  const loadRequests = useCallback(async () => {
    if (!userId) return;
    const { data, error: requestError } = await supabase
      .from('support_requests')
      .select('id,category,subject,message,status,attachments,created_at,updated_at')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });
    if (requestError) throw requestError;
    setRequests((data ?? []) as SupportRequest[]);
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadRequests()
      .catch((caught) => mounted && setError(caught instanceof Error ? caught.message : 'Unable to load support requests.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [loadRequests]);

  async function refresh() {
    setRefreshing(true);
    setError('');
    try { await loadRequests(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to refresh support requests.'); }
    finally { setRefreshing(false); }
  }

  async function pickAttachment() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAttachment({ uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
  }

  async function uploadAttachment(profileId: string) {
    if (!attachment) return [] as string[];
    const response = await fetch(attachment.uri);
    const bytes = await response.arrayBuffer();
    const extension = attachment.fileName?.split('.').pop()?.toLowerCase() || attachment.mimeType?.split('/').pop() || 'jpg';
    const path = `${profileId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('support-attachments')
      .upload(path, bytes, { contentType: attachment.mimeType ?? 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;
    return [path];
  }

  async function submit() {
    if (!userId) {
      setError('Please sign in again before contacting support.');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setError('Add a subject and message so we know how to help.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const attachments = await uploadAttachment(userId);
      const { data, error: insertError } = await supabase
        .from('support_requests')
        .insert({
          profile_id: userId,
          category,
          subject: subject.trim(),
          message: message.trim(),
          status: 'open',
          attachments,
          diagnostics,
        })
        .select('id,category,subject,message,status,attachments,created_at,updated_at')
        .single();
      if (insertError) throw insertError;

      setRequests((current) => [data as SupportRequest, ...current]);
      setSubject('');
      setMessage('');
      setAttachment(null);
      Alert.alert('Support request submitted', `Your request number is ${ticketNumber(data.id)}. You can track it here.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit your support request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function emailSupport() {
    if (!supportEmail) return;
    const subjectLine = encodeURIComponent(subject.trim() || 'Melanated App Support');
    const body = encodeURIComponent(message.trim());
    await Linking.openURL(`mailto:${supportEmail}?subject=${subjectLine}&body=${body}`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#D7B45A" />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.eyebrow}>HELP & SUPPORT</Text>
        <Text style={styles.title}>How can we help?</Text>
        <Text style={styles.intro}>Send us a request without leaving the app. Your app version and device details are included automatically so we can troubleshoot faster.</Text>

        <View style={styles.primaryCard}>
          <Text style={styles.cardTitle}>Contact Support</Text>
          <Text style={styles.label}>Topic</Text>
          <View style={styles.chips}>
            {categories.map((item) => (
              <Pressable key={item} style={[styles.chip, category === item && styles.chipActive]} onPress={() => setCategory(item)}>
                <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Subject</Text>
          <TextInput value={subject} onChangeText={setSubject} placeholder="What do you need help with?" placeholderTextColor="#728078" style={styles.input} />

          <Text style={styles.label}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what happened and what you expected to happen."
            placeholderTextColor="#728078"
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.messageInput]}
          />

          {attachment ? (
            <View style={styles.attachmentRow}>
              <Image source={{ uri: attachment.uri }} style={styles.attachmentPreview} />
              <View style={styles.attachmentCopy}><Text style={styles.attachmentTitle}>Screenshot attached</Text><Text style={styles.muted}>Up to 10 MB</Text></View>
              <Pressable onPress={() => setAttachment(null)}><Text style={styles.remove}>Remove</Text></Pressable>
            </View>
          ) : (
            <Pressable style={styles.secondaryButton} onPress={() => void pickAttachment()}>
              <Text style={styles.secondaryButtonText}>+ Add Screenshot or Photo</Text>
            </Pressable>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.submit, submitting && styles.disabled]} disabled={submitting} onPress={() => void submit()}>
            <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit Request'}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.safetyCard} onPress={() => { setCategory('Safety / Report'); setSubject('Safety concern'); }}>
          <View><Text style={styles.safetyTitle}>Report a Safety Concern</Text><Text style={styles.muted}>For member conduct, event safety, or something that needs prompt attention.</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionEyebrow}>MY SUPPORT REQUESTS</Text><Text style={styles.sectionTitle}>Track your requests</Text></View>
          <Pressable onPress={() => void refresh()}><Text style={styles.refresh}>Refresh</Text></Pressable>
        </View>

        {loading ? <ActivityIndicator color="#D7B45A" style={styles.loader} /> : null}
        {!loading && requests.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No support requests yet</Text><Text style={styles.muted}>When you contact us, your request and status will appear here.</Text></View> : null}
        {requests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <View style={styles.requestTop}>
              <Text style={styles.ticket}>{ticketNumber(request.id)}</Text>
              <View style={styles.statusPill}><Text style={styles.statusText}>{statusLabel(request.status)}</Text></View>
            </View>
            <Text style={styles.requestSubject}>{request.subject}</Text>
            <Text style={styles.requestMeta}>{request.category} · {formatDate(request.created_at)}</Text>
            <Text style={styles.requestMessage} numberOfLines={3}>{request.message}</Text>
          </View>
        ))}

        <View style={styles.helpRow}>
          <Pressable style={styles.helpCard} onPress={() => router.push('/trail-guide' as never)}><Text style={styles.helpTitle}>Help & FAQs</Text><Text style={styles.muted}>Open the Trail Guide</Text></Pressable>
          <Pressable style={[styles.helpCard, !supportEmail && styles.disabled]} disabled={!supportEmail} onPress={() => void emailSupport()}><Text style={styles.helpTitle}>Email Us</Text><Text style={styles.muted}>{supportEmail ?? 'Email fallback not configured'}</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 60 },
  back: { color: '#D7B45A', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 5 },
  intro: { color: '#AEB8B2', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  primaryCard: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2A3931', borderRadius: 20, padding: 18, gap: 10 },
  cardTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginBottom: 2 },
  label: { color: '#D4DCD7', fontSize: 12, fontWeight: '900', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#3A4B42', backgroundColor: '#111A16', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999 },
  chipActive: { borderColor: '#D7B45A', backgroundColor: '#2B2A1B' },
  chipText: { color: '#AEB8B2', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#F3D477' },
  input: { backgroundColor: '#0F1713', color: '#FFF8E8', borderWidth: 1, borderColor: '#33443A', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15 },
  messageInput: { minHeight: 132 },
  secondaryButton: { borderWidth: 1, borderColor: '#495D51', borderRadius: 13, padding: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#D7B45A', fontWeight: '900' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#33443A', borderRadius: 13, padding: 9 },
  attachmentPreview: { width: 52, height: 52, borderRadius: 9 },
  attachmentCopy: { flex: 1 },
  attachmentTitle: { color: '#FFF8E8', fontWeight: '800' },
  remove: { color: '#FFB4A9', fontWeight: '800' },
  submit: { backgroundColor: '#D7B45A', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 2 },
  submitText: { color: '#111712', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#FFB4A9', lineHeight: 20 },
  safetyCard: { marginTop: 14, borderWidth: 1, borderColor: '#7A4B43', backgroundColor: '#261A18', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  safetyTitle: { color: '#FFD5CF', fontSize: 17, fontWeight: '900', marginBottom: 4 },
  chevron: { color: '#E9A49A', fontSize: 28, fontWeight: '700' },
  muted: { color: '#89968E', fontSize: 12, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30, marginBottom: 10 },
  sectionEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 3 },
  refresh: { color: '#D7B45A', fontWeight: '900', paddingVertical: 6 },
  loader: { marginVertical: 24 },
  empty: { borderWidth: 1, borderColor: '#29372F', borderRadius: 16, padding: 18, backgroundColor: '#141E19' },
  emptyTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 16, marginBottom: 4 },
  requestCard: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#26332C', padding: 15, marginBottom: 10 },
  requestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ticket: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  statusPill: { backgroundColor: '#26372E', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: '#DDE9E1', fontSize: 10, fontWeight: '900' },
  requestSubject: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 9 },
  requestMeta: { color: '#89968E', fontSize: 11, fontWeight: '700', marginTop: 3 },
  requestMessage: { color: '#AEB8B2', lineHeight: 20, marginTop: 8 },
  helpRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  helpCard: { flex: 1, minHeight: 92, backgroundColor: '#141E19', borderWidth: 1, borderColor: '#29372F', borderRadius: 15, padding: 14 },
  helpTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginBottom: 4 },
});