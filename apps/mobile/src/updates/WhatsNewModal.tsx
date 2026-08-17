import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReleaseNotes } from './releaseNotes';

type Props = {
  visible: boolean;
  release: ReleaseNotes;
  onDismiss: () => void;
};

export function WhatsNewModal({ visible, release, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>MELANATED ADVENTURERS</Text>
              <Text style={styles.title}>{release.title}</Text>
            </View>
            <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close what's new">
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.intro}>{release.intro}</Text>

          <View style={styles.list}>
            {release.items.map((item) => (
              <View key={item} style={styles.itemRow}>
                <View style={styles.dot} />
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.button} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.buttonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 8, 6, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#142019',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2A3A31',
    padding: 22,
    gap: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.25, marginBottom: 7 },
  title: { color: '#FFF8E8', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  close: { color: '#C8D1CB', fontSize: 31, lineHeight: 31, fontWeight: '300' },
  intro: { color: '#B7C2BA', fontSize: 15, lineHeight: 21 },
  list: { gap: 13 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D7B45A', marginTop: 7 },
  itemText: { flex: 1, color: '#F0F3F1', fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#D7B45A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  buttonText: { color: '#111712', fontSize: 15, fontWeight: '900' },
});
