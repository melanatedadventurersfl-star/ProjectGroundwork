export type GeoPoint = { latitude: number; longitude: number };

const CITY_POINTS: Record<string, GeoPoint> = {
  'jacksonville,fl': { latitude: 30.3322, longitude: -81.6557 },
  'jacksonville beach,fl': { latitude: 30.2947, longitude: -81.3931 },
  'atlantic beach,fl': { latitude: 30.3344, longitude: -81.3987 },
  'neptune beach,fl': { latitude: 30.3119, longitude: -81.3965 },
  'st. augustine,fl': { latitude: 29.9012, longitude: -81.3124 },
  'saint augustine,fl': { latitude: 29.9012, longitude: -81.3124 },
  'fernandina beach,fl': { latitude: 30.6697, longitude: -81.4626 },
  'orange park,fl': { latitude: 30.1661, longitude: -81.7065 },
  'gainesville,fl': { latitude: 29.6516, longitude: -82.3248 },
  'ocala,fl': { latitude: 29.1872, longitude: -82.1401 },
  'tallahassee,fl': { latitude: 30.4383, longitude: -84.2807 },
  'pensacola,fl': { latitude: 30.4213, longitude: -87.2169 },
  'destin,fl': { latitude: 30.3935, longitude: -86.4958 },
  'panama city,fl': { latitude: 30.1588, longitude: -85.6602 },
  'orlando,fl': { latitude: 28.5383, longitude: -81.3792 },
  'kissimmee,fl': { latitude: 28.2920, longitude: -81.4076 },
  'tampa,fl': { latitude: 27.9506, longitude: -82.4572 },
  'st. petersburg,fl': { latitude: 27.7676, longitude: -82.6403 },
  'saint petersburg,fl': { latitude: 27.7676, longitude: -82.6403 },
  'clearwater,fl': { latitude: 27.9659, longitude: -82.8001 },
  'sarasota,fl': { latitude: 27.3364, longitude: -82.5307 },
  'fort myers,fl': { latitude: 26.6406, longitude: -81.8723 },
  'naples,fl': { latitude: 26.1423, longitude: -81.7948 },
  'west palm beach,fl': { latitude: 26.7153, longitude: -80.0534 },
  'fort lauderdale,fl': { latitude: 26.1224, longitude: -80.1373 },
  'miami,fl': { latitude: 25.7617, longitude: -80.1918 },
  'key west,fl': { latitude: 24.5551, longitude: -81.7800 },
};

function normalize(value: string) {
  return value.toLowerCase().replace(/florida/g, 'fl').replace(/\s+/g, ' ').trim();
}

export function pointForCity(city: string, state: string): GeoPoint | null {
  return CITY_POINTS[`${normalize(city)},${normalize(state)}`] ?? null;
}

export function resolveSearchCenter(search: string, fallbackCity?: string, fallbackState?: string): GeoPoint | null {
  const normalized = normalize(search);
  if (normalized) {
    for (const [key, point] of Object.entries(CITY_POINTS)) {
      const parts = key.split(',');
      const city = parts[0];
      const state = parts[1];
      if (!city || !state) continue;
      if (normalized.includes(city) && (normalized.includes(state) || normalized.includes('fl'))) return point;
    }

    // A non-empty query that is not a recognized city is a keyword search.
    // Do not silently fall back to the member's home city, because that makes
    // unrelated adventures/events appear to match the typed keyword.
    return null;
  }

  return fallbackCity && fallbackState ? pointForCity(fallbackCity, fallbackState) : null;
}

export function distanceMiles(a: GeoPoint, b: GeoPoint) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthMiles = 3958.8;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthMiles * Math.asin(Math.sqrt(hav));
}
