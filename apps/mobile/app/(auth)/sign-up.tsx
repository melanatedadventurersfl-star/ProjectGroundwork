import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFriendlyAuthError } from '../../src/lib/errors';
import { supabase } from '../../src/lib/supabase';
import { getPendingInviteToken, normalizeInviteToken, savePendingInviteToken } from '../../src/referrals/pendingInvite';

const COMMUNITY_GUIDELINES_VERSION = '2026-08-16';
const USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,24}$/;

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [acceptedGuidelines, setAcceptedGuidelines] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedUsername = username.trim();
  const usernameIsValid = USERNAME_PATTERN.test(normalizedUsername);
  const normalizedInviteCode = normalizeInviteToken(inviteCode);
  const canSubmit = useMemo(
    () => Boolean(email.trim() && usernameIsValid && password.length >= 8 && acceptedGuidelines),
    [acceptedGuidelines, email, password, usernameIsValid],
  );

  useEffect(() => {
    const pending = getPendingInviteToken();
    if (pending) setInviteCode(pending);
  }, []);

  async function handleSignUp() {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (normalizedInviteCode) savePendingInviteToken(normalizedInviteCode);

      const { data: available, error: availabilityError } = await supabase.rpc('username_available', {
        p_username: normalizedUsername,
      });
      if (availabilityError) throw availabilityError;
      if (!available) {
        Alert.alert('Username unavailable', 'That username is already in use. Try another one.');
        return;
      }

      const acceptedAt = new Date().toISOString();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: normalizedUsername,
            display_name: normalizedUsername,
            community_guidelines_accepted_at: acceptedAt,
            community_guidelines_version: COMMUNITY_GUIDELINES_VERSION,
          },
        },
      });

      if (error) {
        Alert.alert('Unable to create account', getFriendlyAuthError(error, 'Unable to create account.'));
        return;
      }

      if (data.session) {
        router.replace('/onboarding-v2');
        return;
      }

      Alert.alert('Check your email', 'Use the verification link to activate your account, then return to sign in. Your invite will stay attached on this device.');
    } catch (caught) {
      Alert.alert('Unable to create account', getFriendlyAuthError(caught, 'Unable to create account.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>JOIN THE TRAIL</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.body}>Start with the basics. Your adventure preferences come next.</Text>

          {normalizedInviteCode ? (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteEyebrow}>MEMBER INVITE ATTACHED</Text>
              <Text style={styles.inviteTitle}>You were invited into the community.</Text>
              <Text style={styles.inviteBody}>After signup, we’ll credit the member who invited you automatically.</Text>
            </View>
          ) : null}

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            placeholder="Username"
            style={styles.input}
            value={username}
          />
          {username.length > 0 && !usernameIsValid ? (
            <Text style={styles.help}>Use 3–24 letters, numbers, periods, or underscores.</Text>
          ) : null}
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            style={styles.input}
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            onChangeText={setPassword}
            placeholder="Password (8+ characters)"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <View style={styles.optionalField}>
            <Text style={styles.optionalLabel}>INVITE CODE · OPTIONAL</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setInviteCode}
              placeholder="Paste invite code"
              style={styles.input}
              value={inviteCode}
            />
            <Text style={styles.help}>Usually filled automatically from an invite link. Use this only as a backup after installing the app.</Text>
          </View>

          <View style={styles.guidelinesCard}>
            <Text style={styles.guidelinesEyebrow}>BEFORE YOU JOIN</Text>
            <Text style={styles.guidelinesTitle}>This community has a trail code.</Text>
            <Text style={styles.guidelinesBody}>Help keep Melanated safe, welcoming, respectful, and responsible outdoors.</Text>
            <Pressable onPress={() => router.push('/community-guidelines' as never)} hitSlop={6}>
              <Text style={styles.guidelinesLink}>Read the Community Guidelines →</Text>
            </Pressable>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedGuidelines }}
              onPress={() => setAcceptedGuidelines((value) => !value)}
              style={styles.agreementRow}
            >
              <View style={[styles.checkbox, acceptedGuidelines && styles.checkboxChecked]}>
                <Text style={[styles.checkmark, !acceptedGuidelines && styles.checkmarkHidden]}>✓</Text>
              </View>
              <Text style={styles.agreementText}>I have read and agree to follow the Community Guidelines.</Text>
            </Pressable>
          </View>

          <Pressable
            disabled={!canSubmit || isSubmitting}
            onPress={() => void handleSignUp()}
            style={[styles.button, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Creating account…' : 'Create account'}</Text>
          </Pressable>

          <Link href="/(auth)/sign-in" style={styles.link}>Already have an account? Sign in</Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#17211B' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { gap: 16, padding: 24, borderRadius: 16, backgroundColor: '#F7F3EA' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: '#24543B' },
  title: { fontSize: 30, fontWeight: '800', color: '#17211B' },
  body: { fontSize: 16, lineHeight: 24, color: '#56615A' },
  inviteBanner: { borderWidth: 1, borderColor: '#D2B45F', borderRadius: 12, backgroundColor: '#FFF4CE', padding: 14, gap: 4 },
  inviteEyebrow: { color: '#6C5A20', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  inviteTitle: { color: '#302A18', fontSize: 16, fontWeight: '900' },
  inviteBody: { color: '#5F573F', fontSize: 13, lineHeight: 19 },
  optionalField: { gap: 7 },
  optionalLabel: { color: '#68736C', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  help: { marginTop: -8, color: '#68736C', fontSize: 12, lineHeight: 17 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#B8BEB9', borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  guidelinesCard: { gap: 8, borderWidth: 1, borderColor: '#CCD3CE', borderRadius: 12, backgroundColor: '#EEF2EE', padding: 14 },
  guidelinesEyebrow: { color: '#6D785F', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  guidelinesTitle: { color: '#17211B', fontSize: 17, fontWeight: '800' },
  guidelinesBody: { color: '#56615A', fontSize: 14, lineHeight: 20 },
  guidelinesLink: { color: '#24543B', fontSize: 14, fontWeight: '800' },
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkbox: { width: 23, height: 23, borderRadius: 6, borderWidth: 2, borderColor: '#708077', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxChecked: { backgroundColor: '#24543B', borderColor: '#24543B' },
  checkmark: { color: '#FFFFFF', fontSize: 15, lineHeight: 17, fontWeight: '900' },
  checkmarkHidden: { opacity: 0 },
  agreementText: { flex: 1, color: '#334039', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#24543B' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: '#24543B', fontWeight: '700' },
});