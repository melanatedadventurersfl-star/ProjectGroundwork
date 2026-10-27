# Spring Glen · Field Operations
A standalone web-only application under `ProjectGroundwork/spring-glen/`. Other repository folders are untouched.

## What is implemented
- Supabase email/password authentication and pending worker applications
- Manager-approved workers and skill verification
- Task publishing, qualified claiming with atomic reservation RPC, and per-worker offers
- Property GPS check-in / check-out (unverified by default)
- Before/after/photo/video uploads to a private Supabase Storage bucket
- Worker task transitions: reserved, active, paused, submitted
- Manager work review and manual external payment tracking
- Location zones, manager operations dashboard

## Existing backend
Supabase project: `hqndxityqrdiiwqyjagu` (Go Melanated's active shared instance).
All Spring Glen business tables use prefix `sg_`. Existing community tables were not changed. The Workout App Supabase project `iftnwzqlofhujzulmofu` was already inactive and was not modified.

## Required first manager provisioning
The initial account cannot grant itself management authority. Sign up from the Spring Glen web app, verify email, then an existing Supabase database administrator must execute a deliberate, authenticated approval of that specific user after verifying their ID:
```sql
update public.sg_members
set role='manager', approval='approved'
where user_id = '<verified user UUID>';
```
This is intentionally not exposed to public signup.

## Production caveats
**Early alpha, not production-ready.** No completed offline media persistence/sync; no real QR validation; no actual mapped site plan; no AI task drafting endpoint; no owner budget ledger; no email/push dispatch; no automated external transfers. Do not use this version as the official employee timekeeping/payroll system. Photos require connectivity. Approval and payment functions still require server-enforced workflow hardening and security review before financial use. Publish externally only after permission/security tests.

## Hosting
Serve this folder over HTTPS. A static host or GitHub Pages configured for the repository may be suitable. On your Supabase Auth settings, add the exact HTTPS site URL to approved redirect URLs. No service-role secrets belong in this public repository.

## Planned next steps
1. Complete authorization hardening with server-only status transitions and finance auditing.
2. Offline IndexedDB media queue on iOS and Android, including failure recovery.
3. Property image overlay and QR station verification.
4. Owner-admin approval policy and funded budget controls.
5. AI task draft via server-side endpoint with explicit manager confirmation.
