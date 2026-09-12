import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getConnections, type Connection } from '../community/circles';
import { getMemberBasecamp, removeProfileCover, removeProfilePhoto, saveProfileDetails, uploadProfileCover, uploadProfilePhoto } from './api';
import { ProfilePosts } from './ProfilePosts';
import { getJourney, getMemberBadges, getMemoryAlbums, getPassportStamps, type JourneyItem, type MemberBadge, type MemoryAlbum, type MemoryPhoto, type PassportStamp } from '../passport/api';
import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt';
import { STAMP_CATALOG, type StampCatalogItem } from '../passport/StampCatalog';
import { RankEmblem, rankFor, rankLadder } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';
import { searchWeatherLocations, type WeatherLocationSuggestion } from '../weather/api';

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

const INTERESTS=['Camping','Hiking','Water Adventures','Paddling','Fishing','Family Adventures','Road Trips','Wellness Outdoors','Photography','Volunteering'];
const COVER_ASPECT:[number,number]=[16,9];
type ProfileTab='journey'|'posts'|'photos'|'about';
type EarnedStampCard={stamp:PassportStamp;art:StampCatalogItem|null};

type Highlight={title:string;body:string};

function Avatar({url,name,size=76}:{url?:string|null;name?:string|null;size?:number}){
 const radius=size/2;
 if(url)return <Image source={{uri:url}} style={{width:size,height:size,borderRadius:radius,backgroundColor:'#F5C341'}}/>;
 return <View style={{width:size,height:size,borderRadius:radius,backgroundColor:'#F5C341',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:size*.4,fontWeight:'900',color:'#121A17'}}>{String(name??'A').slice(0,1).toUpperCase()}</Text></View>;
}

