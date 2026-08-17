import clearNight from '../weather/assets/clearNight';
import drizzle from '../weather/assets/drizzle';
import fog from '../weather/assets/fog';
import partlyCloudy from '../weather/assets/partlyCloudy';
import explorerHighRes from './assets/explorerHighRes';

/**
 * Explorer Level 0 background contract.
 *
 * These keys are intentionally stable so the artwork can be swapped without
 * changing Trailhead resolver logic. The generated shoreline art is the visual
 * source of truth; until each production image is checked into the repo, the
 * matching existing weather asset is used as a safe fallback.
 */
export const explorerBannerAssets = {
  clearMorning: { uri: explorerHighRes },
  partlyCloudyAfternoon: { uri: partlyCloudy },
  fogMorning: { uri: fog },
  rain: { uri: drizzle },
  night: { uri: clearNight },
} as const;

export type ExplorerBannerAssetKey = keyof typeof explorerBannerAssets;
