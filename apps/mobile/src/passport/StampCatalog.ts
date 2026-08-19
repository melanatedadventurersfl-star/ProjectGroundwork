import type { ImageSourcePropType } from 'react-native';

export type StampCatalogItem = {
  id: string;
  code?: string;
  title: string;
  year: 2025 | 2026;
  dateLabel: string;
  location: string;
  source: ImageSourcePropType;
};

export const STAMP_CATALOG: readonly StampCatalogItem[] = [
  {
    id: '2025-group-launch',
    code: 'legacy-event-2025-group-launch',
    title: 'MA Official Group Launch',
    year: 2025,
    dateLabel: 'Mar 4, 2025',
    location: 'Jacksonville, FL',
    source: require('../../assets/stamps/2025-group-launch.png'),
  },
  {
    id: '2025-huguenot-camping',
    code: 'legacy-event-2025-huguenot-camping',
    title: 'Huguenot Park Camping Trip',
    year: 2025,
    dateLabel: 'Mar 28–30, 2025',
    location: 'Huguenot Memorial Park · Jacksonville, FL',
    source: require('../../assets/stamps/2025-huguenot-camping.png'),
  },
  {
    id: '2025-float-out',
    code: 'legacy-event-2025-float-out',
    title: 'Great Melanated Float-Out',
    year: 2025,
    dateLabel: 'Apr 26, 2025',
    location: 'North Florida',
    source: require('../../assets/stamps/2025-float-out.png'),
  },
  {
    id: '2025-black-breezy',
    code: 'legacy-event-2025-black-breezy',
    title: 'Black & Breezy: The Summer Cool-Down',
    year: 2025,
    dateLabel: 'Jun 20–22, 2025',
    location: 'Tomoka State Park, FL',
    source: require('../../assets/stamps/2025-black-breezy.png'),
  },
  {
    id: '2025-fire-dragon',
    code: 'legacy-event-2025-fire-dragon',
    title: 'Great Melanated Fire Dragon Conquest',
    year: 2025,
    dateLabel: 'Jul 12, 2025',
    location: 'Jacksonville, FL',
    source: require('../../assets/stamps/2025-fire-dragon.png'),
  },
  {
    id: '2025-wet-wild',
    code: 'legacy-event-2025-wet-wild',
    title: 'Great Melanated Wet & Wild Adventure',
    year: 2025,
    dateLabel: 'Jul 18, 2025',
    location: 'Orlando / Kissimmee, FL',
    source: require('../../assets/stamps/2025-wet-wild.png'),
  },
  {
    id: '2026-beach-escape',
    code: 'legacy-event-2026-beach-escape',
    title: 'Great Melanated Beach Escape',
    year: 2026,
    dateLabel: 'Mar 27–29, 2026',
    location: 'Huguenot Memorial Park · Jacksonville, FL',
    source: require('../../assets/stamps/2026-beach-escape.png'),
  },
  {
    id: '2026-float-out-juneteenth',
    code: 'legacy-event-2026-float-out-juneteenth',
    title: 'Great Melanated Float Out · Juneteenth Edition',
    year: 2026,
    dateLabel: 'Jun 20, 2026',
    location: 'William F. Sheffield Regional Park · Jacksonville, FL',
    source: require('../../assets/stamps/2026-float-out-juneteenth.png'),
  },
  {
    id: '2026-champs',
    code: 'legacy-event-2026-champs',
    title: 'C.H.A.M.P.s Summer Session',
    year: 2026,
    dateLabel: 'Jul 23, 2026',
    location: 'Jacksonville Area',
    source: require('../../assets/stamps/2026-champs-summer-session.png'),
  },
  {
    id: '2026-splash-after-dark',
    code: 'legacy-event-2026-splash-after-dark',
    title: 'Splash After Dark',
    year: 2026,
    dateLabel: 'Jul 25, 2026',
    location: 'Island H2O · Orlando Area',
    source: require('../../assets/stamps/2026-splash-after-dark.png'),
  },
  {
    id: '2026-little-camp-of-horrors',
    title: 'Little Camp of Horrors',
    year: 2026,
    dateLabel: 'Oct 30–Nov 1, 2026',
    location: 'North Florida',
    source: require('../../assets/stamps/2026-Little-Camp-of-Horrors.png'),
  },
  {
    id: '2026-campsgiving',
    title: 'Campsgiving',
    year: 2026,
    dateLabel: 'Nov 20–22, 2026',
    location: 'Jacksonville Area',
    source: require('../../assets/stamps/2026-Campsgiving.png'),
  },
  {
    id: '2026-winter-wondercamp',
    title: 'Winter Wondercamp',
    year: 2026,
    dateLabel: 'Dec 18–20, 2026',
    location: 'North Florida',
    source: require('../../assets/stamps/2026-Winter-WonderCamp.png'),
  },
];

export const FEATURED_STAMPS = STAMP_CATALOG.slice(-3);
