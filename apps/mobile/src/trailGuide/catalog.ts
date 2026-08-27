export type DiscoveryCategory = 'All' | 'Hiking' | 'Camping' | 'Parks' | 'Water' | 'Scenic';
export type TrailGuideCityKey =
  | 'jacksonville'
  | 'orlando'
  | 'miami'
  | 'tampa'
  | 'st-petersburg'
  | 'fort-lauderdale'
  | 'west-palm-beach'
  | 'naples'
  | 'fort-myers'
  | 'sarasota';

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
  miami: ['Close to Miami', 'Biscayne Bay & Islands', 'Everglades & Wetlands', 'Trails & Hammocks', 'Beaches & Water', 'Worth the Drive'],
  tampa: ['Close to Tampa', 'Bay & Mangroves', 'Rivers & Springs', 'Trails Worth Exploring', 'Camping Nearby', 'Wildlife & Coastal Preserves', 'Worth the Drive'],
  'st-petersburg': ['Close to St. Pete', 'Bayfront & Beaches', 'Mangroves & Preserves', 'Trails Worth Exploring', 'Island Escapes', 'Worth the Drive'],
  'fort-lauderdale': ['Close to Fort Lauderdale', 'Beaches & Coastal Parks', 'Everglades & Wetlands', 'Trails & Natural Areas', 'Paddling', 'Worth the Drive'],
  'west-palm-beach': ['Close to West Palm', 'Beaches & Lagoons', 'Wetlands & Wildlife', 'Trails & Natural Areas', 'River Country', 'Worth the Drive'],
  naples: ['Close to Naples', 'Gulf Beaches', 'Mangroves & Estuaries', 'Swamps & Wildlife', 'Trails Worth Exploring', 'Worth the Drive'],
  'fort-myers': ['Close to Fort Myers', 'River & Sloughs', 'Beaches & Islands', 'Mangroves & Estuaries', 'Trails Worth Exploring', 'Worth the Drive'],
  sarasota: ['Close to Sarasota', 'Beaches & Bays', 'Myakka Country', 'Trails & Preserves', 'Camping Nearby', 'Worth the Drive'],
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

const miamiSeeds: Seed[] = [
['oleta-river-state-park','Oleta River State Park','Water','North Miami Beach'],
['bill-baggs-cape-florida-state-park','Bill Baggs Cape Florida State Park','Water','Key Biscayne'],
['biscayne-national-park','Biscayne National Park','Water','Homestead'],
['everglades-national-park-shark-valley','Everglades National Park — Shark Valley','Scenic','Miami-Dade'],
['matheson-hammock-park','Matheson Hammock Park','Water','Coral Gables'],
['crandon-park','Crandon Park','Water','Key Biscayne'],
['bear-cut-preserve','Bear Cut Preserve','Hiking','Key Biscayne'],
['deering-estate','Deering Estate','Scenic','Palmetto Bay'],
['virginia-key-beach-park','Virginia Key Beach Park','Water','Miami'],
['greynolds-park','Greynolds Park','Parks','North Miami Beach'],
['ad-barnes-park','A.D. Barnes Park','Parks','Miami'],
['tropical-park','Tropical Park','Parks','Miami'],
];

