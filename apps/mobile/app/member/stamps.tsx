import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getPassportStamps, type PassportStamp } from '../../src/passport/api';
import { isLegacyStampCode, StampArt } from '../../src/passport/StampArt';
import { AppIcon } from '../../src/ui/AppIcon';

export default function ProfileStampsScreen() {
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void getPassportStamps()
      .then(setStamps)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load stamps.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to profile">
        <AppIcon name="chevron-forward" color="#F5C341" size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        <Text style={styles.backText}>Profile</Text>
      </Pressable>
      <View>
        <Text style={styles.eyebrow}>PASSPORT COLLECTION</Text>
        <Text style={styles.title}>Stamps</Text>
        <Text style={styles.copy}>Tutorial milestones and official adventures leave permanent marks in your collection.</Text>
      </View>

      {loading ? <ActivityIndicator color="#F5C341" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !stamps.length ? (
        <View style={styles.empty}>
          <AppIcon name="stamp" color="#F5C341" size={34} />
          <Text style={styles.emptyTitle}>Your stamp book is waiting.</Text>
          <Text style={styles.copy}>Finish the guided tutorial or complete an official adventure to earn your first stamp.</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {stamps.map((stamp) => (
          <Pressable
            key={`${stamp.stamp_id}-${stamp.adventure_id ?? 'none'}`}
            style={styles.card}
            onPress={() => stamp.adventure_id && router.push(`/passport/reflection/${stamp.adventure_id}`)}
          >
            <View style={styles.art}>
              {isLegacyStampCode(stamp.code) ? <StampArt code={stamp.code} width={108} /> : <View style={styles.generic}><AppIcon name="stamp" color="#F5C341" size={42} /></View>}
            </View>
            <Text style={styles.cardTitle}>{stamp.title}</Text>
            <Text style={styles.earned}>Earned {new Date(stamp.earned_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
          </Pressable>
        ))}
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
  loader: { marginTop: 24 },
  error: { color: '#FFB4A9' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', minHeight: 185, backgroundColor: '#111A17', borderRadius: 18, borderWidth: 1, borderColor: '#29342F', padding: 12, alignItems: 'center' },
  art: { height: 116, alignItems: 'center', justifyContent: 'center' },
  generic: { width: 82, height: 82, borderRadius: 20, borderWidth: 2, borderColor: '#D7B45A', backgroundColor: '#21302A', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#F7F8F3', fontSize: 13.5, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  earned: { color: '#67CFC8', fontSize: 10.5, fontWeight: '800', marginTop: 6 },
  empty: { backgroundColor: '#111A17', borderRadius: 18, borderWidth: 1, borderColor: '#29342F', padding: 22, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#F7F8F3', fontSize: 17, fontWeight: '900', textAlign: 'center' },
});