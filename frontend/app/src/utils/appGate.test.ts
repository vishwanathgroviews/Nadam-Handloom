import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../api/appConfig';
import { decideAppGate, wouldRequireUpdate } from './appGate';

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  maintenance: { enabled: false, message: '' },
  webMaintenance: { enabled: false, message: '' },
  android: { latestBuild: 23, minBuild: 21, forceUpdate: false, updateUrl: 'https://play.example/app' },
  ios: { latestBuild: 3, minBuild: 2, forceUpdate: false, updateUrl: 'https://testflight.example/app' },
  updatedAt: null,
  ...overrides,
});

const gate = (input: Partial<Parameters<typeof decideAppGate>[0]> = {}) =>
  decideAppGate({ config: config(), platform: 'android', build: 23, role: 'STAFF', ...input });

describe('decideAppGate', () => {
  it('opens the app normally when it is up to date', () => {
    expect(gate()).toEqual({ kind: 'ok' });
  });

  it('opens the app normally when the config could not be loaded', () => {
    expect(gate({ config: null, build: 1 })).toEqual({ kind: 'ok' });
  });

  it('requires an update below the minimum version, whether or not force update is on', () => {
    expect(gate({ build: 20 })).toEqual({ kind: 'update_required', updateUrl: 'https://play.example/app' });
  });

  it('only suggests an update between the minimum and the latest version when force update is off', () => {
    expect(gate({ build: 22 })).toEqual({ kind: 'update_available', updateUrl: 'https://play.example/app' });
    expect(gate({ build: 21 })).toEqual({ kind: 'update_available', updateUrl: 'https://play.example/app' });
  });

  it('requires every build below the latest to update when force update is on', () => {
    const forced = config({ android: { latestBuild: 23, minBuild: 21, forceUpdate: true, updateUrl: 'https://play.example/app' } });

    expect(gate({ config: forced, build: 22 })).toEqual({ kind: 'update_required', updateUrl: 'https://play.example/app' });
    expect(gate({ config: forced, build: 23 })).toEqual({ kind: 'ok' });
  });

  it('never holds back a build newer than the config knows about', () => {
    const forced = config({ android: { latestBuild: 23, minBuild: 23, forceUpdate: true, updateUrl: '' } });
    expect(gate({ config: forced, build: 24 })).toEqual({ kind: 'ok' });
  });

  it('judges each platform by its own numbers', () => {
    // Build 2 is far below Android's minimum but is the iPhone minimum.
    expect(gate({ platform: 'ios', build: 2 })).toEqual({ kind: 'update_available', updateUrl: 'https://testflight.example/app' });
    expect(gate({ platform: 'ios', build: 1 })).toEqual({ kind: 'update_required', updateUrl: 'https://testflight.example/app' });
    expect(gate({ platform: 'ios', build: 3 })).toEqual({ kind: 'ok' });
  });

  it('never blocks a build whose number could not be read', () => {
    const strict = config({ android: { latestBuild: 23, minBuild: 23, forceUpdate: true, updateUrl: '' } });
    expect(gate({ config: strict, build: 0 })).toEqual({ kind: 'ok' });
  });

  describe('maintenance', () => {
    const maintenance = config({ maintenance: { enabled: true, message: 'Stock count until 6 pm' } });

    it('locks out staff, with the message', () => {
      expect(gate({ config: maintenance })).toEqual({ kind: 'maintenance', message: 'Stock count until 6 pm' });
    });

    it('never locks out an owner, who has to be able to turn it off', () => {
      expect(gate({ config: maintenance, role: 'ADMIN' })).toEqual({ kind: 'ok' });
    });

    it('leaves the sign-in screen reachable while signed out', () => {
      expect(gate({ config: maintenance, role: null })).toEqual({ kind: 'ok' });
    });

    it('still shows an owner the update notice during maintenance', () => {
      expect(gate({ config: maintenance, role: 'ADMIN', build: 22 })).toEqual({
        kind: 'update_available',
        updateUrl: 'https://play.example/app',
      });
    });

    it('asks for a required update first, since the phone needs it either way', () => {
      expect(gate({ config: maintenance, build: 20 }).kind).toBe('update_required');
    });

    it('is not triggered by website maintenance', () => {
      const webOnly = config({ webMaintenance: { enabled: true, message: 'Back soon' } });
      expect(gate({ config: webOnly })).toEqual({ kind: 'ok' });
    });
  });
});

describe('wouldRequireUpdate', () => {
  it('warns when the new settings would lock out the phone saving them', () => {
    const settings = config({ android: { latestBuild: 24, minBuild: 24, forceUpdate: false, updateUrl: '' } });
    expect(wouldRequireUpdate(settings, 'android', 23)).toBe(true);
    expect(wouldRequireUpdate(settings, 'android', 24)).toBe(false);
  });

  it('counts force update against the latest version', () => {
    const settings = config({ ios: { latestBuild: 4, minBuild: 2, forceUpdate: true, updateUrl: '' } });
    expect(wouldRequireUpdate(settings, 'ios', 3)).toBe(true);
    expect(wouldRequireUpdate(config(), 'ios', 2)).toBe(false);
  });

  it('does not warn when the build number is unknown', () => {
    const settings = config({ android: { latestBuild: 99, minBuild: 99, forceUpdate: true, updateUrl: '' } });
    expect(wouldRequireUpdate(settings, 'android', 0)).toBe(false);
  });
});
