import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCampaignTeam, listHostCampaigns, type CampaignTeamMember, type HostCampaign } from './campaigns';
import { createHostMeeting, listHostMeetings, type HostMeeting } from './meetings';
import { AppIcon } from '../ui/AppIcon';

type TeamMap = Record<string, CampaignTeamMember[]>;

function parseLocalDateTime(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMeetingDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function HostTeamsHub() {
  const [campaigns, setCampaigns] = useState<HostCampaign[]>([]);
  const [meetings, setMeetings] = useState<HostMeeting[]>([]);
  const [teams, setTeams] = useState<TeamMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextCampaigns = await listHostCampaigns();
      const [nextMeetings, teamEntries] = await Promise.all([
        listHostMeetings(nextCampaigns.map((campaign) => campaign.id)),
        Promise.all(nextCampaigns.map(async (campaign) => [campaign.id, await listCampaignTeam(campaign)] as const)),
      ]);
      setCampaigns(nextCampaigns);
      setMeetings(nextMeetings);
      setTeams(Object.fromEntries(teamEntries));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load teams and meetings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.status !== 'complete'), [campaigns]);
  const manageableCampaigns = useMemo(() => activeCampaigns.filter((campaign) => campaign.canManage), [activeCampaigns]);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const selectedTeam = selectedCampaign ? teams[selectedCampaign.id] ?? [] : [];
  const upcomingMeetings = useMemo(() => meetings.filter((meeting) => meeting.status === 'scheduled'), [meetings]);
  const completedMeetings = useMemo(() => meetings.filter((meeting) => meeting.status === 'complete').slice(-5).reverse(), [meetings]);

  const openSchedule = (campaign?: HostCampaign) => {
    const nextCampaign = campaign ?? manageableCampaigns[0] ?? null;
    setShowSchedule(true);
    if (!nextCampaign) return;
    setSelectedCampaignId(nextCampaign.id);
    setSelectedAttendees((teams[nextCampaign.id] ?? []).map((member) => member.profileId));
    setTitle(`${nextCampaign.shortTitle} Team Meeting`);
  };

  const selectCampaign = (campaign: HostCampaign) => {
    setSelectedCampaignId(campaign.id);
    setSelectedAttendees((teams[campaign.id] ?? []).map((member) => member.profileId));
    setTitle(`${campaign.shortTitle} Team Meeting`);
  };

  const toggleAttendee = (profileId: string) => {
    setSelectedAttendees((current) => current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]);
  };

  const scheduleMeeting = async () => {
    if (!selectedCampaign) {
      setError('Choose an event for this meeting.');
      return;
    }
    const start = parseLocalDateTime(startsAt);
    const end = parseLocalDateTime(endsAt);
    if (!start || !end) {
      setError('Use YYYY-MM-DD HH:MM for the meeting start and end time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const meeting = await createHostMeeting({
        campaignId: selectedCampaign.id,
        title,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        location,
        meetingUrl,
        attendeeProfileIds: selectedAttendees,
      });
      setShowSchedule(false);
      setStartsAt('');
      setEndsAt('');
      setLocation('');
      setMeetingUrl('');
      await load();
      router.push(`/host/meetings/${meeting.id}` as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to schedule this meeting.');
    } finally {
      setSaving(false);
    }
  };

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>

      <View style={styles.hero}>
        <View style={styles.heroIcon}><AppIcon name="team" color="#77B9A6" size={26} /></View>
        <Text style={styles.eyebrow}>TEAMS</Text>
        <Text style={styles.title}>Teams + Meetings</Text>
        <Text style={styles.subtitle}>Coordinate event crews, schedule planning meetings, capture decisions and turn follow-up into assigned work.</Text>
        <Pressable style={styles.primary} onPress={() => openSchedule()} disabled={!manageableCampaigns.length}>
          <Text style={styles.primaryText}>＋ Schedule Meeting</Text>
        </Pressable>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading teams…</Text></View> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

      {!loading && showSchedule ? <View style={styles.panel}>
        <Text style={styles.sectionKicker}>NEW MEETING</Text>
        <Text style={styles.sectionTitle}>Schedule with your team</Text>
        <Text style={styles.helper}>V1 schedules inside Go Melanated. Calendar sync and automatic availability come later.</Text>

        <Text style={styles.label}>Event</Text>
        <View style={styles.chips}>{manageableCampaigns.map((campaign) => <Pressable key={campaign.id} onPress={() => selectCampaign(campaign)} style={[styles.chip, selectedCampaignId === campaign.id && styles.chipActive]}><Text style={[styles.chipText, selectedCampaignId === campaign.id && styles.chipTextActive]}>{campaign.shortTitle}</Text></Pressable>)}</View>

        <Text style={styles.label}>Meeting title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Weekly planning meeting" placeholderTextColor="#667269" />

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}><Text style={styles.label}>Starts</Text><TextInput value={startsAt} onChangeText={setStartsAt} style={styles.input} placeholder="2026-09-16 19:00" placeholderTextColor="#667269" autoCapitalize="none" /></View>
          <View style={styles.fieldHalf}><Text style={styles.label}>Ends</Text><TextInput value={endsAt} onChangeText={setEndsAt} style={styles.input} placeholder="2026-09-16 20:00" placeholderTextColor="#667269" autoCapitalize="none" /></View>
        </View>

        <Text style={styles.label}>Location</Text>
        <TextInput value={location} onChangeText={setLocation} style={styles.input} placeholder="Optional physical location" placeholderTextColor="#667269" />
        <Text style={styles.label}>Virtual meeting link</Text>
        <TextInput value={meetingUrl} onChangeText={setMeetingUrl} style={styles.input} placeholder="Optional Zoom, Meet or Teams link" placeholderTextColor="#667269" autoCapitalize="none" />

        <Text style={styles.label}>Invite</Text>
        <View style={styles.attendeeList}>{selectedTeam.map((member) => {
          const selected = selectedAttendees.includes(member.profileId);
          return <Pressable key={member.profileId} onPress={() => toggleAttendee(member.profileId)} style={[styles.attendeeRow, selected && styles.attendeeSelected]}>
            <View style={[styles.checkbox, selected && styles.checkboxSelected]}><Text style={styles.checkboxText}>{selected ? '✓' : ''}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{member.displayName}</Text><Text style={styles.rowMeta}>{member.role}</Text></View>
          </Pressable>;
        })}</View>

        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={() => setShowSchedule(false)}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
          <Pressable style={styles.primarySmall} onPress={() => void scheduleMeeting()} disabled={saving}><Text style={styles.primaryText}>{saving ? 'Scheduling…' : 'Schedule Meeting'}</Text></Pressable>
        </View>
      </View> : null}

      {!loading ? <>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Upcoming meetings</Text><Text style={styles.sectionCount}>{upcomingMeetings.length}</Text></View>
        {upcomingMeetings.length ? upcomingMeetings.map((meeting) => {
          const campaign = campaigns.find((item) => item.id === meeting.campaignId);
          return <Pressable key={meeting.id} style={styles.meetingCard} onPress={() => router.push(`/host/meetings/${meeting.id}` as never)}>
            <View style={styles.meetingDate}><Text style={styles.meetingMonth}>{new Date(meeting.startsAt).toLocaleString('en-US', { month: 'short' }).toUpperCase()}</Text><Text style={styles.meetingDay}>{new Date(meeting.startsAt).getDate()}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{meeting.title}</Text><Text style={styles.cardMeta}>{formatMeetingDate(meeting.startsAt)}</Text><Text style={styles.cardMeta}>{campaign?.shortTitle ?? 'Event'}{meeting.location ? ` · ${meeting.location}` : ''}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>;
        }) : <View style={styles.empty}><Text style={styles.emptyText}>No meetings scheduled yet.</Text></View>}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Event teams</Text><Text style={styles.sectionCount}>{activeCampaigns.length}</Text></View>
        {activeCampaigns.map((campaign) => {
          const team = teams[campaign.id] ?? [];
          const eventMeetings = meetings.filter((meeting) => meeting.campaignId === campaign.id && meeting.status === 'scheduled');
          return <View key={campaign.id} style={styles.card}>
            <View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{campaign.shortTitle}</Text><Text style={styles.cardMeta}>{team.length} team member{team.length === 1 ? '' : 's'} · {eventMeetings.length} upcoming meeting{eventMeetings.length === 1 ? '' : 's'}</Text></View><AppIcon name="team" color="#77B9A6" size={20} /></View>
            <View style={styles.memberStack}>{team.slice(0, 5).map((member) => <View key={member.profileId} style={styles.memberPill}><Text style={styles.memberName}>{member.displayName}</Text><Text style={styles.memberRole}>{member.role}</Text></View>)}</View>
            {campaign.canManage ? <Pressable style={styles.cardAction} onPress={() => openSchedule(campaign)}><Text style={styles.cardActionText}>Schedule team meeting</Text></Pressable> : null}
          </View>;
        })}

        {completedMeetings.length ? <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent meeting history</Text></View>{completedMeetings.map((meeting) => <Pressable key={meeting.id} style={styles.historyRow} onPress={() => router.push(`/host/meetings/${meeting.id}` as never)}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{meeting.title}</Text><Text style={styles.rowMeta}>{formatMeetingDate(meeting.startsAt)}</Text>{meeting.recap ? <Text style={styles.recap}>{meeting.recap}</Text> : null}</View><Text style={styles.chevron}>›</Text></Pressable>)}</> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F0C' },
  content: { padding: 18, paddingBottom: 72 },
  back: { color: '#D7B45A', fontWeight: '900', marginBottom: 14 },
  hero: { borderRadius: 22, borderWidth: 1, borderColor: '#2E3A33', backgroundColor: '#141D17', padding: 18 },
  heroIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 13, backgroundColor: '#77B9A622' },
  eyebrow: { color: '#77B9A6', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 30, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#9AA69E', fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 560 },
  primary: { minHeight: 46, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primarySmall: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#172017', fontWeight: '900', fontSize: 11 },
  loading: { padding: 30, alignItems: 'center', gap: 9 },
  muted: { color: '#849087', fontSize: 10 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#6F3D37', backgroundColor: '#281817', padding: 12, marginTop: 12 },
  error: { color: '#F0A599', fontSize: 10, lineHeight: 15 },
  panel: { borderRadius: 18, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#111914', padding: 14, marginTop: 14 },
  sectionKicker: { color: '#77B9A6', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '900' },
  helper: { color: '#7F8B83', fontSize: 9, lineHeight: 14, marginTop: 5 },
  label: { color: '#9AA69E', fontSize: 9, fontWeight: '800', marginTop: 12, marginBottom: 5 },
  input: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#334139', backgroundColor: '#0D140F', color: '#FFF8E8', paddingHorizontal: 11, fontSize: 11 },
  fieldRow: { flexDirection: 'row', gap: 8 },
  fieldHalf: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#36443C', backgroundColor: '#111914', paddingHorizontal: 10, paddingVertical: 8 },
  chipActive: { borderColor: '#D7B45A', backgroundColor: '#D7B45A22' },
  chipText: { color: '#849087', fontSize: 9, fontWeight: '800' },
  chipTextActive: { color: '#F2D27E' },
  attendeeList: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3932' },
  attendeeRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2D3932' },
  attendeeSelected: { backgroundColor: '#77B9A611' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: '#4A5950', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: '#77B9A6', backgroundColor: '#77B9A6' },
  checkboxText: { color: '#0A0F0C', fontSize: 11, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  secondaryButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#B6C0B9', fontSize: 10, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 },
  sectionCount: { color: '#77B9A6', fontSize: 11, fontWeight: '900' },
  meetingCard: { minHeight: 86, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 11 },
  meetingDate: { width: 48, height: 54, borderRadius: 12, backgroundColor: '#1D2922', alignItems: 'center', justifyContent: 'center' },
  meetingMonth: { color: '#77B9A6', fontSize: 8, fontWeight: '900' },
  meetingDay: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 1 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#141B16', padding: 14, marginTop: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  cardMeta: { color: '#89958D', fontSize: 9, lineHeight: 14, marginTop: 3 },
  memberStack: { marginTop: 10, gap: 6 },
  memberPill: { borderRadius: 10, backgroundColor: '#101711', paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  memberName: { color: '#DDE6DF', fontSize: 9, fontWeight: '800' },
  memberRole: { color: '#748179', fontSize: 8, textTransform: 'capitalize' },
  cardAction: { marginTop: 10, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: '#77B9A655', alignItems: 'center', justifyContent: 'center' },
  cardActionText: { color: '#90CCBA', fontSize: 9, fontWeight: '900' },
  historyRow: { minHeight: 68, borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111814', padding: 12, marginTop: 7, flexDirection: 'row', alignItems: 'center' },
  rowTitle: { color: '#FFF8E8', fontSize: 10, fontWeight: '900' },
  rowMeta: { color: '#7F8B83', fontSize: 8, lineHeight: 12, marginTop: 2 },
  recap: { color: '#9EB5A7', fontSize: 8, lineHeight: 12, marginTop: 5 },
  chevron: { color: '#667269', fontSize: 24, marginLeft: 8 },
  empty: { borderRadius: 14, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111814', padding: 18, alignItems: 'center' },
  emptyText: { color: '#758178', fontSize: 9 },
});
