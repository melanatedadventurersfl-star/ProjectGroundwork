Offline support keeps the last successful Supabase read responses on-device for up to 90 days and falls back to them when the network is unavailable. This makes previously loaded member/profile data, tickets and trip details, Adventures, Passport records, and other database-backed read screens available offline after they have been opened online at least once.

Offline + Safety V1 extends that foundation for active outdoor use. Members can download an event pack containing core adventure details, schedule items, relevant announcements, event coordinates, and an authorized host roster when the signed-in account has access. Adventure Safety Mode stores the active safety session and a lightweight breadcrumb trail in `ma-offline.db`. Breadcrumbs stay on the device by default.

Safety check-ins are local-first writes. `Starting`, `I'm okay`, `I'm back`, and `Need help` are written to the local queue before a server sync is attempted. `Need help` receives the highest queue priority. The UI must distinguish a locally recorded check-in from a server-delivered check-in. Losing service must never be presented as successful delivery.

Safety sync is deliberately narrow. V1 queues safety session state and explicit safety check-ins only. Normal RSVPs, saves, posts, uploads, payments, support requests, and other writes still require a connection unless their feature adds its own conflict-safe queue later.

Power behavior is conservative. Foreground route recording uses balanced location accuracy, a 30-meter movement threshold, and a 60-second Android time interval while the Safety screen is active. It stops when that screen is no longer active. V1 does not depend on unrestricted background location execution.

The offline route view is a breadcrumb recovery trace, not a downloaded street or trail basemap. It continues to provide coordinates plus distance and bearing to the saved safe point or event location without data service. Full offline map tiles remain a separate provider integration.

Remote images and newly requested private signed media may still require a connection unless the device already has them in its image cache. Host roster data is downloaded only when existing server authorization allows it and should be removed with the event pack when no longer needed.
