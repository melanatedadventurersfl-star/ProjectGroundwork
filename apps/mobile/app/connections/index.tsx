import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../src/lib/supabase';

type ConnectionRow = {
  id: string;
  status: string;
  requester_id: string;
  addressee_id: string;
  other_id: string;
  display_name: string | null;
  username: string | null;
  home_city: string | null;
  home_state: string | null;
};

export default function ConnectionsScreen() {
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error('Sign in required.');
      const userId = userData.user.id;
      const { data: connections, error: connectionsError } = await supabase
        .from('member_connections')
        .select('id,status,requester_id,addressee_id,created_at')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (connectionsError) throw connectionsError;
      const raw = connections ?? [];
      const otherIds = [...new Set(raw.map((row) => row.requester_id === userId ? row.addressee_id : row.requester_id))];
      let profiles: any[] = [];
      if (otherIds.length) {
        const { data, error: profileError } = await supabase.from('community_profile_directory').select('*').in('id', otherIds);
        if (profileError) throw profileError;
        profiles = data ?? [];
      }
      const byId = new Map(profiles.map((profile) => [profile.id, profile]));
      setRows(raw.map((row) => {
        const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
        const profile = byId.get(otherId) ?? {};
        return { ...row, other_id: otherId, display_name: profile.display_name ?? null, username: profile.username ?? null, home_city: profile.home_city ?? null, home_state: profile.home_state ?? null };
      }));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load connections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function respond(id: string, status: 'accepted' | 'declined') {
    const { error: updateError } = await supabase.from('member_connections').update({ status }).eq('id', id);
    if (updateError) setError(updateError.message);
    else await load();
  }

  async function remove(id: string) {
    const { error: deleteError } = await supabase.from('member_connections').delete().eq('id', id);
    if (deleteError) setError(deleteError.message);
    else await load();
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>COMMUNITY</Text><Text style={styles.title}>Connections</Text>
    <Text style={styles.intro}>Approved connections make it easier to stay in touch without turning MA into a follower-count contest.</Text>
    {loading ? <ActivityIndicator color="#D7B45A" /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !rows.length ? <View style={styles.empty}><Text style={styles.cardTitle}>No connections yet</Text><Text style={styles.muted}>Open a member profile from Community to send a connection request.</Text></View> : null}
    {rows.map((row) => {
      const location = [row.home_city, row.home_state].filter(Boolean).join(', ');
      return <Pressable key={row.id} style={styles.card} onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: row.other_id } })}>
        <View style={styles.cardTop}><View style={styles.avatar}><Text style={styles.avatarText}>{String(row.display_name ?? 'A').slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.cardTitle}>{row.display_name ?? 'Adventurer'}</Text>{row.username ? <Text style={styles.gold}>@{row.username}</Text> : null}{location ? <Text style={styles.muted}>{location}</Text> : null}</View><Text style={styles.status}>{row.status.replace('_',' ').toUpperCase()}</Text></View>
        {row.status === 'pending' ? <View style={styles.actions}><Pressable style={styles.primary} onPress={() => void respond(row.id,'accepted')}><Text style={styles.primaryText}>Accept</Text></Pressable><Pressable style={styles.secondary} onPress={() => void respond(row.id,'declined')}><Text style={styles.secondaryText}>Decline</Text></Pressable></View> : null}
        {row.status === 'accepted' ? <Pressable onPress={() => void remove(row.id)}><Text style={styles.remove}>Remove connection</Text></Pressable> : null}
      </Pressable>;
    })}
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:50,gap:12},back:{color:'#D7B45A',fontWeight:'900'},eyebrow:{color:'#D7B45A',fontWeight:'900',letterSpacing:1,fontSize:11,marginTop:8},title:{color:'#FFF8E8',fontSize:34,fontWeight:'900'},intro:{color:'#9DA8A1',lineHeight:21,marginBottom:4},error:{color:'#FFB4A9'},empty:{backgroundColor:'#17211C',borderRadius:18,padding:18,borderWidth:1,borderColor:'#29372F'},card:{backgroundColor:'#17211C',borderRadius:18,padding:16,borderWidth:1,borderColor:'#29372F',gap:12},cardTop:{flexDirection:'row',alignItems:'center',gap:12},avatar:{width:50,height:50,borderRadius:25,backgroundColor:'#D7B45A',alignItems:'center',justifyContent:'center'},avatarText:{color:'#17211C',fontSize:21,fontWeight:'900'},cardTitle:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},muted:{color:'#96A39B',marginTop:3},gold:{color:'#D7B45A',fontWeight:'800',marginTop:2},status:{color:'#BFE2C9',fontSize:9,fontWeight:'900',letterSpacing:.7},actions:{flexDirection:'row',gap:8},primary:{flex:1,backgroundColor:'#D7B45A',borderRadius:12,padding:11,alignItems:'center'},primaryText:{color:'#17211C',fontWeight:'900'},secondary:{flex:1,borderWidth:1,borderColor:'#56645C',borderRadius:12,padding:11,alignItems:'center'},secondaryText:{color:'#FFF8E8',fontWeight:'800'},remove:{color:'#D7B45A',fontWeight:'800',fontSize:12}});
