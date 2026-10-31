# Nandam Admin app

Expo SDK 57 · React Native 0.86 · Expo Router · JavaScript. Runs on Android and iOS phones and tablets.

Module 1 (Sign in) is built. The plan is in [`../../docs/modules/module-01-sign-in.md`](../../docs/modules/module-01-sign-in.md), and the approved mock-up is in `../../docs/design/ui-mockup/module-1-sign-in/`.

## Variants
- `APP_VARIANT=test` (default): **Nandam Admin (Test)**, app id `com.nandamhandlooms.admin.test`. It installs beside the shop's current app and never replaces it, and it allows plain HTTP to a developer's machine on the local Wi-Fi.
- `APP_VARIANT=production`: **Nandam Admin**, HTTPS only.

The server address is set at build time with `EXPO_PUBLIC_API_URL`, for example `http://192.168.0.4:4100/api/v2`.

## Commands
```
npm install --legacy-peer-deps
npm test                                   # app logic tests (Jest)
npx expo-doctor                            # project health check
CI=1 npx expo prebuild --clean             # generates android/ and ios/ (never edit them by hand)
EXPO_PUBLIC_API_URL=... npx expo run:android --variant release --device   # real Android phone over USB
EXPO_PUBLIC_API_URL=... npx expo run:ios --configuration Release --device # real iPhone (needs Apple signing)
```

## Layout
```
src/app/            screens (Expo Router). (auth) before sign-in, (welcome) right after setup or reset, (app) signed in
src/auth/           session (7-day sign-in, silent renewal), secure storage, device id, Face ID / fingerprint, drafts, journey state
src/api/            http (one place that talks to the server), client (adds and renews the access key), connectivity
src/components/     design-system pieces: buttons, banners, PIN and code boxes, woven header, dialogs, toasts, tab bar
src/theme/          tokens (Peacock palette, Plus Jakarta Sans, soft corners) and the light/dark theme
modules/nandam-biometrics/   our native module: Secure Enclave (iOS) / Keystore + BiometricPrompt (Android) signing keys
```

## Face ID / fingerprint
`modules/nandam-biometrics` creates a P-256 key inside the phone's security chip that can sign only after a successful biometric check (strong biometrics only on Android). The server keeps the public key and verifies signatures over one-time challenges. Details are in section 8.3 of the plan.
