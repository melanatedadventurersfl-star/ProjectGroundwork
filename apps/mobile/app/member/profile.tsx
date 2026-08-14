import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp, removeProfilePhoto, saveProfileDetails, saveProfilePrivacy, uploadProfilePhoto } from '../../src/member/api';
import { getJourney, getPassportStamps, type PassportStamp } from '../../src/passport/api';
import { RankEmblem, rankFor, rankLadder } from '../../src/passport/RankEmblem';
import { isLegacyStampCode, StampArt } from '../../src/passport/StampArt';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';
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

function Stat({icon,value,label,last=false}:{icon:AppIconName;value:number;label:string;last?:boolean}){
 return <View style={[styles.statCell,last&&styles.statCellLast]}><AppIcon name={icon} color="#F5C341" size={18}/><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function FeaturedStamp({stamp}:{stamp:PassportStamp}){
 return <View style={styles.favoriteCard}>
  <View style={styles.favoriteArt}>{isLegacyStampCode(stamp.code)?<StampArt code={stamp.code} width={68}/>:<View style={styles.genericStamp}><AppIcon name="stamp" color="#F5C341" size={28}/></View>}</View>
  <Text style={styles.favoriteTitle} numberOfLines={2}>{stamp.title}</Text>
  <Text style={styles.favoriteMeta}>Earned</Text>
 </View>;
}

function Avatar({url,name,size=76}:{url?:string|null;name?:string|null;size?:number}){
 const radius=size/2;
 if(url)return <Image source={{uri:url}} style={{width:size,height:size,borderRadius:radius,backgroundColor:'#F5C341'}}/>;
 return <View style={{width:size,height:size,borderRadius:radius,backgroundColor:'#F5C341',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:size*.42,fontWeight:'900',color:'#121A17'}}>{String(name??'A').slice(0,1).toUpperCase()}</Text></View>;
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
 const [photoBusy,setPhotoBusy]=useState(false);
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
 async function chooseProfilePhoto(){
  setMessage('');
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted){setMessage('Photo library access is needed to choose a profile picture.');return}
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.85});
  if(result.canceled||!result.assets?.[0])return;
  setPhotoBusy(true);
  try{
   const asset=result.assets[0];
   const avatarUrl=await uploadProfilePhoto({uri:asset.uri,mimeType:asset.mimeType});
   setData((current:any)=>({...current,profile:{...current.profile,avatar_url:avatarUrl}}));
   setMessage('Profile photo updated.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to update profile photo.')}
  finally{setPhotoBusy(false)}
 }
 async function removePhoto(){
  setPhotoBusy(true);setMessage('');
  try{await removeProfilePhoto();setData((current:any)=>({...current,profile:{...current.profile,avatar_url:null}}));setMessage('Profile photo removed.')}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to remove profile photo.')}
  finally{setPhotoBusy(false)}
 }
 function photoMenu(){
  if(!data?.profile?.avatar_url){void chooseProfilePhoto();return}
  Alert.alert('Profile photo','Choose what you want to do.',[
   {text:'Cancel',style:'cancel'},
   {text:'Change photo',onPress:()=>void chooseProfilePhoto()},
   {text:'Remove photo',style:'destructive',onPress:()=>void removePhoto()},
  ]);
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
  <Pressable onPress={()=>setEditing(false)} style={styles.editBack}><AppIcon name="chevron-forward" color="#F5C341" size={24} style={{transform:[{rotate:'180deg'}]}}/><Text style={styles.editBackText}>Profile</Text></Pressable>
  <View style={styles.photoEditor}>
   <Pressable onPress={photoMenu} disabled={photoBusy} style={styles.photoPressable}>
    <Avatar url={profile.avatar_url} name={name} size={84}/>
    <View style={styles.cameraBadge}><AppIcon name="camera" color="#121A17" size={15}/></View>
    {photoBusy?<View style={styles.photoBusy}><ActivityIndicator color="#F5C341"/></View>:null}
   </Pressable>
   <View style={styles.photoCopy}><Text style={styles.editTitle}>Profile photo</Text><Text style={styles.muted}>Tap your photo to choose, change, or remove it.</Text><Pressable onPress={photoMenu} disabled={photoBusy}><Text style={styles.photoAction}>{profile.avatar_url?'Change photo':'Choose photo'}</Text></Pressable></View>
  </View>
  <View style={styles.card}><Text style={styles.label}>DISPLAY NAME</Text><TextInput value={name} onChangeText={setName} style={styles.input}/><Text style={styles.label}>USERNAME · OPTIONAL</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@trailname" placeholderTextColor="#66746B" style={styles.input}/><Text style={styles.label}>BIO</Text><TextInput value={bio} onChangeText={setBio} multiline maxLength={280} placeholder="Tell the community what kind of outside you love." placeholderTextColor="#66746B" style={[styles.input,styles.bio]}/></View>
  <View style={styles.card}><Text style={styles.cardTitle}>Home location</Text><Text style={styles.muted}>Choose a state first, then select a verified city.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.states}>{states.map(code=><Pressable key={code} onPress={()=>{setState(code);setCity('');setQuery('')}} style={[styles.stateChip,state===code&&styles.stateActive]}><Text style={[styles.stateText,state===code&&styles.stateTextActive]}>{code}</Text></Pressable>)}</ScrollView><TextInput value={query} onChangeText={value=>{setQuery(value);if(value!==city)setCity('')}} placeholder={`Search cities in ${state}`} placeholderTextColor="#66746B" style={styles.input}/>{suggestions.map(item=><Pressable key={`${item.id}-${item.name}`} style={styles.suggestion} onPress={()=>{setCity(item.name);setQuery(item.name);setSuggestions([])}}><Text style={styles.suggestionTitle}>{item.name}</Text><Text style={styles.muted}>{item.region}</Text></Pressable>)}{city?<Text style={styles.gold}>Selected: {city}, {state}</Text>:<Text style={styles.muted}>Select a city result before saving.</Text>}</View>
  <Pressable disabled={saving||!name.trim()||!city} onPress={()=>void save()} style={[styles.primary,(saving||!name.trim()||!city)&&styles.disabled]}><Text style={styles.primaryText}>{saving?'Saving…':'Save Profile'}</Text></Pressable>{message?<Text style={styles.message}>{message}</Text>:null}
  <View style={styles.card}><Text style={styles.cardTitle}>Profile privacy</Text><Text style={styles.muted}>Exact address, phone, email, payment details, emergency information, and dependent details are never public.</Text>{privacy.map(([key,label])=><View key={key} style={styles.privacyRow}><Text style={styles.rowText}>{label}</Text><Switch value={Boolean(profile[key])} onValueChange={value=>void toggle(key,value)} trackColor={{false:'#435148',true:'#8C763F'}} thumbColor={profile[key]?'#F0D083':'#D9DED9'}/></View>)}</View>
 </ScrollView></SafeAreaView>;

 return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
  <View style={styles.topBar}><Pressable onPress={()=>router.back()} hitSlop={10}><AppIcon name="chevron-forward" color="#F5C341" size={26} style={{transform:[{rotate:'180deg'}]}}/></Pressable><Pressable style={styles.editPill} onPress={()=>setEditing(true)}><Text style={styles.editPillText}>Edit Profile</Text><AppIcon name="edit" color="#F5C341" size={17}/></Pressable></View>

  <View style={styles.profileHeaderCard}>
   <View style={styles.identityRankRow}>
    <View style={styles.identityCluster}>
     <Pressable onPress={photoMenu} style={styles.avatarWrap}>
      <Avatar url={profile.avatar_url} name={profile.display_name} size={70}/>
      <View style={styles.mainCameraBadge}><AppIcon name="camera" color="#121A17" size={12}/></View>
     </Pressable>
     <View style={styles.heroCopy}>
      <Text style={styles.name}>{profile.display_name??'Adventurer'}</Text>
      {profile.username?<Text style={styles.handle}>@{profile.username}</Text>:null}
      {profile.city_visible!==false&&location?<View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={14}/><Text style={styles.location}>{location}</Text></View>:null}
     </View>
    </View>
    <View style={styles.rankIdentity}>
     <RankEmblem rank={rank} size={48}/>
     <Text style={styles.rankCompact}>{rank.toUpperCase()}</Text>
     <Text style={styles.rankCount}>{journey.length}/{nextMinimum}</Text>
    </View>
   </View>

   <Text style={styles.bioText}>{profile.bio||'Add a short bio to tell the community what kind of outside you love.'}</Text>

   <View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${progress*100}%`}]}/></View>
   {nextRank?<Text style={styles.progressText}><Text style={styles.progressNumber}>{remaining}</Text> adventure{remaining===1?'':'s'} to <Text style={styles.progressNext}>{nextRank[0]}</Text></Text>:<Text style={styles.progressText}>Highest rank reached</Text>}

   <View style={styles.statsCard}><Stat icon="adventure" value={journey.length} label="Adventures"/><Stat icon="stamp" value={stamps.length} label="Stamps"/><Stat icon="photos" value={totalPhotos} label="Photos"/><Stat icon="trail-family" value={data?.households?.length??0} label="Trail Family" last/></View>
  </View>

  <View style={styles.tabs}>{(['journey','posts','photos','about'] as ProfileTab[]).map(value=><Pressable key={value} onPress={()=>setTab(value)} style={styles.tab}><Text style={[styles.tabText,tab===value&&styles.tabTextActive]}>{value.charAt(0).toUpperCase()+value.slice(1)}</Text>{tab===value?<View style={styles.tabUnderline}/>:null}</Pressable>)}</View>

  {tab==='journey'?<>
   <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Featured Stamps</Text></View>
   {featuredStamps.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesRow}>{featuredStamps.map(stamp=><FeaturedStamp key={stamp.stamp_id} stamp={stamp}/>)}</ScrollView>:<View style={styles.empty}><Text style={styles.emptyTitle}>Your earned stamps will live here</Text><Text style={styles.muted}>Complete official adventures to start building your collection.</Text></View>}

   <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Adventure Journey</Text></View>
   {journey.length?<View style={styles.timeline}>{journey.map((item,index)=><Pressable key={item.adventure_id} style={styles.timelineRow} onPress={()=>router.push(`/passport/reflection/${item.adventure_id}`)}>
    <View style={styles.timelineRail}><View style={styles.completeDot}><AppIcon name="checkmark" color="#F7F8F3" size={31}/></View>{index<journey.length-1?<View style={styles.timelineLine}/>:null}</View>
    <View style={styles.journeyCard}><View style={styles.journeyBadge}><AppIcon name="adventure" color="#F5C341" size={23}/></View><View style={styles.journeyCopy}><Text style={styles.journeyTitle}>{item.title}</Text><Text style={styles.journeyMeta}>{formatDate(item.experienced_at||item.starts_at)}{item.city?` · ${item.city}`:''}</Text><View style={styles.journeyStatusRow}><Text style={styles.journeyStatus}>Completed</Text>{Number(item.stamp_count)>0?<><Text style={styles.journeyDot}>·</Text><AppIcon name="stamp" color="#67CFC8" size={13}/><Text style={styles.journeyStatus}>Stamp earned</Text></>:null}</View></View><AppIcon name="chevron-forward" color="#D7B45A" size={22}/></View>
   </Pressable>)}</View>:<View style={styles.empty}><Text style={styles.emptyTitle}>Your journey starts with the first adventure</Text><Text style={styles.muted}>Completed official Adventures will build your timeline here.</Text></View>}
  </>:null}

  {tab==='posts'?<View style={styles.card}><Text style={styles.cardTitle}>Posts</Text><View style={styles.emptyInner}><Text style={styles.emptyTitle}>No posts yet</Text><Text style={styles.muted}>Share something from your next adventure.</Text></View></View>:null}

  {tab==='photos'?<View style={styles.card}><Text style={styles.cardTitle}>Photos</Text><Text style={styles.muted}>Your photos stay organized around the adventures they came from.</Text>{journey.filter(item=>Number(item.photo_count)>0).map(item=><Pressable key={item.adventure_id} style={styles.listRow} onPress={()=>router.push(`/passport/reflection/${item.adventure_id}`)}><View><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.muted}>{item.photo_count} photo{Number(item.photo_count)===1?'':'s'}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={22}/></Pressable>)}{totalPhotos===0?<View style={styles.emptyInner}><Text style={styles.emptyTitle}>No adventure photos yet</Text><Text style={styles.muted}>Photos added to memories will collect here automatically.</Text></View>:null}</View>:null}

  {tab==='about'?<View style={styles.card}><Text style={styles.cardTitle}>About</Text><Text style={styles.body}>{profile.bio||'Add a short bio to tell the community what kind of outside you love.'}</Text>{Array.isArray(profile.interests)&&profile.interests.length?<View style={styles.chips}>{profile.interests.map((interest:string)=><Text key={interest} style={styles.chip}>{interest}</Text>)}</View>:null}<Text style={styles.muted}>Joined {profile.created_at?new Date(profile.created_at).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'recently'}</Text></View>:null}
 </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#09110F'},center:{flex:1,backgroundColor:'#09110F',alignItems:'center',justifyContent:'center'},content:{paddingHorizontal:18,paddingTop:8,paddingBottom:72,gap:15},editContent:{padding:20,paddingBottom:60,gap:14},
 topBar:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},editPill:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#171D1B',borderWidth:1,borderColor:'#252E2A',borderRadius:999,paddingHorizontal:14,paddingVertical:9},editPillText:{color:'#F5C341',fontWeight:'800'},editBack:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start'},editBackText:{color:'#F5C341',fontWeight:'800'},
 profileHeaderCard:{backgroundColor:'#111A17',borderWidth:1,borderColor:'#27332F',borderRadius:22,padding:16},identityRankRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},identityCluster:{flex:1,flexDirection:'row',alignItems:'center',gap:12},avatarWrap:{width:70,height:70,position:'relative'},mainCameraBadge:{position:'absolute',right:-1,bottom:1,width:24,height:24,borderRadius:12,backgroundColor:'#F5C341',borderWidth:2,borderColor:'#111A17',alignItems:'center',justifyContent:'center'},heroCopy:{flex:1,gap:2},name:{fontSize:27,fontWeight:'900',color:'#F7F8F3',letterSpacing:-.5},handle:{color:'#F5C341',fontSize:15,fontWeight:'800'},locationRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:2},location:{color:'#AEB9B4',fontSize:13.5},rankIdentity:{width:88,alignItems:'center',justifyContent:'center',paddingLeft:8,borderLeftWidth:1,borderLeftColor:'#25322D'},rankCompact:{color:'#F7F8F3',fontSize:11.5,fontWeight:'900',letterSpacing:.5,marginTop:3,textAlign:'center'},rankCount:{color:'#6FD3CF',fontSize:11,fontWeight:'800',marginTop:1},bioText:{color:'#D4DBD7',fontSize:14.5,lineHeight:20,marginTop:11},
 progressTrack:{height:7,borderRadius:99,backgroundColor:'#194B4B',overflow:'hidden',marginTop:10},progressFill:{height:'100%',backgroundColor:'#F5C341',borderRadius:99},progressText:{color:'#80CDC9',fontSize:11.5,marginTop:6},progressNumber:{color:'#F5C341',fontWeight:'900'},progressNext:{color:'#F5C341',fontWeight:'900'},
 statsCard:{flexDirection:'row',marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:'#25322D'},statCell:{flex:1,alignItems:'center',paddingHorizontal:4,borderRightWidth:1,borderRightColor:'#29332F'},statCellLast:{borderRightWidth:0},statValue:{color:'#F7F8F3',fontSize:21,fontWeight:'900',marginTop:2},statLabel:{color:'#AAB5B0',fontSize:9.8,marginTop:1,textAlign:'center'},
 photoEditor:{flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'#111A17',borderRadius:20,borderWidth:1,borderColor:'#28362E',padding:15},photoPressable:{width:84,height:84,borderRadius:42,position:'relative'},photoCopy:{flex:1,gap:5},photoAction:{color:'#F5C341',fontWeight:'900',marginTop:2},cameraBadge:{position:'absolute',right:-1,bottom:2,width:28,height:28,borderRadius:14,backgroundColor:'#F5C341',borderWidth:3,borderColor:'#111A17',alignItems:'center',justifyContent:'center'},photoBusy:{position:'absolute',left:0,right:0,top:0,bottom:0,borderRadius:42,backgroundColor:'rgba(9,17,15,.68)',alignItems:'center',justifyContent:'center'},
 tabs:{flexDirection:'row',backgroundColor:'#121A18',borderRadius:17,borderWidth:1,borderColor:'#28322E',overflow:'hidden'},tab:{flex:1,alignItems:'center',paddingTop:12,paddingBottom:9,position:'relative'},tabText:{color:'#A8B2AD',fontSize:13,fontWeight:'800'},tabTextActive:{color:'#F5C341'},tabUnderline:{height:3,backgroundColor:'#F5C341',position:'absolute',bottom:0,left:18,right:18,borderRadius:4},
 sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:1},sectionTitle:{color:'#F7F8F3',fontSize:21,fontWeight:'900'},favoritesRow:{gap:10,paddingRight:8},favoriteCard:{width:128,minHeight:156,backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#29342F',padding:11,alignItems:'center'},favoriteArt:{height:78,alignItems:'center',justifyContent:'center'},favoriteTitle:{color:'#F7F8F3',fontWeight:'900',fontSize:13,textAlign:'center',marginTop:4},favoriteMeta:{color:'#60C9C3',fontSize:11,marginTop:4},genericStamp:{width:64,height:64,borderRadius:18,borderWidth:2,borderColor:'#D7B45A',backgroundColor:'#21302A',alignItems:'center',justifyContent:'center',transform:[{rotate:'3deg'}]},
 timeline:{gap:0},timelineRow:{flexDirection:'row'},timelineRail:{width:45,alignItems:'center'},completeDot:{width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',zIndex:2},timelineLine:{width:2,backgroundColor:'#39473F',flex:1,minHeight:82},journeyCard:{flex:1,minHeight:100,backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28332F',marginBottom:10,padding:12,flexDirection:'row',alignItems:'center',gap:11},journeyBadge:{width:44,height:44,borderRadius:12,backgroundColor:'#16302A',alignItems:'center',justifyContent:'center'},journeyCopy:{flex:1},journeyTitle:{color:'#F7F8F3',fontSize:15.5,fontWeight:'900'},journeyMeta:{color:'#AAB6B0',fontSize:12.5,marginTop:3},journeyStatusRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:7},journeyStatus:{color:'#67CFC8',fontSize:11.5,fontWeight:'800'},journeyDot:{color:'#67CFC8',fontSize:12},
 card:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16,gap:10},cardTitle:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},empty:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16},emptyInner:{backgroundColor:'#0C1411',borderRadius:14,padding:15,marginTop:4},emptyTitle:{color:'#F7F8F3',fontWeight:'900'},muted:{color:'#96A39B',lineHeight:20},body:{color:'#C8D0CB',lineHeight:22},
 editTitle:{fontSize:27,fontWeight:'900',color:'#FFF8E8'},label:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},gold:{color:'#D7B45A',fontWeight:'800',marginTop:2},input:{backgroundColor:'#101813',borderWidth:1,borderColor:'#314039',borderRadius:12,color:'#FFF8E8',paddingHorizontal:13,paddingVertical:12},bio:{minHeight:100,textAlignVertical:'top'},states:{gap:7},stateChip:{borderWidth:1,borderColor:'#435148',borderRadius:999,paddingHorizontal:11,paddingVertical:7},stateActive:{backgroundColor:'#D7B45A',borderColor:'#D7B45A'},stateText:{color:'#C6CEC8',fontWeight:'800'},stateTextActive:{color:'#17211C'},suggestion:{paddingVertical:10,borderTopWidth:1,borderTopColor:'#26332C'},suggestionTitle:{color:'#FFF8E8',fontWeight:'800'},primary:{backgroundColor:'#D7B45A',borderRadius:14,padding:14,alignItems:'center'},primaryText:{color:'#17211C',fontWeight:'900'},disabled:{opacity:.45},message:{color:'#E4D7B0',textAlign:'center'},privacyRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingTop:9,borderTopWidth:1,borderTopColor:'#26332C'},rowText:{color:'#FFF8E8',fontWeight:'700',flex:1},listRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,paddingVertical:10,borderTopWidth:1,borderTopColor:'#26332C'},listTitle:{color:'#FFF8E8',fontWeight:'800'},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{color:'#F0D083',backgroundColor:'#26372D',borderRadius:999,paddingHorizontal:10,paddingVertical:6,fontSize:12,fontWeight:'700'}
});