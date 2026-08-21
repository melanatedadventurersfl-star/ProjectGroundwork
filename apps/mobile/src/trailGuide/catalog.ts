export type DiscoveryCategory = 'All' | 'Hiking' | 'Camping' | 'Parks' | 'Water' | 'Scenic';
export type TrailGuideCityKey = 'jacksonville' | 'orlando';

export type TrailGuidePlace = {
  id: string;
  city: TrailGuideCityKey;
  category: Exclude<DiscoveryCategory, 'All'>;
  name: string;
  area: string;
  type: string;
  tags: string[];
  meta: string;
  image: string;
  summary: string;
  details: string[];
  collections: string[];
};

export const discoveryCategories: DiscoveryCategory[] = ['All', 'Hiking', 'Camping', 'Parks', 'Water', 'Scenic'];

export const cityCollections: Record<TrailGuideCityKey, string[]> = {
  jacksonville: ['Close to the City', 'Beaches & Water', 'Paddling & Marshes', 'Trails Worth Exploring', 'Camping Nearby', 'Timucuan & Coastal Wildlands', 'Worth the Drive'],
  orlando: ['Close to Orlando', 'Springs & Water', 'Trails Worth Exploring', 'Camping Nearby', 'Easy Nature Escapes', 'Worth the Drive'],
};

