import { supabase } from '../lib/supabase';

export async function addGeneralAdmissionTicket(
  adventureId: string,
  capacity: number | null,
  priceCents: number,
) {
  if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error('Ticket price is invalid.');

  const { data, error } = await supabase
    .from('ticket_types')
    .insert({
      adventure_id: adventureId,
      name: 'General Admission',
      description: priceCents === 0 ? 'Admission to this community outing.' : 'General admission to this community outing.',
      price_cents: priceCents,
      capacity,
      min_per_order: 1,
      max_per_order: Math.min(capacity ?? 10, 10),
      is_active: true,
      sort_order: 0,
    })
    .select('id,name,price_cents,capacity')
    .single();
  if (error) throw error;

  const { error: adventureError } = await supabase
    .from('adventures')
    .update({ starting_price_cents: priceCents })
    .eq('id', adventureId);
  if (adventureError) throw adventureError;

  return data;
}

export async function listHostTicketTypes(adventureId: string) {
  const { data, error } = await supabase
    .from('ticket_types')
    .select('id,name,description,price_cents,capacity,min_per_order,max_per_order,is_active,sort_order')
    .eq('adventure_id', adventureId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}
