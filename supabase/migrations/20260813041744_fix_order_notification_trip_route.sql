create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare kind_value public.notification_kind; notification_title text; notification_body text;
begin
  if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
  if new.status='held'::public.order_status then kind_value='registration'; notification_title='Reservation held'; notification_body='Your adventure reservation is being held while payment is pending.';
  elsif new.status='payment_pending'::public.order_status then kind_value='payment'; notification_title='Payment pending'; notification_body='Your reservation is waiting for payment confirmation.';
  elsif new.status='paid'::public.order_status then kind_value='payment'; notification_title='Payment confirmed'; notification_body='Your adventure is confirmed. Readiness and your adventure group are now available.';
  elsif new.status='refunded'::public.order_status then kind_value='payment'; notification_title='Refund updated'; notification_body='Your reservation has been marked refunded.';
  elsif new.status='cancelled'::public.order_status then kind_value='registration'; notification_title='Reservation cancelled'; notification_body='Your reservation has been cancelled.';
  else return new; end if;

  insert into public.notifications(recipient_id,adventure_id,kind,priority,title,body,action_url,dedupe_key)
  values(new.purchaser_id,new.adventure_id,kind_value,'normal',notification_title,notification_body,
         '/member/trips', 'order-'||new.id::text||'-'||new.status::text)
  on conflict (recipient_id,dedupe_key) do nothing;
  return new;
end; $$;
