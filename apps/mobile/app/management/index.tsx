import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MANAGEMENT_SECTIONS } from '../../src/management/workspace';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = {
  bg: '#0A0F0C', panel: '#131B16', raised: '#19231C', line: '#2D3A32', cream: '#FFF8E8',
  muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#84C992', orange: '#E7A05C',
};

export default function ManagementHomeScreen() {
  const { width } = useWindowDimensions();
  const roomy = width >= 760;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={[styles.content, roomy && styles.contentRoomy]} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>GO MELANATED</Text>
          <Text style={styles.title}>Management</Text>
          <Text style={styles.subtitle}>Run the organization across events, people, money and day-to-day work.</Text>
        </View>
        <Pressable accessibilityLabel="Open Management menu" style={styles.menuButton} onPress={() => router.push('/management/menu' as never)}>
          <AppIcon name="menu" color={COLORS.cream} size={23} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroKicker}>ORGANIZATION WORKSPACE</Text>
          <Text style={styles.heroTitle}>Everything beyond a single event.</Text>
          <Text style={styles.heroCopy}>Management is for cross-event work, staff, vendors, finances, marketing, files and operations. Event execution stays in Host Center.</Text>
        </View>
        <View style={styles.workspaceButtons}>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/management/work' as never)}>
            <AppIcon name="tasks" color="#172017" size={18} />
            <Text style={styles.primaryButtonText}>Open My Work</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/host' as never)}>
            <Text style={styles.secondaryButtonText}>Switch to Host Center</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <SummaryCard title="My Work" copy="Tasks and assignments across the organization" icon="tasks" accent="#A990ED" route="/management/work" />
        <SummaryCard title="Communications" copy="Host inquiries, vendor and team messages" icon="notifications" accent="#75AEE8" route="/management/communications" />
        <SummaryCard title="Finances" copy="Revenue, expenses and profitability across events" icon="reports" accent={COLORS.green} route="/management/finances" />
        <SummaryCard title="Opportunities" copy="Vending, partnerships and sponsorships" icon="briefcase" accent={COLORS.orange} route="/management/opportunities" />
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>Management tools</Text>
          <Text style={styles.sectionMeta}>Each section keeps an organization-wide view instead of duplicating event-level Host Center pages.</Text>
        </View>
        <Pressable onPress={() => router.push('/management/menu' as never)}><Text style={styles.sectionAction}>Full menu</Text></Pressable>
      </View>

      <View style={[styles.toolGrid, roomy && styles.toolGridRoomy]}>
        {MANAGEMENT_SECTIONS.map((section) => <Pressable
          key={section.key}
          style={[styles.toolCard, roomy && styles.toolCardRoomy]}
          onPress={() => router.push(`/management/${section.key}` as never)}
        >
          <View style={[styles.toolIcon, { backgroundColor: `${section.accent}22` }]}><AppIcon name={section.icon} color={section.accent} size={21} /></View>
          <View style={{ flex: 1 }}><Text style={styles.toolTitle}>{section.title}</Text><Text style={styles.toolSubtitle}>{section.subtitle}</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function SummaryCard({ title, copy, icon, accent, route }: { title: string; copy: string; icon: Parameters<typeof AppIcon>[0]['name']; accent: string; route: string }) {
  return <Pressable style={styles.summaryCard} onPress={() => router.push(route as never)}>
    <View style={[styles.summaryIcon, { backgroundColor: `${accent}20` }]}><AppIcon name={icon} color={accent} size={20} /></View>
    <Text style={styles.summaryTitle}>{title}</Text><Text style={styles.summaryCopy}>{copy}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 100 },
  contentRoomy: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 26 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 31, fontWeight: '900', marginTop: 2 },
  subtitle: { color: COLORS.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4, maxWidth: 600 },
  menuButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 22, backgroundColor: '#16221B', borderWidth: 1, borderColor: '#33463A', padding: 18, gap: 16 },
  heroKicker: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: COLORS.cream, fontSize: 25, lineHeight: 30, fontWeight: '900', marginTop: 4 },
  heroCopy: { color: '#B6C0BA', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 700 },
  workspaceButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  primaryButton: { minHeight: 44, borderRadius: 12, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 },
  primaryButtonText: { color: '#172017', fontSize: 11.5, fontWeight: '900' },
  secondaryButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#4A594F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryButtonText: { color: COLORS.cream, fontSize: 11.5, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  summaryCard: { width: '48.5%', minHeight: 130, borderRadius: 16, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 13 },
  summaryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  summaryTitle: { color: COLORS.cream, fontSize: 14, fontWeight: '900' },
  summaryCopy: { color: COLORS.dim, fontSize: 10, lineHeight: 14, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 22 },
  sectionTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: COLORS.dim, fontSize: 10, lineHeight: 15, marginTop: 3, maxWidth: 620 },
  sectionAction: { color: COLORS.gold, fontSize: 10, fontWeight: '900' },
  toolGrid: { marginTop: 10, gap: 8 },
  toolGridRoomy: { flexDirection: 'row', flexWrap: 'wrap' },
  toolCard: { minHeight: 76, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  toolCardRoomy: { width: '49.4%' },
  toolIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { color: COLORS.cream, fontSize: 13.5, fontWeight: '900' },
  toolSubtitle: { color: COLORS.dim, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  chevron: { color: COLORS.muted, fontSize: 25, fontWeight: '500' },
});
