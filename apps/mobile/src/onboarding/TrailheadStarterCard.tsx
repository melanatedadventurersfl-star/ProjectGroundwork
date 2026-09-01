import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { loadOnboardingProfile } from './onboardingService';
import { openTrailheadAction } from './trailheadExperience';
import { startGuidedTutorial } from './tutorialController';
import { getTrailheadProgress, type TrailheadAction } from './trailheadProgress';
import { hasFinishedGuidedTutorial } from './tutorialPreference';

const steps: { action: TrailheadAction; title: string }[] = [
  { action: 'profile', title: 'Complete your profile' },
  { action: 'trail-guide', title: 'Explore the Trail Guide' },
  { action: 'save-place', title: 'Save your first place' },
  { action: 'adventure', title: 'Find an adventure' },
  { action: 'outpost', title: 'Visit the Outpost' },
  { action: 'ask-go', title: 'Ask Go something' },
];

type StarterProfile = {
  first_name?: string | null;
  display_name?: string | null;
  home_city?: string | null;
  home_state?: string | null;
  discovery_radius_miles?: number | null;
  experience_level?: string | null;
  interests?: string[] | null;
  onboarding_completed_at?: string | null;
};

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

function experienceCopy(level?: string | null) {
  const normalized = level?.trim().toLowerCase();
  if (!normalized || normalized === 'new' || normalized === 'beginner') {
    return 'We’ll favor beginner-friendly options and clearer planning details.';
  }
  if (normalized.includes('intermediate')) {
    return 'We’ll mix approachable outings with options that stretch your range.';
  }
  if (normalized.includes('advanced') || normalized.includes('experienced')) {
    return 'We’ll keep stronger adventure options in the mix instead of starting you at square one.';
  }
  return 'We’ll use your experience level to shape what feels like a good fit.';
}

function locationCopy(profile: StarterProfile) {
  const city = profile.home_city?.trim();
  const state = profile.home_state?.trim();
  const radius = profile.discovery_radius_miles;
  const place = [city, state].filter(Boolean).join(', ');

  if (place && radius) return `Showing options around ${place}, up to ${radius} miles.`;
  if (place) return `Starting with options around ${place}.`;
  if (radius) return `Starting with options within about ${radius} miles.`;
  return 'Add your home area so nearby recommendations can get more useful.';
}

function displayInterest(value: string) {
  if (value === 'Beginner-friendly experiences') return 'Beginner friendly';
  if (value === 'Festivals and group events') return 'Group events';
  if (value === 'Family adventures') return 'Family outings';
  return value;
}

