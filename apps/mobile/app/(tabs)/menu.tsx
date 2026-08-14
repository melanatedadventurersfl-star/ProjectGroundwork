import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

const sections: readonly [string, readonly [string, string, AppIconName][]][] = [
  ['Account', [
    ['Edit Profile','/member/profile?edit=1','profile'],
    ['Profile & Privacy','/member/profile','privacy'],
    ['Notifications','/notifications','notifications'],
    ['Weather & Location','/member/weather','weather'],
  ]],
  ['Membership', [
    ['Trips & Payments','/member/trips','trips'],
    ['Trail Family','/member/trail-family','community'],
    ['Connections','/connections','connections'],
  ]],
  ['Help', [
    ['App Guide · How It Works','/guide','guide'],
    ['Support','/member','support'],
    ['About Melanated Adventurers','/about','about'],
  ]],
] as const;

export default function MenuScreen() {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const gitSha = process.env.EXPO_PUBLIC_GIT_SHA?.slice(0, 8);
  const updateId = Updates.updateId?.slice(0, 8);
  const runtimeVersion = Updates.runtimeVersion || 'embedded';
  const showPreviewBuild = process.env.EXPO_PUBLIC_APP_ENV === 'preview';

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

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MEMBER HUB</Text><Text style={styles.title}>Menu</Text>
    {sections.map(([title, rows]) => <View key={title} style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.card}>
      {rows.map(([label, route, icon], index) => <Pressable key={label} style={[styles.row,index>0&&styles.divider]} onPress={()=>router.push(route as never)}><View style={styles.rowLead}><AppIcon name={icon} color="#F6F4EE" size={21} /><Text style={styles.rowTitle}>{label}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={20} /></Pressable>)}
    </View></View>)}
    {showPreviewBuild ? <View style={styles.buildCard}>
      <Text style={styles.buildLabel}>PREVIEW BUILD</Text>
      <Text style={styles.buildValue}>Main {gitSha || 'unknown'} · OTA {updateId || 'embedded'}</Text>
      <Text style={styles.buildMeta}>Runtime {runtimeVersion}</Text>
    </View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable style={styles.signOut} disabled={signingOut} onPress={()=>void handleSignOut()}><Text style={styles.signOutText}>{signingOut?'Signing out…':'Sign Out'}</Text></Pressable>
    <Text style={styles.signOutHelp}>Use Sign Out when switching test accounts. Your saved Supabase session is cleared from this device.</Text>
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:54},eyebrow:{color:'#D7B45A',fontWeight:'900',letterSpacing:1.1,fontSize:11},title:{color:'#FFF8E8',fontSize:36,fontWeight:'900',marginTop:4,marginBottom:22},section:{marginBottom:20},sectionTitle:{color:'#8F9A93',fontSize:12,fontWeight:'900',textTransform:'uppercase',letterSpacing:1,marginBottom:8},card:{backgroundColor:'#17211C',borderRadius:16,borderWidth:1,borderColor:'#26332C',overflow:'hidden'},row:{minHeight:56,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},rowLead:{flexDirection:'row',alignItems:'center',gap:12,flex:1},divider:{borderTopWidth:1,borderTopColor:'#26332C'},rowTitle:{color:'#FFF8E8',fontSize:16,fontWeight:'700'},buildCard:{backgroundColor:'#131D18',borderRadius:14,borderWidth:1,borderColor:'#33463B',padding:13,marginBottom:16},buildLabel:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},buildValue:{color:'#FFF8E8',fontSize:13,fontWeight:'800',marginTop:4},buildMeta:{color:'#7F8B83',fontSize:11,marginTop:3},signOut:{borderWidth:1,borderColor:'#77534D',backgroundColor:'#211817',borderRadius:14,padding:15,alignItems:'center',marginTop:2},signOutText:{color:'#FFB4A9',fontWeight:'900',fontSize:16},signOutHelp:{color:'#7F8B83',fontSize:12,lineHeight:18,marginTop:8},error:{color:'#FFB4A9',marginBottom:10}});
