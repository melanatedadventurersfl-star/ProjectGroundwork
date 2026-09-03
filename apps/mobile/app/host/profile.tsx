import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../../src/ui/AppIcon';

const C = { bg: '#0A0F0C', panel: '#131B16', line: '#2D3A32', cream: '#FFF8E8', muted: '#95A29A', gold: '#D7B45A' };

export default function HostProfileHubScreen() {
  return <SafeAreaView style={styles.safe}>
    <View style={styles.content}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
      <Text style={styles.eyebrow}>HOST PROFILE</Text>
      <Text style={styles.title}>Manage your host presence</Text>
      <Text style={styles.copy}>Edit what members see, then manage organizations, followers, event history and host photos.</Text>

      <Pressable style={styles.card} onPress={() => router.push('/host/profile-public' as never)}>
        <View style={styles.icon}><AppIcon name="profile" color={C.gold} size={22} /></View>
        <View style={styles.flex}><Text style={styles.cardTitle}>Public profile</Text><Text style={styles.cardCopy}>Identity, specialties, contact options, FAQs and policies.</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push('/host/profile-details' as never)}>
        <View style={styles.icon}><AppIcon name="briefcase" color={C.gold} size={22} /></View>
        <View style={styles.flex}><Text style={styles.cardTitle}>Organizations & history</Text><Text style={styles.cardCopy}>Organizations, follower list, hosted events and event photo history.</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, gap: 12 },
  back: { color: C.gold, fontWeight: '900', marginBottom: 10 },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: C.cream, fontSize: 30, fontWeight: '900', marginTop: 2 },
  copy: { color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  card: { minHeight: 82, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#292516', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  cardTitle: { color: C.cream, fontSize: 14, fontWeight: '900' },
  cardCopy: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  chevron: { color: C.muted, fontSize: 24 }
});
