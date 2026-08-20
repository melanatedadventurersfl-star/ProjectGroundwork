import type { ImageSourcePropType } from 'react-native';

export type TrailGuideCity = {
  key: string;
  label: string;
  latitude: number;
  longitude: number;
  source: ImageSourcePropType;
};

export const TRAIL_GUIDE_DEFAULT_BACKGROUND: ImageSourcePropType = {
  uri: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=82',
};

export const TRAIL_GUIDE_CITIES: TrailGuideCity[] = [
  { key: 'jacksonville', label: 'Jacksonville, FL', latitude: 30.3322, longitude: -81.6557, source: require('../../../../trail-guide-jacksonville.png') },
  { key: 'orlando', label: 'Orlando, FL', latitude: 28.5383, longitude: -81.3792, source: require('../../../../trail-guide-orlando.png') },
  { key: 'miami', label: 'Miami, FL', latitude: 25.7617, longitude: -80.1918, source: require('../../../../trail-guide-miami.png') },
  { key: 'tampa', label: 'Tampa, FL', latitude: 27.9506, longitude: -82.4572, source: require('../../../../trail-guide-tampa.png') },
  { key: 'st-petersburg', label: 'St. Petersburg, FL', latitude: 27.7676, longitude: -82.6403, source: require('../../../../trail-guide-st-petersburg.png') },
  { key: 'fort-lauderdale', label: 'Fort Lauderdale, FL', latitude: 26.1224, longitude: -80.1373, source: require('../../../../trail-guide-fort-lauderdale.png') },
  { key: 'west-palm-beach', label: 'West Palm Beach, FL', latitude: 26.7153, longitude: -80.0534, source: require('../../../../trail-guide-west-palm-beach.png') },
  { key: 'naples', label: 'Naples, FL', latitude: 26.1423, longitude: -81.7948, source: require('../../../../trail-guide-naples.png') },
  { key: 'fort-myers', label: 'Fort Myers, FL', latitude: 26.6406, longitude: -81.8723, source: require('../../../../trail-guide-fort-myers.png') },
  { key: 'sarasota', label: 'Sarasota, FL', latitude: 27.3364, longitude: -82.5307, source: require('../../../../trail-guide-sarasota.png') },
  { key: 'tallahassee', label: 'Tallahassee, FL', latitude: 30.4383, longitude: -84.2807, source: require('../../../../trail-guide-tallahassee.png') },
  { key: 'gainesville', label: 'Gainesville, FL', latitude: 29.6516, longitude: -82.3248, source: require('../../../../trail-guide-gainesville.png') },
  { key: 'ocala', label: 'Ocala, FL', latitude: 29.1872, longitude: -82.1401, source: require('../../../../trail-guide-ocala.png') },
  { key: 'daytona-beach', label: 'Daytona Beach, FL', latitude: 29.2108, longitude: -81.0228, source: require('../../../../trail-guide-daytona-beach.png') },
  { key: 'pensacola', label: 'Pensacola, FL', latitude: 30.4213, longitude: -87.2169, source: require('../../../../trail-guide-pensacola.png') },
  { key: 'panama-city', label: 'Panama City, FL', latitude: 30.1588, longitude: -85.6602, source: require('../../../../trail-guide-panama-city.png') },
  { key: 'destin', label: 'Destin, FL', latitude: 30.3935, longitude: -86.4958, source: require('../../../../trail-guide-destin.png') },
  { key: 'lakeland', label: 'Lakeland, FL', latitude: 28.0395, longitude: -81.9498, source: require('../../../../trail-guide-lakeland.png') },
  { key: 'cape-coral', label: 'Cape Coral, FL', latitude: 26.5629, longitude: -81.9495, source: require('../../../../trail-guide-cape-coral.png') },
  { key: 'port-st-lucie', label: 'Port St. Lucie, FL', latitude: 27.273, longitude: -80.3582, source: require('../../../../trail-guide-port-st-lucie.png') },
  { key: 'key-west', label: 'Key West, FL', latitude: 24.5551, longitude: -81.78, source: require('../../../../trail-guide-key-west.png') },
];

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMiles(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);
  const deltaLat = toRadians(latitudeB - latitudeA);
  const deltaLon = toRadians(longitudeB - longitudeA);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getNearestTrailGuideCity(latitude: number, longitude: number) {
  return TRAIL_GUIDE_CITIES.reduce<{ city: TrailGuideCity; distance: number } | null>((best, city) => {
    const distance = distanceMiles(latitude, longitude, city.latitude, city.longitude);
    if (!best || distance < best.distance) return { city, distance };
    return best;
  }, null);
}
