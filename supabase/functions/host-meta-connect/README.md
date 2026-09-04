# Host Profile Meta connector

This connector links an organization Host Profile to Facebook Pages and linked Instagram professional accounts for profile-data import only.

## Required Edge Function secrets

- `META_APP_ID`
- `META_APP_SECRET`
- `META_GRAPH_VERSION`
- `META_TOKEN_ENCRYPTION_KEY`
- `META_PROFILE_CALLBACK_URL` (optional if the default Supabase callback URL is used)
- `META_PROFILE_SCOPES` (optional, defaults to `pages_show_list,pages_read_engagement,instagram_basic`)

`META_TOKEN_ENCRYPTION_KEY` should be a long random secret. Provider access tokens are encrypted with AES-GCM before they are stored.

## Meta OAuth redirect URI

Add the deployed callback Edge Function URL to the Meta app's valid OAuth redirect URIs:

`https://hqndxityqrdiiwqyjagu.supabase.co/functions/v1/host-meta-callback`

If `META_PROFILE_CALLBACK_URL` is set, use that exact value instead.

## Behavior

1. The signed-in Go Melanated organization owner/admin starts the connection.
2. `host-meta-connect` creates a short-lived server-side OAuth state and returns the Facebook authorization URL.
3. Meta redirects to `host-meta-callback`.
4. The callback validates and consumes the state, exchanges the authorization code, encrypts the provider token, and redirects back to the Go Melanated app.
5. The host chooses one of the Facebook Pages returned by Meta.
6. The connector imports that Page's profile data and, when available, the linked Instagram professional account profile data into `host_social_profiles`.
7. Organization profile fields are not overwritten automatically. Imported social data remains separately reviewable.
8. Disconnecting removes the encrypted Meta connection while keeping imported social profile rows as manual data.

Facebook Groups remain manual because the Meta Groups API is not available for this use case.
