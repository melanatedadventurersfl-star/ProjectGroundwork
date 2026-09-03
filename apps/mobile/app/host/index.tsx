import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOutingHostAccess } from '../../src/hosting/api';
import { getCampaignDaysUntil, getCampaignReadiness, listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { getEventOperationsSummary } from '../../src/hosting/eventBuilder';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

const COLORS = { bg: '#0A0F0C', panel: '#131B16', raised: '#19231C', line: '#2D3A32', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#84C992', danger: '#EA806E', purple: '#A990ED', blue: '#75AEE8', orange: '#E7A05C' };

type EventSummary = { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getEventOperationsSummary>> };
type Tool = { title: string; subtitle: string; route: string; icon: AppIconName; accent: string };

const tools: Tool[] = [
  { title: 'Host Profile', subtitle: 'Edit what members see about you', route: '/host/profile', icon: 'profile', accent: '#D7B45A' },
  { title: 'Events', subtitle: 'Build, run and close out events', route: '/host/events', icon: 'adventure', accent: '#D7B45A' },
  { title: 'Work', subtitle: 'Tasks, assignments and deadlines', route: '/host/work', icon: 'tasks', accent: '#A990ED' },
  { title: 'Calendar', subtitle: 'Events, deadlines and schedules', route: '/host/calendar', icon: 'calendar', accent: '#75AEE8' },
  { title: 'Teams', subtitle: 'People, roles and event crews', route: '/host/teams', icon: 'team', accent: '#77B9A6' },
  { title: 'Vendors', subtitle: 'Directory, documents and event vendors', route: '/host/vendors', icon: 'directory', accent: '#75AEE8' },
  { title: 'Opportunities', subtitle: 'Vending, events and partnerships', route: '/host/opportunities', icon: 'briefcase', accent: '#E7A05C' },
  { title: 'Directories', subtitle: 'Venues, vendors and resources', route: '/host/directories', icon: 'directory', accent: '#D7B45A' },
  { title: 'Finances', subtitle: 'Revenue, expenses and profit', route: '/host/finances', icon: 'reports', accent: '#84C992' },
  { title: 'Marketing', subtitle: 'Campaigns, content and promotion', route: '/host/campaigns', icon: 'megaphone', accent: '#E7A05C' },
  { title: 'Communications', subtitle: 'Templates, schedules and audiences', route: '/host/communications', icon: 'notifications', accent: '#A990ED' },
  { title: 'Inventory', subtitle: 'Equipment, supplies and rentals', route: '/host/inventory-hub', icon: 'settings', accent: '#8DA19A' },
  { title: 'Templates', subtitle: 'Reusable event building blocks', route: '/host/library', icon: 'library', accent: '#D7B45A' },
];

export default function HostCenterScreen() {
  const { width } = useWindowDimensions();
  const roomy = width >= 760;
  const [campaigns, setCampaigns] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approved, setApproved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const access = await getOutingHostAccess();
      setApproved(access.approved);
      if (!access.approved) {
        setCampaigns([]);
        return;
      }
      const rows = await listHostCampaigns();
      const hydrated = await Promise.all(rows.map(async (campaign) => ({
        campaign,
        operations: await getEventOperationsSummary(campaign.id).catch(() => ({
          progress: getCampaignReadiness(campaign),
          taskCount: campaign.tasks.length,
          completeTaskCount: campaign.tasks.filter((task) => task.status === 'complete').length,
          overdueTaskCount: 0,
          revenueCents: 0,
          expenseCents: 0,
          profitCents: 0,
          confirmedVendors: 0,
          pendingVendors: 0,
          scheduledCommunications: 0,
          draftCommunications: 0,
        })),
      })));
      setCampaigns(hydrated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Host Center.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = campaigns.filter(({ campaign }) => campaign.status !== 'complete');
  const totalRevenue = active.reduce((sum, item) => sum + item.operations.revenueCents, 0);
  const totalExpenses = active.reduce((sum, item) => sum + item.operations.expenseCents, 0);
  const overdue = active.reduce((sum, item) => sum + item.operations.overdueTaskCount, 0);
  const attention = active.reduce((sum, item) => sum + item.campaign.tasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical').length, 0);
  const readiness = active.length ? Math.round(active.reduce((sum, item) => sum + item.operations.progress, 0) / active.length) : 0;
  const upcomingTasks = useMemo(() => active
    .flatMap(({ campaign }) => campaign.tasks.filter((task) => task.status !== 'complete').map((task) => ({ ...task, campaign })))
    .sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999'))
    .slice(0, 5), [active]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /><Text style={styles.loadingText}>Opening Host Center…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View><Text style={styles.eyebrow}>GO MELANATED</Text><Text style={styles.title}>Host Center</Text></View>
        <Pressable style={styles.buildButton} onPress={() => router.push('/host/create' as never)}><AppIcon name="add" color="#172017" size={18} /><Text style={styles.buildButtonText}>Build an Event</Text></Pressable>
      </View>

      {!approved ? <View style={styles.accessCard}><Text style={styles.accessTitle}>Host access required</Text><Text style={styles.accessBody}>Complete the Host Pathway before event and operations tools unlock.</Text><Pressable style={styles.primary} onPress={() => router.push('/host/apply' as never)}><Text style={styles.primaryText}>Open Host Pathway</Text></Pressable></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}

      {approved ? <>
        <Pressable style={styles.profileBanner} onPress={() => router.push('/host/profile' as never)}>
          <View style={styles.profileIcon}><AppIcon name="profile" color={COLORS.gold} size={23} /></View>
          <View style={styles.profileBannerCopy}><Text style={styles.profileBannerEyebrow}>YOUR PUBLIC PRESENCE</Text><Text style={styles.profileBannerTitle}>Set up your Host Profile</Text><Text style={styles.profileBannerBody}>Add your organization name, about section, specialties, contact options, FAQs and policies.</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1400&q=80' }} imageStyle={styles.heroImage} style={styles.hero}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}><Text style={styles.heroKicker}>OPERATIONS AT A GLANCE</Text><Text style={styles.heroTitle}>{active.length} active event{active.length === 1 ? '' : 's'}</Text><Text style={styles.heroCopy}>{attention + overdue > 0 ? `${attention + overdue} items need attention across your current work.` : 'Your active event work has no flagged issues.'}</Text><View style={styles.heroStats}><HeroStat value={`${readiness}%`} label="Average ready" /><HeroStat value={`$${(totalRevenue / 100).toLocaleString()}`} label="Revenue" /><HeroStat value={`$${((totalRevenue - totalExpenses) / 100).toLocaleString()}`} label="Projected profit" /></View></View>
        </ImageBackground>

        <Text style={styles.sectionTitle}>Needs attention</Text>
        <View style={[styles.metricGrid, roomy && styles.metricGridRoomy]}>
          <MetricCard value={String(overdue)} label="Overdue tasks" accent={COLORS.danger} onPress={() => router.push('/host/work' as never)} />
          <MetricCard value={String(attention)} label="Flagged items" accent={COLORS.orange} onPress={() => router.push('/host/work' as never)} />
          <MetricCard value={`$${(totalExpenses / 100).toLocaleString()}`} label="Event expenses" accent={COLORS.green} onPress={() => router.push('/host/finances' as never)} />
          <MetricCard value={String(active.reduce((sum, item) => sum + item.operations.pendingVendors, 0))} label="Vendors pending" accent={COLORS.blue} onPress={() => router.push('/host/vendors' as never)} />
        </View>

        <View style={styles.sectionRow}><View><Text style={styles.sectionTitle}>Active events</Text><Text style={styles.sectionMeta}>Open an event to see readiness, money, people and what happens next.</Text></View><Pressable onPress={() => router.push('/host/events' as never)}><Text style={styles.sectionAction}>View all</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>
          {active.length === 0 ? <View style={styles.emptyEvent}><Text style={styles.emptyEventTitle}>No active events</Text><Text style={styles.emptyEventBody}>Start with a blank event or an Event Starter.</Text></View> : active.map(({ campaign, operations }) => <EventCard key={campaign.id} campaign={campaign} operations={operations} />)}
        </ScrollView>

        <View style={styles.sectionRow}><View><Text style={styles.sectionTitle}>Your work</Text><Text style={styles.sectionMeta}>The next open tasks across every event.</Text></View><Pressable onPress={() => router.push('/host/work' as never)}><Text style={styles.sectionAction}>Open work</Text></Pressable></View>
        <View style={styles.listCard}>{upcomingTasks.length === 0 ? <Text style={styles.emptyText}>No open event work.</Text> : upcomingTasks.map((task, index) => <Pressable key={task.id} style={[styles.taskRow, index > 0 && styles.divider]} onPress={() => router.push(`/host/campaigns/${task.campaign.slug}/tasks/${task.id}` as never)}><View style={[styles.taskDot, { backgroundColor: task.priority === 'critical' ? COLORS.danger : task.status === 'blocked' ? COLORS.orange : COLORS.gold }]} /><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {task.dueLabel}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>

        <Text style={styles.sectionTitle}>Host tools</Text><Text style={styles.sectionMeta}>Everything that used to be split between Host Center and Management now lives here.</Text>
        <View style={[styles.toolGrid, roomy && styles.toolGridRoomy]}>{tools.map((tool) => <Pressable key={tool.title} style={[styles.toolCard, roomy && styles.toolCardRoomy]} onPress={() => router.push(tool.route as never)}><View style={[styles.toolIcon, { backgroundColor: `${tool.accent}22` }]}><AppIcon name={tool.icon} color={tool.accent} size={20} /></View><View style={{ flex: 1 }}><Text style={styles.toolTitle}>{tool.title}</Text><Text style={styles.toolSubtitle}>{tool.subtitle}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return <View style={styles.heroStat}><Text style={styles.heroStatValue}>{value}</Text><Text style={styles.heroStatLabel}>{label}</Text></View>;
}

function MetricCard({ value, label, accent, onPress }: { value: string; label: string; accent: string; onPress: () => void }) {
  return <Pressable style={styles.metricCard} onPress={onPress}><View style={[styles.metricAccent, { backgroundColor: accent }]} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Pressable>;
}

function EventCard({ campaign, operations }: { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getEventOperationsSummary>> }) {
  const days = getCampaignDaysUntil(campaign);
  return <Pressable style={styles.eventCard} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}><View style={[styles.eventVisual, { backgroundColor: campaign.accent || '#26352B' }]}><Text style={styles.eventVisualMark}>GM</Text><View style={styles.eventStatus}><Text style={styles.eventStatusText}>{campaign.status.toUpperCase()}</Text></View></View><View style={styles.eventBody}><Text style={styles.eventTitle}>{campaign.shortTitle}</Text><Text style={styles.eventMeta}>{campaign.location}</Text><View style={styles.progressRow}><Text style={styles.progressValue}>{operations.progress}% ready</Text><Text style={styles.progressMeta}>{days >= 0 ? `${days} days` : 'In progress'}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(operations.progress, 100))}%` }]} /></View><View style={styles.eventNumbers}><Text style={styles.eventNumber}>{operations.overdueTaskCount} overdue</Text><Text style={styles.eventNumber}>${(operations.profitCents / 100).toLocaleString()} profit</Text></View></View></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: COLORS.muted, fontSize: 12 },
  content: { padding: 18, paddingBottom: 90, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 31, fontWeight: '900', marginTop: 2 },
  buildButton: { minHeight: 42, borderRadius: 12, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  buildButtonText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  profileBanner: { backgroundColor: '#161F19', borderWidth: 1, borderColor: '#5A4E27', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  profileIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#292516', alignItems: 'center', justifyContent: 'center' },
  profileBannerCopy: { flex: 1 },
  profileBannerEyebrow: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  profileBannerTitle: { color: COLORS.cream, fontSize: 15, fontWeight: '900', marginTop: 2 },
  profileBannerBody: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  hero: { minHeight: 255, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImage: { borderRadius: 24 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,12,8,.57)' },
  heroContent: { padding: 19 },
  heroKicker: { color: '#F0D27D', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  heroTitle: { color: '#FFF8E8', fontSize: 27, fontWeight: '900', marginTop: 4 },
  heroCopy: { color: '#D1D9D3', fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 480 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroStat: { flex: 1, borderRadius: 13, padding: 10, backgroundColor: 'rgba(7,15,10,.66)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)' },
  heroStatValue: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  heroStatLabel: { color: '#AAB4AD', fontSize: 8, marginTop: 2 },
  sectionTitle: { color: COLORS.cream, fontSize: 17, fontWeight: '900', marginTop: 22 },
  sectionMeta: { color: COLORS.dim, fontSize: 10, lineHeight: 15, marginTop: 3 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  sectionAction: { color: COLORS.gold, fontSize: 10, fontWeight: '900', paddingBottom: 2 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metricGridRoomy: { flexWrap: 'nowrap' },
  metricCard: { flexGrow: 1, flexBasis: 150, minHeight: 91, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 13, overflow: 'hidden' },
  metricAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  metricValue: { color: COLORS.cream, fontSize: 22, fontWeight: '900' },
  metricLabel: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  eventRow: { gap: 10, paddingTop: 10, paddingBottom: 4 },
  eventCard: { width: 285, borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  eventVisual: { height: 86, padding: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  eventVisualMark: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  eventStatus: { backgroundColor: 'rgba(8,13,10,.70)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  eventStatusText: { color: '#E4E9E5', fontSize: 7, fontWeight: '900' },
  eventBody: { padding: 13 },
  eventTitle: { color: COLORS.cream, fontSize: 14, fontWeight: '900' },
  eventMeta: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 },
  progressValue: { color: COLORS.gold, fontSize: 9, fontWeight: '900' },
  progressMeta: { color: COLORS.muted, fontSize: 8 },
  progressTrack: { height: 5, backgroundColor: '#29352E', borderRadius: 999, marginTop: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 999 },
  eventNumbers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  eventNumber: { color: COLORS.dim, fontSize: 8 },
  emptyEvent: { width: 285, minHeight: 170, borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 18, justifyContent: 'center' },
  emptyEventTitle: { color: COLORS.cream, fontSize: 15, fontWeight: '900' },
  emptyEventBody: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  listCard: { marginTop: 10, borderRadius: 16, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  taskRow: { minHeight: 58, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.line },
  taskDot: { width: 8, height: 8, borderRadius: 4 },
  taskTitle: { color: COLORS.cream, fontSize: 11, fontWeight: '800' },
  taskMeta: { color: COLORS.muted, fontSize: 8, marginTop: 3 },
  emptyText: { color: COLORS.muted, fontSize: 10, padding: 16 },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  toolGridRoomy: { gap: 10 },
  toolCard: { width: '100%', minHeight: 72, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  toolCardRoomy: { width: '32%' },
  toolIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  toolSubtitle: { color: COLORS.muted, fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  chevron: { color: COLORS.dim, fontSize: 22 },
  accessCard: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, padding: 18 },
  accessTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' },
  accessBody: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  primary: { minHeight: 44, borderRadius: 12, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  errorCard: { backgroundColor: '#321E19', borderWidth: 1, borderColor: '#624139', borderRadius: 14, padding: 12, marginBottom: 12 },
  error: { color: '#FFB3A8', fontSize: 10 },
  retry: { color: COLORS.gold, fontSize: 10, fontWeight: '900', marginTop: 7 },
});
