export type TrailGuideArticle = {
  id: string;
  title: string;
  topic: string;
  image: string;
  intro: string;
  points: string[];
};

export const trailGuideArticles: TrailGuideArticle[] = [
  {
    id: 'camping-essentials',
    title: 'Camping Essentials Checklist',
    topic: 'Camping',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80',
    intro: 'A practical starting point for a comfortable first night outside without packing the entire garage.',
    points: [
      'Bring a shelter, ground protection, sleeping bag or quilt, and a sleeping pad that matches the weather.',
      'Carry enough drinking water plus a simple backup method for treating water when your destination requires it.',
      'Plan easy meals, a safe cooking setup, and a way to store food away from wildlife.',
      'Pack a headlamp, backup light, charged phone or battery bank, and any campsite-specific lighting you need.',
      'Add sun protection, rain protection, bug protection, medications, and a compact first-aid kit.',
      'Check campground rules before leaving for fire restrictions, quiet hours, pets, vehicles, and check-in requirements.',
    ],
  },
  {
    id: 'florida-heat-safety',
    title: 'Florida Heat: Plan Smarter',
    topic: 'Conditions',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    intro: 'Heat changes the difficulty of an outdoor day. Treat temperature, humidity, shade, and effort as part of the route.',
    points: [
      'Start early when possible and give yourself a clear turnaround time before the hottest part of the day.',
      'Carry more water than your normal indoor routine suggests and drink consistently instead of waiting until you feel depleted.',
      'Choose shaded routes, springs, coastal breezes, or shorter loops when heat and humidity are elevated.',
      'Wear breathable clothing, sun protection, and a hat, and plan real cooling breaks rather than only slowing your pace.',
      'Know the warning signs of heat illness and end the outing if anyone becomes confused, faint, unusually weak, or stops sweating in dangerous heat.',
    ],
  },
  {
    id: 'hiking-safety',
    title: 'Day-Hike Safety',
    topic: 'Hiking',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80',
    intro: 'A few repeatable habits make day hikes safer without turning every walk into an expedition briefing.',
    points: [
      'Know the route, expected distance, trail surface, and daylight window before you begin.',
      'Tell someone where you are going and when you expect to return, especially on quieter preserves and state forests.',
      'Carry water, navigation, a light, basic first aid, sun protection, and a small emergency layer even on short outings.',
      'Watch the sky and radar before exposed or water-adjacent routes, especially during Florida thunderstorm season.',
      'Turn around when conditions, energy, water supply, or daylight stop matching the plan.',
    ],
  },
  {
    id: 'leave-no-trace',
    title: 'Leave No Trace in Florida',
    topic: 'Stewardship',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80',
    intro: 'Small choices keep springs, beaches, forests, dunes, and wetlands healthy for the next person and the wildlife already there.',
    points: [
      'Stay on durable or designated surfaces and avoid cutting through dunes, restoration areas, and fragile wetland edges.',
      'Pack out trash, food scraps, fishing line, pet waste, and anything else you bring in.',
      'Give wildlife generous space and never feed animals, even when they appear accustomed to people.',
      'Leave plants, shells, historic objects, rocks, and natural features where you find them when site rules require it.',
      'Keep music, voices, lights, pets, and group activity at a level that does not take over the space for everyone else.',
    ],
  },
  {
    id: 'first-camping-trip',
    title: 'Your First Camping Trip',
    topic: 'Camping',
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=900&q=80',
    intro: 'Your first trip does not need to be remote. A nearby campground with reliable amenities is often the better first chapter.',
    points: [
      'Choose a campground within a comfortable drive and favor established sites with restrooms for the first outing.',
      'Set up your tent at home once before the trip so the first attempt is not happening after dark.',
      'Keep the first menu simple and bring one meal that requires almost no preparation.',
      'Check the overnight low, rain chance, bugs, fire rules, and check-in window before leaving.',
      'Plan one or two nearby activities and leave room to simply enjoy camp instead of scheduling every hour.',
    ],
  },
  {
    id: 'paddling-basics',
    title: 'Florida Paddling Basics',
    topic: 'Water',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=80',
    intro: 'Springs, creeks, marshes, and coastal waterways reward preparation because wind, current, tide, and weather can change the return trip.',
    points: [
      'Wear an appropriate personal flotation device and carry the safety equipment required for your craft and location.',
      'Know whether the route is spring-fed, tidal, river current, open water, or a mix because the return effort can be very different.',
      'Check launch hours, shuttle needs, take-out access, weather, wind, and tides before putting in.',
      'Protect phones and essentials from water and carry drinking water separately from the water around you.',
      'Give manatees, alligators, nesting birds, and other wildlife space and never block their movement.',
    ],
  },
  {
    id: 'wildlife-awareness',
    title: 'Florida Wildlife Awareness',
    topic: 'Wildlife',
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80',
    intro: 'Seeing wildlife is part of the magic. The goal is to observe without turning the encounter into a negotiation.',
    points: [
      'Never feed wildlife and secure food, trash, bait, and scented items at camp.',
      'Keep a wide buffer around alligators, snakes, nesting birds, manatees, bears, and other animals.',
      'Keep pets leashed where required and avoid letting them approach wildlife or enter sensitive habitat.',
      'Use extra caution near water edges, dense vegetation, dawn, dusk, and places where visibility is limited.',
      'If wildlife changes its behavior because of your presence, increase your distance.',
    ],
  },
  {
    id: 'family-outdoors',
    title: 'Outdoor Days With Kids',
    topic: 'Family',
    image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80',
    intro: 'A successful family outing is often about the rhythm of the day more than the number of miles completed.',
    points: [
      'Choose shorter routes with an obvious payoff such as water, wildlife, a boardwalk, a beach, or a picnic stop.',
      'Build in snack, shade, bathroom, and water breaks before anyone urgently needs them.',
      'Give kids a job such as spotting trail markers, carrying a small daypack, or choosing the next observation stop.',
      'Bring backup dry clothes for water days and a simple comfort item for the ride home.',
      'End while the day is still fun. Leaving a little adventure unused is better than stretching the outing into exhaustion.',
    ],
  },
  {
    id: 'storm-season',
    title: 'Thunderstorms & Outdoor Plans',
    topic: 'Conditions',
    image: 'https://images.unsplash.com/photo-1500674425229-f692875b0ab7?auto=format&fit=crop&w=900&q=80',
    intro: 'Florida storms can build quickly. A flexible plan is more useful than pretending the forecast is a contract.',
    points: [
      'Check the forecast and radar shortly before departure, not only the night before.',
      'Favor earlier starts during seasons when afternoon thunderstorms are common.',
      'Know where you can safely exit or shelter before starting exposed trails, beaches, paddles, or long bike routes.',
      'Leave water and exposed areas when thunder is nearby and do not wait for rain to become heavy before reacting.',
      'Have a nearby indoor or low-commitment backup activity so changing the plan does not feel like losing the whole day.',
    ],
  },
  {
    id: 'weekend-planning',
    title: 'Build a Better Weekend Adventure',
    topic: 'Planning',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
    intro: 'A good weekend plan balances travel time, effort, weather, and one memorable reason to go.',
    points: [
      'Start with the experience you want: trail, springs, beach, camping, paddling, wildlife, or simply somewhere quiet.',
      'Compare drive time with activity time so the destination is worth the transportation overhead.',
      'Check current access, reservations, parking, weather, and daylight before committing to the final plan.',
      'Pair one primary destination with one nearby backup rather than building a fragile schedule with too many stops.',
      'Save the places that worked well so future weekends begin with a personal shortlist instead of a blank search box.',
    ],
  },
];

export function getTrailGuideArticle(id?: string) {
  return id ? trailGuideArticles.find((article) => article.id === id) : undefined;
}
