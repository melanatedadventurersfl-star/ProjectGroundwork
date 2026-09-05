import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ensureHostCenterProfile, getHostSetupProgress, type HostCenterProfile } from '../../src/hosting/hostEntry';

const sections = [
  { title: 'Vendors', text: 'Directory, documents and event vendors.', route: '/host/vendors' },
  { title: 'Teams', text: 'People, roles and event crews.', route: '/host/teams' },
  { title: 'Opportunities', text: 'Vending, partnerships and possible events.', route: '/host/opportunities' },
  { title: 'Directories', text: 'Reusable venues, vendors and resources.', route: '/host/directories' },
  { title: 'Finances', text: 'Revenue, expenses and event profit.', route: '/host/finances' },
  { title: 'Marketing', text: 'Campaigns, content and promotion.', route: '/host/campaigns' },
  { title: 'Communications', text: 'Schedules, messages and audiences.', route: '/host/communications' },
  { title: 'Inventory', text: 'Equipment, supplies and rentals.', route: '/host/inventory-hub' },
  { title: 'Templates', text: 'Reusable event building blocks.', route: '/host/library' },
];

export default function HostMoreScreen() {
  const [profile, setProfile] = useState<HostCenterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void ensureHostCenterProfile().then((value) => { if (active) setProfile(value); }).catch((error) => console.warn('[host-more] setup load failed', error)).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const progress = useMemo(() => getHostSetupProgress(profile), [profile]);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>HOST CENTER</Text><Text style={styles.title}>More</Text><Text style={styles.subtitle}>Directories, money, marketing, settings and the rest of your operating tools.</Text>

    <Pressable style={styles.setupCard} onPress={() => router.push('/host/setup' as never)}>
      <View style={styles.flex}><Text style={styles.setupLabel}>HOST SETUP</Text><Text style={styles.setupTitle}>{loading ? 'Checking setup…' : `${progress.completed} of ${progress.total} complete`}</Text><Text style={styles.setupText}>Finish organization details, defaults, privacy, notifications, connections and team setup.</Text></View>
      {loading ? <ActivityIndicator color="#D7B45A" size="small" /> : <Text style={styles.percent}>{progress.percent}%</Text>}
    </Pressable>

    <View style={styles.list}>{sections.map((item, index) => <Pressable key={item.title} onPress={() => router.push(item.route as never)} style={[styles.row, index > 0 && styles.divider]}><View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowText}>{item.text}</Text></View><Text style={styles.arrow}>›</Text></Pressable>)}</View>

    <Text style={styles.sectionTitle}>AI & ACCOUNT</Text>
    <Pressable style={styles.action} onPress={() => router.push('/host/ai-privacy' as never)}><View style={styles.flex}><Text style={styles.rowTitle}>AI & Privacy</Text><Text style={styles.rowText}>Memory, personalization and optional analytics.</Text></View><Text style={styles.arrow}>›</Text></Pressable>
    <Pressable style={styles.action} onPress={() => router.push('/host/setup' as never)}><View style={styles.flex}><Text style={styles.rowTitle}>Host Setup & Introduction</Text><Text style={styles.rowText}>Continue setup or replay the Host Center introduction.</Text></View><Text style={styles.arrow}>›</Text></Pressable>

    <Text style={styles.sectionTitle}>SWITCH EXPERIENCE</Text>
    <Pressable style={styles.exit} onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.exitTitle}>Exit Host Center</Text><Text style={styles.exitText}>Return to the normal Go Melanated member experience without signing out.</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0A0F0C' }, content: { padding: 18, paddingBottom: 90, maxWidth: 820, width: '100%', alignSelf: 'center' }, eyebrow: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 31, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#8E9A92', fontSize: 10.5, lineHeight: 16, marginTop: 5 }, setupCard: { minHeight: 102, borderRadius: 17, borderWidth: 1, borderColor: '#6B5722', backgroundColor: '#211C0F', padding: 14, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 }, setupLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, setupTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900', marginTop: 3 }, setupText: { color: '#918A70', fontSize: 8.5, lineHeight: 13, marginTop: 4 }, percent: { color: '#E7C464', fontSize: 20, fontWeight: '900' }, list: { borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#131B16', overflow: 'hidden', marginTop: 14 }, row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A352F' }, rowTitle: { color: '#EAF0EC', fontSize: 11, fontWeight: '900' }, rowText: { color: '#78857D', fontSize: 8.5, lineHeight: 13, marginTop: 3 }, arrow: { color: '#D7B45A', fontSize: 20 }, sectionTitle: { color: '#77857C', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 22, marginBottom: 7 }, action: { minHeight: 66, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#131B16', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginTop: 7 }, exit: { borderRadius: 14, borderWidth: 1, borderColor: '#514833', backgroundColor: '#171711', padding: 13 }, exitTitle: { color: '#E8D6A2', fontSize: 11, fontWeight: '900' }, exitText: { color: '#7F7A69', fontSize: 8.5, lineHeight: 13, marginTop: 3 } });
