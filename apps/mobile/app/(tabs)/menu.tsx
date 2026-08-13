import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const menuItems = [
  { title: 'Profile', detail: 'Your member identity, status, interests, and privacy.', route: '/member/profile' },
  { title: 'Trips & Payments', detail: 'Reservations, payment status, tickets, and booking history.', route: '/member/trips' },
  { title: 'Trail Family', detail: 'Family and trusted travel connections for shared adventures.', route: '/member/trail-family' },
  { title: 'Notifications', detail: 'Announcements, deadlines, payments, groups, and emergency alerts.', route: '/notifications' },
  { title: 'Account & Support', detail: 'Communication settings, ticket wallet, and support requests.', route: '/member' },
];

export default function MenuScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.intro}>Passport stays in the bottom navigation. This menu is for managing you, your trips, and your account.</Text>
        <View style={styles.list}>
          {menuItems.map((item) => (
            <Pressable key={item.title} style={styles.card} onPress={() => router.push(item.route as never)}>
              <View style={styles.cardRow}>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDetail}>{item.detail}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 12 },
  title: { color: '#FFF8E8', fontSize: 34, fontWeight: '900', marginTop: 4 },
  intro: { color: '#96A29B', lineHeight: 20, marginTop: 8, marginBottom: 20 },
  list: { gap: 12 },
  card: { backgroundColor: '#17211C', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#26332C' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardText: { flex: 1 },
  cardTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  cardDetail: { color: '#AEB8B2', marginTop: 6, lineHeight: 21 },
  arrow: { color: '#D7B45A', fontSize: 27 },
});
