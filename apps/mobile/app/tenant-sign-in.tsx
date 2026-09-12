import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../src/lib/supabase';

export default function TenantSignInScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const appSlug = typeof slug === 'string' ? slug : '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    if (!appSlug || !email.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      router.replace(`/experience/${appSlug}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <View style={styles.wrap}>
      <View style={styles.mark}><Text style={styles.markText}>APP</Text></View>
      <Text style={styles.eyebrow}>ORGANIZATION EXPERIENCE</Text>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Use the account connected to this organization.</Text>

      <View style={styles.card}>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#6E7A72" style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#6E7A72" style={styles.input} onSubmitEditing={() => void signIn()} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy || !appSlug || !email.trim() || !password} style={[styles.button, (busy || !appSlug || !email.trim() || !password) && styles.buttonDisabled]} onPress={() => void signIn()}>
          {busy ? <ActivityIndicator color="#101510" /> : <Text style={styles.buttonText}>Enter app</Text>}
        </Pressable>
      </View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  wrap: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', padding: 24 },
  mark: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, borderColor: '#66582F', backgroundColor: '#211E13', alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#D7B45A', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 20 },
  title: { color: '#FFF8E8', fontSize: 34, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#98A69E', fontSize: 12, lineHeight: 18, marginTop: 5 },
  card: { marginTop: 22, borderRadius: 20, borderWidth: 1, borderColor: '#304037', backgroundColor: '#151E18', padding: 16, gap: 11 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#3A4940', backgroundColor: '#0C130F', color: '#FFF8E8', paddingHorizontal: 14, fontSize: 14 },
  error: { color: '#F0A199', fontSize: 10.5, lineHeight: 15 },
  button: { minHeight: 50, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#101510', fontSize: 13, fontWeight: '900' },
});
