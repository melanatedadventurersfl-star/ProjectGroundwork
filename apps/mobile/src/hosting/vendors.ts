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

export async function listHostVendorProfiles(): Promise<HostVendorProfile[]> {
  const { data, error } = await supabase
    .from('host_vendor_profiles')
    .select('id,business_name,category,description,contact_name,email,phone,website,social_links,service_area,brand_assets,documents,internal_notes,is_demo,demo_key,sample_pricing,typical_setup,demo_event_count,rating')
    .order('is_demo', { ascending: true })
    .order('business_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HostVendorProfile[];
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
