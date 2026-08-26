import { supabase } from '../lib/supabase';
import { getOutingHostAccess } from './api';

export type HostAddon = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number | null;
  max_per_order: number;
  is_active: boolean;
  sort_order: number;
};

export type HostAddonInput = {
  name: string;
  description?: string;
  priceCents: number;
  capacity?: number | null;
  maxPerOrder?: number;
};

function validateAddonInput(input: HostAddonInput) {
  if (!input.name.trim()) throw new Error('Add an add-on name.');
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) throw new Error('Add-on price is invalid.');
  if (input.capacity != null && (!Number.isInteger(input.capacity) || input.capacity < 0)) throw new Error('Add-on capacity is invalid.');
  const maxPerOrder = input.maxPerOrder ?? Math.min(input.capacity ?? 10, 10);
  if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1) throw new Error('Maximum per order is invalid.');
  return maxPerOrder;
}

async function ensurePaidPermission(priceCents: number) {
  if (priceCents === 0) return;
  const access = await getOutingHostAccess();
  if (!access.paidEnabled) throw new Error('Paid hosting is not enabled for your account yet.');
}

export async function listHostAddons(adventureId: string): Promise<HostAddon[]> {
  const { data, error } = await supabase
    .from('adventure_addons')
    .select('id,name,description,price_cents,capacity,max_per_order,is_active,sort_order')
    .eq('adventure_id', adventureId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as HostAddon[];
}

export async function addHostAddon(adventureId: string, input: HostAddonInput) {
  const maxPerOrder = validateAddonInput(input);
  await ensurePaidPermission(input.priceCents);
  const existing = await listHostAddons(adventureId);
  const sortOrder = existing.length === 0 ? 0 : Math.max(...existing.map((addon) => addon.sort_order)) + 1;

  const { data, error } = await supabase
    .from('adventure_addons')
    .insert({
      adventure_id: adventureId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      capacity: input.capacity ?? null,
      max_per_order: maxPerOrder,
      is_active: true,
      sort_order: sortOrder,
    })
    .select('id,name,description,price_cents,capacity,max_per_order,is_active,sort_order')
    .single();
  if (error) throw error;
  return data as HostAddon;
}

export async function updateHostAddon(adventureId: string, addonId: string, input: HostAddonInput) {
  const maxPerOrder = validateAddonInput(input);
  await ensurePaidPermission(input.priceCents);
  const { data, error } = await supabase
    .from('adventure_addons')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      capacity: input.capacity ?? null,
      max_per_order: maxPerOrder,
    })
    .eq('id', addonId)
    .eq('adventure_id', adventureId)
    .select('id,name,description,price_cents,capacity,max_per_order,is_active,sort_order')
    .single();
  if (error) throw error;
  return data as HostAddon;
}

export async function setHostAddonActive(adventureId: string, addonId: string, isActive: boolean) {
  const { error } = await supabase
    .from('adventure_addons')
    .update({ is_active: isActive })
    .eq('id', addonId)
    .eq('adventure_id', adventureId);
  if (error) throw error;
}
