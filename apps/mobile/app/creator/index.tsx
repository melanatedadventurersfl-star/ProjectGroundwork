import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

type CreatorProfile = {
  display_name: string | null;
  username: string | null;
  platform_role: string | null;
};

type ToolRow = {
  title: string;
  subtitle: string;
  route: string;
  icon: AppIconName;
};

const tools: ToolRow[] = [
  { title: 'Members & Roles', subtitle: 'Manage member, host, and admin access.', route: '/creator/members', icon: 'community' },
  { title: 'Passport & Recognition', subtitle: 'Change ranks, badges, stamps, and review Founder history.', route: '/creator/passport', icon: 'passport' },
  { title: 'Adventures & Events', subtitle: 'Review and operate the adventure catalog.', route: '/adventures', icon: 'adventure' },
  { title: 'Groups', subtitle: 'Open community group management.', route: '/groups', icon: 'connections' },
  { title: 'App Media', subtitle: 'Publish verified imagery used throughout Melanated.', route: '/admin-media', icon: 'photos' },
  { title: 'Support', subtitle: 'Open the support area for member issues.', route: '/member/support', icon: 'support' },
  { title: 'Admin Profile', subtitle: 'Open the protected administrative identity.', route: '/admin', icon: 'profile' },
];

export default function CreatorConsoleScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!session?.user.id) {
        if (active) setLoading(false);
        return;
      }
      const [adminResult, profileResult] = await Promise.all([
        supabase.rpc('is_platform_admin'),
        supabase.from('profiles').select('display_name,username,platform_role').eq('id', session.user.id).single(),
      ]);
      if (!active) return;
      if (adminResult.error || profileResult.error) {
        setError(adminResult.error?.message ?? profileResult.error?.message ?? 'Unable to verify creator access.');
        setLoading(false);
        return;
      }
      const nextProfile = profileResult.data as CreatorProfile;
      setProfile(nextProfile);
      setAuthorized(adminResult.data === true && nextProfile.platform_role === 'founder');
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [session?.user.id]);

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#F5C341" size="large" /><Text style={styles.muted}>Verifying creator access…</Text></View></SafeAreaView>;

  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.denied}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><View style={styles.deniedCard}><Text style={styles.eyebrow}>PROTECTED PLATFORM AREA</Text><Text style={styles.title}>Creator access required</Text><Text style={styles.muted}>This console is limited to the platform founder account backed by the private master-account record.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></View></SafeAreaView>;

  const name = profile?.display_name?.trim() || profile?.username?.trim() || 'Founder';

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    <View style={styles.hero}>
      <View style={styles.founderBadge}><Text style={styles.founderBadgeText}>FOUNDER</Text></View>
      <Text style={styles.title}>Creator Console</Text>
      <Text style={styles.subtitle}>{name}, this is the protected operating center for Melanated.</Text>
    </View>

    <View style={styles.securityCard}>
      <View style={styles.securityDot} />
      <View style={styles.securityCopy}><Text style={styles.securityTitle}>Master authorization active</Text><Text style={styles.muted}>The console requires both the private singleton master account and the protected founder profile marker.</Text></View>
    </View>

    <Text style={styles.sectionTitle}>PLATFORM OPERATIONS</Text>
    <View style={styles.card}>{tools.map((tool, index) => <Pressable key={tool.title} style={[styles.row,index>0&&styles.divider]} onPress={() => router.push(tool.route as never)}>
      <View style={styles.rowLead}><AppIcon name={tool.icon} color="#F5C341" size={22}/><View style={styles.rowCopy}><Text style={styles.rowTitle}>{tool.title}</Text><Text style={styles.rowSubtitle}>{tool.subtitle}</Text></View></View><AppIcon name="chevron-forward" color="#D7B45A" size={20}/>
    </Pressable>)}</View>

    <Text style={styles.note}>Code deployment, database migrations, secrets, and build credentials remain outside the mobile app by design.</Text>
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:60},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:24},denied:{flex:1,padding:20},deniedCard:{marginTop:36,backgroundColor:'#211817',borderWidth:1,borderColor:'#5A3C35',borderRadius:20,padding:20,gap:8},back:{color:'#D7B45A',fontSize:16,fontWeight:'900'},eyebrow:{color:'#F2C55C',fontSize:11,fontWeight:'900',letterSpacing:1.1},title:{color:'#FFF8E8',fontSize:32,fontWeight:'900',lineHeight:38},subtitle:{color:'#A9B4AD',fontSize:14,lineHeight:20},muted:{color:'#93A097',fontSize:13,lineHeight:19},error:{color:'#FFB4A9',fontSize:12,lineHeight:18},hero:{marginTop:18,marginBottom:18,gap:6},founderBadge:{alignSelf:'flex-start',borderRadius:999,paddingHorizontal:11,paddingVertical:5,backgroundColor:'#3A311B',borderWidth:1,borderColor:'#8D7133'},founderBadgeText:{color:'#F5C341',fontSize:10,fontWeight:'900',letterSpacing:1.1},securityCard:{flexDirection:'row',gap:10,backgroundColor:'#121D17',borderWidth:1,borderColor:'#31483A',borderRadius:16,padding:14,marginBottom:24},securityDot:{width:10,height:10,borderRadius:5,backgroundColor:'#9BE33D',marginTop:4},securityCopy:{flex:1,gap:3},securityTitle:{color:'#EAF1EC',fontSize:13,fontWeight:'900'},sectionTitle:{color:'#8F9A93',fontSize:11,fontWeight:'900',letterSpacing:1,marginBottom:8},card:{backgroundColor:'#17211C',borderRadius:18,borderWidth:1,borderColor:'#28372F',overflow:'hidden'},row:{minHeight:74,paddingHorizontal:15,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},divider:{borderTopWidth:1,borderTopColor:'#28372F'},rowLead:{flex:1,flexDirection:'row',alignItems:'center',gap:12},rowCopy:{flex:1,gap:3},rowTitle:{color:'#FFF8E8',fontSize:15,fontWeight:'900'},rowSubtitle:{color:'#87958D',fontSize:12,lineHeight:17},note:{color:'#6F7D75',fontSize:11,lineHeight:17,textAlign:'center',marginTop:18}});