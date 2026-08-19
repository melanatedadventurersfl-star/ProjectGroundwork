import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getPassportStamps, type PassportStamp } from '../../src/passport/api';
import { STAMP_CATALOG } from '../../src/passport/StampCatalog';
import { AppIcon } from '../../src/ui/AppIcon';

// Temporary showcase mode. Switch this off once stamp ownership is fully linked to event completion.
const SHOW_ALL_STAMPS = true;

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

      <View>
        <Text style={styles.eyebrow}>PASSPORT COLLECTION</Text>
        <Text style={styles.title}>Stamps</Text>
        <Text style={styles.copy}>Official adventures leave a permanent travel mark in your collection.</Text>
      </View>

      <View style={styles.grid}>
        {visibleStamps.map((stamp) => {
          const earned = stamp.code ? earnedByCode.get(stamp.code) : undefined;
          return (
            <Pressable
              key={stamp.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => earned?.adventure_id && router.push(`/passport/reflection/${earned.adventure_id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${stamp.title}, ${stamp.dateLabel}`}
            >
              <View style={styles.art}>
                <Image source={stamp.source} style={styles.stampImage} resizeMode="contain" />
              </View>
              <Text style={styles.collection}>{stamp.year} COLLECTION</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>{stamp.title}</Text>
              <Text style={styles.date}>{stamp.dateLabel}</Text>
              <Text style={styles.location} numberOfLines={2}>{stamp.location}</Text>
              {earned ? <Text style={styles.earned}>COLLECTED</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09110F' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 80, gap: 18 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -5 },
  backText: { color: '#F5C341', fontWeight: '800' },
  eyebrow: { color: '#67CFC8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F7F8F3', fontSize: 32, lineHeight: 37, fontWeight: '900', marginTop: 3 },
  copy: { color: '#98A59E', fontSize: 14, lineHeight: 20, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', minHeight: 304, backgroundColor: '#111A17', borderRadius: 20, borderWidth: 1, borderColor: '#29342F', padding: 10, alignItems: 'center' },
  cardPressed: { opacity: 0.7 },
  art: { width: '100%', height: 196, alignItems: 'center', justifyContent: 'center' },
  stampImage: { width: '100%', height: '100%' },
  collection: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  cardTitle: { color: '#F7F8F3', fontSize: 13.5, lineHeight: 17, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  date: { color: '#67CFC8', fontSize: 10.5, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  location: { color: '#97A49D', fontSize: 9.5, lineHeight: 13, marginTop: 3, textAlign: 'center' },
  earned: { color: '#F5C341', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 7 },
});
