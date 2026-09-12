-- Cover the creator foreign key introduced by tenant-aware signup join links.
create index if not exists organization_join_links_created_by_idx
  on private.organization_join_links(created_by);
