import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getMyPassportRank } from '../passport/rankApi';
import { TrailheadCover as DynamicTrailheadCover } from './TrailheadDynamicCover';

type TrailheadCoverProps = Parameters<typeof DynamicTrailheadCover>[0];

export function TrailheadCover(props: TrailheadCoverProps) {
  const [effectiveRank, setEffectiveRank] = useState(props.rank);

  useFocusEffect(useCallback(() => {
    let active = true;
    setEffectiveRank(props.rank);
    void getMyPassportRank()
      .then((rankState) => {
        if (active) setEffectiveRank(rankState.effective_rank);
      })
      .catch(() => {
        if (active) setEffectiveRank(props.rank);
      });

    return () => {
      active = false;
    };
  }, [props.rank]));

  return <DynamicTrailheadCover {...props} rank={effectiveRank} />;
}
