import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MANAGEMENT_SECTIONS, MANAGEMENT_WORKSPACES } from '../../src/management/workspace';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = { bg: '#0A0F0C', panel: '#131B16', raised: '#19231C', line: '#2D3A32', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A' };

export default function ManagementMenuScreen() {
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View><Text style={styles.eyebrow}>WORKSPACE MENU</Text><Text style={styles.title}>Management</Text></View>
        <Pressable accessibilityLabel="Close Management menu" style={styles.close} onPress={() => router.back()}><AppIcon name="close" color={COLORS.cream} size={24} /></Pressable>
      </View>

      <Pressable style={styles.overview} onPress={() => router.replace('/management' as never)}>
        <View style={styles.icon}><AppIcon name="dashboard" color={COLORS.gold} size={21} /></View>
        <View style={{ flex: 1 }}><Text style={styles.itemTitle}>Overview</Text><Text style={styles.itemSubtitle}>Organization health and management tools</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>MANAGEMENT</Text>
      <View style={styles.list}>
        {MANAGEMENT_SECTIONS.map((section) => <Pressable key={section.key} style={styles.item} onPress={() => router.push(`/management/${section.key}` as never)}>
          <View style={[styles.icon, { backgroundColor: `${section.accent}20` }]}><AppIcon name={section.icon} color={section.accent} size={20} /></View>
          <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{section.title}</Text><Text style={styles.itemSubtitle}>{section.subtitle}</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>)}
      </View>

      <Text style={styles.sectionLabel}>SWITCH WORKSPACE</Text>
      <View style={styles.workspaceCard}>
        {MANAGEMENT_WORKSPACES.map((workspace, index) => <Pressable key={workspace.title} style={[styles.workspaceRow, index > 0 && styles.divider]} onPress={() => router.replace(workspace.route as never)}>
          <Text style={[styles.workspaceTitle, workspace.title === 'Management' && styles.workspaceActive]}>{workspace.title}</Text>
          {workspace.title === 'Management' ? <Text style={styles.current}>CURRENT</Text> : <Text style={styles.chevron}>›</Text>}
        </Pressable>)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 18, paddingBottom: 90 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.cream, fontSize: 30, fontWeight: '900', marginTop: 2 },
  close: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  overview: { minHeight: 74, borderRadius: 16, backgroundColor: '#17221B', borderWidth: 1, borderColor: '#3D4C42', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionLabel: { color: COLORS.dim, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 },
  list: { gap: 7 }, item: { minHeight: 70, borderRadius: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2B2A1B', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: COLORS.cream, fontSize: 13.5, fontWeight: '900' }, itemSubtitle: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 2 }, chevron: { color: COLORS.muted, fontSize: 24 },
  workspaceCard: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  workspaceRow: { minHeight: 52, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line },
  workspaceTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '800' }, workspaceActive: { color: COLORS.gold }, current: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
});