function initials(name?:string|null){
 return (name??'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join('')||'MA';
}

function formatDate(value?:string|null){
 if(!value)return '';
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 return date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

function placeLabel(item:JourneyItem){return [item.city,item.state].filter(Boolean).join(', ')}

function FeaturedStamp({item}:{item:EarnedStampCard}){
 return <Pressable style={({pressed})=>[styles.recognitionCard,pressed&&styles.pressed]} onPress={()=>router.push('/member/stamps')}>
  {item.art?<Image source={item.art.source} style={styles.stampImage} resizeMode="contain"/>:<View style={styles.genericRecognition}><AppIcon name="adventure" color="#F5C341" size={28}/></View>}
  <Text style={styles.recognitionTitle} numberOfLines={2}>{item.stamp.title}</Text>
 </Pressable>;
}

function FeaturedBadge({badge}:{badge:MemberBadge}){
 return <Pressable style={({pressed})=>[styles.recognitionCard,pressed&&styles.pressed]} onPress={()=>router.push('/member/badges')}>
  {hasBadgeArt(badge.title)?<BadgeArt title={badge.title} size={62}/>:<View style={styles.genericRecognition}><AppIcon name="badge" color="#F5C341" size={27}/></View>}
  <Text style={styles.recognitionTitle} numberOfLines={2}>{badge.title}</Text>
 </Pressable>;
}

export default function MemberProfileExperience(){
 const params=useLocalSearchParams<{edit?:string}>();
 const editScrollRef=useRef<ScrollView>(null);
 const [editing,setEditing]=useState(params.edit==='1');
 const [tab,setTab]=useState<ProfileTab>('journey');
 const [data,setData]=useState<any>(null);
 const [journey,setJourney]=useState<JourneyItem[]>([]);
 const [stamps,setStamps]=useState<PassportStamp[]>([]);
 const [badges,setBadges]=useState<MemberBadge[]>([]);
 const [albums,setAlbums]=useState<MemoryAlbum[]>([]);
 const [connections,setConnections]=useState<Connection[]>([]);
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
 const [interests,setInterests]=useState<string[]>([]);
 const [suggestions,setSuggestions]=useState<WeatherLocationSuggestion[]>([]);
 const [citySearching,setCitySearching]=useState(false);
 const selectedState=states.find(item=>item.code===state)??states[8];

 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const [base,nextJourney,nextStamps,nextBadges,nextAlbums,nextConnections]=await Promise.all([
    getMemberBasecamp(),getJourney(),getPassportStamps(),getMemberBadges(),getMemoryAlbums(),getConnections(),
   ]);
   setData(base);setJourney(nextJourney);setStamps(nextStamps);setBadges(nextBadges);setAlbums(nextAlbums);setConnections(nextConnections);
   const profile=base.profile??{};
   setName(profile.display_name??'');setUsername(profile.username??'');setBio(profile.bio??'');
   setState(profile.home_state??'FL');setCity(profile.home_city??'');setQuery(profile.home_city??'');
   setInterests(Array.isArray(profile.interests)?profile.interests:[]);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to load profile.')}finally{setLoading(false)}
 },[]);

 useFocusEffect(useCallback(()=>{void load()},[load]));
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
  try{
   await saveProfileDetails({display_name:name,username:username||null,bio:bio||null,home_city:city||null,home_state:state,interests});
   await load();setEditing(false);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to save profile.')}finally{setSaving(false)}
 }

 function toggleInterest(value:string){setInterests(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value].slice(0,6))}

 async function chooseProfilePhoto(){
  setMessage('');
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted){setMessage('Photo library access is needed to choose a profile picture.');return}
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],base64:true,quality:.85});
  if(result.canceled||!result.assets?.[0])return;
  setPhotoBusy(true);
  try{const asset=result.assets[0];const avatarUrl=await uploadProfilePhoto({uri:asset.uri,base64:asset.base64??undefined,mimeType:asset.mimeType});setData((current:any)=>({...current,profile:{...current.profile,avatar_url:avatarUrl}}))}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to update profile photo.')}finally{setPhotoBusy(false)}
 }
 async function removePhoto(){
  setPhotoBusy(true);setMessage('');
  try{await removeProfilePhoto();setData((current:any)=>({...current,profile:{...current.profile,avatar_url:null}}))}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to remove profile photo.')}finally{setPhotoBusy(false)}
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
  try{const asset=result.assets[0];const coverUrl=await uploadProfileCover({uri:asset.uri,base64:asset.base64??undefined,mimeType:asset.mimeType});setData((current:any)=>({...current,profile:{...current.profile,cover_url:coverUrl}}))}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to update cover image.')}finally{setCoverBusy(false)}
 }
 async function removeCover(){
  setCoverBusy(true);setMessage('');
  try{await removeProfileCover();setData((current:any)=>({...current,profile:{...current.profile,cover_url:null}}))}
  catch(error){setMessage(error instanceof Error?error.message:'Unable to remove cover image.')}finally{setCoverBusy(false)}
 }
 function coverMenu(){
  if(!data?.profile?.cover_url){void chooseCover();return}
  Alert.alert('Cover image','Choose what you want to do.',[{text:'Cancel',style:'cancel'},{text:'Change cover',onPress:()=>void chooseCover()},{text:'Remove cover',style:'destructive',onPress:()=>void removeCover()}]);
 }

 const profile=data?.profile??{};
 const trailmates=useMemo(()=>connections.filter(item=>item.status==='accepted'),[connections]);
 const pendingConnections=useMemo(()=>connections.filter(item=>item.status==='pending'),[connections]);
 const uniquePlaces=useMemo(()=>new Set(journey.map(item=>`${item.city}|${item.state}`.toLowerCase()).filter(Boolean)).size,[journey]);
 const rank=useMemo(()=>rankFor(journey.length),[journey.length]);
 const currentRank=useMemo(()=>rankLadder.find(([name])=>name===rank),[rank]);
 const nextRank=useMemo(()=>rankLadder.find(([,minimum])=>minimum>journey.length),[journey.length]);
 const remaining=nextRank?Math.max(0,nextRank[1]-journey.length):0;
 const rankProgress=useMemo(()=>{if(!nextRank)return 1;const floor=currentRank?.[1]??0;return Math.min(1,Math.max(0,(journey.length-floor)/Math.max(1,nextRank[1]-floor)))},[journey.length,currentRank,nextRank]);
 const location=[profile.home_city,profile.home_state].filter(Boolean).join(', ');
 const featuredBadges=badges.slice(0,3);
 const earnedStampCards=useMemo<EarnedStampCard[]>(()=>stamps.slice(0,3).map(stamp=>({stamp,art:STAMP_CATALOG.find(item=>(stamp.code&&item.code===stamp.code)||item.title.toLowerCase()===stamp.title.toLowerCase())??null})),[stamps]);
 const albumByAdventure=useMemo(()=>new Map(albums.map(album=>[album.adventure_id,album])),[albums]);
 const latestAlbum=albums[0];
 const coverUrl=profile.cover_url??latestAlbum?.cover_url??null;
 const recentAdventures=journey.slice(0,5);
 const favoriteMemories=useMemo(()=>{
  const all=albums.flatMap(album=>album.memories);
  const featured=all.filter(memory=>memory.featured);
  const rest=all.filter(memory=>!memory.featured);
  return [...featured,...rest].slice(0,6);
 },[albums]);
 const completionItems=useMemo(()=>[
  Boolean(profile.avatar_url),Boolean(profile.cover_url),Boolean(profile.bio?.trim()),Boolean(profile.username?.trim()),Boolean(location),Array.isArray(profile.interests)&&profile.interests.length>0,
 ],[profile.avatar_url,profile.cover_url,profile.bio,profile.username,profile.interests,location]);
 const completion=Math.round((completionItems.filter(Boolean).length/completionItems.length)*100);
 const highlights=useMemo<Highlight[]>(()=>{
  const items:Highlight[]=[];
  const first=journey[journey.length-1];
  if(first)items.push({title:'First chapter written',body:`${first.title} started your Trail.`});
  if(journey.length>=5)items.push({title:`${journey.length} adventures`,body:'Your outdoor story keeps growing.'});
  if(uniquePlaces>=5)items.push({title:`${uniquePlaces} places explored`,body:'Your Trail is stretching into new places.'});
  if(trailmates.length>=3)items.push({title:`${trailmates.length} Trailmates`,body:'You are building a crew around the outdoors.'});
  if(stamps.length>=5)items.push({title:`${stamps.length} stamps earned`,body:'Each stamp marks an adventure you showed up for.'});
  return items.slice(-3).reverse();
 },[journey,uniquePlaces,trailmates.length,stamps.length]);
 const statItems=[
  {label:'Adventures',value:journey.length,onPress:()=>router.push('/member/journey')},
  {label:'Places',value:uniquePlaces,onPress:()=>router.push('/member/journey')},
  {label:'TrailMates',value:trailmates.length,onPress:()=>router.push('/connections' as never)},
  {label:'Stamps',value:stamps.length,onPress:()=>router.push('/member/stamps')},
 ].filter(item=>item.value>0);

 async function shareProfile(){
  const display=profile.display_name??'Go Melanated member';
  const summary=[journey.length?`${journey.length} adventures`:null,uniquePlaces?`${uniquePlaces} places`:null,trailmates.length?`${trailmates.length} Trailmates`:null].filter(Boolean).join(', ');
  await Share.share({message:`${display}${profile.username?` (@${profile.username})`:''} on Go Melanated${summary?`: ${summary}`:'.'}`});
 }

 if(loading)return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341"/></SafeAreaView>;

 if(editing)return <SafeAreaView style={styles.safe}>
  <View style={styles.editTopBar}><Pressable onPress={()=>setEditing(false)} style={styles.editBack}><AppIcon name="chevron-forward" color="#F5C341" size={24} style={{transform:[{rotate:'180deg'}]}}/><Text style={styles.editBackText}>Profile</Text></Pressable><Pressable disabled={saving||!name.trim()||!city} onPress={()=>void save()} style={[styles.saveTopButton,(saving||!name.trim()||!city)&&styles.disabled]}><Text style={styles.saveTopButtonText}>{saving?'Saving…':'Save'}</Text></Pressable></View>
  <ScrollView ref={editScrollRef} contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
   {message?<Text style={styles.message}>{message}</Text>:null}
   <View style={styles.coverEditor}><Pressable onPress={coverMenu} disabled={coverBusy} style={styles.coverEditorPreview}>{coverUrl?<Image source={{uri:coverUrl}} style={styles.coverImage}/>:<View style={styles.coverPlaceholder}><AppIcon name="photos" color="#D7B45A" size={28}/><Text style={styles.coverPlaceholderText}>Add a cover image</Text></View>}{coverBusy?<View style={styles.mediaBusy}><ActivityIndicator color="#F5C341"/></View>:null}</Pressable><View style={styles.mediaEditCopy}><Text style={styles.editSectionTitle}>Profile cover</Text><Text style={styles.muted}>Use an image that feels like your outdoor life.</Text><Pressable onPress={coverMenu}><Text style={styles.photoAction}>{profile.cover_url?'Change cover':'Choose cover'}</Text></Pressable></View></View>
   <View style={styles.photoEditor}><Pressable onPress={photoMenu} disabled={photoBusy} style={styles.photoPressable}><Avatar url={profile.avatar_url} name={name} size={84}/><View style={styles.cameraBadge}><AppIcon name="camera" color="#121A17" size={15}/></View>{photoBusy?<View style={styles.photoBusy}><ActivityIndicator color="#F5C341"/></View>:null}</Pressable><View style={styles.mediaEditCopy}><Text style={styles.editSectionTitle}>Profile photo</Text><Text style={styles.muted}>This is how members recognize you across the app.</Text><Pressable onPress={photoMenu}><Text style={styles.photoAction}>{profile.avatar_url?'Change photo':'Choose photo'}</Text></Pressable></View></View>
   <View style={styles.card}><Text style={styles.label}>DISPLAY NAME</Text><TextInput value={name} onChangeText={setName} style={styles.input}/><Text style={styles.label}>USERNAME</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@trailname" placeholderTextColor="#66746B" style={styles.input}/><Text style={styles.label}>BIO</Text><TextInput value={bio} onChangeText={setBio} multiline maxLength={280} placeholder="Tell people what kind of outside you love." placeholderTextColor="#66746B" style={[styles.input,styles.bio]}/></View>
   <View style={styles.card}><Text style={styles.cardTitle}>Outdoor identity</Text><Text style={styles.muted}>Choose up to six interests. These help people understand how you like to get outside.</Text><View style={styles.interestGrid}>{Array.from(new Set([...INTERESTS,...interests])).map(value=>{const selected=interests.includes(value);return <Pressable key={value} onPress={()=>toggleInterest(value)} style={[styles.interestChoice,selected&&styles.interestChoiceSelected]}><Text style={[styles.interestChoiceText,selected&&styles.interestChoiceTextSelected]}>{value}</Text>{selected?<AppIcon name="checkmark" color="#17211C" size={14}/>:null}</Pressable>})}</View></View>
   <View style={styles.card}><Text style={styles.cardTitle}>Home location</Text><Text style={styles.muted}>Your profile uses city and state only, never a street address.</Text><Text style={styles.label}>STATE</Text><Pressable style={styles.dropdownControl} onPress={()=>{Keyboard.dismiss();setStateOpen(open=>!open);setTimeout(()=>editScrollRef.current?.scrollToEnd({animated:true}),80)}}><Text style={styles.dropdownValue}>{selectedState.name} ({state})</Text><AppIcon name="chevron-forward" color="#D7B45A" size={18} style={{transform:[{rotate:stateOpen?'270deg':'90deg'}]}}/></Pressable>
    {stateOpen?<ScrollView style={styles.stateDropdown} contentContainerStyle={styles.stateDropdownContent} nestedScrollEnabled>{states.map(item=><Pressable key={item.code} onPress={()=>{setState(item.code);setCity('');setQuery('');setSuggestions([]);setStateOpen(false)}} style={[styles.stateOption,state===item.code&&styles.stateOptionActive]}><Text style={[styles.stateOptionText,state===item.code&&styles.stateOptionTextActive]}>{item.name}</Text><Text style={[styles.stateCode,state===item.code&&styles.stateOptionTextActive]}>{item.code}</Text></Pressable>)}</ScrollView>:null}
    <Text style={styles.label}>CITY</Text><TextInput value={query} onFocus={()=>{setStateOpen(false);setTimeout(()=>editScrollRef.current?.scrollToEnd({animated:true}),160)}} onChangeText={value=>{setQuery(value);if(value!==city)setCity('')}} placeholder={`Search cities in ${selectedState.name}`} placeholderTextColor="#66746B" style={styles.input} autoCorrect={false}/>
    {citySearching?<View style={styles.citySearchStatus}><ActivityIndicator size="small" color="#D7B45A"/><Text style={styles.muted}>Finding cities…</Text></View>:null}
    {suggestions.length?<View style={styles.suggestionList}>{suggestions.map(item=><Pressable key={`${item.id}-${item.name}`} style={styles.suggestion} onPress={()=>{setCity(item.name);setQuery(item.name);setSuggestions([]);Keyboard.dismiss()}}><View><Text style={styles.suggestionTitle}>{item.name}</Text><Text style={styles.muted}>{item.region}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={18}/></Pressable>)}</View>:null}
    {city?<Text style={styles.gold}>Selected: {city}, {state}</Text>:<Text style={styles.muted}>Choose a city result before saving.</Text>}
   </View>
  </ScrollView>
 </SafeAreaView>;

 return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
  <View style={styles.hero}>
   {coverUrl?<Image source={{uri:coverUrl}} style={styles.coverImage}/>:<View style={styles.coverPlaceholder}><AppIcon name="adventure" color="#D7B45A" size={36}/></View>}
   <View style={styles.heroShade}/>
   <View style={styles.heroActions}><Pressable onPress={()=>void shareProfile()} style={styles.heroAction}><AppIcon name="share" color="#FFF8E8" size={16}/></Pressable><Pressable onPress={()=>setEditing(true)} style={styles.heroActionWide}><AppIcon name="edit" color="#FFF8E8" size={14}/><Text style={styles.heroActionText}>Edit</Text></Pressable></View>
  </View>

  <View style={styles.identityRow}>
   <Pressable onPress={photoMenu} style={styles.avatarWrap}><Avatar url={profile.avatar_url} name={profile.display_name} size={86}/><View style={styles.mainCameraBadge}><AppIcon name="camera" color="#121A17" size={11}/></View></Pressable>
   <View style={styles.identityCopy}><Text style={styles.name} numberOfLines={2}>{profile.display_name??'Adventurer'}</Text>{profile.username?<Text style={styles.handle}>@{profile.username}</Text>:null}{profile.city_visible!==false&&location?<View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={14}/><Text style={styles.location}>{location}</Text></View>:null}<View style={styles.rankLine}><RankEmblem rank={rank} size={23}/><Text style={styles.rankLineText}>{rank}</Text></View></View>
  </View>

  {profile.bio?<Text style={styles.bioText}>{profile.bio}</Text>:<Pressable onPress={()=>setEditing(true)} style={styles.bioPrompt}><AppIcon name="edit" color="#D7B45A" size={16}/><Text style={styles.bioPromptText}>Add a bio so people know what kind of outside you love.</Text></Pressable>}
  {Array.isArray(profile.interests)&&profile.interests.length?<View style={styles.headerChips}>{profile.interests.slice(0,6).map((interest:string)=><Text key={interest} style={styles.headerChip}>{interest}</Text>)}</View>:null}

  {statItems.length?<View style={styles.statsCard}>{statItems.map((item,index)=><Pressable key={item.label} onPress={item.onPress} style={styles.statCell}><Text style={styles.statValue}>{item.value}</Text><Text style={styles.statLabel}>{item.label}</Text>{index<statItems.length-1?<View style={styles.statDivider}/>:null}</Pressable>)}</View>:null}

  <View style={styles.tabs}>{(['journey','posts','photos','about'] as ProfileTab[]).map(value=><Pressable key={value} onPress={()=>setTab(value)} style={styles.tab}><Text style={[styles.tabText,tab===value&&styles.tabTextActive]}>{value.charAt(0).toUpperCase()+value.slice(1)}</Text>{tab===value?<View style={styles.tabUnderline}/>:null}</Pressable>)}</View>

  {tab==='journey'?<View style={styles.tabContent}>
   {completion<100?<Pressable onPress={()=>setEditing(true)} style={styles.completionCard}><View style={styles.completionTop}><View><Text style={styles.eyebrow}>MAKE YOUR PROFILE YOURS</Text><Text style={styles.completionTitle}>{completion}% complete</Text></View><Text style={styles.sectionLink}>Finish profile</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${completion}%`}]}/></View></Pressable>:null}

   <Pressable onPress={()=>router.push('/member/journey')} style={({pressed})=>[styles.trailFeature,pressed&&styles.pressed]}>
    {latestAlbum?.cover_url?<Image source={{uri:latestAlbum.cover_url}} style={styles.trailFeatureImage}/>:null}<View style={styles.trailFeatureShade}/><View style={styles.trailFeatureBody}><Text style={styles.eyebrow}>YOUR OUTDOOR LIFE, REMEMBERED</Text><Text style={styles.trailFeatureTitle}>Your Trail</Text><Text style={styles.trailFeatureText}>{journey.length?`${journey.length} adventure${journey.length===1?'':'s'} across ${uniquePlaces} place${uniquePlaces===1?'':'s'}.`:'Your first adventure becomes chapter one.'}</Text><View style={styles.featureLink}><Text style={styles.featureLinkText}>{journey.length?'Follow your Trail':'Find your next adventure'}</Text><AppIcon name="chevron-forward" color="#17211C" size={16}/></View></View>
   </Pressable>

   {recentAdventures.length?<><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Recent Adventures</Text><Text style={styles.sectionSub}>The newest chapters in your Trail.</Text></View><Pressable onPress={()=>router.push('/member/journey')}><Text style={styles.sectionLink}>View all</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adventureRail}>{recentAdventures.map(item=>{const album=albumByAdventure.get(item.adventure_id);return <Pressable key={item.adventure_id} onPress={()=>router.push(`/passport/memories/${item.adventure_id}` as never)} style={({pressed})=>[styles.adventureCard,pressed&&styles.pressed]}>{album?.cover_url?<Image source={{uri:album.cover_url}} style={styles.adventureImage}/>:<View style={styles.adventureImageFallback}><AppIcon name="adventure" color="#D7B45A" size={28}/></View>}<View style={styles.adventureBody}><Text style={styles.adventureTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.adventureMeta} numberOfLines={1}>{placeLabel(item)}</Text><Text style={styles.adventureMeta}>{formatDate(item.experienced_at||item.starts_at)}{item.photo_count?` · ${item.photo_count} photo${item.photo_count===1?'':'s'}`:''}</Text></View></Pressable>})}</ScrollView></>:null}

   <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Your People</Text><Text style={styles.sectionSub}>{trailmates.length?`${trailmates.length} Trailmate${trailmates.length===1?'':'s'} in your Trail Crew.`:'Build your Trail Crew as you meet people outside.'}</Text></View><Pressable onPress={()=>router.push('/connections' as never)}><Text style={styles.sectionLink}>Open crew</Text></Pressable></View>
   <Pressable onPress={()=>router.push('/connections' as never)} style={styles.peopleCard}><View style={styles.peopleAvatars}>{trailmates.slice(0,5).map((connection,index)=><View key={connection.connection_id} style={[styles.personAvatar,index>0&&styles.personAvatarOverlap]}>{connection.avatar_url?<Image source={{uri:connection.avatar_url}} style={styles.personAvatarImage}/>:<Text style={styles.personAvatarText}>{initials(connection.display_name)}</Text>}</View>)}{!trailmates.length?<View style={styles.emptyPerson}><AppIcon name="connections" color="#D7B45A" size={22}/></View>:null}</View><View style={styles.peopleCopy}><Text style={styles.peopleTitle}>{trailmates.length?'Your Trail Crew':'Find your people'}</Text><Text style={styles.peopleMeta}>{pendingConnections.length?`${pendingConnections.length} pending request${pendingConnections.length===1?'':'s'} · `:''}{trailmates.length?'See everyone you have connected with.':'Connections you make can live here.'}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={18}/></Pressable>

   {favoriteMemories.length?<><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Favorite Memories</Text><Text style={styles.sectionSub}>Photos from the adventures you want to remember.</Text></View><Pressable onPress={()=>setTab('photos')}><Text style={styles.sectionLink}>See photos</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memoryRail}>{favoriteMemories.map((memory:MemoryPhoto)=><Pressable key={memory.id} onPress={()=>router.push(`/passport/memories/photo/${memory.id}` as never)} style={styles.memoryCard}><Image source={{uri:memory.image_url}} style={styles.memoryImage}/>{memory.featured?<View style={styles.favoritePill}><Text style={styles.favoriteText}>Favorite</Text></View>:null}</Pressable>)}</ScrollView></>:null}

   {highlights.length?<><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Profile Highlights</Text><Text style={styles.sectionSub}>Moments that say something about your outdoor story.</Text></View></View><View style={styles.highlightGrid}>{highlights.map(item=><View key={item.title} style={styles.highlightCard}><View style={styles.highlightIcon}><AppIcon name="trail" color="#17211C" size={17}/></View><Text style={styles.highlightTitle}>{item.title}</Text><Text style={styles.highlightBody}>{item.body}</Text></View>)}</View></>:null}

   {featuredBadges.length?<><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Badge Showcase</Text><Pressable onPress={()=>router.push('/member/badges')}><Text style={styles.sectionLink}>View all</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recognitionRail}>{featuredBadges.map(badge=><FeaturedBadge key={badge.badge_id} badge={badge}/>)}</ScrollView></>:null}
   {earnedStampCards.length?<><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Featured Stamps</Text><Pressable onPress={()=>router.push('/member/stamps')}><Text style={styles.sectionLink}>View all</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recognitionRail}>{earnedStampCards.map(item=><FeaturedStamp key={item.stamp.stamp_id} item={item}/>)}</ScrollView></>:null}
  </View>:null}

  {tab==='posts'?<View style={styles.tabContent}><ProfilePosts/></View>:null}

  {tab==='photos'?<View style={styles.tabContent}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Photos</Text><Text style={styles.sectionSub}>Your adventure albums and saved memories.</Text></View></View>{albums.map(album=><Pressable key={album.adventure_id} style={({pressed})=>[styles.photoAlbumCard,pressed&&styles.pressed]} onPress={()=>router.push(`/passport/photos/${album.adventure_id}` as never)}><View style={styles.albumCoverWrap}>{album.cover_url?<Image source={{uri:album.cover_url}} style={styles.albumCover}/>:<View style={styles.albumCoverPlaceholder}><AppIcon name="photos" color="#D7B45A" size={34}/></View>}<View style={styles.albumCountPill}><AppIcon name="photos" color="#FFF8E8" size={12}/><Text style={styles.albumCountText}>{album.memories.length}</Text></View></View><View style={styles.albumFooter}><View style={{flex:1}}><Text style={styles.albumTitle}>{album.title}</Text><Text style={styles.albumMeta}>{placeLabel(album)}</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={18}/></View></Pressable>)}{!albums.length?<View style={styles.empty}><AppIcon name="photos" color="#D7B45A" size={28}/><Text style={styles.emptyTitle}>Your photo story starts with a memory</Text><Text style={styles.muted}>Photos you save from adventures will collect here.</Text></View>:null}</View>:null}

  {tab==='about'?<View style={styles.tabContent}>
   <View style={styles.aboutCard}><View style={styles.rankHeader}><RankEmblem rank={rank} size={38}/><View style={{flex:1}}><Text style={styles.sectionTitle}>{rank}</Text><Text style={styles.sectionSub}>{nextRank?`${remaining} adventure${remaining===1?'':'s'} to ${nextRank[0]}`:'Highest rank reached'}</Text></View></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${Math.max(8,rankProgress*100)}%`}]}/></View></View>
   <View style={styles.aboutCard}><Text style={styles.sectionTitle}>About you</Text>{location?<View style={styles.aboutRow}><AppIcon name="location" color="#D7B45A" size={18}/><View><Text style={styles.aboutLabel}>Home base</Text><Text style={styles.aboutValue}>{location}</Text></View></View>:null}<View style={styles.aboutRow}><AppIcon name="calendar" color="#D7B45A" size={18}/><View><Text style={styles.aboutLabel}>Member since</Text><Text style={styles.aboutValue}>{profile.created_at?new Date(profile.created_at).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'Recently'}</Text></View></View></View>
   <View style={styles.aboutCard}><Text style={styles.sectionTitle}>Profile controls</Text><Pressable onPress={()=>setEditing(true)} style={styles.settingsRow}><AppIcon name="edit" color="#D7B45A" size={18}/><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>Edit profile</Text><Text style={styles.settingsBody}>Photo, cover, bio, interests and home base.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17}/></Pressable><Pressable onPress={()=>router.push('/member/privacy' as never)} style={styles.settingsRow}><AppIcon name="privacy" color="#D7B45A" size={18}/><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>Privacy</Text><Text style={styles.settingsBody}>Control what other members can see.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17}/></Pressable><Pressable onPress={()=>router.push('/member/discovery-settings' as never)} style={styles.settingsRow}><AppIcon name="explore" color="#D7B45A" size={18}/><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>Discovery</Text><Text style={styles.settingsBody}>Choose whether people can find you.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17}/></Pressable>{profile.id?<Pressable onPress={()=>router.push(`/member/view-as-profile/${profile.id}` as never)} style={styles.settingsRow}><AppIcon name="privacy" color="#D7B45A" size={18}/><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>View as member</Text><Text style={styles.settingsBody}>Preview what your profile looks like to someone else.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={17}/></Pressable>:null}</View>
  </View>:null}
 </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#09110F'},center:{flex:1,backgroundColor:'#09110F',alignItems:'center',justifyContent:'center'},content:{paddingHorizontal:16,paddingTop:8,paddingBottom:112,gap:12},tabContent:{gap:14},pressed:{opacity:.65},
 hero:{aspectRatio:16/8.4,borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:'#27332F',backgroundColor:'#111A17',position:'relative'},coverImage:{width:'100%',height:'100%',resizeMode:'cover'},heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(4,10,8,.2)'},coverPlaceholder:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#14231C'},coverPlaceholderText:{color:'#D7B45A',fontWeight:'800'},heroActions:{position:'absolute',right:10,top:10,flexDirection:'row',gap:8},heroAction:{width:36,height:36,borderRadius:18,backgroundColor:'rgba(9,17,15,.86)',borderWidth:1,borderColor:'rgba(255,255,255,.2)',alignItems:'center',justifyContent:'center'},heroActionWide:{height:36,borderRadius:18,paddingHorizontal:12,backgroundColor:'rgba(9,17,15,.86)',borderWidth:1,borderColor:'rgba(255,255,255,.2)',flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'},heroActionText:{color:'#FFF8E8',fontSize:12,fontWeight:'900'},
 identityRow:{flexDirection:'row',gap:12,paddingHorizontal:8,marginTop:-34,zIndex:2},avatarWrap:{width:86,height:86,borderRadius:43,borderWidth:4,borderColor:'#09110F',backgroundColor:'#09110F',position:'relative'},mainCameraBadge:{position:'absolute',right:-2,bottom:3,width:24,height:24,borderRadius:12,backgroundColor:'#F5C341',borderWidth:2,borderColor:'#09110F',alignItems:'center',justifyContent:'center'},identityCopy:{flex:1,minWidth:0,paddingTop:38},name:{fontSize:26,lineHeight:29,fontWeight:'900',color:'#F7F8F3',letterSpacing:-.4},handle:{color:'#F5C341',fontSize:13,fontWeight:'800',marginTop:1},locationRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:3},location:{color:'#AEB9B4',fontSize:13},rankLine:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4},rankLineText:{color:'#F7F8F3',fontSize:12,fontWeight:'900'},
 bioText:{color:'#D4DBD7',fontSize:14.5,lineHeight:20,paddingHorizontal:8},bioPrompt:{marginHorizontal:8,minHeight:42,borderRadius:14,borderWidth:1,borderColor:'#344239',backgroundColor:'#111A17',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9},bioPromptText:{color:'#BAC4BE',fontSize:12.5,flex:1},headerChips:{flexDirection:'row',flexWrap:'wrap',gap:6,paddingHorizontal:8},headerChip:{color:'#E5C977',backgroundColor:'#203029',borderRadius:999,paddingHorizontal:10,paddingVertical:6,fontSize:10.5,fontWeight:'800'},
 statsCard:{flexDirection:'row',borderRadius:18,borderWidth:1,borderColor:'#29362F',backgroundColor:'#111A17',paddingVertical:10,overflow:'hidden'},statCell:{flex:1,alignItems:'center',justifyContent:'center',gap:1,position:'relative'},statValue:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},statLabel:{color:'#93A097',fontSize:10.5,fontWeight:'800'},statDivider:{position:'absolute',right:0,top:5,bottom:5,width:1,backgroundColor:'#28352F'},
 tabs:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#28322E'},tab:{flex:1,alignItems:'center',paddingVertical:9,position:'relative'},tabText:{color:'#A8B2AD',fontSize:12,fontWeight:'800'},tabTextActive:{color:'#F5C341'},tabUnderline:{height:2,backgroundColor:'#F5C341',position:'absolute',bottom:-1,left:12,right:12,borderRadius:4},
 completionCard:{borderRadius:17,borderWidth:1,borderColor:'#4C5F50',backgroundColor:'#17251E',padding:13,gap:9},completionTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},completionTitle:{color:'#FFF8E8',fontSize:17,fontWeight:'900',marginTop:2},eyebrow:{color:'#D7B45A',fontSize:8.5,fontWeight:'900',letterSpacing:1},progressTrack:{height:6,borderRadius:999,backgroundColor:'#2B3730',overflow:'hidden'},progressFill:{height:'100%',borderRadius:999,backgroundColor:'#D7B45A'},
 trailFeature:{minHeight:210,borderRadius:22,overflow:'hidden',backgroundColor:'#1B2B22',borderWidth:1,borderColor:'#4D6654',position:'relative'},trailFeatureImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%',resizeMode:'cover'},trailFeatureShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(8,17,13,.67)'},trailFeatureBody:{flex:1,padding:18,justifyContent:'flex-end',alignItems:'flex-start'},trailFeatureTitle:{color:'#FFF8E8',fontSize:29,fontWeight:'900',letterSpacing:-.5,marginTop:3},trailFeatureText:{color:'#D3DED7',fontSize:13,lineHeight:18,marginTop:3,maxWidth:290},featureLink:{marginTop:12,minHeight:34,borderRadius:17,backgroundColor:'#D7B45A',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:4},featureLinkText:{color:'#17211C',fontSize:11.5,fontWeight:'900'},
 sectionHeader:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:10,marginTop:2},sectionTitle:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},sectionSub:{color:'#8F9C95',fontSize:11.5,lineHeight:16,marginTop:2},sectionLink:{color:'#67CFC8',fontSize:12,fontWeight:'900'},
 adventureRail:{gap:10,paddingRight:16},adventureCard:{width:214,borderRadius:18,overflow:'hidden',backgroundColor:'#111A17',borderWidth:1,borderColor:'#29362F'},adventureImage:{width:'100%',height:118,resizeMode:'cover'},adventureImageFallback:{height:118,backgroundColor:'#192720',alignItems:'center',justifyContent:'center'},adventureBody:{padding:12,gap:3},adventureTitle:{color:'#FFF8E8',fontSize:15,fontWeight:'900',lineHeight:18},adventureMeta:{color:'#8F9C95',fontSize:10.5},
 peopleCard:{minHeight:76,borderRadius:18,borderWidth:1,borderColor:'#2C3A32',backgroundColor:'#111A17',padding:12,flexDirection:'row',alignItems:'center',gap:10},peopleAvatars:{flexDirection:'row',alignItems:'center',paddingLeft:4},personAvatar:{width:38,height:38,borderRadius:19,borderWidth:2,borderColor:'#111A17',backgroundColor:'#26342A',alignItems:'center',justifyContent:'center',overflow:'hidden'},personAvatarOverlap:{marginLeft:-10},personAvatarImage:{width:'100%',height:'100%'},personAvatarText:{color:'#D7B45A',fontSize:10,fontWeight:'900'},emptyPerson:{width:38,height:38,borderRadius:19,backgroundColor:'#223128',alignItems:'center',justifyContent:'center'},peopleCopy:{flex:1,minWidth:0},peopleTitle:{color:'#FFF8E8',fontSize:14,fontWeight:'900'},peopleMeta:{color:'#8F9C95',fontSize:10.5,lineHeight:15,marginTop:2},
 memoryRail:{gap:8,paddingRight:16},memoryCard:{width:132,height:132,borderRadius:17,overflow:'hidden',backgroundColor:'#18251F',position:'relative'},memoryImage:{width:'100%',height:'100%',resizeMode:'cover'},favoritePill:{position:'absolute',left:7,bottom:7,backgroundColor:'rgba(9,17,15,.84)',paddingHorizontal:8,paddingVertical:4,borderRadius:999},favoriteText:{color:'#F5C341',fontSize:8.5,fontWeight:'900'},
 highlightGrid:{gap:8},highlightCard:{borderRadius:17,borderWidth:1,borderColor:'#2C3A32',backgroundColor:'#111A17',padding:13},highlightIcon:{width:31,height:31,borderRadius:16,backgroundColor:'#D7B45A',alignItems:'center',justifyContent:'center',marginBottom:8},highlightTitle:{color:'#FFF8E8',fontSize:14,fontWeight:'900'},highlightBody:{color:'#91A097',fontSize:11.5,lineHeight:16,marginTop:2},
 recognitionRail:{gap:9,paddingRight:16},recognitionCard:{width:112,minHeight:124,borderRadius:17,borderWidth:1,borderColor:'#29342F',backgroundColor:'#111A17',padding:9,alignItems:'center',justifyContent:'center'},stampImage:{width:'100%',height:86},genericRecognition:{width:62,height:62,borderRadius:31,borderWidth:1,borderColor:'#D7B45A',backgroundColor:'#21302A',alignItems:'center',justifyContent:'center'},recognitionTitle:{color:'#F7F8F3',fontWeight:'800',fontSize:10,lineHeight:13,textAlign:'center',marginTop:5},
 photoAlbumCard:{borderRadius:20,overflow:'hidden',backgroundColor:'#111A17',borderWidth:1,borderColor:'#28362E'},albumCoverWrap:{width:'100%',aspectRatio:16/8.5,position:'relative',backgroundColor:'#17211C'},albumCover:{width:'100%',height:'100%',resizeMode:'cover'},albumCoverPlaceholder:{width:'100%',height:'100%',alignItems:'center',justifyContent:'center',backgroundColor:'#17241E'},albumCountPill:{position:'absolute',right:10,top:10,minHeight:28,borderRadius:14,paddingHorizontal:9,backgroundColor:'rgba(9,17,15,.82)',flexDirection:'row',alignItems:'center',gap:5},albumCountText:{color:'#FFF8E8',fontSize:11,fontWeight:'900'},albumFooter:{minHeight:58,paddingHorizontal:14,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10},albumTitle:{color:'#F7F8F3',fontSize:15,fontWeight:'900'},albumMeta:{color:'#8F9B94',fontSize:11,marginTop:2},
 empty:{borderRadius:18,borderWidth:1,borderColor:'#28362E',backgroundColor:'#111A17',padding:18,alignItems:'center',gap:5},emptyTitle:{color:'#F7F8F3',fontWeight:'900',textAlign:'center'},muted:{color:'#96A39B',lineHeight:19},
 aboutCard:{borderRadius:18,borderWidth:1,borderColor:'#28362E',backgroundColor:'#111A17',padding:15,gap:12},rankHeader:{flexDirection:'row',alignItems:'center',gap:10},aboutRow:{flexDirection:'row',alignItems:'center',gap:10},aboutLabel:{color:'#8E9A94',fontSize:10,fontWeight:'800'},aboutValue:{color:'#FFF8E8',fontSize:13,fontWeight:'800',marginTop:1},settingsRow:{minHeight:58,flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:1,borderTopColor:'#25312B',paddingTop:10},settingsCopy:{flex:1},settingsTitle:{color:'#FFF8E8',fontSize:13,fontWeight:'900'},settingsBody:{color:'#8F9C95',fontSize:10.5,lineHeight:15,marginTop:2},
 editContent:{padding:20,paddingBottom:160,gap:14},editTopBar:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#24302B'},editBack:{flexDirection:'row',alignItems:'center'},editBackText:{color:'#F5C341',fontWeight:'800'},saveTopButton:{minWidth:72,minHeight:36,borderRadius:999,paddingHorizontal:16,alignItems:'center',justifyContent:'center',backgroundColor:'#D7B45A'},saveTopButtonText:{color:'#17211C',fontSize:13,fontWeight:'900'},disabled:{opacity:.45},message:{color:'#E4D7B0',textAlign:'center'},
 coverEditor:{backgroundColor:'#111A17',borderRadius:20,borderWidth:1,borderColor:'#28362E',overflow:'hidden'},coverEditorPreview:{aspectRatio:16/9,backgroundColor:'#0E1713'},mediaEditCopy:{padding:14,gap:4},mediaBusy:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(9,17,15,.68)',alignItems:'center',justifyContent:'center'},photoEditor:{flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'#111A17',borderRadius:20,borderWidth:1,borderColor:'#28362E',padding:15},photoPressable:{width:84,height:84,borderRadius:42,position:'relative'},cameraBadge:{position:'absolute',right:-1,bottom:2,width:28,height:28,borderRadius:14,backgroundColor:'#F5C341',borderWidth:3,borderColor:'#111A17',alignItems:'center',justifyContent:'center'},photoBusy:{position:'absolute',left:0,right:0,top:0,bottom:0,borderRadius:42,backgroundColor:'rgba(9,17,15,.68)',alignItems:'center',justifyContent:'center'},editSectionTitle:{fontSize:19,fontWeight:'900',color:'#FFF8E8'},photoAction:{color:'#F5C341',fontWeight:'900',marginTop:2},
 card:{backgroundColor:'#111A17',borderRadius:18,borderWidth:1,borderColor:'#28362E',padding:16,gap:10},cardTitle:{color:'#F7F8F3',fontSize:20,fontWeight:'900'},label:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},gold:{color:'#D7B45A',fontWeight:'800',marginTop:2},input:{backgroundColor:'#101813',borderWidth:1,borderColor:'#314039',borderRadius:12,color:'#FFF8E8',paddingHorizontal:13,paddingVertical:12},bio:{minHeight:100,textAlignVertical:'top'},
 interestGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},interestChoice:{borderRadius:999,borderWidth:1,borderColor:'#36443C',backgroundColor:'#152019',paddingHorizontal:11,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:5},interestChoiceSelected:{backgroundColor:'#D7B45A',borderColor:'#D7B45A'},interestChoiceText:{color:'#C4CEC8',fontSize:11,fontWeight:'800'},interestChoiceTextSelected:{color:'#17211C'},
 dropdownControl:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:'#314039',backgroundColor:'#101813',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},dropdownValue:{color:'#FFF8E8',fontSize:15,fontWeight:'800'},stateDropdown:{maxHeight:260,backgroundColor:'#0D1512',borderWidth:1,borderColor:'#314039',borderRadius:12},stateDropdownContent:{padding:6},stateOption:{minHeight:46,borderRadius:10,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},stateOptionActive:{backgroundColor:'#D7B45A'},stateOptionText:{color:'#D7DED9',fontWeight:'800',fontSize:14},stateOptionTextActive:{color:'#17211C'},stateCode:{color:'#839088',fontWeight:'900',fontSize:12},citySearchStatus:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4},suggestionList:{borderWidth:1,borderColor:'#314039',borderRadius:12,overflow:'hidden',backgroundColor:'#0D1512'},suggestion:{minHeight:58,paddingHorizontal:12,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#26332C',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},suggestionTitle:{color:'#FFF8E8',fontWeight:'900'},
});