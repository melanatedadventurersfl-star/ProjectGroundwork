import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFriendlyAuthError } from '../src/lib/errors';
import { supabase } from '../src/lib/supabase';

function makeInternalUsername(email: string) {
  const localPart = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 14) || 'member';
  return `${localPart}.${Date.now().toString(36).slice(-6)}`;
}

export default function TenantSignUpScreen() {
  const params = useLocalSearchParams<{ org_invite?: string | string[]; slug?: string | string[] }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const inviteToken = useMemo(() => {
    const raw = Array.isArray(params.org_invite) ? params.org_invite[0] : params.org_invite;
    const token = raw?.trim() ?? '';
    return token.startsWith('org_') ? token : '';
  }, [params.org_invite]);
  const slug = useMemo(() => {
    const raw = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    return raw?.trim().toLowerCase() ?? '';
  }, [params.slug]);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = /^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 8 && passwordsMatch && Boolean(inviteToken && slug);

  async function createAccount() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: makeInternalUsername(email.trim()),
            display_name: '',
            organization_join_token: inviteToken,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        router.replace(`/experience/${slug}` as never);
        return;
      }

      setNotice('Check your email to verify this account. Then return here and sign in to the organization app.');
    } catch (caught) {
      setError(getFriendlyAuthError(caught, 'Unable to create this organization account.'));
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.wrap}>
        <View style={styles.mark}><Text style={styles.markText}>APP</Text></View>
        <Text style={styles.eyebrow}>ORGANIZATION INVITATION</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>This signup belongs to the organization that invited you. It does not enroll you in Go Melanated.</Text>

        {!inviteToken || !slug ? <View style={styles.invalid}><Text style={styles.invalidTitle}>Invitation incomplete</Text><Text style={styles.invalidText}>Use the complete invitation link from the organization.</Text></View> : null}

        <View style={styles.card}>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="Email" placeholderTextColor="#6F7D75" style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="Password (8+ characters)" placeholderTextColor="#6F7D75" style={styles.input} />
          <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" placeholder="Confirm password" placeholderTextColor="#6F7D75" style={[styles.input, confirmPassword.length > 0 && !passwordsMatch && styles.inputError]} onSubmitEditing={() => void createAccount()} />
          {password.length > 0 && password.length < 8 ? <Text style={styles.help}>Use at least 8 characters.</Text> : null}
          {confirmPassword.length > 0 && !passwordsMatch ? <Text style={styles.error}>Passwords do not match.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Pressable disabled={!canSubmit || busy} style={[styles.button, (!canSubmit || busy) && styles.disabled]} onPress={() => void createAccount()}>
            {busy ? <ActivityIndicator color="#101510" /> : <Text style={styles.buttonText}>Create account</Text>}
          </Pressable>
        </View>

        {slug ? <Pressable style={styles.signInLink} onPress={() => router.replace({ pathname: '/tenant-sign-in', params: { slug } })}><Text style={styles.signInText}>Already have an account? Sign in</Text></Pressable> : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  wrap: { width: '100%', maxWidth: 500, alignSelf: 'center' },
  mark: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, borderColor: '#66582F', backgroundColor: '#211E13', alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#D7B45A', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 19 },
  title: { color: '#FFF8E8', fontSize: 32, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#98A69E', fontSize: 12, lineHeight: 18, marginTop: 6 },
  invalid: { borderRadius: 14, borderWidth: 1, borderColor: '#73433E', backgroundColor: '#261816', padding: 13, marginTop: 16 },
  invalidTitle: { color: '#F2B2AA', fontSize: 11.5, fontWeight: '900' },
  invalidText: { color: '#B88F89', fontSize: 10, lineHeight: 15, marginTop: 3 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: '#304037', backgroundColor: '#151E18', padding: 16, gap: 11, marginTop: 18 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#3A4940', backgroundColor: '#0C130F', color: '#FFF8E8', paddingHorizontal: 14, fontSize: 14 },
  inputError: { borderColor: '#A5554D' },
  help: { color: '#8F9D94', fontSize: 10 },
  error: { color: '#F0A199', fontSize: 10.5, lineHeight: 15 },
  notice: { color: '#C8AF62', fontSize: 10.5, lineHeight: 16 },
  button: { minHeight: 50, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  disabled: { opacity: 0.42 },
  buttonText: { color: '#101510', fontSize: 13, fontWeight: '900' },
  signInLink: { alignSelf: 'center', padding: 14, marginTop: 8 },
  signInText: { color: '#C9B25E', fontSize: 11, fontWeight: '800' },
});
