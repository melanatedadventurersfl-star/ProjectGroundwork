import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from '../../../src/hosting/campaigns';
import { assessTaskPack, taskPackByKey, type AssessedTaskPackItem } from '../../../src/hosting/taskPacks';
import { supabase } from '../../../src/lib/supabase';

function eventDate(campaign: HostCampaign) {
  return new Date(campaign.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HostWorkPackScreen() {
  const params = useLocalSearchParams<{ key?: string; event?: string }>();
  const pack = taskPackByKey(params.key);
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [assessment, setAssessment] = useState<AssessedTaskPackItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const assessForCampaign = useCallback(async (campaign: HostCampaign) => {
    if (!pack) return;
    const nextAssessment = await assessTaskPack(campaign, pack);
    setAssessment(nextAssessment);
    setSelectedKeys(nextAssessment.filter((item) => item.state === 'missing').map((item) => item.key));
  }, [pack]);

  const load = useCallback(async () => {
    if (!pack) return;
    setLoading(true); setError('');
    try {
      const next = (await listHostCampaigns()).filter((campaign) => campaign.status !== 'complete');
      setCampaigns(next);
      const preferred = next.find((campaign) => campaign.slug === params.event || campaign.id === params.event);
      const current = next.find((campaign) => campaign.id === selectedCampaignId);
      const chosen = current ?? preferred ?? next[0];
      setSelectedCampaignId(chosen?.id ?? '');
      if (chosen) await assessForCampaign(chosen);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to check existing work.'); }
    finally { setLoading(false); }
  }, [assessForCampaign, pack, params.event, selectedCampaignId]);

  useFocusEffect(useCallback(() => { void load(); }, [pack?.key, params.event]));

  const chooseCampaign = useCallback(async (campaign: HostCampaign) => {
    setEventPickerOpen(false);
    setSelectedCampaignId(campaign.id);
    setLoading(true); setError('');
    try { await assessForCampaign(campaign); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to check existing work.'); }
    finally { setLoading(false); }
  }, [assessForCampaign]);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);
  const completeCount = assessment.filter((item) => item.state === 'complete').length;
  const openCount = assessment.filter((item) => item.state === 'open').length;
  const missingCount = assessment.filter((item) => item.state === 'missing').length;

  const undoAdded = useCallback(async (taskKeys: string[]) => {
    if (!selectedCampaignId || !taskKeys.length) return;
    const { error: deleteError } = await supabase.from('host_campaign_tasks').delete().eq('campaign_id', selectedCampaignId).in('task_key', taskKeys);
    if (deleteError) {
      Alert.alert('Undo failed', deleteError.message);
      return;
    }
    if (selectedCampaign) await assessForCampaign(selectedCampaign);
  }, [assessForCampaign, selectedCampaign, selectedCampaignId]);

  const addMissing = useCallback(async () => {
    if (!pack || !selectedCampaignId) return;
    const selected = assessment.filter((item) => item.state === 'missing' && selectedKeys.includes(item.key));
    if (!selected.length) return;
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const rows = selected.map((item, index) => ({ campaign_id: selectedCampaignId, task_key: `pack-${pack.key}-${item.key}`, title: item.title, category: item.category, owner_label: 'Unassigned', due_label: 'No due date', status: 'not_started', priority: item.priority ?? 'normal', sort_order: 900 + index, created_by: authData.user?.id ?? null, updated_by: authData.user?.id ?? null }));
      const { error: insertError } = await supabase.from('host_campaign_tasks').upsert(rows, { onConflict: 'campaign_id,task_key', ignoreDuplicates: true });
      if (insertError) throw insertError;
      if (selectedCampaign) await assessForCampaign(selectedCampaign);
      const addedKeys = rows.map((row) => row.task_key);
      Alert.alert('Tasks added', `${selected.length} task${selected.length === 1 ? '' : 's'} added to ${selectedCampaign?.shortTitle ?? 'the event'}.`, [
        { text: 'Undo', style: 'destructive', onPress: () => { void undoAdded(addedKeys); } },
        { text: 'Done' },
      ]);
    } catch (caught) { Alert.alert('Tasks not added', caught instanceof Error ? caught.message : 'Try again.'); }
    finally { setSaving(false); }
  }, [assessment, assessForCampaign, pack, selectedCampaign, selectedCampaignId, selectedKeys, undoAdded]);

  if (!pack) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>Task pack unavailable</Text><Pressable onPress={() => router.replace('/host/work' as never)}><Text style={styles.back}>Back to My Work</Text></Pressable></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><View style={styles.screen}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ {pack.shortTitle}</Text></Pressable>
    <View style={[styles.header, { borderTopColor: pack.accent }]}><Text style={styles.icon}>{pack.icon}</Text><View style={{ flex: 1 }}><Text style={[styles.kicker, { color: pack.accent }]}>TASK PACK</Text><Text style={styles.title}>{pack.title}</Text><Text style={styles.subtitle}>We check what is complete, already in My Work, and still missing.</Text></View></View>

    <Text style={styles.label}>APPLY TO</Text>
    <Pressable style={styles.eventSelector} onPress={() => setEventPickerOpen(true)}><View style={{ flex: 1 }}><Text style={styles.eventSelectorTitle} numberOfLines={2}>{selectedCampaign?.shortTitle ?? 'Choose an event'}</Text>{selectedCampaign ? <Text style={styles.eventSelectorDate}>{eventDate(selectedCampaign)}</Text> : null}</View><Text style={styles.chevron}>⌄</Text></Pressable>

    {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Checking this event…</Text></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}

    {!loading && !error ? <>
      <View style={styles.summary}><Summary value={completeCount} label="Complete" /><Summary value={openCount} label="Already in My Work" /><Summary value={missingCount} label="Missing" /></View>
      <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>{selectedCampaign?.shortTitle ?? 'Event'} plan</Text><Text style={styles.sectionMeta}>{selectedKeys.length} missing selected</Text></View><View style={styles.links}><Pressable onPress={() => setSelectedKeys(assessment.filter((item) => item.state === 'missing').map((item) => item.key))}><Text style={styles.link}>All</Text></Pressable><Pressable onPress={() => setSelectedKeys([])}><Text style={styles.link}>Clear</Text></Pressable></View></View>
      <View style={styles.list}>{assessment.map((item, index) => { const selectable = item.state === 'missing'; const selected = selectedKeys.includes(item.key); return <Pressable key={item.key} disabled={!selectable && item.state !== 'open'} onPress={() => item.state === 'open' && item.existingTaskId && selectedCampaign ? router.push(`/host/campaigns/${selectedCampaign.slug}/tasks/${item.existingTaskId}` as never) : selectable ? setSelectedKeys((current) => selected ? current.filter((key) => key !== item.key) : [...current, item.key]) : undefined} style={[styles.row, index > 0 && styles.divider, !selectable && styles.rowMuted]}><View style={[styles.check, item.state === 'complete' && styles.completeCheck, item.state === 'open' && styles.openCheck, selectable && selected && styles.selectedCheck]}><Text style={styles.checkText}>{item.state === 'complete' ? '✓' : item.state === 'open' ? '•' : selected ? '✓' : ''}</Text></View><View style={{ flex: 1 }}><Text style={[styles.rowTitle, !selectable && styles.rowTitleMuted]}>{item.title}</Text><Text style={[styles.state, item.state === 'complete' && styles.completeText, item.state === 'open' && styles.openText]}>{item.state === 'complete' ? item.reason ?? 'Complete' : item.state === 'open' ? 'Already in My Work · tap to open' : 'Missing'}</Text></View></Pressable>; })}</View>
    </> : null}
  </ScrollView>

  {!loading && !error ? <View style={styles.sticky}><Pressable disabled={saving || selectedKeys.length === 0} style={[styles.primary, (saving || selectedKeys.length === 0) && styles.disabled]} onPress={() => void addMissing()}><Text style={styles.primaryText}>{saving ? 'Adding…' : `Add ${selectedKeys.length} Missing Task${selectedKeys.length === 1 ? '' : 's'}`}</Text></Pressable></View> : null}

  <Modal visible={eventPickerOpen} transparent animationType="slide" onRequestClose={() => setEventPickerOpen(false)}><Pressable style={styles.backdrop} onPress={() => setEventPickerOpen(false)}><Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}><View style={styles.handle} /><Text style={styles.sheetTitle}>Choose event</Text>{campaigns.map((campaign) => <Pressable key={campaign.id} style={styles.eventOption} onPress={() => void chooseCampaign(campaign)}><View style={{ flex: 1 }}><Text style={styles.eventOptionTitle}>{campaign.shortTitle}</Text><Text style={styles.eventOptionDate}>{eventDate(campaign)}</Text></View>{campaign.id === selectedCampaignId ? <Text style={styles.selected}>✓</Text> : null}</Pressable>)}</Pressable></Pressable></Modal>
  </View></SafeAreaView>;
}

function Summary({ value, label }: { value: number; label: string }) { return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, screen: { flex: 1 }, content: { padding: 18, paddingBottom: 104 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, back: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginBottom: 14 },
  header: { flexDirection: 'row', gap: 11, borderRadius: 17, borderWidth: 1, borderColor: '#2D3932', borderTopWidth: 3, backgroundColor: '#141B16', padding: 14 }, icon: { fontSize: 25 }, kicker: { fontSize: 7, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFF8E8', fontSize: 21, fontWeight: '900', marginTop: 2 }, subtitle: { color: '#849087', fontSize: 8, lineHeight: 12, marginTop: 4 }, label: { color: '#727E76', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 16 },
  eventSelector: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#121914', paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', marginTop: 8 }, eventSelectorTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, eventSelectorDate: { color: '#A990ED', fontSize: 7, fontWeight: '800', marginTop: 3 }, chevron: { color: '#D7B45A', fontSize: 18 },
  loading: { padding: 26, alignItems: 'center', gap: 7 }, muted: { color: '#7E8A82', fontSize: 8 }, error: { color: '#F3A59A', fontSize: 10, marginTop: 10 }, summary: { flexDirection: 'row', gap: 7, marginTop: 12 }, summaryItem: { flex: 1, minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121914', padding: 9 }, summaryValue: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, summaryLabel: { color: '#7E8A82', fontSize: 6.5, lineHeight: 9, marginTop: 2 },
  sectionHead: { marginTop: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, sectionTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' }, sectionMeta: { color: '#7E8A82', fontSize: 7.5, marginTop: 2 }, links: { flexDirection: 'row', gap: 12 }, link: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  list: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', overflow: 'hidden' }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11 }, rowMuted: { backgroundColor: '#111713' }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932' }, check: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: '#526058', alignItems: 'center', justifyContent: 'center' }, selectedCheck: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, completeCheck: { backgroundColor: '#244B36', borderColor: '#3F7255' }, openCheck: { backgroundColor: '#403721', borderColor: '#6A5A31' }, checkText: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, rowTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' }, rowTitleMuted: { color: '#8C9890' }, state: { color: '#7A867E', fontSize: 7, marginTop: 3 }, completeText: { color: '#77B991' }, openText: { color: '#D7B45A' },
  sticky: { position: 'absolute', left: 12, right: 12, bottom: 8, borderRadius: 16, backgroundColor: '#0A0F0CE8', padding: 6 }, primary: { minHeight: 48, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#172017', fontSize: 10, fontWeight: '900' }, disabled: { opacity: .4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.58)', justifyContent: 'flex-end' }, sheet: { maxHeight: '78%', backgroundColor: '#121814', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, borderWidth: 1, borderColor: '#2F3933' }, handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#47514B', marginBottom: 13 }, sheetTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginBottom: 8 }, eventOption: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B352F' }, eventOptionTitle: { color: '#F4F1E8', fontSize: 11, fontWeight: '800' }, eventOptionDate: { color: '#849087', fontSize: 7.5, marginTop: 3 }, selected: { color: '#A8CF55', fontSize: 17, fontWeight: '900' },
});
