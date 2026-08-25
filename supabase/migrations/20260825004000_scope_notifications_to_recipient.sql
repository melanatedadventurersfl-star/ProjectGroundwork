-- Notification inboxes are private, including for the master/founder account.
-- Security-definer notification producers can continue inserting alerts without
-- granting the master account broad read/update access to every member inbox.

drop policy if exists "Master account full access" on public.notifications;
