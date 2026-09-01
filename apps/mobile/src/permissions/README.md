# Web permission behavior

Go Melanated uses browser-native permission APIs on web instead of Expo native permission modules.

- Location: browser geolocation permission.
- Notifications: browser Notification permission when supported.
- Camera: browser media-device permission when supported.
- Photos: file-by-file browser picker access. Browsers do not grant full photo-library permission.
- Contacts: unavailable in unsupported browsers. Contact matching remains available in the mobile app.

The member permissions screen should never send web users to native device settings.
