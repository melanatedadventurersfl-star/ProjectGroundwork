# Go Workout Samsung Health / Health Connect V1

## Goal

Allow an Android Go Workout user to grant read access to Samsung Health workout data through Android Health Connect, import completed exercise sessions into Workout history, and keep the source and consent state explicit.

## Product boundary

This feature belongs to Go Workout. It does not use Go Melanated profile, membership, community, or event data.

The browser experience cannot access Health Connect directly. The Android app owns permission requests and reads. The browser UI can display connection state and consume records only when it runs inside an Android wrapper that exposes the documented bridge.

## Data flow

Galaxy Watch → Samsung Health → Health Connect → Go Workout Android bridge → Workout history

V1 reads:
- exercise sessions
- heart rate
- total calories burned
- distance
- steps

V1 does not infer sets, reps, load, readiness, or progression from wearable data.

## Source filter

Samsung Health records are identified by the Health Connect data origin package:

`com.sec.android.app.shealth`

Records from other Health Connect sources are not imported by the Samsung Health sync action.

## Deduplication

Each imported workout keeps:
- provider
- Health Connect record ID
- source package
- import timestamp

The unique import key is `user_id + provider + external_record_id`. The browser history also uses a deterministic ID based on the same source record.

A repeated sync must not add the same workout twice.

## Android bridge contract

Channel: `goworkout-health-connect`

Supported actions:
- `getStatus`
- `requestPermissions`
- `revokePermissions`
- `readSamsungWorkouts`

The browser bridge accepts either:
- `window.GoWorkoutNativeHealth.request(action, payload)`
- React Native WebView `postMessage` request/response messages

## Privacy

Health access is opt-in. Go Workout requests only the read permissions selected by the user.

Heart rate and calorie data are not exposed to workout partners.

Disconnecting removes Go Workout's Health Connect permissions. Previously imported Workout history remains until the user removes those history records.

## Acceptance criteria

1. Samsung Health appears under Profile → Connected Health.
2. A normal browser never claims it can read Samsung Health.
3. Android permission state is read from Health Connect, not inferred from local UI state.
4. Samsung exercise sessions import into Workout history.
5. Average/peak heart rate, calories, distance, and steps can appear on imported workout details when present.
6. A repeated sync imports zero duplicates.
7. Non-Samsung Health origins are excluded from the Samsung sync.
8. Imported wearable sessions do not create fake strength sets, weights, reps, PRs, or progression evidence.
9. Connection and import metadata are protected by per-user row-level security.
10. Web CI runs normalization and duplicate-import tests.
