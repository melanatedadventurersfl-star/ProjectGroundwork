import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { trailGuideArticles } from '../../src/trailGuide/guides';
import { AppIcon } from '../../src/ui/AppIcon';

function topicAccent(topic: string) {
  if (topic === 'Camping') return '#D7B45A';
  if (topic === 'Water') return '#61BFC4';
  if (topic === 'Hiking') return '#93C66D';
  if (topic === 'Conditions') return '#E39B55';
  if (topic === 'Wildlife') return '#A9C579';
  if (topic === 'Family') return '#E0BF79';
  if (topic === 'Stewardship') return '#78A982';
  return '#D7B45A';
}

export default function TrailGuideGuidesScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <AppIcon name="chevron-back" color="#D7B45A" size={20} />
          <Text style={styles.backText}>Trail Guide</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>FIELD NOTES</Text>
          <Text style={styles.title}>Quick Guides</Text>
          <Text style={styles.subtitle}>Practical Florida outdoor guidance for camping, trails, water, weather, wildlife, and trip planning.</Text>
        </View>

        <View style={styles.grid}>
          {trailGuideArticles.map((guide) => {
            const accent = topicAccent(guide.topic);
            return (
              <Pressable
                key={guide.id}
                onPress={() => router.push(`/trail-guide/guide/${guide.id}` as never)}
                style={({ pressed }) => [styles.card, { borderColor: accent }, pressed && styles.pressed]}
              >
                <View style={[styles.topicPill, { borderColor: accent }]}>
                  <Text style={[styles.topicText, { color: accent }]}>{guide.topic.toUpperCase()}</Text>
                </View>
                <Text style={styles.cardTitle}>{guide.title}</Text>
                <Text numberOfLines={3} style={styles.cardIntro}>{guide.intro}</Text>
                <View style={styles.cardFooter}>
                  <Text style={[styles.openText, { color: accent }]}>Open Guide</Text>
                  <AppIcon name="chevron-forward" color={accent} size={17} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08100C' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 60 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#D7B45A', fontSize: 12, fontWeight: '900' },
  header: { marginTop: 8, marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#FFFDF6', fontSize: 31, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A8B2AC', fontSize: 12, lineHeight: 18, marginTop: 6 },
  grid: { gap: 11 },
  card: { minHeight: 154, borderRadius: 18, borderWidth: 1.5, backgroundColor: '#111A15', padding: 14 },
  topicPill: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, backgroundColor: '#0B120E', paddingHorizontal: 8, paddingVertical: 4 },
  topicText: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  cardTitle: { color: '#FFFDF6', fontSize: 18, lineHeight: 22, fontWeight: '900', marginTop: 10 },
  cardIntro: { color: '#AAB4AE', fontSize: 10.5, lineHeight: 15, marginTop: 5 },
  cardFooter: { marginTop: 'auto', paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openText: { fontSize: 9, fontWeight: '900' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
