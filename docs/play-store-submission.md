# Go Melanated — Google Play Submission Pack

Prepared for the first Android release of **Go Melanated** (`com.melanatedadventurers.app`).

## Store listing

### App name

Go Melanated

### Short description

Find outdoor adventures, community, trails and places to explore together.

### Full description

Go Melanated is an outdoor adventure and community app built to make it easier to discover places, plan experiences, connect with other explorers, and keep your outdoor life organized in one place.

Discover Adventures and outdoor destinations, explore local trail and place recommendations, and find inspiration for your next trip through the Trail Guide. Join conversations in Outpost, connect with people who share your interests, and build a profile that reflects the places you have been and the experiences you are building.

Go Melanated also helps members keep up with the practical side of adventure. Depending on the experience, you can view event details, manage participation, access reservations or tickets, see local information, and keep important adventure details close at hand.

Core experiences include:

- Discovering Adventures and outdoor places
- Exploring trails, local destinations, guides, tips, and outdoor resources
- Joining community conversations and curated groups
- Connecting with other members and viewing member profiles
- Saving favorites and tracking experiences through your Passport
- Viewing reservations, tickets, and participation details for supported Adventures
- Using location-aware nearby discovery and local weather when permission is granted
- Adding photos to your Passport memories
- Receiving relevant app notifications when enabled

Go Melanated is designed to bring discovery, community, and practical trip information together without turning outdoor exploration into another pile of tabs.

Location, camera, photo-library, and notification permissions are optional and are requested only when a feature needs them.

## Suggested Play category

**Travel & Local** is the primary recommendation because discovery, outdoor destinations, local Adventures, trails, and place-based exploration are central to the product. Re-evaluate before final submission if Google Play offers a more specific category that better matches the final production feature set.

## Store assets checklist

Google Play currently requires:

- App icon: 512 x 512 PNG, 32-bit with alpha, maximum 1024 KB
- Feature graphic: 1024 x 500 JPEG or 24-bit PNG without alpha
- At least 2 screenshots to publish
- Recommended for apps: at least 4 high-quality screenshots at 1080 px or greater
- Portrait recommendation: 9:16, at least 1080 x 1920
- Screenshots should show the real app experience and should not rely on device frames

### Recommended first screenshot set

1. **Adventures** — discovery feed with a strong adventure card and nearby/local context
2. **Adventure detail** — title/location card, event details, attendance or reservation state
3. **Trail Guide** — local outdoor discovery, trails, guides, tips, and place recommendations
4. **Outpost** — community feed and discussion experience
5. **Passport/Profile** — rank, memories, favorites, badges, or adventure history
6. **Nearby discovery** — list-oriented local places experience

Avoid screenshots containing test data that looks broken, placeholder email addresses, debug UI, internal admin controls, or personally identifiable test-user information.

## Public policy URLs

Use these after confirming the GitHub Pages deployment is live:

- Privacy Policy: `https://melanatedadventurersfl-star.github.io/ProjectGroundwork/privacy/`
- Account deletion: `https://melanatedadventurersfl-star.github.io/ProjectGroundwork/account-deletion/`

Do not enter either URL in Play Console until it resolves publicly without authentication.

## Data Safety draft

This is a submission worksheet, not a final declaration. The final Play Console answers must match the exact production build, backend behavior, and third-party SDK behavior.

### Does the app collect user data?

**Yes.** The production app uses accounts and connected backend services and can transmit user-provided and feature-related data off device.

### Does the app share user data?

**Needs final SDK/backend confirmation before submission.** Do not mark data as shared merely because it is processed by a service provider acting on the developer's behalf, but confirm Google Play's current definition against every production processor and SDK.

### Data types expected to require disclosure

