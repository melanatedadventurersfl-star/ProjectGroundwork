import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp, saveProfileDetails, saveProfilePrivacy } from '../../src/member/api';
import { getJourney, getMemberBadges } from '../../src/passport/api';
import { searchWeatherLocations, type WeatherLocationSuggestion } from '../../src/weather/api';

const states=['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const privacy=[['profile_is_private','Private account'],['city_visible','Show city & state'],['badges_visible','Show badges'],['adventures_visible','Show completed adventures'],['interests_visible','Show interests'],['trail_family_visible','Show Trail Family summary']] as const;
const ladder=[['Explorer',0],['Pathfinder',1],['Trailblazer',3],['Wayfinder',5],['Summiteer',10],['Legacy Adventurer',20]] as const;
function rankFor(count:number){return [...ladder].reverse().find(([,min])=>count>=min)?.[0]??'Explorer'}
type ProfileTab='posts'|'albums'|'adventures'|'about';

export default function ProfileScreen(){
 const params=useLocalSearchParams<{edit?:string}>();
 const [editing,setEditing]=useState(params.edit==='1');
 const [tab,setTab]=useState<ProfileTab>('posts');
 const [data,setData]=useState<any>(null);
 const [journey,setJourney]=useState<any[]>([]);
 const [badges,setBadges]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [name,setName]=useState('');
 const [username,setUsername]=useState('');
 const [bio,setBio]=useState('');
 const [state,setState]=useState('FL');
 const [city,setCity]=useState('');
 const [query,setQuery]=useState('');
 const [suggestions,setSuggestions]=useState<WeatherLocationSuggestion[]>([]);

 async function load(){
  setLoading(true);
  try{
   const [base,nextJourney,nextBadges]=await Promise.all([getMemberBasecamp(),getJourney(),getMemberBadges()]);
   setData(base);setJourney(nextJourney);setBadges(nextBadges);
   const profile=base.profile??{};
   setName(profile.display_name??'');setUsername(profile.username??'');setBio(profile.bio??'');
   setState(profile.home_state??'FL');setCity(profile.home_city??'');setQuery(profile.home_city??'');
  }finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 useEffect(()=>{
  if(!editing||query.trim().length<2||query===city){setSuggestions([]);return}
  const timer=setTimeout(()=>{void searchWeatherLocations(`${query}, ${state}`).then(rows=>setSuggestions(rows.filter(row=>row.country==='United States').slice(0,6))).catch(()=>setSuggestions([]))},350);
  return()=>clearTimeout(timer)
 },[editing,query,state,city]);

 async function save(){
  setSaving(true);setMessage('');
  try{await saveProfileDetails({display_name:name,username:username||null,bio:bio||null,home_city:city||null,home_state:state});setMessage('Profile saved.');await load();setEditing(false)}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to save profile.')}
  finally{setSaving(false)}
 }
 async function toggle(key:string,value:boolean){
  setData((current:any)=>({...current,profile:{...current.profile,[key]:value}}));
  try{await saveProfilePrivacy({[key]:value})}catch{await load()}
 }

 const profile=data?.profile??{};
 const rank=useMemo(()=>rankFor(journey.length),[journey.length]);
 const location=[profile.home_city,profile.home_state].filter(Boolean).join(', ');
 if(loading)return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A"/></SafeAreaView>;

 if(editing)return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
  <Pressable onPress={()=>setEditing(false)}><Text style={styles.back}>‹ Profile</Text></Pressable>
  <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{(name||'A').slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.title}>Edit Profile</Text><Text style={styles.muted}>Manage your community-facing identity.</Text></View></View>
  <View style={styles.card}><Text style={styles.label}>DISPLAY NAME</Text><TextInput value={name} onChangeText={setName} style={styles.input}/><Text style={styles.label}>USERNAME · OPTIONAL</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@trailname" placeholderTextColor="#66746B" style={styles.input}/><Text style={styles.label}>BIO</Text><TextInput value={bio} onChangeText={setBio} multiline maxLength={280} placeholder="Tell the community what kind of outside you love." placeholderTextColor="#66746B" style={[styles.input,styles.bio]}/></View>
  <View style={styles.card}><Text style={styles.cardTitle}>Home location</Text><Text style={styles.muted}>Choose a state first, then select a verified city. Shortcuts such as “JVille” cannot be stored.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.states}>{states.map(code=><Pressable key={code} onPress={()=>{setState(code);setCity('');setQuery('')}} style={[styles.stateChip,state===code&&styles.stateActive]}><Text style={[styles.stateText,state===code&&styles.stateTextActive]}>{code}</Text></Pressable>)}</ScrollView><TextInput value={query} onChangeText={value=>{setQuery(value);if(value!==city)setCity('')}} placeholder={`Search cities in ${state}`} placeholderTextColor="#66746B" style={styles.input}/>{suggestions.map(item=><Pressable key={`${item.id}-${item.name}`} style={styles.suggestion} onPress={()=>{setCity(item.name);setQuery(item.name);setSuggestions([])}}><Text style={styles.suggestionTitle}>{item.name}</Text><Text style={styles.muted}>{item.region}</Text></Pressable>)}{city?<Text style={styles.gold}>Selected: {city}, {state}</Text>:<Text style={styles.muted}>Select a city result before saving.</Text>}</View>
  <Pressable disabled={saving||!name.trim()||!city} onPress={()=>void save()} style={[styles.primary,(saving||!name.trim()||!city)&&styles.disabled]}><Text style={styles.primaryText}>{saving?'Saving…':'Save Profile'}</Text></Pressable>{message?<Text style={styles.message}>{message}</Text>:null}
  <View style={styles.card}><Text style={styles.cardTitle}>Profile privacy</Text><Text style={styles.muted}>Exact address, phone, email, payment details, emergency information, and dependent details are never public.</Text>{privacy.map(([key,label])=><View key={key} style={styles.privacyRow}><Text style={styles.rowText}>{label}</Text><Switch value={Boolean(profile[key])} onValueChange={value=>void toggle(key,value)} trackColor={{false:'#435148',true:'#8C763F'}} thumbColor={profile[key]?'#F0D083':'#D9DED9'}/></View>)}</View>
 </ScrollView></SafeAreaView>;

 return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
  <Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
  <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{String(profile.display_name??'A').slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.name}>{profile.display_name??'Adventurer'}</Text>{profile.username?<Text style={styles.gold}>@{profile.username}</Text>:null}{profile.city_visible!==false&&location?<Text style={styles.location}>{location}</Text>:null}</View></View>
  <View style={styles.rankCard}><View><Text style={styles.label}>CURRENT RANK</Text><Text style={styles.rank}>{rank}</Text><Text style={styles.muted}>{journey.length} completed official adventure{journey.length===1?'':'s'}</Text></View><View style={styles.rankEmblem}><Text style={styles.rankGlyph}>◆</Text></View></View>
  <Pressable style={styles.primary} onPress={()=>setEditing(true)}><Text style={styles.primaryText}>Edit Profile</Text></Pressable>
  <View style={styles.tabs}>{(['posts','albums','adventures','about'] as ProfileTab[]).map(value=><Pressable key={value} onPress={()=>setTab(value)} style={[styles.tab,tab===value&&styles.tabActive]}><Text style={[styles.tabText,tab===value&&styles.tabTextActive]}>{value.charAt(0).toUpperCase()+value.slice(1)}</Text></Pressable>)}</View>
  {tab==='posts'?<View style={styles.card}><Text style={styles.cardTitle}>Posts</Text><Text style={styles.muted}>Short updates, trip reflections, photos, and gear thoughts you intentionally share will collect here.</Text><View style={styles.empty}><Text style={styles.emptyTitle}>No profile posts yet</Text><Text style={styles.muted}>Your first shared trail note will appear here.</Text></View></View>:null}
  {tab==='albums'?<View style={styles.card}><Text style={styles.cardTitle}>Albums</Text><Text style={styles.muted}>Experience-centered albums turn completed Adventures into a scrapbook.</Text>{journey.slice(0,3).map(item=><View key={item.adventure_id} style={styles.listRow}><View><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.muted}>{item.city}, {item.state} · {item.photo_count} photo{item.photo_count===1?'':'s'}</Text></View><Text style={styles.arrow}>›</Text></View>)}</View>:null}
  {tab==='adventures'?<View style={styles.card}><Text style={styles.cardTitle}>Adventures</Text>{journey.length?journey.slice(0,5).map(item=><Pressable key={item.adventure_id} style={styles.listRow} onPress={()=>router.push(`/passport/reflection/${item.adventure_id}`)}><View><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.muted}>{item.city}, {item.state}</Text></View><Text style={styles.arrow}>›</Text></Pressable>):<Text style={styles.muted}>Completed official Adventures will appear here.</Text>}</View>:null}
  {tab==='about'?<><View style={styles.card}><Text style={styles.cardTitle}>About</Text><Text style={styles.body}>{profile.bio||'Add a short bio to tell the community what kind of outside you love.'}</Text>{Array.isArray(profile.interests)&&profile.interests.length?<View style={styles.chips}>{profile.interests.map((interest:string)=><Text key={interest} style={styles.chip}>{interest}</Text>)}</View>:null}<Text style={styles.muted}>Joined {profile.created_at?new Date(profile.created_at).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'recently'}</Text></View><View style={styles.stats}><View><Text style={styles.stat}>{journey.length}</Text><Text style={styles.statLabel}>Adventures</Text></View><View><Text style={styles.stat}>{badges.length}</Text><Text style={styles.statLabel}>Badges</Text></View><View><Text style={styles.stat}>{data?.households?.length??0}</Text><Text style={styles.statLabel}>Trail Family</Text></View></View></>:null}
 </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},center:{flex:1,backgroundColor:'#0F1713',alignItems:'center',justifyContent:'center'},content:{padding:20,paddingBottom:60,gap:14},back:{color:'#D7B45A',fontWeight:'900'},identity:{flexDirection:'row',alignItems:'center',gap:14},avatar:{width:76,height:76,borderRadius:38,backgroundColor:'#D7B45A',alignItems:'center',justifyContent:'center'},avatarText:{fontSize:31,fontWeight:'900',color:'#17211C'},title:{fontSize:30,fontWeight:'900',color:'#FFF8E8'},name:{fontSize:29,fontWeight:'900',color:'#FFF8E8'},location:{color:'#B5BEB8',marginTop:4},gold:{color:'#D7B45A',fontWeight:'800',marginTop:2},muted:{color:'#96A39B',lineHeight:20},body:{color:'#C8D0CB',lineHeight:22},rankCard:{backgroundColor:'#22342A',borderWidth:1,borderColor:'#3B5144',borderRadius:20,padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},label:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},rank:{color:'#FFF8E8',fontSize:27,fontWeight:'900',marginTop:5},rankEmblem:{width:72,height:72,transform:[{rotate:'45deg'}],borderWidth:2,borderColor:'#D7B45A',backgroundColor:'#17211C',alignItems:'center',justifyContent:'center'},rankGlyph:{color:'#F0D083',fontSize:28,transform:[{rotate:'-45deg'}]},primary:{backgroundColor:'#D7B45A',borderRadius:14,padding:14,alignItems:'center'},primaryText:{color:'#17211C',fontWeight:'900'},disabled:{opacity:.45},tabs:{flexDirection:'row',backgroundColor:'#151F1A',borderRadius:14,padding:4,gap:3},tab:{flex:1,paddingVertical:9,borderRadius:10,alignItems:'center'},tabActive:{backgroundColor:'#D7B45A'},tabText:{color:'#AAB4AE',fontSize:11,fontWeight:'800'},tabTextActive:{color:'#17211C'},card:{backgroundColor:'#17211C',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16,gap:10},cardTitle:{color:'#FFF8E8',fontSize:20,fontWeight:'900'},input:{backgroundColor:'#101813',borderWidth:1,borderColor:'#314039',borderRadius:12,color:'#FFF8E8',paddingHorizontal:13,paddingVertical:12},bio:{minHeight:100,textAlignVertical:'top'},states:{gap:7},stateChip:{borderWidth:1,borderColor:'#435148',borderRadius:999,paddingHorizontal:11,paddingVertical:7},stateActive:{backgroundColor:'#D7B45A',borderColor:'#D7B45A'},stateText:{color:'#C6CEC8',fontWeight:'800'},stateTextActive:{color:'#17211C'},suggestion:{paddingVertical:10,borderTopWidth:1,borderTopColor:'#26332C'},suggestionTitle:{color:'#FFF8E8',fontWeight:'800'},message:{color:'#E4D7B0',textAlign:'center'},privacyRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingTop:9,borderTopWidth:1,borderTopColor:'#26332C'},rowText:{color:'#FFF8E8',fontWeight:'700',flex:1},empty:{backgroundColor:'#101813',borderRadius:14,padding:15},emptyTitle:{color:'#FFF8E8',fontWeight:'900'},listRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,paddingVertical:10,borderTopWidth:1,borderTopColor:'#26332C'},listTitle:{color:'#FFF8E8',fontWeight:'800'},arrow:{color:'#D7B45A',fontSize:24},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{color:'#F0D083',backgroundColor:'#26372D',borderRadius:999,paddingHorizontal:10,paddingVertical:6,fontSize:12,fontWeight:'700'},stats:{backgroundColor:'#17211C',borderRadius:18,padding:17,flexDirection:'row',justifyContent:'space-around'},stat:{color:'#FFF8E8',fontSize:25,fontWeight:'900',textAlign:'center'},statLabel:{color:'#89958D',fontSize:11,marginTop:3,textAlign:'center'}});
