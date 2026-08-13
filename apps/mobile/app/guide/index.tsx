import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const topics = [
  ['Passport','Your personal record of completed official MA Adventures. It brings together your rank, official stamps, achievement badges, Journey and Memories.'],
  ['Ranks','Explorer, Pathfinder, Trailblazer, Wayfinder, Summiteer and Legacy Adventurer mark long-term progress through verified official Adventures.'],
  ['Stamps','A travel-style stamp is earned for a verified completed official MA Adventure. Local Events do not automatically award official stamps.'],
  ['Badges','Collectible achievements for milestones, activities, community participation and special recognition. Badges are separate from rank emblems and stamps.'],
  ['Memories','Your personal scrapbook of photos, reflections and adventure albums. Shared Adventure pages may also show community memories from visible attendees.'],
  ['Trail Family','People you regularly adventure with. Guardians can manage dependents; adults remain independent members with their own privacy controls.'],
  ['Connections','Mutual member relationships, not followers. Connections can make it easier to coordinate Adventures and assign eligible tickets.'],
  ['Interested · Going','Social RSVP signals. Going can be private. A social RSVP never cancels a paid or held reservation.'],
  ['Groups','Adventure Groups coordinate official trips, Local Event Groups support nearby meetups, and Interest Groups are ongoing communities.'],
  ['Reservations & Tickets','The purchaser and attendee can be different people. Trips & Payments is the management center for bookings, attendees, tickets and readiness.'],
  ['Offline','When offline, the app should show the last saved trip essentials. Fresh weather, Explore results, payments and new community activity still require internet.'],
  ['Privacy','Your display name and selected community fields may be visible. Exact address, payment details, phone, email and dependent details are private.'],
] as const;

export default function GuideScreen(){return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Back</Text></Pressable><Text style={s.eyebrow}>TRAIL GUIDE</Text><Text style={s.title}>How MA Works</Text><Text style={s.intro}>A quick field guide to the language you’ll see across Melanated Adventurers.</Text>{topics.map(([title,body])=><View key={title} style={s.card}><Text style={s.cardTitle}>{title}</Text><Text style={s.body}>{body}</Text></View>)}</ScrollView></SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:60,gap:12},back:{color:'#D7B45A',fontWeight:'900'},eyebrow:{color:'#D7B45A',fontSize:11,fontWeight:'900',letterSpacing:1.2,marginTop:8},title:{color:'#FFF8E8',fontSize:34,fontWeight:'900'},intro:{color:'#A5B0A9',fontSize:16,lineHeight:23,marginBottom:6},card:{backgroundColor:'#17211C',borderWidth:1,borderColor:'#28362E',borderRadius:16,padding:16},cardTitle:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},body:{color:'#AEB8B2',lineHeight:21,marginTop:6}});
