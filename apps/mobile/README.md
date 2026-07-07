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

Use Expo Go to verify:

- Email/password sign-in and token persistence.
- Feed refresh, item detail, and open-link flows.
- Item detail edits for title, note, tags, folder, reminder, and URL archive requests.
- URL/text capture through `POST /api/v1/ingest`.
- SQLite offline queue display and manual sync.

Mobile item edits are online-only in Expo Go. The app sends bearer
`PATCH /api/v1/items/[id]`; the server uses timestamp last-write-wins across
web, extension, and mobile.

Expo Go intentionally skips remote push registration. Verified universal/app
links, share intents/extensions, native splash/icon changes, and store-parity
auth should be tested in a development build.

## Optional Expo Go flags

- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`,
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: enable the Google button.
- `EXPO_PUBLIC_EAS_PROJECT_ID`: required for Expo push token registration in a
  development build.

## Development builds

Development and preview build profiles live in `eas.json`. On a Mac or a
machine with EAS configured:

```bash
pnpm --dir apps/mobile start:dev-client
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

Set these variables in EAS before building:

- `EXPO_PUBLIC_API_URL`: public API base, for example
  `https://recallq.xyz/api/v1`.
- `EXPO_PUBLIC_WEB_URL`: public web origin, for OAuth and links.
- `EXPO_PUBLIC_EAS_PROJECT_ID`: Expo project ID used for push tokens.
- Google OAuth client IDs when Google sign-in should be shown.

Native-device verification checklist:

- Push token registration calls `POST /api/v1/devices/push`.
- Reminder push taps open `/item/[id]`.
- Item edits save on device networks that use the public API URL.
- `recallq://item/<id>` opens item detail.
- `https://recallq.xyz/item/<id>` opens the app when associated-domain and
  Android assetlinks files are deployed.
- Replace placeholders in `apps/web/public/.well-known/apple-app-site-association`
  and `apps/web/public/.well-known/assetlinks.json` with the Apple Team ID and
  Android signing certificate SHA-256 before production EAS verification.
- Android plain-text SEND intent appears in the system share sheet.
- iOS share extension is not implemented yet; keep this as a follow-up before
  App Store parity.
