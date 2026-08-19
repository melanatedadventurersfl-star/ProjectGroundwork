import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';

type MemberRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  status: string | null;
  platform_role: string | null;
};

const assignableRoles = ['member','host','admin'] as const;

type AssignableRole = typeof assignableRoles[number];

export default function CreatorMembersScreen() {
  const { session } = useAuth();
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [rows,setRows]=useState<MemberRow[]>([]);
  const [query,setQuery]=useState('');
  const [busyId,setBusyId]=useState<string|null>(null);
  const [error,setError]=useState('');

  async function load() {
    if (!session?.user.id) { setLoading(false); return; }
    setLoading(true);setError('');
    const [adminResult, founderResult] = await Promise.all([
      supabase.rpc('is_platform_admin'),
      supabase.from('profiles').select('platform_role').eq('id',session.user.id).single(),
    ]);
    if (adminResult.error || founderResult.error || adminResult.data !== true || founderResult.data?.platform_role !== 'founder') {
      setAuthorized(false);setLoading(false);return;
    }
    setAuthorized(true);
    const { data, error: listError } = await supabase.from('profiles').select('id,display_name,username,email,status,platform_role').order('created_at',{ascending:false}).limit(100);
    if (listError) setError(listError.message); else setRows((data ?? []) as MemberRow[]);
    setLoading(false);
  }

  useEffect(()=>{void load()},[session?.user.id]);

  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    if(!needle)return rows;
    return rows.filter(row=>[row.display_name,row.username,row.email,row.platform_role,row.status].some(value=>value?.toLowerCase().includes(needle)));
  },[query,rows]);

  async function setRole(member:MemberRow, role:AssignableRole) {
    if(member.id===session?.user.id)return;
    setBusyId(member.id);setError('');
    const { error:updateError }=await supabase.from('profiles').update({platform_role:role}).eq('id',member.id);
    if(updateError)setError(updateError.message); else setRows(current=>current.map(row=>row.id===member.id?{...row,platform_role:role}:row));
    setBusyId(null);
  }

  function chooseRole(member:MemberRow) {
    if(member.id===session?.user.id)return;
    Alert.alert('Change platform role',member.display_name??member.username??member.email??'Member',[
      {text:'Cancel',style:'cancel'},
      ...assignableRoles.map(role=>({text:role.charAt(0).toUpperCase()+role.slice(1),onPress:()=>void setRole(member,role)})),
    ]);
  }

  async function toggleStatus(member:MemberRow) {
    if(member.id===session?.user.id)return;
    const next=member.status==='active'?'pending':'active';
    setBusyId(member.id);setError('');
    const { error:updateError }=await supabase.from('profiles').update({status:next}).eq('id',member.id);
    if(updateError)setError(updateError.message); else setRows(current=>current.map(row=>row.id===member.id?{...row,status:next}:row));
    setBusyId(null);
  }

  if(loading)return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#F5C341"/><Text style={styles.muted}>Loading member controls…</Text></View></SafeAreaView>;
  if(!authorized)return <SafeAreaView style={styles.safe}><View style={styles.denied}><Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Creator access required</Text><Text style={styles.muted}>Member-role controls are restricted to the founder account.</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Creator Console</Text></Pressable>
    <Text style={styles.eyebrow}>FOUNDER CONTROL</Text><Text style={styles.title}>Members & Roles</Text><Text style={styles.muted}>Promote trusted operators to admin, assign hosts, or return accounts to member access.</Text>
    <TextInput value={query} onChangeText={setQuery} autoCapitalize="none" placeholder="Search name, username, email, role…" placeholderTextColor="#66746B" style={styles.search}/>
    {error?<Text style={styles.error}>{error}</Text>:null}
    <View style={styles.list}>{filtered.map((member,index)=>{
      const isFounder=member.id===session?.user.id;
      const busy=busyId===member.id;
      return <View key={member.id} style={[styles.member,index>0&&styles.divider]}>
        <View style={styles.memberTop}><View style={styles.memberCopy}><Text style={styles.memberName}>{member.display_name??member.username??'Member'}</Text><Text style={styles.memberMeta}>{member.username?`@${member.username} · `:''}{member.email??'No email'}</Text></View>{isFounder?<View style={styles.founderPill}><Text style={styles.founderText}>FOUNDER</Text></View>:<View style={styles.rolePill}><Text style={styles.roleText}>{(member.platform_role??'member').toUpperCase()}</Text></View>}</View>
        <View style={styles.actions}>
          <Pressable disabled={busy||isFounder} style={[styles.action,(busy||isFounder)&&styles.disabled]} onPress={()=>chooseRole(member)}><Text style={styles.actionText}>{busy?'Updating…':'Change Role'}</Text></Pressable>
          <Pressable disabled={busy||isFounder} style={[styles.actionSecondary,(busy||isFounder)&&styles.disabled]} onPress={()=>void toggleStatus(member)}><Text style={styles.secondaryText}>{member.status==='active'?'Set Pending':'Activate'}</Text></Pressable>
        </View>
      </View>;
    })}</View>
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:70},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12},denied:{flex:1,padding:20,gap:12},back:{color:'#D7B45A',fontSize:16,fontWeight:'900',marginBottom:14},eyebrow:{color:'#D7B45A',fontSize:11,fontWeight:'900',letterSpacing:1.1},title:{color:'#FFF8E8',fontSize:31,fontWeight:'900',marginTop:4,marginBottom:6},muted:{color:'#96A39B',fontSize:13,lineHeight:19},search:{backgroundColor:'#17211C',borderWidth:1,borderColor:'#314139',borderRadius:14,color:'#FFF8E8',fontSize:14,paddingHorizontal:14,paddingVertical:13,marginTop:18,marginBottom:14},error:{color:'#FFB4A9',fontSize:12,lineHeight:18,marginBottom:10},list:{backgroundColor:'#17211C',borderWidth:1,borderColor:'#28372F',borderRadius:18,overflow:'hidden'},member:{padding:15,gap:12},divider:{borderTopWidth:1,borderTopColor:'#28372F'},memberTop:{flexDirection:'row',alignItems:'flex-start',gap:10},memberCopy:{flex:1,gap:3},memberName:{color:'#FFF8E8',fontSize:16,fontWeight:'900'},memberMeta:{color:'#829088',fontSize:11,lineHeight:16},rolePill:{borderRadius:999,backgroundColor:'#26372D',paddingHorizontal:9,paddingVertical:5},roleText:{color:'#D9E6DC',fontSize:9,fontWeight:'900',letterSpacing:.7},founderPill:{borderRadius:999,backgroundColor:'#3A311B',borderWidth:1,borderColor:'#8D7133',paddingHorizontal:9,paddingVertical:5},founderText:{color:'#F5C341',fontSize:9,fontWeight:'900',letterSpacing:.8},actions:{flexDirection:'row',gap:8},action:{flex:1,backgroundColor:'#F5C341',borderRadius:10,paddingVertical:10,alignItems:'center'},actionText:{color:'#17211C',fontSize:12,fontWeight:'900'},actionSecondary:{flex:1,borderWidth:1,borderColor:'#4C5B53',borderRadius:10,paddingVertical:10,alignItems:'center'},secondaryText:{color:'#FFF8E8',fontSize:12,fontWeight:'800'},disabled:{opacity:.45}});