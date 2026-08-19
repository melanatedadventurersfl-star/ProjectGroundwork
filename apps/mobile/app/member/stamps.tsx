import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getPassportStamps, type PassportStamp } from '../../src/passport/api';
import { STAMP_CATALOG, type StampCatalogItem } from '../../src/passport/StampCatalog';
import { AppIcon } from '../../src/ui/AppIcon';

// Temporary showcase mode. Switch this off once stamp ownership is fully linked to event completion.
const SHOW_ALL_STAMPS = true;
const COLLECTION_YEARS = [2026, 2025] as const;

function StampCard({ stamp, collected }: { stamp: StampCatalogItem; collected: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/member/stamp/${stamp.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${stamp.title} stamp`}
    >
      <View style={[styles.art, stamp.year === 2026 && styles.artTall]}>
        <Image source={stamp.source} style={styles.stampImage} resizeMode="contain" />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{stamp.title}</Text>
      <Text style={styles.date}>{stamp.dateLabel}</Text>
      {collected ? <Text style={styles.collected}>COLLECTED</Text> : null}
    </Pressable>
  );
}

export default function ProfileStampsScreen() {
  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);

  useEffect(() => {
    void getPassportStamps().then(setEarnedStamps).catch(() => setEarnedStamps([]));
  }, []);

  const earnedByCode = useMemo(
    () => new Map(earnedStamps.filter((stamp) => stamp.code).map((stamp) => [stamp.code, stamp])),
    [earnedStamps],
  );

  const visibleStamps = useMemo(
    () => SHOW_ALL_STAMPS
      ? STAMP_CATALOG
      : STAMP_CATALOG.filter((stamp) => stamp.code && earnedByCode.has(stamp.code)),
    [earnedByCode],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to profile">
        <AppIcon name="chevron-forward" color="#F5C341" size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        <Text style={styles.backText}>Profile</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PASSPORT COLLECTION</Text>
        <Text style={styles.title}>Stamps</Text>
        <Text style={styles.copy}>Official adventures leave permanent travel marks in your collection.</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <AppIcon name="stamp" color="#F5C341" size={14} />
            <Text style={styles.summaryText}>{visibleStamps.length} STAMPS</Text>
          </View>
          <Text style={styles.summaryDot}>•</Text>
          <Text style={styles.summaryText}>2025–2026</Text>
        </View>
      </View>

      {COLLECTION_YEARS.map((year) => {
        const collection = visibleStamps.filter((stamp) => stamp.year === year);
        if (!collection.length) return null;
        return (
          <View key={year} style={styles.collectionSection}>
            <View style={styles.collectionHeader}>
              <View>
                <Text style={styles.collectionEyebrow}>PASSPORT SERIES</Text>
                <Text style={styles.collectionTitle}>{year} Collection</Text>
              </View>
              <Text style={styles.collectionCount}>{collection.length} stamp{collection.length === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.grid}>
              {collection.map((stamp) => (
                <StampCard
                  key={stamp.id}
                  stamp={stamp}
                  collected={Boolean(stamp.code && earnedByCode.has(stamp.code))}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09110F' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 90, gap: 24 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -5 },
  backText: { color: '#F5C341', fontWeight: '800' },
  hero: { gap: 3 },
  eyebrow: { color: '#67CFC8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F7F8F3', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 2 },
  copy: { color: '#98A59E', fontSize: 14, lineHeight: 20, marginTop: 3, maxWidth: 440 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
  summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#39453F', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#111A17' },
  summaryText: { color: '#B8C2BD', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5 },
  summaryDot: { color: '#58655F', fontSize: 12 },
  collectionSection: { gap: 12 },
  collectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: '#25312C' },
  collectionEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  collectionTitle: { color: '#F7F8F3', fontSize: 22, lineHeight: 26, fontWeight: '900', marginTop: 2 },
  collectionCount: { color: '#75827B', fontSize: 11, fontWeight: '800', marginBottom: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', minHeight: 258, backgroundColor: '#111A17', borderRadius: 20, borderWidth: 1, borderColor: '#29342F', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 13, alignItems: 'center' },
  cardPressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
  art: { width: '100%', height: 184, alignItems: 'center', justifyContent: 'center' },
  artTall: { height: 200 },
  stampImage: { width: '100%', height: '100%' },
  cardTitle: { color: '#F7F8F3', fontSize: 13.5, lineHeight: 17, fontWeight: '900', textAlign: 'center', marginTop: 5 },
  date: { color: '#67CFC8', fontSize: 10.5, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  collected: { color: '#F5C341', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9, marginTop: 6 },
});
