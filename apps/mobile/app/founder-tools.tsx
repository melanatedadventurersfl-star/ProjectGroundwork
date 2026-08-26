import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '../src/ui/AppIcon';

type ToolRow = {
  label: string;
  route: string;
  icon: AppIconName;
  meta?: string;
};

const creatorRows: ToolRow[] = [
  { label: 'Creator Console', route: '/creator', icon: 'badge', meta: 'Publishing, creator tools and operations' },
];

const adminRows: ToolRow[] = [
  { label: 'Admin Profile', route: '/admin', icon: 'profile' },
  { label: 'Outing Hosts', route: '/admin/outing-hosts', icon: 'trips', meta: 'Approve hosts and paid-outing access' },
  { label: 'App Media', route: '/admin-media', icon: 'guide' },
];

const testingRows: ToolRow[] = [
  { label: 'Replay First-Run Onboarding', route: '/onboarding-v2', icon: 'guide', meta: 'Admin test only' },
  { label: 'Build Status', route: '/build-status', icon: 'about', meta: 'Version, update channel and build fingerprint' },
];

export default function FounderToolsScreen() {
  const gitSha = process.env.EXPO_PUBLIC_GIT_SHA?.slice(0, 8) || 'unknown';
  const updateId = Updates.updateId?.slice(0, 8) || 'embedded';
  const runtimeVersion = Updates.runtimeVersion || 'embedded';
  const environment = process.env.EXPO_PUBLIC_APP_ENV || 'production';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>AUTHORIZED ACCESS</Text>
        <Text style={styles.title}>Founder Tools</Text>
        <Text style={styles.subtitle}>Operational, administrative and testing tools for Go Melanated.</Text>

        <ToolSection title="Creator" rows={creatorRows} />
        <ToolSection title="Administration" rows={adminRows} />
        <ToolSection title="Testing" rows={testingRows} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Build Information</Text>
          <View style={styles.card}>
            <InfoRow label="Environment" value={environment} />
            <InfoRow label="Branch" value="main" />
            <InfoRow label="Commit" value={gitSha} />
            <InfoRow label="OTA" value={updateId} />
            <InfoRow label="Runtime" value={runtimeVersion} last />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToolSection({ title, rows }: { title: string; rows: ToolRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Pressable key={row.label} style={[styles.row, index > 0 && styles.divider]} onPress={() => router.push(row.route as never)}>
            <View style={styles.rowLead}>
              <AppIcon name={row.icon} color="#F6F4EE" size={20} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{row.label}</Text>
                {row.meta ? <Text style={styles.rowMeta}>{row.meta}</Text> : null}
              </View>
            </View>
            <AppIcon name="chevron-forward" color="#BCA25A" size={18} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.divider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 54 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 },
  backText: { color: '#D7B45A', fontSize: 16, fontWeight: '800' },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.2, fontSize: 11, marginTop: 8 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 42, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A7B0AA', fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 24, maxWidth: 360 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.05, marginBottom: 8 },
  card: { backgroundColor: '#171D19', borderRadius: 16, borderWidth: 1, borderColor: '#2B332E', overflow: 'hidden' },
  row: { minHeight: 58, paddingHorizontal: 15, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: '#2B332E' },
  rowLead: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '800' },
  rowMeta: { color: '#8F9A93', fontSize: 11, lineHeight: 15, marginTop: 2 },
  infoRow: { minHeight: 52, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  infoLabel: { color: '#8F9A93', fontSize: 12, fontWeight: '700' },
  infoValue: { flex: 1, color: '#FFF8E8', fontSize: 12, fontWeight: '800', textAlign: 'right' },
});
