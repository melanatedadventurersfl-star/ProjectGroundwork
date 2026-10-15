import type { DiscoveryItem } from './catalog';

/**
 * Fictional examples for previewing Nights. These never touch Supabase,
 * cannot be booked, and must always be identified as demo content in the UI.
 * Dates roll forward so QA always has upcoming morning, daytime, and evening events.
 */
export type DemoCityEvent = DiscoveryItem & {
  source: 'demo';
  neighborhood: string;
  duration: string;
};

type DemoDefinition = {
  id: string;
  title: string;
  description: string;
  category: string;
  neighborhood: string;
  duration: string;
  weekday: number;
  hour: number;
  minute?: number;
  weekOffset?: number;
  priceLabel: string;
  tags: string[];
};

const EXAMPLES: DemoDefinition[] = [
  {
    id: 'demo-nights-coffee', title: 'Coffee & Connections',
    description: 'A casual morning meetup for new faces, good conversation, and finding your people in the city.',
    category: 'Coffee & Social', neighborhood: 'Riverside', duration: '90 minutes',
    weekday: 5, hour: 9, minute: 30, priceLabel: 'Free', tags: ['coffee', 'morning', 'social'],
  },
  {
    id: 'demo-nights-market', title: 'Saturday Makers Market Meetup',
    description: 'Explore local makers, discover small businesses, and enjoy a relaxed Saturday with the community.',
    category: 'Market & Shopping', neighborhood: 'Riverside', duration: '2 hours',
    weekday: 6, hour: 10, priceLabel: 'Free', tags: ['market', 'shopping', 'daytime'],
  },
  {
    id: 'demo-nights-brunch', title: 'Sunday Brunch Club',
    description: 'Meet around the table, connect with fellow city explorers, and discover a new brunch spot.',
    category: 'Brunch & Food', neighborhood: 'San Marco', duration: '2 hours',
    weekday: 0, hour: 11, priceLabel: 'Cost varies', tags: ['brunch', 'food', 'daytime'],
  },
  {
    id: 'demo-nights-art', title: 'Downtown Art & Gallery Hop',
    description: 'Spend the afternoon exploring art, creativity, and conversation in the heart of Jacksonville.',
    category: 'Arts & Culture', neighborhood: 'Downtown Jacksonville', duration: '2 hours',
    weekday: 6, hour: 13, minute: 30, priceLabel: 'Free', tags: ['gallery', 'art', 'afternoon'],
  },
  {
    id: 'demo-nights-museum', title: 'Museum & Culture Afternoon',
    description: 'An easygoing museum meetup with time to explore exhibits together and talk over coffee afterward.',
    category: 'Museum & Culture', neighborhood: 'Downtown Jacksonville', duration: '2 hours',
    weekday: 0, hour: 13, weekOffset: 1, priceLabel: 'Admission varies', tags: ['museum', 'culture', 'afternoon'],
  },
  {
    id: 'demo-nights-giveback', title: 'City Giveback Morning',
    description: 'Connect while giving back through a sample neighborhood service meetup.',
    category: 'Community & Volunteering', neighborhood: 'Springfield', duration: '2 hours',
    weekday: 6, hour: 9, weekOffset: 1, priceLabel: 'Free', tags: ['volunteer', 'community', 'morning'],
  },
  {
    id: 'demo-nights-food', title: 'Food Truck Friday Social',
    description: 'Sample different flavors and meet other city explorers at a casual evening hangout.',
    category: 'Food & Social', neighborhood: 'Southbank', duration: '2 hours',
    weekday: 5, hour: 18, priceLabel: 'Cost varies', tags: ['food', 'social', 'evening'],
  },
  {
    id: 'demo-nights-comedy', title: 'Comedy & Conversation',
    description: 'A sample night out built around live laughs, relaxed conversation, and good company.',
    category: 'Comedy & Entertainment', neighborhood: 'Five Points', duration: '2 hours',
    weekday: 6, hour: 20, priceLabel: 'Admission varies', tags: ['comedy', 'entertainment', 'night'],
  },
];

function nextLocalOccurrence(definition: DemoDefinition, now: Date): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), definition.hour, definition.minute ?? 0);
  start.setDate(start.getDate() + (definition.weekday - start.getDay() + 7) % 7);
  if (start.getTime() <= now.getTime()) start.setDate(start.getDate() + 7);
  if (definition.weekOffset) start.setDate(start.getDate() + 7 * definition.weekOffset);
  return start.toISOString();
}

export function getDemoCityEvents(now = new Date()): DemoCityEvent[] {
  return EXAMPLES.map(definition => ({
    id: definition.id,
    source: 'demo' as const,
    mode: 'night' as const,
    title: definition.title,
    description: definition.description,
    category: definition.category,
    startsAt: nextLocalOccurrence(definition, now),
    city: 'Jacksonville',
    state: 'FL',
    neighborhood: definition.neighborhood,
    duration: definition.duration,
    image: null,
    priceLabel: definition.priceLabel,
    saved: false,
    featured: false,
    point: null,
    tags: definition.tags,
  }));
}

export function getDemoCityEvent(id: string): DemoCityEvent | undefined {
  return getDemoCityEvents().find(event => event.id === id);
}
