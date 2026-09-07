import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  controlOverwatchEntity,
  getOverwatchEntityDetail,
  getOverwatchSnapshot,
  searchOverwatch,
  type OverwatchEntityType,
  type OverwatchRecord,
  type OverwatchSearchResult,
  type OverwatchSection,
  type OverwatchSnapshot,
} from '../../src/overwatch/api';

type NavItem = { key: OverwatchSection; label: string; countKey?: keyof OverwatchSnapshot['counts'] };
type ActionSpec = { key: string; label: string; destructive?: boolean; requiresReason?: boolean };

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'members', label: 'Members', countKey: 'members' },
  { key: 'memberships', label: 'Memberships', countKey: 'active_memberships' },
  { key: 'hosts', label: 'Hosts', countKey: 'hosts' },
  { key: 'vendors', label: 'Vendors', countKey: 'vendors' },
  { key: 'groups', label: 'Groups', countKey: 'groups' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'approvals', label: 'Approvals', countKey: 'pending_approvals' },
  { key: 'reports', label: 'Reports', countKey: 'open_reports' },
  { key: 'audit', label: 'Audit Log' },
];

function text(value: unknown, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ') || fallback;
  return String(value);
}

function formatDate(value: unknown, includeTime = false) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return includeTime
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function entityTypeFor(section: OverwatchSection, item: OverwatchRecord): OverwatchEntityType | null {
  if (section === 'members' || section === 'memberships') return 'member';
  if (section === 'hosts') return 'host';
  if (section === 'vendors') return (item.entity_type as OverwatchEntityType | undefined) ?? 'vendor';
  if (section === 'groups') return 'group';
  if (section === 'events') return (item.entity_type as OverwatchEntityType | undefined) ?? 'adventure';
  if (section === 'reports') return 'report';
  return null;
}

function recordTitle(section: OverwatchSection, row: OverwatchRecord) {
  const item = row as Record<string, unknown>;
  if (section === 'members' || section === 'memberships') return text(item.display_name, text(item.username, text(item.email, 'Member')));
  if (section === 'hosts') return text(item.display_name, text(item.username, 'Host'));
  if (section === 'vendors') return text(item.business_name, text(item.member_name, 'Vendor'));
  if (section === 'groups') return text(item.name, 'Group');
  if (section === 'events') return text(item.title, 'Event');
  if (section === 'reports') return `Report · ${text(item.reason, 'Community report')}`;
  if (section === 'audit') return text(item.action, 'Administrative action');
  return 'Record';
}

