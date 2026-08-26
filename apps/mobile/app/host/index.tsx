import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { applyToHost, getOutingHostAccess, listMyHostOutings, type HostOuting, type OutingHostRecord } from '../../src/hosting/api';
import { getAssignedAdventures } from '../../src/operations/api';

export default function HostOperationsScreen() {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [paidEnabled, setPaidEnabled] = useState(false);
  const [record, setRecord] = useState<OutingHostRecord | null>(null);
  const [outings, setOutings] = useState<HostOuting[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [application, setApplication] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [access, assigned] = await Promise.all([
        getOutingHostAccess(),
        getAssignedAdventures().catch(() => []),
      ]);
      setApproved(access.approved);
      setPaidEnabled(access.paidEnabled);
      setRecord(access.record);
      setAssignments(assigned);
      setOutings(access.approved ? await listMyHostOutings() : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load host access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function submitApplication() {
    setSubmitting(true);
    setError('');
    try {
      const created = await applyToHost(application);
      setRecord(created);
      setApplication('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit your host application.');
    } finally {
      setSubmitting(false);
    }
  }

  const drafts = outings.filter((outing) => outing.status === 'draft' || outing.status === 'scheduled');
  const upcoming = outings.filter((outing) => ['published', 'sold_out'].includes(outing.status) && new Date(outing.ends_at) >= new Date());
  const completed = outings.filter((outing) => outing.status === 'completed' || new Date(outing.ends_at) < new Date());

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>HOSTING</Text>
        <Text style={styles.title}>Host dashboard</Text>
        <Text style={styles.subtitle}>Create community outings, manage the people joining you, and run live adventures from one place.</Text>

        {loading ? <ActivityIndicator color="#D7B45A" style={{ marginTop: 28 }} /> : null}

        {!loading && !approved && !record ? (
          <View style={styles.applicationCard}>
            <Text style={styles.cardEyebrow}>BECOME AN APPROVED HOST</Text>
            <Text style={styles.cardTitle}>Bring your idea to the community.</Text>
            <Text style={styles.body}>Approved hosts can create public outings, configure registration, promote them, and operate attendee check-in. Paid hosting is a separate permission.</Text>
            <TextInput
              value={application}
              onChangeText={setApplication}
              multiline
              placeholder="Tell us what kinds of outings you want to host and your experience leading them."
              placeholderTextColor="#6F7B74"
              style={styles.textarea}
            />
            <Pressable disabled={submitting} style={styles.primary} onPress={() => void submitApplication()}>
              <Text style={styles.primaryText}>{submitting ? 'Submitting…' : 'Apply to Host'}</Text>
            </Pressable>
            <Text style={styles.micro}>Submitting means you agree to follow Go Melanated host, safety, and community standards.</Text>
          </View>
        ) : null}

        {!loading && !approved && record ? (
          <View style={styles.applicationCard}>
            <Text style={styles.cardEyebrow}>APPLICATION {record.status.toUpperCase()}</Text>
            <Text style={styles.cardTitle}>{record.status === 'pending' ? 'Your application is in review.' : 'Hosting access is currently unavailable.'}</Text>
            <Text style={styles.body}>{record.status === 'pending' ? 'When approved, this page becomes your Host Hub and the create tools unlock automatically.' : 'Contact Go Melanated support if you believe your host status should be reviewed.'}</Text>
          </View>
        ) : null}

        {!loading && approved ? (
          <>
            <View style={styles.statusCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusLabel}>APPROVED HOST</Text>
                <Text style={styles.statusTitle}>{record?.host_type === 'official' ? 'Go Melanated Official' : 'Community Host'}</Text>
              </View>
              <View style={[styles.pill, paidEnabled ? styles.pillGold : styles.pillMuted]}>
                <Text style={paidEnabled ? styles.pillGoldText : styles.pillMutedText}>{paidEnabled ? 'Paid enabled' : 'Free outings'}</Text>
              </View>
            </View>

            <Pressable style={styles.createCard} onPress={() => router.push('/host/create' as never)}>
              <Text style={styles.createKicker}>NEW OUTING</Text>
              <Text style={styles.createTitle}>Start with the adventure.</Text>
              <Text style={styles.createCopy}>Build the details, ticket, and launch plan.</Text>
              <Text style={styles.createAction}>Create outing →</Text>
            </Pressable>

            <View style={styles.metrics}>
              <Metric value={outings.length} label="Outings" />
              <Metric value={upcoming.length} label="Upcoming" />
              <Metric value={drafts.length} label="Drafts" />
            </View>

            <OutingSection title="Drafts" empty="Nothing in the workshop yet." outings={drafts} />
            <OutingSection title="Upcoming" empty="Published outings will show here." outings={upcoming} />
            <OutingSection title="Past" empty="Completed outings become part of your host story." outings={completed} />
          </>
        ) : null}

        {assignments.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Field assignments</Text>
            <Text style={styles.sectionIntro}>Operational roles assigned to you by Go Melanated.</Text>
            {assignments.map((item) => {
              const adventure = item.adventures;
              return (
                <Pressable key={`${item.adventure_id}-${item.role}`} style={styles.outingCard} onPress={() => router.push(`/host/${item.adventure_id}` as never)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.outingStatus}>FIELD OPERATIONS · {String(item.role).replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.outingTitle}>{adventure?.title ?? 'Adventure'}</Text>
                    <Text style={styles.outingMeta}>{item.station ? `${item.station} · ` : ''}{adventure?.city}, {adventure?.state}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricNumber}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function OutingSection({ title, empty, outings }: { title: string; empty: string; outings: HostOuting[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {outings.length === 0 ? <Text style={styles.empty}>{empty}</Text> : outings.map((outing) => (
        <Pressable key={outing.id} style={styles.outingCard} onPress={() => router.push(`/host/manage/${outing.id}` as never)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.outingStatus}>{outing.status.replace('_', ' ').toUpperCase()}</Text>
            <Text style={styles.outingTitle}>{outing.title}</Text>
            <Text style={styles.outingMeta}>{new Date(outing.starts_at).toLocaleDateString()} · {outing.city}, {outing.state}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 60 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 42, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A8B1AB', fontSize: 15, lineHeight: 22, marginTop: 5, marginBottom: 22 },
  applicationCard: { borderRadius: 20, borderWidth: 1, borderColor: '#314438', backgroundColor: '#121C16', padding: 18 },
  cardEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#FFF8E8', fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 7 },
  body: { color: '#AAB4AD', fontSize: 14, lineHeight: 21, marginTop: 8 },
  textarea: { minHeight: 126, borderWidth: 1, borderColor: '#36483E', backgroundColor: '#0D1511', borderRadius: 14, color: '#FFF8E8', padding: 14, marginTop: 18, textAlignVertical: 'top' },
  primary: { backgroundColor: '#D7B45A', borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#172017', fontWeight: '900', fontSize: 15 },
  micro: { color: '#77827B', fontSize: 10, lineHeight: 15, marginTop: 10 },
  statusCard: { borderRadius: 18, borderWidth: 1, borderColor: '#31533F', backgroundColor: '#11241A', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusLabel: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 3 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  pillGold: { backgroundColor: '#413515', borderWidth: 1, borderColor: '#705920' },
  pillMuted: { backgroundColor: '#202722', borderWidth: 1, borderColor: '#39413C' },
  pillGoldText: { color: '#E7C464', fontSize: 10, fontWeight: '900' },
  pillMutedText: { color: '#A7B0AA', fontSize: 10, fontWeight: '900' },
  createCard: { marginTop: 16, borderRadius: 20, padding: 18, backgroundColor: '#463614', borderWidth: 1, borderColor: '#8A6A25' },
  createKicker: { color: '#E7C464', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  createTitle: { color: '#FFF5D9', fontSize: 24, fontWeight: '900', marginTop: 5 },
  createCopy: { color: '#D1C39C', fontSize: 13, marginTop: 4 },
  createAction: { color: '#F2CF72', fontWeight: '900', marginTop: 16 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 16 },
  metric: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#2D3731', backgroundColor: '#151B17', padding: 13 },
  metricNumber: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#8F9A93', fontSize: 10, fontWeight: '800', marginTop: 2 },
  section: { marginTop: 25 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  sectionIntro: { color: '#7F8A83', fontSize: 11, marginTop: -3, marginBottom: 9 },
  empty: { color: '#758079', fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  outingCard: { borderRadius: 15, backgroundColor: '#171D19', borderWidth: 1, borderColor: '#2B332E', padding: 15, marginBottom: 9, flexDirection: 'row', alignItems: 'center' },
  outingStatus: { color: '#9D8647', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  outingTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 3 },
  outingMeta: { color: '#8E9891', fontSize: 11, marginTop: 4 },
  chevron: { color: '#D7B45A', fontSize: 28, marginLeft: 10 },
  error: { color: '#FF8A80', marginTop: 18, fontSize: 12, lineHeight: 18 },
});
