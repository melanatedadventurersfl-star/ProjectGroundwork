import { supabase } from '../lib/supabase';
import { getOutingHostAccess } from './api';

export type HostTicketType = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number | null;
  min_per_order: number;
  max_per_order: number;
  is_active: boolean;
  sort_order: number;
};

export type HostTicketInput = {
  name: string;
  description?: string;
  priceCents: number;
  capacity?: number | null;
  minPerOrder?: number;
  maxPerOrder?: number;
};

function validateTicketInput(input: HostTicketInput) {
  if (!input.name.trim()) throw new Error('Add a ticket name.');
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) throw new Error('Ticket price is invalid.');
  if (input.capacity != null && (!Number.isInteger(input.capacity) || input.capacity < 0)) throw new Error('Ticket capacity is invalid.');
  const minPerOrder = input.minPerOrder ?? 1;
  const maxPerOrder = input.maxPerOrder ?? Math.min(input.capacity ?? 10, 10);
  if (!Number.isInteger(minPerOrder) || minPerOrder < 0) throw new Error('Minimum per order is invalid.');
  if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1 || maxPerOrder < minPerOrder) throw new Error('Maximum per order is invalid.');
  return { minPerOrder, maxPerOrder };
}

async function ensurePaidPermission(priceCents: number) {
  if (priceCents === 0) return;
  const access = await getOutingHostAccess();
  if (!access.paidEnabled) throw new Error('Paid hosting is not enabled for your account yet.');
}

async function syncStartingPrice(adventureId: string) {
  const { data, error } = await supabase
    .from('ticket_types')
    .select('price_cents')
    .eq('adventure_id', adventureId)
    .eq('is_active', true)
    .order('price_cents', { ascending: true });
  if (error) throw error;
  const startingPrice = data?.[0]?.price_cents ?? 0;
  const { error: adventureError } = await supabase.from('adventures').update({ starting_price_cents: startingPrice }).eq('id', adventureId);
  if (adventureError) throw adventureError;
}

export async function addGeneralAdmissionTicket(adventureId: string, capacity: number | null, priceCents: number) {
  return addHostTicketType(adventureId, {
    name: 'General Admission',
    description: priceCents === 0 ? 'Admission to this community outing.' : 'General admission to this community outing.',
    priceCents,
    capacity,
    minPerOrder: 1,
    maxPerOrder: Math.min(capacity ?? 10, 10),
  });
}

export async function addHostTicketType(adventureId: string, input: HostTicketInput) {
  const { minPerOrder, maxPerOrder } = validateTicketInput(input);
  await ensurePaidPermission(input.priceCents);
  const existing = await listHostTicketTypes(adventureId);
  const sortOrder = existing.length === 0 ? 0 : Math.max(...existing.map((ticket) => ticket.sort_order)) + 1;

  const { data, error } = await supabase
    .from('ticket_types')
    .insert({
      adventure_id: adventureId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      capacity: input.capacity ?? null,
      min_per_order: minPerOrder,
      max_per_order: maxPerOrder,
      is_active: true,
      sort_order: sortOrder,
    })
    .select('id,name,description,price_cents,capacity,min_per_order,max_per_order,is_active,sort_order')
    .single();
  if (error) throw error;
  await syncStartingPrice(adventureId);
  return data as HostTicketType;
}

export async function updateHostTicketType(adventureId: string, ticketId: string, input: HostTicketInput) {
  const { minPerOrder, maxPerOrder } = validateTicketInput(input);
  await ensurePaidPermission(input.priceCents);
  const { data, error } = await supabase
    .from('ticket_types')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      capacity: input.capacity ?? null,
      min_per_order: minPerOrder,
      max_per_order: maxPerOrder,
    })
    .eq('id', ticketId)
    .eq('adventure_id', adventureId)
    .select('id,name,description,price_cents,capacity,min_per_order,max_per_order,is_active,sort_order')
    .single();
  if (error) throw error;
  await syncStartingPrice(adventureId);
  return data as HostTicketType;
}

export async function setHostTicketActive(adventureId: string, ticketId: string, isActive: boolean) {
  const { error } = await supabase
    .from('ticket_types')
    .update({ is_active: isActive })
    .eq('id', ticketId)
    .eq('adventure_id', adventureId);
  if (error) throw error;
  await syncStartingPrice(adventureId);
}

export async function listHostTicketTypes(adventureId: string): Promise<HostTicketType[]> {
  const { data, error } = await supabase
    .from('ticket_types')
    .select('id,name,description,price_cents,capacity,min_per_order,max_per_order,is_active,sort_order')
    .eq('adventure_id', adventureId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as HostTicketType[];
}
