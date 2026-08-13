export type TicketType = {
  id: string;
  adventure_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number | null;
  min_per_order: number;
  max_per_order: number;
};

export type AdventureAddon = {
  id: string;
  adventure_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number | null;
  max_per_order: number;
};

export type Waiver = {
  id: string;
  adventure_id: string;
  title: string;
  body: string;
  version: string;
  required: boolean;
};

export type CheckoutAttendeeKind = 'self' | 'household_member' | 'connected_member' | 'guest';

export type CheckoutAttendee = {
  ticketTypeId: string;
  kind: CheckoutAttendeeKind;
  profileId?: string;
  firstName: string;
  lastName: string;
  email?: string;
};

export type CheckoutKnownPerson = {
  profileId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string | null;
  relationship: 'self' | 'trail_family' | 'connection';
  trailFamilyRole?: string | null;
};

export type CheckoutSelection = {
  ticketQuantities: Record<string, number>;
  addonQuantities: Record<string, number>;
  attendees: CheckoutAttendee[];
  signatureName: string;
  waiverAccepted: boolean;
};

export type CreatedOrder = {
  id: string;
  total_cents: number;
  status: 'draft' | 'held' | 'payment_pending' | 'paid';
  hold_expires_at: string | null;
};