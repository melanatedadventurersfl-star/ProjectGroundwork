# Go Melanated OTA update safety

The preview update flow treats download and activation as separate stages.

1. Expo reports a new update and the app downloads it.
2. Before reload, the app records the expected update identity.
3. On the next successful boot, the running OTA identity is compared with the expected one.
4. A mismatch or emergency launch is surfaced as an activation failure instead of being reported as current.

This prevents the indefinite-white-screen failure mode from silently reopening the prior bundle while diagnostics claim the update succeeded.
