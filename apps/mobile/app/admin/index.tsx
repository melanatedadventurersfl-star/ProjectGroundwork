import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { getBuildFingerprint } from '../../src/updates/buildInfo';

type AdminProfile = { display_name: string | null; username: string | null; avatar_url: string | null; home_city: string | null; home_state: string | null; platform_role: string | null };

export default function AdminProfileScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [error, setError] = useState('');
  const buildFingerprint = useMemo(() => getBuildFingerprint(), []);

  useEffect(() => {
    let active = true;
    async function loadAdminProfile() {
      if (!session?.user.id) { if (active) { setAuthorized(false); setLoading(false); } return; }
      setLoading(true); setError('');
      const [adminResult, profileResult] = await Promise.all([
        supabase.rpc('is_platform_admin'),
        supabase.from('profiles').select('display_name,username,avatar_url,home_city,home_state,platform_role').eq('id', session.user.id).single(),
      ]);
      if (!active) return;
      if (adminResult.error) { setError(adminResult.error.message); setAuthorized(false); setLoading(false); return; }
      const isAdmin = adminResult.data === true;
      setAuthorized(isAdmin);
      if (!isAdmin) { setProfile(null); setLoading(false); return; }
      if (profileResult.error) setError(profileResult.error.message); else setProfile(profileResult.data as AdminProfile);
      setLoading(false);
    }
    void loadAdminProfile();
    return () => { active = false; };
  }, [session?.user.id]);

  const displayName = profile?.display_name?.trim() || profile?.username?.trim() || 'Administrator';
  const initials = useMemo(() => { const parts = displayName.split(/\s+/).filter(Boolean); const first = parts[0]?.[0] ?? ''; const last = parts[parts.length - 1]?.[0] ?? ''; return (parts.length > 1 ? `${first}${last}` : displayName.slice(0, 2)).toUpperCase(); }, [displayName]);
  const handle = profile?.username ? `@${profile.username.replace(/^@/, '')}` : session?.user.email ?? 'Melanated administrator';
  const location = [profile?.home_city, profile?.home_state].filter(Boolean).join(', ');

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.loadingText}>Checking admin access…</Text></View></SafeAreaView>;
  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.deniedWrap}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Back</Text></Pressable><View style={styles.deniedCard}><Text style={styles.deniedEyebrow}>PROTECTED AREA</Text><Text style={styles.deniedTitle}>Admin access required</Text><Text style={styles.deniedCopy}>This profile is only available to accounts authorized by the platform security role.</Text>{error ? <Text style={styles.errorText}>{error}</Text> : null}</View></View></SafeAreaView>;

  const toolRows = [
    { title: 'Community Safety', subtitle: 'Open reports, escalations, appeals, restrictions, suspensions, and bans in one control room.', route: '/admin/community-safety' },
    { title: 'Moderation Queue', subtitle: 'Review newly reported posts and replies and take enforcement action.', route: '/admin/moderation' },
    { title: 'Members with Violations', subtitle: 'See everyone with moderation history, warnings, restrictions, suspensions, or bans.', route: '/admin/violations' },
    { title: 'Moderation Appeals', subtitle: 'Review member appeals and uphold or reverse enforcement decisions.', route: '/admin/moderation-appeals' },
    { title: 'Build Status', subtitle: 'Verify version, build, commit, update channel, and whether a newer update exists.', route: '/build-status' },
    { title: 'App Media', subtitle: 'Publish verified imagery used across the app.', route: '/admin-media' },
  ];

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹ Back</Text></Pressable>
    <View style={styles.header}><Text style={styles.eyebrow}>ADMINISTRATION</Text><Text style={styles.title}>Admin Profile</Text><Text style={styles.subtitle}>Your Melanated member identity with protected platform access.</Text></View>
    <View style={styles.profileCard}><View style={styles.identityRow}><View style={styles.avatar}>{profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarInitials}>{initials}</Text>}</View><View style={styles.identityCopy}><View style={styles.badge}><Text style={styles.badgeText}>PLATFORM ADMIN</Text></View><Text style={styles.name} numberOfLines={1}>{displayName}</Text><Text style={styles.handle} numberOfLines={1}>{handle}</Text>{location ? <Text style={styles.location}>{location}</Text> : null}</View></View><View style={styles.securityStrip}><View style={styles.securityDot} /><View style={styles.securityCopy}><Text style={styles.securityTitle}>Protected administrator access</Text><Text style={styles.securityBody}>Role changes are locked behind Supabase authorization and cannot be changed from this profile.</Text></View></View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>ADMIN TOOLS</Text><View style={styles.card}>{toolRows.map((item, index) => <Pressable key={item.route} style={[styles.row, index > 0 && styles.divider]} onPress={() => router.push(item.route as never)}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowSubtitle}>{item.subtitle}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>MEMBER PROFILE</Text><View style={styles.card}><Pressable style={styles.row} onPress={() => router.push('/member/profile' as never)}><View style={styles.rowCopy}><Text style={styles.rowTitle}>View Profile</Text><Text style={styles.rowSubtitle}>See your member-facing profile and activity.</Text></View><Text style={styles.chevron}>›</Text></Pressable><Pressable style={[styles.row, styles.divider]} onPress={() => router.push('/member/profile?edit=1' as never)}><View style={styles.rowCopy}><Text style={styles.rowTitle}>Edit Member Profile</Text><Text style={styles.rowSubtitle}>Update public profile details without changing admin access.</Text></View><Text style={styles.chevron}>›</Text></Pressable></View></View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
    <View style={styles.buildFooter}><Text style={styles.buildFooterLabel}>RUNNING</Text><Text style={styles.buildFooterValue}>{buildFingerprint}</Text></View><Text style={styles.note}>Admin status is evaluated from the signed-in account every time this screen loads.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 54 }, centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: '#A9B4AD', fontSize: 14, fontWeight: '700' }, deniedWrap: { flex: 1, padding: 20 }, backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 }, backText: { color: '#D7B45A', fontSize: 16, fontWeight: '800' }, deniedCard: { marginTop: 34, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#523B35', backgroundColor: '#211817', gap: 8 }, deniedEyebrow: { color: '#FFB4A9', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, deniedTitle: { color: '#FFF8E8', fontSize: 25, fontWeight: '900' }, deniedCopy: { color: '#B7A7A2', fontSize: 14, lineHeight: 20 }, header: { marginTop: 8, marginBottom: 18, gap: 4 }, eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -0.5 }, subtitle: { color: '#A9B4AD', fontSize: 14, lineHeight: 20 }, profileCard: { borderRadius: 22, borderWidth: 1, borderColor: '#3C4B43', backgroundColor: '#17211C', padding: 16, gap: 16, marginBottom: 24 }, identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#243229', borderWidth: 2, borderColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, avatarInitials: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' }, identityCopy: { flex: 1, minWidth: 0, gap: 3 }, badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#2C341D', borderWidth: 1, borderColor: '#66752F', marginBottom: 2 }, badgeText: { color: '#CDE96D', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, name: { color: '#FFF8E8', fontSize: 23, lineHeight: 27, fontWeight: '900' }, handle: { color: '#D7B45A', fontSize: 14, fontWeight: '800' }, location: { color: '#8F9A93', fontSize: 12, fontWeight: '700', marginTop: 1 }, securityStrip: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#101914', borderWidth: 1, borderColor: '#2B3D32' }, securityDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#9BE33D', marginTop: 4 }, securityCopy: { flex: 1, gap: 2 }, securityTitle: { color: '#E8F1EA', fontSize: 12, fontWeight: '900' }, securityBody: { color: '#8D9A92', fontSize: 11, lineHeight: 16 }, section: { marginBottom: 20 }, sectionTitle: { color: '#8F9A93', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }, card: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#26332C', overflow: 'hidden' }, row: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, divider: { borderTopWidth: 1, borderTopColor: '#26332C' }, rowCopy: { flex: 1, gap: 3 }, rowTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '800' }, rowSubtitle: { color: '#87938C', fontSize: 12, lineHeight: 17 }, chevron: { color: '#D7B45A', fontSize: 28, lineHeight: 28, fontWeight: '500' }, buildFooter: { alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: '#26332C', paddingTop: 15, marginTop: 2 }, buildFooterLabel: { color: '#718078', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, buildFooterValue: { color: '#9EAAA3', fontSize: 11, fontWeight: '800' }, note: { color: '#718078', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8 }, errorText: { color: '#FFB4A9', fontSize: 12, lineHeight: 18 },
});
