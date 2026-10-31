// App configuration (Expo). Two variants:
//   APP_VARIANT=test (default): "Nandam Admin (Test)", its own app id, so it installs
//     BESIDE the shop's current app and never replaces it during testing. Allows plain
//     HTTP to a developer's machine on the local Wi-Fi.
//   APP_VARIANT=production: the real app, HTTPS only.
//     iPhone (decided 2026-10-13, Module 11 decision 6.8): it is an UPDATE of the old staff
//     app on TestFlight, so it keeps that app's id, Expo project and build numbers (the old
//     app stopped at build 6). Raise IOS_BUILD for every upload.
//     Android: whether it replaces the old app (same app id + signing key) is still to decide.
import { withEntitlementsPlist } from 'expo/config-plugins';

const IS_PRODUCTION = process.env.APP_VARIANT === 'production';
// iPhone notifications need the shop's Apple push key and a signing profile with Push turned
// on. Until both are ready, iPhone builds leave the push permission out (IOS_PUSH=true adds it).
const IOS_PUSH = process.env.IOS_PUSH === 'true';
const withoutApplePushUntilReady = (config) => withEntitlementsPlist(config, (c) => {
  if (!IOS_PUSH) delete c.modResults['aps-environment'];
  return c;
});
const APP_ID = IS_PRODUCTION ? 'com.nandamhandlooms.admin' : 'com.nandamhandlooms.admin.test';
const IOS_APP_ID = IS_PRODUCTION ? 'com.nandamhandlooms.staff' : APP_ID;
const IOS_BUILD = IS_PRODUCTION ? '11' : '1';
// The old staff app's Expo project (iPhone builds are made on Expo's cloud).
const EAS_PROJECT = { slug: 'nandam-handlooms', id: '23fffe49-44ca-40e0-ab15-083196d5b3eb' };

export default () => ({
  name: IS_PRODUCTION ? 'Nandam Admin' : 'Nandam Admin (Test)',
  slug: IS_PRODUCTION ? EAS_PROJECT.slug : 'nandam-admin',
  owner: 'groviews.com',
  version: '2.0.0',
  scheme: 'nandamadmin',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic', // design choice: theme follows the phone
  ios: {
    bundleIdentifier: IOS_APP_ID,
    buildNumber: IOS_BUILD,
    supportsTablet: true,
    infoPlist: {
      NSFaceIDUsageDescription: 'Nandam Admin uses Face ID so you can sign in without typing your PIN.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: APP_ID,
    // The live app started at 26 (after the old staff app's 25) so the server's update check
    // (newest Android = 23 on 15 Oct 2026) never says a newer version is out. Raise it per build.
    versionCode: IS_PRODUCTION ? 32 : 1,
    // Firebase (project nandam-cf952): notifications for each online payment (owners).
    // The file is private (not in git); it holds both app ids (live and test).
    googleServicesFile: './google-services.json',
    allowBackup: false, // sign-in keys must never be restored onto another phone
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#3A0D12' },
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: 'Nandam Admin uses Face ID so you can sign in without typing your PIN.' }],
    'expo-font',
    ['expo-image-picker', {
      cameraPermission: 'Nandam Admin uses the camera to take photos for the catalogue and of sarees.',
      photosPermission: 'Nandam Admin uses your photos to add sarees and pictures to the catalogue.',
      microphonePermission: false,
    }],
    // Module 4: scanning saree tags and Quick add photos. No microphone, no audio.
    ['expo-camera', {
      cameraPermission: 'Nandam Admin uses the camera to scan saree tags and take saree photos.',
      microphonePermission: false,
      recordAudioAndroid: false,
    }],
    ['expo-splash-screen', { image: './assets/logo.png', imageWidth: 160, backgroundColor: '#073F43', dark: { backgroundColor: '#062826' } }],
    // Listed before expo-notifications on purpose: plugins listed later change the files first,
    // so this one runs after it and can take the iPhone push permission out again.
    withoutApplePushUntilReady,
    // Owners: a notification for each online payment and refund (Online payments).
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#0D5C61', defaultChannel: 'payments' }],
    ['expo-build-properties', {
      android: { usesCleartextTraffic: !IS_PRODUCTION },
      ios: {},
    }],
  ],
  extra: { variant: IS_PRODUCTION ? 'production' : 'test', ...(IS_PRODUCTION ? { eas: { projectId: EAS_PROJECT.id } } : {}) },
});
