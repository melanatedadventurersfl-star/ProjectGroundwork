import { supabase } from '../lib/supabase';
import type { AdventureAddon, CheckoutSelection, CreatedOrder, TicketType, Waiver } from './types';

export async function getCheckoutOptions(adventureId: string) {
  const [ticketsResult, addonsResult, waiversResult] = await Promise.all([
    supabase.from('ticket_types').select('*').eq('adventure_id', adventureId).eq('is_active', true).order('sort_order'),
    supabase.from('adventure_addons').select('*').eq('adventure_id', adventureId).eq('is_active', true).order('sort_order'),
    supabase.from('waivers').select('*').eq('adventure_id', adventureId).eq('active', true).order('created_at'),
  ]);

  if (ticketsResult.error) throw ticketsResult.error;
  if (addonsResult.error) throw addonsResult.error;
  if (waiversResult.error) throw waiversResult.error;

  return {
    tickets: (ticketsResult.data ?? []) as TicketType[],
    addons: (addonsResult.data ?? []) as AdventureAddon[],
    waivers: (waiversResult.data ?? []) as Waiver[],
  };
}

export async function createHeldOrder(adventureId: string, selection: CheckoutSelection): Promise<CreatedOrder> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error('You must be signed in to register.');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ adventure_id: adventureId, purchaser_id: user.id, status: 'draft' })
    .select('id,total_cents,status,hold_expires_at')
    .single();
  if (orderError) throw orderError;

  const ticketIds = Object.keys(selection.ticketQuantities).filter((id) => selection.ticketQuantities[id] > 0);
  const addonIds = Object.keys(selection.addonQuantities).filter((id) => selection.addonQuantities[id] > 0);

  const [{ data: tickets, error: ticketError }, { data: addons, error: addonError }] = await Promise.all([
    supabase.from('ticket_types').select('id,name,price_cents').in('id', ticketIds),
    addonIds.length ? supabase.from('adventure_addons').select('id,name,price_cents').in('id', addonIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (ticketError) throw ticketError;
  if (addonError) throw addonError;

  const items = [
    ...(tickets ?? []).map((ticket) => ({
      order_id: order.id,
      ticket_type_id: ticket.id,
      addon_id: null,
      description: ticket.name,
      unit_price_cents: ticket.price_cents,
      quantity: selection.ticketQuantities[ticket.id],
    })),
    ...(addons ?? []).map((addon) => ({
      order_id: order.id,
      ticket_type_id: null,
      addon_id: addon.id,
      description: addon.name,
      unit_price_cents: addon.price_cents,
      quantity: selection.addonQuantities[addon.id],
    })),
  ];

  if (items.length) {
    const { error } = await supabase.from('order_items').insert(items);
    if (error) throw error;
  }

  if (selection.attendees.length) {
    const { error } = await supabase.from('order_attendees').insert(
      selection.attendees.map((attendee) => ({
        order_id: order.id,
        ticket_type_id: attendee.ticketTypeId,
        kind: attendee.kind,
        profile_id: attendee.profileId ?? null,
        first_name: attendee.firstName,
        last_name: attendee.lastName,
        email: attendee.email ?? null,
      })),
    );
    if (error) throw error;
  }

  const { data: held, error: holdError } = await supabase.rpc('hold_order', { p_order_id: order.id });
  if (holdError) throw holdError;
  return held as CreatedOrder;
}

export async function getOrderConfirmation(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_cents,hold_expires_at,adventures(title,starts_at,city,state),ticket_credentials(id,credential_code,order_attendees(first_name,last_name))')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data;
}