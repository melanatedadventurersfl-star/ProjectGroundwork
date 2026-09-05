import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign, updateCampaignDetails, type HostCampaign } from '../../../../src/hosting/campaigns';
import { archiveCampaignWorkspace, cancelCampaignEvent, duplicateCampaignEvent } from '../../../../src/hosting/campaignLifecycle';

type EventStatus = HostCampaign['status'];
type ConfirmAction = 'archive' | 'cancel' | null;

export default function EditHostCampaignScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [title, setTitle] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [status, setStatus] = useState<EventStatus>('planning');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<'duplicate' | 'archive' | 'cancel' | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await getHostCampaign(String(params.id));
      setCampaign(next);
      if (!next) return;
      setTitle(next.title);
      setShortTitle(next.shortTitle);
      setLocation(next.location);
      setStartsAt(toLocalInput(next.startsAt));
      setEndsAt(toLocalInput(next.endsAt));
      setHeroImageUrl(next.heroImageUrl ?? '');
      setStatus(next.status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load event details.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (!campaign || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateCampaignDetails(campaign, {
        title,
        shortTitle,
        location,
        startsAt: parseLocalInput(startsAt),
        endsAt: parseLocalInput(endsAt),
        status,
        heroImageUrl: heroImageUrl.trim() || null,
      });
      setMessage('Event details updated.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save event details.');
    } finally {
      setSaving(false);
    }
  }

  async function duplicateEvent() {
    if (!campaign || actionBusy) return;
    setActionBusy('duplicate');
    setError('');
    setMessage('');
    try {
      const copy = await duplicateCampaignEvent(campaign);
      router.replace(`/host/campaigns/${copy.slug}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to duplicate this event.');
    } finally {
      setActionBusy(null);
    }
  }

  async function archiveEvent() {
    if (!campaign || actionBusy) return;
    setActionBusy('archive');
    setError('');
    try {
      await archiveCampaignWorkspace(campaign);
      setConfirmAction(null);
      router.replace('/host/events' as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to archive this event.');
    } finally {
      setActionBusy(null);
    }
  }

  async function cancelEvent() {
    if (!campaign || actionBusy) return;
    setActionBusy('cancel');
    setError('');
    try {
      await cancelCampaignEvent(campaign);
      setConfirmAction(null);
      router.replace('/host/events' as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to cancel this event.');
    } finally {
      setActionBusy(null);
    }
  }

  if (loading && !campaign) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Opening event details…</Text></View></SafeAreaView>;
  if (!campaign) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Event unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;

  const locked = saving || Boolean(actionBusy) || !campaign.canManage;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT DETAILS</Text>
      </View>

      <Text style={styles.title}>Edit event</Text>
      <Text style={styles.subtitle}>Changes update the Host Center event record. Title, dates, and cover photo also update the linked public adventure.</Text>

      <View style={styles.coverCard}>
        {heroImageUrl.trim() ? <Image source={{ uri: heroImageUrl.trim() }} style={styles.cover} resizeMode="cover" /> : <View style={styles.coverFallback}><Text style={styles.coverFallbackText}>No cover photo</Text></View>}
        <View style={styles.coverCopy}><Text style={styles.cardTitle}>Cover photo</Text><Text style={styles.help}>Paste the existing hosted image URL or a new image URL. The event header updates after you save.</Text></View>
      </View>
      <Field label="Cover photo URL" value={heroImageUrl} onChangeText={setHeroImageUrl} placeholder="https://…" />

      <Field label="Full event title" value={title} onChangeText={setTitle} />
      <Field label="Short title" value={shortTitle} onChangeText={setShortTitle} help="Used in compact Host Center views." />
      <Field label="Location" value={location} onChangeText={setLocation} />
      <Field label="Starts" value={startsAt} onChangeText={setStartsAt} placeholder="2026-09-12 18:00" help="Use YYYY-MM-DD HH:MM." />
      <Field label="Ends" value={endsAt} onChangeText={setEndsAt} placeholder="2026-09-12 22:00" help="Use YYYY-MM-DD HH:MM." />

      <Text style={styles.label}>Status</Text>
      <View style={styles.statusRow}>
        {(['planning', 'live', 'complete'] as EventStatus[]).map((item) => <Pressable key={item} style={[styles.statusChip, status === item && styles.statusChipActive]} onPress={() => setStatus(item)}><Text style={[styles.statusText, status === item && styles.statusTextActive]}>{capitalize(item)}</Text></Pressable>)}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Pressable disabled={locked} style={[styles.saveButton, locked && styles.disabled]} onPress={() => void save()}>
        {saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
      </Pressable>

      {campaign.canManage ? <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Event actions</Text>
        <Text style={styles.actionsHelp}>These actions affect the full event, not one Host Center tab.</Text>

        <Pressable disabled={Boolean(actionBusy)} style={styles.actionRow} onPress={() => void duplicateEvent()}>
          <View style={{ flex: 1 }}><Text style={styles.actionTitle}>Duplicate event</Text><Text style={styles.actionText}>Create a new draft with this event's details, cover, planning tasks, milestones, decisions, dependencies, and marketing plan. Completion and assignments reset.</Text></View>
          {actionBusy === 'duplicate' ? <ActivityIndicator size="small" color="#D7B45A" /> : <Text style={styles.actionChevron}>›</Text>}
        </Pressable>

        <View style={styles.actionDivider} />
        <Pressable disabled={Boolean(actionBusy)} style={styles.actionRow} onPress={() => setConfirmAction(confirmAction === 'archive' ? null : 'archive')}>
          <View style={{ flex: 1 }}><Text style={styles.actionTitle}>Archive workspace</Text><Text style={styles.actionText}>Remove this event from active Host Center planning views without cancelling its public event.</Text></View><Text style={styles.actionChevron}>›</Text>
        </Pressable>
        {confirmAction === 'archive' ? <ConfirmBlock title="Archive this workspace?" body="The Host Center campaign will move to Complete. The linked public event will not be cancelled." busy={actionBusy === 'archive'} confirmLabel="Archive workspace" onCancel={() => setConfirmAction(null)} onConfirm={() => void archiveEvent()} /> : null}

        <View style={styles.actionDivider} />
        <Pressable disabled={Boolean(actionBusy)} style={styles.actionRow} onPress={() => setConfirmAction(confirmAction === 'cancel' ? null : 'cancel')}>
          <View style={{ flex: 1 }}><Text style={styles.dangerTitle}>Cancel event</Text><Text style={styles.actionText}>Cancel the linked public event and close its Host Center workspace.</Text></View><Text style={styles.dangerChevron}>›</Text>
        </Pressable>
        {confirmAction === 'cancel' ? <ConfirmBlock title="Cancel this event?" body="This changes the public adventure to Cancelled and closes the Host Center campaign. Use this only when the event will not take place." busy={actionBusy === 'cancel'} confirmLabel="Cancel event" danger onCancel={() => setConfirmAction(null)} onConfirm={() => void cancelEvent()} /> : null}
      </View> : <Text style={styles.permission}>You can view this event, but your account does not have permission to edit it.</Text>}
    </ScrollView>
  </SafeAreaView>;
}

function ConfirmBlock({ title, body, busy, confirmLabel, danger, onCancel, onConfirm }: { title: string; body: string; busy: boolean; confirmLabel: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <View style={[styles.confirmBlock, danger && styles.confirmDanger]}><Text style={styles.confirmTitle}>{title}</Text><Text style={styles.confirmText}>{body}</Text><View style={styles.confirmButtons}><Pressable disabled={busy} style={styles.cancelButton} onPress={onCancel}><Text style={styles.cancelButtonText}>Keep event</Text></Pressable><Pressable disabled={busy} style={[styles.confirmButton, danger && styles.confirmButtonDanger]} onPress={onConfirm}>{busy ? <ActivityIndicator size="small" color="#FFF8E8" /> : <Text style={styles.confirmButtonText}>{confirmLabel}</Text>}</Pressable></View></View>;
}

function Field({ label, value, onChangeText, placeholder, help }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; help?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#657169" style={styles.input} autoCapitalize="sentences" autoCorrect={false} />{help ? <Text style={styles.help}>{help}</Text> : null}</View>;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalInput(value: string) {
  const normalized = value.trim().replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 18, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#CBD4CE', fontSize: 12, fontWeight: '900' },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 18 },
  subtitle: { color: '#8D9891', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 18 },
  coverCard: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#314039', backgroundColor: '#121A16', padding: 12, marginBottom: 16 },
  cover: { width: 88, height: 108, borderRadius: 12, backgroundColor: '#18211B' },
  coverFallback: { width: 88, height: 108, borderRadius: 12, backgroundColor: '#1A211D', borderWidth: 1, borderColor: '#354139', alignItems: 'center', justifyContent: 'center', padding: 8 },
  coverFallbackText: { color: '#78847D', fontSize: 9, fontWeight: '800', textAlign: 'center' },
  coverCopy: { flex: 1 },
  cardTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  field: { marginBottom: 15 },
  label: { color: '#D6DDD8', fontSize: 10, fontWeight: '900', marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#354139', backgroundColor: '#121A16', color: '#FFF8E8', fontSize: 12, paddingHorizontal: 12 },
  help: { color: '#748079', fontSize: 9, lineHeight: 14, marginTop: 5 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statusChip: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#354139', backgroundColor: '#121A16', alignItems: 'center', justifyContent: 'center' },
  statusChipActive: { borderColor: '#7DA735', backgroundColor: '#1A3118' },
  statusText: { color: '#87928B', fontSize: 10, fontWeight: '900' },
  statusTextActive: { color: '#C9E678' },
  saveButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#E1BC4D', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  saveButtonText: { color: '#172017', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: .45 },
  actionsCard: { marginTop: 22, borderRadius: 16, borderWidth: 1, borderColor: '#314039', backgroundColor: '#101713', overflow: 'hidden' },
  actionsTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', paddingHorizontal: 14, paddingTop: 14 },
  actionsHelp: { color: '#7E8982', fontSize: 9.5, lineHeight: 14, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  actionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  actionDivider: { height: 1, backgroundColor: '#27312B', marginHorizontal: 14 },
  actionTitle: { color: '#F4F1E8', fontSize: 12.5, fontWeight: '900' },
  dangerTitle: { color: '#FF8178', fontSize: 12.5, fontWeight: '900' },
  actionText: { color: '#7E8982', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  actionChevron: { color: '#D7B45A', fontSize: 22, fontWeight: '900' },
  dangerChevron: { color: '#FF8178', fontSize: 22, fontWeight: '900' },
  confirmBlock: { marginHorizontal: 12, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: '#554922', backgroundColor: '#1B180F', padding: 12 },
  confirmDanger: { borderColor: '#64302C', backgroundColor: '#1B1110' },
  confirmTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },
  confirmText: { color: '#9B9688', fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  confirmButtons: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cancelButton: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#39443D', alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: '#C7D0CA', fontSize: 10, fontWeight: '900' },
  confirmButton: { flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: '#967D2D', alignItems: 'center', justifyContent: 'center' },
  confirmButtonDanger: { backgroundColor: '#A54039' },
  confirmButtonText: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' },
  error: { color: '#FF8178', fontSize: 10, lineHeight: 15, marginBottom: 10 },
  success: { color: '#A8CF55', fontSize: 10, fontWeight: '800', marginBottom: 10 },
  muted: { color: '#8D9891', fontSize: 11 },
  permission: { color: '#7E8982', fontSize: 9.5, lineHeight: 14, textAlign: 'center', marginTop: 10 },
});
