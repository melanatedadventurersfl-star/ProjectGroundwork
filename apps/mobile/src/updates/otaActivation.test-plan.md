Manual validation:

- Publish a preview OTA and confirm the app offers the update only after fetchUpdateAsync reports isNew=true.
- Tap Update and confirm the expected update identity is persisted before reload.
- On successful boot, verify the expected identity matches Updates.updateId or buildCommit and is cleared.
- Simulate an emergency/rollback launch and verify the app reports that the update did not activate instead of claiming Latest Build.
