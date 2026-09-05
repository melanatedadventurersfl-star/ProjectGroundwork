-- Expand Host Center marketing destinations to match the provider-neutral distribution model.

alter table public.host_campaign_marketing_items
  drop constraint if exists host_campaign_marketing_items_platforms_check;

alter table public.host_campaign_marketing_items
  add constraint host_campaign_marketing_items_platforms_check
  check (platforms <@ array[
    'go_melanated'::text,
    'facebook'::text,
    'instagram'::text,
    'meetup'::text,
    'eventbrite'::text,
    'email'::text,
    'sms'::text,
    'other'::text
  ]);
