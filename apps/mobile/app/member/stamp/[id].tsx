import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPassportStamps, type PassportStamp } from '../../../src/passport/api';
import { STAMP_CATALOG } from '../../../src/passport/StampCatalog';
import { AppIcon } from '../../../src/ui/AppIcon';

export default function StampDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);
  const stamp = useMemo(() => STAMP_CATALOG.find((item) => item.id === params.id), [params.id]);

  useEffect(() => {
    void getPassportStamps().then(setEarnedStamps).catch(() => setEarnedStamps([]));
  }, []);

  const earned = useMemo(
    () => stamp?.code ? earnedStamps.find((item) => item.code === stamp.code) : undefined,
    [earnedStamps, stamp],
  );

  if (!stamp) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <AppIcon name="stamp" color="#F5C341" size={42} />
          <Text style={styles.missingTitle}>Stamp not found</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to Stamps</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to stamps">
          <AppIcon name="chevron-forward" color="#F5C341" size={24} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>Stamps</Text>
        </Pressable>

        <View style={styles.heroCard}>
          <View style={[styles.artStage, stamp.year === 2026 && styles.artStageTall]}>
            <Image source={stamp.source} style={styles.stampImage} resizeMode="contain" />
          </View>
          <Text style={styles.collection}>{stamp.year} COLLECTION</Text>
          <Text style={styles.title}>{stamp.title}</Text>
          <View style={styles.metaRow}>
            <AppIcon name="adventure" color="#67CFC8" size={15} />
            <Text style={styles.meta}>{stamp.dateLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <AppIcon name="location" color="#67CFC8" size={15} />
            <Text style={styles.meta}>{stamp.location}</Text>
          </View>
          {earned ? <View style={styles.collectedPill}><AppIcon name="checkmark" color="#17211C" size={14} /><Text style={styles.collectedText}>COLLECTED</Text></View> : null}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.eyebrow}>ABOUT THIS STAMP</Text>
          <Text style={styles.body}>A permanent Passport mark from {stamp.title}, preserved as part of the {stamp.year} collection.</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.eyebrow}>ADVENTURE DETAILS</Text>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Collection</Text><Text style={styles.detailValue}>{stamp.year}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Date</Text><Text style={styles.detailValue}>{stamp.dateLabel}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Destination</Text><Text style={[styles.detailValue, styles.detailValueWide]}>{stamp.location}</Text></View>
        </View>

        {earned?.adventure_id ? (
          <Pressable
            onPress={() => router.push(`/passport/reflection/${earned.adventure_id}`)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${stamp.title} adventure`}
          >
            <Text style={styles.primaryButtonText}>Open Adventure</Text>
            <AppIcon name="chevron-forward" color="#17211C" size={20} />
          </Pressable>
        ) : null}

        <View style={styles.footerMark}>
          <AppIcon name="stamp" color="#D7B45A" size={17} />
          <Text style={styles.footerText}>PART OF THE {stamp.year} PASSPORT COLLECTION</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 72, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -5 },
  backText: { color: '#F5C341', fontWeight: '800' },
  heroCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 24, padding: 18, alignItems: 'center' },
  artStage: { width: '100%', height: 330, alignItems: 'center', justifyContent: 'center' },
  artStageTall: { height: 390 },
  stampImage: { width: '100%', height: '100%' },
  collection: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 10 },
  title: { color: '#F7F8F3', fontSize: 25, lineHeight: 30, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 9, paddingHorizontal: 10 },
  meta: { color: '#B6C1BB', fontSize: 13, lineHeight: 18, textAlign: 'center', flexShrink: 1 },
  collectedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, backgroundColor: '#F5C341', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  collectedText: { color: '#17211C', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  infoCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 18, padding: 16 },
  eyebrow: { color: '#67CFC8', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8 },
  body: { color: '#C7D0CB', fontSize: 14, lineHeight: 21 },
  detailRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderTopWidth: 1, borderTopColor: '#25312C' },
  detailLabel: { color: '#7E8C84', fontSize: 12, fontWeight: '800' },
  detailValue: { color: '#F7F8F3', fontSize: 12.5, fontWeight: '800', textAlign: 'right' },
  detailValueWide: { flex: 1 },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#F5C341', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  primaryButtonText: { color: '#17211C', fontSize: 14, fontWeight: '900' },
  buttonPressed: { opacity: 0.72 },
  footerMark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 6 },
  footerText: { color: '#7C8982', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  missingTitle: { color: '#F7F8F3', fontSize: 22, fontWeight: '900' },
});
