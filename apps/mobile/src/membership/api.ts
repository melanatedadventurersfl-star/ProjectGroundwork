import { supabase } from '../lib/supabase';

export type MembershipPlan = {
  code: string;
  name: string;
  description: string | null;
  monthly_price_cents: number | null;
  annual_price_cents: number | null;
  entitlements: string[];
};

export type MembershipStatus = {
  profile_id: string;
  plan_code: string;
  plan_name: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'complimentary';
  billing_period: 'monthly' | 'annual' | 'complimentary' | null;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  entitlements: string[];
};

export type GoPlusAccess = {
  isGoPlus: boolean;
  entitlements: Set<string>;
  membership: MembershipStatus | null;
};

export async function getMembershipHub() {
  const [plansResult, membershipResult] = await Promise.all([
    supabase
      .from('membership_plans')
      .select('code,name,description,monthly_price_cents,annual_price_cents,entitlements')
      .eq('is_active', true)
      .order('monthly_price_cents', { ascending: true }),
    supabase
      .from('member_membership_status')
      .select('*')
      .maybeSingle(),
  ]);

  if (plansResult.error) throw plansResult.error;
  if (membershipResult.error) throw membershipResult.error;

  return {
    plans: (plansResult.data ?? []) as MembershipPlan[],
    membership: (membershipResult.data as MembershipStatus | null) ?? null,
  };
}

export async function getGoPlusAccess(): Promise<GoPlusAccess> {
  const { data, error } = await supabase
    .from('member_membership_status')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  const membership = (data as MembershipStatus | null) ?? null;
  const active = membership != null && ['trialing', 'active', 'complimentary'].includes(membership.status);

  return {
    isGoPlus: active && membership?.plan_code === 'go_plus',
    entitlements: new Set(active ? (membership?.entitlements ?? []) : []),
    membership,
  };
}

export function canUseEntitlement(access: GoPlusAccess, entitlement: string) {
  return access.isGoPlus && access.entitlements.has(entitlement);
}

export function getAdventureAccessState(input: {
  accessLevel?: string | null;
  goPlusEarlyAccessAt?: string | null;
  publicRegistrationAt?: string | null;
  isGoPlus: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const accessLevel = input.accessLevel ?? 'public';

  if (accessLevel === 'go_plus_only') {
    return input.isGoPlus
      ? { canRegister: true, label: 'Go+ Access', reason: null }
      : { canRegister: false, label: 'Go+ Exclusive', reason: 'This Adventure is reserved for Go+ members.' };
  }

  if (accessLevel === 'go_plus_early_access') {
    const publicAt = input.publicRegistrationAt ? new Date(input.publicRegistrationAt) : null;
    const earlyAt = input.goPlusEarlyAccessAt ? new Date(input.goPlusEarlyAccessAt) : null;

    if (publicAt && now >= publicAt) return { canRegister: true, label: null, reason: null };
    if (input.isGoPlus && (!earlyAt || now >= earlyAt)) return { canRegister: true, label: 'Go+ Early Access', reason: null };

    return {
      canRegister: false,
      label: 'Go+ Early Access',
      reason: publicAt ? `Public registration opens ${publicAt.toLocaleDateString()}.` : 'Go+ members can register first.',
    };
  }

  return { canRegister: true, label: null, reason: null };
}
