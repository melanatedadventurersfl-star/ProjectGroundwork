import type { GeoPoint } from '../offline/safetyTypes';

const EARTH_RADIUS_M = 6_371_000;

function radians(value: number) {
  return value * Math.PI / 180;
}

function degrees(value: number) {
  return value * 180 / Math.PI;
}

export function distanceMeters(a: Pick<GeoPoint, 'latitude' | 'longitude'>, b: Pick<GeoPoint, 'latitude' | 'longitude'>) {
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const deltaLat = radians(b.latitude - a.latitude);
  const deltaLon = radians(b.longitude - a.longitude);
  const hav = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

export function bearingDegrees(a: Pick<GeoPoint, 'latitude' | 'longitude'>, b: Pick<GeoPoint, 'latitude' | 'longitude'>) {
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const deltaLon = radians(b.longitude - a.longitude);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

export function bearingLabel(bearing: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(bearing / 45) % directions.length];
}

export function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  if (miles >= 0.1) return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
  return `${Math.max(1, Math.round(meters * 3.28084))} ft`;
}

export function shouldRecordBreadcrumb(previous: GeoPoint | undefined, next: GeoPoint, minimumMeters = 30) {
  if (!previous) return true;
  return distanceMeters(previous, next) >= minimumMeters;
}