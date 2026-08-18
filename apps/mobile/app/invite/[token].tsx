import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { normalizeInviteToken, savePendingInviteToken } from '../../src/referrals/pendingInvite';

export default function InviteCaptureScreen() {
  const { session, isLoading } = useAuth();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => normalizeInviteToken(Array.isArray(params.token) ? params.token[0] : params.token), [params.token]);

  useEffect(() => {
    if (!token || isLoading) return;
    savePendingInviteToken(token);
    const timeout = setTimeout(() => {
      router.replace(session ? '/(tabs)' : '/(auth)/sign-up');
    }, 450);
    return () => clearTimeout(timeout);
  }, [isLoading, session, token]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#D7B45A" size="large" />
      <Text style={styles.eyebrow}>MELANATED ADVENTURERS</Text>
      <Text style={styles.title}>{token ? 'Invite saved' : 'Invite link unavailable'}</Text>
      <Text style={styles.copy}>{token ? 'We’ll connect your account to the member who invited you after you join.' : 'This invite link is missing its referral code.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginTop: 12 },
  title: { color: '#FFF8E8', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  copy: { color: '#AEB8B1', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
});
