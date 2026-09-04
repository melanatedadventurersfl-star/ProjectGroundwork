import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../../src/ui/AppIcon';
import { findVendorWorkspaceItem } from '../../src/vendor/vendorWorkspace';

const C = { bg: '#0B100D', panel: '#151B17', raised: '#1B231E', line: '#2E3832', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#7FB7A3' };

const SECTION_CONTENT: Record<string, { headline: string; body: string; actions: string[] }> = {
  opportunities: { headline: 'Find work that fits your business', body: 'Opportunity matching will use your vendor category, service area, availability, event types and travel radius.', actions: ['Browse matching events', 'Save an opportunity', 'Review match details'] },
  leads: { headline: 'Turn inquiries into bookings', body: 'Keep direct host requests, questions and quote-ready leads in one place.', actions: ['Review new inquiries', 'Reply to a host', 'Convert a lead to a quote'] },
  applications: { headline: 'Know where every application stands', body: 'Track interested, applied, reviewing, accepted, confirmed and completed work.', actions: ['Review submitted applications', 'Check deadlines', 'Update application details'] },
  bookings: { headline: 'Everything for the event in one workspace', body: 'Bookings connect requirements, arrival details, contacts, tasks, documents and event-day status.', actions: ['Review confirmed events', 'Check event requirements', 'Open event-day details'] },
  calendar: { headline: 'Protect your availability', body: 'Manage confirmed work, tentative dates, application deadlines, blocked dates and booking lead time.', actions: ['Set availability', 'Block dates', 'Review upcoming deadlines'] },
  work: { headline: 'Keep every commitment visible', body: 'Tasks, deadlines and event checklists stay connected to the booking that created them.', actions: ['Quick add a task', 'Review overdue work', 'Open event checklists'] },
  messages: { headline: 'Keep business conversations attached to the work', body: 'Messages stay connected to hosts, events, leads and bookings instead of becoming disconnected threads.', actions: ['Open host conversations', 'Review unread messages', 'Use a saved response'] },
  quotes: { headline: 'Build quotes from your real services', body: 'Create proposals from packages, add-ons, travel fees and custom pricing, then track host approval.', actions: ['Create a quote', 'Review sent quotes', 'Manage quote templates'] },
  payments: { headline: 'See what is due and what is paid', body: 'Track deposits, balances, vendor fees and expected payouts against each booking.', actions: ['Review balances', 'Check upcoming deposits', 'Open payout history'] },
  analytics: { headline: 'See what turns attention into bookings', body: 'Track profile views, inquiries, applications, bookings, repeat hosts and revenue.', actions: ['Review funnel', 'Check top services', 'Review repeat business'] },
  services: { headline: 'Make it easy for hosts to understand what you sell', body: 'Manage services, packages, starting prices, add-ons, minimums and travel fees.', actions: ['Add a service', 'Edit packages', 'Update pricing'] },
  profile: { headline: 'Your marketplace storefront', body: 'The Vendor Center profile edits the same vendor record hosts already discover in the Go Melanated directory.', actions: ['Edit business details', 'Update availability', 'Preview public profile'] },
  portfolio: { headline: 'Let completed work strengthen your profile', body: 'Add approved event photos, videos and highlights to show hosts what working with you looks like.', actions: ['Add photos', 'Add an event highlight', 'Review public portfolio'] },
  reviews: { headline: 'Build a record hosts can trust', body: 'Manage ratings, review responses and repeat-booking signals from completed events.', actions: ['Read reviews', 'Respond to feedback', 'Request a review'] },
  documents: { headline: 'Upload once, reuse when needed', body: 'Keep insurance, W-9s, permits, licenses and certificates with expiration status.', actions: ['Upload document', 'Review expiring documents', 'Check verification status'] },
  team: { headline: 'Bring the right people to each booking', body: 'Manage employees and contractors, then assign tasks and event-day shifts.', actions: ['Add a team member', 'Assign a booking', 'Review upcoming shifts'] },
  settings: { headline: 'Set the rules your business works by', body: 'Control service area, travel radius, booking lead time, capacity, blackout dates and contact preferences.', actions: ['Edit service area', 'Set booking rules', 'Manage preferences'] },
};

export default function VendorSectionScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const key = String(params.section ?? '');
  const item = findVendorWorkspaceItem(key);
  const content = SECTION_CONTENT[key];

  if (!item || !content) return <SafeAreaView style={styles.safe}><View style={styles.missing}><Text style={styles.title}>Vendor Center</Text><Text style={styles.body}>This section is not available.</Text><Pressable onPress={() => router.replace('/vendor' as never)} style={styles.primary}><Text style={styles.primaryText}>Back to Vendor Center</Text></Pressable></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/vendor' as never)}><Text style={styles.back}>‹ Vendor Center</Text></Pressable>
        <Pressable style={styles.menuButton} onPress={() => router.push('/vendor/menu' as never)}><AppIcon name="menu" color={C.cream} size={22} /></Pressable>
      </View>

      <View style={[styles.icon, { backgroundColor: `${item.accent}20` }]}><AppIcon name={item.icon} color={item.accent} size={24} /></View>
      <Text style={styles.eyebrow}>VENDOR CENTER</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{content.headline}</Text>
      <Text style={styles.body}>{content.body}</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusDot} />
        <View style={{ flex: 1 }}><Text style={styles.statusTitle}>Workspace connected</Text><Text style={styles.statusMeta}>This section is part of the Vendor Center shell and shares the existing vendor marketplace model.</Text></View>
      </View>

      <Text style={styles.sectionTitle}>CORE ACTIONS</Text>
      <View style={styles.list}>
        {content.actions.map((action, index) => <View key={action} style={styles.row}>
          <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
          <Text style={styles.rowText}>{action}</Text>
          <AppIcon name="chevron-forward" color={C.dim} size={18} />
        </View>)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' }, missing: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, back: { color: C.gold, fontSize: 12, fontWeight: '900' }, menuButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, eyebrow: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: C.cream, fontSize: 31, fontWeight: '900', marginTop: 3 }, subtitle: { color: C.cream, fontSize: 17, lineHeight: 23, fontWeight: '800', marginTop: 8, maxWidth: 520 }, body: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 580 },
  statusCard: { marginTop: 20, borderRadius: 15, borderWidth: 1, borderColor: '#355342', backgroundColor: '#111C16', padding: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, marginTop: 4 }, statusTitle: { color: C.cream, fontSize: 12, fontWeight: '900' }, statusMeta: { color: C.dim, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  sectionTitle: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 24, marginBottom: 8 }, list: { gap: 7 }, row: { minHeight: 58, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, number: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#2A2317', alignItems: 'center', justifyContent: 'center' }, numberText: { color: C.gold, fontSize: 11, fontWeight: '900' }, rowText: { flex: 1, color: C.cream, fontSize: 12.5, fontWeight: '800' }, primary: { marginTop: 18, minHeight: 44, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: C.bg, fontWeight: '900' },
});
