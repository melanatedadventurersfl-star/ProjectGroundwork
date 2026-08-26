-- Allow protected platform administrators to remove any community post directly
-- from the Outpost while preserving the existing author-only delete policy for members.

create policy "Platform admins delete community posts"
on public.community_posts
for delete
to authenticated
using (public.is_platform_admin());