const tampaSeeds: Seed[] = [
['lettuce-lake-conservation-park','Lettuce Lake Conservation Park','Scenic','Tampa'],
['hillsborough-river-state-park','Hillsborough River State Park','Camping','Thonotosassa'],
['lower-hillsborough-wilderness-preserve-flatwoods','Lower Hillsborough Wilderness Preserve / Flatwoods','Hiking','Tampa'],
['morris-bridge-park','Morris Bridge Park','Water','Thonotosassa'],
['trout-creek-park','Trout Creek Park','Water','Tampa'],
['john-b-sargeant-park','John B. Sargeant Park','Water','Thonotosassa'],
['cypress-point-park','Cypress Point Park','Parks','Tampa'],
['picnic-island-park','Picnic Island Park','Water','Tampa'],
['ballast-point-park','Ballast Point Park','Scenic','Tampa'],
['upper-tampa-bay-park','Upper Tampa Bay Park','Scenic','Tampa'],
['lake-rogers-park','Lake Rogers Park','Hiking','Odessa'],
['brooker-creek-preserve','Brooker Creek Preserve','Hiking','Tarpon Springs'],
['weedon-island-preserve','Weedon Island Preserve','Scenic','St. Petersburg'],
['sawgrass-lake-park','Sawgrass Lake Park','Scenic','St. Petersburg'],
['boyd-hill-nature-preserve','Boyd Hill Nature Preserve','Hiking','St. Petersburg'],
['fort-de-soto-park','Fort De Soto Park','Camping','Tierra Verde'],
['honeymoon-island-state-park','Honeymoon Island State Park','Water','Dunedin'],
['caladesi-island-state-park','Caladesi Island State Park','Water','Dunedin'],
['eg-simmons-conservation-park','E.G. Simmons Conservation Park','Camping','Ruskin'],
['apollo-beach-nature-preserve','Apollo Beach Nature Preserve','Scenic','Apollo Beach'],
['cockroach-bay-nature-preserve','Cockroach Bay Nature Preserve','Water','Ruskin'],
['alafia-river-state-park','Alafia River State Park','Camping','Lithia'],
['lithia-springs-conservation-park','Lithia Springs Conservation Park','Water','Lithia'],
['aldermans-ford-conservation-park','Alderman’s Ford Conservation Park','Hiking','Lithia'],
['little-manatee-river-state-park','Little Manatee River State Park','Camping','Wimauma'],
['edward-medard-conservation-park','Edward Medard Conservation Park','Camping','Plant City'],
['robinson-preserve','Robinson Preserve','Scenic','Bradenton'],
['emerson-point-preserve','Emerson Point Preserve','Hiking','Palmetto'],
];

const stPetersburgSeeds: Seed[] = [
['clam-bayou-nature-park','Clam Bayou Nature Park','Scenic','St. Petersburg'],
['maximo-park','Maximo Park','Water','St. Petersburg'],
['abercrombie-park','Abercrombie Park','Hiking','St. Petersburg'],
['north-shore-park','North Shore Park','Parks','St. Petersburg'],
['vinoy-park','Vinoy Park','Parks','St. Petersburg'],
['demens-landing-park','Demens Landing Park','Water','St. Petersburg'],
['coffee-pot-bayou','Coffee Pot Bayou','Scenic','St. Petersburg'],
['jungle-prada-park','Jungle Prada Park','Scenic','St. Petersburg'],
['boca-ciega-millennium-park','Boca Ciega Millennium Park','Hiking','Seminole'],
['shell-key-preserve','Shell Key Preserve','Water','Tierra Verde'],
['egmont-key-state-park','Egmont Key State Park','Water','Egmont Key'],
['skyway-fishing-pier-state-park','Skyway Fishing Pier State Park','Water','Tampa Bay'],
];

const fortLauderdaleSeeds: Seed[] = [
['hugh-taylor-birch-state-park','Hugh Taylor Birch State Park','Parks','Fort Lauderdale'],
['dr-von-d-mizell-eula-johnson-state-park','Dr. Von D. Mizell–Eula Johnson State Park','Water','Dania Beach'],
['secret-woods-nature-center','Secret Woods Nature Center','Hiking','Fort Lauderdale'],
['anne-kolb-nature-center','Anne Kolb Nature Center','Scenic','Hollywood'],
['fern-forest-nature-center','Fern Forest Nature Center','Hiking','Coconut Creek'],
['long-key-natural-area','Long Key Natural Area & Nature Center','Hiking','Davie'],
['tree-tops-park','Tree Tops Park','Parks','Davie'],
['tall-cypress-natural-area','Tall Cypress Natural Area','Hiking','Coral Springs'],
['quiet-waters-park','Quiet Waters Park','Parks','Deerfield Beach'],
['snyder-park','Snyder Park','Parks','Fort Lauderdale'],
['west-lake-park','West Lake Park','Water','Hollywood'],
['deerfield-island-park','Deerfield Island Park','Scenic','Deerfield Beach'],
];

