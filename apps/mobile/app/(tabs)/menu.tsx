import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const sections = [
  ['Account', [['Edit Profile','/member/profile'],['Privacy','/member/profile'],['Notifications','/notifications'],['Weather & Location','/member/weather'],['Account & Security','/member']]],
  ['Membership', [['Trips & Payments','/member/trips'],['Trail Family','/member/trail-family'],['Connections','/connections']]],
  ['Help', [['App Guide · How It Works','/guide'],['Support','/member'],['About Melanated Adventurers','/about']]],
] as const;

export default function MenuScreen() {
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>MEMBER HUB</Text><Text style={s.title}>Menu</Text>
    {sections.map(([title, rows]) => <View key={title} style={s.section}><Text style={s.sectionTitle}>{title}</Text><View style={s.card}>
      {rows.map(([label, route], i) => <Pressable key={label} style={[s.row, i > 0 && s.divider]} onPress={() => router.push(route as never)}><Text style={s.rowTitle}>{label}</Text><Text style={s.arrow}>›</Text></Pressable>)}
    </View></View>)}
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:48},eyebrow:{color:'#D7B45A',fontWeight:'900',letterSpacing:1.1,fontSize:11},title:{color:'#FFF8E8',fontSize:36,fontWeight:'900',marginTop:4,marginBottom:22},section:{marginBottom:20},sectionTitle:{color:'#8F9A93',fontSize:12,fontWeight:'900',textTransform:'uppercase',letterSpacing:1,marginBottom:8},card:{backgroundColor:'#17211C',borderRadius:16,borderWidth:1,borderColor:'#26332C',overflow:'hidden'},row:{minHeight:54,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},divider:{borderTopWidth:1,borderTopColor:'#26332C'},rowTitle:{color:'#FFF8E8',fontSize:16,fontWeight:'700'},arrow:{color:'#D7B45A',fontSize:24}
});
