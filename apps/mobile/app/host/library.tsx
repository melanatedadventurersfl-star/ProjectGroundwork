import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createPersonalLibraryItem,
  listHostLibraryItems,
  type HostLibraryCategory,
  type HostLibraryItem,
} from '../../src/hosting/library';

type LibraryFilter = 'all' | HostLibraryCategory;

const filters: Array<{ key: LibraryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'template', label: 'Templates' },
  { key: 'meal_plan', label: 'Meals' },
  { key: 'gear_list', label: 'Gear' },
  { key: 'guest_message', label: 'Messages' },
  { key: 'policy', label: 'Policies' },
  { key: 'vendor', label: 'Vendors' },
  { key: 'marketing_sequence', label: 'Marketing' },
  { key: 'ticket_structure', label: 'Tickets' },
];

const categoryLabels: Record<HostLibraryCategory, string> = {
  template: 'Template',
  meal_plan: 'Meal plan',
  gear_list: 'Gear list',
  guest_message: 'Guest message',
  policy: 'Policy',
  vendor: 'Vendor',
  marketing_sequence: 'Marketing sequence',
  ticket_structure: 'Ticket structure',
};

export default function HostLibraryScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const initialCategory = filters.some((filter) => filter.key === params.category) ? params.category as LibraryFilter : 'all';
  const [filter, setFilter] = useState<LibraryFilter>(initialCategory);
  const [items, setItems] = useState<HostLibraryItem[]>([]);
  const [selected, setSelected] = useState<HostLibraryItem | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<HostLibraryCategory>('template');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listHostLibraryItems());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load reusable library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleItems = useMemo(() => filter === 'all' ? items : items.filter((item) => item.category === filter), [filter, items]);
  const systemItems = visibleItems.filter((item) => item.scope === 'system' || item.scope === 'organization');
  const personalItems = visibleItems.filter((item) => item.scope === 'personal');

  async function savePersonalItem() {
    setSaving(true);
    setError('');
    try {
      await createPersonalLibraryItem({
        category: newCategory,
        title: newTitle,
        summary: newSummary,
        content: newSummary.trim() ? { notes: newSummary.trim() } : {},
      });
      setNewTitle('');
      setNewSummary('');
      setComposerOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save reusable item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
          <Text style={styles.eyebrow}>HOST LIBRARY</Text>
          <Text style={styles.title}>Reusable Library</Text>
          <Text style={styles.subtitle}>Keep proven event pieces ready to reuse without copying an entire event.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {filters.map((item) => (
              <Pressable key={item.key} style={[styles.filterChip, filter === item.key && styles.filterChipActive]} onPress={() => setFilter(item.key)}>
                <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
          {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading library…</Text></View> : null}

          {!loading ? <>
            <SectionTitle title="Go Melanated Library" count={systemItems.length} />
            {systemItems.length === 0 ? <Text style={styles.empty}>No reusable items in this category yet.</Text> : systemItems.map((item) => <LibraryCard key={item.id} item={item} onPress={() => setSelected(item)} />)}

            <SectionTitle title="My Library" count={personalItems.length} />
            {personalItems.length === 0 ? <View style={styles.personalEmpty}><Text style={styles.personalEmptyTitle}>Nothing saved here yet.</Text><Text style={styles.muted}>Save your own checklist, message, policy, vendor setup, or event structure for future use.</Text></View> : personalItems.map((item) => <LibraryCard key={item.id} item={item} onPress={() => setSelected(item)} />)}
          </> : null}
        </ScrollView>

        <Pressable accessibilityLabel="Add reusable library item" style={styles.fab} onPress={() => setComposerOpen(true)}><Text style={styles.fabPlus}>＋</Text></Pressable>
      </View>

      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.scrim} onPress={() => setSelected(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {selected ? <>
            <Text style={styles.sheetKicker}>{categoryLabels[selected.category].toUpperCase()} · {selected.scope === 'personal' ? 'MY LIBRARY' : 'GO MELANATED'}</Text>
            <Text style={styles.sheetTitle}>{selected.title}</Text>
            <Text style={styles.sheetSummary}>{selected.summary || 'No summary added.'}</Text>
            <View style={styles.contentCard}>
              {describeContent(selected).map((line, index) => <Text key={`${selected.id}-${index}`} style={styles.contentLine}>• {line}</Text>)}
            </View>
            <Text style={styles.sheetNote}>This item is reusable source material. Applying it to an event will use a review step before changing live event data.</Text>
            <Pressable style={styles.closeButton} onPress={() => setSelected(null)}><Text style={styles.closeButtonText}>Done</Text></Pressable>
          </> : null}
        </View>
      </Modal>

      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setComposerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetKicker}>SAVE TO MY LIBRARY</Text>
          <Text style={styles.sheetTitle}>Reusable item</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {(Object.keys(categoryLabels) as HostLibraryCategory[]).map((category) => (
              <Pressable key={category} style={[styles.categoryChip, newCategory === category && styles.categoryChipActive]} onPress={() => setNewCategory(category)}>
                <Text style={[styles.categoryChipText, newCategory === category && styles.categoryChipTextActive]}>{categoryLabels[category]}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="Title" placeholderTextColor="#69736D" />
          <TextInput style={[styles.input, styles.notesInput]} value={newSummary} onChangeText={setNewSummary} placeholder="What should future hosts know or reuse?" placeholderTextColor="#69736D" multiline />
          <Pressable disabled={saving} style={styles.saveButton} onPress={() => void savePersonalItem()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.saveButtonText}>Save to Library</Text>}</Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionCount}>{count}</Text></View>;
}

function LibraryCard({ item, onPress }: { item: HostLibraryItem; onPress: () => void }) {
  return <Pressable style={styles.card} onPress={onPress}>
    <View style={styles.cardTop}><Text style={styles.cardKicker}>{categoryLabels[item.category].toUpperCase()}</Text><Text style={styles.cardScope}>{item.scope === 'personal' ? 'MY LIBRARY' : 'GO MELANATED'}</Text></View>
    <Text style={styles.cardTitle}>{item.title}</Text>
    <Text style={styles.cardSummary}>{item.summary}</Text>
    <Text style={styles.cardAction}>View reusable details ›</Text>
  </Pressable>;
}

function describeContent(item: HostLibraryItem): string[] {
  const content = item.content ?? {};
  const lines: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (Array.isArray(value)) lines.push(`${humanize(key)}: ${value.map(String).join(', ')}`);
    else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') lines.push(`${humanize(key)}: ${String(value)}`);
  }
  return lines.length ? lines : ['No structured details have been added yet.'];
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 118 },
  back: { color: '#C8D1CB', fontSize: 12, fontWeight: '900', marginBottom: 15 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#9DA7A0', fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 16 },
  filters: { gap: 7, paddingBottom: 8 },
  filterChip: { borderRadius: 18, borderWidth: 1, borderColor: '#38423C', paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#352D18' },
  filterText: { color: '#8D9891', fontSize: 10, fontWeight: '900' },
  filterTextActive: { color: '#E7C464' },
  errorCard: { marginTop: 10, borderRadius: 13, borderWidth: 1, borderColor: '#684139', backgroundColor: '#211715', padding: 12 },
  errorText: { color: '#DDA59B', fontSize: 11, lineHeight: 17 },
  loading: { paddingVertical: 34, alignItems: 'center', gap: 9 },
  muted: { color: '#7E8982', fontSize: 11, lineHeight: 17 },
  sectionHeader: { marginTop: 22, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase' },
  sectionCount: { color: '#7E8982', fontSize: 10, fontWeight: '900' },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 15, marginBottom: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardKicker: { color: '#A8CF55', fontSize: 8.5, fontWeight: '900', letterSpacing: .7 },
  cardScope: { color: '#6F7B73', fontSize: 8, fontWeight: '900' },
  cardTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 6 },
  cardSummary: { color: '#909A94', fontSize: 11, lineHeight: 17, marginTop: 5 },
  cardAction: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginTop: 11 },
  empty: { color: '#77827B', fontSize: 11, paddingVertical: 12 },
  personalEmpty: { borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: '#354039', padding: 15 },
  personalEmptyTitle: { color: '#EAE7DE', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  fab: { position: 'absolute', right: 22, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0D47B', shadowColor: '#000', shadowOpacity: .3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabPlus: { color: '#172017', fontSize: 31, lineHeight: 34, fontWeight: '500', marginTop: -2 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,.62)' },
  sheet: { backgroundColor: '#111713', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#344039', padding: 20, paddingBottom: 30, maxHeight: '82%' },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#4A554E', marginBottom: 16 },
  sheetKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .9 },
  sheetTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 5 },
  sheetSummary: { color: '#9BA59F', fontSize: 12, lineHeight: 18, marginTop: 7 },
  contentCard: { borderRadius: 14, borderWidth: 1, borderColor: '#2F3933', backgroundColor: '#0C110E', padding: 13, marginTop: 15 },
  contentLine: { color: '#CCD3CE', fontSize: 11, lineHeight: 18, marginBottom: 3 },
  sheetNote: { color: '#6F7A73', fontSize: 10, lineHeight: 16, marginTop: 14 },
  closeButton: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#465149', alignItems: 'center', justifyContent: 'center', marginTop: 17 },
  closeButtonText: { color: '#D9E0DB', fontSize: 11, fontWeight: '900' },
  categoryRow: { gap: 7, paddingVertical: 13 },
  categoryChip: { borderRadius: 17, borderWidth: 1, borderColor: '#38423C', paddingHorizontal: 10, paddingVertical: 8 },
  categoryChipActive: { borderColor: '#A8CF55', backgroundColor: '#27351E' },
  categoryChipText: { color: '#87928B', fontSize: 9, fontWeight: '900' },
  categoryChipTextActive: { color: '#CDE792' },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#39433D', backgroundColor: '#0C110E', color: '#FFF8E8', paddingHorizontal: 12, marginBottom: 9 },
  notesInput: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  saveButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  saveButtonText: { color: '#172017', fontSize: 12, fontWeight: '900' },
});
