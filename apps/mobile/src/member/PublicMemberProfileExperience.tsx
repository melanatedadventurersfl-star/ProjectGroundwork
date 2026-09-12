import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';
import { ProfilePosts } from './ProfilePosts';
import { BadgeArt, hasBadgeArt } from '../passport/BadgeArt';
import { RankEmblem, rankFor, rankLadder } from '../passport/RankEmblem';
import { resolveStampCatalogItem, type StampCatalogItem } from '../passport/StampCatalog';
import { AppIcon } from '../ui/AppIcon';
import {
  getCommunityProfile,
  getConnectionStatus,
  getViewerInterests,
  requestConnection,
  respondToConnection,
  type CommunityFeaturedBadge,
  type CommunityFeaturedStamp,
  type CommunityProfile,
  type ConnectionStatus,
} from '../social/api';

type ProfileTab='journey'|'posts'|'photos'|'about';
type PublicStampCard={stamp:CommunityFeaturedStamp;art:StampCatalogItem};

function Avatar({url,name}:{url?:string|null;name?:string|null}){
 if(url)return <Image source={{uri:url}} style={styles.avatar}/>;
 return <View style={styles.avatar}><Text style={styles.avatarText}>{String(name??'A').slice(0,1).toUpperCase()}</Text></View>;
}

function FeaturedBadge({badge}:{badge:CommunityFeaturedBadge}){
 return <View style={styles.recognitionItem}><BadgeArt title={badge.title} size={96}/><Text style={styles.recognitionTitle} numberOfLines={2}>{badge.title}</Text></View>;
}

function FeaturedStamp({item}:{item:PublicStampCard}){
 return <View style={styles.recognitionItem}><Image source={item.art.source} style={styles.stampImage} resizeMode="contain"/><Text style={styles.recognitionTitle} numberOfLines={2}>{item.stamp.title}</Text></View>;
}

