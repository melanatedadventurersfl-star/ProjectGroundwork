import * as Updates from 'expo-updates';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { startGuidedTutorial } from '../../src/onboarding/tutorialController';
import { currentReleaseNotes } from '../../src/updates/releaseNotes';
import { hasSeenRelease } from '../../src/updates/releasePreference';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

const sections: readonly [string, readonly [string, string, AppIconName][]][] = [
  ['Account', [
    ['Edit Profile','/member/profile?edit=1','profile'],
    ['Profile & Privacy','/member/privacy','privacy'],
    ['Invite Friends','/member/invites','connections'],
    ['Notifications','/notifications','notifications'],
    ['Weather & Location','/member/weather','weather'],
    ['App Permissions','/member/permissions','privacy'],
    ['Delete Account','/delete-account','privacy'],
  ]],
  ['Membership', [
    ['Go+ Membership','/member/go-plus','badge'],
    ['Trips & Payments','/member/trips','trips'],
    ['Trail Family','/member/trail-family','community'],
    ['Trailmates & Crew','/circles','connections'],
  ]],
  ['Help', [
    ['Trail Guide','/trail-guide','guide'],
    ['Privacy Policy','/privacy-policy','privacy'],
    ['Community Guidelines','/community-guidelines','privacy'],
    ['Replay Tutorial','tutorial://replay','guide'],
    ['Support','/member/support','support'],
    ['About Go Melanated','/about','about'],
  ]],
] as const;

