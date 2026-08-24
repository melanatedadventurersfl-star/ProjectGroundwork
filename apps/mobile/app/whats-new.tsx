import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { currentReleaseNotes } from '../src/updates/releaseNotes';
import { markReleaseSeen } from '../src/updates/releasePreference';
import { AppIcon } from '../src/ui/AppIcon';

export default function WhatsNewScreen() {
  useEffect(() => {
    try {
      markReleaseSeen(currentReleaseNotes.id);
    } catch (error) {
      console.warn('[updates] Unable to save release-note preference', error);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
          <AppIcon name="chevron-back" color="#D7B45A" size={22} />
          <Text style={styles.backText}>Menu</Text>
        </Pressable>

        <Text style={styles.eyebrow}>GO MELANATED</Text>
        <Text style={styles.title}>{currentReleaseNotes.title}</Text>
        <Text style={styles.intro}>{currentReleaseNotes.intro}</Text>

        <View style={styles.card}>
          {currentReleaseNotes.items.map((item, index) => (
            <View key={item} style={[styles.itemRow, index > 0 && styles.divider]}>
              <View style={styles.dot} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>You’ll only see What’s New in Menu again when a new changelog release is available.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 48 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 28 },
  backText: { color: '#D7B45A', fontSize: 15, fontWeight: '800' },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 41, fontWeight: '900', marginTop: 5 },
  intro: { color: '#B7C2BA', fontSize: 16, lineHeight: 23, marginTop: 12, marginBottom: 22 },
  card: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#26332C', overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18 },
  divider: { borderTopWidth: 1, borderTopColor: '#26332C' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D7B45A', marginTop: 7 },
  itemText: { flex: 1, color: '#F0F3F1', fontSize: 15, lineHeight: 22 },
  footer: { color: '#7F8B83', fontSize: 12, lineHeight: 18, marginTop: 16 },
});
