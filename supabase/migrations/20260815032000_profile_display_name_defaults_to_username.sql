create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_username text;
  chosen_display_name text;
begin
  chosen_username := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username'
  )), '');

  chosen_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    chosen_username,
    coalesce(chosen_display_name, chosen_username, 'Adventurer')
  );
  return new;
end;
$$;
