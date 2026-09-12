import type { ImageSourcePropType } from 'react-native';

export type StampCatalogItem = {
  id: string;
  code?: string;
  title: string;
  aliases?: readonly string[];
  codeAliases?: readonly string[];
  year: 2025 | 2026;
  dateLabel: string;
  location: string;
  source: ImageSourcePropType;
};

const CANONICAL_STAMP_CATALOG: StampCatalogItem[] = [
  {
    id: '2025-group-launch',
    code: 'legacy-event-2025-group-launch',
    title: 'MA Official Group Launch',
    aliases: [
      'Melanated Adventures Official Group Launch',
      'Melanated Adventurers Official Group Launch',
      'Melanated Adventures Group Launch',
      'Melanated Adventurers Group Launch',
    ],
    year: 2025,
    dateLabel: 'Mar 4, 2025',
    location: 'Jacksonville, FL',
    source: require('../../assets/stamps/2025-group-launch.png'),
  },
  {
    id: '2025-huguenot-camping',
    code: 'legacy-event-2025-huguenot-camping',
    title: 'Huguenot Park Camping Trip',
    aliases: ['Huguenot Camping Trip', 'Huguenot Memorial Park Camping Trip'],
    year: 2025,
    dateLabel: 'Mar 28–30, 2025',
    location: 'Huguenot Memorial Park · Jacksonville, FL',
    source: require('../../assets/stamps/2025-huguenot-camping.png'),
  },
  {
    id: '2025-float-out',
    code: 'legacy-event-2025-float-out',
    title: 'Great Melanated Float-Out',
    aliases: ['Great Melanated Float Out', 'The Great Melanated Float-Out', 'The Great Melanated Float Out'],
    year: 2025,
    dateLabel: 'Apr 26, 2025',
    location: 'North Florida',
    source: require('../../assets/stamps/2025-float-out.png'),
  },
  {
    id: '2025-black-breezy',
    code: 'legacy-event-2025-black-breezy',
    title: 'Black & Breezy: The Summer Cool-Down',
    aliases: ['Black and Breezy: The Summer Cool-Down', 'Black & Breezy: The Summer Cool Down', 'Black and Breezy: The Summer Cool Down'],
    year: 2025,
    dateLabel: 'Jun 20–22, 2025',
    location: 'Tomoka State Park, FL',
    source: require('../../assets/stamps/2025-black-breezy.png'),
  },
  {
    id: '2025-fire-dragon',
    code: 'legacy-event-2025-fire-dragon',
    title: 'Great Melanated Fire Dragon Conquest',
    aliases: ['The Great Melanated Fire Dragon Conquest'],
    year: 2025,
    dateLabel: 'Jul 12, 2025',
    location: 'Jacksonville, FL',
    source: require('../../assets/stamps/2025-fire-dragon.png'),
  },
  {
    id: '2025-wet-wild',
    code: 'legacy-event-2025-wet-wild',
    title: 'Great Melanated Wet & Wild Adventure',
    aliases: ['Great Melanated Wet and Wild Adventure', 'The Great Melanated Wet & Wild Adventure', 'The Great Melanated Wet and Wild Adventure'],
    year: 2025,
    dateLabel: 'Jul 18, 2025',
    location: 'Orlando / Kissimmee, FL',
    source: require('../../assets/stamps/2025-wet-wild.png'),
  },
  {
    id: '2026-beach-escape',
    code: 'legacy-event-2026-beach-escape',
    title: 'Great Melanated Beach Escape',
    aliases: ['The Great Melanated Beach Escape', 'Great Melanated Beach Escape 2026'],
    year: 2026,
    dateLabel: 'Mar 27–29, 2026',
    location: 'Huguenot Memorial Park · Jacksonville, FL',
    source: require('../../assets/stamps/2026-beach-escape.png'),
  },
  {
    id: '2026-float-out-juneteenth',
    code: 'legacy-event-2026-float-out-juneteenth',
    title: 'Great Melanated Float Out · Juneteenth Edition',
    aliases: [
      'Great Melanated Float-Out · Juneteenth Edition',
      'Great Melanated Float Out - Juneteenth Edition',
      'Great Melanated Float-Out - Juneteenth Edition',
      'Great Melanated Float Out Juneteenth Edition',
      'Great Melanated Float-Out Juneteenth Edition',
      'Float Out Juneteenth',
    ],
    year: 2026,
    dateLabel: 'Jun 20, 2026',
    location: 'William F. Sheffield Regional Park · Jacksonville, FL',
    source: require('../../assets/stamps/2026-float-out-juneteenth.png'),
  },
  {
    id: '2026-champs',
    code: 'legacy-event-2026-champs',
    title: 'C.H.A.M.P.s Summer Session',
    aliases: ['CHAMPS Summer Session', 'C.H.A.M.P.S. Summer Session', 'C.H.A.M.P.s Summer Session 2026'],
    year: 2026,
    dateLabel: 'Jul 23, 2026',
    location: 'Jacksonville Area',
    source: require('../../assets/stamps/2026-champs-summer-session.png'),
  },
  {
    id: '2026-splash-after-dark',
    code: 'legacy-event-2026-splash-after-dark',
    title: 'Splash After Dark',
    aliases: ['Splash After Dark 2026'],
    year: 2026,
    dateLabel: 'Jul 25, 2026',
    location: 'Island H2O · Orlando Area',
    source: require('../../assets/stamps/2026-splash-after-dark.png'),
  },
  {
    id: '2026-little-camp-of-horrors',
    code: 'legacy-event-2026-little-camp-of-horrors',
    title: 'Little Camp of Horrors',
    aliases: [
      'The Great Melanated Little Camp of Horrors',
      'Great Melanated Little Camp of Horrors',
      'The Great Melanated Little Camp of Horrors 2026',
      'Little Camp of Horrors 2026',
    ],
    year: 2026,
    dateLabel: 'Oct 30–Nov 1, 2026',
    location: 'North Florida',
    source: require('../../assets/stamps/2026-Little-Camp-of-Horrors.png'),
  },
  {
    id: '2026-campsgiving',
    code: 'legacy-event-2026-campsgiving',
    title: 'Campsgiving',
    aliases: ['Campsgiving 2026', 'Melanated Adventurers Campsgiving', 'Melanated Adventures Campsgiving'],
    year: 2026,
    dateLabel: 'Nov 20–22, 2026',
    location: 'Jacksonville Area',
    source: require('../../assets/stamps/2026-Campsgiving.png'),
  },
  {
    id: '2026-winter-wondercamp',
    code: 'legacy-event-2026-winter-wondercamp',
    title: 'Winter Wondercamp',
    aliases: ['Winter Wonder Camp', 'Winter Wondercamp 2026', 'Winter Wonder Camp 2026'],
    year: 2026,
    dateLabel: 'Dec 18–20, 2026',
    location: 'North Florida',
    source: require('../../assets/stamps/2026-Winter-WonderCamp.png'),
  },
];

