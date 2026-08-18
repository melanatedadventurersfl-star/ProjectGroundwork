import type { ImageSourcePropType } from 'react-native';
import type { RankName } from '../passport/RankEmblem';
import type { WeatherForecast } from '../weather/api';
import clearNight from '../weather/assets/clearNight';
import drizzle from '../weather/assets/drizzle';
import overcast from '../weather/assets/overcast';
import storm from '../weather/assets/storm';
import { trailheadBackgroundFor } from './bannerAssets';

export type WeatherTheme='clear'|'partly-cloudy'|'cloudy'|'rain'|'storm'|'snow'|'fog'|'windy';
export type DayPhase='morning'|'afternoon'|'evening'|'night';
export type DisplayRank='Explorer'|'Pathfinder'|'Trailblazer'|'Adventurer'|'Summit Seeker'|'Ascendant';
type RankTheme={accent:string;soft:string;glow:string};

const pathfinderNativeScene = require('../../assets/trailhead/pathfinder/pathfinder-clear-evening.jpg') as ImageSourcePropType;

// Kept as a QA hook, but production uses live GPS/weather/time unless explicitly enabled.
export const trailheadDebugOverride: { enabled: boolean; phase?: DayPhase; weather?: WeatherTheme } = {
  enabled: false,
};

export const displayRankByRank:Record<RankName,DisplayRank>={Explorer:'Explorer',Pathfinder:'Pathfinder',Trailblazer:'Trailblazer',Wayfinder:'Adventurer',Summiteer:'Summit Seeker','Legacy Pathfinder':'Ascendant'};
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
export function weatherCopy(w:WeatherTheme,p:DayPhase){if(w==='storm')return'Storms nearby · use caution outdoors.';if(w==='rain')return'Rain nearby · pack a shell.';if(w==='snow')return'Snowy conditions · tread carefully.';if(w==='fog')return'Low visibility · stay aware.';if(w==='windy')return'Windy on the trail · secure loose gear.';if(w==='cloudy')return'Cloud cover makes for a cooler outing.';if(w==='partly-cloudy')return p==='evening'?'Golden hour on the trail.':'Clouds drifting across the trail.';return p==='night'?'The trail settles under moonlight.':p==='evening'?'Perfect evening for a local hike.':p==='morning'?'Fresh air. New day. New trails.':'Perfect weather for a local adventure.'}
export function glyph(w:WeatherTheme,p:DayPhase){if(w==='clear')return p==='night'?'☾':'☀';if(w==='partly-cloudy')return'🌤';return({storm:'⚡',rain:'🌧',snow:'❄',fog:'≋',windy:'〰',cloudy:'☁'} as const)[w]}

function explorerBackground(w:WeatherTheme,p:DayPhase):ImageSourcePropType {
  if (p === 'night') return { uri: clearNight };
  if (w === 'partly-cloudy') return require('../../assets/trailhead/explorer/explorer-partly-cloudy-afternoon.jpg');
  if (w === 'storm') return { uri: storm };
  if (w === 'rain' || w === 'fog') return { uri: drizzle };
  if (w === 'cloudy' || w === 'windy' || w === 'snow') return { uri: overcast };
  return require('../../assets/trailhead/explorer/explorer-clear-morning.jpg');
}

function pathfinderBackground(_w:WeatherTheme,_p:DayPhase):ImageSourcePropType {
  // Stability rule: Pathfinder never routes through data URIs or generated base64 modules.
  // Weather and time still drive greeting/copy/atmosphere while the native scene remains reliable.
  return pathfinderNativeScene;
}

export function backgroundFor(rank:RankName,w:WeatherTheme,p:DayPhase):ImageSourcePropType{
  if(rank==='Explorer') return explorerBackground(w,p);
  if(rank==='Pathfinder') return pathfinderBackground(w,p);
  return {uri: trailheadBackgroundFor(rank,w,p)};
}
