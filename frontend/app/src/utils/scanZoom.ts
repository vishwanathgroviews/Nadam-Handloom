/**
 * How far the scanner's camera is zoomed in — iPhone only.
 *
 * On iPhone expo-camera opens the main wide lens and nothing else. That lens
 * cannot focus on something held close to it, so a small tag was a no-win:
 * near enough to fill the frame it was out of focus, far enough to be sharp
 * its bars were under two pixels wide and the reader could not separate them.
 * (Measured on the shop's own tags: a Code 128 label at about 2.0 px per bar
 * unit decoded, the smaller print of the same label at 1.7 px did not.)
 * Zooming in is the standard answer: staff hold the phone a hand away, where
 * the lens can focus, and the bars still come out several pixels wide.
 *
 * Android is left exactly as it was. Its reader works on the camera's
 * highest-resolution frame and its lenses focus closer, and the same tags
 * already scan there.
 *
 * Kept free of React Native imports so it can be unit-tested — the caller
 * passes Platform.OS in.
 */

/**
 * expo-camera's `zoom` prop for the iPhone scanner: 0 is not zoomed, 1 is the
 * most the lens allows, and the steps in between are multiplicative (the real
 * factor is maxZoom ** zoom). An iPhone's main lens usually reports a
 * maximum of 189 in the photo mode the scanner runs in, which makes this
 * about 2.5×; where it reports 124 it is about 2.3×. The maximum is not
 * something the app can read, so the exact factor is the phone's to decide.
 */
export const IOS_SCAN_ZOOM = 0.175;

/**
 * Far above the smallest change expo-camera acts on and far below anything
 * the eye can see — see scanZoom().
 */
const REAPPLY_STEP = 0.0001;

export const scanZoomAvailable = (os: string): boolean => os === 'ios';

/**
 * The `zoom` prop for the scanner's CameraView.
 *
 * `cameraReady` exists because the native side only touches the lens when
 * the prop *changes*. A zoom handed over while the camera is still starting
 * is set before the capture session is running, and whether it survives the
 * start is the operating system's business, not ours. So the value moves by
 * an invisible step the moment the camera reports ready, which makes the
 * native side set it once more on the running session. If the first one
 * held, nothing visibly happens; if it did not, this is the one that counts.
 */
export const scanZoom = (os: string, zoomedIn: boolean, cameraReady: boolean): number | undefined => {
  if (!scanZoomAvailable(os)) return undefined;
  if (!zoomedIn) return 0;
  return cameraReady ? IOS_SCAN_ZOOM : IOS_SCAN_ZOOM - REAPPLY_STEP;
};

// The 1× / zoom choice is remembered until the app is closed, not per
// scanner: Scan to Sell opens a fresh camera for every scan, and someone
// working through a pile of large labels should not have to switch the zoom
// off again each time. A restart goes back to zoomed in, the setting that
// reads every tag.
let zoomedInChoice = true;

export const isScanZoomedIn = (): boolean => zoomedInChoice;

export const setScanZoomedIn = (zoomedIn: boolean): void => {
  zoomedInChoice = zoomedIn;
};
