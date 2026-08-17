import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const steps = [
  {
    eyebrow: 'TRAIL MARKER 1 OF 5',
    title: 'Your Trailhead',
    body: 'This is your home base. See featured adventures, upcoming plans, local conditions, and what’s happening in the community.',
    route: '/(tabs)',
    focus: 'trailhead',
  },
  {
    eyebrow: 'TRAIL MARKER 2 OF 5',
    title: 'Find Your People',
    body: 'The Outpost is where the community gathers. Share updates, join conversations, discover people nearby, and keep up with your Crew.',
    route: '/(tabs)/community',
    focus: 'outpost',
  },
  {
    eyebrow: 'TRAIL MARKER 3 OF 5',
    title: 'Choose Your Next Adventure',
    body: 'Explore upcoming adventures and local events, check the details, save what catches your eye, and reserve your spot when you’re ready.',
    route: '/(tabs)/explore',
    focus: 'adventures',
  },
  {
    eyebrow: 'TRAIL MARKER 4 OF 5',
    title: 'Build Your Crew',
    body: 'Connect with people you meet outside, organize them into Crews, and keep the people you adventure with close at hand.',
    route: '/circles',
    focus: 'circle',
  },
  {
    eyebrow: 'TRAIL MARKER 5 OF 5',
    title: 'Your Adventure Story',
    body: 'Your Passport grows with every adventure. Collect stamps, earn badges, save memories, and climb the ranks as your story builds.',
    route: '/(tabs)/passport',
    focus: 'passport',
  },
] as const;

type FocusName = (typeof steps)[number]['focus'];

type Props = {
  visible: boolean;
  step: number;
  onStepChange: (step: number) => void;
  onFinish: () => void;
  onSkip: () => void;
};

type FocusRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getFocusRect(focus: FocusName, screenWidth: number, screenHeight: number): FocusRect {
  const left = clamp(screenWidth * 0.045, 14, 24);
  const width = screenWidth - left * 2;

  const configs: Record<FocusName, { top: number; height: number }> = {
    trailhead: { top: 0.105, height: 0.315 },
    outpost: { top: 0.11, height: 0.245 },
    adventures: { top: 0.13, height: 0.34 },
    circle: { top: 0.12, height: 0.29 },
    passport: { top: 0.11, height: 0.34 },
  };

  const config = configs[focus];
  const top = clamp(screenHeight * config.top, 84, 160);
  const height = clamp(screenHeight * config.height, 190, 390);

  return { top, left, width, height };
}

export function GuidedTutorial({ visible, step, onStepChange, onFinish, onSkip }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const currentIndex = Math.max(0, Math.min(steps.length - 1, step));
  const current = steps[currentIndex]!;
  const focusRect = getFocusRect(current.focus, screenWidth, screenHeight);
  const focusBottom = focusRect.top + focusRect.height;
  const cardGutter = clamp(screenWidth * 0.045, 14, 24);

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
        <View pointerEvents="none" style={[styles.shadePiece, { top: 0, left: 0, right: 0, height: focusRect.top }]} />
        <View pointerEvents="none" style={[styles.shadePiece, { top: focusRect.top, left: 0, width: focusRect.left, height: focusRect.height }]} />
        <View pointerEvents="none" style={[styles.shadePiece, { top: focusRect.top, left: focusRect.left + focusRect.width, right: 0, height: focusRect.height }]} />
        <View pointerEvents="none" style={[styles.shadePiece, { top: focusBottom, left: 0, right: 0, bottom: 0 }]} />

        <View
          pointerEvents="none"
          style={[
            styles.focusRing,
            {
              top: focusRect.top,
              left: focusRect.left,
              width: focusRect.width,
              height: focusRect.height,
            },
          ]}
        />

        <View style={[styles.cardWrap, { left: cardGutter, right: cardGutter }]}>
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.eyebrow}>{current.eyebrow}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Skip tutorial" hitSlop={10} onPress={onSkip}>
                <Text style={styles.skip}>Skip tutorial</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>

            {currentIndex === steps.length - 1 ? (
              <View style={styles.rewardRow}>
                <View style={styles.rewardMark}><Text style={styles.rewardMarkText}>✓</Text></View>
                <View style={styles.rewardCopyWrap}>
                  <Text style={styles.rewardTitle}>Finish the trail</Text>
                  <Text style={styles.rewardCopy}>Complete the tour to earn your Trail Ready Passport stamp.</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.controls}>
              <View style={styles.leadingControls}>
                {currentIndex > 0 ? (
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => goTo(currentIndex - 1)}>
                    <Text style={styles.back}>Back</Text>
                  </Pressable>
                ) : null}
                <View style={styles.dots} accessibilityLabel={`Step ${currentIndex + 1} of ${steps.length}`}>
                  {steps.map((_, index) => <View key={index} style={[styles.dot, index === currentIndex && styles.dotActive]} />)}
                </View>
              </View>

              <Pressable style={styles.primary} accessibilityRole="button" onPress={() => goTo(currentIndex + 1)}>
                <Text style={styles.primaryText}>{currentIndex === steps.length - 1 ? 'Start Exploring' : 'Next'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shadePiece: { position: 'absolute', backgroundColor: 'rgba(3, 8, 5, 0.72)' },
  focusRing: {
    position: 'absolute',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E7C95F',
    backgroundColor: 'transparent',
    shadowColor: '#D7B45A',
    shadowOpacity: 0.42,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  cardWrap: { position: 'absolute', bottom: 24, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 470,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3E574A',
    backgroundColor: '#17211C',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 15,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  skip: { color: '#AFC2B8', fontSize: 12, fontWeight: '800' },
  title: { color: '#FFF8E8', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  body: { color: '#B7C3BC', fontSize: 14, lineHeight: 20 },
  rewardRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#35493E',
    backgroundColor: '#1D2A24',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  rewardMark: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  rewardMarkText: { color: '#17211C', fontSize: 14, fontWeight: '900' },
  rewardCopyWrap: { flex: 1, gap: 1 },
  rewardTitle: { color: '#F5E6B0', fontSize: 12, fontWeight: '900' },
  rewardCopy: { color: '#9EAEA5', fontSize: 11, lineHeight: 15 },
  controls: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  leadingControls: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  back: { color: '#D5DED9', fontSize: 13, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#526159' },
  dotActive: { width: 16, backgroundColor: '#D7B45A' },
  primary: { minHeight: 42, borderRadius: 13, backgroundColor: '#D7B45A', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#17211C', fontSize: 13, fontWeight: '900' },
});
