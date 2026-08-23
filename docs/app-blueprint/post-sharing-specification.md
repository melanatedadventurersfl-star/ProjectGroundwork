# Go Melanated Post Sharing Specification

## Purpose

Sharing an Outpost post must send enough context for the recipient to understand what was shared and provide a direct path back to the exact post in Go Melanated.

## Current problem

The existing native share action sends only a generic sentence: `Check out this post on Melanated.` The message contains no author, no post preview, and no post destination. A recipient cannot tell what was shared and cannot navigate back to the post.

## Required share payload

Every shared community post must include:

1. The post author's display name.
2. A concise preview of the post body.
3. A direct deep link to the exact post.
4. Go Melanated branding rather than the retired generic `Melanated` wording.

Default format:

`{Author} shared on Go Melanated`

`“{Post preview}”`

`Open the post: {post URL}`

## Preview rules

- Collapse repeated whitespace.
- Limit the preview to 160 characters.
- If the body exceeds the limit, truncate cleanly and append an ellipsis.
- If the post cannot be loaded, still share a usable fallback message and direct post link.

## Link behavior

### Native deep link

The app already declares the `melanatedadventurers` URL scheme. Community post links use:

`melanatedadventurers://community/{postId}`

Expo Router maps this path to the existing `/community/[id]` route.

### Future universal-link upgrade

The sharing implementation must support `EXPO_PUBLIC_SHARE_BASE_URL`. When configured, the share target becomes:

`{EXPO_PUBLIC_SHARE_BASE_URL}/community/{postId}`

This allows the same share code to move to an HTTPS universal/app link once the public Go Melanated web domain is finalized. Until then, the native scheme remains the fallback.

## Recipient states

### App installed

Opening the deep link routes directly to the shared community post.

### Post unavailable

The existing community detail route must continue to display its graceful unavailable state rather than redirecting the user to an unrelated feed destination.

### App not installed

Native-scheme links require Go Melanated to be installed. Once `EXPO_PUBLIC_SHARE_BASE_URL` is configured and associated-domain / Android App Link infrastructure is added, non-installed recipients should land on the public web fallback with an install/open-app path.

## Share analytics

A share is counted only after the native share sheet reports `Share.sharedAction`. Cancelling or dismissing the sheet must not increment share count.

The existing `community_post_shares` behavior remains the source of truth for post share counts.

## Architecture

The implementation should keep post-sharing logic centralized in the engagement component for this first release so every current post surface inherits the same behavior automatically, including:

- Outpost feed cards
- Community post detail / conversation view
- Any other screen already using `PostEngagementBar`

The same URL-builder pattern can later be extracted and reused for Adventures, Campfires, profiles, Communities, and Trail Guides.

## Acceptance criteria

- Sharing a post no longer sends only `Check out this post on Melanated.`
- Shared text contains `Go Melanated`.
- Shared text contains the post author's name when the post can be loaded.
- Shared text contains a body preview when the post has body text.
- Shared text contains a direct URL to `/community/{postId}`.
- Preview text is no longer than 160 characters before the truncation ellipsis.
- Sharing from both the Outpost feed and post detail screen uses the same payload.
- Cancelling the native share sheet does not increment the share count.
- A successful share continues to increment `community_post_shares`.
- If post context lookup fails, sharing still opens with a branded fallback message and direct post link.
