import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCampaignDaysUntil, getCampaignReadiness } from '../../src/hosting/campaigns';
import { getManagementDashboard } from '../../src/management/api';
import type {
  ManagementCalendarItem,
  ManagementDashboardData,
  ManagementMarketingItem,
  ManagementSectionId,
  ManagementTask,
} from '../../src/management/types';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

const COLORS = {
  ink: '#0A0F0C',
  sidebar: '#0C1510',
  panel: '#121B16',
  panelRaised: '#17231C',
  panelSoft: '#1B2820',
  line: '#2C3B32',
  lineStrong: '#3A4C40',
  cream: '#FFF8E8',
  muted: '#98A49C',
  dim: '#718078',
  gold: '#D7B45A',
  goldSoft: '#E9CC78',
  green: '#9BCB75',
  teal: '#77B9A6',
  danger: '#E87964',
  orange: '#E58A46',
};

type NavItem = { id: ManagementSectionId; label: string; icon: AppIconName; badge?: string };

const primaryNav: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'dashboard' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'my-work', label: 'My Work', icon: 'tasks' },
  { id: 'events', label: 'Events', icon: 'adventure' },
  { id: 'opportunities', label: 'Opportunities', icon: 'briefcase' },
  { id: 'marketing', label: 'Marketing', icon: 'megaphone' },
  { id: 'operations', label: 'Operations', icon: 'settings' },
];

const resourceNav: NavItem[] = [
  { id: 'directories', label: 'Directories', icon: 'directory' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'team', label: 'Team', icon: 'team' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'admin', label: 'Admin', icon: 'settings' },
];

const sectionLabels: Record<ManagementSectionId, string> = {
  home: 'Home',
  calendar: 'Calendar',
  'my-work': 'My Work',
  events: 'Events',
  opportunities: 'Opportunities',
  marketing: 'Marketing',
  operations: 'Operations',
  directories: 'Directories',
  library: 'Library',
  team: 'Team',
  reports: 'Reports',
  admin: 'Admin',
};

export default function ManagementScreen() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 1060;
  const roomy = width >= 760;
  const mobile = width < 760;
  const [activeSection, setActiveSection] = useState<ManagementSectionId>('home');
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getManagementDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Go Melanated Management could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.stateScreen}><View style={styles.brandMark}><Text style={styles.brandMarkText}>GM</Text></View><ActivityIndicator color={COLORS.gold} size="large" /><Text style={styles.stateTitle}>Opening Management</Text><Text style={styles.stateCopy}>Loading events, assignments and campaign work.</Text></View></SafeAreaView>;
  }

  if (!data || error) {
    return <SafeAreaView style={styles.safe}><View style={styles.stateScreen}><View style={styles.errorIcon}><AppIcon name="privacy" color={COLORS.danger} size={26} /></View><Text style={styles.stateTitle}>Management is unavailable</Text><Text style={styles.stateCopy}>{error}</Text><View style={styles.stateActions}><Pressable style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.secondaryButtonText}>Back to member app</Text></Pressable><Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View></View></SafeAreaView>;
  }

  const initials = getInitials(data.profile.displayName);
  const currentLabel = sectionLabels[activeSection];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.shell}>
        {desktop ? <ManagementSidebar active={activeSection} data={data} onSelect={setActiveSection} /> : null}

        <View style={styles.workspace}>
          <View style={[styles.topbar, !desktop && styles.topbarCompact, mobile && styles.topbarMobile]}>
            {!desktop ? <View style={styles.compactBrand}><View style={styles.brandMarkSmall}><Text style={styles.brandMarkSmallText}>GM</Text></View><View><Text style={styles.compactBrandTitle}>Management</Text><Text style={styles.compactBrandMeta}>{currentLabel}</Text></View></View> : <View><Text style={styles.topbarEyebrow}>GO MELANATED MANAGEMENT</Text><Text style={styles.topbarSection}>{currentLabel}</Text></View>}

            <View style={styles.topbarActions}>
              {desktop ? <View style={styles.searchBox}><AppIcon name="search" color={COLORS.dim} size={18} /><TextInput value={search} onChangeText={setSearch} placeholder="Search everything" placeholderTextColor={COLORS.dim} style={styles.searchInput} /></View> : null}
              <Pressable accessibilityLabel="Notifications" style={[styles.iconButton, mobile && styles.iconButtonMobile]}><AppIcon name="notifications" color={COLORS.cream} size={mobile ? 18 : 19} /><View style={styles.notificationDot} /></Pressable>
              <Pressable style={[styles.createButton, mobile && styles.createButtonMobile]} onPress={() => setCreateOpen(true)}><AppIcon name="add" color={COLORS.ink} size={mobile ? 17 : 18} /><Text style={styles.createButtonText}>Create</Text></Pressable>
              {desktop ? <View style={styles.topAvatar}>{data.profile.avatarUrl ? <Image source={{ uri: data.profile.avatarUrl }} style={styles.topAvatarImage} /> : <Text style={styles.topAvatarText}>{initials}</Text>}</View> : null}
            </View>
          </View>

          {!desktop && !mobile ? <CompactNavigation active={activeSection} onSelect={setActiveSection} /> : null}

          <ScrollView style={styles.contentScroll} contentContainerStyle={[styles.content, roomy && styles.contentRoomy, mobile && styles.contentMobile]} showsVerticalScrollIndicator={false}>
            <SectionContent active={activeSection} data={data} roomy={roomy} mobile={mobile} search={search} onCreate={() => setCreateOpen(true)} onSelect={setActiveSection} />
          </ScrollView>

          {mobile ? <MobileNavigation active={activeSection} data={data} onSelect={setActiveSection} onMore={() => setMoreOpen(true)} /> : null}
        </View>
      </View>

      <CreateMenu visible={createOpen} data={data} onClose={() => setCreateOpen(false)} onSelect={setActiveSection} />
      <MoreMenu visible={moreOpen} active={activeSection} onClose={() => setMoreOpen(false)} onSelect={setActiveSection} />
    </SafeAreaView>
  );
}

function ManagementSidebar({ active, data, onSelect }: { active: ManagementSectionId; data: ManagementDashboardData; onSelect: (id: ManagementSectionId) => void }) {
  const attention = data.tasks.filter(needsAttention).length;
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarBrand}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>GM</Text></View>
        <View><Text style={styles.sidebarTitle}>Management</Text><Text style={styles.sidebarMeta}>GO MELANATED</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
        <SidebarGroup items={primaryNav.map((item) => item.id === 'my-work' && attention > 0 ? { ...item, badge: String(attention) } : item)} active={active} onSelect={onSelect} />
        <Text style={styles.sidebarGroupLabel}>RESOURCES & CONTROL</Text>
        <SidebarGroup items={resourceNav} active={active} onSelect={onSelect} />
      </ScrollView>

      <View style={styles.sidebarFooter}>
        <Pressable style={styles.memberAppLink} onPress={() => router.replace('/(tabs)/menu' as never)}><AppIcon name="trailhead" color={COLORS.gold} size={18} /><View style={{ flex: 1 }}><Text style={styles.memberAppTitle}>Member App</Text><Text style={styles.memberAppMeta}>Return to Go Melanated</Text></View><AppIcon name="open" color={COLORS.dim} size={16} /></Pressable>
        <View style={styles.sidebarIdentity}><View style={styles.sidebarAvatar}>{data.profile.avatarUrl ? <Image source={{ uri: data.profile.avatarUrl }} style={styles.topAvatarImage} /> : <Text style={styles.sidebarAvatarText}>{getInitials(data.profile.displayName)}</Text>}</View><View style={{ flex: 1 }}><Text style={styles.sidebarName} numberOfLines={1}>{data.profile.displayName}</Text><Text style={styles.sidebarRole}>{formatLabel(data.profile.platformRole)}</Text></View><AppIcon name="more" color={COLORS.dim} size={18} /></View>
      </View>
    </View>
  );
}

function SidebarGroup({ items, active, onSelect }: { items: NavItem[]; active: ManagementSectionId; onSelect: (id: ManagementSectionId) => void }) {
  return <View style={styles.navGroup}>{items.map((item) => <Pressable key={item.id} style={[styles.navItem, active === item.id && styles.navItemActive]} onPress={() => onSelect(item.id)}><AppIcon name={item.icon} color={active === item.id ? COLORS.goldSoft : COLORS.muted} size={19} /><Text style={[styles.navItemText, active === item.id && styles.navItemTextActive]}>{item.label}</Text>{item.badge ? <View style={styles.navBadge}><Text style={styles.navBadgeText}>{item.badge}</Text></View> : null}</Pressable>)}</View>;
}

