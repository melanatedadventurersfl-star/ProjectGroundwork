Offline support keeps the last successful Supabase read responses on-device for up to 90 days and falls back to them when the network is unavailable. This makes previously loaded member/profile data, tickets and trip details, Adventures, Passport records, and other database-backed read screens available offline after they have been opened online at least once.

Offline + Safety V1 extends that foundation for active outdoor use. Members can download an event pack containing core adventure details, schedule items, relevant announcements, permitted host updates, event coordinates, and an authorized host roster when the signed-in account has access. Adventure Safety Mode stores the active safety session and a lightweight breadcrumb trail in `ma-offline.db`. Breadcrumbs stay on the device by default.

Safety check-ins are local-first writes. `Starting`, `I'm okay`, `I'm back`, and `Need help` are written to the local queue before a server sync is attempted. Required session creation is processed before dependent check-ins, and `Need help` receives the highest user-action priority after that dependency. The UI distinguishes a locally recorded check-in from a server-delivered check-in. Losing service must never be presented as successful delivery.

Offline safety and field storage are scoped to the currently signed-in profile. Safety sessions, breadcrumbs, queued actions, downloaded event packs, locally saved roster sweep state, and Host Field Mode snapshots are cleared when the account signs out or when a different profile becomes the active owner of the local store.

Offline Communication + Host Field Mode extends the queue to operational writes that are safe to retry. Host and staff field actions can locally record attendee check-ins, headcounts, incidents, and host outing messages. Each queued record keeps its original field timestamp and uses an idempotent server identifier or unique conflict key. Explicit safety actions remain ahead of normal field operations in queue priority.

Host Field Mode caches the roster, schedule, headcounts, incidents, permitted host messages, and phone numbers needed for authorized event operations. Attendee email addresses are removed before local storage. Roster sweep state can mark people returned, still out, or needing follow-up without requiring a connection.

Host outing messages are persisted separately from delivery. A message marked `QUEUED` exists only on the host device until sync succeeds. A message marked `POSTED` is stored in Go Melanated, but that is not a read receipt and does not prove a recipient saw it. Members can refresh their event pack while connected and later read the host updates and announcements that were saved on their device. New remote updates cannot arrive while the device has no network path.

Normal RSVPs, community posts, media uploads, payments, support requests, and other write flows still require a connection unless their feature adds its own conflict-safe queue later.

Power behavior is conservative. Foreground route recording uses balanced location accuracy, a 30-meter movement threshold, and a 60-second Android time interval while the Safety screen is active. It stops when that screen is no longer active. The safety flow does not depend on unrestricted background location execution.

Offline Maps + Readiness adds a native MapLibre map layer for iOS and Android. A member can prepare an Adventure before leaving service, refresh its event pack, select a 3 km, 8 km, or 15 km map area, and download the selected region for offline use. The app tracks the native pack ID, progress, resource count, downloaded size, and completion state in a local manifest. A partial or failed map download never counts as ready.

The map style is configured through `EXPO_PUBLIC_MAP_STYLE_URL`. Production builds must point this at a MapLibre-compatible style from a provider that permits offline region downloads. No public tile service is hard-coded as a bulk-download source. Browser builds keep the readiness experience but do not attempt native offline map downloads.

Trip Readiness checks the current offline event pack, map region, saved event coordinates, schedule, and host announcements. The required readiness state is based on a fresh event pack, usable event coordinates, and a completed native map pack on iOS and Android. Schedule and announcement counts are shown as useful context but do not block readiness.

The breadcrumb recovery trace remains available in Adventure Safety Mode and complements the downloaded map. Full breadcrumb history stays local by default. Downloading a map does not enable continuous location tracking.

Remote images and newly requested private signed media may still require a connection unless the device already has them in its image cache. Host roster data is downloaded only when existing server authorization allows it. The event pack or host field snapshot should be removed when it is no longer needed.
