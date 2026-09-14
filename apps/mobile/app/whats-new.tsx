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

  function openFeature(href?: string) {
    if (!href) return;
    router.push(href as never);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
          <AppIcon name="chevron-back" color="#D7B45A" size={22} />
          <Text style={styles.backText}>Menu</Text>
        </Pressable>

        <Text style={styles.eyebrow}>GO MELANATED</Text>
        <Text style={styles.title}>{currentReleaseNotes.title}</Text>
        <Text style={styles.subtitle}>{currentReleaseNotes.subtitle}</Text>
        <Text style={styles.intro}>{currentReleaseNotes.intro}</Text>

        <View style={styles.metaRow}>
          {currentReleaseNotes.dateLabel ? <Text style={styles.meta}>{currentReleaseNotes.dateLabel}</Text> : null}
          {currentReleaseNotes.versionLabel ? <Text style={styles.meta}>{currentReleaseNotes.versionLabel}</Text> : null}
        </View>

        <View style={styles.features}>
          {currentReleaseNotes.features.map((feature) => (
            <View key={feature.id} style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <View style={styles.dot} />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureBody}>{feature.body}</Text>
                {feature.ctaLabel && feature.href ? (
                  <Pressable onPress={() => openFeature(feature.href)} accessibilityRole="button" style={styles.featureCta}>
                    <Text style={styles.featureCtaText}>{feature.ctaLabel}</Text>
                    <AppIcon name="chevron-forward" color="#D7B45A" size={15} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {currentReleaseNotes.footer ? <Text style={styles.footer}>{currentReleaseNotes.footer}</Text> : null}
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
  subtitle: { color: '#F0E0B1', fontSize: 19, lineHeight: 25, fontWeight: '800', marginTop: 8 },
  intro: { color: '#B7C2BA', fontSize: 16, lineHeight: 23, marginTop: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 22 },
  meta: { color: '#7F8B83', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  features: { gap: 12 },
  featureCard: { flexDirection: 'row', gap: 12, backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#26332C', padding: 16 },
  featureIcon: { width: 26, alignItems: 'center', paddingTop: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#D7B45A' },
  featureCopy: { flex: 1 },
  featureTitle: { color: '#FFF8E8', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  featureBody: { color: '#B7C2BA', fontSize: 14, lineHeight: 21, marginTop: 5 },
  featureCta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, marginTop: 10, minHeight: 30 },
  featureCtaText: { color: '#D7B45A', fontSize: 13, fontWeight: '900' },
  footer: { color: '#7F8B83', fontSize: 12, lineHeight: 18, marginTop: 18 },
});
