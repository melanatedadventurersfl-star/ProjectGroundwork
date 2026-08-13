export type UsStateOption = {
  name: string;
  abbreviation: string;
  fips: string;
};

export const US_STATES: UsStateOption[] = [
  { name: 'Alabama', abbreviation: 'AL', fips: '01' },
  { name: 'Alaska', abbreviation: 'AK', fips: '02' },
  { name: 'Arizona', abbreviation: 'AZ', fips: '04' },
  { name: 'Arkansas', abbreviation: 'AR', fips: '05' },
  { name: 'California', abbreviation: 'CA', fips: '06' },
  { name: 'Colorado', abbreviation: 'CO', fips: '08' },
  { name: 'Connecticut', abbreviation: 'CT', fips: '09' },
  { name: 'Delaware', abbreviation: 'DE', fips: '10' },
  { name: 'District of Columbia', abbreviation: 'DC', fips: '11' },
  { name: 'Florida', abbreviation: 'FL', fips: '12' },
  { name: 'Georgia', abbreviation: 'GA', fips: '13' },
  { name: 'Hawaii', abbreviation: 'HI', fips: '15' },
  { name: 'Idaho', abbreviation: 'ID', fips: '16' },
  { name: 'Illinois', abbreviation: 'IL', fips: '17' },
  { name: 'Indiana', abbreviation: 'IN', fips: '18' },
  { name: 'Iowa', abbreviation: 'IA', fips: '19' },
  { name: 'Kansas', abbreviation: 'KS', fips: '20' },
  { name: 'Kentucky', abbreviation: 'KY', fips: '21' },
  { name: 'Louisiana', abbreviation: 'LA', fips: '22' },
  { name: 'Maine', abbreviation: 'ME', fips: '23' },
  { name: 'Maryland', abbreviation: 'MD', fips: '24' },
  { name: 'Massachusetts', abbreviation: 'MA', fips: '25' },
  { name: 'Michigan', abbreviation: 'MI', fips: '26' },
  { name: 'Minnesota', abbreviation: 'MN', fips: '27' },
  { name: 'Mississippi', abbreviation: 'MS', fips: '28' },
  { name: 'Missouri', abbreviation: 'MO', fips: '29' },
  { name: 'Montana', abbreviation: 'MT', fips: '30' },
  { name: 'Nebraska', abbreviation: 'NE', fips: '31' },
  { name: 'Nevada', abbreviation: 'NV', fips: '32' },
  { name: 'New Hampshire', abbreviation: 'NH', fips: '33' },
  { name: 'New Jersey', abbreviation: 'NJ', fips: '34' },
  { name: 'New Mexico', abbreviation: 'NM', fips: '35' },
  { name: 'New York', abbreviation: 'NY', fips: '36' },
  { name: 'North Carolina', abbreviation: 'NC', fips: '37' },
  { name: 'North Dakota', abbreviation: 'ND', fips: '38' },
  { name: 'Ohio', abbreviation: 'OH', fips: '39' },
  { name: 'Oklahoma', abbreviation: 'OK', fips: '40' },
  { name: 'Oregon', abbreviation: 'OR', fips: '41' },
  { name: 'Pennsylvania', abbreviation: 'PA', fips: '42' },
  { name: 'Rhode Island', abbreviation: 'RI', fips: '44' },
  { name: 'South Carolina', abbreviation: 'SC', fips: '45' },
  { name: 'South Dakota', abbreviation: 'SD', fips: '46' },
  { name: 'Tennessee', abbreviation: 'TN', fips: '47' },
  { name: 'Texas', abbreviation: 'TX', fips: '48' },
  { name: 'Utah', abbreviation: 'UT', fips: '49' },
  { name: 'Vermont', abbreviation: 'VT', fips: '50' },
  { name: 'Virginia', abbreviation: 'VA', fips: '51' },
  { name: 'Washington', abbreviation: 'WA', fips: '53' },
  { name: 'West Virginia', abbreviation: 'WV', fips: '54' },
  { name: 'Wisconsin', abbreviation: 'WI', fips: '55' },
  { name: 'Wyoming', abbreviation: 'WY', fips: '56' },
];

/**
 * A small bundled fallback keeps onboarding usable when the Census API is
 * unavailable on a device. The Census list remains the primary source and,
 * when available, replaces these starter cities with the full official list.
 */
