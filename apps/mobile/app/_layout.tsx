import * as Updates from 'expo-updates';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

import { AuthProvider } from '../src/auth/AuthProvider';

const UPDATE_CHECK_THROTTLE_MS = 15000;

export default function RootLayout() {
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    async function checkForUpdate(force = false) {
      if (!Updates.isEnabled || checkingRef.current) return;

      const now = Date.now();
      if (!force && now - lastCheckRef.current < UPDATE_CHECK_THROTTLE_MS) return;

      checkingRef.current = true;
      lastCheckRef.current = now;

      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;

        setApplyingUpdate(true);
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew) {
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.warn('[updates] Unable to apply OTA update', error);
        setApplyingUpdate(false);
      } finally {
        checkingRef.current = false;
      }
    }

    void checkForUpdate(true);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });

    return () => subscription.remove();
  }, []);

  if (applyingUpdate) {
    return (
      <View style={styles.updateScreen}>
        <ActivityIndicator size="large" color="#D7B45A" />
        <Text style={styles.updateEyebrow}>MELANATED ADVENTURERS</Text>
        <Text style={styles.updateTitle}>Updating your trail…</Text>
        <Text style={styles.updateCopy}>Loading the latest app experience.</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="adventures" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="readiness" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="passport" />
        <Stack.Screen name="member" />
        <Stack.Screen name="host" />
      </Stack>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  updateScreen: {
    flex: 1,
    backgroundColor: '#0F1713',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  updateEyebrow: {
    color: '#D7B45A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 12,
  },
  updateTitle: {
    color: '#FFF8E8',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    textAlign: 'center',
  },
  updateCopy: {
    color: '#8F9A93',
    fontSize: 14,
    textAlign: 'center',
  },
});
