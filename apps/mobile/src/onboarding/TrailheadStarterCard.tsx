import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { startGuidedTutorial } from './tutorialController';
import {
  getGuidedTutorialStep,
  hasFinishedGuidedTutorial,
} from './tutorialPreference';

const steps = [
  { title: 'Complete your profile', route: '/member/profile' },
  { title: 'Explore the Trail Guide', route: '/trail-guide' },
  { title: 'Save your first place', route: '/trail-guide' },
  { title: 'Find an adventure', route: '/(tabs)/explore' },
  { title: 'Visit the Outpost', route: '/(tabs)/community' },
  { title: 'Ask Go something', route: '/trail-guide/ask' },
] as const;

function headlineFor(completed: number) {
  if (completed >= 6) return 'You’re ready to finish Trailhead.';
  if (completed === 5) return 'One step from Trail Ready.';
  if (completed >= 3) return 'Your Trailhead is taking shape.';
  return 'Your first adventure starts here.';
}

function ctaFor(completed: number) {
  if (completed >= 6) return 'Finish Trailhead';
  if (completed === 5) return 'Complete final step';
  return 'Continue setup';
}

export function TrailheadStarterCard() {
  const { width } = useWindowDimensions();
  const compactWide = width >= 390;
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useFocusEffect(useCallback(() => {
    try {
      const finished = hasFinishedGuidedTutorial();
      const storedStep = Math.max(0, Math.min(steps.length, getGuidedTutorialStep()));
      setVisible(!finished);
      setStep(storedStep);
    } catch {
      setVisible(true);
      setStep(0);
    }
  }, []));

  if (!visible) return null;

  const completed = Math.max(0, Math.min(step, steps.length));
  const nextIndex = Math.min(completed, steps.length - 1);
  const next = steps[nextIndex];

  function continueTrailhead() {
    if (completed >= steps.length) {
      startGuidedTutorial();
      return;
    }
    if (next) router.push(next.route as never);
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, compactWide && styles.cardWide]}>
        <View style={[styles.copy, compactWide && styles.copyWide]}>
          <Text style={styles.eyebrow}>TRAILHEAD</Text>
          <Text style={[styles.title, compactWide && styles.titleWide]}>{headlineFor(completed)}</Text>
          <Text style={styles.progressCopy}>
            <Text style={styles.progressNumber}>{completed}</Text> of {steps.length} complete
          </Text>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: steps.length, now: completed }}
            accessibilityLabel={`Trailhead progress, ${completed} of ${steps.length} steps complete`}
          >
            <View style={[styles.progressFill, { width: `${(completed / steps.length) * 100}%` }]} />
          </View>
          <Pressable accessibilityRole="button" style={styles.primary} onPress={continueTrailhead}>
            <Text style={styles.primaryText}>{ctaFor(completed)}</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        <View style={[styles.timeline, compactWide && styles.timelineWide]}>
          {steps.map((item, index) => {
            const done = index < completed;
            const active = index === completed && completed < steps.length;
            return (
              <View key={item.title} style={styles.stepRow}>
                <View style={styles.markerColumn}>
                  <View
                    accessibilityLabel={`${item.title}, ${done ? 'complete' : active ? 'next step' : 'incomplete'}`}
                    style={[styles.marker, done && styles.markerDone, active && styles.markerActive]}
                  >
                    {done ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                  {index < steps.length - 1 ? <View style={[styles.connector, done && styles.connectorDone]} /> : null}
                </View>
                <Text numberOfLines={1} style={[styles.stepText, done && styles.stepTextDone, active && styles.stepTextActive]}>
                  {item.title}
                </Text>
              </View>
            );
          })}
          <Pressable accessibilityRole="button" hitSlop={8} onPress={startGuidedTutorial} style={styles.seeAllButton}>
            <Text style={styles.seeAll}>See all steps ›</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#315246',
    backgroundColor: '#0B3D31',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  cardWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  copy: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
  },
  copyWide: {
    width: '43%',
    paddingRight: 12,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#DDB64B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 6,
    color: '#FFF9EB',
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '900',
    maxWidth: 300,
  },
  titleWide: {
    fontSize: 20,
    lineHeight: 23,
  },
  progressCopy: {
    marginTop: 9,
    color: '#C3D0C9',
    fontSize: 12,
    fontWeight: '700',
  },
  progressNumber: {
    color: '#DDB64B',
    fontWeight: '900',
  },
  progressTrack: {
    marginTop: 7,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#31574A',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#DDB64B',
  },
  primary: {
    marginTop: 12,
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: 11,
    backgroundColor: '#DDB64B',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryText: {
    color: '#0E2D25',
    fontSize: 13,
    fontWeight: '900',
  },
  arrow: {
    color: '#0E2D25',
    fontSize: 22,
    lineHeight: 22,
    marginTop: -1,
  },
  timeline: {
    borderTopWidth: 1,
    borderTopColor: '#2B5144',
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 10,
  },
  timelineWide: {
    width: '57%',
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#2B5144',
    paddingLeft: 14,
    paddingRight: 13,
    paddingTop: 13,
  },
  stepRow: {
    minHeight: 29,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
  },
  markerColumn: {
    width: 18,
    alignItems: 'center',
  },
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#718D82',
    backgroundColor: '#0B3D31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: {
    borderColor: '#DDB64B',
    backgroundColor: '#DDB64B',
  },
  markerActive: {
    borderColor: '#F1CF6B',
    borderWidth: 2,
  },
  check: {
    color: '#12372E',
    fontSize: 9,
    fontWeight: '900',
  },
  connector: {
    width: 1.5,
    flex: 1,
    minHeight: 13,
    backgroundColor: '#47695E',
  },
  connectorDone: {
    backgroundColor: '#DDB64B',
  },
  stepText: {
    flex: 1,
    color: '#8EA49A',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  stepTextDone: {
    color: '#EDF3EF',
  },
  stepTextActive: {
    color: '#FFF9EB',
    fontWeight: '900',
  },
  seeAllButton: {
    alignSelf: 'flex-end',
    paddingTop: 1,
    paddingBottom: 1,
  },
  seeAll: {
    color: '#E0B84B',
    fontSize: 12,
    fontWeight: '900',
  },
});
