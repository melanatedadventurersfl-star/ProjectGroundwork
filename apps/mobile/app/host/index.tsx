import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOutingHostAccess } from '../../src/hosting/api';
import { getCampaignDaysUntil, getCampaignReadiness, listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { getEventOperationsSummary } from '../../src/hosting/eventBuilder';
import { supabase } from '../../src/lib/supabase';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = {
  bg: '#0B100D', panel: '#151B17', raised: '#1C241F', line: '#2E3832', cream: '#FFF8E8',
  muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#84C992', danger: '#EA806E',
  blue: '#75AEE8', orange: '#E7A05C', purple: '#A990ED',
};

type EventSummary = {
  campaign: HostCampaign;
  operations: Awaited<ReturnType<typeof getEventOperationsSummary>>;
  heroImageUrl: string | null;
};

type RecentActivity = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  campaignTitle: string;
};

type AdventureImageRow = { id: string; hero_image_url: string | null };
type ActivityRow = { id: string; title: string; status: string; updated_at: string; campaign_id: string };

export default function HostCenterScreen() {
  const { width } = useWindowDimensions();
  const roomy = width >= 760;
  const desktop = width >= 1024;
  const cardWidth = desktop ? 330 : Math.max(280, Math.min(width - 72, 360));

  const [campaigns, setCampaigns] = useState<EventSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
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
        setRecentActivity([]);
        return;
      }

      const rows = await listHostCampaigns();
      const adventureIds = rows.map((campaign) => campaign.adventureId);
      const campaignIds = rows.map((campaign) => campaign.id);

      const imageMap = new Map<string, string | null>();
      if (adventureIds.length > 0) {
        const { data } = await supabase.from('adventures').select('id,hero_image_url').in('id', adventureIds);
        for (const row of (data ?? []) as AdventureImageRow[]) imageMap.set(row.id, row.hero_image_url);
      }

      const hydrated = await Promise.all(rows.map(async (campaign) => ({
        campaign,
        heroImageUrl: imageMap.get(campaign.adventureId) ?? null,
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

      if (campaignIds.length > 0) {
        const { data } = await supabase
          .from('host_campaign_tasks')
          .select('id,title,status,updated_at,campaign_id')
          .in('campaign_id', campaignIds)
          .order('updated_at', { ascending: false })
          .limit(4);
        const titleById = new Map(rows.map((campaign) => [campaign.id, campaign.shortTitle]));
        setRecentActivity(((data ?? []) as ActivityRow[]).map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          updatedAt: row.updated_at,
          campaignTitle: titleById.get(row.campaign_id) ?? 'Host Center',
        })));
      } else {
        setRecentActivity([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Host Center.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = useMemo(
    () => campaigns.filter(({ campaign }) => campaign.status !== 'complete').sort((a, b) => a.campaign.startsAt.localeCompare(b.campaign.startsAt)),
    [campaigns],
  );
  const openTasks = useMemo(() => active
    .flatMap(({ campaign }) => campaign.tasks.filter((task) => task.status !== 'complete').map((task) => ({ ...task, campaign })))
    .sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')), [active]);
  const flagged = openTasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical');
  const overdue = active.reduce((sum, item) => sum + item.operations.overdueTaskCount, 0);
  const pendingVendors = active.reduce((sum, item) => sum + item.operations.pendingVendors, 0);
  const readiness = active.length ? Math.round(active.reduce((sum, item) => sum + item.operations.progress, 0) / active.length) : 0;
  const revenue = active.reduce((sum, item) => sum + item.operations.revenueCents, 0);
  const expenses = active.reduce((sum, item) => sum + item.operations.expenseCents, 0);
  const scheduledMarketing = active.reduce((sum, item) => sum + item.operations.scheduledCommunications, 0);
  const attentionCount = flagged.length + overdue;
  const upcoming = active.slice(0, 3);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /><Text style={styles.loadingText}>Opening Host Center…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={[styles.content, roomy && styles.contentRoomy]} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>GO MELANATED</Text>
          <Text style={styles.title}>Host Center</Text>
          <Text style={styles.subtitle}>{active.length} active event{active.length === 1 ? '' : 's'} · {openTasks.length} open task{openTasks.length === 1 ? '' : 's'} · {attentionCount} need attention</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.createButton} onPress={() => router.push('/host/create' as never)}><AppIcon name="add" color="#171B16" size={18} /><Text style={styles.createButtonText}>Build Event</Text></Pressable>
          {!desktop ? <Pressable accessibilityLabel="Open Host Center menu" style={styles.menuButton} onPress={() => router.push('/host/menu' as never)}><AppIcon name="menu" color={COLORS.cream} size={23} /></Pressable> : null}
        </View>
      </View>

      {!approved ? <View style={styles.accessCard}><Text style={styles.accessTitle}>Host access required</Text><Text style={styles.accessBody}>Complete the Host Pathway before operations tools unlock.</Text><Pressable style={styles.primary} onPress={() => router.push('/host/apply' as never)}><Text style={styles.primaryText}>Open Host Pathway</Text></Pressable></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}

      {approved ? <>
        <View style={styles.summaryStrip}>
          <Summary value={String(active.length)} label="Active events" route="/host/events" />
          <Summary value={`${readiness}%`} label="Average ready" route="/host/events" />
          <Summary value={String(openTasks.length)} label="Open tasks" route="/host/work" />
          <Summary value={String(attentionCount)} label="Need attention" route="/host/work" danger={attentionCount > 0} />
        </View>

        <SectionHeader title="Active events" action="View all" onPress={() => router.push('/host/events' as never)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast" contentContainerStyle={styles.eventRow}>
          {active.length === 0
            ? <View style={styles.emptyEvent}><Text style={styles.emptyEventTitle}>No active events</Text><Text style={styles.emptyEventBody}>Create an event to start planning.</Text></View>
            : active.map(({ campaign, operations, heroImageUrl }) => <EventCard key={campaign.id} campaign={campaign} operations={operations} heroImageUrl={heroImageUrl} width={cardWidth} />)}
        </ScrollView>

        <View style={[styles.board, roomy && styles.boardRoomy]}>
          <View style={styles.boardColumn}>
            <SectionHeader title="Needs attention" action={attentionCount > 3 ? `View all ${attentionCount}` : undefined} onPress={attentionCount > 3 ? () => router.push('/host/work' as never) : undefined} />
            <View style={styles.listCard}>
              {flagged.length === 0 && overdue === 0 && pendingVendors === 0 ? <Text style={styles.emptyText}>Nothing is currently flagged.</Text> : <>
                {overdue > 0 ? <AlertRow title={`${overdue} overdue task${overdue === 1 ? '' : 's'}`} meta="Across active events" action="Review tasks" route="/host/work" /> : null}
                {flagged.slice(0, 3).map((task) => <AlertRow key={task.id} title={task.title} meta={`${task.campaign.shortTitle} · ${task.status}`} action={task.status === 'waiting' ? 'Follow up' : task.status === 'blocked' ? 'Review dependency' : 'Open task'} route="/host/work" />)}
                {pendingVendors > 0 ? <AlertRow title={`${pendingVendors} vendor response${pendingVendors === 1 ? '' : 's'} pending`} meta="Vendor activity" action="Open vendors" route="/host/vendors" /> : null}
              </>}
            </View>
          </View>

          <View style={styles.boardColumn}>
            <SectionHeader title="My work" action={`View all ${openTasks.length}`} onPress={() => router.push('/host/work' as never)} />
            <View style={styles.listCard}>
              {openTasks.length === 0 ? <Text style={styles.emptyText}>No open work.</Text> : openTasks.slice(0, 3).map((task, index) => <Pressable key={task.id} style={[styles.taskRow, index > 0 && styles.divider]} onPress={() => router.push('/host/work' as never)}><View style={[styles.taskDot, { backgroundColor: task.priority === 'critical' ? COLORS.danger : COLORS.gold }]} /><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {task.dueLabel || 'No due date'}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
            </View>
          </View>
        </View>

        <View style={[styles.lowerGrid, roomy && styles.lowerGridRoomy]}>
          <View style={styles.lowerColumn}>
            <Text style={styles.sectionTitleStandalone}>Operations</Text>
            <View style={styles.businessGrid}>
              <BusinessCard title="Finances" value={revenue || expenses ? `$${(revenue / 100).toLocaleString()}` : 'No activity'} meta={revenue || expenses ? `$${(expenses / 100).toLocaleString()} expenses` : 'No financial activity yet'} icon="reports" accent={COLORS.green} route="/host/finances" />
              <BusinessCard title="Vendors" value={pendingVendors > 0 ? String(pendingVendors) : 'Clear'} meta={pendingVendors > 0 ? 'Pending responses' : 'No vendor responses pending'} icon="storefront" accent={COLORS.blue} route="/host/vendors" />
              <BusinessCard title="Marketing" value={scheduledMarketing > 0 ? String(scheduledMarketing) : 'None'} meta={scheduledMarketing > 0 ? 'Scheduled communications' : 'Nothing scheduled'} icon="megaphone" accent={COLORS.orange} route="/host/campaigns" />
              <BusinessCard title="Opportunities" value="Open" meta="Vending, partnerships and sponsorships" icon="briefcase" accent={COLORS.gold} route="/host/opportunities" />
            </View>
          </View>

          <View style={styles.lowerColumn}>
            <SectionHeader title="Upcoming" action="Open calendar" onPress={() => router.push('/host/calendar' as never)} />
            <View style={styles.listCard}>
              {upcoming.length === 0 ? <Text style={styles.emptyText}>No upcoming event dates.</Text> : upcoming.map((item, index) => <UpcomingRow key={item.campaign.id} item={item} first={index === 0} />)}
            </View>

            <SectionHeader title="Recent activity" />
            <View style={styles.listCard}>
              {recentActivity.length === 0 ? <Text style={styles.emptyText}>No recent task activity yet.</Text> : recentActivity.map((item, index) => <ActivityRowView key={item.id} item={item} first={index === 0} />)}
            </View>
          </View>
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onPress ? <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function Summary({ value, label, route, danger = false }: { value: string; label: string; route: string; danger?: boolean }) {
  return <Pressable style={styles.summaryCard} onPress={() => router.push(route as never)}><Text style={[styles.summaryValue, danger && styles.danger]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></Pressable>;
}

function AlertRow({ title, meta, action, route }: { title: string; meta: string; action: string; route: string }) {
  return <Pressable style={styles.alertRow} onPress={() => router.push(route as never)}><View style={styles.alertIcon}><AppIcon name="notifications" color={COLORS.danger} size={17} /></View><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{title}</Text><Text style={styles.alertMeta}>{meta}</Text></View><Text style={styles.rowAction}>{action}</Text><Text style={styles.chevron}>›</Text></Pressable>;
}

function BusinessCard({ title, value, meta, icon, accent, route }: { title: string; value: string; meta: string; icon: Parameters<typeof AppIcon>[0]['name']; accent: string; route: string }) {
  return <Pressable style={styles.businessCard} onPress={() => router.push(route as never)}><View style={[styles.businessIcon, { backgroundColor: `${accent}20` }]}><AppIcon name={icon} color={accent} size={19} /></View><Text style={styles.businessTitle}>{title}</Text><Text style={styles.businessValue}>{value}</Text><Text style={styles.businessMeta}>{meta}</Text></Pressable>;
}

function EventCard({ campaign, operations, heroImageUrl, width }: { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getEventOperationsSummary>>; heroImageUrl: string | null; width: number }) {
  const days = getCampaignDaysUntil(campaign);
  const remaining = Math.max(operations.taskCount - operations.completeTaskCount, 0);
  const attention = campaign.tasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical').length + operations.overdueTaskCount;
  const date = new Date(campaign.startsAt);
  const art = <View style={styles.eventImageOverlay}><Text style={styles.eventStatus}>{campaign.status.toUpperCase()}</Text><Text style={styles.eventTitle}>{campaign.shortTitle}</Text><Text style={styles.eventLocation}>{campaign.location}</Text></View>;

  return <Pressable style={[styles.eventCard, { width, borderTopColor: campaign.accent || COLORS.gold }]} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}>
    {heroImageUrl
      ? <ImageBackground source={{ uri: heroImageUrl }} style={styles.eventArt} imageStyle={styles.eventImage} resizeMode="cover">{art}</ImageBackground>
      : <View style={[styles.eventArt, { backgroundColor: campaign.accent || '#26352B' }]}>{art}</View>}
    <View style={styles.eventBody}>
      <View style={styles.eventProgressLine}><Text style={styles.eventReady}>{operations.progress}% ready</Text><Text style={styles.eventDays}>{days > 0 ? `${days} days` : 'Today'}</Text></View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(operations.progress, 100))}%` }]} /></View>
      <View style={styles.eventMetrics}><View><Text style={styles.metricValue}>{remaining}</Text><Text style={styles.metricLabel}>Tasks left</Text></View><View><Text style={[styles.metricValue, attention > 0 && styles.danger]}>{attention}</Text><Text style={styles.metricLabel}>Need attention</Text></View><View><Text style={styles.dateMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateDay}>{date.getDate()}</Text></View></View>
    </View>
  </Pressable>;
}

function UpcomingRow({ item, first }: { item: EventSummary; first: boolean }) {
  const date = new Date(item.campaign.startsAt);
  return <Pressable style={[styles.upcomingRow, !first && styles.divider]} onPress={() => router.push(`/host/campaigns/${item.campaign.slug}` as never)}>
    <View style={styles.dateBadge}><Text style={styles.dateBadgeMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateBadgeDay}>{date.getDate()}</Text></View>
    {item.heroImageUrl ? <ImageBackground source={{ uri: item.heroImageUrl }} style={styles.thumb} imageStyle={styles.thumbImage} /> : <View style={[styles.thumb, { backgroundColor: item.campaign.accent || COLORS.raised }]} />}
    <View style={{ flex: 1 }}><Text style={styles.upcomingTitle}>{item.campaign.shortTitle}</Text><Text style={styles.upcomingMeta}>{item.campaign.location}</Text></View><Text style={styles.chevron}>›</Text>
  </Pressable>;
}

function ActivityRowView({ item, first }: { item: RecentActivity; first: boolean }) {
  const when = new Date(item.updatedAt);
  return <Pressable style={[styles.activityRow, !first && styles.divider]} onPress={() => router.push('/host/work' as never)}>
    <View style={styles.activityIcon}><AppIcon name="tasks" color={COLORS.purple} size={17} /></View>
    <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityMeta}>{item.campaignTitle} · {item.status.replaceAll('_', ' ')} · {when.toLocaleDateString()}</Text></View><Text style={styles.chevron}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: COLORS.muted, fontSize: 12 },
  content: { padding: 18, paddingBottom: 100 },
  contentRoomy: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 26 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 10 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 31, fontWeight: '900', marginTop: 2 },
  subtitle: { color: COLORS.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4, maxWidth: 650 },
  topActions: { flexDirection: 'row', gap: 8 },
  createButton: { minHeight: 44, borderRadius: 12, backgroundColor: COLORS.gold, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  createButtonText: { color: '#171B16', fontSize: 11, fontWeight: '900' },
  menuButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  summaryCard: { flexGrow: 1, minWidth: 125, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12 },
  summaryValue: { color: COLORS.cream, fontSize: 23, fontWeight: '900' }, summaryLabel: { color: COLORS.dim, fontSize: 9.5, marginTop: 2 }, danger: { color: COLORS.danger },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 9 },
  sectionTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' }, sectionAction: { color: COLORS.gold, fontSize: 10, fontWeight: '900' },
  eventRow: { gap: 12, paddingRight: 18 },
  eventCard: { minHeight: 310, borderRadius: 20, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderTopWidth: 3, overflow: 'hidden' },
  eventArt: { height: 154, justifyContent: 'flex-end' }, eventImage: { borderTopLeftRadius: 17, borderTopRightRadius: 17 },
  eventImageOverlay: { flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: 'rgba(8,12,9,0.30)' },
  eventStatus: { color: '#FFF8E8', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 },
  eventTitle: { color: '#FFF8E8', fontSize: 19, lineHeight: 22, fontWeight: '900', marginTop: 4, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 },
  eventLocation: { color: '#F1E8D7', fontSize: 10, marginTop: 4, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 },
  eventBody: { padding: 13 }, eventProgressLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eventReady: { color: COLORS.cream, fontSize: 11, fontWeight: '900' }, eventDays: { color: COLORS.dim, fontSize: 9.5 },
  progressTrack: { height: 5, borderRadius: 5, backgroundColor: '#26322B', marginTop: 9, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 5, backgroundColor: COLORS.gold },
  eventMetrics: { marginTop: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, metricValue: { color: COLORS.cream, fontSize: 20, fontWeight: '900' }, metricLabel: { color: COLORS.dim, fontSize: 8.5, marginTop: 1 }, dateMonth: { color: COLORS.gold, fontSize: 8.5, fontWeight: '900', textAlign: 'center' }, dateDay: { color: COLORS.cream, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  board: { gap: 2 }, boardRoomy: { flexDirection: 'row', gap: 14 }, boardColumn: { flex: 1 },
  listCard: { borderRadius: 17, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  emptyText: { color: COLORS.dim, fontSize: 11, padding: 16 },
  alertRow: { minHeight: 72, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  alertIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2D1916', alignItems: 'center', justifyContent: 'center' },
  alertTitle: { color: COLORS.cream, fontSize: 12.5, fontWeight: '900' }, alertMeta: { color: COLORS.dim, fontSize: 9.5, marginTop: 2 }, rowAction: { color: COLORS.gold, fontSize: 9, fontWeight: '900' },
  taskRow: { minHeight: 64, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line }, taskDot: { width: 7, height: 7, borderRadius: 4 }, taskTitle: { color: COLORS.cream, fontSize: 12.5, fontWeight: '900' }, taskMeta: { color: COLORS.dim, fontSize: 9.5, marginTop: 2 }, chevron: { color: COLORS.muted, fontSize: 24 },
  lowerGrid: { gap: 14 }, lowerGridRoomy: { flexDirection: 'row', alignItems: 'flex-start' }, lowerColumn: { flex: 1 },
  sectionTitleStandalone: { color: COLORS.cream, fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 9 },
  businessGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, businessCard: { width: '48.5%', minHeight: 142, borderRadius: 17, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 13 }, businessIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 11 }, businessTitle: { color: COLORS.cream, fontSize: 12.5, fontWeight: '900' }, businessValue: { color: COLORS.cream, fontSize: 22, fontWeight: '900', marginTop: 7 }, businessMeta: { color: COLORS.dim, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  upcomingRow: { minHeight: 72, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, dateBadge: { width: 42, alignItems: 'center' }, dateBadgeMonth: { color: COLORS.gold, fontSize: 8, fontWeight: '900' }, dateBadgeDay: { color: COLORS.cream, fontSize: 20, fontWeight: '900' }, thumb: { width: 52, height: 42, borderRadius: 10, overflow: 'hidden' }, thumbImage: { borderRadius: 10 }, upcomingTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' }, upcomingMeta: { color: COLORS.dim, fontSize: 9, marginTop: 2 },
  activityRow: { minHeight: 66, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, activityIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#242132', alignItems: 'center', justifyContent: 'center' }, activityTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' }, activityMeta: { color: COLORS.dim, fontSize: 8.8, marginTop: 2, textTransform: 'capitalize' },
  emptyEvent: { width: 300, minHeight: 180, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 18, justifyContent: 'center' }, emptyEventTitle: { color: COLORS.cream, fontSize: 16, fontWeight: '900' }, emptyEventBody: { color: COLORS.dim, fontSize: 10.5, marginTop: 4 },
  accessCard: { borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 16 }, accessTitle: { color: COLORS.cream, fontSize: 17, fontWeight: '900' }, accessBody: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 5 }, primary: { alignSelf: 'flex-start', marginTop: 12, minHeight: 42, borderRadius: 11, backgroundColor: COLORS.gold, justifyContent: 'center', paddingHorizontal: 13 }, primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  errorCard: { marginTop: 10, borderRadius: 14, backgroundColor: '#281915', borderWidth: 1, borderColor: '#66362D', padding: 12 }, error: { color: '#FFB4A9', fontSize: 11 }, retry: { color: COLORS.gold, fontSize: 10, fontWeight: '900', marginTop: 6 },
});
