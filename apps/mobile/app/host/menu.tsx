import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HOST_WORKSPACE_GROUPS, HOST_WORKSPACE_ITEMS } from '../../src/hosting/hostWorkspace';
import { supabase } from '../../src/lib/supabase';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = { bg: '#0B100D', panel: '#151B17', raised: '#1B231E', line: '#2E3832', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A' };

export default function HostMenuScreen() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (!active) return;
      setIsPlatformAdmin(!error && data === true);
    });
    return () => { active = false; };
  }, []);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>GO MELANATED</Text>
          <Text style={styles.title}>Host Center</Text>
          <Text style={styles.subtitle}>Events and organization operations in one workspace.</Text>
        </View>
        <Pressable accessibilityLabel="Close Host Center menu" style={styles.close} onPress={() => router.back()}><AppIcon name="close" color={COLORS.cream} size={24} /></Pressable>
      </View>

      <Pressable style={styles.overview} onPress={() => router.replace('/host' as never)}>
        <View style={styles.icon}><AppIcon name="dashboard" color={COLORS.gold} size={21} /></View>
        <View style={{ flex: 1 }}><Text style={styles.itemTitle}>Overview</Text><Text style={styles.itemSubtitle}>Active events, work, alerts and business activity</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {HOST_WORKSPACE_GROUPS.map((group) => <View key={group}>
        <Text style={styles.sectionLabel}>{group}</Text>
        <View style={styles.list}>
          {HOST_WORKSPACE_ITEMS.filter((item) => item.group === group).map((item) => <Pressable key={item.key} style={styles.item} onPress={() => router.push(item.route as never)}>
            <View style={[styles.icon, { backgroundColor: `${item.accent}20` }]}><AppIcon name={item.icon} color={item.accent} size={20} /></View>
            <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemSubtitle}>{item.subtitle}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>)}
        </View>
      </View>)}

      <Text style={styles.sectionLabel}>LEAVE HOST CENTER</Text>
      <View style={styles.workspaceCard}>
        <Pressable style={styles.workspaceRow} onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.workspaceTitle}>Back to Member App</Text><Text style={styles.chevron}>›</Text></Pressable>
        {isPlatformAdmin ? <Pressable style={[styles.workspaceRow, styles.divider]} onPress={() => router.replace('/admin' as never)}><Text style={styles.workspaceTitle}>Admin</Text><Text style={styles.chevron}>›</Text></Pressable> : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.cream, fontSize: 30, fontWeight: '900', marginTop: 2 }, subtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 360 },
  close: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  overview: { minHeight: 74, borderRadius: 16, backgroundColor: '#1D2A22', borderWidth: 1, borderColor: '#435447', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 },
  list: { gap: 7 }, item: { minHeight: 70, borderRadius: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2A2317', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: COLORS.cream, fontSize: 13.5, fontWeight: '900' }, itemSubtitle: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 2 }, chevron: { color: COLORS.muted, fontSize: 24 },
  workspaceCard: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  workspaceRow: { minHeight: 52, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line },
  workspaceTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '800' },
});
