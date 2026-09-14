import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export function EventTagPicker({
  label,
  options,
  selected,
  allowCustomTags,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  allowCustomTags: boolean;
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const pool = [...new Set([...options, ...selected])];
    return query ? pool.filter((item) => item.toLowerCase().includes(query)) : pool;
  }, [options, search, selected]);

  function toggle(labelValue: string) {
    onChange(selected.includes(labelValue)
      ? selected.filter((item) => item !== labelValue)
      : [...selected, labelValue]);
  }

  function addCustom() {
    const value = custom.trim();
    if (!value) return;
    if (!selected.some((item) => item.toLowerCase() === value.toLowerCase())) onChange([...selected, value]);
    setCustom('');
  }

  return (
    <>
      <View style={styles.heading}>
        <Text style={styles.label}>{label}</Text>
        <Pressable onPress={() => setOpen(true)}><Text style={styles.action}>+ Add {label.toLowerCase()}</Text></Pressable>
      </View>
      <View style={styles.selectedWrap}>
        {selected.length ? selected.map((item) => (
          <Pressable key={item} style={styles.selectedChip} onPress={() => toggle(item)}>
            <Text style={styles.selectedText}>{item}</Text><Text style={styles.remove}>×</Text>
          </Pressable>
        )) : <Text style={styles.empty}>No {label.toLowerCase()} selected.</Text>}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View><Text style={styles.eyebrow}>EVENT {label.toUpperCase()}</Text><Text style={styles.title}>Choose what fits</Text></View>
              <Pressable onPress={() => setOpen(false)}><Text style={styles.close}>Done</Text></Pressable>
            </View>
            <TextInput value={search} onChangeText={setSearch} placeholder={`Search ${label.toLowerCase()}`} placeholderTextColor="#68756D" style={styles.search} />
            <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
              <View style={styles.options}>
                {filtered.map((item) => {
                  const active = selected.includes(item);
                  return <Pressable key={item} style={[styles.option, active && styles.optionActive]} onPress={() => toggle(item)}><Text style={[styles.optionText, active && styles.optionTextActive]}>{active ? '✓ ' : ''}{item}</Text></Pressable>;
                })}
              </View>
            </ScrollView>
            {allowCustomTags ? (
              <View style={styles.customWrap}>
                <Text style={styles.customLabel}>CUSTOM TAG</Text>
                <View style={styles.customRow}>
                  <TextInput value={custom} onChangeText={setCustom} placeholder="Add a tag" placeholderTextColor="#68756D" style={styles.customInput} returnKeyType="done" onSubmitEditing={addCustom} />
                  <Pressable style={styles.addButton} onPress={addCustom}><Text style={styles.addButtonText}>Add</Text></Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  label: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '900' },
  action: { color: '#D7B45A', fontSize: 9.5, fontWeight: '900' },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  selectedChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: '#8A6A25', backgroundColor: '#322A14', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedText: { color: '#E7C464', fontSize: 10, fontWeight: '800' },
  remove: { color: '#BDA868', fontSize: 15, lineHeight: 17 },
  empty: { color: '#68756D', fontSize: 9.5, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '84%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#111814', borderTopWidth: 1, borderColor: '#344039', padding: 16, paddingBottom: 28 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 3 },
  close: { color: '#D7B45A', fontSize: 11, fontWeight: '900', paddingVertical: 4 },
  search: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', color: '#FFF8E8', paddingHorizontal: 12, fontSize: 15, marginTop: 14 },
  optionList: { maxHeight: 330, marginTop: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10 },
  option: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#121914', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  optionActive: { borderColor: '#8A6A25', backgroundColor: '#322A14' },
  optionText: { color: '#AAB4AE', fontSize: 10, fontWeight: '800' },
  optionTextActive: { color: '#E7C464' },
  customWrap: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2E3932', paddingTop: 12 },
  customLabel: { color: '#78857D', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 7 },
  customInput: { flex: 1, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', color: '#FFF8E8', paddingHorizontal: 11, fontSize: 15 },
  addButton: { minWidth: 72, minHeight: 44, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#172017', fontSize: 10, fontWeight: '900' },
});
