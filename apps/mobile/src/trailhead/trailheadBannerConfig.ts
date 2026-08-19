import type { ImageSourcePropType } from 'react-native';
import type { RankName } from '../passport/RankEmblem';
import type { WeatherForecast } from '../weather/api';
import { trailheadBackgroundFor } from './bannerAssets';

export type WeatherTheme='clear'|'partly-cloudy'|'cloudy'|'rain'|'storm'|'snow'|'fog'|'windy';
export type DayPhase='morning'|'afternoon'|'evening'|'night';
export type DisplayRank=RankName;
type RankTheme={accent:string;soft:string;glow:string};

const explorerClearMorning = require('../../assets/trailhead/explorer/explorer_clear_morning.png') as ImageSourcePropType;
const explorerClearAfternoon = require('../../assets/trailhead/explorer/explorer_clear_afternoon.png') as ImageSourcePropType;
const explorerClearEvening = require('../../assets/trailhead/explorer/explorer_clear_evening.png') as ImageSourcePropType;
const explorerClearNight = require('../../assets/trailhead/explorer/explorer_clear_night.png') as ImageSourcePropType;
const explorerCloudy = require('../../assets/trailhead/explorer/explorer_cloudy_daytime.png') as ImageSourcePropType;
const explorerRain = require('../../assets/trailhead/explorer/explorer_rain_daytime.png') as ImageSourcePropType;
const explorerStorm = require('../../assets/trailhead/explorer/explorer_storm_daytime.png') as ImageSourcePropType;

const pathfinderClearMorning = require('../../assets/trailhead/pathfinder/pathfinder-clear-morning.png') as ImageSourcePropType;
const pathfinderClearAfternoon = require('../../assets/trailhead/pathfinder/pathfinder-clear-afternoon.png') as ImageSourcePropType;
const pathfinderClearEvening = require('../../assets/trailhead/pathfinder/pathfinder-clear-evening.png') as ImageSourcePropType;
const pathfinderClearNight = require('../../assets/trailhead/pathfinder/pathfinder-clear-night.png') as ImageSourcePropType;
const pathfinderCloudy = require('../../assets/trailhead/pathfinder/pathfinder-cloudy.png') as ImageSourcePropType;
const pathfinderRain = require('../../assets/trailhead/pathfinder/pathfinder-rain.png') as ImageSourcePropType;
const pathfinderStorm = require('../../assets/trailhead/pathfinder/pathfinder-storm.png') as ImageSourcePropType;

const trailblazerClearMorning = require('../../assets/trailhead/Trailblazer/trailblazer_clear_morning.png') as ImageSourcePropType;
const trailblazerClearAfternoon = require('../../assets/trailhead/Trailblazer/trailblazer_clear_afternoon.png') as ImageSourcePropType;
const trailblazerClearEvening = require('../../assets/trailhead/Trailblazer/trailblazer_clear_evening.png') as ImageSourcePropType;
const trailblazerClearNight = require('../../assets/trailhead/Trailblazer/trailblazer_clear_night.png') as ImageSourcePropType;
const trailblazerCloudy = require('../../assets/trailhead/Trailblazer/trailblazer_cloudy_daytime.png') as ImageSourcePropType;
const trailblazerRain = require('../../assets/trailhead/Trailblazer/trailblazer_rain_daytime.png') as ImageSourcePropType;
const trailblazerStorm = require('../../assets/trailhead/Trailblazer/trailblazer_storm_daytime.png') as ImageSourcePropType;

export const trailheadDebugOverride: { enabled: boolean; phase?: DayPhase; weather?: WeatherTheme } = {
  enabled: false,
};

export const displayRankByRank:Record<RankName,DisplayRank>={Explorer:'Explorer',Pathfinder:'Pathfinder',Trailblazer:'Trailblazer',Adventurer:'Adventurer','Summit Seeker':'Summit Seeker',Ascendant:'Ascendant'};
export const rankThemes:Record<DisplayRank,RankTheme>={Explorer:{accent:'#37AFFF',soft:'#D9F3FF',glow:'rgba(55,175,255,0.26)'},Pathfinder:{accent:'#9BE33D',soft:'#E7FFC5',glow:'rgba(155,227,61,0.24)'},Trailblazer:{accent:'#FF453A',soft:'#FFD1CD',glow:'rgba(255,69,58,0.24)'},Adventurer:{accent:'#D88A34',soft:'#FFE0B8',glow:'rgba(216,138,52,0.24)'},'Summit Seeker':{accent:'#F2C34B',soft:'#FFF0A6',glow:'rgba(242,195,75,0.24)'},Ascendant:{accent:'#B65CFF',soft:'#F0D5FF',glow:'rgba(182,92,255,0.26)'}};

