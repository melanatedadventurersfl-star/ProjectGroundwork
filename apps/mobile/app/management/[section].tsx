import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { managementSection } from '../../src/management/workspace';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = { bg: '#0A0F0C', panel: '#131B16', raised: '#19231C', line: '#2D3A32', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A' };

export default function ManagementSectionScreen() {
  const { section: key } = useLocalSearchParams<{ section: string }>();
  const section = managementSection(key);

  if (!section) return <SafeAreaView style={styles.center}><Text style={styles.error}>Management section not found.</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Back to Management" style={styles.iconButton} onPress={() => router.back()}><AppIcon name="chevron-back" color={COLORS.cream} size={22} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>MANAGEMENT</Text><Text style={styles.title}>{section.title}</Text></View>
        <Pressable accessibilityLabel="Open Management menu" style={styles.iconButton} onPress={() => router.push('/management/menu' as never)}><AppIcon name="menu" color={COLORS.cream} size={22} /></Pressable>
      </View>

      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: `${section.accent}20` }]}><AppIcon name={section.icon} color={section.accent} size={28} /></View>
        <Text style={styles.heroTitle}>{section.subtitle}</Text>
        <Text style={styles.heroCopy}>This Management view is organization-wide. Event-specific work stays inside Host Center so the two workspaces keep separate jobs.</Text>
      </View>

      <Text style={styles.sectionTitle}>What belongs here</Text>
      <View style={styles.listCard}>{section.bullets.map((bullet, index) => <View key={bullet} style={[styles.row, index > 0 && styles.divider]}><View style={[styles.dot, { backgroundColor: section.accent }]} /><Text style={styles.rowText}>{bullet}</Text></View>)}</View>

      {section.liveRoute ? <View style={styles.bridgeCard}>
        <Text style={styles.bridgeKicker}>LIVE DATA</Text>
        <Text style={styles.bridgeTitle}>The existing operational tools stay connected.</Text>
        <Text style={styles.bridgeCopy}>Until each Management module gets its own deeper organization-wide interface, this opens the current live tool without creating a second source of truth.</Text>
        <Pressable style={styles.primary} onPress={() => router.push(section.liveRoute as never)}><Text style={styles.primaryText}>Open Live Tool</Text><AppIcon name="open" color="#172017" size={17} /></Pressable>
      </View> : <View style={styles.bridgeCard}>
        <Text style={styles.bridgeKicker}>WORKSPACE FOUNDATION</Text>
        <Text style={styles.bridgeTitle}>This section now has a permanent Management home.</Text>
        <Text style={styles.bridgeCopy}>Its data model and working tools can be added here without putting them back inside Host Center.</Text>
      </View>}

      <Pressable style={styles.workspaceSwitch} onPress={() => router.push('/host' as never)}><View><Text style={styles.switchLabel}>Need to run a specific event?</Text><Text style={styles.switchTitle}>Switch to Host Center</Text></View><Text style={styles.chevron}>›</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }, error: { color: '#FFB4A9' },
  content: { padding: 18, paddingBottom: 90, width: '100%', maxWidth: 820, alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 17 }, iconButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1 }, title: { color: COLORS.cream, fontSize: 25, fontWeight: '900', marginTop: 1 },
  hero: { borderRadius: 20, backgroundColor: '#151F19', borderWidth: 1, borderColor: '#334239', padding: 18 }, heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: COLORS.cream, fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 13 }, heroCopy: { color: COLORS.muted, fontSize: 11.5, lineHeight: 17, marginTop: 6 },
  sectionTitle: { color: COLORS.cream, fontSize: 17, fontWeight: '900', marginTop: 22, marginBottom: 9 }, listCard: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  row: { minHeight: 52, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line }, dot: { width: 7, height: 7, borderRadius: 4 }, rowText: { color: '#D5DBD7', fontSize: 12, lineHeight: 17, flex: 1 },
  bridgeCard: { marginTop: 14, borderRadius: 17, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 15 }, bridgeKicker: { color: COLORS.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: 1 }, bridgeTitle: { color: COLORS.cream, fontSize: 16, fontWeight: '900', marginTop: 5 }, bridgeCopy: { color: COLORS.dim, fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  primary: { alignSelf: 'flex-start', marginTop: 13, minHeight: 42, borderRadius: 11, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13 }, primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  workspaceSwitch: { marginTop: 14, minHeight: 66, borderRadius: 15, borderWidth: 1, borderColor: '#3D4B42', backgroundColor: '#111914', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, switchLabel: { color: COLORS.dim, fontSize: 9.5 }, switchTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900', marginTop: 2 }, chevron: { color: COLORS.gold, fontSize: 25 },
});
