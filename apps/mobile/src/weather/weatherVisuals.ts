import clearDay from './assets/clearDay';
import clearNight from './assets/clearNight';
import dawn from './assets/dawn';
import drizzle from './assets/drizzle';
import fog from './assets/fog';
import overcast from './assets/overcast';
import partlyCloudy from './assets/partlyCloudy';
import storm from './assets/storm';

export type WeatherVisualPhase = 'dawn' | 'day' | 'dusk' | 'night';

export function weatherVisualFor(conditionText: string, isDay = true, phase?: WeatherVisualPhase) {
  const text = conditionText.toLowerCase();
  const resolvedPhase = phase ?? (isDay ? 'day' : 'night');

  if (/thunder|storm|torrential|heavy rain/.test(text)) return storm;
  if (/rain|drizzle|shower/.test(text)) return drizzle;
  if (/mist|fog|haze|smoke|dust|sand/.test(text)) return fog;
  if (/partly|partially|sunny intervals/.test(text)) return partlyCloudy;
  if (/cloud|overcast|snow|sleet|freezing|ice/.test(text)) return overcast;
  if (/sunny|clear/.test(text)) {
    if (resolvedPhase === 'night') return clearNight;
    if (resolvedPhase === 'dawn' || resolvedPhase === 'dusk') return dawn;
    return clearDay;
  }

  if (resolvedPhase === 'night') return clearNight;
  if (resolvedPhase === 'dawn' || resolvedPhase === 'dusk') return dawn;
  return partlyCloudy;
}
