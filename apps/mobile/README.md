# Melanated Adventurers Mobile App

This directory is the implementation home for the Melanated Adventurers member and host application.

## Selected stack

- Expo SDK 57
- React Native
- TypeScript
- Expo Router
- Supabase
- MapLibre React Native for native maps and offline regions

## Native development build

The mobile app includes native modules such as MapLibre. Use an Expo development build or EAS build for iOS and Android. Expo Go does not contain the required MapLibre native module.

Offline map regions also require `EXPO_PUBLIC_MAP_STYLE_URL` to point to a MapLibre-compatible style from a provider that permits offline region downloads.

## Required route groups

```text
app/
  (auth)/
  (tabs)/
  adventures/
  readiness/
  safety/
  checkout/
  host/
  _layout.tsx
```

## Initial tabs

1. Trailhead
2. Explore
3. Community
4. Passport
5. Menu

## First vertical slice

Account creation → profile → adventure detail → registration → payment → readiness → host roster → check-in → reflection.

See `docs/app-blueprint/technical-architecture-engineering-backlog-and-project-bootstrap.md` for the full build sequence.
