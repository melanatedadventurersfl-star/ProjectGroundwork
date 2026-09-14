drop policy if exists "Organization members view venue preferences" on public.organization_venue_preferences;
create policy "Organization members view venue preferences"
on public.organization_venue_preferences for select to authenticated
using (private.is_organization_member(organization_id, auth.uid()));

drop policy if exists "Event managers manage venue preferences" on public.organization_venue_preferences;
create policy "Event managers manage venue preferences"
on public.organization_venue_preferences for all to authenticated
using (private.has_organization_permission(organization_id, 'events.manage', auth.uid()))
with check (private.has_organization_permission(organization_id, 'events.manage', auth.uid()));

drop policy if exists "Hosts view own venue shortlist" on public.host_venue_shortlist;
create policy "Hosts view own venue shortlist"
on public.host_venue_shortlist for select to authenticated
using (profile_id = auth.uid() and private.is_organization_member(organization_id, auth.uid()));

drop policy if exists "Hosts manage own venue shortlist" on public.host_venue_shortlist;
create policy "Hosts manage own venue shortlist"
on public.host_venue_shortlist for all to authenticated
using (profile_id = auth.uid() and private.has_organization_permission(organization_id, 'events.manage', auth.uid()))
with check (profile_id = auth.uid() and private.has_organization_permission(organization_id, 'events.manage', auth.uid()));