export function normalizeWeather(text=''):WeatherTheme{const v=text.toLowerCase();if(/thunder|storm|lightning|torrential/.test(v))return'storm';if(/snow|sleet|blizzard|ice|freezing/.test(v))return'snow';if(/rain|drizzle|shower/.test(v))return'rain';if(/fog|mist|haze|smoke|dust|sand/.test(v))return'fog';if(/wind/.test(v))return'windy';if(/overcast/.test(v))return'cloudy';if(/partly|partially|cloud/.test(v))return'partly-cloudy';return'clear'}

function hourForLocation(weather:WeatherForecast|null,now:Date){
  const timeZone=weather?.location.tz_id;
  if(timeZone){
    try{
      const formatted=new Intl.DateTimeFormat('en-US',{timeZone,hour:'2-digit',hourCycle:'h23'}).format(now);
      const parsed=Number(formatted);
      if(Number.isFinite(parsed)) return parsed;
    }catch{
      // Fall through to the device clock if a platform cannot resolve the API timezone.
    }
  }
  return now.getHours();
}

export function dayPhaseFor(weather:WeatherForecast|null,now=new Date()):DayPhase{const h=hourForLocation(weather,now);return h>=5&&h<12?'morning':h>=12&&h<17?'afternoon':h>=17&&h<21?'evening':'night'}
export function greetingFor(p:DayPhase){return p==='morning'?'Good morning':p==='afternoon'?'Good afternoon':p==='evening'?'Good evening':'Good night'}
export function weatherCopy(w:WeatherTheme,p:DayPhase){if(w==='storm')return'Storms nearby. Consider delaying outdoor plans.';if(w==='rain')return'Rain possible nearby. Bring a rain jacket.';if(w==='snow')return'Snowy conditions. Watch for slippery trails.';if(w==='fog')return'Low visibility. Use extra caution outdoors.';if(w==='windy')return'Windy conditions. Secure loose gear.';if(w==='cloudy')return'Cloudy skies and cooler conditions.';if(w==='partly-cloudy')return p==='evening'?'Golden hour on the trail.':'Clouds drifting across the trail.';return p==='night'?'The trail settles under moonlight.':p==='evening'?'Perfect evening for a local hike.':p==='morning'?'Fresh air. New day. New trails.':'Perfect weather for a local adventure.'}
export function glyph(w:WeatherTheme,p:DayPhase){if(w==='clear')return p==='night'?'☾':'☀';if(w==='partly-cloudy')return'🌤';return({storm:'⚡',rain:'🌧',snow:'❄',fog:'≋',windy:'〰',cloudy:'☁'} as const)[w]}

function curatedRankBackground(
  w:WeatherTheme,
  p:DayPhase,
  assets:{
    morning:ImageSourcePropType;
    afternoon:ImageSourcePropType;
    evening:ImageSourcePropType;
    night:ImageSourcePropType;
    cloudy:ImageSourcePropType;
    rain:ImageSourcePropType;
    storm:ImageSourcePropType;
  },
):ImageSourcePropType {
  if (w === 'storm') return assets.storm;
  if (w === 'rain') return assets.rain;
  if (w === 'cloudy' || w === 'partly-cloudy' || w === 'fog' || w === 'windy' || w === 'snow') return assets.cloudy;
  if (p === 'morning') return assets.morning;
  if (p === 'afternoon') return assets.afternoon;
  if (p === 'evening') return assets.evening;
  return assets.night;
}

function explorerBackground(w:WeatherTheme,p:DayPhase):ImageSourcePropType {
  return curatedRankBackground(w,p,{
    morning: explorerClearMorning,
    afternoon: explorerClearAfternoon,
    evening: explorerClearEvening,
    night: explorerClearNight,
    cloudy: explorerCloudy,
    rain: explorerRain,
    storm: explorerStorm,
  });
}

function pathfinderBackground(w:WeatherTheme,p:DayPhase):ImageSourcePropType {
  return curatedRankBackground(w,p,{
    morning: pathfinderClearMorning,
    afternoon: pathfinderClearAfternoon,
    evening: pathfinderClearEvening,
    night: pathfinderClearNight,
    cloudy: pathfinderCloudy,
    rain: pathfinderRain,
    storm: pathfinderStorm,
  });
}

function trailblazerBackground(w:WeatherTheme,p:DayPhase):ImageSourcePropType {
  return curatedRankBackground(w,p,{
    morning: trailblazerClearMorning,
    afternoon: trailblazerClearAfternoon,
    evening: trailblazerClearEvening,
    night: trailblazerClearNight,
    cloudy: trailblazerCloudy,
    rain: trailblazerRain,
    storm: trailblazerStorm,
  });
}

export function backgroundFor(rank:RankName,w:WeatherTheme,p:DayPhase):ImageSourcePropType{
  if(rank==='Explorer') return explorerBackground(w,p);
  if(rank==='Pathfinder') return pathfinderBackground(w,p);
  if(rank==='Trailblazer') return trailblazerBackground(w,p);
  return {uri: trailheadBackgroundFor(rank,w,p)};
}