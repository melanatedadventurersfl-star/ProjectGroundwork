import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFriendlyAuthError } from '../../src/lib/errors';
import { supabase } from '../../src/lib/supabase';

export default function ForgotUsernameScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = useMemo(() => Boolean(email.trim()), [email]);

  async function handleRecover() {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('recover_username_by_email', { p_email: email.trim() });
      if (error) throw error;

      const username = typeof data === 'string' ? data.trim() : '';
      if (username) {
        Alert.alert('Username found', `Your username is ${username}.`);
      } else {
        Alert.alert('No username found', 'We could not find a username for that email. Check the address and try again.');
      }
    } catch (caught) {
      Alert.alert('Unable to recover username', getFriendlyAuthError(caught, 'Unable to recover your username right now.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
        <Text style={styles.title}>Find your username</Text>
        <Text style={styles.body}>Enter the email connected to your account and we’ll look up your Melanated username.</Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          style={styles.input}
          value={email}
        />

        <Pressable
          disabled={!canSubmit || isSubmitting}
          onPress={() => void handleRecover()}
          style={[styles.button, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isSubmitting ? 'Looking…' : 'Find username'}</Text>
        </Pressable>

        <Link href="/(auth)/sign-in" style={styles.link}>Back to sign in</Link>
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
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#24543B' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: '#24543B', fontWeight: '700' },
});