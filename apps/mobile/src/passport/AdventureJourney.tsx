import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgeArt, hasBadgeArt } from './BadgeArt';
import { isLegacyStampCode, StampArt } from './StampArt';
import { getPassportTimeline, type PassportTimelineItem } from './timeline';

type JourneyFilter = 'all' | 'stamps' | 'badges' | 'milestones';

const GOLD = '#D7B45A';
const TEAL = '#35D4C8';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function yearOf(value: string) {
  return new Date(value).getFullYear();
}

function TimelineArtwork({ item }: { item: PassportTimelineItem }) {
  if (item.item_type === 'stamp') {
    return (
      <View style={styles.artShell}>
        {item.code && isLegacyStampCode(item.code) ? (
          <StampArt code={item.code} width={86} />
        ) : (
          <View style={styles.genericStamp}><Text style={styles.genericStampText}>MA</Text></View>
        )}
      </View>
    );
  }

  if (item.item_type === 'badge') {
    return (
      <View style={styles.artShell}>
        {hasBadgeArt(item.title) ? (
          <BadgeArt title={item.title} size={82} />
        ) : (
          <View style={styles.genericBadge}><Text style={styles.genericBadgeText}>★</Text></View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.joinMark}>
      <Text style={styles.joinMarkTop}>MA</Text>
      <Text style={styles.joinMarkBottom}>JOINED</Text>
    </View>
  );
}

export function AdventureJourney() {
  const [timeline, setTimeline] = useState<PassportTimelineItem[]>([]);
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [year, setYear] = useState<number | null>(null);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void getPassportTimeline().then((items) => {
      if (active) setTimeline(items);
    }).catch(() => {
      if (active) setTimeline([]);
    });
    return () => { active = false; };
  }, []);

  const years = useMemo(
    () => Array.from(new Set(timeline.map((item) => yearOf(item.occurred_at)))).sort((a, b) => b - a),
    [timeline],
  );

  const filteredTimeline = useMemo(() => timeline.filter((item) => {
    if (year !== null && yearOf(item.occurred_at) !== year) return false;
    if (filter === 'stamps') return item.item_type === 'stamp';
    if (filter === 'badges') return item.item_type === 'badge';
    if (filter === 'milestones') return item.item_type === 'join' || (item.item_type === 'badge' && item.category === 'milestone');
    return true;
  }), [timeline, filter, year]);

  const latestItem = timeline[timeline.length - 1];

  const openTimelineItem = (item: PassportTimelineItem) => {
    if (item.item_type === 'stamp' && item.adventure_id) {
      router.push(`/passport/reflection/${item.adventure_id}`);
      return;
    }
    if (item.item_type === 'badge') {
      router.push({ pathname: '/passport/badges/[id]', params: { id: item.item_id.replace('badge:', '') } });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>ADVENTURE JOURNEY</Text>
        <Text style={styles.title}>Your adventure history</Text>
        <Text style={styles.tagline}>Your journey. Your stamps. Your story.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {([
          ['all', 'All'],
          ['stamps', 'Stamps'],
          ['badges', 'Badges'],
          ['milestones', 'Milestones'],
        ] as [JourneyFilter, string][]).map(([value, label]) => {
          const active = filter === value;
          return (
            <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setYearPickerOpen(true)} style={[styles.filterChip, year !== null && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, year !== null && styles.filterChipTextActive]}>{year ?? 'Year'} ▾</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.timelinePanel}>
        <View style={styles.timelineTopRow}>
          <Text style={styles.timelineCount}>{filteredTimeline.length} mark{filteredTimeline.length === 1 ? '' : 's'}</Text>
          {year !== null ? <Pressable onPress={() => setYear(null)}><Text style={styles.clearFilter}>Clear year</Text></Pressable> : null}
        </View>

        {filteredTimeline.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll} snapToInterval={164} decelerationRate="fast">
            {filteredTimeline.map((item, index) => {
              const interactive = item.item_type !== 'join';
              return (
                <View key={item.item_id} style={styles.timelineStepWrap}>
                  <View style={styles.connectorRow}>
                    <View style={[styles.connectorLine, index === 0 && styles.connectorLineHidden]} />
                    <View style={[styles.timelineNode, item.item_type === 'stamp' && styles.timelineNodeStamp, item.item_type === 'badge' && styles.timelineNodeBadge]}>
                      <View style={styles.timelineNodeInner} />
                    </View>
                    <View style={[styles.connectorLine, index === filteredTimeline.length - 1 && styles.connectorLineHidden]} />
                  </View>

                  <Pressable disabled={!interactive} onPress={() => openTimelineItem(item)} style={({ pressed }) => [styles.timelineCard, pressed && interactive && styles.timelineCardPressed]}>
                    <TimelineArtwork item={item} />
                    <Text style={styles.timelineTitle} numberOfLines={3}>{item.title}</Text>
                    <Text style={styles.timelineDate}>{formatDate(item.occurred_at)}</Text>
                    {item.city ? <Text style={styles.timelineLocation} numberOfLines={1}>{item.city}{item.state ? `, ${item.state}` : ''}</Text> : null}
                  </Pressable>
                </View>
              );
            })}

            {filter === 'all' && year === null ? (
              <View style={styles.timelineStepWrap}>
                <View style={styles.connectorRow}>
                  <View style={styles.connectorLine} />
                  <View style={styles.todayNode}><View style={styles.todayNodeInner} /></View>
                  <View style={styles.connectorLineHidden} />
                </View>
                <View style={[styles.timelineCard, styles.todayCard]}>
                  <View style={styles.todayCompass}><Text style={styles.todayCompassText}>✦</Text></View>
                  <Text style={styles.todayLabel}>TODAY</Text>
                  <Text style={styles.todayTitle}>The trail keeps going.</Text>
                  {latestItem ? <Text style={styles.timelineDate}>Latest mark {formatDate(latestItem.occurred_at)}</Text> : null}
                </View>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.emptyJourney}>
            <Text style={styles.emptyJourneyTitle}>No marks match these filters.</Text>
            <Text style={styles.emptyJourneyText}>Try another type or switch back to All years.</Text>
          </View>
        )}
      </View>

      <Modal transparent visible={yearPickerOpen} animationType="fade" onRequestClose={() => setYearPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setYearPickerOpen(false)}>
          <Pressable style={styles.yearSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.yearHandle} />
            <Text style={styles.yearTitle}>Filter Journey by Year</Text>
            <Pressable style={[styles.yearOption, year === null && styles.yearOptionActive]} onPress={() => { setYear(null); setYearPickerOpen(false); }}>
              <Text style={[styles.yearOptionText, year === null && styles.yearOptionTextActive]}>All years</Text>
            </Pressable>
            {years.map((value) => (
              <Pressable key={value} style={[styles.yearOption, year === value && styles.yearOptionActive]} onPress={() => { setYear(value); setYearPickerOpen(false); }}>
                <Text style={[styles.yearOptionText, year === value && styles.yearOptionTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: { gap: 2 },
  eyebrow: { color: '#9A8860', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  tagline: { color: '#8F9B93', fontSize: 12, marginTop: 2 },
  filterRow: { gap: 8, paddingRight: 18 },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: '#35473D', backgroundColor: '#141F1A', paddingHorizontal: 14, paddingVertical: 9 },
  filterChipActive: { borderColor: GOLD, backgroundColor: 'rgba(215,180,90,0.12)' },
  filterChipText: { color: '#89968E', fontSize: 11, fontWeight: '900' },
  filterChipTextActive: { color: '#F3D981' },
  timelinePanel: { borderRadius: 22, backgroundColor: '#121D18', borderWidth: 1, borderColor: '#2F4036', paddingVertical: 14 },
  timelineTopRow: { paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineCount: { color: '#8D9B92', fontSize: 10, fontWeight: '800' },
  clearFilter: { color: TEAL, fontSize: 10, fontWeight: '900' },
  timelineScroll: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 },
  timelineStepWrap: { width: 164, alignItems: 'center' },
  connectorRow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  connectorLine: { flex: 1, height: 2, backgroundColor: GOLD },
  connectorLineHidden: { opacity: 0 },
  timelineNode: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFF0B3', backgroundColor: '#5B4B22', alignItems: 'center', justifyContent: 'center' },
  timelineNodeStamp: { borderColor: TEAL, backgroundColor: '#173D38' },
  timelineNodeBadge: { borderColor: GOLD, backgroundColor: '#4B3C18' },
  timelineNodeInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF8E8' },
  timelineCard: { width: 148, minHeight: 205, marginTop: 8, borderRadius: 18, backgroundColor: '#19261F', borderWidth: 1, borderColor: '#35473D', padding: 11, alignItems: 'center' },
  timelineCardPressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
  artShell: { height: 88, width: '100%', alignItems: 'center', justifyContent: 'center' },
  joinMark: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: TEAL, backgroundColor: '#14332F', alignItems: 'center', justifyContent: 'center', marginVertical: 5 },
  joinMarkTop: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  joinMarkBottom: { color: TEAL, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 1 },
  genericStamp: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: TEAL, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14302C' },
  genericStampText: { color: TEAL, fontWeight: '900', fontSize: 17 },
  genericBadge: { width: 72, height: 72, borderRadius: 18, borderWidth: 2, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B2618' },
  genericBadgeText: { color: GOLD, fontSize: 26, fontWeight: '900' },
  timelineTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900', lineHeight: 16, textAlign: 'center', marginTop: 7 },
  timelineDate: { color: '#C6B477', fontSize: 10, fontWeight: '800', marginTop: 7, textAlign: 'center' },
  timelineLocation: { color: '#78877F', fontSize: 9, marginTop: 3, textAlign: 'center' },
  todayNode: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFF8E8', backgroundColor: '#233129', alignItems: 'center', justifyContent: 'center' },
  todayNodeInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL },
  todayCard: { justifyContent: 'center' },
  todayCompass: { width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: '#526158', alignItems: 'center', justifyContent: 'center' },
  todayCompassText: { color: TEAL, fontSize: 31 },
  todayLabel: { color: TEAL, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  todayTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  emptyJourney: { margin: 14, padding: 18, borderRadius: 16, backgroundColor: '#17231D', borderWidth: 1, borderColor: '#2D3C34' },
  emptyJourneyTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 15 },
  emptyJourneyText: { color: '#8F9D95', marginTop: 5, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' },
  yearSheet: { backgroundColor: '#17231D', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#394A41', padding: 18, paddingBottom: 34, gap: 8 },
  yearHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#56645D', alignSelf: 'center', marginBottom: 4 },
  yearTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  yearOption: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#2C3B33' },
  yearOptionActive: { borderColor: GOLD, backgroundColor: 'rgba(215,180,90,0.1)' },
  yearOptionText: { color: '#A2AEA7', fontWeight: '800' },
  yearOptionTextActive: { color: '#F4D67B' },
});
