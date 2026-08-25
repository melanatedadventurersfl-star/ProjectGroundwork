import * as Updates from 'expo-updates';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { PersistentBottomNav } from '../src/navigation/PersistentBottomNav';
import { PersistentTopNav } from '../src/navigation/PersistentTopNav';
import { PushNotificationsManager } from '../src/notifications/PushNotificationsManager';
import { GuidedTutorial } from '../src/onboarding/GuidedTutorial';
import { subscribeGuidedTutorial } from '../src/onboarding/tutorialController';
import {
  hasCompletedGuidedTutorial,
  hasFinishedGuidedTutorial,
  markGuidedTutorialCompleted,
  markGuidedTutorialFinished,
} from '../src/onboarding/tutorialPreference';
import { awardTutorialCompletionStamp } from '../src/onboarding/tutorialRewards';
import { logStartupStage, StartupFailureView, StartupLoadingView, withStartupTimeout } from '../src/reliability/startup';
import { currentReleaseNotes } from '../src/updates/releaseNotes';
import { hasSeenRelease, markReleaseSeen } from '../src/updates/releasePreference';
import { WhatsNewModal } from '../src/updates/WhatsNewModal';

const UPDATE_NETWORK_TIMEOUT_MS = 10000;

type UpdateStartupPhase = 'checking' | 'downloading' | 'ready';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  console.error('[startup] Unhandled root render error', error);
  return <StartupFailureView error={error} onRetry={retry} />;
}

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
    pathname.startsWith('/community-guidelines') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up')
  );
}

function AppShell() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialGateReady, setTutorialGateReady] = useState(false);
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const tutorialCheckedRef = useRef(false);
  const tutorialUserRef = useRef<string | null>(null);
  const whatsNewCheckedRef = useRef(false);
  const firstScreenLoggedRef = useRef(false);
  const releaseSeenKey = currentReleaseNotes.id;

  const isAuthScreen =
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up');
  const isTrailhead = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
  const isCommunityHub = /\/community\/?$/.test(pathname);
  const tutorialGateLocked = Boolean(session) && !isAuthScreen && !tutorialGateReady;
  const hideBottomNav = isLoading || isAuthScreen || keyboardVisible || tutorialGateLocked || tutorialVisible;
  const hideTopNav = isLoading || isAuthScreen || isTrailhead || isCommunityHub || tutorialGateLocked || tutorialVisible;

  useEffect(() => {
    if (isLoading || firstScreenLoggedRef.current) return;
    firstScreenLoggedRef.current = true;
    logStartupStage('navigation-ready', { pathname });
    requestAnimationFrame(() => logStartupStage('first-screen', { pathname }));
  }, [isLoading, pathname]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isLoading || session || isGuestPublicPath(pathname)) return;
    router.replace('/(auth)/sign-in' as never);
  }, [isLoading, pathname, session]);

  useEffect(() => {
    if (isLoading || !session?.user.id || pathname !== '/onboarding') return;

    let active = true;
    void supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn('[onboarding-v2] Unable to verify preview handoff', error.message);
        return;
      }
      if (data === true) router.replace('/onboarding-v2' as never);
    });

    return () => {
      active = false;
    };
  }, [isLoading, pathname, session?.user.id]);

  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (tutorialUserRef.current === userId) return;
    tutorialUserRef.current = userId;
    tutorialCheckedRef.current = false;
    setTutorialGateReady(false);
    setTutorialVisible(false);
    setTutorialStep(0);
  }, [session?.user.id]);

  useEffect(() => {
    if (isLoading || !session || isAuthScreen || tutorialCheckedRef.current) return;
    tutorialCheckedRef.current = true;
    try {
      if (!hasCompletedGuidedTutorial()) {
        markReleaseSeen(releaseSeenKey);
        setWhatsNewVisible(false);
        setTutorialStep(0);
        setTutorialVisible(true);
        router.replace('/(tabs)' as never);
      } else {
        setTutorialGateReady(true);
        if (hasFinishedGuidedTutorial()) {
          void awardTutorialCompletionStamp().catch((error) => {
            console.warn('[tutorial] Unable to sync tutorial completion stamp', error);
          });
        }
      }
    } catch (error) {
      console.warn('[tutorial] Unable to read guided tutorial preference', error);
      setWhatsNewVisible(false);
      setTutorialStep(0);
      setTutorialVisible(true);
      router.replace('/(tabs)' as never);
    }
  }, [isAuthScreen, isLoading, releaseSeenKey, session]);

  useEffect(() => {
    if (isLoading || isAuthScreen || !isTrailhead || tutorialVisible || tutorialGateLocked || whatsNewCheckedRef.current) return;
    whatsNewCheckedRef.current = true;
    try {
      setWhatsNewVisible(!hasSeenRelease(releaseSeenKey));
    } catch (error) {
      console.warn('[updates] Unable to read release-note preference', error);
      setWhatsNewVisible(true);
    }
  }, [isAuthScreen, isLoading, isTrailhead, releaseSeenKey, tutorialGateLocked, tutorialVisible]);

  useEffect(() => subscribeGuidedTutorial(() => {
    setTutorialGateReady(false);
    setWhatsNewVisible(false);
    setTutorialStep(0);
    setTutorialVisible(true);
    router.replace('/(tabs)' as never);
  }), []);

  function closeTutorial() {
    setTutorialVisible(false);
    setTutorialGateReady(true);
    setTutorialStep(0);
    whatsNewCheckedRef.current = false;
    router.replace('/(tabs)' as never);
  }

  function skipTutorial() {
    try { markGuidedTutorialCompleted(); } catch (error) { console.warn('[tutorial] Unable to save guided tutorial preference', error); }
    closeTutorial();
  }

  function finishTutorial() {
    try { markGuidedTutorialFinished(); } catch (error) { console.warn('[tutorial] Unable to save guided tutorial completion', error); }
    void awardTutorialCompletionStamp().catch((error) => console.warn('[tutorial] Unable to award tutorial completion stamp', error));
    closeTutorial();
  }

  function dismissWhatsNew() {
    try { markReleaseSeen(releaseSeenKey); } catch (error) { console.warn('[updates] Unable to save release-note preference', error); }
    setWhatsNewVisible(false);
  }

  if (isLoading) return <StartupLoadingView message="Restoring your session…" />;

  return (
    <View style={styles.appShell} testID="app-shell">
      <PushNotificationsManager enabled={Boolean(session) && !isAuthScreen && !tutorialGateLocked && !tutorialVisible} />
      {hideTopNav ? null : <PersistentTopNav />}
      <KeyboardAvoidingView style={styles.stackArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" /><Stack.Screen name="onboarding" /><Stack.Screen name="onboarding-v2" />
          <Stack.Screen name="(tabs)" /><Stack.Screen name="(auth)" /><Stack.Screen name="auth" />
          <Stack.Screen name="reset-password" /><Stack.Screen name="adventures" /><Stack.Screen name="checkout" />
          <Stack.Screen name="readiness" /><Stack.Screen name="notifications" /><Stack.Screen name="passport" />
          <Stack.Screen name="member" /><Stack.Screen name="host" /><Stack.Screen name="trail-guide" />
          <Stack.Screen name="community-guidelines" /><Stack.Screen name="whats-new" />
        </Stack>
      </KeyboardAvoidingView>
      {hideBottomNav ? null : <PersistentBottomNav />}
      {tutorialVisible ? <GuidedTutorial visible step={tutorialStep} onStepChange={setTutorialStep} onFinish={finishTutorial} onSkip={skipTutorial} /> : null}
      {whatsNewVisible ? <WhatsNewModal visible release={currentReleaseNotes} onDismiss={dismissWhatsNew} /> : null}
    </View>
  );
}

