import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getJourney } from '../../src/passport/api';
import { RankEmblem, rankFor, rankLadder, type RankName } from '../../src/passport/RankEmblem';
import { AppIcon } from '../../src/ui/AppIcon';

const rankCopy: Record<RankName, { motto: string; description: string }> = {
  Explorer: {
    motto: 'The journey begins.',
    description: 'Your first step into the Melanated Adventurers journey.',
  },
  Pathfinder: {
    motto: 'Find the trail. Lead the way.',
    description: 'Earned after completing your first official adventure.',
  },
  Trailblazer: {
    motto: 'Carve your path. Inspire others.',
    description: 'A growing adventure story built through three completed adventures.',
  },
  Adventurer: {
    motto: 'Guided by purpose. Driven by vision.',
    description: 'Five completed adventures mark a member growing into a seasoned adventurer.',
  },
  'Summit Seeker': {
    motto: 'Rise higher. Reach further.',
    description: 'Ten completed adventures recognize sustained exploration and achievement.',
  },
  Ascendant: {
    motto: 'Leave a legacy. Forever part of the trail.',
    description: 'Twenty completed adventures unlock the highest rank in the journey.',
  },
};

export default function RankProgressScreen() {
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getJourney()
      .then((rows) => {
        if (!active) return;
        setCompleted(rows.length);
        setError(null);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load your rank journey.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const currentRank = useMemo(() => rankFor(completed), [completed]);
  const currentIndex = rankLadder.findIndex(([name]) => name === currentRank);
  const nextRank = rankLadder.find(([, minimum]) => minimum > completed);
  const currentMinimum = rankLadder[currentIndex]?.[1] ?? 0;
  const nextMinimum = nextRank?.[1] ?? currentMinimum;
  const tierSpan = Math.max(1, nextMinimum - currentMinimum);
  const progress = nextRank ? Math.max(0, Math.min(1, (completed - currentMinimum) / tierSpan)) : 1;
  const remaining = nextRank ? Math.max(0, nextRank[1] - completed) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
            <AppIcon name="chevron-forward" color="#F5C341" size={25} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>YOUR ADVENTURE STORY</Text>
            <Text style={styles.title}>Rank Journey</Text>
          </View>
        </View>

        {loading ? <ActivityIndicator color="#F5C341" style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.heroBadge}>
                  <RankEmblem rank={currentRank} size={104} />
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.currentLabel}>CURRENT RANK</Text>
                  <Text style={styles.currentRank}>{currentRank}</Text>
                  <Text style={styles.motto}>{rankCopy[currentRank].motto}</Text>
                </View>
              </View>

              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{completed} adventure{completed === 1 ? '' : 's'} completed</Text>
                {nextRank ? <Text style={styles.progressTarget}>{nextRank[0]} at {nextRank[1]}</Text> : <Text style={styles.progressTarget}>Top rank reached</Text>}
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
              {nextRank ? (
                <Text style={styles.progressCopy}><Text style={styles.gold}>{remaining}</Text> more adventure{remaining === 1 ? '' : 's'} to unlock <Text style={styles.gold}>{nextRank[0]}</Text>.</Text>
              ) : (
                <Text style={styles.progressCopy}>You have reached the highest rank in the current journey.</Text>
              )}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>The full trail</Text>
              <Text style={styles.sectionMeta}>6 ranks</Text>
            </View>

            <View style={styles.ladder}>
              {rankLadder.map(([name, minimum], index) => {
                const isCurrent = name === currentRank;
                const unlocked = completed >= minimum;
                const completedTier = unlocked && index < currentIndex;
                const status = isCurrent ? 'CURRENT' : completedTier ? 'COMPLETED' : unlocked ? 'UNLOCKED' : 'LOCKED';

                return (
                  <View key={name} style={[styles.rankCard, isCurrent && styles.rankCardCurrent, !unlocked && styles.rankCardLocked]}>
                    <View style={styles.rankArtWrap}>
                      <RankEmblem rank={name} size={78} muted={!unlocked} />
                      {completedTier ? <View style={styles.checkBadge}><AppIcon name="checkmark" color="#111A17" size={13} /></View> : null}
                    </View>
                    <View style={styles.rankBody}>
                      <View style={styles.rankTitleRow}>
                        <Text style={[styles.rankName, !unlocked && styles.rankNameLocked]}>{name}</Text>
                        <Text style={[styles.statusPill, isCurrent && styles.statusCurrent, completedTier && styles.statusComplete]}>{status}</Text>
                      </View>
                      <Text style={styles.requirement}>{minimum === 0 ? 'Starting rank' : `${minimum} completed adventure${minimum === 1 ? '' : 's'}`}</Text>
                      <Text style={[styles.rankMotto, !unlocked && styles.rankCopyLocked]}>{rankCopy[name].motto}</Text>
                      <Text style={[styles.rankDescription, !unlocked && styles.rankCopyLocked]}>{rankCopy[name].description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.noteCard}>
              <AppIcon name="adventure" color="#67CFC8" size={22} />
              <View style={styles.noteCopy}>
                <Text style={styles.noteTitle}>How ranks work</Text>
                <Text style={styles.noteText}>Ranks advance automatically as you complete official Melanated Adventurers adventures. Badges and stamps remain separate collectibles.</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 72, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111A17', borderWidth: 1, borderColor: '#28332F' },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#67CFC8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F7F8F3', fontSize: 34, lineHeight: 39, fontWeight: '900' },
  loader: { marginVertical: 36 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', borderRadius: 14, padding: 12 },
  heroCard: { backgroundColor: '#111A17', borderRadius: 24, borderWidth: 1, borderColor: '#34453D', padding: 17 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroBadge: { width: 116, height: 116, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroCopy: { flex: 1, minWidth: 0 },
  currentLabel: { color: '#67CFC8', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  currentRank: { color: '#F7F8F3', fontSize: 26, lineHeight: 30, fontWeight: '900', marginTop: 3 },
  motto: { color: '#C9D2CD', fontSize: 13, lineHeight: 18, marginTop: 4 },
  progressHeader: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  progressLabel: { color: '#D6DEDA', fontSize: 11.5, fontWeight: '800' },
  progressTarget: { color: '#67CFC8', fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 9, borderRadius: 99, backgroundColor: '#194B4B', overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#F5C341' },
  progressCopy: { color: '#9FB0A7', fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  gold: { color: '#F5C341', fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { color: '#F7F8F3', fontSize: 22, fontWeight: '900' },
  sectionMeta: { color: '#83938A', fontSize: 12, fontWeight: '800' },
  ladder: { gap: 10 },
  rankCard: { minHeight: 118, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#111A17', borderRadius: 20, borderWidth: 1, borderColor: '#28352F', padding: 12 },
  rankCardCurrent: { borderColor: '#F5C341', backgroundColor: '#18211D' },
  rankCardLocked: { backgroundColor: '#0C1411', borderColor: '#202A26' },
  rankArtWrap: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 },
  checkBadge: { position: 'absolute', right: 0, bottom: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#67CFC8', borderWidth: 2, borderColor: '#111A17', alignItems: 'center', justifyContent: 'center' },
  rankBody: { flex: 1, minWidth: 0 },
  rankTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  rankName: { flex: 1, color: '#F7F8F3', fontSize: 17, fontWeight: '900' },
  rankNameLocked: { color: '#748078' },
  statusPill: { color: '#7F8D85', fontSize: 8, fontWeight: '900', letterSpacing: .65, borderRadius: 999, borderWidth: 1, borderColor: '#39453F', paddingHorizontal: 7, paddingVertical: 4 },
  statusCurrent: { color: '#111A17', backgroundColor: '#F5C341', borderColor: '#F5C341' },
  statusComplete: { color: '#67CFC8', borderColor: '#34675F' },
  requirement: { color: '#67CFC8', fontSize: 10.5, fontWeight: '800', marginTop: 3 },
  rankMotto: { color: '#D5DDD9', fontSize: 12.5, fontWeight: '800', marginTop: 5 },
  rankDescription: { color: '#96A59D', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  rankCopyLocked: { color: '#667169' },
  noteCard: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: '#10221E', borderRadius: 17, borderWidth: 1, borderColor: '#29443C', padding: 14 },
  noteCopy: { flex: 1 },
  noteTitle: { color: '#F7F8F3', fontSize: 14, fontWeight: '900' },
  noteText: { color: '#9DAAA3', fontSize: 12, lineHeight: 18, marginTop: 3 },
});
