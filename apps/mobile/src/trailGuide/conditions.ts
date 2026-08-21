import type { TrailGuidePlace } from './catalog';
import type { WeatherForecast } from '../weather/api';

export type TrailGuideConditionSignal = {
  label: string;
  detail: string;
  tone: 'good' | 'caution' | 'neutral';
  score: number;
};

function includesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function getTrailGuideConditionSignal(place: TrailGuidePlace, weather?: WeatherForecast | null): TrailGuideConditionSignal {
  if (!weather) return { label: 'Check conditions', detail: 'Live weather unavailable', tone: 'neutral', score: 0 };

  const current = weather.current;
  const today = weather.forecast.forecastday[0]?.day;
  const text = `${current.condition.text} ${today?.condition.text ?? ''}`;
  const rainChance = today?.daily_chance_of_rain ?? 0;
  const feels = current.feelslike_f;
  const wind = current.wind_mph;
  const stormy = includesAny(text, ['thunder', 'storm', 'tornado']);
  const rainy = includesAny(text, ['rain', 'shower', 'drizzle']) || rainChance >= 65;
  const veryHot = feels >= 100;
  const hot = feels >= 92;

  if (stormy) return { label: 'Storm risk', detail: 'Choose a flexible or indoor backup', tone: 'caution', score: -5 };
  if (place.category === 'Water' && wind >= 20) return { label: 'Wind caution', detail: `${Math.round(wind)} mph wind`, tone: 'caution', score: -3 };
  if (place.category === 'Hiking' && veryHot) return { label: 'Heat caution', detail: `Feels like ${Math.round(feels)}°`, tone: 'caution', score: -3 };
  if (place.category === 'Water' && hot && !rainy) return { label: 'Good for today', detail: `Feels like ${Math.round(feels)}°`, tone: 'good', score: 4 };
  if ((place.category === 'Parks' || place.category === 'Scenic') && !rainy && !veryHot) return { label: 'Good for today', detail: current.condition.text, tone: 'good', score: 3 };
  if (place.category === 'Hiking' && !rainy && feels < 92) return { label: 'Good trail weather', detail: current.condition.text, tone: 'good', score: 4 };
  if (rainy) return { label: 'Rain possible', detail: `${Math.round(rainChance)}% chance today`, tone: 'caution', score: -2 };
  if (veryHot) return { label: 'Heat caution', detail: `Feels like ${Math.round(feels)}°`, tone: 'caution', score: -2 };

  return { label: 'Conditions look workable', detail: current.condition.text, tone: 'neutral', score: 1 };
}
