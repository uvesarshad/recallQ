# RecallQ Mobile

Expo SDK 52 app for development with Expo Go and production/dev-client builds.

## Expo Go development

Start the web API first, then start the mobile app:

```bash
pnpm dev
pnpm --dir apps/mobile start
```

In development the app uses `EXPO_PUBLIC_API_URL` when provided. If it is not set,
the app derives the LAN host from Expo/Metro and calls `http://<metro-host>:3008/api/v1`.
Set the URL explicitly when your web server runs elsewhere:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.42:3008/api/v1 pnpm --dir apps/mobile start
```

Expo Go is intended for the normal feed, item detail, email/password sign-in,
in-app capture, and SQLite offline queue flows. Remote push delivery,
verified universal/app links, native splash/icon changes, and store-parity auth
should be tested in a development build.

## Optional Expo Go flags

- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`,
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: enable the Google button.
- `EXPO_PUBLIC_EAS_PROJECT_ID`: required for Expo push token registration in a
  development build.
