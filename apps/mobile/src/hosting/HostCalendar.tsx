import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type CampaignTask, type HostCampaign } from './campaigns';
import { AppIcon } from '../ui/AppIcon';

type CalendarMode = 'month' | 'week' | 'agenda';
type CalendarItem = {
  id: string;
  type: 'event' | 'task' | 'decision';
  title: string;
  date: Date;
  campaign: HostCampaign;
  detail: string;
  priority?: CampaignTask['priority'];
  sourceId?: string;
};

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysBetween(a: Date, b: Date) {
  const day = 24 * 60 * 60 * 1000;
  return Math.ceil((startOfDay(b).getTime() - startOfDay(a).getTime()) / day);
}

export function HostCalendar() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<CalendarMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listHostCampaigns();
      setCampaigns(rows.filter((campaign) => campaign.status !== 'complete'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the host calendar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const result: CalendarItem[] = [];
    for (const campaign of campaigns) {
      if (campaign.startsAt) {
        result.push({
          id: `event-${campaign.id}`,
          type: 'event',
          title: campaign.shortTitle,
          date: new Date(campaign.startsAt),
          campaign,
          detail: campaign.location || 'Event',
        });
      }
      for (const task of campaign.tasks) {
        if (task.status !== 'complete' && task.dueAt) {
          result.push({
            id: `task-${task.id}`,
            type: 'task',
            title: task.title,
            date: new Date(task.dueAt),
            campaign,
            detail: `${campaign.shortTitle} · ${task.owner}`,
            priority: task.priority,
            sourceId: task.id,
          });
        }
      }
      for (const decision of campaign.decisions) {
        if (decision.status !== 'decided' && decision.dueAt) {
          result.push({
            id: `decision-${decision.id}`,
            type: 'decision',
            title: decision.title,
            date: new Date(decision.dueAt),
            campaign,
            detail: `${campaign.shortTitle} · decision due`,
            sourceId: decision.id,
          });
        }
      }
    }
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [campaigns]);

  const unscheduled = useMemo(() => campaigns.flatMap((campaign) => [
    ...campaign.tasks.filter((task) => task.status !== 'complete' && !task.dueAt).map((task) => ({ kind: 'task' as const, task, campaign })),
    ...campaign.decisions.filter((decision) => decision.status !== 'decided' && !decision.dueAt).map((decision) => ({ kind: 'decision' as const, decision, campaign })),
  ]), [campaigns]);

  const today = startOfDay(new Date());
  const upcoming = calendarItems.filter((item) => startOfDay(item.date).getTime() >= today.getTime()).slice(0, 8);
  const attention = calendarItems.filter((item) => {
    if (item.type === 'event') return false;
    const days = daysBetween(today, item.date);
    return days < 0 || days <= 3 || item.priority === 'critical';
  });
  const selectedItems = calendarItems.filter((item) => sameDay(item.date, selectedDate));

  const monthCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const shiftMonth = (amount: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  const openItem = (item: CalendarItem) => {
    if (item.type === 'event') {
      router.push(`/host/campaigns/${item.campaign.slug}` as never);
      return;
    }
    if (item.type === 'task' && item.sourceId) {
      router.push(`/host/campaigns/${item.campaign.slug}/tasks/${item.sourceId}` as never);
      return;
    }
    router.push(`/host/campaigns/${item.campaign.slug}` as never);
  };

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>

      <View style={styles.header}>
        <View style={styles.headerIcon}><AppIcon name="calendar" color="#75AEE8" size={24} /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CALENDAR</Text>
          <Text style={styles.title}>Plan what happens next.</Text>
          <Text style={styles.subtitle}>Events, deadlines and unscheduled work in one operating timeline.</Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => router.push('/host/create' as never)}><Text style={styles.addButtonText}>＋</Text></Pressable>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading calendar…</Text></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

      {!loading && !error ? <>
        <View style={styles.briefing}>
          <View style={styles.briefingTop}>
            <View>
              <Text style={styles.sectionKicker}>TODAY</Text>
              <Text style={styles.briefingTitle}>{attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'} need attention` : 'You are clear today'}</Text>
            </View>
            <View style={styles.briefingBadge}><Text style={styles.briefingBadgeText}>{calendarItems.length}</Text><Text style={styles.briefingBadgeLabel}>DATED</Text></View>
          </View>
          {attention.slice(0, 2).map((item) => <Pressable key={item.id} style={styles.attentionRow} onPress={() => openItem(item)}>
            <View style={[styles.itemDot, { backgroundColor: item.priority === 'critical' ? '#EA806E' : '#D7B45A' }]} />
            <View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{formatShortDate(item.date)} · {item.detail}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>)}
          {!attention.length && unscheduled.length ? <Text style={styles.briefingNote}>{unscheduled.length} open item{unscheduled.length === 1 ? '' : 's'} still need a date.</Text> : null}
        </View>

        <View style={styles.modeRow}>
          {(['month', 'week', 'agenda'] as CalendarMode[]).map((value) => <Pressable key={value} style={[styles.modeButton, mode === value && styles.modeButtonActive]} onPress={() => setMode(value)}><Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text></Pressable>)}
        </View>

        {mode === 'month' ? <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <Pressable style={styles.monthArrow} onPress={() => shiftMonth(-1)}><Text style={styles.monthArrowText}>‹</Text></Pressable>
            <Pressable onPress={() => { setCursor(new Date()); setSelectedDate(new Date()); }}><Text style={styles.monthTitle}>{MONTHS[cursor.getMonth()] ?? ''} {cursor.getFullYear()}</Text><Text style={styles.todayLink}>Jump to today</Text></Pressable>
            <Pressable style={styles.monthArrow} onPress={() => shiftMonth(1)}><Text style={styles.monthArrowText}>›</Text></Pressable>
          </View>
          <View style={styles.weekLabels}>{DAY_LABELS.map((label, index) => <Text key={`${label}-${index}`} style={styles.weekLabel}>{label}</Text>)}</View>
          <View style={styles.calendarGrid}>{monthCells.map((date, index) => {
            const count = date ? calendarItems.filter((item) => sameDay(item.date, date)).length : 0;
            const selected = Boolean(date && sameDay(date, selectedDate));
            const isToday = Boolean(date && sameDay(date, today));
            return <Pressable key={index} disabled={!date} style={[styles.dayCell, selected && styles.dayCellSelected]} onPress={() => date && setSelectedDate(date)}>
              {date ? <><Text style={[styles.dayText, isToday && styles.dayTextToday, selected && styles.dayTextSelected]}>{date.getDate()}</Text>{count ? <View style={styles.dayDots}>{Array.from({ length: Math.min(count, 3) }).map((_, dot) => <View key={dot} style={[styles.calendarDot, { backgroundColor: dot === 0 ? '#75AEE8' : '#D7B45A' }]} />)}</View> : null}</> : null}
            </Pressable>;
          })}</View>
          <View style={styles.selectedPanel}>
            <Text style={styles.selectedTitle}>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            {selectedItems.length ? selectedItems.map((item) => <Pressable key={item.id} style={styles.selectedRow} onPress={() => openItem(item)}><View style={[styles.typePill, item.type === 'event' && styles.typePillEvent]}><Text style={styles.typePillText}>{item.type.toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.detail}</Text></View><Text style={styles.chevron}>›</Text></Pressable>) : <Text style={styles.emptyDate}>Nothing scheduled. Tap another date or schedule open work below.</Text>}
          </View>
        </View> : null}

        {mode === 'week' ? <View style={styles.listCard}>
          <Text style={styles.cardHeading}>Next 7 days</Text>
          {calendarItems.filter((item) => { const d = daysBetween(today, item.date); return d >= 0 && d <= 7; }).length ? calendarItems.filter((item) => { const d = daysBetween(today, item.date); return d >= 0 && d <= 7; }).map((item) => <CalendarRow key={item.id} item={item} onPress={() => openItem(item)} />) : <Text style={styles.emptyDate}>No dated work in the next 7 days.</Text>}
        </View> : null}

        {mode === 'agenda' ? <View style={styles.listCard}>
          <Text style={styles.cardHeading}>Upcoming</Text>
          {upcoming.length ? upcoming.map((item) => <CalendarRow key={item.id} item={item} onPress={() => openItem(item)} />) : <Text style={styles.emptyDate}>No upcoming dated work yet.</Text>}
        </View> : null}

        <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>PLANNING ENGINE</Text><Text style={styles.sectionTitle}>Needs scheduling</Text></View><View style={styles.countPill}><Text style={styles.countPillText}>{unscheduled.length}</Text></View></View>
        {unscheduled.length ? <View style={styles.listCard}>
          {unscheduled.slice(0, 8).map((entry, index) => {
            const title = entry.kind === 'task' ? entry.task.title : entry.decision.title;
            const eventDate = new Date(entry.campaign.startsAt);
            const suggested = new Date(eventDate);
            suggested.setDate(suggested.getDate() - Math.max(7, Math.min(30, 10 + index * 3)));
            const open = () => entry.kind === 'task' ? router.push(`/host/campaigns/${entry.campaign.slug}/tasks/${entry.task.id}` as never) : router.push(`/host/campaigns/${entry.campaign.slug}` as never);
            return <Pressable key={`${entry.kind}-${entry.kind === 'task' ? entry.task.id : entry.decision.id}`} style={styles.scheduleRow} onPress={open}>
              <View style={styles.aiIcon}><Text style={styles.aiIconText}>✦</Text></View>
              <View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{entry.campaign.shortTitle}</Text><Text style={styles.suggestion}>Suggested by {formatShortDate(suggested)} · before {formatShortDate(eventDate)}</Text></View>
              <Text style={styles.scheduleAction}>Schedule</Text>
            </Pressable>;
          })}
        </View> : <View style={styles.clearCard}><Text style={styles.clearIcon}>✓</Text><View style={styles.flex}><Text style={styles.rowTitle}>Everything open has a date.</Text><Text style={styles.rowMeta}>New unscheduled work will appear here automatically.</Text></View></View>}

        <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>COMING UP</Text><Text style={styles.sectionTitle}>Next on your timeline</Text></View></View>
        <View style={styles.listCard}>{upcoming.length ? upcoming.slice(0, 5).map((item) => <CalendarRow key={item.id} item={item} onPress={() => openItem(item)} />) : <Text style={styles.emptyDate}>Create an event or add task deadlines to begin your operating timeline.</Text>}</View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function CalendarRow({ item, onPress }: { item: CalendarItem; onPress: () => void }) {
  return <Pressable style={styles.timelineRow} onPress={onPress}>
    <View style={styles.dateBlock}><Text style={styles.dateMonth}>{item.date.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateDay}>{item.date.getDate()}</Text></View>
    <View style={styles.flex}><View style={styles.rowTitleLine}><Text style={styles.rowTitle}>{item.title}</Text>{item.priority === 'critical' ? <Text style={styles.critical}>CRITICAL</Text> : null}</View><Text style={styles.rowMeta}>{item.detail}</Text><Text style={styles.rowType}>{item.type.toUpperCase()}</Text></View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  content: { padding: 18, paddingBottom: 80 },
  back: { color: '#D7B45A', fontWeight: '900', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: '#2E3A33', backgroundColor: '#141D17', padding: 14 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#75AEE822' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#75AEE8', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 21, lineHeight: 25, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#8E9A92', fontSize: 9, lineHeight: 13, marginTop: 3 },
  addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#132017', fontSize: 22, fontWeight: '700', marginTop: -2 },
  loading: { padding: 34, alignItems: 'center', gap: 8 },
  muted: { color: '#849087', fontSize: 10 },
  errorCard: { borderWidth: 1, borderColor: '#743E39', backgroundColor: '#261917', borderRadius: 14, padding: 14, marginTop: 14 },
  errorText: { color: '#F0A297', fontSize: 10 },
  briefing: { marginTop: 12, borderRadius: 17, borderWidth: 1, borderColor: '#354136', backgroundColor: '#121A15', padding: 14 },
  briefingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  briefingTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 2 },
  briefingBadge: { alignItems: 'center', minWidth: 48, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#1E2B23' },
  briefingBadgeText: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  briefingBadgeLabel: { color: '#7E8C82', fontSize: 7, fontWeight: '800', marginTop: 1 },
  briefingNote: { color: '#9AA69E', fontSize: 9, marginTop: 10 },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A352E', marginTop: 10, paddingTop: 9 },
  itemDot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
  rowTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' },
  rowMeta: { color: '#87938B', fontSize: 8, lineHeight: 12, marginTop: 2 },
  chevron: { color: '#69766E', fontSize: 21, fontWeight: '300' },
  modeRow: { flexDirection: 'row', backgroundColor: '#121A15', borderRadius: 13, padding: 4, marginTop: 12, borderWidth: 1, borderColor: '#2D3932' },
  modeButton: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: '#25342B' },
  modeText: { color: '#7F8B83', fontSize: 9, fontWeight: '800' },
  modeTextActive: { color: '#FFF8E8' },
  calendarCard: { marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121A15', overflow: 'hidden' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2D3932' },
  monthArrow: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B2720' },
  monthArrowText: { color: '#D7B45A', fontSize: 24, lineHeight: 26 },
  monthTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  todayLink: { color: '#75AEE8', fontSize: 7, textAlign: 'center', marginTop: 2 },
  weekLabels: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 9 },
  weekLabel: { width: '14.2857%', color: '#637068', fontSize: 8, fontWeight: '800', textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 6, paddingBottom: 10 },
  dayCell: { width: '14.2857%', height: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayCellSelected: { backgroundColor: '#26372D' },
  dayText: { color: '#BAC3BD', fontSize: 10, fontWeight: '700' },
  dayTextToday: { color: '#D7B45A', fontWeight: '900' },
  dayTextSelected: { color: '#FFF8E8' },
  dayDots: { flexDirection: 'row', gap: 2, marginTop: 4 },
  calendarDot: { width: 3, height: 3, borderRadius: 2 },
  selectedPanel: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932', padding: 12 },
  selectedTitle: { color: '#D7B45A', fontSize: 9, fontWeight: '900', marginBottom: 5 },
  selectedRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#263129' },
  typePill: { minWidth: 46, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#2D2B1D' },
  typePillEvent: { backgroundColor: '#1C3040' },
  typePillText: { color: '#D9C67D', fontSize: 6, fontWeight: '900', textAlign: 'center' },
  emptyDate: { color: '#77847B', fontSize: 9, lineHeight: 14, paddingVertical: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 7 },
  sectionKicker: { color: '#75AEE8', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 2 },
  countPill: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  countPillText: { color: '#132017', fontWeight: '900', fontSize: 10 },
  listCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121A15', paddingHorizontal: 12 },
  cardHeading: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', paddingTop: 13, paddingBottom: 7 },
  timelineRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#29342D', paddingVertical: 8 },
  dateBlock: { width: 40, height: 44, borderRadius: 10, backgroundColor: '#1D2A23', alignItems: 'center', justifyContent: 'center' },
  dateMonth: { color: '#75AEE8', fontSize: 7, fontWeight: '900' },
  dateDay: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: -1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  critical: { color: '#EA806E', fontSize: 6, fontWeight: '900' },
  rowType: { color: '#D7B45A', fontSize: 6, fontWeight: '900', marginTop: 3 },
  scheduleRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#29342D', paddingVertical: 9 },
  aiIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#2C2819', alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: '#D7B45A', fontSize: 16 },
  suggestion: { color: '#75AEE8', fontSize: 7, marginTop: 4 },
  scheduleAction: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  clearCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121A15', padding: 14 },
  clearIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#20382C', color: '#84C992', textAlign: 'center', paddingTop: 6, fontWeight: '900' },
});