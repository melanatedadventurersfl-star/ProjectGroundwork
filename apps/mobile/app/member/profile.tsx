import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp, removeProfileCover, removeProfilePhoto, saveProfileDetails, uploadProfileCover, uploadProfilePhoto } from '../../src/member/api';
import { ProfilePosts } from '../../src/member/ProfilePosts';
import { getJourney, getMemberBadges, getPassportStamps, type MemberBadge, type PassportStamp } from '../../src/passport/api';
import { BadgeArt, hasBadgeArt } from '../../src/passport/BadgeArt';
import { FEATURED_STAMPS, type StampCatalogItem } from '../../src/passport/StampCatalog';
import { RankEmblem, rankFor, rankLadder } from '../../src/passport/RankEmblem';
import { AppIcon } from '../../src/ui/AppIcon';
import { searchWeatherLocations, type WeatherLocationSuggestion } from '../../src/weather/api';

const states=[
 {code:'AL',name:'Alabama'},{code:'AK',name:'Alaska'},{code:'AZ',name:'Arizona'},{code:'AR',name:'Arkansas'},{code:'CA',name:'California'},
 {code:'CO',name:'Colorado'},{code:'CT',name:'Connecticut'},{code:'DE',name:'Delaware'},{code:'FL',name:'Florida'},{code:'GA',name:'Georgia'},
 {code:'HI',name:'Hawaii'},{code:'ID',name:'Idaho'},{code:'IL',name:'Illinois'},{code:'IN',name:'Indiana'},{code:'IA',name:'Iowa'},
 {code:'KS',name:'Kansas'},{code:'KY',name:'Kentucky'},{code:'LA',name:'Louisiana'},{code:'ME',name:'Maine'},{code:'MD',name:'Maryland'},
 {code:'MA',name:'Massachusetts'},{code:'MI',name:'Michigan'},{code:'MN',name:'Minnesota'},{code:'MS',name:'Mississippi'},{code:'MO',name:'Missouri'},
 {code:'MT',name:'Montana'},{code:'NE',name:'Nebraska'},{code:'NV',name:'Nevada'},{code:'NH',name:'New Hampshire'},{code:'NJ',name:'New Jersey'},
 {code:'NM',name:'New Mexico'},{code:'NY',name:'New York'},{code:'NC',name:'North Carolina'},{code:'ND',name:'North Dakota'},{code:'OH',name:'Ohio'},
 {code:'OK',name:'Oklahoma'},{code:'OR',name:'Oregon'},{code:'PA',name:'Pennsylvania'},{code:'RI',name:'Rhode Island'},{code:'SC',name:'South Carolina'},
 {code:'SD',name:'South Dakota'},{code:'TN',name:'Tennessee'},{code:'TX',name:'Texas'},{code:'UT',name:'Utah'},{code:'VT',name:'Vermont'},
 {code:'VA',name:'Virginia'},{code:'WA',name:'Washington'},{code:'WV',name:'West Virginia'},{code:'WI',name:'Wisconsin'},{code:'WY',name:'Wyoming'},
] as const;

const COVER_ASPECT:[number,number]=[12,5];
type ProfileTab='journey'|'posts'|'photos'|'about';

function formatDate(value?:string|null){
 if(!value)return '';
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 return date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:date.getFullYear()!==new Date().getFullYear()?'numeric':undefined});
}

function Avatar({url,name,size=82}:{url?:string|null;name?:string|null;size?:number}){
 const radius=size/2;
 if(url)return <Image source={{uri:url}} style={{width:size,height:size,borderRadius:radius,backgroundColor:'#F5C341'}}/>;
 return <View style={{width:size,height:size,borderRadius:radius,backgroundColor:'#F5C341',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:size*.42,fontWeight:'900',color:'#121A17'}}>{String(name??'A').slice(0,1).toUpperCase()}</Text></View>;
}

