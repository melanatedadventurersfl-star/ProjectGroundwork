import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { getFriendlyAuthError } from '../../src/lib/errors';
import { supabase } from '../../src/lib/supabase';

function getParams(url: string) {
  const normalized = url.replace('#', '?');
  const query = normalized.split('?')[1] ?? '';
  return new URLSearchParams(query);
}

export default function AuthCallbackScreen() {
  const [message, setMessage] = useState('Completing secure sign-in…');

  useEffect(() => {
    let active = true;

    async function complete(url: string | null) {
      if (!url) {
        if (active) setMessage('This link is missing authentication details.');
        return;
      }

      try {
        const params = getParams(url);
        const code = params.get('code');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('No recovery session was found in this link.');
        }

        if (!active) return;
        if (type === 'recovery' || url.includes('type=recovery')) {
          router.replace('/reset-password' as never);
        } else {
          router.replace('/(tabs)' as never);
        }
      } catch (caught) {
        if (!active) return;
        setMessage(getFriendlyAuthError(caught, 'This sign-in link could not be completed. Request a new link and try again.'));
      }
    }

    void Linking.getInitialURL().then(complete);
    const subscription = Linking.addEventListener('url', ({ url }) => void complete(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <ActivityIndicator color="#D7B45A" size="large" />
        <Text style={styles.eyebrow}>MELANATED</Text>
        <Text style={styles.title}>Securing your account</Text>
        <Text style={styles.body}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#17211B' },
  card: { gap: 14, padding: 24, borderRadius: 16, backgroundColor: '#111A17', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: '#D7B45A' },
  title: { fontSize: 26, fontWeight: '900', color: '#FFF8E8', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: '#AEB8B2', textAlign: 'center' },
});
