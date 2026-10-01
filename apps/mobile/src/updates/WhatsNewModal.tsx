import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ReleaseFeature, ReleaseNotes } from './releaseNotes';

type Props = {
  visible: boolean;
  release: ReleaseNotes;
  onDismiss: () => void;
};

export function WhatsNewModal({ visible, release, onDismiss }: Props) {
  function openFeature(feature: ReleaseFeature) {
    if (!feature.href) return;
    onDismiss();
    requestAnimationFrame(() => router.push(feature.href as never));
  }

  const visibleFeatures = release.features.slice(0, 5);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>MELANATED ADVENTURERS</Text>
              <Text style={styles.title}>{release.title}</Text>
              <Text style={styles.subtitle}>{release.subtitle}</Text>
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={14}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close what's new"
            >
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          {(release.dateLabel || release.versionLabel) ? (
            <View style={styles.metaRow}>
              {release.dateLabel ? <Text style={styles.metaText}>{release.dateLabel}</Text> : null}
              {release.dateLabel && release.versionLabel ? <View style={styles.metaDot} /> : null}
              {release.versionLabel ? <Text style={styles.metaText}>{release.versionLabel}</Text> : null}
            </View>
          ) : null}

          <Text style={styles.intro}>{release.intro}</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.featureList}
            showsVerticalScrollIndicator={false}
          >
            {visibleFeatures.map((feature, index) => (
              <View key={feature.id} style={styles.featureCard}>
                <View style={styles.featureTopRow}>
                  <View style={styles.featureMarker}>
                    <Text style={styles.featureNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.featureCopy}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureBody}>{feature.body}</Text>
                  </View>
                </View>
                {feature.ctaLabel && feature.href ? (
                  <Pressable
                    onPress={() => openFeature(feature)}
                    style={styles.featureAction}
                    accessibilityRole="button"
                    accessibilityLabel={feature.ctaLabel}
                  >
                    <Text style={styles.featureActionText}>{feature.ctaLabel}</Text>
                    <Text style={styles.featureActionArrow}>→</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {release.footer ? <Text style={styles.footer}>{release.footer}</Text> : null}
          </ScrollView>

          <Pressable style={styles.button} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss what's new">
            <Text style={styles.buttonText}>Start exploring</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 8, 6, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '88%',
    backgroundColor: '#101A15',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#2A3A31',
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.35, marginBottom: 7 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 34, fontWeight: '900' },
  subtitle: { color: '#E8D9AE', fontSize: 16, lineHeight: 21, fontWeight: '800', marginTop: 7 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B2821',
  },
  close: { color: '#D7DFDA', fontSize: 28, lineHeight: 30, fontWeight: '300', marginTop: -2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13 },
  metaText: { color: '#809087', fontSize: 11, fontWeight: '700', letterSpacing: 0.25 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#66766D' },
  intro: { color: '#BFC9C2', fontSize: 14, lineHeight: 20, marginTop: 13, marginBottom: 14 },
  scroll: { flexShrink: 1 },
  featureList: { gap: 10, paddingBottom: 10 },
  featureCard: {
    backgroundColor: '#16221B',
    borderWidth: 1,
    borderColor: '#26362D',
    borderRadius: 18,
    padding: 14,
  },
  featureTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureMarker: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: '#243127',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4B4933',
  },
  featureNumber: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  featureCopy: { flex: 1 },
  featureTitle: { color: '#FFF8E8', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  featureBody: { color: '#B6C2BA', fontSize: 13, lineHeight: 19, marginTop: 4 },
  featureAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 43,
    marginTop: 10,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#202D25',
  },
  featureActionText: { color: '#E2C46D', fontSize: 12, fontWeight: '900' },
  featureActionArrow: { color: '#E2C46D', fontSize: 14, fontWeight: '700' },
  footer: { color: '#829087', fontSize: 12, lineHeight: 18, paddingHorizontal: 3, paddingTop: 3 },
  button: {
    minHeight: 49,
    borderRadius: 15,
    backgroundColor: '#D7B45A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#111712', fontSize: 14, fontWeight: '900' },
});
