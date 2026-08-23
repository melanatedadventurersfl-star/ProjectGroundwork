import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { getPassportStamps, type PassportStamp } from '../../src/passport/api';
import { STAMP_CATALOG, type StampCatalogItem } from '../../src/passport/StampCatalog';
import { getTrailheadFavorites, setFavoriteStamps } from '../../src/trailhead/favorites';
import { AppIcon } from '../../src/ui/AppIcon';

const SHOW_ALL_STAMPS = true;
type YearFilter = 'all' | 2025 | 2026;
const FILTER_OPTIONS: readonly { value: YearFilter; label: string }[] = [
  { value: 'all', label: 'All Years' },
  { value: 2025, label: '2025' },
  { value: 2026, label: '2026' },
];

function StampCard({ stamp, collected, favorite, onFavorite, cardWidth, tablet }: { stamp: StampCatalogItem; collected: boolean; favorite: boolean; onFavorite: () => void; cardWidth: number; tablet: boolean }) {
  return (
    <View style={[styles.card, { width: cardWidth }, tablet && styles.cardTablet, favorite && styles.cardFavorite]}>
      {collected ? <Pressable onPress={onFavorite} style={[styles.favoriteButton, favorite && styles.favoriteButtonActive]} accessibilityRole="button" accessibilityLabel={`${favorite ? 'Remove' : 'Add'} Trailhead favorite`}><Text style={[styles.favoriteStar, favorite && styles.favoriteStarActive]}>★</Text></Pressable> : null}
      <Pressable style={({ pressed }) => [styles.cardTap, pressed && styles.cardPressed]} onPress={() => router.push(`/member/stamp/${stamp.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${stamp.title} stamp`}>
        <View style={[styles.art, tablet && styles.artTablet, stamp.year === 2026 && styles.artTall, stamp.year === 2026 && tablet && styles.artTallTablet]}><Image source={stamp.source} style={styles.stampImage} resizeMode="contain" /></View>
        <Text style={[styles.cardTitle, tablet && styles.cardTitleTablet]} numberOfLines={2}>{stamp.title}</Text>
        <Text style={[styles.date, tablet && styles.dateTablet]}>{stamp.dateLabel}</Text>
        {collected ? <Text style={[styles.collected, tablet && styles.collectedTablet]}>{favorite ? 'TRAILHEAD FAVORITE' : 'COLLECTED'}</Text> : null}
      </Pressable>
    </View>
  );
}

export default function ProfileStampsScreen() {
  const { session } = useAuth();
  const { width: viewportWidth } = useWindowDimensions();
  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [filter, setFilter] = useState<YearFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const tabletGrid = viewportWidth >= 600;
  const gridColumns = tabletGrid ? 3 : 2;
  const gridGap = tabletGrid ? 9 : 10;
  const gridWidth = Math.max(0, viewportWidth - 36);
  const cardWidth = Math.floor((gridWidth - gridGap * (gridColumns - 1)) / gridColumns);

  useEffect(() => {
    void Promise.all([getPassportStamps(), getTrailheadFavorites(session?.user.id)]).then(([stamps, favorites]) => { setEarnedStamps(stamps); setFavoriteCodes(favorites.stamps); }).catch(() => { setEarnedStamps([]); setFavoriteCodes([]); });
  }, [session?.user.id]);

  const earnedByCode = useMemo(() => new Map(earnedStamps.filter((stamp) => stamp.code).map((stamp) => [stamp.code, stamp])), [earnedStamps]);
  const availableStamps = useMemo(() => SHOW_ALL_STAMPS ? STAMP_CATALOG : STAMP_CATALOG.filter((stamp) => stamp.code && earnedByCode.has(stamp.code)), [earnedByCode]);
  const visibleStamps = useMemo(() => filter === 'all' ? availableStamps : availableStamps.filter((stamp) => stamp.year === filter), [availableStamps, filter]);
  const summaryLabel = filter === 'all' ? '2025–2026' : `${filter} COLLECTION`;
  const selectedFilterLabel = FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? 'All Years';

  async function saveFavorites(next: string[]) { const saved = await setFavoriteStamps(session?.user.id, next); setFavoriteCodes(saved.stamps); }
  function toggleFavorite(stamp: StampCatalogItem) {
    if (!stamp.code || !earnedByCode.has(stamp.code)) return;
    if (favoriteCodes.includes(stamp.code)) { void saveFavorites(favoriteCodes.filter((code) => code !== stamp.code)); return; }
    if (favoriteCodes.length < 3) { void saveFavorites([...favoriteCodes, stamp.code]); return; }
    const titleByCode = new Map(STAMP_CATALOG.filter((item) => item.code).map((item) => [item.code as string, item.title]));
    Alert.alert('Choose a Trailhead favorite', 'You can display up to 3 stamps. Select one of your current favorites to swap.', [
      { text: 'Cancel', style: 'cancel' },
      ...favoriteCodes.map((code) => ({ text: titleByCode.get(code) || 'Favorite stamp', onPress: () => void saveFavorites(favoriteCodes.map((current) => current === code ? stamp.code as string : current)) })),
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to profile"><AppIcon name="chevron-forward" color="#F5C341" size={24} style={{ transform: [{ rotate: '180deg' }] }} /><Text style={styles.backText}>Profile</Text></Pressable>
      <View style={styles.hero}><Text style={styles.eyebrow}>PASSPORT COLLECTION</Text><Text style={styles.title}>Stamps</Text><Text style={styles.copy}>Official adventures leave permanent travel marks in your collection.</Text><Text style={styles.favoriteHelp}>★ Choose up to 3 collected stamps for your Trailhead banner.</Text></View>
      <View style={styles.filterWrap}>
        <Pressable onPress={() => setFilterOpen((open) => !open)} style={({ pressed }) => [styles.filterButton, pressed && styles.filterButtonPressed]} accessibilityRole="button" accessibilityLabel={`Filter stamps by year. Current filter ${selectedFilterLabel}`} accessibilityState={{ expanded: filterOpen }}><View><Text style={styles.filterEyebrow}>SHOW COLLECTION</Text><Text style={styles.filterValue}>{selectedFilterLabel}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={19} style={{ transform: [{ rotate: filterOpen ? '270deg' : '90deg' }] }} /></Pressable>
        {filterOpen ? <View style={styles.filterMenu}>{FILTER_OPTIONS.map((option, index) => { const active = option.value === filter; return <Pressable key={String(option.value)} onPress={() => { setFilter(option.value); setFilterOpen(false); }} style={({ pressed }) => [styles.filterOption, index > 0 && styles.filterOptionBorder, active && styles.filterOptionActive, pressed && styles.filterOptionPressed]} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{option.label}</Text>{active ? <AppIcon name="checkmark" color="#17211C" size={17} /> : null}</Pressable>; })}</View> : null}
        <View style={styles.summaryRow}><View style={styles.summaryPill}><AppIcon name="stamp" color="#F5C341" size={13} /><Text style={styles.summaryText}>{visibleStamps.length} STAMP{visibleStamps.length === 1 ? '' : 'S'}</Text></View><Text style={styles.summaryDot}>•</Text><Text style={styles.summaryText}>{summaryLabel}</Text></View>
      </View>
      <View style={[styles.grid, { columnGap: gridGap, rowGap: gridGap }]}>{visibleStamps.map((stamp) => { const collected = Boolean(stamp.code && earnedByCode.has(stamp.code)); return <StampCard key={stamp.id} stamp={stamp} collected={collected} favorite={Boolean(stamp.code && favoriteCodes.includes(stamp.code))} onFavorite={() => toggleFavorite(stamp)} cardWidth={cardWidth} tablet={tabletGrid} />; })}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09110F' }, content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 90, gap: 14 }, back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -5 }, backText: { color: '#F5C341', fontWeight: '800' }, hero: { gap: 3 }, eyebrow: { color: '#67CFC8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#F7F8F3', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 2 }, copy: { color: '#98A59E', fontSize: 14, lineHeight: 20, marginTop: 3, maxWidth: 440 }, favoriteHelp: { color: '#F5C341', fontSize: 11.5, lineHeight: 16, fontWeight: '800', marginTop: 5 },
  filterWrap: { gap: 6, zIndex: 4 }, filterButton: { minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: '#324038', backgroundColor: '#111A17', paddingHorizontal: 13, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filterButtonPressed: { opacity: 0.72 }, filterEyebrow: { color: '#75827B', fontSize: 8, fontWeight: '900', letterSpacing: 0.95 }, filterValue: { color: '#F7F8F3', fontSize: 16, lineHeight: 19, fontWeight: '900' }, filterMenu: { borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#34423B', backgroundColor: '#121B18' }, filterOption: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filterOptionBorder: { borderTopWidth: 1, borderTopColor: '#26312C' }, filterOptionActive: { backgroundColor: '#D7B45A' }, filterOptionPressed: { opacity: 0.72 }, filterOptionText: { color: '#D0D7D3', fontSize: 13.5, fontWeight: '800' }, filterOptionTextActive: { color: '#17211C', fontWeight: '900' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#39453F', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#111A17' }, summaryText: { color: '#B8C2BD', fontSize: 9.75, fontWeight: '900', letterSpacing: 0.4 }, summaryDot: { color: '#58655F', fontSize: 10.5 }, grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { minHeight: 230, backgroundColor: '#111A17', borderRadius: 18, borderWidth: 1, borderColor: '#29342F', paddingHorizontal: 9, paddingTop: 9, paddingBottom: 11, alignItems: 'center', position: 'relative' }, cardFavorite: { borderColor: '#F5C341' }, cardTablet: { minHeight: 196, borderRadius: 16, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 9 }, cardTap: { width: '100%', alignItems: 'center' }, cardPressed: { opacity: 0.68, transform: [{ scale: 0.985 }] }, favoriteButton: { position: 'absolute', top: 8, right: 8, zIndex: 4, width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#49584F', backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' }, favoriteButtonActive: { borderColor: '#F5C341', backgroundColor: '#332D16' }, favoriteStar: { color: '#7F8B85', fontSize: 18 }, favoriteStarActive: { color: '#F5C341' },
  art: { width: '100%', height: 156, alignItems: 'center', justifyContent: 'center' }, artTall: { height: 170 }, artTablet: { height: 124 }, artTallTablet: { height: 136 }, stampImage: { width: '100%', height: '100%' }, cardTitle: { color: '#F7F8F3', fontSize: 12.5, lineHeight: 16, fontWeight: '900', textAlign: 'center', marginTop: 4 }, cardTitleTablet: { fontSize: 11.25, lineHeight: 14, marginTop: 3 }, date: { color: '#67CFC8', fontSize: 10, fontWeight: '800', marginTop: 4, textAlign: 'center' }, dateTablet: { fontSize: 9, marginTop: 3 }, collected: { color: '#F5C341', fontSize: 8, fontWeight: '900', letterSpacing: 0.85, marginTop: 4 }, collectedTablet: { fontSize: 7.5, marginTop: 3 },
});