function normalizeStampIdentity(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[·•–—-]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bthe\b/g, ' ')
    .replace(/\bofficial\b/g, ' ')
    .replace(/\bedition\b/g, ' ')
    .replace(/\b20(?:25|26)\b/g, ' ')
    .replace(/\bmelanated adventurers?\b/g, ' melanated ')
    .replace(/\bmelanated adventures?\b/g, ' melanated ')
    .replace(/\bma\b/g, ' melanated ')
    .replace(/\s+/g, ' ')
    .trim();
}

function catalogIdentityValues(item: StampCatalogItem) {
  return [item.title, ...(item.aliases ?? [])].map(normalizeStampIdentity);
}

export function resolveStampCatalogItem(stamp: { code?: string | null; title?: string | null }) {
  const code = stamp.code?.trim().toLowerCase();
  if (code) {
    const codeMatch = CANONICAL_STAMP_CATALOG.find((item) =>
      [item.code, ...(item.codeAliases ?? [])].some((candidate) => candidate?.toLowerCase() === code),
    );
    if (codeMatch) return codeMatch;
  }

  const title = stamp.title?.trim();
  if (!title) return null;
  const normalizedTitle = normalizeStampIdentity(title);
  return CANONICAL_STAMP_CATALOG.find((item) => catalogIdentityValues(item).includes(normalizedTitle)) ?? null;
}

// Keep existing callers that use STAMP_CATALOG.find(...) working while the app moves
// toward resolveStampCatalogItem(). The canonical array remains unchanged for grids,
// filters, slices, and the full Passport collection.
const aliasEntries = CANONICAL_STAMP_CATALOG.flatMap((item) =>
  (item.aliases ?? []).map((title) => ({ ...item, title })),
);
const canonicalFind = CANONICAL_STAMP_CATALOG.find.bind(CANONICAL_STAMP_CATALOG);
CANONICAL_STAMP_CATALOG.find = ((predicate: Parameters<Array<StampCatalogItem>['find']>[0], thisArg?: unknown) =>
  canonicalFind(predicate, thisArg) ?? aliasEntries.find(predicate, thisArg)) as Array<StampCatalogItem>['find'];

export const STAMP_CATALOG: readonly StampCatalogItem[] = CANONICAL_STAMP_CATALOG;
export const FEATURED_STAMPS = STAMP_CATALOG.slice(-3);
