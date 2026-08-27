import { supabase } from '../lib/supabase';

export type AskGoFoodOption = {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  city: string;
  state: string;
  websiteUrl: string;
  ownershipTags: string[];
  verified: boolean;
};

const FOOD_WORDS = /restaurant|cafe|coffee|bakery|dessert|food|dining|eat|grill|kitchen|bistro|barbecue|bbq|sandwich|taco|pizza|brunch|breakfast|lunch|dinner/i;

function matchesKind(option: AskGoFoodOption, kind: string) {
  const haystack = `${option.category} ${option.description}`.toLowerCase();
  const normalized = kind.toLowerCase();
  if (normalized.includes('coffee') || normalized.includes('dessert')) return /coffee|cafe|bakery|dessert|ice cream|tea/.test(haystack);
  if (normalized.includes('quick')) return /sandwich|taco|pizza|bbq|barbecue|cafe|bakery|counter|quick|casual/.test(haystack);
  if (normalized.includes('sit')) return /restaurant|dining|bistro|grill|kitchen|brunch|dinner/.test(haystack);
  return true;
}

export async function findAskGoFoodOptions(city: string, state: string, kind: string): Promise<AskGoFoodOption[]> {
  const { data, error } = await supabase
    .from('community_places')
    .select('id,name,category,description,address,city,state,website_url,ownership_tags,ownership_verification_status,community_endorsement_count')
    .eq('city', city)
    .eq('state', state)
    .eq('is_active', true)
    .order('community_endorsement_count', { ascending: false })
    .limit(30);

  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      category: String(row.category ?? ''),
      description: String(row.description ?? ''),
      address: String(row.address ?? ''),
      city: String(row.city ?? city),
      state: String(row.state ?? state),
      websiteUrl: String(row.website_url ?? ''),
      ownershipTags: Array.isArray(row.ownership_tags) ? row.ownership_tags.map(String) : [],
      verified: row.ownership_verification_status === 'verified',
    }))
    .filter((option) => FOOD_WORDS.test(`${option.category} ${option.description}`))
    .filter((option) => matchesKind(option, kind))
    .slice(0, 4);
}
