# GoMelanated deployment

Target URL: `https://app.gomelanated.com`

## Hostinger

- Repository: `melanatedadventurersfl-star/ProjectGroundwork`
- Branch: `ma-app-foundation-v0.1`
- App directory: `apps/member-web`
- Node.js: 22
- Install: `npm ci`
- Build: `npm run build`
- Start: `npm run start`
- Domain: `app.gomelanated.com`

Configure the environment values listed in `.env.example` through Hostinger's private environment settings. Do not commit secret values.

## Supabase

Project ref: `hqndxityqrdiiwqyjagu`

The schema and security policies are deployed.

Configure Auth URLs:

- Site URL: `https://app.gomelanated.com`
- Redirect URL: `https://app.gomelanated.com/auth/callback`

Create the first administrator, link the Auth user to `people.auth_user_id`, and grant `administrator` in `member_roles`.

## Stripe

Create a webhook at:

`https://app.gomelanated.com/api/payments/webhook`

Subscribe to `checkout.session.completed` and `checkout.session.expired`.

## Smoke test

1. Join the early-access list.
2. Approve the record and assign Cohort 0.
3. Send the invitation and activate the account.
4. Register for Castaway without payment.
5. Register another test with lunch or support.
6. Complete checkout and verify payment and registration statuses.
