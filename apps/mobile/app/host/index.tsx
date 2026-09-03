import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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

type RecentActivity = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  campaignTitle: string;
};

type DashboardTask = HostCampaign['tasks'][number] & { campaign: HostCampaign };
type AdventureImageRow = { id: string; hero_image_url: string | null };
type ActivityRow = { id: string; title: string; status: string; updated_at: string; campaign_id: string };

export default function HostCenterScreen() {
  const { width } = useWindowDimensions();
  const roomy = width >= 760;
  const desktop = width >= 1024;
  const cardWidth = desktop ? 330 : Math.max(276, Math.min(width - 72, 350));

  const [campaigns, setCampaigns] = useState<EventSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
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
        setRecentActivity([]);
        setOpportunityCount(0);
        return;
      }

      const [rows, opportunities] = await Promise.all([
        listHostCampaigns(),
        listHostOpportunities().catch(() => []),
      ]);
      setOpportunityCount(opportunities.length);

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
          .neq('status', 'not_started')
          .order('updated_at', { ascending: false })
          .limit(12);
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
      if (!background) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = useMemo(
    () => campaigns.filter(({ campaign }) => campaign.status !== 'complete').sort((a, b) => a.campaign.startsAt.localeCompare(b.campaign.startsAt)),
    [campaigns],
  );
  const openTasks = useMemo<DashboardTask[]>(() => active
    .flatMap(({ campaign }) => campaign.tasks.filter((task) => task.status !== 'complete').map((task) => ({ ...task, campaign })))
    .sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')), [active]);
  const myTasks = useMemo(
    () => currentProfileId ? openTasks.filter((task) => task.assigneeProfileId === currentProfileId) : [],
    [currentProfileId, openTasks],
  );
  const flagged = useMemo(
    () => openTasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical'),
    [openTasks],
  );
  const overdue = active.reduce((sum, item) => sum + item.operations.overdueTaskCount, 0);
  const pendingVendors = active.reduce((sum, item) => sum + item.operations.pendingVendors, 0);
  const confirmedVendors = active.reduce((sum, item) => sum + item.operations.confirmedVendors, 0);
  const revenue = active.reduce((sum, item) => sum + item.operations.revenueCents, 0);
  const expenses = active.reduce((sum, item) => sum + item.operations.expenseCents, 0);
  const scheduledMarketing = active.reduce((sum, item) => sum + item.operations.scheduledCommunications, 0);
  const attentionCount = flagged.length + overdue + pendingVendors;
  const upcoming = active.slice(0, 3);
  const nextEvent = active[0];
  const nextEventDays = nextEvent ? getCampaignDaysUntil(nextEvent.campaign) : null;
  const recommendedTask = useMemo(() => pickRecommendedTask(flagged, myTasks, openTasks), [flagged, myTasks, openTasks]);
  const subtitle = nextEvent
    ? `${nextEvent.campaign.shortTitle} · ${nextEventDays === 0 ? 'today' : `${nextEventDays} day${nextEventDays === 1 ? '' : 's'} away`}`
    : 'Plan events, tasks and operations from one place.';

  if (loading) return <HostCenterSkeleton />;

  return <SafeAreaView style={styles.safe}>
    <ScrollView
      contentContainerStyle={[styles.content, roomy && styles.contentRoomy]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={COLORS.gold} />}
    >
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>GO MELANATED</Text>
          <Text style={styles.title}>Host Center</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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
          <Summary value={String(active.length)} label="Active events" route="/host/events" roomy={roomy} />
          <Summary value={nextEventDays === null ? '—' : nextEventDays === 0 ? 'Today' : `${nextEventDays} days`} label="Next event" route="/host/events" roomy={roomy} />
          <Summary value={String(openTasks.length)} label="Open tasks" route="/host/work" roomy={roomy} />
          <Summary value={String(attentionCount)} label="Need attention" route="/host/work" roomy={roomy} danger={attentionCount > 0} />
        </View>

        {active.length === 0 ? <View style={styles.zeroState}>
          <View style={styles.zeroIcon}><AppIcon name="calendar" color={COLORS.gold} size={24} /></View>
          <Text style={styles.zeroTitle}>Your Host Center is ready</Text>
          <Text style={styles.zeroBody}>Create your first event and the dashboard will start organizing tasks, dates, vendors and operations around it.</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/host/create' as never)}><Text style={styles.primaryText}>Build first event</Text></Pressable>
        </View> : null}

        {recommendedTask ? <Pressable style={styles.nextActionCard} onPress={() => router.push('/host/work' as never)}>
          <View style={styles.nextActionIcon}><AppIcon name="tasks" color={COLORS.gold} size={18} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.nextActionEyebrow}>RECOMMENDED NEXT ACTION</Text>
            <Text style={styles.nextActionTitle}>{recommendedTask.title}</Text>
            <Text style={styles.nextActionMeta}>{recommendedTask.campaign.shortTitle} · {formatTaskTiming(recommendedTask)}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable> : null}

        <SectionHeader title="Active events" action="View all" onPress={() => router.push('/host/events' as never)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast" contentContainerStyle={styles.eventRow}>
          {active.length === 0
            ? <View style={styles.emptyEvent}><Text style={styles.emptyEventTitle}>No active events</Text><Text style={styles.emptyEventBody}>Create an event to start planning.</Text></View>
            : active.map(({ campaign, operations, heroImageUrl }) => <EventCard key={campaign.id} campaign={campaign} operations={operations} heroImageUrl={heroImageUrl} width={cardWidth} />)}
        </ScrollView>

        <View style={[styles.board, roomy && styles.boardRoomy]}>
          <View style={[styles.boardColumn, roomy && styles.boardColumnRoomy]}>
            <SectionHeader title="Needs attention" action={attentionCount > 3 ? `View all ${attentionCount}` : undefined} onPress={attentionCount > 3 ? () => router.push('/host/work' as never) : undefined} />
            <View style={styles.listCard}>
              {flagged.length === 0 && overdue === 0 && pendingVendors === 0 ? <Text style={styles.emptyText}>Nothing is currently flagged.</Text> : <>
                {overdue > 0 ? <AlertRow title={`${overdue} overdue task${overdue === 1 ? '' : 's'}`} meta="Across active events · overdue" action="Review" route="/host/work" /> : null}
                {flagged.slice(0, 3).map((task) => <AlertRow key={task.id} title={task.title} meta={`${task.campaign.shortTitle} · ${formatTaskTiming(task)}`} action={task.status === 'waiting' ? 'Follow up' : 'Review'} route="/host/work" />)}
                {pendingVendors > 0 ? <AlertRow title={`${pendingVendors} vendor response${pendingVendors === 1 ? '' : 's'} pending`} meta="Vendor activity · waiting" action="Open vendors" route="/host/vendors" /> : null}
              </>}
            </View>
          </View>

          <View style={[styles.boardColumn, roomy && styles.boardColumnRoomy]}>
            <SectionHeader title="My work" action={myTasks.length > 3 ? `View all ${myTasks.length}` : undefined} onPress={myTasks.length > 3 ? () => router.push('/host/work' as never) : undefined} />
            <View style={styles.listCard}>
              {myTasks.length === 0 ? <Text style={styles.emptyText}>No work assigned to you.</Text> : myTasks.slice(0, 3).map((task, index) => <Pressable key={task.id} style={[styles.taskRow, index > 0 && styles.divider]} onPress={() => router.push('/host/work' as never)}>
                <View style={[styles.priorityBar, { backgroundColor: task.priority === 'critical' ? COLORS.danger : task.status === 'blocked' ? COLORS.orange : COLORS.gold }]} />
                <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskMeta}>{task.campaign.shortTitle} · {formatTaskTiming(task)}</Text></View><Text style={styles.chevron}>›</Text>
              </Pressable>)}
              <Pressable style={[styles.quickAddRow, myTasks.length > 0 && styles.divider]} onPress={() => router.push('/host/work' as never)}><AppIcon name="add" color={COLORS.gold} size={16} /><Text style={styles.quickAddText}>Quick add task</Text></Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.lowerGrid, roomy && styles.lowerGridRoomy]}>
          <View style={[styles.lowerColumn, roomy && styles.lowerColumnRoomy]}>
            <View style={styles.sectionStandaloneHeader}><Text style={styles.sectionTitleStandalone}>Operations</Text><Text style={styles.scopeLabel}>Across active events</Text></View>
            <View style={styles.businessGrid}>
              <BusinessCard title="Finances" value={revenue || expenses ? `$${(revenue / 100).toLocaleString()}` : '$0'} meta={revenue || expenses ? `$${(expenses / 100).toLocaleString()} expenses` : `${active.length} active event${active.length === 1 ? '' : 's'} · $0 tracked`} icon="reports" accent={COLORS.green} route="/host/finances" />
              <BusinessCard title="Vendors" value={pendingVendors > 0 ? `${pendingVendors} pending` : 'Clear'} meta={`${confirmedVendors} confirmed · ${pendingVendors} pending`} icon="storefront" accent={COLORS.blue} route="/host/vendors" />
              <BusinessCard title="Marketing" value={`${scheduledMarketing} scheduled`} meta={scheduledMarketing > 0 ? 'Communications queued' : 'No communications scheduled'} icon="megaphone" accent={COLORS.orange} route="/host/campaigns" />
              <BusinessCard title="Opportunities" value={`${opportunityCount} open`} meta={opportunityCount > 0 ? 'Vending, partnerships and sponsorships' : 'No saved opportunities'} icon="briefcase" accent={COLORS.gold} route="/host/opportunities" />
            </View>
          </View>

          <View style={[styles.lowerColumn, roomy && styles.lowerColumnRoomy]}>
            <SectionHeader title="Upcoming" action="Open calendar" onPress={() => router.push('/host/calendar' as never)} />
            <View style={styles.listCard}>
              {upcoming.length === 0 ? <Text style={styles.emptyText}>No upcoming event dates.</Text> : upcoming.map((item, index) => <UpcomingRow key={item.campaign.id} item={item} first={index === 0} />)}
            </View>

            <SectionHeader title="Recent activity" action={recentActivity.length > 4 ? 'View all' : undefined} onPress={recentActivity.length > 4 ? () => router.push('/host/work' as never) : undefined} />
            <View style={styles.listCard}>
              {recentActivity.length === 0 ? <Text style={styles.emptyText}>No meaningful task changes yet.</Text> : recentActivity.slice(0, 4).map((item, index) => <ActivityRowView key={item.id} item={item} first={index === 0} />)}
            </View>
          </View>
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function HostCenterSkeleton() {
  return <SafeAreaView style={styles.safe}><View style={styles.skeletonContent}>
    <View style={[styles.skeleton, { width: 110, height: 10 }]} />
    <View style={[styles.skeleton, { width: 220, height: 34, marginTop: 10 }]} />
    <View style={[styles.skeleton, { width: 260, height: 12, marginTop: 10 }]} />
    <View style={styles.skeletonGrid}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.skeleton, styles.skeletonMetric]} />)}</View>
    <View style={[styles.skeleton, { height: 210, borderRadius: 18, marginTop: 28 }]} />
    <View style={[styles.skeleton, { height: 120, borderRadius: 18, marginTop: 22 }]} />
  </View></SafeAreaView>;
}

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onPress ? <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function Summary({ value, label, route, roomy, danger = false }: { value: string; label: string; route: string; roomy: boolean; danger?: boolean }) {
  return <Pressable style={[styles.summaryCard, roomy && styles.summaryCardRoomy]} onPress={() => router.push(route as never)}><Text style={[styles.summaryValue, danger && styles.danger]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></Pressable>;
}

function AlertRow({ title, meta, action, route }: { title: string; meta: string; action: string; route: string }) {
  return <Pressable style={styles.alertRow} onPress={() => router.push(route as never)}><View style={styles.alertIcon}><AppIcon name="notifications" color={COLORS.danger} size={17} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.alertTitle}>{title}</Text><Text style={styles.alertMeta}>{meta}</Text></View><Text style={styles.rowAction}>{action}</Text><Text style={styles.chevron}>›</Text></Pressable>;
}

