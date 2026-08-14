export type GeoPoint = { latitude: number; longitude: number };

const CITY_POINTS: Record<string, GeoPoint> = {
  'jacksonville,fl': { latitude: 30.3322, longitude: -81.6557 },
  'jacksonville beach,fl': { latitude: 30.2947, longitude: -81.3931 },
  'atlantic beach,fl': { latitude: 30.3344, longitude: -81.3987 },
  'neptune beach,fl': { latitude: 30.3119, longitude: -81.3965 },
  'st. augustine,fl': { latitude: 29.9012, longitude: -81.3124 },
  'saint augustine,fl': { latitude: 29.9012, longitude: -81.3124 },
  'orange park,fl': { latitude: 30.1661, longitude: -81.7065 },
  'fernandina beach,fl': { latitude: 30.6697, longitude: -81.4626 },
  'gainesville,fl': { latitude: 29.6516, longitude: -82.3248 },
  'tallahassee,fl': { latitude: 30.4383, longitude: -84.2807 },
  'orlando,fl': { latitude: 28.5383, longitude: -81.3792 },
  'tampa,fl': { latitude: 27.9506, longitude: -82.4572 },
  'miami,fl': { latitude: 25.7617, longitude: -80.1918 },
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
