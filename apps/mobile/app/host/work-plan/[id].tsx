import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { buildAiWorkTasks, addSelectedAiWorkTasks, type AiWorkTask } from '../../../src/hosting/aiWorkPlan';
import { getCampaignForAdventure } from '../../../src/hosting/eventBuilder';

export default function AiWorkPlanReviewScreen() {
  const { id, packs } = useLocalSearchParams<{ id: string; packs?: string }>();
  const packList = useMemo(() => String(packs || 'communications,event_day').split(',').map((item) => item.trim()).filter(Boolean), [packs]);
  const tasks = useMemo(() => buildAiWorkTasks(packList), [packList]);
  const [selected, setSelected] = useState<Set<string>>(new Set(tasks.map((task) => task.id)));
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void getCampaignForAdventure(id).then((value) => {
      if (!value) throw new Error('Event workspace not found.');
      setCampaign(value);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load work plan.')).finally(() => setLoading(false));
  }, [id]);

  function toggle(task: AiWorkTask) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
      return next;
    });
  }

  function togglePack(pack: string) {
    const packTasks = tasks.filter((task) => task.pack === pack);
    const allSelected = packTasks.every((task) => selected.has(task.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const task of packTasks) allSelected ? next.delete(task.id) : next.add(task.id);
      return next;
    });
  }

  async function addWork() {
    if (!campaign) return;
    setSaving(true); setError('');
    try {
      await addSelectedAiWorkTasks(campaign.id, campaign.starts_at, tasks.filter((task) => selected.has(task.id)));
      router.replace(`/host/manage/${id}` as never);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add the work plan.'); }
    finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.loading}>Building your work plan…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>BUILD MY WORK PLAN</Text>
    <Text style={styles.title}>Turn the event into actionable work.</Text>
    <Text style={styles.subtitle}>The AI selected task packs from the event plan. Everything starts selected, but you control what gets added.</Text>

    <View style={styles.summary}><Text style={styles.summaryValue}>{selected.size}</Text><Text style={styles.summaryLabel}>tasks selected</Text><Text style={styles.summaryMeta}>{packList.length} recommended work packs</Text></View>

    {packList.map((pack) => {
      const packTasks = tasks.filter((task) => task.pack === pack);
      const selectedCount = packTasks.filter((task) => selected.has(task.id)).length;
      return <View key={pack} style={styles.pack}>
        <Pressable style={styles.packHeader} onPress={() => togglePack(pack)}><View><Text style={styles.packTitle}>{pack.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</Text><Text style={styles.packMeta}>{selectedCount} of {packTasks.length} selected</Text></View><Text style={styles.packAction}>{selectedCount === packTasks.length ? 'Remove all' : 'Select all'}</Text></Pressable>
        {packTasks.map((task) => <Pressable key={task.id} style={styles.task} onPress={() => toggle(task)}><View style={[styles.check, selected.has(task.id) && styles.checkActive]}><Text style={styles.checkText}>{selected.has(task.id) ? '✓' : ''}</Text></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.category} · {task.daysBefore > 0 ? `${task.daysBefore} days before` : task.daysBefore === 0 ? 'Event day' : `${Math.abs(task.daysBefore)} day after`}{task.priority !== 'normal' ? ` · ${task.priority}` : ''}</Text></View></Pressable>)}
      </View>;
    })}

    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable disabled={saving} style={styles.primary} onPress={() => void addWork()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Add {selected.size} Tasks & Open Event</Text>}</Pressable>
    <Pressable onPress={() => router.replace(`/host/manage/${id}` as never)}><Text style={styles.skip}>Skip for now</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', gap: 8 }, loading: { color: '#8E9992', fontSize: 10 }, content: { padding: 18, paddingBottom: 70 }, eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 12, lineHeight: 18, marginTop: 6 }, summary: { borderRadius: 16, borderWidth: 1, borderColor: '#38443D', backgroundColor: '#151B17', padding: 14, marginTop: 15 }, summaryValue: { color: '#FFF8E8', fontSize: 26, fontWeight: '900' }, summaryLabel: { color: '#D7B45A', fontSize: 10, fontWeight: '900' }, summaryMeta: { color: '#7E8A82', fontSize: 9, marginTop: 4 }, pack: { borderRadius: 16, borderWidth: 1, borderColor: '#303C34', backgroundColor: '#141B16', overflow: 'hidden', marginTop: 10 }, packHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 13, backgroundColor: '#18211A' }, packTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' }, packMeta: { color: '#7F8B83', fontSize: 9, marginTop: 2 }, packAction: { color: '#D7B45A', fontSize: 9, fontWeight: '900' }, task: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2B3730' }, check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: '#526058', alignItems: 'center', justifyContent: 'center' }, checkActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, checkText: { color: '#172017', fontSize: 13, fontWeight: '900' }, taskTitle: { color: '#DCE3DE', fontSize: 11, fontWeight: '800' }, taskMeta: { color: '#748078', fontSize: 8, marginTop: 3 }, error: { color: '#FF9D92', fontSize: 11, lineHeight: 16, marginTop: 12 }, primary: { minHeight: 50, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primaryText: { color: '#172017', fontSize: 13, fontWeight: '900' }, skip: { color: '#95A198', fontSize: 10, fontWeight: '800', textAlign: 'center', paddingVertical: 14 } });
