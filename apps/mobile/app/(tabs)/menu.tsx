import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const menuItems = [
  { title: 'Notifications', detail: 'Announcements, deadlines, and emergency alerts.', route: '/notifications' },
  { title: 'Profile and preferences', detail: 'Manage your member details and communication settings.' },
  { title: 'Household', detail: 'Manage adults, dependents, and booking permissions.' },
  { title: 'Tickets and orders', detail: 'Review registrations and entry credentials.' },
  { title: 'Support', detail: 'Get help with an adventure or your account.' },
];

export default function MenuScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MEMBER BASECAMP</Text>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.list}>
          {menuItems.map((item) => (
            <Pressable
              key={item.title}
              style={styles.card}
              onPress={() => item.route ? router.push(item.route as never) : undefined}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDetail}>{item.detail}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  content: { padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#d3a94f', fontWeight: '900', letterSpacing: 1.1, fontSize: 12 },
  title: { color: '#fff8e8', fontSize: 34, fontWeight: '900', marginTop: 4, marginBottom: 20 },
  list: { gap: 12 },
  card: { backgroundColor: '#17211c', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#26332c' },
  cardTitle: { color: '#fff8e8', fontSize: 18, fontWeight: '900' },
  cardDetail: { color: '#aeb8b2', marginTop: 6, lineHeight: 21 },
});