function BusinessCard({ title, value, meta, icon, accent, route }: { title: string; value: string; meta: string; icon: Parameters<typeof AppIcon>[0]['name']; accent: string; route: string }) {
  return <Pressable style={styles.businessCard} onPress={() => router.push(route as never)}><View style={[styles.businessIcon, { backgroundColor: `${accent}20` }]}><AppIcon name={icon} color={accent} size={18} /></View><Text style={styles.businessTitle}>{title}</Text><Text style={styles.businessValue}>{value}</Text><Text style={styles.businessMeta}>{meta}</Text></Pressable>;
}

function EventCard({ campaign, operations, heroImageUrl, width }: { campaign: HostCampaign; operations: Awaited<ReturnType<typeof getEventOperationsSummary>>; heroImageUrl: string | null; width: number }) {
  const days = getCampaignDaysUntil(campaign);
  const remaining = Math.max(operations.taskCount - operations.completeTaskCount, 0);
  const attention = campaign.tasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical').length + operations.overdueTaskCount;
  const date = new Date(campaign.startsAt);
  const readinessLabel = operations.progress === 0 && remaining > 0 ? 'Planning started' : `${operations.progress}% ready`;
  const art = <View style={styles.eventImageOverlay}><Text style={styles.eventStatus}>{campaign.status.toUpperCase()}</Text><Text style={styles.eventTitle}>{campaign.shortTitle}</Text><Text style={styles.eventLocation} numberOfLines={1}>{formatDisplayLocation(campaign.location)}</Text></View>;

  return <Pressable style={[styles.eventCard, { width, borderTopColor: campaign.accent || COLORS.gold }]} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}>
    {heroImageUrl
      ? <ImageBackground source={{ uri: heroImageUrl }} style={styles.eventArt} imageStyle={styles.eventImage} resizeMode="cover">{art}</ImageBackground>
      : <View style={[styles.eventArt, { backgroundColor: campaign.accent || '#26352B' }]}>{art}</View>}
    <View style={styles.eventBody}>
      <View style={styles.eventProgressLine}><Text style={styles.eventReady}>{readinessLabel}</Text><Text style={styles.eventDays}>{days > 0 ? `${days} days to event` : 'Today'}</Text></View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(operations.progress, 100))}%` }]} /></View>
      <View style={styles.eventMetrics}><View><Text style={styles.metricValue}>{remaining}</Text><Text style={styles.metricLabel}>Tasks left</Text></View><View><Text style={[styles.metricValue, attention > 0 && styles.danger]}>{attention}</Text><Text style={styles.metricLabel}>Need attention</Text></View><View><Text style={styles.dateMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateDay}>{date.getDate()}</Text></View></View>
    </View>
  </Pressable>;
}

function UpcomingRow({ item, first }: { item: EventSummary; first: boolean }) {
  const date = new Date(item.campaign.startsAt);
  const showYear = date.getFullYear() !== new Date().getFullYear();
  return <Pressable style={[styles.upcomingRow, !first && styles.divider]} onPress={() => router.push(`/host/campaigns/${item.campaign.slug}` as never)}>
    <View style={styles.dateBadge}><Text style={styles.dateBadgeMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.dateBadgeDay}>{date.getDate()}</Text>{showYear ? <Text style={styles.dateBadgeYear}>{date.getFullYear()}</Text> : null}</View>
    {item.heroImageUrl ? <ImageBackground source={{ uri: item.heroImageUrl }} style={styles.thumb} imageStyle={styles.thumbImage} /> : <View style={[styles.thumb, { backgroundColor: item.campaign.accent || COLORS.raised }]} />}
    <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.upcomingTitle} numberOfLines={2}>{item.campaign.shortTitle}</Text><Text style={styles.upcomingMeta} numberOfLines={1}>{formatDisplayLocation(item.campaign.location)}</Text></View><Text style={styles.chevron}>›</Text>
  </Pressable>;
}

function ActivityRowView({ item, first }: { item: RecentActivity; first: boolean }) {
  const complete = item.status === 'complete';
  const accent = complete ? COLORS.green : COLORS.purple;
  return <Pressable style={[styles.activityRow, !first && styles.divider]} onPress={() => router.push('/host/work' as never)}>
    <View style={[styles.activityIcon, { backgroundColor: `${accent}20` }]}><AppIcon name="tasks" color={accent} size={17} /></View>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityMeta}>{item.campaignTitle} · {formatStatus(item.status)} · {formatRelativeDate(item.updatedAt)}</Text></View><Text style={styles.chevron}>›</Text>
  </Pressable>;
}

function pickRecommendedTask(flagged: DashboardTask[], myTasks: DashboardTask[], openTasks: DashboardTask[]) {
  const score = (task: DashboardTask) => {
    let value = 0;
    if (task.status === 'blocked') value += 50;
    if (task.priority === 'critical') value += 40;
    if (task.status === 'waiting') value += 25;
    if (task.dueAt) {
      const due = new Date(task.dueAt).getTime();
      if (Number.isFinite(due)) {
        const days = Math.floor((due - Date.now()) / 86_400_000);
        if (days < 0) value += 60;
        else if (days === 0) value += 35;
        else if (days <= 2) value += 20;
      }
    }
    return value;
  };
  const candidates = flagged.length ? flagged : myTasks.length ? myTasks : openTasks;
  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

function formatTaskTiming(task: DashboardTask) {
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    const diff = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
    if (Number.isFinite(diff)) {
      if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`;
      if (diff === 0) return 'Due today';
      if (diff === 1) return 'Due tomorrow';
      if (diff <= 7) return `Due in ${diff} days`;
    }
  }
  if (task.status === 'blocked') return 'Blocked';
  if (task.status === 'waiting') return 'Waiting';
  return task.dueLabel || 'No due date';
}

