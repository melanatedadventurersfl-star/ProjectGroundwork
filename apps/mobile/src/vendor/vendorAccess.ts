import { supabase } from '../lib/supabase';

export type VendorAccessStatus = 'pending' | 'needs_info' | 'approved' | 'paused' | 'declined' | 'revoked';

export type VendorAccessRecord = {
  profile_id: string;
  status: VendorAccessStatus;
  business_name: string;
  category: string;
  service_area: string;
  application_note: string;
  applied_at: string;
  approved_at: string | null;
};

export type VendorEntryState = {
  approved: boolean;
  accessRecord: VendorAccessRecord | null;
  destination: string;
};

const SELECT = 'profile_id,status,business_name,category,service_area,application_note,applied_at,approved_at';

export function sanitizeVendorDestination(value?: string | string[] | null) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/vendor')) return '/vendor';
  if (candidate.startsWith('/vendor-login')) return '/vendor';
  return candidate;
}

export async function getVendorAccess(): Promise<{ approved: boolean; record: VendorAccessRecord | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return { approved: false, record: null };

  const { data, error } = await supabase
    .from('vendor_center_access')
    .select(SELECT)
    .eq('profile_id', authData.user.id)
    .maybeSingle();
  if (error) throw error;

  const record = (data ?? null) as VendorAccessRecord | null;
  return { approved: record?.status === 'approved', record };
}

export async function resolveVendorEntry(next?: string | string[] | null): Promise<VendorEntryState> {
  const destination = sanitizeVendorDestination(next);
  const access = await getVendorAccess();
  return { approved: access.approved, accessRecord: access.record, destination };
}

export async function submitVendorApplication(input: {
  businessName: string;
  category: string;
  serviceArea?: string;
  applicationNote?: string;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in before applying for Vendor Center access.');

  const existing = await getVendorAccess();
  if (existing.record?.status === 'approved') return existing.record;
  if (existing.record?.status === 'paused' || existing.record?.status === 'revoked') {
    throw new Error('This vendor account cannot submit a new application right now.');
  }

  const payload = {
    profile_id: authData.user.id,
    status: 'pending' as const,
    business_name: input.businessName.trim(),
    category: input.category.trim(),
    service_area: input.serviceArea?.trim() ?? '',
    application_note: input.applicationNote?.trim() ?? '',
    applied_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing.record) {
    const { data, error } = await supabase
      .from('vendor_center_access')
      .update(payload)
      .eq('profile_id', authData.user.id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as VendorAccessRecord;
  }

  const { data, error } = await supabase
    .from('vendor_center_access')
    .insert(payload)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as VendorAccessRecord;
}

export function vendorAccessLabel(status?: VendorAccessStatus | null) {
  if (status === 'approved') return 'Approved';
  if (status === 'pending') return 'Application pending';
  if (status === 'needs_info') return 'More information needed';
  if (status === 'paused') return 'Access paused';
  if (status === 'declined') return 'Application declined';
  if (status === 'revoked') return 'Access revoked';
  return 'Vendor access required';
}
