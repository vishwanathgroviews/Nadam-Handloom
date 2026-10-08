import { afterEach, describe, expect, it } from 'vitest';
import { IOS_SCAN_ZOOM, isScanZoomedIn, scanZoom, scanZoomAvailable, setScanZoomedIn } from './scanZoom';

// The main lens's usual reported maximum in the scanner's photo mode, and
// the formula expo-camera's iOS code applies to the prop
// (CameraSessionManager.updateZoom): factor = maxZoom ** zoom.
const IPHONE_MAX_ZOOM = 189;
const realFactor = (zoom: number) => IPHONE_MAX_ZOOM ** zoom;

describe('scanZoom', () => {
  it('zooms the iPhone scanner in by about two and a half times', () => {
    const zoom = scanZoom('ios', true, true);
    expect(zoom).toBe(IOS_SCAN_ZOOM);
    expect(realFactor(zoom as number)).toBeGreaterThan(2.4);
    expect(realFactor(zoom as number)).toBeLessThan(2.6);
  });

  it('leaves Android exactly as it was: no zoom prop at all', () => {
    expect(scanZoomAvailable('android')).toBe(false);
    for (const zoomedIn of [true, false]) {
      for (const ready of [true, false]) {
        expect(scanZoom('android', zoomedIn, ready)).toBeUndefined();
      }
    }
  });

  it('goes back to the plain 1× view when the zoom is switched off', () => {
    expect(scanZoom('ios', false, false)).toBe(0);
    expect(scanZoom('ios', false, true)).toBe(0);
    expect(realFactor(0)).toBe(1);
  });

  // The native side sets the lens only when the prop changes, so the value
  // has to move when the camera reports ready — and by more than the
  // smallest difference expo-camera acts on (Double.ulpOfOne, about 2.2e-16).
  it('hands the camera a new value once it is ready, so the zoom is set again on the running camera', () => {
    const starting = scanZoom('ios', true, false) as number;
    const ready = scanZoom('ios', true, true) as number;
    expect(starting).not.toBe(ready);
    expect(Math.abs(ready - starting)).toBeGreaterThan(Number.EPSILON * 1000);
  });

  it('starts at practically the same zoom, so nothing visibly jumps when the camera becomes ready', () => {
    const starting = realFactor(scanZoom('ios', true, false) as number);
    const ready = realFactor(scanZoom('ios', true, true) as number);
    expect(Math.abs(ready - starting) / ready).toBeLessThan(0.001);
  });
});

describe('the remembered zoom choice', () => {
  afterEach(() => setScanZoomedIn(true));

  it('starts zoomed in, the setting that reads the small tags', () => {
    expect(isScanZoomedIn()).toBe(true);
  });

  it('keeps the last choice for the next scanner that opens', () => {
    setScanZoomedIn(false);
    expect(isScanZoomedIn()).toBe(false);
    setScanZoomedIn(true);
    expect(isScanZoomedIn()).toBe(true);
  });
});
