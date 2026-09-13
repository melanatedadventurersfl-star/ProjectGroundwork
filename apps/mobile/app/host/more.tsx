import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ensureHostCenterProfile, getHostSetupProgress, type HostCenterProfile } from '../../src/hosting/hostEntry';
import { supabase } from '../../src/lib/supabase';
import { experienceModuleEnabled, getOrganizationExperience, listExperienceModules } from '../../src/platform/experience';
import {
  getOrganizationPublicBusiness,
  hasOrganizationPermission,
  listMyOrganizations,
  organizationRoleLabel,
  setActiveOrganization,
  type OrganizationPermission,
  type OrganizationPublicBusiness,
  type OrganizationWorkspace,
} from '../../src/platform/organizations';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';
import { getVendorAccess } from '../../src/vendor/vendorAccess';

const COLORS = {
  bg: '#0B100D', panel: '#151B17', raised: '#1B231E', line: '#2E3832', cream: '#FFF8E8',
  muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#7CCB92', blue: '#75AEE8',
  purple: '#A990ED', orange: '#E7A05C', danger: '#E8A09A',
};

type ToolItem = {
  key: string;
  title: string;
  text: string;
  route: string;
  icon: AppIconName;
  accent: string;
  permission?: OrganizationPermission;
  keywords: string;
};

type CategoryKey = 'people' | 'growth' | 'money' | 'resources' | 'setup';

type Category = {
  key: CategoryKey;
  title: string;
  text: string;
  icon: AppIconName;
  accent: string;
  tools: ToolItem[];
};

const CATEGORIES: Category[] = [
  {
    key: 'people', title: 'People & Partners', text: 'Team, vendors, opportunities and reusable contacts.', icon: 'team', accent: COLORS.green,
    tools: [
      { key: 'team', title: 'Team', text: 'People, roles and event crews.', route: '/host/teams', icon: 'team', accent: COLORS.green, permission: 'members.view', keywords: 'staff people roles crew workers members invite' },
      { key: 'marketplace', title: 'Marketplace', text: 'Find and manage services and event vendors.', route: '/host/vendors/marketplace', icon: 'storefront', accent: COLORS.blue, permission: 'vendors.view', keywords: 'vendors services marketplace partners' },
      { key: 'opportunities', title: 'Opportunities', text: 'Vending, partnerships and sponsorships.', route: '/host/opportunities', icon: 'briefcase', accent: COLORS.orange, permission: 'events.view', keywords: 'vending sponsorship partnerships leads' },
      { key: 'directories', title: 'Directories', text: 'Venues, vendors and reusable business resources.', route: '/host/directories', icon: 'directory', accent: COLORS.gold, permission: 'vendors.view', keywords: 'venues vendor directory resources locations' },
    ],
  },
  {
    key: 'growth', title: 'Growth', text: 'Promotion, messages and connected distribution tools.', icon: 'megaphone', accent: COLORS.orange,
    tools: [
      { key: 'marketing', title: 'Marketing', text: 'Campaigns, content, promotion and performance.', route: '/host/campaigns', icon: 'megaphone', accent: COLORS.orange, permission: 'marketing.view', keywords: 'campaign content promotion social ads' },
      { key: 'communications', title: 'Communications', text: 'Messages, schedules and audiences.', route: '/host/communications', icon: 'message', accent: COLORS.purple, permission: 'communications.view', keywords: 'email message attendees vendors staff notifications' },
      { key: 'connections', title: 'Connections & Apps', text: 'Social, ticketing, email and distribution connections.', route: '/host/connections', icon: 'connections', accent: COLORS.green, permission: 'integrations.view', keywords: 'integrations apps facebook eventbrite mailchimp connection' },
    ],
  },
  {
    key: 'money', title: 'Money', text: 'Revenue, expenses, profit and reporting.', icon: 'reports', accent: '#84C992',
    tools: [
      { key: 'finances', title: 'Finances', text: 'Money across events and organization operations.', route: '/host/finances', icon: 'reports', accent: '#84C992', permission: 'finance.view', keywords: 'finance money revenue expenses profit budget sales' },
      { key: 'reports', title: 'Reports', text: 'Cross-event performance and financial history.', route: '/host/finances', icon: 'reports', accent: '#84C992', permission: 'analytics.view', keywords: 'reports analytics performance history' },
    ],
  },
  {
    key: 'resources', title: 'Resources', text: 'Templates, files, inventory and reusable building blocks.', icon: 'library', accent: COLORS.blue,
    tools: [
      { key: 'library', title: 'Templates & Library', text: 'Reusable event and operations building blocks.', route: '/host/library', icon: 'library', accent: COLORS.gold, permission: 'files.view', keywords: 'templates library documents files waivers contracts' },
      { key: 'inventory', title: 'Inventory', text: 'Equipment, supplies, rentals and assignments.', route: '/host/inventory-hub', icon: 'settings', accent: COLORS.muted, permission: 'files.view', keywords: 'inventory gear equipment supplies rentals' },
      { key: 'documents', title: 'Documents', text: 'Waivers, contracts and organization files.', route: '/host/library', icon: 'upload', accent: COLORS.blue, permission: 'files.view', keywords: 'documents waivers contracts uploads files' },
    ],
  },
  {
    key: 'setup', title: 'Setup', text: 'Public presence, organization settings and AI controls.', icon: 'settings', accent: COLORS.gold,
    tools: [
      { key: 'experience', title: 'Public Experience', text: 'Brand, modules, language and publishing target.', route: '/host/experience', icon: 'sparkles', accent: COLORS.gold, permission: 'organization.branding.manage', keywords: 'public experience brand branding modules terminology' },
      { key: 'home-layout', title: 'Home Layout', text: 'Arrange the public Home experience.', route: '/host/home-layout', icon: 'dashboard', accent: COLORS.purple, permission: 'organization.branding.manage', keywords: 'home layout public page blocks' },
      { key: 'host-profile', title: 'Host Profile', text: 'Edit what people see about your host identity.', route: '/host/profile', icon: 'profile', accent: COLORS.gold, permission: 'organization.view', keywords: 'host profile bio public identity' },
      { key: 'ai-privacy', title: 'AI & Privacy', text: 'Memory, personalization and optional analytics.', route: '/host/ai-privacy', icon: 'sparkles', accent: COLORS.purple, permission: 'ai.use', keywords: 'ai privacy memory analytics personalization' },
      { key: 'host-setup', title: 'Host Setup', text: 'Organization defaults and Host Center introduction.', route: '/host/setup', icon: 'settings', accent: COLORS.muted, permission: 'organization.settings.manage', keywords: 'setup settings defaults introduction onboarding' },
    ],
  },
];

