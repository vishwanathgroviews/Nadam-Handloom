// Lets the app see whether WhatsApp is installed, so it can hand a PDF
// straight to it.
//
// Since Android 11 an app can only see other apps it declares in <queries>.
// Without this, react-native-share's installed-check fails even when
// WhatsApp is there, and "Share Invoice on WhatsApp" would send staff to the
// Play Store instead of opening the customer's chat. Both the regular and the
// Business app are declared, since a shop phone often runs WhatsApp Business.
const { withAndroidManifest } = require('expo/config-plugins');

const PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];

module.exports = function withWhatsAppQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [{}];
    const queries = manifest.queries[0];
    queries.package = queries.package || [];
    for (const name of PACKAGES) {
      if (!queries.package.some((p) => p.$ && p.$['android:name'] === name)) {
        queries.package.push({ $: { 'android:name': name } });
      }
    }
    return cfg;
  });
};
