import { router, useLocalSearchParams } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../../../src/ui/AppIcon';

type GuideDetail = {
  title: string;
  image: string;
  intro: string;
  points: string[];
};

const guides: Record<string, GuideDetail> = {
  'camping-essentials': {
    title: 'Camping Essentials Checklist',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=82',
    intro: 'A simple starting checklist for a comfortable first night outside.',
    points: ['Shelter and sleep system', 'Water and easy meals', 'Lighting and backup power', 'Weather layer and sun protection', 'Basic first-aid supplies'],
  },
  'hiking-safety': {
    title: 'Hiking Safety Tips',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=82',
    intro: 'A few habits that make day hikes safer without making them complicated.',
    points: ['Know your route before leaving', 'Carry more water than you expect to need', 'Check weather and daylight', 'Tell someone your plan', 'Turn around before conditions become a problem'],
  },
  'leave-no-trace': {
    title: 'Leave No Trace Principles',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=82',
    intro: 'Small choices help keep outdoor spaces healthy and welcoming for everyone.',
    points: ['Stay on durable surfaces', 'Pack out what you bring in', 'Respect wildlife and distance', 'Leave natural objects where they are', 'Keep noise and impact low'],
  },
};

export default function TrailGuideArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = id ? guides[id] : undefined;

  if (!guide) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <Text style={styles.title}>Guide unavailable</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backButtonText}>Back to Trail Guide</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground source={{ uri: guide.image }} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.shade} />
          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.backLabel}>Trail Guide</Text>
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>GUIDES & KNOW-HOW</Text>
            <Text style={styles.title}>{guide.title}</Text>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <Text style={styles.intro}>{guide.intro}</Text>
          <View style={styles.card}>
            {guide.points.map((point, index) => (
              <View key={point} style={styles.pointRow}>
                <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08100C' },
  hero: { height: 330, justifyContent: 'space-between' },
  heroImage: { resizeMode: 'cover' },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,10,7,0.52)' },
  back: { marginTop: 14, marginLeft: 16, minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(9,16,12,0.58)' },
  backLabel: { color: '#FFFDF6', fontSize: 13, fontWeight: '900' },
  heroCopy: { padding: 22 },
  eyebrow: { color: '#F5C400', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFFDF6', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 6 },
  body: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 76 },
  intro: { color: '#E2E7E3', fontSize: 16, lineHeight: 24 },
  card: { marginTop: 22, borderRadius: 18, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#111915', padding: 16, gap: 5 },
  pointRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B2C20' },
  numberText: { color: '#8ED47A', fontSize: 12, fontWeight: '900' },
  pointText: { color: '#D7DED9', fontSize: 14, lineHeight: 20, flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backButton: { marginTop: 18, minHeight: 44, justifyContent: 'center', borderRadius: 14, backgroundColor: '#F5C400', paddingHorizontal: 18 },
  backButtonText: { color: '#11150F', fontWeight: '900' },
  pressed: { opacity: 0.7 },
});