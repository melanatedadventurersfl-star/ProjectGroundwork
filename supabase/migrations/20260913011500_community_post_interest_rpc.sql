create or replace function public.set_community_post_interests(p_post_id uuid, p_interest_slugs text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.community_posts p
    where p.id = p_post_id
      and p.author_id = auth.uid()
  ) then
    raise exception 'Post not found or not owned by current member';
  end if;

  delete from public.community_post_interests where post_id = p_post_id;

  insert into public.community_post_interests (post_id, interest_id)
  select p_post_id, i.id
  from public.interests i
  where i.is_active
    and i.slug = any(coalesce(p_interest_slugs, array[]::text[]))
  on conflict do nothing;
end;
$$;

revoke all on function public.set_community_post_interests(uuid, text[]) from public, anon;
grant execute on function public.set_community_post_interests(uuid, text[]) to authenticated;