const FALLBACK_CITIES: Record<string, string[]> = {
  AL: ['Birmingham', 'Huntsville', 'Mobile', 'Montgomery'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau'],
  AZ: ['Flagstaff', 'Mesa', 'Phoenix', 'Scottsdale', 'Tucson'],
  AR: ['Fayetteville', 'Fort Smith', 'Little Rock'],
  CA: ['Fresno', 'Los Angeles', 'Oakland', 'Sacramento', 'San Diego', 'San Francisco', 'San Jose'],
  CO: ['Boulder', 'Colorado Springs', 'Denver', 'Fort Collins'],
  CT: ['Bridgeport', 'Hartford', 'New Haven', 'Stamford'],
  DE: ['Dover', 'Newark', 'Wilmington'],
  DC: ['Washington'],
  FL: [
    'Apopka',
    'Boca Raton',
    'Cape Coral',
    'Clearwater',
    'Clermont',
    'Daytona Beach',
    'Fort Lauderdale',
    'Fort Myers',
    'Gainesville',
    'Hollywood',
    'Homestead',
    'Jacksonville',
    'Key Largo',
    'Key West',
    'Kissimmee',
    'Lakeland',
    'Melbourne',
    'Miami',
    'Naples',
    'Ocala',
    'Orlando',
    'Palm Bay',
    'Panama City',
    'Pensacola',
    'Sarasota',
    'Silver Springs',
    'St. Augustine',
    'St. Petersburg',
    'Tallahassee',
    'Tampa',
    'West Palm Beach',
  ],
  GA: ['Athens', 'Atlanta', 'Augusta', 'Columbus', 'Savannah'],
  HI: ['Hilo', 'Honolulu', 'Kailua', 'Kaneohe'],
  ID: ['Boise', 'Idaho Falls', 'Meridian', 'Nampa'],
  IL: ['Aurora', 'Chicago', 'Naperville', 'Peoria', 'Springfield'],
  IN: ['Bloomington', 'Evansville', 'Fort Wayne', 'Indianapolis', 'South Bend'],
  IA: ['Cedar Rapids', 'Des Moines', 'Davenport', 'Iowa City'],
  KS: ['Kansas City', 'Lawrence', 'Overland Park', 'Topeka', 'Wichita'],
  KY: ['Bowling Green', 'Lexington', 'Louisville'],
  LA: ['Baton Rouge', 'Lafayette', 'Lake Charles', 'New Orleans', 'Shreveport'],
  ME: ['Augusta', 'Bangor', 'Portland'],
  MD: ['Annapolis', 'Baltimore', 'Frederick', 'Rockville'],
  MA: ['Boston', 'Cambridge', 'Springfield', 'Worcester'],
  MI: ['Ann Arbor', 'Detroit', 'Grand Rapids', 'Lansing'],
  MN: ['Duluth', 'Minneapolis', 'Rochester', 'Saint Paul'],
  MS: ['Biloxi', 'Gulfport', 'Jackson'],
  MO: ['Columbia', 'Kansas City', 'Springfield', 'St. Louis'],
  MT: ['Billings', 'Bozeman', 'Great Falls', 'Missoula'],
  NE: ['Bellevue', 'Lincoln', 'Omaha'],
  NV: ['Henderson', 'Las Vegas', 'Reno'],
  NH: ['Concord', 'Manchester', 'Nashua', 'Portsmouth'],
  NJ: ['Atlantic City', 'Jersey City', 'Newark', 'Paterson', 'Trenton'],
  NM: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe'],
  NY: ['Albany', 'Buffalo', 'New York', 'Rochester', 'Syracuse'],
  NC: ['Asheville', 'Charlotte', 'Durham', 'Greensboro', 'Raleigh', 'Wilmington'],
  ND: ['Bismarck', 'Fargo', 'Grand Forks'],
  OH: ['Akron', 'Cincinnati', 'Cleveland', 'Columbus', 'Dayton', 'Toledo'],
  OK: ['Norman', 'Oklahoma City', 'Stillwater', 'Tulsa'],
  OR: ['Bend', 'Eugene', 'Portland', 'Salem'],
  PA: ['Allentown', 'Erie', 'Philadelphia', 'Pittsburgh', 'Scranton'],
  RI: ['Cranston', 'Newport', 'Providence', 'Warwick'],
  SC: ['Charleston', 'Columbia', 'Greenville', 'Myrtle Beach'],
  SD: ['Aberdeen', 'Rapid City', 'Sioux Falls'],
  TN: ['Chattanooga', 'Knoxville', 'Memphis', 'Nashville'],
  TX: ['Austin', 'Dallas', 'El Paso', 'Fort Worth', 'Houston', 'San Antonio'],
  UT: ['Ogden', 'Provo', 'Salt Lake City', 'St. George'],
  VT: ['Burlington', 'Montpelier', 'Rutland'],
  VA: ['Alexandria', 'Arlington', 'Norfolk', 'Richmond', 'Virginia Beach'],
  WA: ['Bellevue', 'Seattle', 'Spokane', 'Tacoma'],
  WV: ['Charleston', 'Huntington', 'Morgantown'],
  WI: ['Green Bay', 'Madison', 'Milwaukee'],
  WY: ['Casper', 'Cheyenne', 'Jackson', 'Laramie'],
};

const cityCache = new Map<string, string[]>();

function cleanPlaceName(name: string) {
  const place = name.split(',')[0]?.trim() ?? name.trim();
  return place
    .replace(/\s+(city and borough|city and county|consolidated government|unified government|municipality|borough|village|town|city|CDP)$/i, '')
    .trim();
}

export function getStateOption(abbreviation: string) {
  return US_STATES.find((state) => state.abbreviation === abbreviation.toUpperCase());
}

async function fetchWithTimeout(url: string, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadCitiesForState(abbreviation: string): Promise<string[]> {
  const normalized = abbreviation.toUpperCase();
  const cached = cityCache.get(normalized);
  if (cached) return cached;

  const state = getStateOption(normalized);
  if (!state) return [];

  const fallback = FALLBACK_CITIES[normalized] ?? [];

  try {
    const url = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=place:*&in=state:${state.fips}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`Census city request failed with ${response.status}.`);

    const rows = (await response.json()) as string[][];
    const cities = Array.from(
      new Set(
        rows
          .slice(1)
          .map((row) => cleanPlaceName(row[0] ?? ''))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    if (cities.length > 0) {
      cityCache.set(normalized, cities);
      return cities;
    }
  } catch {
    // Device networking can block or time out on the Census endpoint.
    // Falling back is intentional so onboarding never becomes a dead end.
  }

  const safeFallback = [...fallback].sort((a, b) => a.localeCompare(b));
  cityCache.set(normalized, safeFallback);
  return safeFallback;
}
