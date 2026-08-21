import { router, useLocalSearchParams } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTrailGuideArticle } from '../../../src/trailGuide/guides';
import { AppIcon } from '../../../src/ui/AppIcon';

export default function TrailGuideArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = getTrailGuideArticle(id);

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
            <Text style={styles.eyebrow}>{guide.topic.toUpperCase()} · GUIDES & KNOW-HOW</Text>
            <Text style={styles.title}>{guide.title}</Text>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <Text style={styles.intro}>{guide.intro}</Text>
          <View style={styles.card}>
            {guide.points.map((point, index) => (
              <View key={`${guide.id}-${index}`} style={styles.pointRow}>
                <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>Use this guide as general preparation. Always follow the current rules and safety guidance for the place you are visiting.</Text>
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
  eyebrow: { color: '#F5C400', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: '#FFFDF6', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 6 },
  body: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 76 },
  intro: { color: '#E2E7E3', fontSize: 16, lineHeight: 24 },
  card: { marginTop: 22, borderRadius: 18, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#111915', padding: 16, gap: 5 },
  pointRow: { minHeight: 62, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
  number: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B2C20' },
  numberText: { color: '#8ED47A', fontSize: 12, fontWeight: '900' },
  pointText: { color: '#D7DED9', fontSize: 14, lineHeight: 21, flex: 1 },
  note: { color: '#7F8C85', fontSize: 11, lineHeight: 17, marginTop: 16 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backButton: { marginTop: 18, minHeight: 44, justifyContent: 'center', borderRadius: 14, backgroundColor: '#F5C400', paddingHorizontal: 18 },
  backButtonText: { color: '#11150F', fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