export default function PublicMemberProfileExperience(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [profile,setProfile]=useState<CommunityProfile|null>(null);
 const [connectionStatus,setConnectionStatus]=useState<ConnectionStatus>('none');
 const [connectionId,setConnectionId]=useState<string|null>(null);
 const [viewerInterests,setViewerInterests]=useState<string[]>([]);
 const [canViewAsMember,setCanViewAsMember]=useState(false);
 const [tab,setTab]=useState<ProfileTab>('journey');
 const [loading,setLoading]=useState(true);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState<string|null>(null);

 const load=useCallback(async()=>{
  if(!id)return;
  setLoading(true);
  try{
   const [nextProfile,connection,interests,viewAsGate]=await Promise.all([getCommunityProfile(id),getConnectionStatus(id),getViewerInterests(),supabase.rpc('can_view_as_member')]);
   setProfile(nextProfile);setConnectionStatus(connection.status);setConnectionId(connection.connectionId);setViewerInterests(interests);setCanViewAsMember(!viewAsGate.error&&viewAsGate.data===true);setError(null);
  }catch(caught){setError(caught instanceof Error?caught.message:'Unable to load this member profile.')}finally{setLoading(false)}
 },[id]);

 useFocusEffect(useCallback(()=>{void load()},[load]));

 async function act(action:'request'|'accept'|'decline'){
  if(!id)return;
  setWorking(true);
  try{
   if(action==='request')await requestConnection(id);
   if(action==='accept'&&connectionId)await respondToConnection(connectionId,'accepted');
   if(action==='decline'&&connectionId)await respondToConnection(connectionId,'declined');
   await load();
  }catch(caught){setError(caught instanceof Error?caught.message:'Unable to update this Trailmate connection.')}finally{setWorking(false)}
 }

 const adventureCount=profile?.adventure_count??0;
 const rank=useMemo(()=>rankFor(adventureCount),[adventureCount]);
 const currentRank=useMemo(()=>rankLadder.find(([name])=>name===rank),[rank]);
 const nextRank=useMemo(()=>rankLadder.find(([,minimum])=>minimum>adventureCount),[adventureCount]);
 const remaining=nextRank?Math.max(0,nextRank[1]-adventureCount):0;
 const rankProgress=useMemo(()=>{if(!nextRank)return 1;const floor=currentRank?.[1]??0;return Math.min(1,Math.max(0,(adventureCount-floor)/Math.max(1,nextRank[1]-floor)))},[adventureCount,currentRank,nextRank]);
 const viewerInterestSet=useMemo(()=>new Set(viewerInterests.map(item=>item.trim().toLowerCase())),[viewerInterests]);

 if(loading)return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341"/></SafeAreaView>;
 if(!profile)return <SafeAreaView style={styles.center}><Text style={styles.error}>{error??'Profile not found.'}</Text></SafeAreaView>;
 if(connectionStatus==='self'){router.replace('/member/profile');return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341"/></SafeAreaView>}

 const location=[profile.home_city,profile.home_state].filter(Boolean).join(', ');
 const sharedInterests=(profile.interests??[]).filter(item=>viewerInterestSet.has(item.trim().toLowerCase()));
 const statItems=[
  {label:'Adventures',value:profile.adventure_count},
  {label:'Albums',value:profile.photo_albums.length},
  {label:'Posts',value:profile.post_count},
  {label:'Stamps',value:profile.stamp_count},
 ].filter(item=>item.value>0);
 const latestAlbum=profile.photo_albums[0];
 const joined=new Date(profile.created_at).toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const featuredBadges=profile.featured_badges.filter(badge=>hasBadgeArt(badge.title)).slice(0,3);
 const featuredStamps=profile.featured_stamps
  .map(stamp=>({stamp,art:resolveStampCatalogItem(stamp)}))
  .filter((item):item is PublicStampCard=>Boolean(item.art))
  .slice(0,3);

 async function shareProfile(){
  if(!profile)return;
  const summary=[profile.adventure_count?`${profile.adventure_count} adventures`:null,profile.stamp_count?`${profile.stamp_count} stamps`:null].filter(Boolean).join(', ');
  await Share.share({message:`${profile.display_name??'A Go Melanated member'}${profile.username?` (@${profile.username})`:''} on Go Melanated${summary?`: ${summary}`:'.'}`});
 }

 const connectionAction=()=>{
  if(connectionStatus==='accepted')return <View style={styles.connectedPill}><AppIcon name="connections" color="#FFF8E8" size={16}/><Text style={styles.connectedText}>Trailmate</Text></View>;
  if(connectionStatus==='pending_sent')return <View style={styles.pendingPill}><AppIcon name="checkmark" color="#F5C341" size={15}/><Text style={styles.pendingText}>Request sent</Text></View>;
  if(connectionStatus==='pending_received')return <View style={styles.requestCard}><Text style={styles.requestTitle}>Trailmate request</Text><Text style={styles.requestBody}>This member wants to connect with you.</Text><View style={styles.requestActions}><Pressable disabled={working} onPress={()=>void act('accept')} style={styles.primarySmall}><Text style={styles.primaryText}>Accept</Text></Pressable><Pressable disabled={working} onPress={()=>void act('decline')} style={styles.secondarySmall}><Text style={styles.secondaryText}>Decline</Text></Pressable></View></View>;
  if(connectionStatus==='blocked')return null;
  return <Pressable disabled={working} onPress={()=>void act('request')} style={styles.primaryButton}><AppIcon name="connections" color="#17211C" size={17}/><Text style={styles.primaryText}>{working?'Sending…':'Add Trailmate'}</Text></Pressable>;
 };

 return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
  <View style={styles.hero}>{profile.cover_url?<Image source={{uri:profile.cover_url}} style={styles.coverImage}/>:<View style={styles.coverPlaceholder}><AppIcon name="adventure" color="#D7B45A" size={36}/></View>}<View style={styles.heroShade}/><Pressable onPress={()=>router.back()} style={styles.backButton}><AppIcon name="chevron-forward" color="#FFF8E8" size={23} style={{transform:[{rotate:'180deg'}]}}/></Pressable><Pressable onPress={()=>void shareProfile()} style={styles.shareButton}><AppIcon name="share" color="#FFF8E8" size={16}/></Pressable></View>

  <View style={styles.identityRow}><View style={styles.avatarWrap}><Avatar url={profile.avatar_url} name={profile.display_name}/></View><View style={styles.identityCopy}><Text style={styles.name}>{profile.display_name??'Adventurer'}</Text>{profile.username?<Text style={styles.handle}>@{profile.username}</Text>:null}{location?<View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={14}/><Text style={styles.location}>{location}</Text></View>:null}<View style={styles.rankLine}><RankEmblem rank={rank} size={23}/><Text style={styles.rankLineText}>{rank}</Text></View></View></View>

  {profile.bio?<Text style={styles.bioText}>{profile.bio}</Text>:null}
  {profile.interests_visible&&profile.interests?.length?<View style={styles.headerChips}>{profile.interests.slice(0,6).map(interest=>{const shared=viewerInterestSet.has(interest.trim().toLowerCase());return <View key={interest} style={[styles.headerChip,shared&&styles.headerChipShared]}><Text style={[styles.headerChipText,shared&&styles.headerChipTextShared]}>{interest}</Text></View>})}</View>:null}

  <View style={styles.actionRow}><View style={{flex:1}}>{connectionAction()}</View>{canViewAsMember?<Pressable onPress={()=>router.push(`/member/view-as-profile/${profile.id}` as never)} style={styles.viewAsButton}><AppIcon name="privacy" color="#D7B45A" size={16}/></Pressable>:null}</View>

  {sharedInterests.length?<View style={styles.sharedCard}><AppIcon name="community" color="#D7B45A" size={19}/><View style={{flex:1}}><Text style={styles.sharedTitle}>You have {sharedInterests.length} interest{sharedInterests.length===1?'':'s'} in common</Text><Text style={styles.sharedBody}>{sharedInterests.slice(0,3).join(' · ')}</Text></View></View>:null}

  {profile.can_see_full_profile&&statItems.length?<View style={styles.statsCard}>{statItems.map((item,index)=><View key={item.label} style={styles.statCell}><Text style={styles.statValue}>{item.value}</Text><Text style={styles.statLabel}>{item.label}</Text>{index<statItems.length-1?<View style={styles.statDivider}/>:null}</View>)}</View>:null}

  {!profile.can_see_full_profile?<View style={styles.privateCard}><AppIcon name="privacy" color="#F5C341" size={24}/><View style={{flex:1}}><Text style={styles.privateTitle}>Private profile</Text><Text style={styles.privateBody}>More profile details become visible after this member approves your connection.</Text></View></View>:<>
   <View style={styles.tabs}>{(['journey','posts','photos','about'] as ProfileTab[]).map(value=><Pressable key={value} onPress={()=>setTab(value)} style={styles.tab}><Text style={[styles.tabText,tab===value&&styles.tabTextActive]}>{value.charAt(0).toUpperCase()+value.slice(1)}</Text>{tab===value?<View style={styles.tabUnderline}/>:null}</Pressable>)}</View>

   {tab==='journey'?<View style={styles.tabContent}>
    <View style={styles.trailFeature}>{latestAlbum?.cover_url?<Image source={{uri:latestAlbum.cover_url}} style={styles.trailFeatureImage}/>:null}<View style={styles.trailFeatureShade}/><View style={styles.trailFeatureBody}><Text style={styles.eyebrow}>THEIR OUTDOOR STORY</Text><Text style={styles.trailFeatureTitle}>{profile.display_name?.split(' ')[0]??'Their'} Trail</Text><Text style={styles.trailFeatureText}>{profile.adventure_count?`${profile.adventure_count} completed adventure${profile.adventure_count===1?'':'s'} are part of this story.`:'Their first completed adventure will become chapter one.'}</Text></View></View>

    {profile.photo_albums.length?<><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Shared Adventures</Text><Text style={styles.sectionSub}>Adventures where this member shared photos.</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumRail}>{profile.photo_albums.slice(0,5).map(album=><View key={album.adventure_id} style={styles.sharedAdventureCard}>{album.cover_url&&/^(https?:|data:)/i.test(album.cover_url)?<Image source={{uri:album.cover_url}} style={styles.sharedAdventureImage}/>:<View style={styles.sharedAdventureFallback}><AppIcon name="photos" color="#D7B45A" size={25}/></View>}<View style={styles.sharedAdventureBody}><Text style={styles.sharedAdventureTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.sharedAdventureMeta}>{album.photo_count} photo{album.photo_count===1?'':'s'}</Text></View></View>)}</ScrollView></>:null}

    {featuredBadges.length?<><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Badge Showcase</Text><Text style={styles.sectionSub}>Recognition earned through participation.</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recognitionRail}>{featuredBadges.map(badge=><FeaturedBadge key={badge.badge_id} badge={badge}/>)}</ScrollView></>:null}
    {featuredStamps.length?<><View style={[styles.sectionHeader,styles.recognitionSectionSpacing]}><View><Text style={styles.sectionTitle}>Featured Stamps</Text><Text style={styles.sectionSub}>Adventure stamps from their Trail.</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recognitionRail}>{featuredStamps.map(item=><FeaturedStamp key={item.stamp.stamp_id} item={item}/>)}</ScrollView></>:null}
   </View>:null}

   {tab==='posts'?<View style={styles.tabContent}><ProfilePosts profileId={profile.id}/></View>:null}

   {tab==='photos'?<View style={styles.tabContent}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Photos</Text><Text style={styles.sectionSub}>Adventure moments this member chose to share.</Text></View></View><View style={styles.photoGrid}>{profile.photo_albums.map(album=><View key={album.adventure_id} style={styles.photoTile}>{album.cover_url&&/^(https?:|data:)/i.test(album.cover_url)?<Image source={{uri:album.cover_url}} style={styles.photoTileImage}/>:<View style={styles.photoTileFallback}><AppIcon name="photos" color="#D7B45A" size={28}/></View>}<View style={styles.photoTileShade}/><View style={styles.photoTileCopy}><Text style={styles.photoTileTitle} numberOfLines={2}>{album.title}</Text><Text style={styles.photoTileMeta}>{album.photo_count} photo{album.photo_count===1?'':'s'}</Text></View></View>)}</View>{!profile.photo_albums.length?<View style={styles.empty}><AppIcon name="photos" color="#D7B45A" size={28}/><Text style={styles.emptyTitle}>No shared adventure photos yet</Text></View>:null}</View>:null}

   {tab==='about'?<View style={styles.tabContent}><View style={styles.aboutCard}><View style={styles.rankHeader}><RankEmblem rank={rank} size={38}/><View style={{flex:1}}><Text style={styles.sectionTitle}>{rank}</Text><Text style={styles.sectionSub}>{nextRank?`${remaining} adventure${remaining===1?'':'s'} to ${nextRank[0]}`:'Highest rank reached'}</Text></View></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${Math.max(8,rankProgress*100)}%`}]}/></View></View><View style={styles.aboutCard}>{location?<View style={styles.aboutRow}><AppIcon name="location" color="#D7B45A" size={18}/><View><Text style={styles.aboutLabel}>Home base</Text><Text style={styles.aboutValue}>{location}</Text></View></View>:null}<View style={styles.aboutRow}><AppIcon name="calendar" color="#D7B45A" size={18}/><View><Text style={styles.aboutLabel}>Member since</Text><Text style={styles.aboutValue}>{joined}</Text></View></View>{profile.platform_role!=='member'?<View style={styles.aboutRow}><AppIcon name="community" color="#D7B45A" size={18}/><View><Text style={styles.aboutLabel}>Role</Text><Text style={styles.aboutValue}>{profile.platform_role}</Text></View></View>:null}</View></View>:null}
  </>}
 </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#09110F'},center:{flex:1,backgroundColor:'#09110F',alignItems:'center',justifyContent:'center',padding:24},error:{color:'#F5C341',textAlign:'center'},content:{paddingHorizontal:16,paddingTop:8,paddingBottom:112,gap:12},tabContent:{gap:14},
 hero:{aspectRatio:16/8.4,borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:'#27332F',backgroundColor:'#111A17',position:'relative'},coverImage:{width:'100%',height:'100%',resizeMode:'cover'},coverPlaceholder:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#14231C'},heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(4,10,8,.2)'},backButton:{position:'absolute',left:10,top:10,width:36,height:36,borderRadius:18,backgroundColor:'rgba(9,17,15,.84)',alignItems:'center',justifyContent:'center'},shareButton:{position:'absolute',right:10,top:10,width:36,height:36,borderRadius:18,backgroundColor:'rgba(9,17,15,.84)',alignItems:'center',justifyContent:'center'},
 identityRow:{flexDirection:'row',gap:12,paddingHorizontal:8,marginTop:-34,zIndex:2},avatarWrap:{width:86,height:86,borderRadius:43,borderWidth:4,borderColor:'#09110F',backgroundColor:'#09110F'},avatar:{width:78,height:78,borderRadius:39,backgroundColor:'#F5C341',alignItems:'center',justifyContent:'center'},avatarText:{color:'#17211C',fontSize:30,fontWeight:'900'},identityCopy:{flex:1,minWidth:0,paddingTop:38},name:{color:'#FFF8E8',fontSize:26,lineHeight:29,fontWeight:'900',letterSpacing:-.4},handle:{color:'#F5C341',fontSize:13,fontWeight:'800'},locationRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:3},location:{color:'#AEB9B4',fontSize:13},rankLine:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4},rankLineText:{color:'#FFF8E8',fontSize:12,fontWeight:'900'},bioText:{color:'#D4DBD7',fontSize:14.5,lineHeight:20,paddingHorizontal:8},
 headerChips:{flexDirection:'row',flexWrap:'wrap',gap:6,paddingHorizontal:8},headerChip:{borderRadius:999,backgroundColor:'#203029',paddingHorizontal:10,paddingVertical:6},headerChipShared:{backgroundColor:'#D7B45A'},headerChipText:{color:'#E5C977',fontSize:10.5,fontWeight:'800'},headerChipTextShared:{color:'#17211C'},
 actionRow:{flexDirection:'row',alignItems:'center',gap:8},primaryButton:{minHeight:42,borderRadius:21,backgroundColor:'#D7B45A',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:14},primaryText:{color:'#17211C',fontSize:12.5,fontWeight:'900'},connectedPill:{minHeight:42,borderRadius:21,borderWidth:1,borderColor:'#46584A',backgroundColor:'#1A2921',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:14},connectedText:{color:'#FFF8E8',fontSize:12.5,fontWeight:'900'},pendingPill:{minHeight:42,borderRadius:21,borderWidth:1,borderColor:'#46584A',backgroundColor:'#111A17',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:14},pendingText:{color:'#D3DDD7',fontSize:12,fontWeight:'900'},viewAsButton:{width:42,height:42,borderRadius:21,borderWidth:1,borderColor:'#46584A',backgroundColor:'#111A17',alignItems:'center',justifyContent:'center'},requestCard:{borderRadius:17,borderWidth:1,borderColor:'#4B5C50',backgroundColor:'#15221B',padding:12,gap:6},requestTitle:{color:'#FFF8E8',fontSize:13,fontWeight:'900'},requestBody:{color:'#93A198',fontSize:11},requestActions:{flexDirection:'row',gap:8,marginTop:3},primarySmall:{minHeight:34,borderRadius:17,backgroundColor:'#D7B45A',paddingHorizontal:14,alignItems:'center',justifyContent:'center'},secondarySmall:{minHeight:34,borderRadius:17,borderWidth:1,borderColor:'#46584A',paddingHorizontal:14,alignItems:'center',justifyContent:'center'},secondaryText:{color:'#FFF8E8',fontSize:11.5,fontWeight:'900'},
 sharedCard:{borderRadius:16,borderWidth:1,borderColor:'#405144',backgroundColor:'#142119',padding:12,flexDirection:'row',alignItems:'center',gap:10},sharedTitle:{color:'#FFF8E8',fontSize:12.5,fontWeight:'900'},sharedBody:{color:'#98A69D',fontSize:10.5,marginTop:2},statsCard:{flexDirection:'row',borderRadius:18,borderWidth:1,borderColor:'#29362F',backgroundColor:'#111A17',paddingVertical:10,overflow:'hidden'},statCell:{flex:1,alignItems:'center',gap:1,position:'relative'},statValue:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},statLabel:{color:'#93A097',fontSize:10.5,fontWeight:'800'},statDivider:{position:'absolute',right:0,top:5,bottom:5,width:1,backgroundColor:'#28352F'},
 privateCard:{borderRadius:18,borderWidth:1,borderColor:'#37463D',backgroundColor:'#111A17',padding:16,flexDirection:'row',alignItems:'center',gap:12},privateTitle:{color:'#FFF8E8',fontSize:15,fontWeight:'900'},privateBody:{color:'#94A198',fontSize:11.5,lineHeight:16,marginTop:2},
 tabs:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#28322E'},tab:{flex:1,alignItems:'center',paddingVertical:9,position:'relative'},tabText:{color:'#A8B2AD',fontSize:12,fontWeight:'800'},tabTextActive:{color:'#F5C341'},tabUnderline:{height:2,backgroundColor:'#F5C341',position:'absolute',bottom:-1,left:12,right:12,borderRadius:4},
 trailFeature:{minHeight:200,borderRadius:22,overflow:'hidden',backgroundColor:'#1B2B22',borderWidth:1,borderColor:'#4D6654',position:'relative'},trailFeatureImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%',resizeMode:'cover'},trailFeatureShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(8,17,13,.69)'},trailFeatureBody:{flex:1,padding:18,justifyContent:'flex-end'},eyebrow:{color:'#D7B45A',fontSize:8.5,fontWeight:'900',letterSpacing:1},trailFeatureTitle:{color:'#FFF8E8',fontSize:28,fontWeight:'900',letterSpacing:-.5,marginTop:3},trailFeatureText:{color:'#D3DED7',fontSize:13,lineHeight:18,marginTop:3,maxWidth:290},sectionHeader:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},sectionTitle:{color:'#FFF8E8',fontSize:20,fontWeight:'900'},sectionSub:{color:'#8F9C95',fontSize:11.5,lineHeight:16,marginTop:2},
 albumRail:{gap:10,paddingRight:16},sharedAdventureCard:{width:210,borderRadius:18,overflow:'hidden',backgroundColor:'#111A17',borderWidth:1,borderColor:'#29362F'},sharedAdventureImage:{width:'100%',height:116,resizeMode:'cover'},sharedAdventureFallback:{height:116,alignItems:'center',justifyContent:'center',backgroundColor:'#192720'},sharedAdventureBody:{padding:11},sharedAdventureTitle:{color:'#FFF8E8',fontSize:14,fontWeight:'900'},sharedAdventureMeta:{color:'#8F9C95',fontSize:10.5,marginTop:3},recognitionSectionSpacing:{marginTop:8},recognitionRail:{gap:14,paddingRight:16,paddingVertical:2},recognitionItem:{width:112,minHeight:132,alignItems:'center',justifyContent:'flex-start'},stampImage:{width:108,height:120},recognitionTitle:{width:112,color:'#F7F8F3',fontWeight:'800',fontSize:11.5,lineHeight:14,textAlign:'center',marginTop:3},
 photoGrid:{gap:10},photoTile:{height:190,borderRadius:19,overflow:'hidden',backgroundColor:'#17241E',position:'relative'},photoTileImage:{width:'100%',height:'100%',resizeMode:'cover'},photoTileFallback:{width:'100%',height:'100%',alignItems:'center',justifyContent:'center'},photoTileShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(4,10,8,.18)'},photoTileCopy:{position:'absolute',left:12,right:12,bottom:11},photoTileTitle:{color:'#FFF8E8',fontSize:15,fontWeight:'900'},photoTileMeta:{color:'#E4EAE6',fontSize:10.5,marginTop:2},empty:{borderRadius:18,borderWidth:1,borderColor:'#28362E',backgroundColor:'#111A17',padding:18,alignItems:'center',gap:6},emptyTitle:{color:'#FFF8E8',fontWeight:'900'},
 aboutCard:{borderRadius:18,borderWidth:1,borderColor:'#28362E',backgroundColor:'#111A17',padding:15,gap:12},rankHeader:{flexDirection:'row',alignItems:'center',gap:10},progressTrack:{height:6,borderRadius:999,backgroundColor:'#2B3730',overflow:'hidden'},progressFill:{height:'100%',borderRadius:999,backgroundColor:'#D7B45A'},aboutRow:{flexDirection:'row',alignItems:'center',gap:10},aboutLabel:{color:'#8E9A94',fontSize:10,fontWeight:'800'},aboutValue:{color:'#FFF8E8',fontSize:13,fontWeight:'800',marginTop:1},
});