function formatDisplayLocation(location: string) {
  const dotParts = location.split('·').map((part) => part.trim()).filter(Boolean);
  if (dotParts.length > 1) return `${dotParts[0]} · ${dotParts[dotParts.length - 1]}`;

  const commaParts = location.split(',').map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    const venue = commaParts[0];
    const city = commaParts[commaParts.length - 2];
    const state = commaParts[commaParts.length - 1];
    return `${venue} · ${city}, ${state}`;
  }
  return location;
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return '';
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 60) return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  skeletonContent: { padding: 18 },
  skeleton: { backgroundColor: COLORS.raised, borderRadius: 8 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  skeletonMetric: { width: '48.5%', height: 88, borderRadius: 15 },
  content: { padding: 18, paddingBottom: 104 },
  contentRoomy: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 26, paddingBottom: 90 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 8 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 31, fontWeight: '900', marginTop: 2 },
  subtitle: { color: COLORS.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4, maxWidth: 650 },
  topActions: { flexDirection: 'row', gap: 8 },
  createButton: { minHeight: 44, borderRadius: 12, backgroundColor: COLORS.gold, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  createButtonText: { color: '#171B16', fontSize: 11, fontWeight: '900' },
  menuButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  summaryStripRoomy: { flexWrap: 'nowrap' },
  summaryCard: { width: '48.5%', minHeight: 82, borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12, justifyContent: 'center' },
  summaryCardRoomy: { width: 'auto', flex: 1, minWidth: 125 },
  summaryValue: { color: COLORS.cream, fontSize: 21, fontWeight: '900' },
  summaryLabel: { color: COLORS.dim, fontSize: 9.5, marginTop: 2 },
  danger: { color: COLORS.danger },
  zeroState: { marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 18 },
  zeroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#2B2617', alignItems: 'center', justifyContent: 'center' },
  zeroTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900', marginTop: 12 },
  zeroBody: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 560 },
  nextActionCard: { marginTop: 14, minHeight: 76, borderRadius: 17, borderWidth: 1, borderColor: '#594A25', backgroundColor: '#1B1B13', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextActionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#302817', alignItems: 'center', justifyContent: 'center' },
  nextActionEyebrow: { color: COLORS.gold, fontSize: 7.5, fontWeight: '900', letterSpacing: 1 },
  nextActionTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900', marginTop: 2 },
  nextActionMeta: { color: COLORS.dim, fontSize: 9, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  sectionTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' },
  sectionAction: { color: COLORS.gold, fontSize: 10, fontWeight: '900' },
  eventRow: { gap: 12, paddingRight: 18 },
  eventCard: { minHeight: 236, borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderTopWidth: 3, overflow: 'hidden' },
  eventArt: { height: 104, justifyContent: 'flex-end' },
  eventImage: { borderTopLeftRadius: 15, borderTopRightRadius: 15 },
  eventImageOverlay: { flex: 1, justifyContent: 'flex-end', padding: 13, backgroundColor: 'rgba(8,12,9,0.32)' },
  eventStatus: { color: '#FFF8E8', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 },
  eventTitle: { color: '#FFF8E8', fontSize: 18, lineHeight: 21, fontWeight: '900', marginTop: 4, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 },
  eventLocation: { color: '#F1E8D7', fontSize: 9.5, marginTop: 3, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 },
  eventBody: { padding: 12 },
  eventProgressLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eventReady: { color: COLORS.cream, fontSize: 10.5, fontWeight: '900' },
  eventDays: { color: COLORS.dim, fontSize: 9, flexShrink: 1, textAlign: 'right' },
  progressTrack: { height: 4, borderRadius: 5, backgroundColor: '#26322B', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: COLORS.gold },
  eventMetrics: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  metricValue: { color: COLORS.cream, fontSize: 18, fontWeight: '900' },
  metricLabel: { color: COLORS.dim, fontSize: 8.5, marginTop: 1 },
  dateMonth: { color: COLORS.gold, fontSize: 8.5, fontWeight: '900', textAlign: 'center' },
  dateDay: { color: COLORS.cream, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  board: { gap: 0 },
  boardRoomy: { flexDirection: 'row', gap: 14 },
  boardColumn: {},
  boardColumnRoomy: { flex: 1 },
  listCard: { borderRadius: 17, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  emptyText: { color: COLORS.dim, fontSize: 11, padding: 16 },
  alertRow: { minHeight: 68, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  alertIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#2D1916', alignItems: 'center', justifyContent: 'center' },
  alertTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  alertMeta: { color: COLORS.dim, fontSize: 9.2, marginTop: 2 },
  rowAction: { color: COLORS.gold, fontSize: 8.8, fontWeight: '900', marginLeft: 8, maxWidth: 76, textAlign: 'right' },
  taskRow: { minHeight: 60, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  priorityBar: { width: 4, borderRadius: 4, marginVertical: 13 },
  taskTitle: { color: COLORS.cream, fontSize: 12.5, fontWeight: '900', marginTop: 11 },
  taskMeta: { color: COLORS.dim, fontSize: 9.5, marginTop: 2, marginBottom: 11 },
  quickAddRow: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickAddText: { color: COLORS.gold, fontSize: 10.5, fontWeight: '900' },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.line },
  chevron: { color: COLORS.muted, fontSize: 24, alignSelf: 'center' },
  lowerGrid: { gap: 0 },
  lowerGridRoomy: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  lowerColumn: {},
  lowerColumnRoomy: { flex: 1 },
  sectionStandaloneHeader: { marginTop: 20, marginBottom: 8 },
  sectionTitleStandalone: { color: COLORS.cream, fontSize: 18, fontWeight: '900' },
  scopeLabel: { color: COLORS.dim, fontSize: 8.5, marginTop: 2 },
  businessGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  businessCard: { width: '48.5%', minHeight: 112, borderRadius: 16, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 12 },
  businessIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  businessTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  businessValue: { color: COLORS.cream, fontSize: 18, fontWeight: '900', marginTop: 5 },
  businessMeta: { color: COLORS.dim, fontSize: 9.2, lineHeight: 13, marginTop: 2 },
  upcomingRow: { minHeight: 68, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateBadge: { width: 42, alignItems: 'center' },
  dateBadgeMonth: { color: COLORS.gold, fontSize: 8, fontWeight: '900' },
  dateBadgeDay: { color: COLORS.cream, fontSize: 19, fontWeight: '900' },
  dateBadgeYear: { color: COLORS.dim, fontSize: 7, marginTop: -1 },
  thumb: { width: 50, height: 40, borderRadius: 10, overflow: 'hidden' },
  thumbImage: { borderRadius: 10 },
  upcomingTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  upcomingMeta: { color: COLORS.dim, fontSize: 8.8, marginTop: 2 },
  activityRow: { minHeight: 62, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  activityMeta: { color: COLORS.dim, fontSize: 8.8, marginTop: 2 },
  emptyEvent: { width: 300, minHeight: 150, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 18, justifyContent: 'center' },
  emptyEventTitle: { color: COLORS.cream, fontSize: 16, fontWeight: '900' },
  emptyEventBody: { color: COLORS.dim, fontSize: 10.5, marginTop: 4 },
  accessCard: { borderRadius: 18, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 16 },
  accessTitle: { color: COLORS.cream, fontSize: 17, fontWeight: '900' },
  accessBody: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  primary: { alignSelf: 'flex-start', marginTop: 12, minHeight: 42, borderRadius: 11, backgroundColor: COLORS.gold, justifyContent: 'center', paddingHorizontal: 13 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
  errorCard: { marginTop: 10, borderRadius: 14, backgroundColor: '#281915', borderWidth: 1, borderColor: '#66362D', padding: 12 },
  error: { color: '#FFB4A9', fontSize: 11 },
  retry: { color: COLORS.gold, fontSize: 10, fontWeight: '900', marginTop: 6 },
});