export default function MenuScreen() {
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const [inviteCount, setInviteCount] = useState<number | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const gitSha = process.env.EXPO_PUBLIC_GIT_SHA?.slice(0, 8);
  const updateId = Updates.updateId?.slice(0, 8);
  const runtimeVersion = Updates.runtimeVersion || 'embedded';
  const showPreviewBuild = process.env.EXPO_PUBLIC_APP_ENV === 'preview';

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
    setSigningOut(true); setError('');
    try { await signOut(); router.replace('/'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to sign out.'); }
    finally { setSigningOut(false); }
  }

  function openMenuRoute(route: string) {
    if (route === 'tutorial://replay') { startGuidedTutorial(); return; }
    router.push(route as never);
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MEMBER HUB</Text><Text style={styles.title}>Menu</Text>

    {showWhatsNew ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Updates</Text>
      <View style={[styles.card, styles.updateCard]}>
        <Pressable style={styles.row} onPress={()=>openMenuRoute('/whats-new')}>
          <View style={styles.rowLead}><AppIcon name="guide" color="#D7B45A" size={21} /><View><Text style={styles.rowTitle}>What’s New</Text><Text style={styles.updateMeta}>NEW UPDATE</Text></View></View>
          <AppIcon name="chevron-forward" color="#D7B45A" size={20} />
        </Pressable>
      </View>
    </View> : null}

    {sections.map(([title, rows]) => <View key={title} style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.card}>
      {rows.map(([label, route, icon], index) => {
        const rowLabel = label === 'Invite Friends' && inviteCount !== null ? `${label} · ${inviteCount} available` : label;
        return <Pressable key={label} style={[styles.row,index>0&&styles.divider]} onPress={()=>openMenuRoute(route)}><View style={styles.rowLead}><AppIcon name={icon} color="#F6F4EE" size={21} /><Text style={styles.rowTitle}>{rowLabel}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={20} /></Pressable>;
      })}
    </View></View>)}

    {isFounder ? <View style={styles.section}><Text style={styles.sectionTitle}>Creator</Text><View style={[styles.card,styles.creatorCard]}><Pressable style={styles.row} onPress={()=>openMenuRoute('/creator')}><View style={styles.rowLead}><AppIcon name="badge" color="#F5C341" size={21} /><View><Text style={styles.rowTitle}>Creator Console</Text><Text style={styles.creatorMeta}>FOUNDER ACCESS</Text></View></View><AppIcon name="chevron-forward" color="#F5C341" size={20} /></Pressable></View></View> : null}

    {isPlatformAdmin ? <View style={styles.section}><Text style={styles.sectionTitle}>Admin</Text><View style={styles.card}>
      <Pressable style={styles.row} onPress={()=>openMenuRoute('/admin')}><View style={styles.rowLead}><AppIcon name="profile" color="#F6F4EE" size={21} /><Text style={styles.rowTitle}>Admin Profile</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={20} /></Pressable>
      <Pressable style={[styles.row,styles.divider]} onPress={()=>openMenuRoute('/onboarding-v2')}><View style={styles.rowLead}><AppIcon name="guide" color="#F6F4EE" size={21} /><View><Text style={styles.rowTitle}>Replay First-Run Onboarding</Text><Text style={styles.creatorMeta}>ADMIN TEST ONLY</Text></View></View><AppIcon name="chevron-forward" color="#D7B45A" size={20} /></Pressable>
      <Pressable style={[styles.row,styles.divider]} onPress={()=>openMenuRoute('/admin-media')}><View style={styles.rowLead}><AppIcon name="guide" color="#F6F4EE" size={21} /><Text style={styles.rowTitle}>App Media</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={20} /></Pressable>
    </View></View> : null}

    {showPreviewBuild ? <View style={styles.buildCard}><Text style={styles.buildLabel}>PREVIEW BUILD</Text><Text style={styles.buildValue}>Main {gitSha || 'unknown'} · OTA {updateId || 'embedded'}</Text><Text style={styles.buildMeta}>Runtime {runtimeVersion}</Text></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable style={styles.signOut} disabled={signingOut} onPress={()=>void handleSignOut()}><Text style={styles.signOutText}>{signingOut?'Signing out…':'Sign Out'}</Text></Pressable>
    <Text style={styles.signOutHelp}>Use Sign Out when switching test accounts. Your saved Supabase session is cleared from this device.</Text>
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:54},eyebrow:{color:'#D7B45A',fontWeight:'900',letterSpacing:1.1,fontSize:11},title:{color:'#FFF8E8',fontSize:36,fontWeight:'900',marginTop:4,marginBottom:22},section:{marginBottom:20},sectionTitle:{color:'#8F9A93',fontSize:12,fontWeight:'900',textTransform:'uppercase',letterSpacing:1,marginBottom:8},card:{backgroundColor:'#17211C',borderRadius:16,borderWidth:1,borderColor:'#26332C',overflow:'hidden'},updateCard:{borderColor:'#6B5729',backgroundColor:'#1D2117'},creatorCard:{borderColor:'#6B5729',backgroundColor:'#1D2117'},row:{minHeight:56,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},rowLead:{flexDirection:'row',alignItems:'center',gap:12,flex:1},divider:{borderTopWidth:1,borderTopColor:'#26332C'},rowTitle:{color:'#FFF8E8',fontSize:16,fontWeight:'700'},updateMeta:{color:'#D7B45A',fontSize:9,fontWeight:'900',letterSpacing:.8,marginTop:2},creatorMeta:{color:'#F5C341',fontSize:9,fontWeight:'900',letterSpacing:.8,marginTop:2},buildCard:{backgroundColor:'#131D18',borderRadius:14,borderWidth:1,borderColor:'#33463B',padding:13,marginBottom:16},buildLabel:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},buildValue:{color:'#FFF8E8',fontSize:13,fontWeight:'800',marginTop:4},buildMeta:{color:'#7F8B83',fontSize:11,marginTop:3},signOut:{borderWidth:1,borderColor:'#77534D',backgroundColor:'#211817',borderRadius:14,padding:15,alignItems:'center',marginTop:2},signOutText:{color:'#FFB4A9',fontWeight:'900',fontSize:16},signOutHelp:{color:'#7F8B83',fontSize:12,lineHeight:18,marginTop:8},error:{color:'#FFB4A9',marginBottom:10}
});