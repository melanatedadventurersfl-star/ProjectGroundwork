import { supabase } from '../lib/supabase';

/**
 * Weather data returned by our Supabase Edge Function.
 *
 * The mobile app never calls WeatherAPI directly. Keeping the third-party
 * request behind Supabase protects WEATHERAPI_KEY from the app bundle.
 */
export type WeatherCondition = {
  text: string;
  icon: string;
  code?: number;
};

export type WeatherHour = {
  time: string;
  temp_f: number;
  feelslike_f?: number;
  chance_of_rain?: number;
  humidity?: number;
  wind_mph?: number;
  uv?: number;
  is_day?: number;
  condition: WeatherCondition;
};

export type WeatherForecastDay = {
  date: string;
  day: {
    maxtemp_f: number;
    mintemp_f: number;
    daily_chance_of_rain: number;
    uv?: number;
    condition: WeatherCondition;
  };
  astro?: {
    sunrise?: string;
    sunset?: string;
  };
  hour?: WeatherHour[];
};

export type WeatherForecast = {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    localtime: string;
    tz_id?: string;
  };
  current: {
    temp_f: number;
    feelslike_f: number;
    humidity: number;
    wind_mph: number;
    uv?: number;
    precip_in?: number;
    is_day?: number;
    condition: WeatherCondition;
  };
  forecast: {
    forecastday: WeatherForecastDay[];
  };
};

export type WeatherLocationSuggestion = {
  id: number;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
};

async function invokeWeather<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('weather', { body });

  if (error) throw new Error(error.message || 'Unable to load weather.');
  if (!data) throw new Error('Weather service returned no data.');

  return data;
}

/** Load the supported three-day forecast for a home city/state. */
export function getWeather(city: string, state: string, days = 3) {
  return invokeWeather<WeatherForecast>({ q: `${city},${state}`, days });
}

/** Load weather from a temporary city, ZIP code, or normalized location query. */
export function getWeatherByQuery(query: string, days = 3) {
  return invokeWeather<WeatherForecast>({ q: query.trim(), days });
}

/** Load weather by coordinates without changing the member profile. */
export function getWeatherByCoordinates(latitude: number, longitude: number, days = 3) {
  return invokeWeather<WeatherForecast>({ q: `${latitude},${longitude}`, days });
}

/** Load destination weather, preferring precise adventure coordinates. */
export function getAdventureWeather(location: {
  latitude?: number | null;
  longitude?: number | null;
  city: string;
  state: string;
}, days = 3) {
  if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
    return getWeatherByCoordinates(location.latitude, location.longitude, days);
  }
  return getWeather(location.city, location.state, days);
}

/** Ask the weather proxy for normalized city or ZIP-code suggestions. */
export async function searchWeatherLocations(query: string) {
  const rows = await invokeWeather<WeatherLocationSuggestion[]>({ mode: 'search', q: query });
  return rows.map((row) => ({
    ...row,
    country: /united states|u\.s\.|usa/i.test(row.country) ? 'United States' : row.country,
  }));
}
