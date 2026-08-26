import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listAdventures } from '../../src/adventures/api';
import type { AdventureSummary } from '../../src/adventures/types';
import {
  getAdventureQueue,
  getNextBestAction,
  getReadinessItems,
  updateReadinessStatus,
} from '../../src/readiness/api';
import type { AdventureQueueItem, ReadinessItem, ReadinessStatus } from '../../src/readiness/types';
import { AppIcon } from '../../src/ui/AppIcon';

function shortDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const start = new Date(value);
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.ceil((startDay - today) / 86400000));
}

function statusLabel(status: ReadinessStatus) {
  if (status === 'not_started') return 'Not started';
  if (status === 'in_progress') return 'In progress';
  if (status === 'complete') return 'Complete';
  if (status === 'blocked') return 'Blocked';
  return 'Waived';
}

export default function ReadinessScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [reservation, setReservation] = useState<AdventureQueueItem | null>(null);
  const [adventure, setAdventure] = useState<AdventureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const [nextItems, queue, adventures] = await Promise.all([
        getReadinessItems(orderId),
        getAdventureQueue(),
        listAdventures(),
      ]);
      const nextReservation = queue.find((entry) => entry.order_id === orderId) ?? null;
      setItems(nextItems);
      setReservation(nextReservation);
      setAdventure(
        nextReservation
          ? adventures.find((entry) => entry.id === nextReservation.adventure_id) ?? null
          : null,
      );
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load readiness.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const required = useMemo(() => items.filter((item) => item.is_required), [items]);
  const recommended = useMemo(() => items.filter((item) => !item.is_required), [items]);
  const complete = required.filter((item) => ['complete', 'waived'].includes(item.status)).length;
  const score = required.length ? Math.round((complete / required.length) * 100) : 0;
  const isReady = required.length > 0 && complete === required.length;
  const nextAction = useMemo(() => getNextBestAction(items), [items]);
  const daysAway = daysUntil(reservation?.starts_at);

  async function setStatus(item: ReadinessItem, status: ReadinessStatus) {
    try {
      await updateReadinessStatus(item.id, status);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status } : entry)));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update task.');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#D7B45A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <AppIcon name="chevron-forward" color="#FFF8E8" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <Text style={styles.topLabel}>GET READY</Text>
          <View style={styles.topSpacer} />
        </View>

        <ImageBackground
          source={adventure?.hero_image_url ? { uri: adventure.hero_image_url } : undefined}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroShade} />
          <View style={styles.heroTop}>
            {daysAway !== null ? (
              <View style={styles.countdownPill}>
                <Text style={styles.countdownText}>
                  {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway} days away`}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.eyebrow}>YOUR ADVENTURE</Text>
            <Text style={styles.heroTitle}>{reservation?.title ?? 'Adventure readiness'}</Text>
            {reservation ? (
              <Text style={styles.heroMeta}>
                {shortDate(reservation.starts_at)} · {reservation.city}, {reservation.state}
              </Text>
            ) : null}
          </View>
        </ImageBackground>

        <View style={styles.readinessCard}>
          <View style={styles.readinessHeader}>
            <View style={styles.readinessCopy}>
              <Text style={styles.eyebrow}>ADVENTURE READINESS</Text>
              <Text style={styles.readinessTitle}>
                {required.length === 0 ? 'Prep hasn’t started yet.' : isReady ? 'Trail cleared.' : 'Getting ready.'}
              </Text>
              <Text style={styles.readinessSubtitle}>
                {required.length === 0
                  ? 'No required prep items have been added for this adventure yet.'
                  : `${complete} of ${required.length} required steps complete`}
              </Text>
            </View>
            {required.length > 0 ? (
              <View style={[styles.scoreBadge, isReady && styles.scoreBadgeReady]}>
                <Text style={styles.scoreText}>{score}%</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${score}%` }]} />
          </View>

          {isReady ? (
            <View style={styles.completeState}>
              <AppIcon name="badge" color="#D7B45A" size={20} />
              <Text style={styles.completeText}>You’re ready for {reservation?.city ?? 'your adventure'}.</Text>
            </View>
          ) : nextAction && required.length > 0 ? (
            <View style={styles.nextAction}>
              <Text style={styles.nextLabel}>NEXT STEP</Text>
              <Text style={styles.nextTitle}>{nextAction.title}</Text>
              <Text style={styles.nextBody}>{nextAction.description ?? 'Complete this step to keep your adventure on track.'}</Text>
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your prep checklist</Text>
            {required.length ? <Text style={styles.sectionCount}>{complete}/{required.length}</Text> : null}
          </View>

          {required.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <AppIcon name="guide" color="#D7B45A" size={22} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>Nothing required yet</Text>
                <Text style={styles.emptyBody}>When forms, arrival details, waivers, payments, or other required steps are added, they’ll appear here.</Text>
              </View>
            </View>
          ) : (
            required.map((item) => (
              <ReadinessCard key={item.id} item={item} onStatus={setStatus} />
            ))
          )}
        </View>

        {recommended.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended before you go</Text>
            {recommended.map((item) => (
              <ReadinessCard key={item.id} item={item} onStatus={setStatus} />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Before you go</Text>
          <View style={styles.infoGrid}>
            <InfoCard
              icon="adventure"
              label="Adventure"
              title="View details"
              onPress={() => reservation && router.push({ pathname: '/adventures/[id]', params: { id: reservation.adventure_id } })}
            />
            <InfoCard icon="weather" label="Conditions" title="Check weather" onPress={() => router.push('/member/weather' as never)} />
            <InfoCard icon="guide" label="Reservation" title="Manage trip" onPress={() => router.push('/member/trips')} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadinessCard({
  item,
  onStatus,
}: {
  item: ReadinessItem;
  onStatus: (item: ReadinessItem, status: ReadinessStatus) => Promise<void>;
}) {
  const done = item.status === 'complete' || item.status === 'waived';
  return (
    <View style={[styles.taskCard, item.blocks_check_in && !done && styles.blockerCard]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskCategoryRow}>
          <View style={[styles.taskDot, done && styles.taskDotDone]} />
          <Text style={styles.category}>{item.category}</Text>
        </View>
        <Text style={[styles.status, done && styles.statusDone]}>{statusLabel(item.status)}</Text>
      </View>
      <Text style={styles.taskTitle}>{item.title}</Text>
      {item.description ? <Text style={styles.taskBody}>{item.description}</Text> : null}
      {item.due_at ? <Text style={styles.due}>Due {new Date(item.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text> : null}
      {item.blocks_check_in && !done ? <Text style={styles.blocker}>Required before check-in</Text> : null}
      {!done ? (
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={() => void onStatus(item, 'in_progress')}>
            <Text style={styles.secondaryText}>In progress</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => void onStatus(item, 'complete')}>
            <Text style={styles.primaryText}>Complete</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function InfoCard({ icon, label, title, onPress }: { icon: 'adventure' | 'weather' | 'guide'; label: string; title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.infoCard, pressed && styles.infoCardPressed]}>
      <AppIcon name={icon} color="#D7B45A" size={21} />
      <Text style={styles.infoLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.infoTitle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1713' },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 42, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#34443B', alignItems: 'center', justifyContent: 'center' },
  topLabel: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  topSpacer: { width: 40 },
  hero: { height: 236, borderRadius: 24, overflow: 'hidden', backgroundColor: '#27372F', justifyContent: 'space-between' },
  heroImage: { borderRadius: 24 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,11,8,0.48)' },
  heroTop: { padding: 16, alignItems: 'flex-start', zIndex: 2 },
  countdownPill: { backgroundColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  countdownText: { color: '#17211C', fontSize: 11, fontWeight: '900' },
  heroBody: { padding: 18, zIndex: 2 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#FFF8E8', fontSize: 28, lineHeight: 31, fontWeight: '900', marginTop: 5 },
  heroMeta: { color: '#DCE2DE', fontSize: 14, marginTop: 5 },
  readinessCard: { backgroundColor: '#17211C', borderRadius: 22, borderWidth: 1, borderColor: '#34443B', padding: 17, gap: 14 },
  readinessHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  readinessCopy: { flex: 1 },
  readinessTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 28, fontWeight: '900', marginTop: 5 },
  readinessSubtitle: { color: '#AEB9B3', fontSize: 13, lineHeight: 18, marginTop: 5 },
  scoreBadge: { minWidth: 58, height: 42, paddingHorizontal: 10, borderRadius: 21, backgroundColor: '#252F29', borderWidth: 1, borderColor: '#4A5A51', alignItems: 'center', justifyContent: 'center' },
  scoreBadgeReady: { backgroundColor: '#203A2E', borderColor: '#4D735E' },
  scoreText: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#29352E' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#D7B45A' },
  nextAction: { backgroundColor: '#242F29', borderRadius: 16, padding: 14, gap: 4 },
  nextLabel: { color: '#D7B45A', fontWeight: '900', fontSize: 9, letterSpacing: 1 },
  nextTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  nextBody: { color: '#AFBAB3', lineHeight: 19, fontSize: 13 },
  completeState: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#20362C', borderRadius: 14, padding: 12 },
  completeText: { flex: 1, color: '#E9E5D9', fontSize: 13, fontWeight: '800' },
  error: { color: '#FFB4A9' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  sectionCount: { color: '#D7B45A', fontSize: 12, fontWeight: '900' },
  emptyCard: { flexDirection: 'row', backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#34443B', padding: 16, gap: 12 },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#252F29', alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  emptyBody: { color: '#9EAAA3', fontSize: 13, lineHeight: 18, marginTop: 4 },
  taskCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#2D3C34', padding: 16, gap: 8 },
  blockerCard: { borderColor: '#8C5C4D' },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  taskCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  taskDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#69766E' },
  taskDotDone: { backgroundColor: '#D7B45A' },
  category: { color: '#D7B45A', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  status: { color: '#AAB5AE', fontSize: 11, fontWeight: '700' },
  statusDone: { color: '#D7B45A' },
  taskTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  taskBody: { color: '#B5BEB8', lineHeight: 20, fontSize: 13 },
  due: { color: '#D8C48B', fontSize: 12, fontWeight: '700' },
  blocker: { color: '#E8A694', fontWeight: '800', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 3 },
  primaryButton: { flex: 1, backgroundColor: '#D7B45A', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  primaryText: { color: '#17211C', fontWeight: '900' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#526158', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  secondaryText: { color: '#E5E9E6', fontWeight: '800' },
  infoGrid: { flexDirection: 'row', gap: 9 },
  infoCard: { flex: 1, minHeight: 112, backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#2D3C34', padding: 12, justifyContent: 'space-between' },
  infoCardPressed: { opacity: 0.72 },
  infoLabel: { color: '#7F8D84', fontSize: 8, fontWeight: '900', letterSpacing: 0.7, marginTop: 10 },
  infoTitle: { color: '#FFF8E8', fontSize: 13, lineHeight: 16, fontWeight: '900' },
});