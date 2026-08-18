import { Image, type ImageSourcePropType, View } from 'react-native';

export type RankName = 'Explorer' | 'Pathfinder' | 'Trailblazer' | 'Adventurer' | 'Summit Seeker' | 'Ascendant';

const rankArtwork: Record<RankName, ImageSourcePropType> = {
  Explorer: require('../../assets/ranks/explorer.png'),
  Pathfinder: require('../../assets/ranks/pathfinder.png'),
  Trailblazer: require('../../assets/ranks/trailblazer.png'),
  Adventurer: require('../../assets/ranks/adventurer.png'),
  'Summit Seeker': require('../../assets/ranks/summit-seeker.png'),
  Ascendant: require('../../assets/ranks/ascendant.png'),
};

export const rankLadder = [
  ['Explorer', 0],
  ['Pathfinder', 1],
  ['Trailblazer', 3],
  ['Adventurer', 5],
  ['Summit Seeker', 10],
  ['Ascendant', 20],
] as const;

export function rankFor(completedAdventures: number): RankName {
  return ([...rankLadder].reverse().find(([, minimum]) => completedAdventures >= minimum)?.[0] ?? 'Explorer') as RankName;
}

export function RankEmblem({ rank, size = 64, muted = false }: { rank: RankName; size?: number; muted?: boolean }) {
  return (
    <View
      accessibilityLabel={`${rank} rank emblem`}
      style={{
        width: size,
        height: size,
        opacity: muted ? 0.28 : 1,
      }}
    >
      <Image
        source={rankArtwork[rank]}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}