const categoryContent = {
  Hiking: { type: 'Trail / Preserve', tags: ['Trails', 'Walking'], meta: 'Trail time • Explore on foot', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80', summary: 'A strong local option for trail time, walking, and a quieter stretch outdoors.', details: ['Best for hiking and walking', 'Check trail conditions after heavy rain', 'Bring water, sun protection, and bug protection'] },
  Camping: { type: 'Camping / Outdoors', tags: ['Camping', 'Outdoors'], meta: 'Overnight option • Plan ahead', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80', summary: 'A good base for an overnight outdoor trip with nearby nature to explore.', details: ['Best for camping and longer stays', 'Reservations or site rules may apply', 'Confirm current fire, pet, and quiet-hour rules before arrival'] },
  Parks: { type: 'Park / Nature', tags: ['Nature', 'Easy outing'], meta: 'Flexible outing • Nature access', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80', summary: 'An approachable outdoor stop for fresh air, nature, and a flexible day outside.', details: ['Best for easy outings and nature breaks', 'Good for a shorter, flexible visit', 'Confirm current hours and amenity access before leaving'] },
  Water: { type: 'Water / Springs / Beach', tags: ['Water', 'Nature'], meta: 'Water access • Check conditions', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80', summary: 'A water-focused escape for paddling, shoreline time, swimming where allowed, or wildlife watching.', details: ['Best for water-focused outings', 'Water conditions can change quickly', 'Check swimming, launch, tide, or paddling notices before arrival'] },
  Scenic: { type: 'Scenic / Wildlife', tags: ['Wildlife', 'Scenic'], meta: 'Wildlife & scenery • Take your time', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80', summary: 'A scenery-first destination with wildlife, landscape, or cultural features worth slowing down for.', details: ['Best for wildlife, photography, and slower exploration', 'Morning and late afternoon are often rewarding', 'Keep distance from wildlife and stay on designated routes'] },
} as const;

type Seed = [id: string, name: string, category: Exclude<DiscoveryCategory, 'All'>, area: string];

const jacksonvilleSeeds: Seed[] = [
['kathryn-abbey-hanna-park','Kathryn Abbey Hanna Park','Parks','Jacksonville'],
['jacksonville-baldwin-rail-trail','Jacksonville-Baldwin Rail Trail','Hiking','Jacksonville'],
['timucuan-ecological-and-historic-preserve','Timucuan Ecological & Historic Preserve','Scenic','Jacksonville'],
['little-talbot-island-state-park','Little Talbot Island State Park','Water','Jacksonville'],
['big-talbot-island-state-park','Big Talbot Island State Park','Scenic','Jacksonville'],
['huguenot-memorial-park','Huguenot Memorial Park','Camping','Jacksonville'],
['amelia-island-state-park','Amelia Island State Park','Water','Amelia Island'],
['fort-clinch-state-park','Fort Clinch State Park','Camping','Fernandina Beach'],
['dutton-island-preserve','Dutton Island Preserve','Water','Atlantic Beach'],
['castaway-island-preserve','Castaway Island Preserve','Parks','Jacksonville'],
['julington-durbin-preserve','Julington-Durbin Preserve','Hiking','South Jacksonville'],
['theodore-roosevelt-area','Theodore Roosevelt Area','Hiking','Timucuan Preserve'],
['kingsley-plantation','Kingsley Plantation','Scenic','Fort George Island'],
['cedar-point','Cedar Point','Water','Timucuan Preserve'],
['pumpkin-hill-creek-preserve-state-park','Pumpkin Hill Creek Preserve State Park','Water','Jacksonville'],
['betz-tiger-point-preserve','Betz-Tiger Point Preserve','Hiking','Northeast Jacksonville'],
['seaton-creek-historic-preserve','Seaton Creek Historic Preserve','Hiking','North Jacksonville'],
['cary-state-forest','Cary State Forest','Camping','Nassau County'],
['jennings-state-forest','Jennings State Forest','Hiking','Clay County'],
['camp-milton-historic-preserve','Camp Milton Historic Preserve','Parks','West Jacksonville'],
['tillie-k-fowler-regional-park','Tillie K. Fowler Regional Park','Hiking','West Jacksonville'],
['jacksonville-arboretum-and-botanical-gardens','Jacksonville Arboretum & Botanical Gardens','Parks','Jacksonville'],
['tree-hill-nature-center','Tree Hill Nature Center','Parks','Jacksonville'],
['reddie-point-preserve','Reddie Point Preserve','Water','Jacksonville'],
['blue-cypress-park','Blue Cypress Park','Parks','Jacksonville'],
['ringhaver-park','Ringhaver Park','Water','West Jacksonville'],
['bulls-bay-preserve','Bulls Bay Preserve','Hiking','West Jacksonville'],
['thomas-creek-conservation-area','Thomas Creek Conservation Area','Hiking','North Jacksonville'],
['twelve-mile-swamp-conservation-area','Twelve Mile Swamp Conservation Area','Hiking','St. Johns County'],
['guana-tolomato-matanzas-nerr','Guana Tolomato Matanzas NERR','Scenic','Ponte Vedra Beach'],
['guana-river-wildlife-management-area','Guana River Wildlife Management Area','Hiking','Ponte Vedra Beach'],
['micklers-landing-beach',"Mickler's Landing Beach",'Water','Ponte Vedra Beach'],
['anastasia-state-park','Anastasia State Park','Camping','St. Augustine'],
['washington-oaks-gardens-state-park','Washington Oaks Gardens State Park','Scenic','Palm Coast'],
['ravine-gardens-state-park','Ravine Gardens State Park','Hiking','Palatka'],
['princess-place-preserve','Princess Place Preserve','Camping','Palm Coast'],
['faver-dykes-state-park','Faver-Dykes State Park','Camping','St. Augustine'],
['deep-creek-conservation-area','Deep Creek Conservation Area','Hiking','St. Johns County'],
['moses-creek-conservation-area','Moses Creek Conservation Area','Hiking','St. Augustine'],
['fort-george-island-cultural-state-park','Fort George Island Cultural State Park','Scenic','Jacksonville'],
];

const orlandoSeeds: Seed[] = [
['wekiwa-springs-state-park','Wekiwa Springs State Park','Water','Apopka'],
['rock-springs-run-state-reserve','Rock Springs Run State Reserve','Water','Sorrento'],
['kelly-park-rock-springs','Kelly Park / Rock Springs','Water','Apopka'],
['blue-spring-state-park','Blue Spring State Park','Water','Orange City'],
['lake-louisa-state-park','Lake Louisa State Park','Camping','Clermont'],
['tibet-butler-preserve','Tibet-Butler Preserve','Hiking','Southwest Orlando'],
['oakland-nature-preserve','Oakland Nature Preserve','Hiking','Oakland'],
['split-oak-forest','Split Oak Forest Wildlife and Environmental Area','Hiking','Southeast Orlando'],
['orlando-wetlands','Orlando Wetlands','Scenic','Christmas'],
['mead-botanical-garden','Mead Botanical Garden','Parks','Winter Park'],
['bill-frederick-park','Bill Frederick Park','Camping','Orlando'],
['shingle-creek-regional-park','Shingle Creek Regional Park','Water','Kissimmee'],
['little-big-econ-state-forest','Little Big Econ State Forest','Hiking','Oviedo'],
['charles-h-bronson-state-forest','Charles H. Bronson State Forest','Hiking','East Orlando'],
['black-bear-wilderness-area','Black Bear Wilderness Area','Hiking','Sanford'],
['lake-apopka-wildlife-drive','Lake Apopka Wildlife Drive','Scenic','Apopka'],
['magnolia-park','Magnolia Park','Camping','Apopka'],
['trimble-park','Trimble Park','Camping','Mount Dora'],
['moss-park','Moss Park','Camping','Southeast Orlando'],
['hal-scott-regional-preserve','Hal Scott Regional Preserve and Park','Hiking','East Orlando'],
['econ-river-wilderness-area','Econ River Wilderness Area','Hiking','Oviedo'],
['geneva-wilderness-area','Geneva Wilderness Area','Hiking','Geneva'],
['lake-proctor-wilderness-area','Lake Proctor Wilderness Area','Hiking','Geneva'],
['spring-hammock-preserve','Spring Hammock Preserve','Hiking','Longwood'],
['lower-wekiva-river-preserve-state-park','Lower Wekiva River Preserve State Park','Water','Sanford'],
['seminole-state-forest','Seminole State Forest','Camping','Lake County'],
['lake-norris-conservation-area','Lake Norris Conservation Area','Water','Lake County'],
['hidden-waters-preserve','Hidden Waters Preserve','Hiking','Eustis'],
['lake-lotus-park','Lake Lotus Park','Parks','Altamonte Springs'],
['kraft-azalea-garden','Kraft Azalea Garden','Parks','Winter Park'],
['cady-way-trail','Cady Way Trail','Hiking','Orlando / Winter Park'],
['west-orange-trail','West Orange Trail','Hiking','West Orange County'],
['little-econ-greenway','Little Econ Greenway','Hiking','Orlando'],
['cross-seminole-trail','Cross Seminole Trail','Hiking','Seminole County'],
['lake-jesup-conservation-area','Lake Jesup Conservation Area','Scenic','Seminole County'],
['de-leon-springs-state-park','De Leon Springs State Park','Water','De Leon Springs'],
['alexander-springs-recreation-area','Alexander Springs Recreation Area','Water','Ocala National Forest'],
['juniper-springs-recreation-area','Juniper Springs Recreation Area','Water','Ocala National Forest'],
['circle-b-bar-reserve','Circle B Bar Reserve','Scenic','Lakeland'],
['ocala-national-forest','Ocala National Forest','Camping','North of Orlando'],
];

function collectionsFor(city: TrailGuideCityKey, category: Exclude<DiscoveryCategory, 'All'>, area: string) {
  const collections: string[] = [];
  if (city === 'jacksonville') {
    if (category === 'Water') collections.push('Beaches & Water', 'Paddling & Marshes');
    if (category === 'Hiking') collections.push('Trails Worth Exploring');
    if (category === 'Camping') collections.push('Camping Nearby');
    if (category === 'Scenic') collections.push('Timucuan & Coastal Wildlands');
    if (area.toLowerCase().includes('jacksonville')) collections.push('Close to the City'); else collections.push('Worth the Drive');
  } else {
    if (category === 'Water') collections.push('Springs & Water');
    if (category === 'Hiking') collections.push('Trails Worth Exploring');
    if (category === 'Camping') collections.push('Camping Nearby');
    if (category === 'Parks' || category === 'Scenic') collections.push('Easy Nature Escapes');
    if (area.toLowerCase().includes('orlando') || area === 'Winter Park') collections.push('Close to Orlando');
    if (['Orange City','Lake County','Ocala National Forest','Lakeland','North of Orlando','De Leon Springs'].includes(area)) collections.push('Worth the Drive');
  }
  return [...new Set(collections)];
}

function expandSeeds(city: TrailGuideCityKey, seeds: Seed[]): TrailGuidePlace[] {
  return seeds.map(([id, name, category, area]) => {
    const content = categoryContent[category];
    return { id, city, category, name, area, type: content.type, tags: [...content.tags], meta: content.meta, image: content.image, summary: content.summary, details: [...content.details], collections: collectionsFor(city, category, area) };
  });
}

export const trailGuidePlaces = [...expandSeeds('jacksonville', jacksonvilleSeeds), ...expandSeeds('orlando', orlandoSeeds)];
export function getTrailGuidePlace(id?: string) { return id ? trailGuidePlaces.find((place) => place.id === id) : undefined; }
export function cityKeyFromLocationLabel(label: string): TrailGuideCityKey { return label.toLowerCase().includes('orlando') ? 'orlando' : 'jacksonville'; }
