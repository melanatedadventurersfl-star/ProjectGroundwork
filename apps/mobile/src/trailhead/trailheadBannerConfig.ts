import type { ImageSourcePropType } from 'react-native';
import type { RankName } from '../passport/RankEmblem';
import type { WeatherForecast } from '../weather/api';

export type WeatherTheme = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy';
export type DayPhase = 'morning' | 'afternoon' | 'evening' | 'night';
export type DisplayRank = 'Explorer' | 'Pathfinder' | 'Trailblazer' | 'Adventurer' | 'Summit Seeker' | 'Ascendant';
export type RankTheme = { accent: string; soft: string; glow: string };

export const displayRankByRank: Record<RankName, DisplayRank> = {
  Explorer: 'Explorer', Pathfinder: 'Pathfinder', Trailblazer: 'Trailblazer',
  Wayfinder: 'Adventurer', Summiteer: 'Summit Seeker', 'Legacy Pathfinder': 'Ascendant',
};

export const rankThemes: Record<DisplayRank, RankTheme> = {
  Explorer: { accent: '#37AFFF', soft: '#D9F3FF', glow: 'rgba(55,175,255,0.26)' },
  Pathfinder: { accent: '#9BE33D', soft: '#E7FFC5', glow: 'rgba(155,227,61,0.24)' },
  Trailblazer: { accent: '#FF453A', soft: '#FFD1CD', glow: 'rgba(255,69,58,0.24)' },
  Adventurer: { accent: '#D88A34', soft: '#FFE0B8', glow: 'rgba(216,138,52,0.24)' },
  'Summit Seeker': { accent: '#F2C34B', soft: '#FFF0A6', glow: 'rgba(242,195,75,0.24)' },
  Ascendant: { accent: '#B65CFF', soft: '#F0D5FF', glow: 'rgba(182,92,255,0.26)' },
};

const assets = {
  explorer: require('../../assets/trailhead-banners/explorer-clear-morning.jpg') as ImageSourcePropType,
  pathfinder: require('../../assets/trailhead-banners/pathfinder-clear-evening.jpg') as ImageSourcePropType,
  pathfinderFog: require('../../assets/trailhead-banners/pathfinder-fog-morning.jpg') as ImageSourcePropType,
  trailblazer: require('../../assets/trailhead-banners/trailblazer-rain.jpg') as ImageSourcePropType,
  adventurer: require('../../assets/trailhead-banners/adventurer-evening.jpg') as ImageSourcePropType,
  summit: require('../../assets/trailhead-banners/summit-seeker-morning.jpg') as ImageSourcePropType,
  ascendant: require('../../assets/trailhead-banners/ascendant-snow-night.jpg') as ImageSourcePropType,
};

export function normalizeWeather(text = ''): WeatherTheme {
  const v = text.toLowerCase();
  if (/thunder|storm|lightning|torrential/.test(v)) return 'storm';
  if (/snow|sleet|blizzard|ice|freezing/.test(v)) return 'snow';
  if (/rain|drizzle|shower/.test(v)) return 'rain';
  if (/fog|mist|haze|smoke|dust|sand/.test(v)) return 'fog';
  if (/wind/.test(v)) return 'windy';
  if (/overcast/.test(v)) return 'cloudy';
  if (/partly|partially|cloud/.test(v)) return 'partly-cloudy';
  return 'clear';
}

export function dayPhaseFor(weather: WeatherForecast | null): DayPhase {
  const match = weather?.location.localtime?.match(/(?:T|\s)(\d{1,2}):/);
  const hour = match ? Number(match[1]) : new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function greetingFor(p: DayPhase) {
  return p === 'morning' ? 'Good morning' : p === 'afternoon' ? 'Good afternoon' : p === 'evening' ? 'Good evening' : 'Good night';
}

export function weatherCopy(w: WeatherTheme, p: DayPhase) {
  if (w === 'storm') return 'Storms nearby · use caution outdoors.';
  if (w === 'rain') return 'Rain nearby · pack a shell.';
  if (w === 'snow') return 'Snowy conditions · tread carefully.';
  if (w === 'fog') return 'Low visibility · stay aware.';
  if (w === 'windy') return 'Windy on the trail · secure loose gear.';
  if (w === 'cloudy') return 'Cloud cover makes for a cooler outing.';
  if (w === 'partly-cloudy') return p === 'evening' ? 'Golden hour on the trail.' : 'Clouds drifting across the trail.';
  if (p === 'night') return 'The mountain calls.';
  if (p === 'evening') return 'Perfect evening for a local hike.';
  if (p === 'morning') return 'Fresh air. New day. New trails.';
  return 'Perfect weather for a local adventure.';
}

export function glyph(w: WeatherTheme, p: DayPhase) {
  if (w === 'clear') return p === 'night' ? '☾' : '☀';
  if (w === 'partly-cloudy') return '🌤';
  return ({ storm: '⚡', rain: '🌧', snow: '❄', fog: '≋', windy: '〰', cloudy: '☁' } as const)[w];
}

export function backgroundFor(rank: RankName, w: WeatherTheme, p: DayPhase): ImageSourcePropType {
  const d = displayRankByRank[rank];
  if (d === 'Pathfinder' && w === 'fog') return assets.pathfinderFog;
  if (d === 'Trailblazer') return assets.trailblazer;
  if (d === 'Adventurer') return assets.adventurer;
  if (d === 'Summit Seeker') return assets.summit;
  if (d === 'Ascendant') return assets.ascendant;
  if (d === 'Pathfinder') return assets.pathfinder;
  return assets.explorer;
}