function CompactNavigation({ active, onSelect }: { active: ManagementSectionId; onSelect: (id: ManagementSectionId) => void }) {
  const all = [...primaryNav, ...resourceNav];
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.compactNav} contentContainerStyle={styles.compactNavContent}>{all.map((item) => <Pressable key={item.id} style={[styles.compactNavItem, active === item.id && styles.compactNavItemActive]} onPress={() => onSelect(item.id)}><AppIcon name={item.icon} color={active === item.id ? COLORS.ink : COLORS.muted} size={16} /><Text style={[styles.compactNavText, active === item.id && styles.compactNavTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>;
}

function MobileNavigation({ active, data, onSelect, onMore }: { active: ManagementSectionId; data: ManagementDashboardData; onSelect: (id: ManagementSectionId) => void; onMore: () => void }) {
  const items: NavItem[] = [
    { id: 'home', label: 'Home', icon: 'dashboard' },
    { id: 'my-work', label: 'My Work', icon: 'tasks' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'events', label: 'Events', icon: 'adventure' },
  ];
  const attention = data.tasks.filter(needsAttention).length;
  const moreActive = !items.some((item) => item.id === active);

  return <View style={styles.mobileNav}>{items.map((item) => {
    const selected = item.id === active;
    return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} style={styles.mobileNavItem} onPress={() => onSelect(item.id)}><View style={styles.mobileNavIcon}><AppIcon name={item.icon} color={selected ? COLORS.gold : COLORS.muted} size={19} />{item.id === 'my-work' && attention > 0 ? <View style={styles.mobileNavBadge}><Text style={styles.mobileNavBadgeText}>{attention}</Text></View> : null}</View><Text style={[styles.mobileNavLabel, selected && styles.mobileNavLabelActive]}>{item.label}</Text></Pressable>;
  })}<Pressable accessibilityRole="button" accessibilityState={{ selected: moreActive }} style={styles.mobileNavItem} onPress={onMore}><AppIcon name="more" color={moreActive ? COLORS.gold : COLORS.muted} size={19} /><Text style={[styles.mobileNavLabel, moreActive && styles.mobileNavLabelActive]}>More</Text></Pressable></View>;
}

function MoreMenu({ visible, active, onClose, onSelect }: { visible: boolean; active: ManagementSectionId; onClose: () => void; onSelect: (id: ManagementSectionId) => void }) {
  const items = [...primaryNav.slice(4), ...resourceNav];
  const choose = (id: ManagementSectionId) => { onSelect(id); onClose(); };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.moreBackdrop} onPress={onClose}><Pressable style={styles.moreSheet} onPress={(event) => event.stopPropagation()}><View style={styles.moreHandle} /><View style={styles.moreHeader}><View><Text style={styles.moreEyebrow}>MANAGEMENT</Text><Text style={styles.moreTitle}>More tools</Text></View><Pressable accessibilityLabel="Close more tools" style={styles.moreClose} onPress={onClose}><AppIcon name="close" color={COLORS.cream} size={18} /></Pressable></View><View style={styles.moreGrid}>{items.map((item) => <Pressable key={item.id} style={[styles.moreItem, active === item.id && styles.moreItemActive]} onPress={() => choose(item.id)}><View style={styles.moreItemIcon}><AppIcon name={item.icon} color={active === item.id ? COLORS.gold : COLORS.muted} size={19} /></View><Text style={[styles.moreItemText, active === item.id && styles.moreItemTextActive]}>{item.label}</Text><AppIcon name="chevron-forward" color={COLORS.dim} size={15} /></Pressable>)}</View><Pressable style={styles.moreMemberLink} onPress={() => { onClose(); router.replace('/(tabs)/menu' as never); }}><AppIcon name="trailhead" color={COLORS.gold} size={18} /><Text style={styles.moreMemberText}>Return to Go Melanated</Text><AppIcon name="open" color={COLORS.dim} size={15} /></Pressable></Pressable></Pressable></Modal>;
}

function SectionContent({ active, data, roomy, mobile, search, onCreate, onSelect }: { active: ManagementSectionId; data: ManagementDashboardData; roomy: boolean; mobile: boolean; search: string; onCreate: () => void; onSelect: (id: ManagementSectionId) => void }) {
  if (active === 'home') return <HomeSection data={data} roomy={roomy} mobile={mobile} onCreate={onCreate} onSelect={onSelect} />;
  if (active === 'calendar') return <CalendarSection data={data} />;
  if (active === 'my-work') return <MyWorkSection data={data} />;
  if (active === 'events') return <EventsSection data={data} roomy={roomy} />;
  if (active === 'opportunities') return <OpportunitiesSection />;
  if (active === 'marketing') return <MarketingSection data={data} />;
  if (active === 'operations') return <OperationsSection data={data} />;
  if (active === 'directories') return <DirectoriesSection />;
  if (active === 'library') return <LibrarySection />;
  if (active === 'team') return <TeamSection data={data} />;
  if (active === 'reports') return <ReportsSection data={data} />;
  return <AdminSection data={data} search={search} />;
}

function HomeSection({ data, roomy, mobile, onCreate, onSelect }: { data: ManagementDashboardData; roomy: boolean; mobile: boolean; onCreate: () => void; onSelect: (id: ManagementSectionId) => void }) {
  const openTasks = data.tasks.filter((task) => task.status !== 'complete');
  const attention = openTasks.filter(needsAttention);
  const activeEvents = data.campaigns.filter((campaign) => campaign.status !== 'complete').sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const featuredEvent = activeEvents[0];
  const otherEvents = activeEvents.slice(1, 4);
  const draftContent = data.marketing.filter((item) => item.status === 'idea' || item.status === 'draft').length;
  const nextCalendar = data.calendar.filter((item) => toLocalCalendarDate(item.date).getTime() >= startOfToday()).slice(0, 5);
  const visibleCalendar = mobile ? nextCalendar.slice(0, 3) : nextCalendar;
  const firstName = data.profile.displayName.split(/\s+/)[0];
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  const attentionPanel = <><PanelHeader eyebrow="NEEDS ATTENTION" title={mobile ? 'Resolve these first' : 'Work that can hold up the plan'} action={`${attention.length} items`} onPress={() => onSelect('my-work')} /><View style={styles.panelCard}>{attention.length === 0 ? <EmptyInline icon="checkmark" title="Nothing is blocked" copy="Open work is moving without an active blocker." /> : attention.slice(0, 4).map((task, index) => <AttentionTask key={task.id} task={task} last={index === Math.min(attention.length, 4) - 1} />)}</View></>;
  const eventPanel = <><PanelHeader eyebrow="ACTIVE EVENTS" title="What the team is producing" action="View all" onPress={() => onSelect('events')} /><View style={styles.eventStack}>{activeEvents.length === 0 ? <EmptyPanel title="No active events" copy="Create an event to begin planning work." /> : activeEvents.slice(0, 3).map((campaign) => <HomeEventCard key={campaign.id} campaign={campaign} />)}</View></>;
  const calendarPanel = <><PanelHeader eyebrow={mobile ? 'TODAY & NEXT UP' : 'COMING UP'} title={mobile ? 'Upcoming work' : 'Next on the calendar'} action="Calendar" onPress={() => onSelect('calendar')} /><View style={styles.panelCard}>{visibleCalendar.length === 0 ? <EmptyInline icon="calendar" title="Calendar is clear" copy="Dated tasks and events will appear here." /> : visibleCalendar.map((item, index) => <CalendarRow key={item.id} item={item} last={index === visibleCalendar.length - 1} />)}</View></>;
  const opportunityPanel = <><PanelHeader eyebrow="OPPORTUNITIES" title="Build the research pipeline" /><Pressable style={[styles.importCard, mobile && styles.importCardMobile]} onPress={() => onSelect('opportunities')}><View style={[styles.importIcon, mobile && styles.importIconMobile]}><AppIcon name="open" color={COLORS.gold} size={mobile ? 18 : 22} /></View><View style={mobile ? styles.importMobileCopy : undefined}><Text style={[styles.importTitle, mobile && styles.importTitleMobile]}>Import an event from a URL</Text><Text style={[styles.importCopy, mobile && styles.importCopyMobile]}>{mobile ? 'Turn a public event page into a reviewable opportunity.' : 'Paste an Eventbrite page, venue calendar, festival site or public event link. Review the extracted details before saving.'}</Text><View style={[styles.importAction, mobile && styles.importActionMobile]}><Text style={styles.importActionText}>Open importer</Text><AppIcon name="chevron-forward" color={COLORS.gold} size={16} /></View></View></Pressable></>;

  return <View style={styles.sectionPage}>
    <View style={[styles.pageHeader, mobile && styles.pageHeaderMobile]}><View><Text style={styles.pageEyebrow}>{todayLabel}</Text><Text style={[styles.pageTitle, mobile && styles.pageTitleMobile]}>{getGreeting()}, {firstName}.</Text><Text style={[styles.pageSubtitle, mobile && styles.pageSubtitleMobile]}>Here is what needs attention across Melanated Adventurers.</Text></View>{!mobile ? <View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusPillText}>Event data connected</Text></View> : null}</View>

    {mobile ? <View style={styles.mobileHomeFlow}>
      {attentionPanel}
      {calendarPanel}
      <PanelHeader eyebrow="FEATURED EVENT" title="Closest active event" action="All events" onPress={() => onSelect('events')} />
      {featuredEvent ? <HomeEventCard campaign={featuredEvent} /> : <EmptyPanel title="No active events" copy="Create an event to begin planning work." />}
      {otherEvents.length ? <View style={styles.mobileOtherEvents}>{otherEvents.map((campaign, index) => <MobileEventRow key={campaign.id} campaign={campaign} last={index === otherEvents.length - 1} />)}</View> : null}
      <MobileBusinessSummary activeEvents={activeEvents.length} openTasks={openTasks.length} draftContent={draftContent} onSelect={onSelect} />
      <PanelHeader eyebrow="QUICK ACTIONS" title="Start something" />
      <View style={styles.mobileQuickActions}>
        <QuickAction label="Create task" icon="add" primary onPress={onCreate} />
        <QuickAction label="Open calendar" icon="calendar" onPress={() => onSelect('calendar')} />
        <QuickAction label="Import URL" icon="open" onPress={() => onSelect('opportunities')} />
        <QuickAction label="Create content" icon="megaphone" onPress={() => onSelect('marketing')} />
      </View>
    </View> : null}

    {!mobile ? <View style={styles.metricGrid}>
      <MetricCard compact={false} label="Active events" value={String(activeEvents.length)} detail="Planning or live" icon="adventure" tone="gold" onPress={() => onSelect('events')} />
      <MetricCard compact={false} label="Open work" value={String(openTasks.length)} detail={`${attention.length} need attention`} icon="tasks" tone={attention.length ? 'danger' : 'green'} onPress={() => onSelect('my-work')} />
      <MetricCard compact={false} label="Content drafts" value={String(draftContent)} detail={`${data.marketing.length} total items`} icon="megaphone" tone="teal" onPress={() => onSelect('marketing')} />
      <MetricCard compact={false} label="Opportunities" value="0" detail="Import from URL" icon="briefcase" tone="orange" onPress={() => onSelect('opportunities')} />
    </View> : null}

    {!mobile ? <View style={[styles.dashboardColumns, !roomy && styles.dashboardColumnsStack]}>
      <View style={styles.dashboardPrimary}>
        {attentionPanel}
        {eventPanel}
      </View>

      <View style={styles.dashboardRail}>
        {calendarPanel}
        {opportunityPanel}
      </View>
    </View> : null}
  </View>;
}

