import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HOST_WORKSPACE_ITEMS, HOST_WORKSPACES } from '../../src/hosting/hostWorkspace';
import { supabase } from '../../src/lib/supabase';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = { bg: '#0B100D', panel: '#151B17', raised: '#1B231E', line: '#2E3832', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', purple: '#A990ED' };

export default function HostMenuScreen() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setIsPlatformAdmin(false);
        return;
      }
      setIsPlatformAdmin(data === true);
    });
    return () => { active = false; };
  }, []);

  const workspaces = useMemo(() => HOST_WORKSPACES.filter((item) => !item.adminOnly || isPlatformAdmin), [isPlatformAdmin]);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View><Text style={styles.eyebrow}>WORKSPACE MENU</Text><Text style={styles.title}>Host Center</Text><Text style={styles.subtitle}>Everything tied to building and running your events.</Text></View>
        <Pressable accessibilityLabel="Close Host Center menu" style={styles.close} onPress={() => router.back()}><AppIcon name="close" color={COLORS.cream} size={24} /></Pressable>
      </View>

      <Pressable style={styles.overview} onPress={() => router.replace('/host' as never)}>
        <View style={styles.icon}><AppIcon name="dashboard" color={COLORS.gold} size={21} /></View>
        <View style={{ flex: 1 }}><Text style={styles.itemTitle}>Overview</Text><Text style={styles.itemSubtitle}>Active events, alerts, work and upcoming dates</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>HOST CENTER</Text>
      <View style={styles.list}>
        {HOST_WORKSPACE_ITEMS.map((item) => <Pressable key={item.key} style={styles.item} onPress={() => router.push(item.route as never)}>
          <View style={[styles.icon, { backgroundColor: `${item.accent}20` }]}><AppIcon name={item.icon} color={item.accent} size={20} /></View>
          <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemSubtitle}>{item.subtitle}</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>)}
      </View>

      <Text style={styles.sectionLabel}>SWITCH WORKSPACE</Text>
      <View style={styles.workspaceCard}>
        {workspaces.map((workspace, index) => <Pressable key={workspace.title} style={[styles.workspaceRow, index > 0 && styles.divider]} onPress={() => router.replace(workspace.route as never)}>
          <Text style={[styles.workspaceTitle, workspace.title === 'Host Center' && styles.workspaceActive]}>{workspace.title}</Text>
          {workspace.title === 'Host Center' ? <Text style={styles.current}>CURRENT</Text> : <Text style={styles.chevron}>›</Text>}
        </Pressable>)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 18, paddingBottom: 90 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.cream, fontSize: 30, fontWeight: '900', marginTop: 2 }, subtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 280 },
  close: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  overview: { minHeight: 74, borderRadius: 16, backgroundColor: '#211B2B', borderWidth: 1, borderColor: '#4C3A61', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionLabel: { color: COLORS.dim, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 },
  list: { gap: 7 }, item: { minHeight: 70, borderRadius: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2A2317', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: COLORS.cream, fontSize: 13.5, fontWeight: '900' }, itemSubtitle: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 2 }, chevron: { color: COLORS.muted, fontSize: 24 },
  workspaceCard: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  workspaceRow: { minHeight: 52, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line },
  workspaceTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '800' }, workspaceActive: { color: COLORS.gold }, current: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
});
