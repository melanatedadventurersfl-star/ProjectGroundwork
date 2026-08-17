import { Image, type ImageSourcePropType, View } from 'react-native';

export type RankName = 'Explorer' | 'Pathfinder' | 'Trailblazer' | 'Wayfinder' | 'Summiteer' | 'Legacy Pathfinder';

const rankArtwork: Record<RankName, ImageSourcePropType> = {
  Explorer: require('../../assets/ranks/explorer.png'),
  Pathfinder: require('../../assets/ranks/pathfinder.png'),
  Trailblazer: require('../../assets/ranks/trailblazer.png'),
  Wayfinder: require('../../assets/ranks/wayfinder.png'),
  Summiteer: require('../../assets/ranks/summiteer.png'),
  'Legacy Pathfinder': require('../../assets/ranks/legacy-pathfinder.png'),
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