| Google Play data family | Likely data | Purpose | Required / optional | Final verification |
| --- | --- | --- | --- | --- |
| Personal info | Email address, name/profile information, account identifiers | Account management, authentication, community profile, app functionality | Required for account features | Confirm exact profile fields |
| Location | Approximate and/or precise location when permission is granted | Nearby Adventures/places and local weather | Optional | Confirm precision transmitted and retention |
| Photos and videos | User-selected or camera-captured photos | Passport memories, profile/community features where supported | Optional | Confirm all upload destinations and retention |
| Messages / user-generated content | Posts, comments, discussion content, group/community contributions | Community functionality | Optional | Confirm Play data-type mapping |
| App activity | Favorites, joins/RSVPs, participation state, interaction history | App functionality, personalization, account history | Mix of required/optional | Confirm analytics or behavioral tracking, if any |
| Purchases / transaction information | Reservation/order/ticket records where supported | Fulfillment, accounting, customer support | Feature-dependent | Confirm whether payment-card data ever reaches the app or only a payment processor |
| Device or other IDs | Push-notification token and technical identifiers required by SDKs | Notifications, security, app operations | Optional/technical | Confirm Expo/Supabase production behavior |
| Other info | Waiver acceptance, safety/audit records, referral/invite state where applicable | Legal, safety, fraud prevention, app functionality | Feature-dependent | Confirm exact production tables and flows |

### Security questions

Before submitting the Data Safety form, verify:

- Data is encrypted in transit using HTTPS/TLS.
- Account deletion is available in-app and through the public web resource.
- The privacy policy explains deletion, retention, and legitimate retention exceptions.
- No SDK introduces advertising or cross-app tracking that has not been declared.
- Any analytics SDK, crash reporter, map provider, payment provider, or notification service present in the production artifact is included in the audit.

## Account deletion answer

**Yes, users can request deletion.**

Go Melanated provides:

1. an in-app **Delete Account** flow; and
2. a public account-deletion web resource.

The current implementation creates a controlled deletion request so identity can be verified and records can be deleted or anonymized appropriately. Records that must be retained for legitimate security, fraud-prevention, legal, transaction, waiver, or regulatory reasons must be limited to what is necessary and disclosed in the privacy policy.

## App access / reviewer notes draft

Use a dedicated review account if Google Play review cannot evaluate the main experience without signing in.

Suggested reviewer note:

> Go Melanated is an outdoor adventure and community application. A signed-in account is required for member-specific features such as joining Adventures, community participation, Passport/profile features, reservations, and account settings. Location, camera/photo-library, and notification permissions are optional. Reviewers can decline those permissions and still inspect the primary application experience. Account deletion is available from the app menu under Account > Delete Account.

Before submission, replace this section with the actual reviewer credentials and any precise navigation instructions required by the production build. Never commit reusable production passwords to the repository.

## App content declarations to complete in Play Console

- Privacy Policy
- Data Safety
- Account deletion URL
- App access / reviewer credentials if sign-in is required
- Ads declaration
- Content rating questionnaire
- Target audience and content
- News-app declaration if Google asks and it is applicable
- Permissions declarations if Play Console flags any permission for additional review

### Ads

Expected answer: **No**, unless advertising SDKs or paid promotional placements are introduced before submission. Reconfirm against the final dependency tree and product behavior.

## Support contact

**BLOCKED: official support email not yet selected/configured.**

The final support email should be an address controlled by the Go Melanated operator and should also be reflected consistently in the Play listing and privacy/support experience where appropriate.

## Production release commands

From the repository root:

```bash
npm --workspace @ma/mobile run eas:production:android
```

This invokes the configured EAS production Android build and should produce an Android App Bundle (`.aab`).

After the Google Play app record, service-account credentials, and EAS submission credentials are configured:

```bash
npm --workspace @ma/mobile run eas:submit:android
```

Do not submit until the Play Console application uses the same package identifier: `com.melanatedadventurers.app`.

## Pre-upload release gate

Before uploading the first `.aab`:

- [ ] Developer account identity verification is complete, or Google allows the intended testing-track action while verification is pending
- [ ] Public Privacy Policy URL resolves
- [ ] Public Account Deletion URL resolves
- [ ] Official support email is selected
- [ ] Store listing copy is entered
- [ ] 512 x 512 Play icon is validated
- [ ] 1024 x 500 feature graphic is ready
- [ ] At least 4 phone screenshots are ready at 1080 x 1920 or better
- [ ] Data Safety answers are reconciled against the final production dependency tree and backend
- [ ] App content declarations are completed
- [ ] Review account/instructions are prepared if required
- [ ] Production `.aab` is generated from `main`
- [ ] Internal or closed testing track is selected
- [ ] Required tester/device verification rules for this developer-account type are satisfied

## Source-of-truth note

Google Play policies and asset requirements change. Recheck the live Play Console Help documentation on the day the listing and Data Safety form are submitted.