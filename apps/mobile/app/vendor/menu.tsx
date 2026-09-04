import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../../src/ui/AppIcon';
import { VENDOR_WORKSPACE_GROUPS, VENDOR_WORKSPACE_ITEMS } from '../../src/vendor/vendorWorkspace';

const C = { bg: '#0B100D', panel: '#151B17', raised: '#1B231E', line: '#2E3832', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A' };

export default function VendorMenuScreen() {
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>GO MELANATED</Text>
          <Text style={styles.title}>Vendor Center</Text>
          <Text style={styles.subtitle}>Your business workspace for opportunities, bookings, payments and growth.</Text>
        </View>
        <Pressable accessibilityLabel="Close Vendor Center menu" style={styles.close} onPress={() => router.back()}><AppIcon name="close" color={C.cream} size={24} /></Pressable>
      </View>

      <Pressable style={styles.overview} onPress={() => router.replace('/vendor' as never)}>
        <View style={styles.icon}><AppIcon name="dashboard" color={C.gold} size={21} /></View>
        <View style={{ flex: 1 }}><Text style={styles.itemTitle}>Overview</Text><Text style={styles.itemSubtitle}>Business status, next actions and marketplace activity</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {VENDOR_WORKSPACE_GROUPS.map((group) => <View key={group}>
        <Text style={styles.sectionLabel}>{group}</Text>
        <View style={styles.list}>
          {VENDOR_WORKSPACE_ITEMS.filter((item) => item.group === group).map((item) => <Pressable key={item.key} style={styles.item} onPress={() => router.push(item.route as never)}>
            <View style={[styles.icon, { backgroundColor: `${item.accent}20` }]}><AppIcon name={item.icon} color={item.accent} size={20} /></View>
            <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemSubtitle}>{item.subtitle}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>)}
        </View>
      </View>)}

      <Text style={styles.sectionLabel}>LEAVE VENDOR CENTER</Text>
      <Pressable style={styles.workspaceRow} onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.workspaceTitle}>Back to Member App</Text><Text style={styles.chevron}>›</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }, eyebrow: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: C.cream, fontSize: 30, fontWeight: '900', marginTop: 2 }, subtitle: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 380 }, close: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  overview: { minHeight: 74, borderRadius: 16, backgroundColor: '#1D2A22', borderWidth: 1, borderColor: '#435447', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }, sectionLabel: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 }, list: { gap: 7 }, item: { minHeight: 70, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 }, icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2A2317', alignItems: 'center', justifyContent: 'center' }, itemTitle: { color: C.cream, fontSize: 13.5, fontWeight: '900' }, itemSubtitle: { color: C.dim, fontSize: 9.5, lineHeight: 13, marginTop: 2 }, chevron: { color: C.muted, fontSize: 24 }, workspaceRow: { minHeight: 54, borderRadius: 15, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, workspaceTitle: { color: C.cream, fontSize: 13, fontWeight: '800' },
});
