import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOutingHostAccess } from '../../src/hosting/api';
import { getCampaignDaysUntil, getCampaignReadiness, listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { getEventOperationsSummary } from '../../src/hosting/eventBuilder';
import { HOST_WORKSPACE_ITEMS } from '../../src/hosting/hostWorkspace';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = { bg: '#0B100D', panel: '#151B17', raised: '#1C241F', line: '#2E3832', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#84C992', danger: '#EA806E', purple: '#A990ED', blue: '#75AEE8', orange: '#E7A05C' };

type EventSummary = { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getEventOperationsSummary>> };

export default function HostCenterScreen() {
  const { width } = useWindowDimensions();
  const roomy = width >= 760;
  const [campaigns, setCampaigns] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');

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
          progress: getCampaignReadiness(campaign), taskCount: campaign.tasks.length,
          completeTaskCount: campaign.tasks.filter((task) => task.status === 'complete').length,
          overdueTaskCount: 0, revenueCents: 0, expenseCents: 0, profitCents: 0,
          confirmedVendors: 0, pendingVendors: 0, scheduledCommunications: 0, draftCommunications: 0,
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
  const openTasks = useMemo(() => active.flatMap(({ campaign }) => campaign.tasks.filter((task) => task.status !== 'complete').map((task) => ({ ...task, campaign }))).sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')), [active]);
  const flagged = openTasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical');
  const overdue = active.reduce((sum, item) => sum + item.operations.overdueTaskCount, 0);
  const pendingVendors = active.reduce((sum, item) => sum + item.operations.pendingVendors, 0);
  const readiness = active.length ? Math.round(active.reduce((sum, item) => sum + item.operations.progress, 0) / active.length) : 0;

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /><Text style={styles.loadingText}>Opening Host Center…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={[styles.content, roomy && styles.contentRoomy]} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>GO MELANATED</Text><Text style={styles.title}>Host Center</Text><Text style={styles.subtitle}>Build and run your events from one workspace.</Text></View>
        <View style={styles.topActions}>
          <Pressable style={styles.createButton} onPress={() => router.push('/host/create' as never)}><AppIcon name="add" color="#171B16" size={18} /><Text style={styles.createButtonText}>Build Event</Text></Pressable>
          <Pressable accessibilityLabel="Open Host Center menu" style={styles.menuButton} onPress={() => router.push('/host/menu' as never)}><AppIcon name="menu" color={COLORS.cream} size={23} /></Pressable>
        </View>
      </View>

      {!approved ? <View style={styles.accessCard}><Text style={styles.accessTitle}>Host access required</Text><Text style={styles.accessBody}>Complete the Host Pathway before event tools unlock.</Text><Pressable style={styles.primary} onPress={() => router.push('/host/apply' as never)}><Text style={styles.primaryText}>Open Host Pathway</Text></Pressable></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}

      {approved ? <>
        <View style={styles.hero}><View style={{ flex: 1 }}><Text style={styles.heroKicker}>EVENT WORKSPACE</Text><Text style={styles.heroTitle}>Everything tied to active events.</Text><Text style={styles.heroCopy}>Event execution stays here. Organization-wide work stays in Management.</Text></View><View style={styles.heroActions}><Pressable style={styles.heroPrimary} onPress={() => router.push('/host/events' as never)}><Text style={styles.heroPrimaryText}>Open Events</Text></Pressable><Pressable style={styles.heroSecondary} onPress={() => router.push('/management' as never)}><Text style={styles.heroSecondaryText}>Switch to Management</Text></Pressable></View></View>

        <View style={styles.statsRow}><StatCard value={String(active.length)} label="Active events" /><StatCard value={`${readiness}%`} label="Average ready" /><StatCard value={String(openTasks.length)} label="Open tasks" /><StatCard value={String(flagged.length + overdue)} label="Need attention" danger={flagged.length + overdue > 0} /></View>

        <SectionHeader title="Active events" action="View all" onPress={() => router.push('/host/events' as never)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>{active.length === 0 ? <View style={styles.emptyEvent}><Text style={styles.emptyEventTitle}>No active events</Text><Text style={styles.emptyEventBody}>Create an event to start planning.</Text></View> : active.map(({ campaign, operations }) => <EventCard key={campaign.id} campaign={campaign} operations={operations} />)}</ScrollView>

        <View style={[styles.board, roomy && styles.boardRoomy]}>
          <View style={styles.boardColumn}><SectionHeader title="Needs attention" /><View style={styles.listCard}>{flagged.length === 0 && overdue === 0 && pendingVendors === 0 ? <Text style={styles.emptyText}>No flagged event issues.</Text> : <>{overdue > 0 ? <AlertRow title={`${overdue} overdue task${overdue === 1 ? '' : 's'}`} meta="Across active events" icon="tasks" route="/host/work" /> : null}{flagged.slice(0, 3).map((task) => <AlertRow key={task.id} title={task.title} meta={`${task.campaign.shortTitle} · ${task.status}`} icon="notifications" route="/host/work" />)}{pendingVendors > 0 ? <AlertRow title={`${pendingVendors} vendor response${pendingVendors === 1 ? '' : 's'} pending`} meta="Review event vendor work" icon="storefront" route="/host/vendors" /> : null}</>}</View></View>
          <View style={styles.boardColumn}><SectionHeader title="Your work" action="View all" onPress={() => router.push('/host/work' as never)} /><View style={styles.listCard}>{openTasks.slice(0, 5).length === 0 ? <Text style={styles.emptyText}>No open event work.</Text> : openTasks.slice(0, 5).map((task, index) => <Pressable key={task.id} style={[styles.taskRow, index > 0 && styles.divider]} onPress={() => router.push('/host/work' as never)}><View style={[styles.taskDot, { backgroundColor: task.priority === 'critical' ? COLORS.danger : task.status === 'blocked' ? COLORS.orange : COLORS.gold }]} /><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {task.dueLabel}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View></View>
        </View>

        <SectionHeader title="Host tools" action="Full menu" onPress={() => router.push('/host/menu' as never)} />
        <View style={[styles.toolGrid, roomy && styles.toolGridRoomy]}>{HOST_WORKSPACE_ITEMS.slice(0, 8).map((item) => <Pressable key={item.key} style={[styles.toolCard, roomy && styles.toolCardRoomy]} onPress={() => router.push(item.route as never)}><View style={[styles.toolIcon, { backgroundColor: `${item.accent}20` }]}><AppIcon name={item.icon} color={item.accent} size={20} /></View><Text style={styles.toolTitle}>{item.title}</Text><Text style={styles.toolSubtitle}>{item.subtitle}</Text></Pressable>)}</View>

        <Pressable style={styles.profileBanner} onPress={() => router.push('/host/profile' as never)}><View style={styles.profileIcon}><AppIcon name="profile" color={COLORS.gold} size={22} /></View><View style={{ flex: 1 }}><Text style={styles.profileTitle}>Your Host Profile</Text><Text style={styles.profileCopy}>Manage the public identity members see when they view your events.</Text></View><Text style={styles.chevron}>›</Text></Pressable>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onPress ? <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>; }
function StatCard({ value, label, danger = false }: { value: string; label: string; danger?: boolean }) { return <View style={styles.statCard}><Text style={[styles.statValue, danger && styles.statDanger]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function AlertRow({ title, meta, icon, route }: { title: string; meta: string; icon: 'tasks' | 'notifications' | 'storefront'; route: string }) { return <Pressable style={styles.alertRow} onPress={() => router.push(route as never)}><View style={styles.alertIcon}><AppIcon name={icon} color={COLORS.danger} size={17} /></View><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{title}</Text><Text style={styles.alertMeta}>{meta}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; }

function EventCard({ campaign, operations }: { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getEventOperationsSummary>> }) {
  const days = getCampaignDaysUntil(campaign); const remaining = Math.max(operations.taskCount - operations.completeTaskCount, 0); const attention = campaign.tasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical').length + operations.overdueTaskCount; const date = new Date(campaign.startsAt);
  return <Pressable style={[styles.eventCard, { borderTopColor: campaign.accent || COLORS.gold }]} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}><View style={[styles.eventArt, { backgroundColor: campaign.accent || '#26352B' }]}><Text style={styles.eventArtKicker}>{campaign.status.toUpperCase()}</Text><Text style={styles.eventArtTitle}>{campaign.shortTitle}</Text><Text style={styles.eventArtLocation}>{campaign.location}</Text></View><View style={styles.eventBody}><View style={styles.eventProgressLine}><Text style={styles.eventReady}>{operations.progress}% ready</Text><Text style={styles.eventDays}>{days >= 0 ? `${days} days` : 'In progress'}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(operations.progress, 100))}%` }]} /></View><View style={styles.eventMetrics}><View><Text style={styles.eventMetricValue}>{remaining}</Text><Text style={styles.eventMetricLabel}>Tasks left</Text></View><View><Text style={[styles.eventMetricValue, attention > 0 && styles.statDanger]}>{attention}</Text><Text style={styles.eventMetricLabel}>Need attention</Text></View><View><Text style={styles.eventDateMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.eventDateDay}>{date.getDate()}</Text></View></View></View></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }, loadingText: { color: COLORS.muted, fontSize: 12 }, content: { padding: 18, paddingBottom: 100 }, contentRoomy: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 26 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }, eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.cream, fontSize: 31, fontWeight: '900', marginTop: 2 }, subtitle: { color: COLORS.muted, fontSize: 11.5, marginTop: 4 }, topActions: { flexDirection: 'row', gap: 8 }, createButton: { minHeight: 44, borderRadius: 12, backgroundColor: COLORS.gold, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, createButtonText: { color: '#171B16', fontSize: 11, fontWeight: '900' }, menuButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 22, backgroundColor: '#20192A', borderWidth: 1, borderColor: '#4D3B61', padding: 18, gap: 16 }, heroKicker: { color: COLORS.purple, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, heroTitle: { color: COLORS.cream, fontSize: 25, lineHeight: 30, fontWeight: '900', marginTop: 4 }, heroCopy: { color: '#B7B0BD', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 680 }, heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, heroPrimary: { minHeight: 42, borderRadius: 11, backgroundColor: COLORS.gold, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }, heroPrimaryText: { color: '#171B16', fontSize: 11, fontWeight: '900' }, heroSecondary: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#5B4B68', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }, heroSecondaryText: { color: COLORS.cream, fontSize: 11, fontWeight: '800' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, statCard: { flexGrow: 1, minWidth: 120, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12 }, statValue: { color: COLORS.cream, fontSize: 23, fontWeight: '900' }, statDanger: { color: COLORS.danger }, statLabel: { color: COLORS.dim, fontSize: 9.5, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 9 }, sectionTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' }, sectionAction: { color: COLORS.gold, fontSize: 10, fontWeight: '900' },
  eventRow: { gap: 10, paddingRight: 14 }, eventCard: { width: 300, borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderTopWidth: 3, overflow: 'hidden' }, eventArt: { minHeight: 132, padding: 15, justifyContent: 'flex-end' }, eventArtKicker: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, eventArtTitle: { color: '#FFFFFF', fontSize: 21, lineHeight: 24, fontWeight: '900', marginTop: 4 }, eventArtLocation: { color: '#F1EEE8', fontSize: 9.5, marginTop: 4 }, eventBody: { padding: 13 }, eventProgressLine: { flexDirection: 'row', justifyContent: 'space-between' }, eventReady: { color: COLORS.cream, fontSize: 11, fontWeight: '900' }, eventDays: { color: COLORS.muted, fontSize: 10 }, progressTrack: { height: 5, borderRadius: 99, backgroundColor: '#29312C', overflow: 'hidden', marginTop: 8 }, progressFill: { height: '100%', backgroundColor: COLORS.gold }, eventMetrics: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }, eventMetricValue: { color: COLORS.cream, fontSize: 17, fontWeight: '900' }, eventMetricLabel: { color: COLORS.dim, fontSize: 8, marginTop: 1 }, eventDateMonth: { color: COLORS.gold, fontSize: 8, fontWeight: '900' }, eventDateDay: { color: COLORS.cream, fontSize: 23, fontWeight: '900', lineHeight: 25 }, emptyEvent: { width: 300, minHeight: 140, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 18, justifyContent: 'center' }, emptyEventTitle: { color: COLORS.cream, fontSize: 16, fontWeight: '900' }, emptyEventBody: { color: COLORS.dim, fontSize: 10, marginTop: 4 },
  board: { gap: 10 }, boardRoomy: { flexDirection: 'row' }, boardColumn: { flex: 1 }, listCard: { backgroundColor: COLORS.panel, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' }, alertRow: { minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line }, alertIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#2B1E1A', alignItems: 'center', justifyContent: 'center' }, alertTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '800' }, alertMeta: { color: COLORS.dim, fontSize: 9, marginTop: 2 }, taskRow: { minHeight: 61, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line }, taskDot: { width: 8, height: 8, borderRadius: 4 }, taskTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '800' }, taskMeta: { color: COLORS.dim, fontSize: 9, marginTop: 2 }, chevron: { color: COLORS.muted, fontSize: 23 }, emptyText: { color: COLORS.dim, fontSize: 10.5, padding: 16 },
  toolGrid: { gap: 8 }, toolGridRoomy: { flexDirection: 'row', flexWrap: 'wrap' }, toolCard: { minHeight: 112, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12 }, toolCardRoomy: { width: '24.3%' }, toolIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 9 }, toolTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900' }, toolSubtitle: { color: COLORS.dim, fontSize: 9, lineHeight: 13, marginTop: 3 }, profileBanner: { marginTop: 20, minHeight: 82, borderRadius: 17, borderWidth: 1, borderColor: '#554A29', backgroundColor: '#1B1C14', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }, profileIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#2B2818', alignItems: 'center', justifyContent: 'center' }, profileTitle: { color: COLORS.cream, fontSize: 14, fontWeight: '900' }, profileCopy: { color: COLORS.dim, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  accessCard: { borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 18 }, accessTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' }, accessBody: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 5 }, primary: { minHeight: 42, borderRadius: 11, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#171B16', fontSize: 11, fontWeight: '900' }, errorCard: { borderRadius: 14, backgroundColor: '#261817', padding: 13, marginBottom: 12 }, error: { color: '#FF9B90', fontSize: 11 }, retry: { color: COLORS.gold, fontSize: 10, fontWeight: '900', marginTop: 7 },
});
