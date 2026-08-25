# Go Melanated launcher icon

The approved production launcher artwork in this directory is the canonical native app icon.

Build rules:
- Do not reference retired launcher artwork in app.json or app.config.js.
- Android uses the canonical finished square via `android.icon`; do not feed the finished square into `adaptiveIcon.foregroundImage`.
- Increment `extra.nativeBuildAssetRevision` whenever launcher artwork changes so native build diagnostics clearly identify the asset revision.
- Launcher-icon changes require a fresh native build; OTA updates cannot replace the installed launcher icon.
