-- Add a sparse friend network between fictional pilot personas.
-- Every synthetic persona is connected to the founder in the previous migration.
-- These additional links make mutual connections and Crew views less uniform.

with pairs(email_a, email_b) as (
  values
    ('maya.brooks@ma-demo.test','devon.hill@ma-demo.test'),
    ('maya.brooks@ma-demo.test','tasha.green@ma-demo.test'),
    ('jordan.reed@ma-demo.test','marcus.ellis@ma-demo.test'),
    ('jordan.reed@ma-demo.test','melanatedadventurersfl+trailtester02@gmail.com'),
    ('nia.carter@ma-demo.test','melanatedadventurersfl+hosttester01@gmail.com'),
    ('nia.carter@ma-demo.test','avery.king@ma-demo.test'),
    ('marcus.ellis@ma-demo.test','melanatedadventurersfl+hosttester01@gmail.com'),
    ('tasha.green@ma-demo.test','eli.green@ma-demo.test'),
    ('devon.hill@ma-demo.test','melanatedadventurersfl+trailtester01@gmail.com')
), resolved as (
  select a.id as requester_id, b.id as addressee_id
  from pairs x
  join public.profiles a on lower(a.email) = lower(x.email_a) and a.is_synthetic = true
  join public.profiles b on lower(b.email) = lower(x.email_b) and b.is_synthetic = true
)
insert into public.member_connections (requester_id, addressee_id, status)
select r.requester_id, r.addressee_id, 'accepted'
from resolved r
where r.requester_id <> r.addressee_id
  and not exists (
    select 1 from public.member_connections mc
    where least(mc.requester_id, mc.addressee_id) = least(r.requester_id, r.addressee_id)
      and greatest(mc.requester_id, mc.addressee_id) = greatest(r.requester_id, r.addressee_id)
  );
