import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const sections = [
  ['Information we collect', 'Go Melanated may collect account and profile information, approximate or precise location when you choose location features, photos and other content you submit, community activity, adventure registrations, payment-related records, device push tokens, and support communications.'],
  ['How we use information', 'We use this information to provide accounts and profiles, show nearby outdoor experiences, operate community features, manage adventures and reservations, deliver notifications, provide support, improve safety, prevent abuse, and maintain the service.'],
  ['Location', 'Location access is optional. When enabled, it is used for nearby Adventures, local weather, and location-aware discovery. You can change location permission at any time in your device settings.'],
  ['Photos and user content', 'Photos, posts, comments, reflections, and other content you choose to share may be stored and displayed according to the privacy or audience settings you select. Some submitted content may be reviewed for moderation and safety.'],
  ['Payments and records', 'Payment processing may involve third-party payment providers. We may retain transaction, attendance, waiver, safety, and fraud-prevention records when necessary for legal, financial, security, or operational obligations.'],
  ['Service providers', 'We use service providers to operate the app, including cloud database and authentication, hosting, notifications, mapping or weather-related functionality, and payment processing. These providers process information only as needed to provide their services to us.'],
  ['Account deletion', 'You can request deletion from Menu > Account > Delete Account. We will remove or anonymize personal account data that is no longer required. Certain transaction, waiver, safety, fraud-prevention, or legal records may be retained for the period required by law or legitimate business obligations and will be disconnected from your public profile where appropriate.'],
  ['Security', 'We use technical and organizational safeguards intended to protect account and service data. No online service can guarantee absolute security.'],
  ['Children', 'Go Melanated is not intended for children to create independent accounts unless a supported parent or guardian flow expressly allows it.'],
  ['Changes to this policy', 'We may update this policy as the service evolves. Material changes will be reflected in the app or other appropriate notice.'],
  ['Contact', 'Questions about privacy or deletion requests can be submitted through Menu > Support in the app.'],
] as const;

export default function PrivacyPolicyScreen() {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>GO MELANATED</Text>
    <Text style={styles.title}>Privacy Policy</Text>
    <Text style={styles.meta}>Effective August 21, 2026</Text>
    <Text style={styles.intro}>This policy explains how Go Melanated handles information when you use the mobile app and related services.</Text>
    {sections.map(([title, body]) => <View key={title} style={styles.section}><Text style={styles.heading}>{title}</Text><Text style={styles.body}>{body}</Text></View>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:54},eyebrow:{color:'#D7B45A',fontWeight:'900',letterSpacing:1.1,fontSize:11},title:{color:'#FFF8E8',fontSize:34,fontWeight:'900',marginTop:4},meta:{color:'#8F9A93',fontSize:12,marginTop:6,marginBottom:18},intro:{color:'#D6D9D3',fontSize:15,lineHeight:23,marginBottom:20},section:{marginBottom:20},heading:{color:'#FFF8E8',fontSize:18,fontWeight:'800',marginBottom:7},body:{color:'#BCC5BE',fontSize:14,lineHeight:22}});