import { supabase } from '../lib/supabase';

export type HostVendorProfile = {
  id: string;
  business_name: string;
  category: string;
  description: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  social_links: Record<string, unknown>;
  service_area: string | null;
  brand_assets: Record<string, unknown>;
  documents: Record<string, unknown>;
  internal_notes: string | null;
  is_demo: boolean;
  demo_key: string | null;
  sample_pricing: Record<string, unknown>;
  typical_setup: Record<string, unknown>;
  demo_event_count: number;
  rating: number | null;
};

const CORE_SELECT = 'id,business_name,category,description,contact_name,email,phone,website,social_links,service_area,brand_assets,documents,internal_notes';
const RICH_SELECT = `${CORE_SELECT},is_demo,demo_key,sample_pricing,typical_setup,demo_event_count,rating`;

type CoreVendorRow = Omit<HostVendorProfile, 'is_demo' | 'demo_key' | 'sample_pricing' | 'typical_setup' | 'demo_event_count' | 'rating'>;

function normalizeLegacyVendor(row: CoreVendorRow): HostVendorProfile {
  return {
    ...row,
    is_demo: false,
    demo_key: null,
    sample_pricing: {},
    typical_setup: {},
    demo_event_count: 0,
    rating: null,
  };
}

export async function listHostVendorProfiles(): Promise<HostVendorProfile[]> {
  const rich = await supabase
    .from('host_vendor_profiles')
    .select(RICH_SELECT)
    .order('is_demo', { ascending: true })
    .order('business_name', { ascending: true });

  if (!rich.error) return (rich.data ?? []) as unknown as HostVendorProfile[];

  // Older deployments can have the core vendor table before the demo-enrichment migration.
  // Keep the directory operational while migrations catch up instead of failing the whole page.
  const legacy = await supabase
    .from('host_vendor_profiles')
    .select(CORE_SELECT)
    .order('business_name', { ascending: true });

  if (legacy.error) throw legacy.error;
  return ((legacy.data ?? []) as unknown as CoreVendorRow[]).map(normalizeLegacyVendor);
}

export async function createHostVendorProfile(input: {
  businessName: string;
  category: string;
  contactName?: string;
  email?: string;
  phone?: string;
  serviceArea?: string;
}): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('You must be signed in to add a vendor.');

  const { error } = await supabase.from('host_vendor_profiles').insert({
    business_name: input.businessName.trim(),
    category: input.category.trim() || 'Other',
    contact_name: input.contactName?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    service_area: input.serviceArea?.trim() || null,
    created_by: authData.user.id,
  });
  if (error) throw error;
}

export function vendorDocumentSummary(vendor: HostVendorProfile) {
  const values = Object.values(vendor.documents ?? {}).map(String);
  const onFile = values.filter((value) => value === 'on_file').length;
  const pending = values.filter((value) => value === 'pending').length;
  return { onFile, pending, total: values.length };
}

export function vendorSetupSummary(vendor: HostVendorProfile) {
  const setup = vendor.typical_setup ?? {};
  const parts: string[] = [];
  if (setup.booth_size) parts.push(String(setup.booth_size));
  if (setup.power_required === true) parts.push('Power');
  if (setup.water_required === true) parts.push('Water');
  return parts.join(' · ') || 'Setup varies';
}
