import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
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

const PASSWORD_RESET_REDIRECT = 'https://hqndxityqrdiiwqyjagu.supabase.co/functions/v1/password-reset';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(email.trim() && password), [email, password]);
  const canRecover = useMemo(() => Boolean(recoveryEmail.trim()), [recoveryEmail]);

  async function routeAfterSignIn() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/');
      return;
    }

    if (!user.user_metadata?.community_guidelines_accepted_at) {
      router.replace('/community-guidelines?mode=onboarding' as never);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('[auth] Unable to check onboarding status after sign in', error.message);
      router.replace('/');
      return;
    }

    router.replace(data?.onboarding_completed_at ? '/(tabs)' : '/onboarding-v2');
  }

  async function handleSignIn() {
    if (!canSubmit || isSubmitting) return;

    setInlineError(null);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setInlineError(getFriendlyAuthError(error, 'Check your email and password, then try again.'));
        return;
      }

      await routeAfterSignIn();
    } catch (caught) {
      setInlineError(getFriendlyAuthError(caught, 'Unable to sign in right now.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPasswordRecovery() {
    if (email.trim()) setRecoveryEmail(email.trim());
    setShowPasswordRecovery(true);
  }

  async function handleInlinePasswordReset() {
    if (!canRecover || isRecovering) return;

    setIsRecovering(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
        redirectTo: PASSWORD_RESET_REDIRECT,
      });
      if (error) throw error;

      Alert.alert(
        'Check your email',
        'If an account matches that email, we sent a password reset link. Open the newest reset email to continue.',
      );
    } catch (caught) {
      Alert.alert('Unable to send reset link', getFriendlyAuthError(caught, 'Unable to send a reset link right now.'));
    } finally {
      setIsRecovering(false);
    }
  }

  return (
    <ImageBackground source={require('../../assets/auth/signin.png')} resizeMode="cover" style={styles.background}>
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.spacer} />

            <View style={styles.panel}>
              <Text style={styles.eyebrow}>GO MELANATED</Text>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.body}>Sign in to continue your next adventure.</Text>

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
                    autoComplete="current-password"
                    onChangeText={setPassword}
                    onSubmitEditing={() => void handleSignIn()}
                    placeholder="Password"
                    placeholderTextColor="#AEB8B2"
                    returnKeyType="done"
                    secureTextEntry={!showPassword}
                    style={styles.passwordInput}
                    value={password}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={10}
                    onPress={() => setShowPassword((value) => !value)}
                  >
                    <Text style={styles.visibilityText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable accessibilityRole="button" hitSlop={10} onPress={openPasswordRecovery} style={styles.forgotTap}>
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>

              {inlineError ? <Text style={styles.errorText}>{inlineError}</Text> : null}

              {showPasswordRecovery ? (
                <View style={styles.recoveryPanel}>
                  <View style={styles.recoveryHeaderRow}>
                    <View style={styles.recoveryHeaderCopy}>
                      <Text style={styles.recoveryTitle}>Reset your password</Text>
                      <Text style={styles.recoveryBody}>Enter your email and we’ll send a secure reset link.</Text>
                    </View>
                    <Pressable hitSlop={8} onPress={() => setShowPasswordRecovery(false)}>
                      <Text style={styles.closeRecovery}>Close</Text>
                    </Pressable>
                  </View>

                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={setRecoveryEmail}
                    placeholder="Email"
                    placeholderTextColor="#87938B"
                    style={styles.recoveryInput}
                    value={recoveryEmail}
                  />

                  <Pressable
                    disabled={!canRecover || isRecovering}
                    onPress={() => void handleInlinePasswordReset()}
                    style={[styles.secondaryButton, (!canRecover || isRecovering) && styles.buttonDisabled]}
                  >
                    <Text style={styles.secondaryButtonText}>{isRecovering ? 'Sending…' : 'Send reset link'}</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                disabled={!canSubmit || isSubmitting}
                onPress={() => void handleSignIn()}
                style={[styles.button, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
              </Pressable>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>New here?</Text>
                <Link href="/(auth)/sign-up" style={styles.link}>
                  Create an account
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
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(5, 10, 8, 0.34)',
  },
  safe: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
  spacer: { minHeight: 180, flexGrow: 1 },
  panel: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    gap: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(15, 23, 19, 0.88)',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#FFF8E8', fontSize: 32, lineHeight: 37, fontWeight: '900' },
  body: { color: '#CDD5D0', fontSize: 15, lineHeight: 22 },
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
  forgotTap: { alignSelf: 'flex-end', minHeight: 34, justifyContent: 'center' },
  forgotLink: { color: '#E0C675', fontSize: 13, fontWeight: '800' },
  errorText: { color: '#FFB7AE', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  recoveryPanel: {
    gap: 11,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  recoveryHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  recoveryHeaderCopy: { flex: 1, gap: 4 },
  recoveryTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  recoveryBody: { color: '#B9C3BD', fontSize: 13, lineHeight: 18 },
  closeRecovery: { color: '#D7B45A', fontSize: 13, fontWeight: '800' },
  recoveryInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#56645C',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F7F3EA',
    color: '#17211B',
  },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E9E1C8' },
  secondaryButtonText: { color: '#1F3529', fontSize: 14, fontWeight: '900' },
  button: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#748A4A' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, paddingTop: 2 },
  footerText: { color: '#B9C3BD', fontSize: 14 },
  link: { color: '#E0C675', fontSize: 14, fontWeight: '900' },
});
