import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from 'react-native';

import { assertHostOrganizationInActiveTenant } from '../../../src/platform/tenantScope';

const C = { bg:'#0A0F0C', muted:'#95A29A', gold:'#D7B45A' };

function firstParam(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value}

export default function HostProfileEditorLayout(){
  const params=useLocalSearchParams<{id?:string|string[]}>();
  const id=firstParam(params.id);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    let active=true;
    if(!id){setReady(true);return()=>{active=false}}
    void assertHostOrganizationInActiveTenant(id)
      .then(()=>{if(active)setReady(true)})
      .catch(()=>{if(active)router.replace('/host/profile' as never)});
    return()=>{active=false};
  },[id]);

  if(!ready)return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold}/><Text style={styles.copy}>Opening this client’s host profile…</Text></SafeAreaView>;
  return <Stack screenOptions={{headerShown:false}}/>;
}

const styles=StyleSheet.create({center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:10},copy:{color:C.muted,fontSize:11}});
