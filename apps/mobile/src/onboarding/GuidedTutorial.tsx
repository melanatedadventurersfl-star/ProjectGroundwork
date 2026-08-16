import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const steps = [
  {
    eyebrow: 'TRAIL MARKER 1 OF 5',
    title: 'Your Trailhead',
    body: 'Your adventure starts here. See what’s happening, check your next adventure, catch the weather, and jump back into the community.',
    action: 'Next',
    route: '/(tabs)',
    focus: 'trailhead',
  },
  {
    eyebrow: 'TRAIL MARKER 2 OF 5',
    title: 'Find Your People',
    body: 'This is the Outpost. Share updates, join conversations, discover people nearby, and keep up with your Circle.',
    action: 'Show Me',
    route: '/(tabs)/community',
    focus: 'outpost',
  },
  {
    eyebrow: 'TRAIL MARKER 3 OF 5',
    title: 'Choose Your Next Adventure',
    body: 'Ready to get outside? Explore upcoming adventures, see who’s hosting, check the details, and join when you find one that feels right.',
    action: 'Next Adventure',
    route: '/(tabs)/explore',
    focus: 'adventures',
  },
  {
    eyebrow: 'TRAIL MARKER 4 OF 5',
    title: 'Build Your Circle',
    body: 'Good adventures are better with good people. Connect with people you meet, add them to your Circle, and stay connected beyond the trail.',
    action: 'Got It',
    route: '/circles',
    focus: 'circle',
  },
  {
    eyebrow: 'TRAIL MARKER 5 OF 5',
    title: 'Your Adventure Story',
    body: 'Your profile grows with every adventure. Collect stamps, earn badges, save memories, and watch your journey build over time.',
    action: 'Start Exploring',
    route: '/(tabs)/passport',
    focus: 'passport',
  },
] as const;

type Props = {
  visible: boolean;
  step: number;
  onStepChange: (step: number) => void;
  onFinish: () => void;
  onSkip: () => void;
};

export function GuidedTutorial({ visible, step, onStepChange, onFinish, onSkip }: Props) {
  const current = steps[Math.max(0, Math.min(steps.length - 1, step))];

  function goTo(nextStep: number) {
    const next = steps[nextStep];
    if (!next) {
      onFinish();
      return;
    }
    onStepChange(nextStep);
    router.replace(next.route as never);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.shade} />
        <View pointerEvents="none" style={[styles.focusRing, focusStyles[current.focus]]} />
        <View pointerEvents="none" style={styles.trailStem} />

        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.eyebrow}>{current.eyebrow}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Skip tutorial" hitSlop={10} onPress={onSkip}>
                <Text style={styles.skip}>Skip</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>

            {current.focus === 'outpost' ? (
              <View style={styles.chips}>
                <View style={styles.chip}><Text style={styles.chipText}>General</Text></View>
                <View style={styles.chip}><Text style={styles.chipText}>Circle</Text></View>
                <View style={styles.chip}><Text style={styles.chipText}>Nearby</Text></View>
              </View>
            ) : null}

            <View style={styles.progressRow}>
              <View style={styles.dots}>
                {steps.map((_, index) => <View key={index} style={[styles.dot, index === step && styles.dotActive]} />)}
              </View>
              <Pressable style={styles.primary} accessibilityRole="button" onPress={() => goTo(step + 1)}>
                <Text style={styles.primaryText}>{current.action}{step === steps.length - 1 ? '  🌲' : ''}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const focusStyles = StyleSheet.create({
  trailhead: { top: 116, left: 16, right: 16, height: 330 },
  outpost: { top: 112, left: 16, right: 16, height: 210 },
  adventures: { top: 138, left: 16, right: 16, height: 360 },
  circle: { top: 126, left: 16, right: 16, height: 300 },
  passport: { top: 118, left: 16, right: 16, height: 350 },
});

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 8, 5, 0.62)' },
  focusRing: { position: 'absolute', borderRadius: 24, borderWidth: 2, borderColor: '#E4C66E', backgroundColor: 'rgba(215,180,90,0.05)', shadowColor: '#D7B45A', shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  trailStem: { position: 'absolute', left: 34, bottom: 280, width: 2, height: 64, backgroundColor: '#D7B45A', opacity: 0.9 },
  cardWrap: { paddingHorizontal: 16, paddingBottom: 28 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: '#495C51', backgroundColor: '#17211C', padding: 20, gap: 11, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  skip: { color: '#B9C4BD', fontSize: 13, fontWeight: '800' },
  title: { color: '#FFF8E8', fontSize: 27, lineHeight: 31, fontWeight: '900' },
  body: { color: '#B5C0B9', fontSize: 15, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#3A4D42', backgroundColor: '#203029' },
  chipText: { color: '#E6ECE8', fontSize: 12, fontWeight: '800' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 5 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#53635A' },
  dotActive: { width: 18, backgroundColor: '#D7B45A' },
  primary: { minHeight: 46, borderRadius: 14, backgroundColor: '#D7B45A', paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#17211C', fontSize: 14, fontWeight: '900' },
});