function UpdateStartupScreen({ phase }: { phase: Exclude<UpdateStartupPhase, 'ready'> }) {
  const isDownloading = phase === 'downloading';
  return (
    <View style={styles.updateScreen}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color="#D7B45A" />
      <Text style={styles.updateEyebrow}>GO MELANATED</Text>
      <Text style={styles.updateTitle}>{isDownloading ? 'Updating your trail…' : 'Getting the trail ready…'}</Text>
      <Text style={styles.updateCopy}>
        {isDownloading ? 'Loading the latest app experience.' : 'Checking for the latest experience.'}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [updatePhase, setUpdatePhase] = useState<UpdateStartupPhase>('checking');
  const startupCheckStartedRef = useRef(false);

  useEffect(() => {
    logStartupStage('root-mounted');
    if (startupCheckStartedRef.current) return;
    startupCheckStartedRef.current = true;

    let active = true;

    async function runStartupUpdateCheck() {
      if (!Updates.isEnabled) {
        if (active) setUpdatePhase('ready');
        return;
      }

      logStartupStage('update-check');
      try {
        const result = await withStartupTimeout(
          Updates.checkForUpdateAsync(),
          'Update check',
          UPDATE_NETWORK_TIMEOUT_MS,
        );

        if (!result.isAvailable) {
          if (active) setUpdatePhase('ready');
          return;
        }

        if (active) setUpdatePhase('downloading');
        logStartupStage('update-fetch');
        const fetched = await withStartupTimeout(
          Updates.fetchUpdateAsync(),
          'Update download',
          UPDATE_NETWORK_TIMEOUT_MS,
        );

        if (fetched.isNew) {
          logStartupStage('update-reload');
          await Updates.reloadAsync();
          return;
        }

        if (active) setUpdatePhase('ready');
      } catch (error) {
        console.warn('[updates] Unable to apply OTA update', error);
        if (active) setUpdatePhase('ready');
      }
    }

    void runStartupUpdateCheck();
    return () => {
      active = false;
    };
  }, []);

  if (updatePhase !== 'ready') {
    return <UpdateStartupScreen phase={updatePhase} />;
  }

  return <AuthProvider><AppShell /></AuthProvider>;
}

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: '#0F1713' }, stackArea: { flex: 1 },
  updateScreen: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 10 },
  updateEyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 12 },
  updateTitle: { color: '#FFF8E8', fontSize: 26, lineHeight: 31, fontWeight: '900', textAlign: 'center' },
  updateCopy: { color: '#8F9A93', fontSize: 14, textAlign: 'center' },
});