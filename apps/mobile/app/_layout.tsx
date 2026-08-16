import * as Updates from 'expo-updates';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { PersistentBottomNav } from '../src/navigation/PersistentBottomNav';
import { PersistentTopNav } from '../src/navigation/PersistentTopNav';
import { PushNotificationsManager } from '../src/notifications/PushNotificationsManager';
import { hasSeenGuestTutorialPrompt, markGuestTutorialPromptSeen } from '../src/onboarding/tutorialPreference';

const UPDATE_CHECK_THROTTLE_MS = 15000;

function isGuestPublicPath(pathname: string) {
  const isPublicLocalEvent = pathname.startsWith('/local-events/') && !pathname.startsWith('/local-events/create');
  return (
    pathname === '/' ||
    pathname === '/(tabs)' ||
    pathname === '/(tabs)/' ||
    pathname.includes('/explore') ||
    pathname.startsWith('/adventures') ||
    isPublicLocalEvent ||
    pathname.startsWith('/guide') ||
    pathname.startsWith('/trail-guide') ||
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up')
  );
}

function AppShell() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  const tutorialCheckedRef = useRef(false);

  const isAuthScreen =
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up');
  const isTrailhead = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
  const isCommunityHub = pathname === '/community' || pathname === '/(tabs)/community';
  const hideBottomNav = isLoading || isAuthScreen;
  const hideTopNav = isLoading || isAuthScreen || isTrailhead || isCommunityHub;

  useEffect(() => {
    if (isLoading || session || isGuestPublicPath(pathname)) return;
    router.replace('/(auth)/sign-in' as never);
  }, [isLoading, pathname, session]);

  useEffect(() => {
    if (isLoading || session || !isTrailhead || tutorialCheckedRef.current) return;
    tutorialCheckedRef.current = true;
    try {
      if (!hasSeenGuestTutorialPrompt()) setShowTutorialPrompt(true);
    } catch (error) {
      console.warn('[tutorial] Unable to read tutorial preference', error);
      setShowTutorialPrompt(true);
    }
  }, [isLoading, isTrailhead, session]);

  function finishTutorialPrompt(openTutorial: boolean) {
    try {
      markGuestTutorialPromptSeen();
    } catch (error) {
      console.warn('[tutorial] Unable to save tutorial preference', error);
    }
    setShowTutorialPrompt(false);
    if (openTutorial) router.push('/guide' as never);
  }

  return (
    <View style={styles.appShell}>
      <PushNotificationsManager enabled={Boolean(session) && !isAuthScreen} />
      {hideTopNav ? null : <PersistentTopNav />}
      <View style={styles.stackArea}>
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
          <Stack.Screen name="trail-guide" />
        </Stack>
      </View>
      {hideBottomNav ? null : <PersistentBottomNav />}

      <Modal visible={showTutorialPrompt} transparent animationType="fade" onRequestClose={() => finishTutorialPrompt(false)}>
        <View style={styles.modalShade}>
          <View style={styles.tutorialCard}>
            <Text style={styles.tutorialEyebrow}>WELCOME OUTSIDE</Text>
            <Text style={styles.tutorialTitle}>Want a quick tour?</Text>
            <Text style={styles.tutorialCopy}>See how Trailhead, Explore, Campfire, Passport, stamps, badges, and your member profile fit together.</Text>
            <Pressable style={styles.tutorialPrimary} onPress={() => finishTutorialPrompt(true)}>
              <Text style={styles.tutorialPrimaryText}>Show Tutorial</Text>
            </Pressable>
            <Pressable style={styles.tutorialSecondary} onPress={() => finishTutorialPrompt(false)}>
              <Text style={styles.tutorialSecondaryText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
        if (fetched.isNew) await Updates.reloadAsync();
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

  return <AuthProvider><AppShell /></AuthProvider>;
}

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: '#0F1713' },
  stackArea: { flex: 1 },
  modalShade: { flex: 1, backgroundColor: 'rgba(4,8,6,.76)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  tutorialCard: { width: '100%', maxWidth: 430, borderRadius: 24, borderWidth: 1, borderColor: '#3A4A41', backgroundColor: '#17211C', padding: 22, gap: 12 },
  tutorialEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  tutorialTitle: { color: '#FFF8E8', fontSize: 29, lineHeight: 33, fontWeight: '900' },
  tutorialCopy: { color: '#AEB8B2', fontSize: 15, lineHeight: 22, marginBottom: 4 },
  tutorialPrimary: { backgroundColor: '#D7B45A', borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  tutorialPrimaryText: { color: '#17211C', fontSize: 15, fontWeight: '900' },
  tutorialSecondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tutorialSecondaryText: { color: '#D5DDD8', fontSize: 14, fontWeight: '800' },
  updateScreen: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 10 },
  updateEyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 12 },
  updateTitle: { color: '#FFF8E8', fontSize: 26, lineHeight: 31, fontWeight: '900', textAlign: 'center' },
  updateCopy: { color: '#8F9A93', fontSize: 14, textAlign: 'center' },
});