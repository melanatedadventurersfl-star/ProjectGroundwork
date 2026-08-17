import { Image, View } from 'react-native';

export type RankName = 'Explorer' | 'Pathfinder' | 'Trailblazer' | 'Wayfinder' | 'Summiteer' | 'Legacy Pathfinder';

type SpriteCell = readonly [column: number, row: number];

/**
 * Approved rank artwork supplied for the Trailhead progression system.
 * The six transparent emblems are packed into one 3x2 sprite so the app
 * ships one optimized asset instead of six large source images.
 */
const RANK_SPRITE = require('../../assets/ranks/rank-sprite.webp');

const spriteCells: Record<RankName, SpriteCell> = {
  Explorer: [0, 0],
  Pathfinder: [1, 0],
  Trailblazer: [2, 0],
  Wayfinder: [0, 1],
  Summiteer: [1, 1],
  'Legacy Pathfinder': [2, 1],
};

export const rankLadder = [
  ['Explorer', 0],
  ['Pathfinder', 1],
  ['Trailblazer', 3],
  ['Wayfinder', 5],
  ['Summiteer', 10],
  ['Legacy Pathfinder', 20],
] as const;

export function rankFor(completedAdventures: number): RankName {
  return ([...rankLadder].reverse().find(([, minimum]) => completedAdventures >= minimum)?.[0] ?? 'Explorer') as RankName;
}

export function RankEmblem({ rank, size = 64, muted = false }: { rank: RankName; size?: number; muted?: boolean }) {
  const [column, row] = spriteCells[rank];

  return (
    <View
      accessibilityLabel={`${rank} rank emblem`}
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        opacity: muted ? 0.28 : 1,
      }}
    >
      <Image
        source={RANK_SPRITE}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: size * 3,
          height: size * 2,
          left: -column * size,
          top: -row * size,
        }}
      />
    </View>
  );
}
