import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp } from '../../src/member/api';
import { getJourney, type JourneyItem } from '../../src/passport/api';
import { AppIcon } from '../../src/ui/AppIcon';

type JourneyYear = {
  year: string;
  items: JourneyItem[];
};

type Milestone = {
  threshold: number;
  title: string;
  body: string;
};

const MILESTONES: Milestone[] = [
  { threshold: 50, title: '50 adventures', body: "Fifty adventures. That's a serious outdoor autobiography." },
  { threshold: 25, title: '25 adventures', body: 'Twenty-five adventures. This is becoming a way of life.' },
  { threshold: 10, title: '10 adventures', body: 'Double digits. Ten adventures are now part of your story.' },
  { threshold: 5, title: '5 adventures', body: 'Five adventures. Your Trail is taking shape.' },
  { threshold: 1, title: 'First adventure', body: 'Your first adventure is in the books.' },
];

function experiencedDate(item: JourneyItem) {
  return item.experienced_at || item.starts_at;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Adventure complete';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizePlace(item: JourneyItem) {
  return `${item.city ?? ''}|${item.state ?? ''}`.trim().toLowerCase();
}

function TrailNode({ item, isLast }: { item: JourneyItem; isLast: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.city}, ${item.state}, ${formatDate(experiencedDate(item))}`}
      onPress={() => router.push(`/passport/memories/${item.adventure_id}`)}
      style={({ pressed }) => [styles.trailRow, pressed && styles.pressed]}
    >
      <View style={styles.railColumn}>
        <View style={styles.nodeOuter}><View style={styles.nodeInner} /></View>
        {!isLast ? <View style={styles.rail} /> : null}
      </View>

      <View style={styles.trailCard}>
        <View style={styles.cardTopRow}>
          <Text style={styles.dateText}>{formatDate(experiencedDate(item)).toUpperCase()}</Text>
          <AppIcon name="chevron-forward" color="#7E8B83" size={17} />
        </View>
        <Text style={styles.adventureTitle}>{item.title}</Text>
        <Text style={styles.locationText}>{[item.city, item.state].filter(Boolean).join(', ')}</Text>

        <View style={styles.metaRow}>
          {item.category ? <View style={styles.pill}><Text style={styles.pillText}>{item.category}</Text></View> : null}
          <View style={styles.pill}><Text style={styles.pillText}>{item.photo_count} photo{item.photo_count === 1 ? '' : 's'}</Text></View>
          {item.stamp_count ? <View style={styles.pill}><Text style={styles.pillText}>{item.stamp_count} stamp{item.stamp_count === 1 ? '' : 's'}</Text></View> : null}
        </View>

        {item.highlight ? <Text style={styles.highlight}>“{item.highlight}”</Text> : null}
      </View>
    </Pressable>
  );
}

export default function JourneyScreen() {
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getJourney(), getMemberBasecamp()])
      .then(([nextJourney, basecamp]) => {
        if (!active) return;
        setJourney(nextJourney);
        setProfile(basecamp?.profile ?? null);
        setError(null);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load your Trail.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const sortedJourney = useMemo(
    () => [...journey].sort((a, b) => new Date(experiencedDate(b)).getTime() - new Date(experiencedDate(a)).getTime()),
    [journey],
  );

  const years = useMemo<JourneyYear[]>(() => {
    const grouped = new Map<string, JourneyItem[]>();
    for (const item of sortedJourney) {
      const date = new Date(experiencedDate(item));
      const year = Number.isNaN(date.getTime()) ? 'Earlier' : String(date.getFullYear());
      grouped.set(year, [...(grouped.get(year) ?? []), item]);
    }
    return Array.from(grouped.entries()).map(([year, items]) => ({ year, items }));
  }, [sortedJourney]);

  const uniquePlaces = useMemo(() => new Set(journey.map(normalizePlace).filter(Boolean)).size, [journey]);
  const memoryCount = useMemo(() => journey.reduce((total, item) => total + (item.photo_count ?? 0), 0), [journey]);
  const activeYears = years.filter((group) => group.year !== 'Earlier').length;
  const milestone = MILESTONES.find((item) => journey.length >= item.threshold) ?? null;
  const nextMilestone = [...MILESTONES].reverse().find((item) => item.threshold > journey.length) ?? null;

  async function shareTrail() {
    const name = profile?.display_name || 'My';
    const placeWord = uniquePlaces === 1 ? 'place' : 'places';
    const adventureWord = journey.length === 1 ? 'adventure' : 'adventures';
    const memoryWord = memoryCount === 1 ? 'memory' : 'memories';
    await Share.share({
      message: `${name} Go Melanated Trail: ${journey.length} ${adventureWord}, ${uniquePlaces} ${placeWord}, ${memoryCount} saved ${memoryWord}. Your outdoor life, remembered.`,
    });
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <AppIcon name="chevron-forward" color="#D7B45A" size={19} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.back}>Profile</Text>
          </Pressable>
          {journey.length ? (
            <Pressable onPress={() => void shareTrail()} style={styles.shareButton}>
              <AppIcon name="share" color="#142019" size={16} />
              <Text style={styles.shareButtonText}>Share</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>YOUR OUTDOOR LIFE, REMEMBERED</Text>
          <Text style={styles.title}>Your Trail</Text>
          <Text style={styles.subtitle}>Every adventure adds another chapter. Places, memories and moments collect here as your story grows.</Text>
        </View>

        {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

        {journey.length ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryName}>{profile?.display_name || 'Your journey so far'}</Text>
              <Text style={styles.summaryLocation}>{[profile?.home_city, profile?.home_state].filter(Boolean).join(', ') || 'Go Melanated'}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}><Text style={styles.statNumber}>{journey.length}</Text><Text style={styles.statLabel}>Adventures</Text></View>
                <View style={styles.statDivider} />
                <View style={styles.stat}><Text style={styles.statNumber}>{uniquePlaces}</Text><Text style={styles.statLabel}>Places</Text></View>
                <View style={styles.statDivider} />
                <View style={styles.stat}><Text style={styles.statNumber}>{memoryCount}</Text><Text style={styles.statLabel}>Memories</Text></View>
                <View style={styles.statDivider} />
                <View style={styles.stat}><Text style={styles.statNumber}>{activeYears}</Text><Text style={styles.statLabel}>Years</Text></View>
              </View>
            </View>

            {milestone ? (
              <View style={styles.milestoneCard}>
                <View style={styles.milestoneIcon}><AppIcon name="adventure" color="#F0D083" size={26} /></View>
                <View style={styles.milestoneCopy}>
                  <Text style={styles.milestoneEyebrow}>MILESTONE ALONG THE WAY</Text>
                  <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                  <Text style={styles.milestoneBody}>{milestone.body}</Text>
                  {nextMilestone ? <Text style={styles.nextMilestone}>{nextMilestone.threshold - journey.length} more to your next chapter</Text> : null}
                </View>
              </View>
            ) : null}

            <View style={styles.sectionIntro}>
              <Text style={styles.sectionEyebrow}>THE STORY SO FAR</Text>
              <Text style={styles.sectionTitle}>Follow your Trail</Text>
              <Text style={styles.sectionBody}>Tap any adventure to open the memories you saved there.</Text>
            </View>

            {years.map((group) => (
              <View key={group.year} style={styles.yearSection}>
                <View style={styles.yearRow}><Text style={styles.yearText}>{group.year}</Text><View style={styles.yearLine} /></View>
                {group.items.map((item, index) => (
                  <TrailNode key={item.adventure_id} item={item} isLast={index === group.items.length - 1} />
                ))}
              </View>
            ))}

            <Pressable style={styles.memoryButton} onPress={() => router.push('/passport/memories')}>
              <AppIcon name="photos" color="#F0D083" size={20} />
              <View style={styles.memoryButtonCopy}>
                <Text style={styles.memoryButtonTitle}>Keep the story growing</Text>
                <Text style={styles.memoryButtonBody}>Add photos and reflections to the adventures already on your Trail.</Text>
              </View>
              <AppIcon name="chevron-forward" color="#D7B45A" size={19} />
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><AppIcon name="adventure" color="#D7B45A" size={32} /></View>
            <Text style={styles.emptyEyebrow}>YOUR TRAIL STARTS HERE</Text>
            <Text style={styles.emptyTitle}>Your first adventure becomes chapter one.</Text>
            <Text style={styles.emptyBody}>Complete an official adventure and it will appear here automatically with its place, date and memories.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.primaryButtonText}>Find your next adventure</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 54, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { color: '#D7B45A', fontWeight: '900', fontSize: 15 },
  shareButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', gap: 7 },
  shareButtonText: { color: '#142019', fontWeight: '900', fontSize: 12 },
  heroCopy: { gap: 5, paddingTop: 4, paddingBottom: 2 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  title: { color: '#FFF8E8', fontSize: 38, lineHeight: 42, fontWeight: '900' },
  subtitle: { color: '#A3ADA6', fontSize: 14, lineHeight: 21, maxWidth: 560 },
  errorCard: { backgroundColor: '#2C1C19', borderWidth: 1, borderColor: '#6A3C33', borderRadius: 16, padding: 14 },
  error: { color: '#FFB4A9', lineHeight: 20 },
  summaryCard: { backgroundColor: '#17211C', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#34483C', gap: 4 },
  summaryName: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  summaryLocation: { color: '#98A49C', fontSize: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 15 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statNumber: { color: '#F0D083', fontSize: 23, fontWeight: '900' },
  statLabel: { color: '#A8B2AB', fontSize: 10, fontWeight: '800' },
  statDivider: { width: 1, backgroundColor: '#304139', marginVertical: 3 },
  milestoneCard: { backgroundColor: '#223128', borderRadius: 20, borderWidth: 1, borderColor: '#536A59', padding: 16, flexDirection: 'row', gap: 13 },
  milestoneIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#17211C', alignItems: 'center', justifyContent: 'center' },
  milestoneCopy: { flex: 1, gap: 3 },
  milestoneEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  milestoneTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  milestoneBody: { color: '#CCD4CF', fontSize: 13, lineHeight: 19 },
  nextMilestone: { color: '#F0D083', fontSize: 11, fontWeight: '800', marginTop: 5 },
  sectionIntro: { gap: 3, marginTop: 4 },
  sectionEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#FFF8E8', fontSize: 24, fontWeight: '900' },
  sectionBody: { color: '#98A49C', fontSize: 12, lineHeight: 18 },
  yearSection: { gap: 0 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 2 },
  yearText: { color: '#F0D083', fontSize: 17, fontWeight: '900' },
  yearLine: { flex: 1, height: 1, backgroundColor: '#2C3B33' },
  trailRow: { flexDirection: 'row', minHeight: 118 },
  pressed: { opacity: 0.78 },
  railColumn: { width: 28, alignItems: 'center' },
  nodeOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D7B45A', backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', marginTop: 17 },
  nodeInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F0D083' },
  rail: { width: 2, flex: 1, backgroundColor: '#3B4D42' },
  trailCard: { flex: 1, backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#2B3931', padding: 15, marginBottom: 12, gap: 3 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.75 },
  adventureTitle: { color: '#FFF8E8', fontSize: 18, lineHeight: 23, fontWeight: '900', paddingRight: 8 },
  locationText: { color: '#A4AFA8', fontSize: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  pill: { backgroundColor: '#223128', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  pillText: { color: '#C9D1CC', fontSize: 9, fontWeight: '800' },
  highlight: { color: '#E7E1D3', fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginTop: 9 },
  memoryButton: { minHeight: 76, borderRadius: 18, backgroundColor: '#17211C', borderWidth: 1, borderColor: '#394A40', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  memoryButtonCopy: { flex: 1, gap: 2 },
  memoryButtonTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  memoryButtonBody: { color: '#98A49C', fontSize: 11, lineHeight: 16 },
  emptyCard: { backgroundColor: '#17211C', borderRadius: 22, borderWidth: 1, borderColor: '#34483C', padding: 22, gap: 9, marginTop: 4 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#223128', alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyEyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  emptyTitle: { color: '#FFF8E8', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  emptyBody: { color: '#A3ADA6', lineHeight: 20 },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#142019', fontWeight: '900' },
});
