// Generates every launcher/browser icon the app and the website need from the
// one source logo (repo-root Images/NH_Logo_HD_Transparent.png), so there is a
// single place the mark is defined and no hand-resized copies drift from it.
//
// Run with: node scripts/generate-brand-icons.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(REPO_ROOT, 'Images', 'NH_Logo_HD_Transparent.png');
const APP_ASSETS = path.join(REPO_ROOT, 'frontend', 'app', 'assets');
const WEB_PUBLIC = path.join(__dirname, '..', 'public');

// The logo's own maroon ground, used wherever a transparent PNG would
// otherwise sit on whatever the launcher/browser puts behind it.
const MAROON = '#5C1420';

const flatten = (pipeline) => pipeline.flatten({ background: MAROON });

async function run() {
  mkdirSync(APP_ASSETS, { recursive: true });
  mkdirSync(WEB_PUBLIC, { recursive: true });

  const outputs = [];

  // ---- Staff app (Expo) ----
  // icon.png: the square master Expo slices for iOS and the legacy Android
  // launcher. Opaque, because iOS refuses alpha in an app icon.
  outputs.push([
    path.join(APP_ASSETS, 'icon.png'),
    await flatten(sharp(SRC).resize(1024, 1024, { fit: 'contain', background: MAROON })).png().toBuffer(),
  ]);

  // adaptive-icon.png: Android masks this to a circle/squircle and can crop
  // up to ~33%, so the mark is inset into the safe zone rather than filling
  // the square — otherwise the outer "WEAVING TRADITION" ring gets shaved off.
  const adaptiveInner = await sharp(SRC).resize(648, 648, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  outputs.push([
    path.join(APP_ASSETS, 'adaptive-icon.png'),
    await sharp({ create: { width: 1080, height: 1080, channels: 4, background: MAROON } })
      .composite([{ input: adaptiveInner, gravity: 'center' }])
      .png()
      .toBuffer(),
  ]);

  // splash.png: the mark on the brand ground while the JS bundle loads.
  const splashInner = await sharp(SRC).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  outputs.push([
    path.join(APP_ASSETS, 'splash.png'),
    await sharp({ create: { width: 1284, height: 1284, channels: 4, background: MAROON } })
      .composite([{ input: splashInner, gravity: 'center' }])
      .png()
      .toBuffer(),
  ]);

  // splash-logo.png: the mark alone on transparency. The native launch
  // screen draws it on the brand colour, and the animated in-app splash
  // (components/AppSplash.tsx) draws the very same file at the same size,
  // so the hand-over between the two is invisible.
  outputs.push([
    path.join(APP_ASSETS, 'splash-logo.png'),
    await sharp(SRC).resize(600, 600, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
  ]);

  // favicon.png for Expo's web target.
  outputs.push([
    path.join(APP_ASSETS, 'favicon.png'),
    await flatten(sharp(SRC).resize(64, 64, { fit: 'contain', background: MAROON })).png().toBuffer(),
  ]);

  // ---- Customer website ----
  // Replaces the purple Vite default that was still showing in the tab.
  for (const size of [16, 32, 180, 512]) {
    const name = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}.png`;
    outputs.push([
      path.join(WEB_PUBLIC, name),
      await flatten(sharp(SRC).resize(size, size, { fit: 'contain', background: MAROON })).png().toBuffer(),
    ]);
  }

  for (const [file, buffer] of outputs) {
    writeFileSync(file, buffer);
    console.log(`${path.relative(REPO_ROOT, file)} — ${buffer.length} bytes`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
