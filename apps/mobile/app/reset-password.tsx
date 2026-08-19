import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFriendlyAuthError } from '../src/lib/errors';
import { supabase } from '../src/lib/supabase';

function getParams(url: string) {
  const normalized = url.replace('#', '?');
  const query = normalized.split('?')[1] ?? '';
  return new URLSearchParams(query);
}

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const canSubmit = useMemo(
    () => hasRecoverySession && password.length >= 8 && password === confirmPassword,
    [confirmPassword, hasRecoverySession, password],
  );

  useEffect(() => {
    let active = true;

    async function establishRecoverySession(url: string | null) {
      try {
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession.session) {
          if (active) setHasRecoverySession(true);
          return;
        }

        if (!url) return;

        const params = getParams(url);
        const code = params.get('code');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (active) setHasRecoverySession(true);
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (active) setHasRecoverySession(true);
        }
      } catch (caught) {
        Alert.alert('Reset link problem', getFriendlyAuthError(caught, 'This reset link could not be opened. Request a new one and try again.'));
      } finally {
        if (active) setIsPreparing(false);
      }
    }

    void Linking.getInitialURL().then(establishRecoverySession);
    const subscription = Linking.addEventListener('url', ({ url }) => void establishRecoverySession(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function handleUpdatePassword() {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      Alert.alert('Password updated', 'Your new password is ready. Sign in with it now.', [
        { text: 'Sign in', onPress: () => router.replace('/(auth)/sign-in' as never) },
      ]);
    } catch (caught) {
      Alert.alert('Unable to update password', getFriendlyAuthError(caught, 'Unable to update your password right now.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.body}>
          {isPreparing
            ? 'Opening your secure reset link…'
            : hasRecoverySession
              ? 'Use at least 8 characters for your new password.'
              : 'This screen needs a valid reset link. Go back to sign in and request a new password reset email.'}
        </Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          editable={hasRecoverySession && !isPreparing}
          onChangeText={setPassword}
          placeholder="New password"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          editable={hasRecoverySession && !isPreparing}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          secureTextEntry
          style={styles.input}
          value={confirmPassword}
        />

        {password && confirmPassword && password !== confirmPassword ? (
          <Text style={styles.validation}>Passwords do not match.</Text>
        ) : null}

        <Pressable
          disabled={!canSubmit || isSubmitting}
          onPress={() => void handleUpdatePassword()}
          style={[styles.button, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isSubmitting ? 'Updating…' : 'Update password'}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/(auth)/sign-in' as never)}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#17211B' },
  card: { gap: 16, padding: 24, borderRadius: 16, backgroundColor: '#F7F3EA' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#24543B' },
  title: { fontSize: 30, fontWeight: '800', color: '#17211B' },
  body: { fontSize: 16, lineHeight: 24, color: '#56615A' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#B8BEB9', borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  validation: { color: '#A33A3A', fontSize: 13, fontWeight: '700' },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#24543B' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: '#24543B', fontWeight: '700' },
});
