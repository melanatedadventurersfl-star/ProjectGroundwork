import type { RankName } from '../passport/RankEmblem';
import explorer1 from './assets/explorerClearMorning.u1';
import explorer2 from './assets/explorerClearMorning.u2';
import pathfinderClear1 from './assets/pathfinderClearEvening.p1';
import pathfinderClear2 from './assets/pathfinderClearEvening.p2';
import pathfinderClear3 from './assets/pathfinderClearEvening.p3';
import pathfinderFog1 from './assets/pathfinderFogMorning.p1';
import pathfinderFog2 from './assets/pathfinderFogMorning.p2';
import trailblazer1 from './assets/trailblazerRain.p1';
import trailblazer2 from './assets/trailblazerRain.p2';
import adventurer1 from './assets/adventurerEvening.a1';
import adventurer2 from './assets/adventurerEvening.a2';
import adventurer3 from './assets/adventurerEvening.a3';
import summit1 from './assets/summitSeekerMorning.s1';
import summit2 from './assets/summitSeekerMorning.s2';
import summit3 from './assets/summitSeekerMorning.s3';
import ascendant1 from './assets/ascendantSnowNight.n1';
import ascendant2 from './assets/ascendantSnowNight.n2';
import ascendant3 from './assets/ascendantSnowNight.n3';

export type TrailheadWeatherTheme = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy';
export type TrailheadPhase = 'morning' | 'afternoon' | 'evening' | 'night';
export type TrailheadDisplayRank = 'Explorer' | 'Pathfinder' | 'Trailblazer' | 'Adventurer' | 'Summit Seeker' | 'Ascendant';

const jpg = (payload: string) => `data:image/jpeg;base64,${payload}`;

export const trailheadBannerAssets = {
  explorerClearMorning: jpg(explorer1 + explorer2),
  pathfinderClearEvening: jpg(pathfinderClear1 + pathfinderClear2 + pathfinderClear3),
  pathfinderFogMorning: jpg(pathfinderFog1 + pathfinderFog2),
  trailblazerRain: jpg(trailblazer1 + trailblazer2),
  adventurerEvening: jpg(adventurer1 + adventurer2 + adventurer3),
  summitSeekerMorning: jpg(summit1 + summit2 + summit3),
  ascendantSnowNight: jpg(ascendant1 + ascendant2 + ascendant3),
} as const;

export function trailheadDisplayRank(rank: RankName): TrailheadDisplayRank {
  switch (rank) {
    case 'Wayfinder': return 'Adventurer';
    case 'Summiteer': return 'Summit Seeker';
    case 'Legacy Pathfinder': return 'Ascendant';
    default: return rank;
  }
}

export function trailheadBackgroundFor(
  rank: RankName,
  weather: TrailheadWeatherTheme,
  phase: TrailheadPhase,
) {
  const displayRank = trailheadDisplayRank(rank);

  if (displayRank === 'Pathfinder') {
    if (weather === 'fog' || weather === 'rain' || weather === 'storm' || weather === 'cloudy' || weather === 'snow') {
      return trailheadBannerAssets.pathfinderFogMorning;
    }
    return trailheadBannerAssets.pathfinderClearEvening;
  }
  if (displayRank === 'Trailblazer' && (weather === 'rain' || weather === 'storm')) return trailheadBannerAssets.trailblazerRain;
  if (displayRank === 'Ascendant' && weather === 'snow') return trailheadBannerAssets.ascendantSnowNight;

  switch (displayRank) {
    case 'Explorer': return trailheadBannerAssets.explorerClearMorning;
    case 'Trailblazer': return trailheadBannerAssets.trailblazerRain;
    case 'Adventurer': return trailheadBannerAssets.adventurerEvening;
    case 'Summit Seeker': return trailheadBannerAssets.summitSeekerMorning;
    case 'Ascendant': return trailheadBannerAssets.ascendantSnowNight;
  }
}