function MobileEventRow({ campaign, last }: { campaign: ManagementDashboardData['campaigns'][number]; last: boolean }) {
  const open = campaign.tasks.filter((task) => task.status !== 'complete').length;
  return <Pressable style={[styles.mobileEventRow, !last && styles.rowDivider]} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}><View style={[styles.eventAccent, { backgroundColor: campaign.accent }]} /><View style={styles.mobileEventCopy}><Text style={styles.mobileEventTitle} numberOfLines={1}>{campaign.shortTitle}</Text><Text style={styles.mobileEventMeta}>{getCampaignDaysUntil(campaign)} days · {open} open {open === 1 ? 'task' : 'tasks'}</Text></View><AppIcon name="chevron-forward" color={COLORS.dim} size={17} /></Pressable>;
}

function MobileBusinessSummary({ activeEvents, openTasks, draftContent, onSelect }: { activeEvents: number; openTasks: number; draftContent: number; onSelect: (id: ManagementSectionId) => void }) {
  const items: { label: string; value: number; section: ManagementSectionId }[] = [
    { label: 'Events', value: activeEvents, section: 'events' },
    { label: 'Open work', value: openTasks, section: 'my-work' },
    { label: 'Drafts', value: draftContent, section: 'marketing' },
    { label: 'Opportunities', value: 0, section: 'opportunities' },
  ];
  return <View style={styles.mobileBusinessSummary}>{items.map((item, index) => <Pressable key={item.label} style={[styles.mobileBusinessItem, index > 0 && styles.mobileBusinessDivider]} onPress={() => onSelect(item.section)}><Text style={styles.mobileBusinessValue}>{item.value}</Text><Text style={styles.mobileBusinessLabel}>{item.label}</Text></Pressable>)}</View>;
}

function QuickAction({ label, icon, primary = false, onPress }: { label: string; icon: AppIconName; primary?: boolean; onPress: () => void }) {
  return <Pressable style={[styles.mobileQuickAction, primary && styles.mobileQuickActionPrimary]} onPress={onPress}><AppIcon name={icon} color={primary ? COLORS.ink : COLORS.gold} size={17} /><Text style={[styles.mobileQuickActionText, primary && styles.mobileQuickActionTextPrimary]}>{label}</Text></Pressable>;
}

function MetricCard({ compact, label, value, detail, icon, tone, onPress }: { compact: boolean; label: string; value: string; detail: string; icon: AppIconName; tone: 'gold' | 'danger' | 'green' | 'teal' | 'orange'; onPress: () => void }) {
  const toneColor = { gold: COLORS.gold, danger: COLORS.danger, green: COLORS.green, teal: COLORS.teal, orange: COLORS.orange }[tone];
  return <Pressable style={[styles.metricCard, compact && styles.metricCardCompact]} onPress={onPress}><View style={compact ? styles.metricCompactTop : undefined}><View style={[styles.metricIcon, compact && styles.metricIconCompact, { backgroundColor: `${toneColor}18`, borderColor: `${toneColor}48` }]}><AppIcon name={icon} color={toneColor} size={compact ? 17 : 20} /></View>{compact ? <Text style={[styles.metricValue, styles.metricValueCompact]}>{value}</Text> : null}</View><Text style={[styles.metricLabel, compact && styles.metricLabelCompact]}>{label}</Text>{!compact ? <Text style={styles.metricValue}>{value}</Text> : null}<Text numberOfLines={1} style={[styles.metricDetail, compact && styles.metricDetailCompact, { color: toneColor }]}>{detail}</Text></Pressable>;
}

function PanelHeader({ eyebrow, title, action, onPress }: { eyebrow: string; title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.panelHeader}><View><Text style={styles.panelEyebrow}>{eyebrow}</Text><Text style={styles.panelTitle}>{title}</Text></View>{action ? <Pressable disabled={!onPress} style={styles.panelAction} onPress={onPress}><Text style={styles.panelActionText}>{action}</Text>{onPress ? <AppIcon name="chevron-forward" color={COLORS.gold} size={14} /> : null}</Pressable> : null}</View>;
}

function AttentionTask({ task, last }: { task: ManagementTask; last: boolean }) {
  return <Pressable style={[styles.attentionRow, !last && styles.rowDivider]} onPress={() => router.push(`/host/campaigns/${task.campaignSlug}/tasks/${task.id}` as never)}><View style={[styles.attentionSignal, task.status === 'blocked' ? styles.signalDanger : task.status === 'waiting' ? styles.signalGold : styles.signalOrange]} /><View style={styles.attentionCopy}><View style={styles.attentionTop}><Text style={styles.attentionTitle} numberOfLines={1}>{task.title}</Text><View style={[styles.taskStatusPill, task.status === 'blocked' && styles.taskStatusDanger]}><Text style={[styles.taskStatusText, task.status === 'blocked' && styles.taskStatusTextDanger]}>{task.status === 'not_started' ? 'TO DO' : formatLabel(task.status).toUpperCase()}</Text></View></View><Text style={styles.attentionMeta}>{task.campaignTitle} · {task.owner} · {task.dueLabel}</Text>{task.blockedBy ? <Text style={styles.blockedBy}>Waiting on: {task.blockedBy}</Text> : null}</View><AppIcon name="chevron-forward" color={COLORS.dim} size={17} /></Pressable>;
}

function HomeEventCard({ campaign }: { campaign: ManagementDashboardData['campaigns'][number] }) {
  const readiness = getCampaignReadiness(campaign);
  const open = campaign.tasks.filter((task) => task.status !== 'complete').length;
  const attention = campaign.tasks.filter(needsAttention).length;
  return <Pressable style={styles.homeEventCard} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}><View style={styles.homeEventTop}><View style={[styles.eventAccent, { backgroundColor: campaign.accent }]} /><Text style={styles.homeEventStatus}>{campaign.status.toUpperCase()}</Text><Text style={styles.homeEventDays}>{getCampaignDaysUntil(campaign)} days</Text></View><Text style={styles.homeEventTitle}>{campaign.shortTitle}</Text><Text style={styles.homeEventMeta}>{campaign.location}</Text><View style={styles.homeEventProgress}><View style={[styles.homeEventProgressFill, { width: `${readiness}%`, backgroundColor: campaign.accent }]} /></View><View style={styles.homeEventFooter}><Text style={styles.homeEventReadiness}>{readiness}% ready</Text><Text style={styles.homeEventTaskMeta}>{open} open{attention ? ` · ${attention} need attention` : ''}</Text><View style={styles.openCampaign}><Text style={[styles.openCampaignText, { color: campaign.accent }]}>Open event</Text><AppIcon name="chevron-forward" color={campaign.accent} size={15} /></View></View></Pressable>;
}

function CalendarRow({ item, last }: { item: ManagementCalendarItem; last: boolean }) {
  const date = toLocalCalendarDate(item.date);
  return <Pressable style={[styles.calendarRow, !last && styles.rowDivider]} onPress={() => item.route && router.push(item.route as never)}><View style={styles.calendarDate}><Text style={styles.calendarMonth}>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.calendarDay}>{date.getDate()}</Text></View><View style={[styles.calendarSignal, { backgroundColor: item.accent }]} /><View style={styles.calendarCopy}><Text style={styles.calendarTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.calendarMeta} numberOfLines={1}>{item.subtitle}</Text></View><Text style={styles.calendarKind}>{item.kind.toUpperCase()}</Text></Pressable>;
}

function CalendarSection({ data }: { data: ManagementDashboardData }) {
  const [filter, setFilter] = useState<'all' | ManagementCalendarItem['kind']>('all');
  const filtered = data.calendar.filter((item) => filter === 'all' || item.kind === filter);
  return <StandardPage eyebrow="OPERATIONS CALENDAR" title="Everything with a date, in one place." subtitle="Events, task deadlines and campaign content stay connected to their original records.">
    <View style={styles.toolbar}><View style={styles.filterChips}>{(['all', 'event', 'task', 'deadline', 'marketing'] as const).map((item) => <Pressable key={item} style={[styles.filterChip, filter === item && styles.filterChipActive]} onPress={() => setFilter(item)}><Text style={[styles.filterChipText, filter === item && styles.filterChipTextActive]}>{item === 'all' ? 'Everything' : formatLabel(item)}</Text></Pressable>)}</View><View style={styles.viewToggle}><Text style={styles.viewToggleActive}>Agenda</Text><Text style={styles.viewToggleText}>Week</Text><Text style={styles.viewToggleText}>Month</Text></View></View>
    <View style={styles.listCard}>{filtered.length ? filtered.map((item, index) => <CalendarAgendaRow key={item.id} item={item} last={index === filtered.length - 1} />) : <EmptyInline icon="calendar" title="No calendar items in this view" copy="Change the filter or add a dated record." />}</View>
  </StandardPage>;
}

