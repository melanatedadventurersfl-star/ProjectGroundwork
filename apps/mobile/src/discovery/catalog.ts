import { listAdventures, setAdventureSaved } from '../adventures/api';
import type { AdventureSummary } from '../adventures/types';
import { distanceMiles, pointForCity, type GeoPoint } from '../explore/location';
import { listLocalEvents, type LocalEvent } from '../local-events/api';

export type DiscoveryMode = 'nature' | 'night';
export type DiscoveryItem = {
  id: string;
  source: 'adventure' | 'local-event';
  mode: DiscoveryMode;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  city: string;
  state: string;
  image: string | null;
  priceLabel: string;
  saved: boolean;
  featured: boolean;
  point: GeoPoint | null;
  tags: string[];
};
export type DiscoveryFilters = {
  mode: 'all' | DiscoveryMode;
  query: string;
  when: 'any' | 'today' | 'weekend' | 'week';
  radius: number | null;
  freeOnly: boolean;
  savedOnly: boolean;
};

const NATURE_TERMS = /camp|hik|trail|kayak|paddl|spring|beach|park|nature|outdoor|fishing|fish|cycl|bike|water|forest|wildlife|river|canoe|bird|eco.tour/i;
const CITY_TERMS = /music|concert|night|bar|food|dinner|brunch|restaurant|art|theat|comedy|dance|festival|network|market|gallery|museum|social|culture|culinary|film|movie|club|rooftop|business/i;

// Explicit city categories override the inherited outdoor-adventure fallback.
// This classification is UI-only. A future primary_mode field should replace it.
export function classifyExperience(category: string, title: string, defaultMode: DiscoveryMode): DiscoveryMode {
  if (CITY_TERMS.test(category)) return 'night';
  if (NATURE_TERMS.test(category)) return 'nature';
  if (CITY_TERMS.test(title)) return 'night';
  if (NATURE_TERMS.test(title)) return 'nature';
  return defaultMode;
}

function adventureToItem(item: AdventureSummary): DiscoveryItem {
  const mode = classifyExperience(item.category, item.title, 'nature');
  return {
    id: item.id, source: 'adventure', mode, title: item.title, description: item.summary ?? '',
    category: item.category, startsAt: item.starts_at, city: item.city, state: item.state,
    image: item.hero_image_url, priceLabel: item.starting_price_cents
      ? `From $${(item.starting_price_cents / 100).toFixed(item.starting_price_cents % 100 ? 2 : 0)}` : 'Free',
    saved: item.is_saved === true, featured: item.is_featured === true,
    point: item.latitude != null && item.longitude != null
      ? { latitude: item.latitude, longitude: item.longitude } : pointForCity(item.city, item.state),
    tags: item.event_tags ?? [],
  };
}
function localEventToItem(item: LocalEvent): DiscoveryItem {
  return {
    id: item.id, source: 'local-event', mode: classifyExperience(item.category, item.title, 'night'),
    title: item.title, description: item.description ?? '', category: item.category,
    startsAt: item.starts_at, city: item.city, state: item.state,
    image: item.image_url, priceLabel: item.is_free ? 'Free' : 'See event for price',
    saved: false, featured: false, point: pointForCity(item.city, item.state), tags: [],
  };
}

// The two existing discovery views enforce visibility. Do not query the private
// adventures or local_events tables directly to populate a public feed.
export async function loadDiscoveryItems(): Promise<DiscoveryItem[]> {
  const results = await Promise.allSettled([listAdventures(), listLocalEvents()]);
  const adventures = results[0].status === 'fulfilled' ? results[0].value : [];
  const localEvents = results[1].status === 'fulfilled' ? results[1].value : [];
  if (results.every(result => result.status === 'rejected')) {
    throw new Error('Unable to load experiences. Pull down to try again.');
  }
  const now = Date.now();
  const seen = new Set<string>();
  return [
    ...adventures.filter(event => !event.is_demo && (event.status === 'published' || event.status === 'sold_out'))
      .map(adventureToItem),
    ...localEvents.filter(event => event.status === 'published').map(localEventToItem),
  ].filter(item => {
    if (!Number.isFinite(Date.parse(item.startsAt)) || Date.parse(item.startsAt) < now) return false;
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => Number(b.featured) - Number(a.featured) ||
    Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dateMatches(value: string, when: DiscoveryFilters['when']) {
  if (when === 'any') return true;
  const date = new Date(value);
  const today = new Date();
  if (when === 'today') return sameLocalDay(date, today);
  if (when === 'week') return date.getTime() <= today.getTime() + 7 * 86400000;
  const day = today.getDay();
  const nextSaturday = new Date(today);
  nextSaturday.setDate(today.getDate() + (6 - day + 7) % 7);
  nextSaturday.setHours(0, 0, 0, 0);
  const endSunday = new Date(nextSaturday);
  endSunday.setDate(nextSaturday.getDate() + 1);
  endSunday.setHours(23, 59, 59, 999);
  return date >= nextSaturday && date <= endSunday;
}
export function filterDiscovery(
  items: DiscoveryItem[], filters: DiscoveryFilters, center: GeoPoint | null,
): DiscoveryItem[] {
  const needle = filters.query.trim().toLocaleLowerCase();
  return items.filter(item => {
    if (filters.mode !== 'all' && item.mode !== filters.mode) return false;
    if (filters.savedOnly && !item.saved) return false;
    if (filters.freeOnly && item.priceLabel !== 'Free') return false;
    if (!dateMatches(item.startsAt, filters.when)) return false;
    if (needle && !`${item.title} ${item.description} ${item.category} ${item.city} ${item.state}`.toLocaleLowerCase().includes(needle)) return false;
    if (center && filters.radius !== null) {
      if (!item.point || distanceMiles(center, item.point) > filters.radius) return false;
    }
    return true;
  });
}
export function proximityReason(item: DiscoveryItem, center: GeoPoint | null) {
  return center && item.point ? `${Math.round(distanceMiles(center, item.point))} mi away` : item.category;
}
export async function saveDiscoveryAdventure(item: DiscoveryItem, shouldSave: boolean) {
  if (item.source !== 'adventure') throw new Error('Saving this event is not available yet.');
  await setAdventureSaved(item.id, shouldSave);
}
