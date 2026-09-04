import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOutingHostAccess } from '../../src/hosting/api';
import { getCampaignDaysUntil, getCampaignReadiness, listHostCampaigns, type HostCampaign } from '../../src/hosting/campaigns';
import { getEventOperationsSummary } from '../../src/hosting/eventBuilder';
import { supabase } from '../../src/lib/supabase';
import { listHostOpportunities } from '../../src/management/opportunities';
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

type DashboardTask = HostCampaign['tasks'][number] & { campaign: HostCampaign };
type AdventureImageRow = { id: string; hero_image_url: string | null };
type PaidOrderRow = { id: string; adventure_id: string; total_cents: number };
type AttendeeRow = { order_id: string };
type TicketTypeRow = { adventure_id: string; capacity: number | null; is_active: boolean };

type PerformanceSummary = {
  adventureId: string;
  ticketsSold: number;
  revenueCents: number;
  capacity: number | null;
};

export default function HostCenterScreen() {
  const { width } = useWindowDimensions();
  const roomy = width >= 760;
  const desktop = width >= 1024;
  const cardWidth = desktop ? 310 : Math.max(260, Math.min(width * 0.84, 290));

  const [campaigns, setCampaigns] = useState<EventSummary[]>([]);
  const [performance, setPerformance] = useState<Map<string, PerformanceSummary>>(new Map());
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [opportunityCount, setOpportunityCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError('');
    try {
      const [access, authResult] = await Promise.all([
        getOutingHostAccess(),
        supabase.auth.getUser(),
      ]);
      setApproved(access.approved);
      setCurrentProfileId(authResult.data.user?.id ?? null);

      if (!access.approved) {
        setCampaigns([]);
        setPerformance(new Map());
        setOpportunityCount(0);
        return;
      }

      const [rows, opportunities] = await Promise.all([
        listHostCampaigns(),
        listHostOpportunities().catch(() => []),
      ]);
      setOpportunityCount(opportunities.length);

      const adventureIds = [...new Set(rows.map((campaign) => campaign.adventureId))];
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

      if (adventureIds.length > 0) {
        try {
          const [{ data: paidOrdersData }, { data: ticketTypesData }] = await Promise.all([
            supabase.from('orders').select('id,adventure_id,total_cents').in('adventure_id', adventureIds).eq('status', 'paid'),
            supabase.from('ticket_types').select('adventure_id,capacity,is_active').in('adventure_id', adventureIds).eq('is_active', true),
          ]);
          const paidOrders = (paidOrdersData ?? []) as PaidOrderRow[];
          const ticketTypes = (ticketTypesData ?? []) as TicketTypeRow[];
          const orderIds = paidOrders.map((order) => order.id);
          let attendees: AttendeeRow[] = [];
          if (orderIds.length > 0) {
            const { data } = await supabase.from('order_attendees').select('order_id').in('order_id', orderIds);
            attendees = (data ?? []) as AttendeeRow[];
          }

          const orderAdventure = new Map(paidOrders.map((order) => [order.id, order.adventure_id]));
          const nextPerformance = new Map<string, PerformanceSummary>();
          for (const adventureId of adventureIds) {
            const ordersForEvent = paidOrders.filter((order) => order.adventure_id === adventureId);
            const orderIdSet = new Set(ordersForEvent.map((order) => order.id));
            const ticketsSold = attendees.filter((attendee) => orderIdSet.has(attendee.order_id)).length;
            const revenueCents = ordersForEvent.reduce((sum, order) => sum + (order.total_cents || 0), 0);
            const capacities = ticketTypes.filter((ticket) => ticket.adventure_id === adventureId && ticket.capacity !== null).map((ticket) => ticket.capacity as number);
            const capacity = capacities.length ? capacities.reduce((sum, value) => sum + value, 0) : null;
            if (ticketsSold > 0 || revenueCents > 0 || capacity !== null) {
              nextPerformance.set(adventureId, { adventureId, ticketsSold, revenueCents, capacity });
            }
          }
          void orderAdventure;
          setPerformance(nextPerformance);
        } catch {
          setPerformance(new Map());
        }
      } else {
        setPerformance(new Map());
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Host Center.');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(true); } finally { setRefreshing(false); }
  }, [load]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = useMemo(() => dedupeEvents(
    campaigns.filter(({ campaign }) => campaign.status !== 'complete').sort((a, b) => a.campaign.startsAt.localeCompare(b.campaign.startsAt)),
  ), [campaigns]);

  const openTasks = useMemo<DashboardTask[]>(() => active
    .flatMap(({ campaign }) => campaign.tasks.filter((task) => task.status !== 'complete').map((task) => ({ ...task, campaign })))
    .sort((a, b) => taskPriorityScore(b) - taskPriorityScore(a) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999')), [active]);

  const myTasks = useMemo(() => currentProfileId ? openTasks.filter((task) => task.assigneeProfileId === currentProfileId) : [], [currentProfileId, openTasks]);
  const attentionTasks = useMemo(() => openTasks.filter((task) => isAttentionTask(task)), [openTasks]);
  const overdueTasks = attentionTasks.filter((task) => isOverdue(task));
  const blockedCount = attentionTasks.filter((task) => task.status === 'blocked').length;
  const waitingCount = attentionTasks.filter((task) => task.status === 'waiting').length;
  const pendingVendors = active.reduce((sum, item) => sum + item.operations.pendingVendors, 0);
  const confirmedVendors = active.reduce((sum, item) => sum + item.operations.confirmedVendors, 0);
  const revenue = active.reduce((sum, item) => sum + item.operations.revenueCents, 0);
  const expenses = active.reduce((sum, item) => sum + item.operations.expenseCents, 0);
  const scheduledMarketing = active.reduce((sum, item) => sum + item.operations.scheduledCommunications, 0);
  const attentionCount = attentionTasks.length + pendingVendors;
  const nextEvent = active[0];
  const nextEventDays = nextEvent ? getCampaignDaysUntil(nextEvent.campaign) : null;
  const recommendedTask = attentionTasks[0] ?? myTasks[0] ?? openTasks[0] ?? null;
  const subtitle = nextEvent ? `Next: ${compactEventTitle(nextEvent.campaign.shortTitle)} · ${formatCountdown(nextEventDays)}` : 'Plan events, tasks and operations from one place.';
  const performanceEvents = active.filter((item) => performance.has(item.campaign.adventureId)).slice(0, 3);

  if (loading) return <HostCenterSkeleton />;

  return <SafeAreaView style={styles.safe}>
    <ScrollView
      contentContainerStyle={[styles.content, roomy && styles.contentRoomy]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={COLORS.gold} />}
    >
      <View style={styles.topbar}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>GO MELANATED</Text>
          <Text style={styles.title}>Host Center</Text>
          <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.createButton} onPress={() => router.push('/host/create' as never)}><AppIcon name="add" color="#171B16" size={18} /><Text style={styles.createButtonText}>Build Event</Text></Pressable>
          {!desktop ? <Pressable accessibilityLabel="Open Host Center menu" style={styles.menuButton} onPress={() => router.push('/host/menu' as never)}><AppIcon name="menu" color={COLORS.cream} size={23} /></Pressable> : null}
        </View>
      </View>

      {!approved ? <View style={styles.accessCard}><Text style={styles.accessTitle}>Host access required</Text><Text style={styles.accessBody}>Complete the Host Pathway before operations tools unlock.</Text><Pressable style={styles.primary} onPress={() => router.push('/host/apply' as never)}><Text style={styles.primaryText}>Open Host Pathway</Text></Pressable></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}

      {approved ? <>
        <View style={[styles.summaryStrip, roomy && styles.summaryStripRoomy]}>
          <Summary value={String(active.length)} label="Active events" onPress={() => router.push('/host/events' as never)} roomy={roomy} />
          <Summary value={formatCountdown(nextEventDays)} label="Next event" onPress={() => nextEvent ? router.push(`/host/campaigns/${nextEvent.campaign.slug}` as never) : router.push('/host/events' as never)} roomy={roomy} />
          <Summary value={String(openTasks.length)} label="Open tasks" onPress={() => router.push('/host/work' as never)} roomy={roomy} />
          <Summary value={String(attentionCount)} label="Need attention" onPress={() => router.push('/host/work' as never)} roomy={roomy} danger={attentionCount > 0} />
        </View>

        {active.length === 0 ? <View style={styles.zeroState}><View style={styles.zeroIcon}><AppIcon name="calendar" color={COLORS.gold} size={24} /></View><Text style={styles.zeroTitle}>Your Host Center is ready</Text><Text style={styles.zeroBody}>Create your first event and the dashboard will start organizing tasks, dates, vendors and operations around it.</Text><Pressable style={styles.primary} onPress={() => router.push('/host/create' as never)}><Text style={styles.primaryText}>Build first event</Text></Pressable></View> : null}

        {recommendedTask ? <Pressable style={styles.nextActionCard} onPress={() => router.push('/host/work' as never)}><View style={styles.nextActionIcon}><AppIcon name="tasks" color={COLORS.gold} size={18} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.nextActionEyebrow}>RECOMMENDED NEXT ACTION</Text><Text style={styles.nextActionTitle} numberOfLines={1}>{recommendedTask.title}</Text><Text style={styles.nextActionMeta} numberOfLines={1}>{compactEventTitle(recommendedTask.campaign.shortTitle)} · {formatTaskTiming(recommendedTask)}</Text></View><Text style={styles.chevron}>›</Text></Pressable> : null}

        <SectionHeader title="Active events" action="View all" onPress={() => router.push('/host/events' as never)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 10} decelerationRate="fast" contentContainerStyle={styles.eventRow}>
          {active.length === 0 ? <View style={styles.emptyEvent}><Text style={styles.emptyEventTitle}>No active events</Text><Text style={styles.emptyEventBody}>Create an event to start planning.</Text></View> : active.map(({ campaign, operations, heroImageUrl }) => <EventCard key={campaign.id} campaign={campaign} operations={operations} heroImageUrl={heroImageUrl} width={cardWidth} />)}
        </ScrollView>

        <View style={[styles.board, roomy && styles.boardRoomy]}>
          <View style={[styles.boardColumn, roomy && styles.boardColumnRoomy]}>
            <SectionHeader title="Needs attention" action={attentionCount > 2 ? `View all ${attentionCount}` : undefined} onPress={attentionCount > 2 ? () => router.push('/host/work' as never) : undefined} />
            <View style={styles.attentionSummary}><Text style={styles.attentionSummaryText}>{overdueTasks.length} overdue · {blockedCount} blocked · {waitingCount} waiting</Text></View>
            <View style={styles.listCard}>
              {attentionTasks.length === 0 && pendingVendors === 0 ? <Text style={styles.emptyText}>Nothing needs attention right now.</Text> : <>
                {attentionTasks.slice(0, 2).map((task, index) => <AttentionRow key={task.id} task={task} first={index === 0} />)}
                {attentionTasks.length < 2 && pendingVendors > 0 ? <Pressable style={[styles.alertRow, attentionTasks.length > 0 && styles.divider]} onPress={() => router.push('/host/vendors' as never)}><View style={styles.alertIcon}><AppIcon name="message" color={COLORS.orange} size={17} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.alertTitle}>{pendingVendors} vendor response{pendingVendors === 1 ? '' : 's'} pending</Text><Text style={styles.alertMeta}>Vendor activity · Waiting</Text></View><Text style={styles.chevron}>›</Text></Pressable> : null}
              </>}
            </View>
          </View>

          <View style={[styles.boardColumn, roomy && styles.boardColumnRoomy]}>
            <SectionHeader title={myTasks.length > 0 ? `My work · ${myTasks.length}` : 'My work'} action={myTasks.length > 3 ? 'View all' : undefined} onPress={myTasks.length > 3 ? () => router.push('/host/work' as never) : undefined} />
            <View style={styles.listCard}>
              {myTasks.length === 0 ? <View style={styles.clearState}><Text style={styles.clearTitle}>You're clear</Text><Text style={styles.clearMeta}>No work is assigned to you.</Text></View> : myTasks.slice(0, 3).map((task, index) => <Pressable key={task.id} style={[styles.taskRow, index > 0 && styles.divider]} onPress={() => router.push('/host/work' as never)}><View style={[styles.priorityBar, { backgroundColor: task.priority === 'critical' || isOverdue(task) ? COLORS.danger : task.status === 'blocked' ? COLORS.orange : COLORS.gold }]} /><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text><Text style={styles.taskMeta} numberOfLines={1}>{compactEventTitle(task.campaign.shortTitle)} · {formatTaskTiming(task)}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
              <Pressable style={styles.quickAddRow} onPress={() => router.push('/host/work' as never)}><AppIcon name="add" color={COLORS.gold} size={16} /><Text style={styles.quickAddText}>Quick add task</Text></Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.lowerGrid, roomy && styles.lowerGridRoomy]}>
          <View style={[styles.lowerColumn, roomy && styles.lowerColumnRoomy]}>
            <View style={styles.sectionStandaloneHeader}><Text style={styles.sectionTitleStandalone}>Operations</Text><Text style={styles.scopeLabel}>Across active events</Text></View>
            <View style={styles.businessGrid}>
              <BusinessCard title="Finances" value={revenue || expenses ? `$${(revenue / 100).toLocaleString()}` : '$0'} meta={revenue || expenses ? `$${(expenses / 100).toLocaleString()} expenses` : '$0 tracked'} icon="reports" accent={COLORS.green} route="/host/finances" />
              <BusinessCard title="Vendors" value={pendingVendors > 0 ? `${confirmedVendors} confirmed` : confirmedVendors > 0 ? `${confirmedVendors} confirmed` : 'Clear'} meta={`${pendingVendors} pending`} icon="storefront" accent={COLORS.blue} route="/host/vendors" />
              <BusinessCard title="Marketing" value={`${scheduledMarketing} scheduled`} meta={scheduledMarketing > 0 ? 'Communications queued' : 'Nothing scheduled'} icon="megaphone" accent={COLORS.orange} route="/host/campaigns" />
              <BusinessCard title="Opportunities" value={`${opportunityCount} open`} meta="Business development" icon="briefcase" accent={COLORS.gold} route="/host/opportunities" />
            </View>
          </View>

          <View style={[styles.lowerColumn, roomy && styles.lowerColumnRoomy]}>
            <View style={styles.sectionStandaloneHeader}><Text style={styles.sectionTitleStandalone}>Event performance</Text><Text style={styles.scopeLabel}>Registration and ticketing</Text></View>
            <View style={styles.listCard}>
              {performanceEvents.length === 0 ? <Text style={styles.emptyText}>Ticket performance will appear when sales are tracked.</Text> : performanceEvents.map((item, index) => <PerformanceRow key={item.campaign.id} item={item} data={performance.get(item.campaign.adventureId)!} first={index === 0} />)}
            </View>
          </View>
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function HostCenterSkeleton() {
  return <SafeAreaView style={styles.safe}><View style={styles.skeletonContent}><View style={[styles.skeleton, { width: 110, height: 10 }]} /><View style={[styles.skeleton, { width: 220, height: 34, marginTop: 10 }]} /><View style={[styles.skeleton, { width: 220, height: 12, marginTop: 10 }]} /><View style={styles.skeletonGrid}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.skeleton, styles.skeletonMetric]} />)}</View><View style={[styles.skeleton, { height: 76, borderRadius: 17, marginTop: 14 }]} /><View style={[styles.skeleton, { height: 215, borderRadius: 18, marginTop: 28 }]} /></View></SafeAreaView>;
}

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onPress ? <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function Summary({ value, label, onPress, roomy, danger = false }: { value: string; label: string; onPress: () => void; roomy: boolean; danger?: boolean }) {
  return <Pressable style={[styles.summaryCard, roomy && styles.summaryCardRoomy]} onPress={onPress}><Text style={[styles.summaryValue, danger && styles.danger]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></Pressable>;
}

function AttentionRow({ task, first }: { task: DashboardTask; first: boolean }) {
  const icon = task.status === 'blocked' ? 'close' : task.status === 'waiting' ? 'time' : task.priority === 'critical' ? 'notifications' : 'time';
  const accent = task.status === 'blocked' ? COLORS.orange : task.priority === 'critical' || isOverdue(task) ? COLORS.danger : COLORS.gold;
  return <Pressable style={[styles.alertRow, !first && styles.divider]} onPress={() => router.push('/host/work' as never)}><View style={[styles.alertIcon, { backgroundColor: `${accent}18` }]}><AppIcon name={icon} color={accent} size={17} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.alertTitle} numberOfLines={1}>{task.title}</Text><Text style={styles.alertMeta} numberOfLines={1}>{compactEventTitle(task.campaign.shortTitle)} · {formatTaskTiming(task)}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

function BusinessCard({ title, value, meta, icon, accent, route }: { title: string; value: string; meta: string; icon: Parameters<typeof AppIcon>[0]['name']; accent: string; route: string }) {
  return <Pressable style={styles.businessCard} onPress={() => router.push(route as never)}><View style={[styles.businessIcon, { backgroundColor: `${accent}20` }]}><AppIcon name={icon} color={accent} size={18} /></View><Text style={styles.businessTitle}>{title}</Text><Text style={styles.businessValue}>{value}</Text><Text style={styles.businessMeta}>{meta}</Text></Pressable>;
}

function EventCard({ campaign, operations, heroImageUrl, width }: { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getEventOperationsSummary>>; heroImageUrl: string | null; width: number }) {
  const days = getCampaignDaysUntil(campaign);
  const remaining = Math.max(operations.taskCount - operations.completeTaskCount, 0);
  const attention = campaign.tasks.filter((task) => task.status !== 'complete' && isAttentionTask({ ...task, campaign })).length;
  const date = new Date(campaign.startsAt);
  const readinessLabel = operations.progress === 0 && remaining > 0 ? 'Planning started' : `${operations.progress}% ready`;
  const art = <View style={styles.eventImageOverlay}><Text style={styles.eventStatus}>{campaign.status.toUpperCase()}</Text><Text style={styles.eventTitle} numberOfLines={2}>{compactEventTitle(campaign.shortTitle)}</Text><Text style={styles.eventLocation} numberOfLines={1}>{formatDisplayLocation(campaign.location)}</Text></View>;
  return <Pressable style={[styles.eventCard, { width, borderTopColor: campaign.accent || COLORS.gold }]} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}>{heroImageUrl ? <ImageBackground source={{ uri: heroImageUrl }} style={styles.eventArt} imageStyle={styles.eventImage} resizeMode="cover">{art}</ImageBackground> : <View style={[styles.eventArt, styles.eventArtFallback, { backgroundColor: campaign.accent || '#26352B' }]}>{art}</View>}<View style={styles.eventBody}><View style={styles.eventProgressLine}><Text style={styles.eventReady}>{readinessLabel}</Text><Text style={styles.eventDays}>{days > 0 ? `${days} days to event` : 'Today'}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(operations.progress, 100))}%` }]} /></View><View style={styles.eventMetrics}><Text style={styles.metricInline}><Text style={styles.metricStrong}>{remaining}</Text> tasks</Text><Text style={[styles.metricInline, attention > 0 && styles.danger]}><Text style={styles.metricStrong}>{attention}</Text> attention</Text><View><Text style={styles.dateMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateDay}>{date.getDate()}</Text></View></View></View></Pressable>;
}

function PerformanceRow({ item, data, first }: { item: EventSummary; data: PerformanceSummary; first: boolean }) {
  const percent = data.capacity && data.capacity > 0 ? Math.min(100, Math.round((data.ticketsSold / data.capacity) * 100)) : null;
  return <Pressable style={[styles.performanceRow, !first && styles.divider]} onPress={() => router.push(`/host/campaigns/${item.campaign.slug}` as never)}>{item.heroImageUrl ? <ImageBackground source={{ uri: item.heroImageUrl }} style={styles.performanceThumb} imageStyle={styles.performanceThumbImage} /> : <View style={[styles.performanceThumb, { backgroundColor: item.campaign.accent || COLORS.raised }]} />}<View style={{ flex: 1, minWidth: 0 }}><Text style={styles.performanceTitle} numberOfLines={1}>{compactEventTitle(item.campaign.shortTitle)}</Text><Text style={styles.performanceMeta}>{data.capacity ? `${data.ticketsSold} / ${data.capacity} sold` : `${data.ticketsSold} sold`} · ${(data.revenueCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</Text>{percent !== null ? <View style={styles.performanceTrack}><View style={[styles.performanceFill, { width: `${percent}%` }]} /></View> : null}</View><Text style={styles.chevron}>›</Text></Pressable>;
}

function dedupeEvents(items: EventSummary[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${normalize(item.campaign.shortTitle)}|${item.campaign.startsAt}|${normalize(item.campaign.location)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function isOverdue(task: DashboardTask) { return Boolean(task.dueAt && Number.isFinite(new Date(task.dueAt).getTime()) && new Date(task.dueAt).getTime() < Date.now()); }
function isAttentionTask(task: DashboardTask) { return task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical' || isOverdue(task); }
function taskPriorityScore(task: DashboardTask) { let value = 0; if (isOverdue(task)) value += 60; if (task.status === 'blocked') value += 50; if (task.priority === 'critical') value += 40; if (task.status === 'waiting') value += 25; if (task.dueAt) { const days = Math.ceil((new Date(task.dueAt).getTime() - Date.now()) / 86_400_000); if (days === 0) value += 20; else if (days === 1) value += 10; } return value; }
function formatCountdown(days: number | null) { if (days === null) return '—'; if (days <= 0) return 'Today'; if (days === 1) return 'Tomorrow'; return `${days} days`; }
function compactEventTitle(value: string) { if (/dubious advice/i.test(value)) return 'Dubious Advice'; if (value.length <= 42) return value; const parts = value.split(':').map((part) => part.trim()).filter(Boolean); if (parts.length > 1 && parts[1].length >= 5 && parts[1].length <= 42) return parts[1]; return `${value.slice(0, 39).trim()}…`; }
function formatTaskTiming(task: DashboardTask) { if (task.dueAt) { const due = new Date(task.dueAt); const diff = Math.ceil((due.getTime() - Date.now()) / 86_400_000); if (Number.isFinite(diff)) { if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`; if (diff === 0) return 'Due today'; if (diff === 1) return 'Due tomorrow'; if (diff <= 7) return `Due in ${diff} days`; } } if (task.status === 'blocked') return 'Blocked'; if (task.status === 'waiting') return 'Waiting'; return task.dueLabel ? `Due ${task.dueLabel}` : 'No due date'; }
function formatDisplayLocation(location: string) { const dotParts = location.split('·').map((part) => part.trim()).filter(Boolean); if (dotParts.length > 1) return `${dotParts[0]} · ${dotParts[dotParts.length - 1]}`; const commaParts = location.split(',').map((part) => part.trim()).filter(Boolean); if (commaParts.length >= 3) return `${commaParts[0]} · ${commaParts[commaParts.length - 2]}, ${commaParts[commaParts.length - 1]}`; return location; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  skeletonContent: { padding: 18 }, skeleton: { backgroundColor: COLORS.raised, borderRadius: 8 }, skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }, skeletonMetric: { width: '48.5%', height: 88, borderRadius: 15 },
  content: { padding: 18, paddingBottom: 96 }, contentRoomy: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 26, paddingBottom: 90 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }, eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.cream, fontSize: 31, fontWeight: '900', marginTop: 2 }, subtitle: { color: COLORS.muted, fontSize: 11.5, lineHeight: 16, marginTop: 3, maxWidth: 520 },
  topActions: { flexDirection: 'row', gap: 8 }, createButton: { minHeight: 44, borderRadius: 12, backgroundColor: COLORS.gold, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, createButtonText: { color: '#171B16', fontSize: 11, fontWeight: '900' }, menuButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, summaryStripRoomy: { flexWrap: 'nowrap' }, summaryCard: { width: '48.5%', minHeight: 88, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 10, justifyContent: 'center', alignItems: 'center' }, summaryCardRoomy: { width: 'auto', flex: 1, minWidth: 125 }, summaryValue: { color: COLORS.cream, fontSize: 21, fontWeight: '900', textAlign: 'center' }, summaryLabel: { color: COLORS.dim, fontSize: 9.5, marginTop: 2, textAlign: 'center' }, danger: { color: COLORS.danger },
  zeroState: { marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 18 }, zeroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#2B2617', alignItems: 'center', justifyContent: 'center' }, zeroTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900', marginTop: 12 }, zeroBody: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 560 },
  nextActionCard: { marginTop: 12, minHeight: 72, borderRadius: 17, borderWidth: 1, borderColor: '#594A25', backgroundColor: '#1B1B13', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, nextActionIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#302817', alignItems: 'center', justifyContent: 'center' }, nextActionEyebrow: { color: COLORS.gold, fontSize: 7.5, fontWeight: '900', letterSpacing: 1 }, nextActionTitle: { color: COLORS.cream, fontSize: 12.5, fontWeight: '900', marginTop: 2 }, nextActionMeta: { color: COLORS.dim, fontSize: 8.8, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 7 }, sectionTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' }, sectionAction: { color: COLORS.gold, fontSize: 10, fontWeight: '900' },
  eventRow: { gap: 10, paddingRight: 18 }, eventCard: { minHeight: 210, borderRadius: 17, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderTopWidth: 3, overflow: 'hidden' }, eventArt: { height: 92, justifyContent: 'flex-end' }, eventArtFallback: { height: 72 }, eventImage: { borderTopLeftRadius: 14, borderTopRightRadius: 14 }, eventImageOverlay: { flex: 1, justifyContent: 'flex-end', padding: 11, backgroundColor: 'rgba(8,12,9,0.36)' }, eventStatus: { color: COLORS.cream, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.1 }, eventTitle: { color: COLORS.cream, fontSize: 16, lineHeight: 18, fontWeight: '900', marginTop: 3, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }, eventLocation: { color: '#F1E8D7', fontSize: 8.5, marginTop: 2, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }, eventBody: { padding: 11 }, eventProgressLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, eventReady: { color: COLORS.cream, fontSize: 9.8, fontWeight: '900' }, eventDays: { color: COLORS.dim, fontSize: 8.5, flexShrink: 1, textAlign: 'right' }, progressTrack: { height: 4, borderRadius: 5, backgroundColor: '#26322B', marginTop: 7, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 5, backgroundColor: COLORS.gold }, eventMetrics: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, metricInline: { color: COLORS.dim, fontSize: 9 }, metricStrong: { color: COLORS.cream, fontSize: 13, fontWeight: '900' }, dateMonth: { color: COLORS.gold, fontSize: 7.5, fontWeight: '900', textAlign: 'center' }, dateDay: { color: COLORS.cream, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  board: { gap: 0 }, boardRoomy: { flexDirection: 'row', gap: 14 }, boardColumn: {}, boardColumnRoomy: { flex: 1 }, attentionSummary: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 }, attentionSummaryText: { color: COLORS.muted, fontSize: 9.5 }, listCard: { borderRadius: 16, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' }, emptyText: { color: COLORS.dim, fontSize: 11, padding: 14 }, alertRow: { minHeight: 58, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 }, alertIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, alertTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' }, alertMeta: { color: COLORS.dim, fontSize: 8.8, marginTop: 2 },
  taskRow: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'stretch', gap: 9 }, priorityBar: { width: 4, borderRadius: 4, marginVertical: 11 }, taskTitle: { color: COLORS.cream, fontSize: 11.8, fontWeight: '900', marginTop: 9 }, taskMeta: { color: COLORS.dim, fontSize: 8.8, marginTop: 2, marginBottom: 9 }, clearState: { padding: 12 }, clearTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' }, clearMeta: { color: COLORS.dim, fontSize: 9, marginTop: 2 }, quickAddRow: { minHeight: 42, margin: 8, borderRadius: 11, backgroundColor: '#201D12', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, quickAddText: { color: COLORS.gold, fontSize: 10.5, fontWeight: '900' }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line }, chevron: { color: COLORS.muted, fontSize: 22, alignSelf: 'center' },
  lowerGrid: { gap: 0 }, lowerGridRoomy: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 }, lowerColumn: {}, lowerColumnRoomy: { flex: 1 }, sectionStandaloneHeader: { marginTop: 18, marginBottom: 7 }, sectionTitleStandalone: { color: COLORS.cream, fontSize: 18, fontWeight: '900' }, scopeLabel: { color: COLORS.dim, fontSize: 8.5, marginTop: 2 }, businessGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, businessCard: { width: '48.5%', minHeight: 104, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 11 }, businessIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }, businessTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' }, businessValue: { color: COLORS.cream, fontSize: 17, fontWeight: '900', marginTop: 4 }, businessMeta: { color: COLORS.dim, fontSize: 8.8, lineHeight: 12, marginTop: 2 },
  performanceRow: { minHeight: 70, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, performanceThumb: { width: 54, height: 44, borderRadius: 10, overflow: 'hidden' }, performanceThumbImage: { borderRadius: 10 }, performanceTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' }, performanceMeta: { color: COLORS.muted, fontSize: 9, marginTop: 3 }, performanceTrack: { height: 3, borderRadius: 3, backgroundColor: '#26322B', marginTop: 6, overflow: 'hidden' }, performanceFill: { height: '100%', backgroundColor: COLORS.green },
  emptyEvent: { width: 280, minHeight: 140, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 16, justifyContent: 'center' }, emptyEventTitle: { color: COLORS.cream, fontSize: 15, fontWeight: '900' }, emptyEventBody: { color: COLORS.dim, fontSize: 10, marginTop: 4 },
  accessCard: { borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 16 }, accessTitle: { color: COLORS.cream, fontSize: 17, fontWeight: '900' }, accessBody: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 5 }, primary: { alignSelf: 'flex-start', marginTop: 12, minHeight: 42, borderRadius: 11, backgroundColor: COLORS.gold, justifyContent: 'center', paddingHorizontal: 13 }, primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' }, errorCard: { marginTop: 10, borderRadius: 14, backgroundColor: '#281915', borderWidth: 1, borderColor: '#66362D', padding: 12 }, error: { color: '#FFB4A9', fontSize: 11 }, retry: { color: COLORS.gold, fontSize: 10, fontWeight: '900', marginTop: 6 },
});
