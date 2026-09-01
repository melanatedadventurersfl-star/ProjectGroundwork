import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { startGuidedTutorial } from './tutorialController';
import {
  getGuidedTutorialStep,
  hasFinishedGuidedTutorial,
  setGuidedTutorialStep,
} from './tutorialPreference';

const steps = [
  { title: 'Complete your profile', route: '/member/profile' },
  { title: 'Explore the Trail Guide', route: '/trail-guide' },
  { title: 'Save your first place', route: '/trail-guide' },
  { title: 'Find an adventure', route: '/(tabs)/explore' },
  { title: 'Visit the Outpost', route: '/(tabs)/community' },
  { title: 'Ask Go something', route: '/trail-guide/ask' },
] as const;

export function TrailheadStarterCard() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useFocusEffect(useCallback(() => {
    try {
      const finished = hasFinishedGuidedTutorial();
      const storedStep = Math.max(0, Math.min(steps.length - 1, getGuidedTutorialStep()));
      setVisible(!finished);
      setStep(storedStep);
    } catch {
      setVisible(true);
      setStep(0);
    }
  }, []));

  if (!visible) return null;

  const completed = Math.max(0, Math.min(step, steps.length));
  const preview = steps.slice(0, 4);

  function continueTrailhead() {
    const current = steps[Math.min(step, steps.length - 1)];
    if (!current) return;
    const nextStep = Math.min(step + 1, steps.length - 1);
    setGuidedTutorialStep(nextStep);
    setStep(nextStep);
    router.push(current.route as never);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>TRAILHEAD</Text>
          <Text style={styles.title}>Your first adventure starts here.</Text>
          <Text style={styles.progressCopy}>
            <Text style={styles.progressNumber}>{completed}</Text> of {steps.length} complete
          </Text>
          <View style={styles.progressTrack} accessibilityLabel={`${completed} of ${steps.length} Trailhead steps complete`}>
            <View style={[styles.progressFill, { width: `${(completed / steps.length) * 100}%` }]} />
          </View>
          <Pressable accessibilityRole="button" style={styles.primary} onPress={continueTrailhead}>
            <Text style={styles.primaryText}>Continue</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.timeline}>
          {preview.map((item, index) => {
            const done = index < completed;
            const active = index === completed;
            return (
              <View key={item.title} style={styles.stepRow}>
                <View style={styles.markerColumn}>
                  <View style={[styles.marker, done && styles.markerDone, active && styles.markerActive]}>
                    {done ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                  {index < preview.length - 1 ? <View style={[styles.connector, done && styles.connectorDone]} /> : null}
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
    marginTop: 14,
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#315246',
    backgroundColor: '#0B3D31',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  copy: {
    paddingHorizontal: 18,
    paddingTop: 17,
    paddingBottom: 16,
  },
  eyebrow: {
    color: '#DDB64B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.35,
  },
  title: {
    marginTop: 7,
    color: '#FFF9EB',
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '900',
    maxWidth: 310,
  },
  progressCopy: {
    marginTop: 10,
    color: '#C3D0C9',
    fontSize: 13,
    fontWeight: '700',
  },
  progressNumber: {
    color: '#DDB64B',
    fontWeight: '900',
  },
  progressTrack: {
    marginTop: 8,
    height: 6,
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
    marginTop: 14,
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: '#DDB64B',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryText: {
    color: '#0E2D25',
    fontSize: 14,
    fontWeight: '900',
  },
  arrow: {
    color: '#0E2D25',
    fontSize: 24,
    lineHeight: 24,
    marginTop: -1,
  },
  divider: {
    height: 1,
    backgroundColor: '#2B5144',
  },
  timeline: {
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 13,
  },
  stepRow: {
    minHeight: 35,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  markerColumn: {
    width: 20,
    alignItems: 'center',
  },
  marker: {
    width: 17,
    height: 17,
    borderRadius: 9,
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
  },
  check: {
    color: '#12372E',
    fontSize: 10,
    fontWeight: '900',
  },
  connector: {
    width: 1.5,
    flex: 1,
    minHeight: 17,
    backgroundColor: '#47695E',
  },
  connectorDone: {
    backgroundColor: '#DDB64B',
  },
  stepText: {
    flex: 1,
    color: '#8EA49A',
    fontSize: 13,
    lineHeight: 18,
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
    paddingTop: 2,
    paddingBottom: 1,
  },
  seeAll: {
    color: '#E0B84B',
    fontSize: 13,
    fontWeight: '900',
  },
});
