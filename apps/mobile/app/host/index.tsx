import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOutingHostAccess } from '../../src/hosting/api';
import { getCampaignDaysUntil, getCampaignReadiness, listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { getEventOperationsSummary } from '../../src/hosting/eventBuilder';
import { HOST_WORKSPACE_ITEMS } from '../../src/hosting/hostWorkspace';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = { bg: '#0B100D', panel: '#151B17', raised: '#1C241F', line: '#2E3832', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#84C992', danger: '#EA806E', blue: '#75AEE8', orange: '#E7A05C' };

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
  const openTasks = useMemo(() => active
    .flatMap(({ campaign }) => campaign.tasks.filter((task) => task.status !== 'complete').map((task) => ({ ...task, campaign })))
    .sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')), [active]);
  const flagged = openTasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical');
  const overdue = active.reduce((sum, item) => sum + item.operations.overdueTaskCount, 0);
  const pendingVendors = active.reduce((sum, item) => sum + item.operations.pendingVendors, 0);
  const readiness = active.length ? Math.round(active.reduce((sum, item) => sum + item.operations.progress, 0) / active.length) : 0;
  const revenue = active.reduce((sum, item) => sum + item.operations.revenueCents, 0);
  const expenses = active.reduce((sum, item) => sum + item.operations.expenseCents, 0);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /><Text style={styles.loadingText}>Opening Host Center…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={[styles.content, roomy && styles.contentRoomy]} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>GO MELANATED</Text>
          <Text style={styles.title}>Host Center</Text>
          <Text style={styles.subtitle}>Run your events, team, vendors, money, marketing and day-to-day work.</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.createButton} onPress={() => router.push('/host/create' as never)}><AppIcon name="add" color="#171B16" size={18} /><Text style={styles.createButtonText}>Build Event</Text></Pressable>
          <Pressable accessibilityLabel="Open Host Center menu" style={styles.menuButton} onPress={() => router.push('/host/menu' as never)}><AppIcon name="menu" color={COLORS.cream} size={23} /></Pressable>
        </View>
      </View>

      {!approved ? <View style={styles.accessCard}><Text style={styles.accessTitle}>Host access required</Text><Text style={styles.accessBody}>Complete the Host Pathway before operations tools unlock.</Text><Pressable style={styles.primary} onPress={() => router.push('/host/apply' as never)}><Text style={styles.primaryText}>Open Host Pathway</Text></Pressable></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}

      {approved ? <>
        <View style={styles.summaryStrip}>
          <Summary value={String(active.length)} label="Active events" />
          <Summary value={`${readiness}%`} label="Average ready" />
          <Summary value={String(openTasks.length)} label="Open tasks" />
          <Summary value={String(flagged.length + overdue)} label="Need attention" danger={flagged.length + overdue > 0} />
        </View>

        <SectionHeader title="Active events" action="View all" onPress={() => router.push('/host/events' as never)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>
          {active.length === 0 ? <View style={styles.emptyEvent}><Text style={styles.emptyEventTitle}>No active events</Text><Text style={styles.emptyEventBody}>Create an event to start planning.</Text></View> : active.map(({ campaign, operations }) => <EventCard key={campaign.id} campaign={campaign} operations={operations} />)}
        </ScrollView>

        <View style={[styles.board, roomy && styles.boardRoomy]}>
          <View style={styles.boardColumn}>
            <SectionHeader title="Needs attention" />
            <View style={styles.listCard}>
              {flagged.length === 0 && overdue === 0 && pendingVendors === 0 ? <Text style={styles.emptyText}>Nothing is currently flagged.</Text> : <>
                {overdue > 0 ? <AlertRow title={`${overdue} overdue task${overdue === 1 ? '' : 's'}`} meta="Across active events" route="/host/work" /> : null}
                {flagged.slice(0, 3).map((task) => <AlertRow key={task.id} title={task.title} meta={`${task.campaign.shortTitle} · ${task.status}`} route="/host/work" />)}
                {pendingVendors > 0 ? <AlertRow title={`${pendingVendors} vendor response${pendingVendors === 1 ? '' : 's'} pending`} meta="Review vendor activity" route="/host/vendors" /> : null}
              </>}
            </View>
          </View>

          <View style={styles.boardColumn}>
            <SectionHeader title="My work" action="View all" onPress={() => router.push('/host/work' as never)} />
            <View style={styles.listCard}>{openTasks.length === 0 ? <Text style={styles.emptyText}>No open work.</Text> : openTasks.slice(0, 5).map((task, index) => <Pressable key={task.id} style={[styles.taskRow, index > 0 && styles.divider]} onPress={() => router.push('/host/work' as never)}><View style={[styles.taskDot, { backgroundColor: task.priority === 'critical' ? COLORS.danger : COLORS.gold }]} /><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {task.dueLabel}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>
          </View>
        </View>

        <Text style={styles.sectionTitleStandalone}>Business activity</Text>
        <View style={styles.businessGrid}>
          <BusinessCard title="Finances" value={`$${(revenue / 100).toLocaleString()}`} meta={`$${(expenses / 100).toLocaleString()} expenses`} icon="reports" accent={COLORS.green} route="/host/finances" />
          <BusinessCard title="Vendors" value={String(pendingVendors)} meta="Pending responses" icon="storefront" accent={COLORS.blue} route="/host/vendors" />
          <BusinessCard title="Marketing" value={String(active.reduce((sum, item) => sum + item.operations.scheduledCommunications, 0))} meta="Scheduled communications" icon="megaphone" accent={COLORS.orange} route="/host/campaigns" />
          <BusinessCard title="Opportunities" value="Open" meta="Vending, partnerships and sponsorships" icon="briefcase" accent={COLORS.gold} route="/host/opportunities" />
        </View>

        <SectionHeader title="Quick access" action="Full menu" onPress={() => router.push('/host/menu' as never)} />
        <View style={[styles.toolGrid, roomy && styles.toolGridRoomy]}>{HOST_WORKSPACE_ITEMS.filter((item) => ['work', 'team', 'vendors', 'communications', 'marketing', 'finances', 'documents', 'templates'].includes(item.key)).map((item) => <Pressable key={item.key} style={[styles.toolCard, roomy && styles.toolCardRoomy]} onPress={() => router.push(item.route as never)}><View style={[styles.toolIcon, { backgroundColor: `${item.accent}20` }]}><AppIcon name={item.icon} color={item.accent} size={20} /></View><Text style={styles.toolTitle}>{item.title}</Text><Text style={styles.toolSubtitle}>{item.subtitle}</Text></Pressable>)}</View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onPress ? <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function Summary({ value, label, danger = false }: { value: string; label: string; danger?: boolean }) {
  return <View style={styles.summaryCard}><Text style={[styles.summaryValue, danger && styles.danger]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function AlertRow({ title, meta, route }: { title: string; meta: string; route: string }) {
  return <Pressable style={styles.alertRow} onPress={() => router.push(route as never)}><View style={styles.alertIcon}><AppIcon name="notifications" color={COLORS.danger} size={17} /></View><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{title}</Text><Text style={styles.alertMeta}>{meta}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

function BusinessCard({ title, value, meta, icon, accent, route }: { title: string; value: string; meta: string; icon: Parameters<typeof AppIcon>[0]['name']; accent: string; route: string }) {
  return <Pressable style={styles.businessCard} onPress={() => router.push(route as never)}><View style={[styles.businessIcon, { backgroundColor: `${accent}20` }]}><AppIcon name={icon} color={accent} size={19} /></View><Text style={styles.businessTitle}>{title}</Text><Text style={styles.businessValue}>{value}</Text><Text style={styles.businessMeta}>{meta}</Text></Pressable>;
}

function EventCard({ campaign, operations }: { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getEventOperationsSummary>> }) {
  const days = getCampaignDaysUntil(campaign);
  const remaining = Math.max(operations.taskCount - operations.completeTaskCount, 0);
  const attention = campaign.tasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical').length + operations.overdueTaskCount;
  const date = new Date(campaign.startsAt);
  return <Pressable style={[styles.eventCard, { borderTopColor: campaign.accent || COLORS.gold }]} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}>
    <View style={[styles.eventArt, { backgroundColor: campaign.accent || '#26352B' }]}><Text style={styles.eventStatus}>{campaign.status.toUpperCase()}</Text><Text style={styles.eventTitle}>{campaign.shortTitle}</Text><Text style={styles.eventLocation}>{campaign.location}</Text></View>
    <View style={styles.eventBody}><View style={styles.eventProgressLine}><Text style={styles.eventReady}>{operations.progress}% ready</Text><Text style={styles.eventDays}>{days >= 0 ? `${days} days` : 'In progress'}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(operations.progress, 100))}%` }]} /></View><View style={styles.eventMetrics}><View><Text style={styles.metricValue}>{remaining}</Text><Text style={styles.metricLabel}>Tasks left</Text></View><View><Text style={[styles.metricValue, attention > 0 && styles.danger]}>{attention}</Text><Text style={styles.metricLabel}>Need attention</Text></View><View><Text style={styles.dateMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateDay}>{date.getDate()}</Text></View></View></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }, loadingText: { color: COLORS.muted, fontSize: 12 },
  content: { padding: 18, paddingBottom: 100 }, contentRoomy: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 26 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 10 }, eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.cream, fontSize: 31, fontWeight: '900', marginTop: 2 }, subtitle: { color: COLORS.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4, maxWidth: 650 }, topActions: { flexDirection: 'row', gap: 8 }, createButton: { minHeight: 44, borderRadius: 12, backgroundColor: COLORS.gold, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, createButtonText: { color: '#171B16', fontSize: 11, fontWeight: '900' }, menuButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, summaryCard: { flexGrow: 1, minWidth: 125, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12 }, summaryValue: { color: COLORS.cream, fontSize: 23, fontWeight: '900' }, summaryLabel: { color: COLORS.dim, fontSize: 9.5, marginTop: 2 }, danger: { color: COLORS.danger },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 9 }, sectionTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' }, sectionAction: { color: COLORS.gold, fontSize: 10, fontWeight: '900' }, sectionTitleStandalone: { color: COLORS.cream, fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 9 },
  eventRow: { gap: 10, paddingRight: 18 }, emptyEvent: { width: 300, borderRadius: 16, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 16 }, emptyEventTitle: { color: COLORS.cream, fontWeight: '900' }, emptyEventBody: { color: COLORS.dim, fontSize: 10, marginTop: 4 },
  eventCard: { width: 300, borderRadius: 17, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderTopWidth: 4, overflow: 'hidden' }, eventArt: { minHeight: 112, padding: 14, justifyContent: 'flex-end' }, eventStatus: { color: '#FFFFFFCC', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, eventTitle: { color: '#fff', fontSize: 19, fontWeight: '900', marginTop: 5 }, eventLocation: { color: '#FFFFFFCC', fontSize: 9.5, marginTop: 3 }, eventBody: { padding: 12 }, eventProgressLine: { flexDirection: 'row', justifyContent: 'space-between' }, eventReady: { color: COLORS.cream, fontSize: 10, fontWeight: '800' }, eventDays: { color: COLORS.dim, fontSize: 9.5 }, progressTrack: { height: 5, borderRadius: 4, backgroundColor: '#273029', marginTop: 7, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: COLORS.gold }, eventMetrics: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 11 }, metricValue: { color: COLORS.cream, fontSize: 16, fontWeight: '900' }, metricLabel: { color: COLORS.dim, fontSize: 8.5 }, dateMonth: { color: COLORS.gold, fontSize: 8, fontWeight: '900', textAlign: 'center' }, dateDay: { color: COLORS.cream, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  board: { gap: 4 }, boardRoomy: { flexDirection: 'row', gap: 12 }, boardColumn: { flex: 1 }, listCard: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden', minHeight: 76 }, emptyText: { color: COLORS.dim, fontSize: 10.5, padding: 14 }, alertRow: { minHeight: 62, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line }, alertIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#2A1B18', alignItems: 'center', justifyContent: 'center' }, alertTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '800' }, alertMeta: { color: COLORS.dim, fontSize: 9, marginTop: 2 }, taskRow: { minHeight: 58, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line }, taskDot: { width: 7, height: 7, borderRadius: 4 }, taskTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '800' }, taskMeta: { color: COLORS.dim, fontSize: 9, marginTop: 2 }, chevron: { color: COLORS.muted, fontSize: 23 },
  businessGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, businessCard: { minWidth: 150, flexGrow: 1, width: '47%', minHeight: 128, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12 }, businessIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, businessTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900', marginTop: 9 }, businessValue: { color: COLORS.cream, fontSize: 20, fontWeight: '900', marginTop: 3 }, businessMeta: { color: COLORS.dim, fontSize: 9, lineHeight: 13, marginTop: 2 },
  toolGrid: { gap: 8 }, toolGridRoomy: { flexDirection: 'row', flexWrap: 'wrap' }, toolCard: { minHeight: 86, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12 }, toolCardRoomy: { width: '24.2%' }, toolIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, toolTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900', marginTop: 8 }, toolSubtitle: { color: COLORS.dim, fontSize: 8.8, lineHeight: 12.5, marginTop: 2 },
  accessCard: { borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 16 }, accessTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' }, accessBody: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 5 }, primary: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: COLORS.gold, borderRadius: 11, paddingHorizontal: 13, minHeight: 40, justifyContent: 'center' }, primaryText: { color: '#171B16', fontWeight: '900', fontSize: 10.5 }, errorCard: { borderRadius: 14, backgroundColor: '#261916', borderWidth: 1, borderColor: '#663B33', padding: 13, marginBottom: 10 }, error: { color: '#FFB4A9', fontSize: 11 }, retry: { color: COLORS.gold, fontSize: 10, fontWeight: '900', marginTop: 7 },
});
