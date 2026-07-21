# Melanated Adventurers Mobile App

This directory is the implementation home for the Melanated Adventurers member and host application.

## Selected stack

- Expo SDK 57
- React Native
- TypeScript
- Expo Router
- Supabase
- Stripe PaymentSheet

## Bootstrap command

From the repository root:

```bash
npx create-expo-app@latest apps/mobile --template default@sdk-57
```

Because this README occupies the target directory, move it temporarily or create the Expo app in a temporary directory and copy the generated files into `apps/mobile`.

## Required route groups

```text
app/
  (auth)/
  (tabs)/
  adventures/
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