function recordSubtitle(section: OverwatchSection, row: OverwatchRecord) {
  const item = row as Record<string, unknown>;
  if (section === 'members') return [item.email, [item.home_city, item.home_state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Member record';
  if (section === 'memberships') return `${text(item.membership_name, 'Free')} · ${text(item.membership_status, 'none')}`;
  if (section === 'hosts') return [item.host_type, item.email, `${text(item.event_count, '0')} events`].filter(Boolean).join(' · ');
  if (section === 'vendors') return [item.category, item.service_area, item.member_email].filter(Boolean).join(' · ') || 'Vendor record';
  if (section === 'groups') return [item.kind, [item.city, item.state].filter(Boolean).join(', '), `${text(item.member_count, '0')} members`].filter(Boolean).join(' · ');
  if (section === 'events') return [item.source === 'local_event' ? 'Local event' : 'Event', [item.city, item.state].filter(Boolean).join(', '), item.host_name].filter(Boolean).join(' · ');
  if (section === 'reports') return [item.reported_author_name ? `Reported: ${item.reported_author_name}` : null, item.priority].filter(Boolean).join(' · ') || 'Community report';
  if (section === 'audit') return [item.actor_name, item.entity_type, item.reason].filter(Boolean).join(' · ');
  return '';
}

function recordStatus(section: OverwatchSection, row: OverwatchRecord) {
  const item = row as Record<string, unknown>;
  if (section === 'groups') return text(item.visibility, 'unknown');
  if (section === 'memberships') return text(item.membership_status, 'none');
  if (section === 'audit') return text(item.entity_type, 'audit');
  return text(item.status, 'unknown');
}

function actionsFor(entityType: string, statusValue: string, visibility?: string): ActionSpec[] {
  if (entityType === 'member') {
    if (statusValue === 'active') return [{ key: 'restrict', label: 'Restrict', destructive: true, requiresReason: true }, { key: 'suspend', label: 'Suspend', destructive: true, requiresReason: true }];
    if (statusValue === 'restricted') return [{ key: 'activate', label: 'Restore Active' }, { key: 'suspend', label: 'Suspend', destructive: true, requiresReason: true }];
    if (statusValue === 'suspended') return [{ key: 'activate', label: 'Restore Active' }];
    return [{ key: 'activate', label: 'Activate' }];
  }
  if (entityType === 'host') {
    if (statusValue === 'approved') return [{ key: 'pause', label: 'Pause Host', destructive: true, requiresReason: true }, { key: 'revoke', label: 'Revoke Host', destructive: true, requiresReason: true }];
    if (statusValue === 'paused') return [{ key: 'approve', label: 'Restore Host' }, { key: 'revoke', label: 'Revoke Host', destructive: true, requiresReason: true }];
    if (statusValue === 'revoked') return [{ key: 'approve', label: 'Restore Host' }];
    return [{ key: 'approve', label: 'Approve Host' }, { key: 'pause', label: 'Pause', destructive: true, requiresReason: true }, { key: 'revoke', label: 'Revoke', destructive: true, requiresReason: true }];
  }
  if (entityType === 'vendor') {
    if (statusValue === 'approved') return [{ key: 'pause', label: 'Pause Vendor', destructive: true, requiresReason: true }, { key: 'revoke', label: 'Revoke Vendor', destructive: true, requiresReason: true }];
    if (statusValue === 'paused') return [{ key: 'approve', label: 'Restore Vendor' }, { key: 'revoke', label: 'Revoke Vendor', destructive: true, requiresReason: true }];
    if (statusValue === 'revoked') return [{ key: 'approve', label: 'Restore Vendor' }];
    if (statusValue === 'declined') return [{ key: 'approve', label: 'Approve Vendor' }];
    return [
      { key: 'approve', label: 'Approve Vendor' },
      { key: 'needs_info', label: 'Needs Info', requiresReason: true },
      { key: 'decline', label: 'Decline', destructive: true, requiresReason: true },
    ];
  }
  if (entityType === 'group') {
    return visibility === 'public'
      ? [{ key: 'make_members', label: 'Make Members Only' }]
      : [{ key: 'make_public', label: 'Make Public' }];
  }
  if (entityType === 'adventure' || entityType === 'local_event') {
    if (statusValue === 'published' || statusValue === 'sold_out') return [{ key: 'unpublish', label: 'Unpublish', destructive: true, requiresReason: true }, { key: 'cancel', label: 'Cancel Event', destructive: true, requiresReason: true }];
    if (statusValue === 'cancelled') return [{ key: 'publish', label: 'Republish' }];
    if (statusValue === 'completed') return [];
    return [{ key: 'publish', label: 'Publish' }, { key: 'cancel', label: 'Cancel Event', destructive: true, requiresReason: true }];
  }
  return [];
}

export default function OverwatchScreen() {
  const { width } = useWindowDimensions();
  const desktop = width >= 980;
  const [section, setSection] = useState<OverwatchSection>('overview');
  const [snapshot, setSnapshot] = useState<OverwatchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OverwatchSearchResult[]>([]);
  const [selected, setSelected] = useState<OverwatchRecord | null>(null);
  const [selectedType, setSelectedType] = useState<OverwatchEntityType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const next = await getOverwatchSnapshot();
      setSnapshot(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Overwatch.');
    } finally {
      if (refresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchOverwatch(trimmed)
        .then((results) => { if (active) setSearchResults(results); })
        .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Search failed.'); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const approvals = useMemo(() => {
    if (!snapshot) return [] as { type: OverwatchEntityType; row: OverwatchRecord }[];
    const hosts = snapshot.hosts.filter((item) => text(item.status, '') === 'pending').map((row) => ({ type: 'host' as const, row }));
    const vendors = snapshot.vendors.filter((item) => ['pending', 'needs_info'].includes(text(item.status, '')) && item.entity_type !== 'vendor_profile').map((row) => ({ type: 'vendor' as const, row }));
    return [...hosts, ...vendors].sort((a, b) => new Date(text(b.row.created_at, '0')).getTime() - new Date(text(a.row.created_at, '0')).getTime());
  }, [snapshot]);

  const openDetail = useCallback(async (entityType: OverwatchEntityType, id: string) => {
    setDetailLoading(true);
    setError('');
    try {
      const detail = await getOverwatchEntityDetail(entityType, id);
      setSelected(detail);
      setSelectedType(entityType);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load record details.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function chooseSection(next: OverwatchSection) {
    setSection(next);
    setQuery('');
    setSearchResults([]);
    setSelected(null);
    setSelectedType(null);
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading Overwatch…</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.shell}>
      {desktop ? <DesktopRail section={section} snapshot={snapshot} onSelect={chooseSection} /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, desktop && styles.desktopContent]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#D7B45A" />}
        keyboardShouldPersistTaps="handled"
      >
        <Header desktop={desktop} section={section} query={query} onQueryChange={setQuery} />
        {!desktop ? <MobileNav section={section} snapshot={snapshot} onSelect={chooseSection} /> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {query.trim().length >= 2
          ? <SearchPanel searching={searching} results={searchResults} onOpen={openDetail} />
          : section === 'overview'
            ? <Overview snapshot={snapshot} onOpen={openDetail} onNavigate={chooseSection} />
            : section === 'approvals'
              ? <Approvals rows={approvals} onOpen={openDetail} />
              : section === 'audit'
                ? <Audit rows={snapshot?.audit ?? []} />
                : <Directory section={section} snapshot={snapshot} onOpen={openDetail} />}

        {detailLoading ? <View style={styles.detailLoading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading record…</Text></View> : null}
        {selected && selectedType ? <DetailPanel entityType={selectedType} record={selected} onClose={() => { setSelected(null); setSelectedType(null); }} onChanged={async () => { await load(true); await openDetail(selectedType, selected.id); }} /> : null}
      </ScrollView>
    </View>
  </SafeAreaView>;
}

function Header({ desktop, section, query, onQueryChange }: { desktop: boolean; section: OverwatchSection; query: string; onQueryChange: (value: string) => void }) {
  return <View style={styles.header}>
    <View style={styles.headerTop}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>FOUNDER OVERWATCH</Text>
        <Text style={styles.title}>{section === 'overview' ? 'Platform Control' : NAV_ITEMS.find((item) => item.key === section)?.label ?? 'Overwatch'}</Text>
        <Text style={styles.subtitle}>See the platform, inspect relationships, govern access, and audit administrative changes.</Text>
      </View>
      <View style={styles.workspaceLinks}>
        <Pressable style={styles.workspaceButton} onPress={() => router.push('/admin' as never)}><Text style={styles.workspaceText}>Admin</Text></Pressable>
        <Pressable style={styles.workspaceButton} onPress={() => router.push('/(tabs)' as never)}><Text style={styles.workspaceText}>Member</Text></Pressable>
        <Pressable style={styles.workspaceButton} onPress={() => router.push('/host' as never)}><Text style={styles.workspaceText}>Host</Text></Pressable>
        <Pressable style={styles.workspaceButton} onPress={() => router.push('/vendor' as never)}><Text style={styles.workspaceText}>Vendor</Text></Pressable>
      </View>
    </View>
    <View style={[styles.searchWrap, desktop && styles.searchWrapDesktop]}>
      <Text style={styles.searchGlyph}>⌕</Text>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search people, hosts, vendors, groups, events, email, city…"
        placeholderTextColor="#6E7B73"
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {query ? <Pressable onPress={() => onQueryChange('')} style={styles.clearSearch}><Text style={styles.clearSearchText}>Clear</Text></Pressable> : null}
    </View>
  </View>;
}

function DesktopRail({ section, snapshot, onSelect }: { section: OverwatchSection; snapshot: OverwatchSnapshot | null; onSelect: (section: OverwatchSection) => void }) {
  return <View style={styles.rail}>
    <View style={styles.railBrand}><View style={styles.railMark}><Text style={styles.railMarkText}>O</Text></View><View><Text style={styles.railEyebrow}>GO MELANATED</Text><Text style={styles.railTitle}>Overwatch</Text></View></View>
    <Text style={styles.railSectionLabel}>PLATFORM</Text>
    <View style={styles.railNav}>{NAV_ITEMS.map((item) => {
      const count = item.countKey && snapshot ? snapshot.counts[item.countKey] : null;
      const active = item.key === section;
      return <Pressable key={item.key} style={[styles.railRow, active && styles.railRowActive]} onPress={() => onSelect(item.key)}>
        <Text style={[styles.railRowText, active && styles.railRowTextActive]}>{item.label}</Text>
        {count !== null ? <View style={[styles.countPill, active && styles.countPillActive]}><Text style={[styles.countPillText, active && styles.countPillTextActive]}>{count}</Text></View> : null}
      </Pressable>;
    })}</View>
    <View style={styles.railFooter}><Text style={styles.railFooterTitle}>Founder-only workspace</Text><Text style={styles.railFooterText}>Overwatch access is evaluated separately from standard admin access.</Text></View>
  </View>;
}

function MobileNav({ section, snapshot, onSelect }: { section: OverwatchSection; snapshot: OverwatchSnapshot | null; onSelect: (section: OverwatchSection) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNav}>
    {NAV_ITEMS.map((item) => {
      const active = item.key === section;
      const count = item.countKey && snapshot ? snapshot.counts[item.countKey] : null;
      return <Pressable key={item.key} style={[styles.mobileNavChip, active && styles.mobileNavChipActive]} onPress={() => onSelect(item.key)}><Text style={[styles.mobileNavText, active && styles.mobileNavTextActive]}>{item.label}{count !== null ? ` ${count}` : ''}</Text></Pressable>;
    })}
  </ScrollView>;
}

function Overview({ snapshot, onOpen, onNavigate }: { snapshot: OverwatchSnapshot | null; onOpen: (type: OverwatchEntityType, id: string) => void; onNavigate: (section: OverwatchSection) => void }) {
  if (!snapshot) return <EmptyState title="No Overwatch data" body="The snapshot did not return platform records." />;
  const metrics = [
    { label: 'Members', value: snapshot.counts.members, meta: `${snapshot.counts.active_members} active`, section: 'members' as const },
    { label: 'Hosts', value: snapshot.counts.hosts, meta: `${snapshot.counts.approved_hosts} approved`, section: 'hosts' as const },
    { label: 'Vendors', value: snapshot.counts.vendors, meta: `${snapshot.counts.approved_vendors} approved`, section: 'vendors' as const },
    { label: 'Groups', value: snapshot.counts.groups, meta: 'Platform communities', section: 'groups' as const },
    { label: 'Events', value: snapshot.counts.events, meta: 'Listed records', section: 'events' as const },
    { label: 'Needs Review', value: snapshot.counts.pending_approvals + snapshot.counts.open_reports, meta: `${snapshot.counts.pending_approvals} approvals · ${snapshot.counts.open_reports} reports`, section: 'approvals' as const },
  ];
  return <View style={styles.sectionStack}>
    <View>
      <Text style={styles.sectionEyebrow}>PLATFORM REGISTRY</Text>
      <View style={styles.metricGrid}>{metrics.map((metric) => <Pressable key={metric.label} style={styles.metricCard} onPress={() => onNavigate(metric.section)}><Text style={styles.metricLabel}>{metric.label}</Text><Text style={styles.metricValue}>{metric.value}</Text><Text style={styles.metricMeta}>{metric.meta}</Text></Pressable>)}</View>
    </View>
    <View style={styles.panel}>
      <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Recent platform activity</Text><Text style={styles.panelSubtitle}>Who and what has entered or changed on Go Melanated.</Text></View></View>
      {snapshot.recent_activity.length ? snapshot.recent_activity.slice(0, 30).map((item) => <Pressable key={`${item.entity_type}-${item.id}-${item.created_at}`} style={styles.activityRow} onPress={() => void onOpen(item.entity_type, item.id)}><View style={styles.activityMark}><Text style={styles.activityMarkText}>{item.entity_type.slice(0, 1).toUpperCase()}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowSubtitle}>{item.subtitle} · {formatDate(item.created_at, true)}</Text></View><StatusPill value={item.status ?? 'new'} /></Pressable>) : <Text style={styles.emptyText}>No platform activity yet.</Text>}
    </View>
    <View style={styles.panel}>
      <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Founder controls</Text><Text style={styles.panelSubtitle}>High-level governance stays here. Operational work stays in each workspace.</Text></View></View>
      <View style={styles.shortcutGrid}>
        <Shortcut label="Review Applications" value={snapshot.counts.pending_approvals} onPress={() => onNavigate('approvals')} />
        <Shortcut label="Open Reports" value={snapshot.counts.open_reports} onPress={() => onNavigate('reports')} />
        <Shortcut label="Membership Registry" value={snapshot.counts.active_memberships} onPress={() => onNavigate('memberships')} />
        <Shortcut label="Administrative Audit" value={snapshot.audit.length} onPress={() => onNavigate('audit')} />
      </View>
    </View>
  </View>;
}

function Shortcut({ label, value, onPress }: { label: string; value: number; onPress: () => void }) {
  return <Pressable style={styles.shortcut} onPress={onPress}><Text style={styles.shortcutValue}>{value}</Text><Text style={styles.shortcutLabel}>{label}</Text><Text style={styles.shortcutArrow}>›</Text></Pressable>;
}

function SearchPanel({ searching, results, onOpen }: { searching: boolean; results: OverwatchSearchResult[]; onOpen: (type: OverwatchEntityType, id: string) => void }) {
  return <View style={styles.panel}>
    <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Search results</Text><Text style={styles.panelSubtitle}>Search crosses members, hosts, vendors, groups and events.</Text></View>{searching ? <ActivityIndicator size="small" color="#D7B45A" /> : <Text style={styles.panelCount}>{results.length}</Text>}</View>
    {!searching && results.length === 0 ? <EmptyState title="No matching records" body="Try a name, email, business, group, event, city, or category." compact /> : results.map((item) => <Pressable key={`${item.entity_type}-${item.id}`} style={styles.activityRow} onPress={() => void onOpen(item.entity_type, item.id)}><View style={styles.activityMark}><Text style={styles.activityMarkText}>{item.entity_type.slice(0, 1).toUpperCase()}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowSubtitle}>{item.subtitle || item.entity_type} · {formatDate(item.created_at)}</Text></View><StatusPill value={item.status ?? item.entity_type} /></Pressable>)}
  </View>;
}

function Directory({ section, snapshot, onOpen }: { section: OverwatchSection; snapshot: OverwatchSnapshot | null; onOpen: (type: OverwatchEntityType, id: string) => void }) {
  if (!snapshot) return null;
  let rows: OverwatchRecord[] = [];
  if (section === 'members' || section === 'memberships') rows = snapshot.members;
  if (section === 'hosts') rows = snapshot.hosts;
  if (section === 'vendors') rows = snapshot.vendors;
  if (section === 'groups') rows = snapshot.groups;
  if (section === 'events') rows = snapshot.events;
  if (section === 'reports') rows = snapshot.reports;

  return <View style={styles.panel}>
    <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>{NAV_ITEMS.find((item) => item.key === section)?.label}</Text><Text style={styles.panelSubtitle}>{sectionDescription(section)}</Text></View><Text style={styles.panelCount}>{rows.length}</Text></View>
    {section === 'reports' ? <Pressable style={styles.linkButton} onPress={() => router.push('/admin/community-safety' as never)}><Text style={styles.linkButtonText}>Open Community Safety</Text></Pressable> : null}
    {rows.length === 0 ? <EmptyState title="No records" body="Nothing has been added to this registry yet." compact /> : rows.map((row) => {
      const type = entityTypeFor(section, row);
      return <Pressable key={`${type ?? section}-${row.id}`} style={styles.directoryRow} disabled={!type} onPress={() => { if (type) void onOpen(type, row.id); }}>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>{recordTitle(section, row)}</Text><Text style={styles.rowSubtitle}>{recordSubtitle(section, row)}</Text><Text style={styles.rowMeta}>Added {formatDate(row.created_at)}</Text></View><StatusPill value={recordStatus(section, row)} />
      </Pressable>;
    })}
  </View>;
}

function Approvals({ rows, onOpen }: { rows: { type: OverwatchEntityType; row: OverwatchRecord }[]; onOpen: (type: OverwatchEntityType, id: string) => void }) {
  return <View style={styles.panel}>
    <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Approvals</Text><Text style={styles.panelSubtitle}>Host and vendor access waiting for a human decision.</Text></View><Text style={styles.panelCount}>{rows.length}</Text></View>
    {rows.length === 0 ? <EmptyState title="Nothing waiting" body="There are no host or vendor applications requiring review." compact /> : rows.map(({ type, row }) => <Pressable key={`${type}-${row.id}`} style={styles.directoryRow} onPress={() => void onOpen(type, row.id)}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{type === 'host' ? text(row.display_name, text(row.username, 'Host applicant')) : text(row.business_name, 'Vendor applicant')}</Text><Text style={styles.rowSubtitle}>{type === 'host' ? [row.email, row.host_type].filter(Boolean).join(' · ') : [row.category, row.service_area, row.member_email].filter(Boolean).join(' · ')}</Text><Text style={styles.rowMeta}>Submitted {formatDate(row.created_at)}</Text></View><StatusPill value={text(row.status, 'pending')} /></Pressable>)}
  </View>;
}

function Audit({ rows }: { rows: OverwatchRecord[] }) {
  return <View style={styles.panel}>
    <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Administrative audit</Text><Text style={styles.panelSubtitle}>Every Overwatch control action is recorded with actor, reason, before state and after state.</Text></View><Text style={styles.panelCount}>{rows.length}</Text></View>
    {rows.length === 0 ? <EmptyState title="No Overwatch actions yet" body="The audit trail starts when the first control action is taken." compact /> : rows.map((row) => <View key={row.id} style={styles.auditRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{text(row.action, 'Action')} · {text(row.entity_type, 'record')}</Text><Text style={styles.rowSubtitle}>{text(row.actor_name, 'Founder')} · {formatDate(row.created_at, true)}</Text>{row.reason ? <Text style={styles.auditReason}>Reason: {text(row.reason)}</Text> : null}<Text style={styles.rowMeta}>Before {JSON.stringify(row.previous_data ?? {})} → After {JSON.stringify(row.new_data ?? {})}</Text></View></View>)}
  </View>;
}

function DetailPanel({ entityType, record, onClose, onChanged }: { entityType: OverwatchEntityType; record: OverwatchRecord; onClose: () => void; onChanged: () => Promise<void> }) {
  const item = record as Record<string, unknown>;
  const statusValue = text(item.status, entityType === 'group' ? text(item.visibility, '') : '');
  const actions = actionsFor(entityType, statusValue, text(item.visibility, ''));
  const [reason, setReason] = useState('');
  const [pendingAction, setPendingAction] = useState<ActionSpec | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setReason('');
    setPendingAction(null);
    setActionError('');
  }, [entityType, record.id]);

  async function confirmAction() {
    if (!pendingAction || working) return;
    if (pendingAction.requiresReason && reason.trim().length === 0) {
      setActionError('Enter an administrative reason before confirming this action.');
      return;
    }
    setWorking(true);
    setActionError('');
    try {
      await controlOverwatchEntity({ entityType, entityId: record.id, action: pendingAction.key, reason });
      setPendingAction(null);
      setReason('');
      await onChanged();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Unable to apply Overwatch action.');
    } finally {
      setWorking(false);
    }
  }

  const fields = detailFields(entityType, item);
  return <View style={styles.detailPanel}>
    <View style={styles.detailHeader}><View style={styles.rowCopy}><Text style={styles.sectionEyebrow}>RECORD DETAIL · {entityType.replace('_', ' ').toUpperCase()}</Text><Text style={styles.detailTitle}>{detailTitle(entityType, item)}</Text><Text style={styles.detailId}>{record.id}</Text></View><Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>Close</Text></Pressable></View>
    <View style={styles.detailGrid}>{fields.map((field) => <View key={field.label} style={styles.detailField}><Text style={styles.detailLabel}>{field.label}</Text><Text style={styles.detailValue}>{field.value}</Text></View>)}</View>
    {entityType === 'report' ? <Pressable style={styles.linkButton} onPress={() => router.push('/admin/community-safety' as never)}><Text style={styles.linkButtonText}>Open Full Safety Casework</Text></Pressable> : null}
    {entityType === 'vendor' ? <Pressable style={styles.linkButton} onPress={() => router.push('/admin/vendor-access' as never)}><Text style={styles.linkButtonText}>Open Vendor Access Queue</Text></Pressable> : null}
    {entityType === 'group' ? <Pressable style={styles.linkButton} onPress={() => router.push(`/groups/${record.id}` as never)}><Text style={styles.linkButtonText}>Open Group</Text></Pressable> : null}
    {entityType === 'adventure' ? <Pressable style={styles.linkButton} onPress={() => router.push(`/adventures/${record.id}` as never)}><Text style={styles.linkButtonText}>Open Event Listing</Text></Pressable> : null}
    {entityType === 'local_event' ? <Pressable style={styles.linkButton} onPress={() => router.push(`/local-events/${record.id}` as never)}><Text style={styles.linkButtonText}>Open Local Event</Text></Pressable> : null}

    {actions.length ? <View style={styles.controlBox}><Text style={styles.controlTitle}>FOUNDER CONTROLS</Text><Text style={styles.controlCopy}>Actions change platform state. Restrictive actions require a reason and are written to the audit log.</Text><TextInput value={reason} onChangeText={setReason} placeholder="Administrative reason" placeholderTextColor="#6E7B73" style={styles.reasonInput} multiline />
      <View style={styles.actionRow}>{actions.map((action) => <Pressable key={action.key} disabled={working} style={[styles.actionButton, action.destructive && styles.actionButtonDanger]} onPress={() => { setPendingAction(action); setActionError(''); }}><Text style={[styles.actionButtonText, action.destructive && styles.actionButtonDangerText]}>{action.label}</Text></Pressable>)}</View>
      {pendingAction ? <View style={styles.confirmBox}><Text style={styles.confirmTitle}>Confirm {pendingAction.label}</Text><Text style={styles.confirmCopy}>{pendingAction.requiresReason ? 'This action requires an administrative reason.' : 'This change will be recorded in the Overwatch audit log.'}</Text><View style={styles.confirmActions}><Pressable style={styles.cancelButton} disabled={working} onPress={() => setPendingAction(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable style={styles.confirmButton} disabled={working} onPress={() => void confirmAction()}>{working ? <ActivityIndicator size="small" color="#172017" /> : <Text style={styles.confirmText}>Confirm</Text>}</Pressable></View></View> : null}
      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
    </View> : null}
  </View>;
}

function detailTitle(entityType: string, item: Record<string, unknown>) {
  if (entityType === 'member' || entityType === 'host') return text(item.display_name, text(item.username, text(item.email, 'Member')));
  if (entityType === 'vendor' || entityType === 'vendor_profile') return text(item.business_name, 'Vendor');
  if (entityType === 'group') return text(item.name, 'Group');
  if (entityType === 'adventure' || entityType === 'local_event') return text(item.title, 'Event');
  if (entityType === 'report') return `Report · ${text(item.reason, 'Community report')}`;
  return 'Platform record';
}

function detailFields(entityType: OverwatchEntityType, item: Record<string, unknown>) {
  const location = [item.home_city ?? item.city, item.home_state ?? item.state].filter(Boolean).join(', ');
  const common = [{ label: 'Status', value: text(item.status, entityType === 'group' ? text(item.visibility) : '—') }, { label: 'Created', value: formatDate(item.created_at, true) }];
  if (entityType === 'member') return [
    { label: 'Email', value: text(item.email) }, { label: 'Username', value: text(item.username) }, { label: 'Location', value: location || '—' },
    { label: 'Member status', value: text(item.status) }, { label: 'Platform role', value: text(item.platform_role, 'member') }, { label: 'Host access', value: text(item.host_status, 'none') },
    { label: 'Vendor access', value: text(item.vendor_status, 'none') }, { label: 'Membership', value: `${text(item.membership_name, 'Free')} · ${text(item.membership_status, 'none')}` },
    { label: 'Groups', value: text(item.group_count, '0') }, { label: 'Events listed', value: text(item.event_count, '0') }, { label: 'Reports received', value: text(item.report_count, '0') },
    { label: 'Onboarding complete', value: item.onboarding_completed_at ? formatDate(item.onboarding_completed_at, true) : 'No' }, ...common,
  ];
  if (entityType === 'host') return [
    { label: 'Email', value: text(item.email) }, { label: 'Location', value: location || '—' }, { label: 'Host type', value: text(item.host_type) }, { label: 'Risk tier', value: text(item.risk_tier) },
    { label: 'Paid outings', value: text(item.can_create_paid_outings) }, { label: 'Payout status', value: text(item.payout_status) }, { label: 'Groups managed', value: text(item.group_count, '0') },
    { label: 'Events listed', value: text(item.event_count, '0') }, { label: 'Reports received', value: text(item.report_count, '0') }, { label: 'Application note', value: text(item.application_note) }, ...common,
  ];
  if (entityType === 'vendor' || entityType === 'vendor_profile') return [
    { label: 'Business', value: text(item.business_name) }, { label: 'Category', value: text(item.category) }, { label: 'Service area', value: text(item.service_area) },
    { label: 'Owner / contact', value: text(item.member_name ?? item.contact_name) }, { label: 'Email', value: text(item.member_email ?? item.email) }, { label: 'Phone', value: text(item.phone) },
    { label: 'Website', value: text(item.website) }, { label: 'Verification', value: text(item.verification_status) }, { label: 'Marketplace visible', value: text(item.marketplace_visible) },
    { label: 'Featured', value: text(item.featured) }, { label: 'Application note', value: text(item.application_note ?? item.description) }, ...common,
  ];
  if (entityType === 'group') return [
    { label: 'Type', value: text(item.kind) }, { label: 'Location', value: location || '—' }, { label: 'Visibility', value: text(item.visibility) }, { label: 'Management', value: text(item.management_type) },
    { label: 'Owner', value: text(item.creator_name, text(item.creator_username)) }, { label: 'Owner email', value: text(item.creator_email) }, { label: 'Members', value: text(item.member_count, '0') },
    { label: 'Moderators / hosts', value: text(item.moderator_count, '0') }, { label: 'Events', value: text(item.event_count, '0') }, { label: 'Description', value: text(item.description) }, ...common,
  ];
  if (entityType === 'adventure' || entityType === 'local_event') return [
    { label: 'Category', value: text(item.category) }, { label: 'Starts', value: formatDate(item.starts_at, true) }, { label: 'Ends', value: formatDate(item.ends_at, true) }, { label: 'Location', value: location || '—' },
    { label: 'Venue', value: text(item.venue_name) }, { label: 'Visibility', value: text(item.visibility) }, { label: 'Host', value: text(item.host_name, text(item.host_username)) }, { label: 'Host email', value: text(item.host_email) },
    { label: 'Group', value: text(item.group_name, 'None') }, { label: 'Capacity', value: text(item.capacity) }, { label: 'Featured', value: text(item.is_featured) }, { label: 'Description', value: text(item.description ?? item.summary) }, ...common,
  ];
  if (entityType === 'report') return [
    { label: 'Priority', value: text(item.priority) }, { label: 'Reporter', value: text(item.reporter_name, text(item.reporter_username)) }, { label: 'Reported member', value: text(item.reported_author_name, text(item.reported_author_username)) },
    { label: 'Reason', value: text(item.reason) }, { label: 'Details', value: text(item.details) }, { label: 'Content snapshot', value: text(item.content_snapshot) }, { label: 'Action taken', value: text(item.action_taken) },
    { label: 'Resolution', value: text(item.resolution_note) }, { label: 'Reviewed', value: formatDate(item.reviewed_at, true) }, ...common,
  ];
  return common;
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const warning = ['pending', 'needs_info', 'reviewing', 'restricted', 'paused', 'members'].includes(normalized);
  const danger = ['suspended', 'revoked', 'declined', 'cancelled', 'open'].includes(normalized);
  const good = ['active', 'approved', 'published', 'public', 'completed'].includes(normalized);
  return <View style={[styles.statusPill, warning && styles.statusWarning, danger && styles.statusDanger, good && styles.statusGood]}><Text style={[styles.statusPillText, warning && styles.statusWarningText, danger && styles.statusDangerText, good && styles.statusGoodText]}>{value.replaceAll('_', ' ').toUpperCase()}</Text></View>;
}

function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return <View style={[styles.emptyState, compact && styles.emptyStateCompact]}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{body}</Text></View>;
}

function sectionDescription(section: OverwatchSection) {
  if (section === 'members') return 'Every member account with roles, membership, groups, event listings and report counts.';
  if (section === 'memberships') return 'Membership status across the member registry without entering the member experience.';
  if (section === 'hosts') return 'Host access, standing, role type and platform relationships.';
  if (section === 'vendors') return 'Vendor accounts and non-demo directory records in one registry.';
  if (section === 'groups') return 'Every community, its ownership, visibility, membership and listed events.';
  if (section === 'events') return 'General event records from official adventures and local event listings. Sales and planning stay out of Overwatch.';
  if (section === 'reports') return 'Platform reporting visibility with full casework linked to Community Safety.';
  return '';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B120E' },
  shell: { flex: 1, flexDirection: 'row' },
  scroll: { flex: 1 },
  content: { width: '100%', padding: 16, paddingBottom: 90 },
  desktopContent: { maxWidth: 1380, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#8F9C94', fontSize: 12 },
  rail: { width: 250, backgroundColor: '#101914', borderRightWidth: 1, borderRightColor: '#26342C', padding: 16, paddingTop: 22 },
  railBrand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 25 },
  railMark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7B45A' },
  railMarkText: { color: '#172017', fontSize: 17, fontWeight: '900' },
  railEyebrow: { color: '#7F8C84', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  railTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 1 },
  railSectionLabel: { color: '#66736B', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8 },
  railNav: { gap: 4 },
  railRow: { minHeight: 43, borderRadius: 11, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  railRowActive: { backgroundColor: '#252818', borderWidth: 1, borderColor: '#5C5127' },
  railRowText: { color: '#9CA8A0', fontSize: 12, fontWeight: '800' },
  railRowTextActive: { color: '#FFF5D7' },
  countPill: { minWidth: 26, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B251F' },
  countPillActive: { backgroundColor: '#D7B45A' },
  countPillText: { color: '#8D9A92', fontSize: 9, fontWeight: '900' },
  countPillTextActive: { color: '#172017' },
  railFooter: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#26342C', paddingTop: 14 },
  railFooterTitle: { color: '#C8D0CB', fontSize: 10, fontWeight: '900' },
  railFooterText: { color: '#69766E', fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  header: { marginBottom: 18 },
  headerTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  headerCopy: { flex: 1, minWidth: 250 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 },
  subtitle: { color: '#8F9C94', fontSize: 12, lineHeight: 18, maxWidth: 650, marginTop: 5 },
  workspaceLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  workspaceButton: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#35433B', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111A15' },
  workspaceText: { color: '#C5CEC8', fontSize: 9.5, fontWeight: '900' },
  searchWrap: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: '#34423A', backgroundColor: '#111A15', flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 13 },
  searchWrapDesktop: { maxWidth: 920 },
  searchGlyph: { color: '#D7B45A', fontSize: 21, marginRight: 8 },
  searchInput: { flex: 1, color: '#FFF8E8', fontSize: 14, minHeight: 48 },
  clearSearch: { minHeight: 38, paddingHorizontal: 8, justifyContent: 'center' },
  clearSearchText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  mobileNav: { gap: 7, paddingBottom: 16 },
  mobileNavChip: { minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: '#35433B', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101914' },
  mobileNavChipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  mobileNavText: { color: '#AAB4AE', fontSize: 10, fontWeight: '900' },
  mobileNavTextActive: { color: '#172017' },
  errorBox: { borderRadius: 12, borderWidth: 1, borderColor: '#70443E', backgroundColor: '#211815', padding: 11, marginBottom: 13 },
  errorText: { color: '#FFB1A7', fontSize: 10.5, lineHeight: 16 },
  sectionStack: { gap: 16 },
  sectionEyebrow: { color: '#7C8981', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.05, marginBottom: 8 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metricCard: { flexGrow: 1, flexBasis: 160, minWidth: 150, borderRadius: 16, borderWidth: 1, borderColor: '#2D3B33', backgroundColor: '#151F1A', padding: 14 },
  metricLabel: { color: '#8F9C94', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
  metricValue: { color: '#FFF8E8', fontSize: 29, fontWeight: '900', marginTop: 5 },
  metricMeta: { color: '#6F7D74', fontSize: 9.5, marginTop: 2 },
  panel: { borderRadius: 18, borderWidth: 1, borderColor: '#29372F', backgroundColor: '#121B16', overflow: 'hidden' },
  panelHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#29372F', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  panelTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  panelSubtitle: { color: '#7F8C84', fontSize: 10, lineHeight: 15, marginTop: 3, maxWidth: 720 },
  panelCount: { color: '#D7B45A', fontSize: 16, fontWeight: '900' },
  activityRow: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#26332C', flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#1F2B24', alignItems: 'center', justifyContent: 'center' },
  activityMarkText: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#F6F1E5', fontSize: 12, fontWeight: '900' },
  rowSubtitle: { color: '#849088', fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  rowMeta: { color: '#5F6C64', fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  statusPill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#18221C' },
  statusPillText: { color: '#99A59D', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.45 },
  statusWarning: { borderColor: '#645628', backgroundColor: '#272315' },
  statusWarningText: { color: '#D7B45A' },
  statusDanger: { borderColor: '#74443E', backgroundColor: '#281917' },
  statusDangerText: { color: '#FF9C91' },
  statusGood: { borderColor: '#365D42', backgroundColor: '#14261A' },
  statusGoodText: { color: '#93D69C' },
  shortcutGrid: { padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: { flexGrow: 1, flexBasis: 180, minWidth: 160, borderRadius: 13, borderWidth: 1, borderColor: '#2E3C34', backgroundColor: '#101814', padding: 12, position: 'relative' },
  shortcutValue: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  shortcutLabel: { color: '#8F9C94', fontSize: 9.5, fontWeight: '800', marginTop: 3 },
  shortcutArrow: { position: 'absolute', right: 11, top: 15, color: '#D7B45A', fontSize: 22 },
  directoryRow: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#26332C', flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkButton: { margin: 12, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#5B5029', backgroundColor: '#231F12', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  linkButtonText: { color: '#E0C46C', fontSize: 9.5, fontWeight: '900' },
  auditRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#26332C' },
  auditReason: { color: '#C3CBC6', fontSize: 9.5, lineHeight: 14, marginTop: 5 },
  emptyState: { padding: 34, alignItems: 'center' },
  emptyStateCompact: { paddingVertical: 25 },
  emptyTitle: { color: '#DADFD9', fontSize: 13, fontWeight: '900' },
  emptyText: { color: '#718078', fontSize: 10, lineHeight: 15, marginTop: 4, textAlign: 'center' },
  detailLoading: { marginTop: 14, padding: 15, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  detailPanel: { marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: '#5B5029', backgroundColor: '#171B13', padding: 15 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  detailTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 3 },
  detailId: { color: '#68756D', fontSize: 8.5, marginTop: 4 },
  closeButton: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#3D4A42', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#BAC4BE', fontSize: 9, fontWeight: '900' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  detailField: { flexGrow: 1, flexBasis: 200, minWidth: 160, borderRadius: 12, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111813', padding: 10 },
  detailLabel: { color: '#6E7B73', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  detailValue: { color: '#DCE2DD', fontSize: 10.5, lineHeight: 16, marginTop: 3 },
  controlBox: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#3A402B', paddingTop: 14 },
  controlTitle: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  controlCopy: { color: '#817F70', fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  reasonInput: { minHeight: 70, borderRadius: 11, borderWidth: 1, borderColor: '#39463E', backgroundColor: '#0F1612', color: '#FFF8E8', fontSize: 12, padding: 11, marginTop: 10, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  actionButton: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#5D542D', backgroundColor: '#262315', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { color: '#E2C76D', fontSize: 9, fontWeight: '900' },
  actionButtonDanger: { borderColor: '#68413C', backgroundColor: '#281917' },
  actionButtonDangerText: { color: '#FF9D92' },
  confirmBox: { marginTop: 11, borderRadius: 12, borderWidth: 1, borderColor: '#63572C', backgroundColor: '#231F13', padding: 11 },
  confirmTitle: { color: '#FFF1C5', fontSize: 11.5, fontWeight: '900' },
  confirmCopy: { color: '#9E9578', fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  confirmActions: { flexDirection: 'row', gap: 7, marginTop: 9 },
  cancelButton: { minHeight: 38, borderRadius: 9, borderWidth: 1, borderColor: '#4A504A', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#B9C1BC', fontSize: 9, fontWeight: '900' },
  confirmButton: { minHeight: 38, borderRadius: 9, backgroundColor: '#D7B45A', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#172017', fontSize: 9, fontWeight: '900' },
});
