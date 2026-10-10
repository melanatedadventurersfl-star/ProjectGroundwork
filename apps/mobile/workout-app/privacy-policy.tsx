import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const sections = [
  ['Workout account', 'GO Workout uses a standalone Workout account and backend. It does not require a Go Melanated membership or share Go Melanated profile data.'],
  ['Training data', 'GO Workout stores the workout information you enter or generate, including plans, exercise history, sets, repetitions, loads, preferences, progression, and shared-workout information you choose to use.'],
  ['Health and fitness data', 'If you connect Android Health Connect, GO Workout may read the categories you approve, including exercise sessions, heart rate, calories, distance, and steps. Connected health data is used to add supported activity and metrics to your private Workout history.'],
  ['Samsung Health', 'Samsung Health records are read through Android Health Connect. You can revoke GO Workout access in Connected Health or Android settings.'],
  ['Workout partners', 'Connected heart-rate and calorie data are not shared with workout partners. Shared workout features exchange only the Workout information needed for the session.'],
  ['Data control', 'You can disconnect Health Connect without deleting previously imported workout history. Account deletion and history controls are available inside GO Workout.'],
] as const;

export default function WorkoutPrivacyPolicy() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>GO WORKOUT</Text>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.meta}>Effective October 10, 2026</Text>
        <Text style={styles.intro}>This policy describes the data used by the standalone GO Workout application.</Text>
        {sections.map(([title, body]) => (
          <View key={title} style={styles.section}>
            <Text style={styles.heading}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0D0B' },
  content: { padding: 22, paddingBottom: 56 },
  eyebrow: { color: '#D6FF43', fontWeight: '900', letterSpacing: 1.4, fontSize: 11 },
  title: { color: '#F7FAF8', fontSize: 34, fontWeight: '900', marginTop: 5 },
  meta: { color: '#7F8A84', fontSize: 12, marginTop: 6, marginBottom: 18 },
  intro: { color: '#C9D2CD', fontSize: 15, lineHeight: 23, marginBottom: 22 },
  section: { marginBottom: 20 },
  heading: { color: '#F7FAF8', fontSize: 18, fontWeight: '800', marginBottom: 7 },
  body: { color: '#AEB9B3', fontSize: 14, lineHeight: 22 },
});
