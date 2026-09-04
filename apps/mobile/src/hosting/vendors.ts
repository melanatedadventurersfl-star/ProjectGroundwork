import { supabase } from '../lib/supabase';

export type HostVendorProfile = {
  id: string;
  owner_profile_id: string | null;
  created_by: string | null;
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
  marketplace_visible: boolean;
  marketplace_category: string | null;
  marketplace_subcategory: string | null;
  vendor_kind: 'service' | 'product' | 'venue';
  availability_status: 'available' | 'limited' | 'booking_ahead' | 'contact' | 'unavailable';
  verification_status: 'new' | 'profile_complete' | 'go_melanated_verified' | 'documents_verified';
  starting_price_text: string | null;
  travel_radius_miles: number | null;
  event_types: string[];
  response_time_text: string | null;
  featured: boolean;
};

const CORE_SELECT = 'id,owner_profile_id,created_by,business_name,category,description,contact_name,email,phone,website,social_links,service_area,brand_assets,documents,internal_notes';
const DEMO_SELECT = `${CORE_SELECT},is_demo,demo_key,sample_pricing,typical_setup,demo_event_count,rating`;
const MARKET_SELECT = `${DEMO_SELECT},marketplace_visible,marketplace_category,marketplace_subcategory,vendor_kind,availability_status,verification_status,starting_price_text,travel_radius_miles,event_types,response_time_text,featured`;

type CoreVendorRow = Pick<HostVendorProfile,
  'id' | 'owner_profile_id' | 'created_by' | 'business_name' | 'category' | 'description' | 'contact_name' | 'email' | 'phone' | 'website' | 'social_links' | 'service_area' | 'brand_assets' | 'documents' | 'internal_notes'>;

type DemoVendorRow = CoreVendorRow & Pick<HostVendorProfile,
  'is_demo' | 'demo_key' | 'sample_pricing' | 'typical_setup' | 'demo_event_count' | 'rating'>;

function normalizeCoreVendor(row: CoreVendorRow): HostVendorProfile {
  return {
    ...row,
    is_demo: false,
    demo_key: null,
    sample_pricing: {},
    typical_setup: {},
    demo_event_count: 0,
    rating: null,
    marketplace_visible: false,
    marketplace_category: null,
    marketplace_subcategory: null,
    vendor_kind: 'service',
    availability_status: 'contact',
    verification_status: 'profile_complete',
    starting_price_text: null,
    travel_radius_miles: null,
    event_types: [],
    response_time_text: null,
    featured: false,
  };
}

function normalizeDemoVendor(row: DemoVendorRow): HostVendorProfile {
  return {
    ...normalizeCoreVendor(row),
    ...row,
  };
}

export async function listHostVendorProfiles(): Promise<HostVendorProfile[]> {
  const marketplace = await supabase
    .from('host_vendor_profiles')
    .select(MARKET_SELECT)
    .order('marketplace_visible', { ascending: false })
    .order('featured', { ascending: false })
    .order('business_name', { ascending: true });

  if (!marketplace.error) return (marketplace.data ?? []) as unknown as HostVendorProfile[];

  const demo = await supabase
    .from('host_vendor_profiles')
    .select(DEMO_SELECT)
    .order('is_demo', { ascending: true })
    .order('business_name', { ascending: true });

  if (!demo.error) return ((demo.data ?? []) as unknown as DemoVendorRow[]).map(normalizeDemoVendor);

  const legacy = await supabase
    .from('host_vendor_profiles')
    .select(CORE_SELECT)
    .order('business_name', { ascending: true });

  if (legacy.error) throw legacy.error;
  return ((legacy.data ?? []) as unknown as CoreVendorRow[]).map(normalizeCoreVendor);
}

export async function listMarketplaceVendors(): Promise<HostVendorProfile[]> {
  return (await listHostVendorProfiles()).filter((vendor) => vendor.marketplace_visible);
}

export async function listSavedVendorIds(): Promise<string[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from('host_saved_vendors')
    .select('vendor_profile_id')
    .eq('user_id', authData.user.id);

  if (error) {
    if (String(error.message ?? '').toLowerCase().includes('host_saved_vendors')) return [];
    throw error;
  }

  return (data ?? []).map((row) => String(row.vendor_profile_id));
}

export async function saveMarketplaceVendor(vendorProfileId: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('You must be signed in to save a vendor.');

  const { error } = await supabase.from('host_saved_vendors').upsert({
    user_id: authData.user.id,
    vendor_profile_id: vendorProfileId,
  }, { onConflict: 'user_id,vendor_profile_id' });

  if (error) throw error;
}

export async function removeSavedMarketplaceVendor(vendorProfileId: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('You must be signed in to remove a saved vendor.');

  const { error } = await supabase
    .from('host_saved_vendors')
    .delete()
    .eq('user_id', authData.user.id)
    .eq('vendor_profile_id', vendorProfileId);

  if (error) throw error;
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
    marketplace_visible: false,
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

export function vendorAvailabilityLabel(status: HostVendorProfile['availability_status']) {
  if (status === 'available') return 'Available now';
  if (status === 'limited') return 'Limited availability';
  if (status === 'booking_ahead') return 'Booking ahead';
  if (status === 'unavailable') return 'Unavailable';
  return 'Contact for availability';
}

export function vendorVerificationLabel(status: HostVendorProfile['verification_status']) {
  if (status === 'documents_verified') return 'Documents verified';
  if (status === 'go_melanated_verified') return 'Go Melanated verified';
  if (status === 'new') return 'New vendor';
  return 'Profile complete';
}
