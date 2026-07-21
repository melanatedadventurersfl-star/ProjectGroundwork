create type public.order_status as enum ('draft','held','payment_pending','paid','cancelled','expired','refunded');
create type public.attendee_kind as enum ('self','household_member','guest');

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  capacity integer check (capacity is null or capacity >= 0),
  min_per_order integer not null default 0,
  max_per_order integer not null default 10,
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.adventure_addons (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  capacity integer check (capacity is null or capacity >= 0),
  max_per_order integer not null default 10,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.waivers (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  title text not null,
  body text not null,
  version text not null,
  required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete restrict,
  purchaser_id uuid not null references public.profiles(id) on delete restrict,
  status public.order_status not null default 'draft',
  subtotal_cents integer not null default 0,
  total_cents integer not null default 0,
  hold_expires_at timestamptz,
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid references public.ticket_types(id) on delete restrict,
  addon_id uuid references public.adventure_addons(id) on delete restrict,
  description text not null,
  unit_price_cents integer not null,
  quantity integer not null check (quantity > 0),
  line_total_cents integer generated always as (unit_price_cents * quantity) stored,
  check ((ticket_type_id is not null) <> (addon_id is not null))
);

create table public.order_attendees (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  kind public.attendee_kind not null,
  profile_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  registration_answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.waiver_acceptances (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  attendee_id uuid references public.order_attendees(id) on delete cascade,
  waiver_id uuid not null references public.waivers(id) on delete restrict,
  accepted_by uuid not null references public.profiles(id) on delete restrict,
  waiver_version text not null,
  accepted_at timestamptz not null default now(),
  signature_name text not null
);

create table public.ticket_credentials (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  attendee_id uuid not null unique references public.order_attendees(id) on delete cascade,
  credential_code text not null unique default encode(gen_random_bytes(18), 'hex'),
  checked_in_at timestamptz,
  issued_at timestamptz not null default now()
);

create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

alter table public.ticket_types enable row level security;
alter table public.adventure_addons enable row level security;
alter table public.waivers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_attendees enable row level security;
alter table public.waiver_acceptances enable row level security;
alter table public.ticket_credentials enable row level security;

create policy "Published ticket types are readable" on public.ticket_types for select
using (exists (select 1 from public.adventures a where a.id = adventure_id and a.status in ('published','sold_out')));
create policy "Published addons are readable" on public.adventure_addons for select
using (exists (select 1 from public.adventures a where a.id = adventure_id and a.status in ('published','sold_out')));
create policy "Active waivers are readable" on public.waivers for select
using (active and exists (select 1 from public.adventures a where a.id = adventure_id and a.status in ('published','sold_out')));
create policy "Purchasers read their orders" on public.orders for select using (purchaser_id = auth.uid());
create policy "Purchasers create their orders" on public.orders for insert with check (purchaser_id = auth.uid());
create policy "Purchasers update unpaid orders" on public.orders for update
using (purchaser_id = auth.uid() and status in ('draft','held','payment_pending'))
with check (purchaser_id = auth.uid());
create policy "Purchasers read order items" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.purchaser_id = auth.uid()));
create policy "Purchasers manage order items" on public.order_items for all using (exists (select 1 from public.orders o where o.id = order_id and o.purchaser_id = auth.uid() and o.status in ('draft','held')))
with check (exists (select 1 from public.orders o where o.id = order_id and o.purchaser_id = auth.uid() and o.status in ('draft','held')));
create policy "Purchasers manage attendees" on public.order_attendees for all using (exists (select 1 from public.orders o where o.id = order_id and o.purchaser_id = auth.uid() and o.status in ('draft','held')))
with check (exists (select 1 from public.orders o where o.id = order_id and o.purchaser_id = auth.uid() and o.status in ('draft','held')));
create policy "Purchasers manage waiver acceptances" on public.waiver_acceptances for all using (accepted_by = auth.uid()) with check (accepted_by = auth.uid());
create policy "Purchasers read credentials" on public.ticket_credentials for select using (exists (select 1 from public.orders o where o.id = order_id and o.purchaser_id = auth.uid()));

create or replace function public.recalculate_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare result public.orders;
begin
  if not exists (select 1 from public.orders where id = p_order_id and purchaser_id = auth.uid()) then raise exception 'Order not found'; end if;
  update public.orders o set subtotal_cents = coalesce((select sum(line_total_cents) from public.order_items where order_id = p_order_id),0), total_cents = coalesce((select sum(line_total_cents) from public.order_items where order_id = p_order_id),0) where o.id = p_order_id returning * into result;
  return result;
end; $$;

create or replace function public.hold_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare result public.orders;
begin
  perform public.recalculate_order(p_order_id);
  if not exists (select 1 from public.orders where id = p_order_id and purchaser_id = auth.uid() and status in ('draft','held')) then raise exception 'Order unavailable'; end if;
  update public.orders set status='held', hold_expires_at=now()+interval '15 minutes' where id=p_order_id returning * into result;
  return result;
end; $$;

create or replace function public.issue_order_credentials(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ticket_credentials(order_id, attendee_id)
  select p_order_id, a.id from public.order_attendees a where a.order_id=p_order_id
  on conflict (attendee_id) do nothing;
end; $$;