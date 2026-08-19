import { Image, type ImageSourcePropType } from 'react-native';

export type LegacyStampCode =
  | 'legacy-event-2025-group-launch'
  | 'legacy-event-2025-huguenot-camping'
  | 'legacy-event-2025-float-out'
  | 'legacy-event-2025-black-breezy'
  | 'legacy-event-2025-fire-dragon'
  | 'legacy-event-2025-wet-wild'
  | 'legacy-event-2026-beach-escape'
  | 'legacy-event-2026-float-out-juneteenth'
  | 'legacy-event-2026-champs'
  | 'legacy-event-2026-splash-after-dark';

type StampAsset = {
  source: ImageSourcePropType;
};

const stampAssets: Record<LegacyStampCode, StampAsset> = {
  'legacy-event-2025-group-launch': {
    source: require('../../assets/stamps/2025-group-launch.png'),
  },
  'legacy-event-2025-huguenot-camping': {
    source: require('../../assets/stamps/2025-huguenot-camping.png'),
  },
  'legacy-event-2025-float-out': {
    source: require('../../assets/stamps/2025-float-out.png'),
  },
  'legacy-event-2025-black-breezy': {
    source: require('../../assets/stamps/2025-black-breezy.png'),
  },
  'legacy-event-2025-fire-dragon': {
    source: require('../../assets/stamps/2025-fire-dragon.png'),
  },
  'legacy-event-2025-wet-wild': {
    source: require('../../assets/stamps/2025-wet-wild.png'),
  },
  'legacy-event-2026-beach-escape': {
    source: require('../../assets/stamps/2026-beach-escape.png'),
  },
  'legacy-event-2026-float-out-juneteenth': {
    source: require('../../assets/stamps/2026-float-out-juneteenth.png'),
  },
  'legacy-event-2026-champs': {
    source: require('../../assets/stamps/2026-champs-summer-session.png'),
  },
  'legacy-event-2026-splash-after-dark': {
    source: require('../../assets/stamps/2026-splash-after-dark.png'),
  },
};

export function isLegacyStampCode(code: string | null | undefined): code is LegacyStampCode {
  return !!code && code in stampAssets;
}

export function StampArt({ code, width = 150 }: { code: LegacyStampCode; width?: number }) {
  const stamp = stampAssets[code];
  return (
    <Image
      source={stamp.source}
      style={{ width, height: width * 1.28 }}
      resizeMode="contain"
    />
  );
}