function JourneyStat({value,label,onPress}:{value:number;label:string;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={`View ${label}`} onPress={onPress} style={({pressed})=>[styles.journeyStat,pressed&&styles.pressed]}>
  <Text style={styles.journeyStatValue}>{value}</Text><Text style={styles.journeyStatLabel}>{label}</Text>
 </Pressable>;
}

function FeaturedStamp({stamp}:{stamp:StampCatalogItem}){
 return <Pressable style={({pressed})=>[styles.stampCard,pressed&&styles.pressed]} onPress={()=>router.push('/member/stamps')}>
  <Image source={stamp.source} style={styles.stampImage} resizeMode="contain"/>
  <Text style={styles.stampTitle} numberOfLines={2}>{stamp.title}</Text>
 </Pressable>;
}

function FeaturedBadge({badge}:{badge:MemberBadge}){
 return <Pressable style={({pressed})=>[styles.badgeCard,pressed&&styles.pressed]} onPress={()=>router.push('/member/badges')}>
  {hasBadgeArt(badge.title)?<BadgeArt title={badge.title} size={68}/>:<View style={styles.genericBadge}><AppIcon name="badge" color="#F5C341" size={30}/></View>}
  <Text style={styles.badgeTitle} numberOfLines={2}>{badge.title}</Text>
 </Pressable>;
}

export default function ProfileScreen(){
 const params=useLocalSearchParams<{edit?:string}>();
 const editScrollRef=useRef<ScrollView>(null);
 const [editing,setEditing]=useState(params.edit==='1');
 const [tab,setTab]=useState<ProfileTab>('journey');
 const [data,setData]=useState<any>(null);
 const [journey,setJourney]=useState<any[]>([]);
 const [stamps,setStamps]=useState<PassportStamp[]>([]);
 const [badges,setBadges]=useState<MemberBadge[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [photoBusy,setPhotoBusy]=useState(false);
 const [coverBusy,setCoverBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [name,setName]=useState('');
 const [username,setUsername]=useState('');
 const [bio,setBio]=useState('');
 const [state,setState]=useState('FL');
 const [stateOpen,setStateOpen]=useState(false);
 const [city,setCity]=useState('');
 const [query,setQuery]=useState('');
 const [suggestions,setSuggestions]=useState<WeatherLocationSuggestion[]>([]);
 const [citySearching,setCitySearching]=useState(false);
 const selectedState=states.find(item=>item.code===state)??states[8];

 async function load(){
  setLoading(true);
  try{
   const [base,nextJourney,nextStamps,nextBadges]=await Promise.all([getMemberBasecamp(),getJourney(),getPassportStamps(),getMemberBadges()]);
   setData(base);setJourney(nextJourney);setStamps(nextStamps);setBadges(nextBadges);
   const profile=base.profile??{};
   setName(profile.display_name??'');setUsername(profile.username??'');setBio(profile.bio??'');
   setState(profile.home_state??'FL');setCity(profile.home_city??'');setQuery(profile.home_city??'');
  }finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 useEffect(()=>{
  if(!editing||query.trim().length<2||query===city){setSuggestions([]);setCitySearching(false);return}
  let active=true;setCitySearching(true);
  const timer=setTimeout(()=>{
   void searchWeatherLocations(`${query.trim()}, ${selectedState.name}`)
    .then(rows=>{if(!active)return;const inState=rows.filter(row=>row.country==='United States'&&row.region.toLowerCase()===selectedState.name.toLowerCase());setSuggestions((inState.length?inState:rows.filter(row=>row.country==='United States')).slice(0,6));setTimeout(()=>editScrollRef.current?.scrollToEnd({animated:true}),80)})
    .catch(()=>{if(active)setSuggestions([])}).finally(()=>{if(active)setCitySearching(false)});
  },300);
  return()=>{active=false;clearTimeout(timer)};
 },[editing,query,state,city,selectedState.name]);

 async function save(){
  setSaving(true);setMessage('');
  try{await saveProfileDetails({display_name:name,username:username||null,bio:bio||null,home_city:city||null,home_state:state});setMessage('Profile saved.');await load();setEditing(false)}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to save profile.')}
  finally{setSaving(false)}
 }

 async function chooseProfilePhoto(){
  setMessage('');
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted){setMessage('Photo library access is needed to choose a profile picture.');return}
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],base64:true,quality:.85});
  if(result.canceled||!result.assets?.[0])return;
  setPhotoBusy(true);
  try{
   const asset=result.assets[0];
   const avatarUrl=await uploadProfilePhoto({uri:asset.uri,base64:asset.base64??undefined,mimeType:asset.mimeType});
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
  Alert.alert('Profile photo','Choose what you want to do.',[{text:'Cancel',style:'cancel'},{text:'Change photo',onPress:()=>void chooseProfilePhoto()},{text:'Remove photo',style:'destructive',onPress:()=>void removePhoto()}]);
 }

 async function chooseCover(){
  setMessage('');
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted){setMessage('Photo library access is needed to choose a cover image.');return}
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:COVER_ASPECT,base64:true,quality:.85});
  if(result.canceled||!result.assets?.[0])return;
  setCoverBusy(true);
  try{
   const asset=result.assets[0];
   const coverUrl=await uploadProfileCover({uri:asset.uri,base64:asset.base64??undefined,mimeType:asset.mimeType});
   setData((current:any)=>({...current,profile:{...current.profile,cover_url:coverUrl}}));
   setMessage('Cover image updated.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to update cover image.')}
  finally{setCoverBusy(false)}
 }
 async function removeCover(){
  setCoverBusy(true);setMessage('');
  try{await removeProfileCover();setData((current:any)=>({...current,profile:{...current.profile,cover_url:null}}));setMessage('Cover image removed.')}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to remove cover image.')}
  finally{setCoverBusy(false)}
 }
 function coverMenu(){
  if(!data?.profile?.cover_url){void chooseCover();return}
  Alert.alert('Cover image','Choose what you want to do.',[{text:'Cancel',style:'cancel'},{text:'Change cover',onPress:()=>void chooseCover()},{text:'Remove cover',style:'destructive',onPress:()=>void removeCover()}]);
 }

 const profile=data?.profile??{};
 const rank=useMemo(()=>rankFor(journey.length),[journey.length]);
 const nextRank=useMemo(()=>rankLadder.find(([,minimum])=>minimum>journey.length),[journey.length]);
 const nextMinimum=nextRank?.[1]??Math.max(journey.length,1);
 const progress=nextRank?Math.max(0,Math.min(1,journey.length/nextMinimum)):1;
 const remaining=nextRank?Math.max(0,nextRank[1]-journey.length):0;
 const location=[profile.home_city,profile.home_state].filter(Boolean).join(', ');
 const totalPhotos=journey.reduce((sum,item)=>sum+(Number(item.photo_count)||0),0);
 const featuredStamps=FEATURED_STAMPS;
 const featuredBadges=badges.slice(0,3);
 const fallbackCover=journey.find(item=>item.hero_image_url)?.hero_image_url??null;
 const coverUrl=profile.cover_url??fallbackCover;
 if(loading)return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341"/></SafeAreaView>;

 if(editing)return <SafeAreaView style={styles.safe}>
  <View style={styles.editTopBar}><Pressable onPress={()=>setEditing(false)} style={styles.editBack}><AppIcon name="chevron-forward" color="#F5C341" size={24} style={{transform:[{rotate:'180deg'}]}}/><Text style={styles.editBackText}>Profile</Text></Pressable><Pressable disabled={saving||!name.trim()||!city} onPress={()=>void save()} style={[styles.saveTopButton,(saving||!name.trim()||!city)&&styles.disabled]}><Text style={styles.saveTopButtonText}>{saving?'Saving…':'Save'}</Text></Pressable></View>
  <ScrollView ref={editScrollRef} contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
   {message?<Text style={styles.message}>{message}</Text>:null}
   <View style={styles.coverEditor}>
    <Pressable onPress={coverMenu} disabled={coverBusy} style={styles.coverEditorPreview}>{coverUrl?<Image source={{uri:coverUrl}} style={styles.coverImage}/>:<View style={styles.coverPlaceholder}><AppIcon name="photos" color="#D7B45A" size={28}/><Text style={styles.coverPlaceholderText}>Add a cover image</Text></View>}{coverBusy?<View style={styles.mediaBusy}><ActivityIndicator color="#F5C341"/></View>:null}</Pressable>
    <View style={styles.mediaEditCopy}><Text style={styles.editSectionTitle}>Profile cover</Text><Text style={styles.muted}>A wide image that sets the tone for your profile.</Text><Pressable onPress={coverMenu} disabled={coverBusy}><Text style={styles.photoAction}>{profile.cover_url?'Change cover':'Choose cover'}</Text></Pressable></View>
   </View>
   <View style={styles.photoEditor}><Pressable onPress={photoMenu} disabled={photoBusy} style={styles.photoPressable}><Avatar url={profile.avatar_url} name={name} size={84}/><View style={styles.cameraBadge}><AppIcon name="camera" color="#121A17" size={15}/></View>{photoBusy?<View style={styles.photoBusy}><ActivityIndicator color="#F5C341"/></View>:null}</Pressable><View style={styles.mediaEditCopy}><Text style={styles.editSectionTitle}>Profile photo</Text><Text style={styles.muted}>Your main photo across Go Melanated.</Text><Pressable onPress={photoMenu} disabled={photoBusy}><Text style={styles.photoAction}>{profile.avatar_url?'Change photo':'Choose photo'}</Text></Pressable></View></View>
   <View style={styles.card}><Text style={styles.label}>DISPLAY NAME</Text><TextInput value={name} onChangeText={setName} style={styles.input}/><Text style={styles.label}>USERNAME · OPTIONAL</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@trailname" placeholderTextColor="#66746B" style={styles.input}/><Text style={styles.label}>BIO</Text><TextInput value={bio} onChangeText={setBio} multiline maxLength={280} placeholder="Tell the community what kind of outside you love." placeholderTextColor="#66746B" style={[styles.input,styles.bio]}/></View>
   <View style={styles.card}><Text style={styles.cardTitle}>Home location</Text><Text style={styles.muted}>Choose your state, then select a verified city.</Text><Text style={styles.label}>STATE</Text><Pressable style={styles.dropdownControl} onPress={()=>{Keyboard.dismiss();setStateOpen(open=>!open);setTimeout(()=>editScrollRef.current?.scrollToEnd({animated:true}),80)}}><Text style={styles.dropdownValue}>{selectedState.name} ({state})</Text><AppIcon name="chevron-forward" color="#D7B45A" size={18} style={{transform:[{rotate:stateOpen?'270deg':'90deg'}]}}/></Pressable>
    {stateOpen?<ScrollView style={styles.stateDropdown} contentContainerStyle={styles.stateDropdownContent} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>{states.map(item=><Pressable key={item.code} onPress={()=>{setState(item.code);setCity('');setQuery('');setSuggestions([]);setStateOpen(false)}} style={[styles.stateOption,state===item.code&&styles.stateOptionActive]}><Text style={[styles.stateOptionText,state===item.code&&styles.stateOptionTextActive]}>{item.name}</Text><View style={styles.stateCodeRow}><Text style={[styles.stateCode,state===item.code&&styles.stateOptionTextActive]}>{item.code}</Text>{state===item.code?<AppIcon name="checkmark" color="#17211C" size={16}/>:null}</View></Pressable>)}</ScrollView>:null}
    <Text style={styles.label}>CITY</Text><TextInput value={query} onFocus={()=>{setStateOpen(false);setTimeout(()=>editScrollRef.current?.scrollToEnd({animated:true}),160)}} onChangeText={value=>{setQuery(value);if(value!==city)setCity('')}} placeholder={`Search cities in ${selectedState.name}`} placeholderTextColor="#66746B" style={styles.input} autoCorrect={false}/>
    {citySearching?<View style={styles.citySearchStatus}><ActivityIndicator size="small" color="#D7B45A"/><Text style={styles.muted}>Finding cities…</Text></View>:null}
    {suggestions.length?<View style={styles.suggestionList}>{suggestions.map(item=><Pressable key={`${item.id}-${item.name}`} style={styles.suggestion} onPress={()=>{setCity(item.name);setQuery(item.name);setSuggestions([]);Keyboard.dismiss()}}><View><Text style={styles.suggestionTitle}>{item.name}</Text><Text style={styles.muted}>{item.region}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={18}/></Pressable>)}</View>:null}
    {city?<Text style={styles.gold}>Selected: {city}, {state}</Text>:<Text style={styles.muted}>Tap a city result to confirm it before saving.</Text>}
   </View>
  </ScrollView>
 </SafeAreaView>;

 return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
  <View style={styles.topBar}><Pressable onPress={()=>router.back()} hitSlop={10}><AppIcon name="chevron-forward" color="#F5C341" size={26} style={{transform:[{rotate:'180deg'}]}}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Edit profile" style={styles.editPill} onPress={()=>setEditing(true)}><AppIcon name="edit" color="#F5C341" size={15}/><Text style={styles.editPillText}>Edit</Text></Pressable></View>

  <View style={styles.coverShell}>{coverUrl?<Image source={{uri:coverUrl}} style={styles.coverImage}/>:<View style={styles.coverPlaceholder}><AppIcon name="adventure" color="#D7B45A" size={34}/><Text style={styles.coverPlaceholderText}>Make this profile yours</Text></View>}<View style={styles.coverShade}/><Pressable onPress={coverMenu} style={styles.coverEditButton}><AppIcon name="camera" color="#F7F8F3" size={14}/></Pressable></View>

  <View style={styles.profileIdentity}>
   <Pressable onPress={photoMenu} style={styles.avatarWrap}><Avatar url={profile.avatar_url} name={profile.display_name}/><View style={styles.mainCameraBadge}><AppIcon name="camera" color="#121A17" size={12}/></View></Pressable>
   <View style={styles.identityCopy}><Text style={styles.name} numberOfLines={2}>{profile.display_name??'Adventurer'}</Text>{profile.username?<Text style={styles.handle}>@{profile.username}</Text>:null}{profile.city_visible!==false&&location?<View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={14}/><Text style={styles.location}>{location}</Text></View>:null}</View>
  </View>
  <Text style={styles.bioText}>{profile.bio||'Add a short bio to tell the community what kind of outside you love.'}</Text>

  <View style={styles.achievementCard}>
   <View style={styles.achievementTopRow}>
    <View style={styles.rankIcon}><RankEmblem rank={rank} size={56}/></View>
    <View style={styles.rankCopy}><Text style={styles.rankName}>{rank.toUpperCase()}</Text><Text style={styles.rankSubtitle}>{nextRank?`${remaining} adventure${remaining===1?'':'s'} to ${nextRank[0]}`:'Highest rank reached'}</Text><Text style={styles.rankAdventureCount}>{journey.length} Adventure{journey.length===1?'':'s'}</Text>{nextRank?<View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${progress*100}%`}]}/></View>:null}</View>
   </View>
   <View style={styles.achievementDivider}/>
   <View style={styles.journeyStatsRow}><JourneyStat value={stamps.length} label="Stamps" onPress={()=>router.push('/member/stamps')}/><View style={styles.statDivider}/><JourneyStat value={badges.length} label="Badges" onPress={()=>router.push('/member/badges')}/></View>
  </View>

  <View style={styles.tabs}>{(['journey','posts','photos','about'] as ProfileTab[]).map(value=><Pressable key={value} onPress={()=>setTab(value)} style={styles.tab}><Text style={[styles.tabText,tab===value&&styles.tabTextActive]}>{value.charAt(0).toUpperCase()+value.slice(1)}</Text>{tab===value?<View style={styles.tabUnderline}/>:null}</Pressable>)}</View>

  {tab==='journey'?<>
   <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Featured Stamps</Text><Pressable onPress={()=>router.push('/member/stamps')} style={styles.sectionLinkWrap}><Text style={styles.sectionLink}>View all</Text><AppIcon name="chevron-forward" color="#67CFC8" size={15}/></Pressable></View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stampsRow}>{featuredStamps.map(stamp=><FeaturedStamp key={stamp.id} stamp={stamp}/>)}</ScrollView>

   <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent Adventures</Text><Pressable onPress={()=>router.push('/past-adventures')} style={styles.sectionLinkWrap}><Text style={styles.sectionLink}>View all</Text><AppIcon name="chevron-forward" color="#67CFC8" size={15}/></Pressable></View>
   {journey.length?<View style={styles.timeline}>{journey.slice(0,4).map((item,index)=><Pressable key={item.adventure_id} style={styles.timelineRow} onPress={()=>router.push(`/passport/reflection/${item.adventure_id}`)}><View style={styles.timelineRail}><View style={styles.completeDot}><AppIcon name="checkmark" color="#F7F8F3" size={22}/></View>{index<Math.min(journey.length,4)-1?<View style={styles.timelineLine}/>:null}</View><View style={styles.journeyCard}><View style={styles.journeyBadge}><AppIcon name="adventure" color="#F5C341" size={21}/></View><View style={styles.journeyCopy}><Text style={styles.journeyTitle}>{item.title}</Text><Text style={styles.journeyMeta}>{formatDate(item.experienced_at||item.starts_at)}{item.city?` · ${item.city}`:''}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={21}/></View></Pressable>)}</View>:<View style={styles.empty}><Text style={styles.emptyTitle}>Your journey starts with the first adventure</Text><Text style={styles.muted}>Completed official Adventures will build your timeline here.</Text></View>}

   <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Badge Showcase</Text><Pressable onPress={()=>router.push('/member/badges')} style={styles.sectionLinkWrap}><Text style={styles.sectionLink}>View all</Text><AppIcon name="chevron-forward" color="#67CFC8" size={15}/></Pressable></View>
   {featuredBadges.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>{featuredBadges.map(badge=><FeaturedBadge key={badge.badge_id} badge={badge}/>)}</ScrollView>:<View style={styles.empty}><Text style={styles.emptyTitle}>Your badge case is waiting</Text><Text style={styles.muted}>Milestones you earn will appear here.</Text></View>}
  </>:null}

  {tab==='posts'?<ProfilePosts/>:null}
  {tab==='photos'?<View style={styles.card}><Text style={styles.cardTitle}>Photos</Text><Text style={styles.muted}>Your photos stay organized around the adventures they came from.</Text>{journey.filter(item=>Number(item.photo_count)>0).map(item=><Pressable key={item.adventure_id} style={styles.listRow} onPress={()=>router.push(`/passport/photos/${item.adventure_id}`)}><View><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.muted}>{item.photo_count} photo{Number(item.photo_count)===1?'':'s'}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={22}/></Pressable>)}{totalPhotos===0?<View style={styles.emptyInner}><Text style={styles.emptyTitle}>No adventure photos yet</Text><Text style={styles.muted}>Photos added to memories will collect here automatically.</Text></View>:null}</View>:null}
  {tab==='about'?<View style={styles.card}><Text style={styles.cardTitle}>About</Text><Text style={styles.body}>{profile.bio||'Add a short bio to tell the community what kind of outside you love.'}</Text>{Array.isArray(profile.interests)&&profile.interests.length?<View style={styles.chips}>{profile.interests.map((interest:string)=><Text key={interest} style={styles.chip}>{interest}</Text>)}</View>:null}<Text style={styles.muted}>Joined {profile.created_at?new Date(profile.created_at).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'recently'}</Text></View>:null}
 </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#09110F'},center:{flex:1,backgroundColor:'#09110F',alignItems:'center',justifyContent:'center'},content:{paddingHorizontal:18,paddingTop:8,paddingBottom:108,gap:12},editContent:{padding:20,paddingBottom:160,gap:14},pressed:{opacity:.58},
 topBar:{minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},editPill:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#171D1B',borderWidth:1,borderColor:'#252E2A',borderRadius:999,paddingHorizontal:11,paddingVertical:7,minWidth:64,justifyContent:'center'},editPillText:{color:'#F5C341',fontWeight:'800',fontSize:13},
 coverShell:{aspectRatio:12/5,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:'#27332F',backgroundColor:'#111A17',position:'relative'},coverImage:{width:'100%',height:'100%',resizeMode:'cover'},coverShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(4,10,8,.20)'},coverPlaceholder:{flex:1,alignItems:'center',justifyContent:'center',gap:7,backgroundColor:'#122019'},coverPlaceholderText:{color:'#D7B45A',fontWeight:'800'},coverEditButton:{position:'absolute',right:10,bottom:10,width:32,height:32,borderRadius:16,backgroundColor:'rgba(9,17,15,.78)',borderWidth:1,borderColor:'rgba(245,195,65,.55)',alignItems:'center',justifyContent:'center'},
 profileIdentity:{flexDirection:'row',alignItems:'flex-end',gap:12,marginTop:-43,paddingHorizontal:10,zIndex:2},avatarWrap:{width:82,height:82,position:'relative',borderRadius:41,borderWidth:3,borderColor:'#09110F',backgroundColor:'#09110F'},mainCameraBadge:{position:'absolute',right:-2,bottom:2,width:25,height:25,borderRadius:13,backgroundColor:'#F5C341',borderWidth:2,borderColor:'#09110F',alignItems:'center',justifyContent:'center'},identityCopy:{flex:1,minWidth:0,paddingBottom:4},name:{fontSize:27,fontWeight:'900',lineHeight:30,color:'#F7F8F3',letterSpacing:-.45},handle:{color:'#F5C341',fontSize:14,fontWeight:'800',marginTop:1},locationRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:3},location:{color:'#AEB9B4',fontSize:13},bioText:{color:'#D4DBD7',fontSize:14.5,lineHeight:20,paddingHorizontal:10,marginTop:5},
 achievementCard:{backgroundColor:'#111A17',borderWidth:1,borderColor:'#32443A',borderRadius:20,paddingHorizontal:14,paddingVertical:10},achievementTopRow:{flexDirection:'row',alignItems:'center',gap:10},rankIcon:{width:64,alignItems:'center',justifyContent:'center'},rankCopy:{flex:1,minWidth:0},rankName:{color:'#F7F8F3',fontSize:17,fontWeight:'900',letterSpacing:.5},rankSubtitle:{color:'#67CFC8',fontSize:11.5,fontWeight:'800',marginTop:1},rankAdventureCount:{color:'#D4DBD7',fontSize:12.5,fontWeight:'800',marginTop:4},progressTrack:{height:4,borderRadius:99,backgroundColor:'#194B4B',overflow:'hidden',marginTop:6},progressFill:{height:'100%',backgroundColor:'#F5C341',borderRadius:99},achievementDivider:{height:1,backgroundColor:'#2A3731',marginTop:10,marginBottom:8},
 journeyStatsRow:{flexDirection:'row',alignItems:'stretch'},journeyStat:{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:1},journeyStatValue:{color:'#F7F8F3',fontSize:21,fontWeight:'900'},journeyStatLabel:{color:'#AAB5B0',fontSize:11,fontWeight:'700',marginTop:1},statDivider:{width:1,backgroundColor:'#324038',marginVertical:3},
 tabs:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#28322E'},tab:{flex:1,alignItems:'center',paddingTop:8,paddingBottom:8,position:'relative'},tabText:{color:'#A8B2AD',fontSize:13,fontWeight:'800'},tabTextActive:{color:'#F5C341'},tabUnderline:{height:2,backgroundColor:'#F5C341',position:'absolute',bottom:-1,left:18,right:18,borderRadius:4},
 sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:2},sectionTitle:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},sectionLinkWrap:{flexDirection:'row',alignItems:'center',gap:2},sectionLink:{color:'#67CFC8',fontSize:12.5,fontWeight:'800'},stampsRow:{gap:9,paddingRight:20},stampCard:{width:122,minHeight:150,backgroundColor:'#111A17',borderRadius:17,borderWidth:1,borderColor:'#29342F',padding:8,alignItems:'center'},stampImage:{width:'100%',height:112},stampTitle:{color:'#F7F8F3',fontWeight:'800',fontSize:10.5,lineHeight:13,textAlign:'center',marginTop:2},badgesRow:{gap:9,paddingRight:20},badgeCard:{width:116,minHeight:128,backgroundColor:'#111A17',borderRadius:17,borderWidth:1,borderColor:'#29342F',padding:10,alignItems:'center',justifyContent:'center'},badgeTitle:{color:'#F7F8F3',fontWeight:'800',fontSize:10.5,lineHeight:13,textAlign:'center',marginTop:6},genericBadge:{width:64,height:64,borderRadius:32,borderWidth:1,borderColor:'#D7B45A',backgroundColor:'#21302A',alignItems:'center',justifyContent:'center'},
 timeline:{gap:0},timelineRow:{flexDirection:'row'},timelineRail:{width:36,alignItems:'center'},completeDot:{width:27,height:27,borderRadius:14,alignItems:'center',justifyContent:'center',zIndex:2},timelineLine:{width:2,backgroundColor:'#39473F',flex:1,minHeight:64},journeyCard:{flex:1,minHeight:78,backgroundColor:'#111A17',borderRadius:17,borderWidth:1,borderColor:'#28332F',marginBottom:9,padding:11,flexDirection:'row',alignItems:'center',gap:10},journeyBadge:{width:39,height:39,borderRadius:11,backgroundColor:'#16302A',alignItems:'center',justifyContent:'center'},journeyCopy:{flex:1},journeyTitle:{color:'#F7F8F3',fontSize:14.5,fontWeight:'900'},journeyMeta:{color:'#AAB6B0',fontSize:11.5,marginTop:3},
 card:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16,gap:10},cardTitle:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},empty:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16},emptyInner:{backgroundColor:'#0C1411',borderRadius:14,padding:15,marginTop:4},emptyTitle:{color:'#F7F8F3',fontWeight:'900'},muted:{color:'#96A39B',lineHeight:20},body:{color:'#C8D0CB',lineHeight:22},
 editTopBar:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#24302B',backgroundColor:'#09110F'},editBack:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start'},editBackText:{color:'#F5C341',fontWeight:'800'},saveTopButton:{minWidth:72,minHeight:36,borderRadius:999,paddingHorizontal:16,alignItems:'center',justifyContent:'center',backgroundColor:'#D7B45A'},saveTopButtonText:{color:'#17211C',fontSize:13,fontWeight:'900'},coverEditor:{backgroundColor:'#111A17',borderRadius:20,borderWidth:1,borderColor:'#28362E',overflow:'hidden'},coverEditorPreview:{aspectRatio:12/5,backgroundColor:'#0E1713'},mediaEditCopy:{padding:14,gap:4},photoEditor:{flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'#111A17',borderRadius:20,borderWidth:1,borderColor:'#28362E',padding:15},photoPressable:{width:84,height:84,borderRadius:42,position:'relative'},cameraBadge:{position:'absolute',right:-1,bottom:2,width:28,height:28,borderRadius:14,backgroundColor:'#F5C341',borderWidth:3,borderColor:'#111A17',alignItems:'center',justifyContent:'center'},photoBusy:{position:'absolute',left:0,right:0,top:0,bottom:0,borderRadius:42,backgroundColor:'rgba(9,17,15,.68)',alignItems:'center',justifyContent:'center'},mediaBusy:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(9,17,15,.68)',alignItems:'center',justifyContent:'center'},editSectionTitle:{fontSize:19,fontWeight:'900',color:'#FFF8E8'},photoAction:{color:'#F5C341',fontWeight:'900',marginTop:2},
 label:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},gold:{color:'#D7B45A',fontWeight:'800',marginTop:2},input:{backgroundColor:'#101813',borderWidth:1,borderColor:'#314039',borderRadius:12,color:'#FFF8E8',paddingHorizontal:13,paddingVertical:12},bio:{minHeight:100,textAlignVertical:'top'},dropdownControl:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:'#314039',backgroundColor:'#101813',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},dropdownValue:{color:'#FFF8E8',fontSize:15,fontWeight:'800'},stateDropdown:{maxHeight:260,backgroundColor:'#0D1512',borderWidth:1,borderColor:'#314039',borderRadius:12},stateDropdownContent:{padding:6},stateOption:{minHeight:46,borderRadius:10,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},stateOptionActive:{backgroundColor:'#D7B45A'},stateOptionText:{color:'#D7DED9',fontWeight:'800',fontSize:14},stateOptionTextActive:{color:'#17211C'},stateCodeRow:{flexDirection:'row',alignItems:'center',gap:6},stateCode:{color:'#839088',fontWeight:'900',fontSize:12},citySearchStatus:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4},suggestionList:{borderWidth:1,borderColor:'#314039',borderRadius:12,overflow:'hidden',backgroundColor:'#0D1512'},suggestion:{minHeight:58,paddingHorizontal:12,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#26332C',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},suggestionTitle:{color:'#FFF8E8',fontWeight:'900'},disabled:{opacity:.45},message:{color:'#E4D7B0',textAlign:'center'},listRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,paddingVertical:10,borderTopWidth:1,borderTopColor:'#26332C'},listTitle:{color:'#FFF8E8',fontWeight:'800'},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{color:'#F0D083',backgroundColor:'#26372D',borderRadius:999,paddingHorizontal:10,paddingVertical:6,fontSize:12,fontWeight:'700'}
});