const PERMISSIONS = Array.from(new Set(CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.permission).filter(Boolean)))) as OrganizationPermission[];
const sessionPins = new Map<string, string[]>();
const sessionRecent = new Map<string, string[]>();

export default function HostMoreScreen() {
  const [profile, setProfile] = useState<HostCenterProfile | null>(null);
  const [vendorApproved, setVendorApproved] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationWorkspace[]>([]);
  const [activeOrganization, setActiveOrganizationState] = useState<OrganizationWorkspace | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [publicBusiness, setPublicBusiness] = useState<OrganizationPublicBusiness | null>(null);
  const [tenantAppSlug, setTenantAppSlug] = useState<string | null>(null);
  const [tenantProfileEnabled, setTenantProfileEnabled] = useState(false);
  const [permissions, setPermissions] = useState<Set<OrganizationPermission>>(new Set());
  const [organizationExpanded, setOrganizationExpanded] = useState(false);
  const [switchingOrganizationId, setSwitchingOrganizationId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null);
  const [showAllTools, setShowAllTools] = useState(false);
  const [search, setSearch] = useState('');
  const [pinnedKeys, setPinnedKeys] = useState<string[]>([]);
  const [recentKeys, setRecentKeys] = useState<string[]>([]);
  const [workspaceError, setWorkspaceError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadOrganizationContext(organization: OrganizationWorkspace) {
    const [business, experience, permissionEntries] = await Promise.all([
      getOrganizationPublicBusiness(organization.id).catch(() => null),
      getOrganizationExperience(organization.id).catch(() => null),
      Promise.all(PERMISSIONS.map(async (permission) => [permission, await hasOrganizationPermission(organization.id, permission).catch(() => false)] as const)),
    ]);
    setPublicBusiness(business);
    setPermissions(new Set(permissionEntries.filter(([, allowed]) => allowed).map(([permission]) => permission)));
    setPinnedKeys(sessionPins.get(organization.id) ?? []);
    setRecentKeys(sessionRecent.get(organization.id) ?? []);
    if (!organization.isPlatformDefault && experience) {
      const modules = await listExperienceModules(experience.id).catch(() => []);
      setTenantAppSlug(organization.slug);
      setTenantProfileEnabled(experienceModuleEnabled(modules, 'profiles', false));
    } else {
      setTenantAppSlug(null);
      setTenantProfileEnabled(false);
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      ensureHostCenterProfile(),
      getVendorAccess().catch(() => ({ approved: false, record: null })),
      listMyOrganizations(),
      supabase.auth.getUser(),
      supabase.rpc('is_platform_admin'),
    ]).then(async ([value, vendorAccess, organizationRows, authResult, adminResult]) => {
      if (!active) return;
      const currentOrganization = organizationRows.find((organization) => organization.isActive)
        ?? organizationRows.find((organization) => organization.isPlatformDefault)
        ?? organizationRows[0]
        ?? null;
      setProfile(value);
      setVendorApproved(vendorAccess.approved);
      setIsPlatformAdmin(!adminResult.error && adminResult.data === true);
      setOrganizations(organizationRows);
      setActiveOrganizationState(currentOrganization);
      setCurrentProfileId(authResult.data.user?.id ?? null);
      if (currentOrganization) await loadOrganizationContext(currentOrganization);
    }).catch((error) => {
      console.warn('[host-more] setup load failed', error);
      if (active) setWorkspaceError(error instanceof Error ? error.message : 'Unable to load Host Center tools.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const progress = useMemo(() => getHostSetupProgress(profile), [profile]);
  const flatTools = useMemo(() => CATEGORIES.flatMap((category) => category.tools), []);
  const visibleCategories = useMemo(() => {
    const filtered = CATEGORIES.map((category) => ({
      ...category,
      tools: category.tools.filter((tool) => !tool.permission || permissions.has(tool.permission)),
    })).filter((category) => category.tools.length > 0);
    const roles = new Set(activeOrganization?.roles ?? []);
    const priority: CategoryKey | null = roles.has('finance') ? 'money' : roles.has('marketing') ? 'growth' : null;
    if (!priority) return filtered;
    return [...filtered].sort((a, b) => a.key === priority ? -1 : b.key === priority ? 1 : 0);
  }, [activeOrganization?.roles, permissions]);
  const visibleToolKeys = useMemo(() => new Set(visibleCategories.flatMap((category) => category.tools.map((tool) => tool.key))), [visibleCategories]);
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return flatTools.filter((tool) => visibleToolKeys.has(tool.key) && `${tool.title} ${tool.text} ${tool.keywords}`.toLowerCase().includes(query));
  }, [flatTools, search, visibleToolKeys]);
  const pinnedTools = useMemo(() => pinnedKeys.map((key) => flatTools.find((tool) => tool.key === key)).filter((tool): tool is ToolItem => Boolean(tool && visibleToolKeys.has(tool.key))).slice(0, 4), [flatTools, pinnedKeys, visibleToolKeys]);
  const recentTools = useMemo(() => recentKeys.map((key) => flatTools.find((tool) => tool.key === key)).filter((tool): tool is ToolItem => Boolean(tool && visibleToolKeys.has(tool.key) && !pinnedKeys.includes(tool.key))).slice(0, 3), [flatTools, pinnedKeys, recentKeys, visibleToolKeys]);

  async function switchOrganization(organization: OrganizationWorkspace) {
    if (organization.isActive || switchingOrganizationId) return;
    setSwitchingOrganizationId(organization.id);
    setWorkspaceError('');
    try {
      const next = await setActiveOrganization(organization.id);
      const rows = await listMyOrganizations();
      const nextProfile = await ensureHostCenterProfile();
      setOrganizations(rows);
      setActiveOrganizationState(next);
      setProfile(nextProfile);
      setOrganizationExpanded(false);
      setExpandedCategory(null);
      setSearch('');
      await loadOrganizationContext(next);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to switch organization.');
    } finally {
      setSwitchingOrganizationId(null);
    }
  }

  function recordRecent(tool: ToolItem) {
    if (!activeOrganization) return;
    const next = [tool.key, ...(sessionRecent.get(activeOrganization.id) ?? []).filter((key) => key !== tool.key)].slice(0, 5);
    sessionRecent.set(activeOrganization.id, next);
    setRecentKeys(next);
  }

  function openTool(tool: ToolItem) {
    recordRecent(tool);
    router.push(tool.route as never);
  }

  function togglePin(tool: ToolItem) {
    if (!activeOrganization) return;
    const current = sessionPins.get(activeOrganization.id) ?? [];
    const next = current.includes(tool.key) ? current.filter((key) => key !== tool.key) : [...current, tool.key].slice(-4);
    sessionPins.set(activeOrganization.id, next);
    setPinnedKeys(next);
  }

  function openAsProfile() {
    if (!activeOrganization || !currentProfileId) return;
    setWorkspaceError('');
    if (activeOrganization.isPlatformDefault) {
      router.push('/member/profile' as never);
      return;
    }
    if (!tenantAppSlug || !tenantProfileEnabled) {
      setWorkspaceError('Member profiles are not enabled for this organization app.');
      return;
    }
    router.push(`/experience/${tenantAppSlug}/profile` as never);
  }

  function openAsBusiness() {
    if (!activeOrganization) return;
    setWorkspaceError('');
    if (!activeOrganization.isPlatformDefault) {
      if (!tenantAppSlug) {
        setWorkspaceError('This organization app is not configured yet.');
        return;
      }
      router.push(`/experience/${tenantAppSlug}/business` as never);
      return;
    }
    if (publicBusiness) {
      router.push({ pathname: '/organization-profile/[slug]', params: { slug: publicBusiness.slug } });
      return;
    }
    router.push({ pathname: '/organization-business-preview/[id]', params: { id: activeOrganization.id } });
  }

  const quickActions = [
    { key: 'build', title: 'Build Event', icon: 'add' as AppIconName, route: '/host/create', permission: 'events.manage' as OrganizationPermission },
    { key: 'task', title: 'Add Task', icon: 'tasks' as AppIconName, route: '/host/work', permission: 'tasks.manage' as OrganizationPermission },
    { key: 'invite', title: 'Invite', icon: 'team' as AppIconName, route: '/host/teams', permission: 'members.manage' as OrganizationPermission },
    { key: 'message', title: 'Message', icon: 'message' as AppIconName, route: '/host/communications', permission: 'communications.send' as OrganizationPermission },
  ].filter((action) => permissions.has(action.permission));

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>{activeOrganization?.name.toUpperCase() ?? profile?.organizationName.toUpperCase() ?? 'HOST CENTER'}</Text>
      <Text style={styles.title}>More</Text>
      <Text style={styles.subtitle}>Your organization tools, grouped around what you are trying to do.</Text>

      <Text style={styles.sectionLabel}>ORGANIZATION</Text>
      <View style={styles.organizationCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose organization workspace"
          style={styles.organizationActiveRow}
          onPress={() => organizations.length > 1 && setOrganizationExpanded((value) => !value)}
        >
          <View style={styles.organizationMark}><Text style={styles.organizationMarkText}>{activeOrganization?.name.slice(0, 1).toUpperCase() ?? '?'}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.organizationTitle}>{activeOrganization?.name ?? 'Organization workspace'}</Text>
            <Text style={styles.organizationMeta}>{activeOrganization?.roles.slice(0, 2).map(organizationRoleLabel).join(' · ') || 'Organization member'}</Text>
          </View>
          {loading ? <ActivityIndicator color={COLORS.gold} size="small" /> : organizations.length > 1 ? <Text style={styles.dropdownArrow}>{organizationExpanded ? '⌃' : '⌄'}</Text> : null}
        </Pressable>
        {organizationExpanded ? <View style={styles.organizationDropdown}>
          {organizations.filter((organization) => organization.id !== activeOrganization?.id).map((organization, index) => <Pressable
            key={organization.id}
            disabled={switchingOrganizationId !== null}
            style={[styles.organizationOption, index > 0 && styles.divider]}
            onPress={() => void switchOrganization(organization)}
          >
            <View style={styles.organizationMarkSmall}><Text style={styles.organizationMarkSmallText}>{organization.name.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.flex}><Text style={styles.optionTitle}>{organization.name}</Text><Text style={styles.organizationMeta}>{organization.roles.slice(0, 2).map(organizationRoleLabel).join(' · ') || 'Organization member'}</Text></View>
            {switchingOrganizationId === organization.id ? <ActivityIndicator color={COLORS.gold} size="small" /> : <Text style={styles.chevron}>›</Text>}
          </Pressable>)}
        </View> : null}
      </View>

      <Text style={styles.sectionLabel}>VIEW</Text>
      <View style={styles.publicGrid}>
        <Pressable disabled={!activeOrganization || !currentProfileId} style={styles.publicTile} onPress={openAsProfile}>
          <View style={styles.publicIcon}><AppIcon name="profile" color={COLORS.gold} size={20} /></View>
          <Text style={styles.publicTitle}>Open as Profile</Text>
          <Text style={styles.publicText} numberOfLines={2}>{activeOrganization?.isPlatformDefault ? 'See your member-facing profile.' : tenantProfileEnabled ? 'See your profile in this app.' : 'Profiles are not enabled here.'}</Text>
        </Pressable>
        <Pressable disabled={!activeOrganization} style={styles.publicTile} onPress={openAsBusiness}>
          <View style={styles.publicIcon}><AppIcon name="storefront" color={COLORS.gold} size={20} /></View>
          <Text style={styles.publicTitle}>Open as Business</Text>
          <Text style={styles.publicText} numberOfLines={2}>See the organization-facing public experience.</Text>
        </Pressable>
      </View>

      {quickActions.length > 0 ? <>
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {quickActions.map((action) => <Pressable key={action.key} style={styles.quickAction} onPress={() => router.push(action.route as never)}>
            <View style={styles.quickIcon}><AppIcon name={action.icon} color={COLORS.gold} size={18} /></View><Text style={styles.quickText}>{action.title}</Text>
          </Pressable>)}
        </ScrollView>
      </> : null}

      <View style={styles.searchShell}>
        <AppIcon name="search" color={COLORS.dim} size={18} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search Host Center"
          placeholderTextColor="#66736B"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search ? <Pressable onPress={() => setSearch('')}><Text style={styles.clearSearch}>×</Text></Pressable> : null}
      </View>

      {search.trim() ? <View style={styles.searchResults}>
        <Text style={styles.resultLabel}>{searchResults.length ? `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}` : 'No matching tools'}</Text>
        {searchResults.map((tool, index) => <ToolRow key={tool.key} tool={tool} pinned={pinnedKeys.includes(tool.key)} first={index === 0} onOpen={() => openTool(tool)} onPin={() => togglePin(tool)} />)}
      </View> : <>
        {pinnedTools.length > 0 || recentTools.length > 0 ? <>
          <Text style={styles.sectionLabel}>SHORTCUTS</Text>
          <View style={styles.shortcutCard}>
            {pinnedTools.map((tool, index) => <ToolRow key={`pin-${tool.key}`} tool={tool} pinned first={index === 0} onOpen={() => openTool(tool)} onPin={() => togglePin(tool)} />)}
            {recentTools.map((tool, index) => <ToolRow key={`recent-${tool.key}`} tool={tool} pinned={false} first={pinnedTools.length === 0 && index === 0} onOpen={() => openTool(tool)} onPin={() => togglePin(tool)} recent />)}
          </View>
        </> : null}

        <Text style={styles.sectionLabel}>MANAGE</Text>
        <View style={styles.categoryList}>
          {visibleCategories.map((category) => {
            const expanded = expandedCategory === category.key;
            return <View key={category.key} style={styles.categoryCard}>
              <Pressable style={styles.categoryHeader} onPress={() => setExpandedCategory(expanded ? null : category.key)}>
                <View style={[styles.categoryIcon, { backgroundColor: `${category.accent}20` }]}><AppIcon name={category.icon} color={category.accent} size={21} /></View>
                <View style={styles.flex}><Text style={styles.categoryTitle}>{category.title}</Text><Text style={styles.categoryText}>{category.text}</Text></View>
                <Text style={styles.categoryArrow}>{expanded ? '⌃' : '⌄'}</Text>
              </Pressable>
              {expanded ? <View style={styles.categoryTools}>{category.tools.map((tool, index) => <ToolRow key={tool.key} tool={tool} pinned={pinnedKeys.includes(tool.key)} first={index === 0} onOpen={() => openTool(tool)} onPin={() => togglePin(tool)} />)}</View> : null}
            </View>;
          })}
        </View>

        {!loading && progress.percent < 100 ? <Pressable style={styles.setupNotice} onPress={() => router.push('/host/setup' as never)}>
          <View style={styles.setupIcon}><AppIcon name="settings" color={COLORS.gold} size={19} /></View>
          <View style={styles.flex}><Text style={styles.setupNoticeTitle}>Host setup {progress.percent}% complete</Text><Text style={styles.setupNoticeText}>Finish the remaining organization setup items.</Text></View><Text style={styles.chevron}>›</Text>
        </Pressable> : null}

        <Pressable style={styles.allToolsButton} onPress={() => setShowAllTools((value) => !value)}><Text style={styles.allToolsText}>{showAllTools ? 'Hide all tools' : 'All tools'}</Text><Text style={styles.chevron}>{showAllTools ? '⌃' : '›'}</Text></Pressable>
        {showAllTools ? <View style={styles.allToolsCard}>{visibleCategories.flatMap((category) => category.tools).map((tool, index) => <ToolRow key={`all-${tool.key}`} tool={tool} pinned={pinnedKeys.includes(tool.key)} first={index === 0} onOpen={() => openTool(tool)} onPin={() => togglePin(tool)} />)}</View> : null}
      </>}

      {(vendorApproved || isPlatformAdmin) ? <>
        <Text style={styles.sectionLabel}>SWITCH WORKSPACE</Text>
        <View style={styles.workspaceCard}>
          {vendorApproved ? <Pressable style={styles.workspaceRow} onPress={() => router.replace('/vendor' as never)}><View style={styles.workspaceIcon}><AppIcon name="storefront" color={COLORS.blue} size={19} /></View><Text style={styles.workspaceTitle}>Vendor Center</Text><Text style={styles.chevron}>›</Text></Pressable> : null}
          {isPlatformAdmin ? <Pressable style={[styles.workspaceRow, vendorApproved && styles.divider]} onPress={() => router.replace('/admin' as never)}><View style={styles.workspaceIcon}><AppIcon name="settings" color={COLORS.purple} size={19} /></View><Text style={styles.workspaceTitle}>Admin</Text><Text style={styles.chevron}>›</Text></Pressable> : null}
        </View>
      </> : null}

      {workspaceError ? <Text style={styles.workspaceError}>{workspaceError}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

function ToolRow({ tool, pinned, first, recent, onOpen, onPin }: { tool: ToolItem; pinned: boolean; first: boolean; recent?: boolean; onOpen: () => void; onPin: () => void }) {
  return <View style={[styles.toolRow, !first && styles.divider]}>
    <Pressable style={styles.toolOpen} onPress={onOpen}>
      <View style={[styles.toolIcon, { backgroundColor: `${tool.accent}20` }]}><AppIcon name={tool.icon} color={tool.accent} size={18} /></View>
      <View style={styles.flex}><View style={styles.toolTitleRow}><Text style={styles.toolTitle}>{tool.title}</Text>{recent ? <Text style={styles.recentPill}>RECENT</Text> : null}</View><Text style={styles.toolText}>{tool.text}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
    <Pressable accessibilityLabel={pinned ? `Unpin ${tool.title}` : `Pin ${tool.title}`} style={styles.pinButton} onPress={onPin}><Text style={[styles.pinText, pinned && styles.pinTextActive]}>{pinned ? '★' : '☆'}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 96, maxWidth: 760, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 30, fontWeight: '900', marginTop: 2 },
  subtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 430 },
  sectionLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 },
  organizationCard: { borderRadius: 17, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: '#3C493F', overflow: 'hidden' },
  organizationActiveRow: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#1B2A20' },
  organizationMark: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#2A2518', borderWidth: 1.5, borderColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  organizationMarkText: { color: COLORS.cream, fontSize: 16, fontWeight: '900' },
  organizationTitle: { color: COLORS.cream, fontSize: 14, fontWeight: '900' },
  organizationMeta: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 3 },
  dropdownArrow: { color: COLORS.gold, fontSize: 21, fontWeight: '900', width: 28, textAlign: 'center' },
  organizationDropdown: { borderTopWidth: 1, borderTopColor: COLORS.line },
  organizationOption: { minHeight: 62, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  organizationMarkSmall: { width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  organizationMarkSmallText: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  optionTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  publicGrid: { flexDirection: 'row', gap: 9 },
  publicTile: { flex: 1, minHeight: 112, borderRadius: 16, borderWidth: 1, borderColor: '#5B5030', backgroundColor: '#171711', padding: 12 },
  publicIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#2A2518', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  publicTitle: { color: '#E8D6A2', fontSize: 11, fontWeight: '900' },
  publicText: { color: '#85806D', fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  quickRow: { gap: 8, paddingRight: 4 },
  quickAction: { minWidth: 92, minHeight: 70, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, paddingHorizontal: 11, alignItems: 'flex-start', justifyContent: 'center', gap: 5 },
  quickIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#2A2518', alignItems: 'center', justifyContent: 'center' },
  quickText: { color: COLORS.cream, fontSize: 9.5, fontWeight: '900' },
  searchShell: { minHeight: 48, marginTop: 21, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#111914', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: COLORS.cream, fontSize: 11, paddingVertical: 10, outlineStyle: 'none' } as never,
  clearSearch: { color: COLORS.muted, fontSize: 22, lineHeight: 24, paddingHorizontal: 4 },
  searchResults: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden' },
  resultLabel: { color: COLORS.dim, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 3 },
  shortcutCard: { borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden' },
  categoryList: { gap: 8 },
  categoryCard: { borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden' },
  categoryHeader: { minHeight: 76, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  categoryIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  categoryTitle: { color: COLORS.cream, fontSize: 13.5, fontWeight: '900' },
  categoryText: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  categoryArrow: { color: COLORS.muted, fontSize: 19, fontWeight: '900', width: 26, textAlign: 'center' },
  categoryTools: { borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: '#111814' },
  toolRow: { minHeight: 62, flexDirection: 'row', alignItems: 'stretch' },
  toolOpen: { flex: 1, minHeight: 62, paddingVertical: 9, paddingLeft: 11, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 9 },
  toolIcon: { width: 35, height: 35, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toolTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  toolTitle: { color: '#EAF0EC', fontSize: 10.5, fontWeight: '900' },
  toolText: { color: COLORS.dim, fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  recentPill: { color: COLORS.gold, fontSize: 6.5, fontWeight: '900', letterSpacing: 0.6, borderWidth: 1, borderColor: '#5E512F', borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  pinButton: { width: 42, alignItems: 'center', justifyContent: 'center' },
  pinText: { color: COLORS.dim, fontSize: 20 },
  pinTextActive: { color: COLORS.gold },
  setupNotice: { minHeight: 66, marginTop: 14, borderRadius: 15, borderWidth: 1, borderColor: '#66572D', backgroundColor: '#1D1B11', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  setupIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#2A2518', alignItems: 'center', justifyContent: 'center' },
  setupNoticeTitle: { color: '#E8D6A2', fontSize: 11, fontWeight: '900' },
  setupNoticeText: { color: '#85806D', fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  allToolsButton: { minHeight: 48, marginTop: 11, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allToolsText: { color: COLORS.muted, fontSize: 10, fontWeight: '900' },
  allToolsCard: { marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden' },
  workspaceCard: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  workspaceRow: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  workspaceIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.raised, alignItems: 'center', justifyContent: 'center' },
  workspaceTitle: { flex: 1, color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  workspaceError: { color: COLORS.danger, fontSize: 9, lineHeight: 14, marginTop: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  chevron: { color: COLORS.muted, fontSize: 22 },
});
