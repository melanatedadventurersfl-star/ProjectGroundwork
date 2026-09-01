import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openTrailheadAction } from './trailheadExperience';
import { getTrailheadProgress, type TrailheadAction } from './trailheadProgress';

const steps: { action: TrailheadAction; title: string; body: string }[] = [
  { action: 'profile', title: 'Complete your profile', body: 'Add your photo, display name and home location, then save.' },
  { action: 'trail-guide', title: 'Explore the Trail Guide', body: 'Browse recommendations and open a place that interests you.' },
  { action: 'save-place', title: 'Save your first place', body: 'Open a place and tap Save.' },
  { action: 'adventure', title: 'Find an adventure', body: 'Browse outings and open one that interests you.' },
  { action: 'outpost', title: 'Visit the Outpost', body: 'Open the community hub and see what people are sharing.' },
  { action: 'ask-go', title: 'Ask Go something', body: 'Send Go a question or ask it to plan an outdoor day.' },
];

type Props = {
  visible: boolean;
  onFinish: () => void;
  onSkip: () => void;
  onNavigate: () => void;
};

export function GuidedTutorial({ visible, onFinish, onSkip, onNavigate }: Props) {
  const trailhead = getTrailheadProgress();
  const completedActions = trailhead.completed.filter((item) => item.complete).map((item) => item.action);
  const completedCount = completedActions.length;
  const completedAll = trailhead.allComplete;
  const nextAction = trailhead.nextAction;
  const currentIndex = nextAction ? steps.findIndex((item) => item.action === nextAction) : steps.length - 1;
  const progress = `${completedCount} of ${steps.length} complete`;

  function goToAction(action: TrailheadAction) {
    onNavigate();
    requestAnimationFrame(() => openTrailheadAction(action));
  }

  function continueTrailhead() {
    if (completedAll) {
      onFinish();
      return;
    }
    if (nextAction) goToAction(nextAction);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.copyColumn}>
              <View style={styles.topRow}>
                <Text style={styles.eyebrow}>TRAILHEAD</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close Trailhead" hitSlop={10} onPress={onSkip}>
                  <Text style={styles.skip}>Close</Text>
                </Pressable>
              </View>

              <Text style={styles.title}>{completedAll ? 'You’re ready to finish Trailhead.' : completedCount === 5 ? 'One step from Trail Ready.' : 'Your first adventure starts here.'}</Text>
              <Text style={styles.progressCopy}>
                <Text style={styles.progressNumber}>{completedCount}</Text> of {steps.length} steps complete
              </Text>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: steps.length, now: completedCount }}
                accessibilityLabel={`Trailhead progress, ${progress}`}
              >
                <View style={[styles.progressFill, { width: `${(completedCount / steps.length) * 100}%` }]} />
              </View>

              <Pressable style={styles.primary} accessibilityRole="button" onPress={continueTrailhead}>
                <Text style={styles.primaryText}>{completedAll ? 'Finish Trailhead' : completedCount === 5 ? 'Complete final step' : 'Continue setup'}</Text>
                <Text style={styles.primaryArrow}>›</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <View style={styles.stepsColumn}>
              {steps.map((item, index) => {
                const completed = completedActions.includes(item.action);
                const active = !completedAll && item.action === nextAction;
                return (
                  <Pressable
                    key={item.action}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, checked: completed }}
                    onPress={() => goToAction(item.action)}
                    style={[styles.stepRow, active && styles.stepRowActive]}
                  >
                    <View style={styles.markerColumn}>
                      <View style={[styles.marker, completed && styles.markerDone, active && styles.markerActive]}>
                        {completed ? <Text style={styles.check}>✓</Text> : null}
                      </View>
                      {index < steps.length - 1 ? <View style={[styles.connector, completed && styles.connectorDone]} /> : null}
                    </View>
                    <View style={styles.stepTextWrap}>
                      <Text style={[styles.stepTitle, completed && styles.stepTitleDone, active && styles.stepTitleActive]}>{item.title}</Text>
                      {active ? <Text style={styles.stepBody}>{item.body}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(7, 12, 9, 0.72)' },
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 28 },
  card: { width: '100%', maxWidth: 760, alignSelf: 'center', borderRadius: 24, borderWidth: 1, borderColor: '#315246', backgroundColor: '#0B3D31', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 16 },
  copyColumn: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#DDB64B', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  skip: { color: '#D9E2DD', fontSize: 13, fontWeight: '700' },
  title: { marginTop: 18, color: '#FFF9EB', fontSize: 34, lineHeight: 39, fontWeight: '900', maxWidth: 410 },
  progressCopy: { marginTop: 18, color: '#C7D3CD', fontSize: 15, fontWeight: '600' },
  progressNumber: { color: '#DDB64B', fontWeight: '900' },
  progressTrack: { marginTop: 10, height: 8, borderRadius: 999, backgroundColor: '#31574A', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#DDB64B' },
  primary: { marginTop: 20, minHeight: 48, alignSelf: 'flex-start', borderRadius: 15, backgroundColor: '#DDB64B', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primaryText: { color: '#0E2D25', fontSize: 15, fontWeight: '900' },
  primaryArrow: { color: '#0E2D25', fontSize: 28, lineHeight: 28, marginTop: -2 },
  divider: { height: 1, backgroundColor: '#2B5144' },
  stepsColumn: { paddingHorizontal: 18, paddingVertical: 16 },
  stepRow: { minHeight: 58, flexDirection: 'row', gap: 13, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 7 },
  stepRowActive: { backgroundColor: 'rgba(221, 182, 75, 0.09)' },
  markerColumn: { width: 28, alignItems: 'center' },
  marker: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#78958A', backgroundColor: '#0B3D31', alignItems: 'center', justifyContent: 'center' },
  markerDone: { borderColor: '#DDB64B', backgroundColor: '#DDB64B' },
  markerActive: { borderColor: '#F0CC65' },
  check: { color: '#12372E', fontSize: 14, fontWeight: '900' },
  connector: { width: 2, flex: 1, minHeight: 24, backgroundColor: '#45695C' },
  connectorDone: { backgroundColor: '#DDB64B' },
  stepTextWrap: { flex: 1, paddingTop: 2, paddingBottom: 5 },
  stepTitle: { color: '#AFC0B8', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  stepTitleDone: { color: '#F1F5F2' },
  stepTitleActive: { color: '#FFF9EB', fontWeight: '900' },
  stepBody: { marginTop: 4, color: '#BCCAC3', fontSize: 12, lineHeight: 17 },
});
