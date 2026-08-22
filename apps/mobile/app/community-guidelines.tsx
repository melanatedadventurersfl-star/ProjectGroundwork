import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFriendlyAuthError } from '../src/lib/errors';
import { supabase } from '../src/lib/supabase';

const COMMUNITY_GUIDELINES_VERSION = '2026-08-16';

const guidelines = [
  ['Protect the community', 'No threats, harassment, bullying, stalking, doxxing, or encouraging harm.'],
  ['Respect Black people in all our variety', 'No racism, colorism, misogyny, homophobia, transphobia, ableism, religious attacks, or identity-based harassment.'],
  ['Keep it welcoming', 'Debate is fine. Personal attacks, targeted pile-ons, intimidation, and deliberately hostile behavior are not.'],
  ['Keep it appropriate', 'No sexually explicit content, graphic violence, exploitation, or content intended primarily to shock people.'],
  ['Do not scam the trail', 'No fraud, impersonation, spam, fake events, deceptive fundraising, or misleading promotions.'],
  ['Respect privacy', 'Do not post someone else’s private information, precise location, sensitive conversations, or personal media without appropriate permission.'],
  ['Be responsible outdoors', 'Do not encourage reckless behavior, destruction of public lands, wildlife harassment, illegal activity, or knowingly dangerous outdoor advice.'],
  ['Respect hosts and events', 'Follow event rules, venue rules, safety instructions, and reasonable boundaries established by hosts.'],
  ['Keep promotions in balance', 'Businesses and creators may participate, but repetitive unsolicited advertising should not take over the community.'],
  ['Report, do not retaliate', 'If something crosses the line, report it. Do not turn a disagreement into harassment or a pile-on.'],
] as const;

export default function CommunityGuidelinesScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isOnboarding = mode === 'onboarding';
  const [accepted, setAccepted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleContinue() {
    if (!accepted || isSaving) return;

    setIsSaving(true);
    try {
      const acceptedAt = new Date().toISOString();
      const { error } = await supabase.auth.updateUser({
        data: {
          community_guidelines_accepted_at: acceptedAt,
          community_guidelines_version: COMMUNITY_GUIDELINES_VERSION,
        },
      });
      if (error) throw error;

      router.replace('/onboarding-v2');
    } catch (caught) {
      Alert.alert(
        'Unable to save your agreement',
        getFriendlyAuthError(caught, 'Please try again before continuing.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {!isOnboarding ? (
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        ) : null}

        <Text style={styles.eyebrow}>{isOnboarding ? 'BEFORE YOU JOIN' : 'COMMUNITY GUIDELINES'}</Text>
        <Text style={styles.title}>{isOnboarding ? 'Our community has a Trail Code.' : 'Make the trail better for the next person.'}</Text>
        <Text style={styles.intro}>
          Go Melanated exists to help Black people find the outdoors and find each other. Participate in a way that makes that community safer, stronger, and easier for the next person to join.
        </Text>

        <View style={styles.card}>
          {guidelines.map(([title, body], index) => (
            <View key={title} style={[styles.rule, index > 0 && styles.ruleDivider]}>
              <Text style={styles.ruleNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.ruleBody}>
                <Text style={styles.ruleTitle}>{title}</Text>
                <Text style={styles.ruleText}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.enforcementCard}>
          <Text style={styles.enforcementTitle}>What happens when guidelines are broken?</Text>
          <Text style={styles.enforcementText}>
            Actions may include content removal, warnings, temporary restrictions, event participation restrictions, suspension, or account removal. Severe safety issues may result in immediate action without a warning first.
          </Text>
          <Text style={styles.enforcementText}>
            Credible threats, exploitation, severe harassment, dangerous impersonation, and serious privacy violations are treated as high-priority safety issues.
          </Text>
        </View>

        {isOnboarding ? (
          <View style={styles.agreementCard}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              onPress={() => setAccepted((value) => !value)}
              style={styles.agreementRow}
            >
              <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                <Text style={[styles.checkmark, !accepted && styles.checkmarkHidden]}>✓</Text>
              </View>
              <Text style={styles.agreementText}>I’ve read and agree to follow the Community Guidelines.</Text>
            </Pressable>

            <Pressable
              disabled={!accepted || isSaving}
              onPress={() => void handleContinue()}
              style={[styles.continueButton, (!accepted || isSaving) && styles.continueButtonDisabled]}
            >
              <Text style={styles.continueButtonText}>{isSaving ? 'Saving…' : 'Continue'}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.footer}>By using Go Melanated, you agree to follow these Community Guidelines.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 56, gap: 14 },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 },
  title: { color: '#FFF8E8', fontSize: 32, lineHeight: 36, fontWeight: '900' },
  intro: { color: '#B9C3BD', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2B3A32', borderRadius: 20, overflow: 'hidden' },
  rule: { flexDirection: 'row', gap: 12, padding: 16 },
  ruleDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#34423A' },
  ruleNumber: { color: '#D7B45A', fontSize: 11, fontWeight: '900', width: 24, paddingTop: 2 },
  ruleBody: { flex: 1 },
  ruleTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  ruleText: { color: '#AEB8B2', fontSize: 14, lineHeight: 20, marginTop: 4 },
  enforcementCard: { backgroundColor: '#1A241F', borderWidth: 1, borderColor: '#405047', borderRadius: 18, padding: 17, gap: 8 },
  enforcementTitle: { color: '#FFF3CE', fontSize: 17, fontWeight: '900' },
  enforcementText: { color: '#B8C1BC', fontSize: 14, lineHeight: 20 },
  agreementCard: { gap: 14, borderWidth: 1, borderColor: '#405047', borderRadius: 18, padding: 16, backgroundColor: '#17211C' },
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#829087', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1713' },
  checkboxChecked: { backgroundColor: '#748A4A', borderColor: '#8FA55C' },
  checkmark: { color: '#FFFFFF', fontSize: 15, lineHeight: 17, fontWeight: '900' },
  checkmarkHidden: { opacity: 0 },
  agreementText: { flex: 1, color: '#E5EAE6', fontSize: 14, lineHeight: 20, fontWeight: '800' },
  continueButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#748A4A' },
  continueButtonDisabled: { opacity: 0.45 },
  continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  footer: { color: '#839088', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
