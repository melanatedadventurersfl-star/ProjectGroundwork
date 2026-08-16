import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFriendlyAuthError } from '../../src/lib/errors';
import { supabase } from '../../src/lib/supabase';

export default function SignInScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = useMemo(() => Boolean(identifier.trim() && password), [identifier, password]);

  async function handleSignIn() {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const normalized = identifier.trim();

      if (normalized.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });

        if (error) {
          Alert.alert('Unable to sign in', getFriendlyAuthError(error, 'Check your username/email and password, then try again.'));
          return;
        }
      } else {
        const { data, error } = await supabase.functions.invoke('username-login', {
          body: { identifier: normalized, password },
        });

        if (error || !data?.access_token || !data?.refresh_token) {
          Alert.alert('Unable to sign in', 'Check your username/email and password, then try again.');
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) {
          Alert.alert('Unable to sign in', getFriendlyAuthError(sessionError, 'Unable to start your session.'));
          return;
        }
      }

      router.replace('/(tabs)');
    } catch (caught) {
      Alert.alert('Unable to sign in', getFriendlyAuthError(caught, 'Unable to sign in.'));
    } finally {
      setIsSubmitting(false);
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
          <Link href="/(auth)/forgot-username" style={styles.recoveryLink}>Forgot username?</Link>
          <Link href="/(auth)/forgot-password" style={styles.recoveryLink}>Forgot password?</Link>
        </View>

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
  recoveryLink: { color: '#24543B', fontSize: 13, fontWeight: '800' },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#24543B' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: '#24543B', fontWeight: '700' },
});