import { useFocusEffect } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useState } from 'react';
import { Image, useWindowDimensions, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { getMyPassportRank } from '../passport/rankApi';
import type { RankName } from '../passport/RankEmblem';
import { TrailheadOptimizedCover } from './TrailheadOptimizedCover';
import { backgroundFor, dayPhaseFor } from './trailheadBannerConfig';

type TrailheadCoverProps = Parameters<typeof TrailheadOptimizedCover>[0];

const RANK_CACHE_PREFIX = 'ma-trailhead-rank:v1:';
const VALID_RANKS: RankName[] = ['Explorer', 'Pathfinder', 'Trailblazer', 'Adventurer', 'Summit Seeker', 'Ascendant'];

function isRankName(value: unknown): value is RankName {
  return typeof value === 'string' && VALID_RANKS.includes(value as RankName);
}

export function TrailheadCover(props: TrailheadCoverProps) {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const userId = session?.user.id ?? null;
  const [effectiveRank, setEffectiveRank] = useState<RankName | null>(null);
  const [rankReady, setRankReady] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    const cacheKey = userId ? `${RANK_CACHE_PREFIX}${userId}` : null;

    const resolveRank = async () => {
      let cachedRank: RankName | null = null;

      if (cacheKey) {
        try {
          const cached = await Storage.getItem(cacheKey);
          if (isRankName(cached)) cachedRank = cached;
        } catch {
          // A cache miss should never block Trailhead.
        }
      }

      if (!active) return;
      if (cachedRank) {
        setEffectiveRank(cachedRank);
        setRankReady(true);
      }

      if (!userId) {
        setEffectiveRank(props.rank);
        setRankReady(true);
        return;
      }

      try {
        const rankState = await getMyPassportRank();
        if (!active) return;
        setEffectiveRank(rankState.effective_rank);
        setRankReady(true);
        if (cacheKey) void Storage.setItem(cacheKey, rankState.effective_rank).catch(() => undefined);
      } catch {
        if (!active) return;
        if (!cachedRank) setEffectiveRank(props.rank);
        setRankReady(true);
      }
    };

    void resolveRank();

    return () => {
      active = false;
    };
  }, [props.rank, userId]));

  const waitingForProfile = Boolean(userId) && props.displayName.trim() === 'Adventurer';
  const fallbackHeight = width < 370 ? 286 : width < 420 ? 300 : 318;

  if (!rankReady || !effectiveRank || waitingForProfile) {
    const fallbackBackground = backgroundFor(props.rank, 'clear', dayPhaseFor(null, new Date()));
    return (
      <View accessibilityLabel="Trailhead loading" style={{ height: fallbackHeight, borderRadius: 22, overflow: 'hidden', backgroundColor: '#10232A' }}>
        <Image source={fallbackBackground} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(5, 16, 20, 0.12)' }} />
      </View>
    );
  }

  return <TrailheadOptimizedCover {...props} rank={effectiveRank} />;
}
