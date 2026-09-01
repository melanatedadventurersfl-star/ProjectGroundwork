import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCampaignDaysUntil, getCampaignReadiness, getHostCampaign, type CampaignTask, type CampaignTaskStatus } from '../../../src/hosting/campaigns';

const statusLabels: Record<CampaignTaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  waiting: 'Waiting',
  blocked: 'Blocked',
  review: 'Ready for review',
  complete: 'Complete',
};

export default function HostCampaignDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const campaign = getHostCampaign(String(params.id));

  if (!campaign) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <Text style={styles.title}>Campaign not found</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/host/campaigns' as never)}><Text style={styles.primaryButtonText}>Back to Campaigns</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const readiness = getCampaignReadiness(campaign);
  const days = getCampaignDaysUntil(campaign);
  const attention = campaign.tasks.filter((task) => task.priority === 'critical' || task.status === 'blocked' || task.status === 'waiting');
  const activeTasks = campaign.tasks.filter((task) => task.status !== 'complete');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Campaigns</Text></Pressable>
        <Text style={styles.eyebrow}>HOST CAMPAIGN</Text>
        <Text style={styles.title}>{campaign.shortTitle}</Text>
        <Text style={styles.meta}>{campaign.location}</Text>
        <Text style={styles.countdown}>{days} DAYS TO GO</Text>

        <View style={styles.readinessCard}>
          <View style={styles.readinessTop}><Text style={styles.sectionLabel}>EVENT READINESS</Text><Text style={[styles.readinessValue, { color: campaign.accent }]}>{readiness}%</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${readiness}%`, backgroundColor: campaign.accent }]} /></View>
          <Text style={styles.readinessNote}>Weighted by critical milestones, not just task count.</Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickCard value={String(activeTasks.length)} label="Open work" />
          <QuickCard value={String(attention.length)} label="Needs attention" />
          <QuickCard value={String(campaign.decisions.filter((decision) => decision.status === 'open').length)} label="Open decisions" />
          <QuickCard value={String(campaign.metrics.scheduledMarketing)} label="Scheduled posts" />
        </View>

        <Section title="Needs attention">
          {attention.map((task) => <TaskRow key={task.id} task={task} accent={campaign.accent} />)}
        </Section>

        <Section title="Milestones">
          {campaign.milestones.map((milestone) => (
            <View key={milestone.id} style={styles.milestoneRow}>
              <View style={[styles.check, milestone.complete && { backgroundColor: campaign.accent, borderColor: campaign.accent }]}><Text style={styles.checkText}>{milestone.complete ? '✓' : ''}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{milestone.title}</Text><Text style={styles.rowMeta}>{milestone.weight}% of readiness</Text></View>
            </View>
          ))}
        </Section>

        <Section title="Work">
          {activeTasks.map((task) => <TaskRow key={task.id} task={task} accent={campaign.accent} />)}
        </Section>

        <Section title="Open decisions">
          {campaign.decisions.filter((decision) => decision.status === 'open').map((decision) => (
            <View key={decision.id} style={styles.decisionCard}>
              <Text style={styles.decisionKicker}>DECISION NEEDED · {decision.dueLabel.toUpperCase()}</Text>
              <Text style={styles.rowTitle}>{decision.title}</Text>
              <Text style={styles.rowMeta}>Owner: {decision.owner}</Text>
            </View>
          ))}
        </Section>

        <Section title="Campaign pulse">
          <View style={styles.pulseCard}>
            <Text style={styles.pulseTitle}>Marketing</Text>
            <Text style={styles.pulseValue}>{campaign.metrics.scheduledMarketing} scheduled · {campaign.metrics.marketingNeedsAttention} need attention</Text>
          </View>
          <View style={styles.pulseCard}>
            <Text style={styles.pulseTitle}>Guests</Text>
            <Text style={styles.pulseValue}>{campaign.metrics.capacityLabel}</Text>
          </View>
          <View style={styles.pulseCard}>
            <Text style={styles.pulseTitle}>Budget</Text>
            <Text style={styles.pulseValue}>Budget setup is ready for the next release.</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function QuickCard({ value, label }: { value: string; label: string }) {
  return <View style={styles.quickCard}><Text style={styles.quickValue}>{value}</Text><Text style={styles.quickLabel}>{label}</Text></View>;
}

function TaskRow({ task, accent }: { task: CampaignTask; accent: string }) {
  const danger = task.status === 'blocked' || task.priority === 'critical';
  return (
    <View style={styles.taskCard}>
      <View style={styles.taskTop}><Text style={[styles.taskStatus, { color: danger ? '#FF8A70' : accent }]}>{statusLabels[task.status].toUpperCase()}</Text><Text style={styles.taskDue}>{task.dueLabel}</Text></View>
      <Text style={styles.rowTitle}>{task.title}</Text>
      <Text style={styles.rowMeta}>{task.category} · {task.owner}</Text>
      {task.blockedBy ? <Text style={styles.blockedBy}>Blocked by: {task.blockedBy}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  content: { padding: 20, paddingBottom: 70 },
  missing: { flex: 1, justifyContent: 'center', padding: 24 },
  back: { color: '#D7B45A', fontWeight: '900', marginBottom: 18 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 },
  meta: { color: '#8E9891', fontSize: 12, lineHeight: 18, marginTop: 6 },
  countdown: { color: '#E88633', fontSize: 12, fontWeight: '900', letterSpacing: 1.1, marginTop: 12 },
  readinessCard: { backgroundColor: '#151B17', borderRadius: 20, borderWidth: 1, borderColor: '#303A34', padding: 17, marginTop: 18 },
  readinessTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { color: '#AAB4AD', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  readinessValue: { fontSize: 28, fontWeight: '900' },
  readinessNote: { color: '#758079', fontSize: 10, marginTop: 8 },
  progressTrack: { height: 8, borderRadius: 6, backgroundColor: '#252E29', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 6 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  quickCard: { width: '48%', minHeight: 86, backgroundColor: '#121814', borderWidth: 1, borderColor: '#2A342E', borderRadius: 16, padding: 14 },
  quickValue: { color: '#FFF8E8', fontSize: 24, fontWeight: '900' },
  quickLabel: { color: '#87928B', fontSize: 11, fontWeight: '800', marginTop: 4 },
  section: { marginTop: 26 },
  sectionTitle: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 9 },
  taskCard: { borderRadius: 16, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#2B332E', padding: 15, marginBottom: 9 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  taskStatus: { fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  taskDue: { color: '#7D8881', fontSize: 9, fontWeight: '800' },
  rowTitle: { color: '#FFF8E8', fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 5 },
  rowMeta: { color: '#89948D', fontSize: 11, lineHeight: 16, marginTop: 4 },
  blockedBy: { color: '#C7907E', fontSize: 10.5, lineHeight: 15, marginTop: 7 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#2B332E', padding: 14, marginBottom: 8 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#546159', alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#0B100D', fontWeight: '900' },
  decisionCard: { borderRadius: 16, backgroundColor: '#1E1A12', borderWidth: 1, borderColor: '#574522', padding: 15, marginBottom: 9 },
  decisionKicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  pulseCard: { borderRadius: 14, backgroundColor: '#151B17', borderWidth: 1, borderColor: '#2B332E', padding: 14, marginBottom: 8 },
  pulseTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  pulseValue: { color: '#89948D', fontSize: 11, lineHeight: 17, marginTop: 4 },
  primaryButton: { backgroundColor: '#D7B45A', borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryButtonText: { color: '#172017', fontWeight: '900' },
});
