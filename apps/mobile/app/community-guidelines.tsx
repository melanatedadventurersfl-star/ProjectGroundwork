import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const guidelines = [
  ['Protect the community', 'No threats, harassment, bullying, stalking, doxxing, or encouraging harm.'],
  ['Respect Black people in all our variety', 'No racism, colorism, misogyny, homophobia, transphobia, ableism, religious attacks, or identity-based harassment.'],
  ['Keep it welcoming', 'Debate is fine. Personal attacks, targeted pile-ons, intimidation, and deliberately hostile behavior are not.'],
  ['Keep it appropriate', 'No sexually explicit content, graphic violence, exploitation, or content intended primarily to shock people.'],
  ['Do not scam the trail', 'No fraud, impersonation, spam, fake events, deceptive fundraising, or misleading promotions.'],
  ['Respect privacy', 'Do not post someone else’s private information, precise location, sensitive conversations, or personal media without appropriate permission.'],
  ['Be responsible outdoors', 'Do not encourage reckless behavior, destruction of public lands, wildlife harassment, illegal activity, or knowingly dangerous outdoor advice.'],
  ['Respect hosts and events', 'Follow event rules, venue rules, safety instructions, and reasonable boundaries established by hosts.'],
  ['Keep promotions in balance', 'Businesses and creators may participate, but repetitive unsolicited advertising should not take over the community.'],
  ['Report, do not retaliate', 'If something crosses the line, report it. Do not turn a disagreement into harassment or a pile-on.'],
] as const;

export default function CommunityGuidelinesScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>COMMUNITY GUIDELINES</Text>
        <Text style={styles.title}>Make the trail better for the next person.</Text>
        <Text style={styles.intro}>
          Melanated exists to help Black people find the outdoors and find each other. Participate in a way that makes that community safer, stronger, and easier for the next person to join.
        </Text>

        <View style={styles.card}>
          {guidelines.map(([title, body], index) => (
            <View key={title} style={[styles.rule, index > 0 && styles.ruleDivider]}>
              <Text style={styles.ruleNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.ruleBody}>
                <Text style={styles.ruleTitle}>{title}</Text>
                <Text style={styles.ruleText}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.enforcementCard}>
          <Text style={styles.enforcementTitle}>What happens when guidelines are broken?</Text>
          <Text style={styles.enforcementText}>
            Actions may include content removal, warnings, temporary restrictions, event participation restrictions, suspension, or account removal. Severe safety issues may result in immediate action without a warning first.
          </Text>
          <Text style={styles.enforcementText}>
            Credible threats, exploitation, severe harassment, dangerous impersonation, and serious privacy violations are treated as high-priority safety issues.
          </Text>
        </View>

        <Text style={styles.footer}>By creating an account, you agree to follow these Community Guidelines while using Melanated.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 56, gap: 14 },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 },
  title: { color: '#FFF8E8', fontSize: 32, lineHeight: 36, fontWeight: '900' },
  intro: { color: '#B9C3BD', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#2B3A32', borderRadius: 20, overflow: 'hidden' },
  rule: { flexDirection: 'row', gap: 12, padding: 16 },
  ruleDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#34423A' },
  ruleNumber: { color: '#D7B45A', fontSize: 11, fontWeight: '900', width: 24, paddingTop: 2 },
  ruleBody: { flex: 1 },
  ruleTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  ruleText: { color: '#AEB8B2', fontSize: 14, lineHeight: 20, marginTop: 4 },
  enforcementCard: { backgroundColor: '#1A241F', borderWidth: 1, borderColor: '#405047', borderRadius: 18, padding: 17, gap: 8 },
  enforcementTitle: { color: '#FFF3CE', fontSize: 17, fontWeight: '900' },
  enforcementText: { color: '#B8C1BC', fontSize: 14, lineHeight: 20 },
  footer: { color: '#839088', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
