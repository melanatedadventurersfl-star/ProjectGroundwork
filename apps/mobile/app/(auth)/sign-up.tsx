import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFriendlyAuthError } from '../../src/lib/errors';
import { supabase } from '../../src/lib/supabase';
import { getPendingInviteToken, normalizeInviteToken, savePendingInviteToken } from '../../src/referrals/pendingInvite';

function makeInternalUsername(email: string) {
  const localPart = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 14) || 'member';
  return `${localPart}.${Date.now().toString(36).slice(-6)}`;
}

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedInviteCode = normalizeInviteToken(inviteCode);
  const passwordsMatch = password === confirmPassword;
  const emailLooksValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = useMemo(
    () => Boolean(emailLooksValid && password.length >= 8 && confirmPassword.length >= 8 && passwordsMatch),
    [confirmPassword.length, emailLooksValid, password.length, passwordsMatch],
  );

  useEffect(() => {
    const pending = getPendingInviteToken();
    if (pending) {
      setInviteCode(pending);
      setShowInviteCode(true);
    }
  }, []);

  async function handleSignUp() {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (normalizedInviteCode) savePendingInviteToken(normalizedInviteCode);

      const internalUsername = makeInternalUsername(email.trim());
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: internalUsername,
            display_name: '',
          },
        },
      });

      if (error) {
        Alert.alert('Unable to create account', getFriendlyAuthError(error, 'Unable to create account.'));
        return;
      }

      if (data.session) {
        router.replace('/community-guidelines?mode=onboarding' as never);
        return;
      }

      Alert.alert(
        'Check your email',
        'Use the verification link to activate your account. When you sign in, we’ll take you to the Community Guidelines before profile setup.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }],
      );
    } catch (caught) {
      Alert.alert('Unable to create account', getFriendlyAuthError(caught, 'Unable to create account.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ImageBackground source={require('../../assets/auth/signup.png')} resizeMode="cover" style={styles.background}>
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.spacer} />

            <View style={styles.panel}>
              <Text style={styles.eyebrow}>JOIN THE TRAIL</Text>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.body}>Start with the basics. We’ll build your profile after the Trail Code.</Text>

              {normalizedInviteCode ? (
                <View style={styles.inviteBanner}>
                  <Text style={styles.inviteEyebrow}>MEMBER INVITE ATTACHED</Text>
                  <Text style={styles.inviteBody}>Your invite is ready and will stay connected through signup.</Text>
                </View>
              ) : null}

              <View style={styles.fields}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="#AEB8B2"
                  returnKeyType="next"
                  style={styles.input}
                  value={email}
                />

                <View style={styles.passwordField}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={setPassword}
                    placeholder="Password (8+ characters)"
                    placeholderTextColor="#AEB8B2"
                    returnKeyType="next"
                    secureTextEntry={!showPassword}
                    style={styles.passwordInput}
                    value={password}
                  />
                  <Pressable hitSlop={10} onPress={() => setShowPassword((value) => !value)}>
                    <Text style={styles.visibilityText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>

                <View style={[styles.passwordField, confirmPassword.length > 0 && !passwordsMatch && styles.inputError]}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={setConfirmPassword}
                    onSubmitEditing={() => void handleSignUp()}
                    placeholder="Confirm password"
                    placeholderTextColor="#AEB8B2"
                    returnKeyType="done"
                    secureTextEntry={!showConfirmPassword}
                    style={styles.passwordInput}
                    value={confirmPassword}
                  />
                  <Pressable hitSlop={10} onPress={() => setShowConfirmPassword((value) => !value)}>
                    <Text style={styles.visibilityText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
              </View>

              {password.length > 0 && password.length < 8 ? (
                <Text style={styles.help}>Use at least 8 characters.</Text>
              ) : null}
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <Text style={styles.errorText}>Passwords don’t match yet.</Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setShowInviteCode((value) => !value)}
                style={styles.inviteToggle}
              >
                <Text style={styles.inviteToggleText}>{showInviteCode ? 'Hide invite code' : 'Have an invite code?'}</Text>
              </Pressable>

              {showInviteCode ? (
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setInviteCode}
                  placeholder="Invite code (optional)"
                  placeholderTextColor="#AEB8B2"
                  style={styles.input}
                  value={inviteCode}
                />
              ) : null}

              <Pressable
                disabled={!canSubmit || isSubmitting}
                onPress={() => void handleSignUp()}
                style={[styles.button, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>{isSubmitting ? 'Creating account…' : 'Continue'}</Text>
              </Pressable>

              <Text style={styles.nextStep}>Next: Community Guidelines</Text>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <Link href="/(auth)/sign-in" style={styles.link}>
                  Sign in
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#0B120F' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 10, 8, 0.34)' },
  safe: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
  spacer: { minHeight: 130, flexGrow: 1 },
  panel: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    gap: 13,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(15, 23, 19, 0.88)',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 36, fontWeight: '900' },
  body: { color: '#CDD5D0', fontSize: 15, lineHeight: 22 },
  inviteBanner: { gap: 4, borderWidth: 1, borderColor: 'rgba(215,180,90,0.45)', borderRadius: 14, backgroundColor: 'rgba(215,180,90,0.10)', padding: 12 },
  inviteEyebrow: { color: '#E0C675', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  inviteBody: { color: '#D8D3C5', fontSize: 13, lineHeight: 18 },
  fields: { gap: 10, marginTop: 2 },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#FFF8E8',
    fontSize: 16,
  },
  passwordField: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingRight: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  passwordInput: { flex: 1, minHeight: 52, paddingHorizontal: 16, color: '#FFF8E8', fontSize: 16 },
  visibilityText: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
  inputError: { borderColor: '#E98E82' },
  help: { color: '#B9C3BD', fontSize: 12, lineHeight: 17 },
  errorText: { color: '#FFB7AE', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  inviteToggle: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  inviteToggleText: { color: '#E0C675', fontSize: 13, fontWeight: '800' },
  button: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#748A4A', marginTop: 2 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  nextStep: { color: '#9DA9A2', fontSize: 11, textAlign: 'center', fontWeight: '700', letterSpacing: 0.3 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  footerText: { color: '#B9C3BD', fontSize: 14 },
  link: { color: '#E0C675', fontSize: 14, fontWeight: '900' },
});
