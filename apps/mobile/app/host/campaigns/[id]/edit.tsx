import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHostCampaign, updateCampaignDetails, type HostCampaign } from '../../../../src/hosting/campaigns';
import { archiveCampaignWorkspace, cancelCampaignEvent, duplicateCampaignEvent } from '../../../../src/hosting/campaignLifecycle';
import {
  getEventDistributionState,
  hasPublicationDrift,
  isGoMelanatedPublished,
  publishHostCampaign,
  type EventDistributionState,
} from '../../../../src/hosting/distribution';

type ConfirmAction = 'archive' | 'cancel' | null;
type BusyAction = 'publish' | 'duplicate' | 'archive' | 'cancel' | null;

export default function EditHostCampaignScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<HostCampaign | null>(null);
  const [distribution, setDistribution] = useState<EventDistributionState | null>(null);
  const [title, setTitle] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<BusyAction>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await getHostCampaign(String(params.id));
      setCampaign(next);
      if (!next) {
        setDistribution(null);
        return;
      }
      const nextDistribution = await getEventDistributionState(next.id, next.adventureId);
      setDistribution(nextDistribution);
      setTitle(next.title);
      setShortTitle(next.shortTitle);
      setLocation(next.location);
      setStartsAt(toLocalInput(next.startsAt));
      setEndsAt(toLocalInput(next.endsAt));
      setHeroImageUrl(next.heroImageUrl ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load event details.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function persistDetails() {
    if (!campaign) return;
    await updateCampaignDetails(campaign, {
      title,
      shortTitle,
      location,
      startsAt: parseLocalInput(startsAt),
      endsAt: parseLocalInput(endsAt),
      status: campaign.status,
      heroImageUrl: heroImageUrl.trim() || null,
    });
  }

  async function save() {
    if (!campaign || saving || actionBusy) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await persistDetails();
      setMessage(isGoMelanatedPublished(distribution) ? 'Event details updated.' : 'Draft saved. The event is not public until you choose Publish event.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save event details.');
    } finally {
      setSaving(false);
    }
  }

  async function publishEvent() {
    if (!campaign || actionBusy || saving) return;
    setActionBusy('publish');
    setError('');
    setMessage('');
    try {
      await persistDetails();
      await publishHostCampaign(campaign.id);
      setMessage('Published to Go Melanated. Host Center and the member event are now live together.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish this event.');
    } finally {
      setActionBusy(null);
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

  if (loading && !campaign) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Opening event details…</Text></View></SafeAreaView>;
  }

  if (!campaign) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Event unavailable</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;
  }

  const published = isGoMelanatedPublished(distribution);
  const drift = hasPublicationDrift(campaign.status, distribution);
  const publicStatus = distribution?.adventureStatus ?? 'draft';
  const publicationClosed = campaign.status === 'complete' || ['cancelled', 'completed'].includes(publicStatus);
  const locked = saving || Boolean(actionBusy) || !campaign.canManage;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Event</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT DETAILS</Text>
      </View>

      <Text style={styles.title}>Edit event</Text>
      <Text style={styles.subtitle}>Save changes without publishing. Publish event is the single action that makes the linked Go Melanated event live.</Text>

      <View style={[styles.publicationCard, drift && styles.publicationWarning]}>
        <View style={styles.publicationHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.publicationEyebrow}>PUBLICATION</Text>
            <Text style={styles.publicationTitle}>{published ? 'Published to Go Melanated' : drift ? 'Publication needs attention' : 'Draft event'}</Text>
          </View>
          <View style={[styles.publicationDot, published && styles.publicationDotLive, drift && styles.publicationDotWarning]} />
        </View>

        <View style={styles.stateRow}>
          <StateCell label="Host Center" value={capitalize(campaign.status)} active={campaign.status === 'live'} />
          <StateCell label="Go Melanated" value={formatPublicStatus(publicStatus)} active={published} warning={drift} />
        </View>

        <Text style={styles.publicationBody}>
          {drift
            ? 'Host Center is marked Live, but the member-facing event is not published. Publish event repairs both records together.'
            : published
              ? 'Members can discover this event in Go Melanated. Future destination publishers can attach to the same Host Center event.'
              : publicationClosed
                ? 'This event is closed. Reopen or duplicate it before publishing a new listing.'
                : 'Save your setup as often as needed. Nothing appears in the member app until you publish.'}
        </Text>

        {campaign.canManage && !published && !publicationClosed ? <Pressable disabled={locked} style={[styles.publishButton, locked && styles.disabled]} onPress={() => void publishEvent()}>
          {actionBusy === 'publish' ? <ActivityIndicator color="#172017" /> : <Text style={styles.publishButtonText}>{drift ? 'Finish publishing to Go Melanated' : 'Publish event'}</Text>}
        </Pressable> : null}

        {published ? <Pressable style={styles.openPublicButton} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: campaign.adventureId } } as never)}><Text style={styles.openPublicText}>Open member event ›</Text></Pressable> : null}
      </View>

      <View style={styles.coverCard}>
        {heroImageUrl.trim() ? <Image source={{ uri: heroImageUrl.trim() }} style={styles.cover} resizeMode="cover" /> : <View style={styles.coverFallback}><Text style={styles.coverFallbackText}>No cover photo</Text></View>}
        <View style={styles.coverCopy}><Text style={styles.cardTitle}>Cover photo</Text><Text style={styles.help}>Paste an existing hosted image URL or a new image URL. The Host Center and member event use the same cover.</Text></View>
      </View>
      <Field label="Cover photo URL" value={heroImageUrl} onChangeText={setHeroImageUrl} placeholder="https://…" />

      <Field label="Full event title" value={title} onChangeText={setTitle} />
      <Field label="Short title" value={shortTitle} onChangeText={setShortTitle} help="Used in compact Host Center views." />
      <Field label="Location" value={location} onChangeText={setLocation} />
      <Field label="Starts" value={startsAt} onChangeText={setStartsAt} placeholder="2026-09-12 18:00" help="Use YYYY-MM-DD HH:MM." />
      <Field label="Ends" value={endsAt} onChangeText={setEndsAt} placeholder="2026-09-12 22:00" help="Use YYYY-MM-DD HH:MM." />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Pressable disabled={locked} style={[styles.saveButton, locked && styles.disabled]} onPress={() => void save()}>
        {saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.saveButtonText}>{published ? 'Save changes' : 'Save draft'}</Text>}
      </Pressable>
      {!published ? <Text style={styles.saveHelp}>Saving does not publish the event.</Text> : null}

      {campaign.canManage ? <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Event actions</Text>
        <Text style={styles.actionsHelp}>These actions affect the full event, not one Host Center tab.</Text>

        <Pressable disabled={Boolean(actionBusy)} style={styles.actionRow} onPress={() => void duplicateEvent()}>
          <View style={{ flex: 1 }}><Text style={styles.actionTitle}>Duplicate event</Text><Text style={styles.actionText}>Create a new draft with event details, cover, planning tasks, milestones, decisions, dependencies, and marketing plan. Completion and assignments reset.</Text></View>
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

function StateCell({ label, value, active, warning }: { label: string; value: string; active?: boolean; warning?: boolean }) {
  return <View style={styles.stateCell}><Text style={styles.stateLabel}>{label}</Text><Text style={[styles.stateValue, active && styles.stateValueLive, warning && styles.stateValueWarning]}>{value}</Text></View>;
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
function formatPublicStatus(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 18, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  muted: { color: '#8D9891', fontSize: 11 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#CBD4CE', fontSize: 12, fontWeight: '900' },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 18 },
  subtitle: { color: '#8D9891', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 16 },
  publicationCard: { borderRadius: 17, borderWidth: 1, borderColor: '#3B4B42', backgroundColor: '#111914', padding: 14, marginBottom: 18 },
  publicationWarning: { borderColor: '#8A6730', backgroundColor: '#1E1A10' },
  publicationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  publicationEyebrow: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: .9 },
  publicationTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 3 },
  publicationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#68736C' },
  publicationDotLive: { backgroundColor: '#90C96B' },
  publicationDotWarning: { backgroundColor: '#E6A155' },
  stateRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  stateCell: { flex: 1, minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#0F1612', padding: 10, justifyContent: 'center' },
  stateLabel: { color: '#758179', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  stateValue: { color: '#E8E7E0', fontSize: 12, fontWeight: '900', marginTop: 3 },
  stateValueLive: { color: '#C9E678' },
  stateValueWarning: { color: '#E6B15F' },
  publicationBody: { color: '#8D9891', fontSize: 10.5, lineHeight: 16, marginTop: 12 },
  publishButton: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  publishButtonText: { color: '#172017', fontSize: 12, fontWeight: '900' },
  openPublicButton: { marginTop: 11, alignSelf: 'flex-start' },
  openPublicText: { color: '#D7B45A', fontSize: 10.5, fontWeight: '900' },
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
  saveButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#E1BC4D', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  saveButtonText: { color: '#172017', fontSize: 13, fontWeight: '900' },
  saveHelp: { color: '#748079', fontSize: 9, textAlign: 'center', marginTop: 6 },
  disabled: { opacity: .45 },
  actionsCard: { marginTop: 22, borderRadius: 16, borderWidth: 1, borderColor: '#314039', backgroundColor: '#101713', overflow: 'hidden' },
  actionsTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', paddingHorizontal: 14, paddingTop: 14 },
  actionsHelp: { color: '#7E8982', fontSize: 9.5, lineHeight: 14, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  actionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  actionDivider: { height: 1, backgroundColor: '#27312B', marginHorizontal: 14 },
  actionTitle: { color: '#F4F1E8', fontSize: 12.5, fontWeight: '900' },
  actionText: { color: '#818C85', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  actionChevron: { color: '#D7B45A', fontSize: 22, fontWeight: '900' },
  dangerTitle: { color: '#E68A7F', fontSize: 12.5, fontWeight: '900' },
  dangerChevron: { color: '#E68A7F', fontSize: 22, fontWeight: '900' },
  confirmBlock: { marginHorizontal: 12, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: '#4B4430', backgroundColor: '#18170F', padding: 12 },
  confirmDanger: { borderColor: '#68443E', backgroundColor: '#211614' },
  confirmTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' },
  confirmText: { color: '#8D9891', fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  confirmButtons: { flexDirection: 'row', gap: 8, marginTop: 11 },
  cancelButton: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#38443D', alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: '#B7C0BA', fontSize: 9.5, fontWeight: '900' },
  confirmButton: { flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: '#735F2A', alignItems: 'center', justifyContent: 'center' },
  confirmButtonDanger: { backgroundColor: '#7D3F38' },
  confirmButtonText: { color: '#FFF8E8', fontSize: 9.5, fontWeight: '900' },
  error: { color: '#E58E84', fontSize: 10.5, lineHeight: 16, marginTop: 9 },
  success: { color: '#A9D38C', fontSize: 10.5, lineHeight: 16, marginTop: 9 },
  permission: { color: '#8D9891', fontSize: 10.5, lineHeight: 16, marginTop: 18 },
});
