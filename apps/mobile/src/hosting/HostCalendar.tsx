import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listHostCampaigns, type HostCampaign } from './campaigns';
import { AppIcon } from '../ui/AppIcon';

type CalendarMode = 'month' | 'week' | 'agenda';
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function eventContainsDate(campaign: HostCampaign, date: Date) {
  const target = startOfDay(date).getTime();
  const start = startOfDay(new Date(campaign.startsAt)).getTime();
  const end = startOfDay(new Date(campaign.endsAt || campaign.startsAt)).getTime();
  return target >= start && target <= end;
}
function daysBetween(a: Date, b: Date) {
  const day = 24 * 60 * 60 * 1000;
  return Math.ceil((startOfDay(b).getTime() - startOfDay(a).getTime()) / day);
}
function dateRange(campaign: HostCampaign) {
  const start = new Date(campaign.startsAt);
  const end = new Date(campaign.endsAt || campaign.startsAt);
  const same = sameDay(start, end);
  if (same) return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function HostCalendar() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<CalendarMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await listHostCampaigns();
      const today = startOfDay(new Date()).getTime();
      setCampaigns(rows.filter((campaign) => campaign.status !== 'complete' && startOfDay(new Date(campaign.endsAt || campaign.startsAt)).getTime() >= today));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Event Calendar.');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const today = startOfDay(new Date());
  const upcoming = useMemo(() => [...campaigns].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [campaigns]);
  const selectedEvents = upcoming.filter((campaign) => eventContainsDate(campaign, selectedDate));
  const weekEvents = upcoming.filter((campaign) => {
    const start = new Date(campaign.startsAt);
    const end = new Date(campaign.endsAt || campaign.startsAt);
    return daysBetween(today, end) >= 0 && daysBetween(today, start) <= 7;
  });

  const monthCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const cells: (Date | null)[] = Array(first.getDay()).fill(null);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const shiftMonth = (amount: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const openEvent = (campaign: HostCampaign) => router.push(`/host/campaigns/${campaign.slug}` as never);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>

      <View style={styles.header}>
        <View style={styles.headerIcon}><AppIcon name="calendar" color="#75AEE8" size={24} /></View>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>EVENT CALENDAR</Text><Text style={styles.title}>Upcoming events</Text><Text style={styles.subtitle}>One clean view of when your events are happening.</Text></View>
        <Pressable style={styles.addButton} onPress={() => router.push('/host/create' as never)}><Text style={styles.addButtonText}>＋</Text></Pressable>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading events…</Text></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

      {!loading && !error ? <>
        <View style={styles.summaryCard}><View><Text style={styles.summaryKicker}>UPCOMING</Text><Text style={styles.summaryTitle}>{upcoming.length} event{upcoming.length === 1 ? '' : 's'} on the calendar</Text></View><Pressable onPress={() => router.push('/host/work' as never)}><Text style={styles.workLink}>Open My Work ›</Text></Pressable></View>

        <View style={styles.modeRow}>{(['month', 'week', 'agenda'] as CalendarMode[]).map((value) => <Pressable key={value} style={[styles.modeButton, mode === value && styles.modeButtonActive]} onPress={() => setMode(value)}><Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>

        {mode === 'month' ? <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <Pressable style={styles.monthArrow} onPress={() => shiftMonth(-1)}><Text style={styles.monthArrowText}>‹</Text></Pressable>
            <Pressable onPress={() => { const now = new Date(); setCursor(now); setSelectedDate(now); }}><Text style={styles.monthTitle}>{MONTHS[cursor.getMonth()] ?? ''} {cursor.getFullYear()}</Text><Text style={styles.todayLink}>Jump to today</Text></Pressable>
            <Pressable style={styles.monthArrow} onPress={() => shiftMonth(1)}><Text style={styles.monthArrowText}>›</Text></Pressable>
          </View>
          <View style={styles.weekLabels}>{DAY_LABELS.map((label, index) => <Text key={`${label}-${index}`} style={styles.weekLabel}>{label}</Text>)}</View>
          <View style={styles.calendarGrid}>{monthCells.map((date, index) => {
            const events = date ? upcoming.filter((campaign) => eventContainsDate(campaign, date)) : [];
            const selected = Boolean(date && sameDay(date, selectedDate));
            const isToday = Boolean(date && sameDay(date, today));
            return <Pressable key={index} disabled={!date} style={[styles.dayCell, selected && styles.dayCellSelected]} onPress={() => date && setSelectedDate(date)}>
              {date ? <><Text style={[styles.dayText, isToday && styles.dayTextToday, selected && styles.dayTextSelected]}>{date.getDate()}</Text>{events.length ? <View style={styles.dayDots}>{events.slice(0, 3).map((campaign) => <View key={campaign.id} style={[styles.calendarDot, { backgroundColor: campaign.accent || '#75AEE8' }]} />)}</View> : null}</> : null}
            </Pressable>;
          })}</View>
          <View style={styles.selectedPanel}><Text style={styles.selectedTitle}>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>{selectedEvents.length ? selectedEvents.map((campaign) => <EventRow key={campaign.id} campaign={campaign} onPress={() => openEvent(campaign)} />) : <Text style={styles.emptyText}>No event scheduled for this date.</Text>}</View>
        </View> : null}

        {mode === 'week' ? <View style={styles.listCard}><Text style={styles.cardHeading}>Next 7 days</Text>{weekEvents.length ? weekEvents.map((campaign) => <EventRow key={campaign.id} campaign={campaign} onPress={() => openEvent(campaign)} />) : <Text style={styles.emptyText}>No events in the next 7 days.</Text>}</View> : null}
        {mode === 'agenda' ? <View style={styles.listCard}><Text style={styles.cardHeading}>Upcoming events</Text>{upcoming.length ? upcoming.map((campaign) => <EventRow key={campaign.id} campaign={campaign} onPress={() => openEvent(campaign)} />) : <EmptyState />}</View> : null}

        {mode !== 'agenda' ? <><View style={styles.sectionHeader}><Text style={styles.sectionKicker}>COMING UP</Text><Text style={styles.sectionTitle}>Next events</Text></View><View style={styles.listCard}>{upcoming.length ? upcoming.slice(0, 5).map((campaign) => <EventRow key={campaign.id} campaign={campaign} onPress={() => openEvent(campaign)} />) : <EmptyState />}</View></> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function EventRow({ campaign, onPress }: { campaign: HostCampaign; onPress: () => void }) {
  const start = new Date(campaign.startsAt);
  return <Pressable style={styles.eventRow} onPress={onPress}>
    <View style={[styles.dateBlock, { borderTopColor: campaign.accent || '#75AEE8' }]}><Text style={styles.dateMonth}>{start.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateDay}>{start.getDate()}</Text></View>
    <View style={styles.flex}><View style={styles.eventTitleLine}><Text style={styles.eventTitle}>{campaign.shortTitle}</Text><Text style={styles.status}>{campaign.status.toUpperCase()}</Text></View><Text style={styles.eventMeta}>{dateRange(campaign)} · {campaign.location || 'Location TBD'}</Text><Text style={styles.eventStats}>{campaign.metrics.attendees} attending · {campaign.metrics.capacityLabel}</Text></View><Text style={styles.chevron}>›</Text>
  </Pressable>;
}

function EmptyState() { return <View style={styles.empty}><Text style={styles.emptyIcon}>◇</Text><Text style={styles.emptyTitle}>No upcoming events</Text><Text style={styles.emptyText}>Create an event and it will appear here automatically.</Text><Pressable style={styles.emptyButton} onPress={() => router.push('/host/create' as never)}><Text style={styles.emptyButtonText}>Create event</Text></Pressable></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 80 }, back: { color: '#D7B45A', fontWeight: '900', marginBottom: 14 }, flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: '#2E3A33', backgroundColor: '#141D17', padding: 14 }, headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#75AEE822' }, headerCopy: { flex: 1 }, eyebrow: { color: '#75AEE8', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 21, fontWeight: '900', marginTop: 2 }, subtitle: { color: '#8E9A92', fontSize: 9, lineHeight: 13, marginTop: 3 }, addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' }, addButtonText: { color: '#132017', fontSize: 22, fontWeight: '700' },
  loading: { padding: 34, alignItems: 'center', gap: 8 }, muted: { color: '#849087', fontSize: 10 }, errorCard: { borderWidth: 1, borderColor: '#743E39', backgroundColor: '#261917', borderRadius: 14, padding: 14, marginTop: 14 }, errorText: { color: '#F0A297', fontSize: 10 },
  summaryCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121A15', padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, summaryKicker: { color: '#75AEE8', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, summaryTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', marginTop: 2 }, workLink: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  modeRow: { flexDirection: 'row', backgroundColor: '#121A15', borderRadius: 13, padding: 4, marginTop: 12, borderWidth: 1, borderColor: '#2D3932' }, modeButton: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, modeButtonActive: { backgroundColor: '#25342B' }, modeText: { color: '#7F8B83', fontSize: 9, fontWeight: '800' }, modeTextActive: { color: '#FFF8E8' },
  calendarCard: { marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121A15', overflow: 'hidden' }, monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2D3932' }, monthArrow: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B2720' }, monthArrowText: { color: '#D7B45A', fontSize: 24 }, monthTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', textAlign: 'center' }, todayLink: { color: '#75AEE8', fontSize: 7, textAlign: 'center', marginTop: 2 }, weekLabels: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 9 }, weekLabel: { width: '14.2857%', color: '#637068', fontSize: 8, fontWeight: '800', textAlign: 'center' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 6, paddingBottom: 10 }, dayCell: { width: '14.2857%', height: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, dayCellSelected: { backgroundColor: '#26372D' }, dayText: { color: '#BAC3BD', fontSize: 10, fontWeight: '700' }, dayTextToday: { color: '#D7B45A', fontWeight: '900' }, dayTextSelected: { color: '#FFF8E8' }, dayDots: { flexDirection: 'row', gap: 2, marginTop: 4 }, calendarDot: { width: 4, height: 4, borderRadius: 2 }, selectedPanel: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2D3932', padding: 12 }, selectedTitle: { color: '#D7B45A', fontSize: 9, fontWeight: '900', marginBottom: 4 },
  sectionHeader: { marginTop: 18, marginBottom: 7 }, sectionKicker: { color: '#75AEE8', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, sectionTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 2 }, listCard: { marginTop: 10, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#121A15', paddingHorizontal: 12 }, cardHeading: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', paddingTop: 13, paddingBottom: 7 },
  eventRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#29342D', paddingVertical: 9 }, dateBlock: { width: 42, height: 48, borderRadius: 10, borderTopWidth: 3, backgroundColor: '#1D2A23', alignItems: 'center', justifyContent: 'center' }, dateMonth: { color: '#75AEE8', fontSize: 7, fontWeight: '900' }, dateDay: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, eventTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 }, eventTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', flexShrink: 1 }, status: { color: '#84C992', fontSize: 6, fontWeight: '900' }, eventMeta: { color: '#87938B', fontSize: 8, lineHeight: 12, marginTop: 3 }, eventStats: { color: '#D7B45A', fontSize: 7, marginTop: 4 }, chevron: { color: '#69766E', fontSize: 21 },
  empty: { alignItems: 'center', padding: 24 }, emptyIcon: { color: '#75AEE8', fontSize: 24 }, emptyTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', marginTop: 7 }, emptyText: { color: '#77847B', fontSize: 9, lineHeight: 14, paddingVertical: 10 }, emptyButton: { backgroundColor: '#D7B45A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }, emptyButtonText: { color: '#132017', fontSize: 9, fontWeight: '900' },
});