function CalendarAgendaRow({ item, last }: { item: ManagementCalendarItem; last: boolean }) {
  const date = toLocalCalendarDate(item.date);
  return <Pressable style={[styles.agendaRow, !last && styles.rowDivider]} onPress={() => item.route && router.push(item.route as never)}><View style={styles.agendaDate}><Text style={styles.agendaWeekday}>{date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Text><Text style={styles.agendaDay}>{date.getDate()}</Text><Text style={styles.agendaMonth}>{date.toLocaleDateString(undefined, { month: 'short' })}</Text></View><View style={[styles.agendaBar, { backgroundColor: item.accent }]} /><View style={styles.agendaCopy}><View style={styles.agendaKindRow}><Text style={[styles.agendaKind, { color: item.accent }]}>{item.kind.toUpperCase()}</Text></View><Text style={styles.agendaTitle}>{item.title}</Text><Text style={styles.agendaMeta}>{item.subtitle}</Text></View><AppIcon name="chevron-forward" color={COLORS.dim} size={18} /></Pressable>;
}

function MyWorkSection({ data }: { data: ManagementDashboardData }) {
  const [filter, setFilter] = useState<'open' | 'attention' | 'complete'>('open');
  const myTasks = data.tasks.filter((task) => isTaskOwnedByProfile(task, data));
  const tasks = myTasks.filter((task) => filter === 'complete' ? task.status === 'complete' : filter === 'attention' ? task.status !== 'complete' && needsAttention(task) : task.status !== 'complete');
  return <StandardPage eyebrow="MY WORK" title="Your assignments and blockers." subtitle="Work stays linked to its event, owner and due date.">
    <View style={styles.toolbar}><View style={styles.filterChips}>{(['open', 'attention', 'complete'] as const).map((item) => <Pressable key={item} style={[styles.filterChip, filter === item && styles.filterChipActive]} onPress={() => setFilter(item)}><Text style={[styles.filterChipText, filter === item && styles.filterChipTextActive]}>{item === 'open' ? 'Open work' : formatLabel(item)}</Text></Pressable>)}</View><Pressable style={styles.outlineAction}><AppIcon name="filter" color={COLORS.gold} size={16} /><Text style={styles.outlineActionText}>Filters</Text></Pressable></View>
    <View style={styles.workSummary}><SummaryBlock label="Open" value={String(myTasks.filter((task) => task.status !== 'complete').length)} /><SummaryBlock label="Blocked" value={String(myTasks.filter((task) => task.status === 'blocked').length)} danger /><SummaryBlock label="Waiting" value={String(myTasks.filter((task) => task.status === 'waiting').length)} /><SummaryBlock label="Complete" value={String(myTasks.filter((task) => task.status === 'complete').length)} /></View>
    <View style={styles.listCard}>{tasks.length ? tasks.map((task, index) => <WorkTaskRow key={task.id} task={task} last={index === tasks.length - 1} />) : <EmptyInline icon="checkmark" title="No tasks in this view" copy="Completed and active work are available from the filters above." />}</View>
  </StandardPage>;
}

function WorkTaskRow({ task, last }: { task: ManagementTask; last: boolean }) {
  return <Pressable style={[styles.workTaskRow, !last && styles.rowDivider]} onPress={() => router.push(`/host/campaigns/${task.campaignSlug}/tasks/${task.id}` as never)}><View style={[styles.checkCircle, task.status === 'complete' && styles.checkCircleComplete]}>{task.status === 'complete' ? <AppIcon name="checkmark" color={COLORS.ink} size={16} /> : null}</View><View style={styles.workTaskCopy}><Text style={[styles.workTaskTitle, task.status === 'complete' && styles.completedText]}>{task.title}</Text><Text style={styles.workTaskMeta}>{task.campaignTitle} · {task.category}</Text></View><View style={styles.workTaskOwner}><Text style={styles.workTaskOwnerName}>{task.owner}</Text><Text style={[styles.workTaskDue, task.priority === 'critical' && styles.workTaskDueDanger]}>{task.dueLabel}</Text></View><View style={[styles.taskStatusPill, task.status === 'blocked' && styles.taskStatusDanger]}><Text style={[styles.taskStatusText, task.status === 'blocked' && styles.taskStatusTextDanger]}>{formatLabel(task.status)}</Text></View></Pressable>;
}

function EventsSection({ data, roomy }: { data: ManagementDashboardData; roomy: boolean }) {
  return <StandardPage eyebrow="EVENT MANAGEMENT" title="Plan, publish and run every adventure." subtitle="Each event holds its tickets, timeline, attendees, operations, marketing, files and results.">
    <View style={styles.toolbar}><View style={styles.filterChips}><View style={[styles.filterChip, styles.filterChipActive]}><Text style={styles.filterChipTextActive}>Active</Text></View><View style={styles.filterChip}><Text style={styles.filterChipText}>Drafts</Text></View><View style={styles.filterChip}><Text style={styles.filterChipText}>Completed</Text></View></View><Pressable style={styles.outlineAction} onPress={() => router.push('/host/create' as never)}><AppIcon name="add" color={COLORS.gold} size={17} /><Text style={styles.outlineActionText}>New event</Text></Pressable></View>
    <View style={[styles.eventGrid, !roomy && styles.eventGridStack]}>{data.campaigns.length ? data.campaigns.map((campaign) => <EventWorkspaceCard key={campaign.id} campaign={campaign} />) : <EmptyPanel title="No event workspaces" copy="Create an event or import one to begin." />}</View>
  </StandardPage>;
}

function EventWorkspaceCard({ campaign }: { campaign: ManagementDashboardData['campaigns'][number] }) {
  const readiness = getCampaignReadiness(campaign);
  const open = campaign.tasks.filter((task) => task.status !== 'complete').length;
  const attention = campaign.tasks.filter(needsAttention).length;
  return <Pressable style={styles.eventWorkspaceCard} onPress={() => router.push(`/host/campaigns/${campaign.slug}` as never)}><View style={[styles.eventWorkspaceStripe, { backgroundColor: campaign.accent }]} /><View style={styles.eventWorkspaceBody}><View style={styles.homeEventTop}><Text style={[styles.homeEventStatus, { color: campaign.accent }]}>{campaign.status.toUpperCase()}</Text><View style={styles.datePill}><Text style={styles.datePillText}>{new Date(campaign.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text></View></View><Text style={styles.eventWorkspaceTitle}>{campaign.shortTitle}</Text><Text style={styles.eventWorkspaceLocation}>{campaign.location}</Text><View style={styles.workspaceMetrics}><SummaryBlock label="Ready" value={`${readiness}%`} /><SummaryBlock label="Open" value={String(open)} /><SummaryBlock label="Attention" value={String(attention)} danger={attention > 0} /></View><View style={styles.homeEventProgress}><View style={[styles.homeEventProgressFill, { width: `${readiness}%`, backgroundColor: campaign.accent }]} /></View><View style={styles.eventWorkspaceFooter}><Text style={styles.eventWorkspaceDays}>{getCampaignDaysUntil(campaign)} days to event</Text><View style={styles.openCampaign}><Text style={[styles.openCampaignText, { color: campaign.accent }]}>Manage event</Text><AppIcon name="chevron-forward" color={campaign.accent} size={15} /></View></View></View></Pressable>;
}

function OpportunitiesSection() {
  return <StandardPage eyebrow="OPPORTUNITY LIBRARY" title="Turn outside events into business action." subtitle="Research vending, partnerships, sponsorships, community events and possible venues without losing the source.">
    <View style={styles.opportunityToolbar}><Pressable style={styles.importUrlButton}><AppIcon name="open" color={COLORS.ink} size={18} /><Text style={styles.importUrlButtonText}>Import URL</Text></Pressable><Pressable style={styles.outlineAction}><AppIcon name="add" color={COLORS.gold} size={17} /><Text style={styles.outlineActionText}>Add manually</Text></Pressable></View>
    <View style={styles.urlImporter}><View style={styles.importerLead}><View style={styles.importIcon}><AppIcon name="search" color={COLORS.gold} size={22} /></View><View style={{ flex: 1 }}><Text style={styles.importerTitle}>Paste a public event or vendor page</Text><Text style={styles.importerCopy}>The importer will extract dates, location, organizer, ticket details, vendor fees and deadlines when the source provides them.</Text></View></View><View style={styles.urlInputRow}><TextInput editable={false} placeholder="https://eventbrite.com/e/... or any public event page" placeholderTextColor={COLORS.dim} style={styles.urlInput} /><View style={styles.extractButton}><Text style={styles.extractButtonText}>Extract details</Text></View></View><Text style={styles.importerNote}>Imported details require review before they become a saved record.</Text></View>
    <Text style={styles.pipelineTitle}>OPPORTUNITY PIPELINE</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pipeline}><PipelineColumn label="Discovered" count={0} /><PipelineColumn label="Reviewing" count={0} /><PipelineColumn label="Applied / Contacted" count={0} /><PipelineColumn label="Approved" count={0} /><PipelineColumn label="Scheduled" count={0} /></ScrollView>
  </StandardPage>;
}

function PipelineColumn({ label, count }: { label: string; count: number }) {
  return <View style={styles.pipelineColumn}><View style={styles.pipelineHeader}><Text style={styles.pipelineLabel}>{label}</Text><View style={styles.pipelineCount}><Text style={styles.pipelineCountText}>{count}</Text></View></View><View style={styles.pipelineEmpty}><AppIcon name="briefcase" color={COLORS.dim} size={20} /><Text style={styles.pipelineEmptyText}>No records</Text></View></View>;
}

function MarketingSection({ data }: { data: ManagementDashboardData }) {
  return <StandardPage eyebrow="MARKETING CENTER" title="One campaign, every channel." subtitle="Content remains tied to the event record, planned date, owner and publication status.">
    <View style={styles.workSummary}><SummaryBlock label="Ideas" value={String(data.marketing.filter((item) => item.status === 'idea').length)} /><SummaryBlock label="Drafts" value={String(data.marketing.filter((item) => item.status === 'draft').length)} /><SummaryBlock label="Scheduled" value={String(data.marketing.filter((item) => item.status === 'scheduled').length)} /><SummaryBlock label="Published" value={String(data.marketing.filter((item) => item.status === 'published').length)} /></View>
    <View style={styles.listCard}>{data.marketing.length ? data.marketing.map((item, index) => <MarketingRow key={item.id} item={item} last={index === data.marketing.length - 1} />) : <EmptyInline icon="megaphone" title="No campaign content yet" copy="Open an event campaign to start its content calendar." />}</View>
  </StandardPage>;
}

function MarketingRow({ item, last }: { item: ManagementMarketingItem; last: boolean }) {
  return <Pressable style={[styles.marketingRow, !last && styles.rowDivider]} onPress={() => router.push(`/host/campaigns/${item.campaignSlug}/marketing` as never)}><View style={styles.marketingDate}><Text style={styles.marketingDateMonth}>{new Date(`${item.plannedFor}T12:00:00`).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text><Text style={styles.marketingDateDay}>{new Date(`${item.plannedFor}T12:00:00`).getDate()}</Text></View><View style={styles.marketingCopy}><Text style={styles.marketingItemTitle}>{item.title}</Text><Text style={styles.marketingMeta}>{item.campaignTitle} · {formatLabel(item.contentType)}</Text><View style={styles.platformRow}>{item.platforms.map((platform) => <View key={platform} style={styles.platformPill}><Text style={styles.platformPillText}>{platform}</Text></View>)}</View></View><View style={styles.marketingStatus}><Text style={styles.marketingStatusText}>{formatLabel(item.status)}</Text></View><AppIcon name="chevron-forward" color={COLORS.dim} size={18} /></Pressable>;
}

function OperationsSection({ data }: { data: ManagementDashboardData }) {
  const categories = Array.from(new Set(data.tasks.map((task) => task.category)));
  return <StandardPage eyebrow="BUSINESS OPERATIONS" title="Keep day-to-day work visible." subtitle="Tasks, projects, equipment, deadlines and recurring responsibilities live here.">
    <View style={styles.collectionGrid}>{categories.map((category) => { const tasks = data.tasks.filter((task) => task.category === category); const open = tasks.filter((task) => task.status !== 'complete').length; return <View key={category} style={styles.collectionCard}><View style={styles.collectionIcon}><AppIcon name="tasks" color={COLORS.gold} size={20} /></View><Text style={styles.collectionTitle}>{category}</Text><Text style={styles.collectionMeta}>{open} open · {tasks.length} total</Text><View style={styles.collectionBar}><View style={[styles.collectionBarFill, { width: `${tasks.length ? ((tasks.length - open) / tasks.length) * 100 : 0}%` }]} /></View></View>; })}</View>
  </StandardPage>;
}

function DirectoriesSection() {
  const collections: [string, string, AppIconName][] = [['Vendors', 'Services, pricing, contacts and past work', 'storefront'], ['Venues', 'Rules, capacity, rates, contracts and history', 'location'], ['Organizations', 'Partners, sponsors and community groups', 'directory'], ['People', 'Business contacts across every organization', 'team']];
  return <StandardPage eyebrow="DIRECTORIES" title="Your business relationships, connected." subtitle="Store a contact once, then connect that person or organization to events, tasks, files and opportunities."><View style={styles.collectionGrid}>{collections.map(([title, copy, icon]) => <StarterCollection key={title} title={title} copy={copy} icon={icon} />)}</View></StandardPage>;
}

function LibrarySection() {
  const collections: [string, string, AppIconName][] = [['Information Center', 'Internal guides, procedures and business knowledge', 'library'], ['Templates', 'Reusable events, checklists, outreach and campaign structures', 'tasks'], ['Files', 'Contracts, permits, menus, maps and documents', 'directory'], ['Media', 'Brand assets, event graphics, photos and video', 'photos']];
  return <StandardPage eyebrow="LIBRARY" title="Build the organization’s memory." subtitle="Reusable knowledge and files stay organized around the work they support."><View style={styles.collectionGrid}>{collections.map(([title, copy, icon]) => <StarterCollection key={title} title={title} copy={copy} icon={icon} />)}</View></StandardPage>;
}

function StarterCollection({ title, copy, icon }: { title: string; copy: string; icon: AppIconName }) {
  return <Pressable style={styles.starterCollection}><View style={styles.starterCollectionTop}><View style={styles.collectionIcon}><AppIcon name={icon} color={COLORS.gold} size={22} /></View><View style={styles.emptyCount}><Text style={styles.emptyCountText}>0</Text></View></View><Text style={styles.starterCollectionTitle}>{title}</Text><Text style={styles.starterCollectionCopy}>{copy}</Text><View style={styles.starterCollectionAction}><Text style={styles.starterCollectionActionText}>Open collection</Text><AppIcon name="chevron-forward" color={COLORS.gold} size={15} /></View></Pressable>;
}

function TeamSection({ data }: { data: ManagementDashboardData }) {
  return <StandardPage eyebrow="TEAM HUB" title="Give each person the right workspace." subtitle="Owners, admins, hosts, employees, volunteers and contractors should only see the work and records they need.">
    <View style={styles.teamCard}><View style={styles.teamAvatar}>{data.profile.avatarUrl ? <Image source={{ uri: data.profile.avatarUrl }} style={styles.topAvatarImage} /> : <Text style={styles.teamAvatarText}>{getInitials(data.profile.displayName)}</Text>}</View><View style={styles.teamCopy}><View style={styles.teamRolePill}><Text style={styles.teamRoleText}>{formatLabel(data.profile.platformRole).toUpperCase()}</Text></View><Text style={styles.teamName}>{data.profile.displayName}</Text><Text style={styles.teamMeta}>Full management access · {data.tasks.filter((task) => task.assigneeProfileId === data.profile.id).length} assigned tasks</Text></View><Pressable style={styles.outlineAction}><Text style={styles.outlineActionText}>View profile</Text></Pressable></View>
    <View style={styles.permissionNote}><AppIcon name="privacy" color={COLORS.green} size={20} /><View style={{ flex: 1 }}><Text style={styles.permissionNoteTitle}>Capability-based access is the target model</Text><Text style={styles.permissionNoteCopy}>Event publishing, member administration, marketing, financials and platform settings will be granted separately instead of relying on one admin switch.</Text></View></View>
  </StandardPage>;
}

function ReportsSection({ data }: { data: ManagementDashboardData }) {
  const reports: [string, string, AppIconName][] = [['Event performance', `${data.campaigns.length} event workspaces`, 'adventure'], ['Operations health', `${data.tasks.filter((task) => task.status !== 'complete').length} open tasks`, 'tasks'], ['Marketing output', `${data.marketing.length} content items`, 'megaphone'], ['Vending results', 'No vending records yet', 'storefront']];
  return <StandardPage eyebrow="REPORTS" title="Measure what changes decisions." subtitle="Reports will pull from the same events, work, marketing and opportunity records the team manages each day."><View style={styles.collectionGrid}>{reports.map(([title, copy, icon]) => <StarterCollection key={title} title={title} copy={copy} icon={icon} />)}</View></StandardPage>;
}

function AdminSection({ data, search }: { data: ManagementDashboardData; search: string }) {
  const rows: [string, string, AppIconName][] = [['Roles & permissions', 'Control capabilities for owners, admins, hosts and team members', 'privacy'], ['Integrations', 'Eventbrite, calendar, email and future publishing connections', 'connections'], ['Approvals', 'Require review for publishing, refunds, expenses and commitments', 'checkmark'], ['Platform settings', 'Organization details, notifications and protected owner controls', 'settings']];
  const filtered = rows.filter(([title, copy]) => !search || `${title} ${copy}`.toLowerCase().includes(search.toLowerCase()));
  return <StandardPage eyebrow="ADMINISTRATION" title="Protected system controls." subtitle={`Signed in as ${data.profile.displayName}. These tools stay separate from routine host work.`}><View style={styles.adminList}>{filtered.map(([title, copy, icon], index) => <Pressable key={title} style={[styles.adminRow, index > 0 && styles.rowDivider]}><View style={styles.adminIcon}><AppIcon name={icon} color={COLORS.gold} size={20} /></View><View style={{ flex: 1 }}><Text style={styles.adminTitle}>{title}</Text><Text style={styles.adminCopy}>{copy}</Text></View><AppIcon name="chevron-forward" color={COLORS.dim} size={18} /></Pressable>)}</View></StandardPage>;
}

function StandardPage({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <View style={styles.sectionPage}><View style={styles.standardHeader}><Text style={styles.pageEyebrow}>{eyebrow}</Text><Text style={styles.standardTitle}>{title}</Text><Text style={styles.standardSubtitle}>{subtitle}</Text></View>{children}</View>;
}

function SummaryBlock({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <View style={styles.summaryBlock}><Text style={[styles.summaryValue, danger && styles.summaryValueDanger]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function EmptyInline({ icon, title, copy }: { icon: AppIconName; title: string; copy: string }) {
  return <View style={styles.emptyInline}><View style={styles.emptyInlineIcon}><AppIcon name={icon} color={COLORS.green} size={20} /></View><View><Text style={styles.emptyInlineTitle}>{title}</Text><Text style={styles.emptyInlineCopy}>{copy}</Text></View></View>;
}

function EmptyPanel({ title, copy }: { title: string; copy: string }) {
  return <View style={styles.emptyPanel}><AppIcon name="adventure" color={COLORS.dim} size={24} /><Text style={styles.emptyPanelTitle}>{title}</Text><Text style={styles.emptyPanelCopy}>{copy}</Text></View>;
}

function CreateMenu({ visible, data, onClose, onSelect }: { visible: boolean; data: ManagementDashboardData; onClose: () => void; onSelect: (id: ManagementSectionId) => void }) {
  const mobile = useWindowDimensions().width < 760;
  const items: { title: string; copy: string; icon: AppIconName; action: () => void }[] = [
    { title: 'Event', copy: 'Start blank, use a template or duplicate an event', icon: 'adventure', action: () => router.push('/host/create' as never) },
    { title: 'Task', copy: 'Add work to an event or project', icon: 'tasks', action: () => data.campaigns[0] ? router.push(`/host/campaigns/${data.campaigns[0].slug}` as never) : onSelect('my-work') },
    { title: 'Opportunity', copy: 'Track vending, partnerships or sponsorships', icon: 'briefcase', action: () => onSelect('opportunities') },
    { title: 'Import URL', copy: 'Extract a public event page into a review record', icon: 'open', action: () => onSelect('opportunities') },
    { title: 'Vendor or contact', copy: 'Add a business relationship to the directory', icon: 'storefront', action: () => onSelect('directories') },
    { title: 'Campaign content', copy: 'Plan a post, reel, email or announcement', icon: 'megaphone', action: () => onSelect('marketing') },
  ];
  return <Modal visible={visible} transparent animationType={mobile ? 'slide' : 'fade'} onRequestClose={onClose}><Pressable style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]} onPress={onClose}><Pressable style={[styles.createMenu, mobile && styles.createMenuMobile]} onPress={(event) => event.stopPropagation()}>{mobile ? <View style={styles.moreHandle} /> : null}<View style={styles.createMenuHeader}><View><Text style={styles.createMenuEyebrow}>GLOBAL CREATE</Text><Text style={styles.createMenuTitle}>What are you adding?</Text></View><Pressable style={styles.iconButton} onPress={onClose}><AppIcon name="close" color={COLORS.cream} size={21} /></Pressable></View><ScrollView style={mobile ? styles.createMenuScroll : undefined} showsVerticalScrollIndicator={false}><View style={styles.createMenuGrid}>{items.map((item) => <Pressable key={item.title} style={[styles.createMenuItem, mobile && styles.createMenuItemMobile]} onPress={() => { onClose(); item.action(); }}><View style={styles.createMenuItemIcon}><AppIcon name={item.icon} color={COLORS.gold} size={20} /></View><View style={{ flex: 1 }}><Text style={styles.createMenuItemTitle}>{item.title}</Text><Text style={styles.createMenuItemCopy}>{item.copy}</Text></View><AppIcon name="chevron-forward" color={COLORS.dim} size={17} /></Pressable>)}</View></ScrollView></Pressable></Pressable></Modal>;
}

function needsAttention(task: Pick<ManagementTask, 'status' | 'priority'> | { status: string; priority: string }) {
  return task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical';
}

function getInitials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GM';
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function toLocalCalendarDate(value: string) {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function isTaskOwnedByProfile(task: ManagementTask, data: ManagementDashboardData) {
  if (task.assigneeProfileId === data.profile.id) return true;
  const firstName = data.profile.displayName.trim().split(/\s+/)[0]?.toLowerCase();
  return Boolean(firstName && task.owner.toLowerCase().split(/\s+|\+/).includes(firstName));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ink },
  shell: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 258, backgroundColor: COLORS.sidebar, borderRightWidth: 1, borderRightColor: '#223027' },
  sidebarBrand: { height: 82, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 19, borderBottomWidth: 1, borderBottomColor: '#223027' },
  brandMark: { width: 39, height: 39, borderRadius: 12, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: COLORS.ink, fontSize: 13, fontWeight: '900', letterSpacing: -.3 },
  sidebarTitle: { color: COLORS.cream, fontSize: 16, fontWeight: '900' },
  sidebarMeta: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1.35, marginTop: 2 },
  sidebarScroll: { paddingHorizontal: 11, paddingVertical: 13 },
  navGroup: { gap: 3 },
  sidebarGroupLabel: { color: '#5F6F65', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.15, marginLeft: 10, marginTop: 22, marginBottom: 8 },
  navItem: { minHeight: 43, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 11 },
  navItemActive: { backgroundColor: '#26311F', borderWidth: 1, borderColor: '#4D5429' },
  navItemText: { color: COLORS.muted, fontSize: 12.5, fontWeight: '800', flex: 1 },
  navItemTextActive: { color: COLORS.goldSoft },
  navBadge: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  navBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  sidebarFooter: { padding: 11, gap: 8, borderTopWidth: 1, borderTopColor: '#223027' },
  memberAppLink: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, padding: 10, backgroundColor: '#121D16' },
  memberAppTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  memberAppMeta: { color: COLORS.dim, fontSize: 9, marginTop: 1 },
  sidebarIdentity: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 7 },
  sidebarAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#26362C', borderWidth: 1, borderColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sidebarAvatarText: { color: COLORS.cream, fontSize: 10, fontWeight: '900' },
  sidebarName: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  sidebarRole: { color: COLORS.dim, fontSize: 9, marginTop: 2 },
  workspace: { flex: 1, minWidth: 0, backgroundColor: COLORS.ink },
  topbar: { minHeight: 82, borderBottomWidth: 1, borderBottomColor: '#223027', backgroundColor: '#0D1410', paddingHorizontal: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
  topbarCompact: { minHeight: 70, paddingHorizontal: 14 },
  topbarMobile: { minHeight: 58, paddingHorizontal: 12, gap: 8 },
  topbarEyebrow: { color: COLORS.dim, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  topbarSection: { color: COLORS.cream, fontSize: 18, fontWeight: '900', marginTop: 3 },
  compactBrand: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  brandMarkSmall: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  brandMarkSmallText: { color: COLORS.ink, fontSize: 11, fontWeight: '900' },
  compactBrandTitle: { color: COLORS.cream, fontSize: 14, fontWeight: '900' },
  compactBrandMeta: { color: COLORS.gold, fontSize: 9.5, fontWeight: '800', marginTop: 1 },
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchBox: { width: 260, height: 40, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#111A15', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11 },
  searchInput: { flex: 1, color: COLORS.cream, fontSize: 11.5, outlineStyle: 'none' } as any,
  iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#131C17', alignItems: 'center', justifyContent: 'center' },
  iconButtonMobile: { width: 36, height: 36, borderRadius: 11 },
  notificationDot: { position: 'absolute', right: 9, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.danger, borderWidth: 1, borderColor: '#131C17' },
  createButton: { height: 40, borderRadius: 12, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13 },
  createButtonMobile: { height: 36, borderRadius: 11, paddingHorizontal: 10 },
  createButtonText: { color: COLORS.ink, fontSize: 11.5, fontWeight: '900' },
  topAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#26362C', borderWidth: 1.5, borderColor: COLORS.gold, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  topAvatarImage: { width: '100%', height: '100%' },
  topAvatarText: { color: COLORS.cream, fontSize: 10, fontWeight: '900' },
  compactNav: { maxHeight: 51, borderBottomWidth: 1, borderBottomColor: '#223027', backgroundColor: '#0D1410' },
  compactNavContent: { paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  compactNavItem: { height: 35, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  compactNavItemActive: { backgroundColor: COLORS.gold },
  compactNavText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  compactNavTextActive: { color: COLORS.ink, fontWeight: '900' },
  mobileNav: { minHeight: 61, borderTopWidth: 1, borderTopColor: '#2A382F', backgroundColor: '#0D1410', flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4, paddingBottom: 2 },
  mobileNavItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 7, paddingBottom: 5 },
  mobileNavIcon: { position: 'relative' },
  mobileNavBadge: { position: 'absolute', right: -10, top: -7, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: COLORS.danger, borderWidth: 1.5, borderColor: '#0D1410', alignItems: 'center', justifyContent: 'center' },
  mobileNavBadgeText: { color: '#FFF', fontSize: 7, fontWeight: '900' },
  mobileNavLabel: { color: COLORS.muted, fontSize: 8.5, fontWeight: '800' },
  mobileNavLabelActive: { color: COLORS.goldSoft, fontWeight: '900' },
  contentScroll: { flex: 1 },
  content: { padding: 15, paddingBottom: 70 },
  contentMobile: { paddingHorizontal: 14, paddingTop: 15, paddingBottom: 28 },
  contentRoomy: { padding: 25, paddingBottom: 80 },
  sectionPage: { width: '100%', maxWidth: 1450, alignSelf: 'center' },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 20 },
  pageHeaderMobile: { marginBottom: 11 },
  pageEyebrow: { color: COLORS.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 },
  pageTitle: { color: COLORS.cream, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -.5, marginTop: 5 },
  pageTitleMobile: { fontSize: 25, lineHeight: 30, letterSpacing: -.35, marginTop: 4 },
  pageSubtitle: { color: COLORS.muted, fontSize: 12.5, lineHeight: 19, marginTop: 5, maxWidth: 590 },
  pageSubtitleMobile: { fontSize: 10.5, lineHeight: 16, marginTop: 3 },
  statusPill: { minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: '#31503D', backgroundColor: '#132219', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  statusPillText: { color: '#A8C49C', fontSize: 9.5, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  metricGridMobile: { gap: 8, marginTop: 2, marginBottom: 13 },
  metricCard: { minWidth: 180, flexBasis: 200, flexGrow: 1, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 15 },
  metricCardCompact: { minWidth: 0, flexBasis: '47%', padding: 11, borderRadius: 14 },
  metricCompactTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  metricIcon: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  metricIconCompact: { width: 29, height: 29, borderRadius: 9, marginBottom: 0 },
  metricLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  metricLabelCompact: { fontSize: 9 },
  metricValue: { color: COLORS.cream, fontSize: 28, lineHeight: 33, fontWeight: '900', marginTop: 3 },
  metricValueCompact: { fontSize: 22, lineHeight: 25, marginTop: 0 },
  metricDetail: { fontSize: 9.5, fontWeight: '800', marginTop: 3 },
  metricDetailCompact: { fontSize: 8, marginTop: 2 },
  mobileHomeFlow: { width: '100%' },
  dashboardColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  dashboardColumnsStack: { flexDirection: 'column' },
  dashboardPrimary: { flex: 1.55, minWidth: 0 },
  dashboardRail: { flex: 1, minWidth: 0 },
  panelHeader: { minHeight: 49, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 1, marginBottom: 8 },
  panelEyebrow: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  panelTitle: { color: COLORS.cream, fontSize: 16, fontWeight: '900', marginTop: 3 },
  panelAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4 },
  panelActionText: { color: COLORS.gold, fontSize: 9.5, fontWeight: '900' },
  panelCard: { borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden', marginBottom: 19 },
  attentionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 11 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  attentionSignal: { width: 7, height: 39, borderRadius: 4 },
  signalDanger: { backgroundColor: COLORS.danger },
  signalGold: { backgroundColor: COLORS.gold },
  signalOrange: { backgroundColor: COLORS.orange },
  attentionCopy: { flex: 1, minWidth: 0 },
  attentionTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attentionTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900', flex: 1 },
  attentionMeta: { color: COLORS.muted, fontSize: 9.5, marginTop: 4 },
  blockedBy: { color: '#BDA58C', fontSize: 9, marginTop: 3 },
  taskStatusPill: { borderRadius: 10, backgroundColor: '#2B2A1C', borderWidth: 1, borderColor: '#514A2C', paddingHorizontal: 7, paddingVertical: 4 },
  taskStatusDanger: { backgroundColor: '#321D1A', borderColor: '#6B352E' },
  taskStatusText: { color: COLORS.goldSoft, fontSize: 7.5, fontWeight: '900' },
  taskStatusTextDanger: { color: '#F49B8C' },
  eventStack: { gap: 9, marginBottom: 20 },
  homeEventCard: { borderRadius: 17, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.panelRaised, padding: 15 },
  homeEventTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eventAccent: { width: 7, height: 7, borderRadius: 4 },
  homeEventStatus: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  homeEventDays: { marginLeft: 'auto', color: COLORS.dim, fontSize: 9, fontWeight: '800' },
  homeEventTitle: { color: COLORS.cream, fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 8 },
  homeEventMeta: { color: COLORS.muted, fontSize: 10.5, marginTop: 3 },
  homeEventProgress: { height: 6, borderRadius: 4, backgroundColor: '#28332C', overflow: 'hidden', marginTop: 13 },
  homeEventProgressFill: { height: '100%', borderRadius: 4 },
  homeEventFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 11, marginTop: 10 },
  homeEventReadiness: { color: COLORS.cream, fontSize: 9.5, fontWeight: '900' },
  homeEventTaskMeta: { color: COLORS.muted, fontSize: 9.5 },
  openCampaign: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3 },
  openCampaignText: { fontSize: 9.5, fontWeight: '900' },
  mobileOtherEvents: { borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden', marginTop: 8, marginBottom: 3 },
  mobileEventRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9 },
  mobileEventCopy: { flex: 1, minWidth: 0 },
  mobileEventTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  mobileEventMeta: { color: COLORS.muted, fontSize: 8.5, marginTop: 3 },
  mobileBusinessSummary: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden', marginTop: 20, marginBottom: 3 },
  mobileBusinessItem: { flex: 1, minWidth: 0, minHeight: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, paddingVertical: 9 },
  mobileBusinessDivider: { borderLeftWidth: 1, borderLeftColor: COLORS.line },
  mobileBusinessValue: { color: COLORS.cream, fontSize: 18, fontWeight: '900' },
  mobileBusinessLabel: { color: COLORS.muted, fontSize: 7.5, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  mobileQuickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 3 },
  mobileQuickAction: { minWidth: 0, flexBasis: '47%', flexGrow: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11 },
  mobileQuickActionPrimary: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  mobileQuickActionText: { color: COLORS.cream, fontSize: 9.5, fontWeight: '900' },
  mobileQuickActionTextPrimary: { color: COLORS.ink },
  calendarRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 8 },
  calendarDate: { width: 37, alignItems: 'center' },
  calendarMonth: { color: COLORS.gold, fontSize: 7.5, fontWeight: '900', letterSpacing: .7 },
  calendarDay: { color: COLORS.cream, fontSize: 18, fontWeight: '900', marginTop: 1 },
  calendarSignal: { width: 3, height: 32, borderRadius: 2 },
  calendarCopy: { flex: 1, minWidth: 0 },
  calendarTitle: { color: COLORS.cream, fontSize: 10.5, fontWeight: '900' },
  calendarMeta: { color: COLORS.muted, fontSize: 8.5, marginTop: 3 },
  calendarKind: { color: COLORS.dim, fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  importCard: { borderRadius: 17, borderWidth: 1, borderColor: '#4B4126', backgroundColor: '#1D1B11', padding: 17, marginBottom: 18 },
  importCardMobile: { borderRadius: 14, padding: 13, marginBottom: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  importIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2E2A17', borderWidth: 1, borderColor: '#5E4F25', alignItems: 'center', justifyContent: 'center' },
  importIconMobile: { width: 34, height: 34, borderRadius: 10 },
  importMobileCopy: { flex: 1, minWidth: 0 },
  importTitle: { color: COLORS.cream, fontSize: 15, fontWeight: '900', marginTop: 13 },
  importTitleMobile: { fontSize: 12, marginTop: 0 },
  importCopy: { color: '#A8A18D', fontSize: 10, lineHeight: 16, marginTop: 5 },
  importCopyMobile: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  importAction: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 13 },
  importActionMobile: { marginTop: 7 },
  importActionText: { color: COLORS.gold, fontSize: 10, fontWeight: '900' },
  standardHeader: { marginBottom: 21 },
  standardTitle: { color: COLORS.cream, fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -.4, marginTop: 5 },
  standardSubtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 19, maxWidth: 690, marginTop: 6 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 11, marginBottom: 13 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#342E19', borderColor: '#6B5A2B' },
  filterChipText: { color: COLORS.muted, fontSize: 9.5, fontWeight: '800' },
  filterChipTextActive: { color: COLORS.goldSoft, fontSize: 9.5, fontWeight: '900' },
  viewToggle: { height: 34, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', alignItems: 'center', padding: 3, backgroundColor: COLORS.panel },
  viewToggleActive: { color: COLORS.ink, backgroundColor: COLORS.gold, borderRadius: 7, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6, fontSize: 8.5, fontWeight: '900' },
  viewToggleText: { color: COLORS.dim, paddingHorizontal: 9, fontSize: 8.5, fontWeight: '800' },
  listCard: { borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden' },
  agendaRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  agendaDate: { width: 44, alignItems: 'center' },
  agendaWeekday: { color: COLORS.gold, fontSize: 7.5, fontWeight: '900', letterSpacing: .7 },
  agendaDay: { color: COLORS.cream, fontSize: 22, fontWeight: '900' },
  agendaMonth: { color: COLORS.dim, fontSize: 8 },
  agendaBar: { width: 3, height: 47, borderRadius: 2 },
  agendaCopy: { flex: 1, minWidth: 0 },
  agendaKindRow: { flexDirection: 'row', alignItems: 'center' },
  agendaKind: { fontSize: 7.5, fontWeight: '900', letterSpacing: .7 },
  agendaTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900', marginTop: 3 },
  agendaMeta: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  outlineAction: { minHeight: 36, borderRadius: 11, borderWidth: 1, borderColor: '#5A4B27', backgroundColor: '#1D1B12', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11 },
  outlineActionText: { color: COLORS.gold, fontSize: 9.5, fontWeight: '900' },
  workSummary: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, marginBottom: 13, overflow: 'hidden' },
  summaryBlock: { minWidth: 95, flex: 1, padding: 13, borderRightWidth: 1, borderRightColor: COLORS.line },
  summaryValue: { color: COLORS.cream, fontSize: 20, fontWeight: '900' },
  summaryValueDanger: { color: COLORS.danger },
  summaryLabel: { color: COLORS.muted, fontSize: 8.5, fontWeight: '800', marginTop: 2 },
  workTaskRow: { minHeight: 71, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 9 },
  checkCircle: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checkCircleComplete: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  workTaskCopy: { flex: 1, minWidth: 160 },
  workTaskTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  workTaskMeta: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  workTaskOwner: { minWidth: 115 },
  workTaskOwnerName: { color: '#B8C1BB', fontSize: 9, fontWeight: '800' },
  workTaskDue: { color: COLORS.dim, fontSize: 8.5, marginTop: 3 },
  workTaskDueDanger: { color: COLORS.danger },
  completedText: { color: COLORS.dim, textDecorationLine: 'line-through' },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  eventGridStack: { flexDirection: 'column' },
  eventWorkspaceCard: { minWidth: 310, flexBasis: 430, flexGrow: 1, borderRadius: 18, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.panelRaised, overflow: 'hidden' },
  eventWorkspaceStripe: { height: 5 },
  eventWorkspaceBody: { padding: 17 },
  datePill: { marginLeft: 'auto', borderRadius: 10, backgroundColor: COLORS.panel, paddingHorizontal: 8, paddingVertical: 5 },
  datePillText: { color: COLORS.muted, fontSize: 8.5, fontWeight: '800' },
  eventWorkspaceTitle: { color: COLORS.cream, fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 10 },
  eventWorkspaceLocation: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  workspaceMetrics: { flexDirection: 'row', marginTop: 15, borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.panel },
  eventWorkspaceFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  eventWorkspaceDays: { color: COLORS.muted, fontSize: 9.5, fontWeight: '800' },
  opportunityToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  importUrlButton: { minHeight: 38, borderRadius: 11, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  importUrlButtonText: { color: COLORS.ink, fontSize: 10, fontWeight: '900' },
  urlImporter: { borderRadius: 18, borderWidth: 1, borderColor: '#51482B', backgroundColor: '#1B1A12', padding: 17, marginBottom: 20 },
  importerLead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  importerTitle: { color: COLORS.cream, fontSize: 15, fontWeight: '900' },
  importerCopy: { color: '#A8A18D', fontSize: 10.5, lineHeight: 16, marginTop: 4, maxWidth: 690 },
  urlInputRow: { flexDirection: 'row', gap: 7, marginTop: 15 },
  urlInput: { flex: 1, minHeight: 43, borderRadius: 11, borderWidth: 1, borderColor: '#4E4936', backgroundColor: '#11130F', color: COLORS.cream, paddingHorizontal: 12, fontSize: 10.5 },
  extractButton: { minHeight: 43, borderRadius: 11, backgroundColor: '#40391E', borderWidth: 1, borderColor: '#66592A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  extractButtonText: { color: COLORS.goldSoft, fontSize: 9.5, fontWeight: '900' },
  importerNote: { color: COLORS.dim, fontSize: 8.5, marginTop: 8 },
  pipelineTitle: { color: COLORS.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  pipeline: { gap: 9, paddingBottom: 5 },
  pipelineColumn: { width: 232, minHeight: 230, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 11 },
  pipelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pipelineLabel: { color: COLORS.cream, fontSize: 10.5, fontWeight: '900' },
  pipelineCount: { minWidth: 22, height: 20, borderRadius: 10, backgroundColor: COLORS.panelSoft, alignItems: 'center', justifyContent: 'center' },
  pipelineCountText: { color: COLORS.muted, fontSize: 8.5, fontWeight: '900' },
  pipelineEmpty: { flex: 1, marginTop: 11, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', gap: 6 },
  pipelineEmptyText: { color: COLORS.dim, fontSize: 9 },
  marketingRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 9 },
  marketingDate: { width: 39, alignItems: 'center' },
  marketingDateMonth: { color: COLORS.teal, fontSize: 7.5, fontWeight: '900' },
  marketingDateDay: { color: COLORS.cream, fontSize: 20, fontWeight: '900' },
  marketingCopy: { flex: 1, minWidth: 0 },
  marketingItemTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  marketingMeta: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  platformPill: { borderRadius: 8, backgroundColor: '#20332B', paddingHorizontal: 6, paddingVertical: 3 },
  platformPillText: { color: '#9CCAB9', fontSize: 7, fontWeight: '900', textTransform: 'uppercase' },
  marketingStatus: { borderRadius: 9, backgroundColor: '#302B1B', paddingHorizontal: 8, paddingVertical: 5 },
  marketingStatusText: { color: COLORS.goldSoft, fontSize: 8, fontWeight: '900' },
  collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  collectionCard: { minWidth: 210, flexBasis: 250, flexGrow: 1, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 15 },
  collectionIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#2B2A19', borderWidth: 1, borderColor: '#504627', alignItems: 'center', justifyContent: 'center' },
  collectionTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900', marginTop: 11 },
  collectionMeta: { color: COLORS.muted, fontSize: 9.5, marginTop: 4 },
  collectionBar: { height: 5, borderRadius: 3, backgroundColor: '#28332C', overflow: 'hidden', marginTop: 12 },
  collectionBarFill: { height: '100%', backgroundColor: COLORS.green },
  starterCollection: { minWidth: 240, flexBasis: 300, flexGrow: 1, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 16 },
  starterCollectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyCount: { minWidth: 30, height: 26, borderRadius: 13, backgroundColor: COLORS.panelSoft, alignItems: 'center', justifyContent: 'center' },
  emptyCountText: { color: COLORS.dim, fontSize: 10, fontWeight: '900' },
  starterCollectionTitle: { color: COLORS.cream, fontSize: 16, fontWeight: '900', marginTop: 15 },
  starterCollectionCopy: { color: COLORS.muted, fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  starterCollectionAction: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 16 },
  starterCollectionActionText: { color: COLORS.gold, fontSize: 9.5, fontWeight: '900' },
  teamCard: { borderRadius: 17, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.panelRaised, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  teamAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: '#26362C', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { color: COLORS.cream, fontSize: 15, fontWeight: '900' },
  teamCopy: { flex: 1 },
  teamRolePill: { alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#2E2D1A', paddingHorizontal: 7, paddingVertical: 4 },
  teamRoleText: { color: COLORS.goldSoft, fontSize: 7.5, fontWeight: '900', letterSpacing: .6 },
  teamName: { color: COLORS.cream, fontSize: 17, fontWeight: '900', marginTop: 5 },
  teamMeta: { color: COLORS.muted, fontSize: 9.5, marginTop: 3 },
  permissionNote: { marginTop: 13, borderRadius: 15, borderWidth: 1, borderColor: '#34503D', backgroundColor: '#13231A', flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  permissionNoteTitle: { color: '#DCE8DE', fontSize: 11.5, fontWeight: '900' },
  permissionNoteCopy: { color: '#8EA092', fontSize: 9.5, lineHeight: 15, marginTop: 3 },
  adminList: { borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden' },
  adminRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  adminIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#2B2A19', alignItems: 'center', justifyContent: 'center' },
  adminTitle: { color: COLORS.cream, fontSize: 12.5, fontWeight: '900' },
  adminCopy: { color: COLORS.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  emptyInline: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, padding: 17 },
  emptyInlineIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#1B2B20', alignItems: 'center', justifyContent: 'center' },
  emptyInlineTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  emptyInlineCopy: { color: COLORS.muted, fontSize: 9.5, marginTop: 3 },
  emptyPanel: { minHeight: 160, flex: 1, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyPanelTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900', marginTop: 9 },
  emptyPanelCopy: { color: COLORS.muted, fontSize: 9.5, marginTop: 4, textAlign: 'center' },
  stateScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateTitle: { color: COLORS.cream, fontSize: 20, fontWeight: '900', marginTop: 13 },
  stateCopy: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', maxWidth: 430, marginTop: 6 },
  stateActions: { flexDirection: 'row', gap: 8, marginTop: 17 },
  errorIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#2B1B18', alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  secondaryButton: { minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: COLORS.lineStrong, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: COLORS.cream, fontSize: 10, fontWeight: '900' },
  primaryButton: { minHeight: 40, borderRadius: 11, backgroundColor: COLORS.gold, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: COLORS.ink, fontSize: 10, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalBackdropMobile: { alignItems: 'stretch', justifyContent: 'flex-end', padding: 0 },
  moreBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  moreSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.lineStrong, backgroundColor: '#111A15', paddingHorizontal: 15, paddingTop: 8, paddingBottom: 18 },
  moreHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: COLORS.lineStrong, alignSelf: 'center', marginBottom: 12 },
  moreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  moreEyebrow: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  moreTitle: { color: COLORS.cream, fontSize: 20, fontWeight: '900', marginTop: 2 },
  moreClose: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  moreGrid: { borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden' },
  moreItem: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  moreItemActive: { backgroundColor: '#25271A' },
  moreItemIcon: { width: 27, alignItems: 'center' },
  moreItemText: { flex: 1, color: COLORS.muted, fontSize: 11.5, fontWeight: '800' },
  moreItemTextActive: { color: COLORS.goldSoft, fontWeight: '900' },
  moreMemberLink: { minHeight: 48, borderRadius: 13, backgroundColor: '#17231C', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginTop: 10 },
  moreMemberText: { flex: 1, color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  createMenu: { width: '100%', maxWidth: 650, borderRadius: 20, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: '#111A15', padding: 17, shadowColor: '#000', shadowOpacity: .5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 20 },
  createMenuMobile: { maxWidth: '100%', maxHeight: '84%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingTop: 8, paddingBottom: 18 },
  createMenuScroll: { flexGrow: 0 },
  createMenuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 13 },
  createMenuEyebrow: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  createMenuTitle: { color: COLORS.cream, fontSize: 21, fontWeight: '900', marginTop: 4 },
  createMenuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  createMenuItem: { minWidth: 240, flexBasis: 280, flexGrow: 1, minHeight: 76, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  createMenuItemMobile: { width: '100%', minWidth: 0, flexBasis: 'auto', flexGrow: 0, minHeight: 63 },
  createMenuItemIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#292718', alignItems: 'center', justifyContent: 'center' },
  createMenuItemTitle: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  createMenuItemCopy: { color: COLORS.muted, fontSize: 8.5, lineHeight: 13, marginTop: 3 },
});
