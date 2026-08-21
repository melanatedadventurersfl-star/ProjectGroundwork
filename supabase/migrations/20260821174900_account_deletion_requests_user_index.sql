create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests (user_id)
  where user_id is not null;