const westPalmBeachSeeds: Seed[] = [
['john-d-macarthur-beach-state-park','John D. MacArthur Beach State Park','Water','North Palm Beach'],
['grassy-waters-preserve','Grassy Waters Preserve','Scenic','West Palm Beach'],
['okeeheelee-park','Okeeheelee Park','Parks','West Palm Beach'],
['winding-waters-natural-area','Winding Waters Natural Area','Hiking','West Palm Beach'],
['loxahatchee-slough-natural-area','Loxahatchee Slough Natural Area','Hiking','Palm Beach Gardens'],
['pine-glades-natural-area','Pine Glades Natural Area','Hiking','Jupiter'],
['frenchmans-forest-natural-area',"Frenchman's Forest Natural Area",'Hiking','Palm Beach Gardens'],
['jupiter-ridge-natural-area','Jupiter Ridge Natural Area','Hiking','Jupiter'],
['juno-dunes-natural-area','Juno Dunes Natural Area','Hiking','Juno Beach'],
['riverbend-park','Riverbend Park','Water','Jupiter'],
['arthur-r-marshall-loxahatchee-national-wildlife-refuge','Arthur R. Marshall Loxahatchee National Wildlife Refuge','Scenic','Boynton Beach'],
['jonathan-dickinson-state-park','Jonathan Dickinson State Park','Camping','Hobe Sound'],
];

const naplesSeeds: Seed[] = [
['delnor-wiggins-pass-state-park','Delnor-Wiggins Pass State Park','Water','North Naples'],
['clam-pass-park','Clam Pass Park','Water','Naples'],
['naples-preserve','Naples Preserve','Hiking','Naples'],
['gordon-river-greenway','Gordon River Greenway','Hiking','Naples'],
['corkscrew-swamp-sanctuary','Corkscrew Swamp Sanctuary','Scenic','Naples'],
['crew-bird-rookery-swamp','CREW Bird Rookery Swamp','Hiking','Naples'],
['rookery-bay-nerr','Rookery Bay NERR','Scenic','Naples'],
['collier-seminole-state-park','Collier-Seminole State Park','Camping','Naples'],
['fakahatchee-strand-preserve-state-park','Fakahatchee Strand Preserve State Park','Hiking','Copeland'],
['picayune-strand-state-forest','Picayune Strand State Forest','Hiking','Naples'],
['barefoot-beach-preserve','Barefoot Beach Preserve','Water','Bonita Springs'],
['sugden-regional-park','Sugden Regional Park','Parks','Naples'],
];

const fortMyersSeeds: Seed[] = [
['six-mile-cypress-slough-preserve','Six Mile Cypress Slough Preserve','Scenic','Fort Myers'],
['manatee-park','Manatee Park','Scenic','Fort Myers'],
['lakes-regional-park','Lakes Regional Park','Parks','Fort Myers'],
['caloosahatchee-regional-park','Caloosahatchee Regional Park','Hiking','Alva'],
['hickeys-creek-mitigation-park',"Hickey's Creek Mitigation Park",'Hiking','Alva'],
['matanzas-pass-preserve','Matanzas Pass Preserve','Hiking','Fort Myers Beach'],
['lovers-key-state-park','Lovers Key State Park','Water','Fort Myers Beach'],
['koreshan-state-park','Koreshan State Park','Camping','Estero'],
['estero-bay-preserve-state-park','Estero Bay Preserve State Park','Hiking','Estero'],
['jn-ding-darling-national-wildlife-refuge','J.N. “Ding” Darling National Wildlife Refuge','Scenic','Sanibel'],
['bunche-beach-preserve','Bunche Beach Preserve','Water','Fort Myers'],
['four-mile-cove-ecological-preserve','Four Mile Cove Ecological Preserve','Water','Cape Coral'],
];

