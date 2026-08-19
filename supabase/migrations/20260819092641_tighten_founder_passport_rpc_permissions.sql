revoke execute on function public.get_my_passport_rank() from anon;
revoke execute on function public.creator_search_passport_members(text, integer) from anon;
revoke execute on function public.creator_get_passport_recognition(uuid) from anon;
revoke execute on function public.creator_set_rank_override(uuid, text, text) from anon;
revoke execute on function public.creator_clear_rank_override(uuid, text) from anon;
revoke execute on function public.creator_grant_badge(uuid, uuid, text) from anon;
revoke execute on function public.creator_revoke_badge(uuid, uuid, text) from anon;
revoke execute on function public.creator_grant_stamp(uuid, uuid, text) from anon;
revoke execute on function public.creator_revoke_stamp(uuid, uuid, text) from anon;
