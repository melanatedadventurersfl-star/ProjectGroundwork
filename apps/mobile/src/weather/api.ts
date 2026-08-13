import { supabase } from '../lib/supabase';

/**
 * Weather data returned by our Supabase Edge Function.
 *
 * The mobile app never calls WeatherAPI directly. Keeping the third-party
 * request behind Supabase protects WEATHERAPI_KEY from the app bundle.
 */
export type WeatherForecast = {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    localtime: string;
  };
  current: {
    temp_f: number;
    feelslike_f: number;
    humidity: number;
    wind_mph: number;
    condition: {
      text: string;
      icon: string;
    };
  };
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_f: number;
        mintemp_f: number;
        daily_chance_of_rain: number;
        condition: {
          text: string;
          icon: string;
        };
      };
    }>;
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

/** Load a three-day forecast for a saved city/state. */
export function getWeather(city: string, state: string, days = 3) {
  return invokeWeather<WeatherForecast>({ q: `${city},${state}`, days });
}

/** Load weather by transient device coordinates without changing the profile. */
export function getWeatherByCoordinates(latitude: number, longitude: number, days = 3) {
  return invokeWeather<WeatherForecast>({ q: `${latitude},${longitude}`, days });
}

/**
 * Ask the weather proxy for normalized city suggestions.
 * Used by Edit Profile so values such as "JVille" never become profile data.
 */
export function searchWeatherLocations(query: string) {
  return invokeWeather<WeatherLocationSuggestion[]>({ mode: 'search', q: query });
}