const sarasotaSeeds: Seed[] = [
['myakka-river-state-park','Myakka River State Park','Camping','Sarasota'],
['oscar-scherer-state-park','Oscar Scherer State Park','Camping','Osprey'],
['red-bug-slough-preserve','Red Bug Slough Preserve','Hiking','Sarasota'],
['rothenbach-park','Rothenbach Park','Parks','Sarasota'],
['celery-fields','The Celery Fields','Scenic','Sarasota'],
['bay-preserve-at-osprey','Bay Preserve at Osprey','Scenic','Osprey'],
['phillippi-estate-park','Phillippi Estate Park','Parks','Sarasota'],
['south-lido-park','South Lido Park','Water','Sarasota'],
['ted-sperling-park','Ted Sperling Park','Water','Lido Key'],
['siesta-beach','Siesta Beach','Water','Siesta Key'],
['urfer-family-park','Urfer Family Park','Hiking','Sarasota'],
['sleeping-turtles-preserve-north','Sleeping Turtles Preserve North','Hiking','Venice'],
['deer-prairie-creek-preserve','Deer Prairie Creek Preserve','Hiking','North Port'],
['t-carlton-reserve','T. Mabry Carlton Jr. Memorial Reserve','Hiking','Venice'],
];

function collectionsFor(city: TrailGuideCityKey, category: Exclude<DiscoveryCategory, 'All'>, area: string) {
  const collections: string[] = [];
  const cityLabels: Record<TrailGuideCityKey, string> = {
    jacksonville: 'Jacksonville', orlando: 'Orlando', miami: 'Miami', tampa: 'Tampa', 'st-petersburg': 'St. Petersburg', 'fort-lauderdale': 'Fort Lauderdale', 'west-palm-beach': 'West Palm Beach', naples: 'Naples', 'fort-myers': 'Fort Myers', sarasota: 'Sarasota',
  };
  const localLabel = cityLabels[city].toLowerCase();
  const localNeedle = localLabel.split(' ')[0] ?? localLabel;
  const localCollection = cityCollections[city][0] ?? 'Worth the Drive';
  if (category === 'Water') collections.push(city === 'orlando' ? 'Springs & Water' : 'Beaches & Water');
  if (category === 'Hiking') collections.push('Trails Worth Exploring');
  if (category === 'Camping') collections.push('Camping Nearby');
  if (category === 'Scenic') collections.push('Wildlife & Coastal Preserves');
  if (area.toLowerCase().includes(localNeedle)) collections.push(localCollection);
  else collections.push('Worth the Drive');
  return [...new Set(collections)];
}

function expandSeeds(city: TrailGuideCityKey, seeds: Seed[]): TrailGuidePlace[] {
  return seeds.map(([id, name, category, area]) => {
    const content = categoryContent[category];
    return { id, city, category, name, area, type: content.type, tags: [...content.tags], meta: content.meta, image: content.image, summary: content.summary, details: [...content.details], collections: collectionsFor(city, category, area) };
  });
}

export const trailGuidePlaces = [
  ...expandSeeds('jacksonville', jacksonvilleSeeds),
  ...expandSeeds('orlando', orlandoSeeds),
  ...expandSeeds('miami', miamiSeeds),
  ...expandSeeds('tampa', tampaSeeds),
  ...expandSeeds('st-petersburg', stPetersburgSeeds),
  ...expandSeeds('fort-lauderdale', fortLauderdaleSeeds),
  ...expandSeeds('west-palm-beach', westPalmBeachSeeds),
  ...expandSeeds('naples', naplesSeeds),
  ...expandSeeds('fort-myers', fortMyersSeeds),
  ...expandSeeds('sarasota', sarasotaSeeds),
];

export function getTrailGuidePlace(id?: string) { return id ? trailGuidePlaces.find((place) => place.id === id) : undefined; }

export function cityKeyFromLocationLabel(label: string): TrailGuideCityKey {
  const normalized = label.toLowerCase();
  if (normalized.includes('st. petersburg') || normalized.includes('st petersburg')) return 'st-petersburg';
  if (normalized.includes('fort lauderdale')) return 'fort-lauderdale';
  if (normalized.includes('west palm beach')) return 'west-palm-beach';
  if (normalized.includes('fort myers')) return 'fort-myers';
  if (normalized.includes('jacksonville')) return 'jacksonville';
  if (normalized.includes('orlando')) return 'orlando';
  if (normalized.includes('miami')) return 'miami';
  if (normalized.includes('tampa')) return 'tampa';
  if (normalized.includes('naples')) return 'naples';
  if (normalized.includes('sarasota')) return 'sarasota';
  return 'jacksonville';
}
