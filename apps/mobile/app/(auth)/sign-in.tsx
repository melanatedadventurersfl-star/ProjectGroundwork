import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFriendlyAuthError } from '../../src/lib/errors';
import { supabase } from '../../src/lib/supabase';

const PASSWORD_RESET_REDIRECT = 'melanatedadventurers://auth/callback';

export default function SignInScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const canSubmit = useMemo(() => Boolean(identifier.trim() && password), [identifier, password]);
  const canRecover = useMemo(() => Boolean(recoveryEmail.trim()), [recoveryEmail]);

  async function routeAfterSignIn(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[auth] Unable to check onboarding status after sign in', error.message);
      router.replace('/');
      return;
    }

    router.replace(data?.onboarding_completed_at ? '/(tabs)' : '/onboarding');
  }

  async function handleSignIn() {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const normalized = identifier.trim();
      let userId: string | null = null;

      if (normalized.includes('@')) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });

        if (error) {
          Alert.alert('Unable to sign in', getFriendlyAuthError(error, 'Check your username/email and password, then try again.'));
          return;
        }
        userId = data.user?.id ?? null;
      } else {
        const { data, error } = await supabase.functions.invoke('username-login', {
          body: { identifier: normalized, password },
        });

        if (error || !data?.access_token || !data?.refresh_token) {
          Alert.alert('Unable to sign in', 'Check your username/email and password, then try again.');
          return;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) {
          Alert.alert('Unable to sign in', getFriendlyAuthError(sessionError, 'Unable to start your session.'));
          return;
        }
        userId = sessionData.user?.id ?? null;
      }

      if (userId) {
        await routeAfterSignIn(userId);
      } else {
        router.replace('/');
      }
    } catch (caught) {
      Alert.alert('Unable to sign in', getFriendlyAuthError(caught, 'Unable to sign in.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPasswordRecovery() {
    const typedIdentifier = identifier.trim();
    if (typedIdentifier.includes('@')) setRecoveryEmail(typedIdentifier);
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
        'If an account matches that email, we sent a password reset link. Open it on this device to choose a new password.',
      );
    } catch (caught) {
      Alert.alert('Unable to send reset link', getFriendlyAuthError(caught, 'Unable to send a reset link right now.'));
    } finally {
      setIsRecovering(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>MELANATED ADVENTURERS</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.body}>Sign in with your username or email to continue your next adventure.</Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setIdentifier}
          placeholder="Username or email"
          style={styles.input}
          value={identifier}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="current-password"
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <View style={styles.recoveryRow}>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.push('/(auth)/forgot-username' as never)}
            style={styles.recoveryTap}
          >
            <Text style={styles.recoveryLink}>Forgot username?</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={openPasswordRecovery}
            style={styles.recoveryTap}
          >
            <Text style={styles.recoveryLink}>Forgot password?</Text>
          </Pressable>
        </View>

        {showPasswordRecovery ? (
          <View style={styles.recoveryPanel}>
            <View style={styles.recoveryHeaderRow}>
              <View style={styles.recoveryHeaderCopy}>
                <Text style={styles.recoveryTitle}>Reset your password</Text>
                <Text style={styles.recoveryBody}>Enter the email on your account and we’ll send a secure reset link.</Text>
              </View>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowPasswordRecovery(false)}>
                <Text style={styles.closeRecovery}>Close</Text>
              </Pressable>
            </View>

            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setRecoveryEmail}
              placeholder="Email"
              style={styles.input}
              value={recoveryEmail}
            />

            <Pressable
              disabled={!canRecover || isRecovering}
              onPress={() => void handleInlinePasswordReset()}
              style={[styles.recoveryButton, (!canRecover || isRecovering) && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>{isRecovering ? 'Sending…' : 'Send reset link'}</Text>
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

        <Link href="/(auth)/sign-up" style={styles.link}>
          Create an account
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#17211B' },
  card: { gap: 16, padding: 24, borderRadius: 16, backgroundColor: '#F7F3EA' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: '#24543B' },
  title: { fontSize: 30, fontWeight: '800', color: '#17211B' },
  body: { fontSize: 16, lineHeight: 24, color: '#56615A' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#B8BEB9', borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  recoveryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: -4 },
  recoveryTap: { minHeight: 44, justifyContent: 'center' },
  recoveryLink: { color: '#24543B', fontSize: 13, fontWeight: '800' },
  recoveryPanel: { gap: 12, padding: 14, borderWidth: 1, borderColor: '#D3D8D4', borderRadius: 12, backgroundColor: '#EEF2EE' },
  recoveryHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  recoveryHeaderCopy: { flex: 1, gap: 4 },
  recoveryTitle: { color: '#17211B', fontSize: 16, fontWeight: '800' },
  recoveryBody: { color: '#56615A', fontSize: 13, lineHeight: 18 },
  closeRecovery: { color: '#24543B', fontSize: 13, fontWeight: '800' },
  recoveryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#24543B' },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#24543B' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: '#24543B', fontWeight: '700' },
});