export function TrailheadStarterCard() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const compactWide = width >= 390;
  const [visible, setVisible] = useState(false);
  const [completedActions, setCompletedActions] = useState<TrailheadAction[]>([]);
  const [profile, setProfile] = useState<StarterProfile | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;

    async function load() {
      try {
        const finished = hasFinishedGuidedTutorial();
        const progress = getTrailheadProgress();
        if (!active) return;
        setVisible(!finished);
        setCompletedActions(progress.completed.filter((item) => item.complete).map((item) => item.action));

        if (session?.user.id) {
          const nextProfile = await loadOnboardingProfile(session.user.id);
          if (!active) return;
          setProfile(nextProfile as StarterProfile);
        } else {
          setProfile(null);
        }
      } catch {
        if (!active) return;
        setVisible(true);
        setCompletedActions([]);
      }
    }

    void load();
    return () => { active = false; };
  }, [session?.user.id]));

  const interests = useMemo(
    () => (Array.isArray(profile?.interests) ? profile.interests.filter(Boolean).slice(0, 4) : []),
    [profile?.interests],
  );

  if (!visible) return null;

  const completed = completedActions.length;
  const next = steps.find((item) => !completedActions.includes(item.action)) ?? null;
  const firstName = profile?.first_name?.trim() || profile?.display_name?.trim() || null;
  const hasOnboardingPayoff = Boolean(profile?.onboarding_completed_at && (interests.length || profile?.home_city || profile?.discovery_radius_miles));

  function continueTrailhead() {
    if (!next) {
      startGuidedTutorial();
      return;
    }
    openTrailheadAction(next.action);
  }

  if (hasOnboardingPayoff && completed <= 2) {
    return (
      <View style={styles.wrap}>
        <View style={styles.payoffCard}>
          <Text style={styles.payoffEyebrow}>BUILT FROM YOUR SIGNUP</Text>
          <Text style={styles.payoffTitle}>{firstName ? `${firstName}, your Trailhead is already taking shape.` : 'Your Trailhead is already taking shape.'}</Text>
          <Text style={styles.payoffBody}>The answers you just gave us are now shaping what Go Melanated puts in front of you.</Text>

          {interests.length ? (
            <View style={styles.interestWrap}>
              {interests.map((interest) => (
                <View key={interest} style={styles.interestChip}>
                  <Text style={styles.interestChipText}>{displayInterest(interest)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.reasonList}>
            <View style={styles.reasonRow}>
              <View style={styles.reasonDot} />
              <Text style={styles.reasonText}>{locationCopy(profile ?? {})}</Text>
            </View>
            <View style={styles.reasonRow}>
              <View style={styles.reasonDot} />
              <Text style={styles.reasonText}>{experienceCopy(profile?.experience_level)}</Text>
            </View>
            {interests.length ? (
              <View style={styles.reasonRow}>
                <View style={styles.reasonDot} />
                <Text style={styles.reasonText}>Your selected interests will guide the adventures and places we surface first.</Text>
              </View>
            ) : null}
          </View>

          <Pressable accessibilityRole="button" style={styles.payoffPrimary} onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.payoffPrimaryText}>See what matches me</Text>
            <Text style={styles.payoffArrow}>›</Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={continueTrailhead} style={styles.payoffSecondary}>
            <Text style={styles.payoffSecondaryText}>Continue Trailhead setup</Text>
          </Pressable>
        </View>
      </View>
    );
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
            const done = completedActions.includes(item.action);
            const active = next?.action === item.action;
            return (
              <View key={item.action} style={styles.stepRow}>
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
  wrap: { marginTop: 12, paddingHorizontal: 2 },
  payoffCard: { borderRadius: 20, borderWidth: 1, borderColor: '#4D604E', backgroundColor: '#132119', paddingHorizontal: 17, paddingTop: 17, paddingBottom: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  payoffEyebrow: { color: '#DDB64B', fontSize: 10, fontWeight: '900', letterSpacing: 1.35 },
  payoffTitle: { marginTop: 6, color: '#FFF9EB', fontSize: 22, lineHeight: 26, fontWeight: '900' },
  payoffBody: { marginTop: 7, color: '#B9C7BE', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  interestWrap: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  interestChip: { borderRadius: 999, borderWidth: 1, borderColor: '#52674F', backgroundColor: '#1C3023', paddingHorizontal: 10, paddingVertical: 6 },
  interestChipText: { color: '#F4E6B5', fontSize: 11, fontWeight: '800' },
  reasonList: { marginTop: 14, gap: 8 },
  reasonRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  reasonDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6, backgroundColor: '#DDB64B' },
  reasonText: { flex: 1, color: '#D7E0DA', fontSize: 12.5, lineHeight: 18, fontWeight: '650' },
  payoffPrimary: { marginTop: 16, minHeight: 46, borderRadius: 13, backgroundColor: '#DDB64B', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payoffPrimaryText: { color: '#0E2D25', fontSize: 14, fontWeight: '900' },
  payoffArrow: { color: '#0E2D25', fontSize: 24, lineHeight: 24 },
  payoffSecondary: { marginTop: 7, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  payoffSecondaryText: { color: '#DDB64B', fontSize: 12.5, fontWeight: '900' },
  card: { borderRadius: 20, borderWidth: 1, borderColor: '#315246', backgroundColor: '#0B3D31', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  cardWide: { flexDirection: 'row', alignItems: 'stretch' },
  copy: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 13 },
  copyWide: { width: '43%', paddingRight: 12, justifyContent: 'center' },
  eyebrow: { color: '#DDB64B', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { marginTop: 6, color: '#FFF9EB', fontSize: 21, lineHeight: 24, fontWeight: '900', maxWidth: 300 },
  titleWide: { fontSize: 20, lineHeight: 23 },
  progressCopy: { marginTop: 9, color: '#C3D0C9', fontSize: 12, fontWeight: '700' },
  progressNumber: { color: '#DDB64B', fontWeight: '900' },
  progressTrack: { marginTop: 7, height: 5, borderRadius: 999, backgroundColor: '#31574A', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#DDB64B' },
  primary: { marginTop: 12, alignSelf: 'flex-start', minHeight: 40, borderRadius: 11, backgroundColor: '#DDB64B', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryText: { color: '#0E2D25', fontSize: 13, fontWeight: '900' },
  arrow: { color: '#0E2D25', fontSize: 22, lineHeight: 22, marginTop: -1 },
  timeline: { borderTopWidth: 1, borderTopColor: '#2B5144', paddingHorizontal: 16, paddingTop: 11, paddingBottom: 10 },
  timelineWide: { width: '57%', borderTopWidth: 0, borderLeftWidth: 1, borderLeftColor: '#2B5144', paddingLeft: 14, paddingRight: 13, paddingTop: 13 },
  stepRow: { minHeight: 29, flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  markerColumn: { width: 18, alignItems: 'center' },
  marker: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#718D82', backgroundColor: '#0B3D31', alignItems: 'center', justifyContent: 'center' },
  markerDone: { borderColor: '#DDB64B', backgroundColor: '#DDB64B' },
  markerActive: { borderColor: '#F1CF6B', borderWidth: 2 },
  check: { color: '#12372E', fontSize: 9, fontWeight: '900' },
  connector: { width: 1.5, flex: 1, minHeight: 13, backgroundColor: '#47695E' },
  connectorDone: { backgroundColor: '#DDB64B' },
  stepText: { flex: 1, color: '#8EA49A', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  stepTextDone: { color: '#EDF3EF' },
  stepTextActive: { color: '#FFF9EB', fontWeight: '900' },
  seeAllButton: { alignSelf: 'flex-end', paddingTop: 1, paddingBottom: 1 },
  seeAll: { color: '#E0B84B', fontSize: 12, fontWeight: '900' },
});
