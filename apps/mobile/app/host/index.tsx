import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { applyToHost, getOutingHostAccess, listMyHostOutings, type HostOuting, type OutingHostRecord } from '../../src/hosting/api';
import { getAssignedAdventures } from '../../src/operations/api';

const MIN_APPLICATION_LENGTH = 20;

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
  const [accessLoadFailed, setAccessLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setAccessLoadFailed(false);
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
      setAccessLoadFailed(true);
      setApproved(false);
      setPaidEnabled(false);
      setRecord(null);
      setOutings([]);
      setError(caught instanceof Error ? caught.message : 'Unable to load host access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function submitApplication() {
    if (application.trim().length < MIN_APPLICATION_LENGTH) {
      setError('Tell us a little more about the outings you want to host.');
      return;
    }

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
  const applicationReady = application.trim().length >= MIN_APPLICATION_LENGTH;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>HOSTING</Text>
        <Text style={styles.title}>Host Hub</Text>
        <Text style={styles.subtitle}>Turn an idea into a real community adventure, then manage it from planning through check-in.</Text>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#D7B45A" />
            <Text style={styles.loadingText}>Checking your host access…</Text>
          </View>
        ) : null}

        {!loading && accessLoadFailed ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorEyebrow}>HOST TOOLS TEMPORARILY UNAVAILABLE</Text>
            <Text style={styles.errorTitle}>We couldn’t check your host status.</Text>
            <Text style={styles.body}>Your account is still available. We just need to reconnect the host tools before you apply or manage outings.</Text>
            {error ? <Text style={styles.errorDetail}>{error}</Text> : null}
            <Pressable style={styles.secondaryButton} onPress={() => void load()}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !accessLoadFailed && !approved && !record ? (
          <>
            <View style={styles.introCard}>
              <Text style={styles.cardEyebrow}>BECOME AN APPROVED HOST</Text>
              <Text style={styles.cardTitle}>Bring your idea to the community.</Text>
              <Text style={styles.body}>Approved hosts can create public outings, manage registration, communicate with attendees, and run day-of check-in from one place.</Text>

              <View style={styles.benefitList}>
                <BenefitRow number="01" title="Plan" copy="Create the outing, capacity, location, and registration details." />
                <BenefitRow number="02" title="Gather" copy="See who’s joining and keep the group informed." />
                <BenefitRow number="03" title="Host" copy="Use live attendee and check-in tools on adventure day." />
              </View>
            </View>

            <View style={styles.applicationCard}>
              <Text style={styles.formLabel}>YOUR HOSTING IDEA</Text>
              <Text style={styles.formHelp}>What would you like to host, and what experience do you have leading people outdoors or organizing groups?</Text>
              <TextInput
                value={application}
                onChangeText={(value) => {
                  setApplication(value);
                  if (error) setError('');
                }}
                multiline
                maxLength={1200}
                placeholder="Example: I’d like to lead beginner-friendly hikes and local nature walks. I’ve organized group outings for…"
                placeholderTextColor="#68756D"
                style={styles.textarea}
              />
              <View style={styles.inputMetaRow}>
                <Text style={styles.inputHint}>A few sentences is perfect.</Text>
                <Text style={[styles.characterCount, applicationReady && styles.characterCountReady]}>{application.trim().length}/1200</Text>
              </View>

              {error ? <Text style={styles.inlineError}>{error}</Text> : null}

              <Pressable
                disabled={submitting || !applicationReady}
                style={[styles.primary, (submitting || !applicationReady) && styles.primaryDisabled]}
                onPress={() => void submitApplication()}
              >
                <Text style={[styles.primaryText, (submitting || !applicationReady) && styles.primaryTextDisabled]}>{submitting ? 'Submitting…' : 'Apply to Host'}</Text>
              </Pressable>
              <Text style={styles.micro}>Applications are reviewed before public outing tools unlock. Paid hosting requires separate approval.</Text>
            </View>
          </>
        ) : null}

        {!loading && !accessLoadFailed && !approved && record ? (
          <View style={styles.applicationCard}>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{record.status === 'pending' ? 'IN REVIEW' : record.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.cardTitle}>{record.status === 'pending' ? 'Your host application is on the trail.' : 'Hosting access is currently unavailable.'}</Text>
            <Text style={styles.body}>{record.status === 'pending' ? 'There’s nothing else you need to submit right now. When your application is approved, this page automatically becomes your Host Hub.' : 'Contact Go Melanated support if you believe your host status should be reviewed.'}</Text>
            {record.status === 'pending' ? (
              <View style={styles.reviewSteps}>
                <Text style={styles.reviewStep}>✓ Application received</Text>
                <Text style={styles.reviewStepMuted}>○ Community & safety review</Text>
                <Text style={styles.reviewStepMuted}>○ Host tools unlocked</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {!loading && !accessLoadFailed && approved ? (
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
              <Text style={styles.createCopy}>Build the details, registration, and launch plan.</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

function BenefitRow({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitNumber}><Text style={styles.benefitNumberText}>{number}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitCopy}>{copy}</Text>
      </View>
    </View>
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
  content: { padding: 20, paddingBottom: 70 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 42, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#A8B1AB', fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 22 },
  loadingCard: { borderRadius: 18, borderWidth: 1, borderColor: '#29352E', backgroundColor: '#121814', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  loadingText: { color: '#9BA69F', fontSize: 13, fontWeight: '700' },
  introCard: { borderRadius: 22, borderWidth: 1, borderColor: '#314438', backgroundColor: '#121C16', padding: 19 },
  applicationCard: { borderRadius: 20, borderWidth: 1, borderColor: '#2C3932', backgroundColor: '#101713', padding: 18, marginTop: 12 },
  cardEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#FFF8E8', fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 7 },
  body: { color: '#AAB4AD', fontSize: 14, lineHeight: 21, marginTop: 8 },
  benefitList: { marginTop: 18, gap: 13 },
  benefitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  benefitNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#253229', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3C4E42' },
  benefitNumberText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  benefitTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  benefitCopy: { color: '#88948D', fontSize: 12, lineHeight: 18, marginTop: 2 },
  formLabel: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  formHelp: { color: '#9DA8A1', fontSize: 13, lineHeight: 19, marginTop: 6 },
  textarea: { minHeight: 150, borderWidth: 1, borderColor: '#36483E', backgroundColor: '#0B120E', borderRadius: 14, color: '#FFF8E8', padding: 14, marginTop: 14, textAlignVertical: 'top', fontSize: 14, lineHeight: 20 },
  inputMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  inputHint: { color: '#6F7B74', fontSize: 10 },
  characterCount: { color: '#6F7B74', fontSize: 10, fontWeight: '800' },
  characterCountReady: { color: '#BDA154' },
  primary: { backgroundColor: '#D7B45A', borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  primaryDisabled: { backgroundColor: '#403D2C' },
  primaryText: { color: '#172017', fontWeight: '900', fontSize: 15 },
  primaryTextDisabled: { color: '#777566' },
  micro: { color: '#77827B', fontSize: 10, lineHeight: 15, marginTop: 10 },
  inlineError: { color: '#FF9A90', marginTop: 9, fontSize: 11, lineHeight: 16 },
  errorCard: { borderRadius: 20, borderWidth: 1, borderColor: '#6B403B', backgroundColor: '#231715', padding: 18 },
  errorEyebrow: { color: '#E59A8F', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  errorTitle: { color: '#FFF2EF', fontSize: 21, lineHeight: 27, fontWeight: '900', marginTop: 7 },
  errorDetail: { color: '#B9837D', fontSize: 10, lineHeight: 15, marginTop: 10 },
  secondaryButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#A46D64', alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  secondaryButtonText: { color: '#FFD7D1', fontSize: 13, fontWeight: '900' },
  pendingBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#3B321C', borderWidth: 1, borderColor: '#695623' },
  pendingBadgeText: { color: '#E5C667', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  reviewSteps: { marginTop: 18, gap: 9, borderTopWidth: 1, borderTopColor: '#29342E', paddingTop: 14 },
  reviewStep: { color: '#D7B45A', fontSize: 12, fontWeight: '800' },
  reviewStepMuted: { color: '#748078', fontSize: 12, fontWeight: '700' },
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
});
