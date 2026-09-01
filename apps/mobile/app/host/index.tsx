import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOutingHostAccess, listMyHostOutings, type HostOuting, type OutingHostRecord } from '../../src/hosting/api';
import {
  getCampaignDaysUntil,
  getCampaignReadiness,
  getCurrentCampaignProfileId,
  listHostCampaigns,
  type HostCampaign,
} from '../../src/hosting/campaigns';
import { getAssignedAdventures } from '../../src/operations/api';

type EventFilter = 'active' | 'drafts' | 'upcoming' | 'past';
type EventSource = 'campaign' | 'outing' | 'assignment';

type HostEventRow = {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: string;
  source: EventSource;
  route: string;
  readiness?: number;
  days?: number;
  attention?: number;
};

export default function HostOperationsScreen() {
  const [loading, setLoading] = useState(true);
  const [accessLoadFailed, setAccessLoadFailed] = useState(false);
  const [approved, setApproved] = useState(false);
  const [paidEnabled, setPaidEnabled] = useState(false);
  const [record, setRecord] = useState<OutingHostRecord | null>(null);
  const [outings, setOutings] = useState<HostOuting[]>([]);
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>('active');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setAccessLoadFailed(false);
    setError('');
    try {
      const [access, assigned, hostCampaigns, profileId] = await Promise.all([
        getOutingHostAccess(),
        getAssignedAdventures().catch(() => []),
        listHostCampaigns().catch(() => []),
        getCurrentCampaignProfileId().catch(() => null),
      ]);
      setApproved(access.approved);
      setPaidEnabled(access.paidEnabled);
      setRecord(access.record);
      setAssignments(assigned);
      setCampaigns(hostCampaigns);
      setCurrentProfileId(profileId);
      setOutings(access.approved ? await listMyHostOutings() : []);
      setLoadedAt(new Date().toISOString());
    } catch (caught) {
      setAccessLoadFailed(true);
      setApproved(false);
      setPaidEnabled(false);
      setRecord(null);
      setOutings([]);
      setCampaigns([]);
      setAssignments([]);
      setError(caught instanceof Error ? caught.message : 'Unable to load host access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeTasks = campaigns.flatMap((campaign) => campaign.tasks.filter((task) => task.status !== 'complete'));
  const attentionTasks = activeTasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical');
  const myTasks = activeTasks.filter((task) => Boolean(currentProfileId) && task.assigneeProfileId === currentProfileId);
  const blockedTasks = activeTasks.filter((task) => task.status === 'blocked');
  const unassignedTasks = activeTasks.filter((task) => !task.assigneeProfileId);

  const eventRows = useMemo(() => {
    const rows: HostEventRow[] = [];
    const campaignIds = new Set(campaigns.map((campaign) => campaign.adventureId));
    const outingById = new Map(outings.map((outing) => [outing.id, outing]));

    for (const campaign of campaigns) {
      const outing = outingById.get(campaign.adventureId);
      rows.push({
        id: campaign.adventureId,
        title: campaign.shortTitle,
        location: campaign.location,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
        status: outing?.status ?? campaign.status,
        source: 'campaign',
        route: `/host/campaigns/${campaign.slug}`,
        readiness: getCampaignReadiness(campaign),
        days: getCampaignDaysUntil(campaign),
        attention: campaign.tasks.filter((task) => task.status === 'blocked' || task.status === 'waiting' || task.priority === 'critical').length,
      });
    }

    for (const outing of outings) {
      if (campaignIds.has(outing.id)) continue;
      rows.push({
        id: outing.id,
        title: outing.title,
        location: `${outing.city}, ${outing.state}`,
        startsAt: outing.starts_at,
        endsAt: outing.ends_at,
        status: outing.status,
        source: 'outing',
        route: `/host/manage/${outing.id}`,
      });
    }

    const existingIds = new Set(rows.map((row) => row.id));
    for (const item of assignments) {
      if (existingIds.has(item.adventure_id)) continue;
      const adventure = item.adventures;
      rows.push({
        id: item.adventure_id,
        title: adventure?.title ?? 'Adventure',
        location: [adventure?.city, adventure?.state].filter(Boolean).join(', '),
        startsAt: adventure?.starts_at ?? '',
        endsAt: adventure?.ends_at ?? '',
        status: 'supporting',
        source: 'assignment',
        route: `/host/${item.adventure_id}`,
      });
    }

    return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [assignments, campaigns, outings]);

  const filteredEvents = useMemo(() => {
    const now = loadedAt ? new Date(loadedAt).getTime() : 0;
    return eventRows.filter((event) => {
      const start = event.startsAt ? new Date(event.startsAt).getTime() : 0;
      const end = event.endsAt ? new Date(event.endsAt).getTime() : 0;
      if (eventFilter === 'drafts') return event.status === 'draft' || event.status === 'scheduled' || event.status === 'planning';
      if (eventFilter === 'past') return event.status === 'completed' || event.status === 'cancelled' || (end > 0 && end < now);
      if (eventFilter === 'upcoming') return start > now && !['draft', 'scheduled', 'planning', 'completed', 'cancelled'].includes(event.status);
      return !['completed', 'cancelled'].includes(event.status) && (end === 0 || end >= now) && !['draft', 'scheduled'].includes(event.status);
    });
  }, [eventFilter, eventRows, loadedAt]);

  const statusCopy: Record<string, [string, string]> = {
    pending: ['Application in review', 'Your Host Pathway is complete. We’ll review your application before hosting tools unlock.'],
    needs_info: ['We need a little more information', 'Your application is still open. Go Melanated needs additional information before making a decision.'],
    paused: ['Hosting is paused', 'Your host access is temporarily paused while it is reviewed.'],
    declined: ['Application not approved', 'Your current application was not approved. Contact support if you need clarification or believe it should be reconsidered.'],
    revoked: ['Hosting access revoked', 'Your host access is no longer active. Contact support if you need clarification.'],
  };

  const firstCampaignSlug = campaigns[0]?.slug;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>HOST CENTER</Text>
        <Text style={styles.title}>Host Center</Text>
        <Text style={styles.subtitle}>Plan the adventure, manage the work, and run the event from one place.</Text>

        {loading ? <View style={styles.loadingCard}><ActivityIndicator color="#D7B45A" /><Text style={styles.loadingText}>Loading Host Center…</Text></View> : null}

        {!loading && accessLoadFailed ? (
          <View style={styles.errorCard}>
            <Text style={styles.cardEyebrow}>HOST TOOLS TEMPORARILY UNAVAILABLE</Text>
            <Text style={styles.cardTitle}>We couldn’t load Host Center.</Text>
            {error ? <Text style={styles.errorDetail}>{error}</Text> : null}
            <Pressable style={styles.primary} onPress={() => void load()}><Text style={styles.primaryText}>Try again</Text></Pressable>
          </View>
        ) : null}

        {!loading && !accessLoadFailed && !approved && !record ? (
          <View style={styles.applicationCard}>
            <Text style={styles.cardEyebrow}>BECOME A HOST</Text>
            <Text style={styles.cardTitle}>Lead the next adventure.</Text>
            <Text style={styles.body}>Complete the Host Pathway to create and manage community events.</Text>
            <Pressable style={styles.primary} onPress={() => router.push('/host/apply' as never)}><Text style={styles.primaryText}>Start Host Pathway</Text></Pressable>
          </View>
        ) : null}

        {!loading && !accessLoadFailed && !approved && record ? (() => {
          const copy = statusCopy[record.status] ?? ['Application status', 'Your hosting application is being reviewed.'];
          return <View style={styles.applicationCard}><Text style={styles.cardEyebrow}>{record.status.replace('_', ' ').toUpperCase()}</Text><Text style={styles.cardTitle}>{copy[0]}</Text><Text style={styles.body}>{copy[1]}</Text></View>;
        })() : null}

        {!loading && !accessLoadFailed && approved ? <>
          <View style={styles.hostLine}>
            <View style={styles.hostDot} />
            <Text style={styles.hostLineText}>{record?.host_type === 'official' ? 'Go Melanated Official' : 'Community Host'}</Text>
            <Text style={styles.hostLineSep}>·</Text>
            <Text style={paidEnabled ? styles.hostPaid : styles.hostMuted}>{paidEnabled ? 'Paid enabled' : 'Free outings'}</Text>
          </View>

          <SectionHeader title="Needs Attention" action={attentionTasks.length ? `${attentionTasks.length} items` : undefined} />
          <View style={styles.attentionCard}>
            {attentionTasks.length === 0 ? <Text style={styles.empty}>Nothing needs immediate attention.</Text> : attentionTasks.slice(0, 2).map((task) => (
              <View key={task.id} style={styles.attentionRow}>
                <View style={[styles.attentionDot, task.status === 'blocked' && styles.attentionDotDanger]} />
                <View style={{ flex: 1 }}><Text style={styles.attentionTitle}>{task.title}</Text><Text style={styles.attentionMeta}>{task.status === 'blocked' ? 'Blocked' : task.status === 'waiting' ? 'Waiting' : 'Critical'} · {task.dueLabel}</Text></View>
              </View>
            ))}
          </View>

          <SectionHeader title="Your Events" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {(['active', 'drafts', 'upcoming', 'past'] as EventFilter[]).map((filter) => (
              <Pressable key={filter} style={[styles.filterChip, eventFilter === filter && styles.filterChipActive]} onPress={() => setEventFilter(filter)}>
                <Text style={[styles.filterText, eventFilter === filter && styles.filterTextActive]}>{filter.charAt(0).toUpperCase() + filter.slice(1)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {filteredEvents.length === 0 ? <Text style={styles.empty}>No events in this view.</Text> : filteredEvents.map((event) => <EventCard key={`${event.source}-${event.id}`} event={event} />)}

          <SectionHeader title="Your Work" />
          <View style={styles.workGrid}>
            <WorkMetric label="Mine" value={myTasks.length} />
            <WorkMetric label="Blocked" value={blockedTasks.length} />
            <WorkMetric label="Unassigned" value={unassignedTasks.length} />
          </View>
          {firstCampaignSlug ? <Pressable style={styles.workAction} onPress={() => router.push(`/host/campaigns/${firstCampaignSlug}` as never)}><Text style={styles.workActionText}>Open all event work →</Text></Pressable> : null}

          <Pressable style={styles.createRow} onPress={() => router.push('/host/create' as never)}>
            <View style={styles.createIcon}><Text style={styles.createPlus}>＋</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.createTitle}>Create Adventure</Text><Text style={styles.createCopy}>Start a new community outing.</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Text style={styles.sectionAction}>{action}</Text> : null}</View>;
}

function EventCard({ event }: { event: HostEventRow }) {
  const publishedLabel = event.status === 'published' || event.status === 'sold_out' ? 'PUBLISHED' : event.status.replace('_', ' ').toUpperCase();
  return (
    <Pressable style={styles.eventCard} onPress={() => router.push(event.route as never)}>
      <View style={styles.eventTop}><Text style={styles.eventStatus}>{publishedLabel}</Text><Text style={styles.chevron}>›</Text></View>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.eventMeta}>{event.location}</Text>
      {typeof event.readiness === 'number' ? <>
        <Text style={styles.eventMeta}>{event.days} days to go · {event.readiness}% ready{event.attention ? ` · ${event.attention} need attention` : ''}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${event.readiness}%` }]} /></View>
      </> : <Text style={styles.eventMeta}>{event.startsAt ? new Date(event.startsAt).toLocaleDateString() : 'Date pending'}</Text>}
      <Text style={styles.manageText}>Manage Event →</Text>
    </Pressable>
  );
}

function WorkMetric({ label, value }: { label: string; value: number }) {
  return <View style={styles.workMetric}><Text style={styles.workValue}>{value}</Text><Text style={styles.workLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 60 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 42, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A8B1AB', fontSize: 15, lineHeight: 22, marginTop: 5, marginBottom: 18 },
  loadingCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2D3731', backgroundColor: '#151B17', padding: 18, alignItems: 'center', gap: 10 },
  loadingText: { color: '#A8B1AB', fontSize: 12, fontWeight: '800' },
  applicationCard: { borderRadius: 20, borderWidth: 1, borderColor: '#314438', backgroundColor: '#121C16', padding: 18 },
  errorCard: { borderRadius: 20, borderWidth: 1, borderColor: '#684139', backgroundColor: '#211715', padding: 18 },
  cardEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#FFF8E8', fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 7 },
  body: { color: '#AAB4AD', fontSize: 14, lineHeight: 21, marginTop: 8 },
  errorDetail: { color: '#BB8F87', fontSize: 10.5, lineHeight: 16, marginTop: 11 },
  primary: { backgroundColor: '#D7B45A', borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { color: '#172017', fontWeight: '900', fontSize: 15 },
  hostLine: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#121814', borderWidth: 1, borderColor: '#28342D', paddingHorizontal: 13, gap: 7 },
  hostDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9CCB74' },
  hostLineText: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' },
  hostLineSep: { color: '#657169' },
  hostPaid: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  hostMuted: { color: '#89948D', fontSize: 10, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 9 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  sectionAction: { color: '#A8B1AB', fontSize: 10, fontWeight: '900' },
  attentionCard: { borderRadius: 16, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#303A34', overflow: 'hidden' },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#29322D' },
  attentionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D7B45A' },
  attentionDotDanger: { backgroundColor: '#FF806D' },
  attentionTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  attentionMeta: { color: '#89948D', fontSize: 10, marginTop: 3 },
  filterRow: { gap: 7, paddingBottom: 10 },
  filterChip: { borderRadius: 18, borderWidth: 1, borderColor: '#38423C', backgroundColor: '#111612', paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { borderColor: '#D7B45A', backgroundColor: '#352D18' },
  filterText: { color: '#8D9891', fontSize: 10, fontWeight: '900' },
  filterTextActive: { color: '#E7C464' },
  eventCard: { borderRadius: 18, padding: 16, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#354039', marginBottom: 10 },
  eventTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventStatus: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .9 },
  eventTitle: { color: '#FFF8E8', fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 5 },
  eventMeta: { color: '#8E9891', fontSize: 11, lineHeight: 17, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 5, backgroundColor: '#26302A', overflow: 'hidden', marginTop: 11 },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#D7B45A' },
  manageText: { color: '#E7C464', fontSize: 11, fontWeight: '900', marginTop: 13 },
  workGrid: { flexDirection: 'row', gap: 8 },
  workMetric: { flex: 1, borderRadius: 14, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#303A34', padding: 13 },
  workValue: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  workLabel: { color: '#89948D', fontSize: 10, fontWeight: '800', marginTop: 3 },
  workAction: { alignSelf: 'flex-start', marginTop: 11 },
  workActionText: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  createRow: { marginTop: 24, minHeight: 72, borderRadius: 16, backgroundColor: '#121814', borderWidth: 1, borderColor: '#303A34', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  createIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2E341F', alignItems: 'center', justifyContent: 'center' },
  createPlus: { color: '#D7B45A', fontSize: 22, fontWeight: '900' },
  createTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  createCopy: { color: '#89948D', fontSize: 10.5, marginTop: 3 },
  chevron: { color: '#D7B45A', fontSize: 28, fontWeight: '700' },
  empty: { color: '#758079', fontSize: 12, lineHeight: 18, padding: 14 },
});