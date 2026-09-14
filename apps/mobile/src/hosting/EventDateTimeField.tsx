import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function nextHalfHour() {
  const date = new Date();
  date.setSeconds(0, 0);
  const minutes = date.getMinutes();
  date.setMinutes(minutes < 30 ? 30 : 60);
  if (date.getTime() < Date.now() + 30 * 60 * 1000) date.setMinutes(date.getMinutes() + 30);
  return date;
}

function formatValue(value: string | null) {
  if (!value) return 'Choose date & time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Choose date & time';
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function timeKey(value: Date) {
  return `${value.getHours()}:${value.getMinutes()}`;
}

export function EventDateTimeField({
  label,
  value,
  onChange,
  minimum,
  fallbackOffsetMinutes = 0,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  minimum?: string | null;
  fallbackOffsetMinutes?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => nextHalfHour());

  const dates = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 366 }, (_, index) => {
      const item = new Date(start);
      item.setDate(start.getDate() + index);
      return item;
    });
  }, []);

  const times = useMemo(() => Array.from({ length: 48 }, (_, index) => {
    const item = new Date();
    item.setHours(Math.floor(index / 2), index % 2 === 0 ? 0 : 30, 0, 0);
    return item;
  }), []);

  function showPicker() {
    const existing = value ? new Date(value) : null;
    const minimumDate = minimum ? new Date(minimum) : null;
    const base = existing && !Number.isNaN(existing.getTime())
      ? existing
      : minimumDate && !Number.isNaN(minimumDate.getTime())
        ? new Date(minimumDate.getTime() + fallbackOffsetMinutes * 60 * 1000)
        : nextHalfHour();
    setDraft(base);
    setOpen(true);
  }

  function chooseDate(date: Date) {
    const next = new Date(draft);
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setDraft(next);
  }

  function chooseTime(time: Date) {
    const next = new Date(draft);
    next.setHours(time.getHours(), time.getMinutes(), 0, 0);
    setDraft(next);
  }

  function save() {
    const minimumDate = minimum ? new Date(minimum) : null;
    if (minimumDate && !Number.isNaN(minimumDate.getTime()) && draft <= minimumDate) {
      const next = new Date(minimumDate.getTime() + Math.max(fallbackOffsetMinutes, 30) * 60 * 1000);
      setDraft(next);
      onChange(next.toISOString());
    } else {
      onChange(draft.toISOString());
    }
    setOpen(false);
  }

  return (
    <>
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <Pressable style={styles.field} onPress={showPicker} accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}`}>
          <Text style={[styles.value, !value && styles.placeholder]}>{formatValue(value)}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>{label.toUpperCase()}</Text>
                <Text style={styles.sheetTitle}>{formatValue(draft.toISOString())}</Text>
              </View>
              <Pressable onPress={() => setOpen(false)}><Text style={styles.close}>Close</Text></Pressable>
            </View>

            <Text style={styles.sectionLabel}>DATE</Text>
            <ScrollView style={styles.dateList} nestedScrollEnabled>
              {dates.map((date) => {
                const active = dateKey(date) === dateKey(draft);
                return (
                  <Pressable key={date.toISOString()} style={[styles.dateRow, active && styles.activeRow]} onPress={() => chooseDate(date)}>
                    <Text style={[styles.dateText, active && styles.activeText]}>{date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionLabel}>TIME</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeList}>
              {times.map((time) => {
                const active = timeKey(time) === timeKey(draft);
                return (
                  <Pressable key={timeKey(time)} style={[styles.timeChip, active && styles.timeChipActive]} onPress={() => chooseTime(time)}>
                    <Text style={[styles.timeText, active && styles.activeText]}>{time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.primary} onPress={save}><Text style={styles.primaryText}>Use this time</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: { color: '#CDD5D0', fontSize: 10.5, fontWeight: '900', marginBottom: 6 },
  field: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  value: { flex: 1, color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
  placeholder: { color: '#68756D', fontWeight: '600' },
  chevron: { color: '#D7B45A', fontSize: 20, lineHeight: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#111814', borderTopWidth: 1, borderColor: '#344039', padding: 16, paddingBottom: 28 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  sheetEyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sheetTitle: { color: '#FFF8E8', fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 4 },
  close: { color: '#AAB4AE', fontSize: 11, fontWeight: '900', paddingVertical: 4 },
  sectionLabel: { color: '#7E8A82', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 16, marginBottom: 7 },
  dateList: { maxHeight: 220, borderRadius: 13, borderWidth: 1, borderColor: '#2F3B34', backgroundColor: '#0C120E' },
  dateRow: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26322B' },
  activeRow: { backgroundColor: '#2A2414' },
  dateText: { color: '#C4CDC7', fontSize: 11, fontWeight: '700' },
  activeText: { color: '#E7C464' },
  check: { color: '#D7B45A', fontSize: 13, fontWeight: '900' },
  timeList: { gap: 7, paddingRight: 12 },
  timeChip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#0D1410', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  timeChipActive: { borderColor: '#8A6A25', backgroundColor: '#322A14' },
  timeText: { color: '#AAB4AE', fontSize: 10.5, fontWeight: '800' },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
});
