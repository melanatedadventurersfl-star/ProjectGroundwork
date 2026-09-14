import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createHostOrganization } from '../../src/hosting/hostProfiles';
import { updateHostProfileSetup, type HostType } from '../../src/hosting/hostProfileSetup';

const C={bg:'#0A0F0C',panel:'#131B16',line:'#2D3A32',cream:'#FFF8E8',muted:'#95A29A',gold:'#D7B45A'};
const HOST_TYPES:Array<{key:HostType;label:string;copy:string}>=[
 {key:'business',label:'Business',copy:'Company or event business'},
 {key:'organization',label:'Organization',copy:'Association or formal group'},
 {key:'individual',label:'Individual',copy:'Host under your own name'},
 {key:'nonprofit',label:'Nonprofit',copy:'Mission-led organization'},
 {key:'community',label:'Community',copy:'Member or interest community'},
 {key:'venue',label:'Venue',copy:'Place that hosts experiences'},
 {key:'creator',label:'Creator',copy:'Personal creator brand'},
 {key:'other',label:'Other',copy:'Another kind of host'},
];

export default function NewOrganizationHostProfileScreen(){
 const [name,setName]=useState('');
 const [hostType,setHostType]=useState<HostType>('business');
 const [city,setCity]=useState('');
 const [state,setState]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');

 async function create(){
  setSaving(true);setError('');
  try{
   const org=await createHostOrganization({name,city,state});
   await updateHostProfileSetup(org.id,{hostType,setupStage:'profile'});
   router.replace(`/host/organization-profile-editor/${org.id}` as never);
  }catch(caught){setError(caught instanceof Error?caught.message:'Unable to create host profile.');}
  finally{setSaving(false)}
 }

 return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
  <Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Host profiles</Text></Pressable>
  <Text style={styles.eyebrow}>NEW HOST PROFILE</Text><Text style={styles.title}>Start with the identity people should recognize.</Text><Text style={styles.copy}>You only need the basics here. After this, add your logo, photos, About details, service areas, contact options, and existing business materials.</Text>
  {error?<View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View>:null}
  <View style={styles.card}>
   <Field label="Public host name" value={name} onChangeText={setName} placeholder="Groundwork Test Company"/>
   <Text style={styles.label}>What kind of host is this?</Text>
   <View style={styles.types}>{HOST_TYPES.map((item)=><Pressable key={item.key} style={[styles.type,hostType===item.key&&styles.typeActive]} onPress={()=>setHostType(item.key)}><Text style={[styles.typeTitle,hostType===item.key&&styles.typeTitleActive]}>{item.label}</Text><Text style={styles.typeCopy}>{item.copy}</Text></Pressable>)}</View>
   <View style={styles.row}><View style={styles.flex}><Field label="Home city (optional)" value={city} onChangeText={setCity} placeholder="Jacksonville"/></View><View style={styles.state}><Field label="State" value={state} onChangeText={(value:string)=>setState(value.toUpperCase())} placeholder="FL"/></View></View>
   <View style={styles.nextCard}><Text style={styles.nextTitle}>Next</Text><Text style={styles.nextCopy}>Profile → About → Media → Brand → Features → Preview</Text></View>
   <Pressable disabled={saving||!name.trim()} style={[styles.primary,(saving||!name.trim())&&styles.disabled]} onPress={()=>void create()}>{saving?<ActivityIndicator color="#162019"/>:<Text style={styles.primaryText}>Create profile and continue</Text>}</Pressable>
  </View>
 </ScrollView></SafeAreaView>
}

function Field({label,...props}:any){return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#657269" style={styles.input}/></View>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:C.bg},content:{padding:20,paddingBottom:100},back:{color:C.gold,fontWeight:'900',marginBottom:14},eyebrow:{color:C.gold,fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:C.cream,fontSize:29,fontWeight:'900',marginTop:3,maxWidth:680},copy:{color:C.muted,fontSize:12,lineHeight:18,marginTop:7,maxWidth:650},card:{marginTop:18,backgroundColor:C.panel,borderRadius:18,borderWidth:1,borderColor:C.line,padding:16},field:{marginTop:12},label:{color:C.cream,fontSize:10,fontWeight:'800',marginBottom:6,marginTop:8},input:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:C.line,backgroundColor:'#101611',color:C.cream,paddingHorizontal:12,fontSize:12},types:{flexDirection:'row',flexWrap:'wrap',gap:8},type:{width:'48%',minWidth:140,borderWidth:1,borderColor:C.line,borderRadius:12,padding:10},typeActive:{backgroundColor:'#292516',borderColor:C.gold},typeTitle:{color:C.cream,fontSize:11,fontWeight:'900'},typeTitleActive:{color:C.gold},typeCopy:{color:C.muted,fontSize:8,lineHeight:12,marginTop:3},row:{flexDirection:'row',gap:10},flex:{flex:1},state:{width:110},nextCard:{backgroundColor:'#18211B',borderRadius:12,padding:11,marginTop:16},nextTitle:{color:C.gold,fontSize:9,fontWeight:'900'},nextCopy:{color:C.muted,fontSize:10,marginTop:4},primary:{minHeight:48,borderRadius:12,backgroundColor:C.gold,alignItems:'center',justifyContent:'center',marginTop:14},primaryText:{color:'#162019',fontWeight:'900',fontSize:12},disabled:{opacity:.45},errorCard:{marginTop:14,backgroundColor:'#251614',borderWidth:1,borderColor:'#6A3E38',borderRadius:13,padding:12},error:{color:'#F0A199'}});
