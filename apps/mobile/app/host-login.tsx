import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFriendlyAuthError } from '../src/lib/errors';
import { supabase } from '../src/lib/supabase';
import { resolveHostEntry, sanitizeHostDestination } from '../src/hosting/hostEntry';

const PASSWORD_RESET_REDIRECT = 'https://hqndxityqrdiiwqyjagu.supabase.co/functions/v1/password-reset';

function accessMessage(status?: string | null) {
  if (status === 'pending') return { title: 'Host access pending', body: 'Your host application is still under review. You can return to Go Melanated while it is being reviewed.' };
  if (status === 'needs_info') return { title: 'More information needed', body: 'Your Host Center application needs additional information before access can be approved.' };
  if (status === 'paused') return { title: 'Host access paused', body: 'This account cannot enter Host Center while host access is paused.' };
  if (status === 'declined') return { title: 'Host access unavailable', body: 'This account is not approved for Host Center access.' };
  if (status === 'revoked') return { title: 'Host access revoked', body: 'This account no longer has Host Center access.' };
  return { title: 'Host access required', body: 'This Go Melanated account does not have approved Host Center access.' };
}

export default function HostLoginScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const next = sanitizeHostDestination(params.next);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [accessState, setAccessState] = useState<{ status: string | null } | null>(null);
  const canSubmit = useMemo(() => Boolean(email.trim() && password), [email, password]);

  async function signIn() {
    if (!canSubmit || working) return;
    setWorking(true);
    setError('');
    setAccessState(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      const entry = await resolveHostEntry(next);
      if (!entry.approved) {
        setAccessState({ status: entry.accessRecord?.status ?? null });
        return;
      }
      if (!entry.profile?.introCompletedAt) {
        router.replace(`/host/intro?next=${encodeURIComponent(entry.destination)}` as never);
        return;
      }
      router.replace(entry.destination as never);
    } catch (caught) {
      setError(getFriendlyAuthError(caught, 'Unable to enter Host Center right now.'));
    } finally {
      setWorking(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('Enter your email first, then choose Forgot password.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: PASSWORD_RESET_REDIRECT });
      if (resetError) throw resetError;
      Alert.alert('Check your email', 'If an account matches that email, a password reset link was sent.');
    } catch (caught) {
      setError(getFriendlyAuthError(caught, 'Unable to send a reset link right now.'));
    } finally {
      setWorking(false);
    }
  }

  const blocked = accessState ? accessMessage(accessState.status) : null;

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <View style={styles.mark}><Text style={styles.markText}>GM</Text></View>
          <Text style={styles.brand}>GO MELANATED</Text>
          <Text style={styles.product}>Host Center</Text>
          <Text style={styles.tagline}>Plan, organize, promote and run your events from one workspace.</Text>
        </View>

        <View style={styles.panel}>
          {blocked ? <>
            <Text style={styles.panelEyebrow}>HOST CENTER ACCESS</Text>
            <Text style={styles.panelTitle}>{blocked.title}</Text>
            <Text style={styles.panelBody}>{blocked.body}</Text>
            {accessState?.status === null ? <Pressable style={styles.primary} onPress={() => router.replace('/host/apply' as never)}><Text style={styles.primaryText}>Request Host Access</Text></Pressable> : null}
            <Pressable style={styles.secondary} onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.secondaryText}>Return to Go Melanated</Text></Pressable>
          </> : <>
            <Text style={styles.panelEyebrow}>HOST SIGN IN</Text>
            <Text style={styles.panelTitle}>Welcome back</Text>
            <Text style={styles.panelBody}>Use your existing Go Melanated account. Approved hosts go directly into Host Center.</Text>

            <TextInput autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor="#738078" value={email} onChangeText={setEmail} style={styles.input} />
            <View style={styles.passwordRow}>
              <TextInput autoCapitalize="none" autoComplete="current-password" placeholder="Password" placeholderTextColor="#738078" value={password} onChangeText={setPassword} onSubmitEditing={() => void signIn()} secureTextEntry={!showPassword} style={styles.passwordInput} />
              <Pressable hitSlop={10} onPress={() => setShowPassword((value) => !value)}><Text style={styles.show}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable>
            </View>
            <Pressable disabled={working} onPress={() => void resetPassword()} style={styles.forgot}><Text style={styles.forgotText}>Forgot password?</Text></Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable disabled={!canSubmit || working} style={[styles.primary, (!canSubmit || working) && styles.disabled]} onPress={() => void signIn()}>{working ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Enter Host Center</Text>}</Pressable>
            <View style={styles.divider} />
            <Pressable onPress={() => router.replace('/(auth)/sign-in' as never)}><Text style={styles.memberLink}>Member sign in →</Text></Pressable>
          </>}
        </View>

        <Text style={styles.security}>One account. Separate Host Center workspace. Your host permission determines access.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08100C' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingVertical: 42 },
  brandBlock: { width: '100%', maxWidth: 480, alignSelf: 'center', marginBottom: 22 },
  mark: { width: 48, height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#786126', backgroundColor: '#302713', alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#E7C464', fontWeight: '900', fontSize: 15 },
  brand: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 16 },
  product: { color: '#FFF8E8', fontSize: 36, lineHeight: 42, fontWeight: '900', marginTop: 3 },
  tagline: { color: '#A8B2AB', fontSize: 13, lineHeight: 20, maxWidth: 410, marginTop: 7 },
  panel: { width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#314037', backgroundColor: '#121A15', padding: 18 },
  panelEyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  panelTitle: { color: '#FFF8E8', fontSize: 23, fontWeight: '900', marginTop: 4 },
  panelBody: { color: '#97A39B', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 12 },
  input: { minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#35423A', backgroundColor: '#0D1410', paddingHorizontal: 13, color: '#FFF8E8', fontSize: 14, marginTop: 8 },
  passwordRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#35423A', backgroundColor: '#0D1410', paddingRight: 13, marginTop: 9 },
  passwordInput: { flex: 1, minHeight: 50, paddingHorizontal: 13, color: '#FFF8E8', fontSize: 14 },
  show: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  forgot: { alignSelf: 'flex-end', paddingVertical: 10 },
  forgotText: { color: '#C7AD63', fontSize: 10, fontWeight: '800' },
  error: { color: '#FF9D92', fontSize: 10, lineHeight: 15, marginVertical: 3 },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' },
  secondary: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  secondaryText: { color: '#D0D8D3', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#2B3730', marginVertical: 16 },
  memberLink: { color: '#9EAAA2', fontSize: 10, textAlign: 'center', fontWeight: '800' },
  security: { color: '#65726A', fontSize: 8.5, lineHeight: 13, textAlign: 'center', marginTop: 14, alignSelf: 'center', maxWidth: 420 },
});
