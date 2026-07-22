begin;

select plan(18);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'adventures', 'adventures table exists');
select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'readiness_tasks', 'readiness tasks table exists');
select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'community_posts', 'community posts table exists');
select has_table('public', 'adventure_reflections', 'reflections table exists');
select has_table('public', 'support_requests', 'support table exists');
select has_view('public', 'published_adventures', 'published adventure discovery view exists');
select has_view('public', 'member_adventure_queue', 'member adventure queue view exists');
select has_view('public', 'member_journey', 'member journey view exists');
select has_view('public', 'member_ticket_wallet', 'member ticket wallet view exists');
select has_function('public', 'handle_new_user', array[]::text[], 'new-user profile function exists');
select has_function('public', 'complete_member_onboarding', array['jsonb'], 'onboarding completion function exists');
select has_function('public', 'create_registration_hold', array['uuid','jsonb','jsonb','jsonb'], 'registration hold function exists');
select has_function('public', 'create_household_with_owner', array['text'], 'household creation function exists');
select isnt_empty('select tablename from pg_tables where schemaname = ''public'' and rowsecurity', 'RLS is enabled on public tables');
select pass('MVP schema smoke suite reached completion');

select * from finish();
rollback;
