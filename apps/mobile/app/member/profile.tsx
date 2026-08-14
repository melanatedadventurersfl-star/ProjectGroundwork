import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp, saveProfileDetails, saveProfilePrivacy } from '../../src/member/api';
import { getJourney, getPassportStamps, type PassportStamp } from '../../src/passport/api';
import { RankEmblem, rankFor, rankLadder } from '../../src/passport/RankEmblem';
import { isLegacyStampCode, StampArt } from '../../src/passport/StampArt';
import { searchWeatherLocations, type WeatherLocationSuggestion } from '../../src/weather/api';

const states=['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const privacy=[['profile_is_private','Private account'],['city_visible','Show city & state'],['badges_visible','Show stamps'],['adventures_visible','Show completed adventures'],['interests_visible','Show interests'],['trail_family_visible','Show Trail Family summary']] as const;
type ProfileTab='journey'|'posts'|'photos'|'about';

function formatDate(value?:string|null){
 if(!value)return '';
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 return date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:date.getFullYear()!==new Date().getFullYear()?'numeric':undefined});
}

function Stat({icon,value,label}:{icon:string;value:number;label:string}){
 return <View style={styles.statCell}><Text style={styles.statIcon}>{icon}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function FeaturedStamp({stamp}:{stamp:PassportStamp}){
 return <View style={styles.favoriteCard}>
  <View style={styles.favoriteArt}>{isLegacyStampCode(stamp.code)?<StampArt code={stamp.code} width={68}/>:<View style={styles.genericStamp}><Text style={styles.genericStampIcon}>✦</Text></View>}</View>
  <Text style={styles.favoriteTitle} numberOfLines={2}>{stamp.title}</Text>
  <Text style={styles.favoriteMeta}>Earned</Text>
 </View>;
}

export default function ProfileScreen(){
 const params=useLocalSearchParams<{edit?:string}>();
 const [editing,setEditing]=useState(params.edit==='1');
 const [tab,setTab]=useState<ProfileTab>('journey');
 const [data,setData]=useState<any>(null);
 const [journey,setJourney]=useState<any[]>([]);
 const [stamps,setStamps]=useState<PassportStamp[]>([]);
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
   const [base,nextJourney,nextStamps]=await Promise.all([getMemberBasecamp(),getJourney(),getPassportStamps()]);
   setData(base);setJourney(nextJourney);setStamps(nextStamps);
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
 const nextRank=useMemo(()=>rankLadder.find(([,minimum])=>minimum>journey.length),[journey.length]);
 const nextMinimum=nextRank?.[1]??Math.max(journey.length,1);
 const progress=nextRank?Math.max(0,Math.min(1,journey.length/nextMinimum)):1;
 const remaining=nextRank?Math.max(0,nextRank[1]-journey.length):0;
 const location=[profile.home_city,profile.home_state].filter(Boolean).join(', ');
 const totalPhotos=journey.reduce((sum,item)=>sum+(Number(item.photo_count)||0),0);
 const featuredStamps=stamps.slice(0,3);
 if(loading)return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341"/></SafeAreaView>;

 if(editing)return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
  <Pressable onPress={()=>setEditing(false)}><Text style={styles.back}>‹ Profile</Text></Pressable>
  <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{(name||'A').slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.editTitle}>Edit Profile</Text><Text style={styles.muted}>Manage your community-facing identity.</Text></View></View>
  <View style={styles.card}><Text style={styles.label}>DISPLAY NAME</Text><TextInput value={name} onChangeText={setName} style={styles.input}/><Text style={styles.label}>USERNAME · OPTIONAL</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@trailname" placeholderTextColor="#66746B" style={styles.input}/><Text style={styles.label}>BIO</Text><TextInput value={bio} onChangeText={setBio} multiline maxLength={280} placeholder="Tell the community what kind of outside you love." placeholderTextColor="#66746B" style={[styles.input,styles.bio]}/></View>
  <View style={styles.card}><Text style={styles.cardTitle}>Home location</Text><Text style={styles.muted}>Choose a state first, then select a verified city.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.states}>{states.map(code=><Pressable key={code} onPress={()=>{setState(code);setCity('');setQuery('')}} style={[styles.stateChip,state===code&&styles.stateActive]}><Text style={[styles.stateText,state===code&&styles.stateTextActive]}>{code}</Text></Pressable>)}</ScrollView><TextInput value={query} onChangeText={value=>{setQuery(value);if(value!==city)setCity('')}} placeholder={`Search cities in ${state}`} placeholderTextColor="#66746B" style={styles.input}/>{suggestions.map(item=><Pressable key={`${item.id}-${item.name}`} style={styles.suggestion} onPress={()=>{setCity(item.name);setQuery(item.name);setSuggestions([])}}><Text style={styles.suggestionTitle}>{item.name}</Text><Text style={styles.muted}>{item.region}</Text></Pressable>)}{city?<Text style={styles.gold}>Selected: {city}, {state}</Text>:<Text style={styles.muted}>Select a city result before saving.</Text>}</View>
  <Pressable disabled={saving||!name.trim()||!city} onPress={()=>void save()} style={[styles.primary,(saving||!name.trim()||!city)&&styles.disabled]}><Text style={styles.primaryText}>{saving?'Saving…':'Save Profile'}</Text></Pressable>{message?<Text style={styles.message}>{message}</Text>:null}
  <View style={styles.card}><Text style={styles.cardTitle}>Profile privacy</Text><Text style={styles.muted}>Exact address, phone, email, payment details, emergency information, and dependent details are never public.</Text>{privacy.map(([key,label])=><View key={key} style={styles.privacyRow}><Text style={styles.rowText}>{label}</Text><Switch value={Boolean(profile[key])} onValueChange={value=>void toggle(key,value)} trackColor={{false:'#435148',true:'#8C763F'}} thumbColor={profile[key]?'#F0D083':'#D9DED9'}/></View>)}</View>
 </ScrollView></SafeAreaView>;

 return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
  <View style={styles.topBar}><Pressable onPress={()=>router.back()} hitSlop={10}><Text style={styles.back}>‹</Text></Pressable><Pressable style={styles.editPill} onPress={()=>setEditing(true)}><Text style={styles.editPillText}>Edit Profile</Text><Text style={styles.editPencil}>✎</Text></Pressable></View>

  <View style={styles.heroRow}>
   <View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{String(profile.display_name??'A').slice(0,1).toUpperCase()}</Text></View>
   <View style={styles.heroCopy}><Text style={styles.name}>{profile.display_name??'Adventurer'}</Text>{profile.username?<Text style={styles.handle}>@{profile.username}</Text>:null}{profile.city_visible!==false&&location?<Text style={styles.location}>⌖  {location}</Text>:null}</View>
  </View>
  <Text style={styles.bioText}>{profile.bio||'Add a short bio to tell the community what kind of outside you love.'}</Text>

  <View style={styles.statsCard}><Stat icon="⌁" value={journey.length} label="Adventures"/><Stat icon="♙" value={stamps.length} label="Stamps"/><Stat icon="▧" value={totalPhotos} label="Photos"/><Stat icon="♧" value={data?.households?.length??0} label="Trail Family"/></View>

  <View style={styles.rankCard}>
   <RankEmblem rank={rank} size={82}/>
   <View style={styles.rankCopy}><Text style={styles.rank}>{rank.toUpperCase()}</Text><Text style={styles.rankSub}>{journey.length} official adventure{journey.length===1?'':'s'} completed</Text><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${progress*100}%`}]}/></View>{nextRank?<Text style={styles.progressText}><Text style={styles.progressNumber}>{journey.length}/{nextMinimum}</Text> total · <Text style={styles.progressNumber}>{remaining}</Text> adventure{remaining===1?'':'s'} to <Text style={styles.progressNext}>{nextRank[0]}</Text></Text>:<Text style={styles.progressText}>Highest rank reached</Text>}</View>
  </View>

  <View style={styles.tabs}>{(['journey','posts','photos','about'] as ProfileTab[]).map(value=><Pressable key={value} onPress={()=>setTab(value)} style={styles.tab}><Text style={[styles.tabText,tab===value&&styles.tabTextActive]}>{value.charAt(0).toUpperCase()+value.slice(1)}</Text>{tab===value?<View style={styles.tabUnderline}/>:null}</Pressable>)}</View>

  {tab==='journey'?<>
   <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Featured Stamps</Text></View>
   {featuredStamps.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesRow}>{featuredStamps.map(stamp=><FeaturedStamp key={stamp.stamp_id} stamp={stamp}/>)}</ScrollView>:<View style={styles.empty}><Text style={styles.emptyTitle}>Your earned stamps will live here</Text><Text style={styles.muted}>Complete official adventures to start building your collection.</Text></View>}

   <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Adventure Journey</Text></View>
   {journey.length?<View style={styles.timeline}>{journey.map((item,index)=><Pressable key={item.adventure_id} style={styles.timelineRow} onPress={()=>router.push(`/passport/reflection/${item.adventure_id}`)}>
    <View style={styles.timelineRail}><View style={styles.completeDot}><Text style={styles.completeCheck}>✓</Text></View>{index<journey.length-1?<View style={styles.timelineLine}/>:null}</View>
    <View style={styles.journeyCard}><View style={styles.journeyBadge}><Text style={styles.journeyBadgeIcon}>⌁</Text></View><View style={styles.journeyCopy}><Text style={styles.journeyTitle}>{item.title}</Text><Text style={styles.journeyMeta}>{formatDate(item.experienced_at||item.starts_at)}{item.city?` · ${item.city}`:''}</Text><Text style={styles.journeyStatus}>Completed{Number(item.stamp_count)>0?'  ·  ✦ Stamp earned':''}</Text></View><Text style={styles.arrow}>›</Text></View>
   </Pressable>)}</View>:<View style={styles.empty}><Text style={styles.emptyTitle}>Your journey starts with the first adventure</Text><Text style={styles.muted}>Completed official Adventures will build your timeline here.</Text></View>}
  </>:null}

  {tab==='posts'?<View style={styles.card}><Text style={styles.cardTitle}>Posts</Text><View style={styles.emptyInner}><Text style={styles.emptyTitle}>No posts yet</Text><Text style={styles.muted}>Share something from your next adventure.</Text></View></View>:null}

  {tab==='photos'?<View style={styles.card}><Text style={styles.cardTitle}>Photos</Text><Text style={styles.muted}>Your photos stay organized around the adventures they came from.</Text>{journey.filter(item=>Number(item.photo_count)>0).map(item=><Pressable key={item.adventure_id} style={styles.listRow} onPress={()=>router.push(`/passport/reflection/${item.adventure_id}`)}><View><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.muted}>{item.photo_count} photo{Number(item.photo_count)===1?'':'s'}</Text></View><Text style={styles.arrow}>›</Text></Pressable>)}{totalPhotos===0?<View style={styles.emptyInner}><Text style={styles.emptyTitle}>No adventure photos yet</Text><Text style={styles.muted}>Photos added to memories will collect here automatically.</Text></View>:null}</View>:null}

  {tab==='about'?<View style={styles.card}><Text style={styles.cardTitle}>About</Text><Text style={styles.body}>{profile.bio||'Add a short bio to tell the community what kind of outside you love.'}</Text>{Array.isArray(profile.interests)&&profile.interests.length?<View style={styles.chips}>{profile.interests.map((interest:string)=><Text key={interest} style={styles.chip}>{interest}</Text>)}</View>:null}<Text style={styles.muted}>Joined {profile.created_at?new Date(profile.created_at).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'recently'}</Text></View>:null}
 </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#09110F'},center:{flex:1,backgroundColor:'#09110F',alignItems:'center',justifyContent:'center'},content:{paddingHorizontal:18,paddingTop:8,paddingBottom:72,gap:18},editContent:{padding:20,paddingBottom:60,gap:14},
 topBar:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{color:'#F5C341',fontSize:32,fontWeight:'500'},editPill:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'#171D1B',borderWidth:1,borderColor:'#252E2A',borderRadius:999,paddingHorizontal:16,paddingVertical:10},editPillText:{color:'#F5C341',fontWeight:'800'},editPencil:{color:'#F5C341',fontSize:18},
 heroRow:{flexDirection:'row',alignItems:'center',gap:20},avatarLarge:{width:94,height:94,borderRadius:47,backgroundColor:'#F5C341',alignItems:'center',justifyContent:'center',shadowColor:'#F5C341',shadowOpacity:.18,shadowRadius:12},avatarLargeText:{fontSize:42,fontWeight:'900',color:'#121A17'},heroCopy:{flex:1,gap:5},name:{fontSize:34,fontWeight:'900',color:'#F7F8F3',letterSpacing:-.6},handle:{color:'#F5C341',fontSize:17,fontWeight:'800'},location:{color:'#B2BDB8',fontSize:15},bioText:{color:'#D4DBD7',fontSize:16,lineHeight:23,paddingHorizontal:2,marginTop:-7,marginBottom:2},
 statsCard:{flexDirection:'row',backgroundColor:'#111A17',borderRadius:20,borderWidth:1,borderColor:'#27332F',paddingVertical:15},statCell:{flex:1,alignItems:'center',paddingHorizontal:5,borderRightWidth:1,borderRightColor:'#29332F'},statIcon:{color:'#F5C341',fontSize:18,fontWeight:'900'},statValue:{color:'#F7F8F3',fontSize:25,fontWeight:'900',marginTop:3},statLabel:{color:'#AAB5B0',fontSize:10.5,marginTop:1,textAlign:'center'},
 rankCard:{backgroundColor:'#0C3433',borderWidth:1,borderColor:'#245654',borderRadius:22,padding:16,flexDirection:'row',alignItems:'center',gap:16,overflow:'hidden'},rankCopy:{flex:1},rank:{color:'#F7F8F3',fontSize:25,fontWeight:'900',letterSpacing:.4},rankSub:{color:'#6FD3CF',marginTop:3,fontSize:13},progressTrack:{height:10,borderRadius:99,backgroundColor:'#194B4B',overflow:'hidden',marginTop:14},progressFill:{height:'100%',backgroundColor:'#F5C341',borderRadius:99},progressText:{color:'#80CDC9',fontSize:13,marginTop:9},progressNumber:{color:'#F5C341',fontWeight:'900'},progressNext:{color:'#F5C341',fontWeight:'900'},
 tabs:{flexDirection:'row',backgroundColor:'#121A18',borderRadius:17,borderWidth:1,borderColor:'#28322E',overflow:'hidden'},tab:{flex:1,alignItems:'center',paddingTop:13,paddingBottom:10,position:'relative'},tabText:{color:'#A8B2AD',fontSize:13,fontWeight:'800'},tabTextActive:{color:'#F5C341'},tabUnderline:{height:3,backgroundColor:'#F5C341',position:'absolute',bottom:0,left:18,right:18,borderRadius:4},
 sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:1},sectionTitle:{color:'#F7F8F3',fontSize:21,fontWeight:'900'},sectionLink:{color:'#65C9C4',fontSize:13,fontWeight:'700'},favoritesRow:{gap:10,paddingRight:8},favoriteCard:{width:128,minHeight:156,backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#29342F',padding:11,alignItems:'center'},favoriteArt:{height:78,alignItems:'center',justifyContent:'center'},favoriteTitle:{color:'#F7F8F3',fontWeight:'900',fontSize:13,textAlign:'center',marginTop:4},favoriteMeta:{color:'#60C9C3',fontSize:11,marginTop:4},genericStamp:{width:64,height:64,borderRadius:18,borderWidth:2,borderColor:'#D7B45A',backgroundColor:'#21302A',alignItems:'center',justifyContent:'center',transform:[{rotate:'3deg'}]},genericStampIcon:{color:'#F5C341',fontSize:25},
 timeline:{gap:0},timelineRow:{flexDirection:'row'},timelineRail:{width:45,alignItems:'center'},completeDot:{width:32,height:32,borderRadius:16,backgroundColor:'#1D7B48',alignItems:'center',justifyContent:'center',zIndex:2},completeCheck:{color:'#F7F8F3',fontWeight:'900',fontSize:17},timelineLine:{width:2,backgroundColor:'#39473F',flex:1,minHeight:82},journeyCard:{flex:1,minHeight:100,backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28332F',marginBottom:10,padding:12,flexDirection:'row',alignItems:'center',gap:11},journeyBadge:{width:44,height:44,borderRadius:12,backgroundColor:'#16302A',alignItems:'center',justifyContent:'center'},journeyBadgeIcon:{color:'#F5C341',fontSize:22,fontWeight:'900'},journeyCopy:{flex:1},journeyTitle:{color:'#F7F8F3',fontSize:15.5,fontWeight:'900'},journeyMeta:{color:'#AAB6B0',fontSize:12.5,marginTop:3},journeyStatus:{color:'#67CFC8',fontSize:11.5,fontWeight:'800',marginTop:7},
 card:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16,gap:10},cardTitle:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},empty:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16},emptyInner:{backgroundColor:'#0C1411',borderRadius:14,padding:15,marginTop:4},emptyTitle:{color:'#F7F8F3',fontWeight:'900'},muted:{color:'#96A39B',lineHeight:20},body:{color:'#C8D0CB',lineHeight:22},
 identity:{flexDirection:'row',alignItems:'center',gap:14},avatar:{width:76,height:76,borderRadius:38,backgroundColor:'#D7B45A',alignItems:'center',justifyContent:'center'},avatarText:{fontSize:31,fontWeight:'900',color:'#17211C'},editTitle:{fontSize:30,fontWeight:'900',color:'#FFF8E8'},label:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},gold:{color:'#D7B45A',fontWeight:'800',marginTop:2},input:{backgroundColor:'#101813',borderWidth:1,borderColor:'#314039',borderRadius:12,color:'#FFF8E8',paddingHorizontal:13,paddingVertical:12},bio:{minHeight:100,textAlignVertical:'top'},states:{gap:7},stateChip:{borderWidth:1,borderColor:'#435148',borderRadius:999,paddingHorizontal:11,paddingVertical:7},stateActive:{backgroundColor:'#D7B45A',borderColor:'#D7B45A'},stateText:{color:'#C6CEC8',fontWeight:'800'},stateTextActive:{color:'#17211C'},suggestion:{paddingVertical:10,borderTopWidth:1,borderTopColor:'#26332C'},suggestionTitle:{color:'#FFF8E8',fontWeight:'800'},primary:{backgroundColor:'#D7B45A',borderRadius:14,padding:14,alignItems:'center'},primaryText:{color:'#17211C',fontWeight:'900'},disabled:{opacity:.45},message:{color:'#E4D7B0',textAlign:'center'},privacyRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingTop:9,borderTopWidth:1,borderTopColor:'#26332C'},rowText:{color:'#FFF8E8',fontWeight:'700',flex:1},listRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,paddingVertical:10,borderTopWidth:1,borderTopColor:'#26332C'},listTitle:{color:'#FFF8E8',fontWeight:'800'},arrow:{color:'#D7B45A',fontSize:24},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{color:'#F0D083',backgroundColor:'#26372D',borderRadius:999,paddingHorizontal:10,paddingVertical:6,fontSize:12,fontWeight:'700'}
});