import * as Updates from 'expo-updates';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { setPendingTrailheadTooltip } from '../../src/onboarding/trailheadExperience';
import { resetTrailheadProgress } from '../../src/onboarding/trailheadProgress';
import { startGuidedTutorial } from '../../src/onboarding/tutorialController';
import { resetGuidedTutorial } from '../../src/onboarding/tutorialPreference';
import { getBuildInfo } from '../../src/updates/buildInfo';
import { currentReleaseNotes } from '../../src/updates/releaseNotes';
import { hasSeenRelease } from '../../src/updates/releasePreference';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

type MenuRow = {
  label: string;
  route?: string;
  icon: AppIconName;
  meta?: string;
  badge?: string;
  action?: 'tutorial' | 'reset-tutorial' | 'check-update' | 'install-update' | 'sign-out';
  destructive?: boolean;
};

type UpdateState = 'idle' | 'checking' | 'current' | 'available' | 'installing' | 'error';

export default function MenuScreen() {
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const [inviteCount, setInviteCount] = useState<number | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateMessage, setUpdateMessage] = useState('');
  const buildInfo = useMemo(() => getBuildInfo(), []);

  const displayName = useMemo(() => {
    const metadata = session?.user.user_metadata ?? {};
    return metadata.full_name || metadata.display_name || metadata.name || session?.user.email?.split('@')[0] || 'Member';
  }, [session?.user.email, session?.user.user_metadata]);

  const initials = useMemo(() => {
    const parts = String(displayName).trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GM';
  }, [displayName]);

  const refreshWhatsNew = useCallback(() => {
    try {
      setShowWhatsNew(!hasSeenRelease(currentReleaseNotes.id));
    } catch (caught) {
      console.warn('[updates] Unable to read release-note preference', caught);
      setShowWhatsNew(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    refreshWhatsNew();
  }, [refreshWhatsNew]));

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;

    void Promise.all([
      supabase.from('member_invites').select('id', { count: 'exact', head: true }).eq('sender_profile_id', session.user.id).eq('status', 'available'),
      supabase.rpc('is_platform_admin'),
      supabase.from('profiles').select('platform_role').eq('id', session.user.id).single(),
    ]).then(([inviteResult, adminResult, profileResult]) => {
      if (!active) return;
      if (inviteResult.error) console.warn('Unable to load invite count', inviteResult.error.message);
      else setInviteCount(inviteResult.count ?? 0);

      if (adminResult.error) console.warn('Unable to resolve admin status', adminResult.error.message);
      else {
        const admin = adminResult.data === true;
        setIsPlatformAdmin(admin);
        setIsFounder(admin && !profileResult.error && profileResult.data?.platform_role === 'founder');
      }
    });

    return () => { active = false; };
  }, [session?.user.id]);

  async function handleSignOut() {
    setSigningOut(true);
    setError('');
    try {
      await signOut();
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign out.');
    } finally {
      setSigningOut(false);
    }
  }

  async function checkForUpdate() {
    setError('');
    if (!Updates.isEnabled) {
      setUpdateState('error');
      setUpdateMessage('Updates are unavailable in this build.');
      return;
    }

    setUpdateState('checking');
    setUpdateMessage('Checking for the latest Go Melanated update…');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setUpdateState('available');
        setUpdateMessage('An update is ready to install.');
      } else {
        setUpdateState('current');
        setUpdateMessage('You’re on the latest version.');
      }
    } catch (caught) {
      setUpdateState('error');
      setUpdateMessage(caught instanceof Error ? caught.message : 'Unable to check for updates right now.');
    }
  }

  async function installUpdate() {
    setUpdateState('installing');
    setUpdateMessage('Downloading update…');
    try {
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) {
        setUpdateMessage('Update ready. Restarting Go Melanated…');
        await Updates.reloadAsync();
        return;
      }
      setUpdateState('current');
      setUpdateMessage('You’re already on the latest version.');
    } catch (caught) {
      setUpdateState('error');
      setUpdateMessage(caught instanceof Error ? caught.message : 'Unable to install the update.');
    }
  }

  function openRoute(route: string) {
    router.push(route as never);
  }

  async function handleRow(row: MenuRow) {
    if (row.action === 'tutorial') {
      startGuidedTutorial();
      return;
    }
    if (row.action === 'reset-tutorial') {
      resetTrailheadProgress();
      resetGuidedTutorial();
      setPendingTrailheadTooltip(null);
      startGuidedTutorial();
      return;
    }
    if (row.action === 'check-update') {
      await checkForUpdate();
      return;
    }
    if (row.action === 'install-update') {
      await installUpdate();
      return;
    }
    if (row.action === 'sign-out') {
      await handleSignOut();
      return;
    }
    if (row.route) openRoute(row.route);
  }

  const yourGoRows: MenuRow[] = [
    { label: 'Go+ Membership', route: '/member/go-plus', icon: 'badge' },
    { label: 'Trips & Payments', route: '/member/trips', icon: 'trips', meta: 'Bookings, tickets & receipts' },
    { label: 'Host an Outing', route: '/host', icon: 'guide', meta: 'Create, promote & manage community outings' },
    { label: 'Trail Family', route: '/member/trail-family', icon: 'community' },
    { label: 'Trailmates & Crew', route: '/circles', icon: 'connections' },
    { label: 'Invite Friends', route: '/member/invites', icon: 'connections', badge: inviteCount === null ? undefined : String(inviteCount) },
  ];

  const preferenceRows: MenuRow[] = [
    { label: 'Profile & Privacy', route: '/member/privacy', icon: 'profile' },
    { label: 'Notifications', route: '/notifications', icon: 'notifications' },
    { label: 'Weather & Location', route: '/member/weather', icon: 'weather' },
    { label: 'App Permissions', route: '/member/permissions', icon: 'privacy' },
  ];

  const helpRows: MenuRow[] = [
    { label: 'Help Center', route: '/member/support', icon: 'support' },
    { label: 'Community Guidelines', route: '/community-guidelines', icon: 'guide' },
    { label: 'Privacy Policy', route: '/privacy-policy', icon: 'privacy' },
    { label: 'Trailhead', icon: 'guide', action: 'tutorial', meta: 'Review your starter journey' },
    { label: 'Reset Trailhead', icon: 'guide', action: 'reset-tutorial', meta: 'Restart all six setup steps' },
  ];

  const appRows: MenuRow[] = [
    { label: 'What’s New', route: '/whats-new', icon: 'guide', badge: showWhatsNew ? 'NEW' : undefined },
    { label: 'About Go Melanated', route: '/about', icon: 'about' },
  ];

  const accountRows: MenuRow[] = [
    { label: signingOut ? 'Signing out…' : 'Sign Out', icon: 'profile', action: 'sign-out' },
    { label: 'Delete Account', route: '/delete-account', icon: 'privacy', destructive: true, meta: 'This action cannot be undone.' },
  ];

  const updateBusy = updateState === 'checking' || updateState === 'installing';
  const updateActionLabel = updateState === 'available'
    ? 'Install Update'
    : updateState === 'checking'
      ? 'Checking…'
      : updateState === 'installing'
        ? 'Installing…'
        : 'Check for Updates';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>MEMBER HUB</Text>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.subtitle}>Your account, membership and Go Melanated settings.</Text>

        <Pressable style={styles.profileCard} onPress={() => openRoute('/member/profile')}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.memberLine}>
              <AppIcon name="badge" color="#D7B45A" size={16} />
              <Text style={styles.memberLabel}>Go Melanated Member</Text>
            </View>
          </View>
          <View style={styles.profileAction}>
            <Text style={styles.profileActionText}>View Profile</Text>
            <AppIcon name="chevron-forward" color="#D7B45A" size={17} />
          </View>
        </Pressable>

        {isPlatformAdmin ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isFounder ? 'Founder' : 'Admin'}</Text>
            <Pressable style={styles.founderCard} onPress={() => openRoute('/founder-tools')}>
              <View style={styles.founderIcon}><AppIcon name="badge" color="#F5C341" size={24} /></View>
              <View style={styles.founderCopy}>
                <Text style={styles.founderTitle}>{isFounder ? 'Founder Tools' : 'Admin Tools'}</Text>
                <Text style={styles.founderMeta}>Manage Go Melanated operations and content.</Text>
              </View>
              <AppIcon name="chevron-forward" color="#F5C341" size={20} />
            </Pressable>
            <View style={styles.restrictedLine}>
              <AppIcon name="privacy" color="#9B8140" size={13} />
              <Text style={styles.restrictedText}>Visible to authorized accounts only</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Update & Build</Text>
          <View style={styles.buildCard}>
            <View style={styles.buildHeader}>
              <View style={styles.buildHeaderCopy}>
                <Text style={styles.buildTitle}>Go Melanated {buildInfo.appVersion}</Text>
                <Text style={styles.buildMeta}>
                  Native {buildInfo.nativeBuildNumber} · CI {buildInfo.ciBuildNumber} · {buildInfo.activeSource.toUpperCase()}
                </Text>
              </View>
              <View style={styles.buildPill}>
                <Text style={styles.buildPillText}>{buildInfo.channel}</Text>
              </View>
            </View>

            <View style={styles.buildDetailRow}>
              <Text style={styles.buildDetailLabel}>Commit</Text>
              <Text style={styles.buildDetailValue}>{buildInfo.shortCommit || 'Unknown'}</Text>
            </View>
            <View style={styles.buildDetailRow}>
              <Text style={styles.buildDetailLabel}>Runtime</Text>
              <Text style={styles.buildDetailValue}>{buildInfo.runtimeVersion}</Text>
            </View>

            <Pressable
              disabled={updateBusy}
              style={[styles.updateButton, updateState === 'available' && styles.updateButtonReady]}
              onPress={() => void (updateState === 'available' ? installUpdate() : checkForUpdate())}
            >
              {updateBusy ? <ActivityIndicator size="small" color="#0B100D" /> : <AppIcon name="about" color="#0B100D" size={17} />}
              <Text style={styles.updateButtonText}>{updateActionLabel}</Text>
            </Pressable>

            {updateMessage ? <Text style={styles.buildStatus}>{updateMessage}</Text> : null}
          </View>
        </View>

        <MenuSection title="Your Go Melanated" rows={yourGoRows} onPress={handleRow} />
        <MenuSection title="Preferences" rows={preferenceRows} onPress={handleRow} />
        <MenuSection title="Help & Safety" rows={helpRows} onPress={handleRow} />
        <MenuSection title="App" rows={appRows} onPress={handleRow} />
        <MenuSection title="Account" rows={accountRows} onPress={handleRow} busy={signingOut} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.footer}>Go Melanated</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuSection({ title, rows, onPress, busy = false }: { title: string; rows: MenuRow[]; onPress: (row: MenuRow) => void | Promise<void>; busy?: boolean }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, index) => {
          const rowBusy = busy && (row.action === 'check-update' || row.action === 'install-update' || row.action === 'sign-out');
          return (
            <Pressable key={row.label} disabled={rowBusy} style={[styles.row, index > 0 && styles.divider]} onPress={() => void onPress(row)}>
              <View style={styles.rowLead}>
                <View style={styles.rowIcon}><AppIcon name={row.icon} color={row.destructive ? '#FF6B61' : '#F6F4EE'} size={20} /></View>
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.rowTitle, row.destructive && styles.destructiveText]}>{row.label}</Text>
                  {row.meta ? <Text style={styles.rowMeta}>{row.meta}</Text> : null}
                </View>
              </View>
              <View style={styles.rowTail}>
                {rowBusy ? <ActivityIndicator size="small" color="#D7B45A" /> : null}
                {!rowBusy && row.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{row.badge}</Text></View> : null}
                {!rowBusy ? <AppIcon name="chevron-forward" color={row.destructive ? '#FF6B61' : '#AEB8B2'} size={18} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 52 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.2, fontSize: 11 },
  title: { color: '#FFF8E8', fontSize: 38, lineHeight: 44, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A7B0AA', fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 18, maxWidth: 330 },
  profileCard: { minHeight: 102, borderRadius: 18, borderWidth: 1, borderColor: '#31533F', backgroundColor: '#11241A', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 24 },
  avatar: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: '#D7B45A', backgroundColor: '#1E3026', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  memberLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  memberLabel: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
  profileAction: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#886F31', borderRadius: 18, paddingHorizontal: 11, minHeight: 36 },
  profileActionText: { color: '#E5C66C', fontSize: 11, fontWeight: '900' },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.05, marginBottom: 8 },
  card: { backgroundColor: '#171D19', borderRadius: 16, borderWidth: 1, borderColor: '#2B332E', overflow: 'hidden' },
  row: { minHeight: 58, paddingHorizontal: 15, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: '#2B332E' },
  rowLead: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 11 },
  rowIcon: { width: 24, alignItems: 'center' },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '700' },
  rowMeta: { color: '#8F9A93', fontSize: 11, lineHeight: 15, marginTop: 2 },
  rowTail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 25, height: 25, borderRadius: 13, paddingHorizontal: 7, backgroundColor: '#443516', borderWidth: 1, borderColor: '#705920', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#E7C464', fontSize: 10, fontWeight: '900' },
  destructiveText: { color: '#FF746A' },
  buildCard: { borderRadius: 16, borderWidth: 1, borderColor: '#355342', backgroundColor: '#111C16', padding: 15 },
  buildHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  buildHeaderCopy: { flex: 1, minWidth: 0 },
  buildTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  buildMeta: { color: '#9EAAA3', fontSize: 11, lineHeight: 16, marginTop: 3 },
  buildPill: { borderRadius: 999, borderWidth: 1, borderColor: '#705920', backgroundColor: '#352B15', paddingHorizontal: 9, paddingVertical: 5 },
  buildPillText: { color: '#E7C464', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  buildDetailRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#243128' },
  buildDetailLabel: { color: '#78877E', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  buildDetailValue: { color: '#D8DFDA', fontSize: 11, fontWeight: '700' },
  updateButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingHorizontal: 14 },
  updateButtonReady: { backgroundColor: '#F5C341' },
  updateButtonText: { color: '#0B100D', fontSize: 13, fontWeight: '900' },
  buildStatus: { color: '#AAB5AE', fontSize: 11, lineHeight: 16, marginTop: 9, textAlign: 'center' },
  founderCard: { minHeight: 88, borderRadius: 16, borderWidth: 1, borderColor: '#8C6D28', backgroundColor: '#4A3716', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  founderIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#5D461A', alignItems: 'center', justifyContent: 'center' },
  founderCopy: { flex: 1 },
  founderTitle: { color: '#FFF3D1', fontSize: 17, fontWeight: '900' },
  founderMeta: { color: '#D6C59B', fontSize: 11, lineHeight: 16, marginTop: 2 },
  restrictedLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 },
  restrictedText: { color: '#9B8140', fontSize: 10, fontWeight: '700' },
  error: { color: '#FF8A80', fontSize: 12, marginTop: -8, marginBottom: 16 },
  footer: { color: '#637169', fontSize: 11, textAlign: 'center', marginTop: 2